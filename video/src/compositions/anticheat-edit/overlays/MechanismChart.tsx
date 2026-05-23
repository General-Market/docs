import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../../common/fonts";
import { colors } from "../../anticheat/theme";
import { DotGrid, DotGridVignette } from "../../anticheat/DotGrid";
import { IdleZoom, RevealChars } from "../../anticheat/vibe";
import { MECHANISMS, MAX_BPS, TOTAL_BPS, type Mechanism } from "./data";

// One chart per mechanism, drawn in the AntiCheatFull language:
//   light field (#F0F2F4), animated Base-blue dot grid, idle camera
//   breath, near-black display type, JetBrains Mono labels.
//
// Thirteen vertical bars — the full ranking — with one mechanism lifted
// to saturated Base blue and a sapphire bloom behind it. The rest sit
// faint, so the eye sees where this one ranks among all thirteen. A stat
// block at the foot reads the highlighted mechanism's number and the
// conversion that produced it.
//
// `highlightSlug` undefined → overview: every bar is live, no callout.

const W = 1920;

const FG = colors.fg; // #0A0A0A
const ACCENT = colors.accent; // #0052FF
const ACCENT_SOFT = colors.accentSoft; // #5B79FF
const DIM = colors.dim; // #6E727A
const FAINT_BAR = "#C7D0DA";

// Baseline + plot geometry.
const BASELINE = 760;
const MAX_BAR_H = 470;
const BAND_W = 1500;
const BAND_LEFT = (W - BAND_W) / 2;

// sqrt height scale with a floor — compresses the 60→0.004 bps range so
// every bar still reads, while keeping MEV visibly dominant.
const heightFor = (bps: number): number => {
  const t = Math.sqrt(bps) / Math.sqrt(MAX_BPS);
  return Math.max(0.045, t);
};

const fmtBps = (bps: number): string => {
  if (bps >= 10) return `${bps.toFixed(0)}`;
  if (bps >= 1) return `${bps.toFixed(1).replace(/\.0$/, "")}`;
  if (bps >= 0.01) return `${bps.toFixed(2)}`;
  return `${bps.toFixed(3)}`;
};

export type MechanismChartProps = {
  highlightSlug?: string;
};

export const MechanismChart: React.FC<MechanismChartProps> = ({ highlightSlug }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const active = highlightSlug
    ? MECHANISMS.find((m) => m.slug === highlightSlug)
    : undefined;

  const barCount = MECHANISMS.length;
  const gap = 18;
  const barW = (BAND_W - gap * (barCount - 1)) / barCount;

  // Slow sapphire breath behind the active bar.
  const breath = 0.5 + 0.5 * Math.sin((frame / fps) * 2.2);

  const title = active ? active.name : "Thirteen mechanisms";
  const kicker = active
    ? `MECHANISM ${String(active.rank).padStart(2, "0")} / 13`
    : `${TOTAL_BPS} BPS · IF ONE VENUE RUNS EVERY PLAY`;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <IdleZoom durationInFrames={9999} from={1.0} to={1.03}>
        <DotGrid intensity={0.9} speed={1.1} />

        {/* Kicker — mono, uppercase, Base blue */}
        <div
          style={{
            position: "absolute",
            top: 96,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: monoFont,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: ACCENT,
            opacity: interpolate(frame, [2, 14], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          {kicker}
        </div>

        {/* Title — heavy display, near-black, glyph reveal */}
        <div
          style={{
            position: "absolute",
            top: 132,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: font,
            fontSize: 84,
            fontWeight: 800,
            letterSpacing: "-0.022em",
            lineHeight: 1.0,
            color: FG,
            padding: "0 120px",
          }}
        >
          <RevealChars text={title} startFrame={4} stagger={1.1} duration={12} />
        </div>

        {/* Bars */}
        {MECHANISMS.map((m, i) => {
          const isActive = active ? m.slug === active.slug : true;
          const x = BAND_LEFT + i * (barW + gap);
          const targetH = heightFor(m.bps) * MAX_BAR_H;

          const local = frame - 16 - i * 2;
          const rise = spring({
            fps,
            frame: Math.max(0, local),
            config: { mass: 0.6, damping: 15, stiffness: 120 },
            durationInFrames: 26,
          });
          const h = targetH * rise;

          const labelOpacity = interpolate(local - 4, [0, 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          const barColor = isActive ? ACCENT : FAINT_BAR;
          const valueColor = isActive ? ACCENT : "#AEB6C0";

          return (
            <div key={m.slug}>
              {/* Sapphire bloom behind the active bar */}
              {isActive && active && h > 4 ? (
                <div
                  style={{
                    position: "absolute",
                    left: x + barW / 2 - 130,
                    top: BASELINE - h - 130,
                    width: 260,
                    height: h + 220,
                    background:
                      "radial-gradient(ellipse at center, rgba(0,82,255,0.40) 0%, rgba(0,82,255,0) 68%)",
                    opacity: 0.55 + 0.45 * breath,
                    filter: "blur(6px)",
                    pointerEvents: "none",
                  }}
                />
              ) : null}

              {/* Bar pill */}
              <div
                style={{
                  position: "absolute",
                  left: x,
                  top: BASELINE - h,
                  width: barW,
                  height: h,
                  borderRadius: barW / 2,
                  background: barColor,
                  boxShadow:
                    isActive && active
                      ? `0 0 0 1px ${ACCENT_SOFT} inset, 0 12px 30px rgba(0,82,255,0.28)`
                      : "none",
                }}
              />

              {/* Value label above bar */}
              <div
                style={{
                  position: "absolute",
                  left: x - 40,
                  top: BASELINE - h - 54,
                  width: barW + 80,
                  textAlign: "center",
                  fontFamily: monoFont,
                  fontSize: isActive ? 30 : 22,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  color: valueColor,
                  fontVariantNumeric: "tabular-nums",
                  opacity: labelOpacity,
                  whiteSpace: "nowrap",
                }}
              >
                {fmtBps(m.bps)}
              </div>

              {/* Short label below bar */}
              <div
                style={{
                  position: "absolute",
                  left: x - 30,
                  top: BASELINE + 18,
                  width: barW + 60,
                  textAlign: "center",
                  fontFamily: monoFont,
                  fontSize: 16,
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                  color: isActive ? FG : DIM,
                  opacity: labelOpacity,
                  lineHeight: 1.2,
                }}
              >
                {m.short}
              </div>
            </div>
          );
        })}

        {/* Baseline rule */}
        <div
          style={{
            position: "absolute",
            left: BAND_LEFT,
            top: BASELINE,
            width: BAND_W,
            height: 0,
            borderTop: `1px solid ${colors.rule}`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: BAND_LEFT,
            top: BASELINE + 60,
            fontFamily: monoFont,
            fontSize: 14,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: DIM,
          }}
        >
          bps per round-trip · retail baseline 0
        </div>

        {/* Stat callout for the highlighted mechanism */}
        {active ? <StatCallout mechanism={active} frame={frame} /> : null}

        <DotGridVignette intensity={0.28} />
      </IdleZoom>
    </AbsoluteFill>
  );
};

const StatCallout: React.FC<{ mechanism: Mechanism; frame: number }> = ({
  mechanism,
  frame,
}) => {
  const op = interpolate(frame, [18, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [18, 32], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 884,
        textAlign: "center",
        opacity: op,
        transform: `translateY(${y.toFixed(1)}px)`,
        padding: "0 120px",
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 64,
          fontWeight: 800,
          letterSpacing: "-0.022em",
          color: colors.accent,
          lineHeight: 1.0,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {fmtBps(mechanism.bps)}
        <span style={{ fontSize: 30, fontWeight: 700, marginLeft: 8, color: colors.dim }}>
          bps / trade
        </span>
      </div>
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: "0.04em",
          color: colors.fgSoft,
          marginTop: 14,
        }}
      >
        {mechanism.conversion}
      </div>
    </div>
  );
};
