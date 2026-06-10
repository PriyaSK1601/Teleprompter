# Testing Plan

## Manual Testing Checklist

- Launch app from a clean install.
- Open editor window.
- Open overlay window.
- Paste a short script.
- Paste a long script.
- Start countdown.
- Start, pause, resume, restart scrolling.
- Increase and decrease speed using global shortcuts.
- Move and resize overlay.
- Close and reopen overlay.
- Restart app and verify scripts/settings persist.
- Reset overlay position.
- Verify app recovers from missing or malformed settings files.

## Overlay Behaviour Tests

| Test | Expected Result |
| --- | --- |
| Default placement | Overlay appears near top-middle of primary display. |
| Always-on-top over browser | Overlay remains visible above Chrome or Edge. |
| Always-on-top over Zoom/Teams | Overlay remains visible unless app-specific full-screen mode blocks it. |
| Drag overlay | Overlay moves smoothly and remains usable. |
| Resize overlay | Text reflows without breaking scroll. |
| Multi-monitor placement | Overlay can be moved to another monitor and restored. |
| Mixed-DPI displays | Overlay size and position remain sensible. |
| Off-screen recovery | Reset command returns overlay to visible position. |
| Click-through experiment | Click-through can be enabled and disabled safely. |

## Shortcut Tests

| Test | Expected Result |
| --- | --- |
| Register defaults | All default shortcuts register or failures are shown. |
| Focus in another app | Shortcuts still control teleprompter. |
| Start/pause shortcut | Toggles running and paused states. |
| Restart shortcut | Scroll returns to top. |
| Speed up shortcut | Scroll speed increases by predictable step. |
| Slow down shortcut | Scroll speed decreases without going below minimum. |
| Conflict scenario | App reports shortcut registration failure. |

## Scroll Smoothness Tests

| Test | Expected Result |
| --- | --- |
| Short script | Scroll starts and completes cleanly. |
| Long script | Scroll remains smooth without large jumps. |
| High font size | Text remains readable and scroll stays stable. |
| Low opacity background | Text remains readable against common apps. |
| During screen recording | Scroll does not visibly stutter. |
| During video call | Scroll remains usable under CPU/GPU load. |

## Screen-share Tests

Document actual behavior. Do not assume hidden overlay behavior.

Use `docs/10-screen-share-capture-testing.md` as the Stage 5 execution log.

| App / Tool | Full Screen Share | Window Share | Tab Share | Recording | Notes |
| --- | --- | --- | --- | --- | --- |
| Zoom | Test | Test | N/A | Test | Include desktop app behavior. |
| Microsoft Teams | Test | Test | N/A | Test | Include meeting and screen-share modes. |
| Google Meet | Test | Test browser window | Test | Test if possible | Browser capture differs from desktop capture. |
| OBS | Test display capture | Test window capture | N/A | Test | Test whether overlay appears in display capture. |
| Loom | Test screen capture | Test window capture | Test tab capture | Test | Browser and desktop Loom may differ. |
| PowerPoint | Test presenting full screen | Test PowerPoint window | N/A | Test recording | Include presenter mode. |
| Browser-based screen sharing | Test full screen | Test window | Test tab | Test | Include Chrome and Edge. |

## App Persistence Tests

| Test | Expected Result |
| --- | --- |
| Save script | Script appears in saved list. |
| Restart app | Saved scripts remain available. |
| Restore active script | Last active script loads if setting is enabled. |
| Save settings | Text and overlay settings persist. |
| Corrupt settings file | App backs up or ignores bad file and loads defaults. |
| Delete script | Script is removed locally and does not appear after restart. |

## Windows Packaging Tests

| Test | Expected Result |
| --- | --- |
| Clean install | App installs and launches. |
| Portable build | App runs without installer if supported. |
| Update over install | Existing scripts and settings remain. |
| Uninstall | App uninstalls cleanly. |
| Start menu shortcut | Shortcut opens app. |
| Antivirus / SmartScreen review | Any warnings are documented for beta users. |
| Non-admin install | Works if packaging supports it. |

## Suggested Windows Test Matrix

Minimum beta matrix:

- Windows 11 laptop, single display, 100 percent scaling.
- Windows 11 laptop with external monitor, mixed scaling.
- Windows 10 desktop if support is intended.
- Zoom desktop app.
- Teams desktop app.
- Google Meet in Chrome or Edge.
- OBS with display capture and window capture.
- Loom desktop or browser recording.
- PowerPoint presenting and recording.
- Browser-based screen sharing in Chrome and Edge.
