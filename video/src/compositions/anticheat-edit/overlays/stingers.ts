// Stinger timeline — SFX derived from the overlay timelines, so the sound
// stays glued to the picture. One source of truth: OVERLAYS (chart beats) and
// ARTICLE_OVERLAYS (proof beats) own the timestamps; this file only adds the
// per-event offsets at which each sound fires.
//
// Mood: cold, designed, blue-steel, evidentiary — never cartoon. Brief hits in
// the gaps of the voice, sub-weighted, ducked. See EDIT-SURPRISES.md.
//
// Chart internals (frame 0 = overlay entry, MechanismChart.tsx):
//   f4  title glyph-reveal      → title transition
//   f14 bars spring up          → graph transition
//   f30 stat number lands       → number burst
// Article internals (articles.tsx): shockwave ring fires f4 (punch) / f8 (whip).

import { OVERLAYS } from "./timeline";
import { ARTICLE_OVERLAYS } from "./articles";

export type Hit = {
  /** final.mp4 seconds (absolute). */
  at: number;
  /** path under public/ (staticFile). */
  file: string;
  gain: number;
  /** seconds to hold the clip before fading out. */
  dur: number;
};

const lib = (f: string) => `sfx/${f}`; // shared public/sfx/
const own = (f: string) => `anticheat-edit/sfx/${f}`; // Epidemic adds for this edit

const hits: Hit[] = [];

// ─── Chart overlays: title transition + graph transition ────────────────────
OVERLAYS.forEach((slot, i) => {
  const t = slot.at;
  const isOverview = i === 0; // overview has no single highlight / stat callout

  // Title — the "case file opens" signature (identical on every chart).
  hits.push({ at: t + 0.13, file: lib("title-whoosh-hit.mp3"), gain: 0.28, dur: 1.5 });
  hits.push({ at: t + 0.2, file: lib("text-boom-short.mp3"), gain: 0.22, dur: 1.5 });

  // Graph — the data populates.
  hits.push({ at: t + 0.47, file: own("graph-riser.mp3"), gain: 0.26, dur: 3 });
  if (!isOverview) {
    hits.push({ at: t + 0.53, file: lib("magic-aura-pulse.mp3"), gain: 0.16, dur: 2 });
    hits.push({ at: t + 1.0, file: lib("burst-number-radiate.mp3"), gain: 0.24, dur: 2 });
  }
});

// ─── Article overlays: the proof slams down ─────────────────────────────────
ARTICLE_OVERLAYS.forEach((slot) => {
  const t = slot.at;
  if (slot.treatment === "punch") {
    hits.push({ at: t - 0.3, file: lib("transition-reverse-whoosh.mp3"), gain: 0.28, dur: 1.2 });
    hits.push({ at: t + 0.13, file: lib("impact-cinematic.mp3"), gain: 0.4, dur: 3 }); // ring f4
    hits.push({ at: t + 0.13, file: lib("hit-deep-sub.mp3"), gain: 0.3, dur: 3 });
    hits.push({ at: t + 0.27, file: own("glitch-data.mp3"), gain: 0.16, dur: 2 });
  } else if (slot.treatment === "whip") {
    hits.push({ at: t, file: lib("mg-whoosh-deep.mp3"), gain: 0.3, dur: 1.2 });
    hits.push({ at: t + 0.27, file: lib("impact-cinematic.mp3"), gain: 0.4, dur: 3 }); // ring f8
    hits.push({ at: t + 0.27, file: lib("hit-deep-sub.mp3"), gain: 0.3, dur: 3 });
    hits.push({ at: t + 0.4, file: own("glitch-data.mp3"), gain: 0.16, dur: 2 });
  } else {
    // fullscreen — absorb the weight; one designed whoosh-impact with a tail.
    hits.push({ at: t, file: own("article-slam.mp3"), gain: 0.34, dur: 5 });
  }
});

export const STINGER_HITS: Hit[] = hits.sort((a, b) => a.at - b.at);
