// ---------------------------------------------------------------------------
// Lighting preset — named configs for time-of-day / mood
// ---------------------------------------------------------------------------

export interface AmbianceLight {
  pos: [number, number, number];
  color: string;
  intensity: number;
  distance: number;
}

export interface LightingPreset {
  id: string;
  skyColor: string;
  sunColor: string;
  sunIntensity: number;
  sunPosition: [number, number, number];
  ambientColor: string;
  ambientIntensity: number;
  fillColor: string;
  fillIntensity: number;
  oceanColor: string;
  sandColor: string;
  fog?: { color: string; near: number; far: number };
  ambianceLights?: AmbianceLight[];
}
