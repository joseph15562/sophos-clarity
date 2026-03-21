---
name: FireComply Connector Agent
overview: The Electron connector app code already exists at firecomply-connector/ (31 source files from a previous session). What remains is making it buildable and downloadable -- install deps, add app icons, create the GitHub Actions CI workflow for multi-platform builds, and update the download buttons in AgentManager to link to releases.
todos:
  - id: install-deps
    content: Install npm dependencies in firecomply-connector/ and verify the project compiles
    status: completed
  - id: app-icons
    content: Generate app icons (icon.png, tray-icon.png) for the connector assets directory
    status: completed
  - id: fix-build
    content: Fix any TypeScript or build errors, ensure npm run build succeeds
    status: completed
  - id: github-actions
    content: Create .github/workflows/build-connector.yml for multi-platform Electron builds
    status: completed
  - id: download-buttons
    content: Update AgentManager download buttons to link to GitHub releases (remove disabled)
    status: in_progress
isProject: false
---

# FireComply Connector Agent -- Build & Ship

The Electron app code already exists at `firecomply-connector/` with 31 source files covering the full architecture (main process, renderer UI, firewall API client, XML parser, analysis engine, scheduler, system tray). All code was written in a previous session per the plan at `clarity_connector_agent_86366a85.plan.md`.

What remains is making it buildable and downloadable.

## 1. Install Dependencies and Fix Build

Run `npm install` in `firecomply-connector/`, then `npm run build` to compile both the renderer (Vite) and main process (tsc). Fix any TypeScript errors that arise.

Key files:

- [firecomply-connector/package.json](firecomply-connector/package.json)
- [firecomply-connector/tsconfig.json](firecomply-connector/tsconfig.json)
- [firecomply-connector/tsconfig.main.json](firecomply-connector/tsconfig.main.json)
- [firecomply-connector/vite.config.ts](firecomply-connector/vite.config.ts)

## 2. App Icons

The `firecomply-connector/assets/` directory is empty. Generate a simple app icon (`icon.png` 512x512) and tray icon (`tray-icon.png` 16x16). `electron-builder` requires these for packaging.

A simple SVG-to-PNG approach using a shield/lock icon in the brand purple (#2006F7) on dark background.

## 3. GitHub Actions Workflow

Create `.github/workflows/build-connector.yml`:

- **Trigger**: Push tags matching `connector-v`* or manual `workflow_dispatch`
- **Matrix**: `windows-latest`, `macos-latest`, `ubuntu-latest`
- **Steps**: Checkout, setup Node 20, `npm ci` in `firecomply-connector/`, run the appropriate `dist` script
- **Upload**: Attach release assets from `firecomply-connector/release/`
- **Create GitHub Release** with the three platform installers

## 4. Download Buttons

Update [src/components/AgentManager.tsx](src/components/AgentManager.tsx) lines 526-536:

- Remove `disabled` from all three buttons
- Each button becomes an `<a>` link to the latest GitHub release:
  - Windows: `https://github.com/joseph15562/sophos-clarity/releases/latest/download/FireComply-Connector-Setup.exe`
  - macOS: `https://github.com/joseph15562/sophos-clarity/releases/latest/download/FireComply-Connector.dmg`
  - Linux: `https://github.com/joseph15562/sophos-clarity/releases/latest/download/FireComply-Connector.AppImage`
- Replace "Binaries will be available" text with "Download the latest version from GitHub Releases"

