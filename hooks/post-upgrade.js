#!/usr/bin/env node
/**
 * Post-upgrade hook for zylos-browser
 *
 * Called by Claude after CLI upgrade completes (zylos upgrade --json).
 * Handles config schema migrations.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

function timestampSuffix() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function backupConfigFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const backupPath = `${filePath}.backup.${timestampSuffix()}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function atomicWriteJSON(filePath, obj) {
  const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(obj, null, 2));
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch {}
    throw err;
  }
}

const HOME = process.env.HOME;
const DATA_DIR = path.join(HOME, 'zylos/components/browser');
const configPath = path.join(DATA_DIR, 'config.json');

console.log('[post-upgrade] Running browser-specific migrations...\n');

// Ensure data directories exist
const subdirs = ['knowledge', 'sequences', 'screenshots', 'logs'];
for (const dir of subdirs) {
  fs.mkdirSync(path.join(DATA_DIR, dir), { recursive: true });
}

// Config migrations
if (fs.existsSync(configPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    let migrated = false;
    const migrations = [];

    // Migration 1: Ensure enabled field
    if (config.enabled === undefined) {
      config.enabled = true;
      migrated = true;
      migrations.push('Added enabled field');
    }

    // Migration 2: Ensure cdp_port
    if (config.cdp_port === undefined) {
      config.cdp_port = 9222;
      migrated = true;
      migrations.push('Added cdp_port');
    }

    // Migration 3: Ensure headless field
    if (config.headless === undefined) {
      config.headless = false;
      migrated = true;
      migrations.push('Added headless field');
    }

    // Migration 4: Ensure display settings
    if (!config.display) {
      config.display = { number: 99, resolution: '1280x1024x24' };
      migrated = true;
      migrations.push('Added display settings');
    }

    // Migration 5: Ensure vnc settings
    if (!config.vnc) {
      config.vnc = { enabled: true, port: 5900, novnc_port: 6080 };
      migrated = true;
      migrations.push('Added vnc settings');
    }

    // Migration 6: Ensure knowledge settings
    if (!config.knowledge) {
      config.knowledge = { auto_save: true, max_gotchas_per_domain: 50 };
      migrated = true;
      migrations.push('Added knowledge settings');
    }

    // Migration 7: Ensure sequences settings
    if (!config.sequences) {
      config.sequences = { timeout_default: 30000, retry_on_failure: true, max_retries: 2 };
      migrated = true;
      migrations.push('Added sequences settings');
    }

    // Migration 8: Ensure screenshots settings
    if (!config.screenshots) {
      config.screenshots = { auto_save: false, directory: 'screenshots' };
      migrated = true;
      migrations.push('Added screenshots settings');
    }

    // Save if migrated
    if (migrated) {
      const backupPath = backupConfigFile(configPath);
      if (backupPath) console.log(`[post-upgrade] Backed up config to ${path.basename(backupPath)}`);
      atomicWriteJSON(configPath, config);
      console.log('Config migrations applied:');
      migrations.forEach(m => console.log('  - ' + m));
    } else {
      console.log('No config migrations needed.');
    }
  } catch (err) {
    console.error('Config migration failed:', err.message);
    process.exit(1);
  }
} else {
  console.log('No config file found, skipping migrations.');
}

// Archive the pre-upgrade backup with a timestamp instead of deleting it,
// so the prior knowledge dir is recoverable if the upgrade introduces a
// regression. Owner is expected to clean up `knowledge.backup-*` dirs
// manually once they're confident the upgrade is stable.
const knowledgeBackup = path.join(DATA_DIR, 'knowledge.backup');
if (fs.existsSync(knowledgeBackup)) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace(/Z$/, '');
  const archived = path.join(DATA_DIR, `knowledge.backup-${ts}`);
  fs.renameSync(knowledgeBackup, archived);
  console.log(`Archived knowledge.backup/ → knowledge.backup-${ts}/`);
}

// Restart display infrastructure
console.log('\nRestarting display infrastructure...');
try {
  execSync('zylos-browser display start', { stdio: 'inherit', timeout: 60000 });
} catch {
  console.log('  Auto-start failed. Start manually: zylos-browser display start');
}

console.log('\n[post-upgrade] Complete!');
