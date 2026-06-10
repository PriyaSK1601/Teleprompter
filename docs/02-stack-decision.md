# Stack Decision

## Recommendation

Build the MVP as an Electron desktop app with TypeScript.

Recommended stack:

- Electron for desktop shell, windows, global shortcuts, packaging, and Windows APIs where needed.
- TypeScript across main, preload, and renderer code.
- React or plain web UI in renderer. Prefer React if the app needs a structured settings/editor UI; keep the overlay renderer lightweight.
- Local JSON files for MVP persistence.
- electron-builder for Windows packaging once the MVP is stable.

Electron is the best fit because this product depends on a reliable desktop overlay, global shortcuts, local storage, fast UI iteration, and future cross-platform optionality. Electron is not the most lightweight option, but its windowing and packaging maturity make it the most pragmatic MVP choice.

## Decision Matrix

Scoring: 1 = poor, 3 = acceptable, 5 = strong.

| Option | Speed of Development | Floating Overlay Reliability | Always-on-top | Global Shortcuts | Screen-share / Capture Control | Click-through Support | Performance | UI Polish | Windows Packaging | Future Cross-platform | Developer Complexity | Suitability |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Electron | 5 | 4 | 5 | 5 | 3 | 4 | 3 | 5 | 4 | 5 | 3 | 5 |
| Tauri | 3 | 3 | 4 | 3 | 2 | 3 | 5 | 4 | 3 | 4 | 4 | 3 |
| .NET WPF | 3 | 5 | 5 | 4 | 4 | 5 | 5 | 3 | 5 | 1 | 3 | 4 |
| .NET WinUI | 3 | 3 | 4 | 4 | 3 | 3 | 5 | 4 | 4 | 1 | 4 | 3 |
| Qt | 3 | 4 | 4 | 4 | 3 | 4 | 4 | 4 | 3 | 4 | 4 | 3 |
| Web app | 5 | 1 | 1 | 1 | 1 | 1 | 4 | 5 | 5 | 5 | 2 | 1 |
| Chrome extension | 4 | 1 | 1 | 2 | 1 | 1 | 4 | 4 | 4 | 3 | 3 | 1 |

## Option Analysis

### Electron

Strengths:

- Mature support for transparent, frameless, always-on-top windows.
- Built-in global shortcut registration.
- Good developer speed using TypeScript and web UI.
- Cross-platform path remains open after Windows MVP.
- Packaging and auto-update ecosystem is mature.
- Easy separation of main process, preload bridge, editor renderer, and overlay renderer.

Weaknesses:

- Higher memory footprint than native options.
- Capture behavior still needs real-world testing in Zoom, Teams, Meet, OBS, Loom, and PowerPoint.
- Deeper Windows-specific behavior may require native modules or small platform-specific helpers.

Decision:

- Use Electron for MVP.
- Validate overlay, global shortcuts, click-through, and capture behavior before investing in polish.

### Tauri

Strengths:

- Smaller binaries and lower memory usage.
- Uses web technologies for UI.
- Future cross-platform support.

Weaknesses:

- Desktop overlay and global shortcut behavior can be less straightforward.
- Plugin ecosystem and examples for this exact overlay use case are thinner than Electron.
- Rust plus web stack increases implementation complexity.

Decision:

- Avoid for MVP unless binary size is the overriding constraint.

### .NET WPF

Strengths:

- Strongest Windows-native overlay control.
- Excellent performance and access to Win32 APIs.
- Reliable always-on-top, transparency, click-through, and capture-related experiments.
- Mature Windows installer options.

Weaknesses:

- Windows-only.
- UI polish and iteration speed may be slower than web UI depending on team skill.
- Future macOS support would require a rewrite.

Decision:

- Strong fallback if Electron fails key overlay or capture tests.
- Avoid as first choice if future cross-platform support matters.

### .NET WinUI

Strengths:

- Modern Windows UI platform.
- Good performance and Windows integration.

Weaknesses:

- Overlay-style utility windows are often less straightforward than WPF/Win32.
- Desktop app packaging can be more opinionated.
- Windows-only.

Decision:

- Avoid for MVP. It is not the clearest fit for a floating overlay utility.

### Qt

Strengths:

- Mature native cross-platform GUI toolkit.
- Good windowing control.
- Good performance.

Weaknesses:

- Developer experience is heavier for a small product.
- Licensing and packaging choices require attention.
- Web-like editor/settings UI may take more effort.

Decision:

- Avoid for MVP unless the team is already strong in Qt.

### Web App

Strengths:

- Fastest to prototype UI.
- Easiest distribution.

Weaknesses:

- Cannot create true always-on-top desktop overlays.
- Cannot reliably register desktop-wide shortcuts.
- Cannot work over arbitrary apps, PowerPoint, Zoom desktop, Teams desktop, OBS, or screen recording tools.

Decision:

- Avoid as product implementation. It can be used only for marketing or documentation later.

### Chrome Extension

Strengths:

- Useful for prompting inside browser pages.
- Easier install path for browser-only workflows.

Weaknesses:

- Cannot reliably overlay desktop-wide.
- Cannot appear above native Zoom, Teams, PowerPoint, OBS, or arbitrary desktop apps.
- Global shortcut behavior is browser-scoped and limited.
- Screen sharing behavior is constrained by Chrome and page context.

Decision:

- Do not build first.
- Consider later only as a companion for browser-based recording workflows.

## Why Electron Is Best For The MVP

The MVP's riskiest requirements are desktop overlay reliability and global controls. Electron supports both directly while preserving fast product iteration. It lets the team build a polished editor/settings experience with web technologies while keeping overlay behavior in the main process where desktop window control belongs.

The first implementation should not assume Electron is perfect. Stage 1 must prove always-on-top, transparency, dragging, resizing, click-through feasibility, multi-monitor placement, DPI scaling, and capture behavior on Windows.

## Stacks To Avoid For Now

- Avoid Chrome extension for MVP because it cannot solve the desktop-wide overlay problem.
- Avoid pure web app because it cannot meet core product requirements.
- Avoid WinUI because it adds Windows platform constraints without being clearly better than WPF for overlay work.
- Avoid Tauri unless binary size is more important than development certainty.
- Avoid Qt unless the team already has Qt expertise.

