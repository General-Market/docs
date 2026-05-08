import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { beatPulse, VIDEO_BEATS } from "../beats";

// Beat-twinkle dots. N small bright points at deterministic positions,
// each assigned a beat to twinkle on. Pure SVG, zero filters, zero
// backdrop. The cheapest FX in the kit.
//
// Mount at the composition root with no Sequence above it so that
// useCurrentFrame() returns absolute frames.

export interface SparkleProps {
  // Absolute frame at which the field appears (fades in over 12f).
  startFrame: number;
  // Absolute frame at which the field fades out (over 18f).
  endFrame: number;
  // Number of dots in the field. 12–24 reads as ambient; more reads
  // as snow.
  count?: number;
  // Fixed seed so positions are stable between renders.
  seed?: number;
  // Beat indices the sparkles are allowed to twinkle on. By default
  // every beat in VIDEO_BEATS is fair game; pass a subset to bind
  // sparkles to specific moments.
  beatIndices?: readonly number[];
  // Maximum dot radius in px at twinkle peak.
  maxRadius?: number;
  // Dot fill colour at peak.
  color?: string;
  // Box constraining the field (CSS percentages of the frame).
  area?: { left: string; top: string; width: string; height: string };
  // Twinkle envelope shape.
  attack?: number;
  decay?: number;
}

// Tiny deterministic hash → 0..1.
const rand = (seed: number, i: number): number => {
  const x = Math.sin(seed * 9301 + i * 49297) * 233280;
  return x - Math.floor(x);
};

export const Sparkle: React.FC<SparkleProps> = ({
  startFrame,
  endFrame,
  count = 16,
  seed = 1,
  beatIndices,
  maxRadius = 3.5,
  color = "rgba(180, 210, 255, 1)",
  area = { left: "0%", top: "0%", width: "100%", height: "100%" },
  attack = 6,
  decay = 18,
}) => {
  const frame = useCurrentFrame();
  if (frame < startFrame - 12 || frame > endFrame + 18) return null;

  const dots = useMemo(() => {
    const pool = beatIndices ?? VIDEO_BEATS.map((_, i) => i);
    return Array.from({ length: count }, (_, i) => ({
      x: rand(seed, i * 2 + 1),
      y: rand(seed, i * 2 + 2),
      beat: pool[Math.floor(rand(seed, i * 3) * pool.length)] ?? 0,
      // Random radius scale 0.6..1.0 so the field has size variation.
      r: 0.6 + rand(seed, i * 5) * 0.4,
    }));
  }, [count, seed, beatIndices]);

  // Field-level fade-in/out so the sparkles don't pop on/off as a block.
  let fieldOpacity = 1;
  if (frame < startFrame) fieldOpacity = (frame - (startFrame - 12)) / 12;
  else if (frame > endFrame) fieldOpacity = 1 - (frame - endFrame) / 18;
  fieldOpacity = Math.max(0, Math.min(1, fieldOpacity));
  if (fieldOpacity <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        pointerEvents: "none",
        left: area.left,
        top: area.top,
        width: area.width,
        height: area.height,
        opacity: fieldOpacity,
      }}
    >
      {dots.map((d, i) => {
        const env = beatPulse(frame, d.beat, attack, decay);
        if (env <= 0) return null;
        const size = maxRadius * 2 * d.r * env;
        return (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            style={{
              position: "absolute",
              left: `${d.x * 100}%`,
              top: `${d.y * 100}%`,
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              borderRadius: "50%",
              backgroundColor: color,
              opacity: env,
              boxShadow: `0 0 ${size * 1.6}px ${color}`,
            }}
          />
        );
      })}
    </div>
  );
};
