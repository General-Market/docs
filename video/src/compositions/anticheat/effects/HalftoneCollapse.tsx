import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";

type Props = {
  startFrame: number;
  durationFrames?: number;
  cellSize?: number;
  color?: string;
};

export const HalftoneCollapse: React.FC<Props> = ({
  startFrame,
  durationFrames = 16,
  cellSize = 36,
  color = "#000000",
}) => {
  const frame = useCurrentFrame();
  const id = React.useId();
  const local = frame - startFrame;
  if (local < 0 || local > durationFrames) return null;

  const t = local / durationFrames;

  // Wave position sweeps top→bottom across normalized 0..1.
  const waveY = interpolate(t, [0, 1], [-0.25, 1.25], {
    easing: Easing.inOut(Easing.cubic),
  });
  const waveWidth = 0.45;
  const peakRadius = cellSize * 0.55;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      <svg
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        viewBox="0 0 1080 1920"
        style={{ display: "block" }}
      >
        <defs>
          <pattern
            id={`${id}-grid`}
            width={cellSize}
            height={cellSize}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx={cellSize / 2}
              cy={cellSize / 2}
              r={peakRadius}
              fill={color}
            />
          </pattern>
          <linearGradient
            id={`${id}-mask`}
            x1="0"
            y1={waveY - waveWidth / 2}
            x2="0"
            y2={waveY + waveWidth / 2}
          >
            <stop offset="0%" stopColor="black" />
            <stop offset="50%" stopColor="white" />
            <stop offset="100%" stopColor="black" />
          </linearGradient>
          <mask id={`${id}-m`}>
            <rect
              width="1080"
              height="1920"
              fill={`url(#${id}-mask)`}
            />
          </mask>
        </defs>
        <rect
          width="1080"
          height="1920"
          fill={`url(#${id}-grid)`}
          mask={`url(#${id}-m)`}
        />
      </svg>
    </div>
  );
};
