// Rainbows-Compare intro — one laptop, three answers, the rainbows reveal.
//
// Text placement is copied verbatim from Rainbows-Flashblocks Scene 01,
// 02, 03 — same positions, same staggers, same per-beat durations
// (48 / 48 / 84 frames at 24 fps). Beat 2's text was originally blue
// on a light gradient; here it is white over the lofi cloud broll for
// legibility.
//
// One laptop sits centred behind the text and stays still through
// beats 1 and 2. At the rainbows reveal — frames 132 to 156, exactly
// when the title "you trade rainbows." slides in — it performs a
// single 360° Y-axis spin, eased like an Apple keynote, and lands
// forward as the title settles. That is its only motion.

import React, { useEffect, useMemo, useRef } from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useGLTF, ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
// @ts-ignore — SkeletonUtils types are not bundled
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { loadFont } from "@remotion/google-fonts/Inter";
import { LofiDots } from "../../endcard/LofiDots";
import { useGsapProxy } from "../standrew/gsapUtils";

const { fontFamily } = loadFont("normal", {
  subsets: ["latin"],
  weights: ["400", "700", "800"],
});

const MODEL_URL = staticFile("models/tabletop_macbook_iphone.glb");
useGLTF.preload(MODEL_URL);

// ── Screen mesh + per-beat canvas painters ─────────────────────────
//
// The macbook screen is a flat mesh with a baseColorMap (the baked
// wallpaper). Worldcoin2Composition proved the path: find the first
// textured mesh inside the lid, clone its material, swap map +
// emissiveMap to a CanvasTexture. Drawing is done per-frame in 2D —
// bold, iconic shapes that read at the screen's small in-frame size,
// not detailed charts.

const SCREEN_W = 1280;
const SCREEN_H = 800;

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

// Beat 1 — perps. Black bg, red descending zigzag, big red P&L.
function drawBeat1Perps(ctx: CanvasRenderingContext2D, localFrame: number) {
  ctx.fillStyle = "#0a0a10";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // grid
  ctx.strokeStyle = "rgba(255,80,90,0.06)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    const y = (i / 8) * SCREEN_H;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SCREEN_W, y);
    ctx.stroke();
  }

  // descending line — deterministic seed so it doesn't jitter per frame
  ctx.strokeStyle = "#ff3344";
  ctx.lineWidth = 6;
  ctx.beginPath();
  let x = 60;
  let y = 220;
  ctx.moveTo(x, y);
  const seeds = [0.62, 0.18, 0.74, 0.31, 0.55, 0.12, 0.83, 0.27, 0.49, 0.71, 0.36, 0.58, 0.91, 0.25, 0.42, 0.68, 0.15, 0.79, 0.33, 0.56];
  for (let i = 0; i < seeds.length; i++) {
    x += (SCREEN_W - 120) / seeds.length;
    const drift = (seeds[i] - 0.45) * 80;
    y += 22 + drift;
    ctx.lineTo(x, y);
  }
  ctx.stroke();

  // glow under the line
  ctx.fillStyle = "rgba(255,40,60,0.08)";
  ctx.beginPath();
  ctx.moveTo(60, SCREEN_H);
  ctx.lineTo(60, 220);
  let gx = 60;
  let gy = 220;
  for (let i = 0; i < seeds.length; i++) {
    gx += (SCREEN_W - 120) / seeds.length;
    const drift = (seeds[i] - 0.45) * 80;
    gy += 22 + drift;
    ctx.lineTo(gx, gy);
  }
  ctx.lineTo(gx, SCREEN_H);
  ctx.closePath();
  ctx.fill();

  // header
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "bold 44px ui-monospace, Menlo, monospace";
  ctx.fillText("BTC-PERP · 25× LONG", 60, 80);

  // big P&L — animates a touch with localFrame so it feels live
  const drift = Math.sin(localFrame * 0.15) * 0.3;
  ctx.fillStyle = "#ff3344";
  ctx.font = "900 110px ui-monospace, Menlo, monospace";
  ctx.fillText(`-${(43.21 + drift).toFixed(2)}%`, 60, SCREEN_H - 80);
}

// Beat 2 — options. Dark blue/green bg, IV smile curve, call payoff.
function drawBeat2Options(ctx: CanvasRenderingContext2D, localFrame: number) {
  // gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
  grad.addColorStop(0, "#08151a");
  grad.addColorStop(1, "#03070a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // grid
  ctx.strokeStyle = "rgba(80,200,180,0.07)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const y = (i / 6) * SCREEN_H;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SCREEN_W, y);
    ctx.stroke();
  }

  // IV smile — quadratic bowl
  ctx.strokeStyle = "#4cd9b8";
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let px = 60; px <= SCREEN_W - 60; px += 6) {
    const t = (px - 60) / (SCREEN_W - 120);
    const u = (t - 0.5) * 2; // -1..1
    const v = u * u; // 0..1
    const y = 460 - v * 220;
    if (px === 60) ctx.moveTo(px, y);
    else ctx.lineTo(px, y);
  }
  ctx.stroke();

  // call payoff — hockey stick
  ctx.strokeStyle = "#88ff66";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(60, 660);
  ctx.lineTo(640, 660);
  ctx.lineTo(SCREEN_W - 60, 240);
  ctx.stroke();

  // strike marker — pulses with localFrame
  const pulse = 0.5 + 0.5 * Math.sin(localFrame * 0.3);
  ctx.fillStyle = `rgba(255,221,0,${0.4 + 0.4 * pulse})`;
  ctx.beginPath();
  ctx.arc(640, 660, 12 + pulse * 4, 0, Math.PI * 2);
  ctx.fill();

  // header
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "bold 44px ui-monospace, Menlo, monospace";
  ctx.fillText("BTC 100K CALL · IV 68%", 60, 80);

  // bottom label
  ctx.fillStyle = "#88ff66";
  ctx.font = "900 96px ui-monospace, Menlo, monospace";
  ctx.fillText("+∞ UPSIDE", 60, SCREEN_H - 80);
}

// Beat 3 — rainbows. Six chromatic bands + a market headline.
function drawBeat3Rainbows(ctx: CanvasRenderingContext2D, localFrame: number) {
  ctx.fillStyle = "#06060a";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // six rainbow horizontal bands across the upper screen
  const bands = ["#ff2855", "#ff8800", "#ffd400", "#4cd964", "#00aaff", "#6633ff"];
  const bandH = 60;
  const totalH = bands.length * bandH;
  const startY = 110;
  // sweep — each band fades in slightly offset by localFrame
  for (let i = 0; i < bands.length; i++) {
    const reveal = Math.max(0, Math.min(1, (localFrame - i * 2) / 14));
    const eased = reveal * reveal * (3 - 2 * reveal);
    const w = (SCREEN_W - 120) * eased;
    ctx.fillStyle = bands[i];
    ctx.fillRect(60, startY + i * bandH, w, bandH - 6);
  }

  // header
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "bold 40px ui-monospace, Menlo, monospace";
  ctx.fillText("RAINBOWS · BTC PRICE BAND", 60, 80);

  // market question
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 78px Inter, system-ui, sans-serif";
  ctx.fillText("Where will BTC", 60, startY + totalH + 90);
  ctx.fillText("close on Friday?", 60, startY + totalH + 175);

  // tickers — six odds across, faintly pulsing
  ctx.font = "bold 32px ui-monospace, Menlo, monospace";
  for (let i = 0; i < bands.length; i++) {
    const pulse = 0.7 + 0.3 * Math.sin(localFrame * 0.2 + i);
    ctx.fillStyle = bands[i];
    ctx.globalAlpha = pulse;
    const labels = ["<90k", "90-95", "95-100", "100-105", "105-110", ">110k"];
    const colW = (SCREEN_W - 120) / bands.length;
    ctx.fillText(labels[i], 70 + i * colW, SCREEN_H - 40);
  }
  ctx.globalAlpha = 1;
}

// ── Composition timing ──────────────────────────────────────────────

const W = 1920;
const H = 1080;
const FPS = 24;
const BEAT1 = 48;
const BEAT2 = 48;
const BEAT3 = 84;
const TOTAL_FRAMES = BEAT1 + BEAT2 + BEAT3; // 180

// Spin window — the rainbows reveal moment. Frames 132 → 156 is the
// title slide-in inside Scene03 (1.5s → 2.6s of beat 3 at 24fps).
const SPIN_START = 132;
const SPIN_END = 156;
const SPIN_FRAMES = SPIN_END - SPIN_START;

// Negative-space drift — laptop slides right during the title slide-in
// so the left-aligned title gets clean horizontal space. Symmetry on
// the setups, asymmetry on the punchline.
const NS_START = 134;
const NS_END = 156;
const NS_SHIFT = 0.9;

// Chromatic flash — single brief burst at the title's first slide-in
// frame. Six frames of radial chroma, opacity eases out.
const FLASH_START = 134;
const FLASH_DUR = 6;

// ── Camera & macbook pose ──────────────────────────────────────────

// Worldcoin2 hero pose, pulled back ~0.8 units to give the text room.
const CAM_POS_START = new THREE.Vector3(3.031, 4.096, -7.0);
const CAM_POS_END = new THREE.Vector3(3.031, 4.096, -6.18); // Worldcoin2 baseline
const CAM_TARGET = new THREE.Vector3(3.001, 2.78, 0.829);

const LID_OPEN = new THREE.Quaternion(-0.78333, 0, 0, 0.62161);
const BEVELS_POS = new THREE.Vector3(-0.00012, 0.00824, -0.10401);
const BEVELS_SCALE = new THREE.Vector3(0.27471, 0.27471, 0.27471);

// ── Macbook scene — single laptop ──────────────────────────────────

const MacbookSceneOne: React.FC<{ frame: number }> = ({ frame }) => {
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

  // Find the screen mesh inside the lid — once.
  const screenMesh = useMemo(() => {
    const bevels = root.getObjectByName("Bevels_2");
    return bevels ? findMacbookScreenMesh(bevels) : null;
  }, [root]);

  // Canvas + texture — created once, persisted via refs.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  if (!canvasRef.current) {
    const c = document.createElement("canvas");
    c.width = SCREEN_W;
    c.height = SCREEN_H;
    // Paint black so the first frame never leaks the baked GLB wallpaper.
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

  // Bind canvas texture to the screen material once mesh is found.
  useEffect(() => {
    if (!screenMesh || !textureRef.current) return;
    bindCanvasToScreen(screenMesh, textureRef.current);
  }, [screenMesh]);

  // Per-frame: pick the beat, paint the canvas, mark texture dirty.
  const ctx = canvasRef.current.getContext("2d");
  if (ctx) {
    if (frame < BEAT1) {
      drawBeat1Perps(ctx, frame);
    } else if (frame < BEAT1 + BEAT2) {
      drawBeat2Options(ctx, frame - BEAT1);
    } else {
      drawBeat3Rainbows(ctx, frame - (BEAT1 + BEAT2));
    }
    if (textureRef.current) textureRef.current.needsUpdate = true;
  }

  // Single 360° spin in the rainbows window. Ease-in-out cubic — slow
  // start, fast middle, slow finish. Outside the window: yaw 0, fully
  // forward. The lid stays open at LID_OPEN throughout.
  let yaw = 0;
  if (frame >= SPIN_START && frame < SPIN_END) {
    const t = (frame - SPIN_START) / SPIN_FRAMES;
    const eased =
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    yaw = eased * Math.PI * 2;
  }
  root.rotation.y = yaw;

  // Negative space at the punchline — drift right during phase 2 so
  // the left-aligned title gets clean horizontal space.
  let xShift = 0;
  if (frame >= NS_START) {
    const t = Math.min(1, (frame - NS_START) / (NS_END - NS_START));
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    xShift = eased * NS_SHIFT;
  }
  root.position.x = xShift;

  // Whisper of breath so the laptop is never dead. ±0.3% scale, slow.
  const breath = 1 + Math.sin(frame * 0.06) * 0.003;
  root.scale.set(breath, breath, breath);

  // Slow camera push-in — Apple keynote dolly. Linear over the whole
  // 7.5s. Subtle enough to feel like air moving rather than a move.
  const t = interpolate(frame, [0, TOTAL_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cam = camera as THREE.PerspectiveCamera;
  cam.position.set(
    CAM_POS_START.x + (CAM_POS_END.x - CAM_POS_START.x) * t,
    CAM_POS_START.y + (CAM_POS_END.y - CAM_POS_START.y) * t,
    CAM_POS_START.z + (CAM_POS_END.z - CAM_POS_START.z) * t,
  );
  cam.lookAt(CAM_TARGET);
  cam.fov = 50;
  cam.updateProjectionMatrix();

  return (
    <>
      <primitive object={root} />
      <Environment preset="studio" environmentIntensity={1.6} />
      <ambientLight intensity={0.3} />
      {/* Key light — strong, upper-front-left */}
      <directionalLight position={[5, 8, -5]} intensity={2.6} castShadow />
      {/* Fill — soft, cool, upper-right */}
      <directionalLight position={[-4, 4, 3]} intensity={0.6} color="#c0d0e8" />
      {/* Rim — separates body from broll behind */}
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

// ── Text layers — copied verbatim from ScenesA, white throughout ───

const baseText: React.CSSProperties = {
  fontFamily,
  fontWeight: 800,
  fontStyle: "italic",
  lineHeight: 1.15,
  display: "inline-block",
  color: "#fff",
  textShadow: "0 6px 28px rgba(0,0,0,0.65)",
};

// Softer weight for beats 1 and 2 — these are the boring, familiar
// answers. They should not scream as loudly as the punchline.
const softText: React.CSSProperties = {
  ...baseText,
  fontWeight: 700,
};

// Chromatic gradient for the rainbows title. background-clip:text
// requires transparent fill; drop-shadow filter replaces text-shadow,
// which doesn't compose with gradient text.
const rainbowText: React.CSSProperties = {
  ...baseText,
  letterSpacing: "-0.01em",
  background:
    "linear-gradient(90deg, #ff2855 0%, #ff8800 18%, #ffd400 35%, #4cd964 55%, #00aaff 75%, #6633ff 100%)",
  backgroundClip: "text",
  WebkitBackgroundClip: "text",
  color: "transparent",
  WebkitTextFillColor: "transparent",
  textShadow: "none",
  filter: "drop-shadow(0 6px 28px rgba(0,0,0,0.65))",
};

const center: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  display: "flex",
  gap: 36,
  justifyContent: "center",
  whiteSpace: "nowrap",
};

// Beat 1 — Scene01_Intro logic. Centered phrase A, centered phrase B.
const SCENE01_PHRASE_A = ["When", "you", "want", "leverage"] as const;
const SCENE01_PHRASE_B = ["you", "trade", "perps."] as const;

function buildScene01Proxies() {
  const init: Record<string, Record<string, number>> = {
    phraseA: { opacity: 1 },
    phraseB: { opacity: 0 },
  };
  SCENE01_PHRASE_A.forEach((_, i) => {
    init[`a_${i}`] = { opacity: i === 0 ? 1 : 0, y: i === 0 ? 0 : 15 };
  });
  SCENE01_PHRASE_B.forEach((_, i) => {
    init[`b_${i}`] = { opacity: 0, y: 15 };
  });
  return init;
}
const scene01Init = buildScene01Proxies();

const TextBeat1: React.FC = () => {
  const s = useGsapProxy((tl, p) => {
    SCENE01_PHRASE_A.forEach((_, i) => {
      if (i === 0) return;
      tl.to(
        p[`a_${i}`],
        { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" },
        0.15 + i * 0.12,
      );
    });
    tl.to(p.phraseA, { opacity: 0, duration: 0.18, ease: "power2.in" }, 0.85);
    tl.to(p.phraseB, { opacity: 1, duration: 0.15, ease: "power2.out" }, 0.95);
    SCENE01_PHRASE_B.forEach((_, i) => {
      tl.to(
        p[`b_${i}`],
        { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" },
        0.95 + i * 0.18,
      );
    });
  }, scene01Init);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ ...center, opacity: s.phraseA.opacity }}>
        {SCENE01_PHRASE_A.map((word, i) => {
          const proxy = s[`a_${i}`];
          return (
            <span
              key={i}
              style={{
                ...softText,
                fontSize: 160,
                opacity: proxy.opacity,
                transform: `translateY(${proxy.y}px)`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
      <div style={{ ...center, opacity: s.phraseB.opacity }}>
        {SCENE01_PHRASE_B.map((word, i) => {
          const proxy = s[`b_${i}`];
          return (
            <span
              key={i}
              style={{
                ...softText,
                fontSize: 200,
                opacity: proxy.opacity,
                transform: `translateY(${proxy.y}px)`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// Beat 2 — Scene02_Numbers logic. Phrase A left-aligned, phrase B
// centered huge. White instead of the original blue.
const SCENE02_PHRASE_A = [
  "When",
  "you",
  "want",
  "volatility",
  "exposure",
] as const;
const SCENE02_PHRASE_B = ["you", "trade", "options."] as const;

function buildScene02Proxies() {
  const init: Record<string, Record<string, number>> = {
    phraseA: { opacity: 1 },
    phraseB: { opacity: 0 },
  };
  SCENE02_PHRASE_A.forEach((_, i) => {
    init[`a_${i}`] = { opacity: 0, y: 15 };
  });
  SCENE02_PHRASE_B.forEach((_, i) => {
    init[`b_${i}`] = { opacity: 0, y: 15 };
  });
  return init;
}
const scene02Init = buildScene02Proxies();

const TextBeat2: React.FC = () => {
  const s = useGsapProxy((tl, p) => {
    SCENE02_PHRASE_A.forEach((_, i) => {
      tl.to(
        p[`a_${i}`],
        { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" },
        i * 0.1,
      );
    });
    tl.to(p.phraseA, { opacity: 0, duration: 0.18, ease: "power2.in" }, 0.85);
    tl.to(p.phraseB, { opacity: 1, duration: 0.15, ease: "power2.out" }, 0.95);
    SCENE02_PHRASE_B.forEach((_, i) => {
      tl.to(
        p[`b_${i}`],
        { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" },
        0.95 + i * 0.16,
      );
    });
  }, scene02Init);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Phrase A — left-aligned (Scene02 layout, white text) */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "8%",
          transform: "translateY(-50%)",
          maxWidth: "84%",
          display: "flex",
          flexWrap: "wrap",
          gap: "0 22px",
          opacity: s.phraseA.opacity,
        }}
      >
        {SCENE02_PHRASE_A.map((word, i) => {
          const proxy = s[`a_${i}`];
          return (
            <span
              key={i}
              style={{
                ...softText,
                fontSize: 145,
                opacity: proxy.opacity,
                transform: `translateY(${proxy.y}px)`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>

      {/* Phrase B — centered, huge (Scene02 punch) */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0 28px",
          opacity: s.phraseB.opacity,
        }}
      >
        {SCENE02_PHRASE_B.map((word, i) => {
          const proxy = s[`b_${i}`];
          return (
            <span
              key={i}
              style={{
                ...softText,
                fontSize: 250,
                opacity: proxy.opacity,
                transform: `translateY(${proxy.y}px)`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// Beat 3 — Scene03_DarkGrid logic. Phase 1: single-word flashes
// centered. Phase 2: title "you trade rainbows." slides left-aligned.
const TextBeat3: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Phase 1 — word flashes
      tl.to(p.when, { opacity: 0, duration: 0.08, ease: "power2.in" }, 0.35);
      tl.to(
        p.youFlash,
        { opacity: 1, y: 0, duration: 0.1, ease: "power2.out" },
        0.35,
      );
      tl.to(
        p.youFlash,
        { opacity: 0, duration: 0.08, ease: "power2.in" },
        0.7,
      );
      tl.to(
        p.want,
        { opacity: 1, y: 0, duration: 0.1, ease: "power2.out" },
        0.7,
      );
      tl.to(p.want, { opacity: 0, duration: 0.08, ease: "power2.in" }, 1.0);
      tl.to(
        p.better,
        { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" },
        1.0,
      );

      // Phase 1 cross-fades out
      tl.to(p.phase1, { opacity: 0, duration: 0.15, ease: "power2.in" }, 1.5);

      // Phase 2 — title slides in from the right
      tl.to(p.phase2, { opacity: 1, duration: 0.15, ease: "power2.out" }, 1.6);
      tl.to(p.title, { x: 0, duration: 0.4, ease: "power2.out" }, 1.6);
    },
    {
      phase1: { opacity: 1 },
      when: { opacity: 1, y: 0 },
      youFlash: { opacity: 0, y: 15 },
      want: { opacity: 0, y: 15 },
      better: { opacity: 0, y: 15 },
      phase2: { opacity: 0 },
      title: { x: 50 },
    },
  );

  const flashSpan = (
    text: string,
    opacity: number,
    y: number,
    fontSize: number,
  ) => (
    <span
      style={{
        ...baseText,
        fontStyle: "normal",
        letterSpacing: "-0.02em",
        position: "absolute",
        left: "50%",
        transform: `translate(-50%, ${y}px)`,
        fontSize,
        opacity,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Phase 1 — single-word flashes, all sharing one centered slot */}
      <div style={{ ...center, opacity: s.phase1.opacity }}>
        {s.when.opacity > 0.01 && flashSpan("When", s.when.opacity, s.when.y, 145)}
        {s.youFlash.opacity > 0.01 &&
          flashSpan("you", s.youFlash.opacity, s.youFlash.y, 145)}
        {s.want.opacity > 0.01 &&
          flashSpan("want", s.want.opacity, s.want.y, 145)}
        {s.better.opacity > 0.01 &&
          flashSpan("better odds", s.better.opacity, s.better.y, 175)}
      </div>

      {/* Phase 2 — title card. The word "rainbows" gets the chromatic
          gradient; "you trade " stays white so the punch lands on the
          last word. */}
      <div
        style={{
          position: "absolute",
          top: "55%",
          left: "8%",
          transform: `translateX(${s.title.x}px)`,
          opacity: s.phase2.opacity,
          maxWidth: "84%",
          display: "flex",
          alignItems: "baseline",
          gap: "0.18em",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ ...baseText, fontSize: 200 }}>you trade</span>
        <span style={{ ...rainbowText, fontSize: 200 }}>rainbows.</span>
      </div>
    </AbsoluteFill>
  );
};

// ── Chromatic flash + broll breath ─────────────────────────────────

// Single radial chroma burst at the title slide-in. Six frames. The
// reader registers it without naming it.
const ChromaticFlash: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < FLASH_START || frame >= FLASH_START + FLASH_DUR) return null;
  const t = (frame - FLASH_START) / FLASH_DUR;
  const opacity = Math.pow(1 - t, 2);
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        mixBlendMode: "screen",
        opacity,
        background:
          "radial-gradient(ellipse at center, rgba(255,255,255,0.95) 0%, rgba(255,100,180,0.55) 25%, rgba(255,200,80,0.4) 45%, rgba(80,180,255,0.3) 70%, transparent 100%)",
      }}
    />
  );
};

// Subtle dip + blur within four frames of each beat boundary. The text
// changes feel like cuts, not crossfades. Subliminal — never below 0.85.
function brollBreathStyle(frame: number): React.CSSProperties {
  const dist = Math.min(Math.abs(frame - BEAT1), Math.abs(frame - (BEAT1 + BEAT2)));
  if (dist >= 4) return {};
  const t = dist / 4;
  const opacity = 0.85 + 0.15 * t;
  const blur = (1 - t) * 4;
  return { opacity, filter: `blur(${blur}px)` };
}

// ── Composition ────────────────────────────────────────────────────

export const RainbowsCompareIntro: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ width: W, height: H }}>
      {/* Lofi cloud broll — full colour, no chroma filter. Wrapped in a
          breathing div that dips opacity + blur briefly at each beat
          boundary so cuts register subliminally. */}
      <AbsoluteFill style={brollBreathStyle(frame)}>
        <LofiDots skipFadeIn />
      </AbsoluteFill>

      {/* Macbook hero — driven by global frame so the spin lands at the
          rainbows reveal regardless of the per-Sequence text timing. */}
      <AbsoluteFill>
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
            <MacbookSceneOne frame={frame} />
          </React.Suspense>
        </ThreeCanvas>
      </AbsoluteFill>

      {/* Text on top — three sequences, exact placements from
          Rainbows-Flashblocks Scene 01, 02, 03. Beat 2 white not blue. */}
      <Sequence from={0} durationInFrames={BEAT1} name="01 leverage / perps">
        <TextBeat1 />
      </Sequence>
      <Sequence
        from={BEAT1}
        durationInFrames={BEAT2}
        name="02 vol exposure / options"
      >
        <TextBeat2 />
      </Sequence>
      <Sequence
        from={BEAT1 + BEAT2}
        durationInFrames={BEAT3}
        name="03 better odds / rainbows"
      >
        <TextBeat3 />
      </Sequence>

      {/* Chromatic flash — single brief burst at title slide-in. */}
      <ChromaticFlash frame={frame} />
    </AbsoluteFill>
  );
};

export const rainbowsCompareIntroMeta = {
  id: "RainbowsCompareIntro",
  component: RainbowsCompareIntro,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: TOTAL_FRAMES,
};
