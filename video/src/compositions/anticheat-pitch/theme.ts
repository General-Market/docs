export const FPS = 30;
export const W = 1920;
export const H = 1080;

export const DURATION_SEC = 12;
export const TOTAL_FRAMES = DURATION_SEC * FPS;

export const toFrames = (seconds: number): number => Math.round(seconds * FPS);

// Pitch-deck palette: black canvas, orange signature, white type,
// neutral gray for support copy.
export const colors = {
  bg: "#0D0E0F",
  fg: "#FFFFFF",
  fgDim: "#F1F2F7",
  dim: "#828587",
  panel: "#25282B",
  accent: "#FFA300",
  rule: "#1A1B1D",
};

// Pitch-deck typography. Calibri-first sans-serif stack — falls back gracefully
// when the precise face is not available on the rendering machine.
export const pitchSans =
  "'Calibri', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
export const pitchSansLight =
  "'Calibri Light', 'Calibri', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

// Six scene chapters, paginated like an investor deck.
export const TOTAL_CHAPTERS = 6;
