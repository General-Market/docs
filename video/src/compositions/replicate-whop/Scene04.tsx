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
const FINAL_INTEREST = FINAL_TOTAL - FINAL_DEPOSIT; // ~377,047

function generateBarData() {
  const bars: { year: number; deposit: number; interest: number }[] = [];
  for (let i = 1; i <= BAR_COUNT; i++) {
    const deposit = DEPOSIT_PER_YEAR * i;
    // Compound interest — reference shows green visible from ~year 8 onward
    const t = i / BAR_COUNT;
    const interest = FINAL_INTEREST * Math.pow(t, 1.8);
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

  // 90 frames total for this segment
  const segDur = 90;
  const zoomStart = fps * 1.2; // start zooming at 1.2s (frame 30)

  const entryScale = spring({
    fps,
    frame,
    from: 0.92,
    to: 1,
    config: { damping: 20 },
  });
  // Zoom into chart area — gentler zoom matching v4's best SSIM
  const zoomScale = interpolate(
    frame,
    [zoomStart, segDur],
    [1, 1.5],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const zoomY = interpolate(
    frame,
    [zoomStart, segDur],
    [0, -200],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const zoomX = interpolate(
    frame,
    [zoomStart, segDur],
    [0, -60],
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
    [fps * 0.2, fps * 1.5],
    [0, 1224907],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const interestVal = interpolate(
    frame,
    [fps * 0.6, fps * 1.8],
    [0, FINAL_INTEREST],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const annotationOp = interpolate(frame, [fps * 1.0, fps * 1.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Chart area — match reference proportions: ~75% bar, ~25% gap
  const CARD_W = 3200;
  const CARD_H = 1800;
  const PAD_X = 140;
  const PAD_TOP = 420; // space for badge + number + legend
  const PAD_BOTTOM = 100; // space for x-axis labels
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

            const delayFrames = fps * 0.2 + i * 0.6;
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
const COIN_COUNT = 26;
const coinSeeds = Array.from({ length: COIN_COUNT }, (_, i) => {
  // Layer system: 5 huge foreground, 10 medium midground, 11 small background
  const layer = i < 5 ? 0 : i < 15 ? 1 : 2;
  const sizes = [700, 450, 260];
  const sizeVariance = [200, 150, 80];
  const blurLevels = [0, 0, 2.5]; // background coins get depth-of-field blur
  const shadowLevels = ["0 8px 30px rgba(0,0,0,0.35)", "0 4px 16px rgba(0,0,0,0.2)", "none"];
  return {
    x: ((i * 193 + 37) % 3500) + 170,
    delay: ((i * 19) % 12) * 0.04, // wider stagger — more cascading
    speed: [1400, 1800, 2400][layer] + ((i * 131) % 600),
    size: sizes[layer] + ((i * 97) % sizeVariance[layer]),
    rotSpeed: 60 + ((i * 41) % 100),
    rotStart: ((i * 73) % 360),
    rotX: 5 + ((i * 31) % 15),
    blur: blurLevels[layer],
    shadow: shadowLevels[layer],
    layer,
  };
});

/* Sparkle glints during coin rain */
const SPARKLE_COUNT = 16;
const sparkleSeeds = Array.from({ length: SPARKLE_COUNT }, (_, i) => ({
  x: ((i * 257 + 83) % 3600) + 120,
  y: ((i * 173 + 41) % 1800) + 180,
  startFrame: Math.floor(((i * 37) % 40) + 3), // staggered appearance
  size: 16 + ((i * 29) % 24),
}));

const CoinRainTransition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps; // seconds

  // Red background wash builds as coins accumulate
  const bgOp = interpolate(
    frame,
    [0, fps * 0.3, fps * 1.0],
    [0, 0.15, 0.4],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Red wash behind coins */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 40%, rgba(232,57,28,${bgOp}) 0%, rgba(180,30,10,${bgOp * 0.6}) 60%, rgba(120,20,5,${bgOp * 0.3}) 100%)`,
        }}
      />
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
                {/* 3D sphere gradient — off-center highlight for metallic look */}
                <radialGradient id={`coinGrad${i}`} cx="38%" cy="32%" r="65%" fx="35%" fy="28%">
                  <stop offset="0%" stopColor="#FF8A6A" />
                  <stop offset="30%" stopColor="#F04A2A" />
                  <stop offset="65%" stopColor={WHOP_RED} />
                  <stop offset="90%" stopColor="#A52210" />
                  <stop offset="100%" stopColor="#7A1A0C" />
                </radialGradient>
                {/* Specular highlight — hot white dot */}
                <radialGradient id={`coinSpec${i}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
                  <stop offset="40%" stopColor="rgba(255,255,255,0.3)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </radialGradient>
                {/* Rim light gradient */}
                <radialGradient id={`coinRim${i}`} cx="50%" cy="50%" r="50%">
                  <stop offset="85%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="95%" stopColor="rgba(255,255,255,0.12)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
                </radialGradient>
              </defs>
              {/* Shadow beneath coin */}
              <ellipse
                cx="52"
                cy="88"
                rx="32"
                ry="6"
                fill="rgba(0,0,0,0.12)"
              />
              {/* Main coin body */}
              <circle
                cx="50"
                cy="50"
                r="46"
                fill={`url(#coinGrad${i})`}
              />
              {/* Outer rim — darker edge */}
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="#8A1D0A"
                strokeWidth="2.5"
              />
              {/* Inner rim ring for depth */}
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1"
              />
              {/* Rim light overlay */}
              <circle
                cx="50"
                cy="50"
                r="46"
                fill={`url(#coinRim${i})`}
              />
              {/* Specular highlight — bright dot offset upper-left */}
              <circle
                cx="36"
                cy="34"
                r="12"
                fill={`url(#coinSpec${i})`}
              />
              {/* Glossy highlight band — diagonal white stripe */}
              <ellipse
                cx="42"
                cy="40"
                rx="26"
                ry="9"
                fill="rgba(255,255,255,0.22)"
                transform="rotate(-35 42 40)"
              />
              {/* W mark — filled Whop double-swoosh */}
              <path
                d="M30 44 C36 50, 42 54, 48 56 C54 54, 62 48, 70 38
                   L72 42 C64 52, 56 58, 48 60 C40 58, 34 52, 28 46 Z"
                fill="rgba(255,255,255,0.92)"
              />
              <path
                d="M22 56 C26 52, 30 52, 34 56 C40 62, 46 66, 52 66 C58 66, 64 60, 72 50
                   L74 54 C66 64, 58 70, 52 70 C46 70, 40 66, 34 60 C30 56, 26 56, 22 60 Z"
                fill="rgba(255,255,255,0.88)"
              />
            </svg>
          </div>
        );
      })}
      {/* Sparkle glints — 4-point stars that flash repeatedly */}
      {sparkleSeeds.map((sp, si) => {
        const life = 8; // frames each sparkle lives
        const cycle = life + 6; // gap between flashes
        const localFrame = ((frame - sp.startFrame) % cycle + cycle) % cycle;
        const active = frame >= sp.startFrame && localFrame < life;
        const sparkleOp = active
          ? Math.sin((localFrame / life) * Math.PI)
          : 0;
        if (sparkleOp <= 0) return null;
        const s = sp.size * (0.6 + sparkleOp * 0.4);
        return (
          <svg
            key={`sp${si}`}
            style={{
              position: "absolute",
              left: sp.x - s / 2,
              top: sp.y - s / 2,
              opacity: sparkleOp * 0.9,
              pointerEvents: "none",
            }}
            width={s}
            height={s}
            viewBox="0 0 24 24"
          >
            <path
              d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z"
              fill="#fff"
            />
          </svg>
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
        {/* Whop W mark — filled swoosh pair matching official logo */}
        <svg width="380" height="280" viewBox="0 0 200 140" fill="none">
          {/* Upper swoosh — starts thin left, dips to valley, rises thick right */}
          <path
            d="M38 48 C46 56, 54 62, 64 66 C74 70, 86 66, 100 56 C114 46, 130 32, 152 16
               L156 22
               C134 38, 116 52, 102 62 C88 72, 76 76, 64 72 C52 68, 44 60, 36 52 Z"
            fill={WHOP_RED}
          />
          {/* Lower swoosh — wider arc, deeper dip */}
          <path
            d="M8 78 C14 72, 22 72, 30 78 C42 90, 56 106, 72 114 C84 118, 98 112, 114 98 C130 84, 148 64, 164 46
               L168 52
               C152 70, 132 88, 116 102 C100 116, 86 122, 72 118 C56 112, 42 96, 30 84 C22 76, 14 76, 8 82 Z"
            fill={WHOP_RED}
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
      <Sequence from={0} durationInFrames={105} name="Dashboard">
        <DashboardSegment />
      </Sequence>
      <Sequence from={105} durationInFrames={90} name="GrowthChart">
        <GrowthChartSegment />
      </Sequence>
      <Sequence from={190} durationInFrames={100} name="DepositMethods">
        <DepositSegment />
      </Sequence>
      <Sequence from={275} durationInFrames={55} name="CoinRain">
        <CoinRainTransition />
      </Sequence>
      <Sequence from={320} durationInFrames={123} name="LogoReveal">
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
