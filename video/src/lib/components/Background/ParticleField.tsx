import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { noise2D } from "@remotion/noise";
import { seededRandom } from "../../utils/random";

interface Props {
  count?: number;
  energy?: number; // 0-1, modulates density
  color?: string;
  width?: number;
  height?: number;
}

interface Particle {
  id: number;
  baseX: number;
  baseY: number;
  size: number;
  speed: number;
  shape: "circle" | "diamond";
  baseOpacity: number;
}

export const ParticleField: React.FC<Props> = ({
  count = 30,
  energy = 0.5,
  color = "rgba(255,255,255,0.15)",
  width = 1080,
  height = 1920,
}) => {
  const frame = useCurrentFrame();

  const particles = useMemo((): Particle[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      baseX: seededRandom(i * 7 + 1) * width,
      baseY: seededRandom(i * 7 + 2) * height,
      size: 2 + seededRandom(i * 7 + 3) * 6,
      speed: 0.3 + seededRandom(i * 7 + 4) * 0.9,
      shape: seededRandom(i * 7 + 5) > 0.5 ? "circle" : "diamond",
      baseOpacity: 0.05 + seededRandom(i * 7 + 6) * 0.15,
    }));
  }, [count, width, height]);

  const visibleCount = Math.floor(count * (0.5 + energy * 0.5));

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {particles.slice(0, visibleCount).map((p) => {
        const x =
          p.baseX + noise2D(`px${p.id}`, frame * 0.005 * p.speed, 0) * 80;
        const y =
          p.baseY +
          noise2D(`py${p.id}`, 0, frame * 0.005 * p.speed) * 80 -
          frame * p.speed * 0.5;
        const wrappedY = ((y % height) + height) % height;
        const opacity =
          p.baseOpacity +
          noise2D(`po${p.id}`, frame * 0.01, 0) * 0.05;

        return (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: x,
              top: wrappedY,
              width: p.size,
              height: p.size,
              backgroundColor: color,
              borderRadius: p.shape === "circle" ? "50%" : 0,
              transform:
                p.shape === "diamond" ? "rotate(45deg)" : undefined,
              opacity: Math.max(0, Math.min(0.2, opacity)),
            }}
          />
        );
      })}
    </div>
  );
};
