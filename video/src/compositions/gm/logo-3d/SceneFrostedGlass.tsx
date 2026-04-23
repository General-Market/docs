/**
 * Scene 5 — Frosted Glass.
 * Semi-transparent glass text with subtle refraction and chromatic aberration.
 * Light passes through the letters. Stripe / Apple Vision Pro aesthetic.
 * Clean, modern, ethereal — physical presence that feels weightless.
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
  MeshTransmissionMaterial,
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
  const x = Math.sin(time * 0.07) * 0.01;
  const y = Math.cos(time * 0.05) * 0.006;
  const z = interpolate(progress, [0, 0.5, 1], [1.0, 0.96, 1.0], {
    extrapolateRight: "clamp",
  });
  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);
  return null;
};

// ── Gradient backdrop — gives the glass something to refract ──
const GradientBackdrop: React.FC = () => {
  return (
    <mesh position={[0, 0, -0.5]}>
      <planeGeometry args={[4, 3]} />
      <meshBasicMaterial color="#080810" />
    </mesh>
  );
};

// ── Glass text line ──
const GlassLine: React.FC<{
  children: string;
  size: number;
  height: number;
  position: [number, number, number];
}> = ({ children, size, height, position }) => {
  return (
    <Text3D
      font={FONT_PATH}
      size={size}
      height={height}
      bevelEnabled
      bevelSize={0.008}
      bevelThickness={0.004}
      bevelSegments={6}
      curveSegments={32}
      letterSpacing={-0.01}
      position={position}
    >
      {children}
      <MeshTransmissionMaterial
        backside
        samples={8}
        thickness={0.3}
        chromaticAberration={0.02}
        anisotropy={0.1}
        distortion={0.1}
        distortionScale={0.2}
        temporalDistortion={0}
        transmission={0.95}
        roughness={0.3}
        color="#e0e0e8"
        ior={1.5}
      />
    </Text3D>
  );
};

// ── Logo text ──
const LogoText: React.FC<{ time: number }> = ({ time }) => {
  const breathe = 1 + Math.sin(time * 0.25) * 0.003;

  return (
    <Center>
      <group scale={breathe * 0.5}>
        <GlassLine size={0.22} height={0.06} position={[0, 0.12, 0]}>
          GENERAL
        </GlassLine>
        <GlassLine size={0.26} height={0.08} position={[0, -0.18, 0]}>
          MARKET
        </GlassLine>
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
      <DriftCamera time={time} progress={progress} />

      <ambientLight intensity={0.08} color="#e0e0ff" />

      <GradientBackdrop />

      <Environment
        frames={Infinity}
        resolution={256}
        background={false}
        environmentIntensity={0.6}
      >
        <color attach="background" args={["#000000"]} />

        {/* Broad soft overhead — primary refraction source */}
        <Lightformer
          form="rect"
          intensity={2.5}
          color="#ffffff"
          scale={[15, 5, 1]}
          position={[0, 5, -4]}
        />
        {/* Lower fill — cool tint */}
        <Lightformer
          form="rect"
          intensity={1.2}
          color="#c0c8e0"
          scale={[12, 3, 1]}
          position={[0, -4, -4]}
        />
        {/* Right accent */}
        <Lightformer
          form="rect"
          intensity={1.5}
          color="#ffffff"
          scale={[0.5, 8, 1]}
          position={[6, 0, -3]}
        />
        {/* Left accent — subtle warm */}
        <Lightformer
          form="rect"
          intensity={1.0}
          color="#e8e0d8"
          scale={[0.5, 6, 1]}
          position={[-6, 0, -3]}
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

export const SceneFrostedGlass: React.FC = () => {
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
      style={{ background: "#080810" }}
    >
      <React.Suspense fallback={null}>
        <SceneInner frame={frame} />
      </React.Suspense>
    </ThreeCanvas>
  );
};

export const sceneFrostedGlassMeta = {
  id: "GMLogo-FrostedGlass",
  component: SceneFrostedGlass,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
};
