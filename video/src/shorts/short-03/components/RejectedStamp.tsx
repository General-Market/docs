/**
 * RejectedStamp — ink stamp overlay with spring slam + screen shake.
 *
 * Slams in at `delayFrames` with a bouncy spring animation,
 * decaying screen tremble, then fades out.
 *
 * Asset: public/shorts/short-03/refusal_stamp.png (OnlyGFX, CC0)
 */

import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Img,
  staticFile,
  AbsoluteFill,
} from "remotion";
import { noise2D } from "@remotion/noise";

interface Props {
  /** Frame (shot-local) when the stamp slams down. */
  delayFrames: number;
  /** How long the stamp stays fully visible after slam (default 40). */
  holdFrames?: number;
  /** Fade-out duration in frames after hold (default 10). */
  fadeOutFrames?: number;
  /** Stamp image width in px (default 320). */
  width?: number;
  /** Slight rotation in degrees (default -12, matching the stamp's natural tilt). */
  rotation?: number;
}

const STAMP_SRC = "shorts/short-03/refusal_stamp.png";

export const RejectedStamp: React.FC<Props> = ({
  delayFrames,
  holdFrames = 40,
  fadeOutFrames = 10,
  width = 320,
  rotation = -12,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const f = frame - delayFrames;
  if (f < 0) return null;

  // ── Slam spring (scale: 3.5 → bounce → 1.0) ──────────────────────
  const slamProgress = spring({
    frame: f,
    fps,
    config: { damping: 8, stiffness: 300, mass: 0.5 },
    durationInFrames: 12,
  });

  const scale = interpolate(slamProgress, [0, 0.5, 1], [3.5, 0.9, 1]);

  // ── Opacity: instant on slam, hold, then fade out ─────────────────
  const opacity = interpolate(
    f,
    [0, 1, holdFrames, holdFrames + fadeOutFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  if (opacity <= 0) return null;

  // ── Screen tremble (decaying noise shake) ─────────────────────────
  const shakeDuration = 8;
  let tx = 0;
  let ty = 0;
  if (f < shakeDuration) {
    const decay = 1 - f / shakeDuration;
    const amp = 6 * decay;
    tx = noise2D("stamp-sx", f * 0.4, 0) * amp;
    ty = noise2D("stamp-sy", 0, f * 0.4) * amp;
  }

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        zIndex: 20,
        transform: `translate(${tx}px, ${ty}px)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 40,
          top: 80,
          transform: `rotate(${rotation}deg) scale(${scale})`,
          transformOrigin: "top left",
          opacity,
          filter: `drop-shadow(0 0 6px rgba(255, 0, 0, ${opacity * 0.4}))`,
        }}
      >
        <Img
          src={staticFile(STAMP_SRC)}
          style={{
            width,
            height: "auto",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
