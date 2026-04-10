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
import { COLOR, TYPE } from "../designTokens";
import { FPS } from "../theme";
import { DiagramCard } from "../components/DiagramCard";

const sec = (s: number) => Math.round(s * FPS);

// ── Timing ─────────────────────────────────────────────────────────────────
// Local frame 0 = 194.04s in video.
const ERA_TL_IN = sec(22.76);
const ERA_TL_OUT = sec(36.26);
const ERA_STAGGER = [0, sec(3.5), sec(7)]; // card entrance offsets within era sequence

const COMP_IN = sec(36.26);
const COMP_OUT = sec(47.46);

// ── Era Timeline ───────────────────────────────────────────────────────────

interface EraEntry {
  year: string;
  title: string;
  subtitle: string;
  highlighted: boolean;
}

const ERAS: EraEntry[] = [
  {
    year: "1920s",
    title: "Technical Analysis",
    subtitle: "Few knew it = edge",
    highlighted: false,
  },
  {
    year: "1970s",
    title: "Black-Scholes",
    subtitle: "Few could compute = edge",
    highlighted: false,
  },
  {
    year: "2026",
    title: "General Market",
    subtitle: "YOU are here = edge",
    highlighted: true,
  },
];

const EraTimeline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = ERA_TL_OUT - ERA_TL_IN;

  const exitOpacity = interpolate(frame, [duration - sec(1), duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <DiagramCard>
      <div style={{ opacity: exitOpacity }}>
        {/* Label */}
        <div style={{ ...TYPE.label, marginBottom: 28 }}>The Edge Evolves</div>

        {/* Cards row */}
        <div style={{ display: "flex", gap: 28, justifyContent: "center" }}>
          {ERAS.map((era, i) => {
            const delay = ERA_STAGGER[i];
            const localFrame = Math.max(frame - delay, 0);

            const s = spring({
              frame: localFrame,
              fps,
              config: { damping: 14, stiffness: 140, mass: 0.7 },
            });

            const opacity = interpolate(localFrame, [0, 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            const y = interpolate(s, [0, 1], [24, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            const scale = interpolate(s, [0, 1], [0.92, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            return (
              <div
                key={era.year}
                style={{
                  flex: 1,
                  opacity,
                  transform: `translateY(${y}px) scale(${scale})`,
                  background: era.highlighted
                    ? COLOR.lightMint
                    : COLOR.lightSurface,
                  border: era.highlighted
                    ? `2px solid ${COLOR.wiseGreen}`
                    : `1px solid ${COLOR.border}`,
                  borderRadius: 24,
                  padding: "28px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    ...TYPE.subHeading,
                    color: era.highlighted
                      ? COLOR.darkGreen
                      : COLOR.nearBlack,
                  }}
                >
                  {era.year}
                </div>
                <div
                  style={{
                    ...TYPE.cardTitle,
                    color: era.highlighted
                      ? COLOR.darkGreen
                      : COLOR.nearBlack,
                  }}
                >
                  {era.title}
                </div>
                <div
                  style={{
                    ...TYPE.caption,
                    color: era.highlighted
                      ? COLOR.darkGreen
                      : COLOR.gray,
                  }}
                >
                  {era.subtitle}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DiagramCard>
  );
};

// ── Competitive Landscape ──────────────────────────────────────────────────

interface BarEntry {
  label: string;
  widthPct: number;
  stat: string;
  isGM: boolean;
}

const BARS: BarEntry[] = [
  { label: "Stocks", widthPct: 92, stat: "$5.7T", isGM: false },
  { label: "Options", widthPct: 72, stat: "HFT 60%", isGM: false },
  { label: "Crypto", widthPct: 48, stat: "$44B", isGM: false },
  { label: "Pred Mkts", widthPct: 20, stat: "Growing", isGM: false },
  { label: "GM", widthPct: 8, stat: "First", isGM: true },
];

const CompetitiveLandscape: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = COMP_OUT - COMP_IN;

  const exitOpacity = interpolate(frame, [duration - sec(1), duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <DiagramCard>
      <div style={{ opacity: exitOpacity }}>
        {/* Label */}
        <div style={{ ...TYPE.label, marginBottom: 28 }}>
          Competitive Density
        </div>

        {/* Bars */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {BARS.map((bar, i) => {
            const delay = i * sec(0.35);
            const localFrame = Math.max(frame - delay, 0);

            const barWidth = interpolate(
              localFrame,
              [0, sec(1)],
              [0, bar.widthPct],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );

            const rowOpacity = interpolate(localFrame, [0, 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            const statOpacity = interpolate(
              localFrame,
              [sec(0.7), sec(1.2)],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );

            return (
              <div
                key={bar.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  opacity: rowOpacity,
                }}
              >
                {/* Label */}
                <div
                  style={{
                    ...TYPE.bodySemibold,
                    width: 110,
                    textAlign: "right",
                    color: bar.isGM ? COLOR.wiseGreen : COLOR.nearBlack,
                  }}
                >
                  {bar.label}
                </div>

                {/* Bar track */}
                <div
                  style={{
                    flex: 1,
                    height: bar.isGM ? 24 : 18,
                    background: COLOR.lightSurface,
                    borderRadius: 6,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${barWidth}%`,
                      height: "100%",
                      background: bar.isGM ? COLOR.wiseGreen : COLOR.warmDark,
                      borderRadius: 6,
                    }}
                  />
                </div>

                {/* Stat */}
                <div
                  style={{
                    ...TYPE.caption,
                    width: 80,
                    opacity: statOpacity,
                    color: bar.isGM ? COLOR.darkGreen : COLOR.gray,
                  }}
                >
                  {bar.stat}
                </div>
              </div>
            );
          })}
        </div>

        {/* YOU ARE HERE callout */}
        {(() => {
          const calloutFrame = Math.max(frame - sec(2.5), 0);
          const calloutOpacity = interpolate(
            calloutFrame,
            [0, sec(0.5)],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );

          return (
            <div
              style={{
                marginTop: 20,
                marginLeft: 124,
                opacity: calloutOpacity,
              }}
            >
              <span
                style={{
                  ...TYPE.bodySemibold,
                  color: COLOR.wiseGreen,
                  letterSpacing: 1.5,
                }}
              >
                YOU ARE HERE
              </span>
            </div>
          );
        })()}
      </div>
    </DiagramCard>
  );
};

// ── Main Export ─────────────────────────────────────────────────────────────

export const EraDiagrams: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Era Timeline: local 22.76s – 36.26s */}
      <Sequence from={ERA_TL_IN} durationInFrames={ERA_TL_OUT - ERA_TL_IN}>
        <EraTimeline />
        {ERA_STAGGER.map((delay, i) => (
          <Sequence key={i} from={delay}>
            <Audio
              src={staticFile(
                i === 2
                  ? "sfx/drop-cinematic-hit.mp3"
                  : "sfx/scroll-tick.mp3",
              )}
              volume={i === 2 ? 0.65 : 0.4}
            />
          </Sequence>
        ))}
      </Sequence>

      {/* Competitive Landscape: local 36.26s – 47.46s */}
      <Sequence from={COMP_IN} durationInFrames={COMP_OUT - COMP_IN}>
        <CompetitiveLandscape />
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
