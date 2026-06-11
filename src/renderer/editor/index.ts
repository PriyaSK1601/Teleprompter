const statusElement = document.querySelector<HTMLElement>("#status");
const newScriptButton = document.querySelector<HTMLButtonElement>("#newScriptButton");
const saveScriptButton = document.querySelector<HTMLButtonElement>("#saveScriptButton");
const clearScriptButton = document.querySelector<HTMLButtonElement>("#clearScriptButton");
const startTeleprompterButton = document.querySelector<HTMLButtonElement>("#startTeleprompterButton");
const scriptSearch = document.querySelector<HTMLInputElement>("#scriptSearch");
const scriptList = document.querySelector<HTMLUListElement>("#scriptList");
const scriptTitle = document.querySelector<HTMLInputElement>("#scriptTitle");
const scriptBody = document.querySelector<HTMLTextAreaElement>("#scriptBody");
const settingsButton = document.querySelector<HTMLButtonElement>("#settingsButton");
const settingsModal = document.querySelector<HTMLElement>("#settingsModal");
const settingsBackdrop = document.querySelector<HTMLElement>("#settingsBackdrop");
const closeSettingsButton = document.querySelector<HTMLButtonElement>("#closeSettingsButton");
const resetSettingsButton = document.querySelector<HTMLButtonElement>("#resetSettingsButton");
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
const scrollModeSelect = document.querySelector<HTMLSelectElement>("#scrollModeSelect");
const scrollSpeedInput = document.querySelector<HTMLInputElement>("#scrollSpeedInput");
const scrollSpeedValue = document.querySelector<HTMLElement>("#scrollSpeedValue");
const highlightModeSelect = document.querySelector<HTMLSelectElement>("#highlightModeSelect");
const settingsPreview = document.querySelector<HTMLElement>("#settingsPreview");

let currentScriptsState: ScriptsState = {
  scripts: []
};
let activeScriptId: string | undefined;
let settingsRenderLocked = false;

const ipcBackedControls = [
  newScriptButton,
  saveScriptButton,
  clearScriptButton,
  startTeleprompterButton,
  resetSettingsButton,
  fontSizeInput,
  lineHeightInput,
  textColorInput,
  alignmentSelect,
  opacityInput,
  backgroundColorInput,
  countdownEnabledInput,
  countdownSecondsInput,
  scrollModeSelect,
  scrollSpeedInput,
  highlightModeSelect
];

function setStatus(message: string): void {
  if (statusElement) {
    statusElement.textContent = message;
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getTeleprompterApi(): TeleprompterApi | undefined {
  return window.teleprompter;
}

function requireTeleprompterApi(): TeleprompterApi {
  const api = getTeleprompterApi();

  if (!api) {
    throw new Error("Launch through Electron with npm run dev so the app can reach the main process.");
  }

  return api;
}

function setIpcControlsDisabled(disabled: boolean): void {
  for (const control of ipcBackedControls) {
    if (control) {
      control.disabled = disabled;
    }
  }
}

function handleMissingPreloadApi(): void {
  setIpcControlsDisabled(true);
  setStatus("Electron bridge unavailable. Start the desktop app with npm run dev.");
}

function initializePreloadApi(): boolean {
  if (!getTeleprompterApi()) {
    handleMissingPreloadApi();
    return false;
  }

  setIpcControlsDisabled(false);
  return true;
}

async function runEditorAction(label: string, action: () => Promise<void>): Promise<void> {
  if (!getTeleprompterApi()) {
    handleMissingPreloadApi();
    return;
  }

  try {
    await action();
  } catch (error: unknown) {
    setStatus(`${label} failed. ${formatError(error)}`);
  }
}

function getEditorTitle(): string {
  return scriptTitle?.value ?? "";
}

function getEditorBody(): string {
  return scriptBody?.value ?? "";
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

function getFilteredScripts(): ScriptRecord[] {
  const query = scriptSearch?.value.trim().toLowerCase() ?? "";

  if (!query) {
    return currentScriptsState.scripts;
  }

  return currentScriptsState.scripts.filter((script) => {
    return script.title.toLowerCase().includes(query) || script.body.toLowerCase().includes(query);
  });
}

function renderScriptsList(): void {
  if (!scriptList) {
    return;
  }

  scriptList.textContent = "";
  const scripts = getFilteredScripts();

  if (scripts.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "script-list-empty";
    emptyItem.textContent = currentScriptsState.scripts.length === 0 ? "No scripts yet" : "No matching scripts";
    scriptList.append(emptyItem);
    return;
  }

  for (const script of scripts) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const date = new Date(script.updatedAt).toLocaleDateString();
    button.type = "button";
    button.className = script.id === activeScriptId ? "script-list-item active" : "script-list-item";
    const title = document.createElement("span");
    const updatedAt = document.createElement("small");
    title.textContent = script.title;
    updatedAt.textContent = date;
    button.append(title, updatedAt);
    button.addEventListener("click", () => {
      void runEditorAction("Open script", async () => {
        const state = await requireTeleprompterApi().setActiveScript(script.id);
        renderScriptsState(state, "Script loaded");
      });
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

async function loadScriptsState(): Promise<void> {
  const state = await requireTeleprompterApi().getScriptsState();
  renderScriptsState(state, "Ready");
}

async function saveCurrentScript(status = "Saved"): Promise<ScriptsState | undefined> {
  const body = getEditorBody();
  const title = getEditorTitle();

  if (body.trim().length === 0 && title.trim().length === 0) {
    setStatus("Add a title or script before saving.");
    return undefined;
  }

  const state = await requireTeleprompterApi().saveScript({
    id: activeScriptId,
    title,
    body
  });
  renderScriptsState(state, status);
  return state;
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

  if (scrollModeSelect) {
    scrollModeSelect.value = settings.behavior.scrollMode;
  }

  if (highlightModeSelect) {
    highlightModeSelect.value = settings.experimental.highlightMode;
  }

  renderSettingsPreview(settings);

  settingsRenderLocked = false;
}

function renderSettingsPreview(settings: AppSettings): void {
  if (!settingsPreview) {
    return;
  }

  settingsPreview.style.color = settings.text.textColor;
  settingsPreview.style.fontSize = `${settings.text.fontSize}px`;
  settingsPreview.style.lineHeight = String(settings.text.lineHeight);
  settingsPreview.style.textAlign = settings.text.alignment;
}

function renderSettingsPreviewFromControls(): void {
  if (!settingsPreview) {
    return;
  }

  settingsPreview.style.color = textColorInput?.value ?? "";
  settingsPreview.style.fontSize = `${Number(fontSizeInput?.value) || 32}px`;
  settingsPreview.style.lineHeight = String(Number(lineHeightInput?.value) || 1.5);
  settingsPreview.style.textAlign = alignmentSelect?.value ?? "center";
}

async function loadSettings(): Promise<void> {
  const settings = await requireTeleprompterApi().getSettings();
  renderSettings(settings);
}

async function saveSettingsFromControls(): Promise<void> {
  if (settingsRenderLocked) {
    return;
  }

  const settings = await requireTeleprompterApi().updateSettings({
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
      scrollSpeed: Number(scrollSpeedInput?.value),
      scrollMode: scrollModeSelect?.value as AppSettings["behavior"]["scrollMode"]
    },
    experimental: {
      highlightMode: highlightModeSelect?.value as AppSettings["experimental"]["highlightMode"]
    }
  });

  renderSettings(settings);
  setStatus("Settings saved");
}

function openSettings(): void {
  if (settingsModal) {
    settingsModal.hidden = false;
  }
}

function closeSettings(): void {
  if (settingsModal) {
    settingsModal.hidden = true;
  }
}

window.addEventListener("error", (event) => {
  setStatus(`Renderer error. ${event.message}`);
});

window.addEventListener("unhandledrejection", (event) => {
  setStatus(`Unexpected error. ${formatError(event.reason)}`);
});

settingsButton?.addEventListener("click", openSettings);
settingsBackdrop?.addEventListener("click", closeSettings);
closeSettingsButton?.addEventListener("click", closeSettings);

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSettings();
  }
});

scriptSearch?.addEventListener("input", renderScriptsList);

newScriptButton?.addEventListener("click", () => {
  void runEditorAction("Create script", async () => {
    const state = await requireTeleprompterApi().clearActiveScript();
    renderScriptsState(state, "New script");
  });
});

saveScriptButton?.addEventListener("click", () => {
  void runEditorAction("Save script", async () => {
    await saveCurrentScript();
  });
});

clearScriptButton?.addEventListener("click", () => {
  void runEditorAction("Clear editor", async () => {
    const state = await requireTeleprompterApi().clearActiveScript();
    renderScriptsState(state, "Editor cleared");
  });
});

startTeleprompterButton?.addEventListener("click", () => {
  void runEditorAction("Start teleprompter", async () => {
    const state = await saveCurrentScript("Script saved");

    if (!state?.activeScript) {
      return;
    }

    const api = requireTeleprompterApi();
    await api.openOverlay();
    await api.sendTeleprompterCommand("restart");
    setStatus("Teleprompter started");
  });
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
  scrollModeSelect,
  scrollSpeedInput,
  highlightModeSelect
]) {
  control?.addEventListener("input", () => {
    renderSettingsPreviewFromControls();
    void runEditorAction("Save settings", saveSettingsFromControls);
  });

  control?.addEventListener("change", () => {
    renderSettingsPreviewFromControls();
    void runEditorAction("Save settings", saveSettingsFromControls);
  });
}

resetSettingsButton?.addEventListener("click", () => {
  void runEditorAction("Reset settings", async () => {
    const settings = await requireTeleprompterApi().resetSettings();
    renderSettings(settings);
    setStatus("Settings reset");
  });
});

if (initializePreloadApi()) {
  void runEditorAction("Load local scripts", loadScriptsState);
  void runEditorAction("Load settings", loadSettings);
}
