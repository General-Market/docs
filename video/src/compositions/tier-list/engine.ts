// Pure derivations off config + data. No React, no rendering — just geometry
// and the placement schedule. The reel reads everything from here, so a knob
// changed in config.ts ripples through layout, timing and total duration.

import { interpolate } from "remotion";
import { SOURCES, type Tier, type TierSource } from "./data";
import { CAMERA, FILL_ORDER, FPS, LAYOUT, TIERS, TIMING, W, H } from "./config";

export type Vec = { x: number; y: number };

export type Placement = {
  src: TierSource;
  tier: Tier;
  slotIndex: number; // position within its tier row
  pickIndex: number; // global order the cursor grabs it (also its tray slot)
  flightStart: number; // frame the logo lifts out of the tray
  dropFrame: number; // frame it lands in its row
};

const ROW_INDEX: Record<Tier, number> = Object.fromEntries(
  TIERS.map((t, i) => [t.id, i]),
) as Record<Tier, number>;

const byTier = (tier: Tier): TierSource[] => SOURCES.filter((s) => s.tier === tier);

/** y of a tier row's top edge and vertical centre, in world coords. */
export const rowGeometry = (tier: Tier) => {
  const top = LAYOUT.board.top + ROW_INDEX[tier] * LAYOUT.board.rowH;
  return { top, center: top + LAYOUT.board.rowH / 2 };
};

const trackWidth = LAYOUT.board.trackRight - LAYOUT.board.trackX - LAYOUT.board.leftPad;
const maxRowCount = Math.max(1, ...TIERS.map((t) => byTier(t.id).length));

/** One uniform tile size for every logo — sized so the fullest row fits its track. */
export const TILE = Math.max(
  LAYOUT.tile.min,
  Math.min(LAYOUT.tile.max, (trackWidth - LAYOUT.tile.gap * (maxRowCount - 1)) / maxRowCount),
);

export const tileSizeFor = (_tier: Tier): number => TILE;

/** Centre of slot `i` in a tier row — left-aligned, like a real tiermaker board. */
export const slotCenter = (tier: Tier, i: number): Vec => ({
  x: LAYOUT.board.trackX + LAYOUT.board.leftPad + i * (TILE + LAYOUT.tile.gap) + TILE / 2,
  y: rowGeometry(tier).center,
});

const trayRows = Math.ceil(SOURCES.length / LAYOUT.tray.cols);
const trayCellW = (W - 2 * LAYOUT.tray.padX) / LAYOUT.tray.cols;
const trayCellH = (LAYOUT.tray.bottom - LAYOUT.tray.top) / trayRows;

/** Fixed tray slot for a pick index — the pool depletes in fill order. */
export const traySlotCenter = (pickIndex: number): Vec => {
  const col = pickIndex % LAYOUT.tray.cols;
  const row = Math.floor(pickIndex / LAYOUT.tray.cols);
  return {
    x: LAYOUT.tray.padX + trayCellW * (col + 0.5),
    y: LAYOUT.tray.top + trayCellH * (row + 0.5),
  };
};

/** Build the placement schedule once. Drives every logo and the timeline. */
function buildSchedule() {
  const placements: Placement[] = [];
  const tierWindow: Partial<Record<Tier, { start: number; end: number }>> = {};
  let f = TIMING.introFrames;
  let pick = 0;
  let maxDrop = f;

  for (const tier of FILL_ORDER) {
    f += TIMING.tierLead;
    const start = f;
    byTier(tier).forEach((src, slotIndex) => {
      const flightStart = f;
      const dropFrame = flightStart + TIMING.flight;
      placements.push({ src, tier, slotIndex, pickIndex: pick, flightStart, dropFrame });
      maxDrop = Math.max(maxDrop, dropFrame);
      f += TIMING.drop[tier];
      pick += 1;
    });
    tierWindow[tier] = { start, end: maxDrop };
    f += TIMING.tierTail;
  }

  const outroStart = maxDrop + TIMING.tierTail;
  const total = outroStart + TIMING.outroFrames;
  return { placements, tierWindow, outroStart, total };
}

export const SCHEDULE = buildSchedule();
export const TOTAL = SCHEDULE.total;

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const cubic = (a: number, b: number, c: number, d: number, t: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

export type FlightState = { pos: Vec; phase: "tray" | "flight" | "placed"; airborne: number };

/** Where a logo is at `frame`, and how far into its flight (0..1). */
export const flightState = (p: Placement, frame: number): FlightState => {
  const start = traySlotCenter(p.pickIndex);
  const end = slotCenter(p.tier, p.slotIndex);
  if (frame <= p.flightStart) return { pos: start, phase: "tray", airborne: 0 };
  if (frame >= p.dropFrame) return { pos: end, phase: "placed", airborne: 1 };
  const raw = (frame - p.flightStart) / (p.dropFrame - p.flightStart);
  const t = easeInOut(raw);
  const peak = Math.min(start.y, end.y) - 150;
  const c1 = { x: start.x + (end.x - start.x) * 0.25, y: peak };
  const c2 = { x: start.x + (end.x - start.x) * 0.75, y: peak };
  return {
    pos: { x: cubic(start.x, c1.x, c2.x, end.x, t), y: cubic(start.y, c1.y, c2.y, end.y, t) },
    phase: "flight",
    airborne: raw,
  };
};

/** The one description chip showing at `frame` — the most recent landed logo. */
export const activeChip = (frame: number): Placement | null => {
  let best: Placement | null = null;
  for (const p of SCHEDULE.placements) {
    if (p.dropFrame <= frame && frame < p.dropFrame + TIMING.chipDwell[p.tier]) {
      if (!best || p.dropFrame > best.dropFrame) best = p;
    }
  }
  return best;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Cursor position at `frame`: rides the airborne logo, else glides to the next pickup. */
export const cursorAt = (frame: number): Vec => {
  let inflight: Placement | null = null;
  for (const p of SCHEDULE.placements) {
    if (p.flightStart <= frame && frame < p.dropFrame) {
      if (!inflight || p.flightStart > inflight.flightStart) inflight = p;
    }
  }
  if (inflight) return flightState(inflight, frame).pos;

  let prev: Placement | null = null;
  let next: Placement | null = null;
  for (const p of SCHEDULE.placements) {
    if (p.dropFrame <= frame && (!prev || p.dropFrame > prev.dropFrame)) prev = p;
    if (p.flightStart > frame && (!next || p.flightStart < next.flightStart)) next = p;
  }
  if (!next) return prev ? slotCenter(prev.tier, prev.slotIndex) : traySlotCenter(0);
  const to = traySlotCenter(next.pickIndex);
  if (!prev) return to;
  const from = slotCenter(prev.tier, prev.slotIndex);
  const t = easeInOut(
    Math.max(0, Math.min(1, (frame - prev.dropFrame) / Math.max(1, next.flightStart - prev.dropFrame))),
  );
  return { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) };
};

export type Camera = { scale: number; tx: number; ty: number; rotX: number; rotY: number; persp: number };

const opts = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Camera keyframes: establish wide, then for each tier lift out (transition) and
// dive in (focus, tracking the cursor), then pull back at the end.
const boardTop = LAYOUT.board.top;
const boardBottom = boardTop + TIERS.length * LAYOUT.board.rowH;
const boardCenter = (boardTop + boardBottom) / 2;
const establishCy = (boardTop + LAYOUT.tray.bottom) / 2;

const kF: number[] = [0, TIMING.introFrames];
const kScale: number[] = [CAMERA.introPushFrom, CAMERA.establishScale];
const kCy: number[] = [establishCy, establishCy];
const kTrack: number[] = [0, 0];
for (const tier of FILL_ORDER) {
  const w = SCHEDULE.tierWindow[tier];
  if (!w) continue;
  kF.push(w.start - TIMING.tierLead * 0.6);
  kScale.push(CAMERA.transitionScale);
  kCy.push((rowGeometry(tier).center + boardCenter) / 2);
  kTrack.push(0);
  kF.push((w.start + w.end) / 2);
  kScale.push(CAMERA.focusScale);
  kCy.push(rowGeometry(tier).center);
  kTrack.push(1);
}
kF.push(SCHEDULE.outroStart, TOTAL);
kScale.push(CAMERA.outroScale, CAMERA.outroScale * 1.03);
kCy.push(boardCenter, boardCenter);
kTrack.push(0, 0);

/** A camera that never holds still — establishes, dives in tracking the cursor,
 * lifts out between rows, pulls back at the end, over a gently tilting plane. */
export const cameraAt = (frame: number): Camera => {
  const scale = interpolate(frame, kF, kScale, opts);
  const cyKey = interpolate(frame, kF, kCy, opts);
  const track = interpolate(frame, kF, kTrack, opts);
  const halfW = W / (2 * scale);
  const halfH = H / (2 * scale);
  let cx = W / 2;
  let cy = cyKey;
  if (scale > 1) {
    const cursorX = cursorAt(frame).x;
    cx = clampN(lerp(W / 2, cursorX, track), halfW, W - halfW);
    cy = clampN(cyKey, halfH, H - halfH);
  }
  const t = frame / FPS;
  const rotX = CAMERA.tiltBaseDeg + CAMERA.tiltOscDeg * Math.sin(t * 0.6);
  const rotY = CAMERA.swayDeg * Math.sin(t * 0.42 + 1);
  return { scale, tx: W / 2 - cx * scale, ty: H / 2 - cy * scale, rotX, rotY, persp: CAMERA.perspective };
};

/** The tier currently being filled — for a subtle row highlight. */
export const activeTierAt = (frame: number): Tier | null => {
  let active: Tier | null = null;
  for (const tier of FILL_ORDER) {
    const w = SCHEDULE.tierWindow[tier];
    if (w && frame >= w.start) active = tier;
  }
  return active;
};
