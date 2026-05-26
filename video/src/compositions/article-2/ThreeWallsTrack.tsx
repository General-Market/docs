import React from "react";
import { interpolate } from "remotion";
import { C, EASE, font, monoFont, FPS, W, H, sec, PILL_GRADIENT } from "../batch-flow/theme";
import {
  Stage,
  FIELD_BG,
  glassPanel,
  glassCard,
  CaptionPill,
  BeatTitle,
} from "../batch-flow/chrome";

// The Three Walls share one engine: a wide board the camera rides over, the
// batch-flow chrome (navy backlight + floating glass panel), and one set of
// helpers. Each wall lays its stations out in board coordinates and writes a
// camera(frame) → {x, scale}; the camera is the narrator and there are no cuts.

export { C, EASE, font, monoFont, FPS, W, H, sec, PILL_GRADIENT };
export { Stage, FIELD_BG, glassPanel, glassCard, CaptionPill, BeatTitle };

// ── helpers ───────────────────────────────────────────────────────────────────
export const ci = (
  frame: number,
  a: number,
  b: number,
  from: number,
  to: number,
  easing?: (t: number) => number,
): number =>
  interpolate(frame, [a, b], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));

// A deterministic PRNG so every render of a frame is identical.
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── face states ────────────────────────────────────────────────────────────────
// The three expressions a chip can wear. Green won, red lost, amber unsure.
export const FACE = {
  happy: "#1FB877",
  unhappy: "#F2566B",
  neutral: "#E8A13A",
} as const;
export type FaceState = keyof typeof FACE;

// ── camera ──────────────────────────────────────────────────────────────────
// Where the board point under the viewport centre sits, and at what zoom.
export type Cam = { x: number; y?: number; scale: number };

// Glide a camera through keyframed focal points and scales. Times are frames.
// The eases off each mark and settles soft — the hand-led whiteboard pan.
export const camAt = (
  frame: number,
  keys: { t: number; x: number; y?: number; scale: number }[],
  easing: (t: number) => number = EASE.inOut,
): Cam => {
  const ts = keys.map((k) => k.t);
  const xs = keys.map((k) => k.x);
  const ys = keys.map((k) => k.y ?? H / 2);
  const ss = keys.map((k) => k.scale);
  const opt = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const, easing };
  return {
    x: interpolate(frame, ts, xs, opt),
    y: interpolate(frame, ts, ys, opt),
    scale: interpolate(frame, ts, ss, opt),
  };
};

// ── TrackBoard ────────────────────────────────────────────────────────────────
// The wide surface. Children are placed in board coordinates; the board is
// translated and scaled so the camera's focal point lands at the viewport
// centre. An optional flow spine runs the length of the track. The dot lattice
// is painted here so the whole board shares one ground.
export const TrackBoard: React.FC<{
  width: number;
  height?: number;
  cam: Cam;
  spine?: { x1: number; x2: number; y: number } | null;
  children: React.ReactNode;
}> = ({ width, height = H, cam, spine = null, children }) => {
  const scale = cam.scale;
  const fx = cam.x;
  const fy = cam.y ?? H / 2;
  const tx = W / 2 - fx * scale;
  const ty = H / 2 - fy * scale;
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
        transformOrigin: "0 0",
        transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${scale.toFixed(5)})`,
        willChange: "transform",
        background: FIELD_BG,
        backgroundImage:
          "radial-gradient(circle, rgba(0,113,227,0.22) 1.2px, transparent 1.5px)",
        backgroundSize: "14px 14px",
      }}
    >
      {spine ? (
        <div
          style={{
            position: "absolute",
            left: spine.x1,
            top: spine.y - 1,
            width: spine.x2 - spine.x1,
            height: 2,
            background:
              "linear-gradient(90deg, rgba(0,113,227,0.3), rgba(158,123,255,0.3))",
            opacity: 0.45,
          }}
        />
      ) : null}
      {children}
    </div>
  );
};

// ── HeroNumber ─────────────────────────────────────────────────────────────────
// The big gradient counter for the scale moments (100k → 1B, money back to
// traders). tabular figures so the digits don't jitter as they climb.
export const heroNumberStyle = (size: number): React.CSSProperties => ({
  fontFamily: font,
  fontSize: size,
  fontWeight: 800,
  letterSpacing: "-0.035em",
  lineHeight: 0.95,
  fontVariantNumeric: "tabular-nums",
  background: PILL_GRADIENT,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  filter: "drop-shadow(0 14px 36px rgba(94,120,255,0.4))",
});

export const commas = (n: number): string => Math.round(n).toLocaleString("en-US");
