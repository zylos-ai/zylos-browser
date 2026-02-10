# CLAUDE.md

Development guidelines for zylos-browser.

## Project Conventions

- **ESM only** — Use `import`/`export`, never `require()`. All files use ES Modules (`"type": "module"` in package.json)
- **Node.js 20+** — Minimum runtime version
- **Conventional commits** — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- **No `files` in package.json** — Rely on `.gitignore` to exclude unnecessary files. Use `.npmignore` if publishing to npm
- **Secrets in `.env` only** — Never commit secrets. Use `~/zylos/.env` for credentials, `config.json` for non-sensitive runtime config
- **English for code** — Comments, commit messages, PR descriptions, and documentation in English

## Architecture

This is a **capability component** for the Zylos agent ecosystem.

- `src/cli.js` — CLI entry point (`zylos-browser` command)
- `src/lib/browser.js` — Browser connection management (CDP)
- `src/lib/snapshot.js` — Accessibility tree snapshot
- `src/lib/actions.js` — Page interaction actions (click, type, scroll)
- `src/lib/screenshot.js` — Screenshot capture
- `src/lib/__tests__/` — Unit tests (`node --test`)
- `hooks/` — Lifecycle hooks (post-install, pre-upgrade, post-upgrade)

See [DESIGN.md](./DESIGN.md) for full architecture documentation.

## Testing

```bash
npm test
```
