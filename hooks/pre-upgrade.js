#!/usr/bin/env node
/**
 * Pre-upgrade hook for zylos-browser
 *
 * Called by Claude BEFORE CLI upgrade steps.
 * If this hook fails (exit code 1), the upgrade is aborted.
 *
 * This hook handles:
 * - Backup config.json
 * - Backup knowledge and sequences directories
 */

import fs from 'node:fs';
import path from 'node:path';

const HOME = process.env.HOME;
const DATA_DIR = path.join(HOME, 'zylos/components/browser');
const configPath = path.join(DATA_DIR, 'config.json');

console.log('[pre-upgrade] Running browser pre-upgrade checks...\n');

// 1. Backup config
if (fs.existsSync(configPath)) {
  const backupPath = configPath + '.backup';
  fs.copyFileSync(configPath, backupPath);
  console.log('Config backed up to:', backupPath);
}

// 2. Backup knowledge directory (contains learned site data)
const knowledgeDir = path.join(DATA_DIR, 'knowledge');
if (fs.existsSync(knowledgeDir)) {
  const files = fs.readdirSync(knowledgeDir).filter(f => f.endsWith('.json'));
  if (files.length > 0) {
    const backupDir = path.join(DATA_DIR, 'knowledge.backup');
    fs.mkdirSync(backupDir, { recursive: true });
    for (const file of files) {
      fs.copyFileSync(path.join(knowledgeDir, file), path.join(backupDir, file));
    }
    console.log(`Knowledge backed up: ${files.length} files to knowledge.backup/`);
  }
}

// 3. Backup sequences directory
const sequencesDir = path.join(DATA_DIR, 'sequences');
if (fs.existsSync(sequencesDir)) {
  const countFiles = (dir) => {
    let count = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) count += countFiles(path.join(dir, entry.name));
      else if (entry.name.endsWith('.json')) count++;
    }
    return count;
  };
  const fileCount = countFiles(sequencesDir);
  if (fileCount > 0) {
    console.log(`Sequences directory has ${fileCount} files (preserved via SKILL.md preserve field).`);
  }
}

console.log('\n[pre-upgrade] Checks passed, proceeding with upgrade.');
