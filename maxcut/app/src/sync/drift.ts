// Drift — the state a sync group enters when a cut touches one peer and
// spares another. `syncOffsetFrames` records the slip; a caller-supplied flag
// separates "user nudged" from "cut drifted". We keep the distinction trivial
// because the truth is simple: the group is either aligned or it is not.
//
// Pure. Consumed by SyncBadge and useSyncActions.

import type { Clip } from "../project/schema";

export type DriftState = "synced" | "offsetPositive" | "offsetNegative" | "drifted";

export function driftOf(clip: Clip, opts?: { markedDrifted?: boolean }): DriftState {
  if (opts?.markedDrifted) return "drifted";
  const off = clip.syncOffsetFrames ?? 0;
  if (off === 0) return "synced";
  return off > 0 ? "offsetPositive" : "offsetNegative";
}

// Re-sync a group: apply `xcorrLag` frames so the residual offset becomes zero.
// Each group member has its `syncOffsetFrames` reduced by the lag. The lag is
// signed — positive means the group currently trails; subtracting restores it.
export function reSyncGroup(
  clips: Clip[],
  groupIds: string[],
  xcorrLag: number,
): Clip[] {
  if (xcorrLag === 0 || groupIds.length === 0) return clips;
  const set = new Set(groupIds);
  return clips.map((c) => {
    if (!set.has(c.id)) return c;
    const prev = c.syncOffsetFrames ?? 0;
    return { ...c, syncOffsetFrames: prev - xcorrLag };
  });
}
