import { ipcMain, type IpcMainInvokeEvent } from "electron";
import {
  ipcChannels,
  type AppPingResponse,
  type IpcChannel,
  type SaveScriptInput,
  type SettingsUpdate,
  type ShortcutUpdateInput,
  type TeleprompterCommand
} from "../shared/ipc";
import {
  createOverlayWindow,
  broadcastScriptChanged,
  broadcastSettingsChanged,
  closeOverlayWindow,
  closeOverlayForRecovery,
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
  resetOverlaySettings,
  saveScript,
  setActiveScript,
  updateAppSettings
} from "./storage";
import { getShortcutStatus, resetGlobalShortcuts, updateGlobalShortcuts } from "./shortcuts";
import { logError, logInfo } from "./logger";

function errorMetadata(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    message: String(error)
  };
}

function registerLoggedHandler<TResult, TArgs extends unknown[]>(
  channel: IpcChannel,
  handler: (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<TResult> | TResult
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...(args as TArgs));
    } catch (error: unknown) {
      logError("IPC handler failed", {
        channel,
        ...errorMetadata(error)
      });
      throw error;
    }
  });
}

export function registerIpcHandlers(): void {
  registerLoggedHandler(ipcChannels.appPing, async (): Promise<AppPingResponse> => {
    return {
      message: "pong",
      timestamp: new Date().toISOString()
    };
  });

  registerLoggedHandler(ipcChannels.overlayOpen, async (): Promise<void> => {
    createOverlayWindow();
  });

  registerLoggedHandler(ipcChannels.overlayClose, async (): Promise<void> => {
    closeOverlayWindow();
  });

  registerLoggedHandler(ipcChannels.overlayHide, async (): Promise<void> => {
    hideOverlayWindow();
  });

  registerLoggedHandler(ipcChannels.overlayResetPosition, async () => {
    return resetOverlayPosition();
  });

  registerLoggedHandler(ipcChannels.overlaySetClickThrough, async (_event, enabled: boolean) => {
    return setOverlayClickThrough(enabled);
  });

  registerLoggedHandler(ipcChannels.overlayGetState, async () => {
    return getOverlayState();
  });

  registerLoggedHandler(ipcChannels.teleprompterCommand, async (_event, command: TeleprompterCommand) => {
    sendTeleprompterCommand(command, "editor");
  });

  registerLoggedHandler(ipcChannels.shortcutsGetStatus, async () => {
    return getShortcutStatus();
  });

  registerLoggedHandler(ipcChannels.shortcutsUpdate, async (_event, input: ShortcutUpdateInput) => {
    return updateGlobalShortcuts(input);
  });

  registerLoggedHandler(ipcChannels.shortcutsReset, async () => {
    return resetGlobalShortcuts();
  });

  registerLoggedHandler(ipcChannels.scriptsGetState, async () => {
    return getScriptsState();
  });

  registerLoggedHandler(ipcChannels.scriptsSave, async (_event, input: SaveScriptInput) => {
    const state = saveScript(input);
    broadcastScriptChanged();
    return state;
  });

  registerLoggedHandler(ipcChannels.scriptsSetActive, async (_event, id: string) => {
    const state = setActiveScript(id);
    broadcastScriptChanged();
    return state;
  });

  registerLoggedHandler(ipcChannels.scriptsRename, async (_event, id: string, title: string) => {
    const state = renameScript(id, title);
    broadcastScriptChanged();
    return state;
  });

  registerLoggedHandler(ipcChannels.scriptsDelete, async (_event, id: string) => {
    const state = deleteScript(id);
    broadcastScriptChanged();
    return state;
  });

  registerLoggedHandler(ipcChannels.scriptsClearActive, async () => {
    const state = clearActiveScript();
    broadcastScriptChanged();
    return state;
  });

  registerLoggedHandler(ipcChannels.settingsGet, async () => {
    return loadAppSettings();
  });

  registerLoggedHandler(ipcChannels.settingsUpdate, async (_event, update: SettingsUpdate) => {
    const settings = updateAppSettings(update);
    broadcastSettingsChanged(settings);
    return settings;
  });

  registerLoggedHandler(ipcChannels.settingsReset, async () => {
    const settings = resetAppSettings();
    broadcastSettingsChanged(settings);
    return settings;
  });

  registerLoggedHandler(ipcChannels.recoveryReset, async () => {
    const settings = resetAppSettings();
    resetOverlaySettings();
    closeOverlayForRecovery();
    const overlay = resetOverlayPosition();
    broadcastSettingsChanged(settings);
    logInfo("Recovery reset completed");
    return {
      settings,
      overlay
    };
  });

  registerLoggedHandler(ipcChannels.storageGetInfo, async () => {
    return getStorageInfo();
  });
}
