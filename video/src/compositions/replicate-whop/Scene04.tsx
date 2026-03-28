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
const BG = "#f5f5f7";
const CARD_BG = "#FFFFFF";
const TEXT_PRIMARY = "#111111";
const TEXT_SECONDARY = "#6B7280";
const BORDER = "#E5E7EB";
const TETHER_GREEN = "#26A17B";
const AAVE_PURPLE = "#7C3AED";

/* ─── data: 30 bars, year 1..30 ─── */
const BAR_COUNT = 30;
const DEPOSIT_PER_YEAR = 36800;
const FINAL_TOTAL = 1224907;
const FINAL_DEPOSIT = BAR_COUNT * DEPOSIT_PER_YEAR; // 1,104,000
const FINAL_INTEREST = FINAL_TOTAL - FINAL_DEPOSIT; // 120,907

function generateBarData() {
  const bars: { year: number; deposit: number; interest: number }[] = [];
  for (let i = 1; i <= BAR_COUNT; i++) {
    const deposit = DEPOSIT_PER_YEAR * i;
    // Scale interest so it reaches FINAL_INTEREST at year 30
    // Use quadratic growth to match visual curve
    const t = i / BAR_COUNT;
    const interest = FINAL_INTEREST * t * t;
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

  const cardOpacity = interpolate(frame, [0, fps * 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });
  const cardY = interpolate(frame, [0, fps * 0.5], [60, 0], {
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

  const row1Op = interpolate(frame, [fps * 0.8, fps * 1.2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const row2Op = interpolate(frame, [fps * 1.0, fps * 1.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const row3Op = interpolate(frame, [fps * 1.2, fps * 1.6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const row4Op = interpolate(frame, [fps * 1.4, fps * 1.8], [0, 1], {
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
          width: 2800,
          backgroundColor: CARD_BG,
          borderRadius: 48,
          padding: "100px 120px",
          boxShadow: "0 8px 60px rgba(0,0,0,0.06)",
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

  // 150 frames total for this segment
  const segDur = 150;
  const zoomStart = segDur - fps * 1.2; // zoom in during last 1.2s

  const entryScale = spring({
    fps,
    frame,
    from: 0.92,
    to: 1,
    config: { damping: 20 },
  });
  // Zoom into bar area at end
  const zoomScale = interpolate(
    frame,
    [zoomStart, segDur],
    [1, 1.6],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const zoomY = interpolate(
    frame,
    [zoomStart, segDur],
    [0, -300],
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

  const counterVal = interpolate(
    frame,
    [fps * 0.4, fps * 5],
    [0, 1224907],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const interestVal = interpolate(
    frame,
    [fps * 1.5, fps * 4.5],
    [0, FINAL_INTEREST],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const annotationOp = interpolate(frame, [fps * 2.5, fps * 3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Chart area — fill the card generously
  const CARD_W = 3200;
  const CARD_H = 1800;
  const PAD_X = 140;
  const PAD_TOP = 420; // space for badge + number + legend
  const PAD_BOTTOM = 100; // space for x-axis labels
  const chartWidth = CARD_W - PAD_X * 2;
  const chartHeight = CARD_H - PAD_TOP - PAD_BOTTOM;
  const barGap = 10;
  const barWidth = (chartWidth - barGap * (BAR_COUNT - 1)) / BAR_COUNT;

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
          transform: `scale(${cardScale}) translateY(${zoomY}px)`,
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

            const delayFrames = fps * 0.4 + i * 1.2;
            const growProgress = spring({
              fps,
              frame: frame - delayFrames,
              config: { damping: 18, stiffness: 80, mass: 0.8 },
            });

            const currentDepositH = depositH * growProgress;
            const currentInterestH = interestH * growProgress;
            const x = i * (barWidth + barGap);

            return (
              <g key={i}>
                <rect
                  x={x}
                  y={chartHeight - currentDepositH}
                  width={barWidth}
                  height={Math.max(0, currentDepositH)}
                  fill={BLUE}
                  rx={barWidth > 20 ? 6 : 3}
                />
                <rect
                  x={x}
                  y={chartHeight - currentDepositH - currentInterestH}
                  width={barWidth}
                  height={Math.max(0, currentInterestH)}
                  fill={GREEN}
                  rx={barWidth > 20 ? 6 : 3}
                />
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

  // Word-by-word reveal
  const words = ["Instantly", "deposit", "cash", "or", "crypto"];
  const wordProgress = interpolate(
    frame,
    [0, fps * 1.0],
    [0, words.length],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const modalY = spring({
    fps,
    frame: frame - fps * 0.4,
    from: 100,
    to: 0,
    config: { damping: 16, stiffness: 100 },
  });
  const modalOp = interpolate(frame, [fps * 0.3, fps * 0.7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Cursor moves between deposit options
  const cursorX = interpolate(
    frame,
    [fps * 1.0, fps * 1.5, fps * 2.0, fps * 2.5],
    [2200, 2200, 2180, 2180],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const cursorY = interpolate(
    frame,
    [fps * 1.0, fps * 1.5, fps * 2.0, fps * 2.5],
    [960, 1090, 1220, 1350],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const cursorOp = interpolate(frame, [fps * 0.8, fps * 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: FONT }}>
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 440,
          width: "100%",
          textAlign: "center",
          fontSize: 140,
          fontWeight: 700,
          letterSpacing: -3,
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

      {/* Deposit modal */}
      <div
        style={{
          position: "absolute",
          top: 830,
          left: "50%",
          transform: `translateX(-50%) translateY(${modalY}px)`,
          width: 1400,
          backgroundColor: CARD_BG,
          borderRadius: 36,
          padding: "56px 64px",
          boxShadow: "0 20px 80px rgba(0,0,0,0.08)",
          opacity: modalOp,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 48,
            fontSize: 48,
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
            [fps * 0.5 + i * fps * 0.15, fps * 0.8 + i * fps * 0.15],
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
                padding: "36px 40px",
                borderRadius: 24,
                border: `2px solid ${BORDER}`,
                marginBottom: i < 2 ? 24 : 0,
                opacity: rowOp,
                fontSize: 42,
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: 28 }}
              >
                {/* Icon */}
                <div style={{ width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#F3F4F6", borderRadius: 18, flexShrink: 0 }}>
                  {opt.iconType === "card" && (
                    <div style={{ display: "flex", gap: 4 }}>
                      {/* Mini card brand logos */}
                      <div style={{ width: 28, height: 18, borderRadius: 3, backgroundColor: "#1A1F71", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ color: "#fff", fontSize: 10, fontWeight: 800 }}>V</span>
                      </div>
                      <div style={{ width: 28, height: 18, borderRadius: 3, background: "linear-gradient(135deg, #EB001B 50%, #F79E1B 50%)" }} />
                    </div>
                  )}
                  {opt.iconType === "crypto" && (
                    <div style={{ display: "flex", gap: 4 }}>
                      {["#F7931A", "#627EEA", "#26A17B", "#E8391C"].map((c, ci) => (
                        <div key={ci} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c }} />
                      ))}
                    </div>
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
                  <div style={{ fontWeight: 600, color: TEXT_PRIMARY }}>
                    {opt.label}
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
const COIN_COUNT = 18;
const coinSeeds = Array.from({ length: COIN_COUNT }, (_, i) => ({
  x: ((i * 211 + 47) % 3400) + 200, // spread across 4K with margin
  delay: ((i * 23) % 6) * 0.06, // staggered start
  speed: 2200 + ((i * 131) % 1200), // fall speed
  size: 250 + ((i * 97) % 350), // coin size 250-600 (much bigger)
  rotSpeed: 120 + ((i * 67) % 200), // slower rotation for 3D effect
  rotStart: ((i * 73) % 360), // random start rotation
}));

const CoinRainTransition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps; // seconds

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* "Instantly deposit cash or crypto" text behind the coins, fading out */}
      <div
        style={{
          position: "absolute",
          top: 440,
          width: "100%",
          textAlign: "center",
          fontSize: 140,
          fontWeight: 700,
          letterSpacing: -3,
          fontFamily: FONT,
          opacity: interpolate(frame, [0, fps * 0.3], [1, 0.4], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        <span style={{ color: TEXT_PRIMARY }}>Instantly </span>
        <span style={{ color: TEXT_PRIMARY }}>deposit </span>
        <span style={{ color: WHOP_RED }}>cash </span>
        <span style={{ color: TEXT_PRIMARY }}>or </span>
        <span style={{ color: WHOP_RED }}>crypto</span>
      </div>

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
              transform: `rotateY(${rotation}deg) rotateX(15deg)`,
              transformStyle: "preserve-3d",
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
                  <stop offset="50%" stopColor={WHOP_RED} />
                  <stop offset="100%" stopColor="#B82D15" />
                </radialGradient>
              </defs>
              <circle
                cx="50"
                cy="50"
                r="46"
                fill={`url(#coinGrad${i})`}
                stroke="#B82D15"
                strokeWidth="2"
              />
              {/* Glossy highlight band — diagonal white stripe */}
              <ellipse
                cx="42"
                cy="40"
                rx="28"
                ry="10"
                fill="rgba(255,255,255,0.30)"
                transform="rotate(-35 42 40)"
              />
              <ellipse
                cx="38"
                cy="36"
                rx="16"
                ry="5"
                fill="rgba(255,255,255,0.20)"
                transform="rotate(-35 38 36)"
              />
              {/* W mark — two swoosh strokes */}
              <path
                d="M28 48 C32 50, 38 56, 42 57 C46 58, 54 50, 68 40"
                stroke="#fff"
                strokeWidth="4.5"
                strokeLinecap="round"
                fill="none"
                opacity={0.85}
              />
              <path
                d="M24 60 C28 56, 32 56, 36 58 C42 62, 48 68, 52 69 C56 70, 62 64, 72 54"
                stroke="#fff"
                strokeWidth="4.5"
                strokeLinecap="round"
                fill="none"
                opacity={0.7}
              />
              {/* Rim highlight */}
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="2"
              />
            </svg>
          </div>
        );
      })}
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
      {/* Whop Logo — W swoosh + text */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 60,
          opacity: logoOp,
          transform: `scale(${logoScale})`,
          marginBottom: 200,
        }}
      >
        {/* Whop W mark — two bold swoosh strokes */}
        <svg width="380" height="280" viewBox="0 0 200 140" fill="none">
          {/* Top swoosh — thick stroke, check shape: down then up-right */}
          <path
            d="M42 50 Q56 66, 66 70 Q78 74, 100 54 Q120 36, 155 16"
            stroke={WHOP_RED}
            strokeWidth="22"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Bottom swoosh — thick stroke, left tail curls then up-right */}
          <path
            d="M12 86 Q20 78, 30 80 Q44 84, 62 104 Q74 116, 84 118 Q96 118, 116 98 Q136 78, 164 54"
            stroke={WHOP_RED}
            strokeWidth="22"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        <span
          style={{
            fontSize: 260,
            fontWeight: 800,
            color: WHOP_RED,
            letterSpacing: -6,
          }}
        >
          Whop
        </span>
      </div>

      {/* Partner logos */}
      <div style={{ display: "flex", gap: 240, alignItems: "center" }}>
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
                  <circle
                    cx="48"
                    cy="48"
                    r="42"
                    stroke={p.color}
                    strokeWidth="3"
                    fill="none"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="28"
                    stroke={p.color}
                    strokeWidth="3"
                    fill="none"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="14"
                    stroke={p.color}
                    strokeWidth="3"
                    fill="none"
                  />
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
                  <circle
                    cx="48"
                    cy="48"
                    r="42"
                    stroke={AAVE_PURPLE}
                    strokeWidth="3"
                    fill="none"
                  />
                  {/* Aave ghost: arch with small peak at top */}
                  <path
                    d="M30 66 C30 40 38 26 48 20 C58 26 66 40 66 66"
                    stroke={AAVE_PURPLE}
                    strokeWidth="5"
                    fill="none"
                    strokeLinecap="round"
                  />
                  {/* Small dot at peak */}
                  <circle cx="48" cy="18" r="3" fill={AAVE_PURPLE} />
                </svg>
              )}
              <span
                style={{
                  fontSize: 84,
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
      <Sequence from={0} durationInFrames={125} name="Dashboard">
        <DashboardSegment />
      </Sequence>
      <Sequence from={125} durationInFrames={150} name="GrowthChart">
        <GrowthChartSegment />
      </Sequence>
      <Sequence from={275} durationInFrames={60} name="DepositMethods">
        <DepositSegment />
      </Sequence>
      <Sequence from={310} durationInFrames={45} name="CoinRain">
        <CoinRainTransition />
      </Sequence>
      <Sequence from={355} durationInFrames={88} name="LogoReveal">
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
