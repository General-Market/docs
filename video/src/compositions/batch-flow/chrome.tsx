import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C, EASE, EDGE, font, PILL_GRADIENT, W, H } from "./theme";

// ─── Glass helpers ──────────────────────────────────────────────────────────
//
// Translucent fills only — no nested backdrop-filter. The window (below) is the
// single element that blurs the video; everything inside reads as glass against
// that frosted ground.

export const glassPanel = (radius = 18): React.CSSProperties => ({
  background:
    "linear-gradient(160deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.48) 100%)",
  border: "1px solid rgba(255,255,255,0.72)",
  borderRadius: radius,
  boxShadow:
    "0 12px 32px rgba(70,74,140,0.16), inset 0 1px 0 rgba(255,255,255,0.9)",
});

export const glassCard = (radius = 16): React.CSSProperties => ({
  background:
    "linear-gradient(160deg, rgba(255,255,255,0.66) 0%, rgba(255,255,255,0.40) 100%)",
  border: "1px solid rgba(255,255,255,0.6)",
  borderRadius: radius,
  boxShadow:
    "0 8px 24px rgba(70,74,140,0.13), inset 0 1px 0 rgba(255,255,255,0.82)",
});

// ─── Points network ──────────────────────────────────────────────────────
//
// A white ground carrying a field of blue points joined by thin lines — a
// plexus. Every node drifts along a fixed heading, and the distance it has
// travelled grows with the SQUARE of time, so the whole field accelerates:
// near-still at the open, brisk by the climax. Positions are a closed form of
// the frame, so any frame renders identically without state.

const NODES = 90;
const LINK_DIST = 220; // px — draw a line between points closer than this
const BASE_SPEED = 6; // px/s at t=0
const ACCEL = 0.38; // px/s² — the acceleration the brief asks for

const POINT_BLUE = "#0071E3";
const POINT_BRIGHT = "#2997ff";
const POINT_VIOLET = "#6E5BFF";

const mulberry32 = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const wrap = (v: number, m: number): number => ((v % m) + m) % m;

type PNode = { x: number; y: number; r: number; color: string };

const PointsNetwork: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  // Distance travelled under constant acceleration: v0·t + ½·a·t².
  const travel = BASE_SPEED * t + 0.5 * ACCEL * t * t;
  // Bleed past the edges so wrapping points enter/exit off-screen, not at the
  // visible border.
  const MX = 160;
  const fieldW = W + MX * 2;
  const fieldH = H + MX * 2;

  const nodes: PNode[] = [];
  for (let i = 0; i < NODES; i++) {
    const rnd = mulberry32((i + 1) * 2654435761);
    const x0 = rnd() * fieldW;
    const y0 = rnd() * fieldH;
    const ang = rnd() * Math.PI * 2;
    const spd = 0.55 + rnd() * 0.9; // per-node speed multiplier
    const pick = rnd();
    const color = pick > 0.82 ? POINT_VIOLET : pick > 0.5 ? POINT_BRIGHT : POINT_BLUE;
    const x = wrap(x0 + Math.cos(ang) * travel * spd, fieldW) - MX;
    const y = wrap(y0 + Math.sin(ang) * travel * spd, fieldH) - MX;
    nodes.push({ x, y, r: 1.8 + rnd() * 2.6, color });
  }

  const lines: React.ReactNode[] = [];
  for (let i = 0; i < NODES; i++) {
    for (let j = i + 1; j < NODES; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const d = Math.hypot(dx, dy);
      if (d >= LINK_DIST) continue;
      const op = (1 - d / LINK_DIST) * 0.42;
      lines.push(
        <line
          key={`${i}-${j}`}
          x1={nodes[i].x}
          y1={nodes[i].y}
          x2={nodes[j].x}
          y2={nodes[j].y}
          stroke="#1F7DEC"
          strokeWidth={1}
          opacity={op}
        />,
      );
    }
  }

  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity }}>
      <g>{lines}</g>
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r={n.r * 3} fill={n.color} opacity={0.1} />
          <circle cx={n.x} cy={n.y} r={n.r} fill={n.color} opacity={0.95} />
        </g>
      ))}
    </svg>
  );
};

// ─── Stage ────────────────────────────────────────────────────────────────
//
// The shared ground for every beat: a white field with the accelerating blue
// points network behind, and a faint center-bright vignette so the content
// reads clean while the plexus lives at the edges. Beats render in full
// 1920×1080 space on top.

export const Stage: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: "#FFFFFF", fontFamily: font }}>
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(120% 110% at 50% 42%, #FFFFFF 0%, #FBFCFE 55%, #EEF3FB 100%)",
      }}
    />
    <PointsNetwork />
    {/* center-bright veil — keeps the middle clean, plexus reads at the edges */}
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(70% 62% at 50% 48%, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.30) 48%, rgba(255,255,255,0) 78%)",
        pointerEvents: "none",
      }}
    />
    {children}
  </AbsoluteFill>
);

// ─── useFade ────────────────────────────────────────────────────────────────
//
// Beat envelope — fade in over the head, hold, fade out over the tail, so
// beats cross-dissolve over the persistent window.

export const useFade = (durationInFrames: number): number => {
  const frame = useCurrentFrame();
  return interpolate(
    frame,
    [0, EDGE, durationInFrames - EDGE, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
};

// ─── CaptionPill ────────────────────────────────────────────────────────────
//
// A floating lower caption — a frosted glass pill, used over the full-bleed
// product shots where a top title would cover the UI.

export const CaptionPill: React.FC<{ text: string; delay?: number; accent?: string }> = ({
  text,
  delay = 10,
  accent = C.text,
}) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame - delay, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame - delay, [0, 14], [14, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });
  return (
    <div
      style={{
        position: "absolute",
        bottom: 40,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        opacity: op,
        transform: `translateY(${y.toFixed(1)}px)`,
      }}
    >
      <div
        style={{
          ...glassPanel(999),
          padding: "15px 36px",
          boxShadow: "0 18px 44px rgba(58,62,130,0.24), inset 0 1px 0 rgba(255,255,255,0.9)",
          fontFamily: font,
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: accent,
        }}
      >
        {text}
      </div>
    </div>
  );
};

// ─── BeatTitle ────────────────────────────────────────────────────────────
//
// The reel's voice: a blue→violet gradient pill (the reference's label style),
// with an optional dim subtitle below it. Top-centered.

export const BeatTitle: React.FC<{
  title: string;
  sub?: string;
  delay?: number;
  size?: number;
}> = ({ title, sub, delay = 2, size = 46 }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame - delay, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame - delay, [0, 16], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });
  return (
    <div
      style={{
        position: "absolute",
        top: 58,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: op,
        transform: `translateY(${y.toFixed(1)}px)`,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "16px 40px",
          borderRadius: 999,
          background: PILL_GRADIENT,
          boxShadow:
            "0 16px 40px rgba(94,120,255,0.42), 0 4px 14px rgba(0,113,227,0.30), inset 0 1px 0 rgba(255,255,255,0.5)",
          fontFamily: font,
          fontSize: size,
          fontWeight: 800,
          letterSpacing: "-0.01em",
          color: "#fff",
          lineHeight: 1.0,
          whiteSpace: "nowrap",
          textShadow: "0 1px 2px rgba(40,40,90,0.28)",
        }}
      >
        {title}
      </div>
      {sub ? (
        <div
          style={{
            marginTop: 16,
            fontFamily: font,
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: C.dim,
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};
