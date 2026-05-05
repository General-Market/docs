import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";

const SCENE_SECONDS = 6;
const SECOND_LINE_AT = toFrames(2.5);
const GREEN = "#3ddc84";

export const AntiCheatReassure: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t1 = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 110, mass: 0.7 },
  });
  const t2 = spring({
    frame: frame - SECOND_LINE_AT,
    fps,
    config: { damping: 22, stiffness: 100, mass: 0.8 },
  });

  // The first line drifts up slightly as the second arrives.
  const liftFirst = interpolate(
    frame,
    [SECOND_LINE_AT - toFrames(0.3), SECOND_LINE_AT + toFrames(0.5)],
    [0, -64],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Shield reveals with the second line.
  const shield = spring({
    frame: frame - SECOND_LINE_AT,
    fps,
    config: { damping: 26, stiffness: 100, mass: 1 },
  });
  const shieldOpacity = interpolate(shield, [0, 1], [0, 0.06]);
  const shieldScale = interpolate(shield, [0, 1], [0.85, 1]);

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
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: colors.fg,
            lineHeight: 0.95,
            textShadow: "0 4px 28px rgba(0,0,0,0.65)",
            opacity: interpolate(t1, [0, 1], [0, 1]),
            transform: `translateY(${
              interpolate(t1, [0, 1], [22, 0]) + liftFirst
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
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: colors.fg,
            opacity: interpolate(t2, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(t2, [0, 1], [22, 0])}px)`,
          }}
        >
          <span style={{ color: colors.dim, opacity: 0.7 }}>.&nbsp;.&nbsp;.</span>{" "}
          but{" "}
          <span style={{ color: GREEN }}>shielded</span>
          <span style={{ color: colors.fg, opacity: 0.45 }}>.</span>
        </div>

        <div
          style={{
            marginTop: 44,
            fontFamily: monoFont,
            fontSize: 36,
            fontWeight: 500,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: colors.dim,
            opacity:
              interpolate(t2, [0, 1], [0, 1]) *
              interpolate(
                frame,
                [SECOND_LINE_AT + toFrames(0.4), SECOND_LINE_AT + toFrames(1.0)],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              ),
          }}
        >
          Same markets · same speed · cheaters removed
        </div>
      </div>

      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
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
        stroke="#3ddc84"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path
        d="M30 56 L46 72 L72 40"
        fill="none"
        stroke="#3ddc84"
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
