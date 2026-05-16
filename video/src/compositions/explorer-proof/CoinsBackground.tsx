// CoinsBackground — solid brand-green tokens advancing toward the camera.
// Diagonal wobble, no transparency, two matcap variants (glass + bnoise)
// for surface variety, ContactShadows for grounded realism. Each lane
// recycles continuously so the field never empties out.

import React, { useMemo, useEffect } from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useGLTF, useTexture, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { preloadOnce } from "../../lib/preloadOnce";

export type CoinsBackgroundProps = {
  forwardProgress: number;
  opacity: number;
  width: number;
  height: number;
};

const COIN_MODEL_URL = staticFile("models/coin.glb");
const MATCAP_GLASS_URL = staticFile("three-challenge/glass.png");
const MATCAP_NOISE_URL = staticFile("three-challenge/bnoise.png");
preloadOnce(useGLTF.preload, COIN_MODEL_URL);
preloadOnce(useTexture.preload, MATCAP_GLASS_URL);
preloadOnce(useTexture.preload, MATCAP_NOISE_URL);

const BG_GRADIENT =
  "radial-gradient(ellipse at center, #E8E0F2 0%, #D8CFE7 60%, #C6BCD7 100%)";

// Brand identity — solid green token. NO transparency.
const FACE_TEXTURE_SIZE = 512;
const BRAND_GREEN = "#1cb37c";
const BRAND_GREEN_DEEP = "#0d6c4b";
const BRAND_GREEN_LIGHT = "#3ed59a";

function buildFaceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = FACE_TEXTURE_SIZE;
  canvas.height = FACE_TEXTURE_SIZE;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const cx = FACE_TEXTURE_SIZE / 2;
    const cy = FACE_TEXTURE_SIZE / 2;
    // Vertical body gradient — lighter top, deeper bottom.
    const bodyGrad = ctx.createLinearGradient(0, 0, 0, FACE_TEXTURE_SIZE);
    bodyGrad.addColorStop(0, BRAND_GREEN_LIGHT);
    bodyGrad.addColorStop(0.5, BRAND_GREEN);
    bodyGrad.addColorStop(1, BRAND_GREEN_DEEP);
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(0, 0, FACE_TEXTURE_SIZE, FACE_TEXTURE_SIZE);
    // Crescent specular sheen — upper-left highlight.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, FACE_TEXTURE_SIZE * 0.49, 0, Math.PI * 2);
    ctx.clip();
    const sheen = ctx.createRadialGradient(
      cx - FACE_TEXTURE_SIZE * 0.22,
      cy - FACE_TEXTURE_SIZE * 0.24,
      FACE_TEXTURE_SIZE * 0.04,
      cx - FACE_TEXTURE_SIZE * 0.22,
      cy - FACE_TEXTURE_SIZE * 0.24,
      FACE_TEXTURE_SIZE * 0.32,
    );
    sheen.addColorStop(0, "rgba(255,255,255,0.55)");
    sheen.addColorStop(0.5, "rgba(255,255,255,0.18)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, FACE_TEXTURE_SIZE, FACE_TEXTURE_SIZE);
    ctx.restore();
    // White pill mark — current frontend logo, 70% of inscribed disc.
    const pillW = FACE_TEXTURE_SIZE * 0.68;
    const pillH = FACE_TEXTURE_SIZE * (100 / 1024) * 1.35;
    const pillX = (FACE_TEXTURE_SIZE - pillW) / 2;
    const pillY = (FACE_TEXTURE_SIZE - pillH) / 2;
    const pillR = pillH / 2;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.moveTo(pillX + pillR, pillY);
    ctx.lineTo(pillX + pillW - pillR, pillY);
    ctx.arc(pillX + pillW - pillR, pillY + pillR, pillR, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(pillX + pillR, pillY + pillH);
    ctx.arc(pillX + pillR, pillY + pillR, pillR, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

// ── Coin lanes ───────────────────────────────────────────────────────
// 8 lanes total — sparser than before. Each lane has its own matcap
// variant (glass-like or noise-grunge) so the field has visual variety.

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
  variant: "glass" | "noise";
};

const COIN_SEEDS: CoinSeed[] = [
  // Top band
  { x: -5.8, y: 3.0, baseScale: 1.4, cycleSec: 10, cyclePhase: 0.0,
    tiltAxisDir: -1, wobbleAmplitudeDeg: 30, wobblePeriodSec: 6.0,
    wobblePhase: 0.4, staticTiltDeg: -18, variant: "glass" },
  { x: 5.8, y: 3.2, baseScale: 1.5, cycleSec: 11, cyclePhase: 0.5,
    tiltAxisDir: 1, wobbleAmplitudeDeg: 15, wobblePeriodSec: 5.5,
    wobblePhase: 1.6, staticTiltDeg: 22, variant: "noise" },
  // Bottom band
  { x: -5.8, y: -3.0, baseScale: 1.6, cycleSec: 12, cyclePhase: 0.25,
    tiltAxisDir: 1, wobbleAmplitudeDeg: 30, wobblePeriodSec: 7.0,
    wobblePhase: 1.0, staticTiltDeg: -25, variant: "noise" },
  { x: 5.8, y: -3.0, baseScale: 1.45, cycleSec: 11, cyclePhase: 0.75,
    tiltAxisDir: -1, wobbleAmplitudeDeg: 30, wobblePeriodSec: 6.5,
    wobblePhase: 2.2, staticTiltDeg: 20, variant: "glass" },
  // Far edges
  { x: -7.8, y: 2.4, baseScale: 1.0, cycleSec: 13, cyclePhase: 0.15,
    tiltAxisDir: -1, wobbleAmplitudeDeg: 15, wobblePeriodSec: 5.5,
    wobblePhase: 0.7, staticTiltDeg: -10, variant: "glass" },
  { x: 7.8, y: -2.4, baseScale: 1.05, cycleSec: 12.5, cyclePhase: 0.6,
    tiltAxisDir: 1, wobbleAmplitudeDeg: 30, wobblePeriodSec: 6.0,
    wobblePhase: 2.0, staticTiltDeg: 24, variant: "noise" },
  { x: -7.4, y: -2.6, baseScale: 1.05, cycleSec: 11.5, cyclePhase: 0.35,
    tiltAxisDir: 1, wobbleAmplitudeDeg: 30, wobblePeriodSec: 7.0,
    wobblePhase: 0.0, staticTiltDeg: 18, variant: "noise" },
  { x: 7.4, y: 2.6, baseScale: 1.0, cycleSec: 10.5, cyclePhase: 0.88,
    tiltAxisDir: -1, wobbleAmplitudeDeg: 15, wobblePeriodSec: 5.0,
    wobblePhase: 2.5, staticTiltDeg: -16, variant: "glass" },
];

const FPS = 30;
const Z_BACK = -16;
const Z_FRONT = 7;
// Frame margin for "off-screen" detection. Coins fade only once their
// projected screen position is outside the frame box, so they exit
// laterally rather than fading in the middle of the frame.
const FRAME_HALF_W = 9.5; // world units at z=0 (a bit more than visible)
const FRAME_HALF_H = 5.5;

function smoothstep01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

const COIN_RIM_COLOR = new THREE.Color(BRAND_GREEN_DEEP);

const CoinMesh: React.FC<{
  seed: CoinSeed;
  frame: number;
  forwardProgress: number;
  globalAlpha: number;
  gltfScene: THREE.Group;
  faceMap: THREE.Texture;
  matcapGlass: THREE.Texture;
  matcapNoise: THREE.Texture;
}> = ({
  seed,
  frame,
  forwardProgress,
  globalAlpha,
  gltfScene,
  faceMap,
  matcapGlass,
  matcapNoise,
}) => {
  const matcap = seed.variant === "glass" ? matcapGlass : matcapNoise;

  const clone = useMemo(() => {
    const c = gltfScene.clone(true);
    c.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (Array.isArray(mesh.material)) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const name = (mat.name || "").toLowerCase();
      if (name === "front" || name === "back") {
        // Solid green face with brand pill. No transparency.
        const m = new THREE.MeshStandardMaterial({
          map: faceMap,
          color: new THREE.Color("#ffffff"),
          roughness: 0.32,
          metalness: 0.12,
          transparent: true, // we still drive global opacity for fade
          opacity: 1.0,
        });
        m.emissive = new THREE.Color("#ffffff");
        m.emissiveMap = faceMap;
        m.emissiveIntensity = 0.12;
        mesh.material = m;
      } else {
        // Rim — matcap material for metallic environment reflection.
        // No transparency — solid token edge.
        const m = new THREE.MeshMatcapMaterial({
          matcap,
          color: COIN_RIM_COLOR,
          transparent: true,
          opacity: 1.0,
        });
        mesh.material = m;
      }
    });
    return c;
  }, [gltfScene, faceMap, matcap]);

  // ── Advance cycle
  const p = smoothstep01(forwardProgress);
  const cyclePosNormalised =
    (((frame / FPS) / seed.cycleSec + seed.cyclePhase) % 1 + 1) % 1;
  const zRange = Z_FRONT - Z_BACK;
  const zBase = Z_BACK + cyclePosNormalised * zRange;
  const z = zBase + p * 1.0;

  // ── Off-frame detection — coin only fades when its full bounding
  //    box is genuinely past the frame edge. Margin generous (1.6) so
  //    a coin doesn't disappear while any pixel of it could still be
  //    on screen.
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
  // Cycle-end fade only takes effect once the coin is already off-screen.
  const cycleAlpha = fullyOffScreen ? 0 : 1;
  // Subtle fade-in at cycle start so a fresh coin doesn't pop in deep z.
  const fadeIn = smoothstep01((cyclePosNormalised - 0.0) / 0.04);
  const visibility = Math.min(fadeIn, cycleAlpha);

  // Drive material opacity each frame.
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

  // ── Orientation: face camera, then diagonal wobble
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

  // Fatter coins — stretch on the local Y axis (which after baseOrient
  // becomes the depth dimension of the disc). 2.4x makes the rim
  // visibly thick and gives weight to the token edge.
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
  const matcapGlass = useTexture(MATCAP_GLASS_URL);
  const matcapNoise = useTexture(MATCAP_NOISE_URL);
  const faceMap = useMemo(() => buildFaceTexture(), []);

  useEffect(() => {
    matcapGlass.colorSpace = THREE.SRGBColorSpace;
    matcapNoise.colorSpace = THREE.SRGBColorSpace;
  }, [matcapGlass, matcapNoise]);

  const persp = camera as THREE.PerspectiveCamera;
  persp.position.set(0, 0.5, 14);
  persp.lookAt(0, 0, 0);
  persp.fov = 40;
  persp.updateProjectionMatrix();

  // ── Single key light from the VIEWER'S LEFT (camera at +Z, so a
  //    strongly negative X positions the light past the viewer's left
  //    shoulder). Slightly elevated and forward of the coin field.
  //    Same one-source rig as ThreeChallenge — every coin shaded the
  //    same way, no conflicting highlights.
  return (
    <>
      <ambientLight intensity={0.32} color="#ffffff" />
      <directionalLight
        position={[-9, 3.5, 9]}
        intensity={2.4}
        color="#ffffff"
        castShadow
      />
      {/* Ground shadow plane — soft drop shadows on the lavender stage. */}
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
          faceMap={faceMap}
          matcapGlass={matcapGlass}
          matcapNoise={matcapNoise}
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
