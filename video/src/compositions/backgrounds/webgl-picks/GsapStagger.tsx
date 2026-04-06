// Source: https://codepen.io/GreenSock/full/NWZRRNb
import React, { useRef, useEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Faithful port of GreenSock's "Canvas particles" CodePen (NWZRRNb).
 *
 * Original: 99 particles using flair-{2..22}.png images (i % 21 + 2).
 * GSAP timeline.fromTo with:
 *   from: { x: cos(angle*10)*radius, y: sin(angle*10)*radius, scale: 1.1, rotate: 0 }
 *   to:   { x: 0, y: 0, scale: 0, rotate: -3 }
 *   duration: 5, ease: "sine", stagger: { each: -0.05, repeat: -1 }
 * Draw: translate(cw/2, ch/2), rotate(p.rotate), drawImage(p.img, p.x, p.y, img.width*p.scale, img.height*p.scale)
 * Sort by scale for z-indexing. Background: rgb(14, 16, 15). Seek to t=99.
 *
 * Flair images are behind Cloudflare — replaced with procedural lens-flare
 * sparkles that match the original 4-pointed star aesthetic. All animation
 * values are exact from the source.
 */

const PARTICLE_COUNT = 99;
const ANIM_DURATION = 5; // seconds
const STAGGER_EACH = -0.05; // seconds per particle
const BG_COLOR = "rgb(14, 16, 15)";
const SEEK_TIME = 99; // original does .seek(99)
const FLAIR_SIZE = 150; // px — approximate dimension of original flair PNGs

// GSAP "sine" ease = sineInOut
function sineInOut(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// 21 color tints cycling through flair-2.png to flair-22.png
// These are soft-glow lens flare sparkles in distinct hues
const FLAIR_COLORS: string[] = [
  "#f5c842", // flair-2: warm gold
  "#ff6b8a", // flair-3: coral pink
  "#8b6bff", // flair-4: purple
  "#42d4f5", // flair-5: cyan
  "#ff4757", // flair-6: red
  "#5beb6e", // flair-7: green
  "#ffa040", // flair-8: orange
  "#4080ff", // flair-9: blue
  "#ff6b6b", // flair-10: salmon
  "#48dbfb", // flair-11: sky
  "#ff9ff3", // flair-12: pink
  "#54a0ff", // flair-13: cornflower
  "#ffd32a", // flair-14: gold
  "#00d2d3", // flair-15: teal
  "#ff6348", // flair-16: tomato
  "#c56cf0", // flair-17: violet
  "#ffb142", // flair-18: marigold
  "#33d9b2", // flair-19: emerald
  "#fd79a8", // flair-20: rose
  "#a29bfe", // flair-21: lavender
  "#fdcb6e", // flair-22: buff
];

interface Particle {
  colorIdx: number;
  staggerOffset: number; // i * STAGGER_EACH
  x0: number; // starting x (spiral position)
  y0: number; // starting y (spiral position)
}

function buildParticles(radius: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2 - Math.PI / 2;
    particles.push({
      colorIdx: i % 21,
      staggerOffset: i * STAGGER_EACH,
      x0: Math.cos(angle * 10) * radius,
      y0: Math.sin(angle * 10) * radius,
    });
  }
  return particles;
}

/**
 * Compute animated state for a particle at a given global time.
 *
 * In the original GSAP setup:
 * - stagger: { each: -0.05, repeat: -1 } means each particle's INDIVIDUAL
 *   5-second tween repeats infinitely. The stagger only shifts when each
 *   tween starts on the timeline.
 * - Particle i starts its tween at timeline position: i * (-0.05)
 *   (negative stagger = last particle starts earliest)
 * - Each tween loops its own 5s duration independently.
 * - .seek(99) jumps 99s into the running timeline.
 */
function getParticleState(
  p: Particle,
  globalTime: number,
): { x: number; y: number; scale: number; rotate: number } {
  // Time elapsed since this particle's tween started
  const localTime = globalTime - p.staggerOffset;

  // Each tween repeats every ANIM_DURATION seconds
  const cycleTime =
    ((localTime % ANIM_DURATION) + ANIM_DURATION) % ANIM_DURATION;
  const rawProgress = cycleTime / ANIM_DURATION;
  const progress = sineInOut(rawProgress);

  // fromTo: x0 → 0, y0 → 0, scale 1.1 → 0, rotate 0 → -3
  const x = p.x0 * (1 - progress);
  const y = p.y0 * (1 - progress);
  const scale = 1.1 * (1 - progress);
  const rotate = -3 * progress;

  return { x, y, scale, rotate };
}

/**
 * Draw a lens-flare sparkle on an offscreen canvas.
 * 4-pointed cross shape with soft radial glow — matching the visual
 * character of the original flair-N.png assets.
 */
function createFlairCanvas(color: string, size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  // Soft radial glow background
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  glow.addColorStop(0, color + "cc");
  glow.addColorStop(0.2, color + "66");
  glow.addColorStop(0.5, color + "18");
  glow.addColorStop(1, color + "00");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  // 4-pointed star cross (the defining shape of the flair assets)
  ctx.globalCompositeOperation = "lighter";
  for (let axis = 0; axis < 2; axis++) {
    const grad = ctx.createLinearGradient(
      axis === 0 ? 0 : cx,
      axis === 0 ? cy : 0,
      axis === 0 ? size : cx,
      axis === 0 ? cy : size,
    );
    grad.addColorStop(0, color + "00");
    grad.addColorStop(0.3, color + "44");
    grad.addColorStop(0.5, color + "ff");
    grad.addColorStop(0.7, color + "44");
    grad.addColorStop(1, color + "00");

    ctx.fillStyle = grad;
    if (axis === 0) {
      // Horizontal beam
      ctx.fillRect(0, cy - r * 0.06, size, r * 0.12);
    } else {
      // Vertical beam
      ctx.fillRect(cx - r * 0.06, 0, r * 0.12, size);
    }
  }

  // Bright center dot
  const center = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.15);
  center.addColorStop(0, "#ffffffee");
  center.addColorStop(0.5, color + "88");
  center.addColorStop(1, color + "00");
  ctx.fillStyle = center;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";
  return canvas;
}

export const GsapStagger: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const radius = Math.max(width, height);
  const particles = useMemo(() => buildParticles(radius), [radius]);

  // Pre-render the 21 flair images as offscreen canvases
  const flairCanvases = useMemo(() => {
    if (typeof document === "undefined") return [];
    return FLAIR_COLORS.map((color) => createFlairCanvas(color, FLAIR_SIZE));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Global time: seek(99) + current frame time
    const globalTime = SEEK_TIME + frame / fps;

    // Compute all particle states
    const states = particles.map((p) => ({
      ...getParticleState(p, globalTime),
      colorIdx: p.colorIdx,
    }));

    // Sort by scale for z-indexing (smallest drawn first = furthest back)
    states.sort((a, b) => a.scale - b.scale);

    ctx.clearRect(0, 0, width, height);

    // Exact draw logic from the original:
    // ctx.translate(cw/2, ch/2);
    // ctx.rotate(p.rotate);
    // ctx.drawImage(p.img, p.x, p.y, p.img.width * p.scale, p.img.height * p.scale);
    // ctx.resetTransform();
    for (const s of states) {
      if (s.scale <= 0.001) continue;

      const flairCanvas = flairCanvases[s.colorIdx];
      if (!flairCanvas) continue;

      const drawW = FLAIR_SIZE * s.scale;
      const drawH = FLAIR_SIZE * s.scale;

      ctx.translate(width / 2, height / 2);
      ctx.rotate(s.rotate);
      ctx.drawImage(flairCanvas, s.x, s.y, drawW, drawH);
      ctx.resetTransform();
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
