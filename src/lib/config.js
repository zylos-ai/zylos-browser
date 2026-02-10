/**
 * Configuration loader for zylos-browser
 *
 * Loads config from ~/zylos/components/browser/config.json
 * Pattern: loadConfig() / getConfig() / saveConfig()
 */

import fs from 'node:fs';
import path from 'node:path';

const HOME = process.env.HOME;

// Path constants
export const ZYLOS_DIR = process.env.ZYLOS_DIR || path.join(HOME, 'zylos');
export const DATA_DIR = path.join(ZYLOS_DIR, 'components/browser');
export const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
export const KNOWLEDGE_DIR = path.join(DATA_DIR, 'knowledge');
export const SEQUENCES_DIR = path.join(DATA_DIR, 'sequences');
export const SCREENSHOTS_DIR = path.join(DATA_DIR, 'screenshots');
export const LOGS_DIR = path.join(DATA_DIR, 'logs');
export const ENV_FILE = path.join(ZYLOS_DIR, '.env');

// Default configuration (matches arch doc §9)
export const DEFAULT_CONFIG = {
  enabled: true,
  cdp_port: 9222,
  headless: false,
  display: {
    number: 99,
    resolution: '1280x1024x24'
  },
  vnc: {
    enabled: true,
    port: 5900,
    novnc_port: 6080
  },
  knowledge: {
    auto_save: true,
    max_gotchas_per_domain: 50
  },
  sequences: {
    timeout_default: 30000,
    retry_on_failure: true,
    max_retries: 2
  },
  screenshots: {
    auto_save: false,
    directory: 'screenshots'
  }
};

let config = null;

/**
 * Deep merge two objects. Source values override target.
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Load configuration from file, deep-merged with defaults
 */
export function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const content = fs.readFileSync(CONFIG_PATH, 'utf8');
      const fileConfig = JSON.parse(content);
      config = deepMerge(DEFAULT_CONFIG, fileConfig);
    } else {
      config = deepMerge({}, DEFAULT_CONFIG);
    }
  } catch (err) {
    console.error(`[browser] Failed to load config: ${err.message}`);
    config = deepMerge({}, DEFAULT_CONFIG);
  }
  return config;
}

/**
 * Get current configuration (lazy-loads on first call)
 */
export function getConfig() {
  if (!config) {
    loadConfig();
  }
  return config;
}

/**
 * Save configuration to file
 */
export function saveConfig(newConfig) {
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
    config = deepMerge(DEFAULT_CONFIG, newConfig);
  } catch (err) {
    console.error(`[browser] Failed to save config: ${err.message}`);
    throw err;
  }
}
