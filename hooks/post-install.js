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
import crypto from 'node:crypto';
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
const subdirs = ['knowledge', 'sequences', 'screenshots', 'logs', 'chrome-profile'];
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

// 3. Check and auto-install system dependencies

/**
 * Install Chrome/Chromium. Tries multiple methods:
 * 1. apt-get install chromium-browser (Debian/Ubuntu)
 * 2. Google Chrome .deb package (fallback)
 */
function installChrome() {
  // Try chromium-browser via apt first
  try {
    execSync('sudo apt-get install -y chromium-browser', { stdio: 'pipe', timeout: 180000 });
    return;
  } catch {
    console.log('    chromium-browser apt install failed, trying Google Chrome...');
  }

  // Fallback: Google Chrome stable .deb
  const debUrl = 'https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb';
  const debPath = '/tmp/google-chrome-stable.deb';
  execSync(`wget -q -O ${debPath} ${debUrl}`, { stdio: 'pipe', timeout: 120000 });
  execSync(`sudo apt-get install -y ${debPath}`, { stdio: 'pipe', timeout: 120000 });
  execSync(`rm -f ${debPath}`, { stdio: 'ignore' });
}

console.log('\nChecking dependencies...');
const deps = [
  {
    name: 'Chrome/Chromium',
    check: 'which google-chrome-stable || which google-chrome || which chromium-browser || which chromium',
    install: 'install-chrome',
    required: true,
  },
  { name: 'Xvfb', check: 'which Xvfb', install: 'sudo apt-get install -y xvfb', required: true },
  { name: 'x11vnc', check: 'which x11vnc', install: 'sudo apt-get install -y x11vnc', required: true },
  { name: 'websockify (noVNC)', check: 'which websockify', install: 'sudo apt-get install -y websockify', required: true },
];

const missing = [];
for (const dep of deps) {
  try {
    execSync(dep.check, { stdio: 'ignore' });
    console.log(`  [OK] ${dep.name}`);
  } catch {
    console.log(`  [MISSING] ${dep.name} — installing...`);
    try {
      if (dep.install === 'install-chrome') {
        installChrome();
      } else {
        execSync(dep.install, { stdio: 'pipe', timeout: 120000 });
      }
      // Verify installation
      execSync(dep.check, { stdio: 'ignore' });
      console.log(`  [OK] ${dep.name} (installed)`);
      continue;
    } catch (installErr) {
      console.log(`  [FAILED] ${dep.name} — auto-install failed: ${installErr.message}`);
    }
    missing.push(dep);
  }
}

// Bail early if any required dependency is missing
if (missing.length > 0) {
  console.log('\n========================================');
  console.log('  Missing Dependencies');
  console.log('========================================');
  for (const dep of missing) {
    console.log(`  - ${dep.name}`);
  }
  console.log('========================================');
  console.error('\n[post-install] FAILED — required dependencies could not be installed.');
  process.exit(1);
}

// 4. Generate VNC password if not exists
const vncPasswdFile = path.join(DATA_DIR, '.vncpasswd');
if (!fs.existsSync(vncPasswdFile)) {
  console.log('\nGenerating VNC password...');
  try {
    const password = crypto.randomBytes(6).toString('base64').slice(0, 8);
    execSync(`x11vnc -storepasswd ${password} ${vncPasswdFile}`, { stdio: 'pipe' });
    console.log(`  VNC password stored at ${vncPasswdFile}`);
    console.log(`  Password: ${password}`);
  } catch (err) {
    console.log(`  Could not generate VNC password: ${err.message}`);
    console.log('  VNC will fall back to no-password mode.');
  }
} else {
  console.log('\nVNC password already exists, skipping.');
}

// 5. Auto-start display infrastructure (Xvfb + Chrome + VNC)
console.log('\nStarting display infrastructure...');
try {
  execSync('zylos-browser display start', { stdio: 'inherit', timeout: 60000 });
} catch {
  console.log('  Auto-start failed. Start manually: zylos-browser display start');
}

console.log('\n[post-install] Complete!');

console.log('\nQuick start:');
console.log('  zylos-browser display start     # Start Xvfb + Chrome + VNC');
console.log('  zylos-browser open <url>         # Navigate to a URL');
console.log('  zylos-browser snapshot -i        # Get interactive elements');
