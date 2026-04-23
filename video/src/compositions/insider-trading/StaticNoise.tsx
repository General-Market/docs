import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  random,
} from "remotion";

const GRID = 40;

export const StaticNoise: React.FC = () => {
  const frame = useCurrentFrame();

  const noiseOpacity = interpolate(
    frame,
    [0, 75, 195],
    [0.04, 0.1, 0.25],
    { extrapolateRight: "clamp" }
  );

  // Generate noise cells — deterministic per frame
  const cells = useMemo(() => {
    const result: { x: number; y: number; brightness: number }[] = [];
    const cols = Math.ceil(1920 / GRID);
    const rows = Math.ceil(1080 / GRID);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const brightness = random(`noise-${frame}-${r}-${c}`) * 255;
        if (brightness > 180) {
          result.push({ x: c * GRID, y: r * GRID, brightness });
        }
      }
    }
    return result;
  }, [frame]);

  // Horizontal tear lines — classic analog glitch
  const tears = useMemo(() => {
    const result: { y: number; offset: number; height: number }[] = [];
    const tearCount = frame > 195 ? 4 : frame > 75 ? 2 : 0;
    for (let i = 0; i < tearCount; i++) {
      if (random(`tear-active-${frame}-${i}`) > 0.6) {
        result.push({
          y: random(`tear-y-${frame}-${i}`) * 1080,
          offset: (random(`tear-ox-${frame}-${i}`) - 0.5) * 60,
          height: 2 + random(`tear-h-${frame}-${i}`) * 6,
        });
      }
    }
    return result;
  }, [frame]);

  return (
    <AbsoluteFill style={{ opacity: noiseOpacity }}>
      {/* Noise pixels */}
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        {cells.map((cell, i) => (
          <rect
            key={i}
            x={cell.x}
            y={cell.y}
            width={GRID}
            height={GRID}
            fill={`rgb(${cell.brightness},${cell.brightness},${cell.brightness})`}
            opacity={0.3}
          />
        ))}
      </svg>

      {/* Horizontal tear lines */}
      {tears.map((tear, i) => (
        <div
          key={`tear-${i}`}
          style={{
            position: "absolute",
            top: tear.y,
            left: tear.offset,
            width: "100%",
            height: tear.height,
            backgroundColor: "rgba(255, 255, 255, 0.6)",
            mixBlendMode: "overlay",
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
