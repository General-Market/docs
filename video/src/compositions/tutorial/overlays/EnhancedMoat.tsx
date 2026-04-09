import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../../common/fonts";
import { EASE } from "../../../common/easing";
import { FPS, BRAND_GREEN, PANEL } from "../theme";

const sec = (s: number) => Math.round(s * FPS);

// ---------------------------------------------------------------------------
// 1. Position Counter Comparison (0–10s local)
// ---------------------------------------------------------------------------

const PositionCounters: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = sec(10);

  // Entry
  const enterProgress = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });
  const enterY = interpolate(enterProgress, [0, 1], [50, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const enterOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Exit
  const exitOpacity = interpolate(frame, [duration - 10, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Strikethrough animation on left counter (starts at 1s, finishes at 2.5s)
  const strikeWidth = interpolate(frame, [sec(1), sec(2.5)], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Right counter animates from 0 to 10,000,000 over frames 1s–6s
  const countProgress = interpolate(frame, [sec(1), sec(6)], [0, 10_000_000], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });
  const displayCount = Math.round(countProgress).toLocaleString();

  // Right counter glow pulse after reaching target
  const glowIntensity =
    frame > sec(6)
      ? 0.6 + 0.2 * Math.sin((frame - sec(6)) * 0.2)
      : interpolate(frame, [sec(4), sec(6)], [0, 0.6], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 80,
        opacity: Math.min(enterOpacity, exitOpacity),
        transform: `translateY(${enterY}px)`,
      }}
    >
      <div
        style={{
          ...PANEL,
          display: "flex",
          gap: 64,
          padding: "36px 56px",
          alignItems: "center",
        }}
      >
        {/* Left — old world (strikethrough) */}
        <div style={{ textAlign: "center", position: "relative" }}>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 18,
              fontWeight: 500,
              color: "rgba(250,250,250,0.5)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
            }}
          >
            Traditional Markets
          </div>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 44,
              fontWeight: 700,
              color: "rgba(250,250,250,0.4)",
              position: "relative",
              display: "inline-block",
            }}
          >
            {"< 100"}
            {/* Strikethrough line */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: 0,
                width: `${strikeWidth}%`,
                height: 3,
                background: "#DC2626",
                transform: "translateY(-50%)",
                borderRadius: 2,
              }}
            />
          </div>
          <div
            style={{
              fontFamily: font,
              fontSize: 14,
              color: "rgba(250,250,250,0.35)",
              marginTop: 4,
            }}
          >
            positions/day
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 80,
            background: "rgba(250,250,250,0.15)",
          }}
        />

        {/* Right — General Market (growing) */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 18,
              fontWeight: 500,
              color: BRAND_GREEN,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
              opacity: 0.85,
            }}
          >
            General Market
          </div>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 44,
              fontWeight: 700,
              color: BRAND_GREEN,
              textShadow: `0 0 ${24 * glowIntensity}px ${BRAND_GREEN}88`,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {displayCount}
          </div>
          <div
            style={{
              fontFamily: font,
              fontSize: 14,
              color: "rgba(250,250,250,0.6)",
              marginTop: 4,
            }}
          >
            positions/day
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 2. "ALL MARKETS" Text Explosion (10.9s–14s local)
// ---------------------------------------------------------------------------

const ALL_MARKETS_LETTERS = "ALL MARKETS".split("");

const AllMarketsExplosion: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = sec(3.1); // 10.9s → 14s

  // Entry spring
  const enterScale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.6 },
  });

  // Explosion: letters scatter outward at ~0.4s, then settle back by ~1.5s
  const scatterPhase = interpolate(frame, [sec(0.4), sec(0.8), sec(1.5)], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.smooth,
  });

  // Exit
  const exitOpacity = interpolate(frame, [duration - 8, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const enterOpacity = interpolate(frame, [0, 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Geometric shapes around letters
  const shapeOpacity = interpolate(frame, [sec(0.3), sec(0.6), sec(1.8), sec(2.2)], [0, 0.7, 0.7, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: Math.min(enterOpacity, exitOpacity),
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${enterScale})`,
          position: "relative",
        }}
      >
        {ALL_MARKETS_LETTERS.map((letter, i) => {
          // Each letter gets a unique scatter direction
          const angle = ((i - 5) / 5) * 0.6; // spread angle
          const dist = (Math.abs(i - 5) + 1) * 18; // distance from center
          const tx = Math.sin(angle * Math.PI) * dist * scatterPhase;
          const ty = -Math.abs(Math.cos(angle * Math.PI)) * dist * 0.5 * scatterPhase;
          const rotation = angle * 8 * scatterPhase;

          return (
            <div
              key={i}
              style={{
                fontFamily: font,
                fontSize: 96,
                fontWeight: 900,
                color: letter === " " ? "transparent" : BRAND_GREEN,
                letterSpacing: 6,
                transform: `translate(${tx}px, ${ty}px) rotate(${rotation}deg)`,
                textShadow: `0 0 30px ${BRAND_GREEN}66, 0 0 60px ${BRAND_GREEN}33`,
                display: "inline-block",
                minWidth: letter === " " ? 24 : undefined,
              }}
            >
              {letter}
            </div>
          );
        })}

        {/* Geometric decoration shapes */}
        {[
          { x: -340, y: -60, size: 12, type: "circle" as const },
          { x: 340, y: -50, size: 10, type: "circle" as const },
          { x: -280, y: 50, size: 8, type: "rect" as const },
          { x: 280, y: 60, size: 14, type: "rect" as const },
          { x: -180, y: -70, size: 6, type: "circle" as const },
          { x: 200, y: -80, size: 10, type: "rect" as const },
        ].map((shape, i) => {
          const scatterDist = (1 + i * 0.3) * scatterPhase * 20;
          const sx = shape.x + scatterDist * (i % 2 === 0 ? -1 : 1);
          const sy = shape.y - scatterDist;

          return (
            <div
              key={`shape-${i}`}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: shape.size,
                height: shape.size,
                borderRadius: shape.type === "circle" ? "50%" : 2,
                background: BRAND_GREEN,
                opacity: shapeOpacity * (0.5 + i * 0.08),
                transform: `translate(${sx}px, ${sy}px) rotate(${frame * 2 + i * 45}deg)`,
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 3. Era Detail Cards (22.8s–36.3s local)
// ---------------------------------------------------------------------------

interface EraCard {
  delaySec: number;
  label: string;
  detail: string;
  highlight: boolean;
  x: string; // CSS left position
}

const ERA_CARDS: EraCard[] = [
  {
    delaySec: 1,
    label: "Charts & Patterns",
    detail: "Few practitioners \u2192 Massive edge",
    highlight: false,
    x: "10%",
  },
  {
    delaySec: 3,
    label: "Options pricing",
    detail: "Few quants \u2192 Massive edge",
    highlight: false,
    x: "40%",
  },
  {
    delaySec: 5.5,
    label: "Prediction markets",
    detail: "You \u2192 Massive edge",
    highlight: true,
    x: "70%",
  },
];

const EraDetailCards: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = sec(13.5); // 22.8s → 36.3s

  const exitOpacity = interpolate(frame, [duration - 12, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      {ERA_CARDS.map((card, i) => {
        const cardFrame = Math.max(frame - sec(card.delaySec), 0);

        const cardSpring = spring({
          frame: cardFrame,
          fps,
          config: { damping: 14, stiffness: 120, mass: 0.7 },
        });

        const cardOpacity = interpolate(cardFrame, [0, 10], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const cardY = interpolate(cardSpring, [0, 1], [20, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              bottom: 120,
              left: card.x,
              transform: `translateX(-50%) translateY(${cardY}px)`,
              opacity: cardOpacity,
              ...PANEL,
              padding: "16px 20px",
              width: 200,
              border: card.highlight
                ? `1px solid ${BRAND_GREEN}66`
                : "1px solid rgba(250,250,250,0.1)",
            }}
          >
            <div
              style={{
                fontFamily: font,
                fontSize: 15,
                fontWeight: 700,
                color: card.highlight ? BRAND_GREEN : "rgba(250,250,250,0.85)",
                marginBottom: 6,
              }}
            >
              {card.label}
            </div>
            <div
              style={{
                fontFamily: font,
                fontSize: 13,
                fontWeight: 400,
                color: card.highlight ? "rgba(250,250,250,0.9)" : "rgba(250,250,250,0.55)",
                lineHeight: 1.4,
              }}
            >
              {card.detail}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 4. "NO INCUMBENTS" Banner (36.3s–42s local)
// ---------------------------------------------------------------------------

const NoIncumbentsBanner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = sec(5.7); // 36.3s → 42s

  // Slide up from bottom
  const slideUp = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 140, mass: 0.8 },
  });

  const bannerY = interpolate(slideUp, [0, 1], [80, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitOpacity = interpolate(frame, [duration - 10, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const enterOpacity = interpolate(frame, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        opacity: Math.min(enterOpacity, exitOpacity),
      }}
    >
      <div
        style={{
          width: "100%",
          background: BRAND_GREEN,
          padding: "20px 0",
          textAlign: "center",
          transform: `translateY(${bannerY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 32,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          New Financial Instrument = No Incumbents
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 5. Hedge Fund Contrast Numbers (47.5s–53.4s local)
// ---------------------------------------------------------------------------

const HedgeFundNumbers: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = sec(5.9); // 47.5s → 53.4s

  const enterOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  const exitOpacity = interpolate(frame, [duration - 8, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Left number slams in
  const leftSpring = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.7 },
  });
  const leftScale = interpolate(leftSpring, [0, 1], [1.8, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Right number slams in delayed
  const rightFrame = Math.max(frame - sec(1.2), 0);
  const rightSpring = spring({
    frame: rightFrame,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.7 },
  });
  const rightScale = interpolate(rightSpring, [0, 1], [1.8, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rightOpacity = interpolate(rightFrame, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: 60,
        opacity: Math.min(enterOpacity, exitOpacity),
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 80,
          alignItems: "flex-start",
        }}
      >
        {/* $4.5T — traditional */}
        <div style={{ textAlign: "center", transform: `scale(${leftScale})` }}>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 72,
              fontWeight: 700,
              color: "#DC2626",
              fontVariantNumeric: "tabular-nums",
              textShadow: "0 0 20px rgba(220,38,38,0.4)",
            }}
          >
            $4.5T
          </div>
          <div
            style={{
              fontFamily: font,
              fontSize: 16,
              fontWeight: 500,
              color: "rgba(250,250,250,0.5)",
              marginTop: 8,
              maxWidth: 200,
              lineHeight: 1.3,
            }}
          >
            Hedge fund AUM in traditional markets
          </div>
        </div>

        {/* $0 — General Market */}
        <div
          style={{
            textAlign: "center",
            transform: `scale(${rightScale})`,
            opacity: rightOpacity,
          }}
        >
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 72,
              fontWeight: 700,
              color: BRAND_GREEN,
              fontVariantNumeric: "tabular-nums",
              textShadow: `0 0 24px ${BRAND_GREEN}66`,
            }}
          >
            $0
          </div>
          <div
            style={{
              fontFamily: font,
              fontSize: 16,
              fontWeight: 500,
              color: "rgba(250,250,250,0.6)",
              marginTop: 8,
              maxWidth: 200,
              lineHeight: 1.3,
            }}
          >
            Incumbent advantage in General Market
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 6. "YOUR EDGE STARTS HERE" Final Text (50s–53.4s local)
// ---------------------------------------------------------------------------

const EdgeStartsHere: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = sec(3.4); // 50s → 53.4s

  const enterOpacity = interpolate(frame, [0, 15], [0, 0.8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  const exitOpacity = interpolate(frame, [duration - 8, duration], [0.8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 40,
        opacity: Math.min(enterOpacity, exitOpacity),
      }}
    >
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 20,
          fontWeight: 500,
          color: BRAND_GREEN,
          letterSpacing: 4,
          textTransform: "uppercase",
          opacity: 0.85,
        }}
      >
        Your edge starts here
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

export const EnhancedMoat: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* 1. Position counter comparison: 0–10s */}
      <Sequence from={sec(0)} durationInFrames={sec(10)}>
        <PositionCounters />
        <Audio
          src={staticFile("sfx/metric-count-up.mp3")}
          volume={0.5}
          startFrom={0}
        />
      </Sequence>

      {/* 2. "ALL MARKETS" explosion: 10.9s–14s */}
      <Sequence from={sec(10.9)} durationInFrames={sec(3.1)}>
        <AllMarketsExplosion />
        <Audio src={staticFile("sfx/drop-cinematic-hit.mp3")} volume={0.6} />
      </Sequence>

      {/* 3. Era detail cards: 22.8s–36.3s */}
      <Sequence from={sec(22.8)} durationInFrames={sec(13.5)}>
        <EraDetailCards />
      </Sequence>

      {/* 4. "NO INCUMBENTS" banner: 36.3s–42s */}
      <Sequence from={sec(36.3)} durationInFrames={sec(5.7)}>
        <NoIncumbentsBanner />
      </Sequence>

      {/* 5. Hedge fund contrast numbers: 47.5s–53.4s */}
      <Sequence from={sec(47.5)} durationInFrames={sec(5.9)}>
        <HedgeFundNumbers />
      </Sequence>

      {/* 6. "YOUR EDGE STARTS HERE": 50s–53.4s */}
      <Sequence from={sec(50)} durationInFrames={sec(3.4)}>
        <EdgeStartsHere />
      </Sequence>
    </AbsoluteFill>
  );
};
