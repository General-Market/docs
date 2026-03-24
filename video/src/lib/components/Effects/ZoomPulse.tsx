import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

interface ZoomEvent {
  frame: number;
  intensity?: number; // default 0.08
  duration?: number; // default 15 frames
}

interface Props {
  children: React.ReactNode;
  events: ZoomEvent[];
}

export type { ZoomEvent };

export const ZoomPulse: React.FC<Props> = ({ children, events }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let scale = 1;

  for (const e of events) {
    const dur = e.duration ?? 15;
    const intensity = e.intensity ?? 0.08;
    if (frame >= e.frame && frame < e.frame + dur) {
      const p = spring({
        frame: frame - e.frame,
        fps,
        config: { damping: 12, stiffness: 200, mass: 1 },
        durationInFrames: dur,
      });
      scale = 1 + intensity * Math.sin(p * Math.PI);
    }
  }

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      }}
    >
      {children}
    </div>
  );
};
