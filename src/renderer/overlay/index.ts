const countdownElement = document.querySelector<HTMLElement>("#countdown");
const promptViewport = document.querySelector<HTMLElement>("#promptViewport");
const promptText = document.querySelector<HTMLElement>("#promptText");
const progressBar = document.querySelector<HTMLElement>("#progressBar");
const progressLabel = document.querySelector<HTMLElement>("#progressLabel");
const elapsedLabel = document.querySelector<HTMLElement>("#elapsedLabel");
const remainingLabel = document.querySelector<HTMLElement>("#remainingLabel");
const speedLabel = document.querySelector<HTMLElement>("#speedLabel");
const modeLabel = document.querySelector<HTMLElement>("#modeLabel");
const feedbackLabel = document.querySelector<HTMLElement>("#feedbackLabel");
const playPauseButton = document.querySelector<HTMLButtonElement>("#playPauseButton");
const restartButton = document.querySelector<HTMLButtonElement>("#restartButton");
const speedUpButton = document.querySelector<HTMLButtonElement>("#speedUpButton");
const slowDownButton = document.querySelector<HTMLButtonElement>("#slowDownButton");
const closeOverlayButton = document.querySelector<HTMLButtonElement>("#closeOverlayButton");

type ScrollState = "idle" | "countdown" | "running" | "paused" | "completed";

let state: ScrollState = "idle";
let speedPixelsPerSecond = 21;
let scrollPositionY = 0;
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
let totalDurationSeconds = 0;
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
let voiceRecognition: {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<{ 0?: { transcript: string }; isFinal?: boolean }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
} | null = null;
let voiceRecognitionAvailable = false;
let voiceRecognitionShouldRun = false;
let scriptWords: string[] = [];
let scriptWordElements: HTMLElement[] = [];
let scriptSentences: { start: number; end: number; element: HTMLElement }[] = [];
let currentScriptWordIndex = 0;
let targetScrollTop = 0;
let lastScriptMatchAt = 0;
let scriptTrackingFeedbackShown = false;
let lastOffScriptFeedbackAt = 0;
let currentHighlightEndIndex = -1;

type HighlightLineRange = {
  start: number;
  end: number;
};

type HighlightLineCandidate = HighlightLineRange & {
  top: number;
  bottom: number;
};

function hexToRgb(hexColor: string): { red: number; green: number; blue: number } {
  const normalized = hexColor.replace("#", "");

  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function getOpaqueOverlayBackground(hexColor: string, opacity: number): string {
  const background = hexToRgb(hexColor);
  const alpha = Math.min(1, Math.max(0, opacity));

  const red = Math.round(background.red * alpha);
  const green = Math.round(background.green * alpha);
  const blue = Math.round(background.blue * alpha);

  return `rgb(${red} ${green} ${blue})`;
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
}

function formatSeconds(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getRemainingScrollSeconds(): number {
  if (speedPixelsPerSecond <= 0) {
    return 0;
  }

  const remainingScrollDistance = Math.max(0, getMaxPromptScrollTop() - getPromptScrollPosition());
  return Math.ceil(remainingScrollDistance / speedPixelsPerSecond);
}

function syncTotalDurationWithPlaybackPosition(): void {
  const elapsedSeconds = Math.floor(elapsedMilliseconds / 1000);
  totalDurationSeconds = elapsedSeconds + getRemainingScrollSeconds();
}

function updateTimerLabels(): void {
  const elapsedSeconds = Math.floor(elapsedMilliseconds / 1000);
  const remainingSeconds = Math.max(0, totalDurationSeconds - elapsedSeconds);

  if (elapsedLabel) {
    elapsedLabel.textContent = formatSeconds(elapsedSeconds);
  }

  if (remainingLabel) {
    remainingLabel.textContent = `-${formatSeconds(remainingSeconds)}`;
  }
}

function normalizeWord(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'’-]+/gu, "")
    .replace(/^[’'-]+|[’'-]+$/g, "");
}

function normalizeWords(value: string): string[] {
  const fillerWords = new Set(["um", "uh", "erm", "ah", "like"]);
  const matches = value.match(/[\p{L}\p{N}'’-]+/gu) ?? [];
  return matches
    .map(normalizeWord)
    .filter((word) => word.length > 0 && !fillerWords.has(word));
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

function getMaxPromptScrollTop(): number {
  if (!promptViewport) {
    return 0;
  }

  return Math.max(0, promptViewport.scrollHeight - promptViewport.clientHeight);
}

function getPromptScrollPosition(): number {
  return Math.min(getMaxPromptScrollTop(), Math.max(0, scrollPositionY));
}

function setPromptScrollPosition(nextScrollPositionY: number): void {
  scrollPositionY = Math.min(getMaxPromptScrollTop(), Math.max(0, nextScrollPositionY));

  if (promptText) {
    promptText.style.transform = scrollPositionY === 0
      ? ""
      : `translate3d(0, ${-scrollPositionY}px, 0)`;
  }

  if (promptViewport) {
    promptViewport.scrollTop = 0;
  }
}

function getPromptLineHeight(): number {
  if (!promptText) {
    return 0;
  }

  const computedStyle = window.getComputedStyle(promptText);
  const lineHeight = Number.parseFloat(computedStyle.lineHeight);

  if (Number.isFinite(lineHeight)) {
    return lineHeight;
  }

  const fontSize = Number.parseFloat(computedStyle.fontSize);
  return Number.isFinite(fontSize) ? fontSize * 1.5 : 0;
}

function getProgress(): number {
  if (!promptViewport) {
    return 0;
  }

  if (scrollMode === "voice" && scriptWords.length > 0 && currentScriptWordIndex > 0) {
    return Math.min(1, Math.max(0, currentScriptWordIndex / scriptWords.length));
  }

  const maxScrollTop = Math.max(1, getMaxPromptScrollTop());
  return Math.min(1, Math.max(0, getPromptScrollPosition() / maxScrollTop));
}

function updateProgress(): void {
  const progress = getProgress();

  if (progressBar) {
    progressBar.style.width = `${Math.round(progress * 100)}%`;
  }

  if (progressLabel) {
    progressLabel.textContent = `${Math.round(progress * 100)}%`;
  }

  updateTimerLabels();
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
  currentHighlightEndIndex = -1;
}

function updateHighlight(): void {
  if (!promptViewport || !promptText || highlightMode === "none") {
    clearHighlightClasses();
    return;
  }

  if (highlightMode === "sentence") {
    updateCurrentLineHighlight();
    return;
  }

  const elements = getActiveHighlightElements();

  if (elements.length === 0) {
    return;
  }

  promptText.classList.add("focus-mode");
  const nextIndex = getHighlightIndex(elements.length);

  if (nextIndex === currentHighlightIndex) {
    return;
  }

  for (let index = 0; index < elements.length; index += 1) {
    elements[index].classList.toggle("prompt-focus-past", index < nextIndex);
    elements[index].classList.toggle("prompt-focus-active", index === nextIndex);
  }

  currentHighlightIndex = nextIndex;
  currentHighlightEndIndex = nextIndex;
}

function getHighlightIndex(elementCount: number): number {
  if (scrollMode === "voice" && scriptWords.length > 0 && currentScriptWordIndex > 0) {
    if (highlightMode === "word") {
      return Math.min(elementCount - 1, currentScriptWordIndex);
    }

    const sentenceIndex = scriptSentences.findIndex((sentence) => {
      return currentScriptWordIndex >= sentence.start && currentScriptWordIndex <= sentence.end;
    });

    if (sentenceIndex >= 0) {
      return Math.min(elementCount - 1, sentenceIndex);
    }
  }

  return Math.min(elementCount - 1, Math.floor(getProgress() * elementCount));
}

function getLineDistanceFromFocus(line: HighlightLineCandidate, focusY: number): number {
  if (focusY >= line.top && focusY <= line.bottom) {
    return 0;
  }

  return Math.min(Math.abs(focusY - line.top), Math.abs(focusY - line.bottom));
}

function isBetterHighlightLine(
  candidate: HighlightLineCandidate,
  best: HighlightLineCandidate | null,
  focusY: number
): boolean {
  if (!best) {
    return true;
  }

  const candidateDistance = getLineDistanceFromFocus(candidate, focusY);
  const bestDistance = getLineDistanceFromFocus(best, focusY);

  if (candidateDistance !== bestDistance) {
    return candidateDistance < bestDistance;
  }

  const candidateCenter = candidate.top + (candidate.bottom - candidate.top) / 2;
  const bestCenter = best.top + (best.bottom - best.top) / 2;
  return Math.abs(candidateCenter - focusY) < Math.abs(bestCenter - focusY);
}

function selectBetterHighlightLine(
  candidate: HighlightLineCandidate | null,
  best: HighlightLineCandidate | null,
  focusY: number
): HighlightLineCandidate | null {
  if (!candidate) {
    return best;
  }

  return isBetterHighlightLine(candidate, best, focusY) ? candidate : best;
}

function getCurrentLineHighlightRange(): HighlightLineRange | null {
  if (!promptViewport || scriptWordElements.length === 0) {
    return null;
  }

  const viewportRect = promptViewport.getBoundingClientRect();
  const viewportStyle = window.getComputedStyle(promptViewport);
  const viewportPaddingTop = Number.parseFloat(viewportStyle.paddingTop) || 0;
  const focusOffset = Math.max(getPromptLineHeight() * 0.5, viewportPaddingTop);
  const focusY = viewportRect.top + viewportPaddingTop + focusOffset;
  const lineMergeTolerance = 2;
  let currentLine: HighlightLineCandidate | null = null;
  let bestLine: HighlightLineCandidate | null = null;

  for (let index = 0; index < scriptWordElements.length; index += 1) {
    const word = scriptWordElements[index];
    const rect = word.getBoundingClientRect();

    if (rect.height <= 0 || rect.width <= 0) {
      continue;
    }

    if (!currentLine || Math.abs(rect.top - currentLine.top) > lineMergeTolerance) {
      bestLine = selectBetterHighlightLine(currentLine, bestLine, focusY);
      currentLine = {
        start: index,
        end: index,
        top: rect.top,
        bottom: rect.bottom
      };
      continue;
    }

    currentLine.end = index;
    currentLine.top = Math.min(currentLine.top, rect.top);
    currentLine.bottom = Math.max(currentLine.bottom, rect.bottom);
  }

  bestLine = selectBetterHighlightLine(currentLine, bestLine, focusY);

  return bestLine
    ? {
      start: bestLine.start,
      end: bestLine.end
    }
    : null;
}

function updateCurrentLineHighlight(): void {
  if (!promptText) {
    return;
  }

  const activeLine = getCurrentLineHighlightRange();

  if (!activeLine) {
    clearHighlightClasses();
    return;
  }

  promptText.classList.add("focus-mode");

  if (activeLine.start === currentHighlightIndex && activeLine.end === currentHighlightEndIndex) {
    return;
  }

  clearHighlightClasses();
  promptText.classList.add("focus-mode");

  for (let index = 0; index < scriptWordElements.length; index += 1) {
    const word = scriptWordElements[index];
    word.classList.toggle("prompt-focus-past", index < activeLine.start);
    word.classList.toggle("prompt-focus-active", index >= activeLine.start && index <= activeLine.end);
  }

  currentHighlightIndex = activeLine.start;
  currentHighlightEndIndex = activeLine.end;
}

function applySettings(settings: AppSettings): void {
  const previousHighlightMode = highlightMode;
  speedPixelsPerSecond = settings.behavior.scrollSpeed;
  scrollMode = settings.behavior.scrollMode;
  countdownEnabled = settings.countdown.enabled;
  countdownSeconds = settings.countdown.seconds;
  highlightMode = settings.experimental.highlightMode;

  document.documentElement.style.setProperty(
    "--overlay-bg",
    getOpaqueOverlayBackground(settings.overlayAppearance.backgroundColor, settings.overlayAppearance.opacity)
  );
  document.documentElement.style.setProperty("--prompt-font-size", `${settings.text.fontSize}px`);
  document.documentElement.style.setProperty("--prompt-text-color", settings.text.textColor);
  document.documentElement.style.setProperty("--prompt-line-height", String(settings.text.lineHeight));
  document.documentElement.style.setProperty("--prompt-text-align", settings.text.alignment);

  setPromptScrollPosition(scrollPositionY);
  syncTotalDurationWithPlaybackPosition();
  if (highlightMode !== previousHighlightMode) {
    clearHighlightClasses();
  }
  updateControls();
  updateProgress();
  updateHighlight();
}

function stopVoiceTracking(): void {
  voiceSpeaking = false;
  voiceSupported = false;
  voiceLevel = 0;
  voiceRecognitionShouldRun = false;
  voiceRecognitionAvailable = false;

  if (voiceAnimationFrameId !== null) {
    window.cancelAnimationFrame(voiceAnimationFrameId);
    voiceAnimationFrameId = null;
  }

  if (voiceRecognition) {
    voiceRecognition.onend = null;
    voiceRecognition.onerror = null;
    voiceRecognition.onresult = null;

    try {
      voiceRecognition.stop();
    } catch {
      try {
        voiceRecognition.abort();
      } catch {
        voiceRecognition = null;
      }
    }
  }

  voiceRecognition = null;

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

function scoreScriptWindow(inputWords: string[], startIndex: number): { score: number; endIndex: number } {
  let inputIndex = 0;
  let matches = 0;
  let endIndex = startIndex;
  const windowEnd = Math.min(scriptWords.length, startIndex + inputWords.length + 8);

  for (let scriptIndex = startIndex; scriptIndex < windowEnd && inputIndex < inputWords.length; scriptIndex += 1) {
    const inputWord = inputWords[inputIndex];
    const scriptWord = scriptWords[scriptIndex];

    if (
      scriptWord === inputWord ||
      scriptWord.includes(inputWord) ||
      inputWord.includes(scriptWord)
    ) {
      matches += 1;
      inputIndex += 1;
      endIndex = scriptIndex + 1;
    }
  }

  return {
    score: matches / Math.max(1, inputWords.length),
    endIndex
  };
}

function alignTranscriptToScript(transcript: string): void {
  const inputWords = normalizeWords(transcript).slice(-18);

  if (inputWords.length < 2 || scriptWords.length === 0) {
    return;
  }

  const searchStart = Math.max(0, currentScriptWordIndex - 14);
  const searchEnd = Math.min(scriptWords.length - 1, currentScriptWordIndex + 100);
  let bestScore = 0;
  let bestEndIndex = currentScriptWordIndex;

  for (let startIndex = searchStart; startIndex <= searchEnd; startIndex += 1) {
    const result = scoreScriptWindow(inputWords, startIndex);

    if (result.score > bestScore || (result.score === bestScore && result.endIndex > bestEndIndex)) {
      bestScore = result.score;
      bestEndIndex = result.endIndex;
    }
  }

  if (bestScore < 0.44 || bestEndIndex <= currentScriptWordIndex) {
    return;
  }

  const maxAdvance = currentScriptWordIndex + 24;
  currentScriptWordIndex = Math.min(bestEndIndex, maxAdvance, scriptWords.length - 1);
  const activeWord = scriptWordElements[currentScriptWordIndex];

  if (activeWord && promptViewport && promptText) {
    const wordCenter = activeWord.offsetTop - promptViewport.clientHeight * 0.42;
    targetScrollTop = Math.max(0, wordCenter);
  }

  lastScriptMatchAt = Date.now();

  if (!scriptTrackingFeedbackShown) {
    showFeedback("Script tracking active");
    scriptTrackingFeedbackShown = true;
  }

  updateProgress();
  updateHighlight();
}

function startSpeechRecognition(): void {
  const SpeechRecognitionConstructor = (
    (window as unknown as { SpeechRecognition?: new () => typeof voiceRecognition }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => typeof voiceRecognition }).webkitSpeechRecognition
  );

  if (!SpeechRecognitionConstructor) {
    voiceRecognitionAvailable = false;
    showFeedback("Speech-to-text unavailable. Voice activity mode active.");
    return;
  }

  try {
    voiceRecognitionShouldRun = true;
    voiceRecognition = new SpeechRecognitionConstructor();

    if (!voiceRecognition) {
      return;
    }

    voiceRecognition.continuous = true;
    voiceRecognition.interimResults = true;
    voiceRecognition.lang = "en-US";
    voiceRecognition.onresult = (event) => {
      let transcript = "";

      for (let index = 0; index < event.results.length; index += 1) {
        transcript += ` ${event.results[index][0]?.transcript ?? ""}`;
      }

      alignTranscriptToScript(transcript);
    };
    voiceRecognition.onerror = () => {
      voiceRecognitionAvailable = false;
    };
    voiceRecognition.onend = () => {
      if (voiceRecognitionShouldRun && scrollMode === "voice" && state === "running") {
        window.setTimeout(() => {
          try {
            voiceRecognition?.start();
            voiceRecognitionAvailable = true;
          } catch {
            voiceRecognitionAvailable = false;
          }
        }, 250);
      }
    };
    voiceRecognition.start();
    voiceRecognitionAvailable = true;
  } catch {
    voiceRecognitionAvailable = false;
    showFeedback("Speech-to-text unavailable. Voice activity mode active.");
  }
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
  } else if (!wasSpeaking && voiceSpeaking && !voiceRecognitionAvailable) {
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
    lastScriptMatchAt = 0;
    scriptTrackingFeedbackShown = false;
    showFeedback("Listening for speech");
    startSpeechRecognition();
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

  const hasRecentScriptMatch = voiceRecognitionAvailable && Date.now() - lastScriptMatchAt < 1800;

  if (scrollMode !== "voice" || !voiceSupported) {
    setPromptScrollPosition(scrollPositionY + speedPixelsPerSecond * deltaSeconds);
    elapsedMilliseconds += deltaSeconds * 1000;
  } else if (voiceRecognitionAvailable) {
    if (hasRecentScriptMatch) {
      const distance = targetScrollTop - getPromptScrollPosition();
      const maxStep = Math.max(speedPixelsPerSecond * deltaSeconds * 2.4, 2);
      const step = Math.max(-maxStep, Math.min(maxStep, distance * 0.14));
      setPromptScrollPosition(scrollPositionY + step);
      elapsedMilliseconds += deltaSeconds * 1000;
    } else if (voiceSpeaking && Date.now() - lastOffScriptFeedbackAt > 1800) {
      lastOffScriptFeedbackAt = Date.now();
      showFeedback("Paused until script resumes");
    }
  } else if (voiceSpeaking) {
    setPromptScrollPosition(scrollPositionY + speedPixelsPerSecond * deltaSeconds);
    elapsedMilliseconds += deltaSeconds * 1000;
  }

  updateProgress();
  updateHighlight();
  updateControls();

  const maxScrollTop = getMaxPromptScrollTop();

  if (getPromptScrollPosition() >= maxScrollTop) {
    setPromptScrollPosition(maxScrollTop);
    syncTotalDurationWithPlaybackPosition();
    updateProgress();
    updateHighlight();
    stopVoiceTracking();
    setState("completed");
    animationFrameId = null;
    return;
  }

  animationFrameId = window.requestAnimationFrame(scrollFrame);
}

function stopAnimation(): void {
  if (animationFrameId !== null) {
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  lastFrameTime = 0;
}

function startAnimation(): void {
  stopAnimation();
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
  stopAnimation();
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
  stopAnimation();

  if (promptViewport) {
    setPromptScrollPosition(0);
    elapsedMilliseconds = 0;
    currentScriptWordIndex = 0;
    targetScrollTop = 0;
    lastScriptMatchAt = 0;
    lastOffScriptFeedbackAt = 0;
    syncTotalDurationWithPlaybackPosition();
    updateProgress();
    updateHighlight();
  }

  startCountdown();
}

function speedUp(): void {
  speedPixelsPerSecond = Math.min(160, speedPixelsPerSecond + 8);
  syncTotalDurationWithPlaybackPosition();
  showFeedback(`Speed ${speedPixelsPerSecond} px/s`);
  updateControls();
  updateProgress();
}

function slowDown(): void {
  speedPixelsPerSecond = Math.max(8, speedPixelsPerSecond - 8);
  syncTotalDurationWithPlaybackPosition();
  showFeedback(`Speed ${speedPixelsPerSecond} px/s`);
  updateControls();
  updateProgress();
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
    const normalizedWord = normalizeWord(part);
    word.dataset.highlightKind = "word";
    word.dataset.wordIndex = String(scriptWords.length);
    word.textContent = part;
    scriptWords.push(normalizedWord);
    scriptWordElements.push(word);
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
  scriptWords = [];
  scriptWordElements = [];
  scriptSentences = [];
  currentScriptWordIndex = 0;
  targetScrollTop = 0;
  lastScriptMatchAt = 0;

  for (const block of blocks) {
    const paragraph = document.createElement("p");

    for (const sentence of splitSentences(block)) {
      const sentenceElement = document.createElement("span");
      const sentenceStart = scriptWords.length;
      sentenceElement.dataset.highlightKind = "sentence";
      appendWordSpans(sentenceElement, sentence);
      scriptSentences.push({
        start: sentenceStart,
        end: Math.max(sentenceStart, scriptWords.length - 1),
        element: sentenceElement
      });
      paragraph.append(sentenceElement, " ");
    }

    promptText.append(paragraph);
  }

  setPromptScrollPosition(0);
  elapsedMilliseconds = 0;
  syncTotalDurationWithPlaybackPosition();
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

type OverlayTooltip = {
  element: HTMLButtonElement | null;
  label: string;
  shortcut?: string;
  ariaShortcut?: string;
};

const overlayTooltips: OverlayTooltip[] = [
  {
    element: slowDownButton,
    label: "Slower",
    shortcut: "\u2190",
    ariaShortcut: "Left Arrow"
  },
  {
    element: playPauseButton,
    label: "Play/Pause",
    shortcut: "Space"
  },
  {
    element: restartButton,
    label: "Restart",
    shortcut: "R"
  },
  {
    element: speedUpButton,
    label: "Faster",
    shortcut: "\u2192",
    ariaShortcut: "Right Arrow"
  },
  {
    element: closeOverlayButton,
    label: "Exit overlay",
    shortcut: "Esc"
  }
];

function buildTooltipText(tooltip: OverlayTooltip): string {
  return tooltip.shortcut ? `${tooltip.label} (${tooltip.shortcut})` : tooltip.label;
}

function buildTooltipAriaLabel(tooltip: OverlayTooltip): string {
  return tooltip.ariaShortcut ? `${tooltip.label} (${tooltip.ariaShortcut})` : buildTooltipText(tooltip);
}

function applyOverlayTooltips(): void {
  for (const tooltip of overlayTooltips) {
    if (!tooltip.element) {
      continue;
    }

    const tooltipText = buildTooltipText(tooltip);
    tooltip.element.dataset.tooltip = tooltipText;
    tooltip.element.setAttribute("aria-label", buildTooltipAriaLabel(tooltip));
  }
}

const teleprompterApi = window.teleprompter;

applyOverlayTooltips();

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

  if (event.key === "ArrowRight") {
    event.preventDefault();
    speedUp();
    return;
  }

  if (event.key === "ArrowLeft") {
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
    void teleprompterApi?.closeOverlay();
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
