// The thirteen mechanisms, in spoken order — the single source of truth for
// both the section title cards (timeline.tsx) and the persistent ChapterRail.
//
// `at` is the final.mp4 second where the talk reaches that mechanism. These are
// the same play-times the title cards always used; pulling both name and time
// from here means the rail and the cards can never drift apart.
//
// The rail is live from just before mechanism 01 until TURN_AT — the moment the
// indictment ends and the answer begins. By the last chapter the whole rail is
// lit: thirteen cheats stacked in front of the viewer, right before the turn.

export type Chapter = {
  /** 1-based position in the spoken sequence. */
  n: number;
  /** Section name, shown on the title card and under the rail. */
  name: string;
  /** Compact label, for tight readouts. */
  short: string;
  /** final.mp4 seconds where this mechanism begins. */
  at: number;
};

export const CHAPTERS: Chapter[] = [
  // `at` values anchored to the real final.mp4 audio (parakeet transcript),
  // each set to the spoken cue minus a 0.3s lead so the card lands as the
  // mechanism is named — not seconds before it. See REALIGN-TITLE-CARDS.md.
  { n: 1, name: "Colocation", short: "Colocation", at: 27.30 },
  { n: 2, name: "Unfair Fee Tiers", short: "Fee tiers", at: 71.78 },
  { n: 3, name: "Maxing Out Advantages", short: "Maxing out", at: 112.98 },
  { n: 4, name: "Listing Front-Running", short: "Listing FR", at: 147.26 },
  { n: 5, name: "Dealer Flow Visibility", short: "Dealer flow", at: 178.54 },
  { n: 6, name: "Order Flow", short: "Order flow", at: 225.78 },
  { n: 7, name: "Feed Latency", short: "Feed latency", at: 257.30 },
  { n: 8, name: "Matching & Queue Priority", short: "Queue priority", at: 280.18 },
  { n: 9, name: "Cancellation Priority", short: "Cancel priority", at: 318.98 },
  { n: 10, name: "API Rate Limits", short: "API limits", at: 352.62 },
  { n: 11, name: "Funding Rate Edge", short: "Funding edge", at: 364.70 },
  { n: 12, name: "Market-Maker Rebates", short: "Maker rebates", at: 381.58 },
  { n: 13, name: "Liquidation Engine Quirks", short: "Liquidation", at: 433.42 },
];

// The first turn illustration (turn-thin-field). The rail resolves and sweeps
// out here — the problem is fully named, and the answer begins.
export const TURN_AT = 482.045;

// ── Board layout + presence ──────────────────────────────────────────────────
//
// The chapter board claims a fixed slice of the RIGHT edge while it is live.
// AntiCheatLayout eases the head + panels into the remaining width by the SAME
// presence curve below, so the head's push-left and the board's slide-in are
// one locked motion — never a board floating over the speaker.
//
// RAIL_FRAC is the one number to turn if the board should be wider or thinner.
export const RAIL_FRAC = 0.3;
export const RAIL_W = Math.round(1920 * RAIL_FRAC); // 576

const RAIL_APPEAR_AT = CHAPTERS[0].at - 0.9; // slides in just before mechanism 01
const RAIL_ENTER = 0.8;
const RAIL_EXIT = 1.4;

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// 0 before the board appears and after it leaves at the turn; 1 while fully
// present. Eased, so the head push and the slide share one motion.
export function railPresence(sec: number): number {
  const enter = smoothstep(RAIL_APPEAR_AT, RAIL_APPEAR_AT + RAIL_ENTER, sec);
  const exit = 1 - smoothstep(TURN_AT, TURN_AT + RAIL_EXIT, sec);
  return Math.min(enter, exit);
}
