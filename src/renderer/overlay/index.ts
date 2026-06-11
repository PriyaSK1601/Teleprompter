const countdownElement = document.querySelector<HTMLElement>("#countdown");
const promptViewport = document.querySelector<HTMLElement>("#promptViewport");
const promptText = document.querySelector<HTMLElement>("#promptText");
const progressBar = document.querySelector<HTMLElement>("#progressBar");
const progressLabel = document.querySelector<HTMLElement>("#progressLabel");
const elapsedLabel = document.querySelector<HTMLElement>("#elapsedLabel");
const speedLabel = document.querySelector<HTMLElement>("#speedLabel");
const modeLabel = document.querySelector<HTMLElement>("#modeLabel");
const feedbackLabel = document.querySelector<HTMLElement>("#feedbackLabel");
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
let scrollMode: AppSettings["behavior"]["scrollMode"] = "manual";
let currentHighlightIndex = -1;
let elapsedMilliseconds = 0;
let feedbackTimerId: number | null = null;
let voiceAudioContext: AudioContext | null = null;
let voiceAnalyser: AnalyserNode | null = null;
let voiceMediaStream: MediaStream | null = null;
let voiceAnimationFrameId: number | null = null;
let voiceSupported = false;
let voiceSpeaking = false;
let voiceLevel = 0;
let voiceNoiseFloor = 0.018;
let voiceLastSpokeAt = 0;
let voiceStartedAt = 0;

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

  if (speedLabel) {
    speedLabel.textContent = `${speedPixelsPerSecond} px/s`;
  }

  if (modeLabel) {
    modeLabel.textContent = scrollMode === "voice" ? "Voice Tracking" : "Manual";
  }

  if (elapsedLabel) {
    elapsedLabel.textContent = formatElapsed(elapsedMilliseconds);
  }
}

function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function showFeedback(message: string): void {
  if (!feedbackLabel) {
    return;
  }

  feedbackLabel.textContent = message;

  if (feedbackTimerId !== null) {
    window.clearTimeout(feedbackTimerId);
  }

  feedbackTimerId = window.setTimeout(() => {
    feedbackLabel.textContent = "";
    feedbackTimerId = null;
  }, 1400);
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
  scrollMode = settings.behavior.scrollMode;
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

function stopVoiceTracking(): void {
  voiceSpeaking = false;
  voiceSupported = false;
  voiceLevel = 0;

  if (voiceAnimationFrameId !== null) {
    window.cancelAnimationFrame(voiceAnimationFrameId);
    voiceAnimationFrameId = null;
  }

  if (voiceMediaStream) {
    for (const track of voiceMediaStream.getTracks()) {
      track.stop();
    }
  }

  voiceMediaStream = null;
  voiceAnalyser = null;

  if (voiceAudioContext) {
    void voiceAudioContext.close();
  }

  voiceAudioContext = null;
}

function measureVoiceLevel(data: Uint8Array): number {
  let sum = 0;

  for (const sample of data) {
    const normalized = (sample - 128) / 128;
    sum += normalized * normalized;
  }

  return Math.sqrt(sum / data.length);
}

function updateVoiceTracking(): void {
  if (!voiceAnalyser || scrollMode !== "voice" || state !== "running") {
    voiceAnimationFrameId = null;
    return;
  }

  const data = new Uint8Array(voiceAnalyser.fftSize);
  voiceAnalyser.getByteTimeDomainData(data);
  voiceLevel = measureVoiceLevel(data);

  if (Date.now() - voiceStartedAt < 1200) {
    voiceNoiseFloor = voiceNoiseFloor * 0.92 + voiceLevel * 0.08;
  }

  const speechThreshold = Math.max(0.026, voiceNoiseFloor * 2.2);
  const speakingNow = voiceLevel > speechThreshold;

  if (speakingNow) {
    voiceLastSpokeAt = Date.now();
    const levelBoost = Math.min(56, Math.round((voiceLevel - speechThreshold) * 900));
    const targetSpeed = Math.max(18, Math.min(150, 28 + levelBoost));
    speedPixelsPerSecond = Math.round(speedPixelsPerSecond * 0.84 + targetSpeed * 0.16);
  }

  const wasSpeaking = voiceSpeaking;
  voiceSpeaking = Date.now() - voiceLastSpokeAt < 900;

  if (wasSpeaking && !voiceSpeaking) {
    showFeedback("Paused until speech resumes");
  } else if (!wasSpeaking && voiceSpeaking) {
    showFeedback("Speech detected");
  }

  updateControls();
  voiceAnimationFrameId = window.requestAnimationFrame(updateVoiceTracking);
}

async function startVoiceTracking(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") {
    scrollMode = "manual";
    showFeedback("Microphone tracking unavailable. Manual mode active.");
    updateControls();
    return false;
  }

  try {
    stopVoiceTracking();
    voiceMediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    voiceAudioContext = new AudioContext();
    const source = voiceAudioContext.createMediaStreamSource(voiceMediaStream);
    voiceAnalyser = voiceAudioContext.createAnalyser();
    voiceAnalyser.fftSize = 1024;
    voiceAnalyser.smoothingTimeConstant = 0.35;
    source.connect(voiceAnalyser);
    voiceSupported = true;
    voiceSpeaking = false;
    voiceStartedAt = Date.now();
    voiceLastSpokeAt = 0;
    voiceNoiseFloor = 0.018;
    showFeedback("Listening for speech");
    voiceAnimationFrameId = window.requestAnimationFrame(updateVoiceTracking);
    return true;
  } catch {
    scrollMode = "manual";
    showFeedback("Microphone unavailable. Manual mode active.");
    updateControls();
    return false;
  }
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

  if (scrollMode !== "voice" || voiceSpeaking || !voiceSupported) {
    promptViewport.scrollTop += speedPixelsPerSecond * deltaSeconds;
    elapsedMilliseconds += deltaSeconds * 1000;
  }

  updateProgress();
  updateHighlight();
  updateControls();

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
  if (scrollMode === "voice") {
    void startVoiceTracking();
  } else {
    stopVoiceTracking();
  }
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
  stopVoiceTracking();
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
    elapsedMilliseconds = 0;
    updateProgress();
    updateHighlight();
  }

  startCountdown();
}

function speedUp(): void {
  speedPixelsPerSecond = Math.min(160, speedPixelsPerSecond + 8);
  showFeedback(`Speed ${speedPixelsPerSecond} px/s`);
  updateControls();
}

function slowDown(): void {
  speedPixelsPerSecond = Math.max(8, speedPixelsPerSecond - 8);
  showFeedback(`Speed ${speedPixelsPerSecond} px/s`);
  updateControls();
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

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
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

window.addEventListener("keydown", (event) => {
  if (isTypingTarget(event.target)) {
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    speedUp();
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    slowDown();
    return;
  }

  if (event.key === " ") {
    event.preventDefault();
    startPause();
    return;
  }

  if (event.key.toLowerCase() === "r") {
    event.preventDefault();
    restart();
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    void teleprompterApi?.hideOverlay();
  }
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
