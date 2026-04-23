/**
 * Scene 2 — Matcap Silver.
 * Clean FinTech-style 3D metallic logo.
 * Matcap textures bake all lighting into the material —
 * no environment maps, no point lights, no moving parts
 * except the camera and the text breathing.
 */
import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  staticFile,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { Text3D, Center, useTexture } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  ToneMapping,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";

const FONT_PATH = staticFile("fonts/cinzel-decorative-black.typeface.json");

const MATCAP_PATH = staticFile("textures/matcaps/silver-polish.png");

// ── Matcap material ──

const SilverMatcapMaterial: React.FC = () => {
  const matcap = useTexture(MATCAP_PATH);

  useMemo(() => {
    matcap.colorSpace = THREE.SRGBColorSpace;
  }, [matcap]);

  return <meshMatcapMaterial matcap={matcap} color="#e8e8f0" />;
};

// ── Logo text ──

const LogoText: React.FC<{ time: number }> = ({ time }) => {
  const breathe = 1 + Math.sin(time * 0.3) * 0.004;

  return (
    <Center>
      <group scale={breathe * 0.5}>
        <Text3D
          font={FONT_PATH}
          size={0.22}
          height={0.06}
          bevelEnabled
          bevelSize={0.008}
          bevelThickness={0.005}
          bevelSegments={6}
          curveSegments={32}
          letterSpacing={-0.01}
          position={[0, 0.12, 0]}
        >
          GENERAL
          <SilverMatcapMaterial />
        </Text3D>

        <Text3D
          font={FONT_PATH}
          size={0.26}
          height={0.08}
          bevelEnabled
          bevelSize={0.008}
          bevelThickness={0.006}
          bevelSegments={6}
          curveSegments={32}
          letterSpacing={-0.01}
          position={[0, -0.18, 0]}
        >
          MARKET
          <SilverMatcapMaterial />
        </Text3D>
      </group>
    </Center>
  );
};

// ── Camera drift ──

const DriftCamera: React.FC<{ time: number; progress: number }> = ({
  time,
  progress,
}) => {
  const { camera } = useThree();

  const x = Math.sin(time * 0.1) * 0.015;
  const y = Math.cos(time * 0.07) * 0.01;
  const z = interpolate(progress, [0, 0.4, 1], [1.05, 0.95, 1.0], {
    extrapolateRight: "clamp",
  });

  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);
  return null;
};

// ── Inner scene ──

const SceneInner: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const time = frame / fps;
  const progress = frame / durationInFrames;

  return (
    <>
      <DriftCamera time={time} progress={progress} />

      {/* Minimal ambient — matcap does the heavy lifting */}
      <ambientLight intensity={0.05} color="#ffffff" />

      <LogoText time={time} />

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.85}
          luminanceSmoothing={0.4}
          intensity={0.3}
          mipmapBlur
        />
        <ToneMapping mode={ToneMappingMode.AGX} />
      </EffectComposer>
    </>
  );
};

// ── Exported component ──

export const SceneMatcapSilver: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{
        fov: 45,
        near: 0.001,
        far: 50,
        position: [0, 0, 1.0],
      }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        toneMapping: THREE.NoToneMapping,
      }}
      style={{ background: "#0a0a0c" }}
    >
      <React.Suspense fallback={null}>
        <SceneInner frame={frame} />
      </React.Suspense>
    </ThreeCanvas>
  );
};

export const sceneMatcapSilverMeta = {
  id: "GMLogo-MatcapSilver",
  component: SceneMatcapSilver,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
};
