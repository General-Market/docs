/**
 * Human-like cursor movement module
 * Uses xdotool on Xvfb display :1 (1920x1200)
 * No external dependencies — only child_process
 */

const { execSync } = require("child_process");

const DISPLAY = ":1";
const SCREEN_W = 1920;
const SCREEN_H = 1200;

// Measured overhead per execSync xdotool call (~15-25ms).
// We account for this so total move time stays in the 150-400ms budget.
const XDOTOOL_OVERHEAD_MS = 18;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function env() {
  return { env: { ...process.env, DISPLAY } };
}

/** Execute xdotool command silently */
function xdo(cmd) {
  execSync(`xdotool ${cmd}`, env());
}

/** Get current mouse position {x, y} */
function getPos() {
  const out = execSync("xdotool getmouselocation", env()).toString();
  const mx = out.match(/x:(\d+)/);
  const my = out.match(/y:(\d+)/);
  return { x: parseInt(mx[1], 10), y: parseInt(my[1], 10) };
}

/** Clamp value between min and max */
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Random float in [lo, hi) */
function randF(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

/** Random int in [lo, hi] inclusive */
function randI(lo, hi) {
  return Math.floor(randF(lo, hi + 1));
}

/** Blocking sleep in ms using Atomics (no busy-wait) */
function sleepMs(ms) {
  if (ms <= 0) return;
  const buf = new SharedArrayBuffer(4);
  const view = new Int32Array(buf);
  Atomics.wait(view, 0, 0, Math.round(ms));
}

// ---------------------------------------------------------------------------
// Bezier math
// ---------------------------------------------------------------------------

/**
 * Evaluate a cubic Bezier at parameter t in [0,1].
 * P0 = start, P3 = end, P1/P2 = control points.
 */
function cubicBezier(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return (
    u * u * u * p0 +
    3 * u * u * t * p1 +
    3 * u * t * t * p2 +
    t * t * t * p3
  );
}

/**
 * Generate control points that make the path curve naturally.
 * Adds lateral offset proportional to distance so short moves
 * still look organic.
 */
function makeControlPoints(sx, sy, ex, ey) {
  const dx = ex - sx;
  const dy = ey - sy;
  const dist = Math.hypot(dx, dy);

  // Perpendicular unit vector
  const perpX = dist > 0 ? -dy / dist : 0;
  const perpY = dist > 0 ? dx / dist : 0;

  // Lateral sway: 10-30% of distance, random direction
  const sway1 = randF(0.10, 0.30) * dist * (Math.random() < 0.5 ? 1 : -1);
  const sway2 = randF(0.05, 0.20) * dist * (Math.random() < 0.5 ? 1 : -1);

  // Control points at roughly 1/3 and 2/3 along the line, offset laterally
  const cp1x = sx + dx * randF(0.20, 0.40) + perpX * sway1;
  const cp1y = sy + dy * randF(0.20, 0.40) + perpY * sway1;
  const cp2x = sx + dx * randF(0.60, 0.80) + perpX * sway2;
  const cp2y = sy + dy * randF(0.60, 0.80) + perpY * sway2;

  return { cp1x, cp1y, cp2x, cp2y };
}

/**
 * Easing function: slow start, fast middle, slow end.
 */
function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Move cursor from current position to (targetX, targetY) with human-like
 * Bezier curve, variable speed, and slight overshoot + correction.
 *
 * Total wall-clock time targets 150-400ms depending on distance.
 */
function moveToHuman(targetX, targetY) {
  const start = getPos();
  const sx = start.x;
  const sy = start.y;

  const dist = Math.hypot(targetX - sx, targetY - sy);
  if (dist < 2) return; // already there (or 1px — not worth animating)

  // ---- Overshoot target ----
  const overshootPx = randF(1, 5);
  const angle = Math.atan2(targetY - sy, targetX - sx);
  const ovX = Math.round(targetX + Math.cos(angle) * overshootPx);
  const ovY = Math.round(targetY + Math.sin(angle) * overshootPx);

  // ---- Duration budget: 150-400ms total (including correction) ----
  // Reserve ~60ms for the correction phase (2-3 steps + sleeps + overhead).
  const totalBudget = clamp(100 + dist * 0.25, 150, 400);
  const correctionBudget = 60;
  const mainBudget = totalBudget - correctionBudget;

  // ---- Compute step count ----
  // Each step costs ~XDOTOOL_OVERHEAD_MS (exec) + sleepTime.
  // We want enough steps for smooth motion but few enough to stay in budget.
  // Target: step every ~12ms of *logical* time, but actual = overhead + sleep.
  const logicalStepMs = randF(10, 16);
  const steps = clamp(Math.round(mainBudget / (XDOTOOL_OVERHEAD_MS + logicalStepMs)), 4, 30);

  // How much additional sleep per step to fill the budget
  const actualSleepPerStep = Math.max(0, (mainBudget - steps * XDOTOOL_OVERHEAD_MS) / steps);

  // ---- Generate Bezier path to overshoot point ----
  const { cp1x, cp1y, cp2x, cp2y } = makeControlPoints(sx, sy, ovX, ovY);

  for (let i = 1; i <= steps; i++) {
    const rawT = i / steps;
    const t = easeInOutCubic(rawT);

    let px = Math.round(cubicBezier(t, sx, cp1x, cp2x, ovX));
    let py = Math.round(cubicBezier(t, sy, cp1y, cp2y, ovY));

    // Micro-jitter on 25% of intermediate steps
    if (i < steps && Math.random() < 0.25) {
      px += randI(-1, 1);
      py += randI(-1, 1);
    }

    px = clamp(px, 0, SCREEN_W - 1);
    py = clamp(py, 0, SCREEN_H - 1);

    xdo(`mousemove --screen 0 ${px} ${py}`);

    if (actualSleepPerStep > 1) {
      sleepMs(actualSleepPerStep + randF(-2, 2));
    }
  }

  // ---- Correction move: overshoot -> actual target ----
  sleepMs(randF(10, 25));
  const corrSteps = randI(2, 3);
  const cur = getPos();
  for (let i = 1; i <= corrSteps; i++) {
    const t = i / corrSteps;
    const cx = Math.round(cur.x + (targetX - cur.x) * t);
    const cy = Math.round(cur.y + (targetY - cur.y) * t);
    xdo(`mousemove --screen 0 ${cx} ${cy}`);
    sleepMs(randF(5, 12));
  }
}

/**
 * Move to (x, y) then perform a human-like click.
 * Adds pre-click delay, position jitter, and realistic
 * mousedown-mouseup timing.
 */
function clickHuman(x, y) {
  moveToHuman(x, y);

  // Pre-click pause (human reaction / aim settle)
  sleepMs(randF(20, 80));

  // Slight jitter on click position (1-2px)
  const jx = clamp(x + randI(-2, 2), 0, SCREEN_W - 1);
  const jy = clamp(y + randI(-2, 2), 0, SCREEN_H - 1);
  xdo(`mousemove --screen 0 ${jx} ${jy}`);

  // mousedown
  xdo("mousedown 1");
  // Hold duration
  sleepMs(randF(50, 120));
  // mouseup
  xdo("mouseup 1");
}

/**
 * Small random jitter while idle (1-5px displacement).
 * Call periodically between actions to look alive.
 */
function idleJitter() {
  const pos = getPos();
  const dx = randI(-5, 5);
  const dy = randI(-5, 5);
  const nx = clamp(pos.x + dx, 0, SCREEN_W - 1);
  const ny = clamp(pos.y + dy, 0, SCREEN_H - 1);

  // Move in 2-3 tiny steps so it is not instant
  const steps = randI(2, 3);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ix = Math.round(pos.x + (nx - pos.x) * t);
    const iy = Math.round(pos.y + (ny - pos.y) * t);
    xdo(`mousemove --screen 0 ${ix} ${iy}`);
    sleepMs(randF(15, 30));
  }
}

/**
 * Slow random drift over durationMs.
 * Gentle, semi-random direction changes at 10-30 px/s.
 */
function idleDrift(durationMs) {
  const start = Date.now();

  while (Date.now() - start < durationMs) {
    const remaining = durationMs - (Date.now() - start);
    if (remaining < 50) break;

    const segDur = Math.min(randF(300, 600), remaining);
    const speed = randF(10, 30); // px/s
    const totalPx = speed * (segDur / 1000);
    const angle = randF(0, 2 * Math.PI);

    const pos = getPos();
    const destX = clamp(
      Math.round(pos.x + Math.cos(angle) * totalPx),
      50, SCREEN_W - 50
    );
    const destY = clamp(
      Math.round(pos.y + Math.sin(angle) * totalPx),
      50, SCREEN_H - 50
    );

    const stepMs = 40;
    const segSteps = Math.max(Math.floor(segDur / (stepMs + XDOTOOL_OVERHEAD_MS)), 2);

    for (let i = 1; i <= segSteps; i++) {
      if (Date.now() - start >= durationMs) break;
      const t = i / segSteps;
      const et = t * t * (3 - 2 * t); // smoothstep
      const cx = Math.round(pos.x + (destX - pos.x) * et);
      const cy = Math.round(pos.y + (destY - pos.y) * et);
      xdo(`mousemove --screen 0 ${cx} ${cy}`);
      sleepMs(stepMs + randF(-5, 5));
    }
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  moveToHuman,
  clickHuman,
  idleJitter,
  idleDrift,
  getPos,
};
