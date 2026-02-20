/**
 * Display Manager — Xvfb/VNC/noVNC management
 *
 * Manages virtual display infrastructure as shared resources.
 * Uses standard PM2 names (zylos-xvfb, zylos-vnc) so any component
 * needing a display can check and start them.
 */

import { execFile as execFileCb, execSync } from 'node:child_process';
import crypto from 'node:crypto';
import os from 'node:os';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { getConfig, DATA_DIR, ZYLOS_DIR } from './config.js';

const execFile = promisify(execFileCb);

/**
 * Discover Puppeteer-installed Chrome binaries.
 * These are non-snap and avoid confinement issues with user-data-dir.
 */
function findPuppeteerChromes() {
  try {
    const puppeteerDir = path.join(os.homedir(), '.cache/puppeteer/chrome');
    if (!fs.existsSync(puppeteerDir)) return [];
    return fs.readdirSync(puppeteerDir)
      .sort().reverse()
      .map(v => path.join(puppeteerDir, v, 'chrome-linux64/chrome'))
      .filter(p => fs.existsSync(p));
  } catch {
    return [];
  }
}

/** Chrome binary candidates in preference order */
const CHROME_CANDIDATES = [
  'google-chrome-stable',
  'google-chrome',
  ...findPuppeteerChromes(),
  'chromium-browser',
  'chromium',
];

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
 * Find the noVNC web directory for websockify --web flag.
 * Returns null if not found (websockify will run as pure proxy).
 */
function findNoVNCPath() {
  const candidates = [
    '/usr/share/novnc',
    '/usr/share/noVNC',
    '/usr/local/share/noVNC',
    '/snap/novnc/current',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
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
 * Find the Chrome/Chromium binary on this system.
 * @returns {string|null} Path to Chrome binary, or null if not found
 */
export function findChromeBinary() {
  for (const bin of CHROME_CANDIDATES) {
    try {
      if (path.isAbsolute(bin)) {
        if (fs.existsSync(bin)) return bin;
      } else {
        const result = execSync(`which ${bin}`, { encoding: 'utf-8', stdio: 'pipe' }).trim();
        if (result) return result;
      }
    } catch {
      // not found, try next
    }
  }
  return null;
}

/**
 * Ensure Chrome is running with CDP enabled via PM2.
 *
 * @param {object} options - Override settings
 * @returns {{ cdpPort: number, started: boolean }}
 */
export async function ensureChrome(options = {}) {
  const config = getConfig();
  const cdpPort = options.cdpPort ?? config.cdp_port ?? 9222;
  const displayNum = options.displayNumber ?? config.display?.number ?? 99;

  const isRunning = await isPM2Running('zylos-chrome');
  if (isRunning) {
    return { cdpPort, started: false };
  }

  const chromeBin = findChromeBinary();
  if (!chromeBin) {
    throw new Error('Chrome/Chromium not found. Install with: sudo apt-get install -y chromium-browser');
  }

  const chromeArgs = [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${DATA_DIR}/chrome-profile`,
    '--no-first-run',
    '--no-default-browser-check',
    '--no-sandbox',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-translate',
    '--disable-extensions',
    '--disable-default-apps',
    '--disable-features=TranslateUI',
    '--window-size=1920,1080',
    '--window-position=0,0',
    'about:blank',
  ].join(' ');

  // Use bash -c to launch Chrome so PM2 doesn't try to interpret it as Node.js
  const script = `DISPLAY=:${displayNum} ${chromeBin} ${chromeArgs}`;

  try {
    await execFile('pm2', [
      'start', 'bash',
      '--name', 'zylos-chrome',
      '--', '-c', script
    ], { timeout: 15000 });

    // Wait for Chrome to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    return { cdpPort, started: true };
  } catch (err) {
    throw new Error(`Failed to start Chrome: ${err.message}`);
  }
}

/**
 * Stop Chrome PM2 process
 */
export async function stopChrome() {
  try {
    await execFile('pm2', ['delete', 'zylos-chrome'], { timeout: 10000 });
  } catch {
    // Already stopped or doesn't exist
  }
}

/**
 * Get status of display infrastructure
 *
 * @returns {{ xvfb: boolean, chrome: boolean, vnc: boolean, novnc: boolean, display: string }}
 */
export async function getDisplayStatus() {
  const config = getConfig();
  const display = `:${config.display?.number ?? 99}`;

  const [xvfb, chrome, vnc] = await Promise.all([
    isPM2Running('zylos-xvfb'),
    isPM2Running('zylos-chrome'),
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

  return { xvfb, chrome, vnc, novnc, display };
}

/**
 * Get the noVNC URL for visual access
 *
 * @param {object} config - Configuration object
 * @returns {string} noVNC URL
 */
export function getVNCUrl(config) {
  config = config || getConfig();
  let domain = 'localhost';
  try {
    const zylosConfig = JSON.parse(fs.readFileSync(
      path.join(ZYLOS_DIR, '.zylos/config.json'), 'utf8'
    ));
    if (zylosConfig.domain) domain = zylosConfig.domain;
  } catch {
    // config.json not found — use localhost
  }
  return `https://${domain}/vnc/vnc.html?path=vnc/websockify&autoconnect=true`;
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

  // Ensure VNC password file exists
  const vncPasswdFile = path.join(DATA_DIR, '.vncpasswd');
  let authFlags = '-nopw';
  try {
    if (!fs.existsSync(vncPasswdFile)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      // Generate a random 8-char password and store it
      const password = crypto.randomBytes(6).toString('base64').slice(0, 8);
      execSync(`x11vnc -storepasswd ${password} ${vncPasswdFile}`, { stdio: 'pipe' });
    }
    if (fs.existsSync(vncPasswdFile)) {
      authFlags = `-rfbauth ${vncPasswdFile}`;
    }
  } catch {
    // Fall back to -nopw if password setup fails
  }

  // Detect noVNC web directory for websockify --web flag
  const novncPath = findNoVNCPath();
  const webFlag = novncPath ? `--web ${novncPath} ` : '';

  // Start x11vnc + noVNC via a script
  // x11vnc connects to the Xvfb display, noVNC provides web access
  const vncScript = `x11vnc -display :${displayNum} -rfbport ${vncPort} -shared -forever ${authFlags} -bg 2>/dev/null; ` +
    `websockify ${webFlag}${novncPort} localhost:${vncPort}`;

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
