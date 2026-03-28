import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

/* ─── timing (25 fps) — tuned against reference ─── */
const INTRO_START = 0;        // "Introducing" appears
const WHOP_START = 2;         // "Whop" appears — ref: stagger ~2f
const TREASURY_START = 4;     // "Treasury" appears — ref: stagger ~2f
const HOLD_END = 38;          // text holds fully visible (ref: fading at f40)
const ZOOM_OUT_END = 47;      // text zooms/fades out (ref: blank at f45)
const EARN_VISIBLE = 48;      // "Earn up to X%" begins (ref: visible f50)
const PERCENT_ROLL_END = 68;  // percentage stops at 6% — shortened by 10
const APY_APPEAR = 60;        // "APY" label + pill — shifted earlier
const HOLD_EARN_END = 100;    // hold the earn text — ref holds until ~f105
const DASHBOARD_START = 105;  // dashboard slides in — ref: ~f108
const DASHBOARD_FULL = 138;   // dashboard fully visible
const WALLET_START = 150;     // wallet page begins replacing dashboard
const WALLET_FULL = 158;      // wallet page fully visible
// Total duration: 217 frames

/* ─── colors ─── */
const RED = "#E8391C";
const GREEN = "#16A34A";
const GRAY_BG = "#F8F8F8";
const BORDER = "#E5E7EB";
const TEXT_PRIMARY = "#111111";
const TEXT_SECONDARY = "#6B7280";
const BLUE = "#2563EB";

/* ─── SVG chart paths ─── */
const REVENUE_LINE =
  "M 0 72 C 10 68, 18 40, 30 22 C 38 12, 42 15, 50 20 C 58 26, 62 42, 70 48 C 78 52, 85 50, 95 54 L 105 50 L 115 56 L 125 52 L 135 55 L 145 50 L 155 54 L 165 48 L 175 52 L 185 48 L 195 52 L 205 46 L 215 50 L 225 44 L 240 48";
const REVENUE_FILL =
  "M 0 72 C 10 68, 18 40, 30 22 C 38 12, 42 15, 50 20 C 58 26, 62 42, 70 48 C 78 52, 85 50, 95 54 L 105 50 L 115 56 L 125 52 L 135 55 L 145 50 L 155 54 L 165 48 L 175 52 L 185 48 L 195 52 L 205 46 L 215 50 L 225 44 L 240 48 L 240 100 L 0 100 Z";

const YESTERDAY_LINE =
  "M 0 60 C 20 56, 40 58, 60 60 C 80 62, 100 58, 120 60 C 140 62, 160 59, 180 61 C 200 60, 220 62, 240 59";

/* ─── Stats bar chart data ─── */
const NET_REV_BARS = [12, 18, 8, 22, 15, 10, 20, 25, 14, 19, 16, 22, 28, 18];
const NET_REV_COMP = [10, 14, 12, 16, 13, 8, 15, 18, 10, 14, 12, 17, 20, 14];
const NET_REV_LABELS = ["Mar 5", "", "", "", "", "", "Today", "", "", "", "", "", "", ""];
const NEW_CUST_LINE = [2, 3, 4, 3, 5, 6, 5, 7, 8, 9, 10, 12, 14, 18];
const SPEND_LINE = [145, 150, 148, 155, 152, 160, 155, 162, 158, 165, 160, 168, 165, 170];

/* ─── Helpers ─── */
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/* ───────────────────────────────────────────────────── */
/*  Word Reveal                                        */
/* ───────────────────────────────────────────────────── */
const WordReveal: React.FC<{
  text: string;
  color: string;
  startFrame: number;
  frame: number;
  fontSize?: number;
  fontWeight?: number;
}> = ({ text, color, startFrame, frame, fontSize = 180, fontWeight = 700 }) => {
  const progress = clamp01((frame - startFrame) / 6);
  const e = easeOut(progress);
  return (
    <span
      style={{
        display: "inline-block",
        color,
        fontSize,
        fontWeight,
        fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
        opacity: e,
        transform: `translateY(${(1 - e) * 30}px)`,
        marginRight: fontSize * 0.22,
        letterSpacing: "-0.03em",
      }}
    >
      {text}
    </span>
  );
};

/* ───────────────────────────────────────────────────── */
/*  Mini Chart (SVG) for stat cards                    */
/* ───────────────────────────────────────────────────── */
const MiniBarChart: React.FC<{
  data: number[];
  compData?: number[];
  color: string;
  progress: number;
  labels?: string[];
}> = ({ data, compData, color, progress, labels }) => {
  const max = Math.max(...data, ...(compData || []));
  const pairW = 24; // total width per pair
  const gap = 10;
  const chartH = 80;
  const totalH = labels ? chartH + 24 : chartH;
  const totalW = data.length * (pairW + gap);
  const visibleBars = Math.floor(data.length * progress);
  return (
    <svg width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`}>
      {data.slice(0, visibleBars).map((v, i) => {
        const barH = (v / max) * (chartH - 4);
        const x = i * (pairW + gap);
        const compV = compData ? compData[i] : 0;
        const compH = compData ? (compV / max) * (chartH - 4) : 0;
        return (
          <g key={i}>
            {/* comparison bar (purple/gray) */}
            {compData && (
              <rect
                x={x}
                y={chartH - compH}
                width={10}
                height={compH}
                rx={2}
                fill="#D1D5DB"
              />
            )}
            {/* main bar */}
            <rect
              x={compData ? x + 12 : x}
              y={chartH - barH}
              width={compData ? 10 : pairW}
              height={barH}
              rx={2}
              fill={color}
            />
            {/* label */}
            {labels && labels[i] && (
              <text
                x={x + pairW / 2}
                y={totalH - 2}
                textAnchor="middle"
                fontSize="9"
                fill="#9CA3AF"
                fontFamily="Inter, sans-serif"
              >
                {labels[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

const MiniLineChart: React.FC<{
  data: number[];
  color: string;
  progress: number;
  width?: number;
  height?: number;
}> = ({ data, color, progress, width = 200, height = 80 }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const visibleCount = Math.max(2, Math.floor(data.length * progress));
  const pts = data.slice(0, visibleCount).map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - 4 - ((v - min) / range) * (height - 8);
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
};

/* ───────────────────────────────────────────────────── */
/*  Dashboard                                          */
/* ───────────────────────────────────────────────────── */
const Dashboard: React.FC<{ frame: number; fps: number; entryProgress: number }> = ({
  frame,
  fps,
  entryProgress,
}) => {
  const e = easeOut(entryProgress);
  const dashFrame = frame - DASHBOARD_START;
  const chartDraw = clamp01(dashFrame / 30);

  // Animate the gross revenue number counting up — match ref counter curve
  // Ref: f110=$2431, f115=$2896, f120=$3167, f140=$3562, target=$3570
  const grossBase = 2431.30;
  const grossTarget = 3570.61;
  const grossProgress = clamp01(dashFrame / 50);
  const grossValue = grossBase + (grossTarget - grossBase) * easeOut(grossProgress);

  // Animate total balance counting up — match ref counter curve
  // Ref: f110=$34609, f115=$37660, f120=$39498, f140=$42510, target=$42740
  const balBase = 34609.07;
  const balTarget = 42740.24;
  const balProgress = clamp01(dashFrame / 50);
  const balValue = balBase + (balTarget - balBase) * easeOut(balProgress);

  const fmt = (v: number) =>
    "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const pad = 60;
  const cardR = 16;

  // Slight perspective tilt that settles — matches the iPad angle in the reference
  const tiltX = interpolate(entryProgress, [0, 0.6, 1], [4, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        perspective: 3000,
        opacity: e,
      }}
    >
      <div
        style={{
          width: 3200,
          height: 1800,
          background: "#fff",
          borderRadius: 40,
          border: `2px solid ${BORDER}`,
          boxShadow: "0 60px 160px rgba(0,0,0,0.12), 0 20px 60px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.03)",
          padding: pad,
          display: "flex",
          flexDirection: "column",
          gap: 40,
          overflow: "hidden",
          transform: `translateY(${Math.round((1 - e) * 600)}px) rotateX(${tiltX}deg)`,
          transformOrigin: "center bottom",
        }}
      >
        {/* ── Top row: Revenue chart + Balance/Payouts ── */}
        <div style={{ display: "flex", gap: 40, flex: "0 0 auto", height: 700 }}>
          {/* Revenue chart card */}
          <div
            style={{
              flex: 2,
              background: "#fff",
              borderRadius: cardR,
              border: `1.5px solid ${BORDER}`,
              padding: 40,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 8 }}>
              <span style={{ fontSize: 28, color: TEXT_SECONDARY, fontFamily: "Inter, sans-serif" }}>
                Gross revenue
              </span>
              <span
                style={{
                  fontSize: 22,
                  color: GREEN,
                  background: `${GREEN}15`,
                  padding: "4px 12px",
                  borderRadius: 8,
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 600,
                }}
              >
                +143% &uarr;
              </span>
              <span style={{ fontSize: 28, color: TEXT_SECONDARY, marginLeft: 60, fontFamily: "Inter, sans-serif" }}>
                Yesterday
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 40, marginBottom: 24 }}>
              <span
                style={{
                  fontSize: 72,
                  fontWeight: 700,
                  color: TEXT_PRIMARY,
                  fontFamily: "Inter, sans-serif",
                  letterSpacing: "-0.02em",
                }}
              >
                {fmt(grossValue)}
              </span>
              <span style={{ fontSize: 48, color: TEXT_SECONDARY, fontFamily: "Inter, sans-serif" }}>
                $2,983.20
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 24, color: TEXT_SECONDARY, fontFamily: "Inter, sans-serif" }}>
              <span>3:02 PM</span>
            </div>
            {/* Chart */}
            <div style={{ flex: 1, position: "relative", marginTop: 16 }}>
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 240 100"
                preserveAspectRatio="none"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
              >
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BLUE} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={BLUE} stopOpacity="0.01" />
                  </linearGradient>
                  <clipPath id="revClip">
                    <rect x="0" y="0" width={240 * chartDraw} height="100" />
                  </clipPath>
                </defs>
                {/* Horizontal grid lines */}
                {[15, 30, 45, 60, 75, 90].map((y) => (
                  <line key={y} x1="0" y1={y} x2="240" y2={y} stroke="#F0F1F3" strokeWidth="0.4" />
                ))}
                {/* Vertical grid lines (time markers) */}
                {[60, 120, 180].map((x) => (
                  <line key={x} x1={x} y1="0" x2={x} y2="100" stroke="#F0F1F3" strokeWidth="0.3" />
                ))}
                {/* Current time vertical marker */}
                <line x1="150" y1="0" x2="150" y2="100" stroke="#D1D5DB" strokeWidth="0.5" strokeDasharray="2 2" clipPath="url(#revClip)" />
                {/* Yesterday line (gray dashed) */}
                <path
                  d={YESTERDAY_LINE}
                  fill="none"
                  stroke="#D1D5DB"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  clipPath="url(#revClip)"
                />
                {/* Revenue fill */}
                <path d={REVENUE_FILL} fill="url(#revFill)" clipPath="url(#revClip)" />
                {/* Revenue line */}
                <path
                  d={REVENUE_LINE}
                  fill="none"
                  stroke={BLUE}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  clipPath="url(#revClip)"
                />
              </svg>
              {/* Time labels */}
              <div
                style={{
                  position: "absolute",
                  bottom: -4,
                  left: 0,
                  right: 0,
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 20,
                  color: "#9CA3AF",
                  fontFamily: "Inter, sans-serif",
                  padding: "0 2px",
                }}
              >
                <span>12:00 am</span>
                <span>11:59 pm</span>
              </div>
            </div>
          </div>

          {/* Right column: Total balance + Payouts */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 40 }}>
            {/* Total balance */}
            <div
              style={{
                flex: 1,
                background: "#fff",
                borderRadius: cardR,
                border: `1.5px solid ${BORDER}`,
                padding: 40,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 26, color: TEXT_SECONDARY, fontFamily: "Inter, sans-serif" }}>
                  Total balance
                </span>
                <span style={{ fontSize: 24, color: GREEN, fontFamily: "Inter, sans-serif", fontWeight: 500 }}>
                  View
                </span>
              </div>
              <span
                style={{
                  fontSize: 64,
                  fontWeight: 700,
                  color: GREEN,
                  fontFamily: "Inter, sans-serif",
                  letterSpacing: "-0.02em",
                }}
              >
                {fmt(balValue)}
              </span>
              <span style={{ fontSize: 24, color: TEXT_SECONDARY, fontFamily: "Inter, sans-serif", marginTop: 4 }}>
                $7,691.97 available
              </span>
            </div>
            {/* Payouts */}
            <div
              style={{
                flex: 1,
                background: "#fff",
                borderRadius: cardR,
                border: `1.5px solid ${BORDER}`,
                padding: 40,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 26, color: TEXT_SECONDARY, fontFamily: "Inter, sans-serif" }}>
                  Payouts
                </span>
                <span
                  style={{
                    fontSize: 22,
                    color: GREEN,
                    background: `${GREEN}18`,
                    padding: "8px 20px",
                    borderRadius: 24,
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 600,
                    border: `1px solid ${GREEN}30`,
                  }}
                >
                  Completed
                </span>
              </div>
              <span
                style={{
                  fontSize: 64,
                  fontWeight: 700,
                  color: TEXT_PRIMARY,
                  fontFamily: "Inter, sans-serif",
                  letterSpacing: "-0.02em",
                }}
              >
                $895.46
              </span>
              <span style={{ fontSize: 24, color: TEXT_SECONDARY, fontFamily: "Inter, sans-serif", marginTop: 4 }}>
                22 days ago
              </span>
            </div>
          </div>
        </div>

        {/* ── Congratulations banner ── */}
        <div
          style={{
            background: `${BLUE}08`,
            borderRadius: 12,
            padding: "20px 32px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 26,
            fontFamily: "Inter, sans-serif",
            color: TEXT_PRIMARY,
          }}
        >
          <span style={{ fontSize: 28 }}>&#9826;</span>
          Congratulations on crossing $10K in revenue.{" "}
          <span style={{ color: BLUE, fontWeight: 500 }}>See more</span>
        </div>

        {/* ── Stats section ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Stats header */}
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <span style={{ fontSize: 48, fontWeight: 700, color: TEXT_PRIMARY, fontFamily: "Inter, sans-serif" }}>
              Stats
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              fontSize: 24,
              color: TEXT_SECONDARY,
              fontFamily: "Inter, sans-serif",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontWeight: 500, color: TEXT_PRIMARY }}>Last 7 days</span>
            <span>&darr;</span>
            <span>&#128197; Mar 5 - 12, 2026</span>
            <span>compared to</span>
            <span style={{ fontWeight: 500, color: TEXT_PRIMARY }}>Previous period</span>
            <span>&darr;</span>
            <span style={{ fontWeight: 500, color: TEXT_PRIMARY }}>Daily</span>
            <span>&darr;</span>
            <span style={{ fontWeight: 500, color: TEXT_PRIMARY }}>All products</span>
            <span>&darr;</span>
            <span style={{ marginLeft: 40, color: TEXT_PRIMARY }}>+ Add</span>
            <span style={{ color: TEXT_PRIMARY }}>&#9881; Edit</span>
          </div>

          {/* Stat cards row */}
          <div style={{ display: "flex", gap: 32, flex: 1 }}>
            {/* Net revenue */}
            <div
              style={{
                flex: 1,
                background: "#fff",
                borderRadius: cardR,
                border: `1.5px solid ${BORDER}`,
                padding: 32,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 24, color: TEXT_SECONDARY, fontFamily: "Inter, sans-serif" }}>
                Net revenue
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span
                  style={{
                    fontSize: 48,
                    fontWeight: 700,
                    color: TEXT_PRIMARY,
                    fontFamily: "Inter, sans-serif",
                    letterSpacing: "-0.02em",
                  }}
                >
                  $21,545.51
                </span>
                <span style={{ fontSize: 22, color: GREEN, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>
                  +$850.97
                </span>
              </div>
              {/* Chart with Y-axis */}
              <div style={{ display: "flex", gap: 8, flex: 1, marginTop: 8 }}>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: 18, color: TEXT_SECONDARY, fontFamily: "Inter, sans-serif", paddingBottom: 24 }}>
                  <span>24.4K</span>
                  <span>18.5K</span>
                  <span>12.6K</span>
                  <span>6.5K</span>
                </div>
                <div style={{ flex: 1 }}>
                  <MiniBarChart data={NET_REV_BARS} compData={NET_REV_COMP} labels={NET_REV_LABELS} color={BLUE} progress={clamp01(dashFrame / 35)} />
                </div>
              </div>
            </div>

            {/* Spend per paying user */}
            <div
              style={{
                flex: 1,
                background: "#fff",
                borderRadius: cardR,
                border: `1.5px solid ${BORDER}`,
                padding: 32,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 24, color: TEXT_SECONDARY, fontFamily: "Inter, sans-serif" }}>
                Spend per paying user &#9432;
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span
                  style={{
                    fontSize: 48,
                    fontWeight: 700,
                    color: TEXT_PRIMARY,
                    fontFamily: "Inter, sans-serif",
                    letterSpacing: "-0.02em",
                  }}
                >
                  $170.00
                </span>
                <span style={{ fontSize: 22, color: GREEN, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>
                  +$20.00
                </span>
              </div>
              {/* Chart with Y-axis */}
              <div style={{ display: "flex", gap: 8, flex: 1, marginTop: 8 }}>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: 18, color: TEXT_SECONDARY, fontFamily: "Inter, sans-serif", paddingBottom: 4 }}>
                  <span>$200</span>
                  <span>$100</span>
                  <span>$0</span>
                </div>
                <div style={{ flex: 1 }}>
                  <MiniLineChart data={SPEND_LINE} color={BLUE} progress={clamp01(dashFrame / 35)} width={280} height={120} />
                </div>
              </div>
            </div>

            {/* New customers */}
            <div
              style={{
                flex: 1,
                background: "#fff",
                borderRadius: cardR,
                border: `1.5px solid ${BORDER}`,
                padding: 32,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 24, color: TEXT_SECONDARY, fontFamily: "Inter, sans-serif" }}>
                New customers
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span
                  style={{
                    fontSize: 48,
                    fontWeight: 700,
                    color: TEXT_PRIMARY,
                    fontFamily: "Inter, sans-serif",
                    letterSpacing: "-0.02em",
                  }}
                >
                  87
                </span>
                <span style={{ fontSize: 22, color: GREEN, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>
                  +$383.00%
                </span>
              </div>
              {/* Chart with Y-axis */}
              <div style={{ display: "flex", gap: 8, flex: 1, marginTop: 8 }}>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: 18, color: TEXT_SECONDARY, fontFamily: "Inter, sans-serif", paddingBottom: 4 }}>
                  <span>200</span>
                  <span>100</span>
                  <span>0</span>
                </div>
                <div style={{ flex: 1 }}>
                  <MiniLineChart data={NEW_CUST_LINE} color={BLUE} progress={clamp01(dashFrame / 35)} width={280} height={120} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ───────────────────────────────────────────────────── */
/*  Mouse Cursor                                       */
/* ───────────────────────────────────────────────────── */
const MouseCursor: React.FC<{ x: number; y: number; opacity: number }> = ({ x, y, opacity }) => (
  <div
    style={{
      position: "absolute",
      left: Math.round(x),
      top: Math.round(y),
      width: 60,
      height: 72,
      opacity,
      zIndex: 9999,
      pointerEvents: "none",
      filter: "drop-shadow(2px 3px 4px rgba(0,0,0,0.25))",
    }}
  >
    <svg width="60" height="72" viewBox="0 0 24 28" fill="none">
      <path
        d="M5.65 2.15L5.65 22.85L10.35 18.15L14.15 26.35L17.35 24.85L13.55 16.85L19.85 16.85L5.65 2.15Z"
        fill="white"
        stroke="black"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

/* ───────────────────────────────────────────────────── */
/*  Wallet / Treasury Page                             */
/* ───────────────────────────────────────────────────── */
const WalletPage: React.FC<{ frame: number; entryProgress: number }> = ({
  frame,
  entryProgress,
}) => {
  const e = easeOut(entryProgress);
  const _cardR = 16;
  void _cardR;
  const walletFrame = frame - WALLET_START;

  // Progressive zoom into the buttons/bar area (ref zooms in frames 168-200)
  const zoomStart = 168;
  const zoomEnd = 200;
  const zoomProgress = easeInOut(clamp01((frame - zoomStart) / (zoomEnd - zoomStart)));
  // Zoom to show buttons + balance bar + $ amounts (ref f200 ~ 2x zoom)
  const zoomScale = 1 + zoomProgress * 0.95; // zoom from 1x to 1.95x
  // transformOrigin is "center 25%". Buttons are at x~2400 in card space.
  // translate happens in scaled space: need to center viewport on buttons+bar area
  const panX = Math.round(zoomProgress * -200); // shift to center buttons
  const panY = Math.round(zoomProgress * 30);   // slight down to show bar below buttons

  // Cursor animation: appears at frame 162, moves toward "Move" button
  const cursorStart = 162;
  const cursorEnd = 195;
  const cursorProgress = easeInOut(clamp01((frame - cursorStart) / (cursorEnd - cursorStart)));
  const cursorOpacity = interpolate(frame, [cursorStart, cursorStart + 6, 210, 217], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Cursor moves from lower-right toward the "Move" button
  // At 4K, Move button is at roughly x=2400, y=180 (in card coords + padding)
  const cursorX = Math.round(interpolate(cursorProgress, [0, 1], [2800, 2460], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  }));
  const cursorY = Math.round(interpolate(cursorProgress, [0, 1], [1200, 350], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  }));

  // Move button hover state — activates when cursor reaches button area
  const moveHovered = frame >= cursorStart + 18;

  // Animated total balance — reach target in ~15 frames to match ref
  const balBase = 39242.48;
  const balTarget = 42740.24;
  const balProgress = clamp01(walletFrame / 15);
  const balValue = balBase + (balTarget - balBase) * easeInOut(balProgress);
  const fmt = (v: number) =>
    "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Balance bar proportions
  const cashPct = 96.6; // 42740.24 / (42740.24 + 1478)
  const treasuryPct = 3.4;

  const CurrencyRow: React.FC<{
    flag: string;
    code: string;
    amount: string;
    sub?: string;
    showChevron?: boolean;
  }> = ({ flag, code, amount, sub, showChevron }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "28px 0",
        borderBottom: `1px solid ${BORDER}`,
        fontFamily: "Inter, sans-serif",
      }}
    >
      <span style={{ fontSize: 36, marginRight: 20 }}>{flag}</span>
      <span style={{ fontSize: 28, fontWeight: 500, color: TEXT_PRIMARY, flex: 1 }}>{code}</span>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 28, fontWeight: 600, color: TEXT_PRIMARY }}>{amount}</div>
        {sub && <div style={{ fontSize: 22, color: TEXT_SECONDARY, marginTop: 2 }}>{sub}</div>}
      </div>
      {showChevron && (
        <span style={{ fontSize: 24, color: TEXT_SECONDARY, marginLeft: 16 }}>&#x203A;</span>
      )}
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        opacity: e,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: 3200,
          height: 1800,
          background: "#fff",
          borderRadius: 40,
          border: `2px solid ${BORDER}`,
          boxShadow:
            "0 60px 160px rgba(0,0,0,0.12), 0 20px 60px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.03)",
          padding: 80,
          display: "flex",
          flexDirection: "column",
          transform: `translateY(${Math.round((1 - e) * 400)}px) scale(${zoomScale}) translate(${panX}px, ${panY}px)`,
          transformOrigin: "center 25%",
          gap: 40,
          overflow: "hidden",
        }}
      >
        {/* Header: Total balance + action buttons */}
        <div>
          <span
            style={{
              fontSize: 24,
              color: TEXT_SECONDARY,
              fontFamily: "Inter, sans-serif",
              display: "block",
              marginBottom: 8,
            }}
          >
            Total balance
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
            <span
              style={{
                fontSize: 80,
                fontWeight: 700,
                color: TEXT_PRIMARY,
                fontFamily: "Inter, sans-serif",
                letterSpacing: "-0.02em",
              }}
            >
              {fmt(balValue)} <span style={{ fontWeight: 400, fontSize: 48, color: TEXT_SECONDARY }}>USD</span>
            </span>
            <div style={{ flex: 1 }} />
            {/* Action buttons */}
            {[
              { label: "+ Deposit", primary: true },
              { label: "\u21A5 Withdraw", primary: false },
              { label: "\u21C4 Move", primary: false },
            ].map((btn, i) => {
              const isMove = i === 2;
              const isHovered = isMove && moveHovered;
              return (
              <div
                key={i}
                style={{
                  padding: "16px 36px",
                  borderRadius: 12,
                  fontSize: 26,
                  fontWeight: 500,
                  fontFamily: "Inter, sans-serif",
                  background: btn.primary ? BLUE : isHovered ? "#E5E7EB" : "#fff",
                  color: btn.primary ? "#fff" : BLUE,
                  border: btn.primary ? "none" : `1.5px solid ${isHovered ? "#D1D5DB" : BORDER}`,
                }}
              >
                {btn.label}
              </div>
              );
            })}
            {/* Three dots menu */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                border: `1.5px solid ${BORDER}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                color: TEXT_SECONDARY,
              }}
            >
              &#8942;
            </div>
          </div>
        </div>

        {/* Balance bar */}
        <div>
          <div
            style={{
              height: 28,
              borderRadius: 14,
              overflow: "hidden",
              display: "flex",
              background: "#E5E7EB",
            }}
          >
            <div
              style={{
                width: `${cashPct}%`,
                background: BLUE,
                borderRadius: "14px 0 0 14px",
                transition: "width 0.3s",
              }}
            />
            <div
              style={{
                width: `${treasuryPct}%`,
                background: GREEN,
                borderRadius: "0 14px 14px 0",
              }}
            />
          </div>
          {/* Bar legend */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 12,
              fontFamily: "Inter, sans-serif",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: BLUE }} />
              <span style={{ fontSize: 22, color: TEXT_SECONDARY }}>Available cash</span>
              <span style={{ fontSize: 22, fontWeight: 600, color: TEXT_PRIMARY, marginLeft: 12 }}>
                $42,740.24
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: GREEN }} />
              <span style={{ fontSize: 22, color: TEXT_SECONDARY }}>Treasury</span>
              <span style={{ fontSize: 22, fontWeight: 600, color: TEXT_PRIMARY, marginLeft: 12 }}>
                $1,478.00
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 40,
            borderBottom: `1.5px solid ${BORDER}`,
            paddingBottom: 16,
            fontFamily: "Inter, sans-serif",
            fontSize: 26,
          }}
        >
          {["Balances", "All activity", "Withdrawals", "Top ups"].map((tab, i) => (
            <span
              key={i}
              style={{
                color: i === 0 ? TEXT_PRIMARY : TEXT_SECONDARY,
                fontWeight: i === 0 ? 600 : 400,
                paddingBottom: 16,
                borderBottom: i === 0 ? `2px solid ${TEXT_PRIMARY}` : "none",
              }}
            >
              {tab}
            </span>
          ))}
        </div>

        {/* Treasury section */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 32,
                fontWeight: 600,
                color: TEXT_PRIMARY,
                fontFamily: "Inter, sans-serif",
              }}
            >
              Treasury
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 24px",
                borderRadius: 10,
                border: `1.5px solid ${BORDER}`,
                fontSize: 24,
                fontFamily: "Inter, sans-serif",
                color: BLUE,
                fontWeight: 500,
              }}
            >
              <span style={{ fontSize: 20 }}>&#x21C4;</span> Convert
            </div>
          </div>

          <CurrencyRow
            flag="&#x1F4B2;"
            code="USDT"
            amount="&#x20B2; $0.00"
            sub="USDT 0.00"
            showChevron
          />
          <CurrencyRow
            flag="&#x1F947;"
            code="Gold"
            amount="$1,478.43"
            sub="XAU 0.5208/8"
            showChevron
          />

          {/* Cash section */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 32,
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 32,
                fontWeight: 600,
                color: TEXT_PRIMARY,
                fontFamily: "Inter, sans-serif",
              }}
            >
              Cash
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 24px",
                borderRadius: 10,
                border: `1.5px solid ${BORDER}`,
                fontSize: 24,
                fontFamily: "Inter, sans-serif",
                color: BLUE,
                fontWeight: 500,
              }}
            >
              <span style={{ fontSize: 20 }}>&#x21C4;</span> Convert
            </div>
          </div>

          <CurrencyRow flag={"🇺🇸"} code="USD" amount="$39,790.92" />
          <CurrencyRow flag={"🇪🇺"} code="EUR" amount="$847.32" sub="EUR 478.64" />
          <CurrencyRow flag={"🇨🇦"} code="CAD" amount="$623.57" sub="CAD 841.19" />
        </div>
      </div>
      {/* Animated cursor */}
      {cursorOpacity > 0 && (
        <MouseCursor x={cursorX} y={cursorY} opacity={cursorOpacity} />
      )}
    </div>
  );
};

/* ───────────────────────────────────────────────────── */
/*  Main Scene                                         */
/* ───────────────────────────────────────────────────── */
export const Scene01: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* ── Phase 1: "Introducing Whop Treasury" ── */
  const introOpacity = interpolate(frame, [HOLD_END, ZOOM_OUT_END], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const introScale = interpolate(frame, [HOLD_END, ZOOM_OUT_END], [1, 2.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── Phase 2: "Earn up to 6%" ── */
  const earnOpacity = interpolate(
    frame,
    [EARN_VISIBLE, EARN_VISIBLE + 2, HOLD_EARN_END, DASHBOARD_START],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const earnScale = interpolate(
    frame,
    [HOLD_EARN_END, DASHBOARD_START],
    [1, 0.6],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const earnY = interpolate(
    frame,
    [HOLD_EARN_END, DASHBOARD_START],
    [0, -400],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Rolling percentage: 1% -> 6%
  const percentRaw = interpolate(
    frame,
    [EARN_VISIBLE, PERCENT_ROLL_END],
    [1, 6],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const percentDisplay = Math.round(percentRaw);

  // APY label + pill
  const apyOpacity = interpolate(frame, [APY_APPEAR, APY_APPEAR + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── Phase 3: Dashboard ── */
  const dashEntry = clamp01((frame - DASHBOARD_START) / (DASHBOARD_FULL - DASHBOARD_START));

  return (
    <AbsoluteFill style={{ backgroundColor: GRAY_BG }}>
      {/* Phase 1: Introducing Whop Treasury */}
      {frame < ZOOM_OUT_END + 5 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${introScale})`,
            opacity: introOpacity,
            display: "flex",
            alignItems: "baseline",
            whiteSpace: "nowrap",
          }}
        >
          <WordReveal text="Introducing" color="#6B7280" startFrame={INTRO_START} frame={frame} fontWeight={400} />
          <WordReveal text="Whop" color={RED} startFrame={WHOP_START} frame={frame} />
          <WordReveal text="Treasury" color={RED} startFrame={TREASURY_START} frame={frame} />
        </div>
      )}

      {/* Phase 2: Earn up to X% on your balance */}
      {frame >= EARN_VISIBLE && frame < DASHBOARD_START + 10 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${earnScale}) translateY(${Math.round(earnY)}px)`,
            opacity: earnOpacity,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
            <span
              style={{
                fontSize: 140,
                fontWeight: 700,
                color: TEXT_PRIMARY,
                fontFamily: "'Inter', sans-serif",
                letterSpacing: "-0.03em",
              }}
            >
              Earn up to
            </span>
            <span
              style={{
                fontSize: 200,
                fontWeight: 800,
                color: TEXT_PRIMARY,
                fontFamily: "'Inter', sans-serif",
                letterSpacing: "-0.04em",
                display: "inline-block",
                minWidth: "240px",
                textAlign: "center",
              }}
            >
              {percentDisplay}%
            </span>
            <span
              style={{
                fontSize: 140,
                fontWeight: 700,
                color: TEXT_PRIMARY,
                fontFamily: "'Inter', sans-serif",
                letterSpacing: "-0.03em",
                opacity: interpolate(frame, [EARN_VISIBLE + 10, EARN_VISIBLE + 18], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                transform: `translateY(${interpolate(frame, [EARN_VISIBLE + 10, EARN_VISIBLE + 18], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
              }}
            >
              on your balance
            </span>
          </div>
          {/* APY label + pill */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              marginTop: 20,
              opacity: apyOpacity,
            }}
          >
            <span
              style={{
                fontSize: 36,
                fontWeight: 500,
                color: TEXT_SECONDARY,
                letterSpacing: "0.25em",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              APY
            </span>
            <div
              style={{
                background: RED,
                color: "#fff",
                fontSize: 32,
                fontWeight: 600,
                padding: "16px 40px",
                borderRadius: 40,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Higher than any bank
            </div>
          </div>
        </div>
      )}

      {/* Phase 3: Dashboard (analytics) — fades out when wallet arrives */}
      {frame >= DASHBOARD_START && frame < WALLET_START + 8 && (
        <div
          style={{
            opacity: interpolate(
              frame,
              [WALLET_START - 2, WALLET_START + 4],
              [1, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            ),
          }}
        >
          <Dashboard frame={frame} fps={fps} entryProgress={dashEntry} />
        </div>
      )}

      {/* Phase 4: Wallet / Treasury page */}
      {frame >= WALLET_START && (
        <WalletPage
          frame={frame}
          entryProgress={clamp01((frame - WALLET_START) / (WALLET_FULL - WALLET_START))}
        />
      )}

      {/* Phase 5: Transfer modal overlay (last ~10 frames, matching Scene02 merge) */}
      {frame >= 208 && (() => {
        const modalProgress = clamp01((frame - 208) / 6);
        const modalE = easeOut(modalProgress);
        return (
          <>
            {/* Dark overlay */}
            <div
              style={{
                position: "absolute",
                top: 0, left: 0, width: "100%", height: "100%",
                background: `rgba(0,0,0,${modalE * 0.35})`,
              }}
            />
            {/* Modal card */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(-50%, -50%) scale(${0.9 + modalE * 0.1})`,
                opacity: modalE,
                width: 600,
                background: "#fff",
                borderRadius: 20,
                padding: 48,
                boxShadow: "0 30px 80px rgba(0,0,0,0.2)",
                display: "flex",
                flexDirection: "column",
                gap: 28,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 32, fontWeight: 600, color: TEXT_PRIMARY }}>Transfer</span>
                <span style={{ fontSize: 28, color: TEXT_SECONDARY, cursor: "pointer" }}>&#x2715;</span>
              </div>
              {/* Amount input */}
              <div style={{ fontSize: 48, fontWeight: 700, color: TEXT_PRIMARY, borderBottom: `2px solid ${BORDER}`, paddingBottom: 16 }}>
                $<span style={{ borderRight: `2px solid ${TEXT_PRIMARY}`, paddingRight: 2 }}></span>
              </div>
              {/* USD row */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 0" }}>
                <span style={{ fontSize: 28 }}>🇺🇸</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 24, fontWeight: 500, color: TEXT_PRIMARY }}>USD</div>
                  <div style={{ fontSize: 20, color: TEXT_SECONDARY }}>$39,790.92 USD available</div>
                </div>
                <span style={{ fontSize: 22, color: TEXT_SECONDARY }}>&#x203A;</span>
              </div>
              {/* USDT row */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 0" }}>
                <div style={{ width: 36, height: 36, borderRadius: 18, background: "#26A17B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>&#x20AE;</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 24, fontWeight: 500, color: TEXT_PRIMARY }}>USDT</span>
                    <span style={{ fontSize: 18, color: TEXT_SECONDARY }}>&#9432;</span>
                  </div>
                  <div style={{ fontSize: 20, color: GREEN }}>Earns up to 6%</div>
                </div>
              </div>
              {/* Review button */}
              <div style={{ padding: "16px 0", textAlign: "center", fontSize: 24, color: TEXT_SECONDARY }}>
                Review
              </div>
              {/* Cancel */}
              <div style={{ textAlign: "center", fontSize: 22, color: BLUE }}>
                Cancel
              </div>
            </div>
          </>
        );
      })()}
    </AbsoluteFill>
  );
};

export const scene01Meta = {
  id: "WhopScene01",
  component: Scene01,
  width: 3840,
  height: 2160,
  fps: 25,
  durationInFrames: 217, // 227 - 10 (shortened earn phase)
};
