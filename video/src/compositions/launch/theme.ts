export const FPS = 30;
export const DURATION_SEC = 30;
export const TOTAL_FRAMES = DURATION_SEC * FPS; // 900

export const toFrames = (seconds: number): number => Math.round(seconds * FPS);
