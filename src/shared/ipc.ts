export const ipcChannels = {
  appPing: "app:ping",
  overlayOpen: "overlay:open",
  overlayClose: "overlay:close",
  overlayHide: "overlay:hide",
  overlayResetPosition: "overlay:resetPosition",
  overlaySetClickThrough: "overlay:setClickThrough",
  overlayGetState: "overlay:getState",
  teleprompterCommand: "teleprompter:command",
  teleprompterCommandEvent: "teleprompter:commandEvent",
  shortcutsGetStatus: "shortcuts:getStatus",
  shortcutsUpdate: "shortcuts:update",
  shortcutsReset: "shortcuts:reset",
  shortcutsChangedEvent: "shortcuts:changed",
  scriptsGetState: "scripts:getState",
  scriptsSave: "scripts:save",
  scriptsSetActive: "scripts:setActive",
  scriptsRename: "scripts:rename",
  scriptsSetPinned: "scripts:setPinned",
  scriptsDelete: "scripts:delete",
  scriptsDeleteMany: "scripts:deleteMany",
  scriptsClearActive: "scripts:clearActive",
  scriptChangedEvent: "scripts:changed",
  settingsGet: "settings:get",
  settingsUpdate: "settings:update",
  settingsReset: "settings:reset",
  settingsChangedEvent: "settings:changed",
  recoveryReset: "recovery:reset",
  storageGetInfo: "storage:getInfo"
} as const;

export type IpcChannel = (typeof ipcChannels)[keyof typeof ipcChannels];

export type AppPingResponse = {
  message: "pong";
  timestamp: string;
};

export type StorageInfo = {
  userDataPath: string;
};

export type OverlayBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OverlaySettings = {
  version: 1;
  bounds?: OverlayBounds;
  clickThroughEnabled: boolean;
};

export type OverlayState = {
  isOpen: boolean;
  isVisible: boolean;
  isClickThroughEnabled: boolean;
  bounds?: OverlayBounds;
};

export type TeleprompterCommand =
  | "startPause"
  | "restart"
  | "speedUp"
  | "slowDown"
  | "showOverlay"
  | "hideOverlay";

export type TeleprompterCommandEvent = {
  command: TeleprompterCommand;
  source: "editor" | "shortcut";
};

export type ShortcutStatus = {
  action: TeleprompterCommand;
  accelerator: string;
  enabled: boolean;
  registered: boolean;
};

export type ShortcutBinding = {
  action: TeleprompterCommand;
  accelerator: string;
  enabled: boolean;
};

export type ShortcutsFile = {
  version: 1;
  bindings: ShortcutBinding[];
};

export type ShortcutUpdateInput = {
  bindings: ShortcutBinding[];
};

export type ScriptRecord = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
  archived?: boolean;
  pinned?: boolean;
};

export type ScriptsFile = {
  version: 1;
  scripts: ScriptRecord[];
  activeScriptId?: string;
};

export type ScriptsState = {
  scripts: ScriptRecord[];
  activeScript?: ScriptRecord;
};

export type SaveScriptInput = {
  id?: string;
  title: string;
  body: string;
};

export type ScriptChangedEvent = {
  activeScript?: ScriptRecord;
};

export type TextAlignment = "left" | "center" | "right";

export type TextSettings = {
  fontSize: number;
  textColor: string;
  lineHeight: number;
  alignment: TextAlignment;
};

export type OverlayAppearanceSettings = {
  opacity: number;
  backgroundColor: string;
};

export type OverlaySizeSettings = {
  widthRatio: number;
  heightRatio: number;
  xRatio: number;
  yRatio: number;
};

export type CountdownSettings = {
  enabled: boolean;
  seconds: number;
};

export type BehaviorSettings = {
  scrollSpeed: number;
  scrollMode: "manual" | "voice";
  hideInterfaceWhileSpeaking: boolean;
};

export type HighlightMode = "none" | "sentence" | "word";

export type ExperimentalSettings = {
  highlightMode: HighlightMode;
};

export type AppSettings = {
  version: 1;
  text: TextSettings;
  overlayAppearance: OverlayAppearanceSettings;
  overlaySize: OverlaySizeSettings;
  countdown: CountdownSettings;
  behavior: BehaviorSettings;
  experimental: ExperimentalSettings;
};

export type SettingsUpdate = {
  text?: Partial<TextSettings>;
  overlayAppearance?: Partial<OverlayAppearanceSettings>;
  overlaySize?: Partial<OverlaySizeSettings>;
  countdown?: Partial<CountdownSettings>;
  behavior?: Partial<BehaviorSettings>;
  experimental?: Partial<ExperimentalSettings>;
};

export type SettingsChangedEvent = {
  settings: AppSettings;
};

export type TeleprompterApi = {
  ping: () => Promise<AppPingResponse>;
  openOverlay: () => Promise<void>;
  closeOverlay: () => Promise<void>;
  hideOverlay: () => Promise<void>;
  resetOverlayPosition: () => Promise<OverlayState>;
  setOverlayClickThrough: (enabled: boolean) => Promise<OverlayState>;
  getOverlayState: () => Promise<OverlayState>;
  sendTeleprompterCommand: (command: TeleprompterCommand) => Promise<void>;
  onTeleprompterCommand: (callback: (event: TeleprompterCommandEvent) => void) => () => void;
  getShortcutStatus: () => Promise<ShortcutStatus[]>;
  updateShortcuts: (input: ShortcutUpdateInput) => Promise<ShortcutStatus[]>;
  resetShortcuts: () => Promise<ShortcutStatus[]>;
  onShortcutsChanged: (callback: (statuses: ShortcutStatus[]) => void) => () => void;
  getScriptsState: () => Promise<ScriptsState>;
  saveScript: (input: SaveScriptInput) => Promise<ScriptsState>;
  setActiveScript: (id: string) => Promise<ScriptsState>;
  renameScript: (id: string, title: string) => Promise<ScriptsState>;
  setScriptPinned: (id: string, pinned: boolean) => Promise<ScriptsState>;
  deleteScript: (id: string) => Promise<ScriptsState>;
  deleteScripts: (ids: string[]) => Promise<ScriptsState>;
  clearActiveScript: () => Promise<ScriptsState>;
  onScriptChanged: (callback: (event: ScriptChangedEvent) => void) => () => void;
  getSettings: () => Promise<AppSettings>;
  updateSettings: (update: SettingsUpdate) => Promise<AppSettings>;
  resetSettings: () => Promise<AppSettings>;
  onSettingsChanged: (callback: (event: SettingsChangedEvent) => void) => () => void;
  resetRecoveryState: () => Promise<{ settings: AppSettings; overlay: OverlayState }>;
  getStorageInfo: () => Promise<StorageInfo>;
};
