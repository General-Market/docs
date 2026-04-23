// Ducking envelope from transcript words.
// For each word: ramp down (attack) → hold at duckDb through the word → ramp up (release).
// Output is a sparse gain envelope in dB relative to the clip's volumeDb.
// Overlapping words merge: the envelope stays ducked across gaps shorter than the release.

import type { Word, GainKeyframe } from "../project/schema";

export function buildDuckingEnvelope(
  words: Word[],
  duckDb = -12,
  attackMs = 150,
  releaseMs = 400,
  projectFps = 60,
): GainKeyframe[] {
  if (words.length === 0) return [];

  const msToFrames = projectFps / 1000;
  const attackFrames = Math.max(1, Math.round(attackMs * msToFrames));
  const releaseFrames = Math.max(1, Math.round(releaseMs * msToFrames));

  // Word timings in schema are seconds (see WordSchema). Convert to frames.
  const secToFrames = projectFps;

  // Merge overlapping / near-adjacent ducked spans.
  type Span = { start: number; end: number };
  const raw: Span[] = words
    .map((w) => ({
      start: Math.round(w.start * secToFrames),
      end: Math.round(w.end * secToFrames),
    }))
    .sort((a, b) => a.start - b.start);

  const merged: Span[] = [];
  for (const s of raw) {
    const prev = merged[merged.length - 1];
    if (prev && s.start <= prev.end + releaseFrames + attackFrames) {
      prev.end = Math.max(prev.end, s.end);
    } else {
      merged.push({ start: s.start, end: s.end });
    }
  }

  const env: GainKeyframe[] = [];
  for (const span of merged) {
    const attackStart = Math.max(0, span.start - attackFrames);
    const holdStart = span.start;
    const holdEnd = span.end;
    const releaseEnd = span.end + releaseFrames;

    env.push({ frame: attackStart, db: 0 });
    env.push({ frame: holdStart, db: duckDb });
    env.push({ frame: holdEnd, db: duckDb });
    env.push({ frame: releaseEnd, db: 0 });
  }

  return env;
}
