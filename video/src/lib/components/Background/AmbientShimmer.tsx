import React from "react";
import { useCurrentFrame } from "remotion";
import { noise2D } from "@remotion/noise";

interface Props {
  tint?: string;
  opacity?: number;
}

export const AmbientShimmer: React.FC<Props> = ({
  tint = "rgba(255,255,255,0.08)",
  opacity = 0.08,
}) => {
  const frame = useCurrentFrame();
  const offsetX = noise2D("sx", frame * 0.02, 0) * 200;
  const offsetY = noise2D("sy", 0, frame * 0.02) * 200;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(ellipse at ${50 + offsetX * 0.1}% ${50 + offsetY * 0.1}%, ${tint}, transparent 70%)`,
        opacity,
        mixBlendMode: "screen",
      }}
    />
  );
};
