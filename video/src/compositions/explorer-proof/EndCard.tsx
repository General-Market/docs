// EndCard — 3D animated brand reveal. A hero coin tumbles toward the
// camera, settles, the GM logo + URL fade in over a deep-purple stage.
// Progress 0..1 drives the whole timeline:
//   0.0 → 0.25  background fades to dark, coin spins in from far back
//   0.25 → 0.55 coin overshoots forward (touches camera), then settles
//   0.55 → 0.85 wordmark + URL fade in beneath the coin
//   0.85 → 1.0  whole frame stabilises — gentle continuous rotation
//
// One ThreeCanvas, one coin (reusing the same GLB the field uses), one
// HDRI for env reflections. Independent from the coin-field scene.

import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, staticFile } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useGLTF, ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";

export type EndCardProps = {
  /** 0..1 — drives the full reveal. */
  progress: number;
};

const COIN_MODEL_URL = staticFile("models/coin.glb");
const LOGO_URL = staticFile("gm-mark.svg");
useGLTF.preload(COIN_MODEL_URL);

const DISPLAY_STACK =
  '"SF Pro Display", -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif';
const TEXT_STACK =
  '"SF Pro Text", -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif';

const BRAND_BLUE = "#2856F6";
const BRAND_BLUE_DEEP = "#0F2BB5";

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

// Bake the coin material exactly once, shared between the EndCard's
// single hero coin mesh.
function tuneCoin(gltfScene: THREE.Group): THREE.Group {
  const c = gltfScene.clone(true);
  c.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (Array.isArray(mesh.material)) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    const name = (mat.name || "").toLowerCase();
    if (name === "front" || name === "back") {
      mesh.material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(BRAND_BLUE),
        metalness: 0.2,
        roughness: 0.35,
        envMapIntensity: 0.7,
        clearcoat: 0.85,
        clearcoatRoughness: 0.1,
      });
    } else {
      mesh.material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(BRAND_BLUE_DEEP),
        metalness: 0.95,
        roughness: 0.28,
        envMapIntensity: 1.6,
        clearcoat: 0.4,
        clearcoatRoughness: 0.18,
      });
    }
  });
  return c;
}

const HeroCoin: React.FC<{ progress: number }> = ({ progress }) => {
  const gltf = useGLTF(COIN_MODEL_URL);
  const coin = useMemo(() => tuneCoin(gltf.scene), [gltf.scene]);

  // ── Z dolly: far back → overshoot → settle
  // 0.0–0.25 : z eases from -22 to -2 (coming in)
  // 0.25–0.45: overshoots to +1 (closest)
  // 0.45–0.7 : settles back to -3
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
  let z: number;
  if (progress < 0.25) {
    z = -22 + easeOut(progress / 0.25) * 20;
  } else if (progress < 0.45) {
    z = -2 + ((progress - 0.25) / 0.2) * 3;
  } else if (progress < 0.7) {
    z = 1 - ((progress - 0.45) / 0.25) * 4;
  } else {
    z = -3;
  }

  // ── Spin: 3 full revolutions during the entrance, then very slow.
  const spinDuringEntry = progress < 0.5 ? progress * (Math.PI * 6) : null;
  const slowSpin = progress >= 0.5 ? (progress - 0.5) * (Math.PI * 0.8) : 0;
  const spin = spinDuringEntry ?? Math.PI * 3 + slowSpin;

  // ── Tilt: starts edge-on-ish, settles face-forward
  const tilt = interpolate(progress, [0, 0.5, 1], [Math.PI * 0.35, 0.18, 0.1]);

  // Coin lathe-axis points along ±Y. Orient face toward camera (+Z).
  const baseOrient = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    Math.PI / 2,
  );
  const spinQ = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    spin,
  );
  const tiltQ = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    tilt,
  );
  const quat = tiltQ.clone().multiply(spinQ).multiply(baseOrient);

  // Scale: small grow into place
  const scale = interpolate(progress, [0, 0.25, 0.5, 1], [0.3, 1.25, 1.0, 1.05]);

  return (
    <group position={[0, 0.3, z]} quaternion={quat} scale={scale}>
      {/* Thickness 1.2× same as the field */}
      <group scale={[1, 1.2, 1]}>
        <primitive object={coin} />
      </group>
    </group>
  );
};

const Scene: React.FC<{ progress: number }> = ({ progress }) => {
  const { camera } = useThree();
  const persp = camera as THREE.PerspectiveCamera;
  persp.position.set(0, 0.3, 6);
  persp.lookAt(0, 0, 0);
  persp.fov = 38;
  persp.updateProjectionMatrix();

  return (
    <>
      <Environment preset="studio" environmentIntensity={1.0} />
      <ambientLight intensity={0.25} color="#ffffff" />
      <directionalLight position={[-6, 4, 8]} intensity={1.8} color="#ffffff" />
      <directionalLight position={[5, -2, -4]} intensity={0.4} color="#7a8cff" />
      <HeroCoin progress={progress} />
      <ContactShadows
        position={[0, -1.5, 0]}
        scale={8}
        far={4}
        blur={2.2}
        opacity={0.5}
        resolution={1024}
        color="#08081a"
      />
    </>
  );
};

export const EndCard: React.FC<EndCardProps> = ({ progress }) => {
  const clamped = Math.max(0, Math.min(1, progress));
  if (clamped <= 0) return null;

  // Background fades from 0 to fully opaque over the first 25%.
  const bgOpacity = smoothstep(clamped / 0.25);
  // Wordmark / tagline fade in between 0.55 and 0.85.
  const textProg = interpolate(clamped, [0.55, 0.85], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 0.1, 0.3, 1),
  });

  return (
    <AbsoluteFill style={{ opacity: 1, pointerEvents: "none" }}>
      {/* Deep purple radial background */}
      <AbsoluteFill
        style={{
          opacity: bgOpacity,
          background:
            "radial-gradient(ellipse at center, #1a0d2e 0%, #0a0517 75%)",
        }}
      />

      {/* 3D coin canvas */}
      <AbsoluteFill style={{ opacity: bgOpacity }}>
        <ThreeCanvas
          width={1920}
          height={1080}
          camera={{ fov: 38, near: 0.5, far: 100, position: [0, 0.3, 6] }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.1,
          }}
          style={{ background: "transparent" }}
        >
          <React.Suspense fallback={null}>
            <Scene progress={clamped} />
          </React.Suspense>
        </ThreeCanvas>
      </AbsoluteFill>

      {/* Wordmark + tagline — fades in after the coin lands */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: textProg,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 22,
            transform: `translateY(${(1 - textProg) * 24}px)`,
            paddingTop: 380,
          }}
        >
          <div
            style={{
              fontFamily: DISPLAY_STACK,
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: "-0.022em",
              color: "#FFFFFF",
              lineHeight: 1,
            }}
          >
            GENERALMARKET.IO
          </div>
          <div
            style={{
              fontFamily: TEXT_STACK,
              fontSize: 22,
              fontWeight: 400,
              letterSpacing: "0.04em",
              color: "#FFFFFF",
              opacity: 0.55,
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            The Trading Anti-Cheat · /explorer
          </div>
        </div>
      </AbsoluteFill>

      {/* Suppress unused-import warning if LOGO_URL ever falls out */}
      <span style={{ display: "none" }} aria-hidden>{LOGO_URL}</span>
    </AbsoluteFill>
  );
};
