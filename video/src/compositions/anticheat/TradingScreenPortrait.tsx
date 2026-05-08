// Portrait variant of the AntiCheatHook trading panel — laid out for
// a 9:19.5 phone screen so it can be rendered to MP4 and bound as the
// emissive texture on the iPhone in DeviceBroll.

import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { font, monoFont } from "../../common/fonts";
import { toFrames } from "./theme";

const W = 720;
const H = 1560;
const FPS = 30;
const DURATION_SEC = 10;

const CANDLE_COUNT = 36;

export const TradingScreenPortrait: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, toFrames(0.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Manipulation candle hits at ~4.4s, same beat as the landscape chart.
  const manipFrame = toFrames(4.4);
  const candles = generateCandles(frame, CANDLE_COUNT, manipFrame);
  const lastClose = candles[candles.length - 1].close;
  const prevClose = candles[Math.max(0, candles.length - 2)].close;
  const pct = ((lastClose - prevClose) / prevClose) * 100;

  return (
    <AbsoluteFill
      style={{
        width: W,
        height: H,
        background: "linear-gradient(180deg, #0d0d10 0%, #050507 100%)",
        fontFamily: font,
        opacity: fadeIn,
      }}
    >
      {/* Header strip */}
      <div
        style={{
          position: "absolute",
          top: 38,
          left: 36,
          right: 36,
          display: "flex",
          gap: 22,
          alignItems: "baseline",
          fontFamily: monoFont,
          color: "#7a7a7a",
          fontSize: 38,
          letterSpacing: "0.04em",
        }}
      >
        <span style={{ color: "#f5f5f5", fontWeight: 600 }}>BTC-PERP</span>
        <span style={{ marginLeft: "auto" }}>{lastClose.toFixed(2)}</span>
      </div>
      <div
        style={{
          position: "absolute",
          top: 92,
          left: 36,
          right: 36,
          display: "flex",
          gap: 18,
          alignItems: "baseline",
          fontFamily: monoFont,
          fontSize: 30,
          letterSpacing: "0.04em",
        }}
      >
        <span style={{ color: pct >= 0 ? "#3ddc84" : "#ff3b3b" }}>
          {pct >= 0 ? "+" : ""}
          {pct.toFixed(2)}%
        </span>
        <span style={{ marginLeft: "auto", color: "#7a7a7a", opacity: 0.6 }}>
          1m · LIVE
        </span>
      </div>

      {/* Big candle chart */}
      <div
        style={{
          position: "absolute",
          left: 36,
          right: 36,
          top: 168,
          height: 760,
          overflow: "hidden",
          borderTop: "1px solid #1a1a1f",
          borderBottom: "1px solid #1a1a1f",
        }}
      >
        <CandleChart candles={candles} />
      </div>

      {/* Compact order book — bid column + ask column side-by-side */}
      <div
        style={{
          position: "absolute",
          left: 36,
          right: 36,
          top: 956,
          height: 460,
          display: "flex",
          gap: 18,
          fontFamily: monoFont,
        }}
      >
        <OrderBookColumn frame={frame} centerPrice={lastClose} side="bid" />
        <OrderBookColumn frame={frame} centerPrice={lastClose} side="ask" />
      </div>

      {/* Ticker scroll */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 38,
          height: 70,
          borderTop: `1px solid ${"#1f1f1f"}`,
          borderBottom: `1px solid ${"#1f1f1f"}`,
          overflow: "hidden",
        }}
      >
        <Ticker frame={frame} />
      </div>
    </AbsoluteFill>
  );
};

// ─── Chart ─────────────────────────────────────────────────────────────────────

type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
  boom?: boolean;
};

const CandleChart: React.FC<{ candles: Candle[] }> = ({ candles }) => {
  const min = Math.min(...candles.map((c) => c.low));
  const max = Math.max(...candles.map((c) => c.high));
  const range = max - min || 1;
  const yOf = (p: number) => ((max - p) / range) * 100;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      style={{ overflow: "visible" }}
    >
      {[20, 40, 60, 80].map((y) => (
        <line
          key={y}
          x1={0}
          x2={100}
          y1={y}
          y2={y}
          stroke="#1a1a1f"
          strokeWidth={0.12}
        />
      ))}
      {candles.map((c, i) => {
        const x = (i / candles.length) * 100;
        const w = (1 / candles.length) * 0.7 * 100;
        const cx = x + w / 2;
        const isUp = c.close >= c.open;
        const colorC = isUp ? "#3ddc84" : "#ff3b3b";
        const bodyTop = yOf(Math.max(c.open, c.close));
        const bodyH = Math.max(0.4, Math.abs(yOf(c.open) - yOf(c.close)));
        return (
          <g key={i}>
            <line
              x1={cx}
              x2={cx}
              y1={yOf(c.high)}
              y2={yOf(c.low)}
              stroke={colorC}
              strokeWidth={0.18}
            />
            <rect
              x={x}
              y={bodyTop}
              width={w}
              height={bodyH}
              fill={colorC}
              opacity={c.boom ? 1 : 0.85}
            />
          </g>
        );
      })}
    </svg>
  );
};

// ─── Order book ────────────────────────────────────────────────────────────────

const OB_LEVELS = 8;

const OrderBookColumn: React.FC<{
  frame: number;
  centerPrice: number;
  side: "bid" | "ask";
}> = ({ frame, centerPrice, side }) => {
  const spoofIn = toFrames(6.2) - toFrames(2.0);
  const spoofVisible = frame > spoofIn && frame < spoofIn + toFrames(0.7);
  const spoofLevel = 3;
  const accent = side === "bid" ? "#3ddc84" : "#ff3b3b";

  const rows: { price: number; size: number; flash: boolean }[] = [];
  for (let i = 0; i < OB_LEVELS; i++) {
    const noise = pseudo(frame * 0.05 + i + (side === "bid" ? 100 : 0)) * 0.6 + 0.4;
    let size = noise * 12 + 2;
    let flash = false;
    if (side === "bid" && spoofVisible && i === spoofLevel) {
      size = 28;
      flash = true;
    }
    const sign = side === "bid" ? -1 : 1;
    rows.push({
      price: centerPrice + sign * (i + 1) * 0.5,
      size,
      flash,
    });
  }
  // Asks display low → high (closest to mid first); bids display low → high too (deepest first → closest to mid last).
  if (side === "ask") rows.reverse();

  const maxSize = Math.max(...rows.map((r) => r.size));

  return (
    <div
      style={{
        flex: 1,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        fontSize: 22,
        color: "#7a7a7a",
      }}
    >
      <div
        style={{
          fontSize: 18,
          letterSpacing: "0.18em",
          color: accent,
          opacity: 0.7,
          marginBottom: 8,
          textTransform: "uppercase",
        }}
      >
        {side === "bid" ? "BIDS" : "ASKS"}
      </div>
      {rows.map((r, i) => {
        const widthPct = (r.size / maxSize) * 100;
        return (
          <div
            key={i}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              padding: "4px 10px",
              fontVariantNumeric: "tabular-nums",
              backgroundColor: r.flash ? "rgba(255,59,59,0.16)" : "transparent",
              border: r.flash
                ? "1px solid rgba(255,59,59,0.6)"
                : "1px solid transparent",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                right: side === "ask" ? 0 : "auto",
                left: side === "bid" ? 0 : "auto",
                width: `${widthPct}%`,
                backgroundColor: accent,
                opacity: r.flash ? 0.42 : 0.18,
              }}
            />
            <span style={{ position: "relative", flex: 1, color: "#f5f5f5" }}>
              {r.price.toFixed(2)}
            </span>
            <span style={{ position: "relative", color: accent }}>
              {r.size.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Ticker ────────────────────────────────────────────────────────────────────

const TICKER_ITEMS = [
  "ETH-PERP   3,847.12  +1.84%",
  "SOL-PERP   201.55   -2.10%",
  "BTC-PERP   61,247   +0.42%",
  "BLOCK 24,871,902   ◆ MEV $42,118",
  "FILL  61,250.00 × 0.84  BTC-PERP",
];

const Ticker: React.FC<{ frame: number }> = ({ frame }) => {
  const text = TICKER_ITEMS.join("     ·     ");
  const offset = (frame * 6) % 4000;

  return (
    <div
      style={{
        fontFamily: monoFont,
        fontSize: 26,
        color: "#7a7a7a",
        whiteSpace: "nowrap",
        position: "absolute",
        top: "50%",
        transform: `translate(${-offset}px, -50%)`,
        letterSpacing: "0.06em",
      }}
    >
      {text}
      <span style={{ paddingLeft: 80 }}>{text}</span>
    </div>
  );
};

// ─── Candle generator ──────────────────────────────────────────────────────────

function pseudo(seed: number): number {
  return (Math.sin(seed * 12.9898) * 43758.5453) % 1 < 0
    ? ((Math.sin(seed * 12.9898) * 43758.5453) % 1) + 1
    : (Math.sin(seed * 12.9898) * 43758.5453) % 1;
}

function generateCandles(
  timeFrame: number,
  count: number,
  manipAt: number,
): Candle[] {
  const candles: Candle[] = [];
  let price = 61_200;
  const tick = timeFrame * 0.06;
  for (let i = 0; i < count; i++) {
    const phase = i + tick;
    const drift = Math.sin(phase * 0.27) * 18 + Math.cos(phase * 0.61) * 12;
    const noise = (pseudo(phase * 1.7) - 0.5) * 22;
    const open = price;
    let close = price + drift + noise;
    let high = Math.max(open, close) + Math.abs(drift) * 0.4 + pseudo(phase * 3.1) * 6;
    let low = Math.min(open, close) - Math.abs(drift) * 0.4 - pseudo(phase * 5.7 + 1) * 6;
    let boom = false;
    const manipIdx = count - 5;
    if (i === manipIdx && timeFrame >= manipAt && timeFrame < manipAt + 36) {
      close = open - 220;
      high = open + 14;
      low = close - 24;
      boom = true;
    }
    candles.push({ open, high, low, close, boom });
    price = close;
  }
  return candles;
}

export const tradingScreenPortraitMeta = {
  id: "TradingScreenPortrait",
  component: TradingScreenPortrait,
  durationInFrames: DURATION_SEC * FPS,
  fps: FPS,
  width: W,
  height: H,
};
