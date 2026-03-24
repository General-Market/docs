/**
 * ShotVfx — visual overlay effects adapted from LogoAnimations.
 * These are purely atmospheric overlays — no text rendered, just visual spice.
 *
 * Variants:
 *   glitch    — RGB split + scanlines + random flicker (from LogoGlitch)
 *   speed-lines — horizontal light trails (from LogoLightTrail)
 *   ink-splash  — burst particles from center on impact (from LogoStamp)
 *   neon-glow   — atmospheric neon flicker + glow (from LogoNeonSign)
 */

import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  random,
  AbsoluteFill,
} from "remotion";

export type ShotVfxVariant =
  | "glitch"
  | "speed-lines"
  | "ink-splash"
  | "neon-glow";

interface Props {
  variant: ShotVfxVariant;
  color?: string; // accent color (defaults to white)
  delay?: number; // frames before effect starts
}

// ─── Helpers ──────────────────────────────────────────────────────────

function hexRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Glitch overlay ──────────────────────────────────────────────────

const GlitchOverlay: React.FC<{ color: string; delay: number }> = ({
  color,
  delay,
}) => {
  const frame = useCurrentFrame();

  const f = Math.max(0, frame - delay);
  if (f <= 0) return null;

  // Random glitch bursts — 20% chance per frame after delay
  const glitchActive = random(`gvfx-${frame}`) < 0.2;

  if (!glitchActive) return null;

  const offsetX = (random(`gvfx-x-${frame}`) - 0.5) * 30;
  const sliceY = random(`gvfx-sy-${frame}`) * 100;
  const sliceH = 5 + random(`gvfx-sh-${frame}`) * 40;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 30 }}>
      {/* Red channel shift */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: `${sliceY}%`,
          width: "100%",
          height: `${sliceH}px`,
          background: "rgba(255, 0, 0, 0.08)",
          transform: `translateX(${offsetX}px)`,
          mixBlendMode: "screen",
        }}
      />
      {/* Cyan channel shift */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: `${sliceY + 2}%`,
          width: "100%",
          height: `${sliceH * 0.7}px`,
          background: "rgba(0, 255, 255, 0.06)",
          transform: `translateX(${-offsetX}px)`,
          mixBlendMode: "screen",
        }}
      />
      {/* Scanlines */}
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.15) 2px,
            rgba(0,0,0,0.15) 4px
          )`,
          opacity: 0.6,
        }}
      />
      {/* Horizontal tear line */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: `${sliceY}%`,
          width: "100%",
          height: 2,
          background: hexRgba(color, 0.4),
          boxShadow: `0 0 10px ${hexRgba(color, 0.3)}`,
        }}
      />
    </AbsoluteFill>
  );
};

// ─── Speed lines ─────────────────────────────────────────────────────

interface SpeedLine {
  y: number; // % from top
  width: number; // px
  thickness: number; // px
  speed: number; // px per frame
  startX: number; // initial X offset %
  colorIdx: number; // 0 or 1
}

const SpeedLinesOverlay: React.FC<{ color: string; delay: number }> = ({
  color,
  delay,
}) => {
  const frame = useCurrentFrame();

  const f = Math.max(0, frame - delay);

  const lines = useMemo<SpeedLine[]>(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      y: 15 + (i / 12) * 70 + Number(random(`sl-y-${i}`)) * 8,
      width: 120 + Number(random(`sl-w-${i}`)) * 200,
      thickness: 2 + Number(random(`sl-t-${i}`)) * 3,
      speed: 8 + Number(random(`sl-s-${i}`)) * 12,
      startX: -30 - Number(random(`sl-sx-${i}`)) * 20,
      colorIdx: i % 3,
    }));
  }, []);

  // Fade in
  const masterOpacity = interpolate(f, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (masterOpacity <= 0) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 6, overflow: "hidden" }}>
      {lines.map((line, i) => {
        const trailDelay = i * 2;
        const xPos = line.startX + (f - trailDelay) * line.speed * 0.15;
        const lineOpacity = interpolate(
          f - trailDelay,
          [0, 8, 30, 45],
          [0, 0.7, 0.5, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        if (lineOpacity <= 0) return null;

        const lineColor =
          line.colorIdx === 0
            ? color
            : line.colorIdx === 1
              ? "#FFFFFF"
              : hexRgba(color, 0.5);

        return (
          <div
            key={`speedline-${i}`}
            style={{
              position: "absolute",
              left: `${xPos}%`,
              top: `${line.y}%`,
              width: line.width,
              height: line.thickness,
              background: `linear-gradient(90deg, transparent, ${hexRgba(lineColor, lineOpacity)})`,
              filter: "blur(1px)",
              borderRadius: 2,
            }}
          />
        );
      })}
      {/* Central glow */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 600,
          height: 200,
          background: color,
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          filter: "blur(80px)",
          opacity: masterOpacity * 0.08,
        }}
      />
    </AbsoluteFill>
  );
};

// ─── Ink splash ──────────────────────────────────────────────────────

interface InkDot {
  angle: number;
  distance: number;
  size: number;
  delay: number;
}

const InkSplashOverlay: React.FC<{ color: string; delay: number }> = ({
  color,
  delay,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const f = Math.max(0, frame - delay);

  const dots = useMemo<InkDot[]>(() => {
    return Array.from({ length: 16 }, (_, i) => ({
      angle: (i / 16) * Math.PI * 2 + Number(random(`ink-a-${i}`)) * 0.4,
      distance: 80 + Number(random(`ink-d-${i}`)) * 200,
      size: 8 + Number(random(`ink-s-${i}`)) * 20,
      delay: Number(random(`ink-dl-${i}`)) * 5,
    }));
  }, []);

  const burstProgress = spring({
    frame: f,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.6 },
    durationInFrames: 15,
  });

  // Only visible for ~20 frames
  const fadeOut = interpolate(f, [10, 25], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (fadeOut <= 0 || burstProgress <= 0) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 15 }}>
      {dots.map((dot, i) => {
        const dotProgress = spring({
          frame: f - dot.delay,
          fps,
          config: { damping: 12, stiffness: 250, mass: 0.5 },
          durationInFrames: 12,
        });

        const dist = dot.distance * dotProgress;
        const cx = 540 + Math.cos(dot.angle) * dist;
        const cy = 960 + Math.sin(dot.angle) * dist;
        const dotScale = interpolate(dotProgress, [0, 0.5, 1], [0.3, 1.2, 0.8]);
        const dotOpacity = fadeOut * interpolate(dotProgress, [0, 0.2], [0, 1], {
          extrapolateRight: "clamp",
        });

        if (dotOpacity <= 0.01) return null;

        return (
          <div
            key={`ink-${i}`}
            style={{
              position: "absolute",
              left: cx - dot.size / 2,
              top: cy - dot.size / 2,
              width: dot.size,
              height: dot.size,
              borderRadius: "50%",
              backgroundColor: hexRgba(
                i % 2 === 0 ? color : "#FFFFFF",
                dotOpacity * 0.6
              ),
              boxShadow: `0 0 ${dot.size}px ${hexRgba(color, dotOpacity * 0.4)}`,
              transform: `scale(${dotScale})`,
            }}
          />
        );
      })}
      {/* Central flash */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${hexRgba(color, fadeOut * 0.15)} 0%, transparent 70%)`,
          transform: `translate(-50%, -50%) scale(${1 + burstProgress * 2})`,
          filter: "blur(20px)",
        }}
      />
    </AbsoluteFill>
  );
};

// ─── Neon glow ───────────────────────────────────────────────────────

const NeonGlowOverlay: React.FC<{ color: string; delay: number }> = ({
  color,
  delay,
}) => {
  const frame = useCurrentFrame();

  const f = Math.max(0, frame - delay);
  if (f <= 0) return null;

  // Neon flicker — changes every 4 frames
  const flickerSeed = Math.floor(frame / 4);
  const flicker = random(`neon-vfx-${flickerSeed}`) > 0.1 ? 1 : 0.3;

  // Fade in
  const fadeIn = interpolate(f, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Secondary micro-flicker
  const microFlicker = random(`neon-micro-${frame}`) > 0.15 ? 1 : 0.5;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 4 }}>
      {/* Top ambient neon glow */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "15%",
          width: 800,
          height: 400,
          borderRadius: "50%",
          background: color,
          transform: "translate(-50%, -50%)",
          filter: "blur(100px)",
          opacity: fadeIn * flicker * 0.06,
        }}
      />
      {/* Center glow pulse */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "45%",
          width: 500,
          height: 200,
          borderRadius: "50%",
          background: color,
          transform: "translate(-50%, -50%)",
          filter: "blur(60px)",
          opacity: fadeIn * flicker * microFlicker * 0.1,
        }}
      />
      {/* Edge vignette with color tint */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, transparent 50%, ${hexRgba(color, fadeIn * 0.04)} 100%)`,
        }}
      />
      {/* Bottom reflection */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "20%",
          width: 600,
          height: 120,
          borderRadius: "50%",
          background: color,
          transform: "translateX(-50%)",
          filter: "blur(80px)",
          opacity: fadeIn * flicker * 0.04,
        }}
      />
    </AbsoluteFill>
  );
};

// ─── Main component ──────────────────────────────────────────────────

export const ShotVfx: React.FC<Props> = ({
  variant,
  color = "#FFFFFF",
  delay = 0,
}) => {
  switch (variant) {
    case "glitch":
      return <GlitchOverlay color={color} delay={delay} />;
    case "speed-lines":
      return <SpeedLinesOverlay color={color} delay={delay} />;
    case "ink-splash":
      return <InkSplashOverlay color={color} delay={delay} />;
    case "neon-glow":
      return <NeonGlowOverlay color={color} delay={delay} />;
    default:
      return null;
  }
};
