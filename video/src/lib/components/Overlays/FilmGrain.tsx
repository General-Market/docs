import React from "react";
import { useCurrentFrame } from "remotion";
import { seededRandom } from "../../utils/random";

interface Props {
  opacity?: number; // 0.03-0.05
  width?: number;
  height?: number;
}

/**
 * Noise texture overlay, position randomized per frame for grain effect.
 * Uses CSS noise simulation via SVG filter for deterministic rendering.
 */
export const FilmGrain: React.FC<Props> = ({
  opacity = 0.04,
  width = 1080,
  height = 1920,
}) => {
  const frame = useCurrentFrame();
  const offsetX = seededRandom(frame * 3) * 256;
  const offsetY = seededRandom(frame * 3 + 1) * 256;
  const seed = Math.floor(seededRandom(frame) * 1000);

  return (
    <>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter id={`grain-${seed}`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="4"
            seed={seed}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          width,
          height,
          filter: `url(#grain-${seed})`,
          opacity,
          pointerEvents: "none",
          zIndex: 16,
          transform: `translate(${offsetX % 20}px, ${offsetY % 20}px)`,
        }}
      />
    </>
  );
};
