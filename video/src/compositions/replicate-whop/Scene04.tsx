import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from "remotion";

/* ─── colour tokens ─── */
const WHOP_RED = "#E8391C";
const BLUE = "#4472C4";
const BUTTON_BLUE = "#4A7DFF";
const GREEN = "#70AD47";
const CASH_GREEN = "#4ADE80";
const GREEN_BADGE = "#22C55E";
const BG = "#f8f8fa";
const CARD_BG = "#FFFFFF";
const TEXT_PRIMARY = "#111111";
const TEXT_SECONDARY = "#6B7280";
const BORDER = "#E5E7EB";
const TETHER_GREEN = "#26A17B";
const AAVE_PURPLE = "#7C3AED";

/* ─── data: 30 bars, year 1..30 ─── */
const BAR_COUNT = 30;
const DEPOSIT_PER_YEAR = 28262;
const FINAL_TOTAL = 1224907;
const FINAL_DEPOSIT = BAR_COUNT * DEPOSIT_PER_YEAR; // ~847,860
const FINAL_INTEREST = 706347; // matches reference "$706,347 earned in 30 years"

function generateBarData() {
  const bars: { year: number; deposit: number; interest: number }[] = [];
  // 6% APY compound growth — deposit grows linearly, interest exponentially
  // Reference: interest dominates ~60-70% of tallest bars
  const rate = 0.06;
  for (let i = 1; i <= BAR_COUNT; i++) {
    const deposit = DEPOSIT_PER_YEAR * i;
    // Future value of annuity minus pure deposits = compound interest earned
    const fv = DEPOSIT_PER_YEAR * ((Math.pow(1 + rate, i) - 1) / rate);
    const interest = Math.max(0, fv - deposit);
    bars.push({ year: i, deposit, interest });
  }
  return bars;
}
const barData = generateBarData();
const MAX_TOTAL =
  barData[BAR_COUNT - 1].deposit + barData[BAR_COUNT - 1].interest;

function formatDollar(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif';

/* ════════════════════════════════════════════════════════
   SEGMENT A — Dashboard balance bar (frames 0–125)
   ════════════════════════════════════════════════════════ */
const DashboardSegment: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardOpacity = interpolate(frame, [0, fps * 0.2], [0, 1], {
    extrapolateRight: "clamp",
  });
  const cardY = interpolate(frame, [0, fps * 0.25], [40, 0], {
    extrapolateRight: "clamp",
  });

  const treasuryPct = interpolate(
    frame,
    [fps * 0.3, fps * 2.5],
    [0, 0.95],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const cashPct = interpolate(frame, [fps * 0.3, fps * 2.5], [0, 0.05], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const treasuryVal = interpolate(
    frame,
    [fps * 0.3, fps * 3],
    [0, 41269.35],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const cashVal = interpolate(frame, [fps * 0.3, fps * 3], [0, 1470.89], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const usdtVal = interpolate(frame, [fps * 0.3, fps * 3], [0, 39790.92], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const goldVal = 1478.43;
  const usdVal = interpolate(frame, [fps * 0.5, fps * 3], [0, 15468.43], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const row1Op = interpolate(frame, [fps * 0.3, fps * 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const row2Op = interpolate(frame, [fps * 0.4, fps * 0.6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const row3Op = interpolate(frame, [fps * 0.5, fps * 0.7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const row4Op = interpolate(frame, [fps * 0.6, fps * 0.8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const row5Op = interpolate(frame, [fps * 0.7, fps * 0.9], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 3000,
          backgroundColor: CARD_BG,
          borderRadius: 48,
          padding: "80px 110px",
          boxShadow: "0 6px 40px rgba(0,0,0,0.05)",
          opacity: cardOpacity,
          transform: `translateY(${cardY}px)`,
          fontFamily: FONT,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 40,
          }}
        >
          <div>
            <div
              style={{ fontSize: 40, color: TEXT_SECONDARY, marginBottom: 12 }}
            >
              Total balance
            </div>
            <div
              style={{
                fontSize: 96,
                fontWeight: 700,
                color: TEXT_PRIMARY,
                letterSpacing: -2,
              }}
            >
              $42,740.24{" "}
              <span
                style={{
                  fontSize: 64,
                  fontWeight: 400,
                  color: TEXT_SECONDARY,
                }}
              >
                USD
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            {["Deposit", "Withdraw", "Move"].map((label, i) => (
              <div
                key={label}
                style={{
                  padding: "20px 40px",
                  borderRadius: 20,
                  border: `2px solid ${BORDER}`,
                  fontSize: 36,
                  color: i === 0 ? "#fff" : TEXT_PRIMARY,
                  backgroundColor: i === 0 ? BUTTON_BLUE : "transparent",
                  fontWeight: 500,
                }}
              >
                {i === 0 ? "+ " : ""}
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Balance bar */}
        <div
          style={{
            height: 28,
            borderRadius: 14,
            backgroundColor: "#E8EAED",
            overflow: "hidden",
            display: "flex",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: `${treasuryPct * 100}%`,
              height: "100%",
              backgroundColor: BUTTON_BLUE,
              borderRadius: 14,
            }}
          />
          <div
            style={{
              width: `${cashPct * 100}%`,
              height: "100%",
              backgroundColor: CASH_GREEN,
            }}
          />
        </div>

        {/* Legend row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 34,
            marginBottom: 48,
          }}
        >
          <div style={{ display: "flex", gap: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  backgroundColor: BUTTON_BLUE,
                }}
              />
              <span style={{ color: TEXT_SECONDARY }}>Treasury</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  backgroundColor: CASH_GREEN,
                }}
              />
              <span style={{ color: TEXT_SECONDARY }}>Available cash</span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 48,
              color: TEXT_PRIMARY,
              fontWeight: 600,
            }}
          >
            <span>{formatDollar(treasuryVal)}</span>
            <span>{formatDollar(cashVal)}</span>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 48,
            fontSize: 38,
            marginBottom: 48,
            borderBottom: `2px solid ${BORDER}`,
            paddingBottom: 20,
          }}
        >
          {["Balances", "All activity", "Withdrawals", "Top ups"].map(
            (tab, i) => (
              <span
                key={tab}
                style={{
                  color: i === 0 ? TEXT_PRIMARY : TEXT_SECONDARY,
                  fontWeight: i === 0 ? 600 : 400,
                  borderBottom:
                    i === 0 ? `3px solid ${TEXT_PRIMARY}` : "none",
                  paddingBottom: 20,
                }}
              >
                {tab}
              </span>
            )
          )}
        </div>

        {/* Treasury section */}
        <div style={{ opacity: row1Op }}>
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              color: TEXT_PRIMARY,
              marginBottom: 32,
            }}
          >
            Treasury
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: 28,
              marginBottom: 28,
              borderBottom: `1px solid ${BORDER}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: TETHER_GREEN,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 32,
                  fontWeight: 700,
                }}
              >
                ₮
              </div>
              <span
                style={{
                  fontSize: 40,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                }}
              >
                USDT
              </span>
              <span
                style={{
                  fontSize: 28,
                  backgroundColor: GREEN_BADGE,
                  color: "#fff",
                  padding: "4px 16px",
                  borderRadius: 8,
                  fontWeight: 600,
                }}
              >
                6% APY
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                }}
              >
                ₮ {formatDollar(usdtVal).slice(1)}
              </div>
              <span
                style={{
                  fontSize: 32,
                  color: BUTTON_BLUE,
                  fontWeight: 500,
                }}
              >
                Convert
              </span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: 28,
              marginBottom: 40,
              opacity: row2Op,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: "#F59E0B",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 32,
                  fontWeight: 700,
                }}
              >
                Au
              </div>
              <span
                style={{
                  fontSize: 40,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                }}
              >
                Gold
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: 600,
                    color: TEXT_PRIMARY,
                  }}
                >
                  {formatDollar(goldVal)}
                </div>
                <div
                  style={{
                    fontSize: 28,
                    color: TEXT_SECONDARY,
                  }}
                >
                  XAUT 0.21019
                </div>
              </div>
              <span
                style={{
                  fontSize: 32,
                  color: BUTTON_BLUE,
                  fontWeight: 500,
                }}
              >
                Convert
              </span>
            </div>
          </div>
        </div>

        {/* Cash section */}
        <div style={{ opacity: row3Op }}>
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              color: TEXT_PRIMARY,
              marginBottom: 32,
            }}
          >
            Cash
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: 28,
              marginBottom: 28,
              borderBottom: `1px solid ${BORDER}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <div
                style={{
                  width: 64,
                  height: 44,
                  borderRadius: 6,
                  backgroundColor: "#B91C1C",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 26, color: "#fff" }}>🇺🇸</span>
              </div>
              <span
                style={{
                  fontSize: 40,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                }}
              >
                USD
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                }}
              >
                {formatDollar(usdVal)}
              </div>
              <span
                style={{ fontSize: 32, color: BUTTON_BLUE, fontWeight: 500 }}
              >
                Convert
              </span>
            </div>
          </div>
          {/* EUR */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: 28,
              marginBottom: 28,
              borderBottom: `1px solid ${BORDER}`,
              opacity: row4Op,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <div
                style={{
                  width: 64,
                  height: 44,
                  borderRadius: 6,
                  backgroundColor: "#1D4ED8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 26, color: "#fff" }}>🇪🇺</span>
              </div>
              <span
                style={{
                  fontSize: 40,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                }}
              >
                EUR
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: 600,
                    color: TEXT_PRIMARY,
                  }}
                >
                  $847.32
                </div>
                <div style={{ fontSize: 28, color: TEXT_SECONDARY }}>
                  EUR 4,776.44
                </div>
              </div>
              <span
                style={{ fontSize: 32, color: BUTTON_BLUE, fontWeight: 500 }}
              >
                Convert
              </span>
            </div>
          </div>
          {/* GBP */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: 28,
              marginBottom: 28,
              borderBottom: `1px solid ${BORDER}`,
              opacity: row5Op,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <div
                style={{
                  width: 64,
                  height: 44,
                  borderRadius: 6,
                  backgroundColor: "#1D4ED8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 26, color: "#fff" }}>🇬🇧</span>
              </div>
              <span
                style={{
                  fontSize: 40,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                }}
              >
                GBP
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                }}
              >
                $623.57
              </div>
              <span
                style={{ fontSize: 32, color: BUTTON_BLUE, fontWeight: 500 }}
              >
                Convert
              </span>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ════════════════════════════════════════════════════════
   SEGMENT B — Growth chart with bar animation (frames 125–275)
   ════════════════════════════════════════════════════════ */
const GrowthChartSegment: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 90 frames total for this segment
  const segDur = 90;
  const zoomStart = fps * 0.8; // start zooming earlier

  const entryScale = spring({
    fps,
    frame,
    from: 0.92,
    to: 1,
    config: { damping: 20 },
  });
  // Zoom into chart — progressive zoom, matching reference crop at ~1.7x
  const zoomScale = interpolate(
    frame,
    [zoomStart, segDur],
    [1, 1.7],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const zoomY = interpolate(
    frame,
    [zoomStart, segDur],
    [0, -40],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const zoomX = interpolate(
    frame,
    [zoomStart, segDur],
    [0, -200],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const cardScale = entryScale * zoomScale;

  const cardOp = interpolate(frame, [0, fps * 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  const badgeOp = interpolate(frame, [fps * 0.2, fps * 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Counter races ahead of bars — reaches final value by ~1s
  const counterVal = interpolate(
    frame,
    [fps * 0.1, fps * 1.0],
    [0, 1224907],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Interest counter animates alongside bars
  const interestVal = interpolate(
    frame,
    [fps * 0.4, fps * 1.4],
    [0, FINAL_INTEREST],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const annotationOp = interpolate(frame, [fps * 1.0, fps * 1.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Chart area — bars must fill majority of vertical space
  const CARD_W = 3200;
  const CARD_H = 1800;
  const PAD_X = 140;
  const PAD_TOP = 380; // space for badge + number + legend
  const PAD_BOTTOM = 80; // space for x-axis labels
  const chartWidth = CARD_W - PAD_X * 2;
  const chartHeight = CARD_H - PAD_TOP - PAD_BOTTOM;
  const barSlot = chartWidth / BAR_COUNT;
  const barWidth = barSlot * 0.78;
  const barGap = barSlot - barWidth;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          backgroundColor: CARD_BG,
          borderRadius: 48,
          boxShadow: "0 8px 60px rgba(0,0,0,0.06)",
          opacity: cardOp,
          transform: `scale(${cardScale}) translate(${zoomX}px, ${zoomY}px)`,
          position: "relative",
          fontFamily: FONT,
          overflow: "hidden",
        }}
      >
        {/* 6% APY Badge */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 60,
            marginBottom: 16,
            opacity: badgeOp,
          }}
        >
          <div
            style={{
              backgroundColor: GREEN_BADGE,
              color: "#fff",
              fontSize: 40,
              fontWeight: 700,
              padding: "12px 32px",
              borderRadius: 40,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            6% APY ⓘ
          </div>
        </div>

        {/* Big dollar number */}
        <div
          style={{
            textAlign: "center",
            fontSize: 160,
            fontWeight: 700,
            color: TEXT_PRIMARY,
            letterSpacing: -4,
            marginBottom: 32,
          }}
        >
          {formatDollar(counterVal)}
        </div>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            gap: 48,
            fontSize: 42,
            color: TEXT_SECONDARY,
            marginBottom: 24,
            paddingLeft: PAD_X,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                backgroundColor: BLUE,
              }}
            />
            Deposits
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                backgroundColor: GREEN,
              }}
            />
            Interest
          </div>
        </div>

        {/* Grid lines */}
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: PAD_X,
              top: PAD_TOP + chartHeight - (i / 4) * chartHeight,
              width: chartWidth,
              height: 1,
              backgroundColor: "#E5E7EB",
            }}
          />
        ))}

        {/* Annotation: "$118,686 earned in 30 years" */}
        <div
          style={{
            position: "absolute",
            right: PAD_X + 40,
            top: PAD_TOP - 60,
            fontSize: 40,
            opacity: annotationOp,
            display: "flex",
            gap: 10,
          }}
        >
          <span style={{ color: GREEN, fontWeight: 700 }}>
            {formatDollar(interestVal)}
          </span>
          <span style={{ color: TEXT_SECONDARY, fontWeight: 500 }}>
            earned in 30 years
          </span>
        </div>

        {/* SVG Bars */}
        <svg
          style={{
            position: "absolute",
            left: PAD_X,
            top: PAD_TOP,
            width: chartWidth,
            height: chartHeight,
          }}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        >
          {barData.map((bar, i) => {
            const total = bar.deposit + bar.interest;
            const maxH = chartHeight - 10;
            const fullH = (total / MAX_TOTAL) * maxH;
            const depositH = (bar.deposit / MAX_TOTAL) * maxH;
            const interestH = fullH - depositH;

            // Bars grow together after counter starts — subtle left-to-right wave
            const delayFrames = fps * 0.25 + i * 0.25;
            const growProgress = spring({
              fps,
              frame: frame - delayFrames,
              config: { damping: 12, stiffness: 50, mass: 1.2 },
            });

            const currentDepositH = depositH * growProgress;
            const currentInterestH = interestH * growProgress;
            const x = i * (barWidth + barGap);

            return (
              <g key={i}>
                {/* Deposit bar — flat top when interest sits above, rounded when alone */}
                <rect
                  x={x}
                  y={chartHeight - currentDepositH}
                  width={barWidth}
                  height={Math.max(0, currentDepositH)}
                  fill={BLUE}
                  rx={currentInterestH < 1 ? 5 : 0}
                  ry={currentInterestH < 1 ? 5 : 0}
                />
                {/* Interest bar — always rounded top */}
                {currentInterestH > 0.5 && (
                  <rect
                    x={x}
                    y={chartHeight - currentDepositH - currentInterestH}
                    width={barWidth}
                    height={Math.max(0, currentInterestH)}
                    fill={GREEN}
                    rx={5}
                    ry={5}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* X-axis labels */}
        <div
          style={{
            position: "absolute",
            left: PAD_X,
            top: PAD_TOP + chartHeight + 16,
            width: chartWidth,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 34,
            color: TEXT_SECONDARY,
          }}
        >
          {[2, 7, 12, 17, 22, 27, 30].map((y) => (
            <span key={y}>{y}Y</span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ════════════════════════════════════════════════════════
   SEGMENT C — "Instantly deposit cash or crypto" (frames 275–350)
   ════════════════════════════════════════════════════════ */

/* SVG cursor (pointer hand) for a clean look */
const Cursor: React.FC<{ x: number; y: number; opacity: number }> = ({
  x,
  y,
  opacity,
}) => (
  <svg
    style={{
      position: "absolute",
      left: x,
      top: y,
      opacity,
      pointerEvents: "none",
    }}
    width="80"
    height="80"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      d="M5 3L19 12L12 13L15 21L12 22L9 14L5 17V3Z"
      fill="#111"
      stroke="#fff"
      strokeWidth="1"
    />
  </svg>
);

const DepositSegment: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Word-by-word reveal — faster to match reference (all visible by ~0.3s)
  const words = ["Instantly", "deposit", "cash", "or", "crypto"];
  const wordProgress = interpolate(
    frame,
    [0, fps * 0.3],
    [0, words.length],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const modalY = spring({
    fps,
    frame: frame - fps * 0.15,
    from: 100,
    to: 0,
    config: { damping: 16, stiffness: 100 },
  });
  const modalOp = interpolate(frame, [fps * 0.1, fps * 0.35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Cursor moves between deposit options — adjusted for compact modal
  const cursorX = interpolate(
    frame,
    [fps * 1.0, fps * 1.5, fps * 2.0, fps * 2.5],
    [2150, 2150, 2130, 2130],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const cursorY = interpolate(
    frame,
    [fps * 1.0, fps * 1.5, fps * 2.0, fps * 2.5],
    [870, 990, 1100, 1220],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const cursorOp = interpolate(frame, [fps * 0.8, fps * 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: FONT }}>
      {/* Title — smaller, higher, matching reference proportions */}
      <div
        style={{
          position: "absolute",
          top: 340,
          width: "100%",
          textAlign: "center",
          fontSize: 110,
          fontWeight: 700,
          letterSpacing: -2,
        }}
      >
        {words.map((word, wi) => {
          const wordOp = interpolate(
            wordProgress,
            [wi, wi + 0.5],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const isHighlight = word === "cash" || word === "crypto";
          return (
            <span key={wi} style={{ opacity: wordOp }}>
              {wi > 0 ? " " : ""}
              <span style={{ color: isHighlight ? WHOP_RED : TEXT_PRIMARY }}>
                {word}
              </span>
            </span>
          );
        })}
      </div>

      {/* Deposit modal — compact, matching reference proportions */}
      <div
        style={{
          position: "absolute",
          top: 720,
          left: "50%",
          transform: `translateX(-50%) translateY(${modalY}px)`,
          width: 1200,
          backgroundColor: CARD_BG,
          borderRadius: 32,
          padding: "48px 56px",
          boxShadow: "0 16px 60px rgba(0,0,0,0.07)",
          opacity: modalOp,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 36,
            fontSize: 40,
            fontWeight: 600,
            color: TEXT_PRIMARY,
          }}
        >
          <span>Choose deposit method</span>
          <span style={{ color: TEXT_SECONDARY }}>×</span>
        </div>

        {[
          {
            label: "Pay with card",
            sub: "$50,000 limit · 2 min",
            iconType: "card" as const,
          },
          {
            label: "Deposit crypto",
            sub: "No limit · Instant",
            iconType: "crypto" as const,
          },
          {
            label: "Deposit cash balance",
            sub: "No limit · Instant",
            iconType: "bank" as const,
          },
        ].map((opt, i) => {
          const rowOp = interpolate(
            frame,
            [fps * 0.2 + i * fps * 0.08, fps * 0.4 + i * fps * 0.08],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "28px 36px",
                borderRadius: 20,
                border: `2px solid ${BORDER}`,
                marginBottom: i < 2 ? 18 : 0,
                opacity: rowOp,
                fontSize: 36,
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: 28 }}
              >
                {/* Gray icon box */}
                <div style={{ width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#F3F4F6", borderRadius: 18, flexShrink: 0 }}>
                  {opt.iconType === "card" && (
                    <svg width="36" height="28" viewBox="0 0 36 28">
                      <rect width="36" height="28" rx="4" fill="#D1D5DB" />
                      <rect x="0" y="7" width="36" height="5" fill="#9CA3AF" />
                      <rect x="4" y="17" width="14" height="3" rx="1" fill="#B8BCC2" />
                    </svg>
                  )}
                  {opt.iconType === "crypto" && (
                    <svg width="36" height="36" viewBox="0 0 36 36">
                      <circle cx="14" cy="14" r="10" fill="#F7931A" opacity={0.8} />
                      <circle cx="24" cy="14" r="10" fill="#627EEA" opacity={0.8} />
                      <circle cx="18" cy="24" r="10" fill="#26A17B" opacity={0.8} />
                    </svg>
                  )}
                  {opt.iconType === "bank" && (
                    <svg width="36" height="36" viewBox="0 0 36 36">
                      <path d="M18 4L4 14H32L18 4Z" fill="#9CA3AF" />
                      <rect x="7" y="15" width="4" height="12" fill="#9CA3AF" />
                      <rect x="16" y="15" width="4" height="12" fill="#9CA3AF" />
                      <rect x="25" y="15" width="4" height="12" fill="#9CA3AF" />
                      <rect x="3" y="28" width="30" height="4" rx="1" fill="#9CA3AF" />
                    </svg>
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: TEXT_PRIMARY, display: "flex", alignItems: "center", gap: 12 }}>
                    {opt.label}
                    {/* Inline brand icons */}
                    {opt.iconType === "card" && (
                      <div style={{ display: "flex", gap: 4 }}>
                        <div style={{ width: 30, height: 20, borderRadius: 3, backgroundColor: "#1A1F71" }} />
                        <div style={{ width: 30, height: 20, borderRadius: 3, background: "linear-gradient(135deg, #EB001B 50%, #F79E1B 50%)" }} />
                      </div>
                    )}
                    {opt.iconType === "crypto" && (
                      <div style={{ display: "flex", gap: 3 }}>
                        {["#26A17B", "#627EEA", "#F7931A", "#E8391C"].map((c, ci) => (
                          <div key={ci} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 34, color: TEXT_SECONDARY }}>
                    {opt.sub}
                  </div>
                </div>
              </div>
              <span style={{ color: TEXT_SECONDARY, fontSize: 36 }}>›</span>
            </div>
          );
        })}
      </div>

      <Cursor x={cursorX} y={cursorY} opacity={cursorOp} />
    </AbsoluteFill>
  );
};

/* ════════════════════════════════════════════════════════
   TRANSITION — Red Whop coin rain (frames 335–350)
   ════════════════════════════════════════════════════════ */
const COIN_COUNT = 24;
const coinSeeds = Array.from({ length: COIN_COUNT }, (_, i) => {
  const layer = i < 4 ? 0 : i < 13 ? 1 : 2;
  const sizes = [780, 460, 240];
  const sizeVariance = [220, 140, 70];
  const blurLevels = [0, 0, 1.5];
  const shadowLevels = ["0 8px 30px rgba(0,0,0,0.3)", "0 4px 16px rgba(0,0,0,0.18)", "none"];
  // Golden-ratio distribution for even horizontal spread
  const phi = 1.618033988749;
  const xNorm = ((i * phi) % 1);
  return {
    x: Math.floor(xNorm * 3600) + 120,
    delay: ((i * 23) % 16) * 0.035,
    speed: [900, 1300, 1800][layer] + ((i * 131) % 400),
    size: sizes[layer] + ((i * 97) % sizeVariance[layer]),
    rotSpeed: 35 + ((i * 41) % 60),
    rotStart: ((i * 73) % 360),
    rotX: 20 + ((i * 31) % 40),
    blur: blurLevels[layer],
    shadow: shadowLevels[layer],
    layer,
  };
});

/* Sparkles removed — reference has none */

const CoinRainTransition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps; // seconds

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Falling coins */}
      {coinSeeds.map((coin, i) => {
        const elapsed = Math.max(0, t - coin.delay);
        const y = -coin.size + elapsed * coin.speed;
        const rotation = coin.rotStart + elapsed * coin.rotSpeed;
        const opacity = interpolate(
          frame,
          [0, fps * 0.1, fps * 0.5],
          [0, 1, 1],
          { extrapolateRight: "clamp" }
        );
        // Motion blur: faster coins get more vertical blur
        const motionBlur = coin.speed > 2000 ? 1.5 : coin.speed > 1600 ? 0.8 : 0;
        const totalBlur = coin.blur + motionBlur;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: coin.x,
              top: y,
              width: coin.size,
              height: coin.size,
              opacity,
              transform: `rotateY(${rotation}deg) rotateX(${coin.rotX}deg)`,
              transformStyle: "preserve-3d",
              filter: totalBlur > 0 ? `blur(${totalBlur}px)` : undefined,
              boxShadow: coin.shadow !== "none" ? coin.shadow : undefined,
              borderRadius: "50%",
            }}
          >
            <svg
              width={coin.size}
              height={coin.size}
              viewBox="0 0 100 100"
            >
              <defs>
                <radialGradient id={`coinGrad${i}`} cx="40%" cy="35%" r="60%">
                  <stop offset="0%" stopColor="#FF6B4A" />
                  <stop offset="40%" stopColor="#E8391C" />
                  <stop offset="80%" stopColor="#C42E15" />
                  <stop offset="100%" stopColor="#8A1D0C" />
                </radialGradient>
                <clipPath id={`coinClip${i}`}>
                  <circle cx="50" cy="50" r="46" />
                </clipPath>
              </defs>
              {/* Main coin body */}
              <circle cx="50" cy="50" r="46" fill={`url(#coinGrad${i})`} />
              {/* Diagonal stripe — matching reference red/white stripe pattern */}
              <g clipPath={`url(#coinClip${i})`}>
                <rect
                  x="-20" y="30" width="140" height="22"
                  fill="rgba(255,255,255,0.35)"
                  transform="rotate(-35 50 50)"
                />
                <rect
                  x="-20" y="55" width="140" height="14"
                  fill="rgba(255,255,255,0.2)"
                  transform="rotate(-35 50 50)"
                />
              </g>
              {/* Rim */}
              <circle cx="50" cy="50" r="46" fill="none" stroke="#8A1D0A" strokeWidth="2" />
              {/* Specular highlight */}
              <ellipse cx="38" cy="36" rx="16" ry="10" fill="rgba(255,255,255,0.25)" transform="rotate(-20 38 36)" />
            </svg>
          </div>
        );
      })}
      {/* Sparkles removed — reference has none */}
    </AbsoluteFill>
  );
};

/* ════════════════════════════════════════════════════════
   SEGMENT D — Whop logo + partner logos (frames 350–443)
   ════════════════════════════════════════════════════════ */
const LogoRevealSegment: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    fps,
    frame,
    from: 0.5,
    to: 1,
    config: { damping: 12, stiffness: 80 },
  });
  const logoOp = interpolate(frame, [0, fps * 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  const partners = [
    { name: "Plasma", color: "#6B7280" },
    { name: "tether", color: TETHER_GREEN },
    { name: "aave", color: AAVE_PURPLE },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
      }}
    >
      {/* Whop Logo — W swoosh + text — large, matching reference */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 80,
          opacity: logoOp,
          transform: `scale(${logoScale})`,
          marginBottom: 240,
        }}
      >
        {/* Whop W mark — solid filled swooshes matching official logo */}
        <svg width="460" height="340" viewBox="0 0 240 170" fill="none">
          {/* Upper swoosh — thick filled shape */}
          <path
            d="M60 42 C60 42, 68 58, 80 68 C92 78, 108 78, 124 66 C140 54, 156 36, 172 20
               L180 32
               C164 48, 146 64, 128 76 C110 88, 92 88, 78 78 C64 68, 56 52, 52 44 Z"
            fill={WHOP_RED}
          />
          {/* Lower swoosh — wider, deeper filled shape */}
          <path
            d="M18 90 C18 82, 26 76, 36 82 C50 92, 66 112, 84 122 C100 130, 118 124, 136 110 C154 96, 172 72, 188 52
               L196 64
               C180 84, 160 106, 140 120 C120 134, 100 138, 82 130 C64 122, 48 102, 34 90 C26 84, 18 88, 16 94 Z"
            fill={WHOP_RED}
          />
        </svg>
        <span
          style={{
            fontSize: 320,
            fontWeight: 800,
            color: WHOP_RED,
            letterSpacing: -8,
          }}
        >
          Whop
        </span>
      </div>

      {/* Partner logos — larger, matching reference */}
      <div style={{ display: "flex", gap: 300, alignItems: "center" }}>
        {partners.map((p, i) => {
          const pOp = interpolate(
            frame,
            [fps * 0.8 + i * fps * 0.25, fps * 1.2 + i * fps * 0.25],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const pY = spring({
            fps,
            frame: frame - (fps * 0.8 + i * fps * 0.25),
            from: 40,
            to: 0,
            config: { damping: 14 },
          });
          return (
            <div
              key={p.name}
              style={{
                opacity: pOp,
                transform: `translateY(${pY}px)`,
                display: "flex",
                alignItems: "center",
                gap: 24,
              }}
            >
              {/* Partner icon */}
              {p.name === "Plasma" && (
                <svg width="96" height="96" viewBox="0 0 96 96">
                  {/* Starburst/sun pattern — lines radiating from center */}
                  {Array.from({ length: 18 }, (_, j) => {
                    const angle = (j * 20 * Math.PI) / 180;
                    return (
                      <line
                        key={j}
                        x1={48 + Math.cos(angle) * 14}
                        y1={48 + Math.sin(angle) * 14}
                        x2={48 + Math.cos(angle) * 40}
                        y2={48 + Math.sin(angle) * 40}
                        stroke={p.color}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    );
                  })}
                </svg>
              )}
              {p.name === "tether" && (
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    backgroundColor: TETHER_GREEN,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 52,
                    fontWeight: 800,
                  }}
                >
                  ₮
                </div>
              )}
              {p.name === "aave" && (
                <svg width="96" height="96" viewBox="0 0 96 96">
                  {/* Aave arch/rainbow logo */}
                  <path
                    d="M20 62 C20 32 34 16 48 16 C62 16 76 32 76 62"
                    stroke={AAVE_PURPLE}
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <path
                    d="M32 62 C32 42 40 30 48 30 C56 30 64 42 64 62"
                    stroke={AAVE_PURPLE}
                    strokeWidth="5"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              )}
              <span
                style={{
                  fontSize: 100,
                  fontWeight: 600,
                  color: p.color,
                }}
              >
                {p.name}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ════════════════════════════════════════════════════════
   SCENE 04 — Assembled
   ════════════════════════════════════════════════════════ */
export const Scene04: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <Sequence from={0} durationInFrames={105} name="Dashboard">
        <DashboardSegment />
      </Sequence>
      <Sequence from={105} durationInFrames={90} name="GrowthChart">
        <GrowthChartSegment />
      </Sequence>
      <Sequence from={190} durationInFrames={145} name="DepositMethods">
        <DepositSegment />
      </Sequence>
      <Sequence from={270} durationInFrames={60} name="CoinRain">
        <CoinRainTransition />
      </Sequence>
      <Sequence from={325} durationInFrames={118} name="LogoReveal">
        <LogoRevealSegment />
      </Sequence>
    </AbsoluteFill>
  );
};

export const scene04Meta = {
  id: "WhopScene04",
  component: Scene04,
  width: 3840,
  height: 2160,
  fps: 25,
  durationInFrames: 443,
};
