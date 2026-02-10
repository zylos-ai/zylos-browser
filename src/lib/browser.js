/**
 * Core browser control — internal module
 *
 * Wraps agent-browser CLI via execFile for core automation.
 * Playwright CDP is lazily loaded only for advanced methods.
 *
 * This is an internal module used by CLI and other modules,
 * not a public API. Platform components use the CLI.
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { getConfig } from './config.js';
import {
  BrowserError,
  TimeoutError,
  ElementNotFoundError,
  ConnectionError,
  DependencyError
} from './errors.js';

const execFile = promisify(execFileCb);

export class Browser {
  constructor(options = {}) {
    const config = getConfig();
    this.cdpPort = options.cdpPort || config.cdp_port || 9222;
    this.headless = options.headless ?? config.headless ?? false;
    this.display = options.display || `:${config.display?.number || 99}`;
    this.timeout = options.timeout || config.sequences?.timeout_default || 30000;
    this._playwright = null;
    this._cdpBrowser = null;
  }

  /**
   * Run an agent-browser command
   * @param {string} command - The command and args (e.g. 'snapshot -i')
   * @param {object} options - Override timeout etc.
   * @returns {string} stdout
   */
  async _exec(command, options = {}) {
    const timeout = options.timeout || this.timeout;
    const env = {
      ...process.env,
      DISPLAY: this.display
    };

    const args = ['--cdp', String(this.cdpPort), ...this._parseArgs(command)];

    try {
      const { stdout, stderr } = await execFile('agent-browser', args, {
        timeout,
        env,
        maxBuffer: 1024 * 1024 * 5 // 5MB
      });
      return stdout.trim();
    } catch (err) {
      if (err.killed || err.signal === 'SIGTERM') {
        throw new TimeoutError(`Command timed out after ${timeout}ms: agent-browser ${command}`, {
          command,
          timeout
        });
      }
      if (err.code === 'ENOENT') {
        throw new DependencyError('agent-browser', 'agent-browser CLI not found. Install: npm install -g agent-browser');
      }

      const stderr = err.stderr?.toString() || '';
      const stdout = err.stdout?.toString() || '';

      if (stderr.includes('ECONNREFUSED') || stderr.includes('connection refused') || stderr.includes('connect ECONNREFUSED')) {
        throw new ConnectionError(`CDP connection failed on port ${this.cdpPort}. Is Chrome running?`);
      }

      throw new BrowserError(
        `agent-browser ${command} failed: ${stderr || stdout || err.message}`,
        'EXEC_ERROR',
        { command, exitCode: err.code, stderr, stdout }
      );
    }
  }

  /**
   * Parse a command string into args array, respecting quotes
   */
  _parseArgs(command) {
    const args = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (const char of command) {
      if (inQuote) {
        if (char === quoteChar) {
          inQuote = false;
        } else {
          current += char;
        }
      } else if (char === '"' || char === "'") {
        inQuote = true;
        quoteChar = char;
      } else if (char === ' ') {
        if (current) {
          args.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    if (current) args.push(current);
    return args;
  }

  // --- Navigation ---

  async open(url) {
    return this._exec(`open ${url}`);
  }

  async reload() {
    return this._exec('reload');
  }

  async back() {
    return this._exec('back');
  }

  async forward() {
    return this._exec('forward');
  }

  async waitForLoad() {
    return this._exec('wait');
  }

  // --- Snapshot & Element Finding ---

  async snapshot(options = {}) {
    const args = ['snapshot'];
    if (options.interactive) args.push('-i');
    if (options.compact) args.push('-c');
    return this._exec(args.join(' '));
  }

  // --- Interaction (via agent-browser) ---

  async click(ref) {
    return this._exec(`click ${ref}`);
  }

  async type(ref, text) {
    return this._exec(`type ${ref} "${text.replace(/"/g, '\\"')}"`);
  }

  async fill(ref, text) {
    return this._exec(`fill ${ref} "${text.replace(/"/g, '\\"')}"`);
  }

  async select(ref, value) {
    return this._exec(`select ${ref} "${value.replace(/"/g, '\\"')}"`);
  }

  async check(ref) {
    return this._exec(`check ${ref}`);
  }

  async scroll(direction, amount) {
    const args = ['scroll', direction];
    if (amount) args.push(String(amount));
    return this._exec(args.join(' '));
  }

  async keypress(key) {
    return this._exec(`keypress ${key}`);
  }

  // --- Visual ---

  async screenshot(filePath) {
    const args = ['screenshot'];
    if (filePath) args.push(filePath);
    return this._exec(args.join(' '));
  }

  // --- Tab Management ---

  async tabs() {
    return this._exec('tabs');
  }

  async switchTab(index) {
    return this._exec(`tab ${index}`);
  }

  async newTab(url) {
    const args = ['newtab'];
    if (url) args.push(url);
    return this._exec(args.join(' '));
  }

  async closeTab(index) {
    const args = ['closetab'];
    if (index !== undefined) args.push(String(index));
    return this._exec(args.join(' '));
  }

  // --- Advanced (Playwright CDP, lazy-loaded) ---

  async _ensurePlaywright() {
    if (this._cdpBrowser) return;

    try {
      const pw = await import('playwright-core');
      this._playwright = pw.default || pw;
      this._cdpBrowser = await this._playwright.chromium.connectOverCDP(
        `http://127.0.0.1:${this.cdpPort}`
      );
    } catch (err) {
      if (err.code === 'ERR_MODULE_NOT_FOUND') {
        throw new DependencyError('playwright-core', 'playwright-core not installed. Run: npm install playwright-core');
      }
      throw new ConnectionError(`Failed to connect via Playwright CDP: ${err.message}`);
    }
  }

  async _getPage() {
    await this._ensurePlaywright();
    const contexts = this._cdpBrowser.contexts();
    if (contexts.length === 0) {
      throw new BrowserError('No browser contexts available');
    }
    const pages = contexts[0].pages();
    if (pages.length === 0) {
      throw new BrowserError('No pages available');
    }
    return pages[0];
  }

  async evaluate(expression) {
    const page = await this._getPage();
    return page.evaluate(expression);
  }

  async cookies() {
    const page = await this._getPage();
    return page.context().cookies();
  }

  async setCookie(cookie) {
    const page = await this._getPage();
    return page.context().addCookies([cookie]);
  }

  async localStorage(key, value) {
    const page = await this._getPage();
    if (value !== undefined) {
      return page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [key, value]);
    }
    return page.evaluate(k => window.localStorage.getItem(k), key);
  }

  async interceptNetwork(pattern, handler) {
    const page = await this._getPage();
    await page.route(pattern, handler);
  }

  async waitForSelector(selector, options = {}) {
    const page = await this._getPage();
    return page.waitForSelector(selector, options);
  }

  async waitForNavigation(urlPattern, timeout = 30000) {
    const page = await this._getPage();
    return page.waitForURL(urlPattern, { timeout });
  }

  async waitForNetworkIdle(timeout = 30000) {
    const page = await this._getPage();
    return page.waitForLoadState('networkidle', { timeout });
  }

  // --- Lifecycle ---

  async connect({ cdpPort, headless } = {}) {
    if (cdpPort) this.cdpPort = cdpPort;
    if (headless !== undefined) this.headless = headless;
    // Verify connection by running a simple command
    await this._exec('snapshot -c', { timeout: 10000 });
  }

  async disconnect() {
    if (this._cdpBrowser) {
      await this._cdpBrowser.close();
      this._cdpBrowser = null;
      this._playwright = null;
    }
  }
}
