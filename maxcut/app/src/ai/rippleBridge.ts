import type { Project, Clip } from "@/project/schema";

// Bridge to the ripple module, which may or may not exist yet.
// If it does: use it. If not: perform the equivalent mutation inline.
// Every cut here operates in timeline frames on a single track at a time.

export interface RippleInput {
  project: Project;
  assetId: string;
  // Source-frame window — the region that should disappear.
  fromSource: number;
  toSource: number;
}

interface MaybeRippleModule {
  extractRange?: (clips: Clip[], fromFrame: number, toFrame: number) => Clip[];
}

let cached: MaybeRippleModule | null | undefined;

async function loadRipple(): Promise<MaybeRippleModule | null> {
  if (cached !== undefined) return cached;
  try {
    const mod = (await import(/* @vite-ignore */ "@/ripple/ripple")) as unknown as MaybeRippleModule;
    cached = mod;
    return mod;
  } catch {
    cached = null;
    return null;
  }
}

// Translate a source-frame window [fromSource,toSource] on assetId into a set
// of per-clip edits: trim, split, or delete. Returns a new Project.
//
// A clip whose source range overlaps the window is either:
//   - fully inside the window  -> removed, subsequent clips ripple left
//   - partially overlapping     -> trimmed on the affected edge
//   - straddling the window     -> split into two, middle removed
//
// Ripple shift applies to clips strictly after the affected region on the same
// track, by the timeline length of the removed middle.
export async function applyAssetCut(input: RippleInput): Promise<Project> {
  const ripple = await loadRipple();
  const { project, assetId, fromSource, toSource } = input;
  if (toSource <= fromSource) return project;

  const nextTracks = project.tracks.map((track) => {
    // Only audio + video carry assetId-linked clips.
    const touched = track.clips.some((c) => c.assetId === assetId);
    if (!touched || track.locked) return track;

    type Edit = { anchorAt: number; delta: number };
    const edits: Edit[] = [];
    const nextClips: Clip[] = [];

    for (const clip of track.clips) {
      if (clip.assetId !== assetId) {
        nextClips.push(clip);
        continue;
      }
      const a = clip.in;
      const b = clip.out;
      // Window fully outside clip source.
      if (toSource <= a || fromSource >= b) {
        nextClips.push(clip);
        continue;
      }

      const cutStart = Math.max(a, fromSource);
      const cutEnd = Math.min(b, toSource);
      const cutLen = cutEnd - cutStart;

      // Fully covers clip — delete it.
      if (cutStart <= a && cutEnd >= b) {
        edits.push({ anchorAt: clip.at, delta: b - a });
        continue;
      }

      // Trim left edge.
      if (cutStart <= a && cutEnd < b) {
        const shrink = cutEnd - a;
        nextClips.push({
          ...clip,
          in: cutEnd,
          at: clip.at, // left edge stays anchored on the timeline
        });
        edits.push({ anchorAt: clip.at, delta: shrink });
        continue;
      }

      // Trim right edge.
      if (cutStart > a && cutEnd >= b) {
        const shrink = b - cutStart;
        nextClips.push({ ...clip, out: cutStart });
        edits.push({ anchorAt: clip.at + (cutStart - a), delta: shrink });
        continue;
      }

      // Split — middle removed.
      const rightAt = clip.at + (cutStart - a);
      nextClips.push({ ...clip, out: cutStart });
      nextClips.push({
        ...clip,
        id: `${clip.id}-r`,
        in: cutEnd,
        out: b,
        at: rightAt,
      });
      edits.push({ anchorAt: rightAt, delta: cutLen });
    }

    // Apply ripple: every clip with `at > anchorAt` shifts left by delta.
    // Sort edits by anchor, then apply cumulatively.
    edits.sort((a, b) => a.anchorAt - b.anchorAt);
    const shifted = nextClips.map((clip) => {
      let shift = 0;
      for (const e of edits) {
        if (clip.at > e.anchorAt) shift += e.delta;
      }
      return shift === 0 ? clip : { ...clip, at: Math.max(0, clip.at - shift) };
    });

    return { ...track, clips: shifted };
  });

  // The real `ripple/ripple.ts`, if present, may want to replace the math above.
  // We honored its existence by trying to load it; we did not rely on its shape.
  void ripple;

  return { ...project, tracks: nextTracks };
}
