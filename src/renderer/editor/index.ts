const statusElement = document.querySelector<HTMLElement>("#status");
const editorApp = document.querySelector<HTMLElement>(".editor-app");
const toggleSidebarButton = document.querySelector<HTMLButtonElement>("#toggleSidebarButton");
const newScriptButton = document.querySelector<HTMLButtonElement>("#newScriptButton");
const clearScriptButton = document.querySelector<HTMLButtonElement>("#clearScriptButton");
const startTeleprompterButton = document.querySelector<HTMLButtonElement>("#startTeleprompterButton");
const scriptSearch = document.querySelector<HTMLInputElement>("#scriptSearch");
const allScriptsButton = document.querySelector<HTMLButtonElement>("#allScriptsButton");
const allScriptsCount = document.querySelector<HTMLElement>("#allScriptsCount");
const newProjectButton = document.querySelector<HTMLButtonElement>("#newProjectButton");
const projectList = document.querySelector<HTMLElement>("#projectList");
const projectDialog = document.querySelector<HTMLElement>("#projectDialog");
const projectDialogBackdrop = document.querySelector<HTMLElement>("#projectDialogBackdrop");
const projectDialogForm = document.querySelector<HTMLFormElement>("#projectDialogForm");
const projectDialogTitle = document.querySelector<HTMLElement>("#projectDialogTitle");
const projectNameInput = document.querySelector<HTMLInputElement>("#projectNameInput");
const projectDialogError = document.querySelector<HTMLElement>("#projectDialogError");
const submitProjectDialogButton = document.querySelector<HTMLButtonElement>("#submitProjectDialogButton");
const cancelProjectDialogButton = document.querySelector<HTMLButtonElement>("#cancelProjectDialogButton");
const cancelProjectDialogIconButton = document.querySelector<HTMLButtonElement>("#cancelProjectDialogIconButton");
const historyHeading = document.querySelector<HTMLElement>("#historyHeading");
const scriptList = document.querySelector<HTMLUListElement>("#scriptList");
const scriptTitle = document.querySelector<HTMLInputElement>("#scriptTitle");
const scriptBody = document.querySelector<HTMLTextAreaElement>("#scriptBody");
const scriptStats = document.querySelector<HTMLElement>("#scriptStats");
const settingsButton = document.querySelector<HTMLButtonElement>("#settingsButton");
const themeToggleButton = document.querySelector<HTMLButtonElement>("#themeToggleButton");
const settingsModal = document.querySelector<HTMLElement>("#settingsModal");
const settingsBackdrop = document.querySelector<HTMLElement>("#settingsBackdrop");
const closeSettingsButton = document.querySelector<HTMLButtonElement>("#closeSettingsButton");
const resetSettingsButton = document.querySelector<HTMLButtonElement>("#resetSettingsButton");
const shortcutList = document.querySelector<HTMLElement>("#shortcutList");
const fontSizeInput = document.querySelector<HTMLInputElement>("#fontSizeInput");
const fontSizeValue = document.querySelector<HTMLElement>("#fontSizeValue");
const lineHeightInput = document.querySelector<HTMLInputElement>("#lineHeightInput");
const lineHeightValue = document.querySelector<HTMLElement>("#lineHeightValue");
const textColorInput = document.querySelector<HTMLInputElement>("#textColorInput");
const alignmentSelect = document.querySelector<HTMLSelectElement>("#alignmentSelect");
const opacityInput = document.querySelector<HTMLInputElement>("#opacityInput");
const opacityValue = document.querySelector<HTMLElement>("#opacityValue");
const backgroundColorInput = document.querySelector<HTMLInputElement>("#backgroundColorInput");
const appearancePresets = document.querySelector<HTMLElement>("#appearancePresets");
const contrastHint = document.querySelector<HTMLElement>("#contrastHint");
const countdownEnabledInput = document.querySelector<HTMLInputElement>("#countdownEnabledInput");
const countdownSecondsInput = document.querySelector<HTMLInputElement>("#countdownSecondsInput");
const scrollModeSelect = document.querySelector<HTMLSelectElement>("#scrollModeSelect");
const scrollSpeedInput = document.querySelector<HTMLInputElement>("#scrollSpeedInput");
const scrollSpeedValue = document.querySelector<HTMLElement>("#scrollSpeedValue");
const hideInterfaceWhileSpeakingInput = document.querySelector<HTMLInputElement>("#hideInterfaceWhileSpeakingInput");
const highlightModeSelect = document.querySelector<HTMLSelectElement>("#highlightModeSelect");
const settingsPreview = document.querySelector<HTMLElement>("#settingsPreview");
const livePreviewPane = document.querySelector<HTMLElement>("#livePreviewPane");
const livePreviewTrack = document.querySelector<HTMLElement>("#livePreviewTrack");
const livePreviewTexts = Array.from(document.querySelectorAll<HTMLElement>(".live-preview-text"));
const choiceGroups = Array.from(document.querySelectorAll<HTMLElement>("[data-choice-for]"));
const sizeScreen = document.querySelector<HTMLElement>("#sizeScreen");
const sizeWindow = document.querySelector<HTMLElement>("#sizeWindow");
const sizeReadout = document.querySelector<HTMLElement>("#sizeReadout");
const previewCountdown = document.querySelector<HTMLElement>("#previewCountdown");
const livePreviewCountdown = document.querySelector<HTMLElement>("#livePreviewCountdown");
const countdownBlock = document.querySelector<HTMLElement>(".countdown-block");
const scrollSpeedField = document.querySelector<HTMLElement>(".scroll-speed-field");
const settingsSavedPill = document.querySelector<HTMLElement>("#settingsSavedPill");
const settingsDrawer = document.querySelector<HTMLElement>(".settings-drawer");

let currentScriptsState: ScriptsState = {
  projects: [],
  scripts: []
};
let activeScriptId: string | undefined;
let settingsRenderLocked = false;
let openScriptMenuId: string | undefined;
let openProjectMenuId: string | undefined;
let selectedProjectId: string | undefined;
let editingProjectId: string | undefined;
let overlayWidthRatio = 0.47;
let overlayHeightRatio = 0.31;
let overlayXRatio = 0.265;
let overlayYRatio = 0;
let autosaveTimer: number | undefined;
let settingsSaveTimer: number | undefined;
let previewCountdownTimer: number | undefined;
let previewScrollRaf: number | undefined;
let previewScrollOffset = 0;
let previewScrollLastTs = 0;
let previewScrollPaused = false;

const autosaveDelayMs = 600;
const settingsSaveDelayMs = 200;

const overlaySizeLimits = {
  minWidthRatio: 0.25,
  maxWidthRatio: 1,
  minHeightRatio: 0.12,
  maxHeightRatio: 0.9
};

const defaultOverlayPlacement = {
  widthRatio: 0.47,
  heightRatio: 0.31,
  xRatio: 0.265,
  yRatio: 0
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
  newProjectButton,
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
  hideInterfaceWhileSpeakingInput,
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

  // Map the scroll-speed slider (8–160 px/s) linearly onto a realistic speaking pace (70–260 wpm).
  const minSpeed = 8;
  const maxSpeed = 160;
  const minWordsPerMinute = 70;
  const maxWordsPerMinute = 260;
  const clampedSpeed = Math.min(maxSpeed, Math.max(minSpeed, speed));
  const ratio = (clampedSpeed - minSpeed) / (maxSpeed - minSpeed);
  return Math.round(minWordsPerMinute + ratio * (maxWordsPerMinute - minWordsPerMinute));
}

function getSpeedPaceLabel(wordsPerMinute: number): string {
  if (wordsPerMinute <= 110) {
    return "Relaxed";
  }

  if (wordsPerMinute <= 150) {
    return "Natural";
  }

  if (wordsPerMinute <= 190) {
    return "Brisk";
  }

  return "Fast";
}

function renderScrollSpeedValue(): void {
  const wordsPerMinute = getEstimatedWordsPerMinute();
  const pace = getSpeedPaceLabel(wordsPerMinute);

  if (scrollSpeedValue) {
    scrollSpeedValue.textContent = `≈ ${wordsPerMinute} wpm · ${pace}`;
  }

  if (scrollSpeedInput) {
    // Keep the raw value discoverable on hover, and give screen readers the pace.
    scrollSpeedInput.title = `${scrollSpeedInput.value} px/s`;
    scrollSpeedInput.setAttribute("aria-valuetext", `about ${wordsPerMinute} words per minute, ${pace}`);
  }
}

// Refresh every numeric readout (and its screen-reader text) live from the current control values.
function renderControlReadouts(): void {
  if (fontSizeInput) {
    const fontSize = fontSizeInput.value;

    if (fontSizeValue) {
      fontSizeValue.textContent = `${fontSize}px`;
    }

    fontSizeInput.setAttribute("aria-valuetext", `${fontSize} pixels`);
  }

  if (lineHeightInput) {
    const lineHeight = Number(lineHeightInput.value).toFixed(2);

    if (lineHeightValue) {
      lineHeightValue.textContent = lineHeight;
    }

    lineHeightInput.setAttribute("aria-valuetext", `${lineHeight} line spacing`);
  }

  if (opacityInput) {
    const percent = Math.round(Number(opacityInput.value) * 100);

    if (opacityValue) {
      opacityValue.textContent = `${percent}%`;
    }

    opacityInput.setAttribute("aria-valuetext", `${percent} percent`);
  }

  renderScrollSpeedValue();
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
  const projectScopedScripts = selectedProjectId === undefined
    ? currentScriptsState.scripts
    : currentScriptsState.scripts.filter((script) => script.projectId === selectedProjectId);

  if (!query) {
    return projectScopedScripts;
  }

  return projectScopedScripts.filter((script) => {
    return script.title.toLowerCase().includes(query) || script.body.toLowerCase().includes(query);
  });
}

function getProjectName(projectId?: string): string {
  if (!projectId) {
    return "Uncategorised";
  }

  return currentScriptsState.projects.find((project) => project.id === projectId)?.name ?? "Unknown project";
}

function getCurrentProjectName(): string {
  return selectedProjectId ? getProjectName(selectedProjectId) : "All Scripts";
}

function getProjectScriptCount(projectId?: string): number {
  return currentScriptsState.scripts.filter((script) => script.projectId === projectId).length;
}

function renderProjectList(): void {
  if (!projectList) {
    return;
  }

  projectList.textContent = "";

  for (const project of currentScriptsState.projects) {
    const row = document.createElement("div");
    const button = document.createElement("button");
    const menuButton = document.createElement("button");
    row.className = openProjectMenuId === project.id ? "project-list-row has-open-menu" : "project-list-row";
    button.type = "button";
    button.className = selectedProjectId === project.id ? "project-list-item active" : "project-list-item";
    button.innerHTML = `
      <span class="project-list-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" /></svg></span>
      <span class="project-list-name"></span>
      <span class="project-list-count">${getProjectScriptCount(project.id)}</span>
    `;
    button.querySelector<HTMLElement>(".project-list-name")!.textContent = project.name;
    button.addEventListener("click", () => {
      selectedProjectId = project.id;
      openProjectMenuId = undefined;
      renderAllScriptsButton();
      renderProjectList();
      renderScriptsList();
    });

    menuButton.type = "button";
    menuButton.className = "project-menu-button";
    menuButton.setAttribute("aria-label", `More actions for ${project.name}`);
    menuButton.setAttribute("aria-haspopup", "menu");
    menuButton.setAttribute("aria-expanded", openProjectMenuId === project.id ? "true" : "false");
    menuButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>';
    menuButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openProjectMenuId = openProjectMenuId === project.id ? undefined : project.id;
      renderProjectList();
    });

    row.append(button, menuButton);

    if (openProjectMenuId === project.id) {
      row.append(buildProjectActionMenu(project));
    }

    projectList.append(row);
  }
}

function renderAllScriptsButton(): void {
  allScriptsButton?.classList.toggle("active", selectedProjectId === undefined);

  if (allScriptsCount) {
    allScriptsCount.textContent = String(currentScriptsState.scripts.length);
  }
}

function buildProjectActionMenu(project: ProjectRecord): HTMLElement {
  const menu = document.createElement("div");
  menu.className = "project-action-menu";
  menu.setAttribute("role", "menu");

  const renameAction = document.createElement("button");
  renameAction.type = "button";
  renameAction.className = "project-action-menu-item";
  renameAction.setAttribute("role", "menuitem");
  renameAction.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9" /><path d="m16.5 3.5 4 4L7 21H3v-4z" /></svg><span>Rename project</span>';
  renameAction.addEventListener("click", (event) => {
    event.stopPropagation();
    openProjectMenuId = undefined;
    openProjectDialog(project);
  });

  const deleteMoveAction = document.createElement("button");
  deleteMoveAction.type = "button";
  deleteMoveAction.className = "project-action-menu-item";
  deleteMoveAction.setAttribute("role", "menuitem");
  deleteMoveAction.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M18 6l-1 14H7L6 6" /></svg><span>Delete project only</span>';
  deleteMoveAction.addEventListener("click", (event) => {
    event.stopPropagation();
    openProjectMenuId = undefined;
    void deleteProjectWithConfirmation(project, "moveScripts");
  });

  const deleteAllAction = document.createElement("button");
  deleteAllAction.type = "button";
  deleteAllAction.className = "project-action-menu-item danger";
  deleteAllAction.setAttribute("role", "menuitem");
  deleteAllAction.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M18 6l-1 14H7L6 6" /></svg><span>Delete with scripts</span>';
  deleteAllAction.addEventListener("click", (event) => {
    event.stopPropagation();
    openProjectMenuId = undefined;
    void deleteProjectWithConfirmation(project, "deleteScripts");
  });

  menu.append(renameAction, deleteMoveAction, deleteAllAction);
  return menu;
}

function getDuplicateProject(name: string, ignoredProjectId?: string): ProjectRecord | undefined {
  const normalizedName = name.trim().toLocaleLowerCase();
  return currentScriptsState.projects.find((project) => {
    return project.id !== ignoredProjectId && project.name.trim().toLocaleLowerCase() === normalizedName;
  });
}

function setProjectDialogError(message: string): void {
  if (projectDialogError) {
    projectDialogError.textContent = message;
  }
}

function openProjectDialog(project?: ProjectRecord): void {
  editingProjectId = project?.id;
  openProjectMenuId = undefined;
  renderProjectList();

  if (projectDialogTitle) {
    projectDialogTitle.textContent = project ? "Rename project" : "Create project";
  }

  if (submitProjectDialogButton) {
    submitProjectDialogButton.textContent = project ? "Save" : "Create";
  }

  if (projectNameInput) {
    projectNameInput.value = project?.name ?? "";
  }

  setProjectDialogError("");
  projectDialog?.classList.add("is-open");
  projectDialog?.setAttribute("aria-hidden", "false");
  window.setTimeout(() => projectNameInput?.focus(), 0);
  projectNameInput?.select();
}

function closeProjectDialog(): void {
  editingProjectId = undefined;
  setProjectDialogError("");
  projectDialog?.classList.remove("is-open");
  projectDialog?.setAttribute("aria-hidden", "true");
  newProjectButton?.focus();
}

async function submitProjectDialog(): Promise<void> {
  const name = projectNameInput?.value.trim() ?? "";

  if (!name) {
    setProjectDialogError("Enter a project name.");
    projectNameInput?.focus();
    return;
  }

  if (getDuplicateProject(name, editingProjectId)) {
    setProjectDialogError("A project with this name already exists.");
    projectNameInput?.focus();
    return;
  }

  if (editingProjectId) {
    const currentProject = currentScriptsState.projects.find((project) => project.id === editingProjectId);

    if (!currentProject || currentProject.name === name) {
      closeProjectDialog();
      renderProjectList();
      return;
    }

    const state = await requireTeleprompterApi().renameProject(editingProjectId, name);
    closeProjectDialog();
    renderScriptsState(state);
    return;
  }

  const state = await requireTeleprompterApi().createProject(name);
  const createdProject = state.projects[state.projects.length - 1];

  if (createdProject) {
    selectedProjectId = createdProject.id;
  }

  closeProjectDialog();
  renderScriptsState(state);
}

async function deleteProjectWithConfirmation(project: ProjectRecord, mode: DeleteProjectMode): Promise<void> {
  const scriptCount = getProjectScriptCount(project.id);
  const message = mode === "deleteScripts"
    ? `Delete "${project.name}" and ${scriptCount} script${scriptCount === 1 ? "" : "s"}? This cannot be undone.`
    : `Delete "${project.name}" and move its ${scriptCount} script${scriptCount === 1 ? "" : "s"} to Uncategorised?`;

  if (!window.confirm(message)) {
    renderProjectList();
    return;
  }

  const state = await requireTeleprompterApi().deleteProject(project.id, mode);

  if (selectedProjectId === project.id) {
    selectedProjectId = undefined;
  }

  renderScriptsState(state);
}

function renderScriptsList(): void {
  if (!scriptList) {
    return;
  }

  if (historyHeading) {
    historyHeading.textContent = getCurrentProjectName();
  }

  scriptList.textContent = "";
  const scripts = getFilteredScripts();

  if (scripts.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "script-list-empty";
    emptyItem.textContent = currentScriptsState.scripts.length === 0
      ? "No scripts yet"
      : selectedProjectId
        ? "No scripts in this project"
        : "No matching scripts";
    scriptList.append(emptyItem);
    return;
  }

  for (const script of scripts) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const content = document.createElement("span");
    const rightMeta = document.createElement("span");
    const menuButton = document.createElement("button");
    const date = new Date(script.updatedAt).toLocaleDateString();
    item.className = openScriptMenuId === script.id ? "script-list-row has-open-menu" : "script-list-row";
    button.type = "button";
    button.className = [
      "script-list-item",
      script.id === activeScriptId ? "active" : "",
      script.pinned ? "is-pinned" : ""
    ].filter(Boolean).join(" ");
    const title = document.createElement("span");
    const updatedAt = document.createElement("small");
    const titleRow = document.createElement("span");
    content.className = "script-list-item-content";
    rightMeta.className = "script-list-item-meta";
    titleRow.className = "script-title-row";
    title.textContent = script.title;
    titleRow.append(title);

    if (script.pinned) {
      const pinIndicator = document.createElement("span");
      pinIndicator.className = "script-pin-indicator";
      pinIndicator.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17v5" /><path d="M5 17h14" /><path d="m6 10 2-7h8l2 7" /><path d="M8 10h8l1 7H7z" /></svg>';
      pinIndicator.title = "Pinned";
      rightMeta.append(pinIndicator);
    }

    updatedAt.textContent = date;
    content.append(titleRow, updatedAt);

    button.append(content, rightMeta);
    menuButton.type = "button";
    menuButton.className = "script-menu-button";
    menuButton.setAttribute("aria-label", `More actions for ${script.title}`);
    menuButton.setAttribute("aria-haspopup", "menu");
    menuButton.setAttribute("aria-expanded", openScriptMenuId === script.id ? "true" : "false");
    menuButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>';
    menuButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openScriptMenuId = openScriptMenuId === script.id ? undefined : script.id;
      renderScriptsList();
    });

    button.addEventListener("click", () => {
      void runEditorAction("Open script", async () => {
        const state = await requireTeleprompterApi().setActiveScript(script.id);
        renderScriptsState(state);
      });
    });
    item.append(button, menuButton);

    if (openScriptMenuId === script.id) {
      item.append(buildScriptActionMenu(script));
    }

    scriptList.append(item);
  }
}

function buildScriptActionMenu(script: ScriptRecord): HTMLElement {
  const menu = document.createElement("div");
  menu.className = "script-action-menu";
  menu.setAttribute("role", "menu");

  const pinAction = document.createElement("button");
  pinAction.type = "button";
  pinAction.className = "script-action-menu-item";
  pinAction.setAttribute("role", "menuitem");
  pinAction.innerHTML = script.pinned
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2 2 20 20" /><path d="M12 17v5" /><path d="M5 17h12" /><path d="m6 10 2-7h8l2 7" /><path d="M8 10h8l1 7H7z" /></svg><span>Unpin script</span>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17v5" /><path d="M5 17h14" /><path d="m6 10 2-7h8l2 7" /><path d="M8 10h8l1 7H7z" /></svg><span>Pin script</span>';
  pinAction.addEventListener("click", (event) => {
    event.stopPropagation();
    openScriptMenuId = undefined;
    void runEditorAction(script.pinned ? "Unpin script" : "Pin script", async () => {
      const state = await requireTeleprompterApi().setScriptPinned(script.id, !script.pinned);
      renderScriptsState(state);
    });
  });

  const deleteAction = document.createElement("button");
  deleteAction.type = "button";
  deleteAction.className = "script-action-menu-item danger";
  deleteAction.setAttribute("role", "menuitem");
  deleteAction.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M18 6l-1 14H7L6 6" /></svg><span>Delete script</span>';
  deleteAction.addEventListener("click", (event) => {
    event.stopPropagation();
    openScriptMenuId = undefined;
    void deleteScriptsWithConfirmation([script.id]);
  });

  const moveLabel = document.createElement("div");
  moveLabel.className = "script-action-menu-label";
  moveLabel.textContent = "Move to";

  const moveTargets: Array<{ id?: string; name: string }> = [
    { id: undefined, name: "Uncategorised" },
    ...currentScriptsState.projects.map((project) => ({ id: project.id, name: project.name }))
  ];
  const moveActions = moveTargets.map((target) => {
    const action = document.createElement("button");
    action.type = "button";
    action.className = script.projectId === target.id
      ? "script-action-menu-item is-current"
      : "script-action-menu-item";
    action.setAttribute("role", "menuitem");
    action.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" /></svg><span></span>';
    action.querySelector("span")!.textContent = target.name;
    action.addEventListener("click", (event) => {
      event.stopPropagation();
      openScriptMenuId = undefined;
      void runEditorAction("Move script", async () => {
        const state = await requireTeleprompterApi().moveScriptToProject(script.id, target.id);
        renderScriptsState(state);
      });
    });
    return action;
  });

  menu.append(pinAction, moveLabel, ...moveActions, deleteAction);
  return menu;
}

function renderScriptsState(state: ScriptsState): void {
  currentScriptsState = state;

  if (selectedProjectId && !currentScriptsState.projects.some((project) => project.id === selectedProjectId)) {
    selectedProjectId = undefined;
  }

  if (historyHeading) {
    historyHeading.textContent = getCurrentProjectName();
  }

  renderAllScriptsButton();
  renderProjectList();
  setEditorFromScript(state.activeScript);
  renderScriptsList();
}

async function deleteScriptsWithConfirmation(ids: string[]): Promise<void> {
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
  renderScriptsState(state);
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
    body,
    projectId: activeScriptId ? undefined : selectedProjectId
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
    body,
    projectId: activeScriptId ? undefined : selectedProjectId
  });

  currentScriptsState = state;
  activeScriptId = state.activeScript?.id ?? activeScriptId;
  renderScriptsList();
}

function getChoiceBacking(group: HTMLElement): (HTMLSelectElement | HTMLInputElement) | null {
  const backingId = group.dataset.choiceFor;
  return backingId ? document.querySelector<HTMLSelectElement | HTMLInputElement>(`#${backingId}`) : null;
}

function getChoiceOptions(group: HTMLElement): HTMLButtonElement[] {
  return Array.from(group.querySelectorAll<HTMLButtonElement>("[data-value]"));
}

function syncChoiceGroup(group: HTMLElement): void {
  const backing = getChoiceBacking(group);

  if (!backing) {
    return;
  }

  for (const option of getChoiceOptions(group)) {
    const isActive = option.dataset.value === backing.value;
    option.setAttribute("aria-checked", isActive ? "true" : "false");
    option.tabIndex = isActive ? 0 : -1;
  }
}

function syncChoiceGroups(): void {
  for (const group of choiceGroups) {
    syncChoiceGroup(group);
  }
}

function selectChoiceValue(group: HTMLElement, value: string): void {
  const backing = getChoiceBacking(group);

  if (!backing) {
    return;
  }

  if (backing.value === value) {
    syncChoiceGroup(group);
    return;
  }

  backing.value = value;
  syncChoiceGroup(group);
  // Reuse the existing change handler on the backing control to persist and preview.
  backing.dispatchEvent(new Event("change", { bubbles: true }));
}

function initChoiceGroups(): void {
  for (const group of choiceGroups) {
    const options = getChoiceOptions(group);

    group.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-value]");

      if (target?.dataset.value) {
        selectChoiceValue(group, target.dataset.value);
      }
    });

    group.addEventListener("keydown", (event) => {
      const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];

      if (!keys.includes(event.key)) {
        return;
      }

      event.preventDefault();
      const currentIndex = options.findIndex((option) => option.getAttribute("aria-checked") === "true");
      const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (Math.max(0, currentIndex) + delta + options.length) % options.length;
      const next = options[nextIndex];

      if (next?.dataset.value) {
        selectChoiceValue(group, next.dataset.value);
        next.focus();
      }
    });
  }
}

const shortcutActionLabels: Record<TeleprompterCommand, string> = {
  showOverlay: "Show teleprompter",
  hideOverlay: "Hide teleprompter",
  startPause: "Play / Pause",
  restart: "Restart from top",
  speedUp: "Speed up",
  slowDown: "Slow down"
};

const acceleratorTokenLabels: Record<string, string> = {
  CommandOrControl: "Ctrl",
  CmdOrCtrl: "Ctrl",
  Command: "Cmd",
  Cmd: "Cmd",
  Control: "Ctrl",
  Ctrl: "Ctrl",
  Alt: "Alt",
  Option: "Alt",
  Shift: "Shift",
  Super: "Win",
  Meta: "Win",
  Up: "↑",
  Down: "↓",
  Left: "←",
  Right: "→",
  Space: "Space",
  Return: "Enter",
  Escape: "Esc"
};

let shortcutStatuses: ShortcutStatus[] = [];
let captureKeydownHandler: ((event: KeyboardEvent) => void) | null = null;

function formatAcceleratorTokens(accelerator: string): string[] {
  return accelerator
    .split("+")
    .filter((token) => token.length > 0)
    .map((token) => acceleratorTokenLabels[token] ?? token);
}

function normalizeCaptureKey(event: KeyboardEvent): string | null {
  const key = event.key;

  if (["Control", "Alt", "Shift", "Meta", "OS"].includes(key)) {
    return null;
  }

  const named: Record<string, string> = {
    " ": "Space",
    Spacebar: "Space",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Enter: "Return",
    Escape: "Escape",
    Tab: "Tab",
    Backspace: "Backspace",
    Delete: "Delete"
  };

  if (named[key]) {
    return named[key];
  }

  if (/^F\d{1,2}$/.test(key)) {
    return key;
  }

  if (key.length === 1) {
    return key.toUpperCase();
  }

  return null;
}

function acceleratorFromEvent(event: KeyboardEvent): string | null {
  const key = normalizeCaptureKey(event);

  if (!key) {
    return null;
  }

  const hasModifier = event.ctrlKey || event.metaKey || event.altKey;
  const isFunctionKey = /^F\d{1,2}$/.test(key);

  // Require a modifier (except for function keys) so global hotkeys don't swallow plain keystrokes.
  if (!hasModifier && !isFunctionKey) {
    return null;
  }

  const parts: string[] = [];

  if (event.ctrlKey || event.metaKey) {
    parts.push("CommandOrControl");
  }

  if (event.altKey) {
    parts.push("Alt");
  }

  if (event.shiftKey) {
    parts.push("Shift");
  }

  parts.push(key);
  return parts.join("+");
}

function renderKeycaps(container: HTMLElement, accelerator: string): void {
  container.textContent = "";
  container.classList.remove("is-capturing");
  const tokens = formatAcceleratorTokens(accelerator);

  if (tokens.length === 0) {
    const placeholder = document.createElement("span");
    placeholder.className = "shortcut-keys-placeholder";
    placeholder.textContent = "Not set";
    container.append(placeholder);
    return;
  }

  for (const token of tokens) {
    const keycap = document.createElement("kbd");
    keycap.className = "keycap";
    keycap.textContent = token;
    container.append(keycap);
  }
}

function detachShortcutCapture(): void {
  if (captureKeydownHandler) {
    window.removeEventListener("keydown", captureKeydownHandler, true);
    captureKeydownHandler = null;
  }
}

function cancelShortcutCapture(): void {
  if (!captureKeydownHandler) {
    return;
  }

  detachShortcutCapture();
  renderShortcuts(shortcutStatuses);
}

function beginShortcutCapture(action: TeleprompterCommand, button: HTMLButtonElement): void {
  detachShortcutCapture();
  button.classList.add("is-capturing");
  button.textContent = "Press keys…";

  captureKeydownHandler = (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape") {
      cancelShortcutCapture();
      return;
    }

    const accelerator = acceleratorFromEvent(event);

    if (!accelerator) {
      return;
    }

    detachShortcutCapture();
    void applyShortcutBindings(action, { accelerator });
  };

  window.addEventListener("keydown", captureKeydownHandler, true);
}

async function applyShortcutBindings(
  action: TeleprompterCommand,
  changes: { accelerator?: string; enabled?: boolean }
): Promise<void> {
  await runEditorAction("Update shortcut", async () => {
    const bindings: ShortcutBinding[] = shortcutStatuses.map((status) => ({
      action: status.action,
      accelerator: status.action === action && changes.accelerator !== undefined
        ? changes.accelerator
        : status.accelerator,
      enabled: status.action === action && changes.enabled !== undefined
        ? changes.enabled
        : status.enabled
    }));
    const updated = await requireTeleprompterApi().updateShortcuts({ bindings });
    renderShortcuts(updated);
  });
}

function renderShortcuts(statuses: ShortcutStatus[]): void {
  shortcutStatuses = statuses;

  if (!shortcutList) {
    return;
  }

  shortcutList.textContent = "";

  for (const status of statuses) {
    const label = shortcutActionLabels[status.action] ?? status.action;
    const row = document.createElement("div");
    row.className = status.enabled ? "shortcut-row" : "shortcut-row is-disabled";

    const info = document.createElement("div");
    info.className = "shortcut-info";
    const name = document.createElement("span");
    name.className = "shortcut-name";
    name.textContent = label;
    info.append(name);

    if (status.enabled && !status.registered) {
      const warning = document.createElement("span");
      warning.className = "shortcut-warning";
      warning.textContent = "Unavailable — another app may use this combination";
      info.append(warning);
    }

    const controls = document.createElement("div");
    controls.className = "shortcut-controls";

    const keys = document.createElement("button");
    keys.type = "button";
    keys.className = "shortcut-keys";
    keys.setAttribute("aria-label", `Change the ${label} shortcut`);
    renderKeycaps(keys, status.accelerator);
    keys.addEventListener("click", () => beginShortcutCapture(status.action, keys));

    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.className = "toggle-switch";
    toggle.checked = status.enabled;
    toggle.setAttribute("aria-label", `Enable the ${label} shortcut`);
    toggle.addEventListener("change", () => {
      void applyShortcutBindings(status.action, { enabled: toggle.checked });
    });

    controls.append(keys, toggle);
    row.append(info, controls);
    shortcutList.append(row);
  }
}

async function loadShortcuts(): Promise<void> {
  const statuses = await requireTeleprompterApi().getShortcutStatus();
  renderShortcuts(statuses);
}

function renderSettings(settings: AppSettings): void {
  settingsRenderLocked = true;

  if (fontSizeInput) {
    fontSizeInput.value = String(settings.text.fontSize);
  }

  if (lineHeightInput) {
    lineHeightInput.value = String(settings.text.lineHeight);
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

  if (hideInterfaceWhileSpeakingInput) {
    hideInterfaceWhileSpeakingInput.checked = settings.behavior.hideInterfaceWhileSpeaking;
  }

  renderControlReadouts();

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
  syncChoiceGroups();
  syncCountdownDurationState();
  syncScrollModeState();
  updateActivePreset();
  updateContrastHint();

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
  highlightMode: string;
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
    livePreviewPane.dataset.highlight = values.highlightMode;
  }

  for (const text of livePreviewTexts) {
    text.style.color = values.textColor;
    text.style.fontSize = `${values.fontSize}px`;
    text.style.lineHeight = String(values.lineHeight);
    text.style.textAlign = values.alignment;
  }

  updatePreviewHighlight();
}

function renderSettingsPreview(settings: AppSettings): void {
  applyPreviewStyles({
    backgroundColor: settings.overlayAppearance.backgroundColor,
    opacity: settings.overlayAppearance.opacity,
    textColor: settings.text.textColor,
    fontSize: settings.text.fontSize,
    lineHeight: settings.text.lineHeight,
    alignment: settings.text.alignment,
    highlightMode: settings.experimental.highlightMode
  });
}

function renderSettingsPreviewFromControls(): void {
  applyPreviewStyles({
    backgroundColor: backgroundColorInput?.value ?? "#111827",
    opacity: Number(opacityInput?.value) || 0.82,
    textColor: textColorInput?.value ?? "#f8fafc",
    fontSize: Number(fontSizeInput?.value) || 32,
    lineHeight: Number(lineHeightInput?.value) || 1.5,
    alignment: alignmentSelect?.value ?? "center",
    highlightMode: highlightModeSelect?.value ?? "none"
  });
}

type AppearancePreset = {
  id: string;
  name: string;
  textColor: string;
  backgroundColor: string;
  opacity: number;
};

const appearancePresetList: AppearancePreset[] = [
  { id: "midnight", name: "Midnight", textColor: "#f9fafb", backgroundColor: "#111827", opacity: 0.82 },
  { id: "contrast", name: "High contrast", textColor: "#ffffff", backgroundColor: "#000000", opacity: 1 },
  { id: "paper", name: "Paper", textColor: "#26221b", backgroundColor: "#f4efe2", opacity: 0.95 },
  { id: "sage", name: "Sage", textColor: "#eef4ec", backgroundColor: "#2f4636", opacity: 0.86 }
];

function relativeLuminance(hexColor: string): number {
  const { red, green, blue } = hexToPreviewRgb(hexColor);
  const channels = [red, green, blue].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function getContrastRatio(hexA: string, hexB: string): number {
  const lighter = Math.max(relativeLuminance(hexA), relativeLuminance(hexB));
  const darker = Math.min(relativeLuminance(hexA), relativeLuminance(hexB));
  return (lighter + 0.05) / (darker + 0.05);
}

function getReadableTextColor(backgroundColor: string): string {
  const darkText = "#1f2420";
  const lightText = "#f9fafb";
  return getContrastRatio(lightText, backgroundColor) >= getContrastRatio(darkText, backgroundColor)
    ? lightText
    : darkText;
}

function normalizeReadablePreset(preset: AppearancePreset): AppearancePreset {
  return getContrastRatio(preset.textColor, preset.backgroundColor) >= 4.5
    ? preset
    : { ...preset, textColor: getReadableTextColor(preset.backgroundColor) };
}

function isPresetActive(preset: AppearancePreset): boolean {
  const readablePreset = normalizeReadablePreset(preset);
  return (
    (textColorInput?.value ?? "").toLowerCase() === readablePreset.textColor &&
    (backgroundColorInput?.value ?? "").toLowerCase() === readablePreset.backgroundColor &&
    Math.abs(Number(opacityInput?.value) - readablePreset.opacity) < 0.005
  );
}

function updateActivePreset(): void {
  if (!appearancePresets) {
    return;
  }

  const cards = Array.from(appearancePresets.querySelectorAll<HTMLButtonElement>(".preset-card"));
  const anyActive = appearancePresetList.some(isPresetActive);

  cards.forEach((card, index) => {
    const preset = appearancePresetList.find((entry) => entry.id === card.dataset.preset);
    const active = preset ? isPresetActive(preset) : false;
    card.setAttribute("aria-checked", active ? "true" : "false");
    // Keep one card keyboard-reachable: the active one, or the first when on custom colours.
    card.tabIndex = active || (!anyActive && index === 0) ? 0 : -1;
  });
}

function updateContrastHint(): void {
  if (!contrastHint) {
    return;
  }

  const textColor = textColorInput?.value ?? "#ffffff";
  const backgroundColor = backgroundColorInput?.value ?? "#000000";
  contrastHint.hidden = getContrastRatio(textColor, backgroundColor) >= 3;
}

function applyAppearancePreset(preset: AppearancePreset): void {
  const readablePreset = normalizeReadablePreset(preset);

  if (textColorInput) {
    textColorInput.value = readablePreset.textColor;
  }

  if (backgroundColorInput) {
    backgroundColorInput.value = readablePreset.backgroundColor;
  }

  if (opacityInput) {
    opacityInput.value = String(readablePreset.opacity);
  }

  renderSettingsPreviewFromControls();
  renderControlReadouts();
  updateActivePreset();
  updateContrastHint();
  scheduleSettingsSave();
}

function buildAppearancePresets(): void {
  if (!appearancePresets) {
    return;
  }

  appearancePresets.textContent = "";

  for (const preset of appearancePresetList) {
    const readablePreset = normalizeReadablePreset(preset);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "preset-card";
    card.dataset.preset = preset.id;
    card.setAttribute("role", "radio");
    card.setAttribute("aria-checked", "false");
    card.setAttribute("aria-label", preset.name);
    card.tabIndex = -1;

    const swatch = document.createElement("span");
    swatch.className = "preset-swatch";
    swatch.textContent = "Aa";
    swatch.style.background = getOpaquePreviewBackground(readablePreset.backgroundColor, readablePreset.opacity);
    swatch.style.color = readablePreset.textColor;

    const name = document.createElement("span");
    name.className = "preset-name";
    name.textContent = preset.name;

    card.append(swatch, name);
    card.addEventListener("click", () => applyAppearancePreset(readablePreset));
    appearancePresets.append(card);
  }

  appearancePresets.addEventListener("keydown", (event) => {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];

    if (!keys.includes(event.key)) {
      return;
    }

    event.preventDefault();
    const cards = Array.from(appearancePresets.querySelectorAll<HTMLButtonElement>(".preset-card"));
    const currentIndex = cards.findIndex((card) => card === document.activeElement);
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    const next = cards[(Math.max(0, currentIndex) + delta + cards.length) % cards.length];
    const preset = appearancePresetList.find((entry) => entry.id === next?.dataset.preset);

    if (next && preset) {
      next.focus();
      applyAppearancePreset(normalizeReadablePreset(preset));
    }
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

const livePreviewSampleText =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

function buildLivePreviewWords(): void {
  const words = livePreviewSampleText.split(/\s+/).filter(Boolean);

  for (const paragraph of livePreviewTexts) {
    paragraph.textContent = "";

    words.forEach((word, index) => {
      const span = document.createElement("span");
      span.className = "lp-word";
      span.textContent = word;
      paragraph.append(span);

      if (index < words.length - 1) {
        paragraph.append(document.createTextNode(" "));
      }
    });
  }
}

function updatePreviewHighlight(): void {
  if (!livePreviewTrack || !livePreviewPane) {
    return;
  }

  const mode = livePreviewPane.dataset.highlight ?? "none";
  const words = Array.from(livePreviewTrack.querySelectorAll<HTMLElement>(".lp-word"));

  if (mode !== "sentence" && mode !== "word") {
    livePreviewTrack.classList.remove("is-focus-tracking");

    for (const word of words) {
      word.classList.remove("is-active");
    }

    return;
  }

  livePreviewTrack.classList.add("is-focus-tracking");

  if (mode === "word") {
    updatePreviewWordHighlight(words);
    return;
  }

  updatePreviewLineHighlight(words);
}

function updatePreviewWordHighlight(words: HTMLElement[]): void {
  if (!livePreviewTrack || !livePreviewPane) {
    return;
  }

  // Two identical copies stack in the track, so the first half is one reading pass.
  const wordsPerCopy = Math.floor(words.length / 2);
  const loopHeight = livePreviewTrack.scrollHeight / 2;

  if (wordsPerCopy <= 0 || loopHeight <= 0) {
    return;
  }

  // Where the centre focus band falls in the track's own (untransformed) coordinates.
  const bandContentY = previewScrollOffset + livePreviewPane.clientHeight / 2;
  const bandWithinLoop = ((bandContentY % loopHeight) + loopHeight) % loopHeight;

  // Group the first copy into visual lines using stable layout positions (offsetTop ignores the scroll transform).
  type PreviewLine = { top: number; bottom: number; indices: number[] };
  const lines: PreviewLine[] = [];
  let currentLine: PreviewLine | null = null;

  for (let index = 0; index < wordsPerCopy; index += 1) {
    const word = words[index];
    const top = word.offsetTop;
    const bottom = top + word.offsetHeight;

    if (!currentLine || Math.abs(top - currentLine.top) > 2) {
      currentLine = { top, bottom, indices: [index] };
      lines.push(currentLine);
    } else {
      currentLine.indices.push(index);
      currentLine.bottom = Math.max(currentLine.bottom, bottom);
    }
  }

  // The line nearest the band (measured with wrap, since the copies loop).
  let activeLine: PreviewLine | null = null;
  let bestDistance = Infinity;

  for (const line of lines) {
    const center = (line.top + line.bottom) / 2;
    const rawDistance = Math.abs(center - bandWithinLoop);
    const distance = Math.min(rawDistance, loopHeight - rawDistance);

    if (distance < bestDistance) {
      bestDistance = distance;
      activeLine = line;
    }
  }

  if (!activeLine) {
    return;
  }

  // Sweep the active word left-to-right as the line crosses the band, so it keeps pace with the scroll.
  const span = Math.max(1, activeLine.bottom - activeLine.top);
  const through = Math.min(0.999, Math.max(0, (bandWithinLoop - activeLine.top) / span));
  const activeIndex = activeLine.indices[Math.floor(through * activeLine.indices.length)];

  words.forEach((word, index) => {
    word.classList.toggle("is-active", index % wordsPerCopy === activeIndex);
  });
}

function updatePreviewLineHighlight(words: HTMLElement[]): void {
  if (!livePreviewPane) {
    return;
  }

  const paneRect = livePreviewPane.getBoundingClientRect();
  const bandY = paneRect.top + paneRect.height / 2;

  // Read every word's geometry first (one layout pass), then write classes.
  const entries = words.map((word) => {
    const rect = word.getBoundingClientRect();
    return { word, top: rect.top, center: rect.top + rect.height / 2, height: rect.height };
  });

  let best: (typeof entries)[number] | null = null;

  for (const entry of entries) {
    if (entry.height <= 0) {
      continue;
    }

    if (!best || Math.abs(entry.center - bandY) < Math.abs(best.center - bandY)) {
      best = entry;
    }
  }

  for (const entry of entries) {
    const active = best !== null && Math.abs(entry.top - best.top) <= 2;
    entry.word.classList.toggle("is-active", active);
  }
}

function stepPreviewScroll(timestamp: number): void {
  if (!livePreviewTrack) {
    previewScrollRaf = undefined;
    return;
  }

  if (previewScrollPaused) {
    // Hold position (reset to top) while a countdown plays; keep the loop alive to resume cleanly.
    previewScrollLastTs = timestamp;
    previewScrollRaf = requestAnimationFrame(stepPreviewScroll);
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

  updatePreviewHighlight();
  previewScrollRaf = requestAnimationFrame(stepPreviewScroll);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function startPreviewScroll(): void {
  if (!livePreviewTrack || previewScrollRaf !== undefined) {
    return;
  }

  previewScrollOffset = 0;
  previewScrollLastTs = 0;
  previewScrollPaused = false;
  livePreviewTrack.style.transform = "translateY(0)";

  if (prefersReducedMotion()) {
    // Honour reduced-motion: show a static, still-representative preview instead of looping it.
    updatePreviewHighlight();
    return;
  }

  previewScrollRaf = requestAnimationFrame(stepPreviewScroll);
}

function stopPreviewScroll(): void {
  if (previewScrollRaf !== undefined) {
    cancelAnimationFrame(previewScrollRaf);
    previewScrollRaf = undefined;
  }

  previewScrollLastTs = 0;
}

function getCountdownElements(): HTMLElement[] {
  return [previewCountdown, livePreviewCountdown].filter((element): element is HTMLElement => element !== null);
}

function setCountdownText(text: string, hidden: boolean): void {
  for (const element of getCountdownElements()) {
    element.textContent = text;
    element.hidden = hidden;
  }
}

function stopPreviewCountdown(): void {
  if (previewCountdownTimer !== undefined) {
    window.clearInterval(previewCountdownTimer);
    previewCountdownTimer = undefined;
  }

  for (const element of getCountdownElements()) {
    element.hidden = true;
  }

  // Resume the preview scroll once the countdown ends (or is cancelled).
  previewScrollPaused = false;
  previewScrollLastTs = 0;
}

function playPreviewCountdown(): void {
  stopPreviewCountdown();

  if (getCountdownElements().length === 0) {
    return;
  }

  // Park the preview scroll at the top and hold it until the countdown finishes.
  previewScrollPaused = true;
  previewScrollOffset = 0;
  previewScrollLastTs = 0;

  if (livePreviewTrack) {
    livePreviewTrack.style.transform = "translateY(0)";
  }

  const seconds = Math.max(1, Math.min(10, Math.round(Number(countdownSecondsInput?.value) || 3)));
  let remaining = seconds;
  setCountdownText(String(remaining), false);
  previewCountdownTimer = window.setInterval(() => {
    remaining -= 1;

    if (remaining < 1) {
      stopPreviewCountdown();
      return;
    }

    setCountdownText(String(remaining), false);
  }, 1000);
}

function syncCountdownDurationState(): void {
  countdownBlock?.classList.toggle("is-duration-disabled", !countdownEnabledInput?.checked);
}

function syncScrollModeState(): void {
  // Manual scroll speed only applies in manual mode; dim it when voice tracking drives the pace.
  scrollSpeedField?.classList.toggle("is-mode-disabled", scrollModeSelect?.value === "voice");
}

function applyOverlayPlacement(place: string): void {
  if (place === "reset") {
    overlayWidthRatio = defaultOverlayPlacement.widthRatio;
    overlayHeightRatio = defaultOverlayPlacement.heightRatio;
    overlayXRatio = defaultOverlayPlacement.xRatio;
    overlayYRatio = defaultOverlayPlacement.yRatio;
  } else if (place === "full-width") {
    overlayWidthRatio = 1;
    overlayXRatio = 0;
    overlayYRatio = 0;
  } else {
    overlayYRatio = 0;

    if (place === "top-left") {
      overlayXRatio = 0;
    } else if (place === "top-right") {
      overlayXRatio = 1 - overlayWidthRatio;
    } else {
      overlayXRatio = (1 - overlayWidthRatio) / 2;
    }
  }

  // Keep everything inside the screen after the change.
  overlayWidthRatio = clampRatio(overlayWidthRatio, overlaySizeLimits.minWidthRatio, overlaySizeLimits.maxWidthRatio);
  overlayHeightRatio = clampRatio(overlayHeightRatio, overlaySizeLimits.minHeightRatio, overlaySizeLimits.maxHeightRatio);
  overlayXRatio = clampRatio(overlayXRatio, 0, 1 - overlayWidthRatio);
  overlayYRatio = clampRatio(overlayYRatio, 0, 1 - overlayHeightRatio);

  // Animate just this change, then drop the class so dragging stays snappy.
  sizeWindow?.classList.add("is-snapping");
  renderOverlaySize();
  window.setTimeout(() => sizeWindow?.classList.remove("is-snapping"), 240);

  void runEditorAction("Save teleprompter size", saveOverlaySize);
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
  showSavedPill();
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

let savedPillTimer: number | undefined;

function showSavedPill(): void {
  // Only confirm while the drawer is actually open (skip the flush-on-close save).
  if (!settingsSavedPill || !settingsModal?.classList.contains("is-open")) {
    return;
  }

  settingsSavedPill.classList.add("is-visible");

  if (savedPillTimer !== undefined) {
    window.clearTimeout(savedPillTimer);
  }

  savedPillTimer = window.setTimeout(() => {
    settingsSavedPill.classList.remove("is-visible");
    savedPillTimer = undefined;
  }, 1500);
}

function scheduleSettingsSave(): void {
  if (settingsRenderLocked) {
    return;
  }

  if (settingsSaveTimer !== undefined) {
    window.clearTimeout(settingsSaveTimer);
  }

  settingsSaveTimer = window.setTimeout(() => {
    settingsSaveTimer = undefined;
    void runEditorAction("Save settings", saveSettingsFromControls);
  }, settingsSaveDelayMs);
}

function flushSettingsSave(): void {
  if (settingsSaveTimer === undefined) {
    return;
  }

  window.clearTimeout(settingsSaveTimer);
  settingsSaveTimer = undefined;
  void runEditorAction("Save settings", saveSettingsFromControls);
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
      scrollMode: scrollModeSelect?.value as AppSettings["behavior"]["scrollMode"],
      hideInterfaceWhileSpeaking: Boolean(hideInterfaceWhileSpeakingInput?.checked)
    },
    experimental: {
      highlightMode: highlightModeSelect?.value as AppSettings["experimental"]["highlightMode"]
    }
  });

  renderSettings(settings);
  renderScriptStats();
  showSavedPill();
}

const sidebarCollapsedStorageKey = "teleprompter:sidebarCollapsed";
const editorThemeStorageKey = "teleprompter:editorTheme";

type EditorTheme = "light" | "dark";

function setEditorTheme(theme: EditorTheme): void {
  document.documentElement.dataset.editorTheme = theme;

  if (themeToggleButton) {
    const nextTheme = theme === "dark" ? "light" : "dark";
    themeToggleButton.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
    themeToggleButton.title = `Switch to ${nextTheme} mode`;
  }

  try {
    localStorage.setItem(editorThemeStorageKey, theme);
  } catch {
    // Ignore storage failures; the theme simply won't persist.
  }
}

function loadEditorTheme(): EditorTheme {
  try {
    return localStorage.getItem(editorThemeStorageKey) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function toggleEditorTheme(): void {
  setEditorTheme(document.documentElement.dataset.editorTheme === "dark" ? "light" : "dark");
}

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

let settingsReturnFocusElement: HTMLElement | null = null;

function getDrawerFocusableElements(): HTMLElement[] {
  if (!settingsDrawer) {
    return [];
  }

  const selector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(settingsDrawer.querySelectorAll<HTMLElement>(selector)).filter(
    (element) => element.offsetParent !== null
  );
}

// Keep keyboard focus inside the open dialog instead of leaking to the dimmed editor behind it.
function handleSettingsTabKey(event: KeyboardEvent): void {
  if (event.key !== "Tab") {
    return;
  }

  const focusable = getDrawerFocusableElements();

  if (focusable.length === 0) {
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement as HTMLElement | null;

  if (event.shiftKey && (active === first || !settingsDrawer?.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !settingsDrawer?.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}

function openSettings(): void {
  if (!settingsModal) {
    return;
  }

  settingsReturnFocusElement = document.activeElement as HTMLElement | null;
  settingsModal.classList.add("is-open");
  void runEditorAction("Load shortcuts", loadShortcuts);
  requestAnimationFrame(() => {
    renderOverlaySize();
    renderSettingsPreviewFromControls();
    startPreviewScroll();
    // Move focus into the dialog for keyboard and screen-reader users.
    (closeSettingsButton ?? getDrawerFocusableElements()[0])?.focus();
  });
}

function closeSettings(): void {
  flushSettingsSave();
  disarmReset();
  settingsModal?.classList.remove("is-open");
  cancelShortcutCapture();
  stopPreviewCountdown();
  stopPreviewScroll();
  settingsReturnFocusElement?.focus();
  settingsReturnFocusElement = null;
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
settingsDrawer?.addEventListener("keydown", handleSettingsTabKey);

setEditorTheme(loadEditorTheme());
setSidebarCollapsed(loadSidebarCollapsed());
themeToggleButton?.addEventListener("click", toggleEditorTheme);
toggleSidebarButton?.addEventListener("click", () => {
  setSidebarCollapsed(!editorApp?.classList.contains("sidebar-collapsed"));
});

function setupSliderBubble(input: HTMLInputElement | null, format: () => string): void {
  if (!input || !input.parentNode) {
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "range-wrap";
  input.parentNode.insertBefore(wrap, input);
  wrap.append(input);

  const bubble = document.createElement("div");
  bubble.className = "range-bubble";
  bubble.setAttribute("aria-hidden", "true");
  wrap.append(bubble);

  const position = (): void => {
    const min = Number(input.min) || 0;
    const max = Number(input.max) || 100;
    const value = Number(input.value);
    const ratio = max > min ? (value - min) / (max - min) : 0;
    const thumbWidth = 16;
    bubble.style.left = `${ratio * (input.clientWidth - thumbWidth) + thumbWidth / 2}px`;
    bubble.textContent = format();
  };

  const show = (): void => {
    position();
    bubble.classList.add("is-visible");
  };

  const hide = (): void => bubble.classList.remove("is-visible");

  input.addEventListener("input", () => {
    if (bubble.classList.contains("is-visible")) {
      position();
    }
  });
  input.addEventListener("pointerdown", show);
  window.addEventListener("pointerup", hide);
  // Keyboard users: reveal the bubble only when focus came from the keyboard.
  input.addEventListener("focus", () => {
    if (input.matches(":focus-visible")) {
      show();
    }
  });
  input.addEventListener("keydown", () => {
    if (input.matches(":focus-visible")) {
      show();
    }
  });
  input.addEventListener("blur", hide);
}

function setupSliderBubbles(): void {
  setupSliderBubble(fontSizeInput, () => `${fontSizeInput?.value ?? ""}px`);
  setupSliderBubble(lineHeightInput, () => Number(lineHeightInput?.value).toFixed(2));
  setupSliderBubble(scrollSpeedInput, () => `≈ ${getEstimatedWordsPerMinute()} wpm`);
  setupSliderBubble(opacityInput, () => `${Math.round(Number(opacityInput?.value) * 100)}%`);
}

applyMockPlatform();
buildLivePreviewWords();
buildAppearancePresets();
setupSliderBubbles();
initChoiceGroups();
countdownEnabledInput?.addEventListener("change", () => {
  syncCountdownDurationState();

  if (countdownEnabledInput?.checked) {
    playPreviewCountdown();
  } else {
    stopPreviewCountdown();
  }
});

countdownSecondsInput?.addEventListener("change", () => {
  if (countdownEnabledInput?.checked) {
    playPreviewCountdown();
  }
});

scrollModeSelect?.addEventListener("change", syncScrollModeState);

for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>(".placement-row [data-place]"))) {
  button.addEventListener("click", () => applyOverlayPlacement(button.dataset.place ?? ""));
}

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
allScriptsButton?.addEventListener("click", () => {
  selectedProjectId = undefined;
  openProjectMenuId = undefined;
  renderAllScriptsButton();
  renderProjectList();
  renderScriptsList();
});
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
    renderScriptsList();
  });
});

newProjectButton?.addEventListener("click", () => {
  openProjectDialog();
});

projectDialogForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  void runEditorAction(editingProjectId ? "Rename project" : "Create project", submitProjectDialog);
});

projectNameInput?.addEventListener("input", () => {
  setProjectDialogError("");
});

projectDialogBackdrop?.addEventListener("click", closeProjectDialog);
cancelProjectDialogButton?.addEventListener("click", closeProjectDialog);
cancelProjectDialogIconButton?.addEventListener("click", closeProjectDialog);

projectDialog?.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeProjectDialog();
  }
});

clearScriptButton?.addEventListener("click", () => {
  void runEditorAction("Clear editor", async () => {
    const state = await requireTeleprompterApi().clearActiveScript();
    renderScriptsState(state);
  });
});

document.addEventListener("click", (event) => {
  const clickedInsideScriptList = event.target instanceof Node && scriptList?.contains(event.target);
  const clickedInsideProjectList = event.target instanceof Node && projectList?.contains(event.target);

  if ((!openScriptMenuId && !openProjectMenuId) || clickedInsideScriptList || clickedInsideProjectList) {
    return;
  }

  openScriptMenuId = undefined;
  openProjectMenuId = undefined;
  renderProjectList();
  renderScriptsList();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && (openScriptMenuId || openProjectMenuId)) {
    openScriptMenuId = undefined;
    openProjectMenuId = undefined;
    renderProjectList();
    renderScriptsList();
  }
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
  hideInterfaceWhileSpeakingInput,
  highlightModeSelect
]) {
  control?.addEventListener("input", () => {
    renderSettingsPreviewFromControls();
    renderControlReadouts();
    updateActivePreset();
    updateContrastHint();
    renderScriptStats();
    scheduleSettingsSave();
  });

  control?.addEventListener("change", () => {
    renderSettingsPreviewFromControls();
    renderControlReadouts();
    updateActivePreset();
    updateContrastHint();
    renderScriptStats();
    scheduleSettingsSave();
  });
}

const resetDefaultLabel = "Reset to defaults";
const resetArmedLabel = "Reset?";
const resetArmDurationMs = 4000;
let resetArmTimer: number | undefined;

function handleResetOutsideClick(event: Event): void {
  if (event.target instanceof Node && resetSettingsButton?.contains(event.target)) {
    return;
  }

  disarmReset();
}

function disarmReset(): void {
  if (resetArmTimer !== undefined) {
    window.clearTimeout(resetArmTimer);
    resetArmTimer = undefined;
  }

  document.removeEventListener("pointerdown", handleResetOutsideClick, true);

  if (resetSettingsButton) {
    resetSettingsButton.classList.remove("is-arming");
    resetSettingsButton.textContent = resetDefaultLabel;
  }
}

function armReset(): void {
  if (!resetSettingsButton) {
    return;
  }

  resetSettingsButton.classList.add("is-arming");
  resetSettingsButton.textContent = resetArmedLabel;

  if (resetArmTimer !== undefined) {
    window.clearTimeout(resetArmTimer);
  }

  // Auto-disarm so the button never lingers in its red confirm state.
  resetArmTimer = window.setTimeout(disarmReset, resetArmDurationMs);
  // Clicking anywhere outside the button cancels the pending reset.
  document.addEventListener("pointerdown", handleResetOutsideClick, true);
}

resetSettingsButton?.addEventListener("click", () => {
  if (!resetSettingsButton.classList.contains("is-arming")) {
    armReset();
    return;
  }

  disarmReset();
  void runEditorAction("Reset settings", async () => {
    const api = requireTeleprompterApi();
    const settings = await api.resetSettings();
    renderSettings(settings);
    const statuses = await api.resetShortcuts();
    renderShortcuts(statuses);
  });
});

if (initializePreloadApi()) {
  void runEditorAction("Load local scripts", loadScriptsState);
  void runEditorAction("Load settings", loadSettings);
  void runEditorAction("Load shortcuts", loadShortcuts);
}
