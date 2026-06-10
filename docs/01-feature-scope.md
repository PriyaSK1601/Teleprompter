# Feature Scope

## MVP

| Feature | User Value | Technical Complexity | UX Risk | Privacy / Ethical Concern | Recommendation |
| --- | --- | --- | --- | --- | --- |
| Floating overlay window | Lets users read near the webcam while using any app. | Medium; window flags and multi-monitor positioning need care. | Overlay can cover important UI or feel distracting. | Low. | Build first and test heavily. |
| Top-middle default placement | Starts near typical laptop and monitor webcams. | Low to medium; must account for display work area and DPI. | Wrong on unusual monitor layouts. | Low. | Include default plus manual drag. |
| Always-on-top | Keeps prompt visible above meeting, recording, browser, and slide apps. | Low to medium in Electron; still needs app-specific testing. | Can annoy users if hard to dismiss. | Low. | MVP requirement. |
| Draggable overlay | Lets users align prompt with webcam. | Low. | Drag affordance must not interfere with reading. | Low. | Include a small drag handle or edit mode. |
| Resizable overlay | Handles different scripts, screens, and camera positions. | Low to medium. | Too many resize controls can clutter UI. | Low. | Include basic resize handles or window resize. |
| Discreet overlay styling | Supports professional calls and recordings. | Low. | Too subtle can reduce readability. | Low. | Include opacity and simple background. |
| Separate editor window | Keeps writing and prompting workflows distinct. | Medium. | Users may lose track of which script is live. | Low. | MVP requirement. |
| Paste and edit script | Core content entry. | Low. | Unsaved changes can be lost. | Low. | MVP requirement. |
| Save, open, clear scripts | Enables repeated use. | Low to medium. | Script management can become complex. | Low. | Keep local and simple. |
| Smooth auto-scroll | Core prompting experience. | Medium; frame timing matters. | Jitter breaks trust. | Low. | MVP requirement. |
| Pause, resume, restart | Basic control during delivery. | Low. | State must be obvious. | Low. | MVP requirement. |
| Speed up and slow down | Lets users adapt without touching mouse. | Low. | Speed scale must feel predictable. | Low. | MVP requirement. |
| Global keyboard shortcuts | Controls teleprompter while another app has focus. | Medium; conflicts and OS behavior require testing. | Shortcuts can conflict with meeting apps. | Low. | MVP requirement with remapping later. |
| Countdown before start | Gives user time to prepare after pressing start. | Low. | Countdown overlay can distract if too prominent. | Low. | Include 3-second default. |
| Basic text customization | Improves readability across users and displays. | Low to medium. | Too many settings can slow MVP. | Low. | Include font size, color, line spacing, alignment, overlay opacity. |
| Local saved settings | Preserves user setup across sessions. | Low. | Corrupt settings can break launch. | Low. | Include JSON-backed settings. |

## v1

| Feature | User Value | Technical Complexity | UX Risk | Privacy / Ethical Concern | Recommendation |
| --- | --- | --- | --- | --- | --- |
| Shortcut customization | Avoids conflicts with Zoom, Teams, OBS, and PowerPoint. | Medium. | Bad shortcut capture UX can frustrate users. | Low. | Add after global shortcuts prove reliable. |
| Script history | Helps recover recent scripts and repeated sessions. | Medium. | Can clutter editor and create privacy surprises. | Medium; scripts may contain sensitive content. | Add with clear local-only messaging and delete controls. |
| Named saved scripts | Makes app useful for ongoing work. | Low to medium. | Requires basic organization. | Medium if sensitive content is stored. | Add early v1 or late MVP if simple. |
| Profiles / presets | Speeds setup for interviews, YouTube, meetings, and practice. | Medium. | Presets can feel gimmicky if not grounded in actual usage. | Low. | Add after settings stabilize. |
| Reading speed calibration | Helps users choose scroll speed before recording. | Medium. | Calibration can feel like a chore. | Low. | Add when scroll engine is solid. |
| Estimated reading time | Helps plan scripts and recordings. | Low. | Estimates can be misleading. | Low. | Add with clear "estimate" language. |
| Sentence highlighting | Helps track position while reading. | Medium. | Highlight can distract or reduce natural delivery. | Low. | Add as optional v1 feature. |
| Better capture controls | Helps users understand screen-share behavior. | Medium to high; depends on OS and app capture APIs. | False confidence is dangerous. | Medium. | Add based on test findings, not assumptions. |

## Later

| Feature | User Value | Technical Complexity | UX Risk | Privacy / Ethical Concern | Recommendation |
| --- | --- | --- | --- | --- | --- |
| Word-level highlighting | Can improve pacing for some users. | High if timing is natural; simple fixed-rate mode is easier but weaker. | Can look robotic and pull eyes away from camera. | Low. | Build only after sentence highlighting and calibration prove useful. |
| Voice tracking | Adapts scroll speed to actual speaking pace. | High; requires mic permissions, speech detection, latency handling, and fallback logic. | Incorrect tracking during live recording is worse than manual control. | High; microphone access and transcript handling concerns. | Later experimental feature, not MVP. |
| Voice commands | Hands-free pause, resume, speed changes. | High. | False positives can ruin recordings. | High. | Consider only after strong privacy design. |
| Cloud sync | Syncs scripts and settings across devices. | High; accounts, backend, security, billing, support. | Adds trust and reliability burden. | High. | Defer until local app has real retention. |
| AI script assistance | Helps write or refine scripts. | Medium to high. | Shifts product away from prompting utility. | Medium; scripts may be sensitive. | Later add-on, not core MVP. |
| Cross-platform macOS/Linux | Expands market. | Medium with Electron, but overlay behavior differs by OS. | Support burden grows. | Low. | Consider after Windows MVP proves demand. |

## Avoid For Now

| Feature | User Value | Technical Complexity | UX Risk | Privacy / Ethical Concern | Recommendation |
| --- | --- | --- | --- | --- | --- |
| Chrome extension as MVP | Works inside browser pages. | Medium. | Cannot reliably overlay desktop-wide across Zoom, Teams desktop, OBS, PowerPoint, or arbitrary apps. | Low to medium. | Avoid as MVP; maybe later browser companion. |
| Backend account system | Enables sync and billing later. | High. | Adds friction before product value is proven. | High. | Avoid until paid/customer workflows demand it. |
| Subscriptions and payments | Monetization. | Medium to high. | Premature friction. | Medium. | Avoid during technical validation. |
| Real-time collaboration | Shared script editing. | High. | Not core to solo prompting. | Medium. | Avoid. |
| Meeting-platform-specific integrations | Could improve Zoom/Teams behavior. | High; brittle vendor APIs and permissions. | Maintenance burden. | Medium. | Avoid until core desktop app is validated. |

