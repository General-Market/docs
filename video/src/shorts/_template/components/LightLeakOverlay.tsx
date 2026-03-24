/**
 * LightLeakOverlay — floating orange + magenta light blobs with screen blend.
 * Adapted from scenes/EffectAnimations/EffectLightLeak for shot-level use.
 */

import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

interface Props {
  /** Delay before leak animation starts (default 0) */
  delay?: number;
  /** Overall opacity multiplier (default 1) */
  intensity?: number;
}

export const LightLeakOverlay: React.FC<Props> = ({
  delay = 0,
  intensity = 1,
}) => {
  const frame = useCurrentFrame();

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
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    ) * intensity;

  const leak2Opacity =
    interpolate(
      frame,
      [delay + 20, delay + 50, delay + 80, delay + 100],
      [0, 0.5, 0.5, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    ) * intensity;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Orange leak */}
      <div
        style={{
          position: "absolute",
          left: `${leak1X}%`,
          top: "20%",
          width: 400,
          height: 600,
          background:
            "radial-gradient(ellipse, rgba(255, 150, 50, 0.8) 0%, transparent 70%)",
          transform: "rotate(-20deg)",
          opacity: leak1Opacity,
          mixBlendMode: "screen",
          filter: "blur(40px)",
        }}
      />

      {/* Magenta leak */}
      <div
        style={{
          position: "absolute",
          left: `${leak2X}%`,
          bottom: "10%",
          width: 500,
          height: 500,
          background:
            "radial-gradient(ellipse, rgba(255, 50, 150, 0.7) 0%, transparent 70%)",
          transform: "rotate(30deg)",
          opacity: leak2Opacity,
          mixBlendMode: "screen",
          filter: "blur(60px)",
        }}
      />

      {/* Flare */}
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
