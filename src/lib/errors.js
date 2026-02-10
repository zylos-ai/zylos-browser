/**
 * Error classes for zylos-browser
 */

export class BrowserError extends Error {
  constructor(message, code = 'BROWSER_ERROR', details = null) {
    super(message);
    this.name = 'BrowserError';
    this.code = code;
    this.details = details;
  }
}

export class TimeoutError extends BrowserError {
  constructor(message = 'Operation timed out', details = null) {
    super(message, 'TIMEOUT', details);
    this.name = 'TimeoutError';
  }
}

export class ElementNotFoundError extends BrowserError {
  constructor(ref, details = null) {
    super(`Element not found: ${ref}. Try running snapshot again.`, 'ELEMENT_NOT_FOUND', details);
    this.name = 'ElementNotFoundError';
    this.ref = ref;
  }
}

export class ConnectionError extends BrowserError {
  constructor(message = 'Failed to connect to Chrome via CDP. Is Chrome running?', details = null) {
    super(message, 'CONNECTION_ERROR', details);
    this.name = 'ConnectionError';
  }
}

export class DependencyError extends BrowserError {
  constructor(dependency, message = null) {
    super(message || `Missing dependency: ${dependency}`, 'DEPENDENCY_ERROR', { dependency });
    this.name = 'DependencyError';
  }
}
