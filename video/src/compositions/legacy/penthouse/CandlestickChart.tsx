import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { noise2D } from "@remotion/noise";
import { generateCandles, calculateSMA, type Candle } from "./chartData";

interface Props {
  width: number;
  height: number;
  seed?: number;
  candleCount?: number;
  drawInStart?: number;
  drawInEnd?: number;
}

export const CandlestickChart: React.FC<Props> = ({
  width,
  height,
  seed = 42,
  candleCount = 60,
  drawInStart = 0,
  drawInEnd = 90,
}) => {
  const frame = useCurrentFrame();
  const candles = React.useMemo(() => generateCandles(seed, candleCount), [seed, candleCount]);
  const sma = React.useMemo(() => calculateSMA(candles, 14), [candles]);

  const padding = { top: 30, right: 12, bottom: 30, left: 55 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Price range
  const allPrices = candles.flatMap((c) => [c.high, c.low]);
  const minPrice = Math.min(...allPrices) * 0.998;
  const maxPrice = Math.max(...allPrices) * 1.002;
  const priceRange = maxPrice - minPrice;

  const yScale = (price: number) =>
    padding.top + chartH - ((price - minPrice) / priceRange) * chartH;

  const candleWidth = chartW / candleCount;
  const bodyWidth = candleWidth * 0.6;

  // Progress: how many candles to show
  const progress = interpolate(frame, [drawInStart, drawInEnd], [0, candleCount], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const visibleCount = Math.floor(progress);

  // Grid lines
  const gridLines = 5;
  const priceStep = priceRange / gridLines;
  const gridPrices = Array.from({ length: gridLines + 1 }, (_, i) => minPrice + i * priceStep);

  // Live candle noise (after draw-in)
  const lastIdx = candles.length - 1;
  const liveNoise =
    frame > drawInEnd ? noise2D("live-candle", frame * 0.03, 0) * priceRange * 0.01 : 0;

  // SMA path
  const smaPath = sma
    .map((val, i) => {
      if (val === null || i >= visibleCount) return null;
      const x = padding.left + i * candleWidth + candleWidth / 2;
      const y = yScale(val);
      return `${i === 0 || sma[i - 1] === null ? "M" : "L"} ${x} ${y}`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      {/* Background */}
      <rect width={width} height={height} fill="#0d1117" rx={4} />

      {/* Grid */}
      {gridPrices.map((price, i) => {
        const y = yScale(price);
        return (
          <g key={i}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="rgba(255,255,255,0.04)"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 6}
              y={y + 4}
              fill="rgba(255,255,255,0.35)"
              fontSize={10}
              fontFamily="monospace"
              textAnchor="end"
            >
              {price.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* Candles */}
      {candles.map((candle: Candle, i: number) => {
        if (i >= visibleCount) return null;

        const isLast = i === lastIdx && frame > drawInEnd;
        const c = isLast
          ? { ...candle, close: candle.close + liveNoise, high: candle.high + Math.max(0, liveNoise), low: candle.low + Math.min(0, liveNoise) }
          : candle;

        const x = padding.left + i * candleWidth + candleWidth / 2;
        const bullish = c.close >= c.open;
        const color = bullish ? "#00e676" : "#ff3d00";

        const bodyTop = yScale(Math.max(c.open, c.close));
        const bodyBottom = yScale(Math.min(c.open, c.close));
        const bodyH = Math.max(1, bodyBottom - bodyTop);

        // Fade in the latest candle being drawn
        const opacity = i === visibleCount - 1 && progress < candleCount
          ? interpolate(progress - visibleCount + 1, [0, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          : 1;

        return (
          <g key={i} opacity={opacity}>
            {/* Wick */}
            <line
              x1={x}
              y1={yScale(c.high)}
              x2={x}
              y2={yScale(c.low)}
              stroke={color}
              strokeWidth={1}
            />
            {/* Body */}
            <rect
              x={x - bodyWidth / 2}
              y={bodyTop}
              width={bodyWidth}
              height={bodyH}
              fill={color}
              stroke={color}
              strokeWidth={0.5}
            />
          </g>
        );
      })}

      {/* SMA line */}
      {smaPath && (
        <path
          d={smaPath}
          fill="none"
          stroke="#FFD700"
          strokeWidth={1.5}
          opacity={0.7}
          filter="url(#smaGlow)"
        />
      )}

      {/* SMA glow filter */}
      <defs>
        <filter id="smaGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Chart label */}
      <text
        x={padding.left + 4}
        y={padding.top - 10}
        fill="rgba(255,255,255,0.5)"
        fontSize={11}
        fontFamily="monospace"
      >
        OHLC · 1H · SMA(14)
      </text>
    </svg>
  );
};
