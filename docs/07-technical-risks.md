# Technical Risks

## Screen Sharing Risks

Risk:

- Different apps capture windows differently. Zoom, Teams, Meet, OBS, Loom, PowerPoint, and browser tab sharing can disagree about whether the overlay is visible.

Impact:

- Users may accidentally share the teleprompter or believe it is hidden when it is not.

Mitigation:

- Test capture behavior explicitly in Stage 5.
- Document supported and unsupported modes.
- Avoid promising invisibility.
- Prefer user-controlled discreetness over stealth.
- Provide practical guidance such as "share a window instead of the full screen" only if verified.

## Overlay Risks

Risk:

- Always-on-top, transparency, focus behavior, multi-monitor layouts, DPI scaling, and full-screen apps may behave inconsistently.

Impact:

- The app may disappear, cover critical UI, or become hard to recover.

Mitigation:

- Validate overlay behavior in Stage 1.
- Add reset-position command.
- Persist bounds but recover if off-screen.
- Keep editor controls available even if overlay becomes unusable.
- Test laptop, external monitor, mixed-DPI, and full-screen scenarios.

## Global Shortcut Conflicts

Risk:

- Shortcuts may conflict with Zoom, Teams, OBS, PowerPoint, browser shortcuts, keyboard layouts, or OS-reserved combinations.

Impact:

- Controls may fail during recordings or disrupt the user's active app.

Mitigation:

- Register shortcuts in the main process and detect failures.
- Choose conservative defaults.
- Show shortcut registration status.
- Add customization in v1 if conflicts are common.
- Document known conflicts.

## Click-through Mode Risks

Risk:

- Click-through overlays can be difficult to move, resize, or regain focus.

Impact:

- Users may get stuck with an overlay they cannot control during a live session.

Mitigation:

- Do not enable click-through by default in MVP.
- Gate it behind a debug or explicit setting.
- Provide a global shortcut to disable click-through.
- Keep reset and close controls accessible from the editor.

## Performance Risks

Risk:

- Scroll animation may jitter under CPU load, screen sharing, video recording, or high-DPI rendering.

Impact:

- Reading becomes distracting and unreliable.

Mitigation:

- Use requestAnimationFrame for scroll timing.
- Keep overlay renderer simple.
- Avoid heavy layout recalculation per frame.
- Test long scripts.
- Avoid word-level highlighting in MVP because it increases layout churn.

## Packaging And Windows Installer Risks

Risk:

- Installer, signing, antivirus warnings, app data paths, and auto-update decisions can slow release.

Impact:

- Users may not trust or successfully install the beta.

Mitigation:

- Configure packaging in Stage 6, after core behavior is proven.
- Start with private beta distribution.
- Decide later whether code signing is required before broader release.
- Keep user data in standard Electron user data paths.
- Test install, update-over-install, uninstall, and portable builds.

## Microphone And Voice Tracking Risks

Risk:

- Voice tracking requires microphone permissions, speech/audio processing, latency management, noise handling, accent robustness, and fallback behavior.

Impact:

- Incorrect tracking can ruin recordings. Microphone access creates trust and privacy concerns.

Mitigation:

- Exclude voice tracking from MVP.
- Treat it as an experimental later feature.
- If built, process locally where possible.
- Provide explicit mic permission UX.
- Never upload audio or transcripts without explicit consent.
- Preserve manual controls as the fallback.

## Privacy Risks

Risk:

- Scripts may contain confidential business, interview, legal, medical, financial, or personal content.

Impact:

- Users need confidence that scripts remain private.

Mitigation:

- MVP is local-first with no backend.
- Do not add accounts or cloud sync in MVP.
- Do not include script contents in logs, telemetry, or crash reports.
- Add clear local-delete controls before script history grows.
- If future sync is added, use explicit consent and strong security design.

## Product Scope Risks

Risk:

- Advanced features such as AI writing, voice tracking, cloud sync, and Chrome extension can distract from core reliability.

Impact:

- The app may become broad but unreliable.

Mitigation:

- Ship overlay, shortcuts, countdown, scrolling, editor, and local persistence first.
- Use staged implementation.
- Require each later feature to prove it improves real prompting sessions.

