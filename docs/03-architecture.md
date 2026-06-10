# Architecture

## MVP Architecture

The MVP should use Electron with a small number of explicit responsibilities:

- Main process owns native desktop concerns: app lifecycle, window creation, global shortcuts, persistence file access, and IPC routing.
- Overlay renderer owns teleprompter display and scroll animation.
- Editor renderer owns script editing, saved scripts, settings UI, and controls.
- Preload scripts expose narrow, typed APIs to renderers.
- Local storage layer reads and writes JSON files in the app user data directory.

## Window Model

### Editor Window

Purpose:

- Primary app window.
- Paste, edit, save, open, clear, and manage scripts.
- Configure text and overlay settings.
- Start countdown and open/close overlay.

Initial behavior:

- Normal framed window.
- Minimum usable size, for example 900 x 650.
- Can be hidden and restored with a global shortcut.
- Owns script editing and settings controls.

### Overlay Window

Purpose:

- Floating teleprompter display.
- Always-on-top.
- Transparent or semi-transparent background.
- Top-middle default placement.
- Draggable and resizable.
- Can run independently while editor is hidden.

Initial behavior:

- Frameless.
- Transparent or translucent.
- Always-on-top using Electron window APIs.
- Skip taskbar if the behavior is not confusing.
- Can be shown/hidden with shortcut.
- Receives state updates from main process.

Important implementation note:

Click-through should be tested as an optional mode, not assumed as the default. Users still need a way to drag, resize, and regain control of the overlay.

## Main Process Responsibilities

- Create and manage editor and overlay windows.
- Register global shortcuts.
- Store current teleprompter state.
- Route IPC commands between editor and overlay.
- Persist scripts and settings to local JSON.
- Restore last overlay bounds and settings.
- Handle app startup, shutdown, and single-instance behavior.
- Own platform-specific capture and window behavior experiments.

## Renderer Responsibilities

### Editor Renderer

- Script textarea or editor component.
- Script list and save/open/clear controls.
- Settings controls for font size, text color, line spacing, alignment, opacity, and countdown.
- Buttons for open overlay, start, pause, restart, and close overlay.
- Shortcut display and later shortcut customization.

### Overlay Renderer

- Render script text using current settings.
- Maintain smooth scroll animation using requestAnimationFrame.
- Show countdown state.
- Show paused/running state subtly.
- Render optional drag/edit handles.
- Accept commands from main process: load script, start countdown, start scroll, pause, resume, restart, set speed, update settings.

## Local Storage Layer

Use files under Electron's `app.getPath("userData")`.

Suggested files:

- `scripts.json` for saved scripts.
- `settings.json` for app and overlay settings.
- `shortcuts.json` for keyboard shortcut bindings.
- `calibration.json` for future reading-speed calibration.

The storage layer should validate loaded data and fall back to defaults if files are missing or malformed.

## Keyboard Shortcut Layer

The main process should register global shortcuts and translate them into app commands.

Initial shortcuts:

- Show/hide overlay.
- Show editor.
- Start or pause scrolling.
- Restart from top.
- Increase speed.
- Decrease speed.

The MVP can ship with defaults. Shortcut customization belongs in v1 unless conflicts appear during testing.

## IPC / Event Flow

Examples:

- Editor updates script -> editor renderer sends `script:update` -> main stores current script -> main sends `overlay:scriptChanged`.
- User presses Start -> editor sends `teleprompter:startCountdown` -> main sends countdown command to overlay.
- User presses global pause shortcut -> main handles shortcut -> main sends `teleprompter:togglePause` to overlay -> overlay replies with new state.
- Overlay bounds change -> overlay or main captures bounds -> main saves settings.
- Settings change -> editor sends `settings:update` -> main saves settings -> main sends `overlay:settingsChanged`.

## Text Architecture Diagram

```text
Windows OS
  |
  | global shortcuts, window focus, always-on-top behavior
  v
Electron Main Process
  |-- App lifecycle
  |-- Window manager
  |-- Global shortcut registry
  |-- Local JSON storage
  |-- IPC command router
  |
  | IPC via preload APIs
  v
+----------------------+        +----------------------+
| Editor Window        |        | Overlay Window       |
|----------------------|        |----------------------|
| Script editor        |        | Script display       |
| Saved scripts        |        | Countdown            |
| Settings controls    |        | Smooth scroll engine |
| Start/pause controls |        | Overlay handles      |
+----------------------+        +----------------------+
        |                                  ^
        | script/settings/control events   |
        +----------------------------------+
```

## Security Boundaries

- Disable direct Node.js access in renderers.
- Use preload scripts with a narrow API.
- Validate IPC payloads in the main process.
- Treat local scripts as private user data.
- Avoid backend calls in MVP.

