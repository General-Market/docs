/**
 * ArchitectureDiagram — premium fintech architecture schematic.
 *
 * 10x visual upgrade: glass cards, 4-pass edges, multi-particle flow,
 * pulse-ring dot grid, bokeh background, 4-phase entrance choreography,
 * 5 ambient effect systems.
 *
 * All layout engine, edge geometry, lerpPath, types preserved.
 * `instant` and `light` flags fully respected.
 */

import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  AbsoluteFill,
  Img,
  staticFile,
} from "remotion";
import { noise2D } from "@remotion/noise";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import type { ArchitectureDiagramConfig, ArchDiagramTiming } from "../types";

const { fontFamily } = loadInter("normal", {
  subsets: ["latin"],
  weights: ["400", "600", "700"],
});

// ── Constants ─────────────────────────────────────────────────────────

const DEFAULT_TIMING: ArchDiagramTiming = {
  nodeEntranceDuration: 14,
  nodeStagger: 8,
  edgeDelay: 4,
  edgeDrawDuration: 15,
  particleDelay: 4,
};

const NODE_W = 420;
const NODE_H = 72;
const NODE_RX = 10;
const ACCENT_BAR_W = 4;
const NODE_GAP_Y = 112;
const TOP_PAD = 300;
const DOT_GRID = 48;

// ── Helpers ───────────────────────────────────────────────────────────

function hex(c: string, a: number): string {
  const h = c.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function hexRgb(c: string): [number, number, number] {
  const h = c.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

// ── Layout engine ─────────────────────────────────────────────────────

interface NodePos {
  id: string;
  x: number;
  y: number;
  order: number;
}

function layoutNodes(config: ArchitectureDiagramConfig, W: number): Map<string, NodePos> {
  const positions = new Map<string, NodePos>();
  const { nodes, edges } = config;
  const topPad = config.topPad ?? TOP_PAD;

  const outgoing = new Map<string, string[]>();
  for (const e of edges) {
    const list = outgoing.get(e.from) || [];
    list.push(e.to);
    outgoing.set(e.from, list);
  }

  const incoming = new Map<string, number>();
  for (const n of nodes) incoming.set(n.id, 0);
  for (const e of edges) {
    if (!e.curved) incoming.set(e.to, (incoming.get(e.to) || 0) + 1);
  }

  const queue: string[] = [];
  for (const n of nodes) {
    if ((incoming.get(n.id) || 0) === 0) queue.push(n.id);
  }
  const order: string[] = [];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    order.push(id);
    for (const to of outgoing.get(id) || []) {
      const edge = edges.find((e) => e.from === id && e.to === to);
      if (edge?.curved) continue;
      const count = (incoming.get(to) || 1) - 1;
      incoming.set(to, count);
      if (count === 0) queue.push(to);
    }
  }
  for (const n of nodes) {
    if (!visited.has(n.id)) order.push(n.id);
  }

  let row = 0;
  let entranceIdx = 0;
  const placed = new Set<string>();

  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    if (placed.has(id)) continue;

    const siblings = findSiblings(id, outgoing, edges, placed);

    if (siblings.length > 1) {
      const gap = 36;
      const totalW = siblings.length * NODE_W + (siblings.length - 1) * gap;
      const startX = (W - totalW) / 2;
      for (let s = 0; s < siblings.length; s++) {
        positions.set(siblings[s], {
          id: siblings[s],
          x: startX + s * (NODE_W + gap) + NODE_W / 2,
          y: topPad + row * NODE_GAP_Y,
          order: entranceIdx++,
        });
        placed.add(siblings[s]);
      }
    } else {
      positions.set(id, {
        id,
        x: W / 2,
        y: topPad + row * NODE_GAP_Y,
        order: entranceIdx++,
      });
      placed.add(id);
    }
    row++;
  }

  return positions;
}

function findSiblings(
  id: string,
  outgoing: Map<string, string[]>,
  edges: { from: string; to: string; curved?: boolean }[],
  placed: Set<string>,
): string[] {
  const parentEdge = edges.find((e) => e.to === id && !e.curved);
  if (!parentEdge) return [id];
  const parentId = parentEdge.from;
  const children = (outgoing.get(parentId) || []).filter((to) => {
    const edge = edges.find((e) => e.from === parentId && e.to === to);
    return !edge?.curved && !placed.has(to);
  });
  return children.length >= 2 ? children : [id];
}

// ── Edge geometry ─────────────────────────────────────────────────────

function edgePath(from: NodePos, to: NodePos, curved: boolean): string {
  const y1 = from.y + NODE_H / 2;
  const y2 = to.y - NODE_H / 2;

  if (curved) {
    const off = 240;
    return `M ${from.x + NODE_W / 2} ${from.y} C ${from.x + off} ${from.y - 80}, ${to.x + off} ${to.y - 80}, ${to.x + NODE_W / 2} ${to.y}`;
  }
  if (Math.abs(from.x - to.x) < 5) {
    return `M ${from.x} ${y1} L ${to.x} ${y2}`;
  }
  const midY = (y1 + y2) / 2;
  return `M ${from.x} ${y1} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${y2}`;
}

function approxLen(d: string): number {
  const parts = d.split(/[MLCQ]/g).filter(Boolean);
  const pts: [number, number][] = [];
  for (const p of parts) {
    const nums = p.trim().split(/[\s,]+/).map(Number);
    for (let i = 0; i < nums.length - 1; i += 2) pts.push([nums[i], nums[i + 1]]);
  }
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return len * 1.3;
}

function lerpPath(from: NodePos, to: NodePos, curved: boolean, t: number): [number, number] {
  if (curved) {
    const x0 = from.x + NODE_W / 2, y0 = from.y;
    const x3 = to.x + NODE_W / 2, y3 = to.y;
    const c1x = x0 + 240, c1y = y0 - 80, c2x = x3 + 240, c2y = y3 - 80;
    const u = 1 - t;
    return [
      u ** 3 * x0 + 3 * u ** 2 * t * c1x + 3 * u * t ** 2 * c2x + t ** 3 * x3,
      u ** 3 * y0 + 3 * u ** 2 * t * c1y + 3 * u * t ** 2 * c2y + t ** 3 * y3,
    ];
  }
  const y1 = from.y + NODE_H / 2, y2 = to.y - NODE_H / 2;
  return [from.x + (to.x - from.x) * t, y1 + (y2 - y1) * t];
}

// Arrowhead at path endpoint — returns polygon points string
function arrowHead(from: NodePos, to: NodePos, curved: boolean, size: number): string {
  const t1 = lerpPath(from, to, curved, 0.97);
  const t2 = lerpPath(from, to, curved, 1.0);
  const dx = t2[0] - t1[0];
  const dy = t2[1] - t1[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const tip = t2;
  const left: [number, number] = [tip[0] - ux * size + px * size * 0.4, tip[1] - uy * size + py * size * 0.4];
  const right: [number, number] = [tip[0] - ux * size - px * size * 0.4, tip[1] - uy * size - py * size * 0.4];
  return `${tip[0]},${tip[1]} ${left[0]},${left[1]} ${right[0]},${right[1]}`;
}

// ── Component ─────────────────────────────────────────────────────────

interface Props {
  config: ArchitectureDiagramConfig;
}

export const ArchitectureDiagram: React.FC<Props> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const tm = { ...DEFAULT_TIMING, ...config.timing };
  const positions = React.useMemo(() => layoutNodes(config, W), [config, W]);
  const nodeMap = new Map(config.nodes.map((n) => [n.id, n]));
  const light = !!config.light;
  const instant = !!config.instant;

  // Smooth global fade-in (instant: fully visible)
  const opacity = instant ? 1 : interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Scale transform — scale from horizontal center
  const s = config.nodeScale ?? 1;
  const tx = (W / 2) * (1 - s);
  const contentTransform = s !== 1 ? `translate(${tx}, 0) scale(${s})` : undefined;

  // Compute diagram center (for pulse rings)
  const allPos = Array.from(positions.values());
  const centerX = allPos.length > 0 ? allPos.reduce((s, p) => s + p.x, 0) / allPos.length : W / 2;
  const centerY = allPos.length > 0 ? allPos.reduce((s, p) => s + p.y, 0) / allPos.length : H / 2;

  // Last node entrance frame (for scan sweep timing)
  const lastEnterEnd = allPos.reduce((mx, p) => Math.max(mx, p.order * tm.nodeStagger + tm.nodeEntranceDuration), 0);

  // Node colors for bokeh
  const nodeColors = config.nodes.map((n) => n.color);
  const bokehColor1 = nodeColors[0] ?? "#4F46E5";
  const bokehColor3 = nodeColors[Math.min(2, nodeColors.length - 1)] ?? "#0891B2";
  const bokehNeutral = light ? "#94A3B8" : "#475569";

  return (
    <AbsoluteFill style={{ opacity }}>
      {!config.transparentBg && (
        <AbsoluteFill style={{ backgroundColor: light ? "#FFFFFF" : "#0B0D14" }} />
      )}

      {/* ── C. Bokeh blobs (HTML layer behind SVG) ── */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {[bokehColor1, bokehColor3, bokehNeutral].map((col, bi) => {
          const bx = noise2D("bkx" + bi, frame * 0.003, bi * 10) * 120 + W * (0.25 + bi * 0.25);
          const by = noise2D("bky" + bi, bi * 10, frame * 0.003) * 80 + H * (0.3 + bi * 0.15);
          const radius = 280 + bi * 60;
          const [r, g, b] = hexRgb(col);
          const bOpacity = light ? 0.02 : 0.04;
          return (
            <div
              key={`bokeh-${bi}`}
              style={{
                position: "absolute",
                left: bx - radius,
                top: by - radius,
                width: radius * 2,
                height: radius * 2,
                borderRadius: "50%",
                background: `radial-gradient(circle, rgba(${r},${g},${b},${bOpacity}) 0%, transparent 70%)`,
                filter: "blur(80px)",
              }}
            />
          );
        })}
      </div>

      {/* Header logo + label */}
      {config.headerLogo && (
        <div
          style={{
            position: "absolute",
            top: config.headerLogo.topY ?? 200,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            zIndex: 1,
          }}
        >
          <Img
            src={staticFile(config.headerLogo.src)}
            style={{
              width: config.headerLogo.width ?? 280,
              objectFit: "contain",
            }}
          />
          {config.headerLogo.label && (
            <div
              style={{
                fontFamily: "'Switzer', 'Inter', sans-serif",
                fontSize: config.headerLogo.labelSize ?? 28,
                fontWeight: 700,
                color: config.headerLogo.labelColor ?? "#1a1a2e",
                textAlign: "center",
                letterSpacing: 1,
              }}
            >
              {config.headerLogo.label}
            </div>
          )}
        </div>
      )}

      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", top: 0, left: 0 }}>
        <defs>
          {/* ── SVG Filters ── */}
          <filter id="ad-blur-xl" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="24" />
          </filter>
          <filter id="ad-blur-md" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" />
          </filter>
          <filter id="ad-blur-sm" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
          </filter>
          <filter id="ad-dot-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* ── Per-node gradients ── */}
          {config.nodes.map((node) => {
            const [r, g, b] = hexRgb(node.color);
            return (
              <React.Fragment key={`defs-${node.id}`}>
                {/* Card fill gradient (glass) */}
                <linearGradient id={`card-fill-${node.id}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={light ? "#FAFBFF" : "#121626"} />
                  <stop offset="100%" stopColor={light ? "#EEF2FC" : "#0a0d16"} />
                </linearGradient>
                {/* Gradient border (glassmorphism) */}
                <linearGradient id={`border-grad-${node.id}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={`rgba(${r},${g},${b},${light ? 0.5 : 0.4})`} />
                  <stop offset="100%" stopColor={`rgba(${r},${g},${b},${light ? 0.12 : 0.08})`} />
                </linearGradient>
                {/* Accent bar gradient */}
                <linearGradient id={`accent-bar-${node.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={`rgba(${r},${g},${b},0.9)`} />
                  <stop offset="100%" stopColor={`rgba(${r},${g},${b},0.5)`} />
                </linearGradient>
              </React.Fragment>
            );
          })}

          {/* Scan sweep gradient */}
          <linearGradient id="scan-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="40%" stopColor={light ? "rgba(79,70,229,0.15)" : "rgba(79,70,229,0.25)"} />
            <stop offset="50%" stopColor={light ? "rgba(79,70,229,0.3)" : "rgba(79,70,229,0.5)"} />
            <stop offset="60%" stopColor={light ? "rgba(79,70,229,0.15)" : "rgba(79,70,229,0.25)"} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        <g transform={contentTransform}>

        {/* ── C. Pulse ring dot grid ── */}
        {(() => {
          const dots: React.ReactNode[] = [];
          // Two concentric rings expanding outward
          const ring1Radius = ((frame * 3.5) % 1200);
          const ring2Radius = (((frame * 2.8) + 400) % 1200);

          for (let x = DOT_GRID; x < W; x += DOT_GRID) {
            for (let y = DOT_GRID; y < H; y += DOT_GRID) {
              const dist = Math.hypot(x - centerX, y - centerY);
              // Proximity to either ring wavefront
              const prox1 = Math.max(0, 1 - Math.abs(dist - ring1Radius) / 60);
              const prox2 = Math.max(0, 1 - Math.abs(dist - ring2Radius) / 60);
              const glow = Math.max(prox1, prox2);

              const baseAlpha = light ? 0.06 : 0.03;
              const alpha = baseAlpha + glow * 0.55;
              const r = 1 + glow * 2.5;
              const fill = light
                ? `rgba(0,0,0,${alpha})`
                : `rgba(255,255,255,${alpha})`;

              dots.push(
                <circle key={`g${x}-${y}`} cx={x} cy={y} r={r} fill={fill} />,
              );
            }
          }
          return dots;
        })()}

        {/* ── D. Scan sweep line (entrance choreography phase 1) ── */}
        {!instant && frame < lastEnterEnd + 10 && (() => {
          const sweepY = interpolate(frame, [0, lastEnterEnd], [
            (allPos[0]?.y ?? TOP_PAD) - 60,
            (allPos[allPos.length - 1]?.y ?? TOP_PAD + 400) + 60,
          ], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const sweepOp = interpolate(frame, [lastEnterEnd, lastEnterEnd + 10], [0.8, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <rect
              x={0}
              y={sweepY - 2}
              width={W}
              height={4}
              fill="url(#scan-sweep)"
              opacity={sweepOp}
            />
          );
        })()}

        {/* ── D. Alignment guides (entrance choreography phase 2) ── */}
        {!instant && config.nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const enterAt = pos.order * tm.nodeStagger;
          const guideStart = Math.max(0, enterAt - 6);
          const guideMid = Math.max(guideStart + 1, enterAt);
          const guideOp = interpolate(frame, [
            guideStart, guideMid, guideMid + tm.nodeEntranceDuration,
          ], [0, 0.15, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          if (guideOp <= 0) return null;
          return (
            <line
              key={`guide-${node.id}`}
              x1={W * 0.15}
              y1={pos.y}
              x2={W * 0.85}
              y2={pos.y}
              stroke={light ? "rgba(79,70,229,0.2)" : "rgba(79,70,229,0.3)"}
              strokeWidth={0.5}
              strokeDasharray="6 4"
              opacity={guideOp}
            />
          );
        })}

        {/* ── B. Edges (4-pass rendering + multi-particle flow) ── */}
        {config.edges.map((edge, ei) => {
          const fp = positions.get(edge.from);
          const tp = positions.get(edge.to);
          if (!fp || !tp) return null;

          const d = edgePath(fp, tp, !!edge.curved);
          const len = approxLen(d);

          const srcDone = fp.order * tm.nodeStagger + tm.nodeEntranceDuration;
          const eStart = srcDone + tm.edgeDelay;
          const eEnd = eStart + tm.edgeDrawDuration;

          const draw = instant ? 1 : interpolate(frame, [eStart, eEnd], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const dashOff = len * (1 - draw);

          const color = nodeMap.get(edge.from)?.color ?? "#555";

          // Edge pulse breathing (never synchronized)
          const breathe = 1 + Math.sin(frame * 0.04 + ei * 0.9) * 0.15;

          // Arrowhead fades in at 80% draw progress
          const arrowOp = interpolate(draw, [0.8, 1], [0, 0.6], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          // Multi-particle flow: 3 particles per edge
          const dotStart = instant ? 0 : eEnd + tm.particleDelay;
          const dotActive = frame >= dotStart;

          return (
            <g key={`e${ei}`}>
              {/* Pass 1: Deep glow — color bleed */}
              <path
                d={d}
                fill="none"
                stroke={hex(color, (light ? 0.06 : 0.10) * breathe)}
                strokeWidth={16}
                strokeLinecap="round"
                strokeDasharray={len}
                strokeDashoffset={dashOff}
                filter="url(#ad-blur-md)"
              />
              {/* Pass 2: Mid bloom — fiber optic glow */}
              <path
                d={d}
                fill="none"
                stroke={hex(color, (light ? 0.12 : 0.18) * breathe)}
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={len}
                strokeDashoffset={dashOff}
                filter="url(#ad-blur-sm)"
              />
              {/* Pass 3: Main line — crisp wire */}
              <path
                d={d}
                fill="none"
                stroke={hex(color, light ? 0.5 : 0.4)}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeDasharray={len}
                strokeDashoffset={dashOff}
              />
              {/* Pass 4: Core highlight — premium fiber optic core */}
              <path
                d={d}
                fill="none"
                stroke={light ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.20)"}
                strokeWidth={0.5}
                strokeLinecap="round"
                strokeDasharray={len}
                strokeDashoffset={dashOff}
              />

              {/* Directional arrowhead */}
              {draw > 0.8 && (
                <polygon
                  points={arrowHead(fp, tp, !!edge.curved, 12)}
                  fill={hex(color, arrowOp)}
                />
              )}

              {/* D. Connection spark — white flash at destination on edge complete */}
              {!instant && (() => {
                const sparkFrame = eEnd;
                const sparkLife = frame - sparkFrame;
                if (sparkLife < 0 || sparkLife > 4) return null;
                const sparkR = interpolate(sparkLife, [0, 4], [4, 20]);
                const sparkOp = interpolate(sparkLife, [0, 4], [0.6, 0]);
                return (
                  <circle
                    cx={tp.x}
                    cy={tp.y}
                    r={sparkR}
                    fill="none"
                    stroke={light ? "rgba(79,70,229,0.5)" : "rgba(255,255,255,0.5)"}
                    strokeWidth={1.5}
                    opacity={sparkOp}
                  />
                );
              })()}

              {/* 3 data-flow particles per edge */}
              {dotActive && [0, 0.33, 0.66].map((phaseOff, pi) => {
                const period = 55 + ei * 5 + noise2D("ep" + ei, pi, 0) * 15;
                const dotT = ((frame - dotStart + phaseOff * period) % period) / period;
                const [px, py] = lerpPath(fp, tp, !!edge.curved, dotT);
                return (
                  <g key={`p${ei}-${pi}`} filter="url(#ad-dot-glow)">
                    {/* Halo */}
                    <circle cx={px} cy={py} r={5} fill={hex(color, 0.15)} />
                    {/* Mid */}
                    <circle cx={px} cy={py} r={3} fill={hex(color, 0.5)} />
                    {/* Core */}
                    <circle cx={px} cy={py} r={1.5} fill={light ? "#333" : "#fff"} opacity={0.9} />
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* ── A. Nodes (9-layer premium glass cards) ── */}
        {config.nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;

          const enterAt = pos.order * tm.nodeStagger;
          const progress = instant ? 1 : spring({
            frame: Math.max(0, frame - enterAt),
            fps,
            config: { damping: 28, stiffness: 220, mass: 1 },
            durationInFrames: tm.nodeEntranceDuration,
          });

          const settled = instant || frame > enterAt + tm.nodeEntranceDuration + 4;

          // Enhanced breathing: noise drift + secondary sine envelope
          const noiseDx = settled ? noise2D("nx" + node.id, frame * 0.008, 0) * 1.5 : 0;
          const noiseDy = settled ? noise2D("ny" + node.id, 0, frame * 0.008) * 1 : 0;
          const sineEnv = settled ? Math.sin(frame * 0.015 + pos.order * 1.1) * 0.4 : 0;
          const dx = noiseDx * (1 + sineEnv);
          const dy = noiseDy * (1 + sineEnv);

          const op = instant ? 1 : interpolate(progress, [0, 0.4], [0, 1], { extrapolateRight: "clamp" });
          const sc = instant ? 1 : interpolate(progress, [0, 1], [0.92, 1]);
          const slideY = instant ? 0 : interpolate(progress, [0, 1], [24, 0]);

          const cx = pos.x + dx;
          const cy = pos.y + slideY + dy;
          const hw = NODE_W / 2;
          const hh = NODE_H / 2;

          const [cr, cg, cb] = hexRgb(node.color);

          // Status dot pulse with phase stagger
          const pulsePhase = (frame * 0.06 + pos.order * 1.3) % (Math.PI * 2);
          const pulseR = 8 + Math.sin(pulsePhase) * 3;
          const pulseOp = 0.15 + Math.sin(pulsePhase) * 0.1;

          // Ambient glow blob breathing
          const glowBreath = settled
            ? 0.7 + noise2D("glow" + node.id, frame * 0.01, 0) * 0.3
            : 0;

          return (
            <g
              key={node.id}
              transform={`translate(${cx},${cy}) scale(${sc})`}
              opacity={op}
            >
              {/* Layer 1: Ambient glow blob */}
              <ellipse
                cx={0}
                cy={0}
                rx={NODE_W * 0.4}
                ry={NODE_H * 0.8}
                fill={`rgba(${cr},${cg},${cb},${(light ? 0.04 : 0.07) * glowBreath})`}
                filter="url(#ad-blur-xl)"
              />

              {/* Layer 2: Card shadow */}
              <rect
                x={-hw + 4}
                y={-hh + 6}
                width={NODE_W}
                height={NODE_H}
                rx={NODE_RX}
                fill="rgba(0,0,0,0.4)"
                filter="url(#ad-blur-md)"
              />

              {/* Layer 3: Card fill (per-node gradient) */}
              <rect
                x={-hw}
                y={-hh}
                width={NODE_W}
                height={NODE_H}
                rx={NODE_RX}
                fill={`url(#card-fill-${node.id})`}
              />

              {/* Layer 4: Gradient border (glassmorphism) */}
              <rect
                x={-hw}
                y={-hh}
                width={NODE_W}
                height={NODE_H}
                rx={NODE_RX}
                fill="none"
                stroke={`url(#border-grad-${node.id})`}
                strokeWidth={1}
              />

              {/* Layer 5: Glass highlights — top + left inner edge */}
              <line
                x1={-hw + NODE_RX}
                y1={-hh + 0.5}
                x2={hw - NODE_RX}
                y2={-hh + 0.5}
                stroke={light ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.12)"}
                strokeWidth={1}
              />
              <line
                x1={-hw + 0.5}
                y1={-hh + NODE_RX}
                x2={-hw + 0.5}
                y2={hh - NODE_RX}
                stroke={light ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.06)"}
                strokeWidth={1}
              />

              {/* Layer 6: Accent bar (vertical gradient) */}
              <rect
                x={-hw}
                y={-hh}
                width={ACCENT_BAR_W}
                height={NODE_H}
                rx={2}
                fill={`url(#accent-bar-${node.id})`}
              />

              {/* Layer 7: Subtitle chip (badge background) */}
              {(() => {
                const subText = node.subtitle.toUpperCase();
                const chipW = subText.length * 6.5 + 12;
                const chipX = -hw + ACCENT_BAR_W + 34;
                const chipY = 9;
                return (
                  <rect
                    x={chipX}
                    y={chipY}
                    width={chipW}
                    height={16}
                    rx={4}
                    fill={light
                      ? `rgba(${cr},${cg},${cb},0.08)`
                      : `rgba(${cr},${cg},${cb},0.12)`
                    }
                  />
                );
              })()}

              {/* Layer 8: Label + text shadow */}
              <text
                x={-hw + ACCENT_BAR_W + 37}
                y={-5}
                textAnchor="start"
                fontFamily={fontFamily}
                fontSize={21}
                fontWeight={700}
                fill={light ? "rgba(26,26,46,0.08)" : "rgba(0,0,0,0.08)"}
                letterSpacing={0.5}
              >
                {node.label}
              </text>
              <text
                x={-hw + ACCENT_BAR_W + 36}
                y={-6}
                textAnchor="start"
                fontFamily={fontFamily}
                fontSize={21}
                fontWeight={700}
                fill={light ? "#1a1a2e" : "#FFFFFF"}
                letterSpacing={0.5}
              >
                {node.label}
              </text>

              {/* Subtitle */}
              <text
                x={-hw + ACCENT_BAR_W + 40}
                y={21}
                textAnchor="start"
                fontFamily="monospace"
                fontSize={10}
                fill={hex(node.color, light ? 0.7 : 0.55)}
                letterSpacing={0.6}
              >
                {node.subtitle.toUpperCase()}
              </text>

              {/* Layer 9: Status dot — 3-layer + animated pulse ring */}
              <g transform={`translate(${-hw + ACCENT_BAR_W + 20}, 0)`}>
                {/* Pulse ring (animated) */}
                <circle
                  cx={0}
                  cy={0}
                  r={pulseR}
                  fill="none"
                  stroke={`rgba(${cr},${cg},${cb},${pulseOp})`}
                  strokeWidth={0.8}
                />
                {/* Outer ring */}
                <circle cx={0} cy={0} r={8} fill={`rgba(${cr},${cg},${cb},0.1)`} />
                {/* Mid */}
                <circle cx={0} cy={0} r={5.5} fill={hex(node.color, 0.4)} />
                {/* Core */}
                <circle cx={0} cy={0} r={2.5} fill={node.color} />
              </g>

              {/* D. Landing burst — expanding ring on spring completion */}
              {!instant && (() => {
                const burstStart = enterAt + tm.nodeEntranceDuration;
                const burstLife = frame - burstStart;
                if (burstLife < 0 || burstLife > 5) return null;
                const burstR = interpolate(burstLife, [0, 5], [10, 50]);
                const burstOp = interpolate(burstLife, [0, 5], [0.35, 0]);
                return (
                  <circle
                    cx={0}
                    cy={0}
                    r={burstR}
                    fill="none"
                    stroke={`rgba(${cr},${cg},${cb},${burstOp})`}
                    strokeWidth={1.5}
                  />
                );
              })()}
            </g>
          );
        })}

        {/* ── E. Micro-particles (12 tiny dots following noise paths) ── */}
        {(() => {
          const particles: React.ReactNode[] = [];
          for (let i = 0; i < 12; i++) {
            const px = noise2D("mpx" + i, frame * 0.005, i * 7) * (W * 0.4) + W * 0.5;
            const py = noise2D("mpy" + i, i * 7, frame * 0.005) * (H * 0.3) + centerY;

            // Find nearest node color
            let nearDist = Infinity;
            let nearColor = light ? "#94A3B8" : "#475569";
            for (const pos of allPos) {
              const nd = Math.hypot(px - pos.x, py - pos.y);
              if (nd < nearDist) {
                nearDist = nd;
                nearColor = nodeMap.get(pos.id)?.color ?? nearColor;
              }
            }

            const mAlpha = 0.15 + noise2D("mpa" + i, frame * 0.01, 0) * 0.1;
            const mSize = 1 + noise2D("mps" + i, 0, frame * 0.01) * 0.8;

            particles.push(
              <circle
                key={`mp-${i}`}
                cx={px}
                cy={py}
                r={mSize}
                fill={hex(nearColor, mAlpha)}
              />,
            );
          }
          return particles;
        })()}

        </g>
      </svg>

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: light
            ? "radial-gradient(ellipse at 50% 40%, transparent 50%, rgba(0,0,0,0.08) 100%)"
            : "radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(0,0,0,0.4) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
