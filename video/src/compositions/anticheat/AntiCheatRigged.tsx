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

const SCENE_SECONDS = 12;

const CARDS = [
  {
    n: "01",
    glyph: "✦",
    label: "A tip from a politician.",
    sub: "Material non-public information.",
  },
  {
    n: "02",
    glyph: "◢",
    label: "$100M of latency infra.",
    sub: "Co-located, sub-microsecond.",
  },
  {
    n: "03",
    glyph: "◇",
    label: "$30M for exchange data.",
    sub: "Direct feeds. Unfair by design.",
  },
] as const;

export const AntiCheatRigged: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Headline enters at 0, cards from 2s, last line at 10s.
  const headlineT = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 110, mass: 0.7 },
  });

  // The headline fades out as the final stamp rises.
  const finalAt = toFrames(10);
  const fadeOut = interpolate(
    frame,
    [finalAt - toFrames(0.3), finalAt + toFrames(0.4)],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <TradingBackdrop />

      {/* Headline */}
      <div
        style={{
          position: "absolute",
          top: "12%",
          left: 0,
          right: 0,
          textAlign: "center",
          padding: "0 96px",
          opacity: interpolate(headlineT, [0, 1], [0, 1]) * fadeOut,
          transform: `translateY(${interpolate(headlineT, [0, 1], [22, 0])}px)`,
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

      {/* Three cards */}
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
        {CARDS.map((card, i) => {
          const at = toFrames(2 + i * 2.5);
          const t = spring({
            frame: frame - at,
            fps,
            config: { damping: 22, stiffness: 130, mass: 0.6 },
          });
          const opacity = interpolate(t, [0, 1], [0, 1]);
          const y = interpolate(t, [0, 1], [40, 0]);
          return (
            <div
              key={card.n}
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
                <span style={{ color: colors.accent, fontSize: 30 }}>
                  {card.glyph}
                </span>
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
        })}
      </div>

      {/* Final stamp */}
      <FinalStamp showFrom={finalAt} />

      {/* Vignette */}
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

const FinalStamp: React.FC<{ showFrom: number }> = ({ showFrom }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({
    frame: frame - showFrom,
    fps,
    config: { damping: 16, stiffness: 180, mass: 0.6 },
  });
  if (frame < showFrom - 4) return null;
  const opacity = interpolate(t, [0, 1], [0, 1]);
  const scale = interpolate(t, [0, 1], [0.92, 1]);

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
          transform: `scale(${scale})`,
          textShadow: "0 4px 32px rgba(255,59,59,0.25)",
        }}
      >
        You&rsquo;re leaving 70%
        <br />
        on the table.
      </div>
    </AbsoluteFill>
  );
};

const TradingBackdrop: React.FC = () => {
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
        style={{ position: "absolute", inset: 0, opacity: 0.45 }}
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
