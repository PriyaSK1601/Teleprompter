import { ipcMain } from "electron";
import { ipcChannels, type AppPingResponse } from "../shared/ipc";
import {
  createOverlayWindow,
  broadcastScriptChanged,
  broadcastSettingsChanged,
  closeOverlayWindow,
  getOverlayState,
  hideOverlayWindow,
  resetOverlayPosition,
  sendTeleprompterCommand,
  setOverlayClickThrough
} from "./windows";
import {
  clearActiveScript,
  deleteScript,
  loadAppSettings,
  getScriptsState,
  getStorageInfo,
  renameScript,
  resetAppSettings,
  saveScript,
  setActiveScript,
  updateAppSettings
} from "./storage";
import { getShortcutStatus } from "./shortcuts";

export function registerIpcHandlers(): void {
  ipcMain.handle(ipcChannels.appPing, async (): Promise<AppPingResponse> => {
    return {
      message: "pong",
      timestamp: new Date().toISOString()
    };
  });

  ipcMain.handle(ipcChannels.overlayOpen, async (): Promise<void> => {
    createOverlayWindow();
  });

  ipcMain.handle(ipcChannels.overlayClose, async (): Promise<void> => {
    closeOverlayWindow();
  });

  ipcMain.handle(ipcChannels.overlayHide, async (): Promise<void> => {
    hideOverlayWindow();
  });

  ipcMain.handle(ipcChannels.overlayResetPosition, async () => {
    return resetOverlayPosition();
  });

  ipcMain.handle(ipcChannels.overlaySetClickThrough, async (_event, enabled: boolean) => {
    return setOverlayClickThrough(enabled);
  });

  ipcMain.handle(ipcChannels.overlayGetState, async () => {
    return getOverlayState();
  });

  ipcMain.handle(ipcChannels.teleprompterCommand, async (_event, command) => {
    sendTeleprompterCommand(command, "editor");
  });

  ipcMain.handle(ipcChannels.shortcutsGetStatus, async () => {
    return getShortcutStatus();
  });

  ipcMain.handle(ipcChannels.scriptsGetState, async () => {
    return getScriptsState();
  });

  ipcMain.handle(ipcChannels.scriptsSave, async (_event, input) => {
    const state = saveScript(input);
    broadcastScriptChanged();
    return state;
  });

  ipcMain.handle(ipcChannels.scriptsSetActive, async (_event, id: string) => {
    const state = setActiveScript(id);
    broadcastScriptChanged();
    return state;
  });

  ipcMain.handle(ipcChannels.scriptsRename, async (_event, id: string, title: string) => {
    const state = renameScript(id, title);
    broadcastScriptChanged();
    return state;
  });

  ipcMain.handle(ipcChannels.scriptsDelete, async (_event, id: string) => {
    const state = deleteScript(id);
    broadcastScriptChanged();
    return state;
  });

  ipcMain.handle(ipcChannels.scriptsClearActive, async () => {
    const state = clearActiveScript();
    broadcastScriptChanged();
    return state;
  });

  ipcMain.handle(ipcChannels.settingsGet, async () => {
    return loadAppSettings();
  });

  ipcMain.handle(ipcChannels.settingsUpdate, async (_event, update) => {
    const settings = updateAppSettings(update);
    broadcastSettingsChanged(settings);
    return settings;
  });

  ipcMain.handle(ipcChannels.settingsReset, async () => {
    const settings = resetAppSettings();
    broadcastSettingsChanged(settings);
    return settings;
  });

  ipcMain.handle(ipcChannels.storageGetInfo, async () => {
    return getStorageInfo();
  });
}
