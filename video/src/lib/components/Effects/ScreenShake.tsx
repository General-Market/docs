import React from "react";
import { useCurrentFrame } from "remotion";
import { noise2D } from "@remotion/noise";

interface ShakeEvent {
  frame: number;
  amplitude: number; // 6-12px
  duration: number; // 8-15 frames
}

interface Props {
  children: React.ReactNode;
  events: ShakeEvent[];
}

export type { ShakeEvent };

export const ScreenShake: React.FC<Props> = ({ children, events }) => {
  const frame = useCurrentFrame();

  let tx = 0;
  let ty = 0;

  for (const e of events) {
    if (frame >= e.frame && frame < e.frame + e.duration) {
      const progress = (frame - e.frame) / e.duration;
      const decay = 1 - progress; // linear decay
      const amp = e.amplitude * decay;
      tx += noise2D("shx", frame * 0.3, e.frame) * amp;
      ty += noise2D("shy", e.frame, frame * 0.3) * amp;
    }
  }

  return (
    <div style={{ transform: `translate(${tx}px, ${ty}px)` }}>{children}</div>
  );
};
