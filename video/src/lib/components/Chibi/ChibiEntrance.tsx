import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
  children: React.ReactNode;
  startFrame?: number;
  durationFrames?: number;
}

/**
 * Spring scale pop-in: 0 → 1.08 → 1.0 over 12 frames
 */
export const ChibiEntrance: React.FC<Props> = ({
  children,
  startFrame = 6,
  durationFrames = 12,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 12, stiffness: 200, mass: 1 },
    durationInFrames: durationFrames,
  });

  const scale = frame < startFrame ? 0 : progress;
  const opacity = frame < startFrame ? 0 : Math.min(1, progress * 2);

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        opacity,
        transformOrigin: "center bottom",
      }}
    >
      {children}
    </div>
  );
};
