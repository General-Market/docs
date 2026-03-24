import React from "react";
import type { LightingPreset } from "../types/lighting";
import { useQuality } from "../quality";

export const LightingController: React.FC<{
  preset: LightingPreset;
  /** Additional screen accent light (for desk scenes) */
  accentLight?: { position: [number, number, number]; color: string; intensity: number; distance: number };
}> = ({ preset, accentLight }) => {
  const { config: quality } = useQuality();

  return (
    <>
      {/* Ambient light */}
      <ambientLight intensity={preset.ambientIntensity} color={preset.ambientColor} />

      {/* Sun directional */}
      <directionalLight
        position={preset.sunPosition}
        intensity={preset.sunIntensity}
        color={preset.sunColor}
        castShadow={quality.shadows && preset.sunIntensity > 0.5}
        shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-2}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-bias={-0.0005}
      />

      {/* Fill light */}
      <directionalLight position={[-3, 4, 2]} intensity={preset.fillIntensity} color={preset.fillColor} />

      {/* Screen accent light */}
      {accentLight && (
        <pointLight
          position={accentLight.position}
          intensity={accentLight.intensity}
          color={accentLight.color}
          distance={accentLight.distance}
          decay={2}
        />
      )}

      {/* Ambiance lights (neon, fog glow, etc.) */}
      {preset.ambianceLights?.map((light, i) => (
        <pointLight
          key={`amb-${i}`}
          position={light.pos}
          intensity={light.intensity}
          color={light.color}
          distance={light.distance}
          decay={2}
        />
      ))}
    </>
  );
};
