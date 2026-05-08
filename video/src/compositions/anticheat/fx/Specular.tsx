import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

// Diagonal gloss sweep — the highlight that crosses a card edge or a
// metal panel when light hits it. One linear-gradient with an animated
// transform. No filters. No backdrop. Cheap.
//
// Mount inside an AbsoluteFill positioned over the target rectangle
// (let the parent set width/height/top/left). The sweep travels from
// outside the left edge to outside the right edge over `duration`
// frames, peaking at the midpoint.

export interface SpecularProps {
  // Absolute frame at which the sweep begins.
  startFrame: number;
  // Total sweep duration in frames. 10–14 reads as a flick; longer
  // reads as cheap.
  duration?: number;
  // Sweep angle in degrees. 115 = down-right, matches typical card
  // gloss conventions.
  angle?: number;
  // Highlight intensity at the centre of the sweep. The gradient is
  // already alpha-blended; this multiplies the whole layer.
  intensity?: number;
  // Highlight colour. Use rgba.
  color?: string;
  // Sweep band width as a fraction of the container (0..1).
  bandWidth?: number;
  // Mix-blend for compositing the sweep against whatever sits below.
  // "screen" reads as a light hit on dark surfaces; "overlay" works
  // better on mid-tones; "soft-light" on light backgrounds.
  blendMode?: React.CSSProperties["mixBlendMode"];
  // Extra style passthrough — typically clip-path or border-radius
  // matching the underlying card.
  style?: React.CSSProperties;
}

export const Specular: React.FC<SpecularProps> = ({
  startFrame,
  duration = 12,
  angle = 115,
  intensity = 0.9,
  color = "rgba(255, 255, 255, 0.9)",
  bandWidth = 0.18,
  blendMode = "screen",
  style,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  if (local < 0 || local > duration) return null;

  // Sweep position from -1 (off-screen left) to 1 (off-screen right).
  const t = interpolate(local, [0, duration], [-1, 1], {
    easing: Easing.bezier(0.4, 0, 0.6, 1),
  });
  // Bell envelope so brightness peaks at midpoint and dies at edges.
  const env =
    Math.sin(interpolate(local, [0, duration], [0, Math.PI])) * intensity;

  // Translate the gradient via background-position. The gradient itself
  // is wider than the container so we can slide it across.
  const bandStart = 0.5 - bandWidth / 2;
  const bandEnd = 0.5 + bandWidth / 2;
  const grad = `linear-gradient(${angle}deg, transparent 0%, transparent ${bandStart * 100}%, ${color} ${50}%, transparent ${bandEnd * 100}%, transparent 100%)`;

  const xPercent = (t + 1) * 100; // 0..200

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        backgroundImage: grad,
        backgroundSize: "200% 200%",
        backgroundPosition: `${xPercent}% 50%`,
        backgroundRepeat: "no-repeat",
        opacity: Math.max(0, env),
        mixBlendMode: blendMode,
        ...style,
      }}
    />
  );
};
