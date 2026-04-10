import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLOR, TYPE, BUTTON, PANEL } from "../designTokens";
import { FPS } from "../theme";
import { DiagramCard } from "../components/DiagramCard";

const sec = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

// Beat boundaries (local seconds from section start at 48.64s)
const BEAT1_START = sec(8.4);
const BEAT2_START = sec(13.4);
const BEAT3_START = sec(18.4);
const BEAT4_START = sec(23.4);
const CONTENT_END = sec(37);
const EXIT_END = sec(39);

// Streamer data
const STREAMERS = [
  { name: "xQc", viewers: "120k", sparkline: [60, 75, 68, 90, 100, 115, 108, 120] },
  { name: "Kai Cenat", viewers: "84k", sparkline: [40, 55, 70, 62, 75, 80, 78, 84] },
  { name: "Pokimane", viewers: "45k", sparkline: [30, 35, 42, 38, 44, 40, 43, 45] },
  { name: "Shroud", viewers: "12k", sparkline: [8, 10, 9, 11, 13, 12, 11, 12] },
  { name: "Summit1g", viewers: "8k", sparkline: [5, 6, 7, 8, 7, 9, 8, 8] },
  { name: "Amouranth", viewers: "3k", sparkline: [1, 2, 2, 3, 2, 3, 3, 3] },
];

// xQc detailed chart data (past 30 min + future zone)
const XQC_HISTORY = [
  100, 105, 108, 103, 110, 112, 106, 114, 118, 115,
  120, 117, 122, 119, 125, 121, 118, 123, 126, 120,
  115, 119, 124, 128, 122, 118, 120, 125, 122, 120,
];

// Stock exchange liquidity bars (percentage width)
const STOCK_BARS = [
  { label: "AAPL", width: 100 },
  { label: "TSLA", width: 82 },
  { label: "NVDA", width: 74 },
  { label: "GOOG", width: 58 },
  { label: "#50", width: 22 },
  { label: "#200", width: 8 },
  { label: "#500", width: 3 },
  { label: "#2,000", width: 0.5 },
  { label: "#8,000", width: 0 },
];

const GM_BARS = [
  { label: "xQc" },
  { label: "Kai" },
  { label: "Poki" },
  { label: "#500" },
  { label: "#2k" },
  { label: "#4k" },
  { label: "#5k" },
];

// ── Sparkline SVG ─────────────────────────────────────────────────────────

const Sparkline: React.FC<{
  data: number[];
  width: number;
  height: number;
  drawProgress: number;
  color?: string;
}> = ({ data, width, height, drawProgress, color = COLOR.wiseGreen }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const padding = 2;
  const usableH = height - padding * 2;
  const usableW = width - padding * 2;

  const points = data.map((v, i) => ({
    x: padding + (i / (data.length - 1)) * usableW,
    y: padding + usableH - ((v - min) / range) * usableH,
  }));

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  // Approximate path length
  let pathLen = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    pathLen += Math.sqrt(dx * dx + dy * dy);
  }

  const dashOffset = pathLen * (1 - drawProgress);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={pathLen}
        strokeDashoffset={dashOffset}
      />
    </svg>
  );
};

// ── Beat 1: The Batch ─────────────────────────────────────────────────────

const BatchGrid: React.FC<{ frame: number; fps: number; beatFrame: number }> = ({
  frame,
  fps,
  beatFrame,
}) => {
  // Counter animation: 0 → 5000
  const counterProgress = interpolate(
    beatFrame,
    [sec(1.5), sec(3.5)],
    [0, 1],
    { ...clamp, easing: EASE_OUT },
  );
  const counterVal = Math.round(counterProgress * 5000);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>
      {/* Hero title */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginBottom: 32 }}>
        <span style={{ ...TYPE.displayHero, color: COLOR.wiseGreen }}>5,000</span>
        <span style={{ ...TYPE.cardTitle, color: COLOR.gray }}>streamers, one batch</span>
      </div>

      {/* Grid of 6 streamer cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          width: "100%",
          maxWidth: 720,
        }}
      >
        {STREAMERS.map((s, i) => {
          const stagger = i * sec(0.15);
          const cardSpring = spring({
            frame: Math.max(0, beatFrame - stagger),
            fps,
            config: { damping: 16, stiffness: 140, mass: 0.7 },
          });

          const sparkDraw = interpolate(
            beatFrame,
            [stagger + sec(0.3), stagger + sec(1.2)],
            [0, 1],
            clamp,
          );

          return (
            <div
              key={s.name}
              style={{
                ...PANEL.white,
                padding: "16px 18px",
                borderRadius: 16,
                opacity: cardSpring,
                transform: `translateY(${interpolate(cardSpring, [0, 1], [16, 0], clamp)}px) scale(${interpolate(cardSpring, [0, 1], [0.95, 1], clamp)})`,
              }}
            >
              <div style={{ ...TYPE.bodySemibold, fontSize: 24, marginBottom: 4 }}>
                {s.name}
              </div>
              <Sparkline data={s.sparkline} width={180} height={36} drawProgress={sparkDraw} />
              <div
                style={{
                  ...TYPE.caption,
                  fontSize: 22,
                  fontVariantNumeric: "tabular-nums",
                  marginTop: 4,
                  color: COLOR.nearBlack,
                  fontWeight: 600,
                }}
              >
                {s.viewers}
              </div>
            </div>
          );
        })}
      </div>

      {/* "x 5,000" counter */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          opacity: interpolate(beatFrame, [sec(1.2), sec(1.6)], [0, 1], clamp),
        }}
      >
        <span style={{ ...TYPE.cardTitle, color: COLOR.gray }}>×</span>
        <span
          style={{
            ...TYPE.statValue,
            fontSize: 52,
            color: COLOR.wiseGreen,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {counterVal.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

// ── Beat 2: The Question ──────────────────────────────────────────────────

const QuestionCard: React.FC<{ frame: number; fps: number; beatFrame: number }> = ({
  frame,
  fps,
  beatFrame,
}) => {
  const enterSpring = spring({
    frame: beatFrame,
    fps,
    config: { damping: 16, stiffness: 120, mass: 0.8 },
  });

  // Chart dimensions
  const chartW = 560;
  const chartH = 180;
  const pad = 40;
  const plotW = chartW - pad * 2;
  const plotH = chartH - pad;

  // Build the history line
  const yMin = 100;
  const yMax = 130;
  const nowIdx = XQC_HISTORY.length;
  const totalPoints = nowIdx + 6; // 6 future points

  const toX = (i: number) => pad + (i / (totalPoints - 1)) * plotW;
  const toY = (v: number) => pad + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const historyPath = XQC_HISTORY
    .map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`)
    .join(" ");

  // Animate line drawing
  const lineDraw = interpolate(beatFrame, [sec(0.4), sec(1.8)], [0, 1], clamp);
  let histLen = 0;
  for (let i = 1; i < XQC_HISTORY.length; i++) {
    const dx = toX(i) - toX(i - 1);
    const dy = toY(XQC_HISTORY[i]) - toY(XQC_HISTORY[i - 1]);
    histLen += Math.sqrt(dx * dx + dy * dy);
  }

  const nowX = toX(nowIdx - 1);
  const futureStartX = toX(nowIdx);

  // Question mark fade
  const qFade = interpolate(beatFrame, [sec(2), sec(2.5)], [0, 1], clamp);

  // YES/NO buttons
  const btnFade = interpolate(beatFrame, [sec(2.5), sec(3)], [0, 1], clamp);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
        opacity: enterSpring,
        transform: `scale(${interpolate(enterSpring, [0, 1], [0.96, 1], clamp)})`,
      }}
    >
      {/* xQc header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
        <span style={{ ...TYPE.sectionHeading, color: COLOR.nearBlack }}>xQc</span>
        <span style={{ ...TYPE.cardTitle, color: COLOR.gray }}>120,000 viewers</span>
      </div>

      {/* Chart */}
      <svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
        {/* Y axis labels */}
        {[100, 110, 120, 130].map((v) => (
          <React.Fragment key={v}>
            <text
              x={pad - 8}
              y={toY(v) + 4}
              textAnchor="end"
              fill={COLOR.gray}
              fontSize={18}
              fontFamily="Inter"
            >
              {v}k
            </text>
            <line
              x1={pad}
              y1={toY(v)}
              x2={pad + plotW}
              y2={toY(v)}
              stroke={COLOR.border}
              strokeWidth={1}
            />
          </React.Fragment>
        ))}

        {/* Future shaded zone */}
        <rect
          x={futureStartX}
          y={pad}
          width={pad + plotW - futureStartX}
          height={plotH}
          fill="rgba(159, 232, 112, 0.08)"
          opacity={qFade}
        />

        {/* History line */}
        <path
          d={historyPath}
          fill="none"
          stroke={COLOR.nearBlack}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={histLen}
          strokeDashoffset={histLen * (1 - lineDraw)}
        />

        {/* NOW vertical line */}
        <line
          x1={nowX}
          y1={pad}
          x2={nowX}
          y2={pad + plotH}
          stroke={COLOR.wiseGreen}
          strokeWidth={2}
          strokeDasharray="6 4"
          opacity={interpolate(beatFrame, [sec(1.6), sec(2)], [0, 1], clamp)}
        />
        <text
          x={nowX}
          y={pad - 8}
          textAnchor="middle"
          fill={COLOR.wiseGreen}
          fontSize={18}
          fontWeight={700}
          fontFamily="Inter"
          opacity={interpolate(beatFrame, [sec(1.6), sec(2)], [0, 1], clamp)}
        >
          NOW
        </text>

        {/* Question mark in future zone */}
        <text
          x={(futureStartX + pad + plotW) / 2}
          y={pad + plotH / 2 + 16}
          textAnchor="middle"
          fill={COLOR.wiseGreen}
          fontSize={48}
          fontWeight={900}
          fontFamily="Inter"
          opacity={qFade}
        >
          ?
        </text>
      </svg>

      {/* Question + buttons */}
      <div
        style={{
          ...PANEL.greenAccent,
          padding: "20px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          opacity: btnFade,
          transform: `translateY(${interpolate(btnFade, [0, 1], [8, 0], clamp)}px)`,
        }}
      >
        <span style={{ ...TYPE.bodySemibold, fontSize: 24, textAlign: "center" }}>
          Will xQc have MORE viewers in 10 minutes?
        </span>
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ ...BUTTON.primary, padding: "10px 28px", fontSize: 24 }}>
            YES ▲
          </div>
          <div
            style={{
              ...BUTTON.secondary,
              padding: "10px 28px",
              fontSize: 24,
              color: COLOR.danger,
            }}
          >
            NO ▼
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Beat 3: Bet Slip ──────────────────────────────────────────────────────

const BET_ROWS = [
  { rank: 1, name: "xQc", viewers: "120k", side: "YES" },
  { rank: 2, name: "Kai Cenat", viewers: "84k", side: "NO" },
  { rank: 3, name: "Pokimane", viewers: "45k", side: "YES" },
  { rank: 4, name: "Shroud", viewers: "12k", side: "NO" },
  { rank: 5, name: "Summit1g", viewers: "8k", side: "YES" },
];

const BetSlip: React.FC<{ frame: number; fps: number; beatFrame: number }> = ({
  frame,
  fps,
  beatFrame,
}) => {
  const enterSpring = spring({
    frame: beatFrame,
    fps,
    config: { damping: 16, stiffness: 120, mass: 0.8 },
  });

  // Progress bar
  const progressVal = interpolate(beatFrame, [sec(0.5), sec(3.2)], [0, 100], clamp);
  const isReady = progressVal >= 99;

  // Submit button pulse
  const pulsePhase = (beatFrame - sec(3.5)) / sec(0.6);
  const pulseScale = isReady ? 1 + Math.sin(pulsePhase * Math.PI * 2) * 0.03 : 1;
  const submitOpacity = interpolate(beatFrame, [sec(3.2), sec(3.5)], [0, 1], clamp);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        opacity: enterSpring,
        transform: `scale(${interpolate(enterSpring, [0, 1], [0.96, 1], clamp)})`,
        width: "100%",
        maxWidth: 640,
        alignSelf: "center",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginBottom: 16 }}>
        <span style={{ ...TYPE.sectionHeading, color: COLOR.nearBlack }}>Batch Slip</span>
      </div>

      {/* Visible rows */}
      {BET_ROWS.map((row, i) => {
        const checkDelay = sec(0.5) + i * sec(0.08);
        const checkOpacity = interpolate(beatFrame, [checkDelay, checkDelay + sec(0.2)], [0, 1], clamp);
        const isYes = row.side === "YES";

        return (
          <div
            key={row.rank}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 16px",
              borderRadius: 12,
              background: i % 2 === 0 ? COLOR.lightSurface : "transparent",
              opacity: interpolate(beatFrame, [sec(0.2) + i * sec(0.06), sec(0.4) + i * sec(0.06)], [0, 1], clamp),
            }}
          >
            <span style={{ ...TYPE.caption, fontSize: 22, fontVariantNumeric: "tabular-nums", width: 32, color: COLOR.gray }}>
              #{row.rank}
            </span>
            <span style={{ ...TYPE.bodySemibold, fontSize: 24, flex: 1 }}>{row.name}</span>
            <span style={{ ...TYPE.caption, fontSize: 22, fontVariantNumeric: "tabular-nums", width: 56 }}>
              {row.viewers}
            </span>
            <span
              style={{
                ...TYPE.bodySemibold,
                fontSize: 22,
                color: isYes ? COLOR.darkGreen : COLOR.danger,
                width: 40,
              }}
            >
              {row.side}
            </span>
            <span
              style={{
                fontSize: 22,
                color: COLOR.wiseGreen,
                opacity: checkOpacity,
                transform: `scale(${interpolate(checkOpacity, [0, 1], [0.5, 1], clamp)})`,
              }}
            >
              ✓
            </span>
          </div>
        );
      })}

      {/* Ellipsis row */}
      <div
        style={{
          textAlign: "center",
          ...TYPE.bodySemibold,
          fontSize: 22,
          color: COLOR.gray,
          padding: "6px 0",
          opacity: interpolate(beatFrame, [sec(1.2), sec(1.5)], [0, 1], clamp),
        }}
      >
        · · · 4,995 more · · ·
      </div>

      {/* Last row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          borderRadius: 12,
          background: COLOR.lightSurface,
          opacity: interpolate(beatFrame, [sec(1.5), sec(1.8)], [0, 1], clamp),
        }}
      >
        <span style={{ ...TYPE.caption, fontSize: 22, fontVariantNumeric: "tabular-nums", width: 32, color: COLOR.gray }}>
          #5000
        </span>
        <span style={{ ...TYPE.bodySemibold, fontSize: 24, flex: 1 }}>tiny_streamer</span>
        <span style={{ ...TYPE.caption, fontSize: 22, fontVariantNumeric: "tabular-nums", width: 56 }}>12</span>
        <span style={{ ...TYPE.bodySemibold, fontSize: 22, color: COLOR.danger, width: 40 }}>NO</span>
        <span
          style={{
            fontSize: 22,
            color: COLOR.wiseGreen,
            opacity: interpolate(beatFrame, [sec(1.8), sec(2)], [0, 1], clamp),
            transform: `scale(${interpolate(
              interpolate(beatFrame, [sec(1.8), sec(2)], [0, 1], clamp),
              [0, 1],
              [0.5, 1],
              clamp,
            )})`,
          }}
        >
          ✓
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 12 }}>
        <div
          style={{
            height: 8,
            background: COLOR.lightSurface,
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressVal}%`,
              background: COLOR.wiseGreen,
              borderRadius: 4,
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 8,
          }}
        >
          <span style={{ ...TYPE.caption, fontSize: 22, fontVariantNumeric: "tabular-nums" }}>
            {Math.round(progressVal * 50).toLocaleString()} / 5,000
          </span>
          {isReady && (
            <span
              style={{
                ...TYPE.bodySemibold,
                fontSize: 22,
                color: COLOR.darkGreen,
                opacity: interpolate(beatFrame, [sec(3.2), sec(3.5)], [0, 1], clamp),
              }}
            >
              Ready to submit
            </span>
          )}
        </div>
      </div>

      {/* Submit button */}
      <div
        style={{
          alignSelf: "center",
          marginTop: 8,
          opacity: submitOpacity,
          transform: `scale(${pulseScale})`,
        }}
      >
        <div
          style={{
            ...BUTTON.primary,
            padding: "14px 48px",
            fontSize: 24,
            boxShadow: isReady ? `0 0 20px rgba(159, 232, 112, 0.4)` : "none",
          }}
        >
          Submit Batch
        </div>
      </div>
    </div>
  );
};

// ── Beat 4: Liquidity Comparison ──────────────────────────────────────────

const LiquidityComparison: React.FC<{ frame: number; fps: number; beatFrame: number }> = ({
  frame,
  fps,
  beatFrame,
}) => {
  const enterSpring = spring({
    frame: beatFrame,
    fps,
    config: { damping: 16, stiffness: 120, mass: 0.8 },
  });

  const leftDelay = sec(0.5);
  const rightDelay = sec(2);

  // Bottom text fade
  const bottomFade = interpolate(beatFrame, [sec(4), sec(4.8)], [0, 1], clamp);

  const BAR_H = 24;
  const BAR_GAP = 8;
  const MAX_BAR_W = 280;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 32,
        opacity: enterSpring,
        transform: `scale(${interpolate(enterSpring, [0, 1], [0.96, 1], clamp)})`,
        width: "100%",
      }}
    >
      {/* Hero title */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginBottom: 32 }}>
        <span style={{ ...TYPE.displayHero, color: COLOR.wiseGreen }}>Liquidity</span>
        <span style={{ ...TYPE.cardTitle, color: COLOR.gray }}>for everyone</span>
      </div>

      <div style={{ display: "flex", gap: 56, justifyContent: "center", width: "100%" }}>
        {/* LEFT: Stock Exchange */}
        <div style={{ flex: 1, maxWidth: 360 }}>
          <div style={{ ...TYPE.cardTitle, fontSize: 24, marginBottom: 20, color: COLOR.gray }}>
            Stock Exchange
          </div>
          {STOCK_BARS.map((bar, i) => {
            const barDelay = leftDelay + i * sec(0.12);
            const barProgress = interpolate(
              beatFrame,
              [barDelay, barDelay + sec(0.5)],
              [0, 1],
              { ...clamp, easing: EASE_OUT },
            );
            const barW = bar.width * barProgress;

            return (
              <div
                key={bar.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: BAR_GAP,
                  opacity: interpolate(beatFrame, [barDelay, barDelay + sec(0.2)], [0, 1], clamp),
                }}
              >
                <span
                  style={{
                    ...TYPE.caption,
                    fontSize: 20,
                    fontVariantNumeric: "tabular-nums",
                    width: 64,
                    textAlign: "right",
                    color: COLOR.gray,
                  }}
                >
                  {bar.label}
                </span>
                <div
                  style={{
                    height: BAR_H,
                    width: (barW / 100) * MAX_BAR_W,
                    minWidth: bar.width > 0 ? 2 : 0,
                    background: COLOR.lightSurface,
                    borderRadius: BAR_H / 2,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* RIGHT: General Market */}
        <div style={{ flex: 1, maxWidth: 360 }}>
          <div style={{ ...TYPE.cardTitle, fontSize: 24, marginBottom: 20, color: COLOR.wiseGreen }}>
            General Market
          </div>
          {GM_BARS.map((bar, i) => {
            const barDelay = rightDelay + i * sec(0.12);
            const barProgress = interpolate(
              beatFrame,
              [barDelay, barDelay + sec(0.5)],
              [0, 1],
              { ...clamp, easing: EASE_OUT },
            );
            const barW = 100 * barProgress;

            return (
              <div
                key={bar.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: BAR_GAP,
                  opacity: interpolate(beatFrame, [barDelay, barDelay + sec(0.2)], [0, 1], clamp),
                }}
              >
                <span
                  style={{
                    ...TYPE.caption,
                    fontSize: 20,
                    fontVariantNumeric: "tabular-nums",
                    width: 64,
                    textAlign: "right",
                    color: COLOR.nearBlack,
                    fontWeight: 600,
                  }}
                >
                  {bar.label}
                </span>
                <div
                  style={{
                    height: BAR_H,
                    width: (barW / 100) * MAX_BAR_W,
                    background: COLOR.wiseGreen,
                    borderRadius: BAR_H / 2,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom captions */}
      <div
        style={{
          display: "flex",
          gap: 56,
          justifyContent: "center",
          width: "100%",
          opacity: bottomFade,
          transform: `translateY(${interpolate(bottomFade, [0, 1], [8, 0], clamp)}px)`,
        }}
      >
        <div style={{ flex: 1, maxWidth: 360, textAlign: "center" }}>
          <span style={{ ...TYPE.caption, fontSize: 22, color: COLOR.gray }}>
            Top 5 get 90% volume
          </span>
          <br />
          <span style={{ ...TYPE.caption, fontSize: 22, color: COLOR.gray, fontStyle: "italic" }}>
            The rest: no one cares
          </span>
        </div>
        <div style={{ flex: 1, maxWidth: 360, textAlign: "center" }}>
          <span style={{ ...TYPE.bodySemibold, fontSize: 22, color: COLOR.darkGreen }}>
            Everyone trades everything
          </span>
        </div>
      </div>
    </div>
  );
};

// ── Main Card (all beats inside one DiagramCard) ──────────────────────────

const LiquidityCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Beat-local frames (relative to each beat's start within this Sequence)
  const b1Frame = frame - BEAT1_START;
  const b2Frame = frame - BEAT2_START;
  const b3Frame = frame - BEAT3_START;
  const b4Frame = frame - BEAT4_START;

  // Crossfade opacities between beats
  const beat1Opacity = interpolate(
    frame,
    [BEAT1_START, BEAT1_START + sec(0.3), BEAT2_START - sec(0.3), BEAT2_START],
    [0, 1, 1, 0],
    clamp,
  );

  const beat2Opacity = interpolate(
    frame,
    [BEAT2_START, BEAT2_START + sec(0.3), BEAT3_START - sec(0.3), BEAT3_START],
    [0, 1, 1, 0],
    clamp,
  );

  const beat3Opacity = interpolate(
    frame,
    [BEAT3_START, BEAT3_START + sec(0.3), BEAT4_START - sec(0.3), BEAT4_START],
    [0, 1, 1, 0],
    clamp,
  );

  const beat4Opacity = interpolate(
    frame,
    [BEAT4_START, BEAT4_START + sec(0.3), CONTENT_END, EXIT_END],
    [0, 1, 1, 0],
    clamp,
  );

  // Nothing visible before BEAT1_START
  if (frame < BEAT1_START - sec(0.5)) return null;

  return (
    <DiagramCard padding="40px 56px">
      {/* Beat 1 — Batch Grid */}
      {beat1Opacity > 0.01 && (
        <AbsoluteFill
          style={{
            opacity: beat1Opacity,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 56px",
          }}
        >
          <BatchGrid frame={frame} fps={fps} beatFrame={b1Frame} />
        </AbsoluteFill>
      )}

      {/* Beat 2 — The Question */}
      {beat2Opacity > 0.01 && (
        <AbsoluteFill
          style={{
            opacity: beat2Opacity,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 56px",
          }}
        >
          <QuestionCard frame={frame} fps={fps} beatFrame={b2Frame} />
        </AbsoluteFill>
      )}

      {/* Beat 3 — Bet Slip */}
      {beat3Opacity > 0.01 && (
        <AbsoluteFill
          style={{
            opacity: beat3Opacity,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 56px",
          }}
        >
          <BetSlip frame={frame} fps={fps} beatFrame={b3Frame} />
        </AbsoluteFill>
      )}

      {/* Beat 4 — Liquidity Comparison */}
      {beat4Opacity > 0.01 && (
        <AbsoluteFill
          style={{
            opacity: beat4Opacity,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 56px",
          }}
        >
          <LiquidityComparison frame={frame} fps={fps} beatFrame={b4Frame} />
        </AbsoluteFill>
      )}
    </DiagramCard>
  );
};

// ── Export ─────────────────────────────────────────────────────────────────

export const LiquidityDiagrams: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence from={BEAT1_START} durationInFrames={EXIT_END - BEAT1_START}>
        <LiquidityCard />
        <Audio src={staticFile("sfx/scroll-tick.mp3")} volume={0.4} />
      </Sequence>
      <Sequence from={BEAT3_START} durationInFrames={sec(1)}>
        <Audio src={staticFile("sfx/text-pop-rapid-sequence.mp3")} volume={0.3} />
      </Sequence>
      <Sequence from={BEAT4_START + sec(2)} durationInFrames={sec(1)}>
        <Audio src={staticFile("sfx/dramatic-reveal.mp3")} volume={0.35} />
      </Sequence>
    </AbsoluteFill>
  );
};
