import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface Props {
  children: React.ReactNode;
  triggerFrame: number;
  durationFrames?: number;
}

/**
 * Exponential shrink-out over 6 frames
 */
export const ChibiExit: React.FC<Props> = ({
  children,
  triggerFrame,
  durationFrames = 6,
}) => {
  const frame = useCurrentFrame();

  if (frame < triggerFrame) {
    return <>{children}</>;
  }

  const progress = interpolate(
    frame,
    [triggerFrame, triggerFrame + durationFrames],
    [0, 1],
    { extrapolateRight: "clamp" },
  );

  // Exponential ease-in
  const scale = 1 - progress * progress;
  const opacity = 1 - progress;

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
