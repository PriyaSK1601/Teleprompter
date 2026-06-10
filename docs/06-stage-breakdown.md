# Stage Breakdown

## Stage 0: Repo Setup and Technical Spike

When asked to implement this stage, Codex should:

- Scaffold an Electron + TypeScript project.
- Create separate main, preload, editor renderer, and overlay renderer entry points.
- Add basic package scripts for development and build.
- Create two windows: editor and overlay.
- Add a minimal typed IPC bridge.
- Add storage path helper but no final data model implementation.
- Add a short developer README if the repo has none.

Done means:

- `npm install` and the dev command work.
- The editor window can open the overlay window.
- IPC ping/pong works.
- No production feature work has started.

## Stage 1: Floating Overlay Proof of Concept

When asked to implement this stage, Codex should:

- Implement overlay window creation as frameless, transparent or translucent, and always-on-top.
- Position the overlay at the top-middle of the primary display by default.
- Add drag support through a defined drag region or edit mode.
- Add resize support.
- Add show, hide, close, and reset-position actions.
- Persist overlay bounds to a temporary or early settings file.
- Add a debug toggle or config flag for click-through experiments.

Done means:

- Overlay can be placed near the webcam and stays above normal windows.
- Overlay remains recoverable if positioned badly.
- Findings about click-through feasibility are documented.

## Stage 2: Scrolling Engine and Keyboard Controls

When asked to implement this stage, Codex should:

- Add a long-script display to the overlay.
- Implement a requestAnimationFrame scroll loop.
- Add teleprompter states: idle, countdown, running, paused, completed.
- Add start, pause/resume, restart, speed up, and slow down commands.
- Register global shortcuts in the Electron main process.
- Route shortcut events to the overlay.
- Show current speed and state in the editor.

Done means:

- User can read a script while controlling scroll from another focused app.
- Scroll is smooth enough for real use.
- Shortcut registration failures are visible.

## Stage 3: Script Editor and Local Persistence

When asked to implement this stage, Codex should:

- Build the editor UI for writing and editing plain-text scripts.
- Implement saved script records in `scripts.json`.
- Add save, rename, open, duplicate if cheap, and clear actions.
- Sync active script content to the overlay.
- Add unsaved-change prompts or a clear autosave policy.
- Validate local data on load.

Done means:

- Scripts survive app restart.
- The active script is restored or clearly selectable.
- Bad local data does not crash the app.

## Stage 4: Customisation and Settings

When asked to implement this stage, Codex should:

- Add settings controls for font size, text color, line spacing, alignment, overlay opacity, and background color.
- Add countdown enable/seconds setting if the UI remains simple.
- Persist settings to `settings.json`.
- Apply setting changes live to the overlay.
- Add reset-to-default settings.
- Clamp invalid settings values.

Done means:

- A user can make the overlay readable on common display sizes.
- Settings persist across restarts.
- The overlay remains clean and professional.

## Stage 5: Screen-share and Capture Testing

When asked to implement this stage, Codex should:

- Create or update a manual capture test checklist.
- Test overlay behavior against Zoom, Teams, Google Meet, OBS, Loom, PowerPoint, and browser screen sharing on Windows.
- Record which sharing modes show or hide the overlay.
- Test full screen, window share, screen share, tab share, and recording where applicable.
- Add any reliable Electron window flag changes discovered during testing.
- Add in-app wording only if necessary to prevent user misunderstanding.

Done means:

- The project has a documented capture behavior matrix.
- MVP claims about discreet or hidden behavior are accurate.
- Unreliable capture behavior is not marketed as guaranteed.

## Stage 6: MVP Packaging and Beta Release

When asked to implement this stage, Codex should:

- Configure Windows packaging with electron-builder.
- Add app metadata, icon placeholder, installer configuration, and portable build if useful.
- Add basic logging for startup and shortcut registration failures.
- Add a reset overlay/settings recovery action.
- Build and test a local Windows beta package.
- Create release notes and known limitations.

Done means:

- A Windows user can install or run the beta without the dev environment.
- Existing scripts and settings persist across restart.
- The beta package is ready for private testing.

## Stage 7: v1 Features

When asked to implement this stage, Codex should choose a narrow v1 slice, not all v1 features at once. Good candidates:

- Shortcut customization.
- Script history with privacy-conscious delete controls.
- Reading speed calibration.
- Estimated reading time.
- Sentence highlighting.
- Profiles or presets.

Done means:

- The selected feature is integrated with existing storage and settings.
- It does not reduce overlay reliability.
- It has clear manual tests.

Implemented v1 slice:

- Shortcut customization.
- Shortcut bindings are persisted locally.
- Shortcut registration refreshes after saving.
- Failed registrations remain visible in the editor.

## Stage 8: Later Experimental Features

When asked to implement this stage, Codex should treat each feature as an experiment with a kill criterion. Candidates:

- Word-level highlighting.
- Voice tracking.
- Voice commands.
- Cloud sync.
- AI script assistance.
- Chrome extension companion.

Done means:

- The experiment has a prototype, privacy review, and reliability notes.
- It is not merged into the main MVP experience unless it improves real prompting sessions.

Implemented experiment:

- Optional sentence and word highlighting modes.
- Highlighting uses scroll progress only.
- No microphone permission, voice tracking, speech recognition, backend, cloud sync, or AI features were added.
- Default highlight mode remains `none`.
