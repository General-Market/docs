// Squarified treemap — Bruls / Huijbers / van Wijk. Single-level layout
// for the curator board: each curator is one cell, footprint area = TVL.

import type { Curator } from "./data";

export type Rect = { x: number; y: number; w: number; h: number };

export type LaidCell = {
  curator: Curator;
  rect: Rect;
};

function worstAspect(values: number[], length: number): number {
  if (length <= 0) return Infinity;
  let sum = 0;
  let max = -Infinity;
  let min = Infinity;
  for (const v of values) {
    sum += v;
    if (v > max) max = v;
    if (v < min) min = v;
  }
  if (sum <= 0 || min <= 0) return Infinity;
  const a = (length * length * max) / (sum * sum);
  const b = (sum * sum) / (length * length * min);
  return Math.max(a, b);
}

export function layoutTreemap(curators: Curator[], outer: Rect): LaidCell[] {
  if (curators.length === 0) return [];
  const area = outer.w * outer.h;
  const total = curators.reduce((s, c) => s + c.tvl, 0);
  if (total <= 0 || area <= 0) return [];

  const queue = curators
    .slice()
    .sort((a, b) => b.tvl - a.tvl)
    .map((c) => ({ src: c, scaled: (c.tvl / total) * area }));

  const out: LaidCell[] = [];
  let remaining: Rect = { ...outer };
  let row: typeof queue = [];

  const flushRow = () => {
    if (row.length === 0) return;
    const rowSum = row.reduce((s, x) => s + x.scaled, 0);
    const horizontal = remaining.w >= remaining.h;
    const shorter = Math.min(remaining.w, remaining.h);
    const thickness = rowSum / shorter;

    if (horizontal) {
      let cursor = remaining.y;
      for (const it of row) {
        const h = it.scaled / thickness;
        out.push({ curator: it.src, rect: { x: remaining.x, y: cursor, w: thickness, h } });
        cursor += h;
      }
      remaining = {
        x: remaining.x + thickness,
        y: remaining.y,
        w: remaining.w - thickness,
        h: remaining.h,
      };
    } else {
      let cursor = remaining.x;
      for (const it of row) {
        const w = it.scaled / thickness;
        out.push({ curator: it.src, rect: { x: cursor, y: remaining.y, w, h: thickness } });
        cursor += w;
      }
      remaining = {
        x: remaining.x,
        y: remaining.y + thickness,
        w: remaining.w,
        h: remaining.h - thickness,
      };
    }
    row = [];
  };

  while (queue.length > 0) {
    const shorter = Math.min(remaining.w, remaining.h);
    if (shorter <= 0) break;
    const next = queue[0];
    const trialValues = [...row.map((r) => r.scaled), next.scaled];
    const trialWorst = worstAspect(trialValues, shorter);
    const currentWorst =
      row.length === 0
        ? Infinity
        : worstAspect(row.map((r) => r.scaled), shorter);

    if (trialWorst <= currentWorst) {
      row.push(next);
      queue.shift();
    } else {
      flushRow();
    }
  }
  flushRow();

  return out;
}
