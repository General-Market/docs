// BatchFlowReel — the batch market, from the product UI to the throughput
// graph, on a white ground carrying an accelerating blue points-and-lines
// network. Frosted cards, blue→violet gradient pills, soft glows. Brand blue
// leads; violet and pink are the pastel accents.

import { Easing } from "remotion";
import { font, monoFont } from "../../common/fonts";

export { font, monoFont };

export const FPS = 60;
export const W = 1920;
export const H = 1080;

export const sec = (s: number): number => Math.round(s * FPS);

// The panel is scaled down inside the comp so the blue broll breathes around
// it. Beats render in full 1920×1080 space and are scaled into the panel.
export const WINDOW_SCALE = 0.92;

// Blue-led pastel gradient for the pills and the flow connectors.
export const PILL_GRADIENT =
  "linear-gradient(95deg, #0071E3 0%, #5E78FF 52%, #9E7BFF 100%)";

export const C = {
  text: "#1D1D1F",
  dim: "#5A5B6A",
  faint: "#8A8B9C",
  grid: "rgba(60, 60, 110, 0.08)",
  rule: "rgba(60, 60, 110, 0.14)",
  ruleStrong: "rgba(60, 60, 110, 0.22)",
  // Card / panel fills are translucent so the frosted window reads through
  // them — anything painted on C.surface becomes glass automatically.
  surface: "rgba(255, 255, 255, 0.62)",
  surfaceSunk: "rgba(255, 255, 255, 0.34)",
  up: "#1FB877",
  upSoft: "rgba(31, 184, 119, 0.16)",
  down: "#F2566B",
  downSoft: "rgba(242, 86, 107, 0.14)",
  blue: "#0071E3",
  blueSoft: "rgba(0, 113, 227, 0.14)",
  // Pastel accents.
  accent: "#0071E3",
  accentBright: "#2997ff",
  violet: "#6E5BFF",
  pink: "#FF7AC6",
  // Glass tokens.
  glass: "rgba(255, 255, 255, 0.62)",
  glassSunk: "rgba(255, 255, 255, 0.34)",
  glassBorder: "rgba(255, 255, 255, 0.72)",
} as const;

// 12-color palette — brand blue first, then a legible pastel spread for chips
// and bars. Saturated enough to read on the frosted window, soft enough to
// sit in the pastel world.
export const NEON = [
  "#0071E3",
  "#1FB877",
  "#E8A13A",
  "#7B5CFF",
  "#17B0A6",
  "#FF7A59",
  "#9AB02A",
  "#FF6FB5",
  "#22B36B",
  "#2BA6F0",
  "#5566E0",
  "#F0556A",
] as const;

export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
  inOut: Easing.bezier(0.87, 0, 0.13, 1),
  smooth: Easing.bezier(0.4, 0, 0.2, 1),
} as const;

export type BeatKey =
  | "product"
  | "enter"
  | "traders"
  | "pool"
  | "settle"
  | "payout"
  | "multiply"
  | "unlock";

export const BEATS: { key: BeatKey; seconds: number }[] = [
  { key: "product", seconds: 7.0 },
  { key: "enter", seconds: 4.0 },
  { key: "traders", seconds: 5.5 },
  { key: "pool", seconds: 6.5 },
  { key: "settle", seconds: 6.5 },
  { key: "payout", seconds: 5.5 },
  { key: "multiply", seconds: 7.0 },
  { key: "unlock", seconds: 7.0 },
];

// ─── The board ────────────────────────────────────────────────────────────────
//
// Every schematic lives on ONE board — a 3×3 grid of full-frame cells, not nine
// separate scenes. The camera flies over it: it rests on a cell at scale 1, and
// for each transition it pulls all the way back to frame the whole board — every
// schematic visible at once — then dives into the next cell. The pull-back is
// the proof that it was all one surface the whole time.

export const GRID_COLS = 3;
export const GRID_ROWS = 3;
export const BOARD_W = GRID_COLS * W;
export const BOARD_H = GRID_ROWS * H;
export const BOARD_CX = BOARD_W / 2;
export const BOARD_CY = BOARD_H / 2;
// At this scale the whole board fits the viewport exactly.
export const ZOOM_OUT = W / BOARD_W;

// Reading-order snake, so the camera path never doubles back on itself.
const CELL: Record<BeatKey, readonly [number, number]> = {
  product: [0, 0],
  enter: [1, 0],
  traders: [2, 0],
  pool: [2, 1],
  settle: [1, 1],
  payout: [0, 1],
  multiply: [0, 2],
  unlock: [1, 2],
};

export const cellOrigin = (key: BeatKey): [number, number] => {
  const [c, r] = CELL[key];
  return [c * W, r * H];
};
export const cellCenter = (key: BeatKey): [number, number] => {
  const [c, r] = CELL[key];
  return [c * W + W / 2, r * H + H / 2];
};

// How long the camera holds on each schematic (its build + read) and how long
// the pull-back/dive between them runs. LEAD lets a beat begin building during
// the dive in, so you arrive on a schematic already in motion.
export const TRANSITION = sec(1.3);
export const LEAD = sec(0.45);
// the closing move: once the last schematic is drawn, pull all the way out and
// hold on the finished board — every station filled, one surface.
export const CLOSE = sec(1.7);
export const CLOSE_HOLD = sec(1.6);

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

const LAST_END =
  FOCUS[FOCUS.length - 1].from + FOCUS[FOCUS.length - 1].durationInFrames;

export const TOTAL_FRAMES = LAST_END + CLOSE + CLOSE_HOLD;

// The camera at a given frame: which board point sits under the viewport centre,
// and at what scale. Resting → the cell at scale 1. Between → it eases out to the
// whole board (focus passes through board centre exactly as scale bottoms out)
// and back in to the next cell. The scale bump has zero velocity at both ends, so
// the move breathes rather than snaps — the organic feel lives in the camera.
export type Camera = { scale: number; fx: number; fy: number };

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const cameraAt = (frame: number): Camera => {
  for (let i = 0; i < FOCUS.length; i++) {
    const f = FOCUS[i];
    const end = f.from + f.durationInFrames;
    const [cx, cy] = cellCenter(f.key);
    if (frame <= end) return { scale: 1, fx: cx, fy: cy };
    const next = FOCUS[i + 1];
    if (next && frame < next.from) {
      const p = (frame - end) / (next.from - end); // 0..1 across the transition
      const [nx, ny] = cellCenter(next.key);
      const bump = 0.5 * (1 - Math.cos(2 * Math.PI * p)); // 0→1→0, flat at the ends
      const scale = 1 - (1 - ZOOM_OUT) * bump;
      const fx =
        p < 0.5
          ? lerp(cx, BOARD_CX, EASE.inOut(p / 0.5))
          : lerp(BOARD_CX, nx, EASE.inOut((p - 0.5) / 0.5));
      const fy =
        p < 0.5
          ? lerp(cy, BOARD_CY, EASE.inOut(p / 0.5))
          : lerp(BOARD_CY, ny, EASE.inOut((p - 0.5) / 0.5));
      return { scale, fx, fy };
    }
  }
  // closing pull-back: from the last cell out to the whole finished board, held.
  const last = FOCUS[FOCUS.length - 1];
  const [cx, cy] = cellCenter(last.key);
  const e = EASE.inOut(Math.max(0, Math.min(1, (frame - LAST_END) / CLOSE)));
  return {
    scale: lerp(1, ZOOM_OUT, e),
    fx: lerp(cx, BOARD_CX, e),
    fy: lerp(cy, BOARD_CY, e),
  };
};
