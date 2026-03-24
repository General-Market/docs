import type { LightingPreset } from "../../types/lighting";

/** RED PANIC — 0DTE dark stormy sky, flashing red, fog */
export const stormyRed: LightingPreset = {
  id: "stormy-red",
  skyColor: "#1a0808",
  sunColor: "#ff1100",
  sunIntensity: 0.6,
  sunPosition: [-4, 2, 4],
  ambientColor: "#3a1010",
  ambientIntensity: 0.25,
  fillColor: "#cc0000",
  fillIntensity: 0.3,
  oceanColor: "#440000",
  sandColor: "#5a3030",
  fog: { color: "#1a0505", near: 4, far: 18 },
  ambianceLights: [
    { pos: [-3, 1.5, -3], color: "#ff0000", intensity: 3, distance: 8 },
    { pos: [3, 1.5, -5], color: "#ff2200", intensity: 2.5, distance: 8 },
    { pos: [0, 1, -8], color: "#cc0000", intensity: 2, distance: 8 },
    { pos: [-5, 0.5, -7], color: "#ff4444", intensity: 1.5, distance: 6 },
  ],
};

/** Purple twilight — polymarket */
export const purpleTwilight: LightingPreset = {
  id: "purple-twilight",
  skyColor: "#4A2080",
  sunColor: "#CC88FF",
  sunIntensity: 0.8,
  sunPosition: [-2, 2, 4],
  ambientColor: "#6a4a8a",
  ambientIntensity: 0.4,
  fillColor: "#7c3aed",
  fillIntensity: 0.3,
  oceanColor: "#2a1a4a",
  sandColor: "#8a7a6a",
  ambianceLights: [
    { pos: [-4, 1, -4], color: "#7c3aed", intensity: 2, distance: 8 },
    { pos: [4, 1, -6], color: "#a855f7", intensity: 1.5, distance: 6 },
  ],
};
