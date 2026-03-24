/**
 * LightLeakOverlay — floating light blobs with screen blend.
 * Accepts a base color prop from the direction spec; derives warm/cool
 * variants from it. Falls back to orange/magenta if no color provided.
 */

import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

interface Props {
  /** Delay before leak animation starts (default 0) */
  delay?: number;
  /** Overall opacity multiplier (default 1) */
  intensity?: number;
  /** Base color from direction spec (e.g. "#ffca65", "#f7931a", "#7c3aed") */
  color?: string;
}

/** Parse hex to RGB, return as [r, g, b] */
const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
};

/** Shift hue roughly by blending toward a target */
const shiftColor = (
  rgb: [number, number, number],
  warmShift: number,
): [number, number, number] => {
  // Warm shift: increase R, decrease B
  // Cool shift: decrease R, increase B
  return [
    Math.min(255, Math.max(0, rgb[0] + warmShift * 40)),
    rgb[1],
    Math.min(255, Math.max(0, rgb[2] - warmShift * 40)),
  ];
};

export const LightLeakOverlay: React.FC<Props> = ({
  delay = 0,
  intensity = 1,
  color,
}) => {
  const frame = useCurrentFrame();

  // Derive two leak colors from the base color
  let leak1Rgb: [number, number, number];
  let leak2Rgb: [number, number, number];

  if (color) {
    const base = hexToRgb(color);
    leak1Rgb = shiftColor(base, 1); // warmer variant
    leak2Rgb = shiftColor(base, -1); // cooler variant
  } else {
    leak1Rgb = [255, 150, 50]; // fallback orange
    leak2Rgb = [255, 50, 150]; // fallback magenta
  }

  const leak1X = interpolate(frame, [delay, delay + 80], [-20, 120], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const leak2X = interpolate(frame, [delay + 20, delay + 100], [120, -20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const leak1Opacity =
    interpolate(
      frame,
      [delay, delay + 30, delay + 60, delay + 80],
      [0, 0.6, 0.6, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    ) * intensity;

  const leak2Opacity =
    interpolate(
      frame,
      [delay + 20, delay + 50, delay + 80, delay + 100],
      [0, 0.5, 0.5, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    ) * intensity;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Primary leak */}
      <div
        style={{
          position: "absolute",
          left: `${leak1X}%`,
          top: "20%",
          width: 400,
          height: 600,
          background: `radial-gradient(ellipse, rgba(${leak1Rgb[0]}, ${leak1Rgb[1]}, ${leak1Rgb[2]}, 0.8) 0%, transparent 70%)`,
          transform: "rotate(-20deg)",
          opacity: leak1Opacity,
          mixBlendMode: "screen",
          filter: "blur(40px)",
        }}
      />

      {/* Secondary leak */}
      <div
        style={{
          position: "absolute",
          left: `${leak2X}%`,
          bottom: "10%",
          width: 500,
          height: 500,
          background: `radial-gradient(ellipse, rgba(${leak2Rgb[0]}, ${leak2Rgb[1]}, ${leak2Rgb[2]}, 0.7) 0%, transparent 70%)`,
          transform: "rotate(30deg)",
          opacity: leak2Opacity,
          mixBlendMode: "screen",
          filter: "blur(60px)",
        }}
      />

      {/* Flare (always white-ish for punch) */}
      <div
        style={{
          position: "absolute",
          left: `${leak1X + 10}%`,
          top: "40%",
          width: 200,
          height: 200,
          background:
            "radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, transparent 60%)",
          opacity: leak1Opacity * 0.5,
          mixBlendMode: "screen",
        }}
      />
    </AbsoluteFill>
  );
};
