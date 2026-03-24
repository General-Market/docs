import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface Props {
  children: React.ReactNode;
  triggerFrame: number;
  durationFrames?: number;
}

export const ZoomTransition: React.FC<Props> = ({
  children,
  triggerFrame,
  durationFrames = 12,
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

  const scale = progress < 0.5
    ? interpolate(progress, [0, 0.5], [1.0, 1.3])
    : interpolate(progress, [0.5, 1], [1.3, 1.0]);
  const opacity = progress < 0.5
    ? interpolate(progress, [0, 0.5], [1, 0])
    : interpolate(progress, [0.5, 1], [0, 1]);

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        opacity,
        transformOrigin: "center center",
      }}
    >
      {children}
    </div>
  );
};
