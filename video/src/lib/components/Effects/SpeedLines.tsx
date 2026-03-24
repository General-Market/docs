import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { seededRandom } from "../../utils/random";

interface SpeedLineEvent {
  frame: number;
  duration?: number; // default 20 frames
}

interface Props {
  events: SpeedLineEvent[];
  width?: number;
  height?: number;
  lineCount?: number;
}

export type { SpeedLineEvent };

export const SpeedLines: React.FC<Props> = ({
  events,
  width = 1080,
  height = 1920,
  lineCount = 24,
}) => {
  const frame = useCurrentFrame();
  const cx = width / 2;
  const cy = height / 2;

  for (const e of events) {
    const dur = e.duration ?? 20;
    if (frame >= e.frame && frame < e.frame + dur) {
      const progress = (frame - e.frame) / dur;
      // Fade in for first 30%, hold, fade out last 30%
      const opacity =
        progress < 0.3
          ? interpolate(progress, [0, 0.3], [0, 0.6])
          : progress > 0.7
            ? interpolate(progress, [0.7, 1], [0.6, 0])
            : 0.6;

      const lines = Array.from({ length: lineCount }, (_, i) => {
        const angle = (i / lineCount) * Math.PI * 2;
        const seed = e.frame * 100 + i;
        const innerR = 200 + seededRandom(seed) * 100;
        const outerR = Math.max(width, height);
        const x1 = cx + Math.cos(angle) * innerR;
        const y1 = cy + Math.sin(angle) * innerR;
        const x2 = cx + Math.cos(angle) * outerR;
        const y2 = cy + Math.sin(angle) * outerR;
        return `M${x1},${y1} L${x2},${y2}`;
      });

      return (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{
            position: "absolute",
            inset: 0,
            opacity,
            pointerEvents: "none",
            zIndex: 13,
          }}
        >
          {lines.map((d, i) => (
            <path
              key={i}
              d={d}
              stroke="rgba(255,255,255,0.4)"
              strokeWidth={2 + seededRandom(e.frame * 100 + i + 50) * 2}
              fill="none"
            />
          ))}
        </svg>
      );
    }
  }

  return null;
};
