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
const TERMINAL_AT = toFrames(0.8);
const GREEN = "#3ddc84";

// Per-line typewriter timing (scene-local seconds, char-per-second cps).
type Line = {
  text: string;
  color: string;
  bold?: boolean;
  startSec: number;
  cps: number;
};

const LINES: Line[] = [
  { text: "$ claude", color: colors.dim, startSec: 0.8, cps: 32 },
  {
    text: "> upgrade my bot to block-trading",
    color: colors.fg,
    startSec: 1.4,
    cps: 32,
  },
  {
    text: "✓ shielded",
    color: GREEN,
    bold: true,
    startSec: 2.8,
    cps: 32,
  },
];

const LINE_END_SEC = (l: Line) => l.startSec + l.text.length / l.cps;
const LAST_LINE = LINES[LINES.length - 1];
const CHECK_LANDS_SEC = LINE_END_SEC(LAST_LINE);

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

// ─── Headline: "General changes this." snaps in at 0s, sits at the top. ──────

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

  // One-time scale punch on "changes".
  const punch = spring({
    frame: frame - toFrames(0.05),
    fps,
    config: { damping: 9, stiffness: 220, mass: 0.55 },
  });
  const punchScale =
    1 + Math.sin(Math.min(1, Math.max(0, punch)) * Math.PI) * 0.06;

  return (
    <div
      style={{
        position: "absolute",
        top: "10%",
        left: 0,
        right: 0,
        textAlign: "center",
        padding: "0 96px",
        opacity,
        transform: `translateY(${enterY}px)`,
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 110,
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
    </div>
  );
};

// ─── Terminal: dark panel + character-by-character type-out per line. ────────

const Terminal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < TERMINAL_AT - 2) return null;

  const local = frame - TERMINAL_AT;
  const localSec = local / FPS;

  // Panel scale-spring entrance the moment line 1 starts typing.
  const enterFrame = local - toFrames(LINES[0].startSec - TERMINAL_AT / FPS);
  const enter = spring({
    frame: enterFrame,
    fps,
    config: { damping: 10, stiffness: 180, mass: 0.7, overshootClamping: false },
  });
  // back.out(1.6)-flavoured: spring already overshoots; compress range to 0.96 → 1.0.
  const enterScale = interpolate(enter, [0, 1], [0.96, 1.0]);
  const enterOpacity = interpolate(
    enterFrame,
    [0, toFrames(0.32)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Determine the active line — the highest line whose start has passed.
  let activeLineIdx = -1;
  for (let i = 0; i < LINES.length; i++) {
    if (localSec >= LINES[i].startSec) activeLineIdx = i;
  }
  const allDone =
    activeLineIdx === LINES.length - 1 && localSec >= CHECK_LANDS_SEC;

  // Cursor blink: 1Hz square wave keyed off frame. Solid (no blink) once `✓ shielded`
  // has fully landed.
  const blinkFrames = Math.round(FPS / 2); // 15 frames on, 15 off → 1Hz
  const blinkOn = Math.floor(local / blinkFrames) % 2 === 0;
  const cursorVisible = allDone ? true : blinkOn;

  // Green-pulse on the shielded line: starts when `✓ shielded` fully lands.
  const checkLandFrame = local - toFrames(CHECK_LANDS_SEC);
  const pulseDur = toFrames(0.4);
  const pulseT =
    checkLandFrame >= 0 && checkLandFrame <= pulseDur
      ? checkLandFrame / pulseDur
      : -1;
  const shieldedBg =
    pulseT >= 0
      ? `rgba(61,220,132,${Math.sin(pulseT * Math.PI) * 0.15})`
      : "transparent";

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
          background: "#0d0d10",
          border: `1px solid #1a1a1f`,
          borderRadius: 12,
          transform: `scale(${enterScale})`,
          opacity: enterOpacity,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          marginTop: 80,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 18px",
            borderBottom: `1px solid #1a1a1f`,
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
            padding: "36px",
            fontFamily: monoFont,
            fontSize: 38,
            lineHeight: 1.5,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {LINES.map((line, i) => {
            // Pre-start: invisible (collapses height to 0 so later lines aren't pushed).
            if (localSec < line.startSec) {
              return <div key={i} style={{ height: 0, opacity: 0 }} />;
            }
            const elapsed = localSec - line.startSec;
            const charsDone = Math.min(
              line.text.length,
              Math.floor(elapsed * line.cps),
            );
            const isActive = i === activeLineIdx;
            const fullyTyped = charsDone >= line.text.length;
            const isShielded = !!line.bold;

            return (
              <div
                key={i}
                style={{
                  color: line.color,
                  fontWeight: line.bold ? 700 : 500,
                  whiteSpace: "pre",
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: isShielded ? shieldedBg : "transparent",
                  padding: isShielded ? "2px 6px" : "0",
                  margin: isShielded ? "-2px -6px" : "0",
                  borderRadius: 4,
                  transition: "none",
                }}
              >
                <span>{line.text.slice(0, charsDone)}</span>
                {/* Cursor only on the line currently being typed, OR on the last
                    line once everything finishes. */}
                {(isActive && !fullyTyped) ||
                (i === LINES.length - 1 && allDone) ? (
                  <span
                    style={{
                      display: "inline-block",
                      width: "0.6em",
                      height: "1em",
                      marginLeft: 4,
                      background: GREEN,
                      opacity: cursorVisible ? 1 : 0,
                      verticalAlign: "middle",
                    }}
                  />
                ) : null}
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
