import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  extractDomain,
  extractPath,
  pathMatches,
  loadKnowledge,
  formatForPrompt,
  addGotcha,
  updateElement,
  recordTaskResult,
  getKnowledge,
  listDomains
} from '../knowledge.js';
import { KNOWLEDGE_DIR } from '../config.js';

// Tests use the actual KNOWLEDGE_DIR from config.
// Each test creates/cleans test-prefixed domain files.
const TEST_PREFIX = `__test-${Date.now()}`;

function cleanTestFiles() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) return;
  for (const f of fs.readdirSync(KNOWLEDGE_DIR)) {
    if (f.startsWith(TEST_PREFIX)) {
      fs.unlinkSync(path.join(KNOWLEDGE_DIR, f));
    }
  }
}

function writeTestKnowledge(domain, data) {
  fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  fs.writeFileSync(path.join(KNOWLEDGE_DIR, `${domain}.json`), JSON.stringify(data));
}

describe('knowledge - URL parsing', () => {
  it('extractDomain strips www prefix', () => {
    assert.equal(extractDomain('https://www.example.com/path'), 'example.com');
    assert.equal(extractDomain('https://example.com/path'), 'example.com');
  });

  it('extractDomain returns null for invalid URLs', () => {
    assert.equal(extractDomain('not-a-url'), null);
  });

  it('extractPath returns pathname', () => {
    assert.equal(extractPath('https://example.com/foo/bar'), '/foo/bar');
    assert.equal(extractPath('https://example.com'), '/');
  });
});

describe('knowledge - path matching', () => {
  it('exact match', () => {
    assert.equal(pathMatches('/home', '/home'), true);
    assert.equal(pathMatches('/home', '/about'), false);
  });

  it('wildcard matches one segment', () => {
    assert.equal(pathMatches('/user/123/profile', '/user/*/profile'), true);
    assert.equal(pathMatches('/user/456/profile', '/user/*/profile'), true);
    assert.equal(pathMatches('/user/profile', '/user/*/profile'), false);
  });

  it('multiple wildcards', () => {
    assert.equal(pathMatches('/a/b/c', '/*/*/c'), true);
    assert.equal(pathMatches('/x/y/c', '/*/*/c'), true);
  });
});

describe('knowledge - file operations', () => {
  const testDomain = `${TEST_PREFIX}.com`;

  beforeEach(() => {
    cleanTestFiles();
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  });

  afterEach(() => {
    cleanTestFiles();
  });

  it('loadKnowledge returns null for unknown domain', () => {
    const result = loadKnowledge(`https://${TEST_PREFIX}-unknown.com/`);
    assert.equal(result, null);
  });

  it('loadKnowledge merges _base and path patterns', () => {
    writeTestKnowledge(testDomain, {
      domain: testDomain,
      updated: '2026-01-01',
      _base: {
        elements: { login: { selector: '#login' } },
        gotchas: ['Wait for page load']
      },
      '/dashboard/*': {
        description: 'Dashboard pages',
        elements: { chart: { selector: '.chart' } },
        gotchas: ['Charts take 2s to render']
      }
    });

    const result = loadKnowledge(`https://${testDomain}/dashboard/main`);
    assert.equal(result.domain, testDomain);
    assert.ok(result.elements.login);
    assert.ok(result.elements.chart);
    assert.equal(result.gotchas.length, 2);
    assert.deepEqual(result.matchedPatterns, ['_base', '/dashboard/*']);
  });

  it('addGotcha creates knowledge file if not exists', () => {
    const newDomain = `${TEST_PREFIX}-new.com`;
    const added = addGotcha(`https://${newDomain}/`, 'Test gotcha');
    assert.equal(added, true);

    const filePath = path.join(KNOWLEDGE_DIR, `${newDomain}.json`);
    assert.ok(fs.existsSync(filePath));

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.deepEqual(data._base.gotchas, ['Test gotcha']);

    // Clean up the extra file
    fs.unlinkSync(filePath);
  });

  it('addGotcha prevents duplicates', () => {
    writeTestKnowledge(testDomain, {
      domain: testDomain,
      _base: { gotchas: ['existing gotcha'] }
    });

    const added = addGotcha(`https://${testDomain}/`, 'existing gotcha');
    assert.equal(added, false);
  });

  it('formatForPrompt generates readable output', () => {
    writeTestKnowledge(testDomain, {
      domain: testDomain,
      _base: {
        elements: { btn: { selector: '#btn', note: 'Top right' } },
        gotchas: ['Be careful']
      }
    });

    const loaded = loadKnowledge(`https://${testDomain}/`);
    const prompt = formatForPrompt(loaded);
    assert.ok(prompt.includes(`Site Knowledge: ${testDomain}`));
    assert.ok(prompt.includes('Be careful'));
  });

  it('listDomains includes test domains', () => {
    writeTestKnowledge(`${TEST_PREFIX}-a.com`, { domain: `${TEST_PREFIX}-a.com` });
    writeTestKnowledge(`${TEST_PREFIX}-b.com`, { domain: `${TEST_PREFIX}-b.com` });

    const domains = listDomains();
    assert.ok(domains.includes(`${TEST_PREFIX}-a.com`));
    assert.ok(domains.includes(`${TEST_PREFIX}-b.com`));

    // Clean up extra files
    fs.unlinkSync(path.join(KNOWLEDGE_DIR, `${TEST_PREFIX}-a.com.json`));
    fs.unlinkSync(path.join(KNOWLEDGE_DIR, `${TEST_PREFIX}-b.com.json`));
  });

  it('updateElement adds element info', () => {
    writeTestKnowledge(testDomain, {
      domain: testDomain,
      _base: { elements: {} }
    });

    const updated = updateElement(`https://${testDomain}/`, 'submit', { selector: '#submit', note: 'Green button' });
    assert.equal(updated, true);

    const data = JSON.parse(fs.readFileSync(path.join(KNOWLEDGE_DIR, `${testDomain}.json`), 'utf8'));
    assert.equal(data._base.elements.submit.selector, '#submit');
    assert.equal(data._base.elements.submit.note, 'Green button');
  });

  it('recordTaskResult updates success count', () => {
    writeTestKnowledge(testDomain, {
      domain: testDomain,
      _base: {
        tasks: {
          'login': { steps: ['click login', 'fill form'], success_count: 1 }
        }
      }
    });

    const updated = recordTaskResult(`https://${testDomain}/`, 'login', true);
    assert.equal(updated, true);

    const data = JSON.parse(fs.readFileSync(path.join(KNOWLEDGE_DIR, `${testDomain}.json`), 'utf8'));
    assert.equal(data._base.tasks.login.success_count, 2);
  });
});
