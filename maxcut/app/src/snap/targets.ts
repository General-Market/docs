// Pure snap-target collection. No React, no stores.
// Returns a sorted unique array of candidate *frame* numbers.
//
// The caller adds the playhead contextually — it changes on every tick and
// would force a recompute of the whole target set if we baked it in.

import type { Project } from "../project/schema";

export interface CollectOpts {
  includeWords?: boolean;
  excludeClipId?: string;
}

export function collectSnapTargets(
  project: Project,
  opts: CollectOpts = {},
): number[] {
  const { includeWords = false, excludeClipId } = opts;
  const targets = new Set<number>();

  for (const track of project.tracks) {
    for (const c of track.clips) {
      if (excludeClipId && c.id === excludeClipId) continue;
      const start = c.at;
      const end = c.at + (c.out - c.in);
      targets.add(start);
      targets.add(end);
    }
  }

  for (const m of project.markers) {
    targets.add(m.at);
  }

  if (includeWords) {
    const fps = project.meta.fps || 60;
    for (const t of project.transcripts) {
      for (const w of t.words) {
        // Words store seconds; convert to the project's frame rate.
        targets.add(Math.round(w.start * fps));
        targets.add(Math.round(w.end * fps));
      }
    }
  }

  return [...targets].sort((a, b) => a - b);
}
