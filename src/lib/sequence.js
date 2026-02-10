/**
 * Sequence Execution Engine
 *
 * Runs pre-recorded browser action sequences (JSON format).
 * Uses agent-browser CLI via Browser class for all interactions.
 *
 * Ported from zylos-infra/browser-sequences/sequence-runner.js (CJS→ESM)
 * Adapted: new paths, async execFile, added action types, validation
 */

import fs from 'node:fs';
import path from 'node:path';
import { SEQUENCES_DIR, getConfig } from './config.js';
import { Browser } from './browser.js';

/**
 * Parse snapshot output into structured elements
 */
function parseSnapshot(output) {
  const elements = [];
  const lines = output.split('\n');
  for (const line of lines) {
    const match = line.match(/^- (\w+)\s*"?([^"]*)"?\s*\[ref=(e\d+)\](.*)$/);
    if (match) {
      const [, role, name, ref, attrs] = match;
      elements.push({
        role: role.trim(),
        name: name.trim(),
        ref,
        nth: attrs.includes('[nth=') ? parseInt(attrs.match(/\[nth=(\d+)\]/)?.[1] || '0') : 0,
        disabled: attrs.includes('[disabled]')
      });
    }
  }
  return elements;
}

/**
 * Find an element matching target criteria
 */
function findElement(elements, target) {
  return elements.find(el => {
    if (target.role && el.role !== target.role) return false;
    if (target.name && el.name !== target.name) return false;
    if (target.name_contains && !el.name.toLowerCase().includes(target.name_contains.toLowerCase())) return false;
    if (target.nth !== undefined && el.nth !== target.nth) return false;
    if (el.disabled) return false;
    return true;
  });
}

/**
 * Find element with fallback targets
 */
function findElementWithFallback(elements, action) {
  let element = findElement(elements, action.target);
  if (element) return element;

  if (action.fallback_targets && Array.isArray(action.fallback_targets)) {
    for (const fallback of action.fallback_targets) {
      element = findElement(elements, fallback);
      if (element) return element;
    }
  }

  return null;
}

/**
 * Interpolate {{variables}} in a string with safety
 * Only used in value fields, never in action or target fields
 */
function interpolate(str, variables) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (variables[key] === undefined) {
      throw new Error(`Missing variable: ${key}`);
    }
    // Escape special characters to prevent injection
    const val = String(variables[key]);
    return val.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  });
}

/**
 * Execute a single action step
 */
async function executeAction(browser, action, variables, elements) {
  switch (action.action) {
    case 'click': {
      const element = findElementWithFallback(elements, action);
      if (!element) throw new Error(`Element not found: ${JSON.stringify(action.target)}`);
      await browser.click(`@${element.ref}`);
      break;
    }

    case 'type': {
      const element = findElementWithFallback(elements, action);
      if (!element) throw new Error(`Element not found: ${JSON.stringify(action.target)}`);
      const value = interpolate(action.value, variables);
      await browser.type(`@${element.ref}`, value);
      break;
    }

    case 'fill': {
      const element = findElementWithFallback(elements, action);
      if (!element) throw new Error(`Element not found: ${JSON.stringify(action.target)}`);
      const value = interpolate(action.value, variables);
      await browser.fill(`@${element.ref}`, value);
      break;
    }

    case 'scroll': {
      const direction = action.direction || 'down';
      const amount = action.amount || 500;
      await browser.scroll(direction, amount);
      break;
    }

    case 'keypress': {
      await browser.keypress(action.key);
      break;
    }

    case 'screenshot': {
      const screenshotPath = action.path || undefined;
      await browser.screenshot(screenshotPath);
      break;
    }

    case 'navigate': {
      const url = interpolate(action.url, variables);
      await browser.open(url);
      break;
    }

    case 'wait': {
      await new Promise(resolve => setTimeout(resolve, action.duration || 1000));
      break;
    }

    default:
      throw new Error(`Unknown action: ${action.action}`);
  }

  // Brief pause between actions
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
}

/**
 * Verify sequence success by checking snapshot for expected elements/text
 */
async function verifySuccess(browser, verification) {
  if (!verification) return true;

  const timeout = verification.timeout || 5000;
  const interval = 500;
  const maxAttempts = Math.ceil(timeout / interval);

  const targets = [];
  if (verification.wait_for) targets.push(verification.wait_for);
  if (verification.fallback_wait_for) targets.push(...verification.fallback_wait_for);

  if (targets.length === 0) return true;

  for (let i = 0; i < maxAttempts; i++) {
    const snapshotOutput = await browser.snapshot({ interactive: true });
    const elements = parseSnapshot(snapshotOutput);

    for (const target of targets) {
      if (target.text_contains) {
        if (snapshotOutput.toLowerCase().includes(target.text_contains.toLowerCase())) {
          return true;
        }
      } else {
        const element = findElement(elements, target);
        if (element) return true;
      }
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  return verification.required === false;
}

/**
 * Load a sequence by name from the sequences directory
 */
function loadSequence(name) {
  if (!fs.existsSync(SEQUENCES_DIR)) {
    throw new Error(`Sequences directory not found: ${SEQUENCES_DIR}`);
  }

  const possiblePaths = [
    path.join(SEQUENCES_DIR, name),
    path.join(SEQUENCES_DIR, `${name}.json`)
  ];

  // Also search in domain subdirectories
  try {
    const dirs = fs.readdirSync(SEQUENCES_DIR).filter(f =>
      fs.statSync(path.join(SEQUENCES_DIR, f)).isDirectory()
    );
    for (const dir of dirs) {
      possiblePaths.push(path.join(SEQUENCES_DIR, dir, name));
      possiblePaths.push(path.join(SEQUENCES_DIR, dir, `${name}.json`));
    }
  } catch {
    // Ignore read errors
  }

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  }

  throw new Error(`Sequence not found: ${name}`);
}

/**
 * Validate a sequence JSON schema
 *
 * @param {object} sequenceJson - The sequence object to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSequence(sequenceJson) {
  const errors = [];

  if (!sequenceJson.name) errors.push('Missing "name" field');
  if (!sequenceJson.steps && !sequenceJson.actions) {
    errors.push('Missing "steps" or "actions" field');
  }

  const steps = sequenceJson.steps || sequenceJson.actions || [];
  const validActions = ['click', 'type', 'fill', 'scroll', 'wait', 'screenshot', 'keypress', 'navigate'];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step.action) {
      errors.push(`Step ${i}: missing "action" field`);
      continue;
    }
    if (!validActions.includes(step.action)) {
      errors.push(`Step ${i}: unknown action "${step.action}"`);
    }
    if (['click', 'type', 'fill'].includes(step.action) && !step.target) {
      errors.push(`Step ${i}: "${step.action}" requires a "target" field`);
    }
    if (['type', 'fill'].includes(step.action) && step.value === undefined) {
      errors.push(`Step ${i}: "${step.action}" requires a "value" field`);
    }
  }

  if (sequenceJson.variables) {
    for (const [key, spec] of Object.entries(sequenceJson.variables)) {
      if (!spec.type) {
        errors.push(`Variable "${key}": missing "type" field`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Run a named sequence with variables
 *
 * @param {string} name - Sequence name or path
 * @param {object} variables - Variables to interpolate
 * @param {object} browserOpts - Options passed to Browser constructor
 * @returns {{ success: boolean, steps: object[], error?: string }}
 */
export async function runSequence(name, variables = {}, browserOpts = {}) {
  const sequence = loadSequence(name);
  const config = getConfig();
  const stepResults = [];

  // Validate required variables
  if (sequence.variables) {
    for (const [key, spec] of Object.entries(sequence.variables)) {
      if (spec.required && variables[key] === undefined) {
        return {
          success: false,
          steps: [],
          error: `Missing required variable: ${key}${spec.description ? ` — ${spec.description}` : ''}`
        };
      }
    }
  }

  const browser = new Browser(browserOpts);
  const steps = sequence.steps || sequence.actions || [];

  // Check preconditions
  if (sequence.preconditions?.url_pattern) {
    try {
      const snapshotOutput = await browser.snapshot({ compact: true });
      // URL pattern check would need a dedicated command — skip for now
    } catch {
      // Continue anyway
    }
  }

  // Get initial snapshot
  let elements;
  try {
    const snapshotOutput = await browser.snapshot({ interactive: true });
    elements = parseSnapshot(snapshotOutput);
  } catch (err) {
    return { success: false, steps: [], error: `Failed to get initial snapshot: ${err.message}` };
  }

  // Execute steps
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepDesc = step.description || `${step.action} ${step.target ? JSON.stringify(step.target) : ''}`;

    try {
      await executeAction(browser, step, variables, elements);
      stepResults.push({ step: i, action: step.action, status: 'ok', description: stepDesc });

      // Refresh snapshot after DOM-changing actions
      if (['click', 'type', 'fill', 'navigate'].includes(step.action)) {
        await new Promise(resolve => setTimeout(resolve, 300));
        try {
          const snapshotOutput = await browser.snapshot({ interactive: true });
          elements = parseSnapshot(snapshotOutput);
        } catch {
          // Snapshot might fail during navigation — continue with stale elements
        }
      }
    } catch (err) {
      stepResults.push({ step: i, action: step.action, status: 'failed', error: err.message, description: stepDesc });

      // Check retry config
      if (config.sequences?.retry_on_failure) {
        const maxRetries = config.sequences?.max_retries || 2;
        let retried = false;

        for (let retry = 0; retry < maxRetries; retry++) {
          try {
            await new Promise(resolve => setTimeout(resolve, 500));
            const snapshotOutput = await browser.snapshot({ interactive: true });
            elements = parseSnapshot(snapshotOutput);
            await executeAction(browser, step, variables, elements);
            stepResults.push({ step: i, action: step.action, status: 'ok (retry)', description: stepDesc });
            retried = true;
            break;
          } catch {
            // Retry failed, continue to next retry
          }
        }

        if (!retried) {
          return { success: false, steps: stepResults, error: `Step ${i} failed: ${err.message}` };
        }
      } else {
        return { success: false, steps: stepResults, error: `Step ${i} failed: ${err.message}` };
      }
    }
  }

  // Verify success
  if (sequence.verification) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const verified = await verifySuccess(browser, sequence.verification);
    if (!verified) {
      return { success: false, steps: stepResults, error: 'Sequence verification failed' };
    }
  }

  return { success: true, steps: stepResults };
}

/**
 * List available sequences
 *
 * @returns {{ name: string, domain?: string, description?: string, variables?: object }[]}
 */
export function listSequences() {
  if (!fs.existsSync(SEQUENCES_DIR)) return [];

  const sequences = [];

  function scanDir(dir, prefix = '') {
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scanDir(fullPath, prefix ? `${prefix}/${entry}` : entry);
      } else if (entry.endsWith('.json')) {
        try {
          const seq = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          sequences.push({
            name: prefix ? `${prefix}/${entry.replace(/\.json$/, '')}` : entry.replace(/\.json$/, ''),
            domain: seq.domain || seq.site,
            description: seq.description,
            variables: seq.variables
          });
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  scanDir(SEQUENCES_DIR);
  return sequences;
}
