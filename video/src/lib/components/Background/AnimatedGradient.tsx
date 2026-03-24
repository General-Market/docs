import React from "react";
import { useCurrentFrame, interpolate, interpolateColors } from "remotion";
import { noise2D } from "@remotion/noise";
import type { Emotion } from "../../types";
import { getPalette, getGradientCSS } from "../../utils/colorPalettes";

interface Props {
  emotion: Emotion;
  prevEmotion?: Emotion;
  transitionProgress?: number; // 0-1 during crossfade
}

export const AnimatedGradient: React.FC<Props> = ({
  emotion,
  prevEmotion,
  transitionProgress = 1,
}) => {
  const frame = useCurrentFrame();
  const angle = frame * 0.2; // 0.2deg/frame — IndexMaker DA: fintech dignity, not rave
  const palette = getPalette(emotion);

  // Noise-driven center drift
  const cx = 50 + noise2D("gx", frame * 0.008, 0) * 10;
  const cy = 50 + noise2D("gy", 0, frame * 0.008) * 10;

  // Color crossfade between emotions
  let colors = palette.gradient;
  if (prevEmotion && transitionProgress < 1) {
    const prev = getPalette(prevEmotion).gradient;
    colors = colors.map((c, i) =>
      interpolateColors(transitionProgress, [0, 1], [prev[i], c]),
    ) as [string, string, string];
  }

  const opacity = interpolate(frame, [0, 5], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: getGradientCSS(colors, angle),
        backgroundPosition: `${cx}% ${cy}%`,
        opacity,
      }}
    />
  );
};
