/**
 * StoryCard — Fix 6: Origin story beat.
 *
 * "We wanted to bet on whether our train would be late."
 * "There was no market for it."
 *
 * Personal. Relatable. Grounds the video in human experience.
 * The DB b-roll that follows pays it off immediately.
 */
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { COLOR, FONT } from "../tokens";

export const StoryCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const springConfig = { damping: 12, mass: 0.8 };

  // Line 1 (starts at frame 5)
  const line1Spring = spring({ frame: Math.max(0, frame - 5), fps, config: springConfig });
  const line1Y = interpolate(line1Spring, [0, 1], [30, 0]);
  const line1Op = interpolate(line1Spring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });

  // Line 2 (delayed — 5-frame stagger concept, but preserving the dramatic pause at frame 22)
  const line2Spring = spring({ frame: Math.max(0, frame - 22), fps, config: springConfig });
  const line2Y = interpolate(line2Spring, [0, 1], [30, 0]);
  const line2Op = interpolate(line2Spring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });

  // Fade out
  const fadeOut = interpolate(frame, [48, 58], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.page }}>
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)", textAlign: "center",
        maxWidth: 900, opacity: fadeOut,
      }}>
        <div style={{
          opacity: line1Op, transform: `translateY(${line1Y}px)`,
        }}>
          <span style={{
            fontFamily: FONT.sans, fontSize: 40, fontWeight: 600,
            color: COLOR.textPrimary, letterSpacing: "-0.02em",
            lineHeight: 1.4,
          }}>
            We wanted to bet on whether our train would be late.
          </span>
        </div>

        <div style={{
          opacity: line2Op, transform: `translateY(${line2Y}px)`,
          marginTop: 16,
        }}>
          <span style={{
            fontFamily: FONT.sans, fontSize: 36, fontWeight: 500,
            color: COLOR.textMuted, letterSpacing: "-0.01em",
          }}>
            There was no market for it.
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
