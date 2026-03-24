/**
 * FourHundredKCard — "583,551 of them. And counting."
 *
 * The answer to the opening question.
 * Not a boast — a fact stated quietly on white.
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLOR, FONT } from "../tokens";

const COUNT_START = 180_000;
const COUNT_END = 583_551;

const formatNumber = (n: number): string =>
  Math.round(n).toLocaleString("en-US");

export const FourHundredKCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // 3D rotation on entrance — card tilts into place
  const entrance3d = spring({ frame, fps, config: { damping: 14 } });
  const rotateY = interpolate(entrance3d, [0, 1], [-4, 0]);

  const countStart = 5;
  const countDuration = 24;
  const countEnd = countStart + countDuration;
  const suffixStart = countEnd + 2;

  // Count-up
  const countProgress = interpolate(
    frame,
    [countStart, countEnd],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const easedProgress = 1 - Math.pow(1 - countProgress, 3);
  const currentCount = COUNT_START + (COUNT_END - COUNT_START) * easedProgress;

  const numberOpacity = interpolate(
    frame,
    [countStart, countStart + 5],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // "of them. And counting."
  const suffixOpacity = interpolate(
    frame,
    [suffixStart, suffixStart + 8],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const suffixY = interpolate(
    frame,
    [suffixStart, suffixStart + 8],
    [4, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // ── EXIT: scale down to 0.97 + fade in last 8 frames ──
  const exitProgress = interpolate(frame, [durationInFrames - 8, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const exitScale = interpolate(exitProgress, [0, 1], [1, 0.97]);
  const exitOpacity = interpolate(exitProgress, [0, 1], [1, 0]);

  return (
    <AbsoluteFill style={{
      backgroundColor: "transparent",
      perspective: '1200px',
      transform: `scale(${exitScale})`,
      opacity: exitOpacity,
    }}>
      <div style={{ width: '100%', height: '100%', transform: `rotateY(${rotateY}deg)`, transformStyle: 'preserve-3d' }}>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          {/* The number */}
          <div
            style={{
              fontFamily: FONT.mono,
              fontWeight: 700,
              fontSize: 120,
              color: COLOR.textPrimary,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
              opacity: numberOpacity,
            }}
          >
            {formatNumber(currentCount)}
          </div>

          {/* Suffix */}
          <div
            style={{
              fontFamily: FONT.sans,
              fontWeight: 500,
              fontSize: 28,
              color: COLOR.textMuted,
              letterSpacing: "0.02em",
              opacity: suffixOpacity,
              transform: `translateY(${suffixY}px)`,
            }}
          >
            of them. And counting.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
