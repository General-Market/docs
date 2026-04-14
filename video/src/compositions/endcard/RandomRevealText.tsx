/**
 * RandomRevealText — Letters materialize in random order.
 *
 * Each character gets a seeded random delay, then fades from
 * opacity 0 → 1 over a short window. At any given frame,
 * some letters are invisible, some are mid-fade, some are solid.
 * Spaces appear immediately.
 */

import React, { useMemo } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { seededRandom } from "../../lib/utils/random";

const FADE_FRAMES = 4; // snappy pop — nearly instant

export const RandomRevealText: React.FC<{
  text: string;
  /** Total frames for all characters to begin appearing */
  revealDuration?: number;
  style?: React.CSSProperties;
  seed?: number;
}> = ({ text, revealDuration = 50, style, seed = 7 }) => {
  const frame = useCurrentFrame();

  const delays = useMemo(() => {
    return text.split("").map((char, i) => {
      if (char === " ") return -FADE_FRAMES; // spaces visible immediately
      return seededRandom(i * 31 + seed) * revealDuration;
    });
  }, [text, revealDuration, seed]);

  return (
    <span style={{ display: "inline-block", ...style }}>
      {text.split("").map((char, i) => {
        const delay = delays[i];
        const opacity = interpolate(
          frame,
          [delay, delay + FADE_FRAMES],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        return (
          <span
            key={i}
            style={{
              opacity,
              display: "inline-block",
              // prevent layout shift from invisible characters
              minWidth: char === " " ? "0.3em" : undefined,
            }}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
};
