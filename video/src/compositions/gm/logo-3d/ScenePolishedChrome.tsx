/**
 * Scene 1 — Polished Chrome with Studio HDRI.
 * Clean FinTech mirror finish: Bloomberg, Stripe, Square territory.
 * No scratches, no grime. Just chrome catching light in a dark room.
 */
import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  staticFile,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { Environment, Text3D, Center } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  ToneMapping,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";

const FONT_PATH = staticFile("fonts/cinzel-decorative-black.typeface.json");
const HDRI_PATH = staticFile("textures/hdri/studio_small_03_1k.hdr");

// ── Camera: slow drift + gentle zoom ──
const ChromeCamera: React.FC<{ time: number; progress: number }> = ({
  time,
  progress,
}) => {
  const { camera } = useThree();
  const x = Math.sin(time * 0.1) * 0.015;
  const y = Math.cos(time * 0.07) * 0.01;
  const z = interpolate(progress, [0, 0.4, 1], [1.05, 0.92, 0.96], {
    extrapolateRight: "clamp",
  });
  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);
  return null;
};

// ── Sweeping directional light ──
const SweepingLight: React.FC<{ time: number }> = ({ time }) => {
  const x = Math.sin(time * 0.2) * 3;
  const y = 1.5 + Math.sin(time * 0.12) * 0.3;
  return (
    <directionalLight
      color="#ffffff"
      intensity={4}
      position={[x, y, 3]}
    />
  );
};

// ── 3D text with mirror chrome material ──
const ChromeText: React.FC<{ time: number }> = ({ time }) => {
  const breathe = 1 + Math.sin(time * 0.25) * 0.003;

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
          <meshPhysicalMaterial
            color="#e0e0e8"
            metalness={1}
            roughness={0.03}
            clearcoat={1}
            clearcoatRoughness={0.02}
            envMapIntensity={2.5}
            reflectivity={1}
            normalScale={new THREE.Vector2(0, 0)}
          />
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
          <meshPhysicalMaterial
            color="#e0e0e8"
            metalness={1}
            roughness={0.03}
            clearcoat={1}
            clearcoatRoughness={0.02}
            envMapIntensity={2.5}
            reflectivity={1}
            normalScale={new THREE.Vector2(0, 0)}
          />
        </Text3D>
      </group>
    </Center>
  );
};

// ── Inner scene ──
const SceneInner: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const time = frame / fps;
  const progress = frame / durationInFrames;

  return (
    <>
      <ChromeCamera time={time} progress={progress} />

      <ambientLight intensity={0.08} color="#ccccdd" />
      <SweepingLight time={time} />

      <Environment
        files={HDRI_PATH}
        background={false}
        environmentIntensity={1.2}
      />

      <ChromeText time={time} />

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
export const ScenePolishedChrome: React.FC = () => {
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
        position: [0, 0, 1.05],
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
        <SceneInner frame={frame} />
      </React.Suspense>
    </ThreeCanvas>
  );
};

export const scenePolishedChromeMeta = {
  id: "GMLogo-PolishedChrome",
  component: ScenePolishedChrome,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
};
