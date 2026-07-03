import { app, BrowserWindow, screen } from "electron";
import { join } from "node:path";
import {
  ipcChannels,
  type AppSettings,
  type OverlayBounds,
  type OverlayState,
  type ScriptChangedEvent,
  type SettingsChangedEvent,
  type ShortcutStatus,
  type TeleprompterCommand,
  type TeleprompterCommandEvent
} from "../shared/ipc";
import { calculateOverlayBounds } from "../shared/overlayCore";
import { getScriptsState, loadAppSettings, loadOverlaySettings, saveOverlaySettings } from "./storage";

const rootPath = join(__dirname, "..", "..");
const overlayMinSize = {
  width: 560,
  height: 220
};

let editorWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let saveOverlayBoundsTimer: NodeJS.Timeout | null = null;
let isAppQuitting = false;

app.on("before-quit", () => {
  isAppQuitting = true;
});

function preloadPath(name: "editor" | "overlay"): string {
  return join(rootPath, "dist", "preload", `${name}Preload.js`);
}

function rendererPath(name: "editor" | "overlay"): string {
  return join(rootPath, "src", "renderer", name, "index.html");
}

function getConfiguredOverlayBounds(): OverlayBounds {
  const { overlaySize } = loadAppSettings();
  return calculateOverlayBounds(overlaySize, screen.getPrimaryDisplay().workArea, overlayMinSize);
}

function applyConfiguredOverlayBounds(window: BrowserWindow): void {
  if (process.platform === "darwin") {
    window.setFullScreen(false);
    window.setSimpleFullScreen(false);
  }

  window.setBounds(getConfiguredOverlayBounds());
}

function getDefaultOverlayBounds(): OverlayBounds {
  return getConfiguredOverlayBounds();
}

function getInitialOverlayBounds(): OverlayBounds {
  return getConfiguredOverlayBounds();
}

function getWindowBounds(window: BrowserWindow): OverlayBounds {
  const bounds = window.getBounds();

  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height
  };
}

function persistOverlayBounds(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  const settings = loadOverlaySettings();
  saveOverlaySettings({
    ...settings,
    bounds: getWindowBounds(overlayWindow)
  });
}

function scheduleOverlayBoundsSave(): void {
  if (saveOverlayBoundsTimer) {
    clearTimeout(saveOverlayBoundsTimer);
  }

  saveOverlayBoundsTimer = setTimeout(() => {
    saveOverlayBoundsTimer = null;
    persistOverlayBounds();
  }, 250);
}

function applyClickThrough(enabled: boolean): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  overlayWindow.setIgnoreMouseEvents(enabled, { forward: true });
}

function sendScriptChangedEvent(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  const event: ScriptChangedEvent = {
    activeScript: getScriptsState().activeScript
  };

  overlayWindow.webContents.send(ipcChannels.scriptChangedEvent, event);
}

function sendSettingsChangedEvent(settings: AppSettings = loadAppSettings()): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  const event: SettingsChangedEvent = {
    settings
  };

  overlayWindow.webContents.send(ipcChannels.settingsChangedEvent, event);
}

function hideEditorWindow(): void {
  if (!editorWindow || editorWindow.isDestroyed()) {
    return;
  }

  editorWindow.hide();
}

function restoreEditorWindow(): void {
  if (isAppQuitting || !editorWindow || editorWindow.isDestroyed()) {
    return;
  }

  if (editorWindow.isMinimized()) {
    editorWindow.restore();
  }

  editorWindow.show();
  editorWindow.focus();
}

export function createEditorWindow(): BrowserWindow {
  if (editorWindow && !editorWindow.isDestroyed()) {
    editorWindow.focus();
    return editorWindow;
  }

  editorWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 720,
    minHeight: 430,
    resizable: true,
    title: "Teleprompter",
    backgroundColor: "#f5f4ed",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#f5f4ed",
      symbolColor: "#283029",
      height: 36
    },
    webPreferences: {
      preload: preloadPath("editor"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  editorWindow.loadFile(rendererPath("editor"));
  editorWindow.on("closed", () => {
    editorWindow = null;
  });

  return editorWindow;
}

export function createOverlayWindow(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    applyConfiguredOverlayBounds(overlayWindow);
    overlayWindow.show();
    hideEditorWindow();
    applyClickThrough(loadOverlaySettings().clickThroughEnabled);
    sendScriptChangedEvent();
    sendSettingsChangedEvent();
    return overlayWindow;
  }

  const bounds = getInitialOverlayBounds();

  overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: overlayMinSize.width,
    minHeight: overlayMinSize.height,
    title: "Teleprompter Overlay",
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    fullscreenable: false,
    fullscreen: false,
    maximizable: false,
    resizable: true,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: preloadPath("overlay"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  applyClickThrough(loadOverlaySettings().clickThroughEnabled);
  hideEditorWindow();
  overlayWindow.loadFile(rendererPath("overlay"));
  overlayWindow.once("ready-to-show", () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      return;
    }

    applyConfiguredOverlayBounds(overlayWindow);
    overlayWindow.show();
  });
  overlayWindow.webContents.once("did-finish-load", () => {
    sendScriptChangedEvent();
    sendSettingsChangedEvent();
  });
  overlayWindow.on("move", scheduleOverlayBoundsSave);
  overlayWindow.on("resize", scheduleOverlayBoundsSave);
  overlayWindow.on("closed", () => {
    if (saveOverlayBoundsTimer) {
      clearTimeout(saveOverlayBoundsTimer);
      saveOverlayBoundsTimer = null;
    }

    overlayWindow = null;
    restoreEditorWindow();
  });

  return overlayWindow;
}

export function hideOverlayWindow(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide();
    restoreEditorWindow();
  }
}

export function closeOverlayWindow(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
  }
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow && !overlayWindow.isDestroyed() ? overlayWindow : null;
}

export function resetOverlayPosition(): OverlayState {
  const window = createOverlayWindow();
  const bounds = getDefaultOverlayBounds();

  window.setBounds(bounds);
  window.show();
  window.setAlwaysOnTop(true, "screen-saver");

  const settings = loadOverlaySettings();
  saveOverlaySettings({
    ...settings,
    bounds
  });

  return getOverlayState();
}

export function closeOverlayForRecovery(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
  }
}

export function setOverlayClickThrough(enabled: boolean): OverlayState {
  const settings = loadOverlaySettings();
  saveOverlaySettings({
    ...settings,
    clickThroughEnabled: enabled
  });

  applyClickThrough(enabled);
  return getOverlayState();
}

export function getOverlayState(): OverlayState {
  const window = getOverlayWindow();
  const settings = loadOverlaySettings();

  return {
    isOpen: Boolean(window),
    isVisible: Boolean(window?.isVisible()),
    isClickThroughEnabled: settings.clickThroughEnabled,
    bounds: window ? getWindowBounds(window) : settings.bounds
  };
}

export function sendTeleprompterCommand(
  command: TeleprompterCommand,
  source: TeleprompterCommandEvent["source"]
): void {
  if (command === "showOverlay") {
    createOverlayWindow();
    return;
  }

  if (command === "hideOverlay") {
    hideOverlayWindow();
    return;
  }

  const window = createOverlayWindow();
  const event: TeleprompterCommandEvent = {
    command,
    source
  };

  if (window.webContents.isLoading()) {
    window.webContents.once("did-finish-load", () => {
      window.webContents.send(ipcChannels.teleprompterCommandEvent, event);
    });
    return;
  }

  window.webContents.send(ipcChannels.teleprompterCommandEvent, event);
}

export function broadcastScriptChanged(): void {
  sendScriptChangedEvent();
}

export function broadcastSettingsChanged(settings?: AppSettings): void {
  sendSettingsChangedEvent(settings);
}

export function broadcastShortcutsChanged(statuses: ShortcutStatus[]): void {
  for (const window of [editorWindow, overlayWindow]) {
    if (window && !window.isDestroyed() && !window.webContents.isLoading()) {
      window.webContents.send(ipcChannels.shortcutsChangedEvent, statuses);
    }
  }
}
