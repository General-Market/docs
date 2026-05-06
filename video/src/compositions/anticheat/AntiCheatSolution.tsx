import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import { DotGrid, DotGridVignette } from "./DotGrid";
import { IdleZoom, RevealChars } from "./vibe";

const SCENE_SECONDS = 5.0;
const TERMINAL_AT = toFrames(1.6);
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
          gap: 28,
          justifyContent: "center",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 72,
            height: 72,
            background: colors.accent,
            flexShrink: 0,
            opacity: interpolate(t, [0, 1], [0, 1]),
            transform: `scale(${interpolate(t, [0, 1], [0.4, 1])})`,
          }}
        />
        <span>
          <RevealChars
            text="General "
            startFrame={0}
            stagger={1.4}
            duration={11}
            y={18}
            blur={5}
          />
          <span style={{ color: colors.accent }}>
            <RevealChars
              text="changes"
              startFrame={toFrames(0.18)}
              stagger={1.6}
              duration={12}
              y={20}
              blur={6}
            />
          </span>
          <RevealChars
            text=" this"
            startFrame={toFrames(0.36)}
            stagger={1.4}
            duration={11}
            y={18}
            blur={5}
          />
        </span>
      </div>
      <div
        style={{
          marginTop: 44,
          fontFamily: font,
          fontSize: 64,
          fontWeight: 600,
          letterSpacing: "-0.015em",
          color: colors.fgSoft,
          opacity: interpolate(t2, [0, 1], [0, 1]) * (isTerminal ? 0 : 1),
          transform: `translateY(${interpolate(t2, [0, 1], [16, 0])}px)`,
        }}
      >
        Securing your profits from unfair actors
      </div>
    </AbsoluteFill>
  );
};

// ─── Terminal panel — types out the prompt + response ─────────────────────────

const TERMINAL_LINES: { text: string; color: string; mode: "cmd" | "user" | "ok" }[] = [
  { text: "$ claude", color: "#9aa0a6", mode: "cmd" },
  { text: "> upgrade my bot to block-trading", color: "#f1f3f5", mode: "user" },
  { text: "✓ shielded", color: "#5B86FF", mode: "ok" },
];

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

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 96px",
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

            return (
              <div
                key={i}
                style={{
                  color: line.color,
                  fontWeight: line.mode === "ok" ? 700 : 500,
                  opacity: isActive ? 1 : 0.0,
                  whiteSpace: "pre",
                }}
              >
                {shown}
                {showCursor && <Cursor />}
              </div>
            );
          })}
        </div>
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
