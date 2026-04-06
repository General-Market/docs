import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";

const { fontFamily } = loadFont();

export interface CounterProps {
  target: number;
  durationFrames: number;
  startFrame: number;
  label?: string;
  fontSize?: number;
  color?: string;
  prefix?: string;
  suffix?: string;
  formatWithCommas?: boolean;
}

export const Counter: React.FC<CounterProps> = ({
  target,
  durationFrames,
  startFrame,
  label,
  fontSize = 120,
  color = "#00C853",
  prefix = "",
  suffix = "",
  formatWithCommas = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = frame - startFrame;

  // Cubic ease-out interpolation from 0 -> target
  const rawValue = interpolate(
    localFrame,
    [0, durationFrames],
    [0, target],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );

  const display = Math.round(rawValue);
  const formatted = formatWithCommas ? display.toLocaleString() : String(display);

  // Spring scale-in: 0.8 -> 1 over ~15 frames starting at startFrame
  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 18, stiffness: 160, mass: 0.6 },
    durationInFrames: 15,
  });
  const scaleValue = 0.8 + scale * 0.2;

  const opacity = interpolate(localFrame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const labelSize = fontSize * 0.25;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
        transform: `scale(${scaleValue})`,
        opacity,
      }}
    >
      <div
        style={{
          fontSize,
          fontWeight: 700,
          color,
          lineHeight: 1,
          letterSpacing: -2,
          fontVariantNumeric: "tabular-nums",
          textAlign: "center",
        }}
      >
        {prefix}
        {formatted}
        {suffix}
      </div>
      {label ? (
        <div
          style={{
            marginTop: labelSize * 0.7,
            fontSize: labelSize,
            color: "rgba(255,255,255,0.55)",
            textTransform: "uppercase",
            letterSpacing: 4,
            fontWeight: 400,
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};
