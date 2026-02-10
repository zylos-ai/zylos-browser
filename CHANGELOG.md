# Changelog

## 0.1.0-beta.1 (2026-02-10)

### Fixed
- **VNC password authentication**: Replace `-nopw` with `-rfbauth` using auto-generated password file
- **websockify path detection**: Auto-detect noVNC web directory across common installation paths
- **Dynamic VNC URL**: Read domain from `~/zylos/.env` instead of hardcoded `zylos10.jinglever.com`

### Added
- `http_routes` in SKILL.md for automatic Caddy `/vnc/*` reverse proxy configuration
- `loadEnv()` helper in config.js for reading `~/zylos/.env`
- VNC password auto-generation in post-install hook
- Auto-start display infrastructure when all dependencies are present

---

## 0.1.0 (2026-02-10)

Initial release.

- Core browser control via agent-browser CLI wrapper
- Site knowledge engine (per-domain knowledge storage)
- Sequence execution engine (pre-recorded browser actions)
- Task analyzer (post-task analysis and self-healing)
- Display manager (Xvfb/VNC/noVNC management)
- Full CLI interface (`zylos-browser` command)
- Lifecycle hooks (post-install, pre-upgrade, post-upgrade)
