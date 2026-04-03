/**
 * Scene 01: Emerald Lenticular
 * The Solana-style metallic slats but in GM brand greens.
 * Deep green, teal, mint, white highlights on iridescent dark metal.
 */
import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, Bloom, ToneMapping } from "@react-three/postprocessing";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ToneMappingMode } from "postprocessing";

const SLAT_COUNT = 48;
const SLAT_WIDTH = 0.065;
const SLAT_GAP = 0.001;
const SLAT_SPACING = SLAT_WIDTH + SLAT_GAP;
const TOTAL_WIDTH = SLAT_COUNT * SLAT_SPACING;

const Lights: React.FC<{ time: number }> = ({ time }) => {
  const lights = useMemo(
    () => [
      { color: "#00A36C", s: 0.15, p: 0, y: 0.8, r: 2.0 },
      { color: "#008A5A", s: 0.12, p: 1.2, y: -0.3, r: 2.5 },
      { color: "#16A34A", s: 0.18, p: 2.4, y: 1.0, r: 1.8 },
      { color: "#00cc88", s: 0.1, p: 3.6, y: -0.5, r: 2.0 },
      { color: "#ffffff", s: 0.14, p: 4.8, y: 0.1, r: 1.9 },
      { color: "#00ddaa", s: 0.16, p: 0.8, y: -0.1, r: 1.6 },
      { color: "#E6F7F0", s: 0.11, p: 2.0, y: 0.5, r: 2.3 },
      { color: "#0A2E1C", s: 0.13, p: 3.2, y: -0.4, r: 1.5 },
      { color: "#00A36C", s: 0.09, p: 5.0, y: 0.0, r: 1.7 },
      { color: "#22ffaa", s: 0.08, p: 0.5, y: 0.7, r: 2.8 },
      { color: "#008A5A", s: 0.07, p: 3.0, y: -0.6, r: 3.0 },
      { color: "#ffffff", s: 0.06, p: 1.8, y: 0.9, r: 2.5 },
    ],
    []
  );

  return (
    <>
      {lights.map((l, i) => {
        const wave = Math.sin(time * l.s * 1.5 + l.p + i * 0.4) * 0.3;
        const x = Math.sin(time * l.s * 2 + l.p) * l.r;
        const y = Math.cos(time * l.s * 1.5 + l.p * 0.7) * 1.2 + l.y + wave;
        const z = 0.3 + Math.sin(time * l.s + l.p * 1.3) * 0.4;
        return (
          <pointLight key={i} color={l.color} intensity={45} distance={8} decay={1.0} position={[x, y, z]} />
        );
      })}
      <ambientLight intensity={0.01} color="#040a08" />
    </>
  );
};

const Slats: React.FC<{ time: number }> = ({ time }) => {
  const slats = useMemo(() => {
    const arr: { x: number; r: number; thMin: number; thMax: number }[] = [];
    for (let i = 0; i < SLAT_COUNT; i++) {
      arr.push({
        x: -TOTAL_WIDTH / 2 + i * SLAT_SPACING + SLAT_WIDTH / 2,
        r: 0.2 + (i % 7) * 0.025,
        thMin: 80 + (i % 5) * 50,
        thMax: 350 + (i % 3) * 180,
      });
    }
    return arr;
  }, []);

  const angle = 0.2 + Math.sin(time * 0.15) * 0.05;

  return (
    <group>
      {slats.map((s, i) => {
        const dir = i % 2 === 0 ? 1 : -1;
        const a = angle * dir + Math.sin(time * 0.1 + i * 0.2) * 0.03;
        return (
          <mesh key={i} position={[s.x, 0, 0]} rotation={[0, a, 0]}>
            <boxGeometry args={[SLAT_WIDTH, 5.0, 0.006]} />
            <meshPhysicalMaterial
              color="#060e0a"
              metalness={0.88}
              roughness={s.r}
              clearcoat={0.8}
              clearcoatRoughness={0.06}
              iridescence={0.85}
              iridescenceIOR={1.8}
              iridescenceThicknessRange={[s.thMin, s.thMax]}
              envMapIntensity={3.0}
              reflectivity={0.9}
            />
          </mesh>
        );
      })}
    </group>
  );
};

const Backdrop: React.FC<{ time: number }> = ({ time }) => {
  const ribbons = useMemo(
    () => [
      { color: "#00A36C", y: 0.4, w: 6, h: 2.5 },
      { color: "#008A5A", y: -0.6, w: 5.5, h: 2.0 },
      { color: "#16A34A", y: 1.2, w: 5, h: 1.8 },
      { color: "#00cc88", y: -1.0, w: 6.5, h: 2.2 },
      { color: "#22ffaa", y: 0.0, w: 6, h: 2.0 },
      { color: "#0A2E1C", y: -1.5, w: 5.5, h: 1.8 },
      { color: "#E6F7F0", y: 0.9, w: 5, h: 1.5 },
      { color: "#00A36C", y: -0.3, w: 6, h: 2.3 },
    ],
    []
  );

  return (
    <group position={[0, 0, -1.5]}>
      {ribbons.map((r, i) => (
        <mesh key={i} position={[Math.sin(time * 0.18 + i * 1.1) * 2, r.y + Math.cos(time * 0.13 + i * 0.8) * 0.6, -i * 0.04]} rotation={[0, 0, Math.sin(time * 0.09 + i * 0.5) * 0.3]}>
          <planeGeometry args={[r.w, r.h]} />
          <meshBasicMaterial color={r.color} transparent opacity={0.85} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
};

const Camera: React.FC<{ time: number; progress: number }> = ({ time, progress }) => {
  const { camera } = useThree();
  camera.position.set(Math.sin(time * 0.07) * 0.06, Math.cos(time * 0.05) * 0.03, interpolate(progress, [0, 0.5, 1], [1.5, 1.3, 1.5], { extrapolateRight: "clamp" }));
  camera.lookAt(0, 0, 0);
  return null;
};

const Scene: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const time = frame / fps;
  const progress = frame / durationInFrames;

  return (
    <>
      <Camera time={time} progress={progress} />
      <Environment frames={Infinity} resolution={256} background={false} environmentIntensity={0.15}>
        <color attach="background" args={["#000000"]} />
        <Lightformer form="rect" intensity={1.0} color="#00A36C" scale={[6, 2, 1]} position={[Math.sin(time * 0.08) * 6, 4, -6]} rotation={[0, time * 0.03, 0]} />
        <Lightformer form="rect" intensity={0.8} color="#008A5A" scale={[7, 2, 1]} position={[Math.cos(time * 0.06) * 7, -3, -5]} rotation={[0, time * 0.025 + 1.5, 0]} />
        <Lightformer form="circle" intensity={1.2} color="#16A34A" scale={3} position={[Math.sin(time * 0.1 + 2) * 5, 5, Math.cos(time * 0.08) * 6]} />
        <Lightformer form="rect" intensity={0.5} color="#ffffff" scale={[12, 0.5, 1]} position={[0, 7, -3]} />
      </Environment>
      <directionalLight color="#ffffff" intensity={4} position={[-2 + Math.sin(time * 0.12) * 1.5, 2 + Math.cos(time * 0.09) * 1, 3.5]} />
      <Lights time={time} />
      <Backdrop time={time} />
      <Slats time={time} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.8} luminanceSmoothing={0.3} intensity={0.6} mipmapBlur />
        <ToneMapping mode={ToneMappingMode.AGX} />
      </EffectComposer>
    </>
  );
};

export const EmeraldLenticular: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas width={width} height={height} camera={{ fov: 50, near: 0.001, far: 50, position: [0, 0, 1.5] }} gl={{ antialias: true, alpha: false, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }} style={{ background: "#000000" }}>
      <React.Suspense fallback={null}>
        <Scene frame={frame} />
      </React.Suspense>
    </ThreeCanvas>
  );
};

export const scene01Meta = {
  id: "GMLaunch-01-EmeraldLenticular",
  component: EmeraldLenticular,
  width: 1920, height: 1080, fps: 30,
  durationInFrames: 240,
};
