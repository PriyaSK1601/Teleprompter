import type { OverlayBounds, OverlaySizeSettings, ShortcutStatus, TeleprompterCommand } from "./ipc";

export type DisplayArea = OverlayBounds;

export type WordLayout = {
  index: number;
  top: number;
  bottom: number;
};

export type MeasuredLine = {
  start: number;
  end: number;
  top: number;
  bottom: number;
};

type RgbColor = {
  red: number;
  green: number;
  blue: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hexColor: string): RgbColor {
  const normalized = hexColor.replace("#", "");

  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function rgbToHex(color: RgbColor): string {
  const channel = (value: number): string => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0");
  return `#${channel(color.red)}${channel(color.green)}${channel(color.blue)}`;
}

function mixRgb(from: RgbColor, to: RgbColor, amount: number): RgbColor {
  const ratio = clamp(amount, 0, 1);
  return {
    red: from.red + (to.red - from.red) * ratio,
    green: from.green + (to.green - from.green) * ratio,
    blue: from.blue + (to.blue - from.blue) * ratio
  };
}

function relativeLuminance(hexColor: string): number {
  const { red, green, blue } = hexToRgb(hexColor);
  const channels = [red, green, blue].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function getContrastRatio(hexA: string, hexB: string): number {
  const lighter = Math.max(relativeLuminance(hexA), relativeLuminance(hexB));
  const darker = Math.min(relativeLuminance(hexA), relativeLuminance(hexB));
  return (lighter + 0.05) / (darker + 0.05);
}

export function deriveActiveTextColor(
  textColor: string,
  backgroundColor: string,
  minimumContrast = 4.5,
  darkenFactor = 0.78
): string {
  const original = hexToRgb(textColor);
  const darkened: RgbColor = {
    red: original.red * darkenFactor,
    green: original.green * darkenFactor,
    blue: original.blue * darkenFactor
  };
  const darkenedHex = rgbToHex(darkened);
  const originalContrast = getContrastRatio(textColor, backgroundColor);
  const darkenedContrast = getContrastRatio(darkenedHex, backgroundColor);

  if (darkenedContrast >= minimumContrast) {
    return darkenedHex;
  }

  if (originalContrast < minimumContrast) {
    return darkenedContrast >= originalContrast ? darkenedHex : textColor.toLowerCase();
  }

  let safeAmount = 0;
  let unsafeAmount = 1;

  for (let iteration = 0; iteration < 12; iteration += 1) {
    const amount = (safeAmount + unsafeAmount) / 2;
    const candidate = rgbToHex(mixRgb(original, darkened, amount));

    if (getContrastRatio(candidate, backgroundColor) >= minimumContrast) {
      safeAmount = amount;
    } else {
      unsafeAmount = amount;
    }
  }

  return rgbToHex(mixRgb(original, darkened, safeAmount));
}

export function calculateOverlayBounds(
  overlaySize: OverlaySizeSettings,
  area: DisplayArea,
  minimum: { width: number; height: number }
): OverlayBounds {
  const width = clamp(Math.round(area.width * overlaySize.widthRatio), minimum.width, area.width);
  const height = clamp(Math.round(area.height * overlaySize.heightRatio), minimum.height, area.height);
  const x = area.x + Math.round(clamp(area.width * overlaySize.xRatio, 0, area.width - width));
  const y = area.y + Math.round(clamp(area.height * overlaySize.yRatio, 0, area.height - height));

  return { x, y, width, height };
}

export function getCenteredLineScrollPosition(lineTop: number, lineHeight: number, viewportHeight: number): number {
  return lineTop + lineHeight / 2 - viewportHeight / 2;
}

export function getCenteredLineScrollRange(
  firstLineTop: number,
  firstLineHeight: number,
  finalLineTop: number,
  finalLineHeight: number,
  viewportHeight: number
): { min: number; max: number } {
  const min = getCenteredLineScrollPosition(firstLineTop, firstLineHeight, viewportHeight);
  const final = getCenteredLineScrollPosition(finalLineTop, finalLineHeight, viewportHeight);
  return { min, max: Math.max(min, final) };
}

export function preserveScrollProgress(
  previousPosition: number,
  previousMin: number,
  previousMax: number,
  nextMin: number,
  nextMax: number
): number {
  const previousRange = Math.max(1, previousMax - previousMin);
  const progress = clamp((previousPosition - previousMin) / previousRange, 0, 1);
  return nextMin + progress * Math.max(0, nextMax - nextMin);
}

export function calculateScrollProgress(
  position: number,
  minimum: number,
  maximum: number,
  playbackStarted: boolean
): number {
  const range = maximum - minimum;

  if (range <= 0) {
    return playbackStarted ? 1 : 0;
  }

  return clamp((position - minimum) / range, 0, 1);
}
export function calculateSynchronizedTimerTotalSeconds(
  elapsedMilliseconds: number,
  remainingDistance: number,
  pixelsPerSecond: number
): number {
  const elapsedSeconds = Math.floor(Math.max(0, elapsedMilliseconds) / 1000);

  if (pixelsPerSecond <= 0) {
    return elapsedSeconds;
  }

  const remainingSeconds = Math.ceil(Math.max(0, remainingDistance) / pixelsPerSecond);
  return elapsedSeconds + remainingSeconds;
}

export function getSynchronizedTimerSeconds(
  elapsedMilliseconds: number,
  totalSeconds: number,
  isComplete = false
): { elapsed: number; remaining: number } {
  const elapsed = Math.floor(Math.max(0, elapsedMilliseconds) / 1000);
  const remaining = isComplete
    ? 0
    : Math.max(0, totalSeconds - elapsed);
  return { elapsed, remaining };
}

export function groupMeasuredWordsIntoLines(words: WordLayout[], tolerance = 2): MeasuredLine[] {
  const lines: MeasuredLine[] = [];

  for (const word of words) {
    const current = lines[lines.length - 1];

    if (!current || Math.abs(current.top - word.top) > tolerance) {
      lines.push({ start: word.index, end: word.index, top: word.top, bottom: word.bottom });
      continue;
    }

    current.end = word.index;
    current.top = Math.min(current.top, word.top);
    current.bottom = Math.max(current.bottom, word.bottom);
  }

  return lines;
}

export function isShortcutActionEnabled(
  statuses: Pick<ShortcutStatus, "action" | "enabled">[],
  action: TeleprompterCommand
): boolean {
  return statuses.find((status) => status.action === action)?.enabled ?? false;
}
