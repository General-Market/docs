// CoinsBackground — real 3D coins (Three.js) drifting behind the
// CSS phone. Each coin is a translucent purple cylinder with the GM
// mark mapped onto its front and back faces. Coins always rotate
// slowly around their Y axis; forwardProgress dollies them toward
// the camera; opacity fades the whole field.
//
// Only one WebGL canvas in this composition (the phone is CSS), so
// there is no context contention. Camera is fixed; coins move in
// world space.

import React, { useMemo } from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

// Preload so the texture is ready before the first frame renders;
// otherwise useTexture suspends and Suspense renders the fallback
// (nothing), making the coin field invisible on the very first paint.
useTexture.preload(staticFile("gm-logo-white-1024.png"));

export type CoinsBackgroundProps = {
  forwardProgress: number;
  opacity: number;
  width: number;
  height: number;
};

const COIN_COUNT = 14;
const BG_COLOR = "#E0D8EC";
const MARK_URL = staticFile("gm-logo-white-1024.png");

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
  basePos: THREE.Vector3;
  forwardOffset: number;
  baseScale: number;
  forwardScale: number;
  spinSpeed: number; // rad/frame, always positive
  spinPhase: number;
  tilt: THREE.Euler;
  driftAmp: [number, number, number];
  driftFreq: [number, number, number];
  driftPhase: [number, number, number];
};

function buildCoins(): Coin[] {
  const rng = mulberry32(42);
  const coins: Coin[] = [];
  // Two bands: outer (loud, near the edges) and back (small, deep,
  // sit between the wordmarks for layered depth without crowding the
  // phone or covering the text).
  for (let i = 0; i < COIN_COUNT; i += 1) {
    const isOuter = i < 8;
    const side = rng() < 0.5 ? -1 : 1;
    let x: number, y: number, z: number;
    if (isOuter) {
      // Outer band: hugs the left/right edges of the frame, sitting
      // behind the wordmarks. x pushed further out so coins don't
      // crowd the text on resting beats.
      x = side * (7 + rng() * 2.5); // ±7..±9.5
      y = (rng() - 0.5) * 6.5; // ±3.25
      z = -2.5 + (rng() - 0.5) * 3; // -4..-1
    } else {
      // Back band: deep, small, scattered. Perspective shrinks them so
      // they fill the dead space without competing with the phone.
      x = (rng() - 0.5) * 16; // ±8
      y = (rng() - 0.5) * 5.5; // ±2.75
      z = -8 + (rng() - 0.5) * 2; // -9..-7
    }

    const baseScale = isOuter ? 1.0 + rng() * 0.4 : 0.55 + rng() * 0.25;
    const forwardScale = baseScale * (1.15 + rng() * 0.35);
    const forwardOffset = isOuter ? 2.5 + rng() * 2 : 4 + rng() * 2.5;

    // 8..16 second spin period at 30fps — slow, hypnotic.
    const period = 8 + rng() * 8;
    const spinSpeed = (Math.PI * 2) / (period * 30);

    // Random gentle tilt — the coin face is not perfectly square to
    // the camera, which catches the rim light as the coin spins.
    const tilt = new THREE.Euler(
      (rng() - 0.5) * 0.45,
      0,
      (rng() - 0.5) * 0.45,
      "YXZ",
    );

    coins.push({
      basePos: new THREE.Vector3(x, y, z),
      forwardOffset,
      baseScale,
      forwardScale,
      spinSpeed,
      spinPhase: rng() * Math.PI * 2,
      tilt,
      driftAmp: [0.25 + rng() * 0.4, 0.25 + rng() * 0.4, 0.2 + rng() * 0.3],
      driftFreq: [
        (Math.PI * 2) / ((12 + rng() * 10) * 30),
        (Math.PI * 2) / ((12 + rng() * 10) * 30),
        (Math.PI * 2) / ((12 + rng() * 10) * 30),
      ],
      driftPhase: [rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2],
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
  globalAlpha: number;
  faceMap: THREE.Texture;
}> = ({ coin, frame, forwardProgress, globalAlpha, faceMap }) => {
  const p = smoothstep(forwardProgress);

  const dx = coin.driftAmp[0] * Math.sin(frame * coin.driftFreq[0] + coin.driftPhase[0]);
  const dy = coin.driftAmp[1] * Math.sin(frame * coin.driftFreq[1] + coin.driftPhase[1]);
  const dz = coin.driftAmp[2] * Math.sin(frame * coin.driftFreq[2] + coin.driftPhase[2]);

  const x = coin.basePos.x + dx;
  const y = coin.basePos.y + dy;
  const z = coin.basePos.z + dz + coin.forwardOffset * p;

  const scale = coin.baseScale + (coin.forwardScale - coin.baseScale) * p;
  const spinAngle = coin.spinPhase + frame * coin.spinSpeed;

  // Tilt + spin combined as a single quaternion. Spin is around the
  // local Y axis after the tilt is applied — so the coin reads as a
  // gently leaning disc that keeps rotating on its own axis.
  const spinQ = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    spinAngle,
  );
  const tiltQ = new THREE.Quaternion().setFromEuler(coin.tilt);
  const quat = tiltQ.clone().multiply(spinQ);

  // The cylinder primitive sits with its axis along Y. To make the
  // round faces point along ±Z (so we see the disc head-on), we lay
  // the cylinder on its side with a constant 90° rotation. This is
  // baked into the geometry rotation, leaving the runtime quaternion
  // free to spin and tilt the disc face.
  return (
    <group position={[x, y, z]} quaternion={quat} scale={scale}>
      <group rotation={[Math.PI / 2, 0, 0]}>
        {/* Body — purple disc with subtle gloss. Solid enough to read
            against the lavender background. */}
        <mesh>
          <cylinderGeometry args={[1, 1, 0.18, 64, 1]} />
          <meshStandardMaterial
            color="#956cd0"
            emissive="#3a1f6a"
            emissiveIntensity={0.18}
            roughness={0.35}
            metalness={0.25}
            transparent
            opacity={0.78 * globalAlpha}
          />
        </mesh>
        {/* Front face — GM mark in white, slightly raised so it
            catches its own highlight */}
        <mesh position={[0, 0.091, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.94, 64]} />
          <meshStandardMaterial
            map={faceMap}
            color="#ffffff"
            emissive="#ffffff"
            emissiveMap={faceMap}
            emissiveIntensity={0.35}
            transparent
            opacity={globalAlpha}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        {/* Back face — same mark, mirrored */}
        <mesh position={[0, -0.091, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.94, 64]} />
          <meshStandardMaterial
            map={faceMap}
            color="#ffffff"
            emissive="#ffffff"
            emissiveMap={faceMap}
            emissiveIntensity={0.35}
            transparent
            opacity={globalAlpha}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
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
  const faceMap = useTexture(MARK_URL);
  faceMap.colorSpace = THREE.SRGBColorSpace;
  faceMap.anisotropy = 8;

  const persp = camera as THREE.PerspectiveCamera;
  persp.position.set(0, 0.5, 14);
  persp.lookAt(0, 0, 0);
  persp.fov = 40;
  persp.updateProjectionMatrix();

  return (
    <>
      <ambientLight intensity={0.85} color="#f3ecff" />
      <directionalLight position={[6, 7, 8]} intensity={1.2} color="#ffffff" />
      <directionalLight position={[-5, 3, 4]} intensity={0.5} color="#c6b3ed" />
      <directionalLight position={[0, -4, 6]} intensity={0.3} color="#e0d5ff" />
      {coins.map((coin, i) => (
        <CoinMesh
          key={i}
          coin={coin}
          frame={frame}
          forwardProgress={forwardProgress}
          globalAlpha={opacity}
          faceMap={faceMap}
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
          position: [0, 0.5, 14],
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
