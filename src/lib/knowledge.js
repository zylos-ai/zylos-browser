/**
 * Site Knowledge Engine
 *
 * Per-domain knowledge storage for browser automation.
 * Claude loads domain knowledge before tasks, saves learnings after.
 *
 * Ported from zylos-infra/browser-agent/cdp-service/site-knowledge.js (CJS→ESM)
 * Adapted: new paths, added APIs per arch doc §4.2
 */

import fs from 'node:fs';
import path from 'node:path';
import { KNOWLEDGE_DIR, getConfig } from './config.js';

/**
 * Extract domain from URL
 */
export function extractDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Extract path from URL
 */
export function extractPath(url) {
  try {
    const u = new URL(url);
    return u.pathname;
  } catch {
    return '/';
  }
}

/**
 * Check if a URL path matches a pattern (supports * wildcard)
 * * matches one path segment (non-slash characters)
 */
export function pathMatches(urlPath, pattern) {
  if (urlPath === pattern) return true;

  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/]+');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(urlPath);
}

/**
 * Get the knowledge file path for a domain
 */
function knowledgeFilePath(domain) {
  return path.join(KNOWLEDGE_DIR, `${domain}.json`);
}

/**
 * Merge a knowledge section into a result object
 */
function mergeKnowledge(result, section) {
  if (section.elements) {
    Object.assign(result.elements, section.elements);
  }
  if (section.editor) {
    result.editor = section.editor;
  }
  if (section.tasks) {
    Object.assign(result.tasks, section.tasks);
  }
  if (section.gotchas) {
    result.gotchas.push(...section.gotchas);
  }
  if (section.description) {
    result.description = section.description;
  }
}

/**
 * Load site knowledge for a given URL.
 * Returns merged knowledge from _base + matching path patterns.
 */
export function loadKnowledge(url) {
  const domain = extractDomain(url);
  if (!domain) return null;

  const filePath = knowledgeFilePath(domain);
  if (!fs.existsSync(filePath)) return null;

  try {
    const knowledge = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const urlPath = extractPath(url);

    const result = {
      domain: knowledge.domain || domain,
      url,
      path: urlPath,
      elements: {},
      editor: null,
      tasks: {},
      gotchas: [],
      matchedPatterns: []
    };

    // Merge _base if exists
    if (knowledge._base) {
      result.matchedPatterns.push('_base');
      mergeKnowledge(result, knowledge._base);
    }

    // Find and merge matching path patterns
    for (const pattern of Object.keys(knowledge)) {
      if (pattern === 'domain' || pattern === 'updated' || pattern === '_base') continue;
      if (pathMatches(urlPath, pattern)) {
        result.matchedPatterns.push(pattern);
        mergeKnowledge(result, knowledge[pattern]);
      }
    }

    return result;
  } catch (err) {
    console.error(`[knowledge] Error loading ${filePath}: ${err.message}`);
    return null;
  }
}

/**
 * Format knowledge as a readable string for Claude's context
 */
export function formatForPrompt(knowledge) {
  if (!knowledge) return '';

  let prompt = `\n## Site Knowledge: ${knowledge.domain}\n`;
  prompt += `Current page: ${knowledge.path}\n`;

  if (knowledge.description) {
    prompt += `Page type: ${knowledge.description}\n`;
  }

  if (Object.keys(knowledge.elements).length > 0) {
    prompt += `\n### Known Elements:\n`;
    for (const [name, info] of Object.entries(knowledge.elements)) {
      prompt += `- ${name}: `;
      if (info.selector) prompt += `selector="${info.selector}"`;
      if (info.ref_name) prompt += `${info.selector ? ', ' : ''}ref_name="${info.ref_name}"`;
      if (info.note) prompt += ` (${info.note})`;
      prompt += '\n';
    }
  }

  if (knowledge.editor) {
    prompt += `\n### Editor Info:\n`;
    prompt += `- Type: ${knowledge.editor.type}\n`;
    prompt += `- Selector: ${knowledge.editor.selector}\n`;
    if (knowledge.editor.note) prompt += `- Note: ${knowledge.editor.note}\n`;
  }

  if (Object.keys(knowledge.tasks).length > 0) {
    prompt += `\n### Known Task Workflows:\n`;
    for (const [taskName, task] of Object.entries(knowledge.tasks)) {
      prompt += `- ${taskName}: ${task.steps?.join(' → ') || '(no steps)'}`;
      if (task.success_count) prompt += ` [${task.success_count} successes]`;
      if (task.note) prompt += ` (${task.note})`;
      prompt += '\n';
    }
  }

  if (knowledge.gotchas.length > 0) {
    prompt += `\n### Gotchas (Important!):\n`;
    for (const gotcha of knowledge.gotchas) {
      prompt += `- ${gotcha}\n`;
    }
  }

  return prompt;
}

/**
 * Add a gotcha to a domain's knowledge
 */
export function addGotcha(url, gotcha, pattern = '_base') {
  const domain = extractDomain(url);
  if (!domain) return false;

  const filePath = knowledgeFilePath(domain);

  let knowledge;
  if (fs.existsSync(filePath)) {
    knowledge = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } else {
    // Create new knowledge file for the domain
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
    knowledge = { domain, updated: new Date().toISOString() };
  }

  if (!knowledge[pattern]) {
    knowledge[pattern] = { gotchas: [] };
  }
  if (!knowledge[pattern].gotchas) {
    knowledge[pattern].gotchas = [];
  }

  // Avoid duplicates
  if (knowledge[pattern].gotchas.includes(gotcha)) return false;

  // Enforce max gotchas limit
  const config = getConfig();
  const maxGotchas = config.knowledge?.max_gotchas_per_domain || 50;
  if (knowledge[pattern].gotchas.length >= maxGotchas) {
    console.warn(`[knowledge] Max gotchas (${maxGotchas}) reached for ${domain}/${pattern}`);
    return false;
  }

  knowledge[pattern].gotchas.push(gotcha);
  knowledge.updated = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(knowledge, null, 2));
  return true;
}

/**
 * Update an element's selector info in site knowledge
 */
export function updateElement(url, name, selectorInfo) {
  const domain = extractDomain(url);
  if (!domain) return false;

  const filePath = knowledgeFilePath(domain);
  if (!fs.existsSync(filePath)) return false;

  try {
    const knowledge = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!knowledge._base) knowledge._base = {};
    if (!knowledge._base.elements) knowledge._base.elements = {};

    knowledge._base.elements[name] = {
      ...knowledge._base.elements[name],
      ...selectorInfo
    };
    knowledge.updated = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(knowledge, null, 2));
    return true;
  } catch (err) {
    console.error(`[knowledge] Error updating element: ${err.message}`);
    return false;
  }
}

/**
 * Record a task result (success/failure)
 */
export function recordTaskResult(url, taskName, success) {
  const domain = extractDomain(url);
  if (!domain) return false;

  const filePath = knowledgeFilePath(domain);
  if (!fs.existsSync(filePath)) return false;

  try {
    const knowledge = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Find the matching pattern that has this task
    for (const pattern of Object.keys(knowledge)) {
      if (knowledge[pattern]?.tasks?.[taskName]) {
        const task = knowledge[pattern].tasks[taskName];
        if (success) {
          task.success_count = (task.success_count || 0) + 1;
          task.last_success = new Date().toISOString().split('T')[0];
        } else {
          task.failure_count = (task.failure_count || 0) + 1;
          task.last_failure = new Date().toISOString().split('T')[0];
        }
        knowledge.updated = new Date().toISOString();
        fs.writeFileSync(filePath, JSON.stringify(knowledge, null, 2));
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error(`[knowledge] Error recording task result: ${err.message}`);
    return false;
  }
}

/**
 * Get raw knowledge data for a domain
 */
export function getKnowledge(domain) {
  const filePath = knowledgeFilePath(domain);
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * List all domains that have knowledge files
 */
export function listDomains() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) return [];

  return fs.readdirSync(KNOWLEDGE_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace(/\.json$/, ''))
    .sort();
}
