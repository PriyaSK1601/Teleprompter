import { contextBridge, ipcRenderer } from "electron";
import {
  ipcChannels,
  type ScriptChangedEvent,
  type SettingsChangedEvent,
  type TeleprompterApi,
  type TeleprompterCommandEvent
} from "../shared/ipc";

const teleprompterApi: TeleprompterApi = {
  ping: () => ipcRenderer.invoke(ipcChannels.appPing),
  openOverlay: () => ipcRenderer.invoke(ipcChannels.overlayOpen),
  closeOverlay: () => ipcRenderer.invoke(ipcChannels.overlayClose),
  hideOverlay: () => ipcRenderer.invoke(ipcChannels.overlayHide),
  resetOverlayPosition: () => ipcRenderer.invoke(ipcChannels.overlayResetPosition),
  setOverlayClickThrough: (enabled: boolean) =>
    ipcRenderer.invoke(ipcChannels.overlaySetClickThrough, enabled),
  getOverlayState: () => ipcRenderer.invoke(ipcChannels.overlayGetState),
  sendTeleprompterCommand: (command) => ipcRenderer.invoke(ipcChannels.teleprompterCommand, command),
  onTeleprompterCommand: (callback: (event: TeleprompterCommandEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, commandEvent: TeleprompterCommandEvent) => {
      callback(commandEvent);
    };

    ipcRenderer.on(ipcChannels.teleprompterCommandEvent, listener);

    return () => {
      ipcRenderer.removeListener(ipcChannels.teleprompterCommandEvent, listener);
    };
  },
  getShortcutStatus: () => ipcRenderer.invoke(ipcChannels.shortcutsGetStatus),
  updateShortcuts: (input) => ipcRenderer.invoke(ipcChannels.shortcutsUpdate, input),
  resetShortcuts: () => ipcRenderer.invoke(ipcChannels.shortcutsReset),
  getScriptsState: () => ipcRenderer.invoke(ipcChannels.scriptsGetState),
  saveScript: (input) => ipcRenderer.invoke(ipcChannels.scriptsSave, input),
  setActiveScript: (id) => ipcRenderer.invoke(ipcChannels.scriptsSetActive, id),
  renameScript: (id, title) => ipcRenderer.invoke(ipcChannels.scriptsRename, id, title),
  deleteScript: (id) => ipcRenderer.invoke(ipcChannels.scriptsDelete, id),
  clearActiveScript: () => ipcRenderer.invoke(ipcChannels.scriptsClearActive),
  onScriptChanged: (callback: (event: ScriptChangedEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, scriptEvent: ScriptChangedEvent) => {
      callback(scriptEvent);
    };

    ipcRenderer.on(ipcChannels.scriptChangedEvent, listener);

    return () => {
      ipcRenderer.removeListener(ipcChannels.scriptChangedEvent, listener);
    };
  },
  getSettings: () => ipcRenderer.invoke(ipcChannels.settingsGet),
  updateSettings: (update) => ipcRenderer.invoke(ipcChannels.settingsUpdate, update),
  resetSettings: () => ipcRenderer.invoke(ipcChannels.settingsReset),
  onSettingsChanged: (callback: (event: SettingsChangedEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, settingsEvent: SettingsChangedEvent) => {
      callback(settingsEvent);
    };

    ipcRenderer.on(ipcChannels.settingsChangedEvent, listener);

    return () => {
      ipcRenderer.removeListener(ipcChannels.settingsChangedEvent, listener);
    };
  },
  resetRecoveryState: () => ipcRenderer.invoke(ipcChannels.recoveryReset),
  getStorageInfo: () => ipcRenderer.invoke(ipcChannels.storageGetInfo)
};

contextBridge.exposeInMainWorld("teleprompter", teleprompterApi);
