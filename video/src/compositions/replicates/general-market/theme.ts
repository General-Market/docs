// General Market — explainer theme
// Dark background, single GM green accent, muted white text.

export const THEME = {
  bg: "#0A0E17",
  bgDeeper: "#070A11",
  panel: "#121826",
  green: "#00D26A",
  greenDim: "#008F49",
  greenGlow: "rgba(0, 210, 106, 0.35)",
  grey: "#2B3241",
  greyDim: "#1A1F2B",
  greyLine: "#222938",
  text: "#F1F5F9",
  textMuted: "#8B94A7",
  red: "#FF4B4B",
  redDim: "#B22F2F",
  white: "#FFFFFF",
} as const;

// Category palette for Beat 4. Each category gets a distinct, readable color.
export const CATEGORIES = [
  { name: "politics", color: "#FF6B6B" },
  { name: "sports", color: "#FFB84D" },
  { name: "econ", color: "#FFD93D" },
  { name: "twitch", color: "#9B59FF" },
  { name: "steam", color: "#4DABF7" },
  { name: "films", color: "#FF6EC7" },
  { name: "animal cams", color: "#6EE7B7" },
  { name: "space launches", color: "#5EEAD4" },
  { name: "weather", color: "#7DD3FC" },
  { name: "niche sports", color: "#A3E635" },
  { name: "music", color: "#C084FC" },
  { name: "gaming", color: "#2DD4BF" },
  { name: "tech", color: "#818CF8" },
  { name: "everything", color: "#F8FAFC" },
] as const;

// Scene durations (30fps)
export const FPS = 30;
export const DUR = {
  intro: 90, // 3s
  beat1: 150, // 5s Liquidity
  beat2: 150, // 5s Profitable size
  beat3: 150, // 5s Markets expand
  beat4: 165, // 5.5s Categories
  beat5: 150, // 5s Settlement
  beat6: 300, // 10s Formula
  outro: 90, // 3s
} as const;

export const TOTAL_DURATION =
  DUR.intro +
  DUR.beat1 +
  DUR.beat2 +
  DUR.beat3 +
  DUR.beat4 +
  DUR.beat5 +
  DUR.beat6 +
  DUR.outro;

export const WIDTH = 1920;
export const HEIGHT = 1080;

// Shared layout constants — keep grids visually anchored across scenes.
export const LAYOUT = {
  gridW: 620,
  gridH: 500,
  gridRows: 8,
  gridCols: 10,
  gridGap: 8,
  // GM grid at expanded size (Beat 3 onward)
  gridWExpanded: 1080,
  gridHExpanded: 740,
  gridRowsExpanded: 22,
  gridColsExpanded: 32,
  gridGapExpanded: 4,
} as const;
