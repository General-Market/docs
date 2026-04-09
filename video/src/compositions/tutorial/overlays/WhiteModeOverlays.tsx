import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Audio,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  staticFile,
} from "remotion";
import { font, monoFont } from "../../../common/fonts";
import { toFrames } from "../theme";

/* ─── Design tokens (matching frontend CSS vars) ─── */

const WHITE = {
  bg: "#FFFFFF",
  text: "#1A1A1A",
  muted: "#999999",
  border: "#E0E0E0",
  surface: "#F4F6F5",
  brand: "#00A36C",
  up: "#16A34A",
  shadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
} as const;

/* ─── Shared entrance animation ─── */

function useCardEntrance(direction: "top" | "center" = "center") {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scaleSpring = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 140, mass: 0.6 },
    durationInFrames: 20,
  });

  const scale = interpolate(scaleSpring, [0, 1], [0.95, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateY =
    direction === "top"
      ? interpolate(scaleSpring, [0, 1], [-60, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

  return { scale, opacity, translateY };
}

/* ─── Shared fade out ─── */

function useFadeOut(holdSec: number) {
  const frame = useCurrentFrame();
  const holdFrames = toFrames(holdSec);
  const fadeOutFrames = 10;
  const fadeOutStart = holdFrames - fadeOutFrames;

  return interpolate(frame, [fadeOutStart, holdFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/* ─── Micro label ─── */

const MicroLabel: React.FC<{
  children: React.ReactNode;
  color?: string;
}> = ({ children, color = WHITE.muted }) => (
  <span
    style={{
      fontSize: 11,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color,
      fontFamily: font,
      lineHeight: 1.4,
    }}
  >
    {children}
  </span>
);

/* ─── Mono value ─── */

const MonoValue: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  weight?: number;
}> = ({ children, size = 28, color = WHITE.text, weight = 900 }) => (
  <span
    style={{
      fontSize: size,
      fontWeight: weight,
      fontFamily: monoFont,
      fontVariantNumeric: "tabular-nums",
      letterSpacing: "-0.03em",
      color,
      lineHeight: 1.15,
    }}
  >
    {children}
  </span>
);

/* ═══════════════════════════════════════════════════════════════
   PANEL 1: Category Pills (48.64s, hold 3s)
   ═══════════════════════════════════════════════════════════════ */

const CATEGORIES = [
  { label: "All", count: 47, active: true },
  { label: "Transport", count: 3, active: false },
  { label: "Streaming", count: 5, active: false },
  { label: "Gaming", count: 4, active: false },
  { label: "Crypto", count: 8, active: false },
  { label: "Weather", count: 3, active: false },
  { label: "Sports", count: 4, active: false },
  { label: "Finance", count: 6, active: false },
  { label: "Music", count: 3, active: false },
  { label: "E-sports", count: 4, active: false },
];

const CategoryPills: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale, opacity, translateY } = useCardEntrance("top");
  const fadeOut = useFadeOut(3);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: 60,
      }}
    >
      <div
        style={{
          background: WHITE.bg,
          borderRadius: 12,
          boxShadow: WHITE.shadow,
          border: `1px solid ${WHITE.border}`,
          padding: "20px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          transform: `scale(${scale}) translateY(${translateY}px)`,
          opacity: Math.min(opacity, fadeOut),
          maxWidth: 1100,
        }}
      >
        {/* Header */}
        <MicroLabel>Categories</MicroLabel>

        {/* Pills row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexWrap: "nowrap",
          }}
        >
          {CATEGORIES.map((cat, i) => {
            const pillDelay = i * 2;
            const pillSpring = spring({
              frame: frame - pillDelay,
              fps,
              config: { damping: 18, stiffness: 180, mass: 0.4 },
              durationInFrames: 12,
            });

            const pillScale = interpolate(pillSpring, [0, 1], [0.8, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            const pillOpacity = interpolate(
              frame - pillDelay,
              [0, 8],
              [0, 1],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }
            );

            return (
              <div
                key={cat.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "6px 16px",
                  borderRadius: 999,
                  background: cat.active
                    ? "rgba(0, 0, 0, 0.06)"
                    : "transparent",
                  transform: `scale(${pillScale})`,
                  opacity: pillOpacity,
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: cat.active ? 700 : 500,
                    color: cat.active ? WHITE.text : WHITE.muted,
                    fontFamily: font,
                    letterSpacing: "0.01em",
                  }}
                >
                  {cat.label}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: monoFont,
                    fontVariantNumeric: "tabular-nums",
                    color: "rgba(153, 153, 153, 0.6)",
                    fontWeight: 500,
                  }}
                >
                  {cat.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════════════
   PANEL 2: Metrics Dashboard Mockup (89.84s, hold 3s)
   ═══════════════════════════════════════════════════════════════ */

const BATCH_METRICS = [
  { label: "Markets", value: "30" },
  { label: "Window", value: "10 min" },
  { label: "Settlement", value: "Parimutuel" },
  { label: "Status", value: "Live", color: WHITE.up },
];

const MetricsDashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale, opacity } = useCardEntrance("center");
  const fadeOut = useFadeOut(3);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          background: WHITE.bg,
          borderRadius: 12,
          boxShadow: WHITE.shadow,
          border: `1px solid ${WHITE.border}`,
          width: 640,
          transform: `scale(${scale})`,
          opacity: Math.min(opacity, fadeOut),
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 28px 16px",
            borderBottom: `1px solid ${WHITE.border}`,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: WHITE.muted,
              fontFamily: font,
            }}
          >
            Source Batch
          </span>
          <div
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: WHITE.text,
              fontFamily: font,
              letterSpacing: "-0.025em",
              marginTop: 4,
            }}
          >
            TRAIN DELAY BATCH
          </div>
        </div>

        {/* Metrics grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: 0,
          }}
        >
          {BATCH_METRICS.map((m, i) => {
            const stagger = i * 3;
            const statSpring = spring({
              frame: frame - stagger,
              fps,
              config: { damping: 20, stiffness: 160, mass: 0.5 },
              durationInFrames: 15,
            });

            const statY = interpolate(statSpring, [0, 1], [16, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            const statOpacity = interpolate(
              frame - stagger,
              [0, 10],
              [0, 1],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }
            );

            return (
              <div
                key={m.label}
                style={{
                  padding: "20px 28px",
                  borderRight:
                    i < BATCH_METRICS.length - 1
                      ? `1px solid ${WHITE.border}`
                      : "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  transform: `translateY(${statY}px)`,
                  opacity: statOpacity,
                }}
              >
                <MicroLabel>{m.label}</MicroLabel>
                <MonoValue
                  size={m.value.length > 6 ? 18 : 24}
                  color={m.color ?? WHITE.text}
                  weight={m.color ? 700 : 900}
                >
                  {m.value}
                </MonoValue>
              </div>
            );
          })}
        </div>

        {/* Bottom border accent */}
        <div
          style={{
            height: 3,
            background: `linear-gradient(90deg, ${WHITE.brand} 0%, ${WHITE.border} 100%)`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════════════
   PANEL 3: Settlement Flow Diagram (113.76s, hold 4s)
   ═══════════════════════════════════════════════════════════════ */

const FLOW_STEPS = [
  { label: "BETS OPEN", active: false },
  { label: "BETS CLOSE", active: false },
  { label: "ORACLE CONSENSUS", active: true },
  { label: "PNL DISTRIBUTED", active: false },
];

const SettlementFlow: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale, opacity } = useCardEntrance("center");
  const fadeOut = useFadeOut(4);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          background: WHITE.bg,
          borderRadius: 12,
          boxShadow: WHITE.shadow,
          border: `1px solid ${WHITE.border}`,
          padding: "32px 40px",
          transform: `scale(${scale})`,
          opacity: Math.min(opacity, fadeOut),
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <MicroLabel>Settlement Pipeline</MicroLabel>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
          }}
        >
          {FLOW_STEPS.map((step, i) => {
            const stepDelay = i * 6;
            const stepSpring = spring({
              frame: frame - stepDelay,
              fps,
              config: { damping: 18, stiffness: 160, mass: 0.5 },
              durationInFrames: 16,
            });

            const stepScale = interpolate(stepSpring, [0, 1], [0.85, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            const stepOpacity = interpolate(
              frame - stepDelay,
              [0, 10],
              [0, 1],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }
            );

            // Arrow opacity animates between steps
            const arrowOpacity =
              i < FLOW_STEPS.length - 1
                ? interpolate(frame - (stepDelay + 4), [0, 8], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })
                : 0;

            return (
              <React.Fragment key={step.label}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    transform: `scale(${stepScale})`,
                    opacity: stepOpacity,
                  }}
                >
                  {/* Step box */}
                  <div
                    style={{
                      padding: "14px 24px",
                      borderRadius: 8,
                      border: `2px solid ${step.active ? WHITE.up : WHITE.border}`,
                      background: step.active
                        ? "rgba(22, 163, 74, 0.08)"
                        : WHITE.bg,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {/* Step indicator dot */}
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: step.active ? WHITE.up : WHITE.border,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: step.active ? WHITE.up : WHITE.text,
                        fontFamily: font,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                </div>

                {/* Arrow connector */}
                {i < FLOW_STEPS.length - 1 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "0 6px",
                      opacity: arrowOpacity,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 2,
                        background: WHITE.border,
                      }}
                    />
                    <div
                      style={{
                        width: 0,
                        height: 0,
                        borderLeft: `8px solid ${WHITE.border}`,
                        borderTop: "5px solid transparent",
                        borderBottom: "5px solid transparent",
                      }}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════════════
   PANEL 4: Privacy Comparison Card (166.20s, hold 3s)
   ═══════════════════════════════════════════════════════════════ */

const COMPARISON_ROWS = [
  { attribute: "Order Book", traditional: "Visible", gm: "Sealed" },
  { attribute: "Trades", traditional: "Public", gm: "Private" },
  { attribute: "Settlement", traditional: "Days", gm: "10 min" },
  { attribute: "Copy Trading", traditional: "Enabled", gm: "Blocked" },
];

const PrivacyComparison: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale, opacity } = useCardEntrance("center");
  const fadeOut = useFadeOut(3);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          background: WHITE.bg,
          borderRadius: 12,
          boxShadow: WHITE.shadow,
          border: `1px solid ${WHITE.border}`,
          width: 580,
          transform: `scale(${scale})`,
          opacity: Math.min(opacity, fadeOut),
          overflow: "hidden",
        }}
      >
        {/* Column headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr 1fr",
            borderBottom: `1px solid ${WHITE.border}`,
          }}
        >
          <div style={{ padding: "16px 24px" }}>
            <MicroLabel>Attribute</MicroLabel>
          </div>
          <div
            style={{
              padding: "16px 24px",
              borderLeft: `1px solid ${WHITE.border}`,
            }}
          >
            <MicroLabel color="rgba(153, 153, 153, 0.7)">
              Traditional
            </MicroLabel>
          </div>
          <div
            style={{
              padding: "16px 24px",
              borderLeft: `1px solid ${WHITE.border}`,
            }}
          >
            <MicroLabel color={WHITE.up}>General Market</MicroLabel>
          </div>
        </div>

        {/* Rows */}
        {COMPARISON_ROWS.map((row, i) => {
          const rowDelay = i * 4;
          const rowSpring = spring({
            frame: frame - rowDelay,
            fps,
            config: { damping: 20, stiffness: 150, mass: 0.5 },
            durationInFrames: 14,
          });

          const rowX = interpolate(rowSpring, [0, 1], [20, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          const rowOpacity = interpolate(
            frame - rowDelay,
            [0, 10],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }
          );

          const isLast = i === COMPARISON_ROWS.length - 1;

          return (
            <div
              key={row.attribute}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1fr",
                borderBottom: isLast ? "none" : `1px solid ${WHITE.border}`,
                transform: `translateX(${rowX}px)`,
                opacity: rowOpacity,
              }}
            >
              <div style={{ padding: "14px 24px" }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: WHITE.text,
                    fontFamily: font,
                  }}
                >
                  {row.attribute}
                </span>
              </div>
              <div
                style={{
                  padding: "14px 24px",
                  borderLeft: `1px solid ${WHITE.border}`,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: WHITE.muted,
                    fontFamily: font,
                  }}
                >
                  {row.traditional}
                </span>
              </div>
              <div
                style={{
                  padding: "14px 24px",
                  borderLeft: `1px solid ${WHITE.border}`,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: WHITE.up,
                    fontFamily: font,
                  }}
                >
                  {row.gm}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════════════
   PANEL 5: Platform Overview (264.88s, hold 4s)
   ═══════════════════════════════════════════════════════════════ */

const OVERVIEW_STATS = [
  { label: "Sources", value: "47" },
  { label: "Markets", value: "512,000+" },
  { label: "Categories", value: "14" },
  { label: "Status", value: "Live", color: WHITE.up },
];

const PlatformOverview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale, opacity } = useCardEntrance("center");
  const fadeOut = useFadeOut(4);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          background: WHITE.bg,
          borderRadius: 12,
          boxShadow: WHITE.shadow,
          border: `1px solid ${WHITE.border}`,
          width: 620,
          transform: `scale(${scale})`,
          opacity: Math.min(opacity, fadeOut),
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Logo header */}
        <div
          style={{
            padding: "28px 32px 20px",
            borderBottom: `1px solid ${WHITE.border}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {/* GM logo mark */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: WHITE.text,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                color: WHITE.bg,
                fontSize: 16,
                fontWeight: 900,
                fontFamily: font,
                letterSpacing: "-0.05em",
              }}
            >
              GM
            </span>
          </div>
          <span
            style={{
              fontSize: 20,
              fontWeight: 900,
              color: WHITE.text,
              fontFamily: font,
              letterSpacing: "-0.025em",
            }}
          >
            GENERAL MARKET
          </span>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            borderBottom: `1px solid ${WHITE.border}`,
          }}
        >
          {OVERVIEW_STATS.map((stat, i) => {
            const stagger = i * 4;
            const statSpring = spring({
              frame: frame - stagger,
              fps,
              config: { damping: 20, stiffness: 160, mass: 0.5 },
              durationInFrames: 15,
            });

            const statY = interpolate(statSpring, [0, 1], [12, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            const statOpacity = interpolate(
              frame - stagger,
              [0, 10],
              [0, 1],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }
            );

            return (
              <div
                key={stat.label}
                style={{
                  padding: "20px 24px",
                  borderRight:
                    i < OVERVIEW_STATS.length - 1
                      ? `1px solid ${WHITE.border}`
                      : "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  transform: `translateY(${statY}px)`,
                  opacity: statOpacity,
                }}
              >
                <MicroLabel>{stat.label}</MicroLabel>
                <MonoValue
                  size={stat.value.length > 6 ? 20 : 28}
                  color={stat.color ?? WHITE.text}
                  weight={stat.color ? 700 : 900}
                >
                  {stat.value}
                </MonoValue>
              </div>
            );
          })}
        </div>

        {/* Footer URL */}
        <div
          style={{
            padding: "16px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: WHITE.brand,
              fontFamily: font,
              letterSpacing: "0.02em",
            }}
          >
            generalmarket.io
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════════════
   PANEL CONFIGS
   ═══════════════════════════════════════════════════════════════ */

interface PanelConfig {
  startSec: number;
  holdSec: number;
  Component: React.FC;
}

const PANELS: PanelConfig[] = [
  { startSec: 48.64, holdSec: 3, Component: CategoryPills },
  { startSec: 89.84, holdSec: 3, Component: MetricsDashboard },
  { startSec: 113.76, holdSec: 4, Component: SettlementFlow },
  { startSec: 166.2, holdSec: 3, Component: PrivacyComparison },
  { startSec: 264.88, holdSec: 4, Component: PlatformOverview },
];

/* ─── Full-Duration Overlay ─── */

export const WhiteModeOverlays: React.FC = () => {
  return (
    <AbsoluteFill>
      {PANELS.map((panel) => {
        const startFrame = toFrames(panel.startSec);
        const durationFrames = toFrames(panel.holdSec);
        const { Component } = panel;

        return (
          <React.Fragment key={panel.startSec}>
            <Sequence from={startFrame} durationInFrames={durationFrames}>
              <Component />
            </Sequence>

            {/* SFX: cursor-click-soft on panel appearance */}
            <Sequence from={startFrame} durationInFrames={30}>
              <Audio
                src={staticFile("sfx/cursor-click-soft.mp3")}
                volume={0.35}
              />
            </Sequence>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
