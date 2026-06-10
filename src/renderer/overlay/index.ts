import type { AppSettings } from "../../shared/ipc";

const overlayStatus = document.querySelector<HTMLParagraphElement>("#overlayStatus");
const countdownElement = document.querySelector<HTMLElement>("#countdown");
const promptViewport = document.querySelector<HTMLElement>("#promptViewport");
const promptText = document.querySelector<HTMLElement>("#promptText");
const stateLabel = document.querySelector<HTMLElement>("#stateLabel");
const speedLabel = document.querySelector<HTMLElement>("#speedLabel");

type ScrollState = "idle" | "countdown" | "running" | "paused" | "completed";

let state: ScrollState = "idle";
let speedPixelsPerSecond = 36;
let lastFrameTime = 0;
let animationFrameId: number | null = null;
let countdownTimerId: number | null = null;
let countdownRemaining = 0;
let countdownEnabled = true;
let countdownSeconds = 3;
let highlightMode: AppSettings["experimental"]["highlightMode"] = "none";
let currentHighlightIndex = -1;

function hexToRgb(hexColor: string): { red: number; green: number; blue: number } {
  const normalized = hexColor.replace("#", "");

  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function updateLabels(): void {
  if (overlayStatus) {
    overlayStatus.textContent = state;
  }

  if (stateLabel) {
    stateLabel.textContent = `State: ${state}`;
  }

  if (speedLabel) {
    speedLabel.textContent = `Speed: ${speedPixelsPerSecond} px/s`;
  }
}

function getActiveHighlightElements(): HTMLElement[] {
  if (!promptText || highlightMode === "none") {
    return [];
  }

  return Array.from(promptText.querySelectorAll<HTMLElement>(`[data-highlight-kind="${highlightMode}"]`));
}

function clearActiveHighlight(): void {
  if (!promptText) {
    return;
  }

  for (const element of Array.from(promptText.querySelectorAll(".prompt-highlight-active"))) {
    element.classList.remove("prompt-highlight-active");
  }

  currentHighlightIndex = -1;
}

function updateHighlight(): void {
  if (!promptViewport || highlightMode === "none") {
    clearActiveHighlight();
    return;
  }

  const elements = getActiveHighlightElements();

  if (elements.length === 0) {
    return;
  }

  const maxScrollTop = Math.max(1, promptViewport.scrollHeight - promptViewport.clientHeight);
  const progress = Math.min(1, Math.max(0, promptViewport.scrollTop / maxScrollTop));
  const nextIndex = Math.min(elements.length - 1, Math.floor(progress * elements.length));

  if (nextIndex === currentHighlightIndex) {
    return;
  }

  if (currentHighlightIndex >= 0) {
    elements[currentHighlightIndex]?.classList.remove("prompt-highlight-active");
  }

  elements[nextIndex]?.classList.add("prompt-highlight-active");
  currentHighlightIndex = nextIndex;
}

function applySettings(settings: AppSettings): void {
  speedPixelsPerSecond = settings.behavior.scrollSpeed;
  countdownEnabled = settings.countdown.enabled;
  countdownSeconds = settings.countdown.seconds;
  highlightMode = settings.experimental.highlightMode;
  const background = hexToRgb(settings.overlayAppearance.backgroundColor);

  document.documentElement.style.setProperty(
    "--overlay-bg",
    `rgb(${background.red} ${background.green} ${background.blue} / ${settings.overlayAppearance.opacity})`
  );
  document.documentElement.style.setProperty("--prompt-font-size", `${settings.text.fontSize}px`);
  document.documentElement.style.setProperty("--prompt-text-color", settings.text.textColor);
  document.documentElement.style.setProperty("--prompt-line-height", String(settings.text.lineHeight));
  document.documentElement.style.setProperty("--prompt-text-align", settings.text.alignment);

  updateLabels();
  updateHighlight();
}

function clearCountdown(): void {
  if (countdownTimerId !== null) {
    window.clearInterval(countdownTimerId);
    countdownTimerId = null;
  }

  if (countdownElement) {
    countdownElement.hidden = true;
    countdownElement.textContent = "";
  }
}

function setState(nextState: ScrollState): void {
  state = nextState;
  updateLabels();
}

function scrollFrame(timestamp: number): void {
  if (state !== "running" || !promptViewport) {
    animationFrameId = null;
    return;
  }

  if (lastFrameTime === 0) {
    lastFrameTime = timestamp;
  }

  const deltaSeconds = (timestamp - lastFrameTime) / 1000;
  lastFrameTime = timestamp;
  promptViewport.scrollTop += speedPixelsPerSecond * deltaSeconds;
  updateHighlight();

  const maxScrollTop = promptViewport.scrollHeight - promptViewport.clientHeight;

  if (promptViewport.scrollTop >= maxScrollTop) {
    promptViewport.scrollTop = maxScrollTop;
    updateHighlight();
    setState("completed");
    animationFrameId = null;
    return;
  }

  animationFrameId = window.requestAnimationFrame(scrollFrame);
}

function startAnimation(): void {
  if (animationFrameId !== null) {
    window.cancelAnimationFrame(animationFrameId);
  }

  lastFrameTime = 0;
  animationFrameId = window.requestAnimationFrame(scrollFrame);
}

function startRunning(): void {
  clearCountdown();
  setState("running");
  startAnimation();
}

function startCountdown(): void {
  clearCountdown();

  if (!countdownEnabled || countdownSeconds <= 0) {
    startRunning();
    return;
  }

  countdownRemaining = countdownSeconds;
  setState("countdown");

  if (countdownElement) {
    countdownElement.hidden = false;
    countdownElement.textContent = String(countdownRemaining);
  }

  countdownTimerId = window.setInterval(() => {
    countdownRemaining -= 1;

    if (countdownRemaining <= 0) {
      startRunning();
      return;
    }

    if (countdownElement) {
      countdownElement.textContent = String(countdownRemaining);
    }
  }, 1000);
}

function pause(): void {
  clearCountdown();
  setState("paused");
}

function startPause(): void {
  if (state === "idle" || state === "completed") {
    startCountdown();
    return;
  }

  if (state === "countdown" || state === "running") {
    pause();
    return;
  }

  if (state === "paused") {
    startRunning();
  }
}

function restart(): void {
  clearCountdown();

  if (promptViewport) {
    promptViewport.scrollTop = 0;
    updateHighlight();
  }

  startCountdown();
}

function speedUp(): void {
  speedPixelsPerSecond = Math.min(160, speedPixelsPerSecond + 8);
  updateLabels();
}

function slowDown(): void {
  speedPixelsPerSecond = Math.max(8, speedPixelsPerSecond - 8);
  updateLabels();
}

function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  return matches?.map((sentence) => sentence.trim()).filter(Boolean) ?? [text];
}

function appendWordSpans(parent: HTMLElement, sentence: string): void {
  const parts = sentence.split(/(\s+)/);

  for (const part of parts) {
    if (part.length === 0) {
      continue;
    }

    if (/^\s+$/.test(part)) {
      parent.append(document.createTextNode(part));
      continue;
    }

    const word = document.createElement("span");
    word.dataset.highlightKind = "word";
    word.textContent = part;
    parent.append(word);
  }
}

function renderScript(body?: string): void {
  if (!promptText || !promptViewport) {
    return;
  }

  const text = body?.trim()
    ? body
    : "No active script loaded yet. Save or open a script in the editor to send it to the overlay.";
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  promptText.textContent = "";

  for (const block of blocks) {
    const paragraph = document.createElement("p");

    for (const sentence of splitSentences(block)) {
      const sentenceElement = document.createElement("span");
      sentenceElement.dataset.highlightKind = "sentence";
      appendWordSpans(sentenceElement, sentence);
      paragraph.append(sentenceElement, " ");
    }

    promptText.append(paragraph);
  }

  promptViewport.scrollTop = 0;
  clearActiveHighlight();
  updateHighlight();

  if (state !== "idle") {
    clearCountdown();
    setState("idle");
  }
}

function handleCommand(command: string): void {
  if (command === "startPause") {
    startPause();
    return;
  }

  if (command === "restart") {
    restart();
    return;
  }

  if (command === "speedUp") {
    speedUp();
    return;
  }

  if (command === "slowDown") {
    slowDown();
  }
}

window.teleprompter.onTeleprompterCommand((event) => {
  handleCommand(event.command);
});

window.teleprompter.onScriptChanged((event) => {
  renderScript(event.activeScript?.body);
});

window.teleprompter.onSettingsChanged((event) => {
  applySettings(event.settings);
});

window.teleprompter.getScriptsState().then((state) => {
  renderScript(state.activeScript?.body);
}).catch(() => {
  renderScript();
});

window.teleprompter.getSettings().then(applySettings).catch(() => {
  updateLabels();
});

updateLabels();
