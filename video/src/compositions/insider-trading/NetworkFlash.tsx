import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  random,
} from "remotion";

// Network brand colors
const NETWORK_COLORS = [
  "#cc0000", // CNN
  "#003580", // Fox
  "#ff6600", // Bloomberg
  "#009e73", // CNBC
  "#bb1919", // BBC
  "#0089d0", // MSNBC
  "#c8960c", // Al Jazeera
  "#ff0000", // Breaking news generic
];

export const NetworkFlash: React.FC = () => {
  const frame = useCurrentFrame();

  // Flash frequency increases over time
  const flashInterval = frame < 120 ? 20 : frame < 150 ? 12 : 6;
  const isFlashFrame = frame % flashInterval < 2;

  if (!isFlashFrame) return null;

  const colorIndex = Math.floor(random(`nf-${frame}`) * NETWORK_COLORS.length);
  const color = NETWORK_COLORS[colorIndex];

  const intensity = interpolate(
    frame,
    [0, 60, 120],
    [0.08, 0.15, 0.25],
    { extrapolateRight: "clamp" }
  );

  // Occasionally do a full-screen flash
  const fullFlash = random(`ff-${frame}`) > 0.8;

  if (fullFlash) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: color,
          opacity: intensity * 1.5,
          mixBlendMode: "screen",
        }}
      />
    );
  }

  // Partial flash — horizontal band
  const bandY = random(`by-${frame}`) * 800;
  const bandHeight = 100 + random(`bh-${frame}`) * 300;

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: bandY,
          left: 0,
          right: 0,
          height: bandHeight,
          backgroundColor: color,
          opacity: intensity,
          mixBlendMode: "screen",
        }}
      />
    </AbsoluteFill>
  );
};
