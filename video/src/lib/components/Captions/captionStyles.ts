import type { CSSProperties } from "react";

export interface CaptionStyleConfig {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  highlightColor: string;
  currentWordColor: string;
  letterSpacing?: number;
}

const boldStroke: CaptionStyleConfig = {
  fontFamily: "Montserrat, sans-serif",
  fontSize: 72,
  fontWeight: 900,
  color: "#FFFFFF",
  strokeColor: "#000000",
  strokeWidth: 3,
  highlightColor: "#FFD700",
  currentWordColor: "#00FF88",
};

const minimal: CaptionStyleConfig = {
  fontFamily: "Montserrat, sans-serif",
  fontSize: 64,
  fontWeight: 700,
  color: "#FFFFFF",
  strokeColor: "rgba(0,0,0,0.5)",
  strokeWidth: 1,
  highlightColor: "#4CC9F0",
  currentWordColor: "#FFFFFF",
};

const neon: CaptionStyleConfig = {
  fontFamily: "Montserrat, sans-serif",
  fontSize: 72,
  fontWeight: 900,
  color: "#00FF88",
  strokeColor: "#000000",
  strokeWidth: 2,
  highlightColor: "#FF0A54",
  currentWordColor: "#FFFF00",
  letterSpacing: 2,
};

// IndexMaker DA — IBM Plex Sans Bold, brand blue highlight, cyan active word
const indexmaker: CaptionStyleConfig = {
  fontFamily: "IBM Plex Sans, sans-serif",
  fontSize: 64,
  fontWeight: 700,
  color: "#FFFFFF",
  strokeColor: "#000000",
  strokeWidth: 3,
  highlightColor: "#2470ff",
  currentWordColor: "#3EDCEB",
  letterSpacing: 0.5,
};

export const captionPresets = { "bold-stroke": boldStroke, minimal, neon, indexmaker };

export const getWordStyle = (config: CaptionStyleConfig): CSSProperties => ({
  fontFamily: config.fontFamily,
  fontSize: config.fontSize,
  fontWeight: config.fontWeight,
  color: config.color,
  WebkitTextStroke: `${config.strokeWidth}px ${config.strokeColor}`,
  paintOrder: "stroke fill",
  letterSpacing: config.letterSpacing,
  lineHeight: 1.3,
  textAlign: "center",
});
