import { app } from "electron";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  OverlaySettings,
  SaveScriptInput,
  ScriptRecord,
  ScriptsFile,
  ScriptsState,
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
