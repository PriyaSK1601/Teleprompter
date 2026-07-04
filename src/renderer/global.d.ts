type AppSettings = import("../shared/ipc").AppSettings;
type ShortcutBinding = import("../shared/ipc").ShortcutBinding;
type ShortcutStatus = import("../shared/ipc").ShortcutStatus;
type ScriptRecord = import("../shared/ipc").ScriptRecord;
type ScriptsState = import("../shared/ipc").ScriptsState;
type TeleprompterApi = import("../shared/ipc").TeleprompterApi;
type TeleprompterCommand = import("../shared/ipc").TeleprompterCommand;

// Provided at runtime by the exports shim in overlay/index.html.
declare const overlayCore: typeof import("../shared/overlayCore");

interface Window {
  teleprompter?: TeleprompterApi;
}

