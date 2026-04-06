/**
 * OpeningSequence — the hook with a metric.
 *
 * PH finding: metrics placed early = massive boost.
 * PH finding: questions on screen = boost.
 * PH finding: numbers in title = +43 median.
 *
 * Two lines:
 *   "583,551 things in the world have no market."
 *   (pause)
 *   "What if they did?"
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { COLOR, FONT } from "../tokens";

export const OpeningSequence: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const springConfig = { damping: 12, mass: 0.8 };

  // Line 1: the metric (starts at frame 3)
  const line1Spring = spring({ frame: Math.max(0, frame - 3), fps, config: springConfig });
  const line1Y = interpolate(line1Spring, [0, 1], [30, 0]);
  const line1Opacity = interpolate(line1Spring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });

  // Line 2: the question (delayed — 5-frame stagger from line 1 start + natural gap = frame 20)
  const line2Spring = spring({ frame: Math.max(0, frame - 20), fps, config: springConfig });
  const line2Y = interpolate(line2Spring, [0, 1], [30, 0]);
  const line2Opacity = interpolate(line2Spring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });

  // End fade
  const fadeOut = interpolate(frame, [44, 58], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const masterOpacity = frame < 44 ? 1 : fadeOut;

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.page }}>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          maxWidth: 1100,
          opacity: masterOpacity,
        }}
      >
        {/* The metric — large, monospace number */}
        <div
          style={{
            opacity: line1Opacity,
            transform: `translateY(${line1Y}px)`,
          }}
        >
          <span
            style={{
              fontFamily: FONT.sans,
              fontSize: 48,
              fontWeight: 700,
              color: COLOR.textPrimary,
              letterSpacing: "-0.02em",
              lineHeight: 1.4,
            }}
          >
            <span
              style={{
                fontFamily: FONT.mono,
                fontWeight: 700,
                color: COLOR.textPrimary,
              }}
            >
              583,551
            </span>
            {" things in the world have no market."}
          </span>
        </div>

        {/* The question — lighter weight */}
        <div
          style={{
            opacity: line2Opacity,
            transform: `translateY(${line2Y}px)`,
            marginTop: 20,
          }}
        >
          <span
            style={{
              fontFamily: FONT.sans,
              fontSize: 44,
              fontWeight: 500,
              color: COLOR.textMuted,
              letterSpacing: "-0.01em",
            }}
          >
            What if they did?
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
