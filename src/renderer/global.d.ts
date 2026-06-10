type AppSettings = import("../shared/ipc").AppSettings;
type ShortcutBinding = import("../shared/ipc").ShortcutBinding;
type ShortcutStatus = import("../shared/ipc").ShortcutStatus;
type ScriptRecord = import("../shared/ipc").ScriptRecord;
type ScriptsState = import("../shared/ipc").ScriptsState;
type TeleprompterApi = import("../shared/ipc").TeleprompterApi;
type TeleprompterCommand = import("../shared/ipc").TeleprompterCommand;

interface Window {
  teleprompter?: TeleprompterApi;
}

