# Teleprompter

Windows-first desktop teleprompter app.

## Current Stage

UI/UX refactor: professional teleprompter experience.

The project currently includes the Electron + TypeScript foundation, polished editor mode, floating glass teleprompter overlay, local script persistence, overlay customisation, screen-share capture test plan, Windows packaging configuration, shortcut support, highlighting, countdown, and manual/voice scroll modes:

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
- Highlighting remains based on scroll progress and stays visually subtle
- Manual scroll mode using the configured scroll speed
- Voice Tracking scroll mode using local microphone activity detection with graceful fallback to Manual when microphone access is unavailable
- Configurable countdown before scrolling starts
- Live settings preview for text colour, font size, spacing, and alignment
- Overlay status for elapsed time, scroll speed, mode, progress, and speed-change feedback

It does not implement code signing or auto-updates yet.

## Screen-share Status

Screen-share and recording behavior must be tested on Windows before making claims about whether the overlay appears in shared or recorded output.

Use [docs/10-screen-share-capture-testing.md](docs/10-screen-share-capture-testing.md) as the Stage 5 execution log.

Current safe wording:

> The overlay is designed to be discreet and controllable. Screen-share visibility depends on the app and share mode.

## Keyboard Shortcuts

Global shortcuts:

- Show overlay: `Ctrl+Alt+O`
- Hide overlay: `Ctrl+Alt+H`
- Start / pause: `Ctrl+Alt+Space`
- Restart: `Ctrl+Alt+R`
- Speed up: `Ctrl+Alt+Up`
- Slow down: `Ctrl+Alt+Down`

Shortcut registration and persistence remain implemented in the app, but shortcut configuration is intentionally hidden from the main interface to keep the editor clean.

Overlay keyboard controls:

- `Up Arrow`: increase scroll speed
- `Down Arrow`: decrease scroll speed
- `Space`: start or pause
- `R`: restart
- `Escape`: hide overlay

Overlay keyboard controls are ignored when focus is inside an input, textarea, select, or contenteditable field.

## Scroll Modes

Manual mode uses the manual scroll speed configured in Settings. Speed can also be adjusted live from the overlay controls or overlay keyboard controls.

Voice Tracking mode uses local microphone audio activity detection in the overlay. It does not send audio to a backend and does not require speech-to-text. When speech is detected, scrolling resumes and adapts speed based on voice activity. When speech stops, scrolling pauses. If microphone access is unavailable or fails, the overlay shows a short message and falls back to Manual mode.

## Countdown Timer

The countdown appears inside the overlay before scrolling begins. Countdown duration and enable/disable state are configurable in Settings.

## Settings

Settings include text colour, font size, spacing, alignment, countdown duration, scroll mode, manual scroll speed, highlight mode, background colour, and overlay opacity. Appearance settings include a live preview panel so changes can be evaluated before starting the teleprompter.

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
