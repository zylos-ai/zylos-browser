/**
 * Display Manager — Xvfb/VNC/noVNC management
 *
 * Manages virtual display infrastructure as shared resources.
 * Uses standard PM2 names (zylos-xvfb, zylos-vnc) so any component
 * needing a display can check and start them.
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { getConfig, ZYLOS_DIR } from './config.js';

const execFile = promisify(execFileCb);

/**
 * Check if a PM2 process is running by name
 */
async function isPM2Running(name) {
  try {
    const { stdout } = await execFile('pm2', ['jlist'], { timeout: 10000 });
    const list = JSON.parse(stdout);
    return list.some(p => p.name === name && p.pm2_env?.status === 'online');
  } catch {
    return false;
  }
}

/**
 * Ensure Xvfb display is running
 * Checks for existing zylos-xvfb PM2 process, starts if not running.
 *
 * @param {object} options - Override display settings
 * @returns {{ display: string, started: boolean }}
 */
export async function ensureDisplay(options = {}) {
  const config = getConfig();
  const displayNum = options.displayNumber ?? config.display?.number ?? 99;
  const resolution = options.resolution || config.display?.resolution || '1280x1024x24';
  const display = `:${displayNum}`;

  const isRunning = await isPM2Running('zylos-xvfb');
  if (isRunning) {
    return { display, started: false };
  }

  // Start Xvfb via PM2
  try {
    await execFile('pm2', [
      'start', 'Xvfb',
      '--name', 'zylos-xvfb',
      '--', display, `-screen`, `0`, resolution
    ], { timeout: 15000 });
    // Wait for Xvfb to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { display, started: true };
  } catch (err) {
    throw new Error(`Failed to start Xvfb: ${err.message}`);
  }
}

/**
 * Get status of display infrastructure
 *
 * @returns {{ xvfb: boolean, vnc: boolean, novnc: boolean, display: string }}
 */
export async function getDisplayStatus() {
  const config = getConfig();
  const display = `:${config.display?.number ?? 99}`;

  const [xvfb, vnc] = await Promise.all([
    isPM2Running('zylos-xvfb'),
    isPM2Running('zylos-vnc')
  ]);

  // noVNC runs as part of zylos-vnc (websockify), check port
  let novnc = false;
  if (vnc) {
    const novncPort = Number(config.vnc?.novnc_port ?? 6080);
    try {
      const { stdout: ssOutput } = await execFile('ss', ['-tlnp'], { timeout: 5000 });
      novnc = ssOutput.includes(`:${novncPort}`);
    } catch {
      // Port not listening
    }
  }

  return { xvfb, vnc, novnc, display };
}

/**
 * Get the noVNC URL for visual access
 *
 * @param {object} config - Configuration object
 * @returns {string} noVNC URL
 */
export function getVNCUrl(config) {
  config = config || getConfig();
  // URL is proxied through nginx — port is not in the URL
  return `https://zylos10.jinglever.com/vnc/vnc.html?path=vnc/websockify&autoconnect=true`;
}

/**
 * Start VNC (x11vnc + noVNC websockify) via PM2
 *
 * @param {object} options - Override VNC settings
 * @returns {{ vncPort: number, novncPort: number, url: string }}
 */
export async function startVNC(options = {}) {
  const config = getConfig();
  const displayNum = Number(options.displayNumber ?? config.display?.number ?? 99);
  const vncPort = Number(options.vncPort ?? config.vnc?.port ?? 5900);
  const novncPort = Number(options.novncPort ?? config.vnc?.novnc_port ?? 6080);

  if (!Number.isInteger(displayNum) || !Number.isInteger(vncPort) || !Number.isInteger(novncPort)) {
    throw new Error('Invalid display/VNC port configuration — must be integers');
  }

  const isRunning = await isPM2Running('zylos-vnc');
  if (isRunning) {
    return { vncPort, novncPort, url: getVNCUrl(config) };
  }

  // Ensure display is running first
  await ensureDisplay(options);

  // Start x11vnc + noVNC via a script
  // x11vnc connects to the Xvfb display, noVNC provides web access
  const vncScript = `x11vnc -display :${displayNum} -rfbport ${vncPort} -shared -forever -nopw -bg 2>/dev/null; ` +
    `websockify --web /usr/share/novnc ${novncPort} localhost:${vncPort}`;

  try {
    await execFile('pm2', [
      'start', 'bash',
      '--name', 'zylos-vnc',
      '--', '-c', vncScript
    ], { timeout: 15000 });

    await new Promise(resolve => setTimeout(resolve, 2000));
    return { vncPort, novncPort, url: getVNCUrl(config) };
  } catch (err) {
    throw new Error(`Failed to start VNC: ${err.message}`);
  }
}

/**
 * Stop VNC services (does NOT stop Xvfb — it's shared)
 */
export async function stopVNC() {
  try {
    await execFile('pm2', ['delete', 'zylos-vnc'], { timeout: 10000 });
  } catch {
    // Already stopped or doesn't exist
  }
}

/**
 * Request human intervention — notify user and wait
 *
 * Sends a message via C4 comm-bridge notifying the user that
 * manual action is needed (login, captcha, etc.), with a VNC link.
 *
 * @param {string} reason - Why intervention is needed
 * @param {string} notifyChannel - Channel to notify (default: browser)
 * @returns {Promise<void>} Resolves after sending notification (fire-and-forget)
 */
export async function requestHumanIntervention(reason, notifyChannel = 'browser') {
  const config = getConfig();
  const vncUrl = getVNCUrl(config);

  const C4_RECEIVE = path.join(ZYLOS_DIR, '.claude/skills/comm-bridge/scripts/c4-receive.js');
  const message = `[BROWSER] Manual action needed: ${reason}\nVNC: ${vncUrl}`;

  try {
    await execFile('node', [
      C4_RECEIVE,
      '--channel', notifyChannel,
      '--no-reply',
      '--content', message
    ], { timeout: 10000 });
  } catch (err) {
    console.error(`[display] Failed to send intervention request: ${err.message}`);
    // Don't throw — the intervention request is best-effort
  }
}
