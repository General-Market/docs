/**
 * Scene 03: Glass Grid
 * Floating translucent glass panels with brand green edges.
 * Slowly rotating in 3D space. Apple-like product visualization.
 */
import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, Bloom, ToneMapping } from "@react-three/postprocessing";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ToneMappingMode } from "postprocessing";

const GlassPanel: React.FC<{
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number];
  opacity: number;
}> = ({ position, rotation, scale, opacity }) => (
  <mesh position={position} rotation={rotation}>
    <planeGeometry args={[scale[0], scale[1]]} />
    <meshPhysicalMaterial
      color="#0a1a12"
      metalness={0.1}
      roughness={0.05}
      transmission={0.85}
      thickness={0.3}
      ior={1.5}
      clearcoat={1.0}
      clearcoatRoughness={0.02}
      transparent
      opacity={opacity}
      side={THREE.DoubleSide}
      envMapIntensity={2.0}
    />
  </mesh>
);

const GlassEdge: React.FC<{
  position: [number, number, number];
  rotation: [number, number, number];
  width: number;
  height: number;
}> = ({ position, rotation, width, height }) => (
  <group position={position} rotation={rotation}>
    {/* Top edge */}
    <mesh position={[0, height / 2, 0]}>
      <boxGeometry args={[width, 0.005, 0.005]} />
      <meshBasicMaterial color="#00A36C" toneMapped={false} />
    </mesh>
    {/* Bottom edge */}
    <mesh position={[0, -height / 2, 0]}>
      <boxGeometry args={[width, 0.005, 0.005]} />
      <meshBasicMaterial color="#00A36C" toneMapped={false} />
    </mesh>
    {/* Left edge */}
    <mesh position={[-width / 2, 0, 0]}>
      <boxGeometry args={[0.005, height, 0.005]} />
      <meshBasicMaterial color="#008A5A" toneMapped={false} />
    </mesh>
    {/* Right edge */}
    <mesh position={[width / 2, 0, 0]}>
      <boxGeometry args={[0.005, height, 0.005]} />
      <meshBasicMaterial color="#008A5A" toneMapped={false} />
    </mesh>
  </group>
);

const Panels: React.FC<{ time: number }> = ({ time }) => {
  const panels = useMemo(
    () => [
      { x: 0, y: 0, z: 0, w: 1.2, h: 0.8, speed: 0.1, phase: 0 },
      { x: -0.8, y: 0.5, z: -0.5, w: 0.8, h: 0.6, speed: 0.12, phase: 1 },
      { x: 0.9, y: -0.3, z: -0.3, w: 1.0, h: 0.7, speed: 0.08, phase: 2 },
      { x: -0.3, y: -0.6, z: -0.8, w: 0.7, h: 0.5, speed: 0.15, phase: 3 },
      { x: 0.5, y: 0.7, z: -0.6, w: 0.9, h: 0.6, speed: 0.11, phase: 4 },
      { x: -1.1, y: -0.2, z: -0.4, w: 0.6, h: 0.9, speed: 0.09, phase: 5 },
      { x: 0.2, y: -0.8, z: -0.2, w: 1.1, h: 0.5, speed: 0.13, phase: 6 },
      { x: -0.6, y: 0.8, z: -0.7, w: 0.8, h: 0.8, speed: 0.07, phase: 7 },
    ],
    []
  );

  return (
    <group>
      {panels.map((p, i) => {
        const rx = Math.sin(time * p.speed + p.phase) * 0.3;
        const ry = time * p.speed * 0.5 + p.phase;
        const rz = Math.cos(time * p.speed * 0.7 + p.phase) * 0.15;
        const pos: [number, number, number] = [
          p.x + Math.sin(time * p.speed * 0.3 + p.phase) * 0.1,
          p.y + Math.cos(time * p.speed * 0.4 + p.phase) * 0.08,
          p.z,
        ];
        const rot: [number, number, number] = [rx, ry, rz];
        const opacity = 0.4 + Math.sin(time * 0.3 + i) * 0.15;
        return (
          <group key={i}>
            <GlassPanel position={pos} rotation={rot} scale={[p.w, p.h]} opacity={opacity} />
            <GlassEdge position={pos} rotation={rot} width={p.w} height={p.h} />
          </group>
        );
      })}
    </group>
  );
};

const Camera: React.FC<{ time: number; progress: number }> = ({ time, progress }) => {
  const { camera } = useThree();
  const z = interpolate(progress, [0, 0.5, 1], [3.0, 2.5, 3.0], { extrapolateRight: "clamp" });
  camera.position.set(Math.sin(time * 0.05) * 0.3, Math.cos(time * 0.04) * 0.2, z);
  camera.lookAt(0, 0, -0.3);
  return null;
};

const Scene: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const time = frame / fps;
  const progress = frame / durationInFrames;

  return (
    <>
      <Camera time={time} progress={progress} />
      <Environment frames={Infinity} resolution={256} background={false} environmentIntensity={0.3}>
        <color attach="background" args={["#000000"]} />
        <Lightformer form="rect" intensity={2} color="#00A36C" scale={[10, 3, 1]} position={[0, 5, -5]} />
        <Lightformer form="rect" intensity={1.5} color="#008A5A" scale={[8, 2, 1]} position={[0, -5, -4]} />
        <Lightformer form="circle" intensity={3} color="#ffffff" scale={2} position={[5, 3, 2]} />
        <Lightformer form="rect" intensity={0.8} color="#16A34A" scale={[6, 6, 1]} position={[-5, 0, -3]} />
      </Environment>
      <directionalLight color="#ffffff" intensity={2} position={[3, 3, 5]} />
      <ambientLight intensity={0.02} color="#001a0e" />
      <Panels time={time} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.4} intensity={1.0} mipmapBlur />
        <ToneMapping mode={ToneMappingMode.AGX} />
      </EffectComposer>
    </>
  );
};

export const GlassGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas width={width} height={height} camera={{ fov: 40, near: 0.01, far: 50, position: [0, 0, 3] }} gl={{ antialias: true, alpha: false, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }} style={{ background: "#000000" }}>
      <React.Suspense fallback={null}>
        <Scene frame={frame} />
      </React.Suspense>
    </ThreeCanvas>
  );
};

export const scene03Meta = {
  id: "GMLaunch-03-GlassGrid",
  component: GlassGrid,
  width: 1920, height: 1080, fps: 30,
  durationInFrames: 240,
};
