import type { ScriptRecord, ScriptsState, TeleprompterCommand } from "../../shared/ipc";

const statusElement = document.querySelector<HTMLPreElement>("#status");
const newScriptButton = document.querySelector<HTMLButtonElement>("#newScriptButton");
const saveScriptButton = document.querySelector<HTMLButtonElement>("#saveScriptButton");
const renameScriptButton = document.querySelector<HTMLButtonElement>("#renameScriptButton");
const deleteScriptButton = document.querySelector<HTMLButtonElement>("#deleteScriptButton");
const clearScriptButton = document.querySelector<HTMLButtonElement>("#clearScriptButton");
const scriptList = document.querySelector<HTMLUListElement>("#scriptList");
const scriptTitle = document.querySelector<HTMLInputElement>("#scriptTitle");
const scriptBody = document.querySelector<HTMLTextAreaElement>("#scriptBody");
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
const shortcutList = document.querySelector<HTMLUListElement>("#shortcutList");

let currentScriptsState: ScriptsState = {
  scripts: []
};
let activeScriptId: string | undefined;

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

async function renderShortcutStatus(): Promise<void> {
  if (!shortcutList) {
    return;
  }

  const shortcuts = await window.teleprompter.getShortcutStatus();
  shortcutList.textContent = "";

  for (const shortcut of shortcuts) {
    const item = document.createElement("li");
    item.textContent = `${shortcut.action}: ${shortcut.accelerator} ${shortcut.registered ? "registered" : "failed"}`;
    item.className = shortcut.registered ? "shortcut-ok" : "shortcut-failed";
    shortcutList.append(item);
  }
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
