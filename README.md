<p align="center">
  <img src="./assets/logo.png" alt="Zylos" height="120">
</p>

<h1 align="center">zylos-browser</h1>

<p align="center">
  Browser automation component for <a href="https://github.com/zylos-ai/zylos-core">Zylos</a> agents.
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg" alt="Node.js"></a>
</p>

<p align="center">
  <a href="./README.zh-CN.md">中文</a>
</p>

---

- **Browse the web** — your AI agent navigates, clicks, fills forms, and extracts content from any website
- **See like a human** — accessibility tree snapshots let the agent understand page structure, no brittle selectors
- **Learn from mistakes** — per-domain knowledge store tracks gotchas and adapts over time
- **Your browser, your logins** — connect to your own Chrome via CDP, reuse existing sessions without re-authenticating

## Getting Started

Tell your Zylos agent:

> "Install the browser component"

Or use the CLI:

```bash
zylos add browser
```

Zylos will guide you through the setup, including Playwright browser installation.

## Managing the Component

Just tell your Zylos agent what you need:

| Task | Example |
|------|---------|
| Take a screenshot | "Take a screenshot of the current page" |
| Open a URL | "Open https://example.com in the browser" |
| Check status | "Show browser status" |
| Upgrade | "Upgrade browser component" |
| Uninstall | "Uninstall browser component" |

Or manage via CLI:

```bash
zylos upgrade browser
zylos uninstall browser
```

## Architecture

```
zylos-browser (generic toolbox)
    |
    +-- Browser Control     Navigate, click, type, screenshot
    +-- Accessibility Tree  Snapshot with element refs
    +-- Site Knowledge      Per-domain rules and selectors
    +-- Sequence Runner     Multi-step workflow automation
```

Platform-specific logic (Twitter, Xiaohongshu, etc.) belongs in their own components that depend on zylos-browser.

## Documentation

- [SKILL.md](./SKILL.md) — Component specification and CLI commands
- [CHANGELOG.md](./CHANGELOG.md) — Version history

## Contributing

See [Contributing Guide](https://github.com/zylos-ai/.github/blob/main/CONTRIBUTING.md).

## Built by Coco

Zylos is the open-source core of [Coco](https://coco.xyz/) — the AI employee platform.

We built Zylos because we needed it ourselves: reliable infrastructure to keep AI agents running 24/7 on real work. Every component is battle-tested in production at Coco, serving teams that depend on their AI employees every day.

Want a managed experience? [Coco](https://coco.xyz/) gives you a ready-to-work AI employee — persistent memory, multi-channel communication, and skill packages — deployed in 5 minutes.

## License

[MIT](./LICENSE)
