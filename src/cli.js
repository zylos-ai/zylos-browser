#!/usr/bin/env node
/**
 * zylos-browser CLI entry point
 *
 * Single entry CLI for browser automation. Claude calls this directly.
 * Installed as ~/zylos/bin/zylos-browser via SKILL.md bin field.
 */

import { Browser } from './lib/browser.js';
import { getConfig } from './lib/config.js';

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'help' || command === '--help') {
  printUsage();
  process.exit(0);
}

// Parse global flags
let cdpPort = null;
let headless = false;
const cleanArgs = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--cdp' && args[i + 1]) {
    cdpPort = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--headless') {
    headless = true;
  } else {
    cleanArgs.push(args[i]);
  }
}

const cmd = cleanArgs[0];
const cmdArgs = cleanArgs.slice(1);

async function main() {
  try {
    const opts = {};
    if (cdpPort) opts.cdpPort = cdpPort;
    if (headless) opts.headless = headless;

    switch (cmd) {
      // --- Core browser control ---
      case 'open':
        await runBrowser(opts, b => b.open(requireArg(cmdArgs[0], 'url')));
        break;

      case 'snapshot': {
        const interactive = cmdArgs.includes('-i');
        const compact = cmdArgs.includes('-c');
        await runBrowser(opts, b => b.snapshot({ interactive, compact }));
        break;
      }

      case 'click':
        await runBrowser(opts, b => b.click(requireArg(cmdArgs[0], 'ref')));
        break;

      case 'type':
        await runBrowser(opts, b => b.type(requireArg(cmdArgs[0], 'ref'), requireArg(cmdArgs[1], 'text')));
        break;

      case 'fill':
        await runBrowser(opts, b => b.fill(requireArg(cmdArgs[0], 'ref'), requireArg(cmdArgs[1], 'text')));
        break;

      case 'select':
        await runBrowser(opts, b => b.select(requireArg(cmdArgs[0], 'ref'), requireArg(cmdArgs[1], 'value')));
        break;

      case 'check':
        await runBrowser(opts, b => b.check(requireArg(cmdArgs[0], 'ref')));
        break;

      case 'screenshot':
        await runBrowser(opts, b => b.screenshot(cmdArgs[0]));
        break;

      case 'scroll':
        await runBrowser(opts, b => b.scroll(
          requireArg(cmdArgs[0], 'direction (up|down|left|right)'),
          cmdArgs[1]
        ));
        break;

      case 'keypress':
        await runBrowser(opts, b => b.keypress(requireArg(cmdArgs[0], 'key')));
        break;

      // --- Navigation ---
      case 'back':
        await runBrowser(opts, b => b.back());
        break;

      case 'forward':
        await runBrowser(opts, b => b.forward());
        break;

      case 'reload':
        await runBrowser(opts, b => b.reload());
        break;

      // --- Tab management ---
      case 'tabs':
        await runBrowser(opts, b => b.tabs());
        break;

      case 'tab':
        await runBrowser(opts, b => b.switchTab(requireArg(cmdArgs[0], 'index')));
        break;

      case 'newtab':
        await runBrowser(opts, b => b.newTab(cmdArgs[0]));
        break;

      case 'closetab':
        await runBrowser(opts, b => b.closeTab(cmdArgs[0]));
        break;

      // --- Sequence runner ---
      case 'run':
        await runSequenceCmd(cmdArgs, opts);
        break;

      case 'sequences':
        await listSequencesCmd();
        break;

      // --- Site knowledge ---
      case 'knowledge':
        await knowledgeCmd(cmdArgs);
        break;

      // --- Display management ---
      case 'display':
        await displayCmd(cmdArgs);
        break;

      default:
        console.error(`Unknown command: ${cmd}`);
        console.error('Run "zylos-browser help" for usage.');
        process.exit(1);
    }
  } catch (err) {
    if (err.code) {
      // Structured error from our error classes
      console.error(`[${err.code}] ${err.message}`);
    } else {
      console.error(`Error: ${err.message}`);
    }
    process.exit(1);
  }
}

/**
 * Create a Browser instance, run the action, and print output
 */
async function runBrowser(opts, action) {
  const browser = new Browser(opts);
  const result = await action(browser);
  if (result) console.log(result);
}

/**
 * Require a CLI argument or exit with error
 */
function requireArg(value, name) {
  if (!value) {
    console.error(`Missing required argument: <${name}>`);
    process.exit(1);
  }
  return value;
}

/**
 * Run sequence command
 */
async function runSequenceCmd(cmdArgs, browserOpts) {
  const name = requireArg(cmdArgs[0], 'sequence-name');

  // Parse --var key=value pairs
  const variables = {};
  for (let i = 1; i < cmdArgs.length; i++) {
    if (cmdArgs[i] === '--var' && cmdArgs[i + 1]) {
      const eq = cmdArgs[i + 1].indexOf('=');
      if (eq > 0) {
        variables[cmdArgs[i + 1].slice(0, eq)] = cmdArgs[i + 1].slice(eq + 1);
      }
      i++;
    }
  }

  const { runSequence } = await import('./lib/sequence.js');
  const result = await runSequence(name, variables, browserOpts);
  if (result.success) {
    console.log(`Sequence "${name}" completed successfully.`);
  } else {
    console.error(`Sequence "${name}" failed: ${result.error}`);
    process.exit(1);
  }
}

/**
 * List available sequences
 */
async function listSequencesCmd() {
  const { listSequences } = await import('./lib/sequence.js');
  const sequences = listSequences();
  if (sequences.length === 0) {
    console.log('No sequences available.');
    return;
  }
  console.log('Available sequences:\n');
  for (const seq of sequences) {
    console.log(`  ${seq.name}`);
    if (seq.domain) console.log(`    Domain: ${seq.domain}`);
    if (seq.description) console.log(`    ${seq.description}`);
    if (seq.variables && Object.keys(seq.variables).length > 0) {
      console.log(`    Variables: ${Object.keys(seq.variables).join(', ')}`);
    }
    console.log();
  }
}

/**
 * Knowledge subcommands
 */
async function knowledgeCmd(cmdArgs) {
  const sub = cmdArgs[0];
  if (!sub) {
    console.error('Usage: zylos-browser knowledge <domain|add-gotcha|domains>');
    process.exit(1);
  }

  const { loadKnowledge, formatForPrompt, addGotcha, listDomains } = await import('./lib/knowledge.js');

  switch (sub) {
    case 'domains': {
      const domains = listDomains();
      if (domains.length === 0) {
        console.log('No site knowledge stored yet.');
      } else {
        console.log('Domains with knowledge:\n');
        for (const d of domains) console.log(`  ${d}`);
      }
      break;
    }
    case 'add-gotcha': {
      const domain = requireArg(cmdArgs[1], 'domain');
      const gotcha = requireArg(cmdArgs[2], 'gotcha text');
      const url = `https://${domain}/`;
      const added = addGotcha(url, gotcha);
      if (added) {
        console.log(`Gotcha added to ${domain}.`);
      } else {
        console.log('Gotcha already exists or domain has no knowledge file.');
      }
      break;
    }
    default: {
      // Treat as domain name
      const domain = sub;
      const url = `https://${domain}/`;
      const knowledge = loadKnowledge(url);
      if (!knowledge) {
        console.log(`No knowledge found for ${domain}.`);
      } else {
        console.log(formatForPrompt(knowledge));
      }
      break;
    }
  }
}

/**
 * Display subcommands
 */
async function displayCmd(cmdArgs) {
  const sub = cmdArgs[0];
  if (!sub) {
    console.error('Usage: zylos-browser display <status|start|stop|vnc-url>');
    process.exit(1);
  }

  const display = await import('./lib/display.js');

  switch (sub) {
    case 'status': {
      const status = await display.getDisplayStatus();
      console.log('Display status:');
      console.log(`  Xvfb:  ${status.xvfb ? 'running' : 'stopped'}`);
      console.log(`  VNC:   ${status.vnc ? 'running' : 'stopped'}`);
      console.log(`  noVNC: ${status.novnc ? 'running' : 'stopped'}`);
      console.log(`  DISPLAY: ${status.display}`);
      break;
    }
    case 'start': {
      const result = await display.ensureDisplay();
      console.log(`Display ready (DISPLAY=${result.display})`);
      if (result.started) console.log('  Xvfb was started.');
      const vnc = await display.startVNC();
      console.log(`VNC started on port ${vnc.vncPort}`);
      if (vnc.url) console.log(`noVNC: ${vnc.url}`);
      break;
    }
    case 'stop': {
      await display.stopVNC();
      console.log('VNC stopped.');
      break;
    }
    case 'vnc-url': {
      const config = getConfig();
      const url = display.getVNCUrl(config);
      console.log(url);
      break;
    }
    default:
      console.error(`Unknown display command: ${sub}`);
      process.exit(1);
  }
}

function printUsage() {
  console.log(`zylos-browser - Browser automation for Zylos agents

Usage: zylos-browser <command> [options]

Core Control:
  open <url>                   Navigate to URL
  snapshot [-i] [-c]           Get accessibility tree (-i interactive, -c compact)
  click <ref>                  Click element by ref
  type <ref> <text>            Type text (append)
  fill <ref> <text>            Fill text (replace)
  select <ref> <value>         Select dropdown option
  check <ref>                  Toggle checkbox
  screenshot [path]            Take screenshot
  scroll <direction> [pixels]  Scroll (up|down|left|right)
  keypress <key>               Press key

Navigation:
  back                         Go back
  forward                      Go forward
  reload                       Reload page

Tabs:
  tabs                         List all tabs
  tab <index>                  Switch to tab
  newtab [url]                 Open new tab
  closetab [index]             Close tab

Sequences:
  run <name> [--var k=v ...]   Run a sequence
  sequences                    List available sequences

Knowledge:
  knowledge <domain>           Show knowledge for domain
  knowledge add-gotcha <domain> "<text>"
  knowledge domains            List domains

Display:
  display status               Show Xvfb/VNC status
  display start                Start display + VNC
  display stop                 Stop VNC
  display vnc-url              Show noVNC URL

Global Options:
  --cdp <port>                 CDP port (default: 9222)
  --headless                   Use headless mode
  help                         Show this help`);
}

main();
