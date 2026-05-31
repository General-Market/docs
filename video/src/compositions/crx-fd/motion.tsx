import React from "react";
import { interpolate, spring } from "remotion";
import { C, FPS } from "./theme";

export const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const ci = (f: number, a: number, b: number, x: number, y: number, e?: (t: number) => number): number =>
  interpolate(f, [a, b], [x, y], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });
export const cubicOut = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);

// ── Fling — the SettleDiagram signature: an element is thrown into place on a
//    spring rebound, smeared by motion blur as it travels, then settles. Never a
//    plain slide-fade. dir picks the throw vector.
export const Fling: React.FC<{
  local: number;
  delay?: number;
  from?: [number, number];
  config?: { damping: number; stiffness: number; mass: number };
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ local, delay = 0, from = [0, 34], config = { damping: 13, stiffness: 150, mass: 0.7 }, children, style }) => {
  const l = local - delay;
  if (l < -2) return null;
  const s = spring({ frame: Math.max(0, l), fps: FPS, config });
  const x = lerp(from[0], 0, s);
  const y = lerp(from[1], 0, s);
  const op = ci(l, 0, 8, 0, 1);
  const blur = ci(l, 0, 22, 6, 0);
  return (
    <div
      style={{
        ...style,
        opacity: op,
        transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`,
        filter: blur > 0.12 ? `blur(${blur.toFixed(1)}px)` : undefined,
        willChange: "transform, filter",
      }}
    >
      {children}
    </div>
  );
};

// ── Stamp — scale overshoot, the way the YES/NO chip lands ────────────────────
export const Stamp: React.FC<{
  local: number;
  delay?: number;
  config?: { damping: number; stiffness: number; mass: number };
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ local, delay = 0, config = { damping: 11, stiffness: 170, mass: 0.7 }, children, style }) => {
  const l = local - delay;
  if (l < -2) return null;
  const s = spring({ frame: Math.max(0, l), fps: FPS, config });
  const op = ci(l, 0, 7, 0, 1);
  return (
    <div style={{ ...style, opacity: op, transform: `scale(${s.toFixed(3)})`, transformOrigin: "center", willChange: "transform" }}>
      {children}
    </div>
  );
};

// ── Bloom — soft radial light behind a focal point ────────────────────────────
export const Bloom: React.FC<{ x: number; y: number; r: number; color: string; op: number }> = ({ x, y, r, color, op }) =>
  op <= 0.01 ? null : (
    <div
      style={{
        position: "absolute",
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, transparent 68%)`,
        opacity: op,
        filter: "blur(10px)",
        pointerEvents: "none",
      }}
    />
  );

// ── RingPop — a ring of light expands and fades from a point ──────────────────
export const RingPop: React.FC<{ x: number; y: number; local: number; delay?: number; color?: string; max?: number }> = ({
  x,
  y,
  local,
  delay = 0,
  color = C.teal,
  max = 2.8,
}) => {
  const l = local - delay;
  if (l < 0 || l > 30) return null;
  const t = clamp01(l / 27);
  const scale = lerp(0.5, max, cubicOut(t));
  const op = ci(l, 0, 5, 0, 0.55) * ci(l, 5, 27, 1, 0);
  return (
    <div style={{ position: "absolute", left: x - 40, top: y - 40, width: 80, height: 80, pointerEvents: "none" }}>
      <div style={{ width: 80, height: 80, borderRadius: "50%", border: `3px solid ${color}`, transform: `scale(${scale.toFixed(2)})`, opacity: op }} />
    </div>
  );
};

// ── arrival emphasis — a quick scale pop when the camera lands on a beat ──────
export const pop = (frame: number, at: number, amp = 0.05, dur = 18): number => {
  const d = frame - at;
  if (d < 0 || d > dur) return 1;
  return 1 + amp * Math.sin((d / dur) * Math.PI);
};
// a 0→1→0 flash for blooms/rings on arrival
export const flash = (frame: number, at: number, dur = 26): number => {
  const d = frame - at;
  if (d < 0 || d > dur) return 0;
  return Math.sin((d / dur) * Math.PI);
};

// ── a gentle continuous breathing value, loop-safe over `period` frames ───────
export const breathe = (frame: number, period: number, amp = 1, phase = 0): number =>
  Math.sin(((frame / period) * Math.PI * 2) + phase) * amp;

// ── camera punch + shake around a board frame (the click-land feel) ───────────
export const punchAt = (frame: number, at: number, amp = 0.05, shake = 12): { scale: number; sx: number; sy: number } => {
  const d = frame - at;
  const scale = ci(frame, at - 1, at + 3, 1, 1 + amp) * ci(frame, at + 3, at + 30, 1, 1 / (1 + amp));
  const a = ci(d, 0, 1, 0, shake) * ci(d, 1, 9, 1, 0);
  return { scale, sx: Math.sin(d * 16.5) * a, sy: Math.cos(d * 21.3) * a * 0.6 };
};
