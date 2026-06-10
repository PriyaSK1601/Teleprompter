# MVP Beta Release Notes

## Release Status

Status: packaging-ready, pending Windows build verification.

This beta is intended for private testing. It should not be marketed as production-ready until Windows packaging, screen-share capture behavior, and installer behavior are verified on real Windows machines.

## Included In This Beta

- Floating always-on-top overlay.
- Top-middle default overlay placement.
- Draggable and resizable overlay.
- Overlay position reset and recovery action.
- Plain-text script editor.
- Local saved scripts.
- Active script sync to overlay.
- Smooth scrolling with countdown.
- Start/pause, restart, speed up, and slow down controls.
- Global shortcut registration with visible status.
- Editable global shortcut bindings.
- Per-shortcut enable toggles.
- Shortcut reset-to-default action.
- Text customization: font size, color, line spacing, and alignment.
- Overlay customization: opacity and background color.
- Countdown and scroll speed settings.
- Local-first storage with no account, backend, or cloud sync.
- Basic local app log file.

## Not Included Yet

- Code signing.
- Auto-updates.
- Cloud sync.
- Accounts.
- Payments.
- Voice tracking.
- Voice commands.
- AI script generation.
- Chrome extension.
- Shortcut customization.
- Sentence or word highlighting.

## Known Limitations

- Screen-share and recording behavior is not guaranteed.
- Click-through remains experimental and disabled by default.
- Windows installer behavior still requires clean-machine testing.
- Global shortcuts may conflict with other apps.
- The app icon is not final.
- No automatic crash reporting is included.

## Storage And Privacy

- Scripts are saved locally in Electron's user data directory.
- Settings are saved locally in Electron's user data directory.
- The app does not send scripts to a server.
- The app does not include telemetry.
- Logs should not include script contents.

## Packaging Commands

Build the app JavaScript:

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

Expected artifacts:

- `release/Teleprompter-0.0.0-x64-installer.exe`
- `release/Teleprompter-0.0.0-x64-portable.exe`
- `release/win-unpacked/Teleprompter.exe`

## Windows Beta Checklist

| Test | Expected Result | Status |
| --- | --- | --- |
| Clean install | App installs and launches. | Untested |
| Portable launch | Portable build launches without installer. | Untested |
| First run | Editor window opens. | Untested |
| Overlay open | Overlay appears near top-middle of display. | Untested |
| Save script | Script persists after restart. | Untested |
| Save settings | Settings persist after restart. | Untested |
| Recovery reset | Overlay returns to visible position and defaults. | Untested |
| Update over install | Existing scripts remain. | Untested |
| Uninstall | App uninstalls cleanly. | Untested |
| App data after uninstall | Scripts remain unless explicitly removed by user. | Untested |
| Shortcut registration | Shortcut status is visible in editor. | Untested |
| Log file | Startup log exists in user data logs folder. | Untested |

## Release Decision

Ship private beta only after:

- `npm run typecheck` passes.
- `npm run build` passes.
- Windows packaging command succeeds on a Windows machine.
- At least one clean Windows install has been verified.
- The Stage 5 capture matrix has initial results.
