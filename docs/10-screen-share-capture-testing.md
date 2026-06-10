# Screen-share and Capture Testing

## Stage 5 Status

Status: ready for manual Windows testing.

This document defines the Stage 5 capture test process. It does not claim the overlay is hidden from screen sharing. Capture behavior must be verified on real Windows machines with the target apps because meeting and recording tools use different capture paths.

## Product Rule

Do not market the overlay as hidden, invisible, private, or screen-share-safe until a specific app, mode, Windows version, and app version have been tested.

The safe default user promise is:

> The overlay is designed to be discreet and controllable. Screen-share visibility depends on the app and share mode.

## Test Environment Fields

Record these before every test pass:

| Field | Value |
| --- | --- |
| Tester |  |
| Date |  |
| Windows version |  |
| Device type | Laptop / desktop / VM |
| GPU |  |
| Display setup | Single / external monitor / mixed DPI |
| Display scaling | 100% / 125% / 150% / mixed |
| Teleprompter build |  |
| App under test |  |
| App version |  |
| Capture mode | Full screen / window / tab / display / recording |

## Required Overlay Setup

Use the same setup for each test unless the test case says otherwise:

- Open the editor.
- Create or open a saved script with at least 500 words.
- Open the overlay.
- Place the overlay near the top-middle of the target display.
- Set opacity between 65% and 85%.
- Confirm start/pause, restart, speed up, and slow down work.
- Confirm the overlay is visible to the local user before starting capture.
- Capture or screenshot the receiving side where possible.

## Result Values

Use these exact result values:

- `Visible`: overlay appears in the shared or recorded output.
- `Hidden`: overlay does not appear in the shared or recorded output.
- `Partial`: overlay appears inconsistently, flickers, or appears only in some sub-modes.
- `Blocked`: app or environment could not run the test.
- `Untested`: test has not been run.

## Capture Matrix

| Tool | Mode | Expected Before Testing | Result | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| Zoom desktop | Share full screen | Likely visible | Untested |  | Test participant view. |
| Zoom desktop | Share specific window | Unknown | Untested |  | Test target app window and editor window separately. |
| Zoom desktop | Record meeting | Unknown | Untested |  | Check final recording file. |
| Microsoft Teams desktop | Share full screen | Likely visible | Untested |  | Test participant view. |
| Microsoft Teams desktop | Share specific window | Unknown | Untested |  | New Teams and classic Teams may differ. |
| Microsoft Teams desktop | Record meeting | Unknown | Untested |  | Check cloud/local recording result. |
| Google Meet in Chrome | Share entire screen | Likely visible | Untested |  | Test receiver browser. |
| Google Meet in Chrome | Share browser window | Unknown | Untested |  | Overlay may be outside captured window. |
| Google Meet in Chrome | Share tab | Likely hidden | Untested |  | Confirm overlay is not part of tab capture. |
| Google Meet in Edge | Share entire screen | Likely visible | Untested |  | Browser implementation may differ. |
| Google Meet in Edge | Share tab | Likely hidden | Untested |  | Confirm with receiver. |
| OBS | Display capture | Likely visible | Untested |  | Check preview and recorded output. |
| OBS | Window capture | Unknown | Untested |  | Test target app window capture. |
| OBS | Game capture | Unknown | Untested |  | Only if relevant. |
| Loom desktop | Full screen recording | Likely visible | Untested |  | Check final video. |
| Loom desktop | Window recording | Unknown | Untested |  | Check final video. |
| Loom browser | Tab recording | Likely hidden | Untested |  | Confirm overlay is outside tab capture. |
| PowerPoint desktop | Present full screen | Unknown | Untested |  | Check overlay above slideshow and recording. |
| PowerPoint desktop | Record slideshow | Unknown | Untested |  | Check exported recording. |
| Chrome screen share | Entire screen | Likely visible | Untested |  | Generic WebRTC screen share. |
| Chrome screen share | Window | Unknown | Untested |  | Test target window. |
| Chrome screen share | Tab | Likely hidden | Untested |  | Confirm tab-only capture. |
| Edge screen share | Entire screen | Likely visible | Untested |  | Generic WebRTC screen share. |
| Edge screen share | Window | Unknown | Untested |  | Test target window. |
| Edge screen share | Tab | Likely hidden | Untested |  | Confirm tab-only capture. |

## Overlay Behavior Matrix

| Test | Result | Notes |
| --- | --- | --- |
| Overlay remains always-on-top above Chrome | Untested |  |
| Overlay remains always-on-top above Edge | Untested |  |
| Overlay remains always-on-top above Zoom | Untested |  |
| Overlay remains always-on-top above Teams | Untested |  |
| Overlay remains above PowerPoint slideshow | Untested |  |
| Overlay remains above OBS preview | Untested |  |
| Overlay survives full-screen app transitions | Untested |  |
| Overlay can be reset after moving off-screen | Untested |  |
| Overlay works on external monitor | Untested |  |
| Overlay works with mixed DPI displays | Untested |  |

## Shortcut Matrix

| Context | Start/Pause | Restart | Speed Up | Slow Down | Show/Hide | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Editor focused | Untested | Untested | Untested | Untested | Untested |  |
| Chrome focused | Untested | Untested | Untested | Untested | Untested |  |
| Edge focused | Untested | Untested | Untested | Untested | Untested |  |
| Zoom focused | Untested | Untested | Untested | Untested | Untested |  |
| Teams focused | Untested | Untested | Untested | Untested | Untested |  |
| PowerPoint focused | Untested | Untested | Untested | Untested | Untested |  |
| OBS focused | Untested | Untested | Untested | Untested | Untested |  |

## Click-through Test Matrix

Click-through remains experimental and should stay disabled by default.

| Test | Result | Notes |
| --- | --- | --- |
| Enable click-through from editor | Untested |  |
| Click target app through overlay | Untested |  |
| Disable click-through from editor | Untested |  |
| Hide overlay while click-through is enabled | Untested |  |
| Reset overlay while click-through is enabled | Untested |  |
| Recover if overlay cannot be dragged | Untested |  |

## Evidence Requirements

For each app/mode:

- Save a screenshot of the local screen before sharing.
- Save a screenshot or recording from the receiver or captured output.
- Record whether the overlay was visible, hidden, partial, blocked, or untested.
- Record app version and Windows version.
- Record any shortcut failures.
- Record whether click-through was enabled.

## Release Guidance

Before private beta:

- Complete at least one Windows 11 single-display pass.
- Complete at least one external-monitor pass.
- Complete Zoom, Teams, Google Meet, OBS, Loom, and PowerPoint tests.
- Document exact modes where the overlay is visible.
- Keep click-through labelled experimental unless every recovery path works.

Before public claims about screen sharing:

- Repeat tests after major Zoom, Teams, Chrome, Edge, OBS, Loom, Electron, or Windows updates.
- Do not generalize one app's behavior to another app.
- Do not generalize tab-share behavior to full-screen sharing.

## Current Known Limitation

This repository has not yet been manually tested against Windows screen-share or recording apps. Until those tests are run, the app should be described as a local teleprompter overlay, not as a hidden or capture-excluded overlay.

