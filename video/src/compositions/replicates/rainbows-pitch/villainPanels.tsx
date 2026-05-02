/* Villain panels — one panel per villain in Scene 07. Same Vision-style
   chrome as MockOrderbook (traffic-light dots, monospace numbers, dark bg).
   Cross-fade is driven by the parent via the `active` prop. */

import React from "react";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { subsets: ["latin"], weights: ["400", "500", "700", "800"] });
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

export const PANEL_W = 580;
export const PANEL_H = 720;

export const RED = "#ef5350";
export const GREEN = "#26a69a";
export const INTER_FONT = fontFamily;
export const PANEL_MONO = MONO;

/* ── Generic Vision-style chrome wrapper ──────────────────────── */
const PanelChrome: React.FC<{
  title: string;
  meta: string;
  metaColor?: string;
  children: React.ReactNode;
}> = ({ title, meta, metaColor = "rgba(255,255,255,0.7)", children }) => (
  <div
    style={{
      width: PANEL_W,
      height: PANEL_H,
      background: "#0d1117",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14,
      overflow: "hidden",
      boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
      fontFamily,
      display: "flex",
      flexDirection: "column",
    }}
  >
    <div
      style={{
        height: 44,
        padding: "0 14px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "rgba(13,17,23,0.96)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}
    >
      <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#ff5f57" }} />
      <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#febc2e" }} />
      <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#28c840" }} />
      <span
        style={{
          marginLeft: 16,
          color: "rgba(255,255,255,0.7)",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}
      >
        {title}
      </span>
      <span
        style={{
          marginLeft: "auto",
          color: metaColor,
          fontSize: 12,
          fontFamily: MONO,
          letterSpacing: "0.04em",
        }}
      >
        {meta}
      </span>
    </div>
    <div style={{ flex: 1, minHeight: 0, position: "relative" }}>{children}</div>
  </div>
);

/* ── Panel 1: Frontrun mempool ────────────────────────────────── */
export const FrontrunPanel: React.FC<{ frame: number }> = ({ frame }) => {
  type Tx = { hash: string; gas: string; size: string; tag?: "FRONTRUN" | null };
  const txs: Tx[] = [
    { hash: "0x71fa…ac02", gas: "32 gwei", size: "0.84 BTC" },
    { hash: "0x2bd9…e114", gas: "31 gwei", size: "1.20 BTC" },
    { hash: "0xff31…0a8c", gas: "240 gwei", size: "0.84 BTC", tag: "FRONTRUN" },
    { hash: "0x9c12…7e44", gas: "30 gwei", size: "0.45 BTC" },
    { hash: "0xae43…d901", gas: "30 gwei", size: "2.10 BTC" },
    { hash: "0x4f8e…b6c2", gas: "29 gwei", size: "0.31 BTC" },
    { hash: "0x1aa0…5f10", gas: "29 gwei", size: "0.92 BTC" },
    { hash: "0x60c2…1ddb", gas: "28 gwei", size: "1.04 BTC" },
  ];

  // Frontrun row jumps up over time
  const jump = Math.min(1, frame / 18);
  const flash = (Math.sin(frame * 0.5) + 1) / 2;

  return (
    <PanelChrome title="MEMPOOL · pending" meta={`block +${1 + Math.floor(frame / 24)}`} metaColor="#febc2e">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 110px 110px 110px",
          padding: "10px 14px",
          fontSize: 11,
          color: "rgba(255,255,255,0.45)",
          letterSpacing: "0.08em",
          fontFamily: MONO,
          textTransform: "uppercase",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <span>Hash</span>
        <span style={{ textAlign: "right" }}>Gas</span>
        <span style={{ textAlign: "right" }}>Size</span>
        <span style={{ textAlign: "right" }}>Tag</span>
      </div>
      {txs.map((tx, i) => {
        const isFront = tx.tag === "FRONTRUN";
        const dy = isFront ? -i * 56 * jump : 0;
        const bg = isFront ? `rgba(239,83,80,${0.18 + 0.12 * flash})` : "transparent";
        const color = isFront ? RED : "rgba(255,255,255,0.85)";
        return (
          <div
            key={tx.hash}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 110px 110px 110px",
              padding: "12px 14px",
              fontFamily: MONO,
              fontSize: 13,
              background: bg,
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              transform: `translateY(${dy}px)`,
              boxShadow: isFront ? `inset 3px 0 0 ${RED}` : "none",
            }}
          >
            <span style={{ color }}>{tx.hash}</span>
            <span style={{ textAlign: "right", color, fontWeight: isFront ? 800 : 400 }}>{tx.gas}</span>
            <span style={{ textAlign: "right", color: "rgba(255,255,255,0.6)" }}>{tx.size}</span>
            <span
              style={{
                textAlign: "right",
                color: isFront ? RED : "rgba(255,255,255,0.25)",
                fontWeight: 800,
                letterSpacing: "0.06em",
              }}
            >
              {tx.tag ?? "—"}
            </span>
          </div>
        );
      })}
    </PanelChrome>
  );
};

/* ── Panel 2: Spoof orderbook ─────────────────────────────────── */
export const SpoofPanel: React.FC<{ frame: number; intensity: number }> = ({ frame, intensity }) => {
  type Row = { price: string; size: string; side: "ask" | "bid"; spoof?: boolean };
  const asks: Row[] = [
    { price: "108,512.40", size: "0.42", side: "ask" },
    { price: "108,510.10", size: "12.50", side: "ask", spoof: true },
    { price: "108,508.85", size: "0.07", side: "ask" },
    { price: "108,506.20", size: "8.84", side: "ask", spoof: true },
    { price: "108,504.00", size: "0.31", side: "ask" },
  ];
  const bids: Row[] = [
    { price: "108,498.50", size: "0.66", side: "bid" },
    { price: "108,496.10", size: "15.21", side: "bid", spoof: true },
    { price: "108,493.80", size: "0.18", side: "bid" },
    { price: "108,491.20", size: "1.04", side: "bid" },
    { price: "108,485.00", size: "9.40", side: "bid", spoof: true },
  ];

  // Cancellation flicker: spoof rows blink in/out on a short cycle
  const flicker = (Math.sin(frame * 0.6) + 1) / 2;
  const cancelStrength = Math.min(1, intensity);

  const Row = ({ r }: { r: Row }) => {
    const color = r.side === "ask" ? RED : GREEN;
    const bg = r.side === "ask" ? "rgba(239,83,80,0.08)" : "rgba(38,166,154,0.08)";
    const ghost = r.spoof ? cancelStrength * (0.5 + 0.5 * flicker) : 0;
    const fade = 1 - ghost * 0.85;
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 100px 100px",
          padding: "11px 14px",
          fontFamily: MONO,
          fontSize: 14,
          color: "rgba(255,255,255,0.85)",
          background: bg,
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          opacity: fade,
          position: "relative",
        }}
      >
        <span style={{ color, textDecoration: ghost > 0.4 ? "line-through" : "none" }}>{r.price}</span>
        <span style={{ textAlign: "right", color: "rgba(255,255,255,0.65)" }}>{r.size}</span>
        <span
          style={{
            textAlign: "right",
            color: r.spoof ? RED : "rgba(255,255,255,0.45)",
            fontWeight: r.spoof ? 800 : 400,
          }}
        >
          {r.spoof ? "CANCEL" : "—"}
        </span>
      </div>
    );
  };

  return (
    <PanelChrome title="BOOK · spoof detected" meta={`cancels ${Math.floor(7 + frame * 0.4)}/s`} metaColor={RED}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 100px 100px",
          padding: "10px 14px",
          fontSize: 11,
          color: "rgba(255,255,255,0.45)",
          letterSpacing: "0.08em",
          fontFamily: MONO,
          textTransform: "uppercase",
        }}
      >
        <span>Price</span>
        <span style={{ textAlign: "right" }}>Size</span>
        <span style={{ textAlign: "right" }}>State</span>
      </div>
      {asks.map((r, i) => <Row key={`a${i}`} r={r} />)}
      <div
        style={{
          padding: "10px 14px",
          background: "rgba(255,255,255,0.03)",
          fontFamily: MONO,
          fontSize: 12,
          color: "rgba(255,255,255,0.55)",
          display: "flex",
          justifyContent: "space-between",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <span>SPREAD</span>
        <span>1.50 · 0.001%</span>
      </div>
      {bids.map((r, i) => <Row key={`b${i}`} r={r} />)}
    </PanelChrome>
  );
};

/* ── Panel 3: Insider options-flow chart ──────────────────────── */
const InsiderPanel: React.FC<{ frame: number }> = ({ frame }) => {
  const W = 540;
  const H = 540;
  const padL = 28;
  const padR = 28;
  const padT = 28;
  const padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Flat line with sharp pre-news spike. News marker around x=0.78.
  const NEWS_X = 0.78;
  const points: Array<[number, number]> = [];
  const N = 40;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    let v = 0.18 + Math.sin(t * 14) * 0.015 + Math.sin(t * 31) * 0.008;
    // Spike rises sharply between 0.55 and 0.76 (pre-news)
    if (t > 0.55 && t < NEWS_X) {
      const k = (t - 0.55) / (NEWS_X - 0.55);
      v += Math.pow(k, 2.4) * 0.72;
    }
    // After news, holds high
    if (t >= NEWS_X) v = 0.92 + Math.sin(t * 22) * 0.01;
    points.push([t, v]);
  }

  // Animated draw progress — line draws across the panel
  const progress = Math.min(1, frame / 30);
  const visibleN = Math.max(2, Math.floor(N * progress));
  const visiblePts = points.slice(0, visibleN);

  const toX = (t: number) => padL + plotW * t;
  const toY = (v: number) => padT + plotH * (1 - v);

  const path = visiblePts
    .map(([t, v], i) => `${i === 0 ? "M" : "L"} ${toX(t).toFixed(2)} ${toY(v).toFixed(2)}`)
    .join(" ");

  const newsX = toX(NEWS_X);
  const newsVisible = progress > NEWS_X * 0.95;

  // Flat baseline ticks
  const ticks = [0.25, 0.5, 0.75];

  return (
    <PanelChrome title="OPTIONS FLOW · anomaly" meta="3,400% vs avg" metaColor={RED}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="insider-spike" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2cd36f" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#2cd36f" stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* gridlines */}
        {ticks.map((t) => (
          <line
            key={t}
            x1={padL}
            y1={toY(t)}
            x2={W - padR}
            y2={toY(t)}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="2 4"
          />
        ))}
        {/* baseline label */}
        <text
          x={padL}
          y={toY(0.18) - 6}
          fontFamily={MONO}
          fontSize={10}
          fill="rgba(255,255,255,0.35)"
          letterSpacing="0.06em"
        >
          AVG VOLUME
        </text>
        {/* spike fill */}
        {visiblePts.length > 1 && (
          <path
            d={`${path} L ${toX(visiblePts[visiblePts.length - 1][0]).toFixed(2)} ${toY(0).toFixed(2)} L ${padL} ${toY(0).toFixed(2)} Z`}
            fill="url(#insider-spike)"
          />
        )}
        {/* line */}
        <path d={path} fill="none" stroke="#2cd36f" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />

        {/* News marker (vertical dashed red line + label) */}
        {newsVisible && (
          <g>
            <line
              x1={newsX}
              y1={padT}
              x2={newsX}
              y2={H - padB}
              stroke={RED}
              strokeWidth={1.6}
              strokeDasharray="4 4"
              opacity={0.9}
            />
            <rect
              x={newsX + 6}
              y={padT + 6}
              width={120}
              height={28}
              rx={4}
              fill="rgba(239,83,80,0.18)"
              stroke={RED}
              strokeWidth={1}
            />
            <text
              x={newsX + 14}
              y={padT + 25}
              fontFamily={MONO}
              fontSize={12}
              fontWeight={700}
              fill={RED}
              letterSpacing="0.06em"
            >
              NEWS DROP
            </text>
          </g>
        )}

        {/* x-axis time labels */}
        {[0, 0.5, 1].map((t, i) => (
          <text
            key={i}
            x={toX(t)}
            y={H - 12}
            textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
            fontFamily={MONO}
            fontSize={11}
            fill="rgba(255,255,255,0.35)"
          >
            {["−24h", "−12h", "now"][i]}
          </text>
        ))}
      </svg>
    </PanelChrome>
  );
};

/* ── Panel 4: Wash-trade candlesticks ─────────────────────────── */
const ManipulationPanel: React.FC<{ frame: number }> = ({ frame }) => {
  const W = 540;
  const H = 540;
  const padL = 28;
  const padR = 28;
  const padT = 28;
  const padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Candlesticks: pump (huge greens) → dump (red collapse).
  // Each candle: [open, close, low, high]
  type Candle = [number, number, number, number];
  const candles: Candle[] = [
    [0.32, 0.34, 0.30, 0.36],
    [0.34, 0.36, 0.33, 0.38],
    [0.36, 0.42, 0.35, 0.44],
    [0.42, 0.55, 0.40, 0.58],
    [0.55, 0.72, 0.53, 0.76],
    [0.72, 0.88, 0.70, 0.92],
    [0.88, 0.95, 0.86, 0.97],
    [0.95, 0.92, 0.88, 0.97], // top
    [0.92, 0.55, 0.50, 0.93], // collapse
    [0.55, 0.34, 0.30, 0.58],
    [0.34, 0.28, 0.26, 0.36],
    [0.28, 0.30, 0.26, 0.32],
  ];

  const reveal = Math.min(candles.length, Math.floor((frame / 26) * candles.length) + 1);
  const visible = candles.slice(0, reveal);

  const cw = plotW / candles.length;
  const bodyW = cw * 0.62;

  const toX = (i: number) => padL + cw * i + cw / 2;
  const toY = (v: number) => padT + plotH * (1 - v);

  return (
    <PanelChrome title="VOLUME · wash trade" meta="vol +812%" metaColor={RED}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {/* gridlines */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={padL}
            y1={toY(t)}
            x2={W - padR}
            y2={toY(t)}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="2 4"
          />
        ))}
        {visible.map((c, i) => {
          const [o, cl, lo, hi] = c;
          const x = toX(i);
          const isUp = cl >= o;
          const color = isUp ? GREEN : RED;
          const bodyTop = toY(Math.max(o, cl));
          const bodyBottom = toY(Math.min(o, cl));
          return (
            <g key={i}>
              {/* wick */}
              <line
                x1={x}
                y1={toY(hi)}
                x2={x}
                y2={toY(lo)}
                stroke={color}
                strokeWidth={1.4}
              />
              {/* body */}
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

        {/* peak annotation */}
        {reveal >= 8 && (
          <g>
            <line
              x1={toX(7)}
              y1={padT}
              x2={toX(7)}
              y2={toY(0.97)}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <text
              x={toX(7)}
              y={padT + 18}
              textAnchor="middle"
              fontFamily={MONO}
              fontSize={11}
              fontWeight={700}
              fill="rgba(255,255,255,0.7)"
              letterSpacing="0.06em"
            >
              PEAK
            </text>
          </g>
        )}

        {/* dump annotation */}
        {reveal >= 10 && (
          <g>
            <rect
              x={toX(9) - 56}
              y={toY(0.55) - 14}
              width={112}
              height={26}
              rx={4}
              fill="rgba(239,83,80,0.18)"
              stroke={RED}
              strokeWidth={1}
            />
            <text
              x={toX(9)}
              y={toY(0.55) + 4}
              textAnchor="middle"
              fontFamily={MONO}
              fontSize={12}
              fontWeight={700}
              fill={RED}
              letterSpacing="0.06em"
            >
              −62% DUMP
            </text>
          </g>
        )}

        {[0, 0.5, 1].map((t, i) => (
          <text
            key={i}
            x={padL + plotW * t}
            y={H - 12}
            textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
            fontFamily={MONO}
            fontSize={11}
            fill="rgba(255,255,255,0.35)"
          >
            {["t0", "t+30m", "t+1h"][i]}
          </text>
        ))}
      </svg>
    </PanelChrome>
  );
};

/* ── VillainPanels — picks the active panel and cross-fades ───── */
export type PanelOpacities = [number, number, number, number];

export const VillainPanels: React.FC<{
  opacities: PanelOpacities;
  frame: number;
  spoofIntensity: number;
}> = ({ opacities, frame, spoofIntensity }) => {
  return (
    <div style={{ position: "relative", width: PANEL_W, height: PANEL_H }}>
      <div style={{ position: "absolute", inset: 0, opacity: opacities[0] }}>
        <FrontrunPanel frame={frame} />
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: opacities[1] }}>
        <SpoofPanel frame={frame} intensity={spoofIntensity} />
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: opacities[2] }}>
        <InsiderPanel frame={frame} />
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: opacities[3] }}>
        <ManipulationPanel frame={frame} />
      </div>
    </div>
  );
};
