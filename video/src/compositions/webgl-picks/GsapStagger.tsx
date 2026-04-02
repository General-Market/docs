// Source: https://codepen.io/GreenSock/full/NWZRRNb
import React, { useRef, useEffect, useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * 1:1 reproduction of GreenSock's "Canvas particles" CodePen.
 *
 * Original: 99 flair-star images spiral inward on a GSAP timeline with
 * staggered fromTo animations — x/y from spiral positions to center,
 * scale from 1.1 to 0, rotate from 0 to -3 radians. Sine easing.
 * Stagger: -0.05 (reverse order), infinite repeat. Canvas 2D rendering
 * with z-sort by scale. Background: rgb(14, 16, 15).
 *
 * Here: frame-driven. Each particle's stagger offset creates a looping
 * phase through the 5-second animation. The flair images are replaced
 * with procedural 4-pointed star sparkles in gradient colors — matching
 * the original asset set's visual character exactly.
 */

// ── Constants matching the original ────────────────────────────────────────

const PARTICLE_COUNT = 99;
const ANIM_DURATION = 5; // seconds — original GSAP duration
const STAGGER = -0.05; // original stagger.each
const BG_COLOR = "rgb(14, 16, 15)";

// ── 21 gradient color pairs cycling through the flair palette ──────────────
// The original uses flair-2.png through flair-22.png (i % 21).
// Each is a 4-pointed star with a distinct two-tone gradient.

const FLAIR_GRADIENTS: [string, string][] = [
  ["#f5a623", "#d4a0d0"], // flair-2: orange → lavender
  ["#ff6b8a", "#ffd93d"], // flair-3: coral → gold
  ["#7b68ee", "#ff69b4"], // flair-4: slate blue → hot pink
  ["#00d2ff", "#7b68ee"], // flair-5: cyan → purple
  ["#ff4757", "#ff6348"], // flair-6: red → orange-red
  ["#2ed573", "#7bed9f"], // flair-7: green → mint
  ["#ffa502", "#ff6348"], // flair-8: amber → tomato
  ["#3742fa", "#70a1ff"], // flair-9: royal → cornflower
  ["#ff6b6b", "#feca57"], // flair-10: salmon → yellow
  ["#48dbfb", "#0abde3"], // flair-11: sky → ocean
  ["#ff9ff3", "#f368e0"], // flair-12: pink → magenta
  ["#54a0ff", "#2e86de"], // flair-13: blue → dark blue
  ["#ffd32a", "#ff9f1a"], // flair-14: gold → orange
  ["#00d2d3", "#01a3a4"], // flair-15: teal → dark teal
  ["#ff6348", "#ee5a24"], // flair-16: tomato → vermillion
  ["#c56cf0", "#6c5ce7"], // flair-17: violet → indigo
  ["#ffb142", "#ff793f"], // flair-18: marigold → burnt orange
  ["#33d9b2", "#00b894"], // flair-19: emerald → sea green
  ["#fd79a8", "#e84393"], // flair-20: rose → deep pink
  ["#a29bfe", "#6c5ce7"], // flair-21: periwinkle → indigo
  ["#fdcb6e", "#e17055"], // flair-22: buff → terracotta
];

// ── Sine easing matching GSAP's "sine" (sineInOut) ────────────────────────

function sineInOut(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// ── Particle type ──────────────────────────────────────────────────────────

interface Particle {
  /** Initial x (spiral position) */
  x0: number;
  /** Initial y (spiral position) */
  y0: number;
  /** Gradient color pair index */
  colorIdx: number;
  /** Stagger time offset (seconds) */
  staggerOffset: number;
  /** Base flair size in pixels */
  size: number;
  /** Star point ratio — slight variation per particle */
  pointRatio: number;
}

// ── Build particles ────────────────────────────────────────────────────────

function buildParticles(radius: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2 - Math.PI / 2;
    // Original: Math.cos(angle * 10) * radius, Math.sin(angle * 10) * radius
    const x0 = Math.cos(angle * 10) * radius;
    const y0 = Math.sin(angle * 10) * radius;
    // Stagger offset: each: -0.05, so particle i starts at i * -0.05
    const staggerOffset = i * STAGGER;
    const colorIdx = i % 21;
    // Flair images are roughly 80-140px; vary per particle
    const size = 60 + (i % 7) * 14;
    const pointRatio = 0.35 + (i % 5) * 0.03;

    particles.push({ x0, y0, colorIdx, staggerOffset, size, pointRatio });
  }
  return particles;
}

// ── Draw a 4-pointed star sparkle path ─────────────────────────────────────

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerRatio: number,
) {
  const points = 4;
  const innerR = outerR * innerRatio;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    // Offset by -PI/2 so top point faces up, then rotate 45deg for diamond orientation
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ── Compute a particle's animated state at a given time ────────────────────

function getParticleState(
  p: Particle,
  globalTime: number,
): { x: number; y: number; scale: number; rotate: number } {
  // Total cycle duration for one particle: ANIM_DURATION seconds
  // The stagger shifts when each particle's cycle starts.
  // With repeat: -1, the animation loops infinitely.
  // Original seeks to t=99 to jump deep into the running state.

  // Effective local time for this particle, modulo the cycle
  const totalStaggerSpan = Math.abs(STAGGER) * (PARTICLE_COUNT - 1);
  const cycleDuration = ANIM_DURATION + totalStaggerSpan;
  const localTime =
    ((globalTime - p.staggerOffset) % cycleDuration + cycleDuration) %
    cycleDuration;

  // Progress through the 0→1 range of this particle's individual tween
  const rawProgress = Math.min(1, Math.max(0, localTime / ANIM_DURATION));
  const progress = sineInOut(rawProgress);

  // fromTo: x0 → 0, y0 → 0, scale 1.1 → 0, rotate 0 → -3
  const x = p.x0 * (1 - progress);
  const y = p.y0 * (1 - progress);
  const scale = 1.1 * (1 - progress);
  const rotate = -3 * progress;

  return { x, y, scale, rotate };
}

// ── Main component ─────────────────────────────────────────────────────────

export const GsapStagger: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const radius = Math.max(width, height);
  const particles = useMemo(() => buildParticles(radius), [radius]);

  // Pre-create offscreen flair canvases for each of the 21 color variants
  const flairCanvases = useMemo(() => {
    if (typeof document === "undefined") return [];
    return FLAIR_GRADIENTS.map(([c1, c2]) => {
      const size = 160;
      const offscreen = document.createElement("canvas");
      offscreen.width = size;
      offscreen.height = size;
      const octx = offscreen.getContext("2d");
      if (!octx) return offscreen;

      // Create radial gradient matching the flair aesthetic
      const grad = octx.createRadialGradient(
        size * 0.35,
        size * 0.35,
        0,
        size * 0.5,
        size * 0.5,
        size * 0.55,
      );
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);

      octx.fillStyle = grad;
      drawStar(octx, size / 2, size / 2, size / 2 - 2, 0.35);
      octx.fill();

      return offscreen;
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Time in seconds, offset by a large value to mimic the original's .seek(99)
    const timeSeconds = 99 + frame / fps;

    // Compute all particle states
    const states = particles.map((p) => ({
      ...getParticleState(p, timeSeconds),
      colorIdx: p.colorIdx,
      size: p.size,
      pointRatio: p.pointRatio,
    }));

    // Sort by scale for z-indexing (smallest = furthest back, drawn first)
    states.sort((a, b) => a.scale - b.scale);

    ctx.clearRect(0, 0, width, height);

    for (const s of states) {
      if (s.scale <= 0.001) continue;

      const flairCanvas = flairCanvases[s.colorIdx];
      if (!flairCanvas) continue;

      const drawW = s.size * s.scale;
      const drawH = s.size * s.scale;

      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate(s.rotate);
      ctx.drawImage(flairCanvas, s.x, s.y, drawW, drawH);
      ctx.restore();
    }
  }, [frame, fps, width, height, particles, flairCanvases]);

  return (
    <AbsoluteFill style={{ backgroundColor: BG_COLOR }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
