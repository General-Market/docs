import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface FlashEvent {
  frame: number;
  color?: string; // default white
  duration?: number; // default 8 frames
  maxOpacity?: number; // default 0.7
}

interface Props {
  events: FlashEvent[];
}

export type { FlashEvent };

export const FlashImpact: React.FC<Props> = ({ events }) => {
  const frame = useCurrentFrame();

  for (const e of events) {
    const dur = e.duration ?? 8;
    const peak = e.maxOpacity ?? 0.7;
    if (frame >= e.frame && frame < e.frame + dur) {
      const mid = e.frame + dur * 0.3;
      const opacity =
        frame < mid
          ? interpolate(frame, [e.frame, mid], [0, peak])
          : interpolate(frame, [mid, e.frame + dur], [peak, 0]);

      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: e.color ?? "white",
            opacity,
            zIndex: 11,
            pointerEvents: "none",
          }}
        />
      );
    }
  }

  return null;
};
