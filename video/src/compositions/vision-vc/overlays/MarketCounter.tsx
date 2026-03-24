/**
 * MarketCounter — bottom-right number on light background.
 * JetBrains Mono, tabular nums. Dark text, no shadows.
 */
import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLOR, FONT } from "../tokens";

interface CounterKeyframe {
  frame: number;
  value: number;
}

interface MarketCounterProps {
  keyframes: CounterKeyframe[];
  showFrom?: number;
  fadeOutFrom?: number;
}

export const MarketCounter: React.FC<MarketCounterProps> = ({
  keyframes,
  showFrom = 0,
  fadeOutFrom = Infinity,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < showFrom) return null;

  const frames = keyframes.map((k) => k.frame);
  const values = keyframes.map((k) => k.value);
  const value = Math.round(
    interpolate(frame, frames, values, {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

  const fadeIn = interpolate(frame, [showFrom, showFrom + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(
    frame,
    [fadeOutFrom, fadeOutFrom + 15],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const opacity = Math.min(fadeIn, fadeOut);
  if (opacity <= 0) return null;

  const display = value.toLocaleString("en-US");

  // ── SCALE PULSE at each keyframe transition ──
  // At each keyframe, spring-scale to 1.06 then settle back to 1.0.
  // damping: 8 gives a snappy bounce with visible overshoot.
  let pulseScale = 1;
  for (let i = 0; i < keyframes.length; i++) {
    const kf = keyframes[i].frame;
    const elapsed = frame - kf;
    if (elapsed >= 0 && elapsed < 25) {
      // Spring naturally overshoots 1.0 with low damping, then settles.
      // We want: at frame 0 → scale 1.0, overshoot peak → 1.06, settle → 1.0
      // So we spring from 0→1 and map the result to scale where 1.0 maps to 1.0
      // and the overshoot maps proportionally above 1.0.
      const s = spring({
        frame: elapsed,
        fps,
        config: { damping: 8, stiffness: 200, mass: 0.4 },
      });
      // s overshoots to ~1.12 then returns to 1.0
      // Scale: 1.0 + 0.06 * (s - 1) when past 1; rises proportionally before
      if (s <= 1) {
        // Rising phase: scale goes 1.0 → 1.06
        pulseScale = 1 + 0.06 * s;
      } else {
        // Overshoot + settle: peak at 1.06, decays back to 1.0
        pulseScale = 1 + 0.06 * (2 - s);
      }
    }
  }

  // Gentler size growth
  const maxValue = 583551;
  const progress = Math.min(1, value / maxValue);
  const easedProgress = 1 - Math.pow(1 - progress, 0.4);
  const fontSize = 36 + easedProgress * 72; // 36px → 108px
  const labelSize = 11 + easedProgress * 5; // 11px → 16px

  return (
    <div
      style={{
        position: "absolute",
        bottom: 40,
        right: 60,
        opacity: opacity * 0.6, // More restrained
        textAlign: "right",
        userSelect: "none",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: FONT.mono,
          fontWeight: 700,
          fontSize,
          color: COLOR.textSecondary,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
          lineHeight: 1,
          transform: `scale(${pulseScale})`,
          transformOrigin: "right center",
        }}
      >
        {display}
      </div>
      <div
        style={{
          fontFamily: FONT.sans,
          fontWeight: 600,
          fontSize: labelSize,
          color: COLOR.textMuted,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginTop: 4,
        }}
      >
        PREDICTION MARKETS
      </div>
    </div>
  );
};
