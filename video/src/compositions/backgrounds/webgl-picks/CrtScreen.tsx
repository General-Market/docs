// Faithful port of the "CRT / VCR ScreenEffect" CodePen by @rlafuente.
// ALL animation is driven by useCurrentFrame() — no CSS @keyframes, no
// setInterval, no requestAnimationFrame. Canvas noise is seeded per-frame via
// mulberry32 so every render pass is deterministic.

import React, { useRef, useLayoutEffect } from "react";
import {
  AbsoluteFill,
  Loop,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";

// trading.mp4 is 2.133s @ 30fps → 64 source frames. The composition runs at
// 60fps, so we scale: 64 / 30 * 60 = 128 composition-frames per loop cycle.
const BROLL_LOOP_FRAMES = 128;

// ── Seeded PRNG (mulberry32) ────────────────────────────────────────────────
// Returns a value in [0, 1). Each call advances the state. Seed with frame
// number so every frame produces the same random sequence regardless of which
// render pass is executing.

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let z = t;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// ── Snow canvas ─────────────────────────────────────────────────────────────
// Drawn at half resolution (chunky CRT static) and scaled up via CSS.

const SnowCanvas: React.FC<{ frame: number; width: number; height: number }> =
  ({ frame, width, height }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const cw = Math.floor(width / 2);
    const ch = Math.floor(height / 2);

    useLayoutEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rng = mulberry32(frame * 0x9e3779b9);
      const d = ctx.createImageData(cw, ch);
      const b = new Uint32Array(d.data.buffer);
      for (let i = 0; i < b.length; i++) {
        // Alpha in high byte, grey value in the lower 24 bits.
        b[i] = ((255 * rng()) | 0) << 24;
      }
      ctx.putImageData(d, 0, 0);
    }, [frame, cw, ch]);

    return (
      <canvas
        ref={canvasRef}
        width={cw}
        height={ch}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.2,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
    );
  };

// ── VCR tracking-noise canvas ────────────────────────────────────────────────
// Mimics renderTrackingNoise / renderTail from the original ScreenEffect class.
// miny = 220, miny2 = 220 (source config), num = 70, blur = 1px.
// Drawn at full tube resolution.

const VcrCanvas: React.FC<{
  frame: number;
  width: number;
  height: number;
}> = ({ frame, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rng = mulberry32((frame * 0x9e3779b9 + 0xdeadbeef) >>> 0);
    const num = 70;
    const radius = 2;
    const xmax = width;
    const ymax = height;
    // Scale the original 640×360 miny values to the tube size.
    const scaleY = height / 360;
    let posy1 = 220 * scaleY;
    let posy2 = 220 * scaleY;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#fff";

    const renderTail = (x0: number, y: number, r: number) => {
      const n = randInt(rng, 1, 50);
      const dir = rng() > 0.5 ? 1 : -1;
      let rd = r;
      let cx = x0;
      for (let i = 0; i < n; i++) {
        const step = 0.01;
        rd -= step;
        const rr = Math.max(0, randInt(rng, Math.floor(rd), Math.ceil(r)));
        const dx = randInt(rng, 1, 4) * dir;
        r = Math.max(0, r - 0.1);
        cx += dx;
        ctx.fillRect(cx, y, rr, rr);
        ctx.fill();
      }
    };

    ctx.beginPath();
    for (let i = 0; i <= num; i++) {
      const x = rng() * xmax;
      const y1 = randInt(rng, (posy1 += 3 * scaleY), ymax);
      const y2 = randInt(rng, 0, Math.max(0, (posy2 -= 3 * scaleY)));
      ctx.fillRect(x, y1, radius, radius);
      ctx.fillRect(x, y2, radius, radius);
      ctx.fill();
      renderTail(x, y1, radius);
      renderTail(x, y2, radius);
    }
    ctx.closePath();
  }, [frame, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        filter: "blur(1px)",
        pointerEvents: "none",
      }}
    />
  );
};

// ── Main ─────────────────────────────────────────────────────────────────────

export const CrtScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Tube dimensions — 4:3 centered on the 1920×1080 canvas.
  const tubeW = 960;
  const tubeH = 720;

  // ── Power-on flash (maps the "on" @keyframes, first ~0.7s / ~42 frames @ 60fps)
  // The original keyframe:
  //   0%   scale(1, 0.8) brightness(4)
  //   3.5% translate 100%
  //   3.6% translate -100%
  //   9%   scale(1.3, 0.6) brightness(4) opacity(0)
  //   11%  scale(1,1) contrast(0) brightness(0) opacity(0)
  //   100% scale(1,1) contrast(1) brightness(1.2) saturate(1.3)
  //
  // We compress the chaos (0–11%) into frames 0–36 (~0.6s) and treat 100% as
  // settled state from frame 36 onward. The "translate to ±100%" is the tube
  // briefly going off-screen — we mimic this with a scale-Y collapse + bright
  // flash instead of actually leaving the frame (easier to control).

  const POWER_FRAMES = Math.round(fps * 3.0); // 3-second power-on like source

  // scaleX collapses from 1.3 → 1 during the burst, then settles.
  const scaleX = interpolate(
    frame,
    [0, Math.round(POWER_FRAMES * 0.09), Math.round(POWER_FRAMES * 0.11), POWER_FRAMES],
    [1, 1.3, 1, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // scaleY squishes hard, then pops back.
  const scaleY = interpolate(
    frame,
    [0, Math.round(POWER_FRAMES * 0.035), Math.round(POWER_FRAMES * 0.09), Math.round(POWER_FRAMES * 0.11), POWER_FRAMES],
    [0.8, 0.8, 0.6, 1, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Brightness flare then normal.
  const brightness = interpolate(
    frame,
    [0, Math.round(POWER_FRAMES * 0.09), Math.round(POWER_FRAMES * 0.11), POWER_FRAMES],
    [4, 4, 0, 1.2],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Saturation ramps up as screen settles.
  const saturation = interpolate(
    frame,
    [Math.round(POWER_FRAMES * 0.11), POWER_FRAMES],
    [0, 1.3],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Opacity: invisible during the blackout window (11%), then fades in.
  const tubeOpacity = interpolate(
    frame,
    [0, Math.round(POWER_FRAMES * 0.09), Math.round(POWER_FRAMES * 0.11), POWER_FRAMES],
    [1, 0, 0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    }
  );

  // ── Wobble — ±1px jitter driven by low-frequency sine/cosine pairs.
  // The source uses 100ms CSS loops — at 60fps that's 6-frame cycles. We pick
  // two primes so x and y drift independently and never perfectly sync.
  const wobbleX = Math.sin((frame / 7) * Math.PI * 2) * 1;
  const wobbleY = Math.cos((frame / 11) * Math.PI * 2) * 1;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Tube wrapper — wobble lives here */}
      <div
        style={{
          position: "absolute",
          left: (width - tubeW) / 2,
          top: (height - tubeH) / 2,
          width: tubeW,
          height: tubeH,
          transform: `translate(${wobbleX}px, ${wobbleY}px)`,
          // CRT curvature: soft border-radius + inner shadow for the tube-face
          // bevel. The outer box-shadow gives the deep surrounding bezel.
          borderRadius: 24,
          overflow: "hidden",
          boxShadow:
            "0 0 0 8px #1a1a1a, 0 0 0 16px #111, 0 30px 80px rgba(0,0,0,0.9), inset 0 0 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Power-on transform + filter applied to the inner content wrapper */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${scaleX}, ${scaleY})`,
            opacity: tubeOpacity,
            filter: `brightness(${brightness}) saturate(${saturation})`,
            transformOrigin: "center center",
          }}
        >
          {/* ── Layer 1: Video feed — looped via <Loop> (OffthreadVideo has no loop prop) */}
          <Loop durationInFrames={BROLL_LOOP_FRAMES}>
            <OffthreadVideo
              src={staticFile("broll/trading.mp4")}
              muted
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "blur(1.2px)",
              }}
            />
          </Loop>

          {/* ── Layer 2: Snow canvas (screen blend, half res scaled up) ─── */}
          <SnowCanvas frame={frame} width={tubeW} height={tubeH} />

          {/* ── Layer 3: Scanlines — pure CSS ────────────────────────────── */}
          {/* Fine horizontal dark lines (2px repeat) + subtle RGB column tint */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: [
                "linear-gradient(transparent 50%, rgba(0,0,0,0.25) 50%)",
                "linear-gradient(90deg, rgba(255,0,0,0.06), rgba(0,255,0,0.02), rgba(0,0,255,0.06))",
              ].join(", "),
              backgroundSize: "100% 2px, 3px 100%",
              pointerEvents: "none",
            }}
          />

          {/* ── Layer 4: VCR tracking noise canvas ──────────────────────── */}
          <VcrCanvas frame={frame} width={tubeW} height={tubeH} />

          {/* ── Layer 5: Vignette — radial gradient replaces the crt.png ── */}
          {/* transparent center → dark edges, mimicking a tube phosphor face */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 80%, rgba(0,0,0,0.85) 100%)",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
