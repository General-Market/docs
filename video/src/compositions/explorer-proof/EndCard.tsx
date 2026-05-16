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
import { ContactShadows } from "@react-three/drei";
import * as THREE from "three";

export type EndCardProps = {
  /** 0..1 — drives the full reveal. */
  progress: number;
};

const LOGO_URL = staticFile("gm-mark.svg");

const DISPLAY_STACK =
  '"SF Pro Display", -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif';
const TEXT_STACK =
  '"SF Pro Text", -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif';

const BRAND_BLUE = "#2856F6";

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

// ── General mark geometry ────────────────────────────────────────────
// Real brand logo, not a coin: 1024×1024 rounded square (rx=232) with
// a centred 512×100 white pill. Modelled at unit size (1.0 = half-side
// of the square), with the pill as a real geometric INSET so when it
// rotates you see the pill carved into the body.
//
// SHAPE_SIZE = 1.0  → half-side of the rounded square
// PILL_W     = 0.5  → half-width of the pill (512/1024)
// PILL_H     = 0.098 → half-height (100/1024)
// CORNER_R   = 0.227 → corner radius (232/1024 ≈ 0.227)
function buildBodyGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const s = 1.0;
  const r = 0.227;
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
  const depth = 0.32;
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 6,
    bevelSize: 0.04,
    bevelThickness: 0.035,
    curveSegments: 28,
  });
  geom.translate(0, 0, -depth / 2);
  geom.computeVertexNormals();
  return geom;
}

// Pill — short extrusion that sits PROUD of both faces. Painted in the
// brand blue so the white body reads as the square and the pill reads
// as the inset stripe (matches AntiCheatEndCard's GeneralMark inversion
// — white square, accent-coloured bar).
function buildPillGeometry(): THREE.BufferGeometry {
  const pillW = 0.5;
  const pillH = 0.098;
  const pillR = pillH; // rx=50 / 1024 ≈ 0.0488, but visually pillH/2 reads right
  const shape = new THREE.Shape();
  shape.moveTo(-pillW + pillR, -pillH);
  shape.lineTo(pillW - pillR, -pillH);
  shape.absarc(pillW - pillR, 0, pillH, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(-pillW + pillR, pillH);
  shape.absarc(-pillW + pillR, 0, pillH, Math.PI / 2, -Math.PI / 2, false);
  shape.closePath();
  const depth = 0.42; // a hair longer than the body so it pokes through both faces
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.012,
    bevelThickness: 0.008,
    curveSegments: 24,
  });
  geom.translate(0, 0, -depth / 2);
  geom.computeVertexNormals();
  return geom;
}

const HeroCoin: React.FC<{ progress: number }> = ({ progress }) => {
  const bodyGeom = useMemo(() => buildBodyGeometry(), []);
  const pillGeom = useMemo(() => buildPillGeometry(), []);

  const bodyMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color("#ffffff"),
        metalness: 0.05,
        roughness: 0.32,
        envMapIntensity: 0.95,
        clearcoat: 0.7,
        clearcoatRoughness: 0.14,
      }),
    [],
  );

  const pillMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(BRAND_BLUE),
        metalness: 0.4,
        roughness: 0.28,
        envMapIntensity: 1.1,
        clearcoat: 0.6,
        clearcoatRoughness: 0.18,
      }),
    [],
  );

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

  // ── Spin: 1.5 revolutions during entry, then 0.5 to land on the
  //    face-forward angle at progress = 1.0 (total 4π = exactly 2
  //    revolutions, ends pointing at the camera).
  const spin =
    progress < 0.5
      ? progress * (Math.PI * 6)
      : Math.PI * 3 + (progress - 0.5) * (Math.PI * 2);

  // ── Tilt: starts edge-on-ish, settles face-forward
  const tilt = interpolate(progress, [0, 0.5, 1], [Math.PI * 0.35, 0.1, 0]);

  // ExtrudeGeometry already extrudes along +Z — face normal points at
  // the camera by default. No baseOrient needed.
  const spinQ = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    spin,
  );
  const tiltQ = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    tilt,
  );
  const quat = tiltQ.clone().multiply(spinQ);

  // Scale: small grow into place
  const scale = interpolate(progress, [0, 0.25, 0.5, 1], [0.3, 1.25, 1.0, 1.05]);

  return (
    <group position={[0, 0.3, z]} quaternion={quat} scale={scale * 1.4}>
      <mesh geometry={bodyGeom} material={bodyMat} />
      <mesh geometry={pillGeom} material={pillMat} />
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
      {/* Three-point rig — no Environment, no HDRI suspense surprises. */}
      <ambientLight intensity={0.55} color="#ffffff" />
      <directionalLight position={[-6, 4, 8]} intensity={2.0} color="#ffffff" />
      <directionalLight position={[5, 2, 4]} intensity={0.9} color="#a8b5ff" />
      <directionalLight position={[0, -3, -2]} intensity={0.35} color="#5060c8" />
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
