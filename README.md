# Teleprompter

Windows-first desktop teleprompter app.

## Current Stage

Stage 3: script editor and local persistence.

The project currently includes the Electron + TypeScript foundation, floating overlay spike, basic teleprompter controls, and local script persistence:

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

It does not implement user customization settings, screen-share testing adjustments, or packaging yet.

## Default Shortcuts

- Show overlay: `Ctrl+Alt+O`
- Hide overlay: `Ctrl+Alt+H`
- Start / pause: `Ctrl+Alt+Space`
- Restart: `Ctrl+Alt+R`
- Speed up: `Ctrl+Alt+Up`
- Slow down: `Ctrl+Alt+Down`

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

Start the app:

```sh
npm run dev
```
