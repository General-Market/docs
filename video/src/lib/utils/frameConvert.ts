const DEFAULT_FPS = 30;

export const msToFrame = (ms: number, fps = DEFAULT_FPS): number =>
  Math.round((ms / 1000) * fps);

export const secondsToFrame = (s: number, fps = DEFAULT_FPS): number =>
  Math.round(s * fps);

export const frameToMs = (frame: number, fps = DEFAULT_FPS): number =>
  (frame / fps) * 1000;

export const frameToSeconds = (frame: number, fps = DEFAULT_FPS): number =>
  frame / fps;
