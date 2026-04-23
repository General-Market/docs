/**
 * Scene 3 — Dark Chrome with Edge Glow.
 * Near-black chrome metal, barely visible in the dark.
 * Narrow lightformer strips and orbiting point lights
 * catch the edges, revealing letter shapes through contrast alone.
 * Bloomberg terminal aesthetic — institutional, dramatic, minimal.
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
import {
  Environment,
  Lightformer,
  Text3D,
  Center,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  ToneMapping,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";

const FONT_PATH = staticFile("fonts/cinzel-decorative-black.typeface.json");

// ── Camera drift ──
const DriftCamera: React.FC<{ time: number; progress: number }> = ({
  time,
  progress,
}) => {
  const { camera } = useThree();
  const x = Math.sin(time * 0.06) * 0.012;
  const y = Math.cos(time * 0.04) * 0.008;
  const z = interpolate(progress, [0, 0.5, 1], [1.0, 0.95, 1.0], {
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
          <meshPhysicalMaterial
            color="#080810"
            metalness={1}
            roughness={0.15}
            clearcoat={1}
            clearcoatRoughness={0.05}
            envMapIntensity={3}
            reflectivity={1}
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
            color="#080810"
            metalness={1}
            roughness={0.15}
            clearcoat={1}
            clearcoatRoughness={0.05}
            envMapIntensity={3}
            reflectivity={1}
          />
        </Text3D>
      </group>
    </Center>
  );
};

// ── Orbiting rim lights ──
const OrbitLights: React.FC<{ time: number }> = ({ time }) => {
  const angle1 = time * 0.3;
  const angle2 = time * 0.2 + Math.PI;
  const radius = 1.8;

  return (
    <>
      {/* White — sweeps from upper right */}
      <pointLight
        color="#ffffff"
        intensity={15}
        distance={6}
        decay={2}
        position={[
          Math.cos(angle1) * radius,
          0.4 + Math.sin(angle1 * 0.7) * 0.3,
          Math.sin(angle1) * radius,
        ]}
      />
      {/* Cool blue — sweeps from lower left */}
      <pointLight
        color="#6688cc"
        intensity={12}
        distance={5}
        decay={2}
        position={[
          Math.cos(angle2) * radius * 0.9,
          -0.2 + Math.sin(angle2 * 0.5) * 0.2,
          Math.sin(angle2) * radius * 0.9,
        ]}
      />
    </>
  );
};

// ── Inner scene ──
const SceneInner: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const time = frame / fps;
  const progress = frame / durationInFrames;

  return (
    <>
      <DriftCamera time={time} progress={progress} />

      {/* Near-zero ambient — the lightformers do all the work */}
      <ambientLight intensity={0.02} color="#ffffff" />

      <Environment
        frames={Infinity}
        resolution={256}
        background={false}
        environmentIntensity={0.5}
      >
        <color attach="background" args={["#000000"]} />

        {/* Top rim — narrow white strip */}
        <Lightformer
          form="rect"
          intensity={3.0}
          color="#ffffff"
          scale={[12, 0.4, 1]}
          position={[0, 4, -3]}
        />
        {/* Bottom rim — subtle blue strip */}
        <Lightformer
          form="rect"
          intensity={1.5}
          color="#4466aa"
          scale={[10, 0.3, 1]}
          position={[0, -4, -3]}
        />
        {/* Right edge — sharp white accent */}
        <Lightformer
          form="rect"
          intensity={2.5}
          color="#ffffff"
          scale={[0.3, 8, 1]}
          position={[5, 0, -2]}
        />
        {/* Left edge — cool blue accent */}
        <Lightformer
          form="rect"
          intensity={1.8}
          color="#5577bb"
          scale={[0.3, 6, 1]}
          position={[-5, 0, -2]}
        />
        {/* Back-center — faint fill to catch top bevels */}
        <Lightformer
          form="rect"
          intensity={0.8}
          color="#aabbdd"
          scale={[4, 2, 1]}
          position={[0, 1, -6]}
        />
      </Environment>

      <OrbitLights time={time} />

      <LogoText time={time} />

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.7}
          luminanceSmoothing={0.3}
          intensity={0.6}
          mipmapBlur
        />
        <ToneMapping mode={ToneMappingMode.AGX} />
      </EffectComposer>
    </>
  );
};

export const SceneDarkChrome: React.FC = () => {
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
      style={{ background: "#000000" }}
    >
      <React.Suspense fallback={null}>
        <SceneInner frame={frame} />
      </React.Suspense>
    </ThreeCanvas>
  );
};

export const sceneDarkChromeMeta = {
  id: "GMLogo-DarkChrome",
  component: SceneDarkChrome,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
};
