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
import { EASE } from "../../../common/easing";
import { COLOR, TYPE, PANEL as PANEL_TOKENS } from "../designTokens";
import { FPS } from "../theme";
import { HEDGE_FUNDS, HFT, PREDICTION_MARKETS } from "../proofData";

const sec = (s: number) => Math.round(s * FPS);

const GREEN = COLOR.up;
const RED = COLOR.down;
const ORANGE = "#f97316"; // gradient step — no token for orange
const YELLOW = "#eab308"; // gradient step — no token for yellow

// ═══════════════════════════════════════════════════════════════════════════
// Local timing — frame 0 = 194.04s in video.
// My section: 216.8s → 247.4s = local 22.76s → 53.36s
// ═══════════════════════════════════════════════════════════════════════════

// Section 1: Era Timeline with Mini-Charts (216.8s → 230.3s)
const ERA_TL_IN = sec(22.76);
const ERA_TL_OUT = sec(36.26);
const ERA_1920_IN = sec(0); // relative to ERA_TL_IN
const ERA_1970_IN = sec(5.2); // 222.0 - 216.8
const ERA_2026_IN = sec(10.1); // 226.9 - 216.8

// Section 2: Competitive Landscape (230.3s → 241.5s)
const COMP_IN = sec(36.26);
const COMP_OUT = sec(47.46);

// ═══════════════════════════════════════════════════════════════════════════
// PARASITE LABEL
// ═══════════════════════════════════════════════════════════════════════════

interface ParasiteLabelProps {
  x: number;
  y: number;
  text: string;
  progress: number;
  align?: "left" | "center" | "right";
}

const ParasiteLabel: React.FC<ParasiteLabelProps> = ({
  x,
  y,
  text,
  progress,
  align = "center",
}) => {
  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const nudgeY = interpolate(progress, [0, 1], [6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });
  // Subtle pulse on first appearance
  const scale = progress > 0.8 ? 1 + 0.015 * Math.sin(progress * 12) : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        opacity,
        transform: `translateY(${nudgeY}px) scale(${scale})`,
        ...TYPE.label,
        color: "rgba(250,250,250,0.55)",
        textAlign: align,
        whiteSpace: "nowrap",
        pointerEvents: "none",
      }}
    >
      {text}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. ERA TIMELINE WITH MINI-CHARTS
// ═══════════════════════════════════════════════════════════════════════════

// -- Mini-chart: animated candlesticks --
const CandlestickChart: React.FC<{ progress: number }> = ({ progress }) => {
  const candles = [
    { o: 36, c: 24, h: 18, l: 40, bull: false },
    { o: 22, c: 32, h: 16, l: 38, bull: true },
    { o: 30, c: 20, h: 14, l: 36, bull: false },
    { o: 18, c: 34, h: 10, l: 40, bull: true },
  ];
  const candleW = 12;
  const gap = 6;
  const totalW = candles.length * (candleW + gap);

  return (
    <svg width={totalW} height={50} viewBox={`0 0 ${totalW} 50`}>
      {candles.map((c, i) => {
        const cProgress = interpolate(
          progress,
          [i * 0.2, i * 0.2 + 0.3],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        const x = i * (candleW + gap);
        const bodyTop = Math.min(c.o, c.c);
        const bodyH = Math.abs(c.o - c.c) * cProgress;
        const wickH = (c.l - c.h) * cProgress;
        const color = c.bull ? "rgba(250,250,250,0.7)" : "rgba(250,250,250,0.35)";

        return (
          <g key={i} opacity={cProgress}>
            {/* Wick */}
            <line
              x1={x + candleW / 2}
              y1={c.h}
              x2={x + candleW / 2}
              y2={c.h + wickH}
              stroke={color}
              strokeWidth={1.5}
            />
            {/* Body */}
            <rect
              x={x}
              y={bodyTop}
              width={candleW}
              height={Math.max(bodyH, 2)}
              fill={c.bull ? color : "transparent"}
              stroke={color}
              strokeWidth={1}
              rx={1}
            />
          </g>
        );
      })}
    </svg>
  );
};

// -- Mini-chart: typing formula --
const FormulaType: React.FC<{ progress: number }> = ({ progress }) => {
  const formula = "f(S,K,r,T,\u03C3)";
  const visibleChars = Math.floor(progress * formula.length);
  const displayed = formula.slice(0, visibleChars);
  const cursorVisible = progress < 1 && Math.sin(progress * 40) > 0;

  return (
    <div
      style={{
        ...TYPE.mono,
        color: "rgba(250,250,250,0.7)",
        letterSpacing: 1,
        minHeight: 24,
        whiteSpace: "nowrap",
      }}
    >
      {displayed}
      {cursorVisible && (
        <span style={{ color: "rgba(250,250,250,0.4)" }}>|</span>
      )}
    </div>
  );
};

// -- Mini-chart: batch grid filling --
const BatchGrid: React.FC<{ progress: number }> = ({ progress }) => {
  const rows = 4;
  const cols = 4;
  const cellSize = 10;
  const gap = 3;

  return (
    <svg
      width={cols * (cellSize + gap)}
      height={rows * (cellSize + gap)}
      viewBox={`0 0 ${cols * (cellSize + gap)} ${rows * (cellSize + gap)}`}
    >
      {Array.from({ length: rows * cols }).map((_, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        const cellProgress = interpolate(
          progress,
          [idx * 0.04, idx * 0.04 + 0.15],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        return (
          <rect
            key={idx}
            x={col * (cellSize + gap)}
            y={row * (cellSize + gap)}
            width={cellSize}
            height={cellSize}
            rx={2}
            fill={
              cellProgress > 0
                ? `rgba(0, 200, 83, ${0.3 + cellProgress * 0.6})`
                : "rgba(250,250,250,0.1)"
            }
          />
        );
      })}
    </svg>
  );
};

// -- Era Card component --
interface EraCardData {
  year: string;
  label: string;
  subtitle: string;
  parasiteLabel: string;
  isHighlight: boolean;
  delayFrames: number; // relative frames within the era timeline sequence
}

const ERA_CARDS: EraCardData[] = [
  {
    year: "1920s",
    label: "Technical Analysis",
    subtitle: "Few knew it = massive edge",
    parasiteLabel: "INFORMATION ASYMMETRY",
    isHighlight: false,
    delayFrames: ERA_1920_IN,
  },
  {
    year: "1970s",
    label: "Black-Scholes",
    subtitle: "Few could compute = massive edge",
    parasiteLabel: "COMPUTATIONAL ASYMMETRY",
    isHighlight: false,
    delayFrames: ERA_1970_IN,
  },
  {
    year: "2026",
    label: "General Market",
    subtitle: "YOU are here = massive edge",
    parasiteLabel: "INSTRUMENT ASYMMETRY",
    isHighlight: true,
    delayFrames: ERA_2026_IN,
  },
];

const EraTimelineCharts: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = ERA_TL_OUT - ERA_TL_IN;

  // Timeline bar grows L→R
  const barProgress = interpolate(frame, [0, sec(10)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Exit fade
  const exitOpacity = interpolate(frame, [duration - sec(1), duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cardWidth = 220;
  const highlightCardWidth = 260;
  const positions = [180, 700, 1260]; // x positions for 3 cards across lower third

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      {/* Dark lower-third panel */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 300,
          background: COLOR.panelDark,
          borderTop: `1px solid ${COLOR.border}22`,
        }}
      />

      {/* Timeline bar across the lower third */}
      <div
        style={{
          position: "absolute",
          bottom: 260,
          left: 120,
          right: 120,
          height: 3,
          background: `${COLOR.border}1A`,
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${barProgress * 100}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${COLOR.border}4D, ${COLOR.up})`,
            borderRadius: 2,
          }}
        />
      </div>

      {/* Era cards */}
      {ERA_CARDS.map((card, i) => {
        const cardFrame = Math.max(frame - card.delayFrames, 0);

        const cardSpring = spring({
          frame: cardFrame,
          fps,
          config: {
            damping: card.isHighlight ? 10 : 14,
            stiffness: card.isHighlight ? 180 : 120,
            mass: 0.6,
          },
        });

        const cardOpacity = interpolate(cardFrame, [0, 10], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const cardY = interpolate(cardSpring, [0, 1], [40, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const cardScale = interpolate(cardSpring, [0, 1], [0.8, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        // Mini-chart progress (starts 0.5s after card appears)
        const chartProgress = interpolate(
          cardFrame,
          [sec(0.5), sec(3)],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        // Parasite label progress (0.3s after card)
        const parasiteProgress = interpolate(
          cardFrame,
          [sec(0.3), sec(1)],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        // 2026 card pulse
        const pulse =
          card.isHighlight && cardFrame > sec(1)
            ? 1 + 0.02 * Math.sin(cardFrame * 0.12)
            : 1;

        const w = card.isHighlight ? highlightCardWidth : cardWidth;

        return (
          <React.Fragment key={card.year}>
            {/* Dot on timeline */}
            <div
              style={{
                position: "absolute",
                bottom: 256,
                left: positions[i] + w / 2 - 6,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: card.isHighlight ? GREEN : "transparent",
                border: card.isHighlight
                  ? `2px solid ${GREEN}`
                  : "2px solid rgba(250,250,250,0.4)",
                boxShadow: card.isHighlight
                  ? `0 0 12px ${GREEN}88`
                  : "none",
                opacity: cardOpacity,
              }}
            />

            {/* Card */}
            <div
              style={{
                position: "absolute",
                bottom: 50,
                left: positions[i],
                width: w,
                opacity: cardOpacity,
                transform: `translateY(${cardY}px) scale(${cardScale * pulse})`,
                background: COLOR.panelDark,
                borderRadius: PANEL_TOKENS.dark.borderRadius,
                padding: "18px 20px",
                border: card.isHighlight
                  ? `1px solid ${GREEN}66`
                  : "1px solid rgba(250,250,250,0.08)",
                boxShadow: card.isHighlight
                  ? `0 0 30px ${GREEN}22, 0 4px 24px rgba(0,0,0,0.4)`
                  : "0 4px 20px rgba(0,0,0,0.3)",
              }}
            >
              {/* Year */}
              <div
                style={{
                  ...TYPE.heading,
                  color: card.isHighlight
                    ? COLOR.up
                    : "rgba(250,250,250,0.5)",
                  marginBottom: 10,
                }}
              >
                {card.year}
              </div>

              {/* Mini-chart */}
              <div style={{ marginBottom: 10, minHeight: 50 }}>
                {i === 0 && <CandlestickChart progress={chartProgress} />}
                {i === 1 && <FormulaType progress={chartProgress} />}
                {i === 2 && <BatchGrid progress={chartProgress} />}
              </div>

              {/* Label */}
              <div
                style={{
                  ...TYPE.subhead,
                  color: card.isHighlight
                    ? COLOR.white
                    : "rgba(250,250,250,0.8)",
                  marginBottom: 4,
                }}
              >
                {card.label}
              </div>

              {/* Subtitle */}
              <div
                style={{
                  ...TYPE.caption,
                  color: card.isHighlight
                    ? "rgba(250,250,250,0.85)"
                    : "rgba(250,250,250,0.45)",
                }}
              >
                {card.subtitle}
              </div>

              {/* Green glow underline for 2026 */}
              {card.isHighlight && (
                <div
                  style={{
                    marginTop: 10,
                    height: 2,
                    background: `linear-gradient(90deg, transparent, ${GREEN}, transparent)`,
                    borderRadius: 1,
                    opacity: 0.6 + 0.2 * Math.sin(cardFrame * 0.1),
                  }}
                />
              )}
            </div>

            {/* Parasite label */}
            <ParasiteLabel
              x={positions[i] + w / 2 - 60}
              y={1080 - 300 - 22}
              text={card.parasiteLabel}
              progress={parasiteProgress}
            />
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. COMPETITIVE LANDSCAPE BAR CHART
// ═══════════════════════════════════════════════════════════════════════════

interface BarData {
  label: string;
  width: number; // 0-100% of max
  color: string;
  stat: string;
  parasiteText: string;
  isPulsing: boolean;
}

const BARS: BarData[] = [
  {
    label: "STOCKS",
    width: 100,
    color: RED,
    stat: `${HEDGE_FUNDS.totalAUM} AUM`,
    parasiteText: "SATURATED",
    isPulsing: false,
  },
  {
    label: "OPTIONS",
    width: 78,
    color: ORANGE,
    stat: `HFT: ${HFT.usEquityShare} volume`,
    parasiteText: "DOMINATED BY MACHINES",
    isPulsing: false,
  },
  {
    label: "CRYPTO",
    width: 55,
    color: YELLOW,
    stat: "Mature infrastructure",
    parasiteText: "INCREASINGLY CROWDED",
    isPulsing: false,
  },
  {
    label: "PRED MKTS",
    width: 18,
    color: GREEN,
    stat: `${PREDICTION_MARKETS.totalVolume2025} volume`,
    parasiteText: "GROWING FAST",
    isPulsing: false,
  },
  {
    label: "GM",
    width: 8,
    color: GREEN,
    stat: "FIRST MOVER",
    parasiteText: "YOU ARE HERE",
    isPulsing: true,
  },
];

const CompetitiveLandscape: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = COMP_OUT - COMP_IN;

  const exitOpacity = interpolate(frame, [duration - sec(1), duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Overall panel entry
  const panelSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.9 },
  });
  const panelOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const panelY = interpolate(panelSpring, [0, 1], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: Math.min(panelOpacity, exitOpacity),
        transform: `translateY(${panelY}px)`,
      }}
    >
      <div
        style={{
          background: COLOR.panelDark,
          borderRadius: PANEL_TOKENS.dark.borderRadius,
          padding: "40px 56px",
          width: 1100,
        }}
      >
        {/* Title */}
        <div
          style={{
            ...TYPE.heading,
            color: "rgba(250,250,250,0.7)",
            textTransform: "uppercase",
            marginBottom: 28,
          }}
        >
          Competitive Density
        </div>

        {/* Bars */}
        {BARS.map((bar, i) => {
          const barDelay = i * sec(0.4);
          const barFrame = Math.max(frame - barDelay - sec(0.5), 0);

          // Bar width animation
          const barFill = interpolate(barFrame, [0, sec(1.2)], [0, bar.width], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE.out,
          });

          const barOpacity = interpolate(barFrame, [0, 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          // Stat text reveal
          const statOpacity = interpolate(
            barFrame,
            [sec(0.8), sec(1.4)],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }
          );

          // Parasite label for this bar
          const parasiteProgress = interpolate(
            barFrame,
            [sec(1.0), sec(1.6)],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }
          );

          // Pulse for GM bar
          const glowIntensity = bar.isPulsing
            ? 0.5 + 0.3 * Math.sin(barFrame * 0.15)
            : 0;

          return (
            <div
              key={bar.label}
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: i < BARS.length - 1 ? 14 : 0,
                opacity: barOpacity,
              }}
            >
              {/* Label */}
              <div
                style={{
                  ...TYPE.label,
                  color: bar.isPulsing
                    ? COLOR.up
                    : "rgba(250,250,250,0.65)",
                  width: 100,
                  textAlign: "right",
                  paddingRight: 16,
                }}
              >
                {bar.label}
              </div>

              {/* Bar track */}
              <div
                style={{
                  flex: 1,
                  height: bar.isPulsing ? 28 : 22,
                  background: `${COLOR.border}0D`,
                  borderRadius: 4,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Filled bar */}
                <div
                  style={{
                    width: `${barFill}%`,
                    height: "100%",
                    background: bar.isPulsing
                      ? `linear-gradient(90deg, ${bar.color}, ${bar.color}cc)`
                      : bar.color,
                    borderRadius: 4,
                    boxShadow: bar.isPulsing
                      ? `0 0 ${16 + glowIntensity * 20}px ${GREEN}${Math.round(
                          glowIntensity * 255
                        )
                          .toString(16)
                          .padStart(2, "0")}`
                      : "none",
                    opacity: bar.isPulsing ? 1 : 0.7,
                  }}
                />
              </div>

              {/* Stat text */}
              <div
                style={{
                  ...TYPE.mono,
                  color: bar.isPulsing
                    ? COLOR.up
                    : "rgba(250,250,250,0.5)",
                  width: 180,
                  paddingLeft: 14,
                  opacity: statOpacity,
                }}
              >
                {bar.stat}
              </div>

              {/* Parasite */}
              <div
                style={{
                  ...TYPE.caption,
                  color: bar.isPulsing
                    ? COLOR.up
                    : "rgba(250,250,250,0.3)",
                  width: 160,
                  paddingLeft: 8,
                  opacity: parasiteProgress,
                  textTransform: "uppercase",
                }}
              >
                {bar.parasiteText}
              </div>
            </div>
          );
        })}

        {/* "YOU ARE HERE" arrow for GM bar */}
        {(() => {
          const arrowFrame = Math.max(frame - sec(3), 0);
          const arrowOpacity = interpolate(arrowFrame, [0, sec(0.6)], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const arrowX = interpolate(arrowFrame, [0, sec(0.8)], [-20, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE.out,
          });
          const arrowPulse =
            arrowFrame > sec(0.8)
              ? 1 + 0.03 * Math.sin(arrowFrame * 0.12)
              : 1;

          return (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginTop: 10,
                marginLeft: 100,
                opacity: arrowOpacity,
                transform: `translateX(${arrowX}px) scale(${arrowPulse})`,
              }}
            >
              <svg width={24} height={16} viewBox="0 0 24 16">
                <path
                  d="M0 8 L16 8 L12 3 M16 8 L12 13"
                  stroke={GREEN}
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                style={{
                  ...TYPE.subhead,
                  color: COLOR.up,
                  marginLeft: 8,
                  letterSpacing: 2,
                  textShadow: `0 0 16px ${COLOR.up}44`,
                }}
              >
                YOU ARE HERE
              </span>
            </div>
          );
        })()}
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export const EraDiagrams: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* 1. Era Timeline with Mini-Charts: local 22.76s – 36.26s */}
      <Sequence from={ERA_TL_IN} durationInFrames={ERA_TL_OUT - ERA_TL_IN}>
        <EraTimelineCharts />
        {/* SFX per era card */}
        {ERA_CARDS.map((card) => (
          <Sequence key={card.year} from={card.delayFrames}>
            <Audio
              src={staticFile(
                card.isHighlight
                  ? "sfx/drop-cinematic-hit.mp3"
                  : "sfx/scroll-tick.mp3"
              )}
              volume={card.isHighlight ? 0.65 : 0.4}
            />
          </Sequence>
        ))}
      </Sequence>

      {/* 2. Competitive Landscape Bar Chart: local 36.26s – 47.46s */}
      <Sequence from={COMP_IN} durationInFrames={COMP_OUT - COMP_IN}>
        <CompetitiveLandscape />
        {/* Stinger when chart completes */}
        <Sequence from={sec(4)}>
          <Audio
            src={staticFile("sfx/stinger-logo-reveal.mp3")}
            volume={0.5}
          />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};
