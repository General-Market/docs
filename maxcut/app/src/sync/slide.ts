// Slide — the U tool. Shift the target clip's `at` by delta; neighbors on the
// same track compensate. The preceding clip extends its `out`; the following
// clip retracts its `in`. The target's source window is untouched.
//
// Clamp so no clip is annihilated — every segment keeps at least one frame.

import type { Clip } from "../project/schema";

const MIN_LEN = 1;

export function slideClip(clips: Clip[], clipId: string, deltaFrames: number): Clip[] {
  const idx = clips.findIndex((c) => c.id === clipId);
  if (idx === -1 || deltaFrames === 0) return clips;

  // Work in track order — sort by `at` without mutating the input.
  const sorted = clips.map((c, i) => ({ c, i })).sort((a, b) => a.c.at - b.c.at);
  const pos = sorted.findIndex((x) => x.c.id === clipId);
  if (pos === -1) return clips;

  const target = sorted[pos].c;
  const prev = pos > 0 ? sorted[pos - 1].c : null;
  const next = pos < sorted.length - 1 ? sorted[pos + 1].c : null;

  const targetLen = target.out - target.in;
  const targetEnd = target.at + targetLen;

  // Bounds on delta so neither neighbor collapses below MIN_LEN.
  let minDelta = -Infinity;
  let maxDelta = Infinity;

  if (prev) {
    // prev extends its out by delta (source frames). prev-source max is prev.out's headroom.
    const prevLen = prev.out - prev.in;
    // Negative delta shrinks prev below MIN_LEN.
    minDelta = Math.max(minDelta, MIN_LEN - prevLen);
    // Positive delta requires prev to have unused source; we don't know total source length here,
    // so cap at the gap between prev.out on source and target.at's movement — keep it permissive
    // but bounded by target's available forward room before next.
  } else {
    // No preceding clip to extend — target cannot move left of 0.
    minDelta = Math.max(minDelta, -target.at);
  }

  if (next) {
    const nextLen = next.out - next.in;
    // Positive delta pushes target end into next; next retracts its `in` by delta.
    maxDelta = Math.min(maxDelta, nextLen - MIN_LEN);
    // Negative delta — next's `in` moves backward; source floor is 0.
    minDelta = Math.max(minDelta, -next.in);
  }

  // Target length stays constant — no direct target-len bound.
  const delta =
    deltaFrames > 0 ? Math.min(deltaFrames, maxDelta) : Math.max(deltaFrames, minDelta);
  if (delta === 0) return clips;

  return clips.map((c) => {
    if (c.id === target.id) {
      return { ...c, at: c.at + delta };
    }
    if (prev && c.id === prev.id) {
      return { ...c, out: c.out + delta };
    }
    if (next && c.id === next.id) {
      // Next starts later (delta > 0) or earlier (delta < 0).
      return { ...c, at: c.at + delta, in: c.in + delta };
    }
    return c;
  });
  // Referenced: `targetEnd` kept as local for reasoning; not emitted.
  void targetEnd;
}
