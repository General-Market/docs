import type { CutSuggestion, Word } from "@/project/schema";

type Suggestion = Omit<CutSuggestion, "id" | "status" | "assetId">;

export interface SilenceOpts {
  minGapMs?: number;
  fps?: number;
}

// Parakeet word timestamps are seconds. Gaps are the white between them.
// A silence is any gap >= minGapMs that nobody filled with a cough.
export function detectSilences(words: Word[], opts: SilenceOpts = {}): Suggestion[] {
  const minGapMs = opts.minGapMs ?? 300;
  const fps = opts.fps ?? 60;
  const out: Suggestion[] = [];

  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1];
    const next = words[i];
    const gapSec = next.start - prev.end;
    if (gapSec <= 0) continue;
    const gapMs = gapSec * 1000;
    if (gapMs < minGapMs) continue;

    out.push({
      kind: "silence",
      start: Math.round(prev.end * fps),
      end: Math.round(next.start * fps),
      text: `(silence ${Math.round(gapMs)}ms)`,
      confidence: Math.min(1, gapMs / 1000),
    });
  }

  return out;
}
