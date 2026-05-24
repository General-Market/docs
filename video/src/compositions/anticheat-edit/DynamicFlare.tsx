/**
 * DynamicFlare — moving electric-blue anamorphic light.
 *
 * The brand's blue as a lamp, not paint: long horizontal streaks of light
 * that drift, breathe, and travel a bright hotspot along their length.
 * Screen-blended, so it only ever adds light. Meant to live BEHIND the
 * subject cutout, where it reads as light in the room rather than a filter.
 *
 * Reusable across videos — tune color, streaks, and pulse per composition.
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { noise2D } from "@remotion/noise";

export interface FlareStreak {
  seed: string;
  baseY: number; // 0..1 vertical rest position
  width: number; // 0..1 fraction of frame width
  thickness: number; // px (core); glow scales from this
  driftPx: number; // vertical wander amplitude
  speed: number; // drift/hotspot speed
  intensity: number; // 0..1 peak opacity
}

const DEFAULT_STREAKS: FlareStreak[] = [
  { seed: "a", baseY: 0.34, width: 1.05, thickness: 3, driftPx: 70, speed: 0.6, intensity: 0.55 },
  { seed: "b", baseY: 0.52, width: 0.9, thickness: 2, driftPx: 110, speed: 0.9, intensity: 0.4 },
  { seed: "c", baseY: 0.68, width: 1.15, thickness: 4, driftPx: 90, speed: 0.45, intensity: 0.32 },
];

export const DynamicFlare: React.FC<{
  color?: [number, number, number];
  streaks?: FlareStreak[];
  pulse?: number;
  opacity?: number;
}> = ({ color = [45, 107, 255], streaks = DEFAULT_STREAKS, pulse = 0.22, opacity = 1 }) => {
  const frame = useCurrentFrame();
  const [r, g, b] = color;
  const breathe = 1 + pulse * Math.sin(frame / 42);

  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", pointerEvents: "none", opacity }}>
      {streaks.map((s, i) => {
        const t = frame * s.speed;
        const driftY = noise2D(`y${s.seed}`, t * 0.012, 0) * s.driftPx;
        const hotspot = 50 + noise2D(`x${s.seed}`, t * 0.014, 1) * 38; // % travels along the bar
        const flicker = 0.78 + 0.22 * Math.sin(frame / 53 + i * 1.7);
        const op = Math.max(0, s.intensity * breathe * flicker);
        const topPx = `calc(${s.baseY * 100}% + ${driftY}px)`;
        const glowH = s.thickness * 9;
        const coreH = Math.max(1.5, s.thickness);

        return (
          <React.Fragment key={s.seed}>
            {/* wide soft glow */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: topPx,
                transform: "translate(-50%, -50%)",
                width: `${s.width * 100}%`,
                height: glowH,
                background: `radial-gradient(ellipse 62% 50% at ${hotspot}% 50%, rgba(${r},${g},${b},${op}) 0%, rgba(${r},${g},${b},${op * 0.35}) 28%, rgba(${r},${g},${b},0) 72%)`,
                filter: `blur(${s.thickness * 3}px)`,
              }}
            />
            {/* bright thin core */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: topPx,
                transform: "translate(-50%, -50%)",
                width: `${s.width * 100}%`,
                height: coreH,
                background: `radial-gradient(ellipse 50% 50% at ${hotspot}% 50%, rgba(${Math.min(255, r + 90)},${Math.min(255, g + 70)},255,${op * 1.1}) 0%, rgba(${r},${g},${b},0) 60%)`,
                filter: "blur(2px)",
              }}
            />
            {/* travelling lens point */}
            <div
              style={{
                position: "absolute",
                left: `${hotspot}%`,
                top: topPx,
                transform: "translate(-50%, -50%)",
                width: s.thickness * 10,
                height: s.thickness * 10,
                borderRadius: "50%",
                background: `radial-gradient(circle, rgba(${Math.min(255, r + 110)},${Math.min(255, g + 90)},255,${op * 0.9}) 0%, rgba(${r},${g},${b},0) 65%)`,
                filter: `blur(${s.thickness * 2}px)`,
              }}
            />
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
