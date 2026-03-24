/**
 * Font loading — Geist Sans + JetBrains Mono
 * Matches the generalmarket.io/points page.
 */

import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadJetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";

// Geist isn't on Google Fonts yet — use Inter as the sans fallback.
// The CSS font-family stack in tokens.ts lists Geist first;
// if a local Geist install exists it will be used automatically.
const { fontFamily: sansFontFamily } = loadInter("normal", {
  subsets: ["latin"],
  weights: ["200", "300", "400", "500", "600", "700", "800", "900"],
});

const { fontFamily: monoFontFamily } = loadJetBrainsMono("normal", {
  subsets: ["latin"],
  weights: ["400", "500", "700"],
});

export const font = sansFontFamily;
export const monoFont = monoFontFamily;
