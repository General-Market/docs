import React from "react";
import type { SceneDefinition } from "../types/scene";
import type { PrefabRegistry } from "../types/prefab";
import type { LightingPreset } from "../types/lighting";
import { EntityRenderer } from "./EntityRenderer";
import { CameraRigController } from "../camera/CameraRigController";
import { LightingController } from "../lighting/LightingController";
import { useQuality } from "../quality";
import { Rain } from "../lighting/weather/Rain";
import { Lightning } from "../lighting/weather/Lightning";

/**
 * SceneRenderer — reads a SceneDefinition and renders the full 3D scene.
 * Replaces the monolithic TradingJourneyScene.
 */
export const SceneRenderer: React.FC<{
  scene: SceneDefinition;
  registry: PrefabRegistry;
  /** Lighting presets lookup (for string references) */
  lightingPresets: Record<string, LightingPreset>;
  /** Per-shot frame (relative to shot start) */
  frame: number;
  fps: number;
  /** Per-shot duration */
  durationFrames: number;
  /** Continuous phase frame (for smooth camera across shots) */
  phaseFrame?: number;
  /** Total phase duration (all shots in same phase) */
  phaseDurationFrames?: number;
}> = ({
  scene,
  registry,
  lightingPresets,
  frame,
  fps,
  durationFrames,
  phaseFrame,
  phaseDurationFrames,
}) => {
  const { config: quality } = useQuality();

  // Resolve lighting
  const lightingPreset: LightingPreset =
    typeof scene.lighting === "string"
      ? lightingPresets[scene.lighting] ?? lightingPresets["golden-hour"]
      : scene.lighting;

  // Normalized time for entity animation/motion
  const dur = phaseDurationFrames ?? durationFrames;
  const f = phaseFrame ?? frame;
  const t = Math.min(1, f / Math.max(1, dur));

  return (
    <>
      {/* Lighting */}
      <LightingController preset={lightingPreset} />

      {/* Camera */}
      <CameraRigController
        rig={scene.camera}
        frame={frame}
        durationFrames={durationFrames}
        phaseFrame={phaseFrame}
        phaseDurationFrames={phaseDurationFrames}
      />

      {/* Fog */}
      {quality.fog && scene.weather?.fog && (
        <fog
          attach="fog"
          args={[scene.weather.fog.color, scene.weather.fog.near, scene.weather.fog.far]}
        />
      )}

      {/* Weather */}
      {quality.rain && scene.weather?.rain && (
        <Rain frame={f} />
      )}
      {quality.lightning && scene.weather?.lightning && (
        <Lightning frame={f} />
      )}

      {/* Entities */}
      {scene.entities.map((entity) => (
        <EntityRenderer
          key={entity.id}
          entity={entity}
          registry={registry}
          frame={frame}
          fps={fps}
          durationFrames={durationFrames}
          t={t}
        />
      ))}
    </>
  );
};
