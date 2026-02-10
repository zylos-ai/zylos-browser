import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateSequence } from '../sequence.js';

describe('sequence - validateSequence', () => {
  it('validates a correct sequence', () => {
    const seq = {
      name: 'test-sequence',
      steps: [
        { action: 'click', target: { role: 'button', name: 'Submit' } },
        { action: 'wait', duration: 500 },
        { action: 'type', target: { role: 'textbox', name: 'Name' }, value: 'Test' }
      ]
    };
    const result = validateSequence(seq);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('rejects missing name', () => {
    const seq = { steps: [{ action: 'click', target: { role: 'button' } }] };
    const result = validateSequence(seq);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('name')));
  });

  it('rejects missing steps', () => {
    const seq = { name: 'test' };
    const result = validateSequence(seq);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('steps')));
  });

  it('rejects unknown actions', () => {
    const seq = {
      name: 'test',
      steps: [{ action: 'fly' }]
    };
    const result = validateSequence(seq);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('fly')));
  });

  it('rejects click without target', () => {
    const seq = {
      name: 'test',
      steps: [{ action: 'click' }]
    };
    const result = validateSequence(seq);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('target')));
  });

  it('rejects type without value', () => {
    const seq = {
      name: 'test',
      steps: [{ action: 'type', target: { role: 'textbox' } }]
    };
    const result = validateSequence(seq);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('value')));
  });

  it('validates all supported action types', () => {
    const seq = {
      name: 'all-actions',
      steps: [
        { action: 'click', target: { role: 'button' } },
        { action: 'type', target: { role: 'textbox' }, value: 'hi' },
        { action: 'fill', target: { role: 'textbox' }, value: 'hi' },
        { action: 'scroll', direction: 'down' },
        { action: 'wait', duration: 100 },
        { action: 'screenshot' },
        { action: 'keypress', key: 'Enter' },
        { action: 'navigate', url: 'https://example.com' }
      ]
    };
    const result = validateSequence(seq);
    assert.equal(result.valid, true);
  });

  it('accepts actions field as alias for steps', () => {
    const seq = {
      name: 'test',
      actions: [{ action: 'wait', duration: 100 }]
    };
    const result = validateSequence(seq);
    assert.equal(result.valid, true);
  });

  it('validates variable definitions', () => {
    const seq = {
      name: 'test',
      steps: [{ action: 'wait' }],
      variables: {
        name: { type: 'string', required: true },
        bad: {}
      }
    };
    const result = validateSequence(seq);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('bad')));
  });
});
