// Emphasis captions — the data layer for CaptionLayer.
//
// Viral-YouTube karaoke captions: one short spoken clause per MAIN POINT, each
// word carrying its exact play-time so it pops in on the frame it is spoken.
// One punchy noun per clause is the highlight (the keyword the point turns on:
// "winning" odds, the "same bay", "statistical" edge, "farmed").
//
// Word timings are pulled from a word-level transcript of final.mp4 (mlx_whisper
// large-v3-turbo, language=en, word_timestamps). They are NOT hand-faked — each
// `start`/`end` is the speaker's actual play-time in the 1.2× baked cut, so the
// karaoke reveal tracks the audio to ~1 frame. See scripts notes below.
//
// Restraint is the spec: ~12 captions across the 10:48 talk, placed only on
// points that carry NO side-panel illustration, and each window was checked
// against panelEvents.ts so no caption ever overlaps an active panel. Do not
// caption every sentence — the director asked not to overdo it.
//
// Rebuild data: /tmp/build_captions.py (matches clauses to the transcript,
// re-validates panel overlap, strips trailing punctuation for display).

export type CaptionWord = {
  /** the word as spoken (display token). */
  w: string;
  /** final.mp4 play-time, seconds, where the word begins. Drives the reveal. */
  start: number;
  /** final.mp4 play-time, seconds, where the word ends. */
  end: number;
};

export type Caption = {
  /** the spoken clause, word by word, each carrying its own play-time. */
  words: CaptionWord[];
  /** index into `words` of the keyword to highlight (the punchy noun). */
  highlight: number;
};

export const CAPTIONS: Caption[] = [
  // Intro — the mission line ("the same winning odds than the biggest players").
  {
    highlight: 3,
    words: [
      { w: "have", start: 22.86, end: 22.98 },
      { w: "the", start: 22.98, end: 23.08 },
      { w: "same", start: 23.08, end: 23.22 },
      { w: "winning", start: 23.22, end: 23.5 },
      { w: "odds", start: 23.5, end: 23.92 },
    ],
  },
  // 01 Colocation — the vivid image: servers in the same bay as the books.
  {
    highlight: 0,
    words: [
      { w: "servers", start: 46.84, end: 47.32 },
      { w: "in", start: 47.32, end: 47.7 },
      { w: "the", start: 47.7, end: 47.86 },
      { w: "same", start: 47.86, end: 48.14 },
      { w: "bay", start: 48.14, end: 48.48 },
    ],
  },
  // 02 Unfair fee tiers — the cost: the strategies left to you are worse.
  {
    highlight: 1,
    words: [
      { w: "less", start: 96.66, end: 96.82 },
      { w: "profitable", start: 96.82, end: 97.34 },
      { w: "more", start: 97.34, end: 97.76 },
      { w: "risky", start: 97.76, end: 98.14 },
    ],
  },
  // 05 Dealer flow visibility — what the edge actually requires.
  {
    highlight: 2,
    words: [
      { w: "you", start: 206.74, end: 206.94 },
      { w: "need", start: 206.94, end: 207.06 },
      { w: "private", start: 207.06, end: 207.3 },
      { w: "server", start: 207.3, end: 207.62 },
    ],
  },
  // 06 Order flow — the named mechanism, on the line the chart doesn't cover.
  {
    highlight: 0,
    words: [
      { w: "order", start: 226.82, end: 227.12 },
      { w: "flows", start: 227.12, end: 227.42 },
      { w: "So", start: 227.68, end: 227.94 },
      { w: "very", start: 227.94, end: 228.2 },
      { w: "few", start: 228.2, end: 228.44 },
    ],
  },
  // 07 Feed latency — the user's example phrase: the last to react loses it.
  {
    highlight: 2,
    words: [
      { w: "loses", start: 337.22, end: 337.56 },
      { w: "a", start: 337.56, end: 337.72 },
      { w: "statistical", start: 337.72, end: 338.12 },
      { w: "edge", start: 338.12, end: 338.52 },
    ],
  },
  // 12 Maker rebates — the maker takes all the liquidity, even at a loss.
  {
    highlight: 3,
    words: [
      { w: "take", start: 419.34, end: 419.54 },
      { w: "all", start: 419.54, end: 419.88 },
      { w: "the", start: 419.88, end: 420.08 },
      { w: "liquidity", start: 420.08, end: 420.48 },
    ],
  },
  // 13 Liquidation — your profitable position gets closed by the venue.
  {
    highlight: 3,
    words: [
      { w: "the", start: 439.74, end: 439.88 },
      { w: "exchange", start: 439.88, end: 440.12 },
      { w: "will", start: 440.12, end: 440.32 },
      { w: "close", start: 440.32, end: 440.74 },
      { w: "it", start: 440.74, end: 440.88 },
    ],
  },
  // Solution — distance stops mattering; no one is collocated to the books.
  {
    highlight: 1,
    words: [
      { w: "is", start: 501.66, end: 501.78 },
      { w: "collocated", start: 501.78, end: 502.26 },
      { w: "to", start: 502.26, end: 502.5 },
      { w: "our", start: 502.5, end: 502.62 },
      { w: "servers", start: 502.62, end: 502.92 },
    ],
  },
  // Solution — the edge is open: patterns everyone can access.
  {
    highlight: 0,
    words: [
      { w: "patterns", start: 536.54, end: 536.94 },
      { w: "that", start: 536.94, end: 537.42 },
      { w: "everyone", start: 537.42, end: 537.74 },
      { w: "can", start: 537.74, end: 537.96 },
      { w: "access", start: 537.96, end: 538.22 },
    ],
  },
  // Outro proof — these are only the cases that went to court.
  {
    highlight: 5,
    words: [
      { w: "the", start: 572.5, end: 572.62 },
      { w: "part", start: 572.62, end: 572.86 },
      { w: "that", start: 572.86, end: 573.1 },
      { w: "went", start: 573.1, end: 573.38 },
      { w: "to", start: 573.38, end: 573.52 },
      { w: "court", start: 573.52, end: 573.8 },
    ],
  },
  // Outro punchline — if you didn't pay, you're the one being farmed.
  {
    highlight: 5,
    words: [
      { w: "you", start: 627.46, end: 627.78 },
      { w: "are", start: 627.78, end: 627.94 },
      { w: "the", start: 627.94, end: 628.04 },
      { w: "one", start: 628.04, end: 628.2 },
      { w: "being", start: 628.2, end: 628.4 },
      { w: "farmed", start: 628.4, end: 628.7 },
    ],
  },
];

// First and last play-time of a caption — used by CaptionLayer to mount only
// the window around it (with a small lead-in and a held tail after the words).
export function captionStart(c: Caption): number {
  return c.words[0].start;
}
export function captionEnd(c: Caption): number {
  return c.words[c.words.length - 1].end;
}
