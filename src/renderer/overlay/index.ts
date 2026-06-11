const countdownElement = document.querySelector<HTMLElement>("#countdown");
const promptViewport = document.querySelector<HTMLElement>("#promptViewport");
const promptText = document.querySelector<HTMLElement>("#promptText");
const progressBar = document.querySelector<HTMLElement>("#progressBar");
const progressLabel = document.querySelector<HTMLElement>("#progressLabel");
const hideOverlayButton = document.querySelector<HTMLButtonElement>("#hideOverlayButton");
const playPauseButton = document.querySelector<HTMLButtonElement>("#playPauseButton");
const restartButton = document.querySelector<HTMLButtonElement>("#restartButton");
const speedUpButton = document.querySelector<HTMLButtonElement>("#speedUpButton");
const slowDownButton = document.querySelector<HTMLButtonElement>("#slowDownButton");
const closeOverlayButton = document.querySelector<HTMLButtonElement>("#closeOverlayButton");

type ScrollState = "idle" | "countdown" | "running" | "paused" | "completed";

let state: ScrollState = "idle";
let speedPixelsPerSecond = 36;
let lastFrameTime = 0;
let animationFrameId: number | null = null;
let countdownTimerId: number | null = null;
let countdownRemaining = 0;
let countdownEnabled = true;
let countdownSeconds = 3;
let highlightMode: AppSettings["experimental"]["highlightMode"] = "sentence";
let currentHighlightIndex = -1;

function hexToRgb(hexColor: string): { red: number; green: number; blue: number } {
  const normalized = hexColor.replace("#", "");

  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function updateControls(): void {
  if (playPauseButton) {
    playPauseButton.textContent = state === "running" || state === "countdown" ? "Pause" : "Play";
  }
}

function setState(nextState: ScrollState): void {
  state = nextState;
  updateControls();
}

function getProgress(): number {
  if (!promptViewport) {
    return 0;
  }

  const maxScrollTop = Math.max(1, promptViewport.scrollHeight - promptViewport.clientHeight);
  return Math.min(1, Math.max(0, promptViewport.scrollTop / maxScrollTop));
}

function updateProgress(): void {
  const progress = getProgress();

  if (progressBar) {
    progressBar.style.width = `${Math.round(progress * 100)}%`;
  }

  if (progressLabel) {
    progressLabel.textContent = `${Math.round(progress * 100)}%`;
  }
}

function getActiveHighlightElements(): HTMLElement[] {
  if (!promptText || highlightMode === "none") {
    return [];
  }

  return Array.from(promptText.querySelectorAll<HTMLElement>(`[data-highlight-kind="${highlightMode}"]`));
}

function clearHighlightClasses(): void {
  if (!promptText) {
    return;
  }

  for (const element of Array.from(promptText.querySelectorAll(".prompt-focus-active, .prompt-focus-past"))) {
    element.classList.remove("prompt-focus-active", "prompt-focus-past");
  }

  promptText.classList.remove("focus-mode");
  currentHighlightIndex = -1;
}

function updateHighlight(): void {
  if (!promptViewport || !promptText || highlightMode === "none") {
    clearHighlightClasses();
    return;
  }

  const elements = getActiveHighlightElements();

  if (elements.length === 0) {
    return;
  }

  promptText.classList.add("focus-mode");
  const nextIndex = Math.min(elements.length - 1, Math.floor(getProgress() * elements.length));

  if (nextIndex === currentHighlightIndex) {
    return;
  }

  for (let index = 0; index < elements.length; index += 1) {
    elements[index].classList.toggle("prompt-focus-past", index < nextIndex);
    elements[index].classList.toggle("prompt-focus-active", index === nextIndex);
  }

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

  updateControls();
  updateProgress();
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
  updateProgress();
  updateHighlight();

  const maxScrollTop = promptViewport.scrollHeight - promptViewport.clientHeight;

  if (promptViewport.scrollTop >= maxScrollTop) {
    promptViewport.scrollTop = maxScrollTop;
    updateProgress();
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
    updateProgress();
    updateHighlight();
  }

  startCountdown();
}

function speedUp(): void {
  speedPixelsPerSecond = Math.min(160, speedPixelsPerSecond + 8);
}

function slowDown(): void {
  speedPixelsPerSecond = Math.max(8, speedPixelsPerSecond - 8);
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
  clearHighlightClasses();
  updateProgress();
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

const teleprompterApi = window.teleprompter;

hideOverlayButton?.addEventListener("click", () => {
  void teleprompterApi?.hideOverlay();
});

playPauseButton?.addEventListener("click", startPause);
restartButton?.addEventListener("click", restart);
speedUpButton?.addEventListener("click", speedUp);
slowDownButton?.addEventListener("click", slowDown);

closeOverlayButton?.addEventListener("click", () => {
  void teleprompterApi?.closeOverlay();
});

if (teleprompterApi) {
  teleprompterApi.onTeleprompterCommand((event) => {
    handleCommand(event.command);
  });

  teleprompterApi.onScriptChanged((event) => {
    renderScript(event.activeScript?.body);
  });

  teleprompterApi.onSettingsChanged((event) => {
    applySettings(event.settings);
  });

  teleprompterApi.getScriptsState().then((scriptState) => {
    renderScript(scriptState.activeScript?.body);
  }).catch(() => {
    renderScript();
  });

  teleprompterApi.getSettings().then(applySettings).catch(() => {
    updateControls();
  });
} else {
  renderScript();
  updateControls();
}

updateControls();
updateProgress();
