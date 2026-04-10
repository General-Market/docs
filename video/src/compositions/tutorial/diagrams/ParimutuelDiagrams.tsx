import React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLOR, TYPE, PANEL } from "../designTokens";
import { FPS } from "../theme";
import { DiagramCard } from "../components/DiagramCard";
import { Sfx } from "../components/Sfx";

const sec = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

// Local timing: frame 0 = 89.84s in video.
// Beats start at local ~41.2s and end at ~69.2s.
const BEAT1_IN = sec(41.2);
const BEAT1_OUT = sec(45.2);
const BEAT2_IN = sec(45.2);
const BEAT2_OUT = sec(52.2);
const BEAT3_IN = sec(52.2);
const BEAT3_OUT = sec(60.2);
const BEAT4_IN = sec(60.2);
const BEAT4_OUT = sec(69.2);

// ── Data ──────────────────────────────────────────────────────────────────

const CHART_POINTS = [
  { x: 0, y: 14 },
  { x: 0.12, y: 11 },
  { x: 0.25, y: 13 },
  { x: 0.38, y: 10 },
  { x: 0.5, y: 15 },
  { x: 0.62, y: 11 },
  { x: 0.75, y: 14 },
  { x: 0.82, y: 12 },
];

const YES_BETTORS = [
  { name: "Alice", amount: 50 },
  { name: "Bob", amount: 120 },
  { name: "Carol", amount: 40 },
  { name: "Dan", amount: 80 },
  { name: "Eve", amount: 50 },
];
const YES_TOTAL = YES_BETTORS.reduce((s, b) => s + b.amount, 0); // 340

const NO_BETTORS = [
  { name: "Frank", amount: 30 },
  { name: "Grace", amount: 80 },
  { name: "Hank", amount: 20 },
  { name: "Ivy", amount: 40 },
  { name: "Jake", amount: 40 },
];
const NO_TOTAL = NO_BETTORS.reduce((s, b) => s + b.amount, 0); // 210

const POOL_TOTAL = YES_TOTAL + NO_TOTAL; // 550

// Each YES bettor wins proportional share of NO pool
const yesPnl = YES_BETTORS.map((b) => ({
  ...b,
  pnl: +((b.amount / YES_TOTAL) * NO_TOTAL).toFixed(2),
}));

interface StationRow {
  station: string;
  delayBefore: number;
  delayAfter: number;
  bet: "YES" | "NO";
  result: number;
}

const STATIONS: StationRow[] = [
  { station: "Frankfurt Hbf", delayBefore: 12, delayAfter: 17, bet: "YES", result: 18.2 },
  { station: "München Hbf", delayBefore: 8, delayAfter: 6, bet: "YES", result: -10.0 },
  { station: "Berlin Hbf", delayBefore: 5, delayAfter: 9, bet: "NO", result: -5.5 },
  { station: "Hamburg Hbf", delayBefore: 3, delayAfter: 3, bet: "NO", result: 4.3 },
  { station: "Köln Hbf", delayBefore: 4, delayAfter: 7, bet: "YES", result: 7.1 },
  { station: "Stuttgart Hbf", delayBefore: 2, delayAfter: 1, bet: "NO", result: 3.4 },
  { station: "Dresden Hbf", delayBefore: 9, delayAfter: 12, bet: "YES", result: 11.8 },
  { station: "Leipzig Hbf", delayBefore: 6, delayAfter: 4, bet: "NO", result: 2.6 },
];

const TOTAL_PNL = 12.4;

// ── Beat 1: Chart ─────────────────────────────────────────────────────────

const ChartBeat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = BEAT1_OUT - BEAT1_IN;

  // Chart area dimensions
  const chartW = 700;
  const chartH = 320;
  const padL = 60;
  const padR = 40;
  const padT = 20;
  const padB = 40;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const yMin = 0;
  const yMax = 20;

  const toSvgX = (pct: number) => padL + pct * innerW;
  const toSvgY = (val: number) =>
    padT + innerH - ((val - yMin) / (yMax - yMin)) * innerH;

  // Build path
  const pathPoints = CHART_POINTS.map((p) => ({
    sx: toSvgX(p.x),
    sy: toSvgY(p.y),
  }));
  const pathD = pathPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.sx} ${p.sy}`)
    .join(" ");

  // Approximate total path length
  let pathLen = 0;
  for (let i = 1; i < pathPoints.length; i++) {
    const dx = pathPoints[i].sx - pathPoints[i - 1].sx;
    const dy = pathPoints[i].sy - pathPoints[i - 1].sy;
    pathLen += Math.sqrt(dx * dx + dy * dy);
  }

  // Draw progress
  const drawProgress = interpolate(frame, [0, sec(1.8)], [0, 1], {
    ...clamp,
    easing: EASE_OUT,
  });
  const dashOffset = pathLen * (1 - drawProgress);

  // NOW line
  const nowX = toSvgX(0.82);
  const nowDrop = interpolate(frame, [sec(1.6), sec(2.2)], [0, 1], {
    ...clamp,
    easing: EASE_OUT,
  });

  // Future zone
  const futureOpacity = interpolate(frame, [sec(2.0), sec(2.6)], [0, 0.25], clamp);

  // Question box
  const questionSpring = spring({
    frame: Math.max(0, frame - sec(2.4)),
    fps,
    config: { damping: 14, stiffness: 140, mass: 0.7 },
  });

  // Exit
  const exitOpacity = interpolate(frame, [duration - sec(0.6), duration], [1, 0], clamp);

  return (
    <DiagramCard>
      <Sfx sound="scroll-tick" volume={0.3} />
      <div style={{ opacity: exitOpacity }}>
        {/* Title */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginBottom: 32 }}>
          <span style={{ ...TYPE.sectionHeading, color: COLOR.nearBlack }}>Frankfurt Hbf</span>
          <span style={{ ...TYPE.cardTitle, color: COLOR.gray }}>Train Delay</span>
        </div>

        {/* Chart */}
        <svg width={chartW} height={chartH} style={{ display: "block", margin: "0 auto" }}>
          {/* Y axis labels */}
          {[0, 5, 10, 15, 20].map((v) => (
            <React.Fragment key={v}>
              <line
                x1={padL}
                y1={toSvgY(v)}
                x2={chartW - padR}
                y2={toSvgY(v)}
                stroke={COLOR.border}
                strokeWidth={1}
              />
              <text
                x={padL - 12}
                y={toSvgY(v) + 4}
                textAnchor="end"
                fill={COLOR.gray}
                fontSize={18}
                fontFamily="Inter"
                fontWeight={500}
              >
                {v}m
              </text>
            </React.Fragment>
          ))}

          {/* X axis labels */}
          {[
            { pct: 0, label: "6:00" },
            { pct: 0.25, label: "6:15" },
            { pct: 0.82, label: "NOW" },
            { pct: 1.0, label: "+10m" },
          ].map((tick) => (
            <text
              key={tick.label}
              x={toSvgX(tick.pct)}
              y={chartH - 8}
              textAnchor="middle"
              fill={tick.label === "NOW" ? COLOR.wiseGreen : COLOR.gray}
              fontSize={18}
              fontFamily="Inter"
              fontWeight={tick.label === "NOW" ? 700 : 500}
            >
              {tick.label}
            </text>
          ))}

          {/* Future zone */}
          <rect
            x={nowX}
            y={padT}
            width={chartW - padR - nowX}
            height={innerH}
            fill={COLOR.wiseGreen}
            opacity={futureOpacity}
            rx={4}
          />

          {/* Line */}
          <path
            d={pathD}
            fill="none"
            stroke={COLOR.wiseGreen}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLen}
            strokeDashoffset={dashOffset}
          />

          {/* NOW vertical line */}
          <line
            x1={nowX}
            y1={padT}
            x2={nowX}
            y2={padT + innerH}
            stroke={COLOR.wiseGreen}
            strokeWidth={1.5}
            strokeDasharray="6 4"
            opacity={nowDrop}
          />

          {/* Current value annotation */}
          {drawProgress > 0.9 && (
            <g
              opacity={interpolate(frame, [sec(1.6), sec(2.0)], [0, 1], clamp)}
            >
              <rect
                x={nowX + 8}
                y={toSvgY(12) - 14}
                width={68}
                height={30}
                rx={6}
                fill={COLOR.wiseGreen}
              />
              <text
                x={nowX + 42}
                y={toSvgY(12) + 2}
                textAnchor="middle"
                fill={COLOR.darkGreen}
                fontSize={18}
                fontWeight={700}
                fontFamily="Inter"
              >
                12 min
              </text>
            </g>
          )}
        </svg>
        <Sfx sound="metric-count-up" volume={0.3} delay={sec(1.6)} />

        {/* Question box */}
        <Sfx sound="dramatic-reveal" volume={0.35} delay={sec(2.4)} />
        <div
          style={{
            marginTop: 24,
            opacity: questionSpring,
            transform: `translateY(${interpolate(questionSpring, [0, 1], [16, 0], clamp)}px)`,
            ...PANEL.greenAccent,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ ...TYPE.bodySemibold }}>
            Will delay be HIGHER in 10 min?
          </span>
          <div style={{ display: "flex", gap: 12 }}>
            <div
              style={{
                background: COLOR.wiseGreen,
                borderRadius: 9999,
                padding: "8px 20px",
                ...TYPE.bodySemibold,
                fontSize: 26,
                color: COLOR.darkGreen,
              }}
            >
              YES ▲
            </div>
            <div
              style={{
                background: "rgba(208,50,56,0.12)",
                borderRadius: 9999,
                padding: "8px 20px",
                ...TYPE.bodySemibold,
                fontSize: 26,
                color: COLOR.danger,
              }}
            >
              NO ▼
            </div>
          </div>
        </div>
      </div>
    </DiagramCard>
  );
};

// ── Beat 2: YES vs NO Pool ────────────────────────────────────────────────

const PoolBeat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = BEAT2_OUT - BEAT2_IN;

  const exitOpacity = interpolate(frame, [duration - sec(0.6), duration], [1, 0], clamp);

  // Bettor cascade
  const bettorOpacity = (i: number, side: "yes" | "no") => {
    const baseDelay = side === "yes" ? sec(0.3) : sec(0.3);
    const offset = baseDelay + i * sec(0.25);
    return spring({
      frame: Math.max(0, frame - offset),
      fps,
      config: { damping: 16, stiffness: 160, mass: 0.5 },
    });
  };

  // Pool total count-up
  const poolFillFrame = sec(2.5);
  const poolProgress = interpolate(frame, [sec(1.5), poolFillFrame], [0, 1], {
    ...clamp,
    easing: EASE_OUT,
  });
  const poolDisplay = Math.round(poolProgress * POOL_TOTAL);

  // Result banner
  const resultOpacity = interpolate(frame, [sec(3.2), sec(3.6)], [0, 1], clamp);

  // PnL reveal
  const pnlReveal = interpolate(frame, [sec(4.2), sec(4.8)], [0, 1], {
    ...clamp,
    easing: EASE_OUT,
  });

  // NO column dims
  const noDim = interpolate(frame, [sec(4.0), sec(4.6)], [1, 0.3], clamp);

  const renderBettorColumn = (
    bettors: { name: string; amount: number }[],
    side: "yes" | "no",
    total: number,
    pnlData?: { name: string; amount: number; pnl: number }[],
  ) => {
    const isYes = side === "yes";
    const borderColor = isYes ? COLOR.wiseGreen : COLOR.danger;
    const dimFactor = isYes ? 1 : noDim;

    return (
      <div
        style={{
          flex: 1,
          border: `2px solid ${borderColor}`,
          borderRadius: 20,
          padding: "20px 24px",
          opacity: dimFactor,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            ...TYPE.label,
            fontSize: 26,
            color: isYes ? COLOR.darkGreen : COLOR.danger,
            marginBottom: 4,
          }}
        >
          {isYes ? "YES ▲" : "NO ▼"}
        </div>
        {bettors.map((b, i) => {
          const s = bettorOpacity(i, side);
          const pnl = isYes && pnlData ? pnlData[i].pnl : undefined;
          const bettorDelay = sec(0.3) + i * sec(0.25);
          return (
            <React.Fragment key={b.name}>
            <Sfx volume={0.2} delay={bettorDelay} />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                opacity: s,
                transform: `translateX(${interpolate(s, [0, 1], [isYes ? -12 : 12, 0], clamp)}px)`,
              }}
            >
              <span style={{ ...TYPE.bodySemibold, fontSize: 26 }}>{b.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    ...TYPE.body,
                    fontSize: 26,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  ${b.amount}
                </span>
                {pnl !== undefined && pnlReveal > 0 && (
                  <span
                    style={{
                      ...TYPE.bodySemibold,
                      fontSize: 26,
                      color: COLOR.wiseGreen,
                      fontVariantNumeric: "tabular-nums",
                      opacity: pnlReveal,
                    }}
                  >
                    +${pnl.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
            </React.Fragment>
          );
        })}
        <div
          style={{
            borderTop: `1px solid ${COLOR.border}`,
            marginTop: 4,
            paddingTop: 8,
            ...TYPE.bodySemibold,
            fontSize: 26,
            fontVariantNumeric: "tabular-nums",
            textAlign: "right",
          }}
        >
          Total: ${total}
        </div>
      </div>
    );
  };

  return (
    <DiagramCard>
      <div style={{ opacity: exitOpacity }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginBottom: 24 }}>
          <span style={{ ...TYPE.sectionHeading, color: COLOR.wiseGreen }}>The Pool</span>
          <span style={{ ...TYPE.cardTitle, color: COLOR.gray }}>YES vs NO</span>
        </div>

        <div style={{ display: "flex", gap: 24, marginBottom: 24 }}>
          {renderBettorColumn(YES_BETTORS, "yes", YES_TOTAL, yesPnl)}

          {/* Center pool box */}
          <div
            style={{
              width: 120,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Sfx sound="money-count" volume={0.3} delay={sec(1.5)} />
            <div
              style={{
                ...PANEL.greenAccent,
                padding: "16px 20px",
                textAlign: "center",
                width: "100%",
              }}
            >
              <div style={{ ...TYPE.label, fontSize: 26, marginBottom: 4 }}>
                POOL
              </div>
              <div
                style={{
                  ...TYPE.statValue,
                  fontSize: 28,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                ${poolDisplay}
              </div>
            </div>
          </div>

          {renderBettorColumn(NO_BETTORS, "no", NO_TOTAL)}
        </div>

        {/* Result banner */}
        <Sfx sound="dramatic-reveal" volume={0.35} delay={sec(3.2)} />
        <Sfx sound="metric-count-up" volume={0.3} delay={sec(4.2)} />
        <div
          style={{
            opacity: resultOpacity,
            transform: `scaleX(${interpolate(resultOpacity, [0, 1], [0.8, 1], clamp)})`,
            background: COLOR.lightMint,
            borderRadius: 16,
            padding: "16px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          }}
        >
          <span style={{ ...TYPE.bodySemibold, color: COLOR.darkGreen }}>
            10 min later: delay → 17 min.
          </span>
          <span
            style={{
              ...TYPE.bodySemibold,
              color: COLOR.wiseGreen,
              fontSize: 28,
            }}
          >
            YES wins.
          </span>
        </div>
      </div>
    </DiagramCard>
  );
};

// ── Beat 3: 30 Stations Table ─────────────────────────────────────────────

const TableBeat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = BEAT3_OUT - BEAT3_IN;

  const exitOpacity = interpolate(frame, [duration - sec(0.6), duration], [1, 0], clamp);

  const rowStagger = (i: number) =>
    spring({
      frame: Math.max(0, frame - sec(0.3) - i * sec(0.15)),
      fps,
      config: { damping: 18, stiffness: 160, mass: 0.5 },
    });

  // PnL counter
  const counterStart = sec(0.3 + STATIONS.length * 0.15 + 0.5);
  const counterProgress = interpolate(
    frame,
    [counterStart, counterStart + sec(1.2)],
    [0, 1],
    { ...clamp, easing: EASE_OUT },
  );
  const pnlDisplay = (counterProgress * TOTAL_PNL).toFixed(2);

  // Win rate bar
  const winRateProgress = interpolate(
    frame,
    [counterStart + sec(0.3), counterStart + sec(1.5)],
    [0, 1],
    { ...clamp, easing: EASE_OUT },
  );

  // "more stations" row
  const moreOpacity = rowStagger(STATIONS.length);

  const winPct = 60; // 18W out of 30

  return (
    <DiagramCard padding="40px 56px">
      <div style={{ opacity: exitOpacity }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginBottom: 24 }}>
          <span style={{ ...TYPE.displayHero, color: COLOR.wiseGreen }}>30 stations</span>
          <span style={{ ...TYPE.cardTitle, color: COLOR.gray }}>one batch</span>
        </div>

        {/* Table header */}
        <div
          style={{
            display: "flex",
            padding: "8px 0",
            borderBottom: `1px solid ${COLOR.border}`,
            marginBottom: 4,
          }}
        >
          {["STATION", "DELAY", "BET", "RESULT"].map((col, i) => (
            <span
              key={col}
              style={{
                ...TYPE.label,
                fontSize: 24,
                flex: i === 0 ? 2 : 1,
                textAlign: i === 3 ? "right" : "left",
              }}
            >
              {col}
            </span>
          ))}
        </div>

        {/* Rows */}
        {STATIONS.map((row, i) => {
          const s = rowStagger(i);
          const isPositive = row.result > 0;
          const rowDelay = sec(0.3) + i * sec(0.15);
          return (
            <React.Fragment key={row.station}>
            <Sfx volume={0.2} delay={rowDelay} />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "7px 0",
                borderBottom: `1px solid ${COLOR.border}`,
                opacity: s,
                transform: `translateY(${interpolate(s, [0, 1], [8, 0], clamp)}px)`,
              }}
            >
              <span style={{ ...TYPE.body, fontSize: 26, flex: 2 }}>
                {row.station}
              </span>
              <span
                style={{
                  ...TYPE.body,
                  fontSize: 26,
                  flex: 1,
                  fontVariantNumeric: "tabular-nums",
                  color: COLOR.gray,
                }}
              >
                {row.delayBefore}→{row.delayAfter}m
              </span>
              <span
                style={{
                  ...TYPE.bodySemibold,
                  fontSize: 26,
                  flex: 1,
                  color: row.bet === "YES" ? COLOR.darkGreen : COLOR.danger,
                }}
              >
                {row.bet} {row.bet === "YES" ? "▲" : "▼"}
              </span>
              <span
                style={{
                  ...TYPE.bodySemibold,
                  fontSize: 26,
                  flex: 1,
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                  color: isPositive ? COLOR.wiseGreen : COLOR.danger,
                }}
              >
                {isPositive ? "+" : ""}${Math.abs(row.result).toFixed(2)}
              </span>
            </div>
            </React.Fragment>
          );
        })}

        {/* More stations */}
        <div
          style={{
            ...TYPE.caption,
            textAlign: "center",
            padding: "10px 0",
            opacity: moreOpacity,
          }}
        >
          · · · 22 more stations · · ·
        </div>

        {/* Summary */}
        <Sfx sound="shape-drop-bounce" volume={0.25} delay={counterStart} />
        <Sfx sound="metric-count-up" volume={0.3} delay={counterStart} />
        <div
          style={{
            borderTop: `2px solid ${COLOR.nearBlack}`,
            marginTop: 4,
            paddingTop: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Win/Loss + bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ ...TYPE.bodySemibold, fontSize: 26 }}>
              18W 12L
            </span>
            <div
              style={{
                width: 160,
                height: 10,
                borderRadius: 5,
                background: COLOR.lightSurface,
                overflow: "hidden",
                display: "flex",
              }}
            >
              <div
                style={{
                  width: `${winPct * winRateProgress}%`,
                  height: "100%",
                  background: COLOR.wiseGreen,
                  borderRadius: "5px 0 0 5px",
                }}
              />
              <div
                style={{
                  width: `${(100 - winPct) * winRateProgress}%`,
                  height: "100%",
                  background: COLOR.danger,
                  borderRadius: "0 5px 5px 0",
                }}
              />
            </div>
          </div>

          {/* Total PnL */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ ...TYPE.label, fontSize: 26 }}>TOTAL PNL</span>
            <span
              style={{
                ...TYPE.statValue,
                fontSize: 36,
                color: COLOR.wiseGreen,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              +${pnlDisplay}
            </span>
          </div>
        </div>
      </div>
    </DiagramCard>
  );
};

// ── Beat 4: Fairness Cap ──────────────────────────────────────────────────

const FairnessBeat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = BEAT4_OUT - BEAT4_IN;

  // Phase 1: size contrast (0 → 4s)
  const yourBoxSpring = spring({
    frame: Math.max(0, frame - sec(0.3)),
    fps,
    config: { damping: 14, stiffness: 140, mass: 0.7 },
  });

  const whaleBoxSpring = spring({
    frame: Math.max(0, frame - sec(1.0)),
    fps,
    config: { damping: 10, stiffness: 200, mass: 1.2 },
  });

  // Phase 2: whale shrinks (4s → 8s)
  const shrinkStart = sec(4.0);
  const shrinkSpring = spring({
    frame: Math.max(0, frame - shrinkStart),
    fps,
    config: { damping: 12, stiffness: 80, mass: 1.0 },
  });

  const YOUR_HEIGHT = 100;
  const WHALE_MAX_HEIGHT = 340;
  const whaleHeight = interpolate(
    shrinkSpring,
    [0, 1],
    [WHALE_MAX_HEIGHT, YOUR_HEIGHT],
    clamp,
  );

  // Label crossfade
  const labelFade = interpolate(frame, [shrinkStart, shrinkStart + sec(1.5)], [0, 1], clamp);

  // "vs" and "matched" labels
  const vsOpacity = interpolate(frame, [shrinkStart + sec(1.0), shrinkStart + sec(1.5)], [0, 1], clamp);

  // Bottom text
  const fairTextOpacity = interpolate(
    frame,
    [shrinkStart + sec(2.0), shrinkStart + sec(2.5)],
    [0, 1],
    clamp,
  );

  // Exit
  const exitOpacity = interpolate(frame, [duration - sec(1.0), duration], [1, 0], clamp);

  return (
    <DiagramCard>
      <Sfx sound="shape-drop-bounce" volume={0.25} delay={sec(0.3)} />
      <Sfx sound="shape-drop-bounce" volume={0.25} delay={sec(1.0)} />
      <Sfx sound="scroll-tick" volume={0.3} delay={shrinkStart + sec(1.0)} />
      <Sfx sound="impact-kick" volume={0.4} delay={shrinkStart + sec(2.0)} />
      <div style={{ opacity: exitOpacity }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginBottom: 32 }}>
          <span style={{ ...TYPE.displayHero, color: COLOR.wiseGreen }}>$1 vs $1</span>
          <span style={{ ...TYPE.cardTitle, color: COLOR.gray }}>fair</span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            gap: 48,
            minHeight: 380,
            paddingBottom: 16,
          }}
        >
          {/* Your box */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              opacity: yourBoxSpring,
              transform: `scale(${interpolate(yourBoxSpring, [0, 1], [0.8, 1], clamp)})`,
            }}
          >
            <div
              style={{
                width: 100,
                height: YOUR_HEIGHT,
                borderRadius: 16,
                border: `2px solid ${COLOR.wiseGreen}`,
                background: COLOR.lightMint,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  ...TYPE.statValue,
                  fontSize: 28,
                  color: COLOR.darkGreen,
                }}
              >
                $1
              </span>
            </div>
            <span style={{ ...TYPE.bodySemibold, fontSize: 26 }}>You</span>
          </div>

          {/* VS */}
          <div
            style={{
              opacity: vsOpacity,
              ...TYPE.bodySemibold,
              fontSize: 28,
              color: COLOR.gray,
              alignSelf: "center",
              transform: `translateY(-${YOUR_HEIGHT / 2}px)`,
            }}
          >
            vs
          </div>

          {/* Whale box */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              opacity: whaleBoxSpring,
              transform: `scale(${interpolate(whaleBoxSpring, [0, 1], [0.7, 1], clamp)})`,
            }}
          >
            <div
              style={{
                width: interpolate(shrinkSpring, [0, 1], [200, 100], clamp),
                height: whaleHeight,
                borderRadius: 16,
                border: `2px solid ${COLOR.nearBlack}`,
                background: COLOR.lightSurface,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  ...TYPE.statValue,
                  fontSize: interpolate(shrinkSpring, [0, 1], [26, 32], clamp),
                  color: COLOR.nearBlack,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {labelFade < 0.5 ? "$1,000,000" : "$1"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ ...TYPE.bodySemibold, fontSize: 26 }}>Whale</span>
              {vsOpacity > 0.5 && (
                <span
                  style={{
                    ...TYPE.caption,
                    fontSize: 26,
                    color: COLOR.wiseGreen,
                    opacity: vsOpacity,
                  }}
                >
                  ← matched
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bottom text */}
        <div
          style={{
            opacity: fairTextOpacity,
            transform: `translateY(${interpolate(fairTextOpacity, [0, 1], [8, 0], clamp)}px)`,
            ...PANEL.greenAccent,
            marginTop: 24,
            textAlign: "center",
          }}
        >
          <span style={{ ...TYPE.bodySemibold, color: COLOR.darkGreen }}>
            You risk $1. Whale risks $1. Fair.
          </span>
        </div>
      </div>
    </DiagramCard>
  );
};

// ── Main Export ────────────────────────────────────────────────────────────

export const ParimutuelDiagrams: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Beat 1: Chart setup */}
      <Sequence from={BEAT1_IN} durationInFrames={BEAT1_OUT - BEAT1_IN}>
        <ChartBeat />
      </Sequence>

      {/* Beat 2: YES vs NO pool */}
      <Sequence from={BEAT2_IN} durationInFrames={BEAT2_OUT - BEAT2_IN}>
        <PoolBeat />
      </Sequence>

      {/* Beat 3: 30 stations table */}
      <Sequence from={BEAT3_IN} durationInFrames={BEAT3_OUT - BEAT3_IN}>
        <TableBeat />
      </Sequence>

      {/* Beat 4: Fairness cap */}
      <Sequence from={BEAT4_IN} durationInFrames={BEAT4_OUT - BEAT4_IN}>
        <FairnessBeat />
      </Sequence>
    </AbsoluteFill>
  );
};
