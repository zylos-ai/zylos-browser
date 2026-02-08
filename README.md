# zylos-browser

General-purpose browser automation capability for Zylos agents. Enables Claude to control a browser for web interactions, data extraction, and automated workflows.

**Note**: This is a generic browser capability component. Platform-specific logic (Twitter posting, Xiaohongshu publishing, etc.) belongs in their own components that depend on zylos-browser.

## Architecture

```
Platform components (zylos-twitter, zylos-xhs, ...)
    |  depend on
    v
zylos-browser
    |
    +-- Core Browser Control (via agent-browser CLI)
    |     - Page navigation, element interaction, screenshots
    |     - Accessibility tree snapshots with refs
    |     - CDP mode for connecting to existing Chrome
    |
    +-- Site Knowledge (learning layer)
    |     - Per-domain automation knowledge store
    |     - Gotcha tracking (lessons learned from failures)
    |     - Element selector caching
    |     - Success rate tracking per task
    |
    +-- Sequence Runner (workflow engine)
    |     - Pre-recorded action sequences (JSON)
    |     - Variable interpolation
    |     - Fallback targeting with alternatives
    |     - Precondition checking
    |
    +-- Task Analysis (self-healing)
          - Post-task success/failure detection
          - Gotcha extraction from failures
          - Knowledge base auto-update
```

## Capabilities

### 1. Core Browser Control

Wraps [agent-browser](https://github.com/vercel-labs/agent-browser) CLI as the underlying engine.

| Capability | Description |
|------------|-------------|
| **Navigation** | Open URLs, back/forward, reload, wait for load states |
| **Element Interaction** | Click, type, fill, select, check/uncheck, drag & drop |
| **Accessibility Snapshots** | Get page structure with deterministic refs (@e1, @e2...) |
| **Screenshots** | Full page or viewport, PNG format |
| **Form Handling** | Fill forms, upload files, submit |
| **Tab Management** | Open, switch, close tabs |
| **Cookie/Storage** | Read/write cookies, localStorage, sessionStorage |
| **Network** | Intercept requests, mock responses, track API calls |
| **Keyboard** | Key press, key combinations (Ctrl+A, etc.) |
| **Mouse** | Move, click at coordinates, scroll, wheel |
| **Wait Conditions** | Wait for element, text, URL pattern, network idle, JS condition |

**Access modes:**
- **Headless** (default): No display needed, runs in background
- **CDP mode**: Connect to an existing Chrome instance (e.g., with user login sessions)
- **Headed mode**: Visible browser window for debugging

### 2. Site Knowledge (Autonomous Learning)

Persistent per-domain knowledge store that helps the agent learn from past browser interactions.

| Feature | Description |
|---------|-------------|
| **Gotcha Tracking** | Records common failure patterns per site (e.g., "button ref changes after page reload") |
| **Element Cache** | Remembers reliable selectors for key elements per URL pattern |
| **Task Success Tracking** | Tracks which approaches work for specific tasks on specific sites |
| **Path Pattern Matching** | Knowledge applies to URL patterns (e.g., `/*/status/*` matches all tweet pages) |

**Storage**: `~/zylos/components/browser/knowledge/{domain}.json`

**How it works**: Before performing a browser task on a domain, Claude loads that domain's knowledge file to understand known pitfalls and reliable selectors. After task completion, new learnings are saved back.

### 3. Sequence Runner (Workflow Engine)

General-purpose engine for running pre-recorded browser action sequences. Platform components provide their own sequence files; zylos-browser provides the execution engine.

| Feature | Description |
|---------|-------------|
| **JSON Sequences** | Define workflows as JSON with steps, variables, and verification |
| **Variable Interpolation** | `{{variable_name}}` syntax for parameterized sequences |
| **Fallback Targeting** | Multiple selector strategies per action (primary + alternatives) |
| **Preconditions** | Check URL pattern and required elements before running |
| **Verification** | Verify success after each action with configurable timeout |

**Example sequence**:
```json
{
  "name": "fill-contact-form",
  "preconditions": {
    "url_pattern": "example.com/contact"
  },
  "variables": {
    "name": { "type": "string", "required": true },
    "message": { "type": "string", "required": true }
  },
  "steps": [
    { "action": "fill", "target": "@name-input", "value": "{{name}}" },
    { "action": "fill", "target": "@message-input", "value": "{{message}}" },
    { "action": "click", "target": "@submit-button" }
  ]
}
```

Sequence files are stored in `~/zylos/components/browser/sequences/` and can be added by platform components or by the user.

### 4. Task Analysis (Self-Healing)

Post-task analysis that helps the agent improve browser automation over time.

| Feature | Description |
|---------|-------------|
| **Success/Failure Detection** | Analyze task output to determine if the browser action succeeded |
| **Gotcha Extraction** | Extract lessons from failures and save to site knowledge |
| **Selector Updates** | Update cached selectors when UI changes are detected |
| **Retry Guidance** | Suggest alternative approaches for failed tasks |

This creates a feedback loop: execute task -> analyze result -> update knowledge -> next execution is smarter.

## Interface

### CLI Commands (for Claude)

```bash
# Core browser control (delegates to agent-browser)
zylos-browser open <url>
zylos-browser snapshot [-i] [-c]
zylos-browser click <ref|selector>
zylos-browser type <ref|selector> <text>
zylos-browser screenshot [path]

# Sequence runner
zylos-browser run <sequence-name> [--var key=value ...]
zylos-browser sequences                    # List available sequences

# Site knowledge
zylos-browser knowledge <domain>           # View knowledge for domain
zylos-browser knowledge add-gotcha <domain> <gotcha>
```

### For Platform Components

Platform components (e.g., zylos-twitter) that depend on zylos-browser can:
1. Register their own sequence files in `~/zylos/components/browser/sequences/<domain>/`
2. Use the sequence runner API to execute workflows
3. Leverage site knowledge for their target domains

## Requirements

- **Chrome/Chromium** with `--remote-debugging-port=9222` (for CDP mode)
  - Or: `agent-browser install` to download bundled Chromium
- **Node.js** >= 20
- **Display**: X11/Xvfb for headed mode (optional, headless works without)
- **agent-browser** CLI (installed globally via npm)

## Data Directory

```
~/zylos/components/browser/
├── config.json          # Component configuration
├── knowledge/           # Per-domain site knowledge
│   ├── x.com.json
│   └── ...
├── sequences/           # Action sequences (from platform components or user)
│   └── ...
└── logs/
    ├── out.log
    └── error.log
```

## Reference

- [agent-browser](https://github.com/vercel-labs/agent-browser) - Underlying browser engine
- [zylos-telegram](https://github.com/zylos-ai/zylos-telegram) - Communication component reference
- [zylos-lark](https://github.com/zylos-ai/zylos-lark) - Communication component reference
