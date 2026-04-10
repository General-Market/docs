/**
 * Scene definitions for TalkingHeadLayout.
 *
 * 57 scenes, 6 layout types, full video coverage (0–282.88s).
 * Every scene boundary triggers a spring-animated webcam resize.
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
  /** Label below webcam (centered-bottom only) */
  bottomLabel?: string;
  /** Logo image path (centered-bottom only) */
  bottomImage?: string;
}

export const SCENES: TalkingHeadScene[] = [
  // ── INTRO (0–48.6s) ─────────────────────────────────────────────

  { startSec: 0.0, endSec: 3.4, layout: "centered-bottom", bottomLabel: "General Market" },
  { startSec: 3.4, endSec: 9.4, layout: "right-small", title: "Not a\nStrategy\nVideo" },
  { startSec: 9.4, endSec: 11.3, layout: "centered" },
  {
    startSec: 11.3, endSec: 17.8, layout: "left-medium",
    pills: ["Liquidity", "Capital Lock", "Risk Management"],
  },
  { startSec: 17.8, endSec: 22.2, layout: "right-medium", title: "And On\nand On..." },
  { startSec: 22.2, endSec: 27.9, layout: "centered-bottom", bottomLabel: "The Escape" },
  { startSec: 27.9, endSec: 34.1, layout: "left-medium", title: "Every Level\nSame Wall" },
  { startSec: 34.1, endSec: 36.4, layout: "centered" },
  { startSec: 36.4, endSec: 42.8, layout: "right-small", title: "Beginner\nto Hedge\nFund" },
  {
    startSec: 42.8, endSec: 48.6, layout: "left-medium",
    title: "Claude\nTerminal", subtitle: "Building your bot...",
  },

  // ── LIQUIDITY FAQ (48.6–89.8s) ──────────────────────────────────

  { startSec: 48.6, endSec: 53.0, layout: "centered-bottom", bottomLabel: "FAQ #1" },
  { startSec: 53.0, endSec: 57.8, layout: "left-small", title: "500,000\nMarkets" },
  { startSec: 57.8, endSec: 62.4, layout: "right-medium", title: "5,000\nStreamers", image: "tutorial/twitch-logo.png" },
  { startSec: 62.4, endSec: 67.4, layout: "left-medium", title: "More Viewers\nin 10 Min?" },
  { startSec: 67.4, endSec: 72.1, layout: "right-medium", title: "Fill Every\nStreamer" },
  { startSec: 72.1, endSec: 78.0, layout: "left-small", title: "Everyone\nTrades\nEverything" },
  { startSec: 78.0, endSec: 84.8, layout: "right-medium", title: "Harder\nBut Worth It" },
  { startSec: 84.8, endSec: 89.8, layout: "centered-bottom", bottomLabel: "General Market" },

  // ── SETTLEMENT FAQ (89.8–131.5s) ────────────────────────────────

  { startSec: 89.8, endSec: 93.3, layout: "centered-bottom", bottomLabel: "FAQ #2" },
  { startSec: 93.3, endSec: 96.4, layout: "right-small", title: "How Price\nWorks" },
  { startSec: 96.4, endSec: 100.4, layout: "left-medium", title: "Train Delay\nBatch", subtitle: "30 stations in Germany" },
  { startSec: 100.4, endSec: 107.8, layout: "right-medium", title: "30 Stations\n10 Minutes" },
  { startSec: 107.8, endSec: 113.8, layout: "left-medium", title: "Everyone\nBets at Once" },
  { startSec: 113.8, endSec: 120.4, layout: "right-medium", title: "Oracle\nComputes" },
  { startSec: 120.4, endSec: 126.1, layout: "left-medium", title: "Parimutuel\nPnL" },
  { startSec: 126.1, endSec: 131.5, layout: "right-small", title: "No Price\nRevealed\nat End" },

  // ── PARIMUTUEL (131.5–161.4s) ───────────────────────────────────

  { startSec: 131.5, endSec: 135.7, layout: "centered-bottom", bottomLabel: "Parimutuel" },
  { startSec: 135.7, endSec: 142.4, layout: "right-medium", title: "Yes Wins\nNo's Collateral" },
  { startSec: 142.4, endSec: 150.4, layout: "left-medium", title: "30 Computations\nOne PnL" },
  { startSec: 150.4, endSec: 155.0, layout: "right-medium", title: "The\nCorrection" },
  { startSec: 155.0, endSec: 159.7, layout: "left-small", title: "$1 vs $1M\nCapped" },
  { startSec: 159.7, endSec: 161.4, layout: "centered" },

  // ── PRIVACY FAQ (161.4–194.0s) ──────────────────────────────────

  { startSec: 161.4, endSec: 166.2, layout: "centered-bottom", bottomLabel: "FAQ #3" },
  { startSec: 166.2, endSec: 172.8, layout: "left-small", title: "Private\nby Design" },
  { startSec: 172.8, endSec: 177.0, layout: "right-medium", title: "Sealed\nBets" },
  { startSec: 177.0, endSec: 181.2, layout: "left-medium", title: "Specialized\nOracle" },
  { startSec: 181.2, endSec: 188.0, layout: "right-medium", title: "Instant\nSettlement" },
  { startSec: 188.0, endSec: 194.0, layout: "left-medium", title: "No Dispute\nNeeded" },

  // ── MOAT FAQ (194.0–247.4s) ─────────────────────────────────────

  { startSec: 194.0, endSec: 198.4, layout: "centered-bottom", bottomLabel: "FAQ #4" },
  { startSec: 198.4, endSec: 204.9, layout: "left-small", title: "Finding\nYour Moat" },
  { startSec: 204.9, endSec: 212.1, layout: "right-medium", title: "Predict All\nNot One" },
  { startSec: 212.1, endSec: 216.8, layout: "left-medium", title: "Quantity\nOver Quality" },
  { startSec: 216.8, endSec: 222.0, layout: "right-medium", title: "1920s", subtitle: "Technical Analysis" },
  { startSec: 222.0, endSec: 226.9, layout: "left-medium", title: "1970s", subtitle: "Black-Scholes" },
  { startSec: 226.9, endSec: 230.3, layout: "centered-bottom", bottomLabel: "2026" },
  { startSec: 230.3, endSec: 236.0, layout: "left-medium", title: "New\nInstrument" },
  { startSec: 236.0, endSec: 241.5, layout: "right-medium", title: "No\nIncumbent" },
  { startSec: 241.5, endSec: 247.4, layout: "left-medium", title: "Hedge Fund\nProblem" },

  // ── SOURCES FAQ (247.4–271.0s) ──────────────────────────────────

  { startSec: 247.4, endSec: 252.0, layout: "centered-bottom", bottomLabel: "FAQ #5" },
  { startSec: 252.0, endSec: 256.0, layout: "left-medium", title: "One Batch\nPer Source" },
  { startSec: 256.0, endSec: 259.5, layout: "right-small", title: "Train\nTwitch\nSteam" },
  { startSec: 259.5, endSec: 264.9, layout: "left-medium", title: "Ask and\nWe'll Add It" },
  { startSec: 264.9, endSec: 271.0, layout: "right-small", title: "1 Billion\nMarkets" },

  // ── CLOSING (271.0–282.9s) ──────────────────────────────────────

  { startSec: 271.0, endSec: 273.8, layout: "centered-bottom", bottomLabel: "Strategy Ready" },
  { startSec: 273.8, endSec: 276.9, layout: "left-small", title: "Strategy\nReady" },
  { startSec: 276.9, endSec: 280.8, layout: "right-medium", title: "General\nMarket", accentLine: 1 },
  { startSec: 280.8, endSec: 282.9, layout: "centered-bottom", bottomLabel: "Max, Founder" },
];
