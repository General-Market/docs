import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors, pitchSans, pitchSansLight, toFrames } from "./theme";

// The slim chrome dropped over every scene to give the file a pitch-deck
// rhythm: eyebrow stamp top-left, slot pager top-right, date trailer bottom-
// right, hairline rule across the top. Self-contained — render as a sibling
// of the scene content.
export const PitchFrame: React.FC<{
  chapter: number;
  total: number;
  eyebrow: string;
  date?: string;
  showFromFrame?: number;
}> = ({
  chapter,
  total,
  eyebrow,
  date = "NOVEMBER 19, 2025",
  showFromFrame = toFrames(0.2),
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [showFromFrame, showFromFrame + toFrames(0.4)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const stamp = `${String(chapter).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;

  return (
    <>
      {/* Top hairline rule — sits above the scene */}
      <div
        style={{
          position: "absolute",
          top: 56,
          left: 64,
          right: 64,
          height: 1,
          background: colors.rule,
          opacity: 0.85,
        }}
      />

      {/* Top-left eyebrow stamp */}
      <div
        style={{
          position: "absolute",
          top: 70,
          left: 64,
          opacity,
          fontFamily: pitchSans,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: colors.accent,
          display: "flex",
          alignItems: "center",
          gap: 18,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 28,
            height: 2,
            background: colors.accent,
          }}
        />
        {eyebrow}
      </div>

      {/* Top-right slot pager */}
      <div
        style={{
          position: "absolute",
          top: 70,
          right: 64,
          opacity,
          fontFamily: pitchSansLight,
          fontSize: 22,
          fontWeight: 400,
          letterSpacing: "0.28em",
          color: colors.dim,
        }}
      >
        {stamp}
      </div>

      {/* Bottom-right date trailer */}
      <div
        style={{
          position: "absolute",
          bottom: 44,
          right: 64,
          opacity,
          fontFamily: pitchSansLight,
          fontSize: 18,
          fontWeight: 400,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: colors.dim,
        }}
      >
        {date}
      </div>

      {/* Bottom-left wordmark */}
      <div
        style={{
          position: "absolute",
          bottom: 44,
          left: 64,
          opacity,
          fontFamily: pitchSans,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "0.34em",
          textTransform: "uppercase",
          color: colors.fg,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            background: colors.accent,
          }}
        />
        General
      </div>
    </>
  );
};
