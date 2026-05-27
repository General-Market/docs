export const FPS = 30;
export const W = 1920;
export const H = 1080;

export const DURATION_SEC = 12;
export const TOTAL_FRAMES = DURATION_SEC * FPS;

export const toFrames = (seconds: number): number => Math.round(seconds * FPS);

// Data-card palette. Light field, GM Electric blue, near-black type.
// `accent` is GM Electric (#2D5BFF) — our blue, migrated off Coinbase's #0052FF.
// `accentSoft` is the lighter cobalt used in the dot grid and secondary fills.
export const colors = {
  bg: "#F0F2F4",
  fg: "#0A0A0A",
  fgSoft: "#1F1F24",
  dim: "#6E727A",
  accent: "#2D5BFF",
  accentSoft: "#5B79FF",
  accentTint: "rgba(45, 91, 255, 0.10)",
  rule: "rgba(10, 10, 12, 0.10)",
  ruleStrong: "rgba(10, 10, 12, 0.22)",
  surface: "#FFFFFF",
};
