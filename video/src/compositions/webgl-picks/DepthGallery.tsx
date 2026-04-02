import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

const PLANE_COUNT = 8;
const DEPTH_SPACING = 3;
const TOTAL_DEPTH = PLANE_COUNT * DEPTH_SPACING;

const MOODS = [
  { bg: "#1a0a2e", b1: "#ff6b6b", b2: "#4ecdc4" },
  { bg: "#0d1b2a", b1: "#ffd93d", b2: "#6bcb77" },
  { bg: "#2d1b69", b1: "#ff8a5c", b2: "#ea5455" },
  { bg: "#1b3a4b", b1: "#95e1d3", b2: "#f38181" },
  { bg: "#0b132b", b1: "#5bc0eb", b2: "#fde74c" },
  { bg: "#1c1c3c", b1: "#e8d5b7", b2: "#00b4d8" },
  { bg: "#2b0d3a", b1: "#f72585", b2: "#7209b7" },
  { bg: "#0f2027", b1: "#2c5f2d", b2: "#97bc62" },
];

const PLANE_COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12",
  "#9b59b6", "#1abc9c", "#e67e22", "#2980b9",
];

// ── Color utilities ──

const hexToRgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
};

const lerpColor = (a: string, b: string, t: number): string => {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
};

// ── Camera dolly through the gallery ──

const CameraRig: React.FC<{
  frame: number;
  fps: number;
  totalFrames: number;
}> = ({ frame, fps, totalFrames }) => {
  const { camera } = useThree();
  const time = frame / fps;
  const progress = frame / totalFrames;

  const z = interpolate(progress, [0, 1], [2, -(TOTAL_DEPTH + 2)], {
    extrapolateRight: "clamp",
  });
  const x = Math.sin(time * 0.3) * 0.15;
  const y = Math.cos(time * 0.2) * 0.08;

  camera.position.set(x, y, z);
  camera.lookAt(x * 0.5, y * 0.5, z - 5);
  return null;
};

// ── Floating image planes ──

const GalleryPlanes: React.FC<{ time: number }> = ({ time }) => {
  const planes = useMemo(
    () =>
      PLANE_COLORS.map((color, i) => ({
        z: -i * DEPTH_SPACING - 2,
        x: (i % 2 === 0 ? -1 : 1) * (0.4 + (i % 3) * 0.15),
        y: ((i * 7 + 3) % 5 - 2) * 0.12,
        color,
      })),
    [],
  );

  return (
    <group>
      {planes.map((p, i) => {
        const breath = 1 + Math.sin(time * 0.5 + i * 1.2) * 0.02;
        const tiltX = Math.sin(time * 0.3 + i) * 0.03;
        const tiltY = Math.cos(time * 0.25 + i * 0.7) * 0.02;
        return (
          <mesh
            key={i}
            position={[p.x, p.y, p.z]}
            rotation={[tiltX, tiltY, 0]}
            scale={[breath, breath, 1]}
          >
            <planeGeometry args={[1.6, 1.0]} />
            <meshBasicMaterial color={p.color} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
};

// ── Luminous trail tube ──

const TrailTube: React.FC = () => {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      points.push(
        new THREE.Vector3(
          Math.sin(t * Math.PI * 2.5) * 0.35,
          Math.cos(t * Math.PI * 3.5) * 0.18,
          3 - t * (TOTAL_DEPTH + 6),
        ),
      );
    }
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, 200, 0.008, 6, false);
  }, []);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.15}
        toneMapped={false}
      />
    </mesh>
  );
};

// ── Three.js scene ──

const DepthScene: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const time = frame / fps;

  return (
    <>
      <CameraRig frame={frame} fps={fps} totalFrames={durationInFrames} />
      <ambientLight intensity={0.3} />
      <GalleryPlanes time={time} />
      <TrailTube />
    </>
  );
};

// ── Mood-shifting blob background (CSS) ──

const BlobBackground: React.FC<{
  frame: number;
  fps: number;
  totalFrames: number;
}> = ({ frame, fps, totalFrames }) => {
  const progress = frame / totalFrames;
  const time = frame / fps;

  const moodFloat = progress * (MOODS.length - 1);
  const idx = Math.min(Math.floor(moodFloat), MOODS.length - 2);
  const t = moodFloat - idx;
  const m0 = MOODS[idx];
  const m1 = MOODS[idx + 1];

  const bg = lerpColor(m0.bg, m1.bg, t);
  const c1 = lerpColor(m0.b1, m1.b1, t);
  const c2 = lerpColor(m0.b2, m1.b2, t);

  const b1x = 50 + Math.sin(time * 0.28) * 13 + Math.sin(time * 0.45) * 5;
  const b1y = 48 + Math.cos(time * 0.22) * 9;
  const b2x = 35 + Math.cos(time * 0.26) * 11;
  const b2y = 55 + Math.sin(time * 0.33) * 7;

  return (
    <AbsoluteFill
      style={{
        background: [
          `radial-gradient(circle at ${b1x}% ${b1y}%, ${c1}88, transparent 45%)`,
          `radial-gradient(circle at ${b2x}% ${b2y}%, ${c2}88, transparent 40%)`,
          bg,
        ].join(", "),
      }}
    />
  );
};

// ── Composition ──

export const DepthGallery: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill>
      <BlobBackground frame={frame} fps={fps} totalFrames={durationInFrames} />
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 45, near: 0.1, far: 100, position: [0, 0, 2] }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        style={{ position: "absolute" }}
      >
        <DepthScene frame={frame} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
