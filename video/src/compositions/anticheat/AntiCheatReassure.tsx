import React, { useEffect, useMemo, useRef } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useGLTF, ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
// @ts-ignore — SkeletonUtils types are not bundled
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";

const SCENE_SECONDS = 4;
const SECOND_LINE_AT = toFrames(2.0);
// "shielded" arrives two beats after "...but" — the pause is the punchline.
const SHIELDED_AT = SECOND_LINE_AT + toFrames(0.6);
const GREEN = "#3ddc84";

// ── MacBook model + screen painting ────────────────────────────────

const MODEL_URL = staticFile("models/tabletop_macbook_iphone.glb");
useGLTF.preload(MODEL_URL);

const SCREEN_W = 1280;
const SCREEN_H = 800;

// Each painter holds for ~30 frames (1s at 30fps). Last 8 frames cross-fade
// into the next painter. Order matches the original conveyor: Polymarket →
// NYSE → Crypto → Pumpfun. Four answers, one screen — the trader keeps
// flipping tabs and never finds the way out.
const BEAT_FRAMES = 30;
const FADE_FRAMES = 8;
const TOTAL_BEATS = 4;

function findMacbookScreenMesh(root: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  root.traverse((child) => {
    if (found) return;
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (Array.isArray(mesh.material)) return;
    const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
    if (mat && mat.map) {
      mesh.material = mat.clone();
      found = mesh;
    }
  });
  return found;
}

function bindCanvasToScreen(mesh: THREE.Mesh, texture: THREE.CanvasTexture) {
  const mat = mesh.material as THREE.MeshStandardMaterial;
  if (mat.map === texture && mat.emissiveMap === texture) return;
  mat.map = texture;
  mat.color = new THREE.Color(0xffffff);
  mat.emissive = new THREE.Color(0xffffff);
  mat.emissiveMap = texture;
  mat.emissiveIntensity = 0.9;
  mat.needsUpdate = true;
}

// ── Painters — bold, iconic, not chart-busy ────────────────────────

type Painter = (ctx: CanvasRenderingContext2D, localFrame: number) => void;

// Painter 1 — Polymarket. Navy, big binary question, two odds bars.
const drawPolymarket: Painter = (ctx, localFrame) => {
  ctx.fillStyle = "#0f1626";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // wordmark
  ctx.fillStyle = "#ffffff";
  ctx.font = "500 20px ui-monospace, Menlo, monospace";
  ctx.save();
  // simulate letter-spacing 0.18em via per-glyph advance
  const wm = "POLYMARKET";
  let wx = 60;
  for (let i = 0; i < wm.length; i++) {
    ctx.fillText(wm[i], wx, 70);
    wx += ctx.measureText(wm[i]).width + 3.6;
  }
  ctx.restore();

  // question
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 80px Inter, system-ui, sans-serif";
  ctx.fillText("Will BTC hit $200K?", 60, 240);

  // bars — animate from 0 → final width across first 12 frames
  const grow = Math.min(1, localFrame / 12);
  const eased = grow * grow * (3 - 2 * grow);

  const barTop = 320;
  const barH = 84;
  const fullW = SCREEN_W - 120;

  // YES
  ctx.fillStyle = "#3ddc84";
  ctx.fillRect(60, barTop, fullW * 0.64 * eased, barH);
  ctx.fillStyle = "#0a1a12";
  ctx.font = "700 40px ui-monospace, Menlo, monospace";
  ctx.fillText("YES 64%", 80, barTop + 56);

  // NO
  ctx.fillStyle = "#ff3b3b";
  ctx.fillRect(60, barTop + barH + 28, fullW * 0.36 * eased, barH);
  ctx.fillStyle = "#1a0808";
  ctx.fillText("NO 36%", 80, barTop + barH + 28 + 56);

  // footnote
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "500 24px ui-monospace, Menlo, monospace";
  ctx.fillText("2.1M wagered  ·  412K bets", 60, SCREEN_H - 60);
};

// Painter 2 — NYSE. Near-black grid, sparkline drawn left-to-right, big price.
const drawNyse: Painter = (ctx, localFrame) => {
  ctx.fillStyle = "#0a0d12";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // faint grid
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    const y = (i / 8) * SCREEN_H;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SCREEN_W, y);
    ctx.stroke();
  }

  // header
  ctx.fillStyle = "#ffffff";
  ctx.font = "500 26px ui-monospace, Menlo, monospace";
  ctx.fillText("NYSE: AAPL", 60, 70);

  ctx.fillStyle = "#3ddc84";
  ctx.font = "700 26px ui-monospace, Menlo, monospace";
  const pctText = "+1.84%";
  const pctW = ctx.measureText(pctText).width;
  ctx.fillText(pctText, SCREEN_W - 60 - pctW, 70);

  // sparkline — deterministic ascending, drawn over first 16 frames
  const reveal = Math.min(1, localFrame / 16);
  const points: { x: number; y: number }[] = [];
  const startX = 60;
  const endX = SCREEN_W - 60;
  const span = endX - startX;
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = startX + span * t;
    // slight wobble around an ascending curve
    const wobble = Math.sin(i * 1.31 + 0.7) * 14;
    const y = 480 - t * 220 - Math.sin(i * 0.41) * 10 + wobble;
    points.push({ x, y });
  }
  const cutoff = Math.floor(points.length * reveal);

  // gradient fill underneath the partial line
  if (cutoff > 1) {
    const grad = ctx.createLinearGradient(0, 280, 0, 540);
    grad.addColorStop(0, "rgba(61,220,132,0.35)");
    grad.addColorStop(1, "rgba(61,220,132,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(points[0].x, 540);
    for (let i = 0; i < cutoff; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.lineTo(points[cutoff - 1].x, 540);
    ctx.closePath();
    ctx.fill();
  }

  // line
  ctx.strokeStyle = "#3ddc84";
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i < cutoff; i++) {
    const p = points[i];
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  // big price
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 100px Inter, system-ui, sans-serif";
  ctx.fillText("$237.89", 60, SCREEN_H - 130);

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "500 22px ui-monospace, Menlo, monospace";
  ctx.fillText("Market open  ·  2.6M volume", 60, SCREEN_H - 60);
};

// Painter 3 — Crypto. Bitcoin orange dark, candles fade in left-to-right.
const drawCrypto: Painter = (ctx, localFrame) => {
  ctx.fillStyle = "#1a0e08";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // header
  ctx.fillStyle = "#ffffff";
  ctx.font = "500 20px ui-monospace, Menlo, monospace";
  ctx.fillText("BTC-PERP  ·  HYPERLIQUID", 60, 70);

  // 14 candles, deterministic via sin
  const N = 14;
  const padX = 80;
  const colW = (SCREEN_W - padX * 2) / N;
  const baseY = 460;
  const reveal = Math.min(1, localFrame / 18);
  const visible = Math.floor(N * reveal);

  for (let i = 0; i < N; i++) {
    if (i > visible) break;
    const seed = Math.sin(i * 1.73 + 0.4);
    const seed2 = Math.sin(i * 0.91 + 1.2);
    const isUp = seed > 0 || i === N - 1;
    const last = i === N - 1;
    const cx = padX + colW * (i + 0.5);
    const bodyH = last ? 220 : 60 + Math.abs(seed2) * 110;
    const wickExtra = 14 + Math.abs(seed) * 18;
    const color = last ? "#3ddc84" : isUp ? "#3ddc84" : "#ff5a3b";

    // body
    const bodyTop = last ? baseY - bodyH : baseY - bodyH + (isUp ? 0 : -seed2 * 30);
    ctx.fillStyle = color;
    ctx.globalAlpha = i === visible && reveal < 1 ? (reveal * N) % 1 : 1;
    ctx.fillRect(cx - colW * 0.32, bodyTop, colW * 0.64, bodyH);
    // wick
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, bodyTop - wickExtra);
    ctx.lineTo(cx, bodyTop + bodyH + wickExtra);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // big price (bottom-left)
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 88px Inter, system-ui, sans-serif";
  ctx.fillText("$61,247.18", 60, SCREEN_H - 100);

  // pct (bottom-right)
  ctx.fillStyle = "#3ddc84";
  ctx.font = "700 32px ui-monospace, Menlo, monospace";
  const pct = "+2.42%";
  const pctW = ctx.measureText(pct).width;
  ctx.fillText(pct, SCREEN_W - 60 - pctW, SCREEN_H - 100);

  // strip
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "500 22px ui-monospace, Menlo, monospace";
  ctx.fillText("8.4M open  ·  5x lev  ·  live", 60, SCREEN_H - 50);
};

// Painter 4 — Pumpfun. Hot pink/black gradient, oversized memecoin glyph.
const drawPumpfun: Painter = (ctx, localFrame) => {
  // radial gradient bg
  const bg = ctx.createRadialGradient(120, 80, 40, 640, 400, 1100);
  bg.addColorStop(0, "#2a0820");
  bg.addColorStop(1, "#0a0a10");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // wordmark
  ctx.fillStyle = "#ff67c5";
  ctx.font = "700 22px ui-monospace, Menlo, monospace";
  ctx.fillText("PUMP.FUN", 60, 70);

  // memecoin glyph — circle with gradient fill, $WOJAK across
  const cx = SCREEN_W / 2;
  const cy = 360;
  const r = 200 + Math.sin(localFrame * 0.18) * 4; // tiny pulse so it never feels frozen

  const glyphGrad = ctx.createRadialGradient(cx - 60, cy - 60, 30, cx, cy, r);
  glyphGrad.addColorStop(0, "#ff67c5");
  glyphGrad.addColorStop(1, "#ffd400");
  ctx.fillStyle = glyphGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // ticker baked across the glyph
  ctx.fillStyle = "#1a0508";
  ctx.font = "800 56px Inter, system-ui, sans-serif";
  const ticker = "$WOJAK";
  const tw = ctx.measureText(ticker).width;
  ctx.fillText(ticker, cx - tw / 2, cy + 20);

  // launch caption
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 56px Inter, system-ui, sans-serif";
  const caption = "$WOJAK launched 3m ago";
  const cw = ctx.measureText(caption).width;
  ctx.fillText(caption, cx - cw / 2, SCREEN_H - 140);

  // stats
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "500 22px ui-monospace, Menlo, monospace";
  const stat = "14 holders  ·  0.4 SOL bonded  ·  $239K mc";
  const sw = ctx.measureText(stat).width;
  ctx.fillText(stat, cx - sw / 2, SCREEN_H - 60);
};

const PAINTERS: Painter[] = [drawPolymarket, drawNyse, drawCrypto, drawPumpfun];

// Paint the current beat plus, during the trailing fade window, the next
// beat on top at growing alpha. Single canvas, two paints, globalAlpha.
function paintScreen(ctx: CanvasRenderingContext2D, frame: number) {
  // clamp frame inside the four-beat range
  const f = Math.min(frame, TOTAL_BEATS * BEAT_FRAMES - 1);
  const beat = Math.floor(f / BEAT_FRAMES);
  const localFrame = f - beat * BEAT_FRAMES;

  const transitionStart = BEAT_FRAMES - FADE_FRAMES;
  const inTransition = localFrame >= transitionStart && beat < TOTAL_BEATS - 1;

  if (inTransition) {
    const t = (localFrame - transitionStart) / FADE_FRAMES;
    // current — fading out
    ctx.globalAlpha = 1;
    PAINTERS[beat](ctx, localFrame);
    // next — coming in
    ctx.globalAlpha = t;
    PAINTERS[beat + 1](ctx, 0);
    ctx.globalAlpha = 1;
  } else {
    ctx.globalAlpha = 1;
    PAINTERS[beat](ctx, localFrame);
  }
}

// ── Camera + macbook pose — slow creep-in, no dolly ───────────────

const CAM_POS_START = new THREE.Vector3(3.031, 4.096, -6.18);
const CAM_POS_END = new THREE.Vector3(3.031, 4.096, -5.55);
const CAM_TARGET = new THREE.Vector3(3.001, 2.78, 0.829);

const LID_OPEN = new THREE.Quaternion(-0.78333, 0, 0, 0.62161);
const BEVELS_POS = new THREE.Vector3(-0.00012, 0.00824, -0.10401);
const BEVELS_SCALE = new THREE.Vector3(0.27471, 0.27471, 0.27471);

// power2.inOut equivalent: y = t<0.5 ? 2t² : 1 − pow(−2t+2, 2)/2
function easeInOut(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2;
}

const MacbookScene: React.FC<{ frame: number }> = ({ frame }) => {
  const { camera } = useThree();
  const gltf = useGLTF(MODEL_URL);

  const root = useMemo(() => {
    const cloned = cloneSkeleton(gltf.scene) as THREE.Object3D;

    const iphone = cloned.getObjectByName("iphone");
    if (iphone) {
      iphone.traverse((child) => {
        const m = child as THREE.Mesh;
        if (m.isMesh) m.visible = false;
      });
    }

    const bevels = cloned.getObjectByName("Bevels_2");
    if (bevels) {
      bevels.position.copy(BEVELS_POS);
      bevels.quaternion.copy(LID_OPEN);
      bevels.scale.copy(BEVELS_SCALE);
    }

    return cloned;
  }, [gltf]);

  const screenMesh = useMemo(() => {
    const bevels = root.getObjectByName("Bevels_2");
    return bevels ? findMacbookScreenMesh(bevels) : null;
  }, [root]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  if (!canvasRef.current) {
    const c = document.createElement("canvas");
    c.width = SCREEN_W;
    c.height = SCREEN_H;
    const ctx0 = c.getContext("2d");
    if (ctx0) {
      ctx0.fillStyle = "#000";
      ctx0.fillRect(0, 0, SCREEN_W, SCREEN_H);
    }
    canvasRef.current = c;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    textureRef.current = tex;
  }

  useEffect(() => {
    if (!screenMesh || !textureRef.current) return;
    bindCanvasToScreen(screenMesh, textureRef.current);
  }, [screenMesh]);

  // Repaint each frame.
  const ctx = canvasRef.current.getContext("2d");
  if (ctx) {
    paintScreen(ctx, frame);
    if (textureRef.current) textureRef.current.needsUpdate = true;
  }

  // No spin, no drift. Whisper of breath only — ±0.3% scale, slow.
  const breath = 1 + Math.sin(frame * 0.06) * 0.003;
  root.scale.set(breath, breath, breath);
  root.rotation.y = 0;
  root.position.x = 0;

  // Camera creep — start → end across the full scene, eased.
  const camT = easeInOut(frame / (SCENE_SECONDS * FPS));
  const camZ = CAM_POS_START.z + (CAM_POS_END.z - CAM_POS_START.z) * camT;
  const cam = camera as THREE.PerspectiveCamera;
  cam.position.set(CAM_POS_START.x, CAM_POS_START.y, camZ);
  cam.lookAt(CAM_TARGET);
  cam.fov = 50;
  cam.updateProjectionMatrix();

  return (
    <>
      <primitive object={root} />
      <Environment preset="studio" environmentIntensity={1.6} />
      <ambientLight intensity={0.3} />
      {/* Key — strong, upper-front-left */}
      <directionalLight position={[5, 8, -5]} intensity={2.6} castShadow />
      {/* Fill — soft, cool */}
      <directionalLight position={[-4, 4, 3]} intensity={0.6} color="#c0d0e8" />
      {/* Rim — separates body from backdrop */}
      <directionalLight position={[0, 5, 8]} intensity={1.4} color="#ffffff" />
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.4}
        scale={14}
        blur={1.6}
        far={5}
      />
    </>
  );
};

// ── Composition ────────────────────────────────────────────────────

export const AntiCheatReassure: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Beat 1: "Trade all the same assets." — snap in at 0s.
  const t1Opacity = interpolate(
    frame,
    [0, toFrames(0.18)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const t1Y = interpolate(
    frame,
    [0, toFrames(0.18)],
    [14, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Beat 2a: ". . . but" — snap in at 2.0s. The setup.
  const local2 = frame - SECOND_LINE_AT;
  const t2Opacity = interpolate(
    local2,
    [0, toFrames(0.18)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const t2Y = interpolate(
    local2,
    [0, toFrames(0.18)],
    [14, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Beat 2b: "shielded" — lands two beats later. The knife.
  const local3 = frame - SHIELDED_AT;
  const t3Opacity = interpolate(
    local3,
    [0, toFrames(0.22)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const t3Y = interpolate(
    local3,
    [0, toFrames(0.22)],
    [42, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const punch = spring({
    frame: local3 - toFrames(0.05),
    fps,
    config: { damping: 9, stiffness: 220, mass: 0.55 },
  });
  const punchScale =
    1 + Math.sin(Math.min(1, Math.max(0, punch)) * Math.PI) * 0.05;

  // Shield watermark joins the knife, not the setup.
  const shield = spring({
    frame: local3,
    fps,
    config: { damping: 26, stiffness: 100, mass: 1 },
  });
  const shieldOpacity = interpolate(shield, [0, 1], [0, 0.06]);
  const shieldScale = interpolate(shield, [0, 1], [0.85, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        fontFamily: font,
        overflow: "hidden",
      }}
    >
      <Backdrop />

      {/* Macbook hero — pushed down so its centre lands ~62% from the top.
          The ThreeCanvas itself is full-bleed; the translateY shifts the
          rendered scene downward in screen space without changing the
          camera/target. */}
      <AbsoluteFill
        style={{
          zIndex: 0,
          transform: "translateY(12%)",
        }}
      >
        <ThreeCanvas
          width={W}
          height={H}
          camera={{
            fov: 50,
            near: 0.5,
            far: 1000,
            position: [CAM_POS_START.x, CAM_POS_START.y, CAM_POS_START.z],
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
            <MacbookScene frame={frame} />
          </React.Suspense>
        </ThreeCanvas>
      </AbsoluteFill>

      {/* Shield watermark — sits with the headlines. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: shieldOpacity,
          transform: `scale(${shieldScale})`,
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        <ShieldGlyph />
      </div>

      {/* Headline ABOVE the laptop. Top of frame, centred. */}
      <div
        style={{
          position: "absolute",
          top: "8%",
          left: 0,
          right: 0,
          textAlign: "center",
          padding: "0 96px",
          zIndex: 3,
          fontFamily: font,
          fontSize: 96,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          color: colors.fg,
          lineHeight: 0.95,
          textShadow: "0 4px 28px rgba(0,0,0,0.65)",
          opacity: t1Opacity,
          transform: `translateY(${t1Y}px)`,
        }}
      >
        Trade all the same assets
      </div>

      {/* "...but" — left of the laptop, centred to its screen height (~62% top). */}
      <div
        style={{
          position: "absolute",
          top: "62%",
          left: 0,
          width: "50%",
          paddingRight: 80,
          textAlign: "right",
          transform: `translateY(calc(-50% + ${t2Y}px))`,
          fontFamily: font,
          fontSize: 96,
          fontWeight: 700,
          letterSpacing: "-0.025em",
          lineHeight: 1,
          color: colors.fg,
          opacity: t2Opacity,
          zIndex: 3,
        }}
      >
        <span style={{ color: colors.dim, opacity: 0.7 }}>
          .&nbsp;.&nbsp;.
        </span>{" "}
        but
      </div>

      {/* "shielded" — anchored to the left, oversized so it spills past the
          right edge. The word is bigger than the frame on purpose: the eye
          can't take it in at once, which is the point. */}
      <div
        style={{
          position: "absolute",
          top: "58%",
          left: 0,
          width: "auto",
          paddingLeft: 60,
          textAlign: "left",
          transform: `translateY(calc(-50% + ${t3Y}px))`,
          fontFamily: font,
          fontSize: 480,
          fontWeight: 900,
          letterSpacing: "-0.05em",
          lineHeight: 0.85,
          color: GREEN,
          opacity: t3Opacity,
          zIndex: 5,
          whiteSpace: "nowrap",
          textShadow: "0 6px 36px rgba(0,0,0,0.7)",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            display: "inline-block",
            transform: `scale(${punchScale})`,
            transformOrigin: "left center",
          }}
        >
          shielded
        </span>
      </div>

      {/* Vignette stays on top of everything. */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          zIndex: 4,
          background:
            "radial-gradient(circle at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

const ShieldGlyph: React.FC = () => (
  <svg
    width={900}
    height={1000}
    viewBox="0 0 100 110"
    preserveAspectRatio="xMidYMid meet"
  >
    <path
      d="M50 4 L92 18 L92 56 C92 82 72 99 50 106 C28 99 8 82 8 56 L8 18 Z"
      fill="none"
      stroke="#3ddc84"
      strokeWidth={2}
      strokeLinejoin="round"
    />
    <path
      d="M30 56 L46 72 L72 40"
      fill="none"
      stroke="#3ddc84"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ─── Backdrop with quiet ambient pulse ────────────────────────────────────────

const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 0.10 + Math.sin((frame / 45) * Math.PI * 2) * 0.04;

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0d0d10 0%, #050507 100%)",
        opacity: 1,
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, opacity: pulse + 0.2 }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            x2={W}
            y1={(i + 1) * (H / 13)}
            y2={(i + 1) * (H / 13)}
            stroke="#16161b"
            strokeWidth={1}
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

export const antiCheatReassureMeta = {
  id: "AntiCheatReassure",
  component: AntiCheatReassure,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};

// silence unused-import warning when monoFont reserved for future reuse
void monoFont;
