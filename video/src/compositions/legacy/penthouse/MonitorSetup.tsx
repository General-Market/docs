import React, { useMemo } from "react";
import * as THREE from "three";
import {
  drawCandlestick,
  drawLineChart,
  drawOrderBook,
  drawTerminal,
  drawHeatMap,
  drawPortfolio,
} from "./MonitorTextures";

// ── Types ───────────────────────────────────────────────────────────────────
type MonitorVariant =
  | "candle1"
  | "candle2"
  | "candle3"
  | "line"
  | "orderbook"
  | "terminal"
  | "heatmap"
  | "portfolio";

interface MonitorDef {
  pos: [number, number, number];
  rot: [number, number, number];
  w: number;
  h: number;
  variant: MonitorVariant;
  glowColor: string;
  delay: number;
  texW?: number;
  texH?: number;
}

// ── 6 monitors arranged along the curved desk arc ──────────────────────────
// Desk params: pivotZ=0.8, rInner=1.3, rOuter=2.55, arcDeg=120
// Monitors placed at rMonitor=2.3 (80% from inner to outer) along the arc.
// Stand base sits on desk surface at y=0.76.
// Screen center y = 0.76 + standHeight + screenH/2 ≈ 1.06
const PIVOT_Z = 0.8;
const R_MONITOR = 2.3;

function monitorArcPos(angleDeg: number, y: number): [number, number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [
    R_MONITOR * Math.sin(a),
    y,
    -R_MONITOR * Math.cos(a) + PIVOT_Z,
  ];
}

export const MONITORS: MonitorDef[] = [
  // Far left — heatmap
  {
    pos: monitorArcPos(-48, 1.06),
    rot: [0, 0.838, 0],
    w: 0.52,
    h: 0.34,
    variant: "heatmap",
    glowColor: "#F59E0B",
    delay: 5,
  },
  // Left — terminal
  {
    pos: monitorArcPos(-28, 1.06),
    rot: [0, 0.489, 0],
    w: 0.52,
    h: 0.34,
    variant: "terminal",
    glowColor: "#FFD700",
    delay: 0,
  },
  // Center-left — candlestick 1
  {
    pos: monitorArcPos(-9, 1.06),
    rot: [0, 0.157, 0],
    w: 0.52,
    h: 0.34,
    variant: "candle1",
    glowColor: "#3B82F6",
    delay: 2,
  },
  // Center-right — candlestick 2 (main, slightly larger)
  {
    pos: monitorArcPos(9, 1.07),
    rot: [0, -0.157, 0],
    w: 0.56,
    h: 0.36,
    variant: "candle2",
    glowColor: "#8B5CF6",
    delay: 1,
    texW: 600,
    texH: 420,
  },
  // Right — order book
  {
    pos: monitorArcPos(28, 1.06),
    rot: [0, -0.489, 0],
    w: 0.52,
    h: 0.34,
    variant: "orderbook",
    glowColor: "#00e676",
    delay: 3,
  },
  // Far right — candlestick 3
  {
    pos: monitorArcPos(48, 1.06),
    rot: [0, -0.838, 0],
    w: 0.52,
    h: 0.34,
    variant: "candle3",
    glowColor: "#22D3EE",
    delay: 4,
  },
];

// ── MonitorScreen with fixes ────────────────────────────────────────────────
const MonitorScreen: React.FC<{ def: MonitorDef; frame: number }> = ({
  def,
  frame,
}) => {
  const canvasRef = useMemo(() => {
    // Guard: in SSR or environments where document is not available
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = def.texW ?? 512;
    c.height = def.texH ?? 384;
    return c;
  }, [def.texW, def.texH]);

  const texture = useMemo(() => {
    if (!canvasRef) return null;
    const t = new THREE.CanvasTexture(canvasRef);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  }, [canvasRef]);

  // Draw to canvas if context is available
  if (canvasRef && texture) {
    const ctx = canvasRef.getContext("2d");
    if (ctx) {
      const tw = canvasRef.width;
      const th = canvasRef.height;
      const adjustedFrame = Math.max(0, frame - def.delay);

      switch (def.variant) {
        case "candle1":
          drawCandlestick(ctx, tw, th, adjustedFrame, 42);
          break;
        case "candle2":
          drawCandlestick(ctx, tw, th, adjustedFrame, 88);
          break;
        case "candle3":
          drawCandlestick(ctx, tw, th, adjustedFrame, 156);
          break;
        case "line":
          drawLineChart(ctx, tw, th, adjustedFrame, 77, "#3B82F6");
          break;
        case "orderbook":
          drawOrderBook(ctx, tw, th, adjustedFrame, 123);
          break;
        case "terminal":
          drawTerminal(ctx, tw, th, adjustedFrame);
          break;
        case "heatmap":
          drawHeatMap(ctx, tw, th, adjustedFrame);
          break;
        case "portfolio":
          drawPortfolio(ctx, tw, th, adjustedFrame);
          break;
      }
      texture.needsUpdate = true;
    }
  }

  // Faster startup animation — reduced flicker duration, starts earlier
  const flickerStart = 2 + def.delay;
  const flickerEnd = flickerStart + 8;
  let opacity: number;
  if (frame < flickerStart) {
    opacity = 0.15; // Dim glow instead of full black
  } else if (frame < flickerEnd) {
    const t = frame - flickerStart;
    // Faster flicker pattern — reaches full brightness sooner
    const pattern = [0.3, 0.7, 0.4, 0.9, 1, 0.8, 1, 1];
    opacity = pattern[Math.min(t, pattern.length - 1)];
  } else {
    opacity = 1;
  }

  const emissiveIntensity =
    opacity * (1.5 + Math.sin(frame * 0.05 + def.delay) * 0.1);

  // Bezel dimensions — thin, modern bezels
  const bezelW = 0.02;

  return (
    <group position={def.pos} rotation={def.rot}>
      {/* Bezel — thin and sleek */}
      <mesh position={[0, 0, -0.012]}>
        <boxGeometry args={[def.w + bezelW, def.h + bezelW, 0.02]} />
        <meshStandardMaterial
          color="#111116"
          roughness={0.15}
          metalness={0.75}
        />
      </mesh>

      {/* Slim back panel */}
      <mesh position={[0, 0, -0.025]}>
        <boxGeometry args={[def.w + bezelW - 0.01, def.h + bezelW - 0.01, 0.01]} />
        <meshStandardMaterial
          color="#0c0c10"
          roughness={0.4}
          metalness={0.5}
        />
      </mesh>

      {/* Screen surface */}
      {texture && (
        <mesh>
          <planeGeometry args={[def.w, def.h]} />
          <meshStandardMaterial
            map={texture}
            emissiveMap={texture}
            emissive={new THREE.Color("#ffffff")}
            emissiveIntensity={emissiveIntensity}
            roughness={0.1}
            metalness={0.0}
            transparent
            opacity={opacity}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* Screen glow light — increased intensity */}
      {opacity > 0.3 && (
        <pointLight
          position={[0, 0, 0.35]}
          color={def.glowColor}
          intensity={0.8 * opacity}
          distance={2.5}
          decay={2}
        />
      )}

      {/* Desk reflection — subtle colored light pointing down */}
      {opacity > 0.3 && (
        <pointLight
          position={[0, -def.h / 2 - 0.15, 0.08]}
          color={def.glowColor}
          intensity={0.25 * opacity}
          distance={1.0}
          decay={2}
        />
      )}

      {/* Monitor stand — slim modern neck */}
      <mesh position={[0, -def.h / 2 - 0.06, -0.016]}>
        <boxGeometry args={[0.03, 0.12, 0.03]} />
        <meshStandardMaterial
          color="#111116"
          roughness={0.15}
          metalness={0.75}
        />
      </mesh>

      {/* Stand base — thin modern oval base */}
      <mesh position={[0, -def.h / 2 - 0.125, 0.02]}>
        <cylinderGeometry args={[0.08, 0.09, 0.008, 20]} />
        <meshStandardMaterial
          color="#111116"
          roughness={0.15}
          metalness={0.75}
        />
      </mesh>
    </group>
  );
};

// ── MonitorSetup — renders all 6 monitors ───────────────────────────────────
export const MonitorSetup: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <>
      {MONITORS.map((def, i) => (
        <MonitorScreen key={i} def={def} frame={frame} />
      ))}
    </>
  );
};
