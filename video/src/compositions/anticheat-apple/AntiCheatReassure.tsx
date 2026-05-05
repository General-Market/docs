import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, easeOut, toFrames } from "./theme";

const SCENE_SECONDS = 6;
const SECOND_LINE_AT = toFrames(2.5);

export const AntiCheatReassure: React.FC = () => {
  const frame = useCurrentFrame();

  // First line entrance — 36-frame ease-out.
  const t1 = interpolate(frame, [0, 36], [0, 1], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Second line entrance — 36-frame ease-out, offset to SECOND_LINE_AT.
  const t2 = interpolate(frame - SECOND_LINE_AT, [0, 36], [0, 1], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The first line drifts up slightly as the second arrives.
  const liftFirst = interpolate(
    frame,
    [SECOND_LINE_AT - toFrames(0.3), SECOND_LINE_AT + toFrames(0.5)],
    [0, -64],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Shield reveals with the second line — 36-frame ease-out.
  const shield = interpolate(frame - SECOND_LINE_AT, [0, 36], [0, 1], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shieldOpacity = interpolate(shield, [0, 1], [0, 0.04]);
  const shieldScale = interpolate(shield, [0, 1], [0.85, 1]);

  // The leading "... but" lifts from dim → fg over 6 frames once `shielded`
  // arrives (the existing gradient transition — preserved).
  const leadingBrighten = interpolate(
    frame,
    [SECOND_LINE_AT + toFrames(0.4), SECOND_LINE_AT + toFrames(0.4) + 6],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Tagline opacity (mono dim line below).
  const taglineOpacity =
    t2 *
    interpolate(
      frame,
      [SECOND_LINE_AT + toFrames(0.4), SECOND_LINE_AT + toFrames(1.0)],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );

  // 1px hairline rule beneath the second line — draws from center outward
  // over 14 frames as the tagline lands.
  const ruleStart = SECOND_LINE_AT + toFrames(0.4);
  const ruleT = interpolate(frame, [ruleStart, ruleStart + 14], [0, 1], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        fontFamily: font,
        justifyContent: "center",
        alignItems: "center",
        padding: "0 96px",
        overflow: "hidden",
      }}
    >
      {/* Faint shield in the back */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: shieldOpacity,
          transform: `scale(${shieldScale})`,
        }}
      >
        <ShieldGlyph />
      </div>

      <div
        style={{
          textAlign: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 124,
            fontWeight: 400,
            letterSpacing: "-0.04em",
            color: colors.fg,
            lineHeight: 0.95,
            opacity: t1,
            transform: `translateY(${
              interpolate(t1, [0, 1], [32, 0]) + liftFirst
            }px)`,
          }}
        >
          Trade all the same assets
          <span style={{ color: colors.fg, opacity: 0.45 }}>.</span>
        </div>

        <div
          style={{
            marginTop: 36,
            fontFamily: font,
            fontSize: 96,
            fontWeight: 400,
            letterSpacing: "-0.025em",
            color: colors.fg,
            opacity: t2,
            transform: `translateY(${interpolate(t2, [0, 1], [32, 0])}px)`,
          }}
        >
          <span
            style={{
              color: colors.dim,
              opacity: interpolate(leadingBrighten, [0, 1], [0.7, 1]),
            }}
          >
            .&nbsp;.&nbsp;.
          </span>{" "}
          <span
            style={{
              color: interpolate(leadingBrighten, [0, 1], [0, 1]) > 0.5 ? colors.fg : colors.dim,
              opacity: interpolate(leadingBrighten, [0, 1], [0.7, 1]),
            }}
          >
            but
          </span>{" "}
          <span style={{ color: colors.green }}>shielded</span>
          <span style={{ color: colors.fg, opacity: 0.45 }}>.</span>
        </div>

        {/* Hairline rule beneath the second line — center-out over 14 frames */}
        <div
          style={{
            position: "relative",
            margin: "32px auto 0",
            width: 720,
            height: 1,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              bottom: 0,
              width: `${ruleT * 100}%`,
              transform: "translateX(-50%)",
              background: colors.rule,
            }}
          />
        </div>

        <div
          style={{
            marginTop: 24,
            fontFamily: monoFont,
            fontSize: 36,
            fontWeight: 500,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: colors.dim,
            opacity: taglineOpacity,
          }}
        >
          Same markets · same speed · cheaters removed
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ShieldGlyph: React.FC = () => {
  return (
    <svg
      width={900}
      height={1000}
      viewBox="0 0 100 110"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d="M50 4 L92 18 L92 56 C92 82 72 99 50 106 C28 99 8 82 8 56 L8 18 Z"
        fill="none"
        stroke={colors.green}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path
        d="M30 56 L46 72 L72 40"
        fill="none"
        stroke={colors.green}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const antiCheatAppleReassureMeta = {
  id: "AntiCheatAppleReassure",
  component: AntiCheatReassure,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
