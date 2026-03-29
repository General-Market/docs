/**
 * Phone3D — Reusable 3D iPhone component for Remotion scenes.
 *
 * Uses @remotion/three ThreeCanvas + @react-three/drei for a real 3D phone
 * with glass front, metallic frame, matte back, Dynamic Island, and shadows.
 *
 * Screen content: pass `screenContent` (React node) — rendered as an HTML
 * overlay precisely aligned to the 3D phone's screen region. The 3D phone
 * renders a dark screen plane; the React content floats on top via absolute
 * positioning. This is the only reliable cross-renderer approach in Remotion
 * (no Html component from drei, no portals — pure overlay alignment).
 *
 * Usage:
 *   <Phone3D
 *     rotateX={0} rotateY={-0.15} rotateZ={0.05}
 *     scale={1}
 *     screenContent={<MyAppUI />}
 *   />
 */

import React, { useMemo, useRef, Suspense } from "react";
import {
  AbsoluteFill,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import {
  ContactShadows,
  Environment,
} from "@react-three/drei";

/* ── iPhone 15 Pro proportions (mm → Three.js units, scaled) ── */
const PHONE_W = 1.5;       // ~75mm → 1.5 units
const PHONE_H = 3.0;       // ~150mm → 3.0 units
const PHONE_D = 0.06;      // thin like a real iPhone (~8mm but scaled down for visual)
const CORNER_R = 0.22;     // corner radius (more rounded like iPhone 16)
const BEZEL = 0.04;        // bezel inset — thinner bezels
const SCREEN_R = 0.18;     // screen corner radius (close to body for edge-to-edge look)

/* Dynamic Island */
const DI_W = 0.38;         // pill width
const DI_H = 0.12;         // pill height
const DI_R = 0.06;         // pill corner radius
const DI_Y_OFFSET = 0.12;  // distance from top of screen

/* ── Rounded rect shape helper ── */
function roundedRectShape(
  w: number, h: number, r: number
): THREE.Shape {
  const shape = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;

  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  return shape;
}

/* ── Pill shape for Dynamic Island ── */
function pillShape(w: number, h: number, r: number): THREE.Shape {
  return roundedRectShape(w, h, r);
}

/* ══════════════════════════════════════════
   PhoneBody — the 3D mesh group
   ══════════════════════════════════════════ */
const PhoneBody: React.FC<{
  screenColor?: string;
  frameColor?: string;
  backColor?: string;
}> = ({
  screenColor = "#0a0a0a",
  frameColor = "#e0e0e4",
  backColor = "#f0f0f2",
}) => {
  /* Body: extruded rounded rect — titanium silver iPhone */
  const bodyGeometry = useMemo(() => {
    const shape = roundedRectShape(PHONE_W, PHONE_H, CORNER_R);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: PHONE_D,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.003,
      bevelSegments: 2,
    });
    geo.center();
    return geo;
  }, []);

  /* Screen: flat rounded rect, slightly inset */
  const screenGeometry = useMemo(() => {
    const sw = PHONE_W - BEZEL * 2;
    const sh = PHONE_H - BEZEL * 2;
    const shape = roundedRectShape(sw, sh, SCREEN_R);
    const geo = new THREE.ShapeGeometry(shape, 32);
    return geo;
  }, []);

  /* Dynamic Island: pill cutout on screen */
  const diGeometry = useMemo(() => {
    const shape = pillShape(DI_W, DI_H, DI_R);
    const geo = new THREE.ShapeGeometry(shape, 16);
    return geo;
  }, []);

  /* Camera lens bump (back) — subtle cylinder */
  const lensGeometry = useMemo(() => {
    return new THREE.CylinderGeometry(0.12, 0.12, 0.02, 32);
  }, []);

  const screenTopEdge = PHONE_H / 2 - BEZEL;

  return (
    <group>
      {/* ── Phone body (titanium frame) ── */}
      <mesh geometry={bodyGeometry}>
        <meshStandardMaterial
          color={frameColor}
          metalness={0.95}
          roughness={0.08}
          envMapIntensity={1.5}
        />
      </mesh>

      {/* ── Screen (dark, sits on front face) ── */}
      <mesh
        geometry={screenGeometry}
        position={[0, 0, PHONE_D / 2 + 0.002]}
      >
        <meshBasicMaterial color={screenColor} />
      </mesh>

      {/* ── Dynamic Island ── */}
      <mesh
        geometry={diGeometry}
        position={[0, screenTopEdge - DI_Y_OFFSET - DI_H / 2, PHONE_D / 2 + 0.003]}
      >
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* ── Matte back (frosted titanium) ── */}
      <mesh position={[0, 0, -PHONE_D / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[PHONE_W - 0.02, PHONE_H - 0.02]} />
        <meshStandardMaterial
          color={backColor}
          metalness={0.3}
          roughness={0.5}
        />
      </mesh>

      {/* ── Camera lens bump (back, top-left) ── */}
      <mesh
        geometry={lensGeometry}
        position={[-0.35, 1.05, -PHONE_D / 2 - 0.01]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <meshStandardMaterial
          color="#1a1a1a"
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>

      {/* ── Side buttons (volume, power) ── */}
      {/* Power button — right side */}
      <mesh position={[PHONE_W / 2 + 0.01, 0.5, 0]}>
        <boxGeometry args={[0.02, 0.25, 0.06]} />
        <meshStandardMaterial color={frameColor} metalness={0.9} roughness={0.15} />
      </mesh>
      {/* Volume up — left side */}
      <mesh position={[-PHONE_W / 2 - 0.01, 0.6, 0]}>
        <boxGeometry args={[0.02, 0.18, 0.06]} />
        <meshStandardMaterial color={frameColor} metalness={0.9} roughness={0.15} />
      </mesh>
      {/* Volume down — left side */}
      <mesh position={[-PHONE_W / 2 - 0.01, 0.3, 0]}>
        <boxGeometry args={[0.02, 0.18, 0.06]} />
        <meshStandardMaterial color={frameColor} metalness={0.9} roughness={0.15} />
      </mesh>
      {/* Mute switch — left side, above volume */}
      <mesh position={[-PHONE_W / 2 - 0.01, 0.9, 0]}>
        <boxGeometry args={[0.02, 0.1, 0.05]} />
        <meshStandardMaterial color={frameColor} metalness={0.9} roughness={0.15} />
      </mesh>
    </group>
  );
};

/* ══════════════════════════════════════════
   PhoneScene — camera, lights, shadows
   ══════════════════════════════════════════ */
const PhoneScene: React.FC<{
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  phoneScale: number;
  screenColor?: string;
  frameColor?: string;
  backColor?: string;
}> = ({ rotateX, rotateY, rotateZ, phoneScale, screenColor, frameColor, backColor }) => {
  const groupRef = useRef<THREE.Group>(null);

  return (
    <>
      {/* Lighting — FLAT even lighting to prevent color shifts during rotation */}
      <ambientLight intensity={1.2} color="#ffffff" />
      <directionalLight position={[0, 0, 5]} intensity={0.5} color="#ffffff" />
      <directionalLight position={[0, 0, -5]} intensity={0.3} color="#ffffff" />

      {/* Environment for clean reflections — studio preset is most neutral */}
      <Environment preset="studio" />

      {/* Phone group with transforms */}
      <group
        ref={groupRef}
        rotation={[rotateX, rotateY, rotateZ]}
        scale={phoneScale}
      >
        <PhoneBody
          screenColor={screenColor}
          frameColor={frameColor}
          backColor={backColor}
        />
      </group>

      {/* Ground shadow */}
      <ContactShadows
        position={[0, -1.8, 0]}
        opacity={0.5}
        scale={5}
        blur={2.5}
        far={4}
      />
    </>
  );
};

/* ══════════════════════════════════════════════════════════════
   Phone3D — Public API
   ══════════════════════════════════════════════════════════════ */
export interface Phone3DProps {
  /** Rotation around X axis (radians). Default 0. */
  rotateX?: number;
  /** Rotation around Y axis (radians). Default 0. */
  rotateY?: number;
  /** Rotation around Z axis (radians). Default 0. */
  rotateZ?: number;
  /** Uniform scale. Default 1. */
  scale?: number;
  /** React node to render as screen content, overlaid on the phone screen. */
  screenContent?: React.ReactNode;
  /** Screen background color in the 3D scene. Default "#0a0a0a". */
  screenColor?: string;
  /** Frame/side metallic color. Default "#8a8a8e" (titanium). */
  frameColor?: string;
  /** Back panel color. Default "#2c2c2e" (dark matte). */
  backColor?: string;
  /** Overall opacity. Default 1. */
  opacity?: number;
  /**
   * Screen overlay positioning — percentage offsets within the container.
   * Tune these if your rotation makes the overlay misalign.
   * Defaults are calibrated for near-frontal views (rotateY < 0.3 rad)
   * on a 16:9 canvas with the default camera (z=5, fov=35).
   */
  screenOverlay?: {
    /** Top offset as % of container height. Default 5 */
    top?: number;
    /** Left offset as % of container width. Default 37.5 */
    left?: number;
    /** Width as % of container width. Default 25 */
    width?: number;
    /** Height as % of container height. Default 88 */
    height?: number;
  };
  /** Style overrides for the outer container */
  style?: React.CSSProperties;
}

export const Phone3D: React.FC<Phone3DProps> = ({
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
  scale: phoneScale = 1,
  screenContent,
  screenColor = "#0a0a0a",
  frameColor = "#e0e0e4",
  backColor = "#f0f0f2",
  opacity = 1,
  screenOverlay,
  style,
}) => {
  const { width, height } = useVideoConfig();

  /* Screen overlay defaults — calibrated for head-on view on 16:9 canvas,
     camera at z=5, fov=35. Phone body is 1.5x3.0 units.
     Screen inset by BEZEL on each side. */
  const overlay = {
    top: screenOverlay?.top ?? 5.5,
    left: screenOverlay?.left ?? 38,
    width: screenOverlay?.width ?? 24,
    height: screenOverlay?.height ?? 86,
  };

  /* CSS perspective that matches the Three.js camera projection.
     Formula: canvasWidth / (2 * tan(fov/2)).
     Camera: z=5, fov=35deg → tan(17.5deg) ≈ 0.3153.
     1280 / (2 * 0.3153) ≈ 2030px. */
  const cssPerspective = Math.round(width / (2 * Math.tan((35 / 2) * Math.PI / 180)));

  return (
    <AbsoluteFill style={{ opacity, ...style }}>
      {/* 3D phone render */}
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ position: [0, 0, 5], fov: 35 }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Suspense fallback={null}>
          <PhoneScene
            rotateX={rotateX}
            rotateY={rotateY}
            rotateZ={rotateZ}
            phoneScale={phoneScale}
            screenColor={screenColor}
            frameColor={frameColor}
            backColor={backColor}
          />
        </Suspense>
      </ThreeCanvas>

      {/* Screen content — REPLACES Three.js overlay with CSS-only phone+screen
          in the SAME transform space. This guarantees screen tilts with the case. */}
      {screenContent && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            perspective: cssPerspective,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: 280,
              height: 580,
              borderRadius: 36,
              overflow: "hidden",
              position: "relative",
              transform: [
                `rotateX(${rotateX}rad)`,
                `rotateY(${rotateY}rad)`,
                `rotateZ(${rotateZ}rad)`,
                `scale(${phoneScale})`,
              ].join(" "),
              transformStyle: "preserve-3d",
              transformOrigin: "center center",
            }}
          >
            {screenContent}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export default Phone3D;
