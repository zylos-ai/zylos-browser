# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-03-06

### Fixed
- **PM2 cannot start Xvfb**: PM2 treated `Xvfb` as a JS script path. Now uses full binary path with `--interpreter none` (#24)
- **noVNC web client not bundled**: `post-install.js` now installs the `novnc` apt package so `vnc.html` is served correctly (#18)
- **noVNC viewport clipped**: Chrome window size (1920x1080) exceeded Xvfb resolution (1280x1024). Aligned to match, and added `resize=scale` to noVNC URL for auto-scaling (#23)
- **CJK fonts not installed**: `post-install.js` now installs `fonts-noto-cjk` and configures fontconfig rules for Chrome (#20, #22)
- **VNC display quality**: Added `-noxdamage` flag to x11vnc for more reliable screen updates
- **Chrome profile lost on reboot**: `user-data-dir` moved from `/tmp/chrome-zylos` to persistent `DATA_DIR/chrome-profile`
- Chrome `--no-sandbox` warning banner by adding `--test-type` flag
- Chinese text garbled (mojibake) when pasting via noVNC clipboard panel by adding `-utf8` to x11vnc

### Added
- `xdotool` installed as optional dependency for clipboard/input automation (#21)
- `--no-sandbox` Chrome flag for compatibility with non-system Chrome installs
- Chrome installation now prefers Google Chrome stable (non-Snap) over `chromium-browser` to avoid Snap sandbox issues

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
