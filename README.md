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
- Save, open, rename, multi-select delete, and clear-editor actions
- Editor word count, character count, and estimated reading-time metadata
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
- Voice Tracking scroll mode with script-aware speech matching when browser speech recognition is available
- Local microphone activity fallback when speech recognition is unavailable
- Configurable countdown before scrolling starts
- Live settings preview for text colour, font size, spacing, and alignment
- Overlay status for elapsed time, estimated remaining time, scroll speed, mode, progress, and speed-change feedback

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

Voice Tracking mode uses the overlay microphone stream locally. When Electron exposes browser speech recognition, the overlay compares recognised words against the active script with fuzzy matching and advances based on script progress. This keeps the prompt paused if the user goes off-script and resumes when the user returns to the script.

If browser speech recognition is unavailable, the overlay stays in Voice Tracking mode and falls back to local microphone activity detection. In fallback mode, scrolling resumes when speech is detected and pauses when speech stops. If microphone access itself is unavailable or fails, the overlay shows a short message and falls back to Manual mode.

Voice tracking does not send audio to this app’s backend because the MVP has no backend. Speech-recognition availability depends on the Electron/Chromium runtime and operating system support.

## Reading Estimates

The editor shows word count, character count, and estimated reading time for the active script. Estimates use the configured manual scroll speed as a practical reading-speed proxy and fall back to a sensible default when no speed is available.

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
