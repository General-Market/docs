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

// The first turn illustration (turn-thin-field) — the indictment ends here.
export const TURN_AT = 482.045;

// ── Sub-parts — the teasing beats inside each chapter ────────────────────────
//
// Each chapter breaks into a few sub-beats. The card returns for each one, so
// progress is felt every 10–20s, not once a chapter. The labels do NOT explain
// (the diagram does that) — they TEASE: a short, edged line, knife pointed at
// the system, cut from what the speaker actually says at that second.
//
// Counts vary on purpose — never a flat three. The short chapters (07 Feed
// Latency, 10 API Rate Limits, 11 Funding Rate Edge) carry none; the card just
// names them and leaves. `at` is the final.mp4 second the sub-beat is spoken.

// `icon` is a lucide-react component name (PascalCase). The tag shows icons
// only — no text — as a stepper, so each one has to carry the meaning of the
// beat on its own. `label` is kept as the authoring note for what the icon
// stands for; it is not rendered.
export type SubPart = { letter: string; label: string; icon: string; at: number };

export const SUBPARTS: Record<number, SubPart[]> = {
  1: [
    { letter: "a", label: "They live in the machine", icon: "Server", at: 43.4 },
    { letter: "b", label: "Your backtest was fiction", icon: "Rewind", at: 60.8 },
  ],
  2: [
    { letter: "a", label: "The good trades aren't for you", icon: "Lock", at: 75.0 },
    { letter: "b", label: "Priced into gambling", icon: "Dice5", at: 96.6 },
  ],
  3: [
    { letter: "a", label: "Winning is just a purchase", icon: "ShoppingCart", at: 119.2 },
    { letter: "b", label: "Someone pays. It's you.", icon: "Wallet", at: 140.0 },
  ],
  4: [
    { letter: "a", label: "They knew before you did", icon: "Eye", at: 150.6 },
    { letter: "b", label: "A thousand small deaths", icon: "Droplet", at: 173.6 },
  ],
  5: [
    { letter: "a", label: "They bought your hand", icon: "ScanEye", at: 185.1 },
    { letter: "b", label: "You'll never hold the key", icon: "KeyRound", at: 206.7 },
    { letter: "c", label: "The book is the trap", icon: "BookLock", at: 221.0 },
  ],
  6: [
    { letter: "a", label: "The house is your counterparty", icon: "Building2", at: 230.5 },
    { letter: "b", label: "Zero fees cost you more", icon: "BadgePercent", at: 254.0 },
  ],
  8: [
    { letter: "a", label: "First in line, for a fee", icon: "ListOrdered", at: 288.0 },
    { letter: "b", label: "You're the sandwich", icon: "Layers", at: 298.4 },
    { letter: "c", label: "The queue was never yours", icon: "Users", at: 308.0 },
  ],
  9: [
    { letter: "a", label: "They vanish before you can", icon: "CircleX", at: 322.2 },
    { letter: "b", label: "Bled on every trade", icon: "Droplet", at: 347.6 },
  ],
  12: [
    { letter: "a", label: "Paid to outbid you", icon: "HandCoins", at: 384.5 },
    { letter: "b", label: "They profit while losing", icon: "TrendingUp", at: 400.0 },
    { letter: "c", label: "Nothing left for you", icon: "CircleSlash2", at: 419.3 },
  ],
  13: [
    { letter: "a", label: "Too profitable to survive", icon: "Flame", at: 438.5 },
    { letter: "b", label: "Your loss is their gift", icon: "Gift", at: 446.0 },
  ],
};

// ── Two transient signals — the chapter card and the sub-part tag ────────────
//
// They are separate now. The chapter card (right edge) shows ONLY at a chapter
// change and closes when nothing is happening. The sub-part tag is a small
// icon-in-a-square + one line, down where the captions sit; it pops at each
// sub-beat and leaves. Together: chapter progress on the side, beat progress at
// the foot.

const CARD_HOLD = 3.0; // seconds the chapter card stays after a chapter begins
const TAG_HOLD = 3.0; // seconds the sub-part tag stays after a sub-beat fires

export type ChapterCard = { chapterIdx: number; start: number; end: number };

// The chapter card to show at `sec`, or null — the latest chapter whose intro
// window still covers it.
export function activeChapterCard(sec: number): ChapterCard | null {
  let idx = -1;
  for (let i = 0; i < CHAPTERS.length; i++) {
    if (sec >= CHAPTERS[i].at && sec < CHAPTERS[i].at + CARD_HOLD) idx = i;
  }
  if (idx < 0) return null;
  return { chapterIdx: idx, start: CHAPTERS[idx].at, end: CHAPTERS[idx].at + CARD_HOLD };
}

export type SubTag = {
  chapterIdx: number;
  subIdx: number;
  /** how many sub-parts the chapter has — for the progress squares. */
  total: number;
  start: number;
  end: number;
};

const SUB_BEATS: { at: number; chapterIdx: number; subIdx: number; total: number }[] = (() => {
  const out: { at: number; chapterIdx: number; subIdx: number; total: number }[] = [];
  CHAPTERS.forEach((ch, ci) => {
    const subs = SUBPARTS[ch.n] ?? [];
    subs.forEach((s, si) => out.push({ at: s.at, chapterIdx: ci, subIdx: si, total: subs.length }));
  });
  return out.sort((a, b) => a.at - b.at);
})();

// The sub-part tag to show at `sec`, or null — the latest sub-beat whose window
// still covers it.
export function activeSubTag(sec: number): SubTag | null {
  let best: (typeof SUB_BEATS)[number] | null = null;
  for (const b of SUB_BEATS) {
    if (sec >= b.at && sec < b.at + TAG_HOLD) best = b;
  }
  if (!best) return null;
  return {
    chapterIdx: best.chapterIdx,
    subIdx: best.subIdx,
    total: best.total,
    start: best.at,
    end: best.at + TAG_HOLD,
  };
}

// ── Board width + presence — for the head push ───────────────────────────────
//
// The chapter board is the full-height right strip (≈30%, ~4.5 numbers visible,
// the live one pinned at the second slot). It is transient — only up while a
// chapter card is active — so AntiCheatLayout reads this presence to ease the
// head into the remaining width WHILE the board is up, and back to full frame
// once it closes. ChapterRail uses the same curve to slide itself in/out, so the
// push and the slide stay locked.
export const BOARD_W = Math.round(1920 * 0.3); // 576
export const CARD_SLIDE = 0.42; // seconds the board slides in / out

const _clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const _smooth = (a: number, b: number, x: number): number => {
  const t = _clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function chapterCardPresence(sec: number): number {
  const c = activeChapterCard(sec);
  if (!c) return 0;
  const inn = _smooth(c.start, c.start + CARD_SLIDE, sec);
  const out = 1 - _smooth(c.end - CARD_SLIDE, c.end, sec);
  return Math.min(inn, out);
}
