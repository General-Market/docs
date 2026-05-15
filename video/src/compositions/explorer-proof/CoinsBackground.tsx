// CoinsBackground — Houdini-grade 3D coins drifting behind the phone.
// Each coin is a lathe-revolved disc with a bevelled rim (so the edge
// catches light the way a real minted coin does), wrapped in a
// translucent purple physical material. The GM mark is overlaid on
// both faces. Positions are hand-set to match the HoudiniSwap
// reference frame: top centre, upper-right, far-left, lower-left big
// foreground, behind-phone fade, upper-right of URL, bottom-right
// hero, plus a back-band of small deep coins for depth.

import React, { useMemo } from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
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

const BG_COLOR = "#E0D8EC";
const MARK_URL = staticFile("gm-logo-white-1024.png");
useTexture.preload(MARK_URL);

// ── Coin profile (lathe) ─────────────────────────────────────────────
// Cross-section traced from edge to centre on the +X side. Rotated
// around the Y axis to make a disc with a rounded bevelled rim and a
// slight face dish. Units are coin-radii.
//
//   y
//   │       ╭─────────────╮   ← top face
//   │     ╭─╯             │
//   │    ╱                │
//   │   │ rim             │
//   │    ╲                │
//   │     ╰─╮             │
//   │       ╰─────────────╯   ← bottom face
//   └────────────────────────→ x
//
const COIN_PROFILE_POINTS: THREE.Vector2[] = (() => {
  const t = 0.085; // half-thickness
  const r = 1.0; // radius
  const bevel = 0.06; // rim bezel radius
  const pts: THREE.Vector2[] = [];
  // Top face out to rim
  pts.push(new THREE.Vector2(0, t));
  pts.push(new THREE.Vector2(r - bevel, t));
  // Top bevel — quarter arc
  const seg = 6;
  for (let i = 1; i <= seg; i += 1) {
    const a = (i / seg) * (Math.PI / 2);
    pts.push(
      new THREE.Vector2(r - bevel + Math.sin(a) * bevel, t - bevel + Math.cos(a) * bevel),
    );
  }
  // Rim (straight side)
  pts.push(new THREE.Vector2(r, -t + bevel));
  // Bottom bevel
  for (let i = 1; i <= seg; i += 1) {
    const a = (i / seg) * (Math.PI / 2);
    pts.push(
      new THREE.Vector2(r - bevel + Math.cos(a) * bevel, -t + bevel - Math.sin(a) * bevel),
    );
  }
  pts.push(new THREE.Vector2(0, -t));
  return pts;
})();

// ── Coin placement — matched to HoudiniSwap reference frame ──────────
//
// World coordinates with camera at (0, 0.5, 14), fov 40°. The frame
// half-height at z=0 is ~5.1, half-width ~9.0 (16:9). Hand-tuned so
// the layout reads exactly like the reference: big foreground bottom-
// left and bottom-right, top-centre hero, mid-rim coins around each
// wordmark, back-band of small deep coins behind everything.
type CoinSeed = {
  basePos: [number, number, number];
  baseScale: number;
  tilt: [number, number, number]; // euler radians
  spinPeriodSec: number; // 8..18 — always positive, always slow
  spinPhase: number; // initial rotation offset
  forwardOffset: number; // z push at forwardProgress = 1
  forwardScaleMul: number; // scale multiplier at forwardProgress = 1
  driftAmp: [number, number, number];
  driftFreqHz: [number, number, number]; // cycles per second
  driftPhase: [number, number, number];
};

const COIN_SEEDS: CoinSeed[] = [
  // 1) Top-centre hero — large, tilted forward
  {
    basePos: [-0.6, 3.8, -1.8],
    baseScale: 1.55,
    tilt: [-0.45, 0, 0.18],
    spinPeriodSec: 13,
    spinPhase: 0.4,
    forwardOffset: 2.6,
    forwardScaleMul: 1.18,
    driftAmp: [0.25, 0.18, 0.12],
    driftFreqHz: [0.06, 0.05, 0.04],
    driftPhase: [0, 1.1, 2.3],
  },
  // 2) Upper-right above URL — medium, slight tilt
  {
    basePos: [6.4, 2.2, -2.1],
    baseScale: 0.95,
    tilt: [-0.15, 0, -0.22],
    spinPeriodSec: 11,
    spinPhase: 1.2,
    forwardOffset: 2.2,
    forwardScaleMul: 1.22,
    driftAmp: [0.18, 0.22, 0.1],
    driftFreqHz: [0.07, 0.05, 0.05],
    driftPhase: [1.7, 0.6, 0.0],
  },
  // 3) Far-left edge, tilted
  {
    basePos: [-7.4, 1.6, -1.4],
    baseScale: 1.25,
    tilt: [0.05, 0, 0.55],
    spinPeriodSec: 15,
    spinPhase: 2.0,
    forwardOffset: 2.0,
    forwardScaleMul: 1.2,
    driftAmp: [0.15, 0.25, 0.12],
    driftFreqHz: [0.05, 0.06, 0.04],
    driftPhase: [0.5, 2.0, 1.0],
  },
  // 4) Mid-left, smaller, near left wordmark
  {
    basePos: [-8.0, -1.6, -2.4],
    baseScale: 0.7,
    tilt: [0, 0, -0.2],
    spinPeriodSec: 9,
    spinPhase: 2.6,
    forwardOffset: 2.4,
    forwardScaleMul: 1.3,
    driftAmp: [0.2, 0.15, 0.1],
    driftFreqHz: [0.05, 0.07, 0.05],
    driftPhase: [1.0, 0.0, 1.4],
  },
  // 5) Big foreground lower-left — hero coin, very large, dramatic tilt
  {
    basePos: [-4.8, -2.3, 0.6],
    baseScale: 2.05,
    tilt: [0.35, 0, -0.35],
    spinPeriodSec: 16,
    spinPhase: 0.8,
    forwardOffset: 1.4,
    forwardScaleMul: 1.1,
    driftAmp: [0.2, 0.18, 0.15],
    driftFreqHz: [0.04, 0.05, 0.04],
    driftPhase: [2.2, 1.5, 0.7],
  },
  // 6) Centre-bottom, partially behind the phone — soft fade
  {
    basePos: [0.6, -3.6, -3.0],
    baseScale: 0.9,
    tilt: [0.2, 0, 0.05],
    spinPeriodSec: 12,
    spinPhase: 1.8,
    forwardOffset: 2.8,
    forwardScaleMul: 1.25,
    driftAmp: [0.18, 0.16, 0.12],
    driftFreqHz: [0.06, 0.05, 0.05],
    driftPhase: [0.4, 1.9, 2.8],
  },
  // 7) Right of phone above URL — medium tilt
  {
    basePos: [5.1, 0.4, -1.6],
    baseScale: 0.95,
    tilt: [-0.1, 0, 0.32],
    spinPeriodSec: 10,
    spinPhase: 0.0,
    forwardOffset: 2.4,
    forwardScaleMul: 1.25,
    driftAmp: [0.2, 0.18, 0.12],
    driftFreqHz: [0.05, 0.06, 0.04],
    driftPhase: [1.2, 0.8, 2.0],
  },
  // 8) Bottom-right hero — large, tilted
  {
    basePos: [5.6, -2.6, 0.2],
    baseScale: 1.7,
    tilt: [0.28, 0, 0.28],
    spinPeriodSec: 14,
    spinPhase: 2.4,
    forwardOffset: 1.6,
    forwardScaleMul: 1.12,
    driftAmp: [0.18, 0.22, 0.14],
    driftFreqHz: [0.05, 0.04, 0.05],
    driftPhase: [1.6, 0.3, 1.1],
  },
  // 9-14) Back-band — small deep coins for layered depth
  {
    basePos: [-5.5, 3.0, -6.0],
    baseScale: 0.5,
    tilt: [-0.2, 0, 0.4],
    spinPeriodSec: 14,
    spinPhase: 1.4,
    forwardOffset: 3.5,
    forwardScaleMul: 1.4,
    driftAmp: [0.3, 0.25, 0.12],
    driftFreqHz: [0.05, 0.06, 0.04],
    driftPhase: [2.5, 1.4, 0.5],
  },
  {
    basePos: [3.0, 3.4, -5.6],
    baseScale: 0.55,
    tilt: [0.1, 0, -0.25],
    spinPeriodSec: 12,
    spinPhase: 0.9,
    forwardOffset: 3.0,
    forwardScaleMul: 1.4,
    driftAmp: [0.25, 0.2, 0.1],
    driftFreqHz: [0.05, 0.05, 0.05],
    driftPhase: [0.8, 2.1, 1.6],
  },
  {
    basePos: [-3.5, 0.6, -5.4],
    baseScale: 0.45,
    tilt: [0.05, 0, 0.2],
    spinPeriodSec: 11,
    spinPhase: 2.2,
    forwardOffset: 2.6,
    forwardScaleMul: 1.4,
    driftAmp: [0.2, 0.22, 0.12],
    driftFreqHz: [0.06, 0.05, 0.04],
    driftPhase: [1.8, 0.5, 0.0],
  },
  {
    basePos: [4.2, -0.4, -6.2],
    baseScale: 0.5,
    tilt: [-0.1, 0, -0.3],
    spinPeriodSec: 13,
    spinPhase: 1.6,
    forwardOffset: 2.8,
    forwardScaleMul: 1.4,
    driftAmp: [0.18, 0.2, 0.12],
    driftFreqHz: [0.05, 0.05, 0.05],
    driftPhase: [0.2, 1.7, 2.4],
  },
  {
    basePos: [-1.0, -1.2, -5.8],
    baseScale: 0.4,
    tilt: [0.15, 0, 0.1],
    spinPeriodSec: 10,
    spinPhase: 0.5,
    forwardOffset: 3.2,
    forwardScaleMul: 1.4,
    driftAmp: [0.22, 0.18, 0.1],
    driftFreqHz: [0.06, 0.05, 0.05],
    driftPhase: [2.0, 0.9, 1.4],
  },
  {
    basePos: [7.8, -1.2, -5.4],
    baseScale: 0.55,
    tilt: [0.0, 0, 0.45],
    spinPeriodSec: 12,
    spinPhase: 2.8,
    forwardOffset: 2.6,
    forwardScaleMul: 1.4,
    driftAmp: [0.18, 0.22, 0.12],
    driftFreqHz: [0.05, 0.06, 0.04],
    driftPhase: [1.0, 0.2, 2.0],
  },
];

const FPS = 30;

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

const CoinMesh: React.FC<{
  seed: CoinSeed;
  frame: number;
  forwardProgress: number;
  globalAlpha: number;
  faceMap: THREE.Texture;
}> = ({ seed, frame, forwardProgress, globalAlpha, faceMap }) => {
  const p = smoothstep(forwardProgress);

  const dx =
    seed.driftAmp[0] *
    Math.sin((frame / FPS) * seed.driftFreqHz[0] * 2 * Math.PI + seed.driftPhase[0]);
  const dy =
    seed.driftAmp[1] *
    Math.sin((frame / FPS) * seed.driftFreqHz[1] * 2 * Math.PI + seed.driftPhase[1]);
  const dz =
    seed.driftAmp[2] *
    Math.sin((frame / FPS) * seed.driftFreqHz[2] * 2 * Math.PI + seed.driftPhase[2]);

  const x = seed.basePos[0] + dx;
  const y = seed.basePos[1] + dy;
  const z = seed.basePos[2] + dz + seed.forwardOffset * p;

  const scale = seed.baseScale * (1 + (seed.forwardScaleMul - 1) * p);

  // Continuous slow spin around the coin's own Y axis.
  const spinSpeed = (Math.PI * 2) / (seed.spinPeriodSec * FPS);
  const spinAngle = seed.spinPhase + frame * spinSpeed;

  // Tilt applied first, spin second — coin reads as a tilted disc
  // spinning around its own face-normal axis.
  const tiltQ = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(seed.tilt[0], seed.tilt[1], seed.tilt[2], "YXZ"),
  );
  const spinQ = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    spinAngle,
  );
  const quat = tiltQ.clone().multiply(spinQ);

  // The lathe geometry is oriented with its axis along +Y. Rotate it
  // so the round faces are in the XZ plane and the disc reads head-
  // on to the camera (which looks along -Z). With the lathe axis
  // along Y the faces already point ±Y, so we tip the group by +90°
  // around X to make them point ±Z.
  return (
    <group position={[x, y, z]} quaternion={quat} scale={scale}>
      <group rotation={[Math.PI / 2, 0, 0]}>
        {/* Coin body — physical material with transmission so the
            disc reads as a translucent gem. */}
        <mesh>
          <latheGeometry args={[COIN_PROFILE_POINTS, 96]} />
          <meshPhysicalMaterial
            color="#a47cd9"
            roughness={0.28}
            metalness={0.0}
            transmission={0.55}
            thickness={0.6}
            ior={1.45}
            clearcoat={0.85}
            clearcoatRoughness={0.18}
            attenuationColor="#7a4dbf"
            attenuationDistance={1.4}
            transparent
            opacity={globalAlpha}
          />
        </mesh>
        {/* Front face — white GM mark, slightly raised so it catches
            its own specular */}
        <mesh position={[0, 0.092, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.78, 64]} />
          <meshStandardMaterial
            map={faceMap}
            color="#ffffff"
            emissive="#ffffff"
            emissiveMap={faceMap}
            emissiveIntensity={0.45}
            transparent
            opacity={globalAlpha}
            depthWrite={false}
          />
        </mesh>
        {/* Back face — same mark, mirrored */}
        <mesh position={[0, -0.092, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.78, 64]} />
          <meshStandardMaterial
            map={faceMap}
            color="#ffffff"
            emissive="#ffffff"
            emissiveMap={faceMap}
            emissiveIntensity={0.45}
            transparent
            opacity={globalAlpha}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
};

const Scene: React.FC<{
  frame: number;
  forwardProgress: number;
  opacity: number;
}> = ({ frame, forwardProgress, opacity }) => {
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
      {/* Soft hemispheric fill — lifts the coin out of the lavender
          background without flattening the rim highlights. */}
      <hemisphereLight args={["#ffffff", "#9b87cc", 0.65]} />
      {/* Key light — bright, top-front, gives the rim its highlight. */}
      <directionalLight position={[3, 8, 9]} intensity={1.6} color="#ffffff" />
      {/* Rim/back light — picks out the bevel from behind. */}
      <directionalLight position={[-4, 2, -6]} intensity={0.6} color="#c8b5ff" />
      {/* Fill — keeps shadow side from going pure black. */}
      <directionalLight position={[-6, -2, 5]} intensity={0.35} color="#e6d8ff" />
      {COIN_SEEDS.map((seed, i) => (
        <CoinMesh
          key={i}
          seed={seed}
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
  // Memoise so the seed list isn't re-allocated each frame.
  const seedFingerprint = useMemo(() => COIN_SEEDS.length, []);
  void seedFingerprint;

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
          toneMappingExposure: 1.05,
        }}
        style={{ background: "transparent" }}
      >
        <React.Suspense fallback={null}>
          <Scene
            frame={frame}
            forwardProgress={forwardProgress}
            opacity={opacity}
          />
        </React.Suspense>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
