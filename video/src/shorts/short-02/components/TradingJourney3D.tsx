import React, { useMemo, useRef, useEffect, Suspense } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  staticFile,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree, useFrame, useLoader, extend } from "@react-three/fiber";
import { useGLTF, Text3D, Effects } from "@react-three/drei";
import { UnrealBloomPass } from "three-stdlib";

extend({ UnrealBloomPass });

declare module "@react-three/fiber" {
  interface ThreeElements {
    unrealBloomPass: any;
  }
}

import * as THREE from "three";
// @ts-ignore — SkeletonUtils types may not be bundled
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
// @ts-ignore — FBXLoader types may not be bundled
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { PHASE_SCREENS, getAllScreenImages, type ScreenEntry, type ScreenDef } from "../screenConfig";
import { CityEnvironment } from "./city/CityEnvironment";
import { mulberry32 } from "./city/cityConfig";
import { useQuality } from "../../../engine/quality";

// ---------------------------------------------------------------------------
// Phase config
// ---------------------------------------------------------------------------

export type ScenePhase =
  | "car-lot"
  | "forex-intro"
  | "forex"
  | "stocks-intro"
  | "stocks"
  | "bitcoin-intro"
  | "bitcoin"
  | "goldman"
  | "0dte"
  | "ambush"
  | "memecoins-solo"
  | "memecoins"
  | "polymarket"
  | "defeat"
  | "return"
  | "car-lot-final"
  | "car-departure";

interface PhaseConfig {
  accentColor: string;
  hasDesk: boolean;
  hasCar: boolean;
  protagonistAnim: string;
  protagonistRotation: number;
  protagonistPosition: [number, number, number];
  showOther: boolean;
  otherAnim: string;
  otherPosition: [number, number, number];
  otherRotation: number;
  showBigRobot: boolean;
  logoFile: string | null;
  logoText: string;
  primaryChart: "candlestick" | "line" | "orderbook";
  chartSeed: number;
}

const PROTAGONIST_COLOR = "#3B82F6";
const BIG_ROBOT_COLOR = "#1a3a6a";

const PHASE_CONFIG: Record<ScenePhase, PhaseConfig> = {
  "car-lot": {
    accentColor: "#f5c542",
    hasDesk: false,
    hasCar: true,
    protagonistAnim: "talking",
    protagonistRotation: -Math.PI * 0.6,     // model faces +Z; -0.6π → faces toward other char
    protagonistPosition: [0.1, 0, 0.3],      // shifted left, closer to other character
    showOther: true,
    otherAnim: "Idle",
    otherPosition: [-0.35, 0, 0.3],          // left side of car
    otherRotation: Math.PI * 0.55,           // +0.55π → faces +X (toward protagonist)
    showBigRobot: false,
    logoFile: null,
    logoText: "",
    primaryChart: "candlestick",
    chartSeed: 42,
  },
  "forex-intro": {
    // "He saw a forex trader" — hero behind trader watching, trader at desk typing
    accentColor: "#00ff41",
    hasDesk: true,
    hasCar: false,
    protagonistAnim: "weight-shift",
    protagonistRotation: Math.PI * 1.19,     // face trader, 20° clockwise from previous
    protagonistPosition: [0.5, 0, 1.5],      // behind trader, right side, visible in frame
    showOther: true,
    otherAnim: "Idle",
    otherPosition: [0.15, 0, 0.15],          // close to desk/screens
    otherRotation: Math.PI,                   // face screens (-Z)
    showBigRobot: false,
    logoFile: "shorts/short-02/logos/forex-screen.png",
    logoText: "FOREX",
    primaryChart: "line",
    chartSeed: 100,
  },
  forex: {
    accentColor: "#00ff41",
    hasDesk: true,
    hasCar: false,
    protagonistAnim: "weight-shift",
    protagonistRotation: Math.PI,
    protagonistPosition: [0.15, 0, 0.0],
    showOther: false,
    otherAnim: "Idle",
    otherPosition: [0, 0, 0],
    otherRotation: 0,
    showBigRobot: false,
    logoFile: "shorts/short-02/logos/forex-screen.png",
    logoText: "FOREX",
    primaryChart: "line",
    chartSeed: 100,
  },
  "stocks-intro": {
    accentColor: "#3B82F6",
    hasDesk: true,
    hasCar: false,
    protagonistAnim: "hands-forward-gesture",
    protagonistRotation: Math.PI * 0.85,
    protagonistPosition: [0.4, 0, 1.3],       // more to the right, visible in frame
    showOther: true,
    otherAnim: "Idle",
    otherPosition: [0.15, 0, 0.15],
    otherRotation: Math.PI,
    showBigRobot: false,
    logoFile: "shorts/short-02/logos/bloomberg-logo.png",
    logoText: "SPY",
    primaryChart: "candlestick",
    chartSeed: 200,
  },
  stocks: {
    accentColor: "#3B82F6",
    hasDesk: true,
    hasCar: false,
    protagonistAnim: "cards",
    protagonistRotation: Math.PI,
    protagonistPosition: [0.15, 0, 0.0],
    showOther: false,
    otherAnim: "Idle",
    otherPosition: [0, 0, 0],
    otherRotation: 0,
    showBigRobot: false,
    logoFile: "shorts/short-02/logos/bloomberg-logo.png",
    logoText: "SPY",
    primaryChart: "candlestick",
    chartSeed: 200,
  },
  "bitcoin-intro": {
    accentColor: "#f7931a",
    hasDesk: true,
    hasCar: false,
    protagonistAnim: "surprised",
    protagonistRotation: Math.PI * 0.85,
    protagonistPosition: [-0.3, 0, 1.3],
    showOther: true,
    otherAnim: "Idle",
    otherPosition: [0.0, 0, -0.05],           // much closer to trading station
    otherRotation: Math.PI,
    showBigRobot: false,
    logoFile: "shorts/short-02/logos/binance.png",
    logoText: "BINANCE",
    primaryChart: "candlestick",
    chartSeed: 300,
  },
  bitcoin: {
    accentColor: "#f7931a",
    hasDesk: true,
    hasCar: false,
    protagonistAnim: "victory",
    protagonistRotation: Math.PI,
    protagonistPosition: [0.15, 0, 0.0],
    showOther: false,
    otherAnim: "Idle",
    otherPosition: [0, 0, 0],
    otherRotation: 0,
    showBigRobot: false,
    logoFile: "shorts/short-02/logos/binance.png",
    logoText: "BINANCE",
    primaryChart: "candlestick",
    chartSeed: 300,
  },
  goldman: {
    accentColor: "#4a7ab0",
    hasDesk: true,
    hasCar: false,
    protagonistAnim: "surprised",
    protagonistRotation: Math.PI + 0.4,
    protagonistPosition: [0.4, 0, 0.5],
    showOther: false,
    otherAnim: "Idle",
    otherPosition: [0, 0, 0],
    otherRotation: 0,
    showBigRobot: true,
    logoFile: "shorts/short-02/logos/goldman-sachs.png",
    logoText: "GOLDMAN SACHS",
    primaryChart: "orderbook",
    chartSeed: 400,
  },
  "0dte": {
    accentColor: "#ff3333",
    hasDesk: true,
    hasCar: false,
    protagonistAnim: "neck-stretching",
    protagonistRotation: Math.PI,
    protagonistPosition: [0.15, 0, 0.0],
    showOther: false,
    otherAnim: "Idle",
    otherPosition: [0, 0, 0],
    otherRotation: 0,
    showBigRobot: false,
    logoFile: "shorts/short-02/logos/robinhood-screen.png",
    logoText: "0DTE",
    primaryChart: "candlestick",
    chartSeed: 500,
  },
  ambush: {
    accentColor: "#cc0000",
    hasDesk: true,
    hasCar: false,
    protagonistAnim: "angry-point",
    protagonistRotation: Math.PI,
    protagonistPosition: [0.15, 0, 0.0],
    showOther: false,
    otherAnim: "Idle",
    otherPosition: [0, 0, 0],
    otherRotation: 0,
    showBigRobot: true,
    logoFile: "shorts/short-02/logos/goldman-sachs.png",
    logoText: "ROBINHOOD",
    primaryChart: "candlestick",
    chartSeed: 450,
  },
  "memecoins-solo": {
    accentColor: "#00ff41",
    hasDesk: true,
    hasCar: false,
    protagonistAnim: "laughing",
    protagonistRotation: Math.PI,
    protagonistPosition: [0.15, 0, 0.0],
    showOther: false,
    otherAnim: "Idle",
    otherPosition: [0, 0, 0],
    otherRotation: 0,
    showBigRobot: false,
    logoFile: "shorts/short-02/logos/pumpfun-screen.png",
    logoText: "PUMP.FUN",
    primaryChart: "line",
    chartSeed: 600,
  },
  memecoins: {
    accentColor: "#cc0000",
    hasDesk: true,
    hasCar: false,
    protagonistAnim: "yelling-while-standing",
    protagonistRotation: Math.PI,
    protagonistPosition: [0.15, 0, 0.0],
    showOther: false,
    otherAnim: "Idle",
    otherPosition: [0, 0, 0],
    otherRotation: 0,
    showBigRobot: true,
    logoFile: "shorts/short-02/logos/pumpfun-screen.png",
    logoText: "PUMP.FUN",
    primaryChart: "line",
    chartSeed: 600,
  },
  polymarket: {
    accentColor: "#7c3aed",
    hasDesk: true,
    hasCar: false,
    protagonistAnim: "thoughtful-head-nod",
    protagonistRotation: Math.PI,
    protagonistPosition: [0.15, 0, 0.0],
    showOther: false,
    otherAnim: "Idle",
    otherPosition: [0, 0, 0],
    otherRotation: 0,
    showBigRobot: false,
    logoFile: "shorts/short-02/logos/polymarket.png",
    logoText: "POLYMARKET",
    primaryChart: "line",
    chartSeed: 700,
  },
  defeat: {
    accentColor: "#666666",
    hasDesk: true,
    hasCar: false,
    protagonistAnim: "defeated",
    protagonistRotation: 0,
    protagonistPosition: [0, 0, 1.8],
    showOther: false,
    otherAnim: "Idle",
    otherPosition: [0, 0, 0],
    otherRotation: 0,
    showBigRobot: true,
    logoFile: "shorts/short-02/logos/citadel.png",
    logoText: "CITADEL",
    primaryChart: "candlestick",
    chartSeed: 800,
  },
  return: {
    accentColor: "#f5c542",
    hasDesk: false,
    hasCar: true,
    protagonistAnim: "walking",
    protagonistRotation: Math.PI,     // faces away from camera, toward car
    protagonistPosition: [0, 0, 3.5], // starts far, walks toward car door
    showOther: false,
    otherAnim: "Idle",
    otherPosition: [0, 0, 0],
    otherRotation: 0,
    showBigRobot: false,
    logoFile: null,
    logoText: "",
    primaryChart: "candlestick",
    chartSeed: 42,
  },
  "car-lot-final": {
    accentColor: "#6366f1",
    hasDesk: true,
    hasCar: false,
    protagonistAnim: "shrugging",
    protagonistRotation: Math.PI,
    protagonistPosition: [0.3, 0, 1.0],
    showOther: false,
    otherAnim: "Idle",
    otherPosition: [0, 0, 0],
    otherRotation: 0,
    showBigRobot: false,
    logoFile: null,
    logoText: "",
    primaryChart: "candlestick",
    chartSeed: 42,
  },
  "car-departure": {
    accentColor: "#f5c542",
    hasDesk: false,
    hasCar: true,
    protagonistAnim: "entering-car",
    protagonistRotation: Math.PI * 0.5,
    protagonistPosition: [0, 0, 0.5],    // beside car door
    showOther: false,
    otherAnim: "Idle",
    otherPosition: [0, 0, 0],
    otherRotation: 0,
    showBigRobot: false,
    logoFile: null,
    logoText: "",
    primaryChart: "candlestick",
    chartSeed: 42,
  },
};

// ---------------------------------------------------------------------------
// Canvas texture drawing functions — extracted to engine/charts/
// ---------------------------------------------------------------------------

import {
  drawCandlestick,
  drawLineChart,
  drawOrderBook,
  drawCandlestickOverlay,
  drawLineOverlay,
  drawOrderBookOverlay,
  drawTickerOverlay,
  drawLogoScreen,
  drawPortfolioCrash,
} from "../../../engine/charts";

const TEX_W = 512;
const TEX_H = 384;

// ---------------------------------------------------------------------------
// Monitor with canvas texture
// ---------------------------------------------------------------------------

type DrawFn = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: number,
) => void;

const MonitorScreen: React.FC<{
  position: [number, number, number];
  screenW: number;
  screenH: number;
  drawFn: DrawFn;
  frame: number;
  glowColor: string;
  hideStand?: boolean;
}> = ({ position, screenW, screenH, drawFn, frame, glowColor, hideStand }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);

  const { canvas, texture } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = TEX_W;
    c.height = TEX_H;
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    canvasRef.current = c;
    textureRef.current = t;
    return { canvas: c, texture: t };
  }, []);

  const ctx = canvas.getContext("2d");
  if (ctx) {
    drawFn(ctx, TEX_W, TEX_H, frame);
    texture.needsUpdate = true;
  }

  const glowCol = useMemo(() => new THREE.Color(glowColor), [glowColor]);

  return (
    <group position={position}>
      {/* Apple-style thin aluminum bezel */}
      <mesh position={[0, 0, -0.008]}>
        <boxGeometry args={[screenW + 0.016, screenH + 0.016, 0.012]} />
        <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
      </mesh>
      {/* Thin chin (Apple logo area) */}
      <mesh position={[0, -(screenH / 2 + 0.01), -0.008]}>
        <boxGeometry args={[screenW + 0.016, 0.025, 0.012]} />
        <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
      </mesh>
      {/* Screen */}
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[screenW, screenH]} />
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive={new THREE.Color("#ffffff")}
          emissiveIntensity={1.5}
          roughness={0.1}
          metalness={0}
          toneMapped={false}
        />
      </mesh>
      {/* Glow light */}
      <pointLight
        position={[0, 0, 0.4]}
        intensity={0.5}
        color={glowCol}
        distance={2}
        decay={2}
      />
      {/* Apple-style single thin aluminum stand + base (hidden on top row) */}
      {!hideStand && (
        <>
          {/* Thin flat stand arm — extends from screen chin to desk surface */}
          <mesh position={[0, -(screenH / 2 + 0.10), -0.02]}>
            <boxGeometry args={[0.04, 0.18, 0.008]} />
            <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
          </mesh>
          {/* Flat rectangular base foot — sits ON desk surface, visible */}
          <mesh position={[0, -(screenH / 2 + 0.18), 0.025]}>
            <boxGeometry args={[0.18, 0.012, 0.12]} />
            <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
          </mesh>
        </>
      )}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Image-based monitor (loads a PNG screenshot as screen texture)
// ---------------------------------------------------------------------------

const ImageMonitor: React.FC<{
  position: [number, number, number];
  screenW: number;
  screenH: number;
  imagePath: string;
  hideStand?: boolean;
}> = ({ position, screenW, screenH, imagePath, hideStand }) => {
  const texture = useLoader(THREE.TextureLoader, staticFile(imagePath));
  // NPOT-safe: 384px height is not power-of-2, so disable mipmaps
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return (
    <group position={position}>
      <mesh position={[0, 0, -0.008]}>
        <boxGeometry args={[screenW + 0.016, screenH + 0.016, 0.012]} />
        <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
      </mesh>
      <mesh position={[0, -(screenH / 2 + 0.01), -0.008]}>
        <boxGeometry args={[screenW + 0.016, 0.025, 0.012]} />
        <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
      </mesh>
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[screenW, screenH]} />
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive={new THREE.Color("#ffffff")}
          emissiveIntensity={1.2}
          roughness={0.1}
          metalness={0}
          toneMapped={false}
        />
      </mesh>
      {!hideStand && (
        <>
          <mesh position={[0, -(screenH / 2 + 0.10), -0.02]}>
            <boxGeometry args={[0.04, 0.18, 0.008]} />
            <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
          </mesh>
          <mesh position={[0, -(screenH / 2 + 0.18), 0.025]}>
            <boxGeometry args={[0.18, 0.012, 0.12]} />
            <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
          </mesh>
        </>
      )}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Hybrid monitor (static PNG screenshot + animated chart overlay)
// ---------------------------------------------------------------------------

const HybridMonitor: React.FC<{
  position: [number, number, number];
  screenW: number;
  screenH: number;
  screenDef: ScreenDef;
  frame: number;
  accentColor: string;
  hideStand?: boolean;
}> = ({ position, screenW, screenH, screenDef, frame, accentColor, hideStand }) => {
  const imageTexture = useLoader(THREE.TextureLoader, staticFile(screenDef.image));
  // NPOT-safe filters (384px height is not power-of-2)
  imageTexture.minFilter = THREE.LinearFilter;
  imageTexture.generateMipmaps = false;

  const { canvas, texture } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = TEX_W;
    c.height = TEX_H;
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return { canvas: c, texture: t };
  }, []);

  const ctx = canvas.getContext("2d");
  if (ctx && imageTexture.image) {
    // 1. Draw static screenshot — auto-fit (contain) + optional scale-down
    const img = imageTexture.image as HTMLImageElement;
    const imgW = img.naturalWidth || img.width || TEX_W;
    const imgH = img.naturalHeight || img.height || TEX_H;
    const imgAspect = imgW / imgH;
    const canvasAspect = TEX_W / TEX_H;
    const sc = screenDef.scale ?? 1;
    let dw: number, dh: number, dx: number, dy: number;
    if (imgAspect > canvasAspect) {
      dw = TEX_W * sc; dh = (TEX_W / imgAspect) * sc;
    } else {
      dh = TEX_H * sc; dw = (TEX_H * imgAspect) * sc;
    }
    dx = (TEX_W - dw) / 2; dy = (TEX_H - dh) / 2;
    ctx.fillStyle = screenDef.overlay?.bgColor ?? "#0d1117";
    ctx.fillRect(0, 0, TEX_W, TEX_H);
    ctx.drawImage(img, dx, dy, dw, dh);

    // 2. Draw animated overlay with platform-matching background
    if (screenDef.overlay) {
      const { type, x, y, w, h, seed, upColor, downColor, bgColor } = screenDef.overlay;
      const s = seed ?? 100;
      const up = upColor ?? "#00e676";
      const down = downColor ?? "#ff3d00";
      const bg = bgColor ?? "#0d1117";
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.translate(x, y);
      if (type === "candlestick") {
        drawCandlestickOverlay(ctx, w, h, frame, s, up, down, bg);
        drawTickerOverlay(ctx, w, h, frame, s, up, down);
      } else if (type === "line") {
        drawLineOverlay(ctx, w, h, frame, s, up, bg);
        drawTickerOverlay(ctx, w, h, frame, s, up, down);
      } else if (type === "orderbook") {
        drawOrderBookOverlay(ctx, w, h, frame, s, up, down, bg);
      } else if (type === "ticker") {
        drawTickerOverlay(ctx, w, h, frame, s, up, down);
      }
      ctx.restore();
    }
    texture.needsUpdate = true;
  }

  const glowCol = useMemo(() => new THREE.Color(accentColor), [accentColor]);

  return (
    <group position={position}>
      <mesh position={[0, 0, -0.008]}>
        <boxGeometry args={[screenW + 0.016, screenH + 0.016, 0.012]} />
        <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
      </mesh>
      <mesh position={[0, -(screenH / 2 + 0.01), -0.008]}>
        <boxGeometry args={[screenW + 0.016, 0.025, 0.012]} />
        <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
      </mesh>
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[screenW, screenH]} />
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive={new THREE.Color("#ffffff")}
          emissiveIntensity={1.5}
          roughness={0.1}
          metalness={0}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        position={[0, 0, 0.4]}
        intensity={0.5}
        color={glowCol}
        distance={2}
        decay={2}
      />
      {!hideStand && (
        <>
          <mesh position={[0, -(screenH / 2 + 0.10), -0.02]}>
            <boxGeometry args={[0.04, 0.18, 0.008]} />
            <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
          </mesh>
          <mesh position={[0, -(screenH / 2 + 0.18), 0.025]}>
            <boxGeometry args={[0.18, 0.012, 0.12]} />
            <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
          </mesh>
        </>
      )}
    </group>
  );
};

// Preload ALL screen images from centralized config
for (const p of getAllScreenImages()) {
  useLoader.preload(THREE.TextureLoader, staticFile(p));
}

// ---------------------------------------------------------------------------
// Trading desk with 4 monitors (2x2)
// ---------------------------------------------------------------------------

const TradingSetup: React.FC<{
  frame: number;
  phase: ScenePhase;
  config: PhaseConfig;
}> = ({ frame, phase, config }) => {
  const scrW = 0.52;
  const scrH = 0.36;
  const gapX = 0.06;
  const gapY = 0.05;

  // Desk top is at y≈0.67. Monitors sit ON the desk via their stands.
  // Stand foot offset from screen center = -(scrH/2 + 0.155) ≈ -0.335
  // So screen center Y = 0.67 + 0.335 = ~1.0
  const deskZ = -0.9; // on the desk (desk spans z=-0.3 to z=-1.1)
  const bottomY = 1.0;
  const topY = bottomY + scrH + gapY;
  const positions: [number, number, number][] = [
    [-(scrW + gapX) / 2, topY, deskZ],   // top-left
    [(scrW + gapX) / 2, topY, deskZ],     // top-right
    [-(scrW + gapX) / 2, bottomY, deskZ], // bottom-left
    [(scrW + gapX) / 2, bottomY, deskZ],  // bottom-right
  ];

  const isStormy = phase === "goldman" || phase === "defeat" || phase === "ambush" || phase === "memecoins";

  const drawFns: DrawFn[] = useMemo(() => {
    const { accentColor, primaryChart, chartSeed, logoText } = config;

    // Goldman/defeat: all charts become crashing red portfolios
    if (isStormy) {
      const drawCrash1: DrawFn = (ctx, w, h, f) => drawPortfolioCrash(ctx, w, h, f);
      const drawCrash2: DrawFn = (ctx, w, h, f) => drawCandlestick(ctx, w, h, f, "#ff3333", chartSeed);
      const drawCrash3: DrawFn = (ctx, w, h, f) => drawPortfolioCrash(ctx, w, h, f);
      const drawLogo: DrawFn = (ctx, w, h, f) =>
        drawLogoScreen(ctx, w, h, f, logoText, "#ff3333");
      return [drawCrash1, drawCrash2, drawCrash3, drawLogo];
    }

    const drawPrimary: DrawFn =
      primaryChart === "line"
        ? (ctx, w, h, f) => drawLineChart(ctx, w, h, f, accentColor, chartSeed)
        : primaryChart === "orderbook"
          ? (ctx, w, h, f) =>
              drawOrderBook(ctx, w, h, f, accentColor, chartSeed)
          : (ctx, w, h, f) =>
              drawCandlestick(ctx, w, h, f, accentColor, chartSeed);

    const drawSecondary: DrawFn =
      primaryChart === "line"
        ? (ctx, w, h, f) =>
            drawCandlestick(ctx, w, h, f, accentColor, chartSeed + 10)
        : (ctx, w, h, f) =>
            drawLineChart(ctx, w, h, f, accentColor, chartSeed + 10);

    const drawTertiary: DrawFn =
      primaryChart === "orderbook"
        ? (ctx, w, h, f) =>
            drawCandlestick(ctx, w, h, f, accentColor, chartSeed + 20)
        : (ctx, w, h, f) =>
            drawOrderBook(ctx, w, h, f, accentColor, chartSeed + 20);

    const drawLogo: DrawFn = (ctx, w, h, f) =>
      drawLogoScreen(ctx, w, h, f, logoText, accentColor);

    return [drawPrimary, drawSecondary, drawTertiary, drawLogo];
  }, [config, isStormy]);

  // Screen shake for goldman/defeat — monitors vibrate with dread
  const shakeX = isStormy ? Math.sin(frame * 0.2) * 0.015 + Math.sin(frame * 0.37) * 0.008 : 0;
  const shakeY = isStormy ? Math.cos(frame * 0.25) * 0.01 : 0;
  const shakeZ = isStormy ? Math.sin(frame * 0.15) * 0.005 : 0;

  return (
    <group position={[shakeX, shakeY, shakeZ]}>
      {/* Desk surface — light wood */}
      <mesh position={[0, 0.65, -0.7]}>
        <boxGeometry args={[2.0, 0.04, 0.8]} />
        <meshStandardMaterial color="#d4a574" roughness={0.6} metalness={0.05} />
      </mesh>
      {/* Desk front edge */}
      <mesh position={[0, 0.645, -0.3]}>
        <boxGeometry args={[2.0, 0.04, 0.015]} />
        <meshStandardMaterial color="#c49565" roughness={0.6} metalness={0.05} />
      </mesh>
      {/* Desk legs — thin metal */}
      {(
        [
          [-0.9, -0.9],
          [0.9, -0.9],
          [-0.9, -0.5],
          [0.9, -0.5],
        ] as const
      ).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.32, z]}>
          <cylinderGeometry args={[0.02, 0.02, 0.64, 8]} />
          <meshStandardMaterial color="#888888" roughness={0.2} metalness={0.7} />
        </mesh>
      ))}

      {/* Monitor mount arm — holds the top row monitors */}
      <group>
        {/* Vertical pole: desk surface (0.67) to top of top monitors */}
        {(() => {
          const poleBottom = 0.67;
          const poleTop = topY + scrH / 2;
          const poleH = poleTop - poleBottom;
          const poleCenter = (poleBottom + poleTop) / 2;
          const mountW = scrW * 2 + gapX; // exact monitor width
          return (
            <>
              <mesh position={[0, poleCenter, deskZ - 0.03]}>
                <cylinderGeometry args={[0.012, 0.012, poleH, 8]} />
                <meshStandardMaterial color="#888888" roughness={0.2} metalness={0.7} />
              </mesh>
              {/* Crossbar at top row center */}
              <mesh position={[0, topY, deskZ - 0.025]}>
                <boxGeometry args={[mountW, 0.015, 0.012]} />
                <meshStandardMaterial color="#888888" roughness={0.2} metalness={0.7} />
              </mesh>
              {/* Crossbar at bottom row center */}
              <mesh position={[0, bottomY, deskZ - 0.025]}>
                <boxGeometry args={[mountW, 0.015, 0.012]} />
                <meshStandardMaterial color="#888888" roughness={0.2} metalness={0.7} />
              </mesh>
              {/* Desk clamp */}
              <mesh position={[0, 0.67, deskZ - 0.03]}>
                <boxGeometry args={[0.06, 0.03, 0.05]} />
                <meshStandardMaterial color="#666666" roughness={0.3} metalness={0.6} />
              </mesh>
            </>
          );
        })()}
      </group>

      {/* 4 Mac-style monitors (2x2) — screens from centralized PHASE_SCREENS config */}
      {positions.map((pos, i) => {
        const phaseScreens = PHASE_SCREENS[phase];
        const entry: ScreenEntry | undefined = phaseScreens?.[i];

        if (entry?.overlay || entry?.scale) {
          return (
            <Suspense key={i} fallback={null}>
              <HybridMonitor position={pos} screenW={scrW} screenH={scrH}
                screenDef={entry} frame={frame} accentColor={config.accentColor}
                hideStand={i < 2} />
            </Suspense>
          );
        }
        if (entry) {
          return (
            <Suspense key={i} fallback={null}>
              <ImageMonitor position={pos} screenW={scrW} screenH={scrH}
                imagePath={entry.image} hideStand={i < 2} />
            </Suspense>
          );
        }
        return (
          <MonitorScreen
            key={i}
            position={pos}
            screenW={scrW}
            screenH={scrH}
            drawFn={drawFns[i]}
            frame={frame}
            glowColor={config.accentColor}
            hideStand={i < 2}
          />
        );
      })}

      {/* Mac Mini — small silver aluminum box on desk */}
      <mesh position={[0.55, 0.685, -0.75]}>
        <boxGeometry args={[0.12, 0.025, 0.12]} />
        <meshStandardMaterial color="#c0c0c4" roughness={0.15} metalness={0.85} />
      </mesh>
      {/* Mac Mini — dark front accent */}
      <mesh position={[0.55, 0.685, -0.688]}>
        <boxGeometry args={[0.118, 0.02, 0.003]} />
        <meshStandardMaterial color="#222222" roughness={0.3} metalness={0.5} />
      </mesh>
      {/* Mac Mini — indicator light */}
      <mesh position={[0.6, 0.685, -0.686]}>
        <sphereGeometry args={[0.003, 8, 8]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={3}
        />
      </mesh>

      {/* Apple Magic Keyboard — wider, thin, aluminum */}
      <group position={[-0.05, 0.685, -0.55]}>
        {/* Keyboard base — thin aluminum slab */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.38, 0.006, 0.1]} />
          <meshStandardMaterial color="#d4d4d8" roughness={0.15} metalness={0.8} />
        </mesh>
        {/* Key area — slightly recessed dark surface */}
        <mesh position={[0, 0.004, 0]}>
          <boxGeometry args={[0.36, 0.003, 0.08]} />
          <meshStandardMaterial color="#2a2a2e" roughness={0.5} metalness={0.2} />
        </mesh>
      </group>

      {/* Apple Magic Mouse — low profile, rounded aluminum */}
      <group position={[0.28, 0.685, -0.5]}>
        {/* Mouse body — rounded flat shape */}
        <mesh position={[0, 0.005, 0]}>
          <boxGeometry args={[0.04, 0.008, 0.065]} />
          <meshStandardMaterial color="#d4d4d8" roughness={0.15} metalness={0.8} />
        </mesh>
        {/* Mouse top — touch surface */}
        <mesh position={[0, 0.01, 0]}>
          <boxGeometry args={[0.036, 0.003, 0.06]} />
          <meshStandardMaterial color="#e8e8ec" roughness={0.1} metalness={0.6} />
        </mesh>
      </group>

      {/* Logo removed — was floating above monitors, user didn't want it */}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Logo plane (loads PNG texture) — for PNGs we have
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Car (Quaternius CC0 sedan GLB)
// ---------------------------------------------------------------------------

const CAR_URL = staticFile("models/car-sedan.glb");
useGLTF.preload(CAR_URL);

const SimpleCar: React.FC<{ position: [number, number, number]; rotationY?: number }> = ({
  position,
  rotationY = Math.PI / 2,
}) => {
  const gltf = useGLTF(CAR_URL);
  const cloned = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={[0.7, 0.7, 0.7]}>
      <primitive object={cloned} />
    </group>
  );
};

// ---------------------------------------------------------------------------
// 3D Heart sign for "I ♥ MIAMI"
// ---------------------------------------------------------------------------

const HeartSign: React.FC = () => {
  const heartGeo = useMemo(() => {
    const shape = new THREE.Shape();
    // Classic heart curve — round lobes, pointed bottom
    shape.moveTo(0, -0.35);
    shape.bezierCurveTo(-0.05, -0.35, -0.25, -0.6, -0.5, -0.35);
    shape.bezierCurveTo(-0.75, -0.1, -0.75, 0.15, -0.5, 0.35);
    shape.bezierCurveTo(-0.3, 0.5, -0.05, 0.65, 0, 0.8);
    shape.bezierCurveTo(0.05, 0.65, 0.3, 0.5, 0.5, 0.35);
    shape.bezierCurveTo(0.75, 0.15, 0.75, -0.1, 0.5, -0.35);
    shape.bezierCurveTo(0.25, -0.6, 0.05, -0.35, 0, -0.35);
    const extrudeSettings = { depth: 0.25, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.04, bevelSegments: 4 };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, []);
  return (
    <group position={[0.85, 0.55, 0.05]} scale={[0.55, 0.55, 0.55]} rotation={[0, 0, Math.PI]}>
      <mesh geometry={heartGeo}>
        <meshStandardMaterial color="#e8192c" roughness={0.25} metalness={0.1} />
      </mesh>
    </group>
  );
};

// ---------------------------------------------------------------------------
// RobotExpressive character
// ---------------------------------------------------------------------------

const ROBOT_URL = staticFile("models/RobotExpressive.glb");
useGLTF.preload(ROBOT_URL);

// Preload all logo textures at module level to avoid async lag during playback
const LOGO_URLS = [
  "shorts/short-02/logos/binance.png",
  "shorts/short-02/logos/goldman-sachs.png",
  "shorts/short-02/logos/robinhood-screen.png",
  "shorts/short-02/logos/pumpfun-screen.png",
  "shorts/short-02/logos/polymarket.png",
  "shorts/short-02/logos/forex-screen.png",
  "shorts/short-02/logos/nyse.png",
  "shorts/short-02/logos/citadel.png",
  "shorts/short-02/logos/jump-trading.png",
  "shorts/short-02/logos/ftx-screen-1.png",
  "shorts/short-02/logos/ftx-screen-2.png",
  "shorts/short-02/logos/binance-screen-2.png",
  "shorts/short-02/logos/forex-screen-2.png",
  "shorts/short-02/logos/nyse-screen-2.png",
  "shorts/short-02/logos/robinhood-screen-2.png",
  "shorts/short-02/logos/pumpfun-screen-2.png",
  "shorts/short-02/logos/polymarket-screen.png",
  "shorts/short-02/logos/polymarket-screen-2.png",
].map((p) => staticFile(p));
for (const url of LOGO_URLS) {
  useLoader.preload(THREE.TextureLoader, url);
}

const BeachCharacter: React.FC<{
  frame: number;
  fps?: number;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  color?: string;
  animationName?: string;
}> = ({
  frame,
  fps = 30,
  position,
  rotationY = 0,
  scale = 1,
  color,
  animationName = "Idle",
}) => {
  const gltf = useGLTF(ROBOT_URL);

  const { cloned, mixer } = useMemo(() => {
    const c = cloneSkeleton(gltf.scene) as THREE.Group;
    if (color) {
      const tint = new THREE.Color(color);
      c.traverse((node: THREE.Object3D) => {
        if ((node as THREE.Mesh).isMesh) {
          const mesh = node as THREE.Mesh;
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          const newMats = mats.map((m) => {
            const nm = (m as THREE.MeshStandardMaterial).clone();
            nm.color.lerp(tint, 0.45);
            return nm;
          });
          mesh.material = newMats.length === 1 ? newMats[0] : newMats;
        }
      });
    }
    return { cloned: c, mixer: new THREE.AnimationMixer(c) };
  }, [gltf.scene, color]);

  useEffect(() => {
    mixer.stopAllAction();
    const clip = gltf.animations.find((a) => a.name === animationName);
    if (clip) mixer.clipAction(clip).play();
  }, [animationName, mixer, gltf.animations]);

  // Deterministic time for Remotion's frame-by-frame rendering
  try { mixer.setTime(frame / fps); } catch { /* ignore stale mixer */ }

  const s = scale * 0.85;

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      scale={[s, s, s]}
    >
      <primitive object={cloned} />
    </group>
  );
};

// ---------------------------------------------------------------------------
// Character registry — single-place definition for all character models.
// To add/swap a character: add one entry to CHARACTERS + drop files in folder.
// ---------------------------------------------------------------------------

const CHAR_DIR = "models/characters";

type CharacterKey = "casualMan" | "eric" | "drex" | "dancingGurl" | "nyanChan";

interface CharacterDef {
  folder: string;
  glbFile?: string;              // defaults to ${folder}.glb
  baseScale: number;
  fbxAnims?: "all" | string[];   // "all" = full library, string[] = specific files, undefined = Soldier fallback
  npc?: boolean;
  npcTags?: string[];            // pool filtering ("beach", etc.)
}

const CHARACTERS: Record<CharacterKey, CharacterDef> = {
  casualMan: {
    folder: "CasualMan", baseScale: 0.6, fbxAnims: "all", npc: true,
  },
  eric: {
    folder: "EricBusinessman", baseScale: 0.006,
  },
  drex: {
    folder: "Drex", baseScale: 0.6, fbxAnims: [
      "idle", "walking", "running", "acknowledging", "arm-stretching",
      "bboy-hip-hop-move", "bboy-uprock-start", "bboy-uprock",
      "cheering", "cheering-1", "dancing", "silly-dancing",
      "standard-idle", "standard-run", "standard-walk",
      "swing-dancing", "wiping-sweat",
    ],
  },
  dancingGurl: {
    folder: "DancingGurl", baseScale: 0.6, npc: true, npcTags: ["beach"], fbxAnims: [
      "idle", "walking", "running", "salsa-dancing",
      "chicken-dance", "female-walk", "happy", "samba-dancing",
      "standing-arguing", "standing", "walk-in-circle", "texting-and-walking",
      "running-1", "salsa-dancing-2", "talking-2",
    ],
  },
  nyanChan: {
    folder: "NyanChanBikini", baseScale: 0.35,
  },
};

// Preload list for characters with fbxAnims: "all" (only a curated subset)
const CHAR_ALL_FBX_PRELOAD: Partial<Record<CharacterKey, string[]>> = {
  casualMan: [
    "look-around", "pointing", "weight-shift", "excited", "entering-code",
    "surprised", "counting", "hands-forward-gesture", "neck-stretching",
    "angry-point", "laughing", "yelling-while-standing", "thoughtful-head-nod",
    "defeated", "running", "shrugging", "entering-car", "idle",
    "walking", "salsa-dancing", "waving", "agreeing", "fall-flat",
    "talking", "victory", "cards", "treadmill-running",
  ],
};

// Scene role constants — swap OTHER_CHARACTER to change the secondary character
const PROTAGONIST: CharacterKey = "casualMan";
const OTHER_CHARACTER: CharacterKey = "drex";

// --- Derived lookups (computed once from CHARACTERS) ---

const CHAR_URLS = Object.fromEntries(
  (Object.entries(CHARACTERS) as [CharacterKey, CharacterDef][]).map(([key, def]) => [
    key,
    staticFile(`${CHAR_DIR}/${def.folder}/${def.glbFile ?? `${def.folder}.glb`}`),
  ]),
) as Record<CharacterKey, string>;

const CHAR_FOLDER: Record<string, string> = Object.fromEntries(
  (Object.entries(CHARACTERS) as [CharacterKey, CharacterDef][]).map(([key, def]) => [
    CHAR_URLS[key], `${CHAR_DIR}/${def.folder}`,
  ]),
);

const MODEL_BASE_SCALE: Record<string, number> = Object.fromEntries(
  (Object.entries(CHARACTERS) as [CharacterKey, CharacterDef][]).map(([key, def]) => [
    CHAR_URLS[key], def.baseScale,
  ]),
);

const CHAR_AVAILABLE_FBX: Record<string, "all" | Set<string>> = Object.fromEntries(
  (Object.entries(CHARACTERS) as [CharacterKey, CharacterDef][])
    .filter(([, def]) => def.fbxAnims)
    .map(([key, def]) => [
      CHAR_URLS[key],
      def.fbxAnims === "all" ? "all" : new Set(def.fbxAnims),
    ]),
);

const NPC_MODEL_POOL: string[] = (Object.entries(CHARACTERS) as [CharacterKey, CharacterDef][])
  .filter(([, def]) => def.npc)
  .map(([key]) => CHAR_URLS[key]);

// Auto-preload all GLB models
for (const key of Object.keys(CHARACTERS) as CharacterKey[]) {
  useGLTF.preload(CHAR_URLS[key]);
}

// Auto-preload FBX animations
for (const [key, def] of Object.entries(CHARACTERS) as [CharacterKey, CharacterDef][]) {
  if (def.fbxAnims === "all") {
    const preloadList = CHAR_ALL_FBX_PRELOAD[key];
    if (preloadList) {
      for (const anim of preloadList) {
        useLoader.preload(FBXLoader, staticFile(`${CHAR_DIR}/${def.folder}/${anim}.fbx`));
      }
    }
  } else if (Array.isArray(def.fbxAnims)) {
    for (const anim of def.fbxAnims) {
      useLoader.preload(FBXLoader, staticFile(`${CHAR_DIR}/${def.folder}/${anim}.fbx`));
    }
  }
}

// Map old NPC/Soldier animation names → Mixamo FBX file stems (lowercase)
const ANIM_TO_FBX: Record<string, string> = {
  Walk: "walking",
  Walking: "walking",
  Run: "running",
  Running: "running",
  Idle: "idle",
  Dance: "salsa-dancing",
  Jump: "excited",
  Wave: "waving",
  ThumbsUp: "agreeing",
  WalkJump: "happy-walk",
  Yes: "agreeing",
  No: "thoughtful-head-shake",
  Death: "fall-flat",
  Punch: "mma-kick",
  Sitting: "sitting-talking",
  Standing: "standing",
};

// Map ALL animation names to Soldier's available set (legacy fallback)
const SOLDIER_ANIM: Record<string, string> = {
  Walking: "Walk",
  Running: "Run",
  Idle: "Idle",
  Punch: "Run",
  Death: "Idle",
  ThumbsUp: "Idle",
  Walk: "Walk",
  Run: "Run",
  Dance: "Walk",
  Wave: "Idle",
  Jump: "Run",
  WalkJump: "Walk",
  Sitting: "Idle",
  Standing: "Idle",
  Yes: "Idle",
  No: "Idle",
};

// ---------------------------------------------------------------------------
// Animation retargeting — reuse Soldier's Walk/Run/Idle on any humanoid model
// Maps bone names across naming conventions:
//   Soldier/Mixamo:    mixamorig:LeftArm
//   CasualMan/Fashion: LeftArm_27, Hips_02
//   DancingGurl:       mixamorig:LeftArm_09
//   EricBusinessman:   upperarm_l_024  (UE4 style)
//   NyanChanBikini:    J_Bip_L_UpperArm_67  (VRM style)
// ---------------------------------------------------------------------------

const SOLDIER_URL = staticFile("models/Soldier.glb");
useGLTF.preload(SOLDIER_URL);

/** Normalize any humanoid bone name to standard Mixamo canonical form */
function canonicalBone(name: string): string {
  let n = name.replace(/_\d+$/, ""); // strip numeric suffix

  // Mixamorig prefix (Soldier, DancingGurl) — colon stripped by GLTFLoader sanitization
  n = n.replace(/^mixamorig:?/, "");

  // VRM prefix (NyanChan) — extract side then remap
  const vrm = n.match(/^J_Bip_([CLR])_(.*)/);
  if (vrm) {
    const side = vrm[1];
    let part = vrm[2];
    const vrmRename: Record<string, string> = {
      UpperArm: "Arm", LowerArm: "ForeArm",
      UpperLeg: "UpLeg", LowerLeg: "Leg",
    };
    part = vrmRename[part] ?? part;
    n = (side === "L" ? "Left" : side === "R" ? "Right" : "") + part;
  }

  // UE4 naming (EricBusinessman)
  const ue4: Record<string, string> = {
    hip: "Hips", spine_01: "Spine", spine_02: "Spine1", spine_03: "Spine2",
    neck: "Neck", head: "Head", head_end: "HeadTop_End",
    shoulder_l: "LeftShoulder", upperarm_l: "LeftArm",
    lowerarm_l: "LeftForeArm", hand_l: "LeftHand",
    shoulder_r: "RightShoulder", upperarm_r: "RightArm",
    lowerarm_r: "RightForeArm", hand_r: "RightHand",
    upperleg_l: "LeftUpLeg", lowerleg_l: "LeftLeg",
    foot_l: "LeftFoot", foot_end_l: "LeftToeBase",
    upperleg_r: "RightUpLeg", lowerleg_r: "RightLeg",
    foot_r: "RightFoot", foot_end_r: "RightToeBase",
  };
  const lower = n.toLowerCase();
  if (ue4[lower]) return ue4[lower];

  return n;
}

// ---------------------------------------------------------------------------
// Generic character — loads any GLB model, plays embedded animations if
// available, otherwise copies Soldier's Walk/Run/Idle bone poses directly.
// ---------------------------------------------------------------------------

const GenericCharacter: React.FC<{
  modelUrl: string;
  frame: number;
  fps?: number;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  color?: string;
  animationName?: string;
  baseScaleFactor?: number; // model-specific size correction
}> = ({
  modelUrl,
  frame,
  fps = 30,
  position,
  rotationY = 0,
  scale = 1,
  color,
  animationName = "Idle",
  baseScaleFactor = 1,
}) => {
  const gltf = useGLTF(modelUrl);
  const soldierGltf = useGLTF(SOLDIER_URL);

  // Clone target model + tint
  const cloned = useMemo(() => {
    const c = cloneSkeleton(gltf.scene) as THREE.Group;
    if (color) {
      const tint = new THREE.Color(color);
      c.traverse((node: THREE.Object3D) => {
        if ((node as THREE.Mesh).isMesh) {
          const mesh = node as THREE.Mesh;
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          const newMats = mats.map((m) => {
            const nm = (m as THREE.MeshStandardMaterial).clone();
            nm.color.lerp(tint, 0.3);
            return nm;
          });
          mesh.material = newMats.length === 1 ? newMats[0] : newMats;
        }
      });
    }
    // Force TRS mode on all nodes — Sketchfab GLTFs often set matrixAutoUpdate=false
    // which means quaternion/position changes are silently ignored during rendering.
    c.traverse((nd) => {
      if (!nd.matrixAutoUpdate) {
        nd.matrix.decompose(nd.position, nd.quaternion, nd.scale);
        nd.matrixAutoUpdate = true;
      }
    });
    return c;
  }, [gltf.scene, color]);

  // Find the target SkinnedMesh (needed for retargetClip)
  const targetMesh = useMemo((): THREE.SkinnedMesh | null => {
    let mesh: THREE.SkinnedMesh | null = null;
    cloned.traverse((nd: THREE.Object3D) => {
      if ((nd as THREE.SkinnedMesh).isSkinnedMesh && !mesh) mesh = nd as THREE.SkinnedMesh;
    });
    return mesh;
  }, [cloned]);

  // Clone Soldier scene for retargeting (retargetClip modifies the source)
  const soldierClone = useMemo(() => {
    const c = cloneSkeleton(soldierGltf.scene) as THREE.Group;
    // Force TRS mode — ensures bone.quaternion is the actual local Q
    c.traverse((nd) => {
      if (!nd.matrixAutoUpdate) {
        nd.matrix.decompose(nd.position, nd.quaternion, nd.scale);
        nd.matrixAutoUpdate = true;
      }
    });
    return c;
  }, [soldierGltf.scene]);

  // Build bone-name mapping: target bone name → soldier bone name
  const boneNameMap = useMemo(() => {
    const names: Record<string, string> = {};
    if (!targetMesh?.skeleton) return names;
    // Index soldier bones by canonical name
    const soldierByCanon: Record<string, string> = {};
    soldierClone.traverse((nd) => {
      if ((nd as THREE.Bone).isBone) {
        const canon = canonicalBone(nd.name).toLowerCase();
        if (!soldierByCanon[canon]) soldierByCanon[canon] = nd.name;
      }
    });
    // Map each target bone to its soldier counterpart
    for (const b of targetMesh!.skeleton.bones) {
      const canon = canonicalBone(b.name).toLowerCase();
      if (soldierByCanon[canon]) names[b.name] = soldierByCanon[canon];
    }
    return names;
  }, [targetMesh, soldierClone]);

  // Animation retargeting using the Wicked Engine / retargeting-threejs world-space formula:
  //   retargetedLocalQ = left * srcAnimLocalQ * right
  // where:
  //   left  = inv(trgParentWorldBindQ) * srcParentWorldBindQ
  //   right = inv(srcWorldBindQ) * trgWorldBindQ
  //
  // This correctly handles different bind poses (T-pose source → A-pose target)
  // by going through world space. World bind Qs from skeleton.boneInverses.
  // Root bones (Hips) whose parent is not a bone are skipped.
  const retargetedClips = useMemo(() => {
    const clips: Record<string, THREE.AnimationClip> = {};
    if (!targetMesh?.skeleton) return clips;

    // Find soldier SkinnedMesh (needed for boneInverses)
    const soldierMeshes: THREE.SkinnedMesh[] = [];
    soldierClone.traverse((nd) => {
      if ((nd as THREE.SkinnedMesh).isSkinnedMesh)
        soldierMeshes.push(nd as THREE.SkinnedMesh);
    });
    const soldierMesh = soldierMeshes[0];
    if (!soldierMesh?.skeleton) return clips;

    // --- Compute WORLD bind-pose quaternions from boneInverses ---
    // inv(boneInverse[i]) = world bind matrix → decompose for world bind Q.
    // These are the ground-truth world orientations at bind time.
    const _m4 = new THREE.Matrix4();
    const _pos = new THREE.Vector3();
    const _scl = new THREE.Vector3();
    const _quat = new THREE.Quaternion();

    const srcWorldBindQ: Record<string, THREE.Quaternion> = {};
    for (let i = 0; i < soldierMesh.skeleton.bones.length; i++) {
      _m4.copy(soldierMesh.skeleton.boneInverses[i]).invert();
      _m4.decompose(_pos, _quat, _scl);
      srcWorldBindQ[soldierMesh.skeleton.bones[i].name] = _quat.clone();
    }

    const trgWorldBindQ: Record<string, THREE.Quaternion> = {};
    for (let i = 0; i < targetMesh.skeleton.bones.length; i++) {
      _m4.copy(targetMesh.skeleton.boneInverses[i]).invert();
      _m4.decompose(_pos, _quat, _scl);
      trgWorldBindQ[targetMesh.skeleton.bones[i].name] = _quat.clone();
    }

    // Index soldier bones by name
    const soldierBoneByName: Record<string, THREE.Bone> = {};
    soldierClone.traverse((nd) => {
      if ((nd as THREE.Bone).isBone) soldierBoneByName[nd.name] = nd as THREE.Bone;
    });

    // Build bone pairs + reverse map (soldier name → target name)
    type BonePair = { target: THREE.Bone; soldier: THREE.Bone };
    const pairs: BonePair[] = [];
    const soldierToTarget: Record<string, string> = {};
    for (const bone of targetMesh.skeleton.bones) {
      const soldierName = boneNameMap[bone.name];
      if (soldierName && soldierBoneByName[soldierName]) {
        pairs.push({ target: bone, soldier: soldierBoneByName[soldierName] });
        soldierToTarget[soldierName] = bone.name;
      }
    }
    if (pairs.length === 0) return clips;

    // --- Precompute retargeting quaternions (world-space formula) ---
    // left  = inv(trgParentWorldBind) * srcParentWorldBind
    // right = inv(srcWorldBind) * trgWorldBind
    // Per keyframe: trgLocal = left * srcAnimLocal * right
    const retargetLeftQ: Record<string, THREE.Quaternion> = {};
    const retargetRightQ: Record<string, THREE.Quaternion> = {};

    for (const { target, soldier } of pairs) {
      // Skip root bones (parent not a bone — Hips in Soldier)
      const srcParent = soldier.parent;
      const trgParent = target.parent;
      const srcParentIsBone = srcParent
        && (srcParent as THREE.Bone).isBone
        && srcWorldBindQ[srcParent.name];
      const trgParentIsBone = trgParent
        && (trgParent as THREE.Bone).isBone
        && trgWorldBindQ[trgParent.name];
      if (!srcParentIsBone || !trgParentIsBone) continue;

      const srcPWB = srcWorldBindQ[srcParent!.name];
      const srcWB = srcWorldBindQ[soldier.name];
      const trgPWB = trgWorldBindQ[trgParent!.name];
      const trgWB = trgWorldBindQ[target.name];
      if (!srcPWB || !srcWB || !trgPWB || !trgWB) continue;

      // left = inv(trgParentWorldBind) * srcParentWorldBind
      retargetLeftQ[soldier.name] = trgPWB.clone().conjugate().multiply(srcPWB);
      // right = inv(srcWorldBind) * trgWorldBind
      retargetRightQ[soldier.name] = srcWB.clone().conjugate().multiply(trgWB);
    }

    // --- Process each Soldier animation clip (direct track transform) ---
    for (const clip of soldierGltf.animations) {
      if (clip.duration < 0.1) continue;

      const newTracks: THREE.KeyframeTrack[] = [];

      for (const track of clip.tracks) {
        // Only retarget quaternion tracks
        if (!track.name.endsWith(".quaternion")) continue;

        const srcBoneName = track.name.replace(".quaternion", "");
        const trgBoneName = soldierToTarget[srcBoneName];
        if (!trgBoneName) continue;

        // World-space retargeting: trgLocal = left * srcAnimLocal * right
        const left = retargetLeftQ[srcBoneName];
        const right = retargetRightQ[srcBoneName];
        if (!left || !right) continue;

        const srcValues = track.values;
        const newValues = new Float32Array(srcValues.length);

        for (let i = 0; i < srcValues.length; i += 4) {
          _quat.set(srcValues[i], srcValues[i + 1], srcValues[i + 2], srcValues[i + 3]);
          _quat.premultiply(left);   // left * srcLocal
          _quat.multiply(right);     // * right

          newValues[i] = _quat.x;
          newValues[i + 1] = _quat.y;
          newValues[i + 2] = _quat.z;
          newValues[i + 3] = _quat.w;
        }

        newTracks.push(new THREE.QuaternionKeyframeTrack(
          `${trgBoneName}.quaternion`,
          Float32Array.from(track.times),
          newValues,
        ));
      }

      if (newTracks.length > 0) {
        clips[clip.name] = new THREE.AnimationClip(clip.name, clip.duration, newTracks);
      }
    }

    return clips;
  }, [targetMesh, soldierClone, boneNameMap, soldierGltf.animations, cloned]);

  // Single mixer for the target model
  const mixer = useMemo(() => new THREE.AnimationMixer(cloned), [cloned]);

  // Pick the best clip: own animation first, then retargeted soldier clip
  const activeClip = useMemo(() => {
    mixer.stopAllAction();
    const mapped = SOLDIER_ANIM[animationName] ?? "Idle";
    const candidates = [animationName, mapped].filter(Boolean) as string[];

    // 1) Try model's own animation
    for (const name of candidates) {
      const clip = gltf.animations.find(
        (a) =>
          (a.name === name || a.name.toLowerCase() === name.toLowerCase()) &&
          a.duration > 0.1,
      );
      if (clip) {
        mixer.clipAction(clip).play();
        return clip.name;
      }
    }

    // 2) Fall back to retargeted Soldier clip
    const soldierClip = retargetedClips[mapped];
    if (soldierClip) {
      mixer.clipAction(soldierClip).play();
      return soldierClip.name;
    }
    return null;
  }, [animationName, mixer, gltf.animations, retargetedClips]);

  // Debug: log once
  const debuggedRef = React.useRef(false);
  if (!debuggedRef.current) {
    debuggedRef.current = true;
    // Show arm-specific bone mapping to verify retargeting
    const armBones = Object.entries(boneNameMap).filter(([t]) => {
      const c = canonicalBone(t).toLowerCase();
      return c.includes("shoulder") || c.includes("arm") || c.includes("hand");
    });
    // Count retargeted tracks per clip
    const trackCounts = Object.fromEntries(
      Object.entries(retargetedClips).map(([name, clip]) => [name, clip.tracks.length]),
    );
    console.warn(
      `[GenericChar] model=${modelUrl.split("/").pop()} activeClip=${activeClip}`,
      `\n  boneMap(${Object.keys(boneNameMap).length} bones):`,
      Object.entries(boneNameMap).slice(0, 8).map(([t, s]) => `${t}→${s}`).join(", "),
      `\n  armBones(${armBones.length}):`, armBones.map(([t, s]) => `${t}→${s}`).join(", "),
      `\n  retargetedClips:`, JSON.stringify(trackCounts),
    );
  }

  // --- Per-frame animation ---
  try {
    if (activeClip) {
      mixer.setTime(frame / fps);
    }
  } catch (err) {
    console.error("[GenericChar] animation error:", modelUrl.split("/").pop(), err);
  }

  const s = scale * baseScaleFactor;

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      scale={[s, s, s]}
    >
      <primitive object={cloned} />
    </group>
  );
};

// ---------------------------------------------------------------------------
// Mixamo Character — loads FBX animations directly from character folder
// Used for characters with Mixamo FBX animation libraries (bypasses Soldier retargeting)
// ---------------------------------------------------------------------------

const MixamoCharacter: React.FC<{
  modelUrl: string;
  animName: string; // FBX file stem, e.g. "idle", "look-around"
  frame: number;
  fps?: number;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  color?: string;
  baseScaleFactor?: number;
  stripRootMotion?: boolean; // true = zero out Hips XZ drift (keep vertical bounce)
  handProp?: "phone"; // attach a prop to left hand bone
}> = ({
  modelUrl,
  animName,
  frame,
  fps = 30,
  position,
  rotationY = 0,
  scale = 1,
  color,
  baseScaleFactor = 1,
  stripRootMotion = false,
  handProp,
}) => {
  const gltf = useGLTF(modelUrl);
  const charFolder = CHAR_FOLDER[modelUrl];
  const fbxUrl = staticFile(`${charFolder}/${animName}.fbx`);
  const fbx = useLoader(FBXLoader, fbxUrl) as THREE.Group;

  // Clone target model + tint
  const cloned = useMemo(() => {
    const c = cloneSkeleton(gltf.scene) as THREE.Group;
    if (color) {
      const tint = new THREE.Color(color);
      c.traverse((node: THREE.Object3D) => {
        if ((node as THREE.Mesh).isMesh) {
          const mesh = node as THREE.Mesh;
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          const newMats = mats.map((m) => {
            const nm = (m as THREE.MeshStandardMaterial).clone();
            nm.color.lerp(tint, 0.3);
            return nm;
          });
          mesh.material = newMats.length === 1 ? newMats[0] : newMats;
        }
      });
    }
    c.traverse((nd) => {
      if (!nd.matrixAutoUpdate) {
        nd.matrix.decompose(nd.position, nd.quaternion, nd.scale);
        nd.matrixAutoUpdate = true;
      }
    });
    return c;
  }, [gltf.scene, color]);

  // Build map: canonical bone name (lowercase) → target model bone name
  const targetBoneMap = useMemo(() => {
    const map: Record<string, string> = {};
    cloned.traverse((nd) => {
      if ((nd as THREE.Bone).isBone) {
        const canon = canonicalBone(nd.name).toLowerCase();
        if (!map[canon]) map[canon] = nd.name;
      }
    });
    return map;
  }, [cloned]);

  // Capture rest-pose quaternions from both skeletons (before any animation plays).
  // FBX skeleton = Mixamo auto-rig rest pose, target = CasualMan's original bind pose.
  // The difference is used to correct each animation keyframe.
  const fbxRestQ = useMemo(() => {
    const map: Record<string, THREE.Quaternion> = {};
    (fbx as THREE.Group).traverse((nd) => {
      if ((nd as THREE.Bone).isBone) {
        const canon = canonicalBone(nd.name).toLowerCase();
        if (!map[canon]) map[canon] = nd.quaternion.clone();
      }
    });
    return map;
  }, [fbx]);

  const trgRestQ = useMemo(() => {
    const map: Record<string, THREE.Quaternion> = {};
    cloned.traverse((nd) => {
      if ((nd as THREE.Bone).isBone) {
        const canon = canonicalBone(nd.name).toLowerCase();
        if (!map[canon]) map[canon] = nd.quaternion.clone();
      }
    });
    return map;
  }, [cloned]);

  // Remap FBX animation tracks to target skeleton bone names.
  // For quaternion tracks: apply rest-pose offset correction so that the
  // animation "delta" from Mixamo's bind pose maps correctly to CasualMan's bind pose.
  //   offset = trgRest * inv(srcRest)
  //   correctedQ = offset * srcAnimQ
  // Only keep quaternion tracks + Hips position (root motion).
  const remappedClip = useMemo(() => {
    if (!fbx.animations?.length) return null;
    const srcClip = fbx.animations[0]; // Mixamo FBX has one clip
    const newTracks: THREE.KeyframeTrack[] = [];
    const _q = new THREE.Quaternion();

    for (const track of srcClip.tracks) {
      const dotIdx = track.name.lastIndexOf(".");
      if (dotIdx < 0) continue;
      const srcBone = track.name.substring(0, dotIdx);
      const prop = track.name.substring(dotIdx); // ".quaternion", ".position", ".scale"

      const canon = canonicalBone(srcBone).toLowerCase();
      // Only keep quaternion tracks + Hips position (root motion)
      if (prop === ".position" && canon !== "hips") continue;
      if (prop === ".scale") continue;

      const targetBone = targetBoneMap[canon];
      if (!targetBone) continue;

      if (prop === ".quaternion") {
        // Apply rest-pose offset: correctedQ = offset * srcAnimQ
        const srcRest = fbxRestQ[canon];
        const trgRest = trgRestQ[canon];
        const values = Float32Array.from(track.values);

        if (srcRest && trgRest) {
          const offset = trgRest.clone().multiply(srcRest.clone().conjugate());
          for (let i = 0; i < values.length; i += 4) {
            _q.set(values[i], values[i + 1], values[i + 2], values[i + 3]);
            _q.premultiply(offset);
            values[i] = _q.x;
            values[i + 1] = _q.y;
            values[i + 2] = _q.z;
            values[i + 3] = _q.w;
          }
        }

        newTracks.push(new THREE.QuaternionKeyframeTrack(
          `${targetBone}${prop}`,
          Float32Array.from(track.times),
          values,
        ));
      } else {
        // Position track (Hips only)
        if (stripRootMotion) {
          // Zero out horizontal drift (X/Z) — keep vertical bounce (Y)
          const values = Float32Array.from(track.values);
          const x0 = values[0], z0 = values[2]; // lock to first-frame origin
          for (let i = 0; i < values.length; i += 3) {
            values[i] = x0;       // lock X
            values[i + 2] = z0;   // lock Z (Y at i+1 preserved)
          }
          newTracks.push(new THREE.VectorKeyframeTrack(
            `${targetBone}${prop}`,
            Float32Array.from(track.times),
            values,
          ));
        } else {
          const newTrack = track.clone();
          newTrack.name = `${targetBone}${prop}`;
          newTracks.push(newTrack);
        }
      }
    }

    if (newTracks.length === 0) return null;
    return new THREE.AnimationClip(srcClip.name || animName, srcClip.duration, newTracks);
  }, [fbx, targetBoneMap, fbxRestQ, trgRestQ, animName, stripRootMotion]);

  // Debug: log remapping info once per animation
  const debuggedRef = React.useRef("");
  if (debuggedRef.current !== animName) {
    debuggedRef.current = animName;
    const srcTracks = fbx.animations?.[0]?.tracks ?? [];
    const unmapped = srcTracks
      .filter((t) => {
        const d = t.name.lastIndexOf(".");
        const bone = d > 0 ? t.name.substring(0, d) : t.name;
        return !targetBoneMap[canonicalBone(bone).toLowerCase()];
      })
      .map((t) => t.name);
    console.warn(
      `[MixamoChar] anim="${animName}" fbxTracks=${srcTracks.length}`,
      `remapped=${remappedClip?.tracks.length ?? 0}`,
      `targetBones=${Object.keys(targetBoneMap).length}`,
      unmapped.length > 0 ? `\n  unmapped: ${unmapped.join(", ")}` : "",
    );
  }

  // Create mixer and play the remapped clip
  const mixer = useMemo(() => new THREE.AnimationMixer(cloned), [cloned]);

  useMemo(() => {
    mixer.stopAllAction();
    if (remappedClip) mixer.clipAction(remappedClip).play();
  }, [remappedClip, mixer]);

  // Attach hand prop (phone) to left hand bone
  useMemo(() => {
    // Always clean up any existing prop first
    const old = cloned.getObjectByName("__hand_prop");
    if (old?.parent) old.parent.remove(old);

    if (!handProp) return;

    // Find left hand bone
    let foundBone: THREE.Object3D | undefined;
    cloned.traverse((nd) => {
      if ((nd as THREE.Bone).isBone) {
        const name = canonicalBone(nd.name).toLowerCase();
        if (name === "lefthand") foundBone = nd;
      }
    });
    if (!foundBone) return;
    const handBone = foundBone;

    if (handProp === "phone") {
      const phoneGroup = new THREE.Group();
      phoneGroup.name = "__hand_prop";
      // Phone body (dark slab) — realistic smartphone ~7cm x 14cm
      const bodyGeo = new THREE.BoxGeometry(0.07, 0.14, 0.01);
      const bodyMat = new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.15, metalness: 0.9 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      phoneGroup.add(body);
      // Screen (glowing)
      const screenGeo = new THREE.BoxGeometry(0.06, 0.12, 0.003);
      const screenMat = new THREE.MeshStandardMaterial({ color: "#223355", emissive: "#334466", emissiveIntensity: 1.5, roughness: 0.05 });
      const screen = new THREE.Mesh(screenGeo, screenMat);
      screen.position.z = 0.007; // screen faces outward from palm
      phoneGroup.add(screen);
      // Position: nestled between thumb and fingers
      phoneGroup.position.set(0, 0.08, 0.02);
      phoneGroup.rotation.set(0.45, 0.1, Math.PI / 2);
      handBone.add(phoneGroup);
    }
  }, [cloned, handProp]);

  // Advance to current frame (deterministic for Remotion)
  try { mixer.setTime(frame / fps); } catch { /* ignore stale mixer */ }

  const s = scale * baseScaleFactor;
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={[s, s, s]}>
      <primitive object={cloned} />
    </group>
  );
};

// ---------------------------------------------------------------------------
// SmartCharacter — auto-routes to MixamoCharacter (FBX) or GenericCharacter (Soldier retarget)
// Only uses MixamoCharacter when the specific FBX file is available for the character
// ---------------------------------------------------------------------------

// FBX fallback chain: when the requested anim isn't available, try these in order
const FBX_FALLBACKS: Record<string, string[]> = {
  "waving": ["happy", "idle"],
  "agreeing": ["happy", "idle"],
  "excited": ["happy", "salsa-dancing", "idle"],
  "happy-walk": ["walking", "female-walk"],
  "thoughtful-head-shake": ["standing-arguing", "standing", "idle"],
  "fall-flat": ["idle"],
  "mma-kick": ["salsa-dancing", "idle"],
  "sitting-talking": ["standing", "idle"],
};

const SmartCharacter: React.FC<{
  modelUrl: string;
  frame: number;
  fps?: number;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  color?: string;
  animationName?: string;
  baseScaleFactor?: number;
}> = (props) => {
  const { modelUrl, animationName = "Idle", ...rest } = props;
  const fbxName = ANIM_TO_FBX[animationName] ?? animationName.toLowerCase();
  const available = CHAR_AVAILABLE_FBX[modelUrl];

  // Check if primary FBX is available
  const hasFBX = (name: string) => available === "all" || (available instanceof Set && available.has(name));

  let resolvedFBX = fbxName;
  if (!hasFBX(fbxName)) {
    // Try fallback chain before resorting to Soldier retarget
    const fallbacks = FBX_FALLBACKS[fbxName];
    const found = fallbacks?.find((f) => hasFBX(f));
    if (found) {
      resolvedFBX = found;
    } else if (!available) {
      // No FBX support at all → Soldier fallback
      return (
        <GenericCharacter
          modelUrl={modelUrl}
          animationName={animationName}
          {...rest}
        />
      );
    } else {
      // Has FBX support but none matched → use idle as last resort
      resolvedFBX = hasFBX("idle") ? "idle" : fbxName;
    }
  }

  if (hasFBX(resolvedFBX)) {
    return (
      <MixamoCharacter
        modelUrl={modelUrl}
        animName={resolvedFBX}
        stripRootMotion
        {...rest}
      />
    );
  }
  return (
    <GenericCharacter
      modelUrl={modelUrl}
      animationName={animationName}
      {...rest}
    />
  );
};

// ---------------------------------------------------------------------------
// Creepy RobotExpressive (for Goldman/Citadel/hedge fund phases)
// Looming behind the desk monitors
// ---------------------------------------------------------------------------

const BigRobot: React.FC<{
  frame: number;
  fps: number;
  phase: ScenePhase;
  durationFrames: number;
}> = ({ frame, fps, phase, durationFrames }) => {
  // 1.5x smaller: defeat 2.25→1.5, others 1.25→0.83
  const isDefeat = phase === "defeat";
  const isWalkIn = phase === "ambush" || phase === "memecoins";
  const scale = isDefeat ? 1.5 : 0.83;

  // Walk-in: robot starts offscreen right and walks to final position
  const finalPos: [number, number, number] = isDefeat
    ? [0, 0, -2.8]
    : [-0.5, 0, -2.5];

  const t = durationFrames > 0 ? Math.min(1, frame / durationFrames) : 1;
  const walkEase = t * t * (3 - 2 * t); // smoothstep

  let pos: [number, number, number];
  let animName = "Idle";
  if (isWalkIn) {
    // Start from far right offscreen, walk to final position
    const startX = 6;
    const startZ = -1;
    const curX = startX + (finalPos[0] - startX) * walkEase;
    const curZ = startZ + (finalPos[2] - startZ) * walkEase;
    pos = [curX, 0, curZ];
    // Switch from Walking to Idle once arrived (~80% through)
    animName = walkEase < 0.8 ? "Walking" : "Idle";
  } else {
    pos = finalPos;
  }

  // Souls boss has pulsing red eye glow; walk-in phases get red glow too
  const pulseIntensity = isDefeat
    ? 3 + Math.sin(frame * 0.08) * 2
    : isWalkIn
      ? 2 + Math.sin(frame * 0.1) * 1.5
      : 0;

  return (
    <group>
      <BeachCharacter
        frame={frame}
        fps={fps}
        position={pos}
        rotationY={isDefeat ? 0 : isWalkIn ? (Math.PI / 2) * (1 - walkEase) + 0.2 * walkEase : 0.2}
        scale={scale}
        color={isDefeat ? "#220000" : isWalkIn ? "#1a0a0a" : BIG_ROBOT_COLOR}
        animationName={animName}
      />
      {/* Red eye glow for defeat + walk-in phases */}
      {(isDefeat || isWalkIn) && (
        <>
          <pointLight
            position={[pos[0], 2.0, pos[2] + 0.8]}
            intensity={pulseIntensity}
            color="#ff0000"
            distance={6}
            decay={2}
          />
          {/* Boss health-bar style red line on ground */}
          {isDefeat && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -1.5]}>
              <planeGeometry args={[2.5, 0.03]} />
              <meshBasicMaterial color="#ff0033" transparent opacity={0.6 + Math.sin(frame * 0.1) * 0.3} />
            </mesh>
          )}
        </>
      )}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Background NPC walkers
// ---------------------------------------------------------------------------

// Per-phase NPC seeds so each scene has unique walker patterns
const PHASE_NPC_SEEDS: Record<string, number> = {
  "car-lot": 1111,
  "forex-intro": 2222,
  forex: 3333,
  "stocks-intro": 4400,
  stocks: 4444,
  "bitcoin-intro": 5500,
  bitcoin: 5555,
  goldman: 6666,
  "0dte": 7777,
  ambush: 6677,
  "memecoins-solo": 8877,
  memecoins: 8888,
  polymarket: 9999,
  defeat: 1234,
  return: 5678,
  "car-lot-final": 9012,
  "car-departure": 9013,
};

const NPC_COLORS = [
  "#9CA3AF", "#6B7280", "#78716C", "#A8A29E",
  "#8B7355", "#6D8B74", "#7C6F64", "#D4A574",
  "#E8B4B8", "#B4D4E8", "#D4E8B4", "#E8D4B4",
];

// Movement patterns for NPCs
type MovePattern = "walk" | "run" | "circle" | "zigzag" | "stationary" | "wander";

// Per-phase NPC behavior templates
interface NpcTemplate {
  anim: string;           // animation name
  useRobot: boolean;      // true = RobotExpressive (more anims), false = Soldier
  move: MovePattern;
  speed: number;          // base speed multiplier
  scale: number;
  zRange: [number, number]; // min/max z position
}

// Goofy themed NPC sets per phase
const PHASE_NPC_TEMPLATES: Record<ScenePhase, NpcTemplate[]> = {
  "car-lot": [
    // People checking out cars, taking photos, excited
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.4, scale: 0.55, zRange: [-3, -6] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.6, scale: 0.5, zRange: [-4, -8] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-3, -5] },
    { anim: "Wave", useRobot: false, move: "stationary", speed: 0, scale: 0.6, zRange: [-4, -6] },
    { anim: "ThumbsUp", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-5, -8] },
    { anim: "Walk", useRobot: false, move: "wander", speed: 0.3, scale: 0.45, zRange: [-6, -10] },
    { anim: "Dance", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-7, -12] },
  ],
  "forex-intro": [
    // Beach joggers, couples, someone waving — women dancing
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.5, scale: 0.55, zRange: [-3, -5] },
    { anim: "Dance", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-3, -5] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.5, scale: 0.5, zRange: [-4, -7] },
    { anim: "Wave", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-5, -8] },
    { anim: "Dance", useRobot: false, move: "circle", speed: 0.3, scale: 0.5, zRange: [-6, -9] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-8, -12] },
  ],
  forex: [
    // Beach vibes — women dancing, people chilling
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.5, scale: 0.55, zRange: [-3, -5] },
    { anim: "Dance", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-3, -5] },
    { anim: "Dance", useRobot: false, move: "circle", speed: 0.3, scale: 0.55, zRange: [-4, -6] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-5, -7] },
    { anim: "Walk", useRobot: false, move: "wander", speed: 0.3, scale: 0.5, zRange: [-6, -9] },
    { anim: "Dance", useRobot: false, move: "stationary", speed: 0, scale: 0.45, zRange: [-8, -12] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.4, scale: 0.5, zRange: [-10, -14] },
  ],
  "stocks-intro": [
    // Watching — protagonist observes, some people walk by
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.5, scale: 0.55, zRange: [-3, -5] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-4, -6] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.6, scale: 0.5, zRange: [-5, -8] },
    { anim: "Walk", useRobot: false, move: "wander", speed: 0.3, scale: 0.45, zRange: [-7, -10] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.45, zRange: [-9, -13] },
  ],
  stocks: [
    // Business-like — walking with purpose, one on phone, thumbs up
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.8, scale: 0.55, zRange: [-3, -5] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.7, scale: 0.5, zRange: [-4, -6] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-4, -6] },
    { anim: "ThumbsUp", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-5, -8] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.6, scale: 0.5, zRange: [-7, -10] },
    { anim: "Yes", useRobot: false, move: "stationary", speed: 0, scale: 0.45, zRange: [-9, -13] },
  ],
  "bitcoin-intro": [
    // Watching BTC trader — curious onlookers
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.4, scale: 0.55, zRange: [-3, -5] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-4, -6] },
    { anim: "Walk", useRobot: false, move: "circle", speed: 0.2, scale: 0.5, zRange: [-5, -7] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-6, -9] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.3, scale: 0.45, zRange: [-8, -12] },
  ],
  bitcoin: [
    // Crypto hype — dancing, jumping, running excited, waving
    { anim: "Dance", useRobot: false, move: "stationary", speed: 0, scale: 0.6, zRange: [-3, -5] },
    { anim: "Jump", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-4, -6] },
    { anim: "Run", useRobot: false, move: "run", speed: 1.0, scale: 0.5, zRange: [-3, -5] },
    { anim: "Wave", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-5, -7] },
    { anim: "Dance", useRobot: false, move: "circle", speed: 0.3, scale: 0.5, zRange: [-6, -9] },
    { anim: "ThumbsUp", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-7, -10] },
    { anim: "Walk", useRobot: false, move: "zigzag", speed: 0.6, scale: 0.45, zRange: [-8, -12] },
    { anim: "WalkJump", useRobot: false, move: "walk", speed: 0.5, scale: 0.5, zRange: [-10, -14] },
  ],
  goldman: [
    // Intimidation — people running away, cowering, scared
    { anim: "Run", useRobot: false, move: "run", speed: 0.8, scale: 0.5, zRange: [-3, -5] },
    { anim: "Run", useRobot: false, move: "run", speed: 0.7, scale: 0.45, zRange: [-4, -6] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.35, zRange: [-4, -6] },
    { anim: "No", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-5, -7] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.5, scale: 0.5, zRange: [-6, -9] },
    { anim: "Death", useRobot: false, move: "stationary", speed: 0, scale: 0.45, zRange: [-7, -10] },
  ],
  "0dte": [
    // Panic — running, zigzag, falling over (capped speeds)
    { anim: "Run", useRobot: false, move: "zigzag", speed: 0.8, scale: 0.5, zRange: [-3, -5] },
    { anim: "Run", useRobot: false, move: "run", speed: 1.0, scale: 0.5, zRange: [-3, -5] },
    { anim: "Run", useRobot: false, move: "zigzag", speed: 0.7, scale: 0.45, zRange: [-4, -7] },
    { anim: "Run", useRobot: false, move: "run", speed: 0.9, scale: 0.5, zRange: [-4, -6] },
    { anim: "Run", useRobot: false, move: "run", speed: 1.0, scale: 0.55, zRange: [-5, -8] },
    { anim: "Jump", useRobot: false, move: "walk", speed: 0.5, scale: 0.45, zRange: [-6, -9] },
    { anim: "No", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-7, -10] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.6, scale: 0.4, zRange: [-8, -12] },
  ],
  ambush: [
    // Intimidation — people running away, cowering, scared
    { anim: "Run", useRobot: false, move: "run", speed: 0.8, scale: 0.5, zRange: [-3, -5] },
    { anim: "Run", useRobot: false, move: "run", speed: 0.7, scale: 0.45, zRange: [-4, -6] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.35, zRange: [-4, -6] },
    { anim: "No", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-5, -7] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.5, scale: 0.5, zRange: [-6, -9] },
    { anim: "Death", useRobot: false, move: "stationary", speed: 0, scale: 0.45, zRange: [-7, -10] },
  ],
  "memecoins-solo": [
    // Party chaos — dancing wildly, jumping, running in circles (same as memecoins)
    { anim: "Dance", useRobot: false, move: "circle", speed: 0.5, scale: 0.6, zRange: [-3, -5] },
    { anim: "Dance", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-4, -6] },
    { anim: "Jump", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-4, -6] },
    { anim: "WalkJump", useRobot: false, move: "walk", speed: 0.6, scale: 0.5, zRange: [-5, -7] },
    { anim: "Dance", useRobot: false, move: "circle", speed: 0.4, scale: 0.5, zRange: [-6, -9] },
    { anim: "Wave", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-7, -10] },
    { anim: "Run", useRobot: false, move: "zigzag", speed: 1.0, scale: 0.45, zRange: [-8, -12] },
    { anim: "Dance", useRobot: false, move: "stationary", speed: 0, scale: 0.45, zRange: [-10, -14] },
  ],
  memecoins: [
    // Party chaos — dancing wildly, jumping, running in circles
    { anim: "Dance", useRobot: false, move: "circle", speed: 0.5, scale: 0.6, zRange: [-3, -5] },
    { anim: "Dance", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-4, -6] },
    { anim: "Jump", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-4, -6] },
    { anim: "WalkJump", useRobot: false, move: "walk", speed: 0.6, scale: 0.5, zRange: [-5, -7] },
    { anim: "Dance", useRobot: false, move: "circle", speed: 0.4, scale: 0.5, zRange: [-6, -9] },
    { anim: "Wave", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-7, -10] },
    { anim: "Run", useRobot: false, move: "zigzag", speed: 1.0, scale: 0.45, zRange: [-8, -12] },
    { anim: "Dance", useRobot: false, move: "stationary", speed: 0, scale: 0.45, zRange: [-10, -14] },
  ],
  polymarket: [
    // Debate — standing in groups, arguing, pointing
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-3, -5] },
    { anim: "Wave", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-3, -5] },
    { anim: "Yes", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-4, -6] },
    { anim: "No", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-4, -6] },
    { anim: "Walk", useRobot: false, move: "wander", speed: 0.3, scale: 0.5, zRange: [-5, -8] },
    { anim: "Standing", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-6, -9] },
    { anim: "ThumbsUp", useRobot: false, move: "stationary", speed: 0, scale: 0.45, zRange: [-8, -12] },
  ],
  defeat: [
    // Somber — slow walking, sitting around, dejected
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.2, scale: 0.5, zRange: [-3, -5] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-4, -6] },
    { anim: "Sitting", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-5, -7] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.15, scale: 0.45, zRange: [-6, -9] },
    { anim: "Death", useRobot: false, move: "stationary", speed: 0, scale: 0.45, zRange: [-7, -10] },
  ],
  return: [
    // Peaceful — slow strolling, waving, chill vibes
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.3, scale: 0.55, zRange: [-3, -5] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.35, scale: 0.5, zRange: [-4, -7] },
    { anim: "Wave", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-5, -7] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-6, -9] },
    { anim: "Walk", useRobot: false, move: "wander", speed: 0.2, scale: 0.45, zRange: [-8, -12] },
    { anim: "ThumbsUp", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-10, -14] },
  ],
  "car-lot-final": [
    // PARTY — everyone close, jumping, dancing, celebrating around the desk
    { anim: "Jump", useRobot: false, move: "stationary", speed: 0, scale: 0.65, zRange: [-1.5, -2.5] },
    { anim: "Dance", useRobot: false, move: "stationary", speed: 0, scale: 0.65, zRange: [-1.5, -2.5] },
    { anim: "Jump", useRobot: false, move: "circle", speed: 0.5, scale: 0.6, zRange: [-2, -3] },
    { anim: "Dance", useRobot: false, move: "circle", speed: 0.4, scale: 0.6, zRange: [-2, -3.5] },
    { anim: "Wave", useRobot: false, move: "stationary", speed: 0, scale: 0.6, zRange: [-1.5, -2] },
    { anim: "ThumbsUp", useRobot: false, move: "stationary", speed: 0, scale: 0.6, zRange: [-2, -3] },
    { anim: "Jump", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-3, -4] },
    { anim: "Dance", useRobot: false, move: "circle", speed: 0.6, scale: 0.55, zRange: [-3, -4.5] },
    { anim: "Jump", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-4, -5] },
    { anim: "Wave", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-4, -6] },
  ],
  "car-departure": [
    // Peaceful — slow strolling, waving, chill vibes (same as return)
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.3, scale: 0.55, zRange: [-3, -5] },
    { anim: "Walk", useRobot: false, move: "walk", speed: 0.35, scale: 0.5, zRange: [-4, -7] },
    { anim: "Wave", useRobot: false, move: "stationary", speed: 0, scale: 0.55, zRange: [-5, -7] },
    { anim: "Idle", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-6, -9] },
    { anim: "Walk", useRobot: false, move: "wander", speed: 0.2, scale: 0.45, zRange: [-8, -12] },
    { anim: "ThumbsUp", useRobot: false, move: "stationary", speed: 0, scale: 0.5, zRange: [-10, -14] },
  ],
};

const BackgroundNPCs: React.FC<{
  frame: number;
  fps: number;
  phase: ScenePhase;
  phaseFrame?: number; // accumulated frame across same-phase shots (prevents jump on cut)
}> = ({ frame, fps, phase, phaseFrame }) => {
  const templates = PHASE_NPC_TEMPLATES[phase] ?? PHASE_NPC_TEMPLATES["forex"];
  // Use phaseFrame for position continuity across same-phase shot cuts
  const f = phaseFrame ?? frame;

  const npcs = useMemo(() => {
    const seed = PHASE_NPC_SEEDS[phase] ?? 5555;
    const rng = mulberry32(seed);
    return templates.map((t) => ({
      ...t,
      startX: -6 + rng() * 12,
      z: t.zRange[0] + rng() * (t.zRange[1] - t.zRange[0]),
      direction: rng() > 0.5 ? 1 : -1,
      color: NPC_COLORS[Math.floor(rng() * NPC_COLORS.length)],
      circleRadius: 0.8 + rng() * 1.2,
      circlePhase: rng() * Math.PI * 2,
      zigzagAmp: 0.5 + rng() * 1.0,
      zigzagFreq: 0.02 + rng() * 0.03,
      wanderSeed: Math.floor(rng() * 10000),
      frameOffset: Math.floor(rng() * 500), // stagger start so NPCs don't all begin at origin
      modelUrl: (phase === "forex-intro" || phase === "forex")
        ? CHAR_URLS["dancingGurl"]
        : NPC_MODEL_POOL[Math.floor(rng() * NPC_MODEL_POOL.length)],
    }));
  }, [phase, templates]);

  return (
    <>
      {npcs.map((npc, i) => {
        // Calculate position based on movement pattern
        let x = npc.startX;
        let z = npc.z;
        let rotY = npc.direction > 0 ? -Math.PI / 2 : Math.PI / 2;
        const spd = npc.speed * 0.015;
        // Effective frame: phaseFrame + per-NPC stagger for variety
        const ef = f + npc.frameOffset;

        if (npc.move === "walk" || npc.move === "run") {
          // Wide wrapping range (40 units) so NPCs never visibly teleport
          const raw = npc.startX + ef * spd * npc.direction;
          x = ((raw % 40) + 40) % 40 - 20;
        } else if (npc.move === "circle") {
          const angle = npc.circlePhase + ef * spd * 0.5;
          x = npc.startX + Math.cos(angle) * npc.circleRadius;
          z = npc.z + Math.sin(angle) * npc.circleRadius;
          rotY = angle + Math.PI / 2;
        } else if (npc.move === "zigzag") {
          const raw = npc.startX + ef * spd * npc.direction;
          x = ((raw % 40) + 40) % 40 - 20;
          z = npc.z + Math.sin(ef * npc.zigzagFreq) * npc.zigzagAmp;
        } else if (npc.move === "wander") {
          // Continuous Perlin-like wander using layered sine waves (no resets)
          const s = npc.wanderSeed;
          const wx = Math.sin(ef * 0.008 + s) * 1.5 + Math.sin(ef * 0.003 + s * 2.7) * 0.8;
          const wz = Math.cos(ef * 0.006 + s * 1.3) * 1.0 + Math.cos(ef * 0.0025 + s * 3.1) * 0.6;
          x = npc.startX + wx;
          z = npc.z + wz;
          // Face movement direction
          const dx = Math.cos(ef * 0.008 + s) * 0.008 * 1.5;
          const dz = -Math.sin(ef * 0.006 + s * 1.3) * 0.006 * 1.0;
          rotY = Math.atan2(dx, dz);
        }

        return (
          <SmartCharacter
            key={i}
            modelUrl={npc.modelUrl}
            frame={frame}
            fps={fps}
            position={[x, 0, z]}
            rotationY={rotY}
            scale={npc.scale}
            color={npc.color}
            animationName={npc.anim}
            baseScaleFactor={MODEL_BASE_SCALE[npc.modelUrl] ?? 0.6}
          />
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------------------
// Camera controller
// ---------------------------------------------------------------------------

const CameraController: React.FC<{
  phase: ScenePhase;
  frame: number;
  durationFrames: number;
  phaseFrame?: number;
  phaseDurationFrames?: number;
}> = ({ phase, frame, durationFrames, phaseFrame, phaseDurationFrames }) => {
  const { camera } = useThree();

  useFrame(() => {
    const f = phaseFrame ?? frame;
    const dur = phaseDurationFrames ?? durationFrames;
    const t = Math.min(1, f / Math.max(1, dur));
    const breathe = Math.sin(f * 0.025) * 0.03;
    const ease = t * t * (3 - 2 * t); // smoothstep

    // Reset dutch tilt — prevents leaking between phases
    camera.rotation.z = 0;

    if (phase === "car-lot") {
      // Phase 1: PEACE — Quick orbit into close two-shot of characters talking
      const orbitAngle = -0.6 + ease * 1.3; // -0.6 → 0.7 (OTS behind hero)
      const r = 3.0 - ease * 1.1; // 3.0 → 1.9 (close at end)
      const height = 2.2 - ease * 0.8; // 2.2 → 1.4 (eye level)
      const sway = Math.sin(f * 0.015) * 0.04;
      camera.position.set(
        Math.sin(orbitAngle) * r + sway,
        height + breathe,
        Math.cos(orbitAngle) * r,
      );
      const lookY = 1.4 - ease * 0.2;
      camera.lookAt(-0.1 * ease + sway * 0.3, lookY, 0.2);

    } else if (phase === "forex-intro") {
      // Phase 2: OTS behind hero watching trader — both visible, gentle push-in
      const orbitAngle = 0.15 + ease * 0.15; // subtle sweep (0.15 → 0.3)
      const r = 3.2 - ease * 0.4; // 3.2 → 2.8 push-in
      const drift = Math.sin(f * 0.02) * 0.015;
      camera.position.set(
        Math.sin(orbitAngle) * r + drift,
        1.5 + breathe,
        Math.cos(orbitAngle) * r,
      );
      camera.lookAt(0, 1.0, -0.3);

    } else if (phase === "forex") {
      // Phase 3: CONFIDENCE — Over-shoulder orbit to hero reveal
      const orbitAngle = 0.8 - ease * 0.5; // 0.8 → 0.3
      const r = 2.2 - ease * 0.3; // 2.2 → 1.9
      const y = 1.4 + ease * 0.15; // 1.4 → 1.55 (crane up = power)
      camera.position.set(
        Math.sin(orbitAngle) * r,
        y,
        Math.cos(orbitAngle) * r,
      );
      camera.lookAt(-0.1, 1.2, -1);

    } else if (phase === "stocks-intro") {
      // Phase 4: Gentle orbit behind hero watching trader
      const orbitAngle = 0.1 + ease * 0.3; // 0.1 → 0.4 (subtle sweep, hero stays visible)
      const r = 3.2 - ease * 0.4; // 3.2 → 2.8 push-in
      const swagger = Math.sin(f * 0.03) * 0.015;
      camera.position.set(
        Math.sin(orbitAngle) * r + swagger,
        1.5 + breathe,
        Math.cos(orbitAngle) * r,
      );
      camera.lookAt(-0.1, 1.0, -0.5);

    } else if (phase === "stocks") {
      // Phase 5: PRIDE — Crane UP + push-in
      const y = 1.15 + ease * 0.45; // 1.15 → 1.6
      const z = 2.8 - ease * 0.5; // 2.8 → 2.3
      const xDrift = 1.2 - ease * 0.4; // drift center
      camera.position.set(xDrift, y, z);
      camera.lookAt(0, 1.2, -0.8);

    } else if (phase === "bitcoin-intro") {
      // Phase 6: ORBIT — sweeps from OTS around to behind screens facing hero
      const orbitAngle = 0.4 + ease * 2.4; // 0.4 → 2.8 (~155° sweep)
      const r = 2.8;
      const y = 1.45 - ease * 0.15;
      const vibe = Math.sin(f * 0.08) * 0.008 * (1 + ease);
      camera.position.set(
        Math.sin(orbitAngle) * r + vibe,
        y + breathe,
        Math.cos(orbitAngle) * r,
      );
      camera.lookAt(0, 1.1, -0.3);

    } else if (phase === "bitcoin") {
      // Phase 7: VICTORY (PEAK HUBRIS) — Fast orbit + crane to film peak
      const orbitAngle = 0.35 + ease * 0.3; // 0.35 → 0.65
      const r = 2.5; // tight radius
      const y = 1.35 + ease * 0.35; // 1.35 → 1.7 (FILM PEAK HEIGHT)
      camera.position.set(
        Math.sin(orbitAngle) * r,
        y,
        Math.cos(orbitAngle) * r,
      );
      // Look-at tilts UP — audience looks up at the victor
      camera.lookAt(0, 1.4 + ease * 0.2, -0.8);

    } else if (phase === "goldman") {
      // Phase 8: SHOCK→DEFEAT — Creeping dolly-in + growing shake
      const z = 3.8 - ease * 1.2; // 3.8 → 2.6
      const y = 1.5 - ease * 0.2; // 1.5 → 1.3 (crane DOWN — power shifting)
      const shakeAmt = 0.008 + ease * 0.025; // 0.008 → 0.033
      const shakeX = Math.sin(f * 0.12) * shakeAmt;
      const shakeY = Math.cos(f * 0.15) * shakeAmt * 0.6;
      camera.position.set(
        0.8 + shakeX,
        y + shakeY,
        z,
      );
      // Look-at drifts deeper to BigRobot
      const lookZ = -1.0 - ease * 0.8; // -1.0 → -1.8
      camera.lookAt(0, 1.3, lookZ);

    } else if (phase === "0dte") {
      // Phase 9: MANIA — Frantic handheld + push-pull breathing
      const zBreath = 2.4 + Math.sin(ease * Math.PI * 2) * 0.3; // full breathing cycle
      const shakeX = Math.sin(f * 0.18) * 0.04 + Math.sin(f * 0.07) * 0.02;
      const shakeY = Math.cos(f * 0.22) * 0.03 + Math.cos(f * 0.09) * 0.015;
      camera.position.set(
        1.2 + shakeX,
        1.4 + shakeY,
        zBreath,
      );
      camera.lookAt(0, 1.2, -1);
      camera.rotation.z = Math.sin(f * 0.05) * 0.015; // dutch tilt introduced

    } else if (phase === "ambush") {
      // AMBUSH — Creeping dolly-in + growing shake (copy from goldman)
      const z = 3.8 - ease * 1.2;
      const y = 1.5 - ease * 0.2;
      const shakeAmt = 0.008 + ease * 0.025;
      const shakeX = Math.sin(f * 0.12) * shakeAmt;
      const shakeY = Math.cos(f * 0.15) * shakeAmt * 0.6;
      camera.position.set(0.8 + shakeX, y + shakeY, z);
      const lookZ = -1.0 - ease * 0.8;
      camera.lookAt(0, 1.3, lookZ);

    } else if (phase === "memecoins-solo") {
      // ESCAPE — Chaotic orbit + dutch tilt (copy from memecoins camera)
      const orbitAngle = -0.2 + ease * 0.5;
      const rPulse = 2.8 + Math.sin(ease * Math.PI * 3) * 0.25;
      const triShakeX = Math.sin(f * 0.15) * 0.025 + Math.sin(f * 0.08) * 0.018 + Math.sin(f * 0.23) * 0.012;
      const triShakeY = Math.cos(f * 0.13) * 0.02 + Math.cos(f * 0.19) * 0.015;
      camera.position.set(
        Math.sin(orbitAngle) * rPulse + triShakeX,
        1.5 + triShakeY,
        Math.cos(orbitAngle) * rPulse,
      );
      camera.lookAt(0, 1.1, -0.8);
      const dutchEnvelope = Math.sin(ease * Math.PI);
      camera.rotation.z = Math.sin(f * 0.04) * (0.025 + 0.015 * dutchEnvelope);

    } else if (phase === "memecoins") {
      // Phase 10: CHAOS — Chaotic orbit + pulsing radius + dutch tilt
      const orbitAngle = -0.2 + ease * 0.5; // -0.2 → 0.3
      const rPulse = 2.8 + Math.sin(ease * Math.PI * 3) * 0.25; // pulsing radius
      const triShakeX = Math.sin(f * 0.15) * 0.025 + Math.sin(f * 0.08) * 0.018 + Math.sin(f * 0.23) * 0.012;
      const triShakeY = Math.cos(f * 0.13) * 0.02 + Math.cos(f * 0.19) * 0.015;
      camera.position.set(
        Math.sin(orbitAngle) * rPulse + triShakeX,
        1.5 + triShakeY,
        Math.cos(orbitAngle) * rPulse,
      );
      camera.lookAt(0, 1.1, -0.8);
      // Dutch tilt: base + envelope that peaks mid-shot
      const dutchEnvelope = Math.sin(ease * Math.PI); // peaks at 0.5
      camera.rotation.z = Math.sin(f * 0.04) * (0.025 + 0.015 * dutchEnvelope);

    } else if (phase === "polymarket") {
      // Phase 11: SCHEMING→FRAGILE HOPE — Slow pull-back, stabilizing
      const z = 2.3 + ease * 0.6; // 2.3 → 2.9 (pull back = contemplation)
      const y = 1.5 + ease * 0.15; // 1.5 → 1.65
      const microDrift = Math.sin(f * 0.015) * 0.015;
      camera.position.set(
        0.6 + microDrift,
        y,
        z,
      );
      camera.lookAt(0, 1.2, -1);
      camera.rotation.z = Math.sin(f * 0.02) * 0.005; // near-zero dutch

    } else if (phase === "defeat") {
      // Phase 12: CRUSHED — Low-angle Souls boss + oppressive crane down
      const y = 1.2 - ease * 0.6; // 1.2 → 0.6 (FILM NADIR)
      const z = 3.5 - ease * 0.8; // 3.5 → 2.7
      const shakeAmt1 = 0.035;
      const shakeAmt2 = 0.02;
      const shakeX = Math.sin(f * 0.15) * shakeAmt1 + Math.sin(f * 0.07) * shakeAmt2;
      const shakeY = Math.cos(f * 0.12) * shakeAmt1 * 0.7 + Math.cos(f * 0.09) * shakeAmt2 * 0.5;
      camera.position.set(
        0.3 + shakeX,
        y + shakeY,
        z,
      );
      // Look-at tilts UP to BigRobot — protagonist tiny, threat massive
      camera.lookAt(0, 1.4 + ease * 0.3, -2.5);
      // Dutch tilt grows with despair
      camera.rotation.z = Math.sin(f * 0.04) * (0.02 + ease * 0.02);

    } else if (phase === "return") {
      // Phase 13: RESIGNATION→ACCEPTANCE — Retreating dolly + crane restoration
      const z = 3.5 + ease * 1.5; // 3.5 → 5.0 (retreating)
      const y = 0.8 + ease * 0.5; // 0.8 → 1.3 (rising from defeat nadir)
      // Shake decays to zero — gone by 2/3 mark
      const shakeDecay = Math.max(0, 1 - ease * 1.5);
      const shakeAmt = 0.02 * shakeDecay;
      const shakeX = Math.sin(f * 0.12) * shakeAmt;
      const shakeY = Math.cos(f * 0.1) * shakeAmt * 0.6;
      camera.position.set(
        0.3 + shakeX,
        y + shakeY,
        z,
      );
      camera.lookAt(0, 0.9, 1.5);
      // Dutch tilt: 0.015 → 0 — world rights itself
      camera.rotation.z = Math.sin(f * 0.03) * 0.015 * shakeDecay;

    } else if (phase === "car-lot-final") {
      // Phase 14: WISDOM — Slow purposeful push to AgiArena screens
      const z = 3.5 - ease * 1.8; // 3.5 → 1.7
      const y = 1.1 + ease * 0.25; // 1.1 → 1.35
      const xDrift = 0.3 - ease * 0.3; // drifts to center
      camera.position.set(xDrift, y, z);
      camera.lookAt(0, 1.3, -1);
      // ZERO shake. Near-zero sway. Smoothest camera in the entire film.

    } else if (phase === "car-departure") {
      // Camera orbits around car on the road speeding away
      const carT = Math.min(1, f / Math.max(1, dur));
      const carEase = carT * carT * carT;
      const carX = carEase * 18;
      const carZ = 3.8;
      // Orbit around the car (camera follows car position)
      const orbitAngle = Math.PI * 0.7 - ease * 1.4;
      const r = 3.0 + ease * 2.0;
      const y = 1.0 + ease * 0.5;
      camera.position.set(
        carX * 0.5 + Math.sin(orbitAngle) * r,
        y + breathe,
        carZ + Math.cos(orbitAngle) * r,
      );
      camera.lookAt(carX * 0.6, 0.5, carZ);

    } else {
      // Fallback — gentle push-in
      camera.position.set(
        1.3 + breathe,
        1.5 + breathe * 0.2,
        2.8 - ease * 0.25,
      );
      camera.lookAt(0, 1.2, -1);
    }
  });

  return null;
};



// ---------------------------------------------------------------------------
// Time-of-day lighting per phase
// ---------------------------------------------------------------------------

interface TimeOfDay {
  skyColor: string;
  sunColor: string;
  sunIntensity: number;
  sunPosition: [number, number, number];
  ambientColor: string;
  ambientIntensity: number;
  fillColor: string;
  fillIntensity: number;
  oceanColor: string;
  sandColor: string;
  fog?: { color: string; near: number; far: number };
  ambianceLights?: { pos: [number, number, number]; color: string; intensity: number; distance: number }[];
}

const PHASE_TIME_OF_DAY: Record<ScenePhase, TimeOfDay> = {
  "car-lot": {
    skyColor: "#FFB347",
    sunColor: "#FFD700",
    sunIntensity: 1.8,
    sunPosition: [2, 3, 4],
    ambientColor: "#ffe0b2",
    ambientIntensity: 0.6,
    fillColor: "#ff9800",
    fillIntensity: 0.4,
    oceanColor: "#FF8C00",
    sandColor: "#D4A76A",
  },
  "forex-intro": {
    skyColor: "#87CEEB",
    sunColor: "#fff5e0",
    sunIntensity: 2.0,
    sunPosition: [3, 6, 3],
    ambientColor: "#fffbe6",
    ambientIntensity: 0.7,
    fillColor: "#b8d8f0",
    fillIntensity: 0.5,
    oceanColor: "#1E90FF",
    sandColor: "#C2B280",
  },
  forex: {
    skyColor: "#87CEEB",
    sunColor: "#fff5e0",
    sunIntensity: 2.2,
    sunPosition: [4, 8, 3],
    ambientColor: "#fffbe6",
    ambientIntensity: 0.8,
    fillColor: "#b8d8f0",
    fillIntensity: 0.6,
    oceanColor: "#1E90FF",
    sandColor: "#C2B280",
  },
  "stocks-intro": {
    // Same midday as stocks — watching scene
    skyColor: "#4DA6FF",
    sunColor: "#ffffff",
    sunIntensity: 2.5,
    sunPosition: [0, 10, 2],
    ambientColor: "#e8f0ff",
    ambientIntensity: 0.9,
    fillColor: "#87CEEB",
    fillIntensity: 0.5,
    oceanColor: "#2196F3",
    sandColor: "#C2B280",
  },
  stocks: {
    skyColor: "#4DA6FF",
    sunColor: "#ffffff",
    sunIntensity: 2.5,
    sunPosition: [0, 10, 2],
    ambientColor: "#e8f0ff",
    ambientIntensity: 0.9,
    fillColor: "#87CEEB",
    fillIntensity: 0.5,
    oceanColor: "#2196F3",
    sandColor: "#C2B280",
  },
  "bitcoin-intro": {
    // Same golden hour as bitcoin — watching scene
    skyColor: "#FF8C00",
    sunColor: "#FF6B00",
    sunIntensity: 2.0,
    sunPosition: [-3, 3, 5],
    ambientColor: "#ffd180",
    ambientIntensity: 0.6,
    fillColor: "#ff9800",
    fillIntensity: 0.5,
    oceanColor: "#E65100",
    sandColor: "#D4A76A",
  },
  bitcoin: {
    skyColor: "#FF8C00",
    sunColor: "#FF6B00",
    sunIntensity: 2.0,
    sunPosition: [-3, 3, 5],
    ambientColor: "#ffd180",
    ambientIntensity: 0.6,
    fillColor: "#ff9800",
    fillIntensity: 0.5,
    oceanColor: "#E65100",
    sandColor: "#D4A76A",
  },
  goldman: {
    skyColor: "#2C2C3A",
    sunColor: "#8899aa",
    sunIntensity: 0.4,
    sunPosition: [2, 4, 3],
    ambientColor: "#444455",
    ambientIntensity: 0.3,
    fillColor: "#334455",
    fillIntensity: 0.2,
    oceanColor: "#1a2a3a",
    sandColor: "#7a7060",
    fog: { color: "#1a1a2a", near: 5, far: 20 },
    ambianceLights: [
      { pos: [-4, 1.8, -6], color: "#ff2266", intensity: 2.5, distance: 8 },
      { pos: [4, 1.5, -4], color: "#00ccff", intensity: 2, distance: 8 },
      { pos: [-2, 0.8, 2], color: "#ff00aa", intensity: 1.5, distance: 6 },
      { pos: [5, 2, -8], color: "#ff4422", intensity: 2, distance: 7 },
    ],
  },
  "0dte": {
    // RED PANIC — dark stormy sky, flashing red, fog
    skyColor: "#1a0808",
    sunColor: "#ff1100",
    sunIntensity: 0.6,
    sunPosition: [-4, 2, 4],
    ambientColor: "#3a1010",
    ambientIntensity: 0.25,
    fillColor: "#cc0000",
    fillIntensity: 0.3,
    oceanColor: "#440000",
    sandColor: "#5a3030",
    fog: { color: "#1a0505", near: 4, far: 18 },
    ambianceLights: [
      { pos: [-3, 1.5, -3], color: "#ff0000", intensity: 3, distance: 8 },
      { pos: [3, 1.5, -5], color: "#ff2200", intensity: 2.5, distance: 8 },
      { pos: [0, 1, -8], color: "#cc0000", intensity: 2, distance: 8 },
      { pos: [-5, 0.5, -7], color: "#ff4444", intensity: 1.5, distance: 6 },
    ],
  },
  ambush: {
    // Dark oppressive — copy from goldman
    skyColor: "#2C2C3A",
    sunColor: "#8899aa",
    sunIntensity: 0.4,
    sunPosition: [2, 4, 3],
    ambientColor: "#444455",
    ambientIntensity: 0.3,
    fillColor: "#334455",
    fillIntensity: 0.2,
    oceanColor: "#1a2a3a",
    sandColor: "#7a7060",
    fog: { color: "#1a1a2a", near: 5, far: 20 },
    ambianceLights: [
      { pos: [-4, 1.8, -6], color: "#ff2266", intensity: 2.5, distance: 8 },
      { pos: [4, 1.5, -4], color: "#00ccff", intensity: 2, distance: 8 },
      { pos: [-2, 0.8, 2], color: "#ff00aa", intensity: 1.5, distance: 6 },
      { pos: [5, 2, -8], color: "#ff4422", intensity: 2, distance: 7 },
    ],
  },
  "memecoins-solo": {
    // Dark with neon ambiance — copy from memecoins
    skyColor: "#0a0a1a",
    sunColor: "#334466",
    sunIntensity: 0.2,
    sunPosition: [0, 2, 5],
    ambientColor: "#1a1a2a",
    ambientIntensity: 0.15,
    fillColor: "#002244",
    fillIntensity: 0.1,
    oceanColor: "#0a1a2a",
    sandColor: "#3a3530",
    ambianceLights: [
      { pos: [-3, 1.5, -3], color: "#00ff41", intensity: 3, distance: 8 },
      { pos: [3, 1.5, -5], color: "#ff00ff", intensity: 2.5, distance: 8 },
      { pos: [0, 1, -8], color: "#00ffff", intensity: 2, distance: 8 },
      { pos: [-5, 0.5, -7], color: "#ffff00", intensity: 1.5, distance: 6 },
      { pos: [5, 0.5, -4], color: "#ff4488", intensity: 2, distance: 6 },
    ],
  },
  memecoins: {
    // Robot returns — RED doom atmosphere
    skyColor: "#0a0a1a",
    sunColor: "#334466",
    sunIntensity: 0.2,
    sunPosition: [0, 2, 5],
    ambientColor: "#1a1a2a",
    ambientIntensity: 0.15,
    fillColor: "#002244",
    fillIntensity: 0.1,
    oceanColor: "#0a1a2a",
    sandColor: "#3a3530",
    ambianceLights: [
      { pos: [-3, 1.5, -3], color: "#cc0000", intensity: 3, distance: 8 },
      { pos: [3, 1.5, -5], color: "#ff0033", intensity: 2.5, distance: 8 },
      { pos: [0, 1, -8], color: "#cc0000", intensity: 2, distance: 8 },
      { pos: [-5, 0.5, -7], color: "#ff4444", intensity: 1.5, distance: 6 },
      { pos: [5, 0.5, -4], color: "#ff0033", intensity: 2, distance: 6 },
    ],
  },
  polymarket: {
    skyColor: "#4A2080",
    sunColor: "#CC88FF",
    sunIntensity: 0.8,
    sunPosition: [-2, 2, 4],
    ambientColor: "#6a4a8a",
    ambientIntensity: 0.4,
    fillColor: "#7c3aed",
    fillIntensity: 0.3,
    oceanColor: "#2a1a4a",
    sandColor: "#8a7a6a",
    ambianceLights: [
      { pos: [-4, 1, -4], color: "#7c3aed", intensity: 2, distance: 8 },
      { pos: [4, 1, -6], color: "#a855f7", intensity: 1.5, distance: 6 },
    ],
  },
  defeat: {
    // SOULS BOSS — deep dark, eerie red/purple glow, fog
    skyColor: "#050008",
    sunColor: "#110011",
    sunIntensity: 0.08,
    sunPosition: [0, 2, 5],
    ambientColor: "#0a0008",
    ambientIntensity: 0.06,
    fillColor: "#110022",
    fillIntensity: 0.05,
    oceanColor: "#030008",
    sandColor: "#1a1218",
    fog: { color: "#080010", near: 3, far: 15 },
    ambianceLights: [
      // Boss arena red glow from behind
      { pos: [0, 3, -6], color: "#ff0033", intensity: 4, distance: 12 },
      // Eerie purple side lights
      { pos: [-3, 1, -4], color: "#6600cc", intensity: 2.5, distance: 8 },
      { pos: [3, 1, -4], color: "#6600cc", intensity: 2.5, distance: 8 },
      // Dim fire flicker
      { pos: [-1, 0.3, -2], color: "#ff3300", intensity: 1, distance: 4 },
      { pos: [1, 0.3, -2], color: "#ff3300", intensity: 1, distance: 4 },
    ],
  },
  return: {
    skyColor: "#FFB6C1",
    sunColor: "#FFD4AA",
    sunIntensity: 1.5,
    sunPosition: [3, 3, 5],
    ambientColor: "#ffe4e1",
    ambientIntensity: 0.55,
    fillColor: "#ffb8a0",
    fillIntensity: 0.4,
    oceanColor: "#FF7F50",
    sandColor: "#C8B090",
  },
  "car-lot-final": {
    skyColor: "#FF7F00",
    sunColor: "#FFD700",
    sunIntensity: 2.0,
    sunPosition: [-3, 3, 6],
    ambientColor: "#ffcc80",
    ambientIntensity: 0.65,
    fillColor: "#ff8800",
    fillIntensity: 0.5,
    oceanColor: "#FF6600",
    sandColor: "#D4A76A",
  },
  "car-departure": {
    // Golden sunset — copy from car-lot
    skyColor: "#FFB347",
    sunColor: "#FFD700",
    sunIntensity: 1.8,
    sunPosition: [2, 3, 4],
    ambientColor: "#ffe0b2",
    ambientIntensity: 0.6,
    fillColor: "#ff9800",
    fillIntensity: 0.4,
    oceanColor: "#FF8C00",
    sandColor: "#D4A76A",
  },
};

// ---------------------------------------------------------------------------
// Rain particles (for Goldman stormy scene)
// ---------------------------------------------------------------------------

const RAIN_COUNT = 200;

const Rain: React.FC<{ frame: number }> = ({ frame }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const drops = useMemo(() => {
    const rng = mulberry32(7890);
    return Array.from({ length: RAIN_COUNT }, () => ({
      x: (rng() - 0.5) * 20,
      z: rng() * -20 - 2,
      speed: 0.15 + rng() * 0.15,
      offset: rng() * 100,
    }));
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      const y = 8 - ((frame * d.speed + d.offset) % 10);
      dummy.position.set(d.x, y, d.z);
      dummy.rotation.set(0, 0, 0.1);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, RAIN_COUNT]}>
      <boxGeometry args={[0.01, 0.3, 0.01]} />
      <meshBasicMaterial color="#aabbcc" transparent opacity={0.4} />
    </instancedMesh>
  );
};

// ---------------------------------------------------------------------------
// Lightning / thunder flash (bright white directional burst)
// ---------------------------------------------------------------------------

const Lightning: React.FC<{ frame: number }> = ({ frame }) => {
  // Pre-generate strike frames (every ~25-40 frames)
  const strikes = useMemo(() => {
    const r = mulberry32(4321);
    const s: number[] = [];
    let f = 8 + Math.floor(r() * 15);
    while (f < 300) {
      s.push(f);
      f += 25 + Math.floor(r() * 20);
    }
    return s;
  }, []);

  // Find closest recent strike
  let intensity = 0;
  for (const sf of strikes) {
    const dt = frame - sf;
    if (dt >= 0 && dt < 8) {
      // Sharp spike: frame 0 = full, decays over 8 frames with a secondary flicker
      const primary = Math.max(0, 1 - dt / 4);
      const flicker = dt === 2 || dt === 3 ? 0.6 : 0; // secondary flash
      intensity = Math.max(intensity, primary + flicker);
    }
  }

  if (intensity <= 0) return null;

  return (
    <>
      {/* Overhead directional flash */}
      <directionalLight
        position={[0, 10, -3]}
        intensity={intensity * 8}
        color="#ccccff"
      />
      {/* Ambient flash fill */}
      <ambientLight intensity={intensity * 2} color="#eeeeff" />
    </>
  );
};

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Inner scene — beach environment
// ---------------------------------------------------------------------------

const TradingJourneyScene: React.FC<{
  phase: ScenePhase;
  frame: number;
  fps: number;
  durationFrames: number;
  config: PhaseConfig;
  phaseFrame?: number;
  phaseDurationFrames?: number;
}> = ({ phase, frame, fps, durationFrames, config, phaseFrame, phaseDurationFrames }) => {
  const tod = PHASE_TIME_OF_DAY[phase] ?? PHASE_TIME_OF_DAY["forex"];
  const { config: quality } = useQuality();

  // NOTE: scene.background and scene.fog are set in PersistentSceneSetup
  // (outside Suspense) to avoid black flashes during phase transitions.

  return (
    <>
      {/* Phase-specific lighting */}
      <ambientLight intensity={tod.ambientIntensity} color={tod.ambientColor} />
      <directionalLight
        position={tod.sunPosition}
        intensity={tod.sunIntensity}
        color={tod.sunColor}
        castShadow={quality.shadows && tod.sunIntensity > 0.5}
        shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-2}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-3, 4, 2]} intensity={tod.fillIntensity} color={tod.fillColor} />


      {/* Screen accent light */}
      {config.hasDesk && (
        <pointLight
          position={[0, 1.2, -0.8]}
          intensity={1.0}
          color={config.accentColor}
          distance={5}
          decay={2}
        />
      )}

      {/* Night ambiance lights */}
      {tod.ambianceLights?.map((light, i) => (
        <pointLight
          key={`amb-${i}`}
          position={light.pos}
          intensity={light.intensity}
          color={light.color}
          distance={light.distance}
          decay={2}
        />
      ))}

      {/* Rain for stormy scenes (Goldman + ambush + memecoins + defeat) */}
      {quality.rain && (phase === "goldman" || phase === "0dte" || phase === "ambush" || phase === "memecoins" || phase === "defeat") && <Rain frame={frame} />}

      {/* Lightning/thunder for panic phases */}
      {quality.lightning && (phase === "0dte" || phase === "ambush" || phase === "memecoins") && <Lightning frame={frame} />}

      <CameraController
        phase={phase}
        frame={frame}
        durationFrames={durationFrames}
        phaseFrame={phaseFrame}
        phaseDurationFrames={phaseDurationFrames}
      />

      {/* Sand floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color={tod.sandColor} roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Ocean — main body */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.25, -25]}>
        <planeGeometry args={[80, 30]} />
        {quality.oceanPhysics
          ? <meshPhysicalMaterial color={tod.oceanColor} roughness={0.1} metalness={0.3} transparent opacity={0.88} envMapIntensity={0.8} />
          : <meshStandardMaterial color={tod.oceanColor} roughness={0.3} transparent opacity={0.85} />
        }
      </mesh>
      {/* Shore foam line — white frothy edge where water meets sand */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, -9.5]}>
        <planeGeometry args={[40, 1.2]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.25} />
      </mesh>
      {/* Shallow water — lighter, more transparent near shore */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, -7]}>
        <planeGeometry args={[40, 6]} />
        {quality.oceanPhysics
          ? <meshPhysicalMaterial color={tod.oceanColor} roughness={0.15} metalness={0.2} transparent opacity={0.5} envMapIntensity={0.6} />
          : <meshStandardMaterial color={tod.oceanColor} roughness={0.3} transparent opacity={0.45} />
        }
      </mesh>

      {/* Trading desk + 4 monitors */}
      {config.hasDesk && (
        <TradingSetup frame={frame} phase={phase} config={config} />
      )}

      {/* City environment — buildings, road, neon, palms, sky plane, road car */}
      <CityEnvironment
        isDark={
          phase === "goldman" || phase === "ambush" || phase === "memecoins-solo" ||
          phase === "memecoins" || phase === "polymarket" || phase === "defeat"
        }
        frame={frame}
        totalFrames={durationFrames}
        hasDesk={config.hasDesk}
      />



      {/* Car — dynamic position for car-departure, static otherwise */}
      {config.hasCar && (() => {
        if (phase === "car-departure") {
          const carT = Math.min(1, frame / Math.max(1, durationFrames));
          const carEase = carT * carT * carT;
          // Car is already on the road, just speeding away along +X
          const carX = carEase * 18;
          const carZ = 3.8; // on the road
          return (
            <group>
              <SimpleCar position={[carX, 0, carZ]} />

              {/* Headlights/taillights removed — daytime sunset scene */}

              {/* Tire marks — trail BEHIND the car from its start position */}
              {carT > 0.03 && (() => {
                const markEnd = Math.max(0, carX - 1.0);
                const markOpacity = Math.min(0.6, carT * 4);
                return markEnd > 0.1 ? (
                  <>
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[markEnd / 2, 0.003, carZ + 0.25]}>
                      <planeGeometry args={[markEnd, 0.05]} />
                      <meshBasicMaterial color="#222222" transparent opacity={markOpacity} />
                    </mesh>
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[markEnd / 2, 0.003, carZ - 0.25]}>
                      <planeGeometry args={[markEnd, 0.05]} />
                      <meshBasicMaterial color="#222222" transparent opacity={markOpacity} />
                    </mesh>
                  </>
                ) : null;
              })()}

              {/* Dust cloud at launch point */}
              {carT > 0.02 && carT < 0.6 && Array.from({ length: 8 }).map((_, i) => {
                const pRng = mulberry32(7700 + i);
                const dustLife = carT * 3;
                const pX = -0.5 + pRng() * 1.0;
                const pY = 0.02 + dustLife * 0.08 + pRng() * 0.05;
                const pZ = carZ + (pRng() - 0.5) * 0.6;
                const pScale = 0.15 + dustLife * 0.2;
                const pOpacity = Math.max(0, 0.35 - dustLife * 0.25);
                return (
                  <mesh key={`dust-${i}`} position={[pX, pY, pZ]} rotation={[-Math.PI / 2, 0, pRng() * Math.PI]}>
                    <circleGeometry args={[pScale, 8]} />
                    <meshBasicMaterial color="#a89272" transparent opacity={pOpacity} side={2} />
                  </mesh>
                );
              })}
            </group>
          );
        }
        return <SimpleCar position={[0, 0, -0.5]} />;
      })()}

      {/* Parking lot ground for car-lot phases */}
      {config.hasCar && (
        <>
          {/* Parking lot asphalt — compact area around the car */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
            <planeGeometry args={[8, 4]} />
            <meshStandardMaterial color="#3a3a3a" roughness={0.95} metalness={0.05} />
          </mesh>
          {/* Access road connecting parking to main road */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 3]}>
            <planeGeometry args={[10, 2.5]} />
            <meshStandardMaterial color="#3a3a3a" roughness={0.95} metalness={0.05} />
          </mesh>
          {/* Parking bay lines — vertical stripes marking each space */}
          {[-3.5, -2, -0.5, 1, 2.5].map((x, i) => (
            <mesh key={`pline-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, -0.005, 0]}>
              <planeGeometry args={[0.06, 3.8]} />
              <meshStandardMaterial color="#e8e8e8" roughness={0.8} />
            </mesh>
          ))}
          {/* Front border line */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.5, -0.005, 1.9]}>
            <planeGeometry args={[6.06, 0.06]} />
            <meshStandardMaterial color="#e8e8e8" roughness={0.8} />
          </mesh>
          {/* Back border line */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.5, -0.005, -1.9]}>
            <planeGeometry args={[6.06, 0.06]} />
            <meshStandardMaterial color="#e8e8e8" roughness={0.8} />
          </mesh>

          {/* 3D "I ♥ MIAMI" sign on the ground */}
          <Suspense fallback={null}>
            <group position={[-2.2, 0, -3.5]}>
              {/* "I" — white 3D letter */}
              <Text3D
                font={staticFile("shorts/short-02/fonts/helvetiker_bold.typeface.json")}
                size={0.9}
                height={0.2}
                position={[0, 0, 0]}
                bevelEnabled
                bevelThickness={0.02}
                bevelSize={0.01}
              >
                I
                <meshStandardMaterial color="#f5f5f5" roughness={0.15} metalness={0.05} />
              </Text3D>
              {/* 3D Heart model — red */}
              <HeartSign />
              {/* "MIAMI" — white 3D letters */}
              <Text3D
                font={staticFile("shorts/short-02/fonts/helvetiker_bold.typeface.json")}
                size={0.9}
                height={0.2}
                position={[1.4, 0, 0]}
                bevelEnabled
                bevelThickness={0.02}
                bevelSize={0.01}
              >
                MIAMI
                <meshStandardMaterial color="#f5f5f5" roughness={0.15} metalness={0.05} />
              </Text3D>
            </group>
          </Suspense>
        </>
      )}

      {/* Protagonist — CasualMan model (hidden immediately in car-departure) */}
      {(() => {
        const t = durationFrames > 0 ? Math.min(frame / durationFrames, 1) : 0;
        // Car-departure: character is already in the car, hide immediately
        if (phase === "car-departure") return null;
        const isMoving = config.protagonistAnim === "running" || config.protagonistAnim === "walking";
        const [bx, by, bz] = config.protagonistPosition;

        // Moving phases: move the character forward over the shot duration
        let posX = bx;
        let posZ = bz;
        let rotY = config.protagonistRotation;
        // Return phase: walk toward car, then switch to entering-car
        let animOverride: string | null = null;
        if (isMoving) {
          if (phase === "return") {
            // Smooth walk toward car (slower ease for walking pace)
            const walkEase = t * t * (3 - 2 * t); // smoothstep
            posZ = bz - walkEase * 3.0; // 3.5 → 0.5
            // Last 25% of return phase: smooth transition to car door
            if (t > 0.75) {
              animOverride = "entering-car";
              const doorT = (t - 0.75) / 0.25; // 0→1 over last quarter
              const doorEase = doorT * doorT * (3 - 2 * doorT); // smoothstep
              const walkPosX = bx; // where walk had them on X
              const walkPosZ = bz - walkEase * 3.0; // where walk would put them on Z
              posX = walkPosX + (-0.35 - walkPosX) * doorEase; // lerp X to car door
              posZ = walkPosZ + (0.5 - walkPosZ) * doorEase; // lerp Z to car door
              rotY = config.protagonistRotation + (Math.PI * 0.5 - config.protagonistRotation) * doorEase;
            }
          } else {
            posX = bx + (t - 0.5) * 1.2;
            posZ = bz + Math.sin(t * Math.PI) * 0.4;
          }
        }
        return (
          <MixamoCharacter
            modelUrl={CHAR_URLS[PROTAGONIST]}
            animName={animOverride ?? config.protagonistAnim}
            frame={frame}
            fps={fps}
            position={[posX, by, posZ]}
            rotationY={rotY}
            scale={1}
            color={PROTAGONIST_COLOR}
            baseScaleFactor={CHARACTERS[PROTAGONIST].baseScale}
            handProp={phase === "car-lot" ? "phone" : undefined}
            stripRootMotion={isMoving}
          />
        );
      })()}

      {/* Other character (shows in intro scenes) */}
      {config.showOther && (() => {
        const oPos = config.otherPosition;
        const oRot = config.otherRotation;
        return (
          <SmartCharacter
            modelUrl={CHAR_URLS[OTHER_CHARACTER]}
            frame={frame}
            fps={fps}
            position={oPos}
            rotationY={oRot}
            scale={0.95}
            animationName={config.otherAnim}
            baseScaleFactor={CHARACTERS[OTHER_CHARACTER].baseScale}
          />
        );
      })()}

      {/* Creepy RobotExpressive behind monitors (Goldman/defeat phases) */}
      {config.showBigRobot && <BigRobot frame={frame} fps={fps} phase={phase} durationFrames={durationFrames} />}

      {/* Background NPC walkers (unique pattern per phase) */}
      {quality.npcs && <BackgroundNPCs frame={frame} fps={fps} phase={phase} phaseFrame={phaseFrame} />}
    </>
  );
};

// ---------------------------------------------------------------------------
// Persistent scene setup — outside Suspense to prevent black flashes
// ---------------------------------------------------------------------------

const PersistentSceneSetup: React.FC<{ phase: ScenePhase }> = ({ phase }) => {
  const { scene } = useThree();
  const { config: quality } = useQuality();
  const tod = PHASE_TIME_OF_DAY[phase] ?? PHASE_TIME_OF_DAY["forex"];
  // Memoize color/fog to avoid creating new objects every render
  const bgColor = useMemo(() => new THREE.Color(tod.skyColor), [tod.skyColor]);
  useEffect(() => {
    scene.background = bgColor;
    if (quality.fog && tod.fog) {
      scene.fog = new THREE.Fog(tod.fog.color, tod.fog.near, tod.fog.far);
    } else if (scene.fog) {
      scene.fog = null;
    }
  }, [scene, bgColor, tod.fog, quality.fog]);
  return null;
};

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

export const TradingJourney3D: React.FC<{
  phase: string;
  overrideFrame?: number;
  overrideDuration?: number;
  phaseFrame?: number;
  phaseDurationFrames?: number;
}> = ({ phase: rawPhase, overrideFrame, overrideDuration, phaseFrame, phaseDurationFrames }) => {
  const hookFrame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const frame = overrideFrame ?? hookFrame;
  const duration = overrideDuration ?? durationInFrames;
  const phase = (rawPhase || "car-lot") as ScenePhase;
  const config = PHASE_CONFIG[phase] ?? PHASE_CONFIG["car-lot"];
  const { config: quality } = useQuality();

  // Grain noise for dark oppressive scenes — deterministic per-frame noise via SVG filter
  const isStormy = phase === "goldman" || phase === "ambush" || phase === "memecoins" || phase === "defeat";

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{
          fov: 45,
          near: 0.1,
          far: 50,
          position: [1.3, 1.5, 3],
        }}
        gl={{
          antialias: quality.antialias,
          alpha: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: quality.toneMappingExposure,
        }}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <PersistentSceneSetup phase={phase} />
        {quality.bloom && (
        <Effects multisamping={4} disableGamma>
          <unrealBloomPass args={[undefined, quality.bloomStrength, 0.6, 0.88]} />
        </Effects>
        )}
        <Suspense fallback={null}>
          <TradingJourneyScene
            phase={phase}
            frame={frame}
            fps={fps}
            durationFrames={duration}
            config={config}
            phaseFrame={phaseFrame}
            phaseDurationFrames={phaseDurationFrames}
          />
        </Suspense>
      </ThreeCanvas>

      {/* Grey desaturation overlay for stormy/defeat scenes */}
      {quality.desaturation && isStormy && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundColor: "rgba(30, 30, 30, 0.35)",
            mixBlendMode: "saturation",
          }}
        />
      )}
      {/* Film grain overlay for stormy scenes (Goldman/defeat) */}
      {quality.filmGrain && isStormy && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' seed='42' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: "128px 128px",
            opacity: 0.15,
            mixBlendMode: "overlay",
          }}
        />
      )}
    </AbsoluteFill>
  );
};
