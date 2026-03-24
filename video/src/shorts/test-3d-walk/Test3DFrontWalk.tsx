import React, { Suspense, useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { WalkingCharacter } from "./PersonCharacter";

// ── Meta ────────────────────────────────────────────────────────────────────
export const test3DFrontWalkMeta = {
  id: "Test3DFrontWalk",
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 300,
};

// ── Colors ──────────────────────────────────────────────────────────────────
const COL = {
  bg: "#0a0a12",
  character: "#8B5CF6",
  gridLine: "#1a1a3e",
  gridBright: "#6366F1",
  rimPurple: "#A855F7",
  rimCyan: "#22D3EE",
};

// ── Animated Grid Ground (Spotify visualizer style) ─────────────────────────
const GRID_SIZE = 60;
const GRID_SEGMENTS = 80;

const GridGround: React.FC<{ frame: number; walkZ: number }> = ({ frame, walkZ }) => {
  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, GRID_SEGMENTS, GRID_SEGMENTS);
  }, []);

  // Animate vertex positions for wave effect
  const animatedGeometry = useMemo(() => {
    const geo = geometry.clone();
    const pos = geo.attributes.position;
    const time = frame * 0.05;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i); // This is Z in world space (plane is rotated)

      // Distance from character
      const dx = x;
      const dz = y - walkZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Wave displacement
      const wave1 = Math.sin(x * 0.3 + time * 2) * Math.sin(y * 0.3 + time * 1.5);
      const wave2 = Math.sin(x * 0.15 - time) * Math.cos(y * 0.2 + time * 0.8);
      // Reactive: amplitude increases near character
      const proximity = Math.max(0, 1 - dist / 8);
      const reactiveBoost = 1 + proximity * 2;

      const displacement = (wave1 * 0.3 + wave2 * 0.2) * reactiveBoost;
      pos.setZ(i, displacement);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [geometry, frame, walkZ]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} geometry={animatedGeometry}>
      <meshStandardMaterial
        color="#080818"
        metalness={0.9}
        roughness={0.15}
        wireframe={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// ── Grid lines overlay ─────────────────────────────────────────────────────
const GridLines: React.FC<{ frame: number; walkZ: number }> = ({ frame, walkZ }) => {
  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, GRID_SEGMENTS, GRID_SEGMENTS);
  }, []);

  const animatedGeometry = useMemo(() => {
    const geo = geometry.clone();
    const pos = geo.attributes.position;
    const time = frame * 0.05;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);

      const dx = x;
      const dz = y - walkZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      const wave1 = Math.sin(x * 0.3 + time * 2) * Math.sin(y * 0.3 + time * 1.5);
      const wave2 = Math.sin(x * 0.15 - time) * Math.cos(y * 0.2 + time * 0.8);
      const proximity = Math.max(0, 1 - dist / 8);
      const reactiveBoost = 1 + proximity * 2;

      const displacement = (wave1 * 0.3 + wave2 * 0.2) * reactiveBoost;
      pos.setZ(i, displacement + 0.02); // Slightly above solid ground
    }
    pos.needsUpdate = true;
    return geo;
  }, [geometry, frame, walkZ]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} geometry={animatedGeometry}>
      <meshBasicMaterial
        color={COL.gridLine}
        wireframe
        transparent
        opacity={0.6}
      />
    </mesh>
  );
};

// ── Pulsing point lights for reflections ───────────────────────────────────
const PulsingLights: React.FC<{ frame: number; walkZ: number }> = ({ frame, walkZ }) => {
  const time = frame * 0.1;
  const pulse1 = 0.5 + Math.sin(time) * 0.5;
  const pulse2 = 0.5 + Math.sin(time * 1.3 + 1) * 0.5;
  const pulse3 = 0.5 + Math.sin(time * 0.7 + 2) * 0.5;

  return (
    <>
      <pointLight
        position={[Math.sin(time * 0.5) * 3, 0.5, walkZ + 2]}
        color="#A855F7"
        intensity={pulse1 * 4}
        distance={10}
      />
      <pointLight
        position={[Math.cos(time * 0.4) * 4, 0.3, walkZ - 3]}
        color="#22D3EE"
        intensity={pulse2 * 3}
        distance={10}
      />
      <pointLight
        position={[Math.sin(time * 0.6 + 3) * 2, 0.8, walkZ + 5]}
        color="#6366F1"
        intensity={pulse3 * 2}
        distance={8}
      />
    </>
  );
};

// ── Vertical light beams (background) ──────────────────────────────────────
const LightBeams: React.FC<{ frame: number; walkZ: number }> = ({ frame, walkZ }) => {
  const time = frame * 0.03;
  const beams = useMemo(
    () => [
      { x: -5, z: 8, color: "#A855F7", phase: 0 },
      { x: 3, z: 12, color: "#22D3EE", phase: 1.5 },
      { x: -2, z: 15, color: "#6366F1", phase: 3 },
      { x: 6, z: 6, color: "#EC4899", phase: 4.5 },
    ],
    []
  );

  return (
    <>
      {beams.map((beam, i) => {
        const opacity = 0.15 + Math.sin(time * 2 + beam.phase) * 0.1;
        return (
          <mesh
            key={i}
            position={[beam.x, 4, walkZ + beam.z]}
          >
            <cylinderGeometry args={[0.05, 0.3, 8, 6]} />
            <meshBasicMaterial color={beam.color} transparent opacity={opacity} />
          </mesh>
        );
      })}
    </>
  );
};

// ── Camera Controller ───────────────────────────────────────────────────────
const CameraController: React.FC<{ walkZ: number; frame: number }> = ({ walkZ, frame }) => {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);

  // Camera directly in front, backing up as character walks
  const cameraZ = walkZ - 3;
  const cameraY = 1.6 + Math.sin(frame * 0.25) * 0.03; // Subtle sway
  const cameraX = Math.sin(frame * 0.08) * 0.1; // Slight horizontal drift

  camera.position.set(cameraX, cameraY, cameraZ);
  target.set(0, 1.2, walkZ);
  camera.lookAt(target);

  return null;
};

// ── Character shadow on dark ground ─────────────────────────────────────────
const DarkShadow: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <mesh
    position={[position[0], 0.02, position[2]]}
    rotation={[-Math.PI / 2, 0, 0]}
  >
    <circleGeometry args={[0.6, 16]} />
    <meshBasicMaterial color="#6366F1" transparent opacity={0.15} />
  </mesh>
);

// ── Main Scene ──────────────────────────────────────────────────────────────
const Scene: React.FC<{ frame: number }> = ({ frame }) => {
  const walkZ = interpolate(frame, [20, 270], [0, 20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <>
      <CameraController walkZ={walkZ} frame={frame} />

      {/* Dark ambient */}
      <ambientLight color="#1a1a2e" intensity={0.3} />

      {/* Key light from above-front */}
      <directionalLight position={[0, 5, walkZ - 5]} intensity={0.6} color="#E0E0FF" />

      {/* Rim lights behind character — purple and cyan */}
      <pointLight
        position={[-1.5, 2, walkZ + 2]}
        color={COL.rimPurple}
        intensity={3}
        distance={6}
      />
      <pointLight
        position={[1.5, 2, walkZ + 2]}
        color={COL.rimCyan}
        intensity={3}
        distance={6}
      />

      {/* Pulsing colored lights for ground reflections */}
      <PulsingLights frame={frame} walkZ={walkZ} />

      {/* Background light beams */}
      <LightBeams frame={frame} walkZ={walkZ} />

      {/* Fog for depth fadeout */}
      <fog attach="fog" args={["#0a0a12", 6, 25]} />

      {/* ── Animated ground ── */}
      <GridGround frame={frame} walkZ={walkZ} />
      <GridLines frame={frame} walkZ={walkZ} />

      {/* ── Walking character ── */}
      <WalkingCharacter
        frame={frame}
        walkPos={[0, 0, walkZ]}
        color={COL.character}
        rotationY={Math.PI} // Face camera
      />
      <DarkShadow position={[0, 0, walkZ]} />
    </>
  );
};

// ── Composition ─────────────────────────────────────────────────────────────
export const Test3DFrontWalk: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: COL.bg }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{
          fov: 55,
          near: 0.1,
          far: 100,
          position: [0, 1.6, -3],
        }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        style={{ background: COL.bg }}
      >
        <Suspense fallback={null}>
          <Scene frame={frame} />
        </Suspense>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
