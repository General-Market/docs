// Pure ripple math. No React, no stores, no side effects.
// The per-track functions operate on one track's clip array. The project-
// level wrappers (`rippleTrimProject`, `splitAtFrameProject`) walk tracks
// and honour `linkedTo` across them.
//
// Convention: a clip occupies timeline frames [at, at + (out - in)).
// Duration on the timeline is always (out - in) — source bounds define length.

import type { Clip, Project, Track } from "../project/schema";

export type Edge = "left" | "right";

function clipDuration(c: Clip): number {
  return c.out - c.in;
}

function clipEnd(c: Clip): number {
  return c.at + clipDuration(c);
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function cloneClip(c: Clip, overrides: Partial<Clip> = {}): Clip {
  return {
    ...c,
    linkedTo: [...c.linkedTo],
    gainEnvelope: c.gainEnvelope.map((k) => ({ ...k })),
    audioFade: c.audioFade ? { ...c.audioFade } : undefined,
    transform: c.transform ? { ...c.transform } : undefined,
    ...overrides,
  };
}

/**
 * Trim the named clip at the given edge to `newFrameOnTimeline`, then shift
 * every following clip on the same track by the delta of the clip's end.
 *
 * Left edge moves `in` and `at` together — the trimmed material at the head
 * stays on the source side, not the timeline side.
 * Right edge moves `out` only.
 *
 * `linkedTo` shifts are the caller's responsibility at the project level;
 * within one track array, we shift only the same-track followers. See
 * `rippleTrimProject` for the project-wide wrapper.
 */
export function rippleTrim(
  clips: Clip[],
  clipId: string,
  edge: Edge,
  newFrameOnTimeline: number,
): Clip[] {
  const idx = clips.findIndex((c) => c.id === clipId);
  if (idx < 0) return clips;
  const target = clips[idx];
  const oldEnd = clipEnd(target);
  let next: Clip;

  if (edge === "left") {
    // newFrameOnTimeline is the new `at`. Shift `in` by the same delta.
    const deltaAt = newFrameOnTimeline - target.at;
    const newIn = target.in + deltaAt;
    // Clamp so `in` stays at or below `out` and non-negative on source.
    const clampedIn = Math.max(0, Math.min(target.out, newIn));
    const clampedAt = target.at + (clampedIn - target.in);
    next = cloneClip(target, { in: clampedIn, at: clampedAt });
  } else {
    // newFrameOnTimeline is the new end on timeline; derive new `out`.
    const newOut = target.in + (newFrameOnTimeline - target.at);
    const clampedOut = Math.max(target.in, newOut);
    next = cloneClip(target, { out: clampedOut });
  }

  const newEnd = clipEnd(next);
  const shift = newEnd - oldEnd;

  return clips.map((c, i) => {
    if (i === idx) return next;
    if (c.at > target.at) return cloneClip(c, { at: c.at + shift });
    return c;
  });
}

/**
 * Remove a clip from a single-track array and collapse the gap: every
 * subsequent clip shifts back by the removed clip's timeline duration.
 */
export function rippleDelete(clips: Clip[], clipId: string): Clip[] {
  const target = clips.find((c) => c.id === clipId);
  if (!target) return clips;
  const dur = clipDuration(target);
  return clips
    .filter((c) => c.id !== clipId)
    .map((c) => (c.at > target.at ? cloneClip(c, { at: c.at - dur }) : c));
}

/** Remove a clip without disturbing its neighbours. A gap remains. */
export function lift(clips: Clip[], clipId: string): Clip[] {
  return clips.filter((c) => c.id !== clipId);
}

/**
 * Cut every clip that overlaps [fromFrame, toFrame), remove the middle,
 * ripple-shift everything after `toFrame` by -(toFrame - fromFrame).
 * Clips entirely inside the range vanish.
 */
export function extractRange(
  clips: Clip[],
  fromFrame: number,
  toFrame: number,
): Clip[] {
  if (toFrame <= fromFrame) return clips;
  const lifted = liftRange(clips, fromFrame, toFrame);
  const shift = toFrame - fromFrame;
  return lifted.map((c) =>
    c.at >= toFrame ? cloneClip(c, { at: c.at - shift }) : c,
  );
}

/**
 * Same as extractRange but leaves the gap. Clips spanning the range get
 * sliced in two; clips wholly inside disappear.
 */
export function liftRange(
  clips: Clip[],
  fromFrame: number,
  toFrame: number,
): Clip[] {
  if (toFrame <= fromFrame) return clips;
  const out: Clip[] = [];
  for (const c of clips) {
    const start = c.at;
    const end = clipEnd(c);
    // No overlap.
    if (end <= fromFrame || start >= toFrame) {
      out.push(c);
      continue;
    }
    // Wholly inside — gone.
    if (start >= fromFrame && end <= toFrame) {
      continue;
    }
    // Overlaps on the left only — keep [start, fromFrame).
    if (start < fromFrame && end > fromFrame && end <= toFrame) {
      const cut = fromFrame - start;
      out.push(cloneClip(c, { out: c.in + cut }));
      continue;
    }
    // Overlaps on the right only — keep [toFrame, end).
    if (start >= fromFrame && start < toFrame && end > toFrame) {
      const skip = toFrame - start;
      out.push(cloneClip(c, { in: c.in + skip, at: toFrame }));
      continue;
    }
    // Spans the whole range — split into head + tail, discard middle.
    const headLen = fromFrame - start;
    const tailSkip = toFrame - start;
    const head = cloneClip(c, {
      id: newId(),
      out: c.in + headLen,
    });
    const tail = cloneClip(c, {
      id: newId(),
      in: c.in + tailSkip,
      at: toFrame,
    });
    out.push(head, tail);
  }
  return out;
}

/**
 * Split every clip on this track at `frame` if the frame falls strictly
 * inside the clip. Both halves preserve `linkedTo` — sync group members
 * must be split at the same timeline frame by the caller.
 */
export function splitAtFrame(clips: Clip[], frame: number): Clip[] {
  const out: Clip[] = [];
  for (const c of clips) {
    const start = c.at;
    const end = clipEnd(c);
    if (frame <= start || frame >= end) {
      out.push(c);
      continue;
    }
    const headLen = frame - start;
    const head = cloneClip(c, {
      id: newId(),
      out: c.in + headLen,
    });
    const tail = cloneClip(c, {
      id: newId(),
      in: c.in + headLen,
      at: frame,
    });
    out.push(head, tail);
  }
  return out;
}

/**
 * Deep-copy the named clip with a new id. Insert at `insertAt` frame when
 * provided; otherwise append immediately after the last clip on the track.
 */
export function duplicateClip(
  clips: Clip[],
  clipId: string,
  insertAt?: number,
): Clip[] {
  const source = clips.find((c) => c.id === clipId);
  if (!source) return clips;
  const last = clips.reduce((acc, c) => Math.max(acc, clipEnd(c)), 0);
  const at = insertAt ?? last;
  const copy = cloneClip(source, {
    id: newId(),
    at,
    // Duplicates are detached from the original sync group. Linking is explicit.
    linkedTo: [],
  });
  return [...clips, copy];
}

// ---------- Project-level wrappers: honour `linkedTo` across tracks. ----------

function findClipAcrossTracks(
  tracks: Track[],
  clipId: string,
): { track: Track; clip: Clip } | null {
  for (const t of tracks) {
    const c = t.clips.find((x) => x.id === clipId);
    if (c) return { track: t, clip: c };
  }
  return null;
}

function mapTrackClips(
  tracks: Track[],
  trackId: string,
  fn: (clips: Clip[]) => Clip[],
): Track[] {
  return tracks.map((t) =>
    t.id === trackId ? { ...t, clips: fn(t.clips) } : t,
  );
}

/**
 * Trim a clip and ripple its own track, then shift every `linkedTo` group
 * member on other tracks by the same end-delta — plus any clips that follow
 * those members on their own tracks, so the ripple is consistent.
 */
export function rippleTrimProject(
  project: Project,
  clipId: string,
  edge: Edge,
  newFrameOnTimeline: number,
): Project {
  const found = findClipAcrossTracks(project.tracks, clipId);
  if (!found) return project;

  const { track, clip } = found;
  const oldEnd = clip.at + (clip.out - clip.in);

  // Apply on primary track first so we can measure the actual delta.
  let nextTracks = mapTrackClips(project.tracks, track.id, (cs) =>
    rippleTrim(cs, clipId, edge, newFrameOnTimeline),
  );

  const newPrimary = nextTracks
    .flatMap((t) => t.clips)
    .find((c) => c.id === clipId);
  if (!newPrimary) return { ...project, tracks: nextTracks };
  const newEnd = newPrimary.at + (newPrimary.out - newPrimary.in);
  const shift = newEnd - oldEnd;

  if (shift === 0 || clip.linkedTo.length === 0) {
    return { ...project, tracks: nextTracks };
  }

  // For each linked member, shift the member itself and every later clip on
  // its track by the same delta. The member's position on its own track is
  // assumed to mirror the primary; we don't retrim it, only translate.
  const linkedIds = new Set(clip.linkedTo);
  nextTracks = nextTracks.map((t) => {
    if (t.id === track.id) return t;
    const hasLinked = t.clips.some((c) => linkedIds.has(c.id));
    if (!hasLinked) return t;
    return {
      ...t,
      clips: t.clips.map((c) => {
        if (linkedIds.has(c.id)) {
          return { ...c, at: c.at + shift };
        }
        // Shift followers on this track so the gap closes / opens uniformly.
        if (c.at > clip.at) {
          return { ...c, at: c.at + shift };
        }
        return c;
      }),
    };
  });

  return { ...project, tracks: nextTracks };
}

/**
 * Split at a timeline frame across every unlocked track. A clip linked to
 * a clip being split is split at the same frame — the pieces inherit the
 * group, so both heads link to each other and both tails link to each other.
 */
export function splitAtFrameProject(
  project: Project,
  frame: number,
): Project {
  const tracks = project.tracks.map((t) =>
    t.locked ? t : { ...t, clips: splitAtFrame(t.clips, frame) },
  );
  return { ...project, tracks };
}

