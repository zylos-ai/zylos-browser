# zylos-browser

Browser automation capability for Zylos agents. Enables Claude to control a browser for web interactions, data extraction, and automated workflows.

## Architecture

```
Claude (via SKILL.md)
    |
    v
zylos-browser
    |
    +-- agent-browser CLI (core engine, Playwright/CDP)
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
    +-- Sequence Runner (workflow automation)
    |     - Pre-recorded action sequences (JSON)
    |     - Variable interpolation
    |     - Fallback targeting with alternatives
    |     - Precondition checking
    |
    +-- Platform Adapters (domain-specific)
          - Twitter/X: post, reply, like, retweet, bookmark
          - Xiaohongshu: multi-page posts, text-to-image
          - (extensible for more platforms)
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

Persistent per-domain knowledge store that helps the agent learn from past interactions.

| Feature | Description |
|---------|-------------|
| **Gotcha Tracking** | Records common failure patterns per site (e.g., "Twitter's reply button changes ref after page reload") |
| **Element Cache** | Remembers reliable selectors for key elements per URL pattern |
| **Task Success Tracking** | Tracks which approaches work for specific tasks on specific sites |
| **Path Pattern Matching** | Knowledge applies to URL patterns (e.g., `/*/status/*` matches all tweet pages) |

**Storage**: `~/zylos/components/browser/knowledge/{domain}.json`

### 3. Sequence Runner (Workflow Automation)

Pre-recorded browser action sequences for common, repetitive tasks.

| Feature | Description |
|---------|-------------|
| **JSON Sequences** | Define workflows as JSON with steps, variables, and verification |
| **Variable Interpolation** | `{{reply_text}}` syntax for parameterized sequences |
| **Fallback Targeting** | Multiple selector strategies per action (primary + 2-3 alternatives) |
| **Preconditions** | Check URL pattern and required elements before running |
| **Verification** | Verify success after each action with configurable timeout |

**Example sequence** (Twitter reply):
```json
{
  "name": "reply",
  "preconditions": {
    "url_pattern": "x.com/*/status/*"
  },
  "variables": {
    "reply_text": { "type": "string", "required": true }
  },
  "steps": [
    { "action": "click", "target": "@reply-button", "fallbacks": ["[data-testid='reply']"] },
    { "action": "type", "target": "@reply-textbox", "value": "{{reply_text}}" },
    { "action": "click", "target": "@reply-submit" }
  ]
}
```

**Built-in sequences:**
- Twitter/X: reply, like, retweet, bookmark
- Xiaohongshu: post, multi-page post
- (extensible: add new sequences as JSON files)

### 4. Platform Adapters

Domain-specific logic for popular platforms, handling their unique UI patterns.

#### Twitter/X Adapter
| Action | Description |
|--------|-------------|
| `post` | Create a new tweet |
| `reply` | Reply to a tweet |
| `like` | Like a tweet |
| `retweet` | Retweet |
| `bookmark` | Bookmark a tweet |
| `thread` | Post a multi-tweet thread |

#### Xiaohongshu (RedNote) Adapter
| Action | Description |
|--------|-------------|
| `post` | Create a single-page post |
| `multipost` | Create multi-page post from content |
| `detect-page` | Detect current page state |

#### Adding New Adapters
Adapters are plain JS modules that combine sequences + site knowledge for a specific platform. New platforms can be added by:
1. Creating a sequence JSON for each action
2. Adding site knowledge entries
3. (Optional) Adding a platform adapter module for complex logic

### 5. Task Analysis (Self-Healing)

Post-task analysis that helps the agent improve over time.

| Feature | Description |
|---------|-------------|
| **Success/Failure Detection** | Analyze task output to determine success |
| **Gotcha Extraction** | Extract lessons from failures and save to site knowledge |
| **Selector Updates** | Update cached selectors when UI changes |
| **Retry Guidance** | Suggest alternative approaches for failed tasks |

## Interface

### CLI Commands (for Claude)

```bash
# Core browser control (via agent-browser)
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

# Platform shortcuts
zylos-browser twitter reply <tweet-url> <text>
zylos-browser twitter post <text>
zylos-browser xhs post <content-file>
```

### C4 Integration

When installed as a zylos component, Claude can use browser capabilities through natural language via C4 channels:

```
User: "Post this on Twitter: Just shipped zylos-browser v0.1.0!"
Claude: [uses zylos-browser twitter post "Just shipped zylos-browser v0.1.0!"]
```

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
│   ├── xiaohongshu.com.json
│   └── ...
├── sequences/           # Action sequences
│   ├── x.com/
│   │   ├── reply.json
│   │   ├── like.json
│   │   └── ...
│   └── xiaohongshu.com/
│       └── post.json
└── logs/
    ├── out.log
    └── error.log
```

## Reference

- [agent-browser](https://github.com/vercel-labs/agent-browser) - Underlying browser engine
- [zylos-telegram](https://github.com/zylos-ai/zylos-telegram) - Communication component reference
- [zylos-lark](https://github.com/zylos-ai/zylos-lark) - Communication component reference
