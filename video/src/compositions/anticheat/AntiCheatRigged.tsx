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

const SCENE_SECONDS = 7;
const CARD_TIMES = [toFrames(1.0), toFrames(2.5), toFrames(4.0)];
const STAMP_AT = toFrames(5.5);

const CARDS = [
  {
    n: "01",
    glyph: "✦",
    label: "A tip from a politician",
    sub: "Material non-public information",
  },
  {
    n: "02",
    glyph: "◢",
    label: "$100M of latency infra",
    sub: "Co-located, sub-microsecond",
  },
  {
    n: "03",
    glyph: "◇",
    label: "$30M for exchange data",
    sub: "Direct feeds, unfair by design",
  },
] as const;

export const AntiCheatRigged: React.FC = () => {
  const frame = useCurrentFrame();

  // Headline + cards fade out as the stamp arrives.
  const fadeOut = interpolate(
    frame,
    [STAMP_AT - toFrames(0.2), STAMP_AT + toFrames(0.1)],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <TradingBackdrop />

      <Headline fadeOut={fadeOut} />

      <div
        style={{
          position: "absolute",
          top: "42%",
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center",
          gap: 36,
          padding: "0 96px",
          opacity: fadeOut,
        }}
      >
        {CARDS.map((card, i) => (
          <Card key={card.n} card={card} at={CARD_TIMES[i]} />
        ))}
      </div>

      <FinalStamp />

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

// ─── Headline: snaps in at 0s, 0.18s entrance ────────────────────────────────

const Headline: React.FC<{ fadeOut: number }> = ({ fadeOut }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, toFrames(0.18)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const y = interpolate(
    frame,
    [0, toFrames(0.18)],
    [14, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        top: "12%",
        left: 0,
        right: 0,
        textAlign: "center",
        padding: "0 96px",
        opacity: opacity * fadeOut,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: colors.dim,
          marginBottom: 16,
        }}
      >
        The rigged stack
      </div>
      <div
        style={{
          fontFamily: font,
          fontSize: 96,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          color: colors.fg,
          lineHeight: 0.95,
          textShadow: "0 4px 28px rgba(0,0,0,0.65)",
        }}
      >
        If you don&rsquo;t have
      </div>
    </div>
  );
};

// ─── Card: each one snaps in (whole card) at its own beat ─────────────────────

const Card: React.FC<{
  card: (typeof CARDS)[number];
  at: number;
}> = ({ card, at }) => {
  const frame = useCurrentFrame();
  const local = frame - at;
  if (local < -2) {
    return (
      <div
        style={{
          flex: 1,
          maxWidth: 480,
          opacity: 0,
        }}
      />
    );
  }

  const opacity = interpolate(
    local,
    [0, toFrames(0.18)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const y = interpolate(
    local,
    [0, toFrames(0.18)],
    [14, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        flex: 1,
        maxWidth: 480,
        padding: "36px 36px 40px",
        border: `1px solid ${colors.accent}`,
        borderRadius: 4,
        backgroundColor: "rgba(255,59,59,0.04)",
        opacity,
        transform: `translateY(${y}px)`,
        boxShadow:
          "0 0 0 1px rgba(255,59,59,0.06), 0 12px 36px rgba(0,0,0,0.55)",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          fontFamily: monoFont,
          color: colors.dim,
          fontSize: 22,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        <span>{card.n}</span>
        <span style={{ color: colors.accent, fontSize: 30 }}>{card.glyph}</span>
      </div>
      <div
        style={{
          fontFamily: font,
          fontSize: 42,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: colors.fg,
          lineHeight: 1.1,
        }}
      >
        {card.label}
      </div>
      <div
        style={{
          marginTop: "auto",
          fontFamily: monoFont,
          fontSize: 18,
          letterSpacing: "0.04em",
          color: colors.dim,
          opacity: 0.85,
        }}
      >
        {card.sub}
      </div>
    </div>
  );
};

// ─── Final stamp at 5.5s — "70% on the table" with one scale punch ────────────

const FinalStamp: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < STAMP_AT - 2) return null;

  const local = frame - STAMP_AT;
  const opacity = interpolate(
    local,
    [0, toFrames(0.18)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const slam = spring({
    frame: local,
    fps,
    config: { damping: 11, stiffness: 200, mass: 0.7 },
  });
  const slamScale = interpolate(slam, [0, 1], [0.6, 1.0]);

  // Single hero-word punch.
  const punch = spring({
    frame: local - toFrames(0.05),
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
        background: "rgba(10,10,10,0.78)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 124,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          color: colors.accent,
          lineHeight: 0.95,
          textAlign: "center",
          padding: "0 96px",
          opacity,
          transform: `scale(${slamScale * punchScale})`,
          textShadow: "0 4px 32px rgba(255,59,59,0.25)",
        }}
      >
        You&rsquo;re leaving 70%
        <br />
        on the table
      </div>
    </AbsoluteFill>
  );
};

// ─── Backdrop with quiet ambient pulse ────────────────────────────────────────

const TradingBackdrop: React.FC = () => {
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

export const antiCheatRiggedMeta = {
  id: "AntiCheatRigged",
  component: AntiCheatRigged,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
