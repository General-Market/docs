export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const SCENE_FRAMES = 4 * FPS; // 120
export const SCENE_COUNT = 20;
export const TOTAL_FRAMES = SCENE_FRAMES * SCENE_COUNT;

export const START = 8400;
export const END = 12;

export const COLOR = {
  bg: "#0a0a0a",
  ink: "#e9e9e5",
  dim: "#6a6a66",
  loss: "#e0322a",
  gain: "#2ad18e",
  gold: "#d4a437",
  paper: "#efe9de",
  ember: "#ff6a1f",
} as const;

// 24 stepped fee events spread across a scene. Each event deducts a chunk.
// Sum of steps === START - END, always finishes at $12.
const STEP_COUNT = 24;
const STEP_SUM = START - END;

// Non-linear schedule: early fees are small, acceleration near end.
const RAW = Array.from({ length: STEP_COUNT }, (_, i) => {
  const t = i / (STEP_COUNT - 1);
  return Math.pow(t + 0.25, 1.8);
});
const RAW_SUM = RAW.reduce((a, b) => a + b, 0);
export const FEE_STEPS = RAW.map((r) => (r / RAW_SUM) * STEP_SUM);

// Balance at each step boundary (step i = balance AFTER fee[i])
export const BALANCE_AT_STEP: number[] = [START];
FEE_STEPS.forEach((fee) => {
  const prev = BALANCE_AT_STEP[BALANCE_AT_STEP.length - 1];
  BALANCE_AT_STEP.push(Math.max(END, prev - fee));
});
BALANCE_AT_STEP[BALANCE_AT_STEP.length - 1] = END;

// Map scene frame (0..SCENE_FRAMES) to current balance with easing.
export const balanceAt = (sceneFrame: number): number => {
  const t = Math.max(0, Math.min(1, sceneFrame / SCENE_FRAMES));
  // Non-linear time so losses accelerate
  const eased = Math.pow(t, 0.85);
  const idx = Math.min(
    BALANCE_AT_STEP.length - 1,
    Math.floor(eased * (BALANCE_AT_STEP.length - 1)),
  );
  const frac = eased * (BALANCE_AT_STEP.length - 1) - idx;
  const a = BALANCE_AT_STEP[idx];
  const b = BALANCE_AT_STEP[Math.min(idx + 1, BALANCE_AT_STEP.length - 1)];
  return a + (b - a) * frac;
};

// True at the exact frame a fee hits — for flash/punch effects.
export const feeHitFrames = FEE_STEPS.map((_, i) =>
  Math.floor(((i + 1) / FEE_STEPS.length) * SCENE_FRAMES),
);

export const isFeeHit = (sceneFrame: number): boolean =>
  feeHitFrames.includes(sceneFrame);

export const fractionOfLossAt = (sceneFrame: number): number => {
  const b = balanceAt(sceneFrame);
  return 1 - (b - END) / (START - END);
};
