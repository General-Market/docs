import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { noise2D } from "@remotion/noise";
import { generateOrderBook } from "./chartData";

interface Props {
  width: number;
  height: number;
  seed?: number;
  levels?: number;
  animateInStart?: number;
  animateInEnd?: number;
}

export const OrderBook: React.FC<Props> = ({
  width,
  height,
  seed = 123,
  levels = 12,
  animateInStart = 30,
  animateInEnd = 60,
}) => {
  const frame = useCurrentFrame();
  const midPrice = 127.45;
  const book = React.useMemo(
    () => generateOrderBook(seed, levels, midPrice),
    [seed, levels]
  );

  const padding = { top: 28, right: 8, bottom: 8, left: 8 };
  const innerW = width - padding.left - padding.right;
  const rowH = (height - padding.top - padding.bottom) / (levels * 2 + 1); // +1 for spread row

  const maxSize = Math.max(
    ...book.bids.map((l) => l.size),
    ...book.asks.map((l) => l.size)
  );

  const progress = interpolate(frame, [animateInStart, animateInEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(frame, [animateInStart, animateInStart + 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <svg width={width} height={height} opacity={opacity}>
      <rect width={width} height={height} fill="#0d1117" rx={4} />

      {/* Label */}
      <text
        x={padding.left + 4}
        y={18}
        fill="rgba(255,255,255,0.5)"
        fontSize={10}
        fontFamily="monospace"
      >
        ORDER BOOK
      </text>

      {/* Column headers */}
      <text x={padding.left + 4} y={padding.top - 2} fill="rgba(255,255,255,0.25)" fontSize={8} fontFamily="monospace">
        PRICE
      </text>
      <text x={width - padding.right - 4} y={padding.top - 2} fill="rgba(255,255,255,0.25)" fontSize={8} fontFamily="monospace" textAnchor="end">
        SIZE
      </text>

      {/* Asks (top, reversed so best ask is at middle) */}
      {[...book.asks].reverse().map((level, i) => {
        const y = padding.top + i * rowH;
        const noiseFactor =
          frame > animateInEnd
            ? 1 + noise2D("ask", frame * 0.04, i * 0.5) * 0.3
            : 1;
        const barW = (level.size / maxSize) * innerW * 0.6 * progress * noiseFactor;

        return (
          <g key={`ask-${i}`}>
            <rect
              x={width - padding.right - barW}
              y={y + 1}
              width={Math.max(0, barW)}
              height={rowH - 2}
              fill="rgba(255,61,0,0.15)"
            />
            <text
              x={padding.left + 4}
              y={y + rowH - 3}
              fill="#ff3d00"
              fontSize={9}
              fontFamily="monospace"
              opacity={0.8}
            >
              {level.price.toFixed(2)}
            </text>
            <text
              x={width - padding.right - 4}
              y={y + rowH - 3}
              fill="rgba(255,61,0,0.6)"
              fontSize={9}
              fontFamily="monospace"
              textAnchor="end"
            >
              {(level.size * noiseFactor).toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* Spread row */}
      {(() => {
        const spreadY = padding.top + levels * rowH;
        const spread = book.asks[0].price - book.bids[0].price;
        return (
          <g>
            <rect
              x={padding.left}
              y={spreadY}
              width={innerW}
              height={rowH}
              fill="rgba(255,255,255,0.03)"
            />
            <text
              x={width / 2}
              y={spreadY + rowH - 3}
              fill="rgba(255,255,255,0.5)"
              fontSize={10}
              fontFamily="monospace"
              textAnchor="middle"
              fontWeight="bold"
            >
              {midPrice.toFixed(2)} · {spread.toFixed(2)}
            </text>
          </g>
        );
      })()}

      {/* Bids (bottom) */}
      {book.bids.map((level, i) => {
        const y = padding.top + (levels + 1 + i) * rowH;
        const noiseFactor =
          frame > animateInEnd
            ? 1 + noise2D("bid", frame * 0.04, i * 0.5) * 0.3
            : 1;
        const barW = (level.size / maxSize) * innerW * 0.6 * progress * noiseFactor;

        return (
          <g key={`bid-${i}`}>
            <rect
              x={width - padding.right - barW}
              y={y + 1}
              width={Math.max(0, barW)}
              height={rowH - 2}
              fill="rgba(0,230,118,0.15)"
            />
            <text
              x={padding.left + 4}
              y={y + rowH - 3}
              fill="#00e676"
              fontSize={9}
              fontFamily="monospace"
              opacity={0.8}
            >
              {level.price.toFixed(2)}
            </text>
            <text
              x={width - padding.right - 4}
              y={y + rowH - 3}
              fill="rgba(0,230,118,0.6)"
              fontSize={9}
              fontFamily="monospace"
              textAnchor="end"
            >
              {(level.size * noiseFactor).toFixed(1)}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
