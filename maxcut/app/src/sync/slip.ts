// Slip — the Y tool. Shift `in` and `out` in lockstep inside the source.
// `at` and duration do not move. The frame where the clip sits stays; only
// what the clip shows changes. The window slides. The wall does not.
//
// Pure. No store, no DOM.

import type { Clip } from "../project/schema";

export function slipClip(clip: Clip, deltaFrames: number, sourceDuration: number): Clip {
  const len = clip.out - clip.in;
  if (len <= 0) return clip;

  const maxIn = Math.max(0, sourceDuration - len);
  // Clamp the proposed `in` to [0, maxIn], then derive `out`.
  const proposedIn = clip.in + deltaFrames;
  const nextIn = Math.min(maxIn, Math.max(0, proposedIn));
  const nextOut = nextIn + len;

  if (nextIn === clip.in) return clip;
  return { ...clip, in: nextIn, out: nextOut };
}
