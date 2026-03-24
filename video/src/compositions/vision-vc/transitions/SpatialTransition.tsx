/**
 * SpatialTransition — directional entrance wrapper.
 *
 * Slides or scales children into position from a given direction.
 * A subtle opacity fade accompanies the first 30% of the spring,
 * so content materializes rather than teleports.
 */
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

interface SpatialTransitionProps {
  direction: "left" | "right" | "up" | "down" | "scale";
  /** Translation distance in px, default 50 */
  distance?: number;
  children: React.ReactNode;
}

export const SpatialTransition: React.FC<SpatialTransitionProps> = ({
  direction,
  distance = 50,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: { damping: 15 },
    durationInFrames: 12,
  });

  // Opacity fades in over the first 30% of the spring
  const opacity = interpolate(progress, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  let transform: string;

  switch (direction) {
    case "left": {
      const tx = interpolate(progress, [0, 1], [-distance, 0]);
      transform = `translateX(${tx}px)`;
      break;
    }
    case "right": {
      const tx = interpolate(progress, [0, 1], [distance, 0]);
      transform = `translateX(${tx}px)`;
      break;
    }
    case "up": {
      const ty = interpolate(progress, [0, 1], [-distance, 0]);
      transform = `translateY(${ty}px)`;
      break;
    }
    case "down": {
      const ty = interpolate(progress, [0, 1], [distance, 0]);
      transform = `translateY(${ty}px)`;
      break;
    }
    case "scale": {
      const s = interpolate(progress, [0, 1], [1 + distance / 1000, 1]);
      transform = `scale(${s})`;
      break;
    }
  }

  return (
    <AbsoluteFill
      style={{
        transform,
        opacity,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
