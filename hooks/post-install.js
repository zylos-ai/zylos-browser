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
 * 1. Google Chrome stable .deb (preferred — not Snap, no sandbox issues)
 * 2. apt-get install chromium-browser (fallback — may be Snap on Ubuntu 22.04+)
 */
function installChrome() {
  // Try Google Chrome stable first (non-Snap, avoids confinement issues)
  try {
    const debUrl = 'https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb';
    const debPath = '/tmp/google-chrome-stable.deb';
    execSync(`wget -q -O ${debPath} ${debUrl}`, { stdio: 'pipe', timeout: 120000 });
    execSync(`sudo apt-get install -y ${debPath}`, { stdio: 'pipe', timeout: 120000 });
    execSync(`rm -f ${debPath}`, { stdio: 'ignore' });
    return;
  } catch {
    console.log('    Google Chrome install failed, trying chromium-browser...');
  }

  // Fallback: chromium-browser via apt (may be Snap on newer Ubuntu)
  execSync('sudo apt-get install -y chromium-browser', { stdio: 'pipe', timeout: 180000 });
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
  { name: 'TigerVNC x0vncserver', check: 'which x0vncserver', install: 'sudo apt-get install -y tigervnc-scraping-server', required: true },
  { name: 'websockify (noVNC)', check: 'which websockify', install: 'sudo apt-get install -y websockify', required: true },
  { name: 'noVNC web client', check: 'test -d /usr/share/novnc', install: 'sudo apt-get install -y novnc', required: true },
  { name: 'xclip', check: 'which xclip', install: 'sudo apt-get install -y xclip', required: true },
  { name: 'xdotool', check: 'which xdotool', install: 'sudo apt-get install -y xdotool', required: false },
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

// 4. Install CJK fonts and fontconfig rules
console.log('\nInstalling CJK fonts...');
try {
  execSync('sudo apt-get install -y fonts-noto-cjk', { stdio: 'pipe', timeout: 120000 });
  console.log('  [OK] fonts-noto-cjk');
} catch {
  console.log('  [WARN] CJK fonts install failed — non-critical, continuing.');
}

// Setup fontconfig rules so Chrome picks up CJK fonts
const fontconfPath = '/etc/fonts/conf.d/64-zylos-cjk.conf';
try {
  if (!fs.existsSync(fontconfPath)) {
    const fontconfContent = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <alias>
    <family>sans-serif</family>
    <prefer><family>Noto Sans CJK SC</family></prefer>
  </alias>
  <alias>
    <family>serif</family>
    <prefer><family>Noto Serif CJK SC</family></prefer>
  </alias>
  <alias>
    <family>monospace</family>
    <prefer><family>Noto Sans Mono CJK SC</family></prefer>
  </alias>
</fontconfig>`;
    execSync(`sudo tee ${fontconfPath} > /dev/null`, { input: fontconfContent, stdio: ['pipe', 'pipe', 'pipe'] });
    execSync('sudo fc-cache -f', { stdio: 'pipe', timeout: 30000 });
    console.log('  [OK] CJK fontconfig rules installed');
  } else {
    console.log('  [OK] CJK fontconfig rules already exist');
  }
} catch {
  console.log('  [WARN] fontconfig CJK setup failed — non-critical, continuing.');
}

// 5. Generate VNC password if not exists
const vncPasswdFile = path.join(DATA_DIR, '.vncpasswd');
if (!fs.existsSync(vncPasswdFile)) {
  console.log('\nGenerating VNC password...');
  try {
    const password = crypto.randomBytes(6).toString('base64').slice(0, 8);
    const obfuscated = execSync('vncpasswd -f', { input: password + '\n', stdio: ['pipe', 'pipe', 'pipe'] });
    fs.writeFileSync(vncPasswdFile, obfuscated, { mode: 0o600 });
    console.log(`  VNC password: ${password}`);
    console.log(`  Stored at ${vncPasswdFile}`);
  } catch (err) {
    console.log(`  Could not generate VNC password: ${err.message}`);
    console.log('  VNC will fall back to no-password mode.');
  }
} else {
  console.log('\nVNC password already exists, skipping.');
}

// 6. Auto-start display infrastructure (Xvfb + Chrome + VNC)
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
