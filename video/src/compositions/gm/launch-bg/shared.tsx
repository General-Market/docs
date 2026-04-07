/**
 * Shared metallic slat scene factory.
 * Each variation passes a config — colors, material, light behavior, camera.
 */
import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, Bloom, ToneMapping } from "@react-three/postprocessing";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ToneMappingMode } from "postprocessing";

export interface LightDef {
  color: string;
  speed: number;
  phase: number;
  yOffset: number;
  radius: number;
}

export interface LightformerDef {
  color: string;
  form: "rect" | "circle";
  scale: [number, number, number];
  orbitRadius: number;
  orbitSpeed: number;
  yOffset: number;
  intensity: number;
}

export interface SceneConfig {
  // Material
  baseColor: string;
  metalness: number;
  roughnessRange: [number, number]; // min, step per slat
  clearcoat: number;
  clearcoatRoughness: number;
  iridescence: number;
  iridescenceIOR: number;
  iridescenceThicknessBase: [number, number]; // min, max
  envMapIntensity: number;
  reflectivity: number;
  // Optional glass/translucent properties
  transmission?: number;
  thickness?: number;
  ior?: number;
  transparent?: boolean;

  // Slats
  slatCount: number;
  slatWidth: number;
  slatGap: number;
  slatAngle: number;
  slatAngleOscillation: number;
  slatAlternate: boolean; // alternate angle direction per slat

  // Lights
  pointLights: LightDef[];
  pointLightIntensity: number;
  ambientIntensity: number;
  ambientColor: string;
  directionalIntensity: number;

  // Lightformers
  lightformers: LightformerDef[];
  envIntensity: number;
  envResolution: number;

  // Backdrop ribbons
  ribbons: { color: string; y: number; w: number; h: number }[];
  ribbonOpacity: number;

  // Camera
  fov: number;
  cameraZRange: [number, number, number]; // start, mid, end
  cameraDriftX: number;
  cameraDriftY: number;

  // Post-processing
  bloomThreshold: number;
  bloomIntensity: number;
  toneMapping: ToneMappingMode;
  toneMappingExposure: number;
}

// ── Scene implementation ──

export const Lights: React.FC<{ config: SceneConfig; time: number }> = ({ config, time }) => (
  <>
    {config.pointLights.map((l, i) => {
      const wave = Math.sin(time * l.speed * 1.5 + l.phase + i * 0.4) * 0.3;
      const x = Math.sin(time * l.speed * 2 + l.phase) * l.radius;
      const y = Math.cos(time * l.speed * 1.5 + l.phase * 0.7) * 1.2 + l.yOffset + wave;
      const z = 0.3 + Math.sin(time * l.speed + l.phase * 1.3) * 0.4;
      return (
        <pointLight key={i} color={l.color} intensity={config.pointLightIntensity} distance={8} decay={1.0} position={[x, y, z]} />
      );
    })}
    <ambientLight intensity={config.ambientIntensity} color={config.ambientColor} />
    <directionalLight
      color="#ffffff"
      intensity={config.directionalIntensity}
      position={[-2 + Math.sin(time * 0.12) * 1.5, 2 + Math.cos(time * 0.09) * 1, 3.5]}
    />
  </>
);

export const EnvFormers: React.FC<{ config: SceneConfig; time: number }> = ({ config, time }) => (
  <>
    {config.lightformers.map((lf, i) => (
      <Lightformer
        key={i}
        form={lf.form}
        intensity={lf.intensity}
        color={lf.color}
        scale={lf.scale}
        position={[
          Math.sin(time * lf.orbitSpeed + i * 1.5) * lf.orbitRadius,
          lf.yOffset + Math.cos(time * lf.orbitSpeed * 0.7 + i) * 2,
          Math.cos(time * lf.orbitSpeed + i * 1.5) * lf.orbitRadius,
        ]}
        rotation={[0, time * lf.orbitSpeed * 0.3 + i, 0]}
      />
    ))}
    {/* White key strips */}
    <Lightformer form="rect" intensity={0.4} color="#ffffff" scale={[12, 0.5, 1]} position={[0, 7, -3]} />
    <Lightformer form="rect" intensity={0.3} color="#ffffff" scale={[12, 0.5, 1]} position={[0, -7, -3]} />
  </>
);

const Slats: React.FC<{ config: SceneConfig; time: number }> = ({ config, time }) => {
  const spacing = config.slatWidth + config.slatGap;
  const totalWidth = config.slatCount * spacing;

  const slats = useMemo(() => {
    const arr: { x: number; r: number; thMin: number; thMax: number }[] = [];
    for (let i = 0; i < config.slatCount; i++) {
      arr.push({
        x: -totalWidth / 2 + i * spacing + config.slatWidth / 2,
        r: config.roughnessRange[0] + (i % 7) * config.roughnessRange[1],
        thMin: config.iridescenceThicknessBase[0] + (i % 5) * 50,
        thMax: config.iridescenceThicknessBase[1] + (i % 3) * 150,
      });
    }
    return arr;
  }, [config, spacing, totalWidth]);

  const angle = config.slatAngle + Math.sin(time * 0.15) * config.slatAngleOscillation;

  return (
    <group>
      {slats.map((s, i) => {
        const dir = config.slatAlternate ? (i % 2 === 0 ? 1 : -1) : 1;
        const a = angle * dir + Math.sin(time * 0.1 + i * 0.2) * 0.025;
        return (
          <mesh key={i} position={[s.x, 0, 0]} rotation={[0, a, 0]}>
            <boxGeometry args={[config.slatWidth, 5.0, 0.006]} />
            <meshPhysicalMaterial
              color={config.baseColor}
              metalness={config.metalness}
              roughness={s.r}
              clearcoat={config.clearcoat}
              clearcoatRoughness={config.clearcoatRoughness}
              iridescence={config.iridescence}
              iridescenceIOR={config.iridescenceIOR}
              iridescenceThicknessRange={[s.thMin, s.thMax]}
              envMapIntensity={config.envMapIntensity}
              reflectivity={config.reflectivity}
              {...(config.transmission != null && { transmission: config.transmission })}
              {...(config.thickness != null && { thickness: config.thickness })}
              {...(config.ior != null && { ior: config.ior })}
              {...(config.transparent != null && { transparent: config.transparent })}
              side={config.transparent ? THREE.DoubleSide : THREE.FrontSide}
            />
          </mesh>
        );
      })}
    </group>
  );
};

export const Backdrop: React.FC<{ config: SceneConfig; time: number }> = ({ config, time }) => (
  <group position={[0, 0, -1.5]}>
    {config.ribbons.map((r, i) => (
      <mesh key={i} position={[Math.sin(time * 0.18 + i * 1.1) * 2, r.y + Math.cos(time * 0.13 + i * 0.8) * 0.6 + Math.sin(time * 0.22 + i * 0.6) * 0.3, -i * 0.04]} rotation={[0, 0, Math.sin(time * 0.09 + i * 0.5) * 0.3]}>
        <planeGeometry args={[r.w, r.h]} />
        <meshBasicMaterial color={r.color} transparent opacity={config.ribbonOpacity} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    ))}
  </group>
);

export const Camera: React.FC<{ config: SceneConfig; time: number; progress: number }> = ({ config, time, progress }) => {
  const { camera } = useThree();
  const x = Math.sin(time * 0.07) * config.cameraDriftX;
  const y = Math.cos(time * 0.05) * config.cameraDriftY;
  const z = interpolate(progress, [0, 0.5, 1], config.cameraZRange, { extrapolateRight: "clamp" });
  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);
  return null;
};

const SceneInner: React.FC<{ config: SceneConfig; frame: number }> = ({ config, frame }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const time = frame / fps;
  const progress = frame / durationInFrames;

  return (
    <>
      <Camera config={config} time={time} progress={progress} />
      <Environment frames={Infinity} resolution={config.envResolution} background={false} environmentIntensity={config.envIntensity}>
        <color attach="background" args={["#000000"]} />
        <EnvFormers config={config} time={time} />
      </Environment>
      <Lights config={config} time={time} />
      <Backdrop config={config} time={time} />
      <Slats config={config} time={time} />
      <EffectComposer>
        <Bloom luminanceThreshold={config.bloomThreshold} luminanceSmoothing={0.3} intensity={config.bloomIntensity} mipmapBlur />
        <ToneMapping mode={config.toneMapping} />
      </EffectComposer>
    </>
  );
};

export const MetallicScene: React.FC<{ config: SceneConfig }> = ({ config }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{ fov: config.fov, near: 0.001, far: 50, position: [0, 0, config.cameraZRange[0]] }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }}
      style={{ background: "#000000" }}
    >
      <React.Suspense fallback={null}>
        <SceneInner config={config} frame={frame} />
      </React.Suspense>
    </ThreeCanvas>
  );
};
