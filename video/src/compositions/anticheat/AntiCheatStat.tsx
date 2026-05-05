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

const SCENE_SECONDS = 7.5;
const STAT_DURATION = toFrames(4);

export const AntiCheatStat: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <Sequence from={0} durationInFrames={STAT_DURATION + toFrames(0.4)}>
        <StatPanel />
      </Sequence>

      <Sequence from={STAT_DURATION}>
        <ZoomList />
      </Sequence>

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

// ─── Stat panel: 0.01% / arrow / 70% ──────────────────────────────────────────

const StatPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 110, mass: 0.7 },
  });
  const exit = spring({
    frame: frame - (STAT_DURATION - toFrames(0.4)),
    fps,
    config: { damping: 28, stiffness: 140, mass: 0.6 },
  });
  const opacity = interpolate(enter, [0, 1], [0, 1]) * (1 - exit);

  // Counters — count up over the first 1.6s.
  const countT = Math.min(1, Math.max(0, frame / toFrames(1.6)));
  const eased = 1 - Math.pow(1 - countT, 3);
  const left = (0.01 * eased).toFixed(2);
  const right = Math.round(70 * eased);

  // Arrow draws from frame 0.6s to 1.6s.
  const arrowT = interpolate(
    frame,
    [toFrames(0.6), toFrames(1.6)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Big numbers row */}
      <div
        style={{
          position: "absolute",
          top: "32%",
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 72,
          padding: "0 96px",
        }}
      >
        <BigNumber value={`${left}%`} subtitle="of traders" tint={colors.fg} />
        <ArrowFlow t={arrowT} />
        <BigNumber
          value={`${right}%`}
          subtitle="of all profits"
          tint={colors.accent}
        />
      </div>

      {/* Sub-line */}
      <div
        style={{
          position: "absolute",
          bottom: "20%",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: font,
          fontSize: 60,
          fontWeight: 500,
          letterSpacing: "-0.01em",
          color: colors.fg,
          opacity: interpolate(
            frame,
            [toFrames(2.0), toFrames(2.6)],
            [0, 0.92],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          ),
        }}
      >
        0.01% of cheaters claim 70% of all profits.
      </div>
    </AbsoluteFill>
  );
};

const BigNumber: React.FC<{
  value: string;
  subtitle: string;
  tint: string;
}> = ({ value, subtitle, tint }) => {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontFamily: font,
          fontSize: 240,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          color: tint,
          lineHeight: 0.95,
          textShadow: "0 4px 28px rgba(0,0,0,0.65)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 22,
          fontFamily: monoFont,
          fontSize: 36,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: colors.dim,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
};

const ArrowFlow: React.FC<{ t: number }> = ({ t }) => {
  // The arrow draws from left to right.
  const length = 220;
  const drawn = Math.max(0, Math.min(length, length * t));
  const headOpacity = t > 0.92 ? 1 : 0;
  return (
    <svg width={length + 40} height={120} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="arrow-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={colors.dim} stopOpacity={0.6} />
          <stop offset="100%" stopColor={colors.accent} stopOpacity={1} />
        </linearGradient>
      </defs>
      <line
        x1={0}
        y1={60}
        x2={drawn}
        y2={60}
        stroke="url(#arrow-grad)"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <g opacity={headOpacity}>
        <line
          x1={length - 14}
          y1={60 - 14}
          x2={length}
          y2={60}
          stroke={colors.accent}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <line
          x1={length - 14}
          y1={60 + 14}
          x2={length}
          y2={60}
          stroke={colors.accent}
          strokeWidth={3}
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
};

// ─── Zoom list: comma-separated mono dim text with depth-clone trails ─────────

const WORDS = ["perps", "options", "predictions", "launchpads"] as const;
const WORD_STAGGER = toFrames(0.22);
const REVEAL_AT =
  WORD_STAGGER * (WORDS.length - 1) + toFrames(0.95);

const ZoomList: React.FC = () => {
  const frame = useCurrentFrame();

  // Eyebrow fades in immediately.
  const eyebrowOpacity = interpolate(
    frame,
    [0, toFrames(0.3)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Final reveal "→ all of it." snaps in once the last echo settles.
  const revealLocal = frame - REVEAL_AT;
  const revealOpacity = interpolate(
    revealLocal,
    [0, toFrames(0.18)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const revealY = interpolate(
    revealLocal,
    [0, toFrames(0.18)],
    [22, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill>
      {/* Eyebrow */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: monoFont,
          fontSize: 40,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: colors.dim,
          opacity: eyebrowOpacity,
        }}
      >
        Every market they touch
      </div>

      {/* Comma-separated word list with zoom clones */}
      <div
        style={{
          position: "absolute",
          top: "44%",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: monoFont,
          fontSize: 72,
          fontWeight: 500,
          letterSpacing: "0.04em",
          color: colors.dim,
          padding: "0 96px",
          lineHeight: 1.1,
        }}
      >
        {WORDS.map((word, i) => (
          <React.Fragment key={word}>
            <ZoomEchoWord word={word} delayFrames={i * WORD_STAGGER} />
            {i < WORDS.length - 1 && (
              <Comma delayFrames={i * WORD_STAGGER + toFrames(0.18)} />
            )}
            {i === WORDS.length - 1 && (
              <Period delayFrames={i * WORD_STAGGER + toFrames(0.45)} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* "→ all of it." */}
      <div
        style={{
          position: "absolute",
          bottom: "22%",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: font,
          fontSize: 88,
          fontWeight: 700,
          letterSpacing: "-0.025em",
          color: colors.fg,
          opacity: revealOpacity,
          transform: `translateY(${revealY}px)`,
        }}
      >
        <span style={{ color: colors.dim, marginRight: 24 }}>→</span>
        all of it.
      </div>
    </AbsoluteFill>
  );
};

// ─── Zoom-echo word: live word + trailing depth-clones at decreasing scale ────
//
// Each echo is the same word rendered a few frames earlier in its own zoom-out
// curve. Earlier frames mean larger scale, lower alpha — so the trail recedes
// from the current letter shape backwards into a haze of micro-clones.
//
// After the animation settles, the echoes fade out and only the live word
// remains, sharp at its natural inline position.

const ECHO_COUNT = 5;
const ECHO_GAP_FRAMES = 1.6;
const ZOOM_DURATION = toFrames(0.55);

const ZoomEchoWord: React.FC<{ word: string; delayFrames: number }> = ({
  word,
  delayFrames,
}) => {
  const frame = useCurrentFrame();
  const local = frame - delayFrames;

  if (local < 0) {
    return (
      <span style={{ display: "inline-block", visibility: "hidden" }}>
        {word}
      </span>
    );
  }

  // After the deepest echo lands, fade them all out so the line resolves to
  // clean text — the trails are a transit effect, not a permanent decoration.
  const echoFade = interpolate(
    local,
    [
      ZOOM_DURATION + ECHO_COUNT * ECHO_GAP_FRAMES + toFrames(0.05),
      ZOOM_DURATION + ECHO_COUNT * ECHO_GAP_FRAMES + toFrames(0.35),
    ],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        color: colors.fg,
      }}
    >
      {/* Reserve layout width with hidden text */}
      <span style={{ visibility: "hidden" }}>{word}</span>

      {Array.from({ length: ECHO_COUNT + 1 }).map((_, i) => {
        const f = local - i * ECHO_GAP_FRAMES;
        if (f < 0) return null;

        const t = Math.max(0, Math.min(1, f / ZOOM_DURATION));
        const eased = 1 - Math.pow(1 - t, 4);

        // Lead (i=0) is the "live" copy. Higher i = older frame echo,
        // captured when scale was still oversized.
        const scale = interpolate(eased, [0, 1], [4.6, 1]);
        const dim = i === 0 ? 1 : Math.pow(0.52, i) * echoFade;
        const op = eased * dim;

        // Lead at full saturation = colors.fg. Echoes drift toward dim/accent
        // for a touch of atmospheric perspective.
        const tint = i === 0 ? colors.fg : i % 2 === 0 ? colors.fg : colors.accent;

        return (
          <span
            key={i}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              textAlign: "center",
              transform: `scale(${scale})`,
              transformOrigin: "center",
              opacity: op,
              color: tint,
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
};

// ─── Punctuation that fades in when its neighbour word arrives ────────────────

const Comma: React.FC<{ delayFrames: number }> = ({ delayFrames }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame - delayFrames,
    [0, toFrames(0.2)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <span style={{ opacity, color: colors.dim, marginRight: "0.35em" }}>,</span>
  );
};

const Period: React.FC<{ delayFrames: number }> = ({ delayFrames }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame - delayFrames,
    [0, toFrames(0.2)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <span style={{ opacity, color: colors.dim }}>.</span>
  );
};

export const antiCheatStatMeta = {
  id: "AntiCheatStat",
  component: AntiCheatStat,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
