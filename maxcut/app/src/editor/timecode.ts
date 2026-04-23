// Frame-indexed math. Seconds are a convenience; frames are the truth.

export function framesToTimecode(frame: number, fps: number): string {
  const f = Math.max(0, Math.floor(frame));
  const totalSeconds = Math.floor(f / fps);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const ff = f % fps;
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(ff)}`;
}

export function pxToFrame(px: number, pxPerFrame: number, scroll: number): number {
  return Math.floor((px + scroll) / pxPerFrame);
}

export function frameToPx(frame: number, pxPerFrame: number, scroll: number): number {
  return frame * pxPerFrame - scroll;
}
