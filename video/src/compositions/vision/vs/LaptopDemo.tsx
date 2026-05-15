/**
 * LaptopDemo — Trade montage on a 3D MacBook screen.
 *
 * Camera starts wide (establishing shot), zooms into the MacBook screen.
 * Terminal overlay progressively zooms as each trade line appears.
 * Duration: 210 frames at 30fps (7s).
 */
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useGLTF, ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
import { preloadOnce } from "../../../lib/preloadOnce";
import { COLOR, FONT, ANIM } from "./tokens";

const FPS = 30;
const MODEL_URL = staticFile("models/tabletop_macbook_iphone.glb");
preloadOnce(useGLTF.preload, MODEL_URL);

// Camera views from DeviceShowcase
const CAM_WIDE = {
  pos: new THREE.Vector3(7.859, 2.544, -9.431),
  target: new THREE.Vector3(2.056, 1.385, 0.641),
  zoom: 1.0,
};
const CAM_MACBOOK = {
  pos: new THREE.Vector3(3.031, 4.096, -6.179),
  target: new THREE.Vector3(3.001, 2.780, 0.829),
  zoom: 1.2,
};
// Even closer — into the screen
const CAM_SCREEN = {
  pos: new THREE.Vector3(3.02, 3.6, -4.0),
  target: new THREE.Vector3(3.0, 3.0, 0.8),
  zoom: 1.6,
};

// Lid states
const LID_CLOSED = new THREE.Quaternion(0, 0, 0, 1);
const LID_OPEN = new THREE.Quaternion(-0.78333, 0, 0, 0.62161);
const BEVELS_POS = new THREE.Vector3(-0.00012, 0.00824, -0.10401);
const BEVELS_SCALE = new THREE.Vector3(0.27471, 0.27471, 0.27471);

// iPhone hidden
const IPHONE_POS = new THREE.Vector3(-3, 0, 0);
const IPHONE_QUAT = new THREE.Quaternion(0.00056, 0.70739, 0.70682, 0.00056);
const IPHONE_SCALE = new THREE.Vector3(22.486, 22.486, 22.486);

// Easing helper
function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// ── 3D Scene with animated camera ──

const _tmpPos = new THREE.Vector3();
const _tmpTarget = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();

const MacbookScene: React.FC<{ frame: number }> = ({ frame }) => {
  const { camera } = useThree();
  const gltf = useGLTF(MODEL_URL);

  const { iphone, bevels } = useMemo(() => ({
    iphone: gltf.scene.getObjectByName("iphone") ?? null,
    bevels: gltf.scene.getObjectByName("Bevels_2") ?? null,
  }), [gltf]);

  // Camera zoom: wide (0-30) → macbook (30-70) → screen (70-210)
  const toMacT = easeInOutSine(interpolate(frame, [0, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }));
  const toScreenT = easeInOutSine(interpolate(frame, [50, 140], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }));

  // Interpolate camera: wide → macbook → screen
  const midPos = _tmpPos.copy(CAM_WIDE.pos).lerp(CAM_MACBOOK.pos, toMacT);
  const pos = midPos.clone().lerp(CAM_SCREEN.pos, toScreenT);
  const midTarget = _tmpTarget.copy(CAM_WIDE.target).lerp(CAM_MACBOOK.target, toMacT);
  const target = midTarget.clone().lerp(CAM_SCREEN.target, toScreenT);
  const zoom = CAM_WIDE.zoom + (CAM_MACBOOK.zoom - CAM_WIDE.zoom) * toMacT
    + (CAM_SCREEN.zoom - CAM_MACBOOK.zoom) * toScreenT;

  const cam = camera as THREE.PerspectiveCamera;
  cam.position.copy(pos);
  cam.lookAt(target);
  cam.zoom = zoom;
  cam.updateProjectionMatrix();

  // Lid opens with camera zoom
  const lidT = easeInOutSine(interpolate(frame, [5, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }));
  if (bevels) {
    bevels.position.copy(BEVELS_POS);
    bevels.quaternion.copy(_tmpQuat.copy(LID_CLOSED).slerp(LID_OPEN, lidT));
    bevels.scale.copy(BEVELS_SCALE);
  }

  if (iphone) {
    iphone.position.copy(IPHONE_POS);
    iphone.quaternion.copy(IPHONE_QUAT);
    iphone.scale.copy(IPHONE_SCALE);
  }

  return (
    <>
      <primitive object={gltf.scene} />
      <Environment preset="studio" environmentIntensity={1.8} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 8, -5]} intensity={2.5} castShadow />
      <directionalLight position={[-4, 4, 3]} intensity={0.6} color="#c0d0e8" />
      <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={14} blur={1.5} far={5} />
    </>
  );
};

// ── Trade data ──

const TRADES = [
  { cmd: "long(crypto, size=10000)", result: "✓ 10,000 positions opened. $0.", start: 40 },
  { cmd: "predict(twitch, up_10min, count=10000)", result: "✓ 10,000 predictions. $0.", start: 80 },
  { cmd: "short(memecoin, tokens=100000)", result: "✓ 100,000 positions. $0.", start: 115 },
  { cmd: "predict(trains, delay, routes=30)", result: "✓ 30 route predictions. $0.", start: 145 },
];

// ── Typing animation ──

const TypedLine: React.FC<{
  text: string;
  frame: number;
  start: number;
  color: string;
  prefix?: string;
}> = ({ text, frame, start, color, prefix = "" }) => {
  const local = Math.max(0, frame - start);
  const charsVisible = Math.min(Math.floor(local * 1.5), text.length);
  const visible = text.slice(0, charsVisible);
  const opacity = interpolate(local, [0, 3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ opacity, fontFamily: FONT.mono, fontSize: 14, color, lineHeight: 1.8 }}>
      {prefix && <span style={{ color: COLOR.textMuted }}>{prefix}</span>}
      {visible}
      {charsVisible < text.length && (
        <span style={{ opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0, color: COLOR.brand }}>▊</span>
      )}
    </div>
  );
};

// ── Terminal overlay with progressive zoom ──

const TerminalOverlay: React.FC = () => {
  const frame = useCurrentFrame();

  // Terminal fades in after camera reaches macbook view
  const terminalOpacity = interpolate(frame, [30, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Progressive zoom: as more trades appear, the overlay scales up
  // simulating the camera pushing into the screen
  const zoomScale = interpolate(frame, [30, 80, 140, 180], [1, 1.05, 1.15, 1.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Progressive pan up: keep latest trade visible as zoom increases
  const panY = interpolate(frame, [30, 80, 140, 180], [0, -5, -15, -30], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const counterStart = 170;
  const counterLocal = Math.max(0, frame - counterStart);
  const counterS = spring({ frame: counterLocal, fps: FPS, config: ANIM.slam });

  return (
    <div
      style={{
        position: "absolute",
        // Screen area — tighter fit on the laptop screen
        left: "27%",
        top: "12%",
        width: "46%",
        height: "50%",
        // Match screen perspective
        transform: [
          "perspective(1200px)",
          "rotateX(-4deg)",
          "rotateY(0.3deg)",
          `scale(${zoomScale})`,
          `translateY(${panY}px)`,
        ].join(" "),
        transformOrigin: "center 40%",
        // Terminal
        backgroundColor: "rgba(5,5,5,0.95)",
        borderRadius: 6,
        padding: "16px 20px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        opacity: terminalOpacity,
      }}
    >
      {/* Title bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF5F56" }} />
        <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFBD2E" }} />
        <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#27C93F" }} />
      </div>

      {/* Trade lines */}
      {TRADES.map((trade, i) => {
        const resultStart = trade.start + Math.ceil(trade.cmd.length / 1.5) + 3;
        return (
          <React.Fragment key={i}>
            <TypedLine
              text={trade.cmd}
              frame={frame}
              start={trade.start}
              color={COLOR.textPrimary}
              prefix="> "
            />
            {frame >= resultStart && (
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 13,
                  color: COLOR.brand,
                  lineHeight: 1.8,
                  opacity: interpolate(frame, [resultStart, resultStart + 5], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                }}
              >
                {"  "}{trade.result}
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* Running total */}
      {frame >= counterStart && (
        <div
          style={{
            marginTop: "auto",
            paddingTop: 10,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            fontFamily: FONT.mono,
            fontSize: 15,
            fontWeight: 700,
            color: COLOR.brand,
            opacity: interpolate(counterS, [0, 0.3], [0, 1], {
              extrapolateRight: "clamp",
            }),
            transform: `scale(${interpolate(counterS, [0, 1], [0.7, 1])})`,
            textShadow: `0 0 20px ${COLOR.brand}44`,
          }}
        >
          120,030 positions. $0. 47 seconds.
        </div>
      )}
    </div>
  );
};

// ── Main export ──

export const LAPTOP_DUR = 210; // 7s at 30fps

export const LaptopDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#f5f5f5" }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{
          fov: 50,
          near: 0.5,
          far: 1000,
          position: [CAM_WIDE.pos.x, CAM_WIDE.pos.y, CAM_WIDE.pos.z],
        }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
      >
        <React.Suspense fallback={null}>
          <MacbookScene frame={frame} />
        </React.Suspense>
      </ThreeCanvas>
      <TerminalOverlay />
    </AbsoluteFill>
  );
};
