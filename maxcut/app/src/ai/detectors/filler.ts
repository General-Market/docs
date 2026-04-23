import type { CutSuggestion, Word } from "@/project/schema";

type Suggestion = Omit<CutSuggestion, "id" | "status" | "assetId">;

// The words people use when they have nothing to say. A partial list.
export const DEFAULT_FILLERS = [
  "um",
  "uh",
  "hmm",
  "like",
  "you know",
  "sort of",
  "i mean",
  "right?",
  "so",
  "actually",
  "basically",
];

export interface FillerOpts {
  fps?: number;
}

function normalize(s: string): string {
  // Strip punctuation that doesn't carry meaning, lowercase, collapse whitespace.
  return s
    .toLowerCase()
    .replace(/[.,!;:"']/g, "")
    .trim();
}

function wordMatches(word: string, token: string): boolean {
  // Filler dictionary entries may keep punctuation (e.g. "right?"). Compare both
  // with trailing-punctuation-stripped forms, so "um," in transcript hits "um".
  const a = normalize(word);
  const b = normalize(token);
  if (a === b) return true;
  // Allow literal match too — "right?" in dict should also hit "right?" verbatim.
  return word.toLowerCase().trim() === token.toLowerCase().trim();
}

export function detectFillers(
  words: Word[],
  dict: string[] = DEFAULT_FILLERS,
  opts: FillerOpts = {},
): Suggestion[] {
  const fps = opts.fps ?? 60;
  const out: Suggestion[] = [];

  // Split dict into single-word and multi-word phrases. Match multi-word first
  // so "you know" wins over "you" + "know" collisions with hypothetical entries.
  const phrases = dict.map((p) => ({
    raw: p,
    tokens: normalize(p).split(/\s+/).filter(Boolean),
  }));
  phrases.sort((a, b) => b.tokens.length - a.tokens.length);

  const consumed = new Array<boolean>(words.length).fill(false);

  for (let i = 0; i < words.length; i++) {
    if (consumed[i]) continue;

    for (const phrase of phrases) {
      const n = phrase.tokens.length;
      if (n === 0) continue;
      if (i + n > words.length) continue;

      let allMatch = true;
      for (let k = 0; k < n; k++) {
        if (consumed[i + k] || !wordMatches(words[i + k].text, phrase.tokens[k])) {
          allMatch = false;
          break;
        }
      }
      if (!allMatch) continue;

      const startSec = words[i].start;
      const endSec = words[i + n - 1].end;
      const text = words.slice(i, i + n).map((w) => w.text).join(" ");

      out.push({
        kind: "filler",
        start: Math.round(startSec * fps),
        end: Math.round(endSec * fps),
        text,
        confidence: n === 1 ? 1 : 0.8,
      });

      for (let k = 0; k < n; k++) consumed[i + k] = true;
      break;
    }
  }

  return out;
}
