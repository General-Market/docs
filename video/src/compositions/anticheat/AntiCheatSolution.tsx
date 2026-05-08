import React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import { DotGrid, DotGridVignette } from "./DotGrid";
import { IdleZoom } from "./vibe";

// Solution = 233f (7.77s). Solution→Reassure transition starts on
// beat 29 (frame 768 absolute). Terminal flies in on scene-local beat 3
// (absolute beat 24, frame 640) — gives the headline 2.5s before the
// terminal arrives, then ~3s of terminal + CTA.
const SCENE_FRAMES = 233;
const SCENE_SECONDS = SCENE_FRAMES / FPS;
const TERMINAL_AT = 77;

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

// ─── Headline: end-screen wordmark — logo on the left, "General" right ──────
// Mirrors the EndCard layout. Soft fade in at the start of the scene, fades
// out into the terminal fly-in at TERMINAL_AT.

const Headline: React.FC = () => {
  const frame = useCurrentFrame();

  // Hold for the first two beats so the wordmark sits still and legible.
  // The blast collapses into the third beat — bezier surge, then a fast
  // white wash that erases the close-up letterforms before the terminal
  // mounts. Read first, blast last.
  const HOLD_END = 51; // beat 2 — ≈1.7s of stillness
  const ZOOM_END = TERMINAL_AT;
  const zoomT = interpolate(frame, [HOLD_END, ZOOM_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.7, 0, 0.84, 0.3),
  });
  const scale = interpolate(zoomT, [0, 1], [1, 88]);

  const opacity = interpolate(frame, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Faster wash — 10 frames from start to solid white, riding the back
  // of the surge.
  const wash = interpolate(
    frame,
    [ZOOM_END - 14, ZOOM_END - 4],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 26,
            padding: "60px 90px",
            background: "transparent",
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <img
            src={staticFile("gm-logo.svg")}
            alt=""
            style={{
              width: 130,
              height: 130,
              flexShrink: 0,
              filter: "drop-shadow(0 8px 28px rgba(0, 82, 255, 0.30))",
            }}
          />
          <span
            style={{
              fontFamily: font,
              fontSize: 140,
              fontWeight: 800,
              letterSpacing: "-0.05em",
              color: colors.fg,
              lineHeight: 0.95,
              textShadow: "0 8px 28px rgba(0, 82, 255, 0.30)",
            }}
          >
            General
          </span>
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{ background: "#FFFFFF", opacity: wash, pointerEvents: "none" }}
      />
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

  // 3D entrance ported from GMBrand Scene03 SegDesktopUI (the desktop UI
  // fly-in that lands at 0:18). Tilted-and-zoomed → flat over 95 frames.
  const ENTRANCE_KEYS = [0, 10, 20, 35, 50, 65, 80, 95];
  const panelRotY = interpolate(
    frame,
    ENTRANCE_KEYS,
    [-22, -18, -14, -10, -7, -4, -2, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const panelRotX = interpolate(
    frame,
    ENTRANCE_KEYS,
    [8, 6.5, 5, 4, 3, 2, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const panelScale = interpolate(
    frame,
    ENTRANCE_KEYS,
    [2.3, 2.0, 1.7, 1.4, 1.2, 1.1, 1.03, 1.0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const panelOpacity = interpolate(frame, [0, 3], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Lines paced so each typewriter event lands on a beat. Terminal
  // mounts at scene-local 77 (beat 3); delays are local to the
  // sequence. Line 0 types out from beat 3, line 1 from beat 4, line 2
  // finishes typing on beat 6 — that's the "shielded" punch.
  const LINE_DELAYS = [0, 26, 67];
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

  // CTA: per-char reveal, last letter first, working back to the first.
  // Each char slides in from off-screen left (-1920px) and fades over 4f.
  // Reveal completes in 30 frames — one beat — for a fast, punchy entry.
  // Wrap allowed so the line stays on two lines.
  // First char fires at scene-local 103 (= 22.20s absolute = beat 4 in
  // Solution).
  const CTA_TEXT = "Shield your pnl from bad actors";
  const CTA_START = 26; // Terminal-local
  const CTA_REVEAL = 30;

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
          perspective: 1400,
          opacity: panelOpacity,
        }}
      >
      <div
        style={{
          background: "linear-gradient(180deg, #0d0d10 0%, #050507 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          transformStyle: "preserve-3d",
          transform: `rotateY(${panelRotY}deg) rotateX(${panelRotX}deg) scale(${panelScale})`,
          transformOrigin: "50% 50%",
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
            minHeight: 400,
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
                  minHeight: "1.5em",
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
      </div>

      <div
        style={{
          width: "min(1500px, 92%)",
          textAlign: "center",
          fontFamily: font,
          fontSize: 120,
          letterSpacing: "-0.025em",
          lineHeight: 1.08,
        }}
      >
        {CTA_TEXT.split(" ").map((word, wi, words) => {
          const wordStart = words
            .slice(0, wi)
            .reduce((n, w) => n + w.length + 1, 0);
          return (
            <React.Fragment key={wi}>
              <span style={{ display: "inline-block", whiteSpace: "nowrap" }}>
                {word.split("").map((ch, ci) => {
                  const i = wordStart + ci;
                  const order = CTA_TEXT.length - 1 - i;
                  const startFrame =
                    CTA_START +
                    CTA_REVEAL * Math.sqrt(order / CTA_TEXT.length);
                  const local = frame - startFrame;
                  const op = Math.max(0, Math.min(1, local / 4));
                  const x = (1 - op) * -1920;
                  const isShield = i < 6;
                  return (
                    <span
                      key={ci}
                      style={{
                        display: "inline-block",
                        opacity: op,
                        transform: `translateX(${x}px)`,
                        color: isShield ? colors.accent : colors.fg,
                        fontWeight: isShield ? 800 : 700,
                      }}
                    >
                      {ch}
                    </span>
                  );
                })}
              </span>
              {wi < words.length - 1 ? " " : null}
            </React.Fragment>
          );
        })}
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
