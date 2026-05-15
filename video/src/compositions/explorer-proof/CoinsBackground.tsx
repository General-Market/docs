// CoinsBackground — translucent purple GM coins drifting in 3D space
// behind a phone. Lavender room, soft lighting, slow lissajous drift,
// per-coin rotation. Two scalar props drive the look:
//   forwardProgress  — 0..1, dollies coins from "deep" to "forward".
//   opacity          — 0..1, global fade for the entire field.
//
// Coin positions are seeded (mulberry32, seed 42) so the layout is
// stable across remounts and renders. Drift/rotation continue
// regardless of forwardProgress so the scene always breathes.

import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, staticFile } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

export type CoinsBackgroundProps = {
  forwardProgress: number;
  opacity: number;
  width: number;
  height: number;
};

const COIN_COUNT = 14;
const BG_COLOR = "#E0D8EC";
const COIN_BODY_COLOR = "#9b87cc";
const COIN_EMISSIVE = "#3a2a6a";
const PHONE_CENTER: [number, number, number] = [-3, 2.5, 0];

const LOGO_URL = staticFile("gm-logo-512.png");

// Deterministic RNG so the coin field is identical every frame and
// every render. Stock mulberry32 — small, fast, no deps.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Coin = {
  basePos: [number, number, number];
  forwardOffset: number;
  baseScale: number;
  forwardScale: number;
  rotAxis: [number, number, number];
  rotSpeed: number;
  driftAmp: [number, number, number];
  driftFreq: [number, number, number];
  driftPhase: [number, number, number];
  spinPhase: number;
};

function buildCoins(): Coin[] {
  const rng = mulberry32(42);
  const coins: Coin[] = [];
  for (let i = 0; i < COIN_COUNT; i += 1) {
    // Cylindrical cloud around the phone. Some near, some far.
    const theta = rng() * Math.PI * 2;
    const radius = 4 + rng() * 5; // 4..9
    const x = PHONE_CENTER[0] + Math.cos(theta) * radius;
    const y = PHONE_CENTER[1] + (rng() - 0.5) * 6; // ±3 vertical spread
    // Deep z lean: bias toward negative so they sit behind the phone.
    const z = PHONE_CENTER[2] + (rng() * 12 - 8); // -8..+4

    const baseScale = 0.7 + rng() * 0.3; // 0.7..1.0
    const forwardScale = 1.0 + rng() * 0.5; // 1.0..1.5
    const forwardOffset = 2 + rng() * 3; // +2..+5 z push

    // Random rotation axis, unit-length.
    const ax = rng() * 2 - 1;
    const ay = rng() * 2 - 1;
    const az = rng() * 2 - 1;
    const len = Math.hypot(ax, ay, az) || 1;

    // 6..12 second period at 30fps → speed in rad/frame.
    const period = 6 + rng() * 6;
    const rotSpeed = (Math.PI * 2) / (period * 30);

    coins.push({
      basePos: [x, y, z],
      forwardOffset,
      baseScale,
      forwardScale,
      rotAxis: [ax / len, ay / len, az / len],
      rotSpeed,
      driftAmp: [0.3 + rng() * 0.5, 0.3 + rng() * 0.5, 0.3 + rng() * 0.5],
      // 10..20 second period → angular freq in rad/frame.
      driftFreq: [
        (Math.PI * 2) / ((10 + rng() * 10) * 30),
        (Math.PI * 2) / ((10 + rng() * 10) * 30),
        (Math.PI * 2) / ((10 + rng() * 10) * 30),
      ],
      driftPhase: [rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2],
      spinPhase: rng() * Math.PI * 2,
    });
  }
  return coins;
}

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

const CoinMesh: React.FC<{
  coin: Coin;
  frame: number;
  forwardProgress: number;
  opacity: number;
  logoMap: THREE.Texture;
}> = ({ coin, frame, forwardProgress, opacity, logoMap }) => {
  const p = smoothstep(forwardProgress);

  // Drift: lissajous on each axis.
  const dx =
    coin.driftAmp[0] * Math.sin(frame * coin.driftFreq[0] + coin.driftPhase[0]);
  const dy =
    coin.driftAmp[1] * Math.sin(frame * coin.driftFreq[1] + coin.driftPhase[1]);
  const dz =
    coin.driftAmp[2] * Math.sin(frame * coin.driftFreq[2] + coin.driftPhase[2]);

  const x = coin.basePos[0] + dx;
  const y = coin.basePos[1] + dy;
  const z = coin.basePos[2] + dz + coin.forwardOffset * p;

  const scale = coin.baseScale + (coin.forwardScale - coin.baseScale) * p;

  // Per-coin rotation.
  const angle = coin.spinPhase + frame * coin.rotSpeed;
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const axis = useMemo(
    () => new THREE.Vector3(coin.rotAxis[0], coin.rotAxis[1], coin.rotAxis[2]),
    [coin.rotAxis],
  );
  quat.setFromAxisAngle(axis, angle);

  // Forward coins are slightly more saturated. Modeled as a small
  // opacity bump from 0.45 (deep) to 0.7 (forward), then multiplied by
  // global opacity.
  const bodyAlpha = (0.45 + 0.25 * p) * opacity;
  const faceAlpha = (0.75 + 0.2 * p) * opacity;

  return (
    <group position={[x, y, z]} quaternion={quat} scale={scale}>
      {/* Coin body — translucent purple cylinder, lying flat on its
          side so the round faces point forward/backward. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1, 1, 0.15, 48, 1]} />
        <meshStandardMaterial
          color={COIN_BODY_COLOR}
          emissive={COIN_EMISSIVE}
          emissiveIntensity={0.25}
          metalness={0.2}
          roughness={0.45}
          transparent
          opacity={bodyAlpha}
          depthWrite={false}
        />
      </mesh>
      {/* Front logo — slightly raised disc with the GM mark. */}
      <mesh position={[0, 0, 0.076]}>
        <circleGeometry args={[0.92, 48]} />
        <meshStandardMaterial
          map={logoMap}
          transparent
          opacity={faceAlpha}
          color="#ffffff"
          emissive="#ffffff"
          emissiveMap={logoMap}
          emissiveIntensity={0.15}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Back logo — mirrored so the mark reads correctly from behind. */}
      <mesh position={[0, 0, -0.076]} rotation={[0, Math.PI, 0]}>
        <circleGeometry args={[0.92, 48]} />
        <meshStandardMaterial
          map={logoMap}
          transparent
          opacity={faceAlpha}
          color="#ffffff"
          emissive="#ffffff"
          emissiveMap={logoMap}
          emissiveIntensity={0.15}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

const Scene: React.FC<{
  coins: Coin[];
  frame: number;
  forwardProgress: number;
  opacity: number;
}> = ({ coins, frame, forwardProgress, opacity }) => {
  const { camera } = useThree();
  const logoMap = useTexture(LOGO_URL);
  // sRGB texture so the brand purple shows true.
  logoMap.colorSpace = THREE.SRGBColorSpace;
  logoMap.anisotropy = 8;

  const persp = camera as THREE.PerspectiveCamera;
  persp.position.set(0, 2, 10);
  persp.lookAt(PHONE_CENTER[0], PHONE_CENTER[1], PHONE_CENTER[2]);
  persp.fov = 40;
  persp.updateProjectionMatrix();

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 6, 8]} intensity={1.1} color="#ffffff" />
      <directionalLight position={[-3, 4, 2]} intensity={0.35} color="#d4c8f0" />
      {coins.map((coin, i) => (
        <CoinMesh
          key={i}
          coin={coin}
          frame={frame}
          forwardProgress={forwardProgress}
          opacity={opacity}
          logoMap={logoMap}
        />
      ))}
    </>
  );
};

export const CoinsBackground: React.FC<CoinsBackgroundProps> = ({
  forwardProgress,
  opacity,
  width,
  height,
}) => {
  const frame = useCurrentFrame();
  const coins = useMemo(() => buildCoins(), []);

  return (
    <AbsoluteFill style={{ width, height, background: BG_COLOR }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{
          fov: 40,
          near: 0.5,
          far: 200,
          position: [0, 2, 10],
        }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        style={{ background: "transparent" }}
      >
        <React.Suspense fallback={null}>
          <Scene
            coins={coins}
            frame={frame}
            forwardProgress={forwardProgress}
            opacity={opacity}
          />
        </React.Suspense>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
