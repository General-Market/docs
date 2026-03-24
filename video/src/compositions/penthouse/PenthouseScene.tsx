import React, { useMemo, useRef } from "react";
import { interpolate, staticFile } from "remotion";
import { useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";

// ── New modular components ───────────────────────────────────────────────────
import { CurvedDesk } from "./CurvedDesk";
import { MonitorSetup } from "./MonitorSetup";
import { CityBuildings3D } from "./CityBuildings3D";
import { WindowFrames3D } from "./WindowFrames3D";
import { WeatherSystem, getWeatherState } from "./WeatherSystem";
import { ReflectiveFloor, DeskReflection, RoomUpgraded } from "./SceneEffects";

// ── Camera Controller ───────────────────────────────────────────────────────
export const CameraController: React.FC<{ frame: number; totalFrames: number }> = ({ frame, totalFrames }) => {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);

  const t = frame / totalFrames;
  const camX = interpolate(t, [0, 0.5, 1], [0.15, -0.1, 0.2], { extrapolateRight: "clamp" });
  const camY = interpolate(t, [0, 0.3, 0.7, 1], [1.35, 1.32, 1.38, 1.4], { extrapolateRight: "clamp" });
  const camZ = interpolate(t, [0, 1], [2.0, 1.7], { extrapolateRight: "clamp" });

  const breathX = Math.sin(frame * 0.012) * 0.02;
  const breathY = Math.sin(frame * 0.018) * 0.01;

  camera.position.set(camX + breathX, camY + breathY, camZ);
  target.set(camX * 0.3, 1.1, -1.5);
  camera.lookAt(target);

  return null;
};

// ── Coffee Mug ──────────────────────────────────────────────────────────────
const CoffeeMug: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    <mesh>
      <cylinderGeometry args={[0.035, 0.03, 0.08, 12]} />
      <meshStandardMaterial color="#B86832" roughness={0.6} metalness={0.1} />
    </mesh>
    <mesh position={[0.045, 0.005, 0]} rotation={[0, 0, Math.PI / 2]}>
      <torusGeometry args={[0.02, 0.005, 8, 12, Math.PI]} />
      <meshStandardMaterial color="#B86832" roughness={0.6} />
    </mesh>
    <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.032, 12]} />
      <meshStandardMaterial color="#2a1a0a" roughness={0.2} />
    </mesh>
  </group>
);

// ── Keyboard ────────────────────────────────────────────────────────────────
const Keyboard: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    <mesh>
      <boxGeometry args={[0.4, 0.015, 0.14]} />
      <meshStandardMaterial color="#1a1a22" roughness={0.4} metalness={0.3} />
    </mesh>
    {Array.from({ length: 4 }).map((_, row) =>
      Array.from({ length: 12 }).map((_, col) => (
        <mesh key={`${row}-${col}`} position={[-0.17 + col * 0.03, 0.01, -0.05 + row * 0.03]}>
          <boxGeometry args={[0.022, 0.006, 0.022]} />
          <meshStandardMaterial color="#252530" roughness={0.5} metalness={0.2} />
        </mesh>
      ))
    )}
  </group>
);

const Mouse: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    <mesh>
      <boxGeometry args={[0.04, 0.015, 0.07]} />
      <meshStandardMaterial color="#1a1a22" roughness={0.4} metalness={0.3} />
    </mesh>
    <mesh position={[0, 0.01, -0.01]}>
      <cylinderGeometry args={[0.004, 0.004, 0.015, 8]} />
      <meshStandardMaterial color="#333" roughness={0.3} metalness={0.5} />
    </mesh>
  </group>
);

// ── AgiaArena Flag — realistic fabric cloth simulation ──────────────────────
const FLAG_W = 0.55;
const FLAG_H = 0.38;
const FLAG_SEGS_X = 48;
const FLAG_SEGS_Y = 32;

const AgiaArenaFlag: React.FC<{ frame: number }> = ({ frame }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const tex = loader.load(staticFile("shorts/short-01/backgrounds/agi-logo.png"));
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, []);

  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(FLAG_W, FLAG_H, FLAG_SEGS_X, FLAG_SEGS_Y);
  }, []);

  const originalPositions = useMemo(() => {
    return new Float32Array(geometry.attributes.position.array);
  }, [geometry]);

  const positions = geometry.attributes.position;
  const halfW = FLAG_W / 2;
  const halfH = FLAG_H / 2;
  const t = frame * 0.07;

  const windBase = 1.0;
  const windGust = windBase + Math.sin(frame * 0.02) * 0.4 + Math.sin(frame * 0.053) * 0.25;
  const windDir = Math.sin(frame * 0.008) * 0.15;

  for (let i = 0; i < positions.count; i++) {
    const ox = originalPositions[i * 3];
    const oy = originalPositions[i * 3 + 1];

    const nx = (ox + halfW) / FLAG_W;
    const ny = (oy + halfH) / FLAG_H;
    const dist = nx * nx * nx;
    const poleConstraint = Math.max(0, nx - 0.02);

    const billow = Math.sin(nx * 3.5 - t * windGust * 1.1 + ny * 0.5) * 0.06 * dist;
    const ripple = Math.sin(nx * 7.0 - t * windGust * 1.6 + ny * 2.0 + 1.2) * 0.025 * dist;
    const micro = Math.sin(nx * 14.0 - t * 2.2 + ny * 6.0 + 0.7) * 0.008 * nx * nx;
    const crossWave = Math.sin(ny * 5.0 + nx * 2.0 - t * 0.8) * 0.015 * dist;
    const edgeFlutter = Math.sin(nx * 18.0 - t * 3.0 + ny * 8.0) * 0.005 * nx * nx * nx * nx;
    const windShift = windDir * nx * nx * 0.03;

    const zDisplace = billow + ripple + micro + crossWave + edgeFlutter + windShift;

    const gravitySag = -poleConstraint * poleConstraint * 0.02 * (1.2 - ny);
    const waveLift = Math.sin(nx * 3.5 - t * windGust * 1.1) * 0.01 * dist;
    const bottomFlap = ny < 0.15 ? Math.sin(nx * 6.0 - t * 1.8) * 0.006 * nx : 0;
    const yDisplace = gravitySag + waveLift + bottomFlap;

    const xStretch = Math.cos(nx * 3.5 - t * windGust * 1.1) * 0.008 * dist;
    const windPull = poleConstraint * 0.005 * windGust;

    positions.setXYZ(i, ox + xStretch + windPull, oy + yDisplace, zDisplace);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();

  const opacity = interpolate(frame, [20, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glowIntensity = 0.18 + Math.sin(frame * 0.04) * 0.05;

  return (
    <group position={[-1.55, 2.45, -2.35]} rotation={[0, 0.25, 0]}>
      <mesh position={[-halfW, 0, 0]}>
        <cylinderGeometry args={[0.006, 0.008, 0.9, 8]} />
        <meshStandardMaterial color="#555" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[-halfW, 0.45, 0]}>
        <sphereGeometry args={[0.014, 8, 8]} />
        <meshStandardMaterial color="#b89040" roughness={0.2} metalness={0.8} />
      </mesh>
      <mesh position={[-halfW, -0.42, 0]}>
        <cylinderGeometry args={[0.012, 0.015, 0.06, 8]} />
        <meshStandardMaterial color="#444" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive={new THREE.Color("#cc2200")}
          emissiveIntensity={glowIntensity}
          transparent
          opacity={opacity}
          roughness={0.7}
          metalness={0.0}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <pointLight position={[0, 0, 0.2]} color="#cc2200" intensity={0.1 * opacity} distance={1.5} decay={2} />
    </group>
  );
};

// ── Main Scene ──────────────────────────────────────────────────────────────
export const PenthouseScene: React.FC<{ frame: number }> = ({ frame }) => {
  const { timeOfDay, rainIntensity } = getWeatherState(frame);

  return (
    <>
      <CameraController frame={frame} totalFrames={600} />

      {/* HDRI environment for realistic reflections and ambient lighting */}
      <Environment files={staticFile("compositions/penthouse/sunset_env.hdr")} background={false} />

      {/* Weather system — dynamic lighting, rain, lightning */}
      <WeatherSystem frame={frame} />

      {/* Room — upgraded walls, ceiling */}
      <RoomUpgraded />

      {/* Reflective floor */}
      <ReflectiveFloor />

      {/* 3D City skyline — real Three.js building meshes (back + right side) */}
      <CityBuildings3D frame={frame} timeOfDay={timeOfDay} rainIntensity={rainIntensity} />

      {/* Panoramic window frames — back wall + right wall */}
      <WindowFrames3D />

      {/* AgiaArena Flag — waving cloth in background */}
      <AgiaArenaFlag frame={frame} />

      {/* Curved desk */}
      <CurvedDesk />

      {/* Desk surface reflection */}
      <DeskReflection />

      {/* 6 Monitors — fixed black screens, thinner bezels */}
      <MonitorSetup frame={frame} />

      {/* Props — positioned on the new desk arc (pivotZ=0.8, rInner=1.3) */}
      <CoffeeMug position={[-0.71, 0.80, -0.51]} />
      <CoffeeMug position={[0.71, 0.80, -0.51]} />
      <Keyboard position={[0, 0.77, -0.62]} />
      <Mouse position={[0.21, 0.77, -0.61]} />

      {/* Fog — handled by WeatherSystem */}
    </>
  );
};
