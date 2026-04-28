import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { noise2D } from "@remotion/noise";

/* ═══════════════════════════════════════════════════════
   Dynamic backgrounds — gradients that drift, breathe, and
   carry a residual zoom across scene cuts.
   ═══════════════════════════════════════════════════════ */

// ── Animated blue mesh gradient (5× faster + drift) ──
export const DynamicBlue: React.FC<{ speed?: number }> = ({ speed = 0.022 }) => {
  const frame = useCurrentFrame();
  const t = frame * speed;

  // Drift component: blobs slowly travel diagonally; noise modulates around the drift line.
  const drift = (frame * 0.06) % 200;

  const x1 = 10 + noise2D("rb-x1", t, 0) * 22 + Math.sin(t * 0.7) * 4;
  const y1 = 10 + noise2D("rb-y1", t, 0.5) * 22 + Math.cos(t * 0.6) * 4;
  const x2 = 85 + noise2D("rb-x2", t, 1) * 18 - Math.sin(t * 0.5) * 5;
  const y2 = 12 + noise2D("rb-y2", t, 1.5) * 20 + Math.cos(t * 0.4) * 4;
  const x3 = 18 + noise2D("rb-x3", t, 2) * 22;
  const y3 = 88 + noise2D("rb-y3", t, 2.5) * 12;
  const x4 = 88 + noise2D("rb-x4", t, 3) * 14;
  const y4 = 82 + noise2D("rb-y4", t, 3.5) * 14;
  const angle = 135 + Math.sin(t * 0.4) * 12;

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(ellipse 100% 100% at ${x1}% ${y1}%, rgba(255,255,255,0.78) 0%, transparent 55%),
          radial-gradient(ellipse 90% 90% at ${x2}% ${y2}%, rgba(255,255,255,0.65) 0%, transparent 50%),
          radial-gradient(ellipse 100% 100% at ${x3}% ${y3}%, rgba(200,220,255,0.4) 0%, transparent 55%),
          radial-gradient(ellipse 85% 85% at ${x4}% ${y4}%, rgba(255,255,255,0.55) 0%, transparent 50%),
          radial-gradient(ellipse 70% 70% at 50% 50%, rgba(120,170,255,0.22) 0%, transparent 65%),
          linear-gradient(${angle}deg, #0050FF 0%, #1060FF 25%, #3080FF 45%, #1060FF 65%, #0040FF 85%, #0035EE 100%)
        `,
        backgroundPosition: `${drift}px 0, ${-drift}px 0, 0 0, 0 0, 0 0, 0 0`,
      }}
    />
  );
};

// ── Animated light gradient (warmer drift, near-white) ──
export const DynamicLight: React.FC<{ speed?: number }> = ({ speed = 0.018 }) => {
  const frame = useCurrentFrame();
  const t = frame * speed;

  const x = 28 + noise2D("rl-x", t, 0) * 22;
  const y = 30 + noise2D("rl-y", t, 0.5) * 22;
  const x2 = 72 + noise2D("rl-x2", t, 1) * 18;
  const y2 = 70 + noise2D("rl-y2", t, 1.5) * 18;
  const angle = 135 + Math.cos(t * 0.5) * 10;

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(ellipse 80% 80% at ${x}% ${y}%, rgba(255,255,255,1) 0%, transparent 70%),
          radial-gradient(ellipse 60% 60% at ${x2}% ${y2}%, rgba(220,230,255,0.55) 0%, transparent 65%),
          linear-gradient(${angle}deg, #f0f4ff 0%, #e8eeff 40%, #f5f8ff 60%, #eef2ff 100%)
        `,
      }}
    />
  );
};

// ── Animated solid blue (used to be flat — now breathes) ──
export const DynamicSolidBlue: React.FC<{ speed?: number }> = ({ speed = 0.018 }) => {
  const frame = useCurrentFrame();
  const t = frame * speed;
  const x = 50 + noise2D("rs-x", t, 0) * 18;
  const y = 50 + noise2D("rs-y", t, 0.5) * 18;
  const angle = 160 + Math.sin(t * 0.3) * 14;

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(ellipse 70% 70% at ${x}% ${y}%, rgba(80,140,255,0.35) 0%, transparent 60%),
          linear-gradient(${angle}deg, #0055FF 0%, #0040FF 40%, #0035EE 70%, #0045FF 100%)
        `,
      }}
    />
  );
};

// ── Animated dark background (slow drift, deep navy) ──
export const DynamicDark: React.FC<{ speed?: number }> = ({ speed = 0.014 }) => {
  const frame = useCurrentFrame();
  const t = frame * speed;
  const x = 40 + noise2D("rd-x", t, 0) * 22;
  const y = 45 + noise2D("rd-y", t, 0.5) * 22;

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(ellipse 60% 60% at ${x}% ${y}%, rgba(50,80,160,0.18) 0%, transparent 65%),
          linear-gradient(180deg, #0c0c12 0%, #111118 50%, #0a0a10 100%)
        `,
      }}
    />
  );
};

/* ═══════════════════════════════════════════════════════
   Hex grid overlay — outline-only honeycomb, stroke = white
   ═══════════════════════════════════════════════════════ */

const SQRT3 = Math.sqrt(3);

export const HexGridOverlay: React.FC<{
  size?: number;
  color?: string;
  opacity?: number;
  strokeWidth?: number;
}> = ({ size = 70, color = "rgba(255,255,255,0.18)", opacity = 1, strokeWidth = 1.4 }) => {
  // Pointy-top hex: width = size * sqrt(3), height = size * 2
  const hexW = size * SQRT3;
  const rowStride = size * 1.5;

  const cols = Math.ceil(1920 / hexW) + 2;
  const rows = Math.ceil(1080 / rowStride) + 2;

  const hexes: React.ReactNode[] = [];
  for (let r = -1; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      const cx = c * hexW + (r % 2 === 0 ? 0 : hexW / 2);
      const cy = r * rowStride + size;
      const points = [
        [cx, cy - size],
        [cx + hexW / 2, cy - size / 2],
        [cx + hexW / 2, cy + size / 2],
        [cx, cy + size],
        [cx - hexW / 2, cy + size / 2],
        [cx - hexW / 2, cy - size / 2],
      ]
        .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
        .join(" ");
      hexes.push(
        <polygon
          key={`h-${r}-${c}`}
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
        />,
      );
    }
  }

  return (
    <AbsoluteFill style={{ opacity, pointerEvents: "none" }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
        style={{ display: "block" }}
      >
        {hexes}
      </svg>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene-level zoom helper.
   - Entry: scale 1.05 → 1.0 over first 14 frames, ease-out cubic (deceleration).
   - Exit:  scale 1.0 → 1.04 over last  7 frames, ease-in cubic (acceleration).
   The cut happens between exit-end and entry-start, so the next scene
   "inherits" the zoom and decelerates out of it.
   ═══════════════════════════════════════════════════════ */

const ENTRY_FRAMES = 14;
const EXIT_FRAMES = 7;
const ENTRY_SCALE = 1.05;
const EXIT_SCALE = 1.04;

export function useBackgroundZoom(durationInFrames: number): number {
  const frame = useCurrentFrame();

  if (frame < ENTRY_FRAMES) {
    const t = frame / ENTRY_FRAMES;
    const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
    return ENTRY_SCALE - (ENTRY_SCALE - 1.0) * ease;
  }
  const exitStart = durationInFrames - EXIT_FRAMES;
  if (frame >= exitStart) {
    const t = Math.min(1, (frame - exitStart) / EXIT_FRAMES);
    const ease = t * t * t; // ease-in cubic
    return 1.0 + (EXIT_SCALE - 1.0) * ease;
  }
  return 1.0;
}

export const ZoomedBg: React.FC<{
  duration: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ duration, children, style }) => {
  const scale = useBackgroundZoom(duration);
  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "50% 50%",
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
