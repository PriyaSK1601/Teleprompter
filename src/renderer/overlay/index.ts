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

  const maxScrollTop = promptViewport.scrollHeight - promptViewport.clientHeight;

  if (promptViewport.scrollTop >= maxScrollTop) {
    promptViewport.scrollTop = maxScrollTop;
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
  countdownRemaining = 3;
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
    paragraph.textContent = block;
    promptText.append(paragraph);
  }

  promptViewport.scrollTop = 0;

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

window.teleprompter.getScriptsState().then((state) => {
  renderScript(state.activeScript?.body);
}).catch(() => {
  renderScript();
});

updateLabels();
