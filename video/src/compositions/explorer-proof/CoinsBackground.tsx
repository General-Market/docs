// CoinsBackground — anodised-blue tokens lit by a studio HDRI.
// One metal across the whole coin. The brand mark, the inner ring and
// the ring of denticles around the perimeter are pressed into the face
// via a procedural height→normal map. The milled edge is reeded the
// same way. No painted face textures anywhere — the only colour is the
// material tint, the rest is reflection.

import React, { useMemo, useEffect } from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useGLTF, ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
import { preloadOnce } from "../../lib/preloadOnce";

export type CoinsBackgroundProps = {
  forwardProgress: number;
  opacity: number;
  width: number;
  height: number;
};

const COIN_MODEL_URL = staticFile("models/coin.glb");
const HDRI_URL = staticFile("textures/hdri/studio_small_03_1k.hdr");
preloadOnce(useGLTF.preload, COIN_MODEL_URL);

const BG_GRADIENT =
  "radial-gradient(ellipse at center, #E8E0F2 0%, #D8CFE7 60%, #C6BCD7 100%)";

const BRAND_BLUE = "#2856F6";
const BRAND_BLUE_DEEP = "#0A249A";

// ── Procedural relief ────────────────────────────────────────────────
// Render the coin design as a grayscale height map on canvas, then run
// a Sobel pass to convert to a tangent-space normal map. This is what
// gives the surface its struck-metal feel — denticles, embossed pill,
// recessed inner ring, all carrying real shadow direction under any
// light angle.

const FACE_HEIGHT_SIZE = 1024;

function buildFaceHeightMap(): HTMLCanvasElement {
  const size = FACE_HEIGHT_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Off-disc area sits at black (recessed / invisible).
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  // The disc itself is the baseline plateau.
  ctx.fillStyle = "#262626";
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.485, 0, Math.PI * 2);
  ctx.fill();

  // Recessed perimeter channel — a thin valley just inside the rim.
  ctx.strokeStyle = "#101010";
  ctx.lineWidth = size * 0.012;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.455, 0, Math.PI * 2);
  ctx.stroke();

  // Denticles — small raised dots around the perimeter. The visual
  // tell that says "this is currency, not a chip token".
  const denticleCount = 84;
  const denticleR = size * 0.428;
  const denticleSize = size * 0.0085;
  ctx.fillStyle = "#a0a0a0";
  for (let i = 0; i < denticleCount; i++) {
    const a = (i / denticleCount) * Math.PI * 2;
    const x = cx + Math.cos(a) * denticleR;
    const y = cy + Math.sin(a) * denticleR;
    ctx.beginPath();
    ctx.arc(x, y, denticleSize, 0, Math.PI * 2);
    ctx.fill();
  }

  // Inner ring — a thin raised circle that frames the brand mark.
  ctx.strokeStyle = "#666666";
  ctx.lineWidth = size * 0.006;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.34, 0, Math.PI * 2);
  ctx.stroke();

  // Central pill — the brand mark, strongly embossed. Soft blur so the
  // normal map produces smooth side gradients instead of a step.
  ctx.filter = "blur(3px)";
  const pillW = size * 0.58;
  const pillH = size * 0.13;
  const pillX = (size - pillW) / 2;
  const pillY = (size - pillH) / 2;
  const pillR = pillH / 2;
  ctx.fillStyle = "#e8e8e8";
  ctx.beginPath();
  ctx.moveTo(pillX + pillR, pillY);
  ctx.lineTo(pillX + pillW - pillR, pillY);
  ctx.arc(pillX + pillW - pillR, pillY + pillR, pillR, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(pillX + pillR, pillY + pillH);
  ctx.arc(pillX + pillR, pillY + pillR, pillR, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fill();
  ctx.filter = "none";

  return canvas;
}

function heightCanvasToNormalMap(
  source: HTMLCanvasElement,
  strength: number,
): THREE.DataTexture {
  const w = source.width;
  const h = source.height;
  const ctx = source.getContext("2d");
  if (!ctx) {
    return new THREE.DataTexture(
      new Uint8Array(4),
      1,
      1,
      THREE.RGBAFormat,
    );
  }
  const src = ctx.getImageData(0, 0, w, h).data;
  const data = new Uint8Array(w * h * 4);
  const sample = (x: number, y: number): number => {
    const cx = Math.max(0, Math.min(w - 1, x));
    const cy = Math.max(0, Math.min(h - 1, y));
    return src[(cy * w + cx) * 4] / 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hL = sample(x - 1, y);
      const hR = sample(x + 1, y);
      const hU = sample(x, y - 1);
      const hD = sample(x, y + 1);
      const dx = (hR - hL) * strength;
      const dy = (hD - hU) * strength;
      const nz = 1.0;
      const len = Math.sqrt(dx * dx + dy * dy + nz * nz);
      const nxN = -dx / len;
      const nyN = -dy / len;
      const nzN = nz / len;
      const i = (y * w + x) * 4;
      data[i] = Math.round((nxN + 1) * 0.5 * 255);
      data[i + 1] = Math.round((nyN + 1) * 0.5 * 255);
      data[i + 2] = Math.round((nzN + 1) * 0.5 * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// Reeded-edge normal map for the rim. Sin wave across U → 96 vertical
// ridges wrapping the cylinder.
function buildRimNormalMap(): THREE.DataTexture {
  const ridgesPerStrip = 96;
  const width = 2048;
  const height = 4;
  const data = new Uint8Array(width * height * 4);
  const amplitude = 0.6;
  for (let x = 0; x < width; x++) {
    const u = x / width;
    const phase = u * ridgesPerStrip * Math.PI * 2;
    const nx = Math.sin(phase) * amplitude;
    const ny = 0;
    const nz = Math.sqrt(Math.max(0.0001, 1 - nx * nx - ny * ny));
    const r = Math.round((nx + 1) * 0.5 * 255);
    const g = Math.round((ny + 1) * 0.5 * 255);
    const b = Math.round((nz + 1) * 0.5 * 255);
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
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

const COIN_FACE_COLOR = new THREE.Color(BRAND_BLUE);
const COIN_RIM_COLOR = new THREE.Color(BRAND_BLUE_DEEP);

const CoinMesh: React.FC<{
  seed: CoinSeed;
  frame: number;
  forwardProgress: number;
  globalAlpha: number;
  gltfScene: THREE.Group;
  faceNormal: THREE.Texture;
  rimNormal: THREE.Texture;
}> = ({
  seed,
  frame,
  forwardProgress,
  globalAlpha,
  gltfScene,
  faceNormal,
  rimNormal,
}) => {
  const clone = useMemo(() => {
    const c = gltfScene.clone(true);
    const glossy = seed.variant === "glossy";
    c.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (Array.isArray(mesh.material)) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const name = (mat.name || "").toLowerCase();
      if (name === "front" || name === "back") {
        const m = new THREE.MeshPhysicalMaterial({
          color: COIN_FACE_COLOR,
          metalness: 0.94,
          roughness: glossy ? 0.28 : 0.4,
          envMapIntensity: 1.35,
          clearcoat: glossy ? 0.45 : 0.2,
          clearcoatRoughness: glossy ? 0.15 : 0.28,
          normalMap: faceNormal,
          normalScale: new THREE.Vector2(1.4, 1.4),
          transparent: true,
          opacity: 1.0,
        });
        mesh.material = m;
      } else {
        const m = new THREE.MeshPhysicalMaterial({
          color: COIN_RIM_COLOR,
          metalness: 0.96,
          roughness: glossy ? 0.32 : 0.44,
          envMapIntensity: 1.4,
          clearcoat: glossy ? 0.3 : 0.12,
          clearcoatRoughness: 0.3,
          normalMap: rimNormal,
          normalScale: new THREE.Vector2(0.6, 0.6),
          transparent: true,
          opacity: 1.0,
        });
        mesh.material = m;
      }
    });
    return c;
  }, [gltfScene, faceNormal, rimNormal, seed.variant]);

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
  const cycleAlpha = fullyOffScreen ? 0 : 1;
  const fadeIn = smoothstep01((cyclePosNormalised - 0.0) / 0.04);
  const visibility = Math.min(fadeIn, cycleAlpha);

  useEffect(() => {
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (Array.isArray(mesh.material)) return;
      (mesh.material as THREE.Material & { opacity: number }).opacity =
        globalAlpha * visibility;
    });
  });

  const scale = seed.baseScale;

  const baseOrient = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    Math.PI / 2,
  );
  const wobbleSpeed = (Math.PI * 2) / (seed.wobblePeriodSec * FPS);
  const wobbleRad =
    (seed.wobbleAmplitudeDeg * Math.PI) / 180 *
    Math.sin(seed.wobblePhase + frame * wobbleSpeed);
  const staticRad = (seed.staticTiltDeg * Math.PI) / 180;
  const totalAngle = wobbleRad + staticRad;
  const ax = Math.SQRT1_2;
  const ay = Math.SQRT1_2 * seed.tiltAxisDir;
  const diagonalAxis = new THREE.Vector3(ax, ay, 0);
  const wobbleQ = new THREE.Quaternion().setFromAxisAngle(
    diagonalAxis,
    totalAngle,
  );
  const quat = wobbleQ.clone().multiply(baseOrient);

  return (
    <group position={[seed.x, seed.y, z]} quaternion={quat}>
      <group scale={[scale, scale * 2.4, scale]}>
        <primitive object={clone} />
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
  const gltf = useGLTF(COIN_MODEL_URL);
  const faceNormal = useMemo(
    () => heightCanvasToNormalMap(buildFaceHeightMap(), 4.0),
    [],
  );
  const rimNormal = useMemo(() => buildRimNormalMap(), []);

  const persp = camera as THREE.PerspectiveCamera;
  persp.position.set(0, 0.5, 14);
  persp.lookAt(0, 0, 0);
  persp.fov = 40;
  persp.updateProjectionMatrix();

  return (
    <>
      <Environment files={HDRI_URL} resolution={256} />
      <ambientLight intensity={0.14} color="#ffffff" />
      <directionalLight
        position={[-9, 3.5, 9]}
        intensity={1.6}
        color="#ffffff"
        castShadow
      />
      <ContactShadows
        position={[0, -5.5, 0]}
        scale={30}
        far={8}
        blur={2.4}
        opacity={0.42}
        resolution={1024}
        color="#3d2b6a"
      />
      {COIN_SEEDS.map((seed, i) => (
        <CoinMesh
          key={i}
          seed={seed}
          frame={frame}
          forwardProgress={forwardProgress}
          globalAlpha={opacity}
          gltfScene={gltf.scene}
          faceNormal={faceNormal}
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
    <AbsoluteFill style={{ width, height, background: BG_GRADIENT }}>
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
