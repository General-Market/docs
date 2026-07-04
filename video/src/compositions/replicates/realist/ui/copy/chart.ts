// ═══════════════════════════════════════════════════════════════
// CHART copy — every string/number on the chart plot area.
// Edit values here; geometry (measured pixel tracks) lives in
// ../chart-data.ts (auto-generated from the reference plates).
// All frames are composition frames (60fps), all y in 1920×1080 px.
// ═══════════════════════════════════════════════════════════════

export const CHART_COLORS = {
  plotBg: "#11161f",
  gridLine: "rgba(84, 98, 122, 0.12)",
  scaleText: "#8b95a7",
  candleGreen: "#259378",
  candleRed: "#d5405a",
  wickGrey: "#5a5f6b",
  bubbleGreenFill: "#2f9e68",
  bubbleGreenRing: "#124d2e",
  bubbleRedFill: "#dd4a52",
  bubbleRedRing: "#6e1a20",
  bubbleYellowFill: "#e0a93a",
  bubbleWhiteFill: "#f2efe9",
  exitLine: "#c0392b",
  exitBadgeBg: "#e13232",
  costLine: "#d7dce6",
  costBadgeBg: "#f4f6f9",
  costBadgeText: "#10151d",
  highChipBg: "#1e2f63",
  lowChipBg: "#1e2f63",
  chipText: "#e8ecf4",
  curChipGreen: "#0fa878",
  curChipRed: "#e13232",
} as const;

// Price-scale eras (TradingView auto-rescale moments measured off plates).
// Labels are generated top..bottom inclusive at even spacing (the real axis
// is log-scaled but near-even over this range).
export type ScaleEra = {
  from: number; // frame
  top: number; // top label value, thousands
  bottom: number; // bottom label value, thousands
  step: number; // thousands
  yTop: number; // y of top label row
  yBottom: number; // y of bottom label row
};
export const SCALE_ERAS: ScaleEra[] = [
  { from: 418, top: 380, bottom: -20, step: 20, yTop: 197, yBottom: 896 },
  { from: 460, top: 400, bottom: -20, step: 20, yTop: 223, yBottom: 896 },
  { from: 700, top: 500, bottom: -25, step: 25, yTop: 199, yBottom: 900 },
  { from: 1055, top: 550, bottom: -25, step: 25, yTop: 209, yBottom: 898 },
];

export const fmtK = (v: number): string => (v < 0 ? `-${Math.abs(v)}K` : `${v}K`);

// High/Low chips at the right edge of the plot.
export const HIGH_CHIP: { f: number; text: string; y: number }[] = [
  { f: 418, text: "High 357K", y: 241 },
  { f: 460, text: "High 377K", y: 259 },
  { f: 700, text: "High 455K", y: 259 },
  { f: 1055, text: "High 509K", y: 259 },
];
export const LOW_CHIP = { text: "Low 2.56K", y: 872 };

// Current Average Exit Price — dashed line label + red badge value.
export const EXIT_LABEL = "Current Average Exit Price";
export const EXIT_BADGE: { f: number; text: string }[] = [
  { f: 418, text: "262K" },
  { f: 460, text: "317K" },
  { f: 520, text: "313K" },
  { f: 580, text: "243K" },
  { f: 690, text: "292K" },
  { f: 800, text: "291K" },
  { f: 920, text: "292K" },
  { f: 1040, text: "303K" },
  { f: 1160, text: "306K" },
  { f: 1290, text: "306K" },
  { f: 1400, text: "298K" },
  { f: 1520, text: "284K" },
];

// Current Average Cost Basis — dashed white line + white badge.
export const COST_LABEL = "Current Average Cost Basis";
export const COST_BADGE = "5.75K";

// Current-price chip (rides the last close on the scale).
export const CURRENT_CHIP: { f: number; text: string; y: number; up: boolean }[] = [
  { f: 418, text: "357K", y: 275, up: true },
  { f: 460, text: "154K", y: 616, up: false },
  { f: 520, text: "98.4K", y: 706, up: false },
  { f: 580, text: "189K", y: 560, up: false },
  { f: 690, text: "388K", y: 348, up: false },
  { f: 800, text: "260K", y: 517, up: true },
  { f: 920, text: "382K", y: 353, up: true },
  { f: 1040, text: "395K", y: 394, up: false },
  { f: 1160, text: "325K", y: 476, up: true },
  { f: 1290, text: "273K", y: 540, up: true },
  { f: 1400, text: "166K", y: 665, up: false },
  { f: 1520, text: "249K", y: 567, up: true },
];

// Time axis: 1s candles, labels every 14 seconds. x positions are near-static
// (pan ≈ 0.09px/frame — imperceptible), measured at f0900.
export const TIME_AXIS: { text: string; x: number }[] = [
  { text: "15:03", x: 845 },
  { text: "15:03:14", x: 924 },
  { text: "15:03:28", x: 1003 },
  { text: "15:03:42", x: 1081 },
  { text: "15:04", x: 1160 },
  { text: "15:04:14", x: 1239 },
  { text: "15:04:28", x: 1317 },
  { text: "15:04:42", x: 1396 },
  { text: "15:05", x: 1475 },
];

// Emoji/glyph pools for the trade bubbles (stable pick per track index).
export const BUBBLE_GLYPHS = {
  g: ["S", "S", "S", "S", "💚", "🥝"],
  r: ["S", "S", "DS", "🍎", "🍅", "💰"],
  y: ["⭐", "🏀", "😀", "👑"],
  w: ["🦷", "🤍", "🍬"],
} as const;
