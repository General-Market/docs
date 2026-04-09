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
import { font } from "../../../common/fonts";
import { EASE } from "../../../common/easing";
import { FPS, BRAND_GREEN, PANEL } from "../theme";

// ---------------------------------------------------------------------------
// Timing — local seconds (frame 0 = 194.04s in video)
// ---------------------------------------------------------------------------

const sec = (s: number) => Math.round(s * FPS);

// Section 1: Q card
const Q_IN = sec(0);
const Q_OUT = sec(10.9);

// Section 2: Paradigm text
const PARADIGM_IN = sec(10.9);
const PARADIGM_OUT = sec(18.1);

// Section 3: QUANTITY > QUALITY
const QGQ_IN = sec(18.1);
const QGQ_OUT = sec(22.8);

// Section 4: Era timeline
const ERA_IN = sec(22.8);
const ERA_OUT = sec(36.3);
const ERA_STAGGER = sec(2);

// Section 5: Clean slate text
const SLATE_IN = sec(36.3);
const SLATE_OUT = sec(47.5);

// Section 6: Hedge fund contrast
const HEDGE_IN = sec(47.5);
const HEDGE_OUT = sec(53.4);

// ---------------------------------------------------------------------------
// Q Card — "How do I find an edge when I must trade everything?"
// ---------------------------------------------------------------------------

const QCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = Q_OUT - Q_IN;

  const slideY = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.9 },
  });

  const y = interpolate(slideY, [0, 1], [60, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const enterOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitOpacity = interpolate(frame, [duration - 12, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 140,
        opacity: Math.min(enterOpacity, exitOpacity),
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          ...PANEL,
          padding: "32px 56px",
          maxWidth: 1100,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 42,
            fontWeight: 700,
            color: "#fafafa",
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          How do I find an edge when I must trade{" "}
          <span style={{ color: BRAND_GREEN }}>everything</span>?
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Paradigm shift — "Predicting ONE market" → "Predicting ALL markets"
// ---------------------------------------------------------------------------

const ParadigmText: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = PARADIGM_OUT - PARADIGM_IN;
  const midpoint = duration / 2;

  // Line 1 fades out over first half
  const line1Opacity = interpolate(frame, [0, midpoint - 6, midpoint + 6], [1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.smooth,
  });

  // Line 2 fades in over second half
  const line2Opacity = interpolate(frame, [midpoint - 6, midpoint + 6, duration], [0, 1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.smooth,
  });

  // Subtle scale for line 2
  const line2Scale = interpolate(frame, [midpoint - 6, midpoint + 12], [0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Overall exit
  const exitOpacity = interpolate(frame, [duration - 10, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const baseStyle: React.CSSProperties = {
    fontFamily: font,
    fontSize: 64,
    fontWeight: 800,
    textAlign: "center",
    lineHeight: 1.2,
    letterSpacing: -1,
    position: "absolute",
  };

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: exitOpacity,
      }}
    >
      <div style={{ position: "relative", width: 900, height: 90 }}>
        <div
          style={{
            ...baseStyle,
            color: "rgba(250, 250, 250, 0.7)",
            opacity: line1Opacity,
            width: "100%",
          }}
        >
          Predicting ONE market
        </div>
        <div
          style={{
            ...baseStyle,
            color: BRAND_GREEN,
            opacity: line2Opacity,
            transform: `scale(${line2Scale})`,
            width: "100%",
          }}
        >
          Predicting ALL markets
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// QUANTITY > QUALITY — big bold center text
// ---------------------------------------------------------------------------

const QuantityQuality: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = QGQ_OUT - QGQ_IN;

  const enterScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 160, mass: 0.7 },
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
        justifyContent: "center",
        alignItems: "center",
        opacity: Math.min(enterOpacity, exitOpacity),
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 86,
          fontWeight: 900,
          color: BRAND_GREEN,
          letterSpacing: 6,
          textTransform: "uppercase",
          transform: `scale(${enterScale})`,
          textShadow: `0 0 40px ${BRAND_GREEN}44, 0 0 80px ${BRAND_GREEN}22`,
        }}
      >
        Quantity &gt; Quality
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Era Timeline — 1920s → 1970s → 2026
// ---------------------------------------------------------------------------

interface EraMarker {
  year: string;
  label: string;
  icon: React.ReactNode;
  isHighlight: boolean;
}

const ERAS: EraMarker[] = [
  {
    year: "1920s",
    label: "Technical Analysis",
    isHighlight: false,
    icon: (
      <svg width={28} height={28} viewBox="0 0 24 24" fill="none">
        <polyline
          points="2,18 7,12 12,15 18,6 22,10"
          stroke="rgba(250,250,250,0.6)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    year: "1970s",
    label: "Black-Scholes",
    isHighlight: false,
    icon: (
      <svg width={28} height={28} viewBox="0 0 24 24" fill="none">
        <text
          x={12}
          y={17}
          textAnchor="middle"
          fontSize={18}
          fontWeight={700}
          fill="rgba(250,250,250,0.6)"
          fontFamily="serif"
        >
          &part;
        </text>
      </svg>
    ),
  },
  {
    year: "2026",
    label: "General Market",
    isHighlight: true,
    icon: (
      <svg width={32} height={32} viewBox="0 0 24 24" fill="none">
        <circle cx={12} cy={12} r={8} fill={BRAND_GREEN} opacity={0.3} />
        <text
          x={12}
          y={16}
          textAnchor="middle"
          fontSize={12}
          fontWeight={900}
          fill={BRAND_GREEN}
        >
          GM
        </text>
      </svg>
    ),
  },
];

const EraTimeline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Timeline bar grows left to right
  const barProgress = interpolate(frame, [0, sec(6)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Overall exit
  const duration = ERA_OUT - ERA_IN;
  const exitOpacity = interpolate(frame, [duration - 12, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: exitOpacity,
      }}
    >
      <div
        style={{
          width: "80%",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Timeline bar */}
        <div
          style={{
            width: "100%",
            height: 4,
            background: "rgba(250, 250, 250, 0.15)",
            borderRadius: 2,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${barProgress * 100}%`,
              height: "100%",
              background: `linear-gradient(90deg, rgba(250,250,250,0.4) 0%, ${BRAND_GREEN} 100%)`,
              borderRadius: 2,
            }}
          />
        </div>

        {/* Markers */}
        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            position: "absolute",
            top: -8,
          }}
        >
          {ERAS.map((era, i) => {
            const markerDelay = i * ERA_STAGGER;
            const markerFrame = Math.max(frame - markerDelay, 0);

            const markerSpring = spring({
              frame: markerFrame,
              fps,
              config: {
                damping: era.isHighlight ? 10 : 14,
                stiffness: era.isHighlight ? 180 : 120,
                mass: 0.6,
              },
            });

            const markerOpacity = interpolate(markerFrame, [0, 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            const markerScale = interpolate(markerSpring, [0, 1], [0.3, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            // Extra pulse for 2026
            const pulse = era.isHighlight
              ? 1 + 0.04 * Math.sin((frame - markerDelay) * 0.15)
              : 1;

            const dotSize = era.isHighlight ? 20 : 16;
            const dotColor = era.isHighlight ? BRAND_GREEN : "transparent";
            const dotBorder = era.isHighlight
              ? `2px solid ${BRAND_GREEN}`
              : "2px solid rgba(250, 250, 250, 0.5)";
            const glow = era.isHighlight
              ? `0 0 16px ${BRAND_GREEN}88, 0 0 32px ${BRAND_GREEN}44`
              : "none";

            return (
              <div
                key={era.year}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  opacity: markerOpacity,
                  transform: `scale(${markerScale * pulse})`,
                }}
              >
                {/* Dot */}
                <div
                  style={{
                    width: dotSize,
                    height: dotSize,
                    borderRadius: "50%",
                    background: dotColor,
                    border: dotBorder,
                    boxShadow: glow,
                    marginBottom: 16,
                  }}
                />

                {/* Icon */}
                <div style={{ marginBottom: 8 }}>{era.icon}</div>

                {/* Year */}
                <div
                  style={{
                    fontFamily: font,
                    fontSize: era.isHighlight ? 36 : 28,
                    fontWeight: era.isHighlight ? 900 : 700,
                    color: era.isHighlight ? BRAND_GREEN : "rgba(250, 250, 250, 0.7)",
                    letterSpacing: 1,
                    textShadow: era.isHighlight
                      ? `0 0 20px ${BRAND_GREEN}66`
                      : "none",
                  }}
                >
                  {era.year}
                </div>

                {/* Label */}
                <div
                  style={{
                    fontFamily: font,
                    fontSize: era.isHighlight ? 30 : 28,
                    fontWeight: 600,
                    color: era.isHighlight
                      ? "rgba(250, 250, 250, 0.95)"
                      : "rgba(250, 250, 250, 0.5)",
                    marginTop: 6,
                    letterSpacing: 0.5,
                  }}
                >
                  {era.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Clean Slate text
// ---------------------------------------------------------------------------

const CleanSlate: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = SLATE_OUT - SLATE_IN;

  const enterOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  const exitOpacity = interpolate(frame, [duration - 12, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const enterY = interpolate(frame, [0, 12], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  const subtitleOpacity = interpolate(frame, [10, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: Math.min(enterOpacity, exitOpacity),
        transform: `translateY(${enterY}px)`,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: font,
            fontSize: 56,
            fontWeight: 800,
            color: "#fafafa",
            letterSpacing: -0.5,
            lineHeight: 1.3,
          }}
        >
          New instrument = no incumbents.
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 28,
            fontWeight: 500,
            color: "rgba(250, 250, 250, 0.6)",
            marginTop: 20,
            opacity: subtitleOpacity,
          }}
        >
          Easier to win when no one has played before.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Hedge Fund Contrast
// ---------------------------------------------------------------------------

const HedgeFundContrast: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = HEDGE_OUT - HEDGE_IN;

  const enterOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  const exitOpacity = interpolate(frame, [duration - 8, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const enterY = interpolate(frame, [0, 12], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Second line fades in delayed
  const line2Opacity = interpolate(frame, [sec(2), sec(3.2)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  const line2Y = interpolate(frame, [sec(2), sec(3.2)], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: Math.min(enterOpacity, exitOpacity),
        transform: `translateY(${enterY}px)`,
      }}
    >
      <div
        style={{
          ...PANEL,
          padding: "48px 64px",
          maxWidth: 1000,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 36,
            fontWeight: 700,
            color: "rgba(250, 250, 250, 0.75)",
            lineHeight: 1.4,
          }}
        >
          Billions in hedge funds competing on old instruments.
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 40,
            fontWeight: 800,
            color: BRAND_GREEN,
            marginTop: 28,
            opacity: line2Opacity,
            transform: `translateY(${line2Y}px)`,
            textShadow: `0 0 24px ${BRAND_GREEN}33`,
          }}
        >
          Here? No one has an edge yet.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Main composition
// ---------------------------------------------------------------------------

export const MoatTimeline: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Q card: 0s – 10.9s */}
      <Sequence from={Q_IN} durationInFrames={Q_OUT - Q_IN}>
        <QCard />
        <Audio src={staticFile("sfx/whoosh-scene-grid.mp3")} volume={0.6} />
      </Sequence>

      {/* Paradigm text: 10.9s – 18.1s */}
      <Sequence from={PARADIGM_IN} durationInFrames={PARADIGM_OUT - PARADIGM_IN}>
        <ParadigmText />
      </Sequence>

      {/* QUANTITY > QUALITY: 18.1s – 22.8s */}
      <Sequence from={QGQ_IN} durationInFrames={QGQ_OUT - QGQ_IN}>
        <QuantityQuality />
        <Audio src={staticFile("sfx/text-appear-blip.mp3")} volume={0.65} />
      </Sequence>

      {/* Era timeline: 22.8s – 36.3s */}
      <Sequence from={ERA_IN} durationInFrames={ERA_OUT - ERA_IN}>
        <EraTimeline />
        {/* SFX per marker */}
        {ERAS.map((era, i) => (
          <Sequence key={era.year} from={i * ERA_STAGGER}>
            <Audio
              src={staticFile(
                era.isHighlight
                  ? "sfx/drop-cinematic-hit.mp3"
                  : "sfx/scroll-tick.mp3"
              )}
              volume={era.isHighlight ? 0.7 : 0.45}
            />
          </Sequence>
        ))}
      </Sequence>

      {/* Clean slate: 36.3s – 47.5s */}
      <Sequence from={SLATE_IN} durationInFrames={SLATE_OUT - SLATE_IN}>
        <CleanSlate />
      </Sequence>

      {/* Hedge fund contrast: 47.5s – 53.4s */}
      <Sequence from={HEDGE_IN} durationInFrames={HEDGE_OUT - HEDGE_IN}>
        <HedgeFundContrast />
      </Sequence>
    </AbsoluteFill>
  );
};
