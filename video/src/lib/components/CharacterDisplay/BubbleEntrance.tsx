import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
  children: React.ReactNode;
  /** Frame to start the entrance (absolute) */
  startFrame: number;
}

/**
 * Spring scale-in for thought/speech bubbles.
 * Pop from 0 → overshoot → 1.0 with a bouncy spring.
 */
export const BubbleEntrance: React.FC<Props> = ({ children, startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < startFrame) return null;

  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 10, stiffness: 180, mass: 0.5 },
    durationInFrames: 15,
  });

  return (
    <div
      style={{
        transform: `scale(${progress})`,
        opacity: Math.min(1, progress * 2),
        transformOrigin: "bottom center",
      }}
    >
      {children}
    </div>
  );
};
