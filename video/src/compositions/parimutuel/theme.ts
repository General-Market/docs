// ParimutuelExplainer — timing + schedule.
//
// One continuous blue field; eight beats transform the content on top of it.
// Beats overlap by OVERLAP frames so their fade envelopes cross-dissolve
// rather than cut to the bare field between them.

export const FPS = 30;
export const W = 1920;
export const H = 1080;

export const sec = (s: number): number => Math.round(s * FPS);

/** Frames each beat overlaps the next — the cross-dissolve window. */
export const OVERLAP = 12;

/** Fade-in / fade-out length inside every beat (matches OVERLAP). */
export const EDGE = 12;

export type BeatKey =
  | "question"
  | "threshold"
  | "pot"
  | "flow"
  | "ballot"
  | "together"
  | "cost"
  | "guarantees"
  | "landing";

export const BEATS: { key: BeatKey; seconds: number }[] = [
  { key: "question", seconds: 5.0 },
  { key: "threshold", seconds: 5.5 },
  { key: "pot", seconds: 6.0 },
  { key: "flow", seconds: 6.0 },
  { key: "ballot", seconds: 6.5 },
  { key: "together", seconds: 6.0 },
  { key: "cost", seconds: 6.0 },
  { key: "guarantees", seconds: 6.5 },
  { key: "landing", seconds: 5.0 },
];

export type BeatSlot = {
  key: BeatKey;
  from: number;
  durationInFrames: number;
};

// Lay the beats end-to-end, pulling each one back by OVERLAP so its head
// fade overlaps the previous tail fade.
export const SCHEDULE: BeatSlot[] = (() => {
  const slots: BeatSlot[] = [];
  let cursor = 0;
  BEATS.forEach((b, i) => {
    const durationInFrames = sec(b.seconds);
    const from = i === 0 ? 0 : cursor - OVERLAP;
    slots.push({ key: b.key, from, durationInFrames });
    cursor = from + durationInFrames;
  });
  return slots;
})();

export const TOTAL_FRAMES =
  SCHEDULE[SCHEDULE.length - 1].from +
  SCHEDULE[SCHEDULE.length - 1].durationInFrames;
