import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

/* ─── timing (25 fps) ─── */
const INTRO_START = 0;        // "Introducing" appears
const WHOP_START = 6;         // "Whop" appears
const TREASURY_START = 12;    // "Treasury" appears
const HOLD_END = 55;          // text holds fully visible
const ZOOM_OUT_END = 75;      // text zooms/fades into "Earn up to..."
const EARN_VISIBLE = 76;      // "Earn up to X%" begins
const PERCENT_ROLL_END = 130; // percentage stops at 6%
const APY_APPEAR = 115;       // "APY" label + pill
const HOLD_EARN_END = 145;    // hold the earn text
const DASHBOARD_START = 146;  // dashboard slides in
const DASHBOARD_FULL = 190;   // dashboard fully visible
// Total duration: 227 frames (216 original + 11 merged from Scene02)

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
}> = ({ text, color, startFrame, frame, fontSize = 180 }) => {
  const progress = clamp01((frame - startFrame) / 10);
  const e = easeOut(progress);
  return (
    <span
      style={{
        display: "inline-block",
        color,
        fontSize,
        fontWeight: 700,
        fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
        opacity: e,
        transform: `translateY(${(1 - e) * 40}px)`,
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

  // Animate the gross revenue number counting up
  const grossBase = 3090.39;
  const grossTarget = 3570.28;
  const grossProgress = clamp01(dashFrame / 40);
  const grossValue = grossBase + (grossTarget - grossBase) * easeInOut(grossProgress);

  // Animate total balance counting up
  const balBase = 38968.99;
  const balTarget = 42650.72;
  const balProgress = clamp01(dashFrame / 40);
  const balValue = balBase + (balTarget - balBase) * easeInOut(balProgress);

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
          transform: `translateY(${(1 - e) * 600}px) rotateX(${tiltX}deg)`,
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
    [EARN_VISIBLE, EARN_VISIBLE + 5, HOLD_EARN_END, DASHBOARD_START],
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
          <WordReveal text="Introducing" color={TEXT_PRIMARY} startFrame={INTRO_START} frame={frame} />
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
            transform: `translate(-50%, -50%) scale(${earnScale}) translateY(${earnY}px)`,
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
                opacity: interpolate(frame, [EARN_VISIBLE + 6, EARN_VISIBLE + 14], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                transform: `translateY(${interpolate(frame, [EARN_VISIBLE + 6, EARN_VISIBLE + 14], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
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

      {/* Phase 3: Dashboard */}
      {frame >= DASHBOARD_START && (
        <Dashboard frame={frame} fps={fps} entryProgress={dashEntry} />
      )}
    </AbsoluteFill>
  );
};

export const scene01Meta = {
  id: "WhopScene01",
  component: Scene01,
  width: 3840,
  height: 2160,
  fps: 25,
  durationInFrames: 227, // 216 + 11 (merged Scene02)
};
