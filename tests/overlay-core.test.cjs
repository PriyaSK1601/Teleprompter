const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateOverlayBounds,
  calculateTimerTotalMilliseconds,
  getCenteredLineScrollPosition,
  groupMeasuredWordsIntoLines,
  isShortcutActionEnabled,
  getSynchronizedTimerSeconds,
  preserveScrollProgress
} = require("../dist/shared/overlayCore.js");

test("overlay bounds use saved ratios inside the display work area", () => {
  assert.deepEqual(
    calculateOverlayBounds(
      { widthRatio: 0.25, heightRatio: 0.2, xRatio: 0.5, yRatio: 0.1 },
      { x: 100, y: 40, width: 1600, height: 1000 },
      { width: 320, height: 180 }
    ),
    { x: 900, y: 140, width: 400, height: 200 }
  );
});

test("overlay bounds clamp minimum size and off-screen placement", () => {
  assert.deepEqual(
    calculateOverlayBounds(
      { widthRatio: 0.05, heightRatio: 0.05, xRatio: 1, yRatio: 1 },
      { x: -1200, y: 20, width: 1200, height: 800 },
      { width: 560, height: 220 }
    ),
    { x: -560, y: 600, width: 560, height: 220 }
  );
});

test("the active script line is centered in the prompt viewport", () => {
  assert.equal(getCenteredLineScrollPosition(20, 40, 400), -160);
});

test("resize anchoring preserves proportional progress", () => {
  assert.equal(preserveScrollProgress(250, 0, 1000, 0, 400), 100);
});

test("elapsed and remaining timers stay complementary", () => {
  const total = calculateTimerTotalMilliseconds(0, 216.3, 21);
  const first = getSynchronizedTimerSeconds(1100, total);
  const second = getSynchronizedTimerSeconds(2100, total);

  assert.equal(first.elapsed + first.remaining, second.elapsed + second.remaining);
  assert.equal(second.elapsed, first.elapsed + 1);
  assert.equal(second.remaining, first.remaining - 1);
  assert.equal(getSynchronizedTimerSeconds(total, total, true).remaining, 0);
});

test("measured words are grouped by their rendered row", () => {
  assert.deepEqual(
    groupMeasuredWordsIntoLines([
      { index: 0, top: 10, bottom: 30 },
      { index: 1, top: 11, bottom: 31 },
      { index: 2, top: 42, bottom: 62 }
    ]),
    [
      { start: 0, end: 1, top: 10, bottom: 31 },
      { start: 2, end: 2, top: 42, bottom: 62 }
    ]
  );
});

test("shortcut eligibility follows the persisted action toggle", () => {
  const statuses = [
    { action: "startPause", enabled: false },
    { action: "restart", enabled: true }
  ];

  assert.equal(isShortcutActionEnabled(statuses, "startPause"), false);
  assert.equal(isShortcutActionEnabled(statuses, "restart"), true);
  assert.equal(isShortcutActionEnabled(statuses, "speedUp"), false);
});
