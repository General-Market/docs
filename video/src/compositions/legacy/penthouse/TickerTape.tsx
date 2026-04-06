import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { TICKER_SYMBOLS, type TickerItem } from "./chartData";

interface Props {
  width: number;
  height?: number;
  fadeInStart?: number;
  fadeInEnd?: number;
  speed?: number;
}

export const TickerTape: React.FC<Props> = ({
  width,
  height = 36,
  fadeInStart = 15,
  fadeInEnd = 30,
  speed = 1.5,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [fadeInStart, fadeInEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Duplicate symbols for seamless loop
  const items = [...TICKER_SYMBOLS, ...TICKER_SYMBOLS, ...TICKER_SYMBOLS];
  const itemWidth = 150; // approximate width per item
  const totalWidth = TICKER_SYMBOLS.length * itemWidth;

  const offset = -(frame * speed) % totalWidth;

  return (
    <div
      style={{
        width,
        height,
        overflow: "hidden",
        background: "rgba(13,17,23,0.9)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        opacity,
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          transform: `translateX(${offset}px)`,
          whiteSpace: "nowrap",
        }}
      >
        {items.map((item: TickerItem, i: number) => (
          <div
            key={i}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "0 16px",
              fontFamily: "monospace",
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.6)", fontWeight: "bold" }}>
              {item.symbol}
            </span>
            <span style={{ color: "rgba(255,255,255,0.4)" }}>{item.price}</span>
            <span
              style={{
                color: item.change >= 0 ? "#00e676" : "#ff3d00",
                fontSize: 11,
              }}
            >
              {item.change >= 0 ? "+" : ""}
              {item.change.toFixed(2)}%
            </span>
            <span style={{ color: "rgba(255,255,255,0.1)", padding: "0 4px" }}>|</span>
          </div>
        ))}
      </div>
    </div>
  );
};
