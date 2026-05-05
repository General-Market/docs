import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, easeOut, toFrames } from "./theme";

const SCENE_SECONDS = 7.0;
const TERMINAL_AT = toFrames(3.2);

export const AntiCheatSolution: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <Headline />

      <Sequence from={TERMINAL_AT}>
        <Terminal />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─── Headline: "General changes this." ────────────────────────────────────────

const Headline: React.FC = () => {
  const frame = useCurrentFrame();

  // 36-frame ease-out entrance.
  const tIn = interpolate(frame, [0, 36], [0, 1], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tSubIn = interpolate(frame - toFrames(0.6), [0, 36], [0, 1], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Slide up + fade as the terminal arrives. Headline reaches 0 BEFORE the
  // terminal lands — Apple = one scene, one hero. No half-opacity ghost
  // sitting behind the next element.
  const lift = interpolate(
    frame,
    [TERMINAL_AT - toFrames(0.4), TERMINAL_AT - toFrames(0.05)],
    [0, -240],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const headlineOpacity = interpolate(
    frame,
    [TERMINAL_AT - toFrames(0.4), TERMINAL_AT - toFrames(0.05)],
    [1, 0],
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
          fontWeight: 300,
          letterSpacing: "-0.04em",
          color: "#f2f4f6",
          lineHeight: 0.95,
          opacity: tIn,
          transform: `translateY(${interpolate(tIn, [0, 1], [32, 0])}px)`,
        }}
      >
        General <span style={{ color: colors.green }}>changes</span> this
        <span style={{ color: "#f2f4f6", opacity: 0.45 }}>.</span>
      </div>
      <div
        style={{
          marginTop: 36,
          fontFamily: monoFont,
          fontSize: 40,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: colors.dim,
          opacity: tSubIn * (isTerminal ? 0 : 1),
          transform: `translateY(${interpolate(tSubIn, [0, 1], [32, 0])}px)`,
        }}
      >
        Securing your profits from unfair actors
      </div>
    </AbsoluteFill>
  );
};

// ─── Terminal panel — types out the prompt + response ─────────────────────────

const TERMINAL_LINES: { text: string; color: string; mode: "cmd" | "user" | "ok" }[] = [
  { text: "$ claude", color: colors.dim, mode: "cmd" },
  { text: "> upgrade my bot to block-trading", color: colors.fg, mode: "user" },
  { text: "✓ shielded", color: colors.green, mode: "ok" },
];

const Terminal: React.FC = () => {
  const frame = useCurrentFrame();

  // Panel itself eases in over 36 frames.
  const panel = interpolate(frame, [0, 36], [0, 1], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const panelOpacity = panel;
  const panelY = interpolate(panel, [0, 1], [32, 0]);

  // Per-line typewriter timings (frames are local to the terminal sequence).
  const LINE_DELAYS = [toFrames(0.3), toFrames(1.2), toFrames(2.5)];
  const CHARS_PER_FRAME = 0.7; // ~21 cps at 30fps

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 96px",
        paddingBottom: "12%",
      }}
    >
      <div
        style={{
          width: "min(1200px, 90%)",
          background: colors.bg,
          border: `1px solid ${colors.rule}`,
          borderRadius: 8,
          opacity: panelOpacity,
          transform: `translateY(${panelY}px)`,
        }}
      >
        {/* Window chrome — single mono caption, no decorative dots. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "14px 18px",
            borderBottom: `1px solid ${colors.rule}`,
          }}
        >
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 22,
              color: colors.dim,
              letterSpacing: "0.18em",
            }}
          >
            ~/bot — claude
          </span>
        </div>

        {/* Body */}
        <div
          style={{
            padding: "36px 44px 40px",
            fontFamily: monoFont,
            fontSize: 36,
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
                  fontWeight: line.mode === "ok" ? 500 : 500,
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
        background: colors.fg,
        opacity: blink ? 0.85 : 0.0,
        height: "1em",
        verticalAlign: "-0.18em",
      }}
    />
  );
};

export const antiCheatAppleSolutionMeta = {
  id: "AntiCheatAppleSolution",
  component: AntiCheatSolution,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
