import type { LightingPreset } from "../../types/lighting";

/** Clear morning sky — forex scenes */
export const brightMorning: LightingPreset = {
  id: "bright-morning",
  skyColor: "#87CEEB",
  sunColor: "#fff5e0",
  sunIntensity: 2.0,
  sunPosition: [3, 6, 3],
  ambientColor: "#fffbe6",
  ambientIntensity: 0.7,
  fillColor: "#b8d8f0",
  fillIntensity: 0.5,
  oceanColor: "#1E90FF",
  sandColor: "#C2B280",
};

/** Bright confidence — forex at full intensity */
export const brightMorningSun: LightingPreset = {
  id: "bright-morning-sun",
  skyColor: "#87CEEB",
  sunColor: "#fff5e0",
  sunIntensity: 2.2,
  sunPosition: [4, 8, 3],
  ambientColor: "#fffbe6",
  ambientIntensity: 0.8,
  fillColor: "#b8d8f0",
  fillIntensity: 0.6,
  oceanColor: "#1E90FF",
  sandColor: "#C2B280",
};

/** Blue sky peak midday — stocks scenes */
export const brightMidday: LightingPreset = {
  id: "bright-midday",
  skyColor: "#4DA6FF",
  sunColor: "#ffffff",
  sunIntensity: 2.5,
  sunPosition: [0, 10, 2],
  ambientColor: "#e8f0ff",
  ambientIntensity: 0.9,
  fillColor: "#87CEEB",
  fillIntensity: 0.5,
  oceanColor: "#2196F3",
  sandColor: "#C2B280",
};
