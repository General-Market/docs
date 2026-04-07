/**
 * Woven metallic ribbons — a basket weave ("panier tressé") built from flat
 * plane bands whose vertices are displaced in Z to interlace over/under at
 * every crossing, with an optional slow S-bend and outward dome curvature.
 *
 * Reuses the lighting, environment and post-processing stack of
 * MetallicScene so existing configs' material language carries across.
 *
 * Geometry is built once per config via useMemo; per-frame motion is
 * expressed as cheap group rotation + camera drift, never by rebuilding
 * vertex buffers.
 */
import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { Environment } from "@react-three/drei";
import { EffectComposer, Bloom, ToneMapping } from "@react-three/postprocessing";
import * as THREE from "three";
import {
  Lights,
  EnvFormers,
  Backdrop,
  Camera,
  type SceneConfig,
} from "./shared";

/**
 * Woven config extends SceneConfig. The slat* fields on the base config are
 * ignored by this scene; everything else (material, lighting, environment,
 * camera) carries over unchanged.
 */
export interface WovenConfig extends SceneConfig {
  weaveRows: number;       // horizontal band count
  weaveCols: number;       // vertical band count
  bandWidth: number;       // ribbon width (flat dimension)
  bandSpan: number;        // total length of each band
  weaveAmplitude: number;  // z displacement at each crossing
  bendAmplitude: number;   // slow long-wave S-bend along each band
  domeCurvature: number;   // outward dome bow across the whole weave
  segments: number;        // geometry resolution along band length
  weaveRotationY: number;  // static rotation around Y
  weaveTiltX: number;      // static tilt around X
  weaveScale: number;      // uniform scale
  spinSpeed: number;       // per-frame rotation speed
  spinAmplitude: number;   // per-frame rotation amplitude
}

type Orient = "horizontal" | "vertical";

interface BandSpec {
  orient: Orient;
  index: number;       // row (horizontal) or col (vertical)
  otherCount: number;  // crossings of the opposite-axis bands
  rowY: number;
  colX: number;
}

/**
 * Build a ribbon geometry that follows a weave + bend + dome profile.
 *
 * Weave math: parametrise the band length by u ∈ [0, 1].
 *   horiz z(u, r) = +A * cos(π * u * (cols + 1) + r * π)
 *   vert  z(u, c) = -A * cos(π * u * (rows + 1) + c * π)
 *
 * At each crossing u = k / (cross+1) for integer k, the cosine collapses
 * to (-1)^(k + r) / (-1)^(k + c), and the opposing signs guarantee one band
 * rides over the other — a clean interlace with zero z-fighting.
 */
const buildRibbonGeometry = (spec: BandSpec, cfg: WovenConfig): THREE.PlaneGeometry => {
  const { bandSpan: L, bandWidth: W, segments } = cfg;
  const A = cfg.weaveAmplitude;
  const B = cfg.bendAmplitude;
  const D = cfg.domeCurvature;

  const geom =
    spec.orient === "horizontal"
      ? new THREE.PlaneGeometry(L, W, segments, 1)
      : new THREE.PlaneGeometry(W, L, 1, segments);

  const pos = geom.attributes.position as THREE.BufferAttribute;
  const halfL = L / 2;
  const sign = spec.orient === "horizontal" ? 1 : -1;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);

    // u ∈ [0, 1] along the band length
    const u = spec.orient === "horizontal" ? (vx + halfL) / L : (vy + halfL) / L;

    // Weave oscillation — cosine with alternating phase per band index
    const weave = Math.cos(Math.PI * u * (spec.otherCount + 1) + spec.index * Math.PI);

    // Slow S-bend — one half-wave of sine across the span
    const bend = Math.sin(Math.PI * u);

    // Dome falloff — position relative to weave center
    const domeX = spec.orient === "horizontal" ? vx : spec.colX;
    const domeY = spec.orient === "horizontal" ? spec.rowY : vy;
    const dx = (domeX * 2) / L;
    const dy = (domeY * 2) / L;
    const domeFalloff = Math.max(0, 1 - dx * dx - dy * dy);

    pos.setZ(i, sign * A * weave + B * bend + D * domeFalloff);
  }

  geom.computeVertexNormals();
  return geom;
};

/**
 * Build all band specs for the weave. Stable per config so useMemo on the
 * resulting array avoids re-allocating at every frame.
 */
const buildBandSpecs = (cfg: WovenConfig): BandSpec[] => {
  const rowSpacing = cfg.bandSpan / (cfg.weaveRows + 1);
  const colSpacing = cfg.bandSpan / (cfg.weaveCols + 1);
  const specs: BandSpec[] = [];
  for (let r = 0; r < cfg.weaveRows; r++) {
    specs.push({
      orient: "horizontal",
      index: r,
      otherCount: cfg.weaveCols,
      rowY: (r - (cfg.weaveRows - 1) / 2) * rowSpacing,
      colX: 0,
    });
  }
  for (let c = 0; c < cfg.weaveCols; c++) {
    specs.push({
      orient: "vertical",
      index: c,
      otherCount: cfg.weaveRows,
      rowY: 0,
      colX: (c - (cfg.weaveCols - 1) / 2) * colSpacing,
    });
  }
  return specs;
};

const WovenMesh: React.FC<{ config: WovenConfig; time: number }> = ({ config, time }) => {
  const specs = useMemo(() => buildBandSpecs(config), [config]);
  const geometries = useMemo(
    () => specs.map((spec) => buildRibbonGeometry(spec, config)),
    [specs, config],
  );

  // Single shared material for all bands — per-mesh creation would recreate
  // the underlying three.js resource every frame.
  const material = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(config.baseColor),
      metalness: config.metalness,
      roughness: config.roughnessRange[0],
      clearcoat: config.clearcoat,
      clearcoatRoughness: config.clearcoatRoughness,
      iridescence: config.iridescence,
      iridescenceIOR: config.iridescenceIOR,
      iridescenceThicknessRange: [
        config.iridescenceThicknessBase[0],
        config.iridescenceThicknessBase[1],
      ],
      envMapIntensity: config.envMapIntensity,
      reflectivity: config.reflectivity,
      side: THREE.DoubleSide,
    });
    if (config.transmission != null) mat.transmission = config.transmission;
    if (config.thickness != null) mat.thickness = config.thickness;
    if (config.ior != null) mat.ior = config.ior;
    if (config.transparent != null) mat.transparent = config.transparent;
    return mat;
  }, [config]);

  // Cheap per-frame motion: group-level rotation oscillation + a slow spin.
  const wobbleY = Math.sin(time * config.spinSpeed) * config.spinAmplitude;
  const wobbleX = Math.cos(time * config.spinSpeed * 0.7) * config.spinAmplitude * 0.4;

  return (
    <group
      scale={config.weaveScale}
      rotation={[config.weaveTiltX + wobbleX, config.weaveRotationY + wobbleY, 0]}
    >
      {geometries.map((geom, i) => {
        const spec = specs[i];
        const pos: [number, number, number] =
          spec.orient === "horizontal" ? [0, spec.rowY, 0] : [spec.colX, 0, 0];
        return (
          <mesh key={i} position={pos} geometry={geom} material={material} />
        );
      })}
    </group>
  );
};

const WovenSceneInner: React.FC<{ config: WovenConfig; frame: number }> = ({ config, frame }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const time = frame / fps;
  const progress = frame / durationInFrames;

  return (
    <>
      <Camera config={config} time={time} progress={progress} />
      <Environment
        frames={Infinity}
        resolution={config.envResolution}
        background={false}
        environmentIntensity={config.envIntensity}
      >
        <color attach="background" args={["#000000"]} />
        <EnvFormers config={config} time={time} />
      </Environment>
      <Lights config={config} time={time} />
      <Backdrop config={config} time={time} />
      <WovenMesh config={config} time={time} />
      <EffectComposer>
        <Bloom
          luminanceThreshold={config.bloomThreshold}
          luminanceSmoothing={0.3}
          intensity={config.bloomIntensity}
          mipmapBlur
        />
        <ToneMapping mode={config.toneMapping} />
      </EffectComposer>
    </>
  );
};

export const WovenMetallicScene: React.FC<{ config: WovenConfig }> = ({ config }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{
        fov: config.fov,
        near: 0.001,
        far: 50,
        position: [0, 0, config.cameraZRange[0]],
      }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        toneMapping: THREE.NoToneMapping,
      }}
      style={{ background: "#000000" }}
    >
      <React.Suspense fallback={null}>
        <WovenSceneInner config={config} frame={frame} />
      </React.Suspense>
    </ThreeCanvas>
  );
};
