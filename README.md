# zylos-browser

[![Version](https://img.shields.io/badge/version-0.1.0--beta.2-blue.svg)](https://github.com/zylos-ai/zylos-browser/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

Browser automation component for [Zylos](https://github.com/zylos-ai/zylos-core) agents — a generic toolbox for web interaction.

## Features

- **Page Navigation** — Open URLs, click elements, fill forms
- **Content Extraction** — Read page content, take screenshots
- **Site Knowledge** — Per-domain interaction rules and selectors
- **Sequence Runner** — Automate multi-step browser workflows
- **VNC Support** — Watch browser activity in real-time via VNC

## Getting Started

Tell your Zylos agent:

> "Install the browser component"

Zylos will guide you through the setup, including Playwright browser installation.

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
    |     - Headless, headed, or CDP mode (connect to existing Chrome)
    |
    +-- Site Knowledge (learning layer)
    |     - Per-domain automation knowledge store
    |     - Gotcha tracking (lessons learned from failures)
    |     - Element selector caching and success rate tracking
    |
    +-- Sequence Runner (workflow engine)
    |     - Pre-recorded action sequences (JSON)
    |     - Variable interpolation and fallback targeting
    |     - Precondition checking and verification
    |
    +-- Task Analysis (self-healing)
          - Post-task success/failure detection
          - Gotcha extraction and knowledge base auto-update
```

zylos-browser is a **generic toolbox, not a platform framework**. Platform-specific logic (Twitter posting, Xiaohongshu publishing, etc.) belongs in their own components that depend on zylos-browser.

## Managing the Component

| Task | Example |
|------|---------|
| Check status | "Show browser status" |
| View logs | "Show browser logs" |
| Take screenshot | "Take a screenshot of the current page" |

## Documentation

- [SKILL.md](./SKILL.md) — Component specification and CLI commands
- [CHANGELOG.md](./CHANGELOG.md) — Version history

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a Pull Request

## License

[MIT](./LICENSE)

---

Made with Claude by [Zylos AI](https://github.com/zylos-ai)
