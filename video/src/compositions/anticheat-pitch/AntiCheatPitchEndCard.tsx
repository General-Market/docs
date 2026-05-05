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
import { PitchFrame } from "./PitchFrame";

const SCENE_SECONDS = 3.5;
const SUBLINE_AT = toFrames(1.0);
const TERTIARY_AT = toFrames(1.6);

export const AntiCheatPitchEndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Beat 1 (0s): wordmark "General" snaps in.
  const wordmarkOpacity = interpolate(
    frame,
    [0, toFrames(0.18)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const wordmarkY = interpolate(
    frame,
    [0, toFrames(0.18)],
    [14, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Hero word punch — once.
  const punch = spring({
    frame: frame - toFrames(0.05),
    fps,
    config: { damping: 9, stiffness: 220, mass: 0.55 },
  });
  const wordmarkPunch =
    1 + Math.sin(Math.min(1, Math.max(0, punch)) * Math.PI) * 0.06;

  // Underline draws once, immediately under wordmark.
  const underlineT = interpolate(
    frame,
    [toFrames(0.4), toFrames(1.1)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Beat 2 (1.5s): subline.
  const sublineLocal = frame - SUBLINE_AT;
  const sublineOpacity = interpolate(
    sublineLocal,
    [0, toFrames(0.18)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const sublineY = interpolate(
    sublineLocal,
    [0, toFrames(0.18)],
    [14, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Beat 3 (3.0s): tertiary.
  const tertiaryLocal = frame - TERTIARY_AT;
  const tertiaryOpacity = interpolate(
    tertiaryLocal,
    [0, toFrames(0.18)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const tertiaryY = interpolate(
    tertiaryLocal,
    [0, toFrames(0.18)],
    [14, 0],
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
      <Backdrop />
      <div
        style={{
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 40,
            fontWeight: 500,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: colors.dim,
            marginBottom: 32,
            opacity: wordmarkOpacity,
            transform: `translateY(${wordmarkY}px)`,
          }}
        >
          Anti-Cheat · Trading
        </div>

        <div
          style={{
            fontFamily: font,
            fontSize: 220,
            fontWeight: 800,
            letterSpacing: "-0.05em",
            color: colors.fg,
            lineHeight: 0.95,
            opacity: wordmarkOpacity,
            transform: `translateY(${wordmarkY}px) scale(${wordmarkPunch})`,
            transformOrigin: "center",
            textShadow: "0 4px 28px rgba(0,0,0,0.65)",
          }}
        >
          General
        </div>

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

        <div
          style={{
            fontFamily: font,
            fontSize: 56,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: colors.fg,
            opacity: sublineOpacity,
            transform: `translateY(${sublineY}px)`,
          }}
        >
          Trading is easy with an Anti-Cheat
        </div>

        <div
          style={{
            marginTop: 32,
            fontFamily: monoFont,
            fontSize: 32,
            fontWeight: 500,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: colors.dim,
            opacity: tertiaryOpacity,
            transform: `translateY(${tertiaryY}px)`,
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
      <PitchFrame chapter={6} total={6} eyebrow="INDEX MAKER" />
    </AbsoluteFill>
  );
};

// ─── Backdrop with quiet ambient pulse ────────────────────────────────────────

const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 0.10 + Math.sin((frame / 45) * Math.PI * 2) * 0.04;

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0d0d10 0%, #050507 100%)",
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, opacity: pulse + 0.2 }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            x2={W}
            y1={(i + 1) * (H / 13)}
            y2={(i + 1) * (H / 13)}
            stroke="#16161b"
            strokeWidth={1}
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

export const antiCheatPitchEndCardMeta = {
  id: "AntiCheatPitchEndCard",
  component: AntiCheatPitchEndCard,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
