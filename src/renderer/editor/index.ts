import type {
  AppSettings,
  ShortcutBinding,
  ShortcutStatus,
  ScriptRecord,
  ScriptsState,
  TeleprompterCommand
} from "../../shared/ipc";

const statusElement = document.querySelector<HTMLPreElement>("#status");
const newScriptButton = document.querySelector<HTMLButtonElement>("#newScriptButton");
const saveScriptButton = document.querySelector<HTMLButtonElement>("#saveScriptButton");
const renameScriptButton = document.querySelector<HTMLButtonElement>("#renameScriptButton");
const deleteScriptButton = document.querySelector<HTMLButtonElement>("#deleteScriptButton");
const clearScriptButton = document.querySelector<HTMLButtonElement>("#clearScriptButton");
const scriptList = document.querySelector<HTMLUListElement>("#scriptList");
const scriptTitle = document.querySelector<HTMLInputElement>("#scriptTitle");
const scriptBody = document.querySelector<HTMLTextAreaElement>("#scriptBody");
const resetSettingsButton = document.querySelector<HTMLButtonElement>("#resetSettingsButton");
const recoveryResetButton = document.querySelector<HTMLButtonElement>("#recoveryResetButton");
const fontSizeInput = document.querySelector<HTMLInputElement>("#fontSizeInput");
const fontSizeValue = document.querySelector<HTMLElement>("#fontSizeValue");
const lineHeightInput = document.querySelector<HTMLInputElement>("#lineHeightInput");
const lineHeightValue = document.querySelector<HTMLElement>("#lineHeightValue");
const textColorInput = document.querySelector<HTMLInputElement>("#textColorInput");
const alignmentSelect = document.querySelector<HTMLSelectElement>("#alignmentSelect");
const opacityInput = document.querySelector<HTMLInputElement>("#opacityInput");
const opacityValue = document.querySelector<HTMLElement>("#opacityValue");
const backgroundColorInput = document.querySelector<HTMLInputElement>("#backgroundColorInput");
const countdownEnabledInput = document.querySelector<HTMLInputElement>("#countdownEnabledInput");
const countdownSecondsInput = document.querySelector<HTMLInputElement>("#countdownSecondsInput");
const scrollSpeedInput = document.querySelector<HTMLInputElement>("#scrollSpeedInput");
const scrollSpeedValue = document.querySelector<HTMLElement>("#scrollSpeedValue");
const highlightModeSelect = document.querySelector<HTMLSelectElement>("#highlightModeSelect");
const pingButton = document.querySelector<HTMLButtonElement>("#pingButton");
const openOverlayButton = document.querySelector<HTMLButtonElement>("#openOverlayButton");
const hideOverlayButton = document.querySelector<HTMLButtonElement>("#hideOverlayButton");
const resetOverlayButton = document.querySelector<HTMLButtonElement>("#resetOverlayButton");
const closeOverlayButton = document.querySelector<HTMLButtonElement>("#closeOverlayButton");
const startPauseButton = document.querySelector<HTMLButtonElement>("#startPauseButton");
const restartButton = document.querySelector<HTMLButtonElement>("#restartButton");
const speedUpButton = document.querySelector<HTMLButtonElement>("#speedUpButton");
const slowDownButton = document.querySelector<HTMLButtonElement>("#slowDownButton");
const clickThroughCheckbox = document.querySelector<HTMLInputElement>("#clickThroughCheckbox");
const saveShortcutsButton = document.querySelector<HTMLButtonElement>("#saveShortcutsButton");
const resetShortcutsButton = document.querySelector<HTMLButtonElement>("#resetShortcutsButton");
const shortcutList = document.querySelector<HTMLUListElement>("#shortcutList");

let currentScriptsState: ScriptsState = {
  scripts: []
};
let activeScriptId: string | undefined;
let settingsRenderLocked = false;

const shortcutLabels: Record<TeleprompterCommand, string> = {
  showOverlay: "Show overlay",
  hideOverlay: "Hide overlay",
  startPause: "Start / pause",
  restart: "Restart",
  speedUp: "Speed up",
  slowDown: "Slow down"
};

function setStatus(message: string): void {
  if (statusElement) {
    statusElement.textContent = message;
  }
}

function setEditorFromScript(script?: ScriptRecord): void {
  activeScriptId = script?.id;

  if (scriptTitle) {
    scriptTitle.value = script?.title ?? "";
  }

  if (scriptBody) {
    scriptBody.value = script?.body ?? "";
  }
}

function renderScriptsList(): void {
  if (!scriptList) {
    return;
  }

  scriptList.textContent = "";

  if (currentScriptsState.scripts.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "script-list-empty";
    emptyItem.textContent = "No saved scripts yet.";
    scriptList.append(emptyItem);
    return;
  }

  for (const script of currentScriptsState.scripts) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = script.id === activeScriptId ? "script-list-item active" : "script-list-item";
    button.textContent = script.title;
    button.addEventListener("click", async () => {
      await loadScript(script.id);
    });
    item.append(button);
    scriptList.append(item);
  }
}

function renderScriptsState(state: ScriptsState, status?: string): void {
  currentScriptsState = state;
  setEditorFromScript(state.activeScript);
  renderScriptsList();

  if (status) {
    setStatus(status);
  }
}

function renderSettings(settings: AppSettings): void {
  settingsRenderLocked = true;

  if (fontSizeInput) {
    fontSizeInput.value = String(settings.text.fontSize);
  }

  if (fontSizeValue) {
    fontSizeValue.textContent = `${settings.text.fontSize}px`;
  }

  if (lineHeightInput) {
    lineHeightInput.value = String(settings.text.lineHeight);
  }

  if (lineHeightValue) {
    lineHeightValue.textContent = settings.text.lineHeight.toFixed(2);
  }

  if (textColorInput) {
    textColorInput.value = settings.text.textColor;
  }

  if (alignmentSelect) {
    alignmentSelect.value = settings.text.alignment;
  }

  if (opacityInput) {
    opacityInput.value = String(settings.overlayAppearance.opacity);
  }

  if (opacityValue) {
    opacityValue.textContent = `${Math.round(settings.overlayAppearance.opacity * 100)}%`;
  }

  if (backgroundColorInput) {
    backgroundColorInput.value = settings.overlayAppearance.backgroundColor;
  }

  if (countdownEnabledInput) {
    countdownEnabledInput.checked = settings.countdown.enabled;
  }

  if (countdownSecondsInput) {
    countdownSecondsInput.value = String(settings.countdown.seconds);
  }

  if (scrollSpeedInput) {
    scrollSpeedInput.value = String(settings.behavior.scrollSpeed);
  }

  if (scrollSpeedValue) {
    scrollSpeedValue.textContent = `${settings.behavior.scrollSpeed} px/s`;
  }

  if (highlightModeSelect) {
    highlightModeSelect.value = settings.experimental.highlightMode;
  }

  settingsRenderLocked = false;
}

async function loadSettings(): Promise<void> {
  const settings = await window.teleprompter.getSettings();
  renderSettings(settings);
}

async function saveSettingsFromControls(): Promise<void> {
  if (settingsRenderLocked) {
    return;
  }

  const settings = await window.teleprompter.updateSettings({
    text: {
      fontSize: Number(fontSizeInput?.value),
      textColor: textColorInput?.value,
      lineHeight: Number(lineHeightInput?.value),
      alignment: alignmentSelect?.value as AppSettings["text"]["alignment"]
    },
    overlayAppearance: {
      opacity: Number(opacityInput?.value),
      backgroundColor: backgroundColorInput?.value
    },
    countdown: {
      enabled: Boolean(countdownEnabledInput?.checked),
      seconds: Number(countdownSecondsInput?.value)
    },
    behavior: {
      scrollSpeed: Number(scrollSpeedInput?.value)
    },
    experimental: {
      highlightMode: highlightModeSelect?.value as AppSettings["experimental"]["highlightMode"]
    }
  });

  renderSettings(settings);
  setStatus("Saved settings and updated overlay.");
}

async function loadScriptsState(): Promise<void> {
  const state = await window.teleprompter.getScriptsState();
  renderScriptsState(state, "Loaded local scripts.");
}

async function loadScript(id: string): Promise<void> {
  const state = await window.teleprompter.setActiveScript(id);
  renderScriptsState(state, "Opened saved script.");
}

function getEditorTitle(): string {
  return scriptTitle?.value ?? "";
}

function getEditorBody(): string {
  return scriptBody?.value ?? "";
}

async function saveCurrentScript(): Promise<void> {
  const body = getEditorBody();
  const title = getEditorTitle();

  if (body.trim().length === 0 && title.trim().length === 0) {
    setStatus("Nothing to save. Add a title or script body first.");
    return;
  }

  const state = await window.teleprompter.saveScript({
    id: activeScriptId,
    title,
    body
  });
  renderScriptsState(state, "Saved script locally and synced overlay.");
}

async function refreshOverlayState(prefix?: string): Promise<void> {
  const state = await window.teleprompter.getOverlayState();

  if (clickThroughCheckbox) {
    clickThroughCheckbox.checked = state.isClickThroughEnabled;
  }

  setStatus(
    JSON.stringify(
      {
        event: prefix ?? "Overlay state",
        overlay: state
      },
      null,
      2
    )
  );
}

async function sendTeleprompterCommand(command: TeleprompterCommand): Promise<void> {
  await window.teleprompter.sendTeleprompterCommand(command);
  await refreshOverlayState(`Sent command: ${command}`);
}

function renderShortcutRows(shortcuts: ShortcutStatus[]): void {
  if (!shortcutList) {
    return;
  }

  shortcutList.textContent = "";

  for (const shortcut of shortcuts) {
    const item = document.createElement("li");
    item.className = "shortcut-row";
    const label = document.createElement("label");
    label.className = "shortcut-label";
    label.textContent = shortcutLabels[shortcut.action];

    const input = document.createElement("input");
    input.className = "text-input shortcut-input";
    input.type = "text";
    input.value = shortcut.accelerator;
    input.dataset.action = shortcut.action;
    input.setAttribute("aria-label", `${shortcutLabels[shortcut.action]} shortcut`);

    const enabledLabel = document.createElement("label");
    enabledLabel.className = "shortcut-enabled";
    const enabled = document.createElement("input");
    enabled.type = "checkbox";
    enabled.checked = shortcut.enabled;
    enabled.dataset.action = shortcut.action;
    enabled.dataset.enabledControl = "true";
    enabledLabel.append(enabled, "Enabled");

    const status = document.createElement("span");
    status.className = shortcut.registered ? "shortcut-ok" : "shortcut-failed";
    status.textContent = shortcut.enabled
      ? shortcut.registered
        ? "Registered"
        : "Failed"
      : "Disabled";

    item.append(label, input, enabledLabel, status);
    shortcutList.append(item);
  }
}

async function renderShortcutStatus(): Promise<void> {
  const shortcuts = await window.teleprompter.getShortcutStatus();
  renderShortcutRows(shortcuts);
}

function getShortcutBindingsFromForm(): ShortcutBinding[] {
  if (!shortcutList) {
    return [];
  }

  const inputs = Array.from(shortcutList.querySelectorAll<HTMLInputElement>(".shortcut-input"));

  return inputs.map((input) => {
    const action = input.dataset.action as TeleprompterCommand;
    const enabled = shortcutList.querySelector<HTMLInputElement>(
      `input[data-enabled-control="true"][data-action="${action}"]`
    );

    return {
      action,
      accelerator: input.value.trim(),
      enabled: enabled?.checked ?? true
    };
  });
}

pingButton?.addEventListener("click", async () => {
  const [pingResponse, storageInfo] = await Promise.all([
    window.teleprompter.ping(),
    window.teleprompter.getStorageInfo()
  ]);

  setStatus(
    JSON.stringify(
      {
        ping: pingResponse,
        storage: storageInfo
      },
      null,
      2
    )
  );
});

openOverlayButton?.addEventListener("click", async () => {
  await window.teleprompter.openOverlay();
  await refreshOverlayState("Overlay window opened");
});

hideOverlayButton?.addEventListener("click", async () => {
  await window.teleprompter.hideOverlay();
  await refreshOverlayState("Overlay window hidden");
});

resetOverlayButton?.addEventListener("click", async () => {
  await window.teleprompter.resetOverlayPosition();
  await refreshOverlayState("Overlay position reset");
});

closeOverlayButton?.addEventListener("click", async () => {
  await window.teleprompter.closeOverlay();
  await refreshOverlayState("Overlay window closed");
});

startPauseButton?.addEventListener("click", async () => {
  await sendTeleprompterCommand("startPause");
});

restartButton?.addEventListener("click", async () => {
  await sendTeleprompterCommand("restart");
});

speedUpButton?.addEventListener("click", async () => {
  await sendTeleprompterCommand("speedUp");
});

slowDownButton?.addEventListener("click", async () => {
  await sendTeleprompterCommand("slowDown");
});

clickThroughCheckbox?.addEventListener("change", async () => {
  await window.teleprompter.setOverlayClickThrough(clickThroughCheckbox.checked);
  await refreshOverlayState("Click-through setting changed");
});

refreshOverlayState().catch(() => {
  setStatus("Unable to load overlay state.");
});

renderShortcutStatus().catch(() => {
  if (shortcutList) {
    shortcutList.textContent = "Unable to load shortcut status.";
  }
});

saveShortcutsButton?.addEventListener("click", async () => {
  const shortcuts = await window.teleprompter.updateShortcuts({
    bindings: getShortcutBindingsFromForm()
  });
  renderShortcutRows(shortcuts);
  setStatus("Saved shortcuts and refreshed global registrations.");
});

resetShortcutsButton?.addEventListener("click", async () => {
  const shortcuts = await window.teleprompter.resetShortcuts();
  renderShortcutRows(shortcuts);
  setStatus("Reset shortcuts to defaults.");
});

newScriptButton?.addEventListener("click", async () => {
  const state = await window.teleprompter.clearActiveScript();
  renderScriptsState(state, "Started a new unsaved script.");
});

saveScriptButton?.addEventListener("click", async () => {
  await saveCurrentScript();
});

renameScriptButton?.addEventListener("click", async () => {
  if (!activeScriptId) {
    setStatus("Save the script before renaming it.");
    return;
  }

  const title = window.prompt("Rename script", getEditorTitle());

  if (title === null) {
    return;
  }

  const state = await window.teleprompter.renameScript(activeScriptId, title);
  renderScriptsState(state, "Renamed script.");
});

deleteScriptButton?.addEventListener("click", async () => {
  if (!activeScriptId) {
    setStatus("No saved script selected.");
    return;
  }

  if (!window.confirm("Delete this saved script from local storage?")) {
    return;
  }

  const state = await window.teleprompter.deleteScript(activeScriptId);
  renderScriptsState(state, "Deleted script.");
});

clearScriptButton?.addEventListener("click", async () => {
  const state = await window.teleprompter.clearActiveScript();
  renderScriptsState(state, "Cleared editor. Saved scripts were not deleted.");
});

loadScriptsState().catch(() => {
  setStatus("Unable to load local scripts.");
});

loadSettings().catch(() => {
  setStatus("Unable to load settings.");
});

for (const control of [
  fontSizeInput,
  lineHeightInput,
  textColorInput,
  alignmentSelect,
  opacityInput,
  backgroundColorInput,
  countdownEnabledInput,
  countdownSecondsInput,
  scrollSpeedInput,
  highlightModeSelect
]) {
  control?.addEventListener("input", () => {
    saveSettingsFromControls().catch(() => {
      setStatus("Unable to save settings.");
    });
  });

  control?.addEventListener("change", () => {
    saveSettingsFromControls().catch(() => {
      setStatus("Unable to save settings.");
    });
  });
}

resetSettingsButton?.addEventListener("click", async () => {
  const settings = await window.teleprompter.resetSettings();
  renderSettings(settings);
  setStatus("Reset overlay settings to defaults.");
});

recoveryResetButton?.addEventListener("click", async () => {
  const result = await window.teleprompter.resetRecoveryState();
  renderSettings(result.settings);
  await refreshOverlayState("Recovered overlay position and settings");
});
