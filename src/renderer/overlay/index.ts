const countdownElement = document.querySelector<HTMLElement>("#countdown");
const promptViewport = document.querySelector<HTMLElement>("#promptViewport");
const promptText = document.querySelector<HTMLElement>("#promptText");
const progressBar = document.querySelector<HTMLElement>("#progressBar");
const progressLabel = document.querySelector<HTMLElement>("#progressLabel");
const elapsedLabel = document.querySelector<HTMLElement>("#elapsedLabel");
const remainingLabel = document.querySelector<HTMLElement>("#remainingLabel");
const speedLabel = document.querySelector<HTMLElement>("#speedLabel");
const modeSelect = document.querySelector<HTMLSelectElement>("#modeSelect");
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
let activeSentenceIndex = -1;
let targetScrollTop = 0;
let lastScriptMatchAt = 0;
let scriptTrackingFeedbackShown = false;
let lastOffScriptFeedbackAt = 0;
let currentHighlightEndIndex = -1;
let endHoldElapsedMilliseconds = 0;
let closeFeedbackTimerId: number | null = null;
let currentScriptBody: string | undefined;
let relayoutTimerId: number | null = null;
let enabledShortcutActions = new Set<TeleprompterCommand>();

const endHoldDurationMilliseconds = 500;
const closeFeedbackDelayMilliseconds = 120;

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

function getOverlayBackground(hexColor: string, opacity: number): string {
  const background = hexToRgb(hexColor);
  const alpha = Math.min(1, Math.max(0, opacity));

  return `rgb(${background.red} ${background.green} ${background.blue} / ${alpha})`;
}

function updateControls(): void {
  if (playPauseButton) {
    const isPlaying = state === "running" || state === "countdown";
    playPauseButton.classList.toggle("is-showing-pause", isPlaying);
    playPauseButton.classList.toggle("is-showing-play", !isPlaying);
  }

  if (speedLabel) {
    speedLabel.textContent = `${speedPixelsPerSecond} px/s`;
  }

  if (modeSelect) {
    modeSelect.value = scrollMode;
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
  const remainingSeconds = remainingScrollDistance / speedPixelsPerSecond;
  return remainingSeconds <= 0 ? 0 : Math.ceil(remainingSeconds);
}

function updateTimerLabels(): void {
  const elapsedSeconds = Math.floor(elapsedMilliseconds / 1000);
  const remainingSeconds = getRemainingScrollSeconds();

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

function flashSpeedLabel(): void {
  if (!speedLabel) {
    return;
  }

  speedLabel.classList.remove("is-speed-feedback");
  void speedLabel.offsetWidth;
  speedLabel.classList.add("is-speed-feedback");
}

function flashControl(button: HTMLButtonElement | null): void {
  if (!button) {
    return;
  }

  button.classList.remove("is-control-feedback");
  void button.offsetWidth;
  button.classList.add("is-control-feedback");
}

function setState(nextState: ScrollState): void {
  state = nextState;
  updateControls();
}

function getNaturalPromptScrollTop(): number {
  if (!promptViewport) {
    return 0;
  }

  return Math.max(0, promptViewport.scrollHeight - promptViewport.clientHeight);
}

function getLineCenteredScrollTop(lineElement: HTMLElement): number {
  return lineElement.offsetTop + lineElement.offsetHeight / 2 - getViewportReadingFocusOffset();
}

function getMinPromptScrollTop(): number {
  return 0;
}

function getViewportReadingFocusOffset(): number {
  if (!promptViewport) {
    return 0;
  }

  const viewportStyle = window.getComputedStyle(promptViewport);
  const paddingTop = Number.parseFloat(viewportStyle.paddingTop) || 0;
  const firstLineHeight = scriptSentences[0]?.element.offsetHeight ?? getPromptLineHeight();
  return paddingTop + firstLineHeight / 2;
}

function getContentLineCandidates(): HighlightLineCandidate[] {
  if (!promptViewport || scriptWordElements.length === 0) {
    return [];
  }

  const viewportRect = promptViewport.getBoundingClientRect();
  const currentScrollPosition = Math.max(0, scrollPositionY);
  const lineMergeTolerance = 2;
  const lines: HighlightLineCandidate[] = [];
  let currentLine: HighlightLineCandidate | null = null;

  for (let index = 0; index < scriptWordElements.length; index += 1) {
    const word = scriptWordElements[index];
    const rect = word.getBoundingClientRect();

    if (rect.height <= 0 || rect.width <= 0) {
      continue;
    }

    const top = rect.top - viewportRect.top + currentScrollPosition;
    const bottom = rect.bottom - viewportRect.top + currentScrollPosition;

    if (!currentLine || Math.abs(top - currentLine.top) > lineMergeTolerance) {
      if (currentLine) {
        lines.push(currentLine);
      }

      currentLine = {
        start: index,
        end: index,
        top,
        bottom
      };
      continue;
    }

    currentLine.end = index;
    currentLine.top = Math.min(currentLine.top, top);
    currentLine.bottom = Math.max(currentLine.bottom, bottom);
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function getFinalHighlightScrollTop(): number {
  const finalSentence = scriptSentences[scriptSentences.length - 1];

  if (finalSentence) {
    return getLineCenteredScrollTop(finalSentence.element);
  }

  const lines = getContentLineCandidates();
  const finalLine = lines[lines.length - 1];

  if (!finalLine) {
    return 0;
  }

  const finalLineCenter = finalLine.top + (finalLine.bottom - finalLine.top) / 2;
  return Math.max(0, finalLineCenter - getViewportReadingFocusOffset());
}

function getMaxPromptScrollTop(): number {
  const minScrollTop = getMinPromptScrollTop();
  return Math.max(minScrollTop, getFinalHighlightScrollTop());
}

function getPromptScrollPosition(): number {
  const minScrollTop = getMinPromptScrollTop();
  const maxScrollTop = getMaxPromptScrollTop();
  return Math.min(maxScrollTop, Math.max(minScrollTop, scrollPositionY));
}

function setPromptScrollPosition(nextScrollPositionY: number): void {
  const minScrollTop = getMinPromptScrollTop();
  const maxScrollTop = getMaxPromptScrollTop();
  scrollPositionY = Math.min(maxScrollTop, Math.max(minScrollTop, nextScrollPositionY));

  if (promptText) {
    promptText.style.transform = Math.abs(scrollPositionY) < 0.5
      ? ""
      : `translate3d(0, ${-scrollPositionY}px, 0)`;
  }

  if (promptViewport) {
    promptViewport.scrollTop = 0;
  }
}

function advancePromptScroll(deltaPixels: number): number {
  const previousScrollPosition = getPromptScrollPosition();
  setPromptScrollPosition(previousScrollPosition + deltaPixels);
  return getPromptScrollPosition() - previousScrollPosition;
}

function addElapsedForScrollDistance(scrollDistance: number, pixelsPerSecond = speedPixelsPerSecond): void {
  if (pixelsPerSecond <= 0 || scrollDistance <= 0) {
    return;
  }

  elapsedMilliseconds += (scrollDistance / pixelsPerSecond) * 1000;
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

  const minScrollTop = getMinPromptScrollTop();
  const maxScrollTop = getMaxPromptScrollTop();
  const scrollRange = Math.max(1, maxScrollTop - minScrollTop);
  return Math.min(1, Math.max(0, (getPromptScrollPosition() - minScrollTop) / scrollRange));
}

function updateProgress(): void {
  const progress = getProgress();
  const progressPercent = progress >= 1 ? 100 : Math.floor(progress * 100);

  if (progressBar) {
    progressBar.style.width = `${progress * 100}%`;
  }

  if (progressLabel) {
    progressLabel.textContent = `${progressPercent}%`;
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

  for (const element of Array.from(
    promptText.querySelectorAll(".prompt-focus-active, .prompt-focus-past, .active, .is-past, .is-upcoming")
  )) {
    element.classList.remove("prompt-focus-active", "prompt-focus-past", "active", "is-past", "is-upcoming");
  }

  promptText.classList.remove("focus-mode", "lyrics-mode", "word-focus-mode");
  currentHighlightIndex = -1;
  currentHighlightEndIndex = -1;
  activeSentenceIndex = -1;
}

function updateHighlight(): void {
  if (!promptViewport || !promptText || highlightMode === "none") {
    clearHighlightClasses();
    return;
  }

  if (highlightMode === "sentence") {
    updateActiveSentenceHighlight();
    return;
  }

  const elements = getActiveHighlightElements();

  if (elements.length === 0) {
    return;
  }

  promptText.classList.add("focus-mode");
  promptText.classList.add("word-focus-mode");
  promptText.classList.remove("lyrics-mode");
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

function getActiveSentenceIndexFromVoice(): number | null {
  if (scrollMode !== "voice" || scriptWords.length === 0 || currentScriptWordIndex <= 0) {
    return null;
  }

  const sentenceIndex = scriptSentences.findIndex((sentence) => {
    return currentScriptWordIndex >= sentence.start && currentScriptWordIndex <= sentence.end;
  });

  return sentenceIndex >= 0 ? sentenceIndex : null;
}

function getActiveSentenceIndexFromFocus(): number {
  if (!promptViewport || scriptSentences.length === 0) {
    return -1;
  }

  const viewportRect = promptViewport.getBoundingClientRect();
  const focusY = viewportRect.top + getViewportReadingFocusOffset();
  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < scriptSentences.length; index += 1) {
    const rect = scriptSentences[index].element.getBoundingClientRect();
    const sentenceCenter = rect.top + rect.height / 2;
    const distance = Math.abs(sentenceCenter - focusY);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  }

  return closestIndex;
}

function updateActiveSentenceHighlight(): void {
  if (!promptText || scriptSentences.length === 0) {
    clearHighlightClasses();
    return;
  }

  const voiceSentenceIndex = getActiveSentenceIndexFromVoice();
  const nextIndex = voiceSentenceIndex ?? getActiveSentenceIndexFromFocus();

  if (nextIndex < 0) {
    return;
  }

  promptText.classList.add("focus-mode", "lyrics-mode");
  promptText.classList.remove("word-focus-mode");

  if (nextIndex === activeSentenceIndex) {
    return;
  }

  endHoldElapsedMilliseconds = 0;

  for (let index = 0; index < scriptSentences.length; index += 1) {
    const sentenceElement = scriptSentences[index].element;
    sentenceElement.classList.toggle("active", index === nextIndex);
    sentenceElement.classList.toggle("is-past", index < nextIndex);
    sentenceElement.classList.toggle("is-upcoming", index > nextIndex);
  }

  activeSentenceIndex = nextIndex;
  currentHighlightIndex = scriptSentences[nextIndex].start;
  currentHighlightEndIndex = scriptSentences[nextIndex].end;
}

function getFinalLineHoldDurationMilliseconds(): number {
  const finalLine = scriptSentences[scriptSentences.length - 1];

  if (!finalLine) {
    return endHoldDurationMilliseconds;
  }

  const wordCount = Math.max(1, finalLine.end - finalLine.start + 1);
  const secondsPerWord = 60 / 150;
  const durationMilliseconds = wordCount * secondsPerWord * 1000;
  return Math.max(1400, Math.min(5200, durationMilliseconds));
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

function toHighlightLineRange(line: HighlightLineCandidate): HighlightLineRange {
  return {
    start: line.start,
    end: line.end
  };
}

function getHighlightLineCandidates(): HighlightLineCandidate[] {
  const lineMergeTolerance = 2;
  const lines: HighlightLineCandidate[] = [];
  let currentLine: HighlightLineCandidate | null = null;

  for (let index = 0; index < scriptWordElements.length; index += 1) {
    const word = scriptWordElements[index];
    const rect = word.getBoundingClientRect();

    if (rect.height <= 0 || rect.width <= 0) {
      continue;
    }

    if (!currentLine || Math.abs(rect.top - currentLine.top) > lineMergeTolerance) {
      if (currentLine) {
        lines.push(currentLine);
      }

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

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function getCurrentLineHighlightRange(): HighlightLineRange | null {
  if (!promptViewport || scriptWordElements.length === 0) {
    return null;
  }

  const lineCandidates = getHighlightLineCandidates();

  if (lineCandidates.length === 0) {
    return null;
  }

  const scrollPosition = getPromptScrollPosition();
  const scrollBoundaryTolerance = 1;

  if (scrollPosition <= scrollBoundaryTolerance) {
    return toHighlightLineRange(lineCandidates[0]);
  }

  const viewportRect = promptViewport.getBoundingClientRect();
  const focusY = viewportRect.top + getViewportReadingFocusOffset();
  let bestLine: HighlightLineCandidate | null = null;

  for (const lineCandidate of lineCandidates) {
    bestLine = selectBetterHighlightLine(lineCandidate, bestLine, focusY);
  }

  return bestLine ? toHighlightLineRange(bestLine) : null;
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
    getOverlayBackground(settings.overlayAppearance.backgroundColor, settings.overlayAppearance.opacity)
  );
  document.documentElement.style.setProperty("--prompt-font-size", `${settings.text.fontSize}px`);
  document.documentElement.style.setProperty("--prompt-text-color", settings.text.textColor);
  document.documentElement.style.setProperty("--prompt-line-height", String(settings.text.lineHeight));
  document.documentElement.style.setProperty("--prompt-text-align", settings.text.alignment);

  setPromptScrollPosition(scrollPositionY);
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
    const voiceSentenceIndex = getActiveSentenceIndexFromVoice();
    const sentenceElement = voiceSentenceIndex === null ? undefined : scriptSentences[voiceSentenceIndex]?.element;
    const targetElement = sentenceElement ?? activeWord;
    const targetCenter = targetElement.offsetTop + targetElement.offsetHeight / 2 - getViewportReadingFocusOffset();
    targetScrollTop = Math.max(0, targetCenter);
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
    const scrolledDistance = advancePromptScroll(speedPixelsPerSecond * deltaSeconds);
    addElapsedForScrollDistance(scrolledDistance);
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
    const scrolledDistance = advancePromptScroll(speedPixelsPerSecond * deltaSeconds);
    addElapsedForScrollDistance(scrolledDistance);
  }

  updateProgress();
  updateHighlight();
  updateControls();

  const maxScrollTop = getMaxPromptScrollTop();
  const isAtEnd = maxScrollTop <= 0 || getPromptScrollPosition() >= maxScrollTop - 0.5;

  if (isAtEnd) {
    setPromptScrollPosition(maxScrollTop);
    updateProgress();
    updateHighlight();
    updateActiveSentenceHighlight();
    const finalLineIndex = scriptSentences.length - 1;
    const finalLineIsActive = finalLineIndex < 0 || activeSentenceIndex === finalLineIndex;

    if (finalLineIsActive) {
      endHoldElapsedMilliseconds += deltaSeconds * 1000;
    } else {
      endHoldElapsedMilliseconds = 0;
    }

    if (finalLineIsActive && endHoldElapsedMilliseconds >= getFinalLineHoldDurationMilliseconds()) {
      stopVoiceTracking();
      setState("completed");
      animationFrameId = null;
      return;
    }

    animationFrameId = window.requestAnimationFrame(scrollFrame);
    return;
  }

  endHoldElapsedMilliseconds = 0;
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
  flashControl(playPauseButton);

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
  flashControl(restartButton);
  clearCountdown();
  stopAnimation();

  if (promptViewport) {
    setPromptScrollPosition(getMinPromptScrollTop());
    elapsedMilliseconds = 0;
    endHoldElapsedMilliseconds = 0;
    currentScriptWordIndex = 0;
    activeSentenceIndex = -1;
    targetScrollTop = 0;
    lastScriptMatchAt = 0;
    lastOffScriptFeedbackAt = 0;
    updateProgress();
    updateHighlight();
  }

  startCountdown();
}

function speedUp(): void {
  flashControl(speedUpButton);
  speedPixelsPerSecond = Math.min(160, speedPixelsPerSecond + 8);
  updateControls();
  flashSpeedLabel();
  updateProgress();
}

function slowDown(): void {
  flashControl(slowDownButton);
  speedPixelsPerSecond = Math.max(8, speedPixelsPerSecond - 8);
  updateControls();
  flashSpeedLabel();
  updateProgress();
}

function closeOverlayWithFeedback(): void {
  flashControl(closeOverlayButton);

  if (closeFeedbackTimerId !== null) {
    window.clearTimeout(closeFeedbackTimerId);
  }

  closeFeedbackTimerId = window.setTimeout(() => {
    closeFeedbackTimerId = null;
    void teleprompterApi?.closeOverlay();
  }, closeFeedbackDelayMilliseconds);
}

function setScrollMode(nextScrollMode: AppSettings["behavior"]["scrollMode"]): void {
  if (nextScrollMode === scrollMode) {
    return;
  }

  scrollMode = nextScrollMode;
  updateControls();
  showFeedback(nextScrollMode === "voice" ? "Voice tracking on" : "Manual mode");

  if (state === "running") {
    if (nextScrollMode === "voice") {
      void startVoiceTracking();
    } else {
      stopVoiceTracking();
    }
  }

  void teleprompterApi?.updateSettings({
    behavior: {
      scrollMode: nextScrollMode
    }
  });
}

function measureReadableLines(text: string): string[] {
  if (!promptText) {
    return [text];
  }

  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [text];
  }

  const measurement = document.createElement("p");
  measurement.className = "prompt-line prompt-line-measure";
  const wordElements = words.map((wordText) => {
    const word = document.createElement("span");
    word.textContent = wordText;
    measurement.append(word, " ");
    return word;
  });
  promptText.append(measurement);

  const lines: string[] = [];
  let currentTop: number | null = null;
  let currentWords: string[] = [];

  for (let index = 0; index < wordElements.length; index += 1) {
    const top = wordElements[index].offsetTop;

    if (currentTop !== null && Math.abs(top - currentTop) > 2) {
      lines.push(currentWords.join(" "));
      currentWords = [];
    }

    currentTop = top;
    currentWords.push(words[index]);
  }

  if (currentWords.length > 0) {
    lines.push(currentWords.join(" "));
  }

  measurement.remove();
  return lines;
}

function appendWordSpans(parent: HTMLElement, line: string): void {
  const parts = line.split(/(\s+)/);

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

function renderScript(body?: string, preservePlayback = false): void {
  if (!promptText || !promptViewport) {
    return;
  }

  const previousProgress = preservePlayback ? getProgress() : 0;
  const previousWordIndex = currentScriptWordIndex;
  currentScriptBody = body;
  const text = body?.trim()
    ? body
    : "No active script loaded yet. Save or open a script in the editor to send it to the overlay.";
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const measuredBlocks = blocks.map(measureReadableLines);
  const nextContent = document.createDocumentFragment();

  scriptWords = [];
  scriptWordElements = [];
  scriptSentences = [];
  currentScriptWordIndex = 0;
  activeSentenceIndex = -1;
  targetScrollTop = 0;
  lastScriptMatchAt = 0;

  for (const lines of measuredBlocks) {
    for (const line of lines) {
      const lineElement = document.createElement("p");
      const lineStart = scriptWords.length;
      lineElement.className = "prompt-line";
      lineElement.dataset.lineIndex = String(scriptSentences.length);
      appendWordSpans(lineElement, line);
      scriptSentences.push({
        start: lineStart,
        end: Math.max(lineStart, scriptWords.length - 1),
        element: lineElement
      });
      nextContent.append(lineElement);
    }
  }

  promptText.style.transform = "none";
  promptText.replaceChildren(nextContent);

  if (preservePlayback) {
    const minScrollTop = getMinPromptScrollTop();
    const maxScrollTop = getMaxPromptScrollTop();
    currentScriptWordIndex = Math.min(previousWordIndex, Math.max(0, scriptWords.length - 1));
    setPromptScrollPosition(minScrollTop + previousProgress * Math.max(0, maxScrollTop - minScrollTop));
  } else {
    setPromptScrollPosition(getMinPromptScrollTop());
    elapsedMilliseconds = 0;
    endHoldElapsedMilliseconds = 0;
  }
  clearHighlightClasses();
  updateProgress();
  updateHighlight();

  if (!preservePlayback && state !== "idle") {
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

function applyShortcutStatuses(statuses: ShortcutStatus[]): void {
  enabledShortcutActions = new Set(statuses.filter((status) => status.enabled).map((status) => status.action));
}

function isLocalShortcutEnabled(action: TeleprompterCommand): boolean {
  return enabledShortcutActions.has(action);
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
    label: "Reset position",
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
modeSelect?.addEventListener("change", () => {
  setScrollMode(modeSelect.value as AppSettings["behavior"]["scrollMode"]);
});

closeOverlayButton?.addEventListener("click", () => {
  closeOverlayWithFeedback();
});

window.addEventListener("keydown", (event) => {
  if (isTypingTarget(event.target)) {
    return;
  }

  if (event.key === "ArrowRight" && isLocalShortcutEnabled("speedUp")) {
    event.preventDefault();
    speedUp();
    return;
  }

  if (event.key === "ArrowLeft" && isLocalShortcutEnabled("slowDown")) {
    event.preventDefault();
    slowDown();
    return;
  }

  if (event.key === " " && isLocalShortcutEnabled("startPause")) {
    event.preventDefault();
    startPause();
    return;
  }

  if (event.key.toLowerCase() === "r" && isLocalShortcutEnabled("restart")) {
    event.preventDefault();
    restart();
    return;
  }

  if (event.key === "Escape" && isLocalShortcutEnabled("hideOverlay")) {
    event.preventDefault();
    closeOverlayWithFeedback();
  }
});

window.addEventListener("resize", () => {
  if (relayoutTimerId !== null) {
    window.clearTimeout(relayoutTimerId);
  }

  relayoutTimerId = window.setTimeout(() => {
    relayoutTimerId = null;
    renderScript(currentScriptBody, true);
  }, 80);
});

if (teleprompterApi) {
  teleprompterApi.onShortcutsChanged(applyShortcutStatuses);
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
  teleprompterApi.getShortcutStatus().then(applyShortcutStatuses).catch(() => {
    enabledShortcutActions.clear();
  });
} else {
  renderScript();
  updateControls();
}

updateControls();
updateProgress();
