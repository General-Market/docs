import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import { DotGrid, DotGridVignette } from "./DotGrid";
import { IdleZoom, RevealChars } from "./vibe";

const SCENE_SECONDS = 8;
const TERMINAL_AT = toFrames(2.8);
const SCENE_FRAMES = toFrames(SCENE_SECONDS);

export const AntiCheatSolution: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <IdleZoom durationInFrames={SCENE_FRAMES} from={1} to={1.04}>
        <DotGrid />
        <Headline />

        <Sequence from={TERMINAL_AT}>
          <Terminal />
        </Sequence>

        <DotGridVignette intensity={0.18} />
      </IdleZoom>
    </AbsoluteFill>
  );
};

// ─── Headline: "General changes this." ────────────────────────────────────────

const Headline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 110, mass: 0.7 },
  });
  const t2 = spring({
    frame: frame - toFrames(0.6),
    fps,
    config: { damping: 22, stiffness: 100, mass: 0.8 },
  });

  const lift = interpolate(
    frame,
    [TERMINAL_AT - toFrames(0.3), TERMINAL_AT + toFrames(0.4)],
    [0, -120],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const headlineOpacity = interpolate(
    frame,
    [TERMINAL_AT - toFrames(0.2), TERMINAL_AT + toFrames(0.5)],
    [1, 0.18],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const isTerminal = frame >= TERMINAL_AT;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 96px",
        textAlign: "center",
        opacity: headlineOpacity,
        transform: `translateY(${lift}px)`,
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
          display: "flex",
          alignItems: "center",
          gap: 36,
          justifyContent: "center",
        }}
      >
        <span>
          <RevealChars
            text="Introducing "
            startFrame={0}
            stagger={0.7}
            duration={10}
            y={16}
            blur={4}
          />
          <span style={{ color: colors.accent }}>
            <RevealChars
              text="General"
              startFrame={toFrames(0.36)}
              stagger={1.0}
              duration={11}
              y={18}
              blur={5}
            />
          </span>
        </span>
        <img
          src={staticFile("gm-logo-black.svg")}
          alt=""
          style={{
            width: 132,
            height: 132,
            display: "inline-block",
            flexShrink: 0,
            opacity: interpolate(t, [0, 1], [0, 1]),
            transform: `scale(${interpolate(t, [0, 1], [0.4, 1])}) rotate(${interpolate(
              t,
              [0, 1],
              [-12, 0],
            )}deg)`,
          }}
        />
      </div>
      <div
        style={{
          marginTop: 44,
          fontFamily: font,
          fontSize: 60,
          fontWeight: 600,
          letterSpacing: "-0.015em",
          color: colors.fgSoft,
          opacity: interpolate(t2, [0, 1], [0, 1]) * (isTerminal ? 0 : 1),
          transform: `translateY(${interpolate(t2, [0, 1], [16, 0])}px)`,
        }}
      >
        shield your pnl in 5 minutes from bad actors
      </div>
    </AbsoluteFill>
  );
};

// ─── Terminal panel — types out the prompt + response ─────────────────────────

const TERMINAL_LINES: { text: string; color: string; mode: "cmd" | "user" | "ok" }[] = [
  { text: "$ claude", color: "#9aa0a6", mode: "cmd" },
  { text: "> upgrade my bot to block-trading", color: "#f1f3f5", mode: "user" },
  { text: "shielded", color: "#5B86FF", mode: "ok" },
];

const ShieldIcon: React.FC<{ size: number; glow: number }> = ({ size, glow }) => (
  <svg
    width={size}
    height={size * 1.14}
    viewBox="0 0 24 28"
    style={{
      flexShrink: 0,
      filter: `drop-shadow(0 0 ${4 + glow * 18}px rgba(91,134,255,${0.55 + glow * 0.4}))`,
    }}
  >
    <path
      d="M12 1.4 L22 5 L22 13 C22 19 17.4 24.8 12 26.6 C6.6 24.8 2 19 2 13 L2 5 Z"
      fill="#5B86FF"
    />
    <path
      d="M7.6 13.4 L10.8 16.6 L16.8 9.6"
      stroke="#0b0b10"
      strokeWidth={2.6}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Terminal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const panel = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 130, mass: 0.6 },
  });
  const panelOpacity = interpolate(panel, [0, 1], [0, 1]);
  const panelY = interpolate(panel, [0, 1], [40, 0]);

  const LINE_DELAYS = [toFrames(0.2), toFrames(0.8), toFrames(2.0)];
  const CHARS_PER_FRAME = 0.85;

  // Frame at which the absolute scene-frame "✓ shielded" finishes typing.
  const shieldedTypeFrames = Math.ceil(
    TERMINAL_LINES[2].text.length / CHARS_PER_FRAME,
  );
  const shieldedCompleteAt = LINE_DELAYS[2] + shieldedTypeFrames;
  const sinceShieldedDone = Math.max(0, frame - shieldedCompleteAt);

  // Punch curve: scale snaps up then settles back.
  const punch = interpolate(
    sinceShieldedDone,
    [0, 4, 12, 26],
    [0, 0.22, 0.04, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Sustained breathing glow after the punch.
  const glowSustain = interpolate(
    sinceShieldedDone,
    [0, 8, 20],
    [0, 1, 0.55],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const glow = Math.max(punch * 1.6, glowSustain);

  // CTA springs in alongside the terminal panel.
  const ctaSpring = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 130, mass: 0.6 },
  });
  const ctaOpacity = interpolate(ctaSpring, [0, 1], [0, 1]);
  const ctaY = interpolate(ctaSpring, [0, 1], [40, 0]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 96px",
        flexDirection: "column",
        gap: 56,
      }}
    >
      <div
        style={{
          width: "min(1200px, 90%)",
          background: "linear-gradient(180deg, #0d0d10 0%, #050507 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          opacity: panelOpacity,
          transform: `translateY(${panelY}px)`,
          boxShadow:
            "0 0 0 1px rgba(10,12,18,0.10), 0 24px 56px rgba(10,12,18,0.20)",
        }}
      >
        {/* Window chrome */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Dot color="#ff5f57" />
          <Dot color="#febc2e" />
          <Dot color="#28c840" />
          <span
            style={{
              marginLeft: 18,
              fontFamily: monoFont,
              fontSize: 24,
              color: "#9aa0a6",
              letterSpacing: "0.08em",
            }}
          >
            ~/bot — claude
          </span>
        </div>

        <div
          style={{
            padding: "36px 44px 40px",
            fontFamily: monoFont,
            fontSize: 50,
            lineHeight: 1.5,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {TERMINAL_LINES.map((line, i) => {
            const start = LINE_DELAYS[i];
            const localFrame = Math.max(0, frame - start);
            const visibleChars = Math.min(
              line.text.length,
              Math.floor(localFrame * CHARS_PER_FRAME),
            );
            const shown = line.text.slice(0, visibleChars);
            const isActive = frame >= start;
            const isComplete = visibleChars >= line.text.length;
            const showCursor = isActive && !isComplete;
            const isShielded = line.mode === "ok";

            const lineScale = isShielded ? 1 + punch : 1;
            const shieldGlow = isShielded ? glow : 0;

            return (
              <div
                key={i}
                style={{
                  color: line.color,
                  fontWeight: line.mode === "ok" ? 700 : 500,
                  opacity: isActive ? 1 : 0.0,
                  whiteSpace: "pre",
                  display: "flex",
                  alignItems: "center",
                  gap: isShielded ? 18 : 0,
                  transform: `scale(${lineScale})`,
                  transformOrigin: "left center",
                  textShadow:
                    isShielded && isComplete
                      ? `0 0 ${22 + shieldGlow * 44}px rgba(91,134,255,${0.45 + shieldGlow * 0.35})`
                      : undefined,
                }}
              >
                {isShielded && isActive ? (
                  <ShieldIcon size={48} glow={shieldGlow} />
                ) : null}
                <span style={{ whiteSpace: "pre" }}>
                  {shown}
                  {showCursor && <Cursor />}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          width: "min(1500px, 92%)",
          textAlign: "center",
          fontFamily: font,
          fontSize: 120,
          fontWeight: 700,
          letterSpacing: "-0.025em",
          lineHeight: 1.08,
          color: colors.fg,
          opacity: ctaOpacity,
          transform: `translateY(${ctaY}px)`,
        }}
      >
        <span style={{ color: colors.accent, fontWeight: 800 }}>Shield</span>{" "}
        your pnl in 5 minutes
      </div>
    </AbsoluteFill>
  );
};

const Cursor: React.FC = () => {
  const frame = useCurrentFrame();
  const blink = Math.floor(frame / 8) % 2 === 0;
  return (
    <span
      style={{
        display: "inline-block",
        width: "0.55em",
        marginLeft: 2,
        background: "#f1f3f5",
        opacity: blink ? 0.85 : 0.0,
        height: "1em",
        verticalAlign: "-0.18em",
      }}
    />
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

export const antiCheatSolutionMeta = {
  id: "AntiCheatSolution",
  component: AntiCheatSolution,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
