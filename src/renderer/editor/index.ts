const statusElement = document.querySelector<HTMLElement>("#status");
const editorApp = document.querySelector<HTMLElement>(".editor-app");
const toggleSidebarButton = document.querySelector<HTMLButtonElement>("#toggleSidebarButton");
const newScriptButton = document.querySelector<HTMLButtonElement>("#newScriptButton");
const clearScriptButton = document.querySelector<HTMLButtonElement>("#clearScriptButton");
const startTeleprompterButton = document.querySelector<HTMLButtonElement>("#startTeleprompterButton");
const scriptSearch = document.querySelector<HTMLInputElement>("#scriptSearch");
const scriptList = document.querySelector<HTMLUListElement>("#scriptList");
const selectedScriptsLabel = document.querySelector<HTMLElement>("#selectedScriptsLabel");
const deleteSelectedScriptsButton = document.querySelector<HTMLButtonElement>("#deleteSelectedScriptsButton");
const scriptTitle = document.querySelector<HTMLInputElement>("#scriptTitle");
const scriptBody = document.querySelector<HTMLTextAreaElement>("#scriptBody");
const scriptStats = document.querySelector<HTMLElement>("#scriptStats");
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
const livePreviewPane = document.querySelector<HTMLElement>("#livePreviewPane");
const livePreviewTrack = document.querySelector<HTMLElement>("#livePreviewTrack");
const livePreviewTexts = Array.from(document.querySelectorAll<HTMLElement>(".live-preview-text"));
const sizeScreen = document.querySelector<HTMLElement>("#sizeScreen");
const sizeWindow = document.querySelector<HTMLElement>("#sizeWindow");
const sizeReadout = document.querySelector<HTMLElement>("#sizeReadout");
const previewCountdown = document.querySelector<HTMLElement>("#previewCountdown");

let currentScriptsState: ScriptsState = {
  scripts: []
};
let activeScriptId: string | undefined;
let settingsRenderLocked = false;
let selectedScriptIds = new Set<string>();
let overlayWidthRatio = 0.47;
let overlayHeightRatio = 0.31;
let overlayXRatio = 0.265;
let overlayYRatio = 0;
let autosaveTimer: number | undefined;
let previewCountdownTimer: number | undefined;
let previewScrollRaf: number | undefined;
let previewScrollOffset = 0;
let previewScrollLastTs = 0;

const autosaveDelayMs = 600;

const overlaySizeLimits = {
  minWidthRatio: 0.25,
  maxWidthRatio: 1,
  minHeightRatio: 0.12,
  maxHeightRatio: 0.9
};

type OverlayResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type OverlayDragState = {
  mode: "move" | "resize";
  dir: OverlayResizeDir | null;
  pointerId: number;
  startPointerX: number;
  startPointerY: number;
  screenWidthPx: number;
  screenHeightPx: number;
  startLeft: number;
  startTop: number;
  startWidth: number;
  startHeight: number;
};

let activeOverlayDrag: OverlayDragState | null = null;

const ipcBackedControls = [
  newScriptButton,
  deleteSelectedScriptsButton,
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
  cancelAutosave();
  activeScriptId = script?.id;

  if (scriptTitle) {
    scriptTitle.value = script?.title ?? "";
  }

  if (scriptBody) {
    scriptBody.value = script?.body ?? "";
  }

  renderScriptStats();
  updateStartButtonState();
}

function updateStartButtonState(): void {
  if (!startTeleprompterButton) {
    return;
  }

  const hasScript = getEditorBody().trim().length > 0;
  startTeleprompterButton.disabled = !hasScript || !getTeleprompterApi();
  startTeleprompterButton.title = hasScript ? "" : "Add a script before starting";
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getWordCount(text: string): number {
  const matches = text.trim().match(/\b[\p{L}\p{N}'’-]+\b/gu);
  return matches?.length ?? 0;
}

function getEstimatedWordsPerMinute(): number {
  const speed = Number(scrollSpeedInput?.value);

  if (!Number.isFinite(speed) || speed <= 0) {
    return 150;
  }

  return Math.round(Math.min(240, Math.max(90, 150 * (speed / 36))));
}

function renderScriptStats(): void {
  if (!scriptStats) {
    return;
  }

  const body = getEditorBody();
  const wordCount = getWordCount(body);
  const characterCount = body.length;
  const estimatedSeconds = wordCount > 0 ? (wordCount / getEstimatedWordsPerMinute()) * 60 : 0;
  scriptStats.textContent =
    `${wordCount} ${wordCount === 1 ? "word" : "words"} • ` +
    `${characterCount} ${characterCount === 1 ? "character" : "characters"} • ` +
    `~${formatDuration(estimatedSeconds)} read`;
}

function hexToPreviewRgb(hexColor: string): { red: number; green: number; blue: number } {
  const normalized = hexColor.replace("#", "");

  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function getOpaquePreviewBackground(hexColor: string, opacity: number): string {
  const background = hexToPreviewRgb(hexColor);
  const alpha = Math.min(1, Math.max(0, opacity));
  const red = Math.round(background.red * alpha);
  const green = Math.round(background.green * alpha);
  const blue = Math.round(background.blue * alpha);

  return `rgb(${red} ${green} ${blue})`;
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
    renderScriptSelectionState();
    return;
  }

  for (const script of scripts) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const checkbox = document.createElement("input");
    const content = document.createElement("span");
    const date = new Date(script.updatedAt).toLocaleDateString();
    checkbox.type = "checkbox";
    checkbox.className = "script-select-checkbox";
    checkbox.checked = selectedScriptIds.has(script.id);
    checkbox.setAttribute("aria-label", `Select ${script.title}`);
    button.type = "button";
    button.className = script.id === activeScriptId ? "script-list-item active" : "script-list-item";
    const title = document.createElement("span");
    const updatedAt = document.createElement("small");
    content.className = "script-list-item-content";
    title.textContent = script.title;
    updatedAt.textContent = date;
    content.append(title, updatedAt);
    button.append(checkbox, content);
    checkbox.addEventListener("click", (event) => {
      event.stopPropagation();

      if (checkbox.checked) {
        selectedScriptIds.add(script.id);
      } else {
        selectedScriptIds.delete(script.id);
      }

      renderScriptSelectionState();
    });
    button.addEventListener("click", () => {
      void runEditorAction("Open script", async () => {
        const state = await requireTeleprompterApi().setActiveScript(script.id);
        renderScriptsState(state);
      });
    });
    item.append(button);
    scriptList.append(item);
  }

  renderScriptSelectionState();
}

function renderScriptsState(state: ScriptsState): void {
  currentScriptsState = state;
  selectedScriptIds = new Set(
    Array.from(selectedScriptIds).filter((id) => currentScriptsState.scripts.some((script) => script.id === id))
  );
  setEditorFromScript(state.activeScript);
  renderScriptsList();
}

function renderScriptSelectionState(): void {
  const selectedCount = selectedScriptIds.size;

  if (selectedScriptsLabel) {
    selectedScriptsLabel.textContent = selectedCount === 0
      ? "No scripts selected"
      : `${selectedCount} selected`;
  }

  if (deleteSelectedScriptsButton) {
    deleteSelectedScriptsButton.disabled = selectedCount === 0;
  }
}

async function loadScriptsState(): Promise<void> {
  const state = await requireTeleprompterApi().getScriptsState();
  renderScriptsState(state);
}

async function saveCurrentScript(): Promise<ScriptsState | undefined> {
  const body = getEditorBody();
  const title = getEditorTitle();

  if (body.trim().length === 0 && title.trim().length === 0) {
    return undefined;
  }

  const state = await requireTeleprompterApi().saveScript({
    id: activeScriptId,
    title,
    body
  });
  renderScriptsState(state);
  return state;
}

function cancelAutosave(): void {
  if (autosaveTimer !== undefined) {
    window.clearTimeout(autosaveTimer);
    autosaveTimer = undefined;
  }
}

function scheduleAutosave(): void {
  if (!getTeleprompterApi()) {
    return;
  }

  cancelAutosave();
  autosaveTimer = window.setTimeout(() => {
    autosaveTimer = undefined;
    void runEditorAction("Auto-save", autosaveCurrentScript);
  }, autosaveDelayMs);
}

async function autosaveCurrentScript(): Promise<void> {
  const title = getEditorTitle();
  const body = getEditorBody();

  if (body.trim().length === 0 && title.trim().length === 0) {
    return;
  }

  const state = await requireTeleprompterApi().saveScript({
    id: activeScriptId,
    title,
    body
  });

  currentScriptsState = state;
  activeScriptId = state.activeScript?.id ?? activeScriptId;
  selectedScriptIds = new Set(
    Array.from(selectedScriptIds).filter((id) => currentScriptsState.scripts.some((script) => script.id === id))
  );
  renderScriptsList();
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

  overlayWidthRatio = settings.overlaySize.widthRatio;
  overlayHeightRatio = settings.overlaySize.heightRatio;
  overlayXRatio = settings.overlaySize.xRatio;
  overlayYRatio = settings.overlaySize.yRatio;
  renderOverlaySize();

  renderSettingsPreview(settings);
  renderScriptStats();

  settingsRenderLocked = false;
}

function getPreviewScale(): number {
  if (!sizeScreen) {
    return 1;
  }

  const mockWidth = sizeScreen.clientWidth;
  const screenWidth = getScreenDimensions().width;

  if (mockWidth <= 0 || screenWidth <= 0) {
    return 1;
  }

  return mockWidth / screenWidth;
}

function applyPreviewStyles(values: {
  backgroundColor: string;
  opacity: number;
  textColor: string;
  fontSize: number;
  lineHeight: number;
  alignment: string;
}): void {
  if (sizeWindow) {
    sizeWindow.style.background = getOpaquePreviewBackground(values.backgroundColor, values.opacity);
    sizeWindow.style.setProperty("--preview-scale", String(getPreviewScale()));
  }

  if (settingsPreview) {
    settingsPreview.style.color = values.textColor;
    settingsPreview.style.fontSize = `${Math.max(4, values.fontSize * getPreviewScale())}px`;
    settingsPreview.style.lineHeight = String(values.lineHeight);
    settingsPreview.style.textAlign = values.alignment;
  }

  if (livePreviewPane) {
    livePreviewPane.style.background = getOpaquePreviewBackground(values.backgroundColor, values.opacity);
  }

  for (const text of livePreviewTexts) {
    text.style.color = values.textColor;
    text.style.fontSize = `${values.fontSize}px`;
    text.style.lineHeight = String(values.lineHeight);
    text.style.textAlign = values.alignment;
  }
}

function renderSettingsPreview(settings: AppSettings): void {
  applyPreviewStyles({
    backgroundColor: settings.overlayAppearance.backgroundColor,
    opacity: settings.overlayAppearance.opacity,
    textColor: settings.text.textColor,
    fontSize: settings.text.fontSize,
    lineHeight: settings.text.lineHeight,
    alignment: settings.text.alignment
  });
}

function renderSettingsPreviewFromControls(): void {
  applyPreviewStyles({
    backgroundColor: backgroundColorInput?.value ?? "#111827",
    opacity: Number(opacityInput?.value) || 0.82,
    textColor: textColorInput?.value ?? "#f8fafc",
    fontSize: Number(fontSizeInput?.value) || 32,
    lineHeight: Number(lineHeightInput?.value) || 1.5,
    alignment: alignmentSelect?.value ?? "center"
  });
}

function clampRatio(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getScreenDimensions(): { width: number; height: number } {
  return {
    width: window.screen?.width || 1920,
    height: window.screen?.height || 1080
  };
}

function applyMockPlatform(): void {
  if (!sizeScreen) {
    return;
  }

  const isMac = /Mac/i.test(navigator.userAgent);
  sizeScreen.classList.toggle("is-macos", isMac);
  sizeScreen.classList.toggle("is-windows", !isMac);
}

function renderOverlaySize(): void {
  const { width: screenWidth, height: screenHeight } = getScreenDimensions();

  if (sizeScreen) {
    sizeScreen.style.aspectRatio = `${screenWidth} / ${screenHeight}`;
  }

  if (sizeWindow) {
    sizeWindow.style.left = `${(overlayXRatio * 100).toFixed(2)}%`;
    sizeWindow.style.top = `${(overlayYRatio * 100).toFixed(2)}%`;
    sizeWindow.style.width = `${(overlayWidthRatio * 100).toFixed(2)}%`;
    sizeWindow.style.height = `${(overlayHeightRatio * 100).toFixed(2)}%`;
  }

  if (sizeReadout) {
    const widthPx = Math.round(screenWidth * overlayWidthRatio);
    const heightPx = Math.round(screenHeight * overlayHeightRatio);
    const widthPercent = Math.round(overlayWidthRatio * 100);
    const heightPercent = Math.round(overlayHeightRatio * 100);
    sizeReadout.textContent =
      `${widthPx} × ${heightPx} px • ${widthPercent}% × ${heightPercent}% of screen`;
  }
}

function stepPreviewScroll(timestamp: number): void {
  if (!livePreviewTrack) {
    previewScrollRaf = undefined;
    return;
  }

  if (previewScrollLastTs === 0) {
    previewScrollLastTs = timestamp;
  }

  const dtSeconds = Math.min(0.05, (timestamp - previewScrollLastTs) / 1000);
  previewScrollLastTs = timestamp;

  const speed = Number(scrollSpeedInput?.value);
  const safeSpeed = Number.isFinite(speed) && speed > 0 ? speed : 0;
  // The track holds two identical copies, so wrapping at half its height loops seamlessly.
  const loopHeight = livePreviewTrack.scrollHeight / 2;

  if (loopHeight > 0) {
    previewScrollOffset = (previewScrollOffset + safeSpeed * dtSeconds) % loopHeight;
    livePreviewTrack.style.transform = `translateY(${-previewScrollOffset}px)`;
  }

  previewScrollRaf = requestAnimationFrame(stepPreviewScroll);
}

function startPreviewScroll(): void {
  if (!livePreviewTrack || previewScrollRaf !== undefined) {
    return;
  }

  previewScrollOffset = 0;
  previewScrollLastTs = 0;
  livePreviewTrack.style.transform = "translateY(0)";
  previewScrollRaf = requestAnimationFrame(stepPreviewScroll);
}

function stopPreviewScroll(): void {
  if (previewScrollRaf !== undefined) {
    cancelAnimationFrame(previewScrollRaf);
    previewScrollRaf = undefined;
  }

  previewScrollLastTs = 0;
}

function stopPreviewCountdown(): void {
  if (previewCountdownTimer !== undefined) {
    window.clearInterval(previewCountdownTimer);
    previewCountdownTimer = undefined;
  }

  if (previewCountdown) {
    previewCountdown.hidden = true;
  }
}

function playPreviewCountdown(): void {
  stopPreviewCountdown();

  if (!previewCountdown) {
    return;
  }

  const seconds = Math.max(1, Math.min(10, Math.round(Number(countdownSecondsInput?.value) || 3)));
  let remaining = seconds;
  previewCountdown.hidden = false;
  previewCountdown.textContent = String(remaining);
  previewCountdownTimer = window.setInterval(() => {
    remaining -= 1;

    if (remaining < 1) {
      stopPreviewCountdown();
      return;
    }

    if (previewCountdown) {
      previewCountdown.textContent = String(remaining);
    }
  }, 1000);
}

async function saveOverlaySize(): Promise<void> {
  await requireTeleprompterApi().updateSettings({
    overlaySize: {
      widthRatio: overlayWidthRatio,
      heightRatio: overlayHeightRatio,
      xRatio: overlayXRatio,
      yRatio: overlayYRatio
    }
  });
}

function applyOverlayResize(drag: OverlayDragState, dxRatio: number, dyRatio: number): void {
  const { minWidthRatio, maxWidthRatio, minHeightRatio, maxHeightRatio } = overlaySizeLimits;
  const dir = drag.dir ?? "";
  let left = drag.startLeft;
  let top = drag.startTop;
  let right = drag.startLeft + drag.startWidth;
  let bottom = drag.startTop + drag.startHeight;

  if (dir.includes("e")) {
    right = clampRatio(right + dxRatio, left + minWidthRatio, Math.min(1, left + maxWidthRatio));
  }

  if (dir.includes("w")) {
    left = clampRatio(left + dxRatio, Math.max(0, right - maxWidthRatio), right - minWidthRatio);
  }

  if (dir.includes("s")) {
    bottom = clampRatio(bottom + dyRatio, top + minHeightRatio, Math.min(1, top + maxHeightRatio));
  }

  if (dir.includes("n")) {
    top = clampRatio(top + dyRatio, Math.max(0, bottom - maxHeightRatio), bottom - minHeightRatio);
  }

  overlayXRatio = left;
  overlayYRatio = top;
  overlayWidthRatio = right - left;
  overlayHeightRatio = bottom - top;
}

function handleOverlayPointerDown(event: PointerEvent): void {
  if (!sizeScreen || !sizeWindow) {
    return;
  }

  const target = event.target as HTMLElement | null;
  const dir = (target?.dataset.resizeDir as OverlayResizeDir | undefined) ?? null;
  event.preventDefault();
  const rect = sizeScreen.getBoundingClientRect();
  activeOverlayDrag = {
    mode: dir ? "resize" : "move",
    dir,
    pointerId: event.pointerId,
    startPointerX: event.clientX,
    startPointerY: event.clientY,
    screenWidthPx: rect.width,
    screenHeightPx: rect.height,
    startLeft: overlayXRatio,
    startTop: overlayYRatio,
    startWidth: overlayWidthRatio,
    startHeight: overlayHeightRatio
  };
  target?.setPointerCapture(event.pointerId);
}

function handleOverlayPointerMove(event: PointerEvent): void {
  if (!activeOverlayDrag || event.pointerId !== activeOverlayDrag.pointerId) {
    return;
  }

  const drag = activeOverlayDrag;
  const dxRatio = drag.screenWidthPx > 0 ? (event.clientX - drag.startPointerX) / drag.screenWidthPx : 0;
  const dyRatio = drag.screenHeightPx > 0 ? (event.clientY - drag.startPointerY) / drag.screenHeightPx : 0;

  if (drag.mode === "move") {
    overlayXRatio = clampRatio(drag.startLeft + dxRatio, 0, 1 - drag.startWidth);
    overlayYRatio = clampRatio(drag.startTop + dyRatio, 0, 1 - drag.startHeight);
  } else {
    applyOverlayResize(drag, dxRatio, dyRatio);
  }

  renderOverlaySize();
}

function handleOverlayPointerUp(event: PointerEvent): void {
  if (!activeOverlayDrag || event.pointerId !== activeOverlayDrag.pointerId) {
    return;
  }

  activeOverlayDrag = null;
  void runEditorAction("Save teleprompter size", saveOverlaySize);
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
  renderScriptStats();
}

const sidebarCollapsedStorageKey = "teleprompter:sidebarCollapsed";

function setSidebarCollapsed(collapsed: boolean): void {
  editorApp?.classList.toggle("sidebar-collapsed", collapsed);

  if (toggleSidebarButton) {
    const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
    toggleSidebarButton.setAttribute("aria-label", label);
    toggleSidebarButton.title = label;
  }

  try {
    localStorage.setItem(sidebarCollapsedStorageKey, collapsed ? "1" : "0");
  } catch {
    // Ignore storage failures; collapse state simply won't persist.
  }
}

function loadSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(sidebarCollapsedStorageKey) === "1";
  } catch {
    return false;
  }
}

function openSettings(): void {
  if (!settingsModal) {
    return;
  }

  settingsModal.classList.add("is-open");
  requestAnimationFrame(() => {
    renderOverlaySize();
    renderSettingsPreviewFromControls();
    startPreviewScroll();
  });
}

function closeSettings(): void {
  settingsModal?.classList.remove("is-open");
  stopPreviewCountdown();
  stopPreviewScroll();
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

setSidebarCollapsed(loadSidebarCollapsed());
toggleSidebarButton?.addEventListener("click", () => {
  setSidebarCollapsed(!editorApp?.classList.contains("sidebar-collapsed"));
});

applyMockPlatform();
countdownEnabledInput?.addEventListener("change", () => {
  if (countdownEnabledInput?.checked) {
    playPreviewCountdown();
  } else {
    stopPreviewCountdown();
  }
});

sizeWindow?.addEventListener("pointerdown", handleOverlayPointerDown);
window.addEventListener("pointermove", handleOverlayPointerMove);
window.addEventListener("pointerup", handleOverlayPointerUp);
window.addEventListener("pointercancel", handleOverlayPointerUp);
window.addEventListener("resize", () => {
  renderOverlaySize();
  renderSettingsPreviewFromControls();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSettings();
  }
});

scriptSearch?.addEventListener("input", renderScriptsList);
scriptBody?.addEventListener("input", () => {
  renderScriptStats();
  scheduleAutosave();
  updateStartButtonState();
});
scriptTitle?.addEventListener("input", () => {
  renderScriptStats();
  scheduleAutosave();
});

function blockWheelScroll(event: WheelEvent): void {
  event.preventDefault();
}

scriptTitle?.addEventListener("wheel", blockWheelScroll, { passive: false });
scriptStats?.addEventListener("wheel", blockWheelScroll, { passive: false });

newScriptButton?.addEventListener("click", () => {
  void runEditorAction("Create script", async () => {
    const state = await requireTeleprompterApi().clearActiveScript();
    renderScriptsState(state);
  });
});

clearScriptButton?.addEventListener("click", () => {
  void runEditorAction("Clear editor", async () => {
    const state = await requireTeleprompterApi().clearActiveScript();
    renderScriptsState(state);
  });
});

deleteSelectedScriptsButton?.addEventListener("click", () => {
  void runEditorAction("Delete scripts", async () => {
    const ids = Array.from(selectedScriptIds);

    if (ids.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      ids.length === 1
        ? "Delete this saved script? This cannot be undone."
        : `Delete ${ids.length} saved scripts? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    const state = await requireTeleprompterApi().deleteScripts(ids);
    selectedScriptIds = new Set();
    renderScriptsState(state);
  });
});

startTeleprompterButton?.addEventListener("click", () => {
  void runEditorAction("Start teleprompter", async () => {
    const state = await saveCurrentScript();

    if (!state?.activeScript) {
      return;
    }

    const api = requireTeleprompterApi();
    await api.openOverlay();
    await api.sendTeleprompterCommand("restart");
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
    renderScriptStats();
    void runEditorAction("Save settings", saveSettingsFromControls);
  });

  control?.addEventListener("change", () => {
    renderSettingsPreviewFromControls();
    renderScriptStats();
    void runEditorAction("Save settings", saveSettingsFromControls);
  });
}

resetSettingsButton?.addEventListener("click", () => {
  void runEditorAction("Reset settings", async () => {
    const settings = await requireTeleprompterApi().resetSettings();
    renderSettings(settings);
  });
});

if (initializePreloadApi()) {
  void runEditorAction("Load local scripts", loadScriptsState);
  void runEditorAction("Load settings", loadSettings);
}
