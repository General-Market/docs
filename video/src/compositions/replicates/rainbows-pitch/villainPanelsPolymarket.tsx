/* villainPanelsPolymarket.tsx — two variants of the chart-bearing
   villain panels, redrawn in Polymarket's chart language: headline
   metric, range pills, right-edge ladder, animated playhead, stats
   strip. Mempool + orderbook panels are reused from villainPanels.tsx.

   Variant A: ManipulationPanel becomes a smooth pump-dump line.
   Variant B: ManipulationPanel keeps its candlesticks; only the
              surrounding chrome adopts the Polymarket frame. */

import React from "react";
import {
  FrontrunPanel,
  SpoofPanel,
  PANEL_W,
  PANEL_H,
  INTER_FONT,
  PANEL_MONO,
  type PanelOpacities,
} from "./villainPanels";

const MUTED = "rgba(255,255,255,0.55)";
const DIM = "rgba(255,255,255,0.35)";
const GRID = "rgba(255,255,255,0.06)";
const GRID_LIGHT = "rgba(255,255,255,0.04)";
const PILL_ACTIVE = "rgba(255,255,255,0.10)";
const POLY_GREEN = "#2DC576";
const POLY_RED = "#E64800";

const RANGES = ["1H", "6H", "1D", "1W", "ALL"];

type StatCol = { label: string; value: string };

type PolyFrameProps = {
  title: string;
  headline: string;
  delta: string;
  trend: "up" | "down";
  activeRange: string;
  stats: StatCol[];
  children: React.ReactNode;
};

const PolyFrame: React.FC<PolyFrameProps> = ({
  title,
  headline,
  delta,
  trend,
  activeRange,
  stats,
  children,
}) => {
  const trendColor = trend === "up" ? POLY_GREEN : POLY_RED;
  return (
    <div
      style={{
        width: PANEL_W,
        height: PANEL_H,
        background: "#0d1117",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
        fontFamily: INTER_FONT,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "16px 20px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: `1px solid ${GRID}`,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.10em",
            color: MUTED,
          }}
        >
          {title}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: POLY_GREEN,
              boxShadow: `0 0 8px ${POLY_GREEN}`,
            }}
          />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: MUTED }}>
            LIVE
          </span>
        </span>
      </div>

      <div style={{ padding: "20px 20px 14px", display: "flex", alignItems: "flex-end" }}>
        <div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: trendColor,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {headline}
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 14,
              fontWeight: 600,
              color: MUTED,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {delta}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {RANGES.map((r) => {
            const active = r === activeRange;
            return (
              <span
                key={r}
                style={{
                  padding: "5px 10px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  fontFamily: PANEL_MONO,
                  background: active ? PILL_ACTIVE : "transparent",
                  color: active ? "#fff" : DIM,
                  border: active ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
                }}
              >
                {r}
              </span>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>{children}</div>

      <div
        style={{
          padding: "14px 20px 18px",
          borderTop: `1px solid ${GRID}`,
          display: "grid",
          gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
          gap: 8,
        }}
      >
        {stats.map((s, i) => (
          <div key={i}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.10em",
                color: DIM,
                textTransform: "uppercase",
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 16,
                fontWeight: 700,
                color: "#fff",
                fontVariantNumeric: "tabular-nums",
                fontFamily: PANEL_MONO,
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Insider options-flow chart, Polymarket-styled (shared A & B) ─── */

const PLOT_W = 540;
const PLOT_H = 360;
const PAD_L = 20;
const PAD_R = 56;
const PAD_T = 18;
const PAD_B = 30;

const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

const RightLadder: React.FC = () => (
  <>
    {yTicks.map((t) => {
      const y = PAD_T + (PLOT_H - PAD_T - PAD_B) * (1 - t);
      return (
        <g key={t}>
          <line
            x1={PAD_L}
            y1={y}
            x2={PLOT_W - PAD_R + 4}
            y2={y}
            stroke={GRID_LIGHT}
            strokeWidth={1}
          />
          <text
            x={PLOT_W - PAD_R + 10}
            y={y + 3}
            fontFamily={PANEL_MONO}
            fontSize={10}
            fill={DIM}
          >
            {(t * 100).toFixed(0)}
          </text>
        </g>
      );
    })}
  </>
);

type TooltipProps = {
  x: number;
  y: number;
  label: string;
  sub: string;
  labelColor: string;
};

const Tooltip: React.FC<TooltipProps> = ({ x, y, label, sub, labelColor }) => {
  const px = Math.min(PLOT_W - PAD_R - 110, Math.max(PAD_L, x + 10));
  return (
    <g>
      <rect
        x={px}
        y={y + 4}
        width={110}
        height={36}
        rx={6}
        fill="rgba(13,17,23,0.95)"
        stroke="rgba(255,255,255,0.10)"
        strokeWidth={1}
      />
      <text
        x={px + 10}
        y={y + 18}
        fontFamily={PANEL_MONO}
        fontSize={11}
        fill={labelColor}
        fontWeight={700}
        letterSpacing="0.06em"
      >
        {label}
      </text>
      <text
        x={px + 10}
        y={y + 32}
        fontFamily={PANEL_MONO}
        fontSize={10}
        fill={MUTED}
      >
        {sub}
      </text>
    </g>
  );
};

const InsiderChart: React.FC<{ frame: number }> = ({ frame }) => {
  const plotW = PLOT_W - PAD_L - PAD_R;
  const plotH = PLOT_H - PAD_T - PAD_B;

  const NEWS_X = 0.78;
  const N = 60;
  const points: Array<[number, number]> = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    let v = 0.18 + Math.sin(t * 14) * 0.012 + Math.sin(t * 31) * 0.006;
    if (t > 0.55 && t < NEWS_X) {
      const k = (t - 0.55) / (NEWS_X - 0.55);
      v += Math.pow(k, 2.4) * 0.72;
    }
    if (t >= NEWS_X) v = 0.92 + Math.sin(t * 22) * 0.008;
    points.push([t, v]);
  }

  const drawDur = 30;
  const progress = Math.min(1, frame / drawDur);
  const visibleN = Math.max(2, Math.floor(N * progress));
  const visiblePts = points.slice(0, visibleN);

  const toX = (t: number) => PAD_L + plotW * t;
  const toY = (v: number) => PAD_T + plotH * (1 - v);

  const path = visiblePts
    .map(([t, v], i) => `${i === 0 ? "M" : "L"} ${toX(t).toFixed(2)} ${toY(v).toFixed(2)}`)
    .join(" ");

  const settle = Math.min(1, Math.max(0, (frame - drawDur) / 12));
  const playT =
    progress < 1 ? (visibleN - 1) / (N - 1) : (1 - settle) * 1 + settle * NEWS_X;
  const playPt = points[Math.min(N - 1, Math.floor(playT * (N - 1)))];
  const playX = toX(playPt[0]);
  const playY = toY(playPt[1]);
  const pulse = settle >= 1 ? (Math.sin((frame - drawDur - 12) * 0.25) + 1) / 2 : 0;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${PLOT_W} ${PLOT_H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="poly-insider-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={POLY_GREEN} stopOpacity={0.22} />
          <stop offset="100%" stopColor={POLY_GREEN} stopOpacity={0} />
        </linearGradient>
      </defs>
      <RightLadder />
      {visiblePts.length > 1 && (
        <path
          d={`${path} L ${toX(visiblePts[visiblePts.length - 1][0]).toFixed(2)} ${toY(0).toFixed(2)} L ${PAD_L} ${toY(0).toFixed(2)} Z`}
          fill="url(#poly-insider-fill)"
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={POLY_GREEN}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1={playX}
        y1={PAD_T}
        x2={playX}
        y2={PLOT_H - PAD_B}
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <circle
        cx={playX}
        cy={playY}
        r={4 + pulse * 1.5}
        fill={POLY_GREEN}
        stroke="#0d1117"
        strokeWidth={2}
      />
      {progress >= 1 && (
        <Tooltip x={playX} y={PAD_T} label="NEWS DROP" sub="+3,400% vol" labelColor={POLY_RED} />
      )}
      {[0, 0.5, 1].map((t, i) => (
        <text
          key={i}
          x={toX(t)}
          y={PLOT_H - 8}
          textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
          fontFamily={PANEL_MONO}
          fontSize={10}
          fill={DIM}
        >
          {["−24h", "−12h", "now"][i]}
        </text>
      ))}
    </svg>
  );
};

const InsiderPolyPanel: React.FC<{ frame: number }> = ({ frame }) => (
  <PolyFrame
    title="OPTIONS FLOW · ANOMALY"
    headline="+3,400%"
    delta="vs 24h avg · pre-news"
    trend="up"
    activeRange="1D"
    stats={[
      { label: "Volume", value: "$4.2M" },
      { label: "Strikes", value: "12" },
      { label: "Calls·Puts", value: "14:1" },
    ]}
  >
    <InsiderChart frame={frame} />
  </PolyFrame>
);

/* ── Variant A: pump-dump as a smooth line ─────────────────────────── */

const ManipulationLineChart: React.FC<{ frame: number }> = ({ frame }) => {
  const plotW = PLOT_W - PAD_L - PAD_R;
  const plotH = PLOT_H - PAD_T - PAD_B;

  const N = 70;
  const PEAK_X = 7 / 11;
  const DUMP_X = 9 / 11;
  const points: Array<[number, number]> = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    let v: number;
    if (t <= PEAK_X) {
      const k = t / PEAK_X;
      v = 0.32 + Math.pow(k, 2.0) * 0.63;
    } else if (t <= DUMP_X) {
      const k = (t - PEAK_X) / (DUMP_X - PEAK_X);
      v = 0.95 - Math.pow(k, 1.8) * 0.4;
    } else {
      const k = (t - DUMP_X) / (1 - DUMP_X);
      v = 0.55 - Math.pow(k, 1.4) * 0.27;
    }
    v += Math.sin(t * 47) * 0.005;
    points.push([t, Math.max(0.02, Math.min(0.98, v))]);
  }

  const drawDur = 30;
  const progress = Math.min(1, frame / drawDur);
  const visibleN = Math.max(2, Math.floor(N * progress));
  const visiblePts = points.slice(0, visibleN);

  const toX = (t: number) => PAD_L + plotW * t;
  const toY = (v: number) => PAD_T + plotH * (1 - v);

  const peakIndex = Math.floor(PEAK_X * (N - 1));
  const greenPts = visiblePts.slice(0, Math.min(peakIndex + 1, visibleN));
  const redPts = visibleN > peakIndex ? visiblePts.slice(peakIndex) : [];

  const greenPath = greenPts
    .map(([t, v], i) => `${i === 0 ? "M" : "L"} ${toX(t).toFixed(2)} ${toY(v).toFixed(2)}`)
    .join(" ");
  const redPath = redPts
    .map(([t, v], i) => `${i === 0 ? "M" : "L"} ${toX(t).toFixed(2)} ${toY(v).toFixed(2)}`)
    .join(" ");

  const settle = Math.min(1, Math.max(0, (frame - drawDur) / 12));
  const playT = progress < 1 ? (visibleN - 1) / (N - 1) : (1 - settle) * 1 + settle * DUMP_X;
  const playIdx = Math.min(N - 1, Math.floor(playT * (N - 1)));
  const playPt = points[playIdx];
  const playX = toX(playPt[0]);
  const playY = toY(playPt[1]);
  const playColor = playPt[0] > PEAK_X ? POLY_RED : POLY_GREEN;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${PLOT_W} ${PLOT_H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="poly-manip-fill-green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={POLY_GREEN} stopOpacity={0.18} />
          <stop offset="100%" stopColor={POLY_GREEN} stopOpacity={0} />
        </linearGradient>
        <linearGradient id="poly-manip-fill-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={POLY_RED} stopOpacity={0.2} />
          <stop offset="100%" stopColor={POLY_RED} stopOpacity={0} />
        </linearGradient>
      </defs>
      <RightLadder />
      {greenPts.length > 1 && (
        <path
          d={`${greenPath} L ${toX(greenPts[greenPts.length - 1][0]).toFixed(2)} ${toY(0).toFixed(2)} L ${toX(greenPts[0][0]).toFixed(2)} ${toY(0).toFixed(2)} Z`}
          fill="url(#poly-manip-fill-green)"
        />
      )}
      {redPts.length > 1 && (
        <path
          d={`${redPath} L ${toX(redPts[redPts.length - 1][0]).toFixed(2)} ${toY(0).toFixed(2)} L ${toX(redPts[0][0]).toFixed(2)} ${toY(0).toFixed(2)} Z`}
          fill="url(#poly-manip-fill-red)"
        />
      )}
      <path
        d={greenPath}
        fill="none"
        stroke={POLY_GREEN}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={redPath}
        fill="none"
        stroke={POLY_RED}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {progress >= 1 && (
        <g>
          <circle cx={toX(PEAK_X)} cy={toY(0.95)} r={3} fill="#fff" />
          <text
            x={toX(PEAK_X)}
            y={toY(0.95) - 8}
            textAnchor="middle"
            fontFamily={PANEL_MONO}
            fontSize={10}
            fontWeight={700}
            fill="#fff"
            letterSpacing="0.06em"
          >
            PEAK
          </text>
        </g>
      )}
      <line
        x1={playX}
        y1={PAD_T}
        x2={playX}
        y2={PLOT_H - PAD_B}
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <circle cx={playX} cy={playY} r={4} fill={playColor} stroke="#0d1117" strokeWidth={2} />
      {progress >= 1 && (
        <Tooltip x={playX} y={PAD_T} label="DUMP" sub="−62% in 30m" labelColor={POLY_RED} />
      )}
      {[0, 0.5, 1].map((t, i) => (
        <text
          key={i}
          x={toX(t)}
          y={PLOT_H - 8}
          textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
          fontFamily={PANEL_MONO}
          fontSize={10}
          fill={DIM}
        >
          {["t0", "t+30m", "t+1h"][i]}
        </text>
      ))}
    </svg>
  );
};

/* ── Variant B: pump-dump as candles inside the Polymarket frame ─── */

const ManipulationCandleChart: React.FC<{ frame: number }> = ({ frame }) => {
  const plotW = PLOT_W - PAD_L - PAD_R;
  const plotH = PLOT_H - PAD_T - PAD_B;

  type Candle = [number, number, number, number];
  const candles: Candle[] = [
    [0.32, 0.34, 0.3, 0.36],
    [0.34, 0.36, 0.33, 0.38],
    [0.36, 0.42, 0.35, 0.44],
    [0.42, 0.55, 0.4, 0.58],
    [0.55, 0.72, 0.53, 0.76],
    [0.72, 0.88, 0.7, 0.92],
    [0.88, 0.95, 0.86, 0.97],
    [0.95, 0.92, 0.88, 0.97],
    [0.92, 0.55, 0.5, 0.93],
    [0.55, 0.34, 0.3, 0.58],
    [0.34, 0.28, 0.26, 0.36],
    [0.28, 0.3, 0.26, 0.32],
  ];

  const reveal = Math.min(candles.length, Math.floor((frame / 26) * candles.length) + 1);
  const visible = candles.slice(0, reveal);

  const cw = plotW / candles.length;
  const bodyW = cw * 0.62;
  const toX = (i: number) => PAD_L + cw * i + cw / 2;
  const toY = (v: number) => PAD_T + plotH * (1 - v);

  const drawDur = 30;
  const progress = Math.min(1, frame / drawDur);
  const settle = Math.min(1, Math.max(0, (frame - drawDur) / 12));
  const lastIdx = Math.min(candles.length - 1, reveal - 1);
  const targetIdx = 8;
  const playIdx =
    progress < 1 ? lastIdx : Math.round((1 - settle) * lastIdx + settle * targetIdx);
  const playX = toX(playIdx);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${PLOT_W} ${PLOT_H}`} preserveAspectRatio="none">
      <RightLadder />
      {visible.map((c, i) => {
        const [o, cl, lo, hi] = c;
        const x = toX(i);
        const isUp = cl >= o;
        const color = isUp ? POLY_GREEN : POLY_RED;
        const bodyTop = toY(Math.max(o, cl));
        const bodyBottom = toY(Math.min(o, cl));
        return (
          <g key={i}>
            <line x1={x} y1={toY(hi)} x2={x} y2={toY(lo)} stroke={color} strokeWidth={1.4} />
            <rect
              x={x - bodyW / 2}
              y={bodyTop}
              width={bodyW}
              height={Math.max(2, bodyBottom - bodyTop)}
              fill={color}
              opacity={0.92}
            />
          </g>
        );
      })}
      <line
        x1={playX}
        y1={PAD_T}
        x2={playX}
        y2={PLOT_H - PAD_B}
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      {progress >= 1 && (
        <g>
          <text
            x={toX(7)}
            y={toY(0.97) - 8}
            textAnchor="middle"
            fontFamily={PANEL_MONO}
            fontSize={10}
            fontWeight={700}
            fill="#fff"
            letterSpacing="0.06em"
          >
            PEAK
          </text>
          <Tooltip x={playX} y={PAD_T} label="DUMP" sub="−62% in 30m" labelColor={POLY_RED} />
        </g>
      )}
      {[0, 0.5, 1].map((t, i) => (
        <text
          key={i}
          x={PAD_L + plotW * t}
          y={PLOT_H - 8}
          textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
          fontFamily={PANEL_MONO}
          fontSize={10}
          fill={DIM}
        >
          {["t0", "t+30m", "t+1h"][i]}
        </text>
      ))}
    </svg>
  );
};

const ManipulationPolyPanelA: React.FC<{ frame: number }> = ({ frame }) => (
  <PolyFrame
    title="PRICE · WASH TRADE"
    headline="−62%"
    delta="$0.30 · last 1h"
    trend="down"
    activeRange="1H"
    stats={[
      { label: "Volume", value: "+812%" },
      { label: "Wash trades", value: "4" },
      { label: "Holders", value: "12" },
    ]}
  >
    <ManipulationLineChart frame={frame} />
  </PolyFrame>
);

const ManipulationPolyPanelB: React.FC<{ frame: number }> = ({ frame }) => (
  <PolyFrame
    title="PRICE · WASH TRADE"
    headline="−62%"
    delta="$0.30 · last 1h"
    trend="down"
    activeRange="1H"
    stats={[
      { label: "Volume", value: "+812%" },
      { label: "Wash trades", value: "4" },
      { label: "Holders", value: "12" },
    ]}
  >
    <ManipulationCandleChart frame={frame} />
  </PolyFrame>
);

export const VillainPanelsA: React.FC<{
  opacities: PanelOpacities;
  frame: number;
  spoofIntensity: number;
}> = ({ opacities, frame, spoofIntensity }) => (
  <div style={{ position: "relative", width: PANEL_W, height: PANEL_H }}>
    <div style={{ position: "absolute", inset: 0, opacity: opacities[0] }}>
      <FrontrunPanel frame={frame} />
    </div>
    <div style={{ position: "absolute", inset: 0, opacity: opacities[1] }}>
      <SpoofPanel frame={frame} intensity={spoofIntensity} />
    </div>
    <div style={{ position: "absolute", inset: 0, opacity: opacities[2] }}>
      <InsiderPolyPanel frame={frame} />
    </div>
    <div style={{ position: "absolute", inset: 0, opacity: opacities[3] }}>
      <ManipulationPolyPanelA frame={frame} />
    </div>
  </div>
);

export const VillainPanelsB: React.FC<{
  opacities: PanelOpacities;
  frame: number;
  spoofIntensity: number;
}> = ({ opacities, frame, spoofIntensity }) => (
  <div style={{ position: "relative", width: PANEL_W, height: PANEL_H }}>
    <div style={{ position: "absolute", inset: 0, opacity: opacities[0] }}>
      <FrontrunPanel frame={frame} />
    </div>
    <div style={{ position: "absolute", inset: 0, opacity: opacities[1] }}>
      <SpoofPanel frame={frame} intensity={spoofIntensity} />
    </div>
    <div style={{ position: "absolute", inset: 0, opacity: opacities[2] }}>
      <InsiderPolyPanel frame={frame} />
    </div>
    <div style={{ position: "absolute", inset: 0, opacity: opacities[3] }}>
      <ManipulationPolyPanelB frame={frame} />
    </div>
  </div>
);
