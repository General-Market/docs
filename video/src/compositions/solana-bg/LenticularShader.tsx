import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { Environment } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

const SLAT_COUNT = 48;
const SLAT_WIDTH = 0.065;
const SLAT_GAP = 0.001;
const SLAT_SPACING = SLAT_WIDTH + SLAT_GAP;
const TOTAL_WIDTH = SLAT_COUNT * SLAT_SPACING;
const SLAT_ANGLE = 0.2; // radians — tilt to catch side light

// ── Animated colored lights ──
const AuroraLights: React.FC<{ time: number }> = ({ time }) => {
  // 14 lights — balanced colors with more green/teal/amber
  const lights = useMemo(
    () => [
      // Top — green/teal dominant
      { color: "#00cc88", s: 0.15, p: 0, y: 0.8, r: 2.0 },
      { color: "#7744cc", s: 0.18, p: 2.4, y: 1.0, r: 1.8 },
      { color: "#00bbaa", s: 0.16, p: 0.8, y: 0.9, r: 1.6 },
      // Center — full spectrum
      { color: "#00ff88", s: 0.12, p: 1.2, y: 0.0, r: 2.2 },
      { color: "#ff6b00", s: 0.14, p: 4.8, y: 0.1, r: 1.9 },
      { color: "#0066ff", s: 0.1, p: 3.6, y: -0.1, r: 2.0 },
      { color: "#ff1493", s: 0.09, p: 5.0, y: 0.2, r: 1.7 },
      // Bottom — pink/amber
      { color: "#ff69b4", s: 0.11, p: 2.0, y: -0.6, r: 2.3 },
      { color: "#33ff55", s: 0.13, p: 3.2, y: -0.8, r: 1.5 },
      { color: "#ffaa00", s: 0.17, p: 1.6, y: -0.9, r: 1.8 },
      // Fill — wide-orbit sweeps, green/teal bias
      { color: "#22cc66", s: 0.08, p: 0.5, y: 0.5, r: 2.8 },
      { color: "#00ddaa", s: 0.07, p: 3.0, y: -0.3, r: 3.0 },
      { color: "#9955ff", s: 0.06, p: 1.8, y: 0.7, r: 2.5 },
      { color: "#dd8800", s: 0.1, p: 4.2, y: -0.5, r: 2.6 },
    ],
    []
  );

  return (
    <>
      {lights.map((l, i) => {
        const x = Math.sin(time * l.s * 2 + l.p) * l.r;
        const y = Math.cos(time * l.s * 1.5 + l.p * 0.7) * 1.2 + l.y;
        const z = 0.3 + Math.sin(time * l.s + l.p * 1.3) * 0.4;
        return (
          <pointLight
            key={i}
            color={l.color}
            intensity={45}
            distance={8}
            decay={1.0}
            position={[x, y, z]}
          />
        );
      })}
      <ambientLight intensity={0.01} color="#080814" />
    </>
  );
};

// ── Slat array — angled metallic slats like venetian blinds ──
const SlatArray: React.FC<{ time: number }> = ({ time }) => {
  const slats = useMemo(() => {
    const arr: { x: number; roughness: number }[] = [];
    for (let i = 0; i < SLAT_COUNT; i++) {
      arr.push({
        x: -TOTAL_WIDTH / 2 + i * SLAT_SPACING + SLAT_WIDTH / 2,
        roughness: 0.2 + (i % 7) * 0.025,
      });
    }
    return arr;
  }, []);

  // Subtle oscillation of the angle over time
  const angle = SLAT_ANGLE + Math.sin(time * 0.15) * 0.05;

  return (
    <group>
      {slats.map((s, i) => {
        // Alternate angle direction for adjacent slats — richer light variation
        const dir = i % 2 === 0 ? 1 : -1;
        const slatAngle = angle * dir + Math.sin(time * 0.1 + i * 0.2) * 0.03;
        return (
          <mesh
            key={i}
            position={[s.x, 0, 0]}
            rotation={[0, slatAngle, 0]}
          >
            <boxGeometry args={[SLAT_WIDTH, 5.0, 0.006]} />
            <meshPhysicalMaterial
              color="#0c0c18"
              metalness={0.82}
              roughness={s.roughness}
              clearcoat={0.7}
              clearcoatRoughness={0.1}
              reflectivity={0.95}
              envMapIntensity={3.0}
            />
          </mesh>
        );
      })}
    </group>
  );
};

// ── Emissive backdrop ──
const AuroraBackdrop: React.FC<{ time: number }> = ({ time }) => {
  const ribbons = useMemo(
    () => [
      { color: "#ff1493", y: 0.4, w: 6, h: 2.5 },
      { color: "#00cc66", y: -0.6, w: 5.5, h: 2.0 },
      { color: "#6633ff", y: 1.2, w: 5, h: 1.8 },
      { color: "#ff8800", y: -1.0, w: 6.5, h: 2.2 },
      { color: "#00aaff", y: 0.0, w: 6, h: 2.0 },
      { color: "#ff44aa", y: -1.5, w: 5.5, h: 1.8 },
      { color: "#22ffbb", y: 0.9, w: 5, h: 1.5 },
      { color: "#aa44ff", y: -0.3, w: 6, h: 2.3 },
      { color: "#ff6644", y: 1.5, w: 5, h: 1.6 },
      { color: "#44ccff", y: -1.8, w: 5.5, h: 1.8 },
    ],
    []
  );

  return (
    <group position={[0, 0, -1.5]}>
      {ribbons.map((r, i) => {
        const x = Math.sin(time * 0.18 + i * 1.1) * 2.0;
        const y = r.y + Math.cos(time * 0.13 + i * 0.8) * 0.6;
        const rot = Math.sin(time * 0.09 + i * 0.5) * 0.3;
        return (
          <mesh key={i} position={[x, y, -i * 0.04]} rotation={[0, 0, rot]}>
            <planeGeometry args={[r.w, r.h]} />
            <meshBasicMaterial
              color={r.color}
              transparent
              opacity={0.9}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
};

// ── Camera ──
const CameraRig: React.FC<{ time: number; progress: number }> = ({
  time,
  progress,
}) => {
  const { camera } = useThree();

  const x = Math.sin(time * 0.07) * 0.06;
  const y = Math.cos(time * 0.05) * 0.03;
  const z = interpolate(progress, [0, 0.5, 1], [1.5, 1.3, 1.5], {
    extrapolateRight: "clamp",
  });

  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);
  return null;
};

// ── Scene ──
const LenticularScene: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const time = frame / fps;
  const progress = frame / durationInFrames;

  return (
    <>
      <CameraRig time={time} progress={progress} />
      <Environment preset="night" environmentIntensity={1.5} />
      <AuroraLights time={time} />
      <AuroraBackdrop time={time} />
      <SlatArray time={time} />

    </>
  );
};

export const LenticularBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{
        fov: 50,
        near: 0.001,
        far: 50,
        position: [0, 0, 1.5],
      }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 3.0,
      }}
      style={{ background: "#000000" }}
    >
      <React.Suspense fallback={null}>
        <LenticularScene frame={frame} />
      </React.Suspense>
    </ThreeCanvas>
  );
};
