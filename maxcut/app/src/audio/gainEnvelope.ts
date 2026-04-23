// Gain envelope: sparse sorted keyframes, piecewise-linear interpolation in dB.
// All operations return new arrays. No in-place mutation.

import type { GainKeyframe } from "../project/schema";

function sortByFrame(env: GainKeyframe[]): GainKeyframe[] {
  return [...env].sort((a, b) => a.frame - b.frame);
}

/**
 * dB at a frame via piecewise-linear interpolation between keyframes.
 * Empty envelope → 0 dB. Before the first keyframe returns the first keyframe's dB;
 * after the last returns the last. Ties (equal frames) use the later value.
 */
export function gainAtFrame(env: GainKeyframe[], frame: number): number {
  if (env.length === 0) return 0;
  const sorted = sortByFrame(env);

  if (frame <= sorted[0].frame) return sorted[0].db;
  const last = sorted[sorted.length - 1];
  if (frame >= last.frame) return last.db;

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (frame >= a.frame && frame <= b.frame) {
      const span = b.frame - a.frame;
      if (span <= 0) return b.db;
      const t = (frame - a.frame) / span;
      return a.db + (b.db - a.db) * t;
    }
  }
  return last.db;
}

/** Insert a keyframe. If one already exists on that frame, replace its dB. */
export function addKeyframe(
  env: GainKeyframe[],
  kf: GainKeyframe,
): GainKeyframe[] {
  const filtered = env.filter((k) => k.frame !== kf.frame);
  return sortByFrame([...filtered, { frame: kf.frame, db: kf.db }]);
}

/** Remove any keyframe at the given frame. Missing frame → returns a copy. */
export function removeKeyframe(
  env: GainKeyframe[],
  frame: number,
): GainKeyframe[] {
  return env.filter((k) => k.frame !== frame);
}

/**
 * Move a keyframe from fromFrame to toFrame and set its dB to toDb.
 * If another keyframe already exists on toFrame (and it is not the one being moved),
 * it is replaced.
 */
export function moveKeyframe(
  env: GainKeyframe[],
  fromFrame: number,
  toFrame: number,
  toDb: number,
): GainKeyframe[] {
  const without = env.filter(
    (k) => k.frame !== fromFrame && k.frame !== toFrame,
  );
  return sortByFrame([...without, { frame: toFrame, db: toDb }]);
}
