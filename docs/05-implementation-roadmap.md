# Implementation Roadmap

## Roadmap Principle

Validate risky desktop behavior before investing in polish. The first stages should prove that Electron can provide a reliable floating overlay, global shortcuts, smooth scrolling, and acceptable screen-share behavior on Windows.

## Stage 0: Repo Setup and Technical Spike

Goal:

- Establish the Electron TypeScript foundation and verify the local development loop.

Features included:

- Electron app shell.
- Main, preload, editor renderer, and overlay renderer structure.
- Basic dev scripts and packaging skeleton.

Tasks:

- Scaffold Electron + TypeScript project.
- Add linting and formatting if lightweight.
- Create placeholder editor and overlay windows.
- Add typed IPC contracts.
- Add storage folder helper using Electron user data path.

Acceptance criteria:

- App starts locally on Windows.
- Editor window opens.
- Overlay window can be created and closed.
- IPC ping works between renderer and main process.

What not to include:

- Production UI polish.
- Full script management.
- Advanced settings.
- Voice, AI, cloud, payments, or extension code.

## Stage 1: Floating Overlay Proof of Concept

Goal:

- Prove the hardest desktop window assumptions early.

Features included:

- Top-middle overlay placement.
- Always-on-top overlay.
- Transparent or translucent background.
- Drag and resize.
- Basic show/hide.
- Optional click-through experiment behind a setting or debug toggle.

Tasks:

- Implement overlay window flags.
- Position overlay using display work area.
- Persist and restore overlay bounds.
- Test multi-monitor and DPI behavior.
- Add manual controls for show/hide and reset position.

Acceptance criteria:

- Overlay appears near the top-middle of the active or primary display.
- Overlay remains above common apps.
- User can move and resize it.
- Overlay can be hidden and restored.
- App can recover if overlay is moved off-screen.

What not to include:

- Full scrolling engine.
- Script library.
- Highlighting.
- Capture guarantees.

## Stage 2: Scrolling Engine and Keyboard Controls

Goal:

- Make the teleprompter usable during another app's focus.

Features included:

- Smooth auto-scroll.
- Start, pause, resume, restart.
- Speed up and slow down.
- Global keyboard shortcuts.
- Countdown before scrolling.

Tasks:

- Build requestAnimationFrame-based scroll loop.
- Define scroll state machine.
- Add countdown state.
- Register global shortcuts in main process.
- Route shortcut commands to overlay.
- Show minimal status in editor.

Acceptance criteria:

- Text scrolls smoothly for long scripts.
- Shortcuts work while another app has focus.
- Countdown defaults to 3 seconds.
- Speed changes are predictable.
- Restart returns to top.

What not to include:

- Shortcut customization.
- Voice tracking.
- Word highlighting.
- Complex animation effects.

## Stage 3: Script Editor and Local Persistence

Goal:

- Let users create and reuse scripts locally.

Features included:

- Paste and edit scripts.
- Save, open, rename, and clear scripts.
- Active script sync to overlay.
- Local JSON persistence.

Tasks:

- Build editor UI.
- Implement scripts JSON storage.
- Add active script state.
- Add unsaved-change handling.
- Validate persistence and recovery behavior.

Acceptance criteria:

- User can save multiple local scripts.
- Last active script can be restored.
- Overlay updates when active script changes.
- Malformed or missing data files do not crash the app.

What not to include:

- Cloud sync.
- Accounts.
- Collaboration.
- Rich text.

## Stage 4: Customisation and Settings

Goal:

- Make the overlay readable across different users and display setups.

Features included:

- Font size.
- Text color.
- Line spacing.
- Text alignment.
- Overlay opacity.
- Background color or glass-like background.
- Countdown enable/seconds setting if simple.

Tasks:

- Implement settings UI.
- Persist settings locally.
- Apply settings live to overlay.
- Add reset-to-defaults.
- Validate bounds for numeric settings.

Acceptance criteria:

- Text can be made readable on common screen sizes.
- Settings persist after restart.
- Bad settings values are clamped or reset.
- Overlay remains visually discreet.

What not to include:

- Themes marketplace.
- Advanced typography.
- Profile presets.
- Sentence or word highlighting.

## Stage 5: Screen-share and Capture Testing

Goal:

- Establish what the app can honestly promise about screen sharing and recording.

Features included:

- Manual test matrix.
- Capture behavior notes inside docs or beta guide.
- Optional technical adjustments if Electron supports them reliably.

Tasks:

- Test Zoom, Teams, Google Meet, OBS, Loom, PowerPoint, and browser screen sharing.
- Test full-screen, window-share, and tab-share modes where applicable.
- Test click-through and always-on-top during screen sharing.
- Document which modes capture or exclude the overlay.
- Adjust window flags only where behavior is proven.

Acceptance criteria:

- Known capture behaviors are documented.
- The app does not make false promises.
- Users have practical guidance for discreet use.

What not to include:

- Platform-specific integrations.
- Unsupported capture bypass claims.
- Stealth behavior that violates platform expectations.

## Stage 6: MVP Packaging and Beta Release

Goal:

- Produce a Windows beta build that can be installed and used outside development.

Features included:

- Windows packaging.
- Basic app icon and metadata.
- Reset/recovery controls.
- Beta release notes.

Tasks:

- Configure electron-builder.
- Build Windows installer or portable executable.
- Verify clean install, update-over-install, and uninstall behavior.
- Add basic error handling and logs.
- Prepare beta checklist.

Acceptance criteria:

- App installs and launches on a clean Windows machine.
- User data persists across app restart.
- Uninstall does not unexpectedly delete scripts unless documented.
- Beta build is usable for real recording sessions.

What not to include:

- Auto-updater unless distribution path requires it.
- Payments.
- Cloud.
- Advanced analytics.

