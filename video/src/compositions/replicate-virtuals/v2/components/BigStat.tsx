import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";

interface BigStatProps {
  value: string;
  startFrame?: number;
  color?: string;
  fontSize?: number;
}

export const BigStat: React.FC<BigStatProps> = ({
  value,
  startFrame = 0,
  color = "#3ECDA0",
  fontSize = 320,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsed = frame - startFrame;
  const s = spring({
    frame: Math.max(0, elapsed),
    fps,
    config: { damping: 14, stiffness: 80, mass: 0.8 },
    durationInFrames: 15,
  });
  const scale = elapsed < 0 ? 0.3 : 0.3 + 0.7 * s;
  const opacity = elapsed < 0 ? 0 : s;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
          fontSize,
          fontWeight: 700,
          color,
          transform: `scale(${scale})`,
          opacity,
          letterSpacing: -2,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
};
