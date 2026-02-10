# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-11

Initial public release.

### Added
- Core browser control via agent-browser CLI wrapper
- Site knowledge engine (per-domain knowledge storage)
- Sequence execution engine (pre-recorded browser actions)
- Task analyzer (post-task analysis and self-healing)
- Display manager (Xvfb/VNC/noVNC management)
- Full CLI interface (`zylos-browser` command)
- Auto-install system dependencies (xvfb, x11vnc, websockify)
- VNC password authentication with auto-generation
- Dynamic VNC URL from domain config
- `http_routes` for automatic Caddy reverse proxy
- Lifecycle hooks (post-install, pre-upgrade, post-upgrade)
