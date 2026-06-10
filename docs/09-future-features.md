# Future Features

## Reading Speed Calibration

What it is:

- A guided flow where users read a sample passage or their own script for a timed interval so the app estimates words per minute.

When it becomes worth building:

- After the core scroll engine is reliable.
- When users struggle to choose a comfortable initial scroll speed.
- Before word-level or voice-based features, because calibration provides useful baseline pacing.

Recommendation:

- Good v1 feature.

## Estimated Reading Time

What it is:

- A script-level estimate based on word count and selected words-per-minute speed.

When it becomes worth building:

- Once scripts are saved locally and the app has a stable speed model.
- When users plan content length for recordings or presentations.

Recommendation:

- Low-risk v1 feature.

## Sentence Highlighting

What it is:

- Highlight the current sentence or current paragraph while scrolling.

When it becomes worth building:

- After smooth scrolling works.
- When users report losing their place.
- Before word-level highlighting.

Recommendation:

- Useful v1 feature if implemented as optional and subtle.

## Word Highlighting

What it is:

- Highlight one word at a time, similar to karaoke-style prompting.

When it becomes worth building:

- Only after reading speed calibration exists.
- Only if user testing shows it improves delivery rather than making reading robotic.
- More justified if paired with voice tracking, but that increases complexity.

Recommendation:

- Later feature. Avoid in MVP because fixed-rate word highlighting can desynchronize quickly and may distract users.

## Voice Tracking

What it is:

- The app listens to the user and adjusts scroll speed to match speaking pace.

When it becomes worth building:

- After manual scroll controls are reliable.
- After privacy messaging is mature.
- When enough users ask for hands-free pacing.
- When there is time to build robust fallback behavior.

Recommendation:

- Later experimental feature. Do not include in MVP. Incorrect voice tracking is worse than no voice tracking during a live recording.

## Profiles And Presets

What it is:

- Saved combinations of overlay size, text settings, speed, countdown, and shortcuts for interviews, YouTube, meetings, presentations, and practice.

When it becomes worth building:

- After settings stabilize.
- When users frequently switch contexts.
- When repeated manual setup becomes a common complaint.

Recommendation:

- Good v1 feature after basic customization.

## Cloud Sync

What it is:

- Sync scripts, settings, and presets across devices.

When it becomes worth building:

- After local-first MVP has real usage.
- When users have multiple Windows machines or expect team workflows.
- When monetization or accounts justify backend complexity.

Recommendation:

- Later. Requires accounts, security, privacy, support, and backend operations. Do not build for MVP.

## Chrome Extension

What it is:

- A browser extension that shows prompting text inside browser pages or browser-based recording workflows.

When it becomes worth building:

- After the desktop app is validated.
- If users specifically need prompts inside browser-only tools.
- If it can complement the desktop app rather than replace it.

Recommendation:

- Later companion at most. Avoid as MVP because it cannot provide a desktop-wide always-on-top overlay over Zoom, Teams desktop, PowerPoint, OBS, or arbitrary apps.

## AI Script Assistance

What it is:

- Generate, rewrite, summarize, or adapt scripts.

When it becomes worth building:

- After the app is trusted as a teleprompter.
- When users ask for script preparation, not just prompting.
- When privacy and data handling are explicit.

Recommendation:

- Later add-on. Avoid until core prompting is reliable.

## Voice Commands

What it is:

- Spoken commands such as "pause," "resume," "faster," or "restart."

When it becomes worth building:

- Only after microphone permission UX and local audio processing strategy are solved.
- Only if false positives can be managed.

Recommendation:

- Later experiment. Keep manual global shortcuts as the primary control model.

