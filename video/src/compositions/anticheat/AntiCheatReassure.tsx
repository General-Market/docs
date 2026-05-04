import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";

const SCENE_SECONDS = 4;
const SECOND_LINE_AT = toFrames(2.0);
const GREEN = "#3ddc84";

export const AntiCheatReassure: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Beat 1: "Trade all the same assets." — snap in at 0s.
  const t1Opacity = interpolate(
    frame,
    [0, toFrames(0.18)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const t1Y = interpolate(
    frame,
    [0, toFrames(0.18)],
    [14, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // First line drifts up slightly when second arrives.
  const liftFirst = interpolate(
    frame,
    [SECOND_LINE_AT - toFrames(0.1), SECOND_LINE_AT + toFrames(0.2)],
    [0, -64],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Beat 2: ". . . but shielded." — snap in at 2.0s with hero punch on `shielded`.
  const local2 = frame - SECOND_LINE_AT;
  const t2Opacity = interpolate(
    local2,
    [0, toFrames(0.18)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const t2Y = interpolate(
    local2,
    [0, toFrames(0.18)],
    [14, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const punch = spring({
    frame: local2 - toFrames(0.05),
    fps,
    config: { damping: 9, stiffness: 220, mass: 0.55 },
  });
  const punchScale =
    1 + Math.sin(Math.min(1, Math.max(0, punch)) * Math.PI) * 0.06;

  // Shield reveal sized with second line.
  const shield = spring({
    frame: local2,
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
      <Backdrop />
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

      <div style={{ textAlign: "center", position: "relative" }}>
        <div
          style={{
            fontFamily: font,
            fontSize: 124,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: colors.fg,
            lineHeight: 0.95,
            textShadow: "0 4px 28px rgba(0,0,0,0.65)",
            opacity: t1Opacity,
            transform: `translateY(${t1Y + liftFirst}px)`,
          }}
        >
          Trade all the same assets
        </div>

        <div
          style={{
            marginTop: 36,
            fontFamily: font,
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: colors.fg,
            opacity: t2Opacity,
            transform: `translateY(${t2Y}px)`,
          }}
        >
          <span style={{ color: colors.dim, opacity: 0.7 }}>
            .&nbsp;.&nbsp;.
          </span>{" "}
          but{" "}
          <span
            style={{
              color: GREEN,
              display: "inline-block",
              transform: `scale(${punchScale})`,
              transformOrigin: "center",
            }}
          >
            shielded
          </span>
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

const ShieldGlyph: React.FC = () => (
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

// ─── Backdrop with quiet ambient pulse ────────────────────────────────────────

const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 0.10 + Math.sin((frame / 45) * Math.PI * 2) * 0.04;

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0d0d10 0%, #050507 100%)",
        opacity: 1,
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

export const antiCheatReassureMeta = {
  id: "AntiCheatReassure",
  component: AntiCheatReassure,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
