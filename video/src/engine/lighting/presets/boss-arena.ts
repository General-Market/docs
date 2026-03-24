import type { LightingPreset } from "../../types/lighting";

/** SOULS BOSS — deep dark, eerie red/purple glow, fog */
export const bossArena: LightingPreset = {
  id: "boss-arena",
  skyColor: "#050008",
  sunColor: "#110011",
  sunIntensity: 0.08,
  sunPosition: [0, 2, 5],
  ambientColor: "#0a0008",
  ambientIntensity: 0.06,
  fillColor: "#110022",
  fillIntensity: 0.05,
  oceanColor: "#030008",
  sandColor: "#1a1218",
  fog: { color: "#080010", near: 3, far: 15 },
  ambianceLights: [
    { pos: [0, 3, -6], color: "#ff0033", intensity: 4, distance: 12 },
    { pos: [-3, 1, -4], color: "#6600cc", intensity: 2.5, distance: 8 },
    { pos: [3, 1, -4], color: "#6600cc", intensity: 2.5, distance: 8 },
    { pos: [-1, 0.3, -2], color: "#ff3300", intensity: 1, distance: 4 },
    { pos: [1, 0.3, -2], color: "#ff3300", intensity: 1, distance: 4 },
  ],
};
