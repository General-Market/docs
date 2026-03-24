import type { LightingPreset } from "../../types/lighting";

/** Soft pink sunset — return scene (acceptance) */
export const sunsetReturn: LightingPreset = {
  id: "sunset-return",
  skyColor: "#FFB6C1",
  sunColor: "#FFD4AA",
  sunIntensity: 1.5,
  sunPosition: [3, 3, 5],
  ambientColor: "#ffe4e1",
  ambientIntensity: 0.55,
  fillColor: "#ffb8a0",
  fillIntensity: 0.4,
  oceanColor: "#FF7F50",
  sandColor: "#C8B090",
};

/** Deep golden — car-lot-final (wisdom) */
export const deepGolden: LightingPreset = {
  id: "deep-golden",
  skyColor: "#FF7F00",
  sunColor: "#FFD700",
  sunIntensity: 2.0,
  sunPosition: [-3, 3, 6],
  ambientColor: "#ffcc80",
  ambientIntensity: 0.65,
  fillColor: "#ff8800",
  fillIntensity: 0.5,
  oceanColor: "#FF6600",
  sandColor: "#D4A76A",
};
