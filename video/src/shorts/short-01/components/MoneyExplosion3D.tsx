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

const BILL_COUNT = 120;
const COIN_COUNT = 80;
const PARTICLE_COUNT = 150;

const COLOR_BG = "#0A0A0A";
const COLOR_GOLD = "#FFD700";
const COLOR_GREEN_BILL = "#2E8B57";
const COLOR_GREEN_LIGHT = "#00FF88";
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
// Bill data — flat rectangles exploding outward
// ---------------------------------------------------------------------------

interface BillData {
  // Initial position (center origin)
  startX: number;
  startY: number;
  startZ: number;
  // Velocity vector (normalized direction * speed)
  vx: number;
  vy: number;
  vz: number;
  speed: number;
  // Rotation speeds
  rotX: number;
  rotY: number;
  rotZ: number;
  // Visual
  scale: number;
  colorVariant: number; // 0=dark green, 1=light green
}

function buildBills(): BillData[] {
  const rng = mulberry32(77777);
  const bills: BillData[] = [];

  for (let i = 0; i < BILL_COUNT; i++) {
    // Random direction on sphere
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    const dirX = Math.sin(phi) * Math.cos(theta);
    const dirY = Math.abs(Math.sin(phi) * Math.sin(theta)) * 0.6 + 0.4; // Bias upward
    const dirZ = Math.cos(phi);

    bills.push({
      startX: (rng() - 0.5) * 0.5,
      startY: (rng() - 0.5) * 0.5,
      startZ: (rng() - 0.5) * 0.5,
      vx: dirX,
      vy: dirY,
      vz: dirZ,
      speed: 3 + rng() * 8,
      rotX: (rng() - 0.5) * 12,
      rotY: (rng() - 0.5) * 12,
      rotZ: (rng() - 0.5) * 8,
      scale: 0.15 + rng() * 0.25,
      colorVariant: rng() < 0.6 ? 0 : 1,
    });
  }

  return bills;
}

// ---------------------------------------------------------------------------
// Coin data — small cylinders spinning outward
// ---------------------------------------------------------------------------

interface CoinData {
  vx: number;
  vy: number;
  vz: number;
  speed: number;
  rotSpeed: number;
  rotAxis: number; // 0=X, 1=Y, 2=Z
  scale: number;
  phase: number;
}

function buildCoins(): CoinData[] {
  const rng = mulberry32(88888);
  const coins: CoinData[] = [];

  for (let i = 0; i < COIN_COUNT; i++) {
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);

    coins.push({
      vx: Math.sin(phi) * Math.cos(theta),
      vy: Math.abs(Math.sin(phi) * Math.sin(theta)) * 0.5 + 0.5,
      vz: Math.cos(phi),
      speed: 2 + rng() * 6,
      rotSpeed: 5 + rng() * 15,
      rotAxis: Math.floor(rng() * 3),
      scale: 0.08 + rng() * 0.12,
      phase: rng() * Math.PI * 2,
    });
  }

  return coins;
}

// ---------------------------------------------------------------------------
// Spark particles
// ---------------------------------------------------------------------------

interface SparkData {
  vx: number;
  vy: number;
  vz: number;
  speed: number;
  phase: number;
}

function buildSparks(): SparkData[] {
  const rng = mulberry32(99999);
  return Array.from({ length: PARTICLE_COUNT }, () => {
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    return {
      vx: Math.sin(phi) * Math.cos(theta),
      vy: Math.abs(Math.sin(phi) * Math.sin(theta)),
      vz: Math.cos(phi),
      speed: 4 + rng() * 10,
      phase: rng() * Math.PI * 2,
    };
  });
}

// ---------------------------------------------------------------------------
// ExplodingBills — instanced bill rectangles
// ---------------------------------------------------------------------------

const ExplodingBills: React.FC<{
  bills: BillData[];
  frame: number;
  explosionProgress: number;
}> = ({ bills, frame, explosionProgress }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const colorArray = useMemo(() => {
    const arr = new Float32Array(bills.length * 3);
    const darkGreen = new THREE.Color(COLOR_GREEN_BILL);
    const lightGreen = new THREE.Color(COLOR_GREEN_LIGHT);
    for (let i = 0; i < bills.length; i++) {
      const c = bills[i].colorVariant === 0 ? darkGreen : lightGreen;
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, [bills]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const colorAttr = new THREE.InstancedBufferAttribute(colorArray, 3);
    mesh.geometry.setAttribute("color", colorAttr);
  }, [colorArray]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const t = explosionProgress;
    // Gravity effect: bills arc up then fall
    const gravity = -6;

    for (let i = 0; i < bills.length; i++) {
      const bill = bills[i];

      if (t <= 0) {
        dummy.scale.set(0, 0, 0);
      } else {
        const elapsed = t * 1.5; // Time scale
        const x = bill.startX + bill.vx * bill.speed * elapsed;
        const y =
          bill.startY +
          bill.vy * bill.speed * elapsed +
          0.5 * gravity * elapsed * elapsed;
        const z = bill.startZ + bill.vz * bill.speed * elapsed;

        // Fade: scale down as they fly out
        const fade = Math.max(0, 1 - t * 0.8);
        const s = bill.scale * (0.5 + fade * 0.5);

        dummy.position.set(x, y, z);
        dummy.rotation.set(
          bill.rotX * elapsed,
          bill.rotY * elapsed,
          bill.rotZ * elapsed,
        );
        // Bills are flat rectangles: wide X, tall Y, thin Z
        dummy.scale.set(s * 1.6, s, s * 0.02);
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
      args={[geometry, undefined, bills.length]}
      frustumCulled={false}
    >
      <meshStandardMaterial
        vertexColors
        emissive={new THREE.Color(COLOR_GREEN_LIGHT)}
        emissiveIntensity={0.4}
        roughness={0.5}
        metalness={0.2}
        transparent
        opacity={0.9}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
};

// ---------------------------------------------------------------------------
// ExplodingCoins — instanced gold cylinders
// ---------------------------------------------------------------------------

const ExplodingCoins: React.FC<{
  coins: CoinData[];
  frame: number;
  explosionProgress: number;
}> = ({ coins, frame, explosionProgress }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const t = explosionProgress;
    const gravity = -5;

    for (let i = 0; i < coins.length; i++) {
      const coin = coins[i];

      if (t <= 0) {
        dummy.scale.set(0, 0, 0);
      } else {
        const elapsed = t * 1.5;
        const x = coin.vx * coin.speed * elapsed;
        const y =
          coin.vy * coin.speed * elapsed + 0.5 * gravity * elapsed * elapsed;
        const z = coin.vz * coin.speed * elapsed;

        const fade = Math.max(0, 1 - t * 0.7);
        const s = coin.scale * (0.5 + fade * 0.5);

        dummy.position.set(x, y, z);

        // Spin on chosen axis
        const rot = coin.rotSpeed * elapsed;
        if (coin.rotAxis === 0) dummy.rotation.set(rot, 0, 0);
        else if (coin.rotAxis === 1) dummy.rotation.set(0, rot, 0);
        else dummy.rotation.set(0, 0, rot);

        dummy.scale.set(s, s * 0.15, s); // Flat coin shape
      }

      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  const geometry = useMemo(
    () => new THREE.CylinderGeometry(1, 1, 1, 12),
    [],
  );

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, coins.length]}
      frustumCulled={false}
    >
      <meshStandardMaterial
        color={COLOR_GOLD}
        emissive={new THREE.Color(COLOR_GOLD)}
        emissiveIntensity={0.6}
        roughness={0.3}
        metalness={0.8}
      />
    </instancedMesh>
  );
};

// ---------------------------------------------------------------------------
// Spark particles — golden sparkle dust
// ---------------------------------------------------------------------------

const SparkParticles: React.FC<{
  sparks: SparkData[];
  frame: number;
  explosionProgress: number;
}> = ({ sparks, explosionProgress }) => {
  const pointsRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    return new Float32Array(sparks.length * 3);
  }, [sparks]);

  useFrame(() => {
    const pts = pointsRef.current;
    if (!pts) return;

    const posAttr = pts.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    const t = explosionProgress;

    for (let i = 0; i < sparks.length; i++) {
      const spark = sparks[i];
      const elapsed = t * 2;
      arr[i * 3] = spark.vx * spark.speed * elapsed;
      arr[i * 3 + 1] =
        spark.vy * spark.speed * elapsed - 3 * elapsed * elapsed;
      arr[i * 3 + 2] = spark.vz * spark.speed * elapsed;
    }

    posAttr.needsUpdate = true;

    // Fade out particles
    const mat = pts.material as THREE.PointsMaterial;
    mat.opacity = Math.max(0, 0.8 - t * 0.6);
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.12}
        color={COLOR_YELLOW}
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
};

// ---------------------------------------------------------------------------
// Camera — pulls back from the explosion
// ---------------------------------------------------------------------------

const CameraController: React.FC<{
  frame: number;
  durationFrames: number;
}> = ({ frame, durationFrames }) => {
  const { camera } = useThree();

  useFrame(() => {
    const t = Math.min(1, frame / Math.max(1, durationFrames));

    // Start: close to the explosion
    // End: pulled back to see the spread
    const z = 4 + t * 5;
    const y = 0.5 + t * 2;

    camera.position.set(0, y, z);
    camera.lookAt(0, 0.5, 0);
  });

  return null;
};

// ---------------------------------------------------------------------------
// MoneyScene — full scene
// ---------------------------------------------------------------------------

const MoneyScene: React.FC<{
  frame: number;
  durationFrames: number;
  bills: BillData[];
  coins: CoinData[];
  sparks: SparkData[];
  explosionProgress: number;
}> = ({ frame, durationFrames, bills, coins, sparks, explosionProgress }) => {
  const { scene } = useThree();

  useEffect(() => {
    scene.fog = new THREE.FogExp2(COLOR_BG, 0.035);
    scene.background = new THREE.Color(COLOR_BG);
    return () => {
      scene.fog = null;
      scene.background = null;
    };
  }, [scene]);

  return (
    <>
      {/* Ambient fill */}
      <ambientLight intensity={0.15} color="#334466" />

      {/* Golden key light from above */}
      <directionalLight
        position={[0, 10, 5]}
        intensity={1.5}
        color="#FFF5E0"
      />

      {/* Green accent from below */}
      <pointLight
        position={[0, -2, 0]}
        intensity={2.0}
        color={COLOR_GREEN_LIGHT}
        distance={20}
        decay={2}
      />

      {/* Gold rim light */}
      <pointLight
        position={[5, 3, -3]}
        intensity={1.0}
        color={COLOR_GOLD}
        distance={15}
        decay={2}
      />

      {/* Flash light at explosion center — bright at start, fades */}
      <pointLight
        position={[0, 0, 0]}
        intensity={Math.max(0, 5 - explosionProgress * 8)}
        color="#FFFFFF"
        distance={12}
        decay={1}
      />

      <CameraController frame={frame} durationFrames={durationFrames} />

      <ExplodingBills
        bills={bills}
        frame={frame}
        explosionProgress={explosionProgress}
      />
      <ExplodingCoins
        coins={coins}
        frame={frame}
        explosionProgress={explosionProgress}
      />
      <SparkParticles
        sparks={sparks}
        frame={frame}
        explosionProgress={explosionProgress}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const MoneyExplosion3D: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const bills = useMemo(() => buildBills(), []);
  const coins = useMemo(() => buildCoins(), []);
  const sparks = useMemo(() => buildSparks(), []);

  const durationFrames = 53; // ~1.78s at 30fps (shot 2 duration)

  // Explosion starts immediately — rapid burst then spread
  const explosionProgress = interpolate(frame, [0, durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: COLOR_BG }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{
          fov: 60,
          near: 0.1,
          far: 50,
          position: [0, 0.5, 4],
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.4,
        }}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <MoneyScene
          frame={frame}
          durationFrames={durationFrames}
          bills={bills}
          coins={coins}
          sparks={sparks}
          explosionProgress={explosionProgress}
        />
      </ThreeCanvas>

      {/* Vignette overlay */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 20%, rgba(0,0,0,0.7) 100%)",
          pointerEvents: "none",
          zIndex: 11,
        }}
      />
    </AbsoluteFill>
  );
};
