// Pure derivations off config + data. No React, no rendering — just geometry
// and the placement schedule. The reel reads everything from here, so a knob
// changed in config.ts ripples through layout, timing and total duration.

import { interpolate } from "remotion";
import { SOURCES, type Tier, type TierSource } from "./data";
import { CAMERA, FILL_ORDER, LAYOUT, TIERS, TIMING, W, H } from "./config";

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

const trackWidth = LAYOUT.board.trackRight - LAYOUT.board.trackX;

/** Tile edge length for a row — shrinks so a crowded row still fits the track. */
export const tileSizeFor = (tier: Tier): number => {
  const n = byTier(tier).length;
  if (n === 0) return LAYOUT.tile.base;
  const fit = (trackWidth - LAYOUT.tile.gap * (n - 1)) / n;
  return Math.max(LAYOUT.tile.min, Math.min(LAYOUT.tile.base, fit));
};

/** Centre of slot `i` in a tier row. */
export const slotCenter = (tier: Tier, i: number): Vec => {
  const size = tileSizeFor(tier);
  const n = byTier(tier).length;
  const used = n * size + LAYOUT.tile.gap * (n - 1);
  const startX = LAYOUT.board.trackX + (trackWidth - used) / 2;
  return {
    x: startX + i * (size + LAYOUT.tile.gap) + size / 2,
    y: rowGeometry(tier).center,
  };
};

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

export type Camera = { scale: number; tx: number; ty: number };

const focusCy = (tier: Tier) =>
  rowGeometry(tier).center * (1 - CAMERA.focusBias) + 540 * CAMERA.focusBias;

const camFrames: number[] = [0, TIMING.introFrames];
const camScale: number[] = [CAMERA.introScale, 1];
const camCy: number[] = [CAMERA.introCy, 540];
for (const tier of FILL_ORDER) {
  const w = SCHEDULE.tierWindow[tier];
  if (!w) continue;
  camFrames.push((w.start + w.end) / 2);
  camScale.push(CAMERA.focusScale);
  camCy.push(focusCy(tier));
}
camFrames.push(SCHEDULE.outroStart, TOTAL);
camScale.push(CAMERA.outroScale, 1.02);
camCy.push(CAMERA.outroCy, CAMERA.outroCy);

const opts = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Camera transform at `frame` — a continuous glide up the board, then a pull-back. */
export const cameraAt = (frame: number): Camera => {
  const scale = interpolate(frame, camFrames, camScale, opts);
  const cy = interpolate(frame, camFrames, camCy, opts);
  const cx = W / 2;
  return { scale, tx: W / 2 - cx * scale, ty: H / 2 - cy * scale };
};
