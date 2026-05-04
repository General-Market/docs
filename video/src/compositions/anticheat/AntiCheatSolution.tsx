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

const SCENE_SECONDS = 5;
const TERMINAL_AT = toFrames(1.8);
const SHIELDED_FLASH_AT = toFrames(3.0);
const GREEN = "#3ddc84";

export const AntiCheatSolution: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <Backdrop />
      <Headline />
      <Terminal />
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

// ─── Headline: "General changes this." snaps in at 0s, lifts when terminal lands

const Headline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(
    frame,
    [0, toFrames(0.18)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const enterY = interpolate(
    frame,
    [0, toFrames(0.18)],
    [14, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Lift + dim as terminal arrives.
  const lift = interpolate(
    frame,
    [TERMINAL_AT - toFrames(0.1), TERMINAL_AT + toFrames(0.2)],
    [0, -120],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const dim = interpolate(
    frame,
    [TERMINAL_AT - toFrames(0.1), TERMINAL_AT + toFrames(0.2)],
    [1, 0.18],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // One-time scale punch on "changes".
  const punch = spring({
    frame: frame - toFrames(0.05),
    fps,
    config: { damping: 9, stiffness: 220, mass: 0.55 },
  });
  const punchScale =
    1 + Math.sin(Math.min(1, Math.max(0, punch)) * Math.PI) * 0.06;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 96px",
        textAlign: "center",
        opacity: opacity * dim,
        transform: `translateY(${enterY + lift}px)`,
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 132,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          color: colors.fg,
          lineHeight: 0.95,
          textShadow: "0 4px 28px rgba(0,0,0,0.65)",
        }}
      >
        General{" "}
        <span
          style={{
            color: GREEN,
            display: "inline-block",
            transform: `scale(${punchScale})`,
            transformOrigin: "center",
          }}
        >
          changes
        </span>{" "}
        this
      </div>
    </AbsoluteFill>
  );
};

// ─── Terminal: the whole block reveals fast at 1.8s. No type-out. ────────────

const TERMINAL_LINES: { text: string; color: string; bold?: boolean }[] = [
  { text: "$ claude", color: colors.dim },
  { text: "> upgrade my bot to block-trading", color: colors.fg },
  { text: "✓ shielded", color: GREEN, bold: true },
];

const Terminal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < TERMINAL_AT - 2) return null;

  const local = frame - TERMINAL_AT;

  // Whole panel snaps in over 0.3s — phrase-level reveal of all three lines.
  const opacity = interpolate(
    local,
    [0, toFrames(0.3)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const slam = spring({
    frame: local,
    fps,
    config: { damping: 11, stiffness: 200, mass: 0.7 },
  });
  const slamScale = interpolate(slam, [0, 1], [0.92, 1]);
  const y = interpolate(
    local,
    [0, toFrames(0.18)],
    [14, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Green flash on `✓ shielded` at SHIELDED_FLASH_AT (scene-local).
  const flashLocal = frame - SHIELDED_FLASH_AT;
  const flash = spring({
    frame: flashLocal,
    fps,
    config: { damping: 9, stiffness: 220, mass: 0.55 },
  });
  const flashScale =
    1 + Math.sin(Math.min(1, Math.max(0, flash)) * Math.PI) * 0.06;
  const flashGlow = Math.max(
    0,
    Math.sin(Math.min(1, Math.max(0, flash)) * Math.PI),
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 96px",
        opacity,
      }}
    >
      <div
        style={{
          width: "min(1200px, 90%)",
          background: "linear-gradient(180deg, #0d0d10 0%, #050507 100%)",
          border: `1px solid ${colors.rule}`,
          borderRadius: 8,
          transform: `translateY(${y}px) scale(${slamScale})`,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 18px",
            borderBottom: `1px solid ${colors.rule}`,
          }}
        >
          <Dot color="#ff5f57" />
          <Dot color="#febc2e" />
          <Dot color="#28c840" />
          <span
            style={{
              marginLeft: 18,
              fontFamily: monoFont,
              fontSize: 16,
              color: colors.dim,
              letterSpacing: "0.08em",
            }}
          >
            ~/bot — claude
          </span>
        </div>

        <div
          style={{
            padding: "32px 40px 36px",
            fontFamily: monoFont,
            fontSize: 38,
            lineHeight: 1.5,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {TERMINAL_LINES.map((line, i) => {
            const isShielded = line.bold;
            return (
              <div
                key={i}
                style={{
                  color: line.color,
                  fontWeight: line.bold ? 700 : 500,
                  whiteSpace: "pre",
                  display: "inline-block",
                  transform: isShielded
                    ? `scale(${flashScale})`
                    : undefined,
                  transformOrigin: "left center",
                  textShadow:
                    isShielded && flashGlow > 0
                      ? `0 0 ${24 * flashGlow}px rgba(61,220,132,${0.6 * flashGlow})`
                      : undefined,
                }}
              >
                {line.text}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <span
    style={{
      display: "inline-block",
      width: 12,
      height: 12,
      borderRadius: 6,
      background: color,
      opacity: 0.85,
    }}
  />
);

// ─── Backdrop with quiet ambient pulse ────────────────────────────────────────

const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 0.14 + Math.sin((frame / 45) * Math.PI * 2) * 0.04;

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
        style={{ position: "absolute", inset: 0, opacity: 0.3 + pulse }}
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
        {Array.from({ length: 18 }).map((_, i) => (
          <line
            key={`v${i}`}
            x1={(i + 1) * (W / 19)}
            x2={(i + 1) * (W / 19)}
            y1={0}
            y2={H}
            stroke="#13131a"
            strokeWidth={1}
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

export const antiCheatSolutionMeta = {
  id: "AntiCheatSolution",
  component: AntiCheatSolution,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
