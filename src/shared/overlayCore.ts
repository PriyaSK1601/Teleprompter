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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
