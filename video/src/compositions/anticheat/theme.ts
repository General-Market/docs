export const FPS = 30;
export const W = 1920;
export const H = 1080;

export const DURATION_SEC = 12;
export const TOTAL_FRAMES = DURATION_SEC * FPS;

export const toFrames = (seconds: number): number => Math.round(seconds * FPS);

export const colors = {
  bg: "#0a0a0a",
  fg: "#f5f5f5",
  dim: "#7a7a7a",
  accent: "#ff3b3b",
  rule: "#1f1f1f",
};
