#!/usr/bin/env node
/**
 * Post-install hook for zylos-browser
 *
 * Called by Claude after CLI installation (zylos add --json).
 * CLI handles: download, npm install, manifest, registration.
 * Claude handles: config collection, this hook.
 *
 * This hook handles browser-specific setup:
 * 1. Create data subdirectories
 * 2. Create default config.json
 * 3. Check system dependencies
 * 4. Setup shared display infrastructure
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const HOME = process.env.HOME;
const DATA_DIR = path.join(HOME, 'zylos/components/browser');

const INITIAL_CONFIG = {
  enabled: true,
  cdp_port: 9222,
  headless: false,
  display: { number: 99, resolution: '1280x1024x24' },
  vnc: { enabled: true, port: 5900, novnc_port: 6080 },
  knowledge: { auto_save: true, max_gotchas_per_domain: 50 },
  sequences: { timeout_default: 30000, retry_on_failure: true, max_retries: 2 },
  screenshots: { auto_save: false, directory: 'screenshots' }
};

console.log('[post-install] Running browser-specific setup...\n');

// 1. Create data subdirectories
console.log('Creating data directories...');
const subdirs = ['knowledge', 'sequences', 'screenshots', 'logs'];
for (const dir of subdirs) {
  fs.mkdirSync(path.join(DATA_DIR, dir), { recursive: true });
  console.log(`  - ${dir}/`);
}

// 2. Create default config if not exists
const configPath = path.join(DATA_DIR, 'config.json');
if (!fs.existsSync(configPath)) {
  console.log('\nCreating default config.json...');
  fs.writeFileSync(configPath, JSON.stringify(INITIAL_CONFIG, null, 2));
  console.log('  - config.json created');
} else {
  console.log('\nConfig already exists, skipping.');
}

// 3. Check system dependencies
console.log('\nChecking dependencies...');
const deps = [
  { name: 'agent-browser', check: 'which agent-browser', msg: 'Install: npm install -g agent-browser' },
  { name: 'Chrome/Chromium', check: 'which google-chrome || which chromium-browser || which chromium', msg: 'Install Chrome or Chromium' },
  { name: 'Xvfb', check: 'which Xvfb', msg: 'Install: sudo apt install xvfb' },
  { name: 'x11vnc', check: 'which x11vnc', msg: 'Install: sudo apt install x11vnc' },
  { name: 'websockify (noVNC)', check: 'which websockify', msg: 'Install: sudo apt install websockify' }
];

const missing = [];
for (const dep of deps) {
  try {
    execSync(dep.check, { stdio: 'ignore' });
    console.log(`  [OK] ${dep.name}`);
  } catch {
    console.log(`  [MISSING] ${dep.name} — ${dep.msg}`);
    missing.push(dep);
  }
}

// 4. Check shared display infrastructure
console.log('\nChecking shared display infrastructure...');
try {
  const pm2List = execSync('pm2 jlist 2>/dev/null', { encoding: 'utf-8' });
  const processes = JSON.parse(pm2List);

  const xvfbRunning = processes.some(p => p.name === 'zylos-xvfb' && p.pm2_env?.status === 'online');
  const vncRunning = processes.some(p => p.name === 'zylos-vnc' && p.pm2_env?.status === 'online');

  console.log(`  Xvfb (zylos-xvfb): ${xvfbRunning ? 'running' : 'not running'}`);
  console.log(`  VNC (zylos-vnc): ${vncRunning ? 'running' : 'not running'}`);

  if (!xvfbRunning) {
    console.log('  Note: Start display with: zylos-browser display start');
  }
} catch {
  console.log('  PM2 not available or no processes running.');
  console.log('  Start display later with: zylos-browser display start');
}

// Summary
console.log('\n[post-install] Complete!');

if (missing.length > 0) {
  console.log('\n========================================');
  console.log('  Missing Dependencies');
  console.log('========================================');
  for (const dep of missing) {
    console.log(`  ${dep.name}: ${dep.msg}`);
  }
  console.log('========================================');
}

console.log('\nQuick start:');
console.log('  zylos-browser display start     # Start Xvfb + VNC');
console.log('  zylos-browser open <url>         # Navigate to a URL');
console.log('  zylos-browser snapshot -i        # Get interactive elements');
