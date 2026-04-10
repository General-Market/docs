/**
 * Scene definitions for TalkingHeadLayout.
 *
 * ~85 scenes, 6 layout types, full video coverage (0–282.88s).
 * Rule: NEVER left→right or right→left directly.
 * Always pass through centered/centered-bottom between side switches.
 * Pattern: centered → side → centered → other side → centered → ...
 */

export type WebcamLayout =
  | "centered"
  | "centered-bottom"
  | "left-medium"
  | "right-medium"
  | "left-small"
  | "right-small";

export interface TalkingHeadScene {
  startSec: number;
  endSec: number;
  layout: WebcamLayout;
  /** Big title — supports \n for line breaks */
  title?: string;
  /** 0-indexed line to render in accent color */
  accentLine?: number;
  /** Smaller text below title */
  subtitle?: string;
  /** Pill badges */
  pills?: string[];
  /** staticFile() path for illustration */
  image?: string;
  /** Grid of logo images — { src: staticFile path, label: name } */
  logos?: { src: string; label: string }[];
  /** Label below webcam (centered-bottom only) */
  bottomLabel?: string;
  /** Logo image path (centered-bottom only) */
  bottomImage?: string;
}

export const SCENES: TalkingHeadScene[] = [
  // ── INTRO (0–48.6s) ─────────────────────────────────────────────
  // Pattern: C → R → C → L → C → R → C → L → C → R → C → L

  { startSec: 0.0, endSec: 3.4, layout: "centered-bottom", bottomLabel: "General Market" },
  { startSec: 3.4, endSec: 9.4, layout: "right-small", title: "Not a\nStrategy\nVideo" },
  { startSec: 9.4, endSec: 11.3, layout: "centered" },
  {
    startSec: 11.3, endSec: 17.8, layout: "left-medium",
    pills: ["Liquidity", "Capital Lock", "Risk Management"],
  },
  { startSec: 17.8, endSec: 19.5, layout: "centered" },
  { startSec: 19.5, endSec: 22.2, layout: "right-medium", title: "And On\nand On..." },
  { startSec: 22.2, endSec: 27.9, layout: "centered-bottom", bottomLabel: "The Escape" },
  { startSec: 27.9, endSec: 34.1, layout: "left-medium", title: "Every Level\nSame Wall" },
  { startSec: 34.1, endSec: 36.4, layout: "centered" },
  { startSec: 36.4, endSec: 42.8, layout: "right-small", title: "Beginner\nto Hedge\nFund" },
  { startSec: 42.8, endSec: 44.5, layout: "centered" },
  {
    startSec: 44.5, endSec: 48.6, layout: "left-medium",
    title: "Claude\nTerminal", subtitle: "Building your bot...",
  },

  // ── LIQUIDITY FAQ (48.6–89.8s) ──────────────────────────────────
  // Last side: L → C → R → C → L → C → R → C → L → C → R → C → L → C

  { startSec: 48.6, endSec: 53.0, layout: "centered-bottom", bottomLabel: "FAQ #1" },
  { startSec: 53.0, endSec: 57.8, layout: "right-small", title: "500,000\nMarkets" },
  { startSec: 57.8, endSec: 59.5, layout: "centered" },
  { startSec: 59.5, endSec: 62.4, layout: "left-medium", title: "5,000\nStreamers", image: "tutorial/logo-twitch.webp" },
  { startSec: 62.4, endSec: 64.0, layout: "centered" },
  { startSec: 64.0, endSec: 67.4, layout: "right-medium", title: "More Viewers\nin 10 Min?" },
  { startSec: 67.4, endSec: 69.0, layout: "centered" },
  { startSec: 69.0, endSec: 72.1, layout: "left-medium", title: "Fill Every\nStreamer" },
  { startSec: 72.1, endSec: 74.0, layout: "centered" },
  { startSec: 74.0, endSec: 78.0, layout: "right-small", title: "Everyone\nTrades\nEverything" },
  { startSec: 78.0, endSec: 80.0, layout: "centered" },
  { startSec: 80.0, endSec: 84.8, layout: "left-medium", title: "Harder\nBut Worth It" },
  { startSec: 84.8, endSec: 89.8, layout: "centered-bottom", bottomLabel: "General Market" },

  // ── SETTLEMENT FAQ (89.8–131.5s) ────────────────────────────────
  // Last side: L → C → R → C → L → C → R → C → L → C → R → C → L → C → R

  { startSec: 89.8, endSec: 93.3, layout: "centered-bottom", bottomLabel: "FAQ #2" },
  { startSec: 93.3, endSec: 96.4, layout: "right-small", title: "How Price\nWorks" },
  { startSec: 96.4, endSec: 98.0, layout: "centered" },
  { startSec: 98.0, endSec: 102.0, layout: "left-medium", title: "Train Delay\nBatch", subtitle: "30 stations in Germany" },
  { startSec: 102.0, endSec: 103.5, layout: "centered" },
  { startSec: 103.5, endSec: 107.8, layout: "right-medium", title: "30 Stations\n10 Minutes" },
  { startSec: 107.8, endSec: 109.5, layout: "centered" },
  { startSec: 109.5, endSec: 113.8, layout: "left-medium", title: "Everyone\nBets at Once" },
  { startSec: 113.8, endSec: 115.5, layout: "centered" },
  { startSec: 115.5, endSec: 120.4, layout: "right-medium", title: "Oracle\nComputes" },
  { startSec: 120.4, endSec: 122.0, layout: "centered" },
  { startSec: 122.0, endSec: 126.1, layout: "left-medium", title: "Parimutuel\nPnL" },
  { startSec: 126.1, endSec: 127.5, layout: "centered" },
  { startSec: 127.5, endSec: 131.5, layout: "right-small", title: "No Price\nRevealed\nat End" },

  // ── PARIMUTUEL (131.5–161.4s) ───────────────────────────────────
  // Last side: R → C → L → C → R → C → L → C → R → C → L → C

  { startSec: 131.5, endSec: 135.7, layout: "centered-bottom", bottomLabel: "Parimutuel" },
  { startSec: 135.7, endSec: 142.4, layout: "left-medium", title: "Yes Wins\nNo's Collateral" },
  { startSec: 142.4, endSec: 144.0, layout: "centered" },
  { startSec: 144.0, endSec: 150.4, layout: "right-medium", title: "30 Computations\nOne PnL" },
  { startSec: 150.4, endSec: 152.0, layout: "centered" },
  { startSec: 152.0, endSec: 155.0, layout: "left-medium", title: "The\nCorrection" },
  { startSec: 155.0, endSec: 156.5, layout: "centered" },
  { startSec: 156.5, endSec: 159.7, layout: "right-small", title: "$1 vs $1M\nCapped" },
  { startSec: 159.7, endSec: 161.4, layout: "centered" },

  // ── PRIVACY FAQ (161.4–194.0s) ──────────────────────────────────
  // Last side: R → C → L → C → R → C → L → C → R → C → L

  { startSec: 161.4, endSec: 166.2, layout: "centered-bottom", bottomLabel: "FAQ #3" },
  { startSec: 166.2, endSec: 172.8, layout: "left-small", title: "Private\nby Design" },
  { startSec: 172.8, endSec: 174.5, layout: "centered" },
  { startSec: 174.5, endSec: 177.0, layout: "right-medium", title: "Sealed\nBets" },
  { startSec: 177.0, endSec: 178.5, layout: "centered" },
  { startSec: 178.5, endSec: 181.2, layout: "left-medium", title: "Specialized\nOracle" },
  { startSec: 181.2, endSec: 183.0, layout: "centered" },
  { startSec: 183.0, endSec: 188.0, layout: "right-medium", title: "Instant\nSettlement" },
  { startSec: 188.0, endSec: 189.5, layout: "centered" },
  { startSec: 189.5, endSec: 194.0, layout: "left-medium", title: "No Dispute\nNeeded" },

  // ── MOAT FAQ (194.0–247.4s) ─────────────────────────────────────
  // Last side: L → C → R → C → L → C → R → C → L → C → R → C → L → C → R → C → L

  { startSec: 194.0, endSec: 198.4, layout: "centered-bottom", bottomLabel: "FAQ #4" },
  { startSec: 198.4, endSec: 204.9, layout: "right-small", title: "Finding\nYour Moat" },
  { startSec: 204.9, endSec: 206.5, layout: "centered" },
  { startSec: 206.5, endSec: 212.1, layout: "left-medium", title: "Predict All\nNot One" },
  { startSec: 212.1, endSec: 213.5, layout: "centered" },
  { startSec: 213.5, endSec: 216.8, layout: "right-medium", title: "Quantity\nOver Quality" },
  { startSec: 216.8, endSec: 218.5, layout: "centered" },
  { startSec: 218.5, endSec: 222.0, layout: "left-medium", title: "1920s", subtitle: "Technical Analysis" },
  { startSec: 222.0, endSec: 223.5, layout: "centered" },
  { startSec: 223.5, endSec: 226.9, layout: "right-medium", title: "1970s", subtitle: "Black-Scholes" },
  { startSec: 226.9, endSec: 230.3, layout: "centered-bottom", bottomLabel: "2026" },
  { startSec: 230.3, endSec: 236.0, layout: "left-medium", title: "New\nInstrument" },
  { startSec: 236.0, endSec: 237.5, layout: "centered" },
  { startSec: 237.5, endSec: 241.5, layout: "right-medium", title: "No\nIncumbent" },
  { startSec: 241.5, endSec: 243.0, layout: "centered" },
  { startSec: 243.0, endSec: 247.4, layout: "left-medium", title: "Hedge Fund\nProblem" },

  // ── SOURCES FAQ (247.4–271.0s) ──────────────────────────────────
  // Last side: L → C → R → C → L → C → R → C → L

  { startSec: 247.4, endSec: 252.0, layout: "centered-bottom", bottomLabel: "FAQ #5" },
  {
    startSec: 252.0, endSec: 256.0, layout: "right-medium",
    title: "One Batch\nPer Source",
    logos: [
      { src: "tutorial/logo-twitch.webp", label: "Twitch" },
      { src: "tutorial/logo-steam.webp", label: "Steam" },
      { src: "tutorial/logo-gtfs.webp", label: "Trains" },
    ],
  },
  { startSec: 256.0, endSec: 257.5, layout: "centered" },
  {
    startSec: 257.5, endSec: 261.0, layout: "left-medium",
    logos: [
      { src: "tutorial/logo-espn.webp", label: "ESPN" },
      { src: "tutorial/logo-flights.webp", label: "Flights" },
      { src: "tutorial/logo-github.webp", label: "GitHub" },
      { src: "tutorial/logo-bitcoin.webp", label: "Bitcoin" },
      { src: "tutorial/logo-npm.webp", label: "npm" },
      { src: "tutorial/logo-hackernews.webp", label: "HN" },
    ],
  },
  { startSec: 261.0, endSec: 262.5, layout: "centered" },
  { startSec: 262.5, endSec: 267.0, layout: "right-medium", title: "Ask and\nWe'll Add It" },
  { startSec: 267.0, endSec: 268.5, layout: "centered" },
  { startSec: 268.5, endSec: 271.0, layout: "left-small", title: "1 Billion\nMarkets" },

  // ── CLOSING (271.0–282.9s) ──────────────────────────────────────
  // Last side: L → C → R → C → L → C

  { startSec: 271.0, endSec: 273.8, layout: "centered-bottom", bottomLabel: "Strategy Ready" },
  { startSec: 273.8, endSec: 276.9, layout: "right-small", title: "Strategy\nReady" },
  { startSec: 276.9, endSec: 278.5, layout: "centered" },
  { startSec: 278.5, endSec: 280.8, layout: "left-medium", title: "General\nMarket", accentLine: 1 },
  { startSec: 280.8, endSec: 282.9, layout: "centered-bottom", bottomLabel: "Max, Founder" },
];
