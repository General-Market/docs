// CoinsBackground — anodised-blue tokens built from real geometry.
// Body is an ExtrudeGeometry with a 4-segment bevel at both rim
// corners. Relief features — 84 cylindrical denticles, a torus inner
// ring, and a beveled brand pill — are extruded and merged for both
// faces, then struck onto the body. One MeshPhysicalMaterial across
// the lot, lit by a studio HDRI. No painted face textures anywhere.

import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, staticFile } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type CoinsBackgroundProps = {
  forwardProgress: number;
  opacity: number;
  width: number;
  height: number;
};

const HDRI_URL = staticFile("textures/hdri/studio_small_03_1k.hdr");

const BG_COLOR = "#FFFFFF";

const BRAND_BLUE = "#2856F6";
const BRAND_BLUE_DEEP = "#0A249A";

// ── Coin geometry ────────────────────────────────────────────────────

const COIN_RADIUS = 1.0;
const COIN_THICKNESS = 0.16;
const BEVEL_SIZE = 0.045;
const BEVEL_THICKNESS = 0.028;
const FACE_Z = COIN_THICKNESS / 2 - BEVEL_THICKNESS; // where flat face sits

// Body — circle Shape extruded with a 4-segment bevel at both ends. The
// bevel is what catches the light along the silhouette; without it the
// rim reads like a hockey puck.
function buildCoinBodyGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, COIN_RADIUS, 0, Math.PI * 2, false);
  const depth = COIN_THICKNESS - BEVEL_THICKNESS * 2;
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 5,
    bevelSize: BEVEL_SIZE,
    bevelThickness: BEVEL_THICKNESS,
    curveSegments: 96,
  });
  geom.translate(0, 0, -depth / 2 - BEVEL_THICKNESS);
  geom.computeVertexNormals();
  return geom;
}

// Relief — denticles, inner ring, brand pill — extruded as real
// geometry and merged into a single buffer. Built once and shared
// across every coin instance.
function buildReliefGeometry(): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = [];
  const reliefDepth = 0.022;
  const reliefBaseZ = FACE_Z; // sits flush on the face plane

  // Denticles — small cylinders around the perimeter, both faces.
  const denticleCount = 84;
  const denticleR = 0.022;
  const denticleH = reliefDepth;
  const denticleOrbit = COIN_RADIUS * 0.87;
  const denticleProto = new THREE.CylinderGeometry(
    denticleR,
    denticleR,
    denticleH,
    14,
  );
  denticleProto.rotateX(Math.PI / 2); // stand upright along Z

  for (const sign of [1, -1] as const) {
    for (let i = 0; i < denticleCount; i++) {
      const a = (i / denticleCount) * Math.PI * 2;
      const g = denticleProto.clone();
      g.translate(
        Math.cos(a) * denticleOrbit,
        Math.sin(a) * denticleOrbit,
        sign * (reliefBaseZ + reliefDepth / 2),
      );
      pieces.push(g);
    }
  }
  denticleProto.dispose();

  // Brand pill — rounded rectangle extruded with a soft bevel. Reads
  // as the brand mark struck into the metal once it picks up reflection.
  const pillW = COIN_RADIUS * 0.6;
  const pillH = COIN_RADIUS * 0.16;
  const pillR = pillH / 2;
  const pillShape = new THREE.Shape();
  pillShape.moveTo(-pillW / 2 + pillR, -pillH / 2);
  pillShape.lineTo(pillW / 2 - pillR, -pillH / 2);
  pillShape.absarc(pillW / 2 - pillR, 0, pillR, -Math.PI / 2, Math.PI / 2, false);
  pillShape.lineTo(-pillW / 2 + pillR, pillH / 2);
  pillShape.absarc(-pillW / 2 + pillR, 0, pillR, Math.PI / 2, -Math.PI / 2, false);
  pillShape.closePath();
  const pillDepth = 0.028;

  for (const sign of [1, -1] as const) {
    const pill = new THREE.ExtrudeGeometry(pillShape, {
      depth: pillDepth,
      bevelEnabled: true,
      bevelSize: 0.008,
      bevelThickness: 0.006,
      bevelSegments: 2,
      curveSegments: 28,
    });
    if (sign === -1) {
      // Mirror BEFORE translating so the pill sticks out from the back
      // face, not into the body.
      pill.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, -1));
    }
    pill.translate(0, 0, sign * reliefBaseZ);
    pieces.push(pill);
  }

  // mergeGeometries demands every input share the same index / no-index
  // state. Normalising to non-indexed across the lot is the universal
  // fix — denticles and the torus are indexed, ExtrudeGeometry isn't.
  const normalised = pieces.map((p) => {
    const flat = p.index ? p.toNonIndexed() : p;
    p.dispose();
    return flat;
  });
  const merged = mergeGeometries(normalised, false);
  for (const p of normalised) p.dispose();
  if (!merged) {
    throw new Error("relief geometry merge failed");
  }
  merged.computeVertexNormals();
  return merged;
}

// Reeded-edge normal map for the rim. 96 ridges wrap once around U.
function buildRimNormalMap(): THREE.DataTexture {
  const ridgesPerStrip = 96;
  const width = 2048;
  const height = 4;
  const data = new Uint8Array(width * height * 4);
  const amplitude = 0.55;
  for (let x = 0; x < width; x++) {
    const u = x / width;
    const phase = u * ridgesPerStrip * Math.PI * 2;
    const nx = Math.sin(phase) * amplitude;
    const nz = Math.sqrt(Math.max(0.0001, 1 - nx * nx));
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4;
      data[i] = Math.round((nx + 1) * 0.5 * 255);
      data[i + 1] = 128;
      data[i + 2] = Math.round((nz + 1) * 0.5 * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

// ── Coin lanes ───────────────────────────────────────────────────────

type CoinSeed = {
  x: number;
  y: number;
  baseScale: number;
  cycleSec: number;
  cyclePhase: number;
  tiltAxisDir: 1 | -1;
  wobbleAmplitudeDeg: number;
  wobblePeriodSec: number;
  wobblePhase: number;
  staticTiltDeg: number;
  variant: "glossy" | "satin";
};

const COIN_SEEDS: CoinSeed[] = [
  { x: -5.8, y: 3.0, baseScale: 1.4, cycleSec: 10, cyclePhase: 0.0,
    tiltAxisDir: -1, wobbleAmplitudeDeg: 30, wobblePeriodSec: 6.0,
    wobblePhase: 0.4, staticTiltDeg: -18, variant: "glossy" },
  { x: 5.8, y: 3.2, baseScale: 1.5, cycleSec: 11, cyclePhase: 0.5,
    tiltAxisDir: 1, wobbleAmplitudeDeg: 15, wobblePeriodSec: 5.5,
    wobblePhase: 1.6, staticTiltDeg: 22, variant: "satin" },
  { x: -5.8, y: -3.0, baseScale: 1.6, cycleSec: 12, cyclePhase: 0.25,
    tiltAxisDir: 1, wobbleAmplitudeDeg: 30, wobblePeriodSec: 7.0,
    wobblePhase: 1.0, staticTiltDeg: -25, variant: "satin" },
  { x: 5.8, y: -3.0, baseScale: 1.45, cycleSec: 11, cyclePhase: 0.75,
    tiltAxisDir: -1, wobbleAmplitudeDeg: 30, wobblePeriodSec: 6.5,
    wobblePhase: 2.2, staticTiltDeg: 20, variant: "glossy" },
  { x: -7.8, y: 2.4, baseScale: 1.0, cycleSec: 13, cyclePhase: 0.15,
    tiltAxisDir: -1, wobbleAmplitudeDeg: 15, wobblePeriodSec: 5.5,
    wobblePhase: 0.7, staticTiltDeg: -10, variant: "glossy" },
  { x: 7.8, y: -2.4, baseScale: 1.05, cycleSec: 12.5, cyclePhase: 0.6,
    tiltAxisDir: 1, wobbleAmplitudeDeg: 30, wobblePeriodSec: 6.0,
    wobblePhase: 2.0, staticTiltDeg: 24, variant: "satin" },
  { x: -7.4, y: -2.6, baseScale: 1.05, cycleSec: 11.5, cyclePhase: 0.35,
    tiltAxisDir: 1, wobbleAmplitudeDeg: 30, wobblePeriodSec: 7.0,
    wobblePhase: 0.0, staticTiltDeg: 18, variant: "satin" },
  { x: 7.4, y: 2.6, baseScale: 1.0, cycleSec: 10.5, cyclePhase: 0.88,
    tiltAxisDir: -1, wobbleAmplitudeDeg: 15, wobblePeriodSec: 5.0,
    wobblePhase: 2.5, staticTiltDeg: -16, variant: "glossy" },
];

const FPS = 30;
const Z_BACK = -16;
const Z_FRONT = 7;
const FRAME_HALF_W = 9.5;
const FRAME_HALF_H = 5.5;

function smoothstep01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

const COIN_BODY_COLOR = new THREE.Color(BRAND_BLUE);
const COIN_RELIEF_COLOR = new THREE.Color(BRAND_BLUE_DEEP);

const CoinMesh: React.FC<{
  seed: CoinSeed;
  frame: number;
  forwardProgress: number;
  globalAlpha: number;
  bodyGeom: THREE.BufferGeometry;
  reliefGeom: THREE.BufferGeometry;
  rimNormal: THREE.Texture;
}> = ({
  seed,
  frame,
  forwardProgress,
  globalAlpha,
  bodyGeom,
  reliefGeom,
  rimNormal,
}) => {
  const glossy = seed.variant === "glossy";

  // ExtrudeGeometry tags its caps as material group 0 and its sides
  // (bevel + extrusion) as group 1. So an array of two materials gives
  // smooth face caps and a reeded rim from one geometry.
  const { bodyFaceMat, bodyRimMat, reliefMat } = useMemo(() => {
    const bodyFaceMat = new THREE.MeshPhysicalMaterial({
      color: COIN_BODY_COLOR,
      metalness: 0.93,
      roughness: glossy ? 0.25 : 0.4,
      envMapIntensity: 1.4,
      clearcoat: glossy ? 0.5 : 0.2,
      clearcoatRoughness: glossy ? 0.14 : 0.3,
    });
    const bodyRimMat = new THREE.MeshPhysicalMaterial({
      color: COIN_BODY_COLOR,
      metalness: 0.95,
      roughness: glossy ? 0.32 : 0.45,
      envMapIntensity: 1.45,
      clearcoat: glossy ? 0.3 : 0.12,
      clearcoatRoughness: 0.28,
      normalMap: rimNormal,
      normalScale: new THREE.Vector2(0.55, 0.55),
    });
    const reliefMat = new THREE.MeshPhysicalMaterial({
      color: COIN_RELIEF_COLOR,
      metalness: 0.96,
      roughness: glossy ? 0.28 : 0.42,
      envMapIntensity: 1.55,
      clearcoat: glossy ? 0.35 : 0.12,
      clearcoatRoughness: 0.26,
    });
    return { bodyFaceMat, bodyRimMat, reliefMat };
  }, [glossy, rimNormal]);

  const p = smoothstep01(forwardProgress);
  const cyclePosNormalised =
    (((frame / FPS) / seed.cycleSec + seed.cyclePhase) % 1 + 1) % 1;
  const zRange = Z_FRONT - Z_BACK;
  const zBase = Z_BACK + cyclePosNormalised * zRange;
  const z = zBase + p * 1.0;

  const cameraZ = 14;
  const distance = Math.max(0.5, cameraZ - z);
  const focalX = FRAME_HALF_W / cameraZ;
  const focalY = FRAME_HALF_H / cameraZ;
  const projX = seed.x / (distance * focalX);
  const projY = seed.y / (distance * focalY);
  const projRadiusX = (seed.baseScale * 1.0) / (distance * focalX);
  const projRadiusY = (seed.baseScale * 1.0) / (distance * focalY);
  const outsideRight = projX - projRadiusX > 1.6;
  const outsideLeft = projX + projRadiusX < -1.6;
  const outsideTop = projY - projRadiusY > 1.6;
  const outsideBottom = projY + projRadiusY < -1.6;
  const fullyOffScreen =
    outsideRight || outsideLeft || outsideTop || outsideBottom;
  const isVisible = !fullyOffScreen && globalAlpha > 0.01;

  const scale = seed.baseScale;

  // The procedural body extrudes along +Z, so its face already points
  // toward the camera at identity rotation. The wobble alone tilts it
  // around a diagonal in the XY plane.
  const wobbleSpeed = (Math.PI * 2) / (seed.wobblePeriodSec * FPS);
  const wobbleRad =
    (seed.wobbleAmplitudeDeg * Math.PI) / 180 *
    Math.sin(seed.wobblePhase + frame * wobbleSpeed);
  const staticRad = (seed.staticTiltDeg * Math.PI) / 180;
  const totalAngle = wobbleRad + staticRad;
  const ax = Math.SQRT1_2;
  const ay = Math.SQRT1_2 * seed.tiltAxisDir;
  const diagonalAxis = new THREE.Vector3(ax, ay, 0);
  const quat = new THREE.Quaternion().setFromAxisAngle(
    diagonalAxis,
    totalAngle,
  );

  return (
    <group
      position={[seed.x, seed.y, z]}
      quaternion={quat}
      visible={isVisible}
    >
      <group scale={[scale, scale, scale]}>
        <mesh geometry={bodyGeom} material={[bodyFaceMat, bodyRimMat]} />
        <mesh geometry={reliefGeom} material={reliefMat} />
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
  const bodyGeom = useMemo(() => buildCoinBodyGeometry(), []);
  const reliefGeom = useMemo(() => buildReliefGeometry(), []);
  const rimNormal = useMemo(() => buildRimNormalMap(), []);

  const persp = camera as THREE.PerspectiveCamera;
  persp.position.set(0, 0.5, 14);
  persp.lookAt(0, 0, 0);
  persp.fov = 40;
  persp.updateProjectionMatrix();

  return (
    <>
      <Environment files={HDRI_URL} resolution={256} />
      <ambientLight intensity={0.12} color="#ffffff" />
      <directionalLight
        position={[-9, 3.5, 9]}
        intensity={1.4}
        color="#ffffff"
      />
      <directionalLight
        position={[6, 4, 5]}
        intensity={0.6}
        color="#bcd0ff"
      />
      <ContactShadows
        position={[0, -5.5, 0]}
        scale={30}
        far={8}
        blur={2.4}
        opacity={0.32}
        resolution={1024}
        color="#000000"
      />
      {COIN_SEEDS.map((seed, i) => (
        <CoinMesh
          key={i}
          seed={seed}
          frame={frame}
          forwardProgress={forwardProgress}
          globalAlpha={opacity}
          bodyGeom={bodyGeom}
          reliefGeom={reliefGeom}
          rimNormal={rimNormal}
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
