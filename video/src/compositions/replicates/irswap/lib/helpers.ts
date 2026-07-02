// Shared math/sampling helpers for the IRSwap replica.

export type Pt = [number, number];
export type TrackRow = [number, number, number];

export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeOutPow = (t: number, p: number) => 1 - Math.pow(1 - clamp01(t), p);
export const easeInPow = (t: number, p: number) => Math.pow(clamp01(t), p);

// Linear sample of a [frame, value] table (clamped outside range).
export const lerp1 = (table: readonly (readonly [number, number])[], f: number): number => {
  if (f <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (f >= last[0]) return last[1];
  for (let i = 0; i < table.length - 1; i++) {
    const [f0, v0] = table[i];
    const [f1, v1] = table[i + 1];
    if (f >= f0 && f <= f1) {
      const t = f1 === f0 ? 0 : (f - f0) / (f1 - f0);
      return v0 + (v1 - v0) * t;
    }
  }
  return last[1];
};

// Linear sample of a [frame, x, y] track (clamped).
export const lerpTrack = (rows: readonly TrackRow[], f: number): Pt => {
  if (f <= rows[0][0]) return [rows[0][1], rows[0][2]];
  const last = rows[rows.length - 1];
  if (f >= last[0]) return [last[1], last[2]];
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if (f >= a[0] && f <= b[0]) {
      const t = b[0] === a[0] ? 0 : (f - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
  }
  return [last[1], last[2]];
};

// Cumulative arc lengths of a polyline. cum[i] = length up to point i.
export const polyArc = (poly: readonly Pt[]): { cum: number[]; total: number } => {
  const cum = [0];
  for (let i = 1; i < poly.length; i++) {
    const dx = poly[i][0] - poly[i - 1][0];
    const dy = poly[i][1] - poly[i - 1][1];
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  return { cum, total: cum[cum.length - 1] };
};

// Point at arc position s along polyline.
export const pointAtArc = (poly: readonly Pt[], cum: number[], s: number): Pt => {
  if (s <= 0) return [...poly[0]] as Pt;
  const total = cum[cum.length - 1];
  if (s >= total) return [...poly[poly.length - 1]] as Pt;
  let i = 1;
  while (cum[i] < s) i++;
  const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1]);
  return [
    poly[i - 1][0] + (poly[i][0] - poly[i - 1][0]) * t,
    poly[i - 1][1] + (poly[i][1] - poly[i - 1][1]) * t,
  ];
};

// Sub-polyline from arc 0 to s (includes interpolated end point).
export const polyUpToArc = (poly: readonly Pt[], cum: number[], s: number): Pt[] => {
  if (s <= 0) return [];
  const total = cum[cum.length - 1];
  if (s >= total) return poly.map((p) => [...p] as Pt);
  const out: Pt[] = [[...poly[0]] as Pt];
  let i = 1;
  while (cum[i] < s) {
    out.push([...poly[i]] as Pt);
    i++;
  }
  out.push(pointAtArc(poly, cum, s));
  return out;
};

// Force a [frame, value] table to be monotonically non-decreasing in value.
export const monotonic = (table: [number, number][]): [number, number][] => {
  const out: [number, number][] = [];
  let maxV = -Infinity;
  for (const [f, v] of table) {
    maxV = Math.max(maxV, v);
    out.push([f, maxV]);
  }
  return out;
};

// Arc position on `poly` closest to point q (searches sampled positions).
export const nearestArc = (
  poly: readonly Pt[],
  cum: number[],
  q: Pt,
  steps = 400,
): number => {
  const total = cum[cum.length - 1];
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i <= steps; i++) {
    const s = (total * i) / steps;
    const p = pointAtArc(poly, cum, s);
    const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
};
