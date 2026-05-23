// Shared tokens for the AntiCheatEdit illustration props.
//
// The look is the Hasheur "blue world" — a deep blue field with a floating
// line grid, logos that hover, a chunky-pixel dissolve — but spoken in the
// AntiCheatFull language: Base blue (#0052FF), Inter/Geist + JetBrains Mono,
// near-black type where the field is light, white ink where it is blue.
//
// Everything that draws on the blue field reads from `scene`. Keep one
// source of truth here so all thirteen mechanism illustrations match.

import { colors as base } from "../../anticheat/theme";
import { font, monoFont } from "../../../common/fonts";

export { font, monoFont };

export const FPS = 30;
export const W = 1920;
export const H = 1080;

export const scene = {
  // Base-blue hero, carried straight from the AntiCheatFull palette.
  accent: base.accent, // #0052FF
  accentSoft: base.accentSoft, // #5B79FF

  // Blue-field gradient stops, bright top-left → deep navy bottom-right.
  blueBright: "#1E73FF",
  blueMid: "#0052FF",
  blueDeep: "#04205C",
  blueAbyss: "#020E2B",

  // Grid + scan lines drawn in white at low alpha over the blue.
  gridLine: "rgba(255, 255, 255, 0.085)",
  gridLineBright: "rgba(255, 255, 255, 0.26)",
  scanLine: "rgba(255, 255, 255, 0.40)",

  // Ink on the blue field.
  ink: "#FFFFFF",
  inkSoft: "rgba(255, 255, 255, 0.74)",
  inkDim: "rgba(255, 255, 255, 0.46)",

  // The rounded white card a logo/flag sits inside (the reference chip).
  chip: "#FFFFFF",
  chipShadow: "rgba(2, 14, 43, 0.45)",
} as const;

// The blue-field gradient, reused by BlueField and as a fallback fill.
export const BLUE_FIELD_GRADIENT = `radial-gradient(135% 130% at 16% 20%, ${scene.blueBright} 0%, ${scene.blueMid} 28%, ${scene.blueDeep} 72%, ${scene.blueAbyss} 100%)`;
