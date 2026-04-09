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

// ---------------------------------------------------------------------------
// Timing — local seconds (component starts at 0, video time 89.84s)
// ---------------------------------------------------------------------------

const sec = (s: number) => Math.round(s * FPS);

// Sub-animation start/end in local seconds
const Q_CARD_IN = sec(0);
const Q_CARD_OUT = sec(5.5);

const TIMELINE_IN = sec(6.56);
const TIMELINE_PHASE1_END = sec(14);
const TIMELINE_PHASE2_END = sec(23);
const TIMELINE_PHASE3_END = sec(30.52);

const NO_PRICE_IN = sec(36.36);
const NO_PRICE_OUT = sec(41);

const FEES_IN = sec(41.64);
const FEES_OUT = sec(45.64);

const PARI_IN = sec(45.88);
const PARI_MID = sec(53);
const PARI_REPEAT = sec(57);
const PARI_OUT = sec(60.6);

const BARS_IN = sec(62.04);
const BARS_LABEL_IN = sec(65);
const BARS_OUT = sec(69.88);

const CAPITAL_IN = sec(69.88);
const CAPITAL_OUT = sec(73.88); // hold 4s from spec end

// Colors
const GREEN = BRAND_GREEN;
const RED = "#ef4444";
const ORACLE_BLUE = "#6366f1";
const DIM = "rgba(255,255,255,0.45)";
const BRIGHT = "#fafafa";

// ---------------------------------------------------------------------------
// Shared enter/exit helpers
// ---------------------------------------------------------------------------

function fadeEnterExit(
  frame: number,
  enterStart: number,
  exitEnd: number,
  fadeFrames = 10,
) {
  const enterOp = interpolate(frame, [enterStart, enterStart + fadeFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitOp = interpolate(frame, [exitEnd - fadeFrames, exitEnd], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return Math.min(enterOp, exitOp);
}

function slideInY(frame: number, start: number, fps: number, from = 30) {
  const s = spring({
    frame: Math.max(frame - start, 0),
    fps,
    config: { damping: 16, stiffness: 120, mass: 0.7 },
  });
  return interpolate(s, [0, 1], [from, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

// ---------------------------------------------------------------------------
// 1. Question Card
// ---------------------------------------------------------------------------

const QCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = fadeEnterExit(frame, Q_CARD_IN, Q_CARD_OUT, 12);
  const y = slideInY(frame, Q_CARD_IN, fps, 40);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 100,
        opacity,
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
            fontSize: 44,
            fontWeight: 700,
            color: BRIGHT,
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          How does pricing work with{" "}
          <span style={{ color: GREEN }}>10-minute settlements</span>?
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 2. Timeline — 3-phase horizontal progress bar
// ---------------------------------------------------------------------------

const PHASES = [
  { label: "BETTING", sub: "Bets flow in", color: GREEN, end: TIMELINE_PHASE1_END },
  { label: "SETTLEMENT", sub: "3 Oracles reach consensus", color: ORACLE_BLUE, end: TIMELINE_PHASE2_END },
  { label: "RESULTS", sub: "PNL distributed", color: BRIGHT, end: TIMELINE_PHASE3_END },
] as const;

const TimelineBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalDuration = TIMELINE_PHASE3_END - TIMELINE_IN;
  const localFrame = frame - TIMELINE_IN;
  const progress = interpolate(localFrame, [0, totalDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.smooth,
  });

  const containerOpacity = fadeEnterExit(frame, TIMELINE_IN, TIMELINE_PHASE3_END + sec(1), 15);
  const containerY = slideInY(frame, TIMELINE_IN, fps, 30);

  // Determine current phase
  const phase1End = (TIMELINE_PHASE1_END - TIMELINE_IN) / totalDuration;
  const phase2End = (TIMELINE_PHASE2_END - TIMELINE_IN) / totalDuration;

  const currentPhaseIdx =
    progress < phase1End ? 0 : progress < phase2End ? 1 : 2;

  // Bar dimensions
  const barWidth = 1200;
  const barHeight = 20;
  const filledWidth = progress * barWidth;

  // Bar color by phase
  const barColor =
    currentPhaseIdx === 0 ? GREEN : currentPhaseIdx === 1 ? ORACLE_BLUE : BRIGHT;

  // Oracle nodes visibility (phase 2+)
  const oracleOpacity = interpolate(
    localFrame,
    [TIMELINE_PHASE1_END - TIMELINE_IN, TIMELINE_PHASE1_END - TIMELINE_IN + 15],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Checkmark visibility (phase 3)
  const checkOpacity = interpolate(
    localFrame,
    [TIMELINE_PHASE2_END - TIMELINE_IN, TIMELINE_PHASE2_END - TIMELINE_IN + 10],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Bet arrows (phase 1) — 5 arrows dropping in from top
  const betArrowProgress = interpolate(
    localFrame,
    [0, TIMELINE_PHASE1_END - TIMELINE_IN],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: containerOpacity,
        transform: `translateY(${containerY}px)`,
      }}
    >
      <div
        style={{
          ...PANEL,
          padding: "60px 80px 80px",
          width: barWidth + 160,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        {/* Phase label */}
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 28,
            fontWeight: 700,
            color: PHASES[currentPhaseIdx].color,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          {PHASES[currentPhaseIdx].label}
        </div>

        {/* Sub-label */}
        <div
          style={{
            fontFamily: font,
            fontSize: 22,
            fontWeight: 500,
            color: DIM,
            marginBottom: 12,
          }}
        >
          {PHASES[currentPhaseIdx].sub}
        </div>

        {/* Bet arrows above bar (phase 1) */}
        <div
          style={{
            position: "relative",
            width: barWidth,
            height: 40,
            overflow: "hidden",
          }}
        >
          {currentPhaseIdx === 0 &&
            Array.from({ length: 5 }).map((_, i) => {
              const delay = i * 0.15;
              const arrowProg = interpolate(
                betArrowProgress,
                [delay, delay + 0.3],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );
              const arrowY = interpolate(arrowProg, [0, 1], [-30, 8], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: EASE.out,
              });
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: 80 + i * 220,
                    top: arrowY,
                    opacity: arrowProg,
                    fontSize: 28,
                    color: GREEN,
                    transform: "rotate(90deg)",
                  }}
                >
                  {"\u279C"}
                </div>
              );
            })}
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: barWidth,
            height: barHeight,
            borderRadius: barHeight / 2,
            background: "rgba(255,255,255,0.08)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              width: filledWidth,
              height: "100%",
              borderRadius: barHeight / 2,
              background: barColor,
            }}
          />
          {/* Phase dividers */}
          <div
            style={{
              position: "absolute",
              left: `${phase1End * 100}%`,
              top: 0,
              width: 2,
              height: "100%",
              background: "rgba(255,255,255,0.2)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `${phase2End * 100}%`,
              top: 0,
              width: 2,
              height: "100%",
              background: "rgba(255,255,255,0.2)",
            }}
          />
        </div>

        {/* Phase labels below bar */}
        <div
          style={{
            width: barWidth,
            display: "flex",
            justifyContent: "space-between",
            fontFamily: monoFont,
            fontSize: 14,
            color: DIM,
            letterSpacing: 2,
            marginTop: 4,
          }}
        >
          <span>0:00</span>
          <span>10:00</span>
        </div>

        {/* Oracle nodes (phase 2) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            opacity: oracleOpacity,
            marginTop: 16,
          }}
        >
          {[1, 2, 3].map((n) => (
            <React.Fragment key={n}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: ORACLE_BLUE,
                  border: "2px solid rgba(255,255,255,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: monoFont,
                  fontSize: 14,
                  fontWeight: 700,
                  color: BRIGHT,
                  flexShrink: 0,
                }}
              >
                {n}
              </div>
              {n < 3 && (
                <div
                  style={{
                    width: 40,
                    height: 2,
                    background: "rgba(99,102,241,0.5)",
                    flexShrink: 0,
                  }}
                />
              )}
            </React.Fragment>
          ))}
          <div
            style={{
              fontFamily: font,
              fontSize: 16,
              color: DIM,
              marginLeft: 16,
            }}
          >
            Oracle Consensus
          </div>
        </div>

        {/* Checkmark (phase 3) */}
        <div
          style={{
            opacity: checkOpacity,
            fontSize: 48,
            color: GREEN,
            marginTop: 8,
          }}
        >
          {"\u2713"}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 3. "No price" reveal
// ---------------------------------------------------------------------------

const NoPriceReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = fadeEnterExit(frame, NO_PRICE_IN, NO_PRICE_OUT, 12);
  const scale = spring({
    frame: Math.max(frame - NO_PRICE_IN, 0),
    fps,
    config: { damping: 12, stiffness: 100, mass: 0.8 },
  });
  const scaleVal = interpolate(scale, [0, 1], [0.85, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div
        style={{
          ...PANEL,
          padding: "56px 80px",
          maxWidth: 1200,
          transform: `scale(${scaleVal})`,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 52,
            fontWeight: 800,
            color: BRIGHT,
            textAlign: "center",
            lineHeight: 1.4,
            letterSpacing: -1,
          }}
        >
          No orderbook. No price.
          <br />
          <span style={{ color: GREEN }}>Result at settlement.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 4. INSERT: Fees card
// ---------------------------------------------------------------------------

const FeesCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = fadeEnterExit(frame, FEES_IN, FEES_OUT, 10);
  const shimmerX = interpolate(frame - FEES_IN, [0, 30], [-200, 1400], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.smooth,
  });

  const y = slideInY(frame, FEES_IN, fps, 24);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          ...PANEL,
          padding: "40px 64px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Shimmer highlight */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: shimmerX,
            width: 120,
            height: "100%",
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 42,
            fontWeight: 700,
            color: GREEN,
            textAlign: "center",
            letterSpacing: 1,
          }}
        >
          $0 spread. $0 fees. $0 slippage.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 5. Parimutuel diagram
// ---------------------------------------------------------------------------

const PariDiagram: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - PARI_IN;

  const containerOpacity = fadeEnterExit(frame, PARI_IN, PARI_OUT, 12);
  const containerY = slideInY(frame, PARI_IN, fps, 30);

  // Pool entry animation
  const poolScale = spring({
    frame: Math.max(localFrame, 0),
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.7 },
  });

  // Arrow from losing to winning pool
  const arrowProgress = interpolate(
    localFrame,
    [sec(3), sec(5)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out },
  );

  // "Winners take losers' collateral" label
  const labelOpacity = interpolate(
    localFrame,
    [sec(4.5), sec(5.5)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // "x30 markets" label
  const repeatLabelOpacity = interpolate(
    localFrame,
    [PARI_MID - PARI_IN, PARI_MID - PARI_IN + sec(0.5)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Fast repeat animation (x30 markets)
  const repeatPhase = Math.max(localFrame - (PARI_REPEAT - PARI_IN), 0);
  const repeatCycle = repeatPhase > 0 ? (repeatPhase % 6) / 6 : 0;
  const repeatFlicker = repeatPhase > 0 ? 0.7 + 0.3 * Math.sin(repeatCycle * Math.PI * 2) : 1;

  // "= Your final PNL" line
  const pnlOpacity = interpolate(
    localFrame,
    [PARI_REPEAT - PARI_IN + sec(2), PARI_REPEAT - PARI_IN + sec(3)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const poolW = 240;
  const poolH = 160;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: containerOpacity,
        transform: `translateY(${containerY}px)`,
      }}
    >
      <div
        style={{
          ...PANEL,
          padding: "48px 80px 56px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        {/* Pool containers */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 80,
            transform: `scale(${interpolate(poolScale, [0, 1], [0.8, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })})`,
            opacity: repeatFlicker,
          }}
        >
          {/* YES Pool */}
          <div
            style={{
              width: poolW,
              height: poolH,
              borderRadius: 12,
              background: "rgba(0,200,83,0.15)",
              border: `2px solid ${GREEN}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 24,
                fontWeight: 700,
                color: GREEN,
              }}
            >
              YES Pool
            </div>
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 18,
                color: DIM,
              }}
            >
              $500
            </div>
          </div>

          {/* Arrow */}
          <div style={{ position: "relative", width: 80, height: 40 }}>
            <div
              style={{
                position: "absolute",
                top: 18,
                left: 0,
                width: interpolate(arrowProgress, [0, 1], [0, 80], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                height: 4,
                background: RED,
                borderRadius: 2,
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 10,
                right: 0,
                opacity: arrowProgress > 0.8 ? 1 : 0,
                fontSize: 24,
                color: RED,
              }}
            >
              {"\u25B6"}
            </div>
          </div>

          {/* NO Pool */}
          <div
            style={{
              width: poolW,
              height: poolH,
              borderRadius: 12,
              background: "rgba(239,68,68,0.12)",
              border: `2px solid ${RED}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 24,
                fontWeight: 700,
                color: RED,
              }}
            >
              NO Pool
            </div>
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 18,
                color: DIM,
              }}
            >
              $500
            </div>
          </div>
        </div>

        {/* "Winners take losers' collateral" */}
        <div
          style={{
            fontFamily: font,
            fontSize: 24,
            fontWeight: 600,
            color: BRIGHT,
            opacity: labelOpacity,
            textAlign: "center",
          }}
        >
          Winners take losers&apos; collateral
        </div>

        {/* "x30 markets" label */}
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 20,
            fontWeight: 700,
            color: GREEN,
            opacity: repeatLabelOpacity,
            letterSpacing: 3,
          }}
        >
          x30 MARKETS
        </div>

        {/* "= Your final PNL" */}
        <div
          style={{
            fontFamily: font,
            fontSize: 28,
            fontWeight: 700,
            color: BRIGHT,
            opacity: pnlOpacity,
            borderTop: "2px solid rgba(255,255,255,0.15)",
            paddingTop: 16,
            width: "100%",
            textAlign: "center",
          }}
        >
          = Your final PNL
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 6. $1 vs $1M bars
// ---------------------------------------------------------------------------

const RiskCapBars: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - BARS_IN;

  const containerOpacity = fadeEnterExit(frame, BARS_IN, BARS_OUT, 12);
  const containerY = slideInY(frame, BARS_IN, fps, 30);

  // Bar grow animation
  const barGrow = spring({
    frame: Math.max(localFrame, 0),
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.8 },
  });

  // Small bar width: 40px, large bar: 800px (proportional to $1M)
  const smallBarW = interpolate(barGrow, [0, 1], [0, 40], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const largeBarW = interpolate(barGrow, [0, 1], [0, 800], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Label animation
  const labelFrame = frame - BARS_LABEL_IN;
  const labelOpacity = interpolate(labelFrame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const labelScale = spring({
    frame: Math.max(labelFrame, 0),
    fps,
    config: { damping: 12, stiffness: 140, mass: 0.6 },
  });

  const barH = 40;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: containerOpacity,
        transform: `translateY(${containerY}px)`,
      }}
    >
      <div
        style={{
          ...PANEL,
          padding: "48px 80px 56px",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 24,
          width: 1100,
        }}
      >
        {/* $1 bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 22,
              fontWeight: 700,
              color: GREEN,
              width: 60,
              textAlign: "right",
            }}
          >
            $1
          </div>
          <div
            style={{
              width: smallBarW,
              height: barH,
              borderRadius: 6,
              background: GREEN,
            }}
          />
        </div>

        {/* $1M bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 22,
              fontWeight: 700,
              color: RED,
              width: 60,
              textAlign: "right",
            }}
          >
            $1M
          </div>
          <div
            style={{
              width: largeBarW,
              height: barH,
              borderRadius: 6,
              background: RED,
            }}
          />
        </div>

        {/* Arrow + label */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 12,
            opacity: labelOpacity,
            transform: `scale(${interpolate(labelScale, [0, 1], [0.9, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })})`,
          }}
        >
          <div style={{ fontSize: 28, color: GREEN }}>{"\u2192"}</div>
          <div
            style={{
              fontFamily: font,
              fontSize: 28,
              fontWeight: 700,
              color: BRIGHT,
            }}
          >
            Max loss = <span style={{ color: GREEN }}>$1</span>
          </div>
        </div>

        {/* Risk cap label */}
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 18,
            fontWeight: 500,
            color: DIM,
            opacity: labelOpacity,
            letterSpacing: 3,
            marginTop: 4,
          }}
        >
          BUILT-IN RISK CAP
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 7. INSERT: Capital lock + Withdrawals card
// ---------------------------------------------------------------------------

const CapitalLockCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = fadeEnterExit(frame, CAPITAL_IN, CAPITAL_OUT, 10);
  const y = slideInY(frame, CAPITAL_IN, fps, 24);

  const shimmerX = interpolate(frame - CAPITAL_IN, [0, 30], [-200, 1400], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.smooth,
  });

  // Stagger line 2
  const line2Opacity = interpolate(
    frame - CAPITAL_IN,
    [sec(0.8), sec(1.4)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          ...PANEL,
          padding: "40px 64px",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          alignItems: "center",
        }}
      >
        {/* Shimmer */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: shimmerX,
            width: 120,
            height: "100%",
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            fontFamily: font,
            fontSize: 36,
            fontWeight: 700,
            color: BRIGHT,
            textAlign: "center",
          }}
        >
          Capital lock: <span style={{ color: GREEN }}>10 minutes</span>. Not
          days.
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 30,
            fontWeight: 600,
            color: DIM,
            textAlign: "center",
            opacity: line2Opacity,
          }}
        >
          Instant withdrawals after settlement.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Main composition — sequences with SFX
// ---------------------------------------------------------------------------

export const SettlementTimeline: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* 1. Q Card */}
      <Sequence from={Q_CARD_IN} durationInFrames={Q_CARD_OUT - Q_CARD_IN}>
        <QCard />
        <Audio src={staticFile("sfx/whoosh-scene-grid.mp3")} volume={0.6} />
      </Sequence>

      {/* 2. Timeline bar */}
      <Sequence
        from={TIMELINE_IN}
        durationInFrames={TIMELINE_PHASE3_END + sec(1) - TIMELINE_IN}
      >
        <TimelineBar />
        {/* Tick per phase transition */}
        <Audio src={staticFile("sfx/scroll-tick.mp3")} volume={0.45} />
        <Sequence from={TIMELINE_PHASE1_END - TIMELINE_IN}>
          <Audio src={staticFile("sfx/scroll-tick.mp3")} volume={0.45} />
        </Sequence>
        <Sequence from={TIMELINE_PHASE2_END - TIMELINE_IN}>
          <Audio src={staticFile("sfx/scroll-tick.mp3")} volume={0.45} />
        </Sequence>
      </Sequence>

      {/* 3. "No price" reveal */}
      <Sequence from={NO_PRICE_IN} durationInFrames={NO_PRICE_OUT - NO_PRICE_IN}>
        <NoPriceReveal />
        <Audio src={staticFile("sfx/boom-cinematic.mp3")} volume={0.55} />
      </Sequence>

      {/* 4. Fees card */}
      <Sequence from={FEES_IN} durationInFrames={FEES_OUT - FEES_IN}>
        <FeesCard />
        <Audio src={staticFile("sfx/dramatic-reveal.mp3")} volume={0.5} />
      </Sequence>

      {/* 5. Parimutuel diagram */}
      <Sequence from={PARI_IN} durationInFrames={PARI_OUT - PARI_IN}>
        <PariDiagram />
        <Audio src={staticFile("sfx/money-count.mp3")} volume={0.5} />
      </Sequence>

      {/* 6. $1 vs $1M bars */}
      <Sequence from={BARS_IN} durationInFrames={BARS_OUT - BARS_IN}>
        <RiskCapBars />
        <Sequence from={BARS_LABEL_IN - BARS_IN}>
          <Audio src={staticFile("sfx/drop-cinematic-hit.mp3")} volume={0.55} />
        </Sequence>
      </Sequence>

      {/* 7. Capital lock card */}
      <Sequence from={CAPITAL_IN} durationInFrames={CAPITAL_OUT - CAPITAL_IN}>
        <CapitalLockCard />
        <Audio src={staticFile("sfx/logo-shimmer-resolve.mp3")} volume={0.5} />
      </Sequence>
    </AbsoluteFill>
  );
};
