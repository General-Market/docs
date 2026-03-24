import React, { useMemo, useRef, useEffect } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DESK_ROWS = 4;
const DESKS_PER_ROW = 6;
// 3 screens per desk = 72 total

const COLOR_BG = "#050510";
const COLOR_SCREEN_GREEN = "#00FF41";
const COLOR_SCREEN_RED = "#FF3333";
const COLOR_SCREEN_BLUE = "#00D4FF";
const COLOR_DESK = "#1a1a2e";
const COLOR_FLOOR = "#080812";
const COLOR_YELLOW = "#FFE500";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Screen data — each screen has a position, color, flicker phase
// ---------------------------------------------------------------------------

interface ScreenData {
  x: number;
  y: number;
  z: number;
  color: THREE.Color;
  phase: number;
  barCount: number;
}

function buildScreens(): ScreenData[] {
  const rng = mulberry32(31337);
  const screens: ScreenData[] = [];
  const colors = [
    new THREE.Color(COLOR_SCREEN_GREEN),
    new THREE.Color(COLOR_SCREEN_RED),
    new THREE.Color(COLOR_SCREEN_BLUE),
  ];

  const rowSpacing = 3.0;
  const deskSpacing = 2.8;
  const startZ = -(DESK_ROWS * rowSpacing) / 2;
  const startX = -(DESKS_PER_ROW * deskSpacing) / 2;

  for (let row = 0; row < DESK_ROWS; row++) {
    for (let col = 0; col < DESKS_PER_ROW; col++) {
      const baseX = startX + col * deskSpacing + (rng() - 0.5) * 0.3;
      const baseZ = startZ + row * rowSpacing + (rng() - 0.5) * 0.3;

      // 3 screens per desk (left, center, right)
      for (let s = 0; s < 3; s++) {
        screens.push({
          x: baseX + (s - 1) * 0.55,
          y: 1.2 + rng() * 0.15,
          z: baseZ,
          color: colors[Math.floor(rng() * colors.length)],
          phase: rng() * Math.PI * 2,
          barCount: 3 + Math.floor(rng() * 5),
        });
      }
    }
  }

  return screens;
}

// ---------------------------------------------------------------------------
// Ticker data — scrolling numbers along walls
// ---------------------------------------------------------------------------

// Ticker data reserved for future scrolling text overlay

// ---------------------------------------------------------------------------
// TradingScreens — instanced screen rectangles with glow
// ---------------------------------------------------------------------------

const TradingScreens: React.FC<{
  screens: ScreenData[];
  frame: number;
  revealProgress: number;
}> = ({ screens, frame, revealProgress }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const colorArray = useMemo(() => {
    const arr = new Float32Array(screens.length * 3);
    for (let i = 0; i < screens.length; i++) {
      const c = screens[i].color;
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, [screens]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const colorAttr = new THREE.InstancedBufferAttribute(colorArray, 3);
    mesh.geometry.setAttribute("color", colorAttr);
  }, [colorArray]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < screens.length; i++) {
      const scr = screens[i];

      // Staggered reveal from center outward
      const distFromCenter = Math.sqrt(scr.x * scr.x + scr.z * scr.z);
      const maxDist = 12;
      const normalizedDist = Math.min(1, distFromCenter / maxDist);
      const appear = Math.max(
        0,
        Math.min(1, (revealProgress - normalizedDist * 0.6) / 0.4),
      );

      if (appear <= 0) {
        dummy.scale.set(0, 0, 0);
      } else {
        // Flicker effect
        const flicker =
          0.7 + 0.3 * Math.sin(frame * 0.15 + scr.phase);

        dummy.position.set(scr.x, scr.y * appear, scr.z);
        dummy.scale.set(0.45 * appear, 0.35 * appear * flicker, 0.02);
        dummy.rotation.set(0, 0, 0);
      }

      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, screens.length]}
      frustumCulled={false}
    >
      <meshStandardMaterial
        vertexColors
        emissive={new THREE.Color("#ffffff")}
        emissiveIntensity={0.8}
        roughness={0.2}
        metalness={0.1}
        transparent
        opacity={0.95}
      />
    </instancedMesh>
  );
};

// ---------------------------------------------------------------------------
// Desk rows — dark rectangles as desk surfaces
// ---------------------------------------------------------------------------

const DeskRows: React.FC<{ revealProgress: number }> = ({
  revealProgress,
}) => {
  const desks = useMemo(() => {
    const result: { x: number; z: number }[] = [];
    const rng = mulberry32(31337);
    const rowSpacing = 3.0;
    const deskSpacing = 2.8;
    const startZ = -(DESK_ROWS * rowSpacing) / 2;
    const startX = -(DESKS_PER_ROW * deskSpacing) / 2;

    for (let row = 0; row < DESK_ROWS; row++) {
      for (let col = 0; col < DESKS_PER_ROW; col++) {
        result.push({
          x: startX + col * deskSpacing + (rng() - 0.5) * 0.3,
          z: startZ + row * rowSpacing + (rng() - 0.5) * 0.3,
        });
        // consume same rng calls as buildScreens
        for (let s = 0; s < 3; s++) {
          rng();
          rng();
          rng();
          rng();
        }
      }
    }
    return result;
  }, []);

  return (
    <>
      {desks.map((desk, i) => {
        const distFromCenter = Math.sqrt(
          desk.x * desk.x + desk.z * desk.z,
        );
        const normalizedDist = Math.min(1, distFromCenter / 12);
        const appear = Math.max(
          0,
          Math.min(1, (revealProgress - normalizedDist * 0.6) / 0.4),
        );

        if (appear <= 0) return null;

        return (
          <mesh
            key={i}
            position={[desk.x, 0.5 * appear, desk.z]}
            scale={[2.2 * appear, 0.1, 1.2 * appear]}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={COLOR_DESK}
              roughness={0.7}
              metalness={0.3}
            />
          </mesh>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------------------
// Floor — reflective dark surface
// ---------------------------------------------------------------------------

const Floor: React.FC = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
    <planeGeometry args={[40, 30]} />
    <meshStandardMaterial
      color={COLOR_FLOOR}
      roughness={0.4}
      metalness={0.6}
    />
  </mesh>
);

// ---------------------------------------------------------------------------
// Floating particles — data dust in the air
// ---------------------------------------------------------------------------

const DataParticles: React.FC<{ frame: number }> = ({ frame }) => {
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const rng = mulberry32(5555);
    const count = 200;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (rng() - 0.5) * 30;
      arr[i * 3 + 1] = rng() * 8;
      arr[i * 3 + 2] = (rng() - 0.5) * 20;
    }
    return { positions: arr, count };
  }, []);

  useFrame(() => {
    const pts = pointsRef.current;
    if (!pts) return;
    const posAttr = pts.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < particles.count; i++) {
      // Drift upward slowly
      arr[i * 3 + 1] = ((arr[i * 3 + 1] + 0.015) % 8);
      // Subtle sway
      arr[i * 3] += Math.sin(frame * 0.02 + i) * 0.003;
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[particles.positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color={COLOR_SCREEN_GREEN}
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
};

// ---------------------------------------------------------------------------
// Camera — swooping overview
// ---------------------------------------------------------------------------

const CameraController: React.FC<{
  frame: number;
  durationFrames: number;
}> = ({ frame, durationFrames }) => {
  const { camera } = useThree();

  useFrame(() => {
    const t = Math.min(1, frame / Math.max(1, durationFrames));

    // Start: high overview looking down
    // End: lower, immersed in the floor
    const startPos = { x: 8, y: 12, z: 14 };
    const endPos = { x: 0, y: 4, z: 6 };

    const x = startPos.x + (endPos.x - startPos.x) * t;
    const y = startPos.y + (endPos.y - startPos.y) * t;
    const z = startPos.z + (endPos.z - startPos.z) * t;

    camera.position.set(x, y, z);
    camera.lookAt(0, 1, -2);
  });

  return null;
};

// ---------------------------------------------------------------------------
// TradingFloorScene
// ---------------------------------------------------------------------------

const TradingFloorScene: React.FC<{
  frame: number;
  durationFrames: number;
  screens: ScreenData[];
  revealProgress: number;
}> = ({ frame, durationFrames, screens, revealProgress }) => {
  const { scene } = useThree();

  useEffect(() => {
    scene.fog = new THREE.FogExp2(COLOR_BG, 0.04);
    scene.background = new THREE.Color(COLOR_BG);
    return () => {
      scene.fog = null;
      scene.background = null;
    };
  }, [scene]);

  return (
    <>
      {/* Ambient fill */}
      <ambientLight intensity={0.08} color="#334466" />

      {/* Overhead cold light */}
      <directionalLight
        position={[0, 15, 5]}
        intensity={0.6}
        color="#aabbdd"
      />

      {/* Green accent from screens */}
      <pointLight
        position={[0, 3, 0]}
        intensity={1.5}
        color={COLOR_SCREEN_GREEN}
        distance={20}
        decay={2}
      />

      {/* Blue rim light */}
      <pointLight
        position={[-10, 5, -5]}
        intensity={0.8}
        color={COLOR_SCREEN_BLUE}
        distance={25}
        decay={2}
      />

      {/* Yellow accent */}
      <pointLight
        position={[8, 4, 3]}
        intensity={0.5}
        color={COLOR_YELLOW}
        distance={15}
        decay={2}
      />

      <CameraController frame={frame} durationFrames={durationFrames} />

      <Floor />
      <DeskRows revealProgress={revealProgress} />
      <TradingScreens
        screens={screens}
        frame={frame}
        revealProgress={revealProgress}
      />
      <DataParticles frame={frame} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const TradingFloor3D: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const screens = useMemo(() => buildScreens(), []);

  const durationFrames = 90; // ~3s at 30fps

  // Reveal animation: screens + desks appear from center outward
  const revealProgress = interpolate(frame, [0, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: COLOR_BG }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{
          fov: 50,
          near: 0.1,
          far: 60,
          position: [8, 12, 14],
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <TradingFloorScene
          frame={frame}
          durationFrames={durationFrames}
          screens={screens}
          revealProgress={revealProgress}
        />
      </ThreeCanvas>

      {/* Vignette overlay */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 25%, rgba(0,0,0,0.7) 100%)",
          pointerEvents: "none",
          zIndex: 11,
        }}
      />
    </AbsoluteFill>
  );
};
