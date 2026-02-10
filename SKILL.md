---
name: browser
version: 0.1.0-beta.2
description: General-purpose browser automation capability
type: capability

lifecycle:
  npm: true
  service: null
  data_dir: ~/zylos/components/browser
  hooks:
    post-install: hooks/post-install.js
    pre-upgrade: hooks/pre-upgrade.js
    post-upgrade: hooks/post-upgrade.js
  preserve:
    - config.json
    - knowledge/
    - sequences/
    - screenshots/

upgrade:
  repo: zylos-ai/zylos-browser
  branch: main

config:
  required: []

bin:
  zylos-browser: src/cli.js

http_routes:
  - path: /vnc/*
    type: reverse_proxy
    target: localhost:6080
    strip_prefix: /vnc

dependencies: []
---

# Browser

General-purpose browser automation capability for Zylos agents.

## Important

- **noVNC URL**: Always use `zylos-browser display vnc-url` to get the correct noVNC URL. Do NOT construct the URL manually — it includes required WebSocket path parameters.
- **Display must be started** before any browser commands: `zylos-browser display start`

## Dependencies

- agent-browser CLI (globally installed)
- Chrome/Chromium with CDP enabled
- Xvfb (for headless display)
- x11vnc + websockify (for VNC/noVNC access, auto-installed by post-install)

## When to Use

- Navigating websites and web applications
- Taking screenshots of web pages
- Filling forms and clicking buttons
- Running pre-recorded browser sequences
- Managing site-specific knowledge for automation

## How to Use

### Core Browser Control

```bash
# Navigate
zylos-browser open <url>
zylos-browser back
zylos-browser forward
zylos-browser reload

# Interact (snapshot first to get element refs)
zylos-browser snapshot -i
zylos-browser click <ref>
zylos-browser type <ref> "text"
zylos-browser fill <ref> "text"
zylos-browser select <ref> <value>
zylos-browser check <ref>
zylos-browser scroll <up|down|left|right> [pixels]
zylos-browser keypress <key>

# Visual
zylos-browser screenshot [path]

# Tab management
zylos-browser tabs
zylos-browser tab <index>
zylos-browser newtab [url]
zylos-browser closetab [index]
```

### Sequence Runner

```bash
# Run a pre-recorded sequence
zylos-browser run <sequence-name> [--var key=value ...]

# List available sequences
zylos-browser sequences
```

### Site Knowledge

```bash
# View knowledge for a domain
zylos-browser knowledge <domain>

# Add a gotcha
zylos-browser knowledge add-gotcha <domain> "gotcha text"

# List all domains with knowledge
zylos-browser knowledge domains
```

### Display Management

```bash
# Check display status (Xvfb, VNC, noVNC)
zylos-browser display status

# Start/stop display infrastructure
zylos-browser display start
zylos-browser display stop

# Get noVNC URL for visual access
zylos-browser display vnc-url
```

## Config Location

- Config: `~/zylos/components/browser/config.json`
- Knowledge: `~/zylos/components/browser/knowledge/`
- Sequences: `~/zylos/components/browser/sequences/`
- Screenshots: `~/zylos/components/browser/screenshots/`
- Logs: `~/zylos/components/browser/logs/`
