import { app } from "electron";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  AppSettings,
  OverlaySettings,
  SaveScriptInput,
  ScriptRecord,
  ShortcutBinding,
  ShortcutUpdateInput,
  ShortcutsFile,
  ScriptsFile,
  ScriptsState,
  SettingsUpdate,
  StorageInfo
} from "../shared/ipc";

const defaultOverlaySettings: OverlaySettings = {
  version: 1,
  clickThroughEnabled: false
};

const defaultScriptsFile: ScriptsFile = {
  version: 1,
  scripts: []
};

export const defaultShortcutBindings: ShortcutBinding[] = [
  { action: "showOverlay", accelerator: "CommandOrControl+Alt+O", enabled: true },
  { action: "hideOverlay", accelerator: "CommandOrControl+Alt+H", enabled: true },
  { action: "startPause", accelerator: "CommandOrControl+Alt+Space", enabled: true },
  { action: "restart", accelerator: "CommandOrControl+Alt+R", enabled: true },
  { action: "speedUp", accelerator: "CommandOrControl+Alt+Up", enabled: true },
  { action: "slowDown", accelerator: "CommandOrControl+Alt+Down", enabled: true }
];

const defaultShortcutsFile: ShortcutsFile = {
  version: 1,
  bindings: defaultShortcutBindings
};

const defaultAppSettings: AppSettings = {
  version: 1,
  text: {
    fontSize: 32,
    textColor: "#f9fafb",
    lineHeight: 1.5,
    alignment: "center"
  },
  overlayAppearance: {
    opacity: 0.82,
    backgroundColor: "#111827"
  },
  countdown: {
    enabled: true,
    seconds: 3
  },
  behavior: {
    scrollSpeed: 36
  },
  experimental: {
    highlightMode: "sentence"
  }
};

export function getStorageInfo(): StorageInfo {
  return {
    userDataPath: app.getPath("userData")
  };
}

export function ensureAppDataDirectories(): void {
  const dataPath = app.getPath("userData");
  const directories = ["scripts", "settings", "logs"];

  for (const directory of directories) {
    mkdirSync(join(dataPath, directory), { recursive: true });
  }
}

function overlaySettingsPath(): string {
  return join(app.getPath("userData"), "settings", "overlay.json");
}

function scriptsPath(): string {
  return join(app.getPath("userData"), "scripts", "scripts.json");
}

function appSettingsPath(): string {
  return join(app.getPath("userData"), "settings", "settings.json");
}

function shortcutsPath(): string {
  return join(app.getPath("userData"), "settings", "shortcuts.json");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function normalizeAppSettings(settings: AppSettings): AppSettings {
  const alignmentValues = ["left", "center", "right"] as const;
  const highlightModes = ["none", "sentence", "word"] as const;

  return {
    version: 1,
    text: {
      fontSize: clamp(Number(settings.text.fontSize) || defaultAppSettings.text.fontSize, 18, 72),
      textColor: isHexColor(settings.text.textColor)
        ? settings.text.textColor
        : defaultAppSettings.text.textColor,
      lineHeight: clamp(Number(settings.text.lineHeight) || defaultAppSettings.text.lineHeight, 1.1, 2.2),
      alignment: alignmentValues.includes(settings.text.alignment)
        ? settings.text.alignment
        : defaultAppSettings.text.alignment
    },
    overlayAppearance: {
      opacity: clamp(
        Number(settings.overlayAppearance.opacity) || defaultAppSettings.overlayAppearance.opacity,
        0.25,
        1
      ),
      backgroundColor: isHexColor(settings.overlayAppearance.backgroundColor)
        ? settings.overlayAppearance.backgroundColor
        : defaultAppSettings.overlayAppearance.backgroundColor
    },
    countdown: {
      enabled: Boolean(settings.countdown.enabled),
      seconds: Math.round(clamp(Number(settings.countdown.seconds) || defaultAppSettings.countdown.seconds, 0, 10))
    },
    behavior: {
      scrollSpeed: Math.round(
        clamp(Number(settings.behavior.scrollSpeed) || defaultAppSettings.behavior.scrollSpeed, 8, 160)
      )
    },
    experimental: {
      highlightMode: highlightModes.includes(settings.experimental.highlightMode)
        ? settings.experimental.highlightMode
        : defaultAppSettings.experimental.highlightMode
    }
  };
}

function isOverlaySettings(value: unknown): value is OverlaySettings {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<OverlaySettings>;
  return candidate.version === 1 && typeof candidate.clickThroughEnabled === "boolean";
}

export function loadOverlaySettings(): OverlaySettings {
  const path = overlaySettingsPath();

  if (!existsSync(path)) {
    return { ...defaultOverlaySettings };
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;

    if (isOverlaySettings(parsed)) {
      return parsed;
    }
  } catch {
    return { ...defaultOverlaySettings };
  }

  return { ...defaultOverlaySettings };
}

export function saveOverlaySettings(settings: OverlaySettings): void {
  ensureAppDataDirectories();
  writeFileSync(overlaySettingsPath(), `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

function isAppSettings(value: unknown): value is AppSettings {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AppSettings>;

  return (
    candidate.version === 1 &&
    typeof candidate.text === "object" &&
    typeof candidate.overlayAppearance === "object" &&
    typeof candidate.countdown === "object" &&
    typeof candidate.behavior === "object"
  );
}

export function getDefaultAppSettings(): AppSettings {
  return normalizeAppSettings(defaultAppSettings);
}

export function loadAppSettings(): AppSettings {
  const path = appSettingsPath();

  if (!existsSync(path)) {
    return getDefaultAppSettings();
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;

    if (isAppSettings(parsed)) {
      return normalizeAppSettings({
        version: 1,
        text: {
          ...defaultAppSettings.text,
          ...parsed.text
        },
        overlayAppearance: {
          ...defaultAppSettings.overlayAppearance,
          ...parsed.overlayAppearance
        },
        countdown: {
          ...defaultAppSettings.countdown,
          ...parsed.countdown
        },
        behavior: {
          ...defaultAppSettings.behavior,
          ...parsed.behavior
        },
        experimental: {
          ...defaultAppSettings.experimental,
          ...parsed.experimental
        }
      });
    }
  } catch {
    return getDefaultAppSettings();
  }

  return getDefaultAppSettings();
}

export function saveAppSettings(settings: AppSettings): void {
  ensureAppDataDirectories();
  writeFileSync(appSettingsPath(), `${JSON.stringify(normalizeAppSettings(settings), null, 2)}\n`, "utf8");
}

export function updateAppSettings(update: SettingsUpdate): AppSettings {
  const currentSettings = loadAppSettings();
  const nextSettings = normalizeAppSettings({
    version: 1,
    text: {
      ...currentSettings.text,
      ...update.text
    },
    overlayAppearance: {
      ...currentSettings.overlayAppearance,
      ...update.overlayAppearance
    },
    countdown: {
      ...currentSettings.countdown,
      ...update.countdown
    },
    behavior: {
      ...currentSettings.behavior,
      ...update.behavior
    },
    experimental: {
      ...currentSettings.experimental,
      ...update.experimental
    }
  });

  saveAppSettings(nextSettings);
  return nextSettings;
}

export function resetAppSettings(): AppSettings {
  const settings = getDefaultAppSettings();
  saveAppSettings(settings);
  return settings;
}

export function resetOverlaySettings(): OverlaySettings {
  const settings: OverlaySettings = {
    version: 1,
    clickThroughEnabled: false
  };

  saveOverlaySettings(settings);
  return settings;
}

function isShortcutAction(value: unknown): value is ShortcutBinding["action"] {
  return defaultShortcutBindings.some((binding) => binding.action === value);
}

function isShortcutBinding(value: unknown): value is ShortcutBinding {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ShortcutBinding>;
  return (
    isShortcutAction(candidate.action) &&
    typeof candidate.accelerator === "string" &&
    typeof candidate.enabled === "boolean"
  );
}

function isShortcutsFile(value: unknown): value is ShortcutsFile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ShortcutsFile>;
  return candidate.version === 1 && Array.isArray(candidate.bindings) && candidate.bindings.every(isShortcutBinding);
}

function normalizeShortcutBindings(bindings: ShortcutBinding[]): ShortcutBinding[] {
  return defaultShortcutBindings.map((defaultBinding) => {
    const override = bindings.find((binding) => binding.action === defaultBinding.action);
    const accelerator = override?.accelerator.trim() || defaultBinding.accelerator;

    return {
      action: defaultBinding.action,
      accelerator,
      enabled: override?.enabled ?? defaultBinding.enabled
    };
  });
}

export function loadShortcutsFile(): ShortcutsFile {
  const path = shortcutsPath();

  if (!existsSync(path)) {
    return {
      version: 1,
      bindings: normalizeShortcutBindings(defaultShortcutsFile.bindings)
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;

    if (isShortcutsFile(parsed)) {
      return {
        version: 1,
        bindings: normalizeShortcutBindings(parsed.bindings)
      };
    }
  } catch {
    return {
      version: 1,
      bindings: normalizeShortcutBindings(defaultShortcutsFile.bindings)
    };
  }

  return {
    version: 1,
    bindings: normalizeShortcutBindings(defaultShortcutsFile.bindings)
  };
}

export function saveShortcutsFile(file: ShortcutsFile): void {
  ensureAppDataDirectories();
  writeFileSync(
    shortcutsPath(),
    `${JSON.stringify({ version: 1, bindings: normalizeShortcutBindings(file.bindings) }, null, 2)}\n`,
    "utf8"
  );
}

export function updateShortcutBindings(input: ShortcutUpdateInput): ShortcutBinding[] {
  const bindings = normalizeShortcutBindings(input.bindings);
  saveShortcutsFile({
    version: 1,
    bindings
  });
  return bindings;
}

export function resetShortcutBindings(): ShortcutBinding[] {
  const bindings = normalizeShortcutBindings(defaultShortcutsFile.bindings);
  saveShortcutsFile({
    version: 1,
    bindings
  });
  return bindings;
}

function isScriptRecord(value: unknown): value is ScriptRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ScriptRecord>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.body === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

function isScriptsFile(value: unknown): value is ScriptsFile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ScriptsFile>;
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.scripts) &&
    candidate.scripts.every(isScriptRecord) &&
    (candidate.activeScriptId === undefined || typeof candidate.activeScriptId === "string")
  );
}

function normalizeTitle(title: string, body: string): string {
  const trimmedTitle = title.trim();

  if (trimmedTitle.length > 0) {
    return trimmedTitle.slice(0, 120);
  }

  const firstContentLine = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return (firstContentLine ?? "Untitled script").slice(0, 120);
}

export function loadScriptsFile(): ScriptsFile {
  const path = scriptsPath();

  if (!existsSync(path)) {
    return { ...defaultScriptsFile, scripts: [] };
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;

    if (isScriptsFile(parsed)) {
      return parsed;
    }
  } catch {
    return { ...defaultScriptsFile, scripts: [] };
  }

  return { ...defaultScriptsFile, scripts: [] };
}

export function saveScriptsFile(file: ScriptsFile): void {
  ensureAppDataDirectories();
  writeFileSync(scriptsPath(), `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

export function getScriptsState(): ScriptsState {
  const file = loadScriptsFile();
  const activeScript = file.scripts.find((script) => script.id === file.activeScriptId);

  return {
    scripts: file.scripts,
    activeScript
  };
}

export function saveScript(input: SaveScriptInput): ScriptsState {
  const file = loadScriptsFile();
  const now = new Date().toISOString();
  const existingScript = input.id ? file.scripts.find((script) => script.id === input.id) : undefined;
  const script: ScriptRecord = {
    id: existingScript?.id ?? randomUUID(),
    title: normalizeTitle(input.title, input.body),
    body: input.body,
    createdAt: existingScript?.createdAt ?? now,
    updatedAt: now,
    lastOpenedAt: now
  };

  const scripts = existingScript
    ? file.scripts.map((currentScript) => (currentScript.id === script.id ? script : currentScript))
    : [script, ...file.scripts];

  saveScriptsFile({
    version: 1,
    scripts,
    activeScriptId: script.id
  });

  return getScriptsState();
}

export function setActiveScript(id: string): ScriptsState {
  const file = loadScriptsFile();
  const now = new Date().toISOString();
  const scripts = file.scripts.map((script) => {
    if (script.id !== id) {
      return script;
    }

    return {
      ...script,
      lastOpenedAt: now
    };
  });

  const activeScriptId = scripts.some((script) => script.id === id) ? id : file.activeScriptId;
  saveScriptsFile({
    version: 1,
    scripts,
    activeScriptId
  });

  return getScriptsState();
}

export function renameScript(id: string, title: string): ScriptsState {
  const file = loadScriptsFile();
  const now = new Date().toISOString();
  const scripts = file.scripts.map((script) => {
    if (script.id !== id) {
      return script;
    }

    return {
      ...script,
      title: normalizeTitle(title, script.body),
      updatedAt: now
    };
  });

  saveScriptsFile({
    version: 1,
    scripts,
    activeScriptId: file.activeScriptId
  });

  return getScriptsState();
}

export function deleteScript(id: string): ScriptsState {
  const file = loadScriptsFile();
  const scripts = file.scripts.filter((script) => script.id !== id);
  const activeScriptId = file.activeScriptId === id ? scripts[0]?.id : file.activeScriptId;

  saveScriptsFile({
    version: 1,
    scripts,
    activeScriptId
  });

  return getScriptsState();
}

export function clearActiveScript(): ScriptsState {
  const file = loadScriptsFile();

  saveScriptsFile({
    version: 1,
    scripts: file.scripts,
    activeScriptId: undefined
  });

  return getScriptsState();
}
