/**
 * Rounded slat variants — four different geometries applied to the holoWhite scene.
 * Reuses Camera / Lights / EnvFormers / Backdrop / post from shared.tsx.
 * Only the slat geometry changes per variant.
 */
import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { Environment, RoundedBox } from "@react-three/drei";
import { EffectComposer, Bloom, ToneMapping } from "@react-three/postprocessing";
import * as THREE from "three";
import type { SceneConfig } from "./shared";
import { Camera, Lights, EnvFormers, Backdrop } from "./shared";
import { holoWhite } from "./configs-white";

type RoundedKind = "cylinder" | "capsule" | "roundedBox" | "lathe";

const SLAT_HEIGHT = 5.0;
const RADIAL_SEGMENTS = 24;

// Shared material props so every variant inherits holoWhite's iridescent metal.
const materialFor = (config: SceneConfig, i: number) => ({
  color: config.baseColor,
  metalness: config.metalness,
  roughness: config.roughnessRange[0] + (i % 7) * config.roughnessRange[1],
  clearcoat: config.clearcoat,
  clearcoatRoughness: config.clearcoatRoughness,
  iridescence: config.iridescence,
  iridescenceIOR: config.iridescenceIOR,
  iridescenceThicknessRange: [
    config.iridescenceThicknessBase[0] + (i % 5) * 50,
    config.iridescenceThicknessBase[1] + (i % 3) * 150,
  ] as [number, number],
  envMapIntensity: config.envMapIntensity,
  reflectivity: config.reflectivity,
});

// T4 — lathe profile. Pillow-shaped pillar: pinched top & bottom, bulged middle.
const latheProfile = (radius: number): THREE.Vector2[] => {
  const h = SLAT_HEIGHT / 2;
  return [
    new THREE.Vector2(0, -h),
    new THREE.Vector2(radius * 0.6, -h + 0.02),
    new THREE.Vector2(radius, -h * 0.8),
    new THREE.Vector2(radius * 1.05, 0),
    new THREE.Vector2(radius, h * 0.8),
    new THREE.Vector2(radius * 0.6, h - 0.02),
    new THREE.Vector2(0, h),
  ];
};

const RoundedSlats: React.FC<{ config: SceneConfig; time: number; kind: RoundedKind }> = ({
  config,
  time,
  kind,
}) => {
  const spacing = config.slatWidth + config.slatGap;
  const totalWidth = config.slatCount * spacing;
  const radius = config.slatWidth / 2;

  const slats = useMemo(() => {
    const arr: { x: number; i: number }[] = [];
    for (let i = 0; i < config.slatCount; i++) {
      arr.push({ x: -totalWidth / 2 + i * spacing + config.slatWidth / 2, i });
    }
    return arr;
  }, [config.slatCount, spacing, totalWidth, config.slatWidth]);

  const latheGeom = useMemo(() => {
    if (kind !== "lathe") return null;
    return new THREE.LatheGeometry(latheProfile(radius), RADIAL_SEGMENTS);
  }, [kind, radius]);

  // RoundedBox variant keeps the Y-axis slat rotation (still has flat faces).
  // Radially symmetric variants (cylinder, capsule, lathe) ignore Y rotation and
  // instead oscillate a subtle X offset so the pillars breathe.
  const angle = config.slatAngle + Math.sin(time * 0.15) * config.slatAngleOscillation;

  return (
    <group>
      {slats.map((s) => {
        const dir = config.slatAlternate ? (s.i % 2 === 0 ? 1 : -1) : 1;
        const rY = angle * dir + Math.sin(time * 0.1 + s.i * 0.2) * 0.025;
        const breathe = Math.sin(time * 0.12 + s.i * 0.18) * 0.008;
        const matProps = materialFor(config, s.i);
        const isRoundedBox = kind === "roundedBox";
        const position: [number, number, number] = [
          s.x + (isRoundedBox ? 0 : breathe),
          0,
          0,
        ];
        const rotation: [number, number, number] = [0, isRoundedBox ? rY : 0, 0];

        if (kind === "cylinder") {
          return (
            <mesh key={s.i} position={position} rotation={rotation}>
              <cylinderGeometry args={[radius, radius, SLAT_HEIGHT, RADIAL_SEGMENTS]} />
              <meshPhysicalMaterial {...matProps} side={THREE.FrontSide} />
            </mesh>
          );
        }

        if (kind === "capsule") {
          const bodyHeight = SLAT_HEIGHT - radius * 2;
          return (
            <mesh key={s.i} position={position} rotation={rotation}>
              <capsuleGeometry args={[radius, bodyHeight, 8, RADIAL_SEGMENTS]} />
              <meshPhysicalMaterial {...matProps} side={THREE.FrontSide} />
            </mesh>
          );
        }

        if (kind === "lathe") {
          return (
            <mesh key={s.i} position={position} rotation={rotation} geometry={latheGeom!}>
              <meshPhysicalMaterial {...matProps} side={THREE.DoubleSide} />
            </mesh>
          );
        }

        // roundedBox — drei component
        return (
          <RoundedBox
            key={s.i}
            position={position}
            rotation={rotation}
            args={[config.slatWidth, SLAT_HEIGHT, config.slatWidth * 0.9]}
            radius={config.slatWidth * 0.35}
            smoothness={4}
            creaseAngle={0.4}
          >
            <meshPhysicalMaterial {...matProps} side={THREE.FrontSide} />
          </RoundedBox>
        );
      })}
    </group>
  );
};

const RoundedSceneInner: React.FC<{ config: SceneConfig; frame: number; kind: RoundedKind }> = ({
  config,
  frame,
  kind,
}) => {
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
      <RoundedSlats config={config} time={time} kind={kind} />
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

const RoundedScene: React.FC<{ kind: RoundedKind; config?: SceneConfig }> = ({
  kind,
  config = holoWhite,
}) => {
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
        <RoundedSceneInner config={config} frame={frame} kind={kind} />
      </React.Suspense>
    </ThreeCanvas>
  );
};

export const RoundedT1Cylinder: React.FC = () => <RoundedScene kind="cylinder" />;
export const RoundedT2Capsule: React.FC = () => <RoundedScene kind="capsule" />;
export const RoundedT3RoundedBox: React.FC = () => <RoundedScene kind="roundedBox" />;
export const RoundedT4Lathe: React.FC = () => <RoundedScene kind="lathe" />;
