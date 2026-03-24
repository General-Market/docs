import type { LightingPreset } from "../../types/lighting";

/** Dark oppressive neon — goldman/ambush scenes */
export const neonNight: LightingPreset = {
  id: "neon-night",
  skyColor: "#2C2C3A",
  sunColor: "#8899aa",
  sunIntensity: 0.4,
  sunPosition: [2, 4, 3],
  ambientColor: "#444455",
  ambientIntensity: 0.3,
  fillColor: "#334455",
  fillIntensity: 0.2,
  oceanColor: "#1a2a3a",
  sandColor: "#7a7060",
  fog: { color: "#1a1a2a", near: 5, far: 20 },
  ambianceLights: [
    { pos: [-4, 1.8, -6], color: "#ff2266", intensity: 2.5, distance: 8 },
    { pos: [4, 1.5, -4], color: "#00ccff", intensity: 2, distance: 8 },
    { pos: [-2, 0.8, 2], color: "#ff00aa", intensity: 1.5, distance: 6 },
    { pos: [5, 2, -8], color: "#ff4422", intensity: 2, distance: 7 },
  ],
};

/** Deep midnight with neon accents — memecoins solo (green neon) */
export const neonMidnight: LightingPreset = {
  id: "neon-midnight",
  skyColor: "#0a0a1a",
  sunColor: "#334466",
  sunIntensity: 0.2,
  sunPosition: [0, 2, 5],
  ambientColor: "#1a1a2a",
  ambientIntensity: 0.15,
  fillColor: "#002244",
  fillIntensity: 0.1,
  oceanColor: "#0a1a2a",
  sandColor: "#3a3530",
  ambianceLights: [
    { pos: [-3, 1.5, -3], color: "#00ff41", intensity: 3, distance: 8 },
    { pos: [3, 1.5, -5], color: "#ff00ff", intensity: 2.5, distance: 8 },
    { pos: [0, 1, -8], color: "#00ffff", intensity: 2, distance: 8 },
    { pos: [-5, 0.5, -7], color: "#ffff00", intensity: 1.5, distance: 6 },
    { pos: [5, 0.5, -4], color: "#ff4488", intensity: 2, distance: 6 },
  ],
};

/** Memecoins with robot — RED doom atmosphere */
export const neonDoom: LightingPreset = {
  id: "neon-doom",
  skyColor: "#0a0a1a",
  sunColor: "#334466",
  sunIntensity: 0.2,
  sunPosition: [0, 2, 5],
  ambientColor: "#1a1a2a",
  ambientIntensity: 0.15,
  fillColor: "#002244",
  fillIntensity: 0.1,
  oceanColor: "#0a1a2a",
  sandColor: "#3a3530",
  ambianceLights: [
    { pos: [-3, 1.5, -3], color: "#cc0000", intensity: 3, distance: 8 },
    { pos: [3, 1.5, -5], color: "#ff0033", intensity: 2.5, distance: 8 },
    { pos: [0, 1, -8], color: "#cc0000", intensity: 2, distance: 8 },
    { pos: [-5, 0.5, -7], color: "#ff4444", intensity: 1.5, distance: 6 },
    { pos: [5, 0.5, -4], color: "#ff0033", intensity: 2, distance: 6 },
  ],
};
