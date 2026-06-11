# Teleprompter

Windows-first desktop teleprompter app.

## Current Stage

UI/UX refactor: professional teleprompter experience.

The project currently includes the Electron + TypeScript foundation, polished editor mode, floating glass teleprompter overlay, local script persistence, overlay customisation, screen-share capture test plan, Windows packaging configuration, shortcut support, and highlighting:

- Main process
- Editor window
- Overlay window
- Preload IPC bridge
- IPC ping proof
- Storage path helper
- Top-middle overlay default placement
- Always-on-top transparent overlay window
- Overlay drag and resize
- Overlay show, hide, close, and reset-position controls
- Persisted overlay bounds
- Click-through experiment toggle
- Smooth requestAnimationFrame-based scrolling
- Teleprompter states: idle, countdown, running, paused, completed
- Three second countdown
- Start/pause, restart, speed up, and slow down commands
- Global shortcut registration with visible registration status
- Plain-text script editor
- Local saved scripts in the Electron user data directory
- Save, open, rename, delete, and clear-editor actions
- Active script sync to the overlay
- Persisted text settings for font size, colour, line spacing, and alignment
- Persisted overlay appearance settings for opacity and background colour
- Persisted countdown and scroll speed settings
- Live settings sync to the overlay
- Reset-to-default settings action
- Manual capture test matrix for Zoom, Teams, Google Meet, OBS, Loom, PowerPoint, Chrome, and Edge
- Capture-result definitions and evidence requirements
- electron-builder configuration for Windows NSIS and portable builds
- Recovery reset for overlay position and settings
- Basic local startup and shortcut-failure logging
- Private beta release notes
- Keyboard shortcuts remain active but are no longer configured in the main UI
- Optional sentence/current-line highlighting
- Optional word highlighting experiment
- Highlighting is based on scroll progress, not microphone or voice tracking

It does not implement voice tracking, code signing, or auto-updates yet.

## Screen-share Status

Screen-share and recording behavior must be tested on Windows before making claims about whether the overlay appears in shared or recorded output.

Use [docs/10-screen-share-capture-testing.md](docs/10-screen-share-capture-testing.md) as the Stage 5 execution log.

Current safe wording:

> The overlay is designed to be discreet and controllable. Screen-share visibility depends on the app and share mode.

## Keyboard Shortcuts

- Show overlay: `Ctrl+Alt+O`
- Hide overlay: `Ctrl+Alt+H`
- Start / pause: `Ctrl+Alt+Space`
- Restart: `Ctrl+Alt+R`
- Speed up: `Ctrl+Alt+Up`
- Slow down: `Ctrl+Alt+Down`

Shortcut registration and persistence remain implemented in the app, but shortcut configuration is intentionally hidden from the main interface to keep the editor clean.

## Development

Install dependencies:

```sh
npm install
```

Run a typecheck:

```sh
npm run typecheck
```

Build:

```sh
npm run build
```

Create a Windows unpacked build:

```sh
npm run pack:win
```

Create Windows installer and portable artifacts:

```sh
npm run dist:win
```

Start the app:

```sh
npm run dev
```

## Beta Notes

Use [docs/11-beta-release-notes.md](docs/11-beta-release-notes.md) before distributing a private Windows beta.
