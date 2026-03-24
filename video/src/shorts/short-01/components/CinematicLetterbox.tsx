import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";

interface Props {
  delay?: number;    // Frames before bars start sliding in
  height?: number;   // Bar height in px (default 90)
  durationFrames: number;
}

export const CinematicLetterbox: React.FC<Props> = ({
  delay = 0,
  height = 90,
  durationFrames,
}) => {
  const frame = useCurrentFrame();

  // Bars slide in over 12 frames with ease-out
  const barHeight = interpolate(
    frame,
    [delay, delay + 12],
    [0, height],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) },
  );

  // Slight fade-out at end of shot (last 8 frames)
  const opacity = interpolate(
    frame,
    [durationFrames - 8, durationFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  if (barHeight <= 0) return null;

  const barStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    height: barHeight,
    backgroundColor: "#000000",
    opacity,
    zIndex: 50,
  };

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ ...barStyle, top: 0 }} />
      <div style={{ ...barStyle, bottom: 0 }} />
    </AbsoluteFill>
  );
};
