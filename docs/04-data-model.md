# Data Model

## Persistence Recommendation

Use local JSON files for the MVP.

Recommended storage:

- `scripts.json`
- `settings.json`
- `shortcuts.json`
- `calibration.json`

Do not use a database for MVP. The app needs simple local persistence for a small number of scripts and settings. JSON is easy to inspect, backup, migrate, and reset. SQLite becomes useful only if script history, full-text search, tagging, sync conflict resolution, or large collections become important.

Avoid IndexedDB for core persistence because the main process should own local data and because renderer-specific browser storage complicates backups, validation, and migrations.

## Script Model

```ts
type ScriptRecord = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
  archived?: boolean;
};
```

MVP rules:

- `id` should be generated locally.
- `title` can be user-entered or derived from the first line.
- `body` is plain text.
- No rich text in MVP.
- No cloud ID in MVP.
- No account ownership fields in MVP.

Suggested file shape:

```ts
type ScriptsFile = {
  version: 1;
  scripts: ScriptRecord[];
  activeScriptId?: string;
};
```

## Settings Model

```ts
type AppSettings = {
  version: 1;
  overlay: OverlaySettings;
  text: TextSettings;
  countdown: CountdownSettings;
  behavior: BehaviorSettings;
};

type OverlaySettings = {
  bounds?: {
    displayId?: string;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  defaultPlacement: "top-middle";
  alwaysOnTop: boolean;
  opacity: number;
  backgroundColor: string;
  clickThroughEnabled: boolean;
};

type TextSettings = {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  lineHeight: number;
  alignment: "left" | "center" | "right";
};

type CountdownSettings = {
  enabled: boolean;
  seconds: number;
};

type BehaviorSettings = {
  scrollSpeed: number;
  speedStep: number;
  startPaused: boolean;
  restoreLastScript: boolean;
};
```

MVP defaults:

- Font size: 32 px.
- Line height: 1.5.
- Alignment: center.
- Countdown: enabled, 3 seconds.
- Overlay opacity: around 0.75.
- Click-through: disabled by default until tested.

## Shortcut Model

```ts
type ShortcutAction =
  | "toggleOverlay"
  | "showEditor"
  | "startPause"
  | "restart"
  | "speedUp"
  | "slowDown";

type ShortcutBinding = {
  action: ShortcutAction;
  accelerator: string;
  enabled: boolean;
};

type ShortcutsFile = {
  version: 1;
  bindings: ShortcutBinding[];
};
```

MVP rules:

- Start with fixed defaults.
- Detect registration failures and show a clear warning in the editor.
- Defer full shortcut remapping until v1 unless conflicts block beta usage.

## Calibration Model

Calibration is not required in MVP, but the data model should leave room for it.

```ts
type CalibrationFile = {
  version: 1;
  wordsPerMinute?: number;
  lastCalibratedAt?: string;
  samples?: CalibrationSample[];
};

type CalibrationSample = {
  id: string;
  wordsRead: number;
  durationSeconds: number;
  calculatedWordsPerMinute: number;
  createdAt: string;
};
```

MVP rule:

- Create no calibration UI in MVP.
- It is acceptable to reserve the file shape later rather than writing an empty file now.

## Data Privacy

- All MVP data stays local.
- No scripts leave the device.
- No telemetry should include script contents.
- If crash reporting is added later, it must redact script text.
- If script history is added, users need clear delete controls.

## Migration Strategy

Each file should include a `version` field. On load:

- If file does not exist, create defaults in memory.
- If file is malformed, back it up and create defaults.
- If version is older, run a migration.
- If version is newer, avoid overwriting it and show a compatibility warning.

