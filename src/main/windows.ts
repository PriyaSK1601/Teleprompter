import { app, BrowserWindow, screen } from "electron";
import { join } from "node:path";
import {
  ipcChannels,
  type AppSettings,
  type OverlayBounds,
  type OverlayState,
  type ScriptChangedEvent,
  type SettingsChangedEvent,
  type TeleprompterCommand,
  type TeleprompterCommandEvent
} from "../shared/ipc";
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
  const area = screen.getPrimaryDisplay().bounds;
  const width = Math.max(overlayMinSize.width, Math.min(Math.round(area.width * overlaySize.widthRatio), area.width));
  const height = Math.max(
    overlayMinSize.height,
    Math.min(Math.round(area.height * overlaySize.heightRatio), area.height)
  );
  const x = area.x + Math.round(Math.min(Math.max(area.width * overlaySize.xRatio, 0), area.width - width));
  const y = area.y + Math.round(Math.min(Math.max(area.height * overlaySize.yRatio, 0), area.height - height));

  return { x, y, width, height };
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
    if (!overlayWindow.isVisible()) {
      overlayWindow.setBounds(getConfiguredOverlayBounds());
    }

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
    resizable: true,
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
