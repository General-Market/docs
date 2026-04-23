/**
 * WiseSparkleSpiral — animated particle spiral, adapted from WebGLPicks/GsapStagger.
 *
 * 99 green lens-flare sparkles spiral inward on a transparent canvas.
 * All colors from the Wise green palette. Sits in the behindWebcam layer.
 */

import React, { useRef, useEffect, useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

const PARTICLE_COUNT = 99;
const ANIM_DURATION = 5; // seconds per cycle
const STAGGER_EACH = -0.05;
const SEEK_TIME = 99; // jump into the running timeline
const FLAIR_SIZE = 120;

const ext = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function sineInOut(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// ── Wise green palette — 21 shades ─────────────────────────────────────────

const FLAIR_COLORS: string[] = [
  "#9fe870", // wiseGreen
  "#cdffad", // pastelGreen
  "#b8f089", // wise light
  "#e2f6d5", // lightMint
  "#10B981", // emerald
  "#34D399", // teal
  "#6ee7b7", // soft emerald
  "#a7f3d0", // pale emerald
  "#86efac", // green-300
  "#4ade80", // green-400
  "#22c55e", // green-500
  "#16a34a", // green-600
  "#059669", // emerald-600
  "#047857", // emerald-700
  "#bbf7d0", // green-200
  "#dcfce7", // green-100
  "#84cc16", // lime-500
  "#a3e635", // lime-400
  "#bef264", // lime-300
  "#d9f99d", // lime-200
  "#9fe870", // wiseGreen (cycle)
];

// ── Particle data ───────────────────────────────────────────────────────────

interface Particle {
  colorIdx: number;
  staggerOffset: number;
  x0: number;
  y0: number;
}

function buildParticles(radius: number): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2 - Math.PI / 2;
    out.push({
      colorIdx: i % 21,
      staggerOffset: i * STAGGER_EACH,
      x0: Math.cos(angle * 10) * radius,
      y0: Math.sin(angle * 10) * radius,
    });
  }
  return out;
}

function getParticleState(
  p: Particle,
  globalTime: number,
): { x: number; y: number; scale: number; rotate: number } {
  const localTime = globalTime - p.staggerOffset;
  const cycleTime =
    ((localTime % ANIM_DURATION) + ANIM_DURATION) % ANIM_DURATION;
  const progress = sineInOut(cycleTime / ANIM_DURATION);
  return {
    x: p.x0 * (1 - progress),
    y: p.y0 * (1 - progress),
    scale: 1.1 * (1 - progress),
    rotate: -3 * progress,
  };
}

// ── Procedural lens-flare sparkle (green palette, normal blend for white bg) ─

function createFlairCanvas(color: string, size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  // Soft radial glow — slightly stronger alpha for visibility on white
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  glow.addColorStop(0, color + "dd");
  glow.addColorStop(0.2, color + "88");
  glow.addColorStop(0.5, color + "22");
  glow.addColorStop(1, color + "00");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  // 4-pointed star cross — normal compositing (not additive) for white bg
  for (let axis = 0; axis < 2; axis++) {
    const grad = ctx.createLinearGradient(
      axis === 0 ? 0 : cx,
      axis === 0 ? cy : 0,
      axis === 0 ? size : cx,
      axis === 0 ? cy : size,
    );
    grad.addColorStop(0, color + "00");
    grad.addColorStop(0.3, color + "55");
    grad.addColorStop(0.5, color + "ff");
    grad.addColorStop(0.7, color + "55");
    grad.addColorStop(1, color + "00");
    ctx.fillStyle = grad;
    if (axis === 0) {
      ctx.fillRect(0, cy - r * 0.06, size, r * 0.12);
    } else {
      ctx.fillRect(cx - r * 0.06, 0, r * 0.12, size);
    }
  }

  // Bright green center dot (green, not white — visible on white bg)
  const center = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.15);
  center.addColorStop(0, color + "ee");
  center.addColorStop(0.5, color + "88");
  center.addColorStop(1, color + "00");
  ctx.fillStyle = center;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.15, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}

// ── Component ───────────────────────────────────────────────────────────────

export const WiseSparkleSpiral: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const radius = Math.max(width, height);
  const particles = useMemo(() => buildParticles(radius), [radius]);

  const flairCanvases = useMemo(() => {
    if (typeof document === "undefined") return [];
    return FLAIR_COLORS.map((c) => createFlairCanvas(c, FLAIR_SIZE));
  }, []);

  // Fade envelope — 0.5s in, 0.5s out at 30fps
  const fadeIn = interpolate(frame, [0, 15], [0, 1], ext);
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    ext,
  );
  const envelope = Math.min(fadeIn, fadeOut);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const globalTime = SEEK_TIME + frame / fps;

    const states = particles.map((p) => ({
      ...getParticleState(p, globalTime),
      colorIdx: p.colorIdx,
    }));

    // Sort by scale — smallest first (furthest back)
    states.sort((a, b) => a.scale - b.scale);

    ctx.clearRect(0, 0, width, height);

    for (const s of states) {
      if (s.scale <= 0.001) continue;
      const flair = flairCanvases[s.colorIdx];
      if (!flair) continue;

      const drawW = FLAIR_SIZE * s.scale;
      const drawH = FLAIR_SIZE * s.scale;

      ctx.translate(width / 2, height / 2);
      ctx.rotate(s.rotate);
      ctx.drawImage(flair, s.x, s.y, drawW, drawH);
      ctx.resetTransform();
    }
  }, [frame, fps, width, height, particles, flairCanvases]);

  return (
    <AbsoluteFill style={{ opacity: envelope }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
