/**
 * BenefitBreadth — Bar chart that actually shows scale.
 *
 * Competitor bars fill 30% of the screen (Binance is the longest).
 * General Market's bar EXTENDS TO THE EDGE and beyond — with an arrow.
 * The 583,551 number is HUGE. The visual gap is undeniable.
 *
 * Bars are thick. Labels are large. No empty space.
 */
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { COLOR, FONT } from "../tokens";
import { DecoGrid } from "../overlays/DecoGrid";
import { Eyebrow } from "../overlays/Eyebrow";

interface BenefitDarkPoolProps {
  durationInFrames: number;
}

const PLATFORMS = [
  { name: "Polymarket", markets: 40, color: "#6366f1" },
  { name: "Kalshi", markets: 200, color: "#8b5cf6" },
  { name: "Robinhood", markets: 150, color: "#22c55e" },
  { name: "Coinbase", markets: 350, color: "#3b82f6" },
  { name: "Binance", markets: 600, color: "#f59e0b" },
];

// Binance (600) fills ~30% of screen width. Others proportional.
const MAX_BAR_PX = 480; // Binance bar width in px
const LABEL_W = 180;
const BAR_H = 44;
const GAP = 16;

export const BenefitDarkPool: React.FC<BenefitDarkPoolProps> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ═══ Staggered spring entrances ═══
  const titleSpring = spring({ frame, fps, config: { damping: 12 }, delay: 0 });
  const subtitleSpring = spring({ frame, fps, config: { damping: 12 }, delay: 5 });
  const chartSpring = spring({ frame, fps, config: { damping: 12 }, delay: 10 });

  const titleEntrY = interpolate(titleSpring, [0, 1], [25, 0]);
  const titleEntrOp = interpolate(titleSpring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });
  const subtitleEntrY = interpolate(subtitleSpring, [0, 1], [25, 0]);
  const subtitleEntrOp = interpolate(subtitleSpring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });
  const chartEntrY = interpolate(chartSpring, [0, 1], [25, 0]);
  const chartEntrOp = interpolate(chartSpring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });

  const fadeOut = interpolate(
    frame, [durationInFrames - 10, durationInFrames], [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Title
  const titleOp = interpolate(frame, [3, 10], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Bars appear staggered
  const barStart = 14;
  const barGap = 7;

  // GM dramatic entrance
  const gmStart = barStart + PLATFORMS.length * barGap + 8;
  const gmOp = interpolate(frame, [gmStart, gmStart + 8], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  // GM bar extends from 0 to FULL SCREEN WIDTH
  const gmBarPct = interpolate(frame, [gmStart + 5, gmStart + 35], [0, 100], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // GM number (appears after bar fully extends)
  const gmNumOp = interpolate(frame, [gmStart + 30, gmStart + 40], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Tagline
  const tagOp = interpolate(frame, [gmStart + 44, gmStart + 54], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Total chart height for vertical centering
  const totalRows = PLATFORMS.length + 1; // +1 for GM
  const chartH = totalRows * (BAR_H + GAP);
  const chartTop = (1080 - chartH) / 2 - 40;

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.page, opacity: fadeOut }}>

      {/* Decorative SVG grid — allocation rings */}
      <DecoGrid variant="allocation" opacity={0.3} />

      {/* Eyebrow label */}
      <div style={{
        position: "absolute", top: 40, left: 60,
        opacity: titleOp * titleEntrOp,
        transform: `translateY(${titleEntrY}px)`,
      }}>
        <Eyebrow color={COLOR.brand} text="01 — Breadth" />
      </div>

      {/* Fix 3: Competitive claim, not clinical title */}
      <div style={{
        position: "absolute", top: chartTop - 60, left: LABEL_W + 80,
        opacity: titleOp * subtitleEntrOp,
        fontFamily: FONT.sans, fontSize: 16, fontWeight: 600,
        color: COLOR.textMuted, letterSpacing: "0.06em",
        transform: `translateY(${subtitleEntrY}px)`,
      }}>
        They list markets. We generate them.
      </div>

      {/* Competitor bars — left-aligned, labels on the left */}
      <div style={{ opacity: chartEntrOp, transform: `translateY(${chartEntrY}px)` }}>
      {PLATFORMS.map((p, i) => {
        const appear = barStart + i * barGap;
        const barOp = interpolate(frame, [appear, appear + 5], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        const barW = interpolate(frame, [appear + 2, appear + 12], [0, (p.markets / 600) * MAX_BAR_PX], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        const top = chartTop + i * (BAR_H + GAP);

        return (
          <div key={i} style={{
            position: "absolute", top, left: 0, right: 0,
            display: "flex", alignItems: "center",
            opacity: barOp,
          }}>
            {/* Label */}
            <div style={{
              width: LABEL_W, textAlign: "right", paddingRight: 24,
              fontFamily: FONT.sans, fontSize: 18, fontWeight: 600,
              color: COLOR.textSecondary,
            }}>
              {p.name}
            </div>
            {/* Bar */}
            <div style={{
              height: BAR_H, width: barW, borderRadius: 6,
              backgroundColor: p.color, opacity: 0.8,
            }} />
            {/* Number */}
            <div style={{
              marginLeft: 14,
              fontFamily: FONT.mono, fontSize: 16, fontWeight: 600,
              color: COLOR.textMuted,
            }}>
              {p.markets}
            </div>
          </div>
        );
      })}

      {/* GENERAL MARKET — the punchline */}
      {gmOp > 0 && (() => {
        const gmTop = chartTop + PLATFORMS.length * (BAR_H + GAP) + 10;
        return (
          <>
            <div style={{
              position: "absolute", top: gmTop, left: 0, right: 0,
              display: "flex", alignItems: "center",
              opacity: gmOp,
            }}>
              {/* Label — bold green */}
              <div style={{
                width: LABEL_W, textAlign: "right", paddingRight: 24,
                fontFamily: FONT.sans, fontSize: 18, fontWeight: 800,
                color: COLOR.brand,
              }}>
                General Market
              </div>
              {/* Bar — extends to edge of screen */}
              <div style={{
                height: BAR_H + 8, // taller than others
                width: `${gmBarPct}%`,
                maxWidth: `calc(100% - ${LABEL_W}px)`,
                borderRadius: 6,
                backgroundColor: COLOR.brand,
                opacity: 0.9,
                position: "relative",
              }}>
                {/* Arrow at end */}
                {gmBarPct > 90 && (
                  <div style={{
                    position: "absolute", right: -30, top: "50%",
                    transform: "translateY(-50%)",
                    fontFamily: FONT.sans, fontSize: 24, color: COLOR.brand,
                    fontWeight: 700,
                  }}>
                    →
                  </div>
                )}
              </div>
            </div>

            {/* The number — HUGE, below the bar */}
            <div style={{
              position: "absolute",
              top: gmTop + BAR_H + 30,
              left: LABEL_W + 24,
              opacity: gmNumOp,
            }}>
              <span style={{
                fontFamily: FONT.mono, fontSize: 64, fontWeight: 700,
                color: COLOR.brand, letterSpacing: "-0.02em",
              }}>
                583,551
              </span>
              <span style={{
                fontFamily: FONT.sans, fontSize: 22, fontWeight: 500,
                color: COLOR.textMuted, marginLeft: 16,
              }}>
                and counting
              </span>
            </div>
          </>
        );
      })()}
      </div>

      {/* Tagline — bottom */}
      <div style={{
        position: "absolute", bottom: 60, left: "50%",
        transform: "translateX(-50%)", textAlign: "center",
        opacity: tagOp * fadeOut,
      }}>
        <div style={{
          fontFamily: FONT.sans, fontSize: 28, fontWeight: 700,
          color: COLOR.textPrimary, letterSpacing: "-0.01em",
        }}>
          From 40 markets to 583,551.
        </div>
      </div>
    </AbsoluteFill>
  );
};
