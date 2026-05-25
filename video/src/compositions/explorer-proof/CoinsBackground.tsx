// CoinsBackground — anodised-blue tokens built from real geometry.
// Body is an ExtrudeGeometry with a 4-segment bevel at both rim
// corners. Relief features — 84 cylindrical denticles, a torus inner
// ring, and a beveled brand pill — are extruded and merged for both
// faces, then struck onto the body. One MeshPhysicalMaterial across
// the lot, lit by a studio HDRI. No painted face textures anywhere.

import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { ContactShadows, Html } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Phone3D, type Phone3DProps } from "./Phone3D";
import { LeftWordmark, RightWordmark } from "./SideTexts";

export type CoinsBackgroundProps = {
  forwardProgress: number;
  opacity: number;
  width: number;
  height: number;
  phone: Phone3DProps;
  sideTextsVisibility: number;
};

const BG_COLOR = "#FFFFFF";

const BRAND_BLUE = "#1B45D7";

// ── Coin geometry ────────────────────────────────────────────────────

const COIN_RADIUS = 1.0;
const COIN_THICKNESS = 0.20;
const BEVEL_SIZE = 0.045;
const BEVEL_THICKNESS = 0.028;
const FACE_Z = COIN_THICKNESS / 2 - BEVEL_THICKNESS; // where flat face sits

// Body — shape's radius is sine-modulated to carry 84 real geometric
// ridges around the rim. Real ridges don't alias the way a high-
// frequency normal map does at oblique angles. The bevel still rounds
// the rim corners so the ridges fade smoothly into the face caps.
const RIM_RIDGES = 84;
const RIM_RIDGE_AMPLITUDE = 0.0042;
const RIM_SEGMENTS = 420; // 5 polygon segments per ridge

function buildCoinBodyGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i <= RIM_SEGMENTS; i++) {
    const a = (i / RIM_SEGMENTS) * Math.PI * 2;
    const r = COIN_RADIUS + Math.sin(a * RIM_RIDGES) * RIM_RIDGE_AMPLITUDE;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const depth = COIN_THICKNESS - BEVEL_THICKNESS * 2;
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 5,
    bevelSize: BEVEL_SIZE,
    bevelThickness: BEVEL_THICKNESS,
  });
  geom.translate(0, 0, -depth / 2 - BEVEL_THICKNESS);
  geom.computeVertexNormals();
  return geom;
}

// Brand mark geometry — matches the EndCard hero: a white rounded
// square with a blue pill struck through its centre. Two separate
// merged buffers so each can carry its own material.

const MARK_HALF = COIN_RADIUS * 0.4;     // half-side of the rounded square
const MARK_RADIUS = MARK_HALF * 0.227;   // rx/size = 232/1024 ≈ 0.227
const MARK_DEPTH = 0.024;
const PILL_HW = MARK_HALF * 0.5;          // half-width of the inner pill
const PILL_HH = MARK_HALF * 0.098;        // half-height of the inner pill
const PILL_DEPTH = 0.016;

function buildMarkSquareShape(): THREE.Shape {
  const shape = new THREE.Shape();
  const s = MARK_HALF;
  const r = MARK_RADIUS;
  shape.moveTo(-s + r, -s);
  shape.lineTo(s - r, -s);
  shape.absarc(s - r, -s + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(s, s - r);
  shape.absarc(s - r, s - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-s + r, s);
  shape.absarc(-s + r, s - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-s, -s + r);
  shape.absarc(-s + r, -s + r, r, Math.PI, Math.PI * 1.5, false);
  shape.closePath();
  return shape;
}

function buildBrandPillShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-PILL_HW + PILL_HH, -PILL_HH);
  shape.lineTo(PILL_HW - PILL_HH, -PILL_HH);
  shape.absarc(PILL_HW - PILL_HH, 0, PILL_HH, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(-PILL_HW + PILL_HH, PILL_HH);
  shape.absarc(-PILL_HW + PILL_HH, 0, PILL_HH, Math.PI / 2, -Math.PI / 2, false);
  shape.closePath();
  return shape;
}

function mergeOrThrow(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const normalised = pieces.map((p) => {
    const flat = p.index ? p.toNonIndexed() : p;
    p.dispose();
    return flat;
  });
  const merged = mergeGeometries(normalised, false);
  for (const p of normalised) p.dispose();
  if (!merged) throw new Error("relief geometry merge failed");
  merged.computeVertexNormals();
  return merged;
}

// White relief — denticles around the perimeter + the rounded-square
// body of the GM mark. Painted white so the mark reads as enamel.
function buildWhiteReliefGeometry(): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = [];
  const denticleDepth = 0.022;
  const denticleR = 0.022;
  const denticleCount = 84;
  const denticleOrbit = COIN_RADIUS * 0.87;
  const denticleProto = new THREE.CylinderGeometry(
    denticleR,
    denticleR,
    denticleDepth,
    14,
  );
  denticleProto.rotateX(Math.PI / 2);

  for (const sign of [1, -1] as const) {
    for (let i = 0; i < denticleCount; i++) {
      const a = (i / denticleCount) * Math.PI * 2;
      const g = denticleProto.clone();
      g.translate(
        Math.cos(a) * denticleOrbit,
        Math.sin(a) * denticleOrbit,
        sign * (FACE_Z + denticleDepth / 2),
      );
      pieces.push(g);
    }
  }
  denticleProto.dispose();

  const markShape = buildMarkSquareShape();
  for (const sign of [1, -1] as const) {
    const mark = new THREE.ExtrudeGeometry(markShape, {
      depth: MARK_DEPTH,
      bevelEnabled: true,
      bevelSize: 0.007,
      bevelThickness: 0.005,
      bevelSegments: 2,
      curveSegments: 24,
    });
    if (sign === -1) {
      mark.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, -1));
    }
    mark.translate(0, 0, sign * FACE_Z);
    pieces.push(mark);
  }

  return mergeOrThrow(pieces);
}

// Blue brand pill — sits on top of the white mark on each face, struck
// through its centre. Painted in the brand blue.
function buildBluePillGeometry(): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = [];
  const pillShape = buildBrandPillShape();
  for (const sign of [1, -1] as const) {
    const pill = new THREE.ExtrudeGeometry(pillShape, {
      depth: PILL_DEPTH,
      bevelEnabled: true,
      bevelSize: 0.004,
      bevelThickness: 0.003,
      bevelSegments: 2,
      curveSegments: 24,
    });
    if (sign === -1) {
      pill.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, -1));
    }
    // Sit ON TOP of the white mark — z starts where the mark ends.
    pill.translate(0, 0, sign * (FACE_Z + MARK_DEPTH));
    pieces.push(pill);
  }
  return mergeOrThrow(pieces);
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
const COIN_RELIEF_COLOR = new THREE.Color("#FFFFFF");

const CoinMesh: React.FC<{
  seed: CoinSeed;
  frame: number;
  forwardProgress: number;
  globalAlpha: number;
  bodyGeom: THREE.BufferGeometry;
  whiteReliefGeom: THREE.BufferGeometry;
  bluePillGeom: THREE.BufferGeometry;
}> = ({
  seed,
  frame,
  forwardProgress,
  globalAlpha,
  bodyGeom,
  whiteReliefGeom,
  bluePillGeom,
}) => {
  const glossy = seed.variant === "glossy";

  // ExtrudeGeometry tags its caps as material group 0 and its sides
  // (bevel + extrusion) as group 1. So an array of two materials gives
  // smooth face caps and a reeded rim from one geometry.
  const { bodyFaceMat, bodyRimMat, whiteReliefMat, bluePillMat } = useMemo(() => {
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
    });
    // The pill, denticles and ring read as white enamel inlay, not as
    // chrome. Low metalness keeps the white from being eaten by the
    // HDRI reflection; clearcoat carries the gloss.
    // The denticles + white mark read as enamel inlay. Low metalness
    // keeps the white from being eaten by HDRI reflection.
    const whiteReliefMat = new THREE.MeshPhysicalMaterial({
      color: COIN_RELIEF_COLOR,
      metalness: 0.08,
      roughness: glossy ? 0.24 : 0.36,
      envMapIntensity: 0.55,
      clearcoat: glossy ? 0.85 : 0.6,
      clearcoatRoughness: glossy ? 0.1 : 0.2,
    });
    // Blue pill on top of the white mark — moderate metalness so it
    // picks up the HDRI as a brand-blue chrome inlay.
    const bluePillMat = new THREE.MeshPhysicalMaterial({
      color: COIN_BODY_COLOR,
      metalness: 0.55,
      roughness: glossy ? 0.26 : 0.38,
      envMapIntensity: 1.1,
      clearcoat: glossy ? 0.6 : 0.3,
      clearcoatRoughness: glossy ? 0.14 : 0.24,
    });
    return { bodyFaceMat, bodyRimMat, whiteReliefMat, bluePillMat };
  }, [glossy]);

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
      {/* Y is the coin's lathe axis (depth). 1.2× on Y makes each coin
          20% thicker without changing its face diameter. */}
      <group scale={[scale, scale * 1.2, scale]}>
        <mesh geometry={bodyGeom} material={[bodyFaceMat, bodyRimMat]} />
        <mesh geometry={whiteReliefGeom} material={whiteReliefMat} />
        <mesh geometry={bluePillGeom} material={bluePillMat} />
      </group>
    </group>
  );
};

// Image-based lighting for the metallic coins. drei's <Environment> — and any
// runtime PMREMGenerator pass (fromEquirectangular / fromScene) — aborts the
// WebGL draw under three 0.182 / @react-three/fiber 9.5 / drei 10.7: the DOM
// commits but the GL frame comes back blank. PMREM renders to its own target
// and, in @remotion/three's single deterministic frame, leaves the renderer in
// a state the capture reads as empty.
//
// Therefore: skip PMREM entirely. Build a small studio gradient as a plain
// CubeTexture (bright top, dark floor, soft side falloff) and hand it straight
// to scene.environment. Metals read it as a clean vertical sheen — no loader,
// no render target, no version coupling.
function makeGradientFace(top: string, bottom: string, size = 128): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

export const SceneEnvironment: React.FC = () => {
  const scene = useThree((s) => s.scene);
  useMemo(() => {
    const sideTop = "#f2f5fb";
    const sideBottom = "#3b3f4b";
    const cube = new THREE.CubeTexture([
      makeGradientFace(sideTop, sideBottom), // +X
      makeGradientFace(sideTop, sideBottom), // -X
      makeGradientFace("#ffffff", "#ffffff"), // +Y (ceiling key)
      makeGradientFace("#23252e", "#16171d"), // -Y (floor)
      makeGradientFace(sideTop, sideBottom), // +Z
      makeGradientFace(sideTop, sideBottom), // -Z
    ] as unknown as HTMLImageElement[]);
    cube.needsUpdate = true;
    cube.colorSpace = THREE.SRGBColorSpace;
    scene.environment = cube;
    return cube;
  }, [scene]);
  return null;
};

const Scene: React.FC<{
  frame: number;
  forwardProgress: number;
  opacity: number;
  phone: Phone3DProps;
  sideTextsVisibility: number;
}> = ({ frame, forwardProgress, opacity, phone, sideTextsVisibility }) => {
  const { camera } = useThree();
  const bodyGeom = useMemo(() => buildCoinBodyGeometry(), []);
  const whiteReliefGeom = useMemo(() => buildWhiteReliefGeometry(), []);
  const bluePillGeom = useMemo(() => buildBluePillGeometry(), []);

  const persp = camera as THREE.PerspectiveCamera;
  persp.position.set(0, 0.5, 14);
  persp.lookAt(0, 0, 0);
  persp.fov = 40;
  persp.updateProjectionMatrix();

  return (
    <>
      <SceneEnvironment />
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
          whiteReliefGeom={whiteReliefGeom}
          bluePillGeom={bluePillGeom}
        />
      ))}
      <Phone3D {...phone} />
      {/* Side wordmarks live inside the 3D scene so the phone and
          coins can occlude them naturally. transform={false} keeps the
          text screen-space-sized; occlude raycasts every frame against
          scene meshes so a close-up phone cleanly hides the text. */}
      <Html
        position={[-8.8, 0, 0]}
        transform={false}
        occlude
        pointerEvents="none"
        zIndexRange={[10, 0]}
      >
        <LeftWordmark visibility={sideTextsVisibility} />
      </Html>
      <Html
        position={[8.8, 0, 0]}
        transform={false}
        occlude
        pointerEvents="none"
        zIndexRange={[10, 0]}
      >
        <RightWordmark visibility={sideTextsVisibility} />
      </Html>
    </>
  );
};

export const CoinsBackground: React.FC<CoinsBackgroundProps> = ({
  forwardProgress,
  opacity,
  width,
  height,
  phone,
  sideTextsVisibility,
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
            phone={phone}
            sideTextsVisibility={sideTextsVisibility}
          />
        </React.Suspense>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
