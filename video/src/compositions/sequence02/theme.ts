export const FPS = 30;
export const W = 1920;
export const H = 1080;

export const DURATION_SEC = 63.8;
export const TOTAL_FRAMES = Math.round(DURATION_SEC * FPS);

export const toFrames = (sec: number) => Math.round(sec * FPS);

export const SRC = "sequence02/sequence02.mp4";
