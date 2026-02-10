import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Browser } from '../browser.js';
import {
  BrowserError,
  TimeoutError,
  ElementNotFoundError,
  ConnectionError,
  DependencyError
} from '../errors.js';

describe('browser - Browser class construction', () => {
  it('creates instance with default config', () => {
    const browser = new Browser();
    assert.equal(browser.cdpPort, 9222);
    assert.equal(browser.headless, false);
    assert.equal(browser.display, ':99');
  });

  it('accepts constructor options', () => {
    const browser = new Browser({ cdpPort: 9333, headless: true, display: ':42' });
    assert.equal(browser.cdpPort, 9333);
    assert.equal(browser.headless, true);
    assert.equal(browser.display, ':42');
  });
});

describe('browser - _parseArgs', () => {
  const browser = new Browser();

  it('parses simple args', () => {
    assert.deepEqual(browser._parseArgs('snapshot -i'), ['snapshot', '-i']);
  });

  it('handles quoted strings', () => {
    assert.deepEqual(browser._parseArgs('type @e5 "hello world"'), ['type', '@e5', 'hello world']);
  });

  it('handles single-quoted strings', () => {
    assert.deepEqual(browser._parseArgs("type @e5 'hello world'"), ['type', '@e5', 'hello world']);
  });

  it('handles empty input', () => {
    assert.deepEqual(browser._parseArgs(''), []);
  });

  it('handles multiple spaces', () => {
    assert.deepEqual(browser._parseArgs('open  https://example.com'), ['open', 'https://example.com']);
  });
});

describe('browser - error classes', () => {
  it('BrowserError has code and details', () => {
    const err = new BrowserError('test', 'TEST_CODE', { foo: 'bar' });
    assert.equal(err.message, 'test');
    assert.equal(err.code, 'TEST_CODE');
    assert.deepEqual(err.details, { foo: 'bar' });
    assert.ok(err instanceof Error);
  });

  it('TimeoutError defaults', () => {
    const err = new TimeoutError();
    assert.equal(err.code, 'TIMEOUT');
    assert.ok(err instanceof BrowserError);
  });

  it('ElementNotFoundError includes ref', () => {
    const err = new ElementNotFoundError('@e5');
    assert.ok(err.message.includes('@e5'));
    assert.equal(err.code, 'ELEMENT_NOT_FOUND');
  });

  it('ConnectionError defaults', () => {
    const err = new ConnectionError();
    assert.ok(err.message.includes('Chrome'));
    assert.equal(err.code, 'CONNECTION_ERROR');
  });

  it('DependencyError includes dependency name', () => {
    const err = new DependencyError('playwright-core');
    assert.ok(err.message.includes('playwright-core'));
    assert.equal(err.code, 'DEPENDENCY_ERROR');
  });
});
