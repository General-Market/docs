// CRX Deliverable-Forward explainer — the whole storyboard drawn on ONE board.
// Everything is drawn from frame 0, so the film OPENS on the finished, zoomed-out
// diagram (same shot it closes on → it loops). An internal camera then tours the
// six cells; each lights up as the camera arrives, a token rides the connectors
// between them, and a cursor clicks CRX into the story. Pastel-glass, teal-led.

import { Easing } from "remotion";
import { font, monoFont } from "../../common/fonts";

export { font, monoFont };

export const FPS = 60;
export const W = 1920;
export const H = 1080;

export const sec = (s: number): number => Math.round(s * FPS);

// minimum on-screen type — nothing reads smaller than this
export const MIN_FONT = 28;

export const TEAL_GRADIENT = "linear-gradient(95deg, #2AD4BB 0%, #1CC8C6 52%, #19B6DD 100%)";

export const C = {
  text: "#1D1D1F",
  dim: "#4C4D5C",
  faint: "#7C7D8E",
  rule: "rgba(60, 64, 110, 0.18)",
  teal: "#0FAFA8",
  tealBright: "#1CC8C6",
  tealDeep: "#0E8F95",
  tealSoft: "rgba(28, 200, 198, 0.18)",
  good: "#12B07C",
  goodSoft: "rgba(18, 176, 124, 0.18)",
  bad: "#F0455F",
  badSoft: "rgba(240, 69, 95, 0.16)",
  gold: "#E8A13A",
} as const;

export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
  inOut: Easing.bezier(0.87, 0, 0.13, 1),
  smooth: Easing.bezier(0.4, 0, 0.2, 1),
} as const;

export const FIELD_BG = "#EEF1F3";

// ─── board — 3×2 grid of full-frame cells ─────────────────────────────────────
export const GRID_COLS = 3;
export const GRID_ROWS = 2;
export const BOARD_W = GRID_COLS * W;
export const BOARD_H = GRID_ROWS * H;
export const BOARD_CX = BOARD_W / 2;
export const BOARD_CY = BOARD_H / 2;
// fit the whole board, with a little margin so it doesn't kiss the edges
export const ZOOM_OUT = Math.min(W / BOARD_W, H / BOARD_H) * 0.96;

export type BeatKey = "want" | "hedge" | "expensive" | "crx" | "happy" | "result";

const CELL: Record<BeatKey, readonly [number, number]> = {
  want: [0, 0],
  hedge: [1, 0],
  expensive: [2, 0],
  crx: [2, 1],
  happy: [1, 1],
  result: [0, 1],
};

export const cellOrigin = (key: BeatKey): [number, number] => {
  const [c, r] = CELL[key];
  return [c * W, r * H];
};
export const cellCenter = (key: BeatKey): [number, number] => {
  const [c, r] = CELL[key];
  return [c * W + W / 2, r * H + H / 2];
};

export const BEATS: { key: BeatKey; seconds: number }[] = [
  { key: "want", seconds: 2.0 },
  { key: "hedge", seconds: 5.2 },
  { key: "expensive", seconds: 2.3 },
  { key: "crx", seconds: 3.6 },
  { key: "happy", seconds: 2.0 },
  { key: "result", seconds: 2.8 },
];

export const TRANSITION = sec(0.72); // snappy pan between cells
export const OPEN_HOLD = sec(1.2); // establish the full diagram, zoomed out
export const OPEN_DIVE = sec(1.0); // fly into beat 1
export const CLOSE = sec(1.1); // pull back out
export const CLOSE_HOLD = sec(1.3); // hold the full diagram again

export type FocusSlot = { key: BeatKey; from: number; durationInFrames: number };

export const FOCUS: FocusSlot[] = (() => {
  const out: FocusSlot[] = [];
  let cursor = 0;
  BEATS.forEach((b) => {
    const durationInFrames = sec(b.seconds);
    out.push({ key: b.key, from: cursor, durationInFrames });
    cursor += durationInFrames + TRANSITION;
  });
  return out;
})();

const LAST_END = FOCUS[FOCUS.length - 1].from + FOCUS[FOCUS.length - 1].durationInFrames;
const HEAD = OPEN_HOLD + OPEN_DIVE;
export const TOTAL_FRAMES = HEAD + LAST_END + CLOSE + CLOSE_HOLD;

// board-time the camera settles onto a beat (for arrival emphasis + token + cursor)
export const beatArrival = (key: BeatKey): number => {
  const f = FOCUS.find((s) => s.key === key);
  return HEAD + (f ? f.from : 0);
};
// board-time the camera leaves a beat
export const beatDepart = (key: BeatKey): number => {
  const f = FOCUS.find((s) => s.key === key)!;
  return HEAD + f.from + f.durationInFrames;
};

export type Camera = { scale: number; fx: number; fy: number };

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
const CAM = Easing.bezier(0.5, 0, 0.2, 1);

export const cameraAt = (frame: number): Camera => {
  // hold the whole diagram, zoomed out
  if (frame < OPEN_HOLD) return { scale: ZOOM_OUT, fx: BOARD_CX, fy: BOARD_CY };
  // dive into the first cell
  if (frame < HEAD) {
    const [cx, cy] = cellCenter(FOCUS[0].key);
    const e = CAM(clamp01((frame - OPEN_HOLD) / OPEN_DIVE));
    return { scale: lerp(ZOOM_OUT, 1, e), fx: lerp(BOARD_CX, cx, e), fy: lerp(BOARD_CY, cy, e) };
  }
  const t = frame - HEAD;
  for (let i = 0; i < FOCUS.length; i++) {
    const f = FOCUS[i];
    const end = f.from + f.durationInFrames;
    const [cx, cy] = cellCenter(f.key);
    if (t <= end) return { scale: 1, fx: cx, fy: cy };
    const next = FOCUS[i + 1];
    if (next && t < next.from) {
      const p = CAM(clamp01((t - end) / (next.from - end)));
      const [nx, ny] = cellCenter(next.key);
      return { scale: 1, fx: lerp(cx, nx, p), fy: lerp(cy, ny, p) };
    }
  }
  // pull back to the whole diagram and hold
  const last = FOCUS[FOCUS.length - 1];
  const [cx, cy] = cellCenter(last.key);
  const e = EASE.inOut(clamp01((t - LAST_END) / CLOSE));
  return { scale: lerp(1, ZOOM_OUT, e), fx: lerp(cx, BOARD_CX, e), fy: lerp(cy, BOARD_CY, e) };
};
