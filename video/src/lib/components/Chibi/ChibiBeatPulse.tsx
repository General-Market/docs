import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
  children: React.ReactNode;
  beatFrames: number[];
  intensity?: number;
}

/**
 * Per-beat scale pulse: 1.0 → 1.06 → 1.0 over 8 frames
 */
export const ChibiBeatPulse: React.FC<Props> = ({
  children,
  beatFrames,
  intensity = 0.06,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Find the most recent beat
  let activeBeat: number | null = null;
  for (const b of beatFrames) {
    if (frame >= b && frame < b + 8) {
      activeBeat = b;
      break;
    }
  }

  let scale = 1;
  if (activeBeat !== null) {
    const pulse = spring({
      frame: frame - activeBeat,
      fps,
      config: { damping: 15, stiffness: 300, mass: 0.5 },
      durationInFrames: 8,
    });
    // pulse goes 0→1, we want 0→intensity→0
    scale = 1 + intensity * Math.sin(pulse * Math.PI);
  }

  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: "center bottom" }}>
      {children}
    </div>
  );
};
