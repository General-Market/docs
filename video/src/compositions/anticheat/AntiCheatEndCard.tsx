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

const SCENE_SECONDS = 10;

export const AntiCheatEndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const wordmark = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 90, mass: 0.9 },
  });
  const subline = spring({
    frame: frame - toFrames(4),
    fps,
    config: { damping: 22, stiffness: 110, mass: 0.7 },
  });
  const tertiary = spring({
    frame: frame - toFrames(7),
    fps,
    config: { damping: 26, stiffness: 100, mass: 0.8 },
  });

  // Underline draws once the wordmark settles.
  const underlineT = interpolate(
    frame,
    [toFrames(1.6), toFrames(2.6)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        fontFamily: font,
        justifyContent: "center",
        alignItems: "center",
        padding: "0 96px",
      }}
    >
      <div
        style={{
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Eyebrow — small monogram label */}
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 26,
            fontWeight: 500,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: colors.dim,
            marginBottom: 28,
            opacity: interpolate(wordmark, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(wordmark, [0, 1], [10, 0])}px)`,
          }}
        >
          Anti-Cheat · Trading
        </div>

        {/* Wordmark */}
        <div
          style={{
            fontFamily: font,
            fontSize: 220,
            fontWeight: 800,
            letterSpacing: "-0.05em",
            color: colors.fg,
            lineHeight: 0.95,
            opacity: interpolate(wordmark, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(wordmark, [0, 1], [28, 0])}px)`,
            textShadow: "0 4px 28px rgba(0,0,0,0.65)",
          }}
        >
          General
        </div>

        {/* Underline */}
        <div
          style={{
            position: "relative",
            width: 720,
            height: 2,
            marginTop: 28,
            marginBottom: 36,
            background: colors.rule,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: `${underlineT * 100}%`,
              background:
                "linear-gradient(90deg, rgba(245,245,245,0) 0%, #f5f5f5 50%, rgba(245,245,245,0) 100%)",
            }}
          />
        </div>

        {/* Subline */}
        <div
          style={{
            fontFamily: font,
            fontSize: 56,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: colors.fg,
            opacity: interpolate(subline, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(subline, [0, 1], [20, 0])}px)`,
          }}
        >
          Trading is easy with an Anti-Cheat
          <span style={{ color: colors.fg, opacity: 0.45 }}>.</span>
        </div>

        {/* Tertiary */}
        <div
          style={{
            marginTop: 28,
            fontFamily: monoFont,
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: colors.dim,
            opacity: interpolate(tertiary, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(tertiary, [0, 1], [12, 0])}px)`,
          }}
        >
          Available only via trading bots
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

export const antiCheatEndCardMeta = {
  id: "AntiCheatEndCard",
  component: AntiCheatEndCard,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
