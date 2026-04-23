/**
 * Scene 4 — Brushed Aluminum
 * Apple-style machined aluminum. Clean directional highlights,
 * clearcoat finish, the quiet confidence of a surface that
 * has been polished by someone who knows when to stop.
 */
import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, interpolate, staticFile } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  Text3D,
  Center,
  useTexture,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  ToneMapping,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";

const FONT_PATH = staticFile("fonts/cinzel-decorative-black.typeface.json");
const NORMAL_MAP_PATH = staticFile(
  "textures/brushed-metal/Metal009_1K-JPG_NormalGL.jpg",
);

// ── Brushed aluminum material ──
const BrushedAluminumMaterial: React.FC = () => {
  const normalMap = useTexture(NORMAL_MAP_PATH);

  useMemo(() => {
    normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.repeat.set(4, 4);
  }, [normalMap]);

  return (
    <meshPhysicalMaterial
      color="#b8b8c0"
      metalness={0.95}
      roughness={0.2}
      normalMap={normalMap}
      normalScale={new THREE.Vector2(0.3, 0.3)}
      clearcoat={0.8}
      clearcoatRoughness={0.1}
      envMapIntensity={2.5}
    />
  );
};

// ── Camera with gentle drift ──
const DriftCamera: React.FC<{ time: number; progress: number }> = ({
  time,
  progress,
}) => {
  const { camera } = useThree();
  const x = Math.sin(time * 0.12) * 0.015;
  const y = Math.cos(time * 0.09) * 0.01;
  const z = interpolate(progress, [0, 0.5, 1], [1.05, 0.95, 1.0], {
    extrapolateRight: "clamp",
  });
  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);
  return null;
};

// ── Logo text ──
const LogoText: React.FC<{ time: number }> = ({ time }) => {
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
          <BrushedAluminumMaterial />
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
          <BrushedAluminumMaterial />
        </Text3D>
      </group>
    </Center>
  );
};

// ── Scene contents ──
const SceneInner: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const time = frame / fps;
  const progress = frame / durationInFrames;

  return (
    <>
      <DriftCamera time={time} progress={progress} />

      <ambientLight intensity={0.12} color="#c0c0d0" />
      <directionalLight
        color="#e8e8f0"
        intensity={2.5}
        position={[2, 3, 4]}
      />
      <directionalLight
        color="#d0d0e0"
        intensity={1.2}
        position={[-3, 1, 2]}
      />

      <Environment
        frames={Infinity}
        resolution={256}
        background={false}
        environmentIntensity={0.5}
      >
        <color attach="background" args={["#0a0a0a"]} />
        {/* Top — broad white fill */}
        <Lightformer
          form="rect"
          intensity={2.5}
          color="#ffffff"
          scale={[20, 5, 1]}
          position={[0, 6, -5]}
        />
        {/* Bottom — subtle cool fill */}
        <Lightformer
          form="rect"
          intensity={0.8}
          color="#d0d4e0"
          scale={[20, 3, 1]}
          position={[0, -6, -5]}
        />
        {/* Side — gentle warmth */}
        <Lightformer
          form="rect"
          intensity={1.0}
          color="#f0ece0"
          scale={[3, 10, 1]}
          position={[8, 0, -3]}
          rotation={[0, -Math.PI / 4, 0]}
        />
      </Environment>

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

// ── Root component ──
export const SceneBrushedAluminum: React.FC = () => {
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
      style={{ background: "#0a0a0a" }}
    >
      <React.Suspense fallback={null}>
        <SceneInner frame={frame} />
      </React.Suspense>
    </ThreeCanvas>
  );
};

export const sceneBrushedAluminumMeta = {
  id: "GMLogo-BrushedAluminum",
  component: SceneBrushedAluminum,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
};
