import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface Props {
  children: React.ReactNode;
  triggerFrame: number;
  durationFrames?: number;
  direction?: "left" | "right";
}

export const WhooshSlide: React.FC<Props> = ({
  children,
  triggerFrame,
  durationFrames = 8,
  direction = "left",
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

  const slideOut = direction === "left" ? -400 : 400;
  const translateX = progress < 0.5
    ? interpolate(progress, [0, 0.5], [0, slideOut])
    : interpolate(progress, [0.5, 1], [-slideOut, 0]);
  const opacity = progress < 0.5
    ? interpolate(progress, [0, 0.5], [1, 0])
    : interpolate(progress, [0.5, 1], [0, 1]);

  return (
    <div style={{ transform: `translateX(${translateX}px)`, opacity }}>
      {children}
    </div>
  );
};
