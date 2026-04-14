export const FPS = 30;
export const DURATION_SEC = 15;
export const TOTAL_FRAMES = Math.round(DURATION_SEC * FPS);

export const toFrames = (sec: number) => Math.round(sec * FPS);

export const W = 1920;
export const H = 1080;
