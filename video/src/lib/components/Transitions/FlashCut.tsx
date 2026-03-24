import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface Props {
  children: React.ReactNode;
  triggerFrame: number;
  durationFrames?: number;
}

/**
 * Instant flash cut: white flash + instant content swap over 3 frames
 */
export const FlashCut: React.FC<Props> = ({
  children,
  triggerFrame,
  durationFrames = 3,
}) => {
  const frame = useCurrentFrame();

  if (frame < triggerFrame || frame >= triggerFrame + durationFrames) {
    return <>{children}</>;
  }

  const progress = interpolate(
    frame,
    [triggerFrame, triggerFrame + durationFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const flashOpacity = progress < 0.5 ? progress * 1.4 : (1 - progress) * 1.4;

  return (
    <>
      {children}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "white",
          opacity: Math.min(0.7, flashOpacity),
          pointerEvents: "none",
          zIndex: 50,
        }}
      />
    </>
  );
};
