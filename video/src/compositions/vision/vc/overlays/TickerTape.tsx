/**
 * TickerTape — scrolling horizontal strip of market names (light mode).
 *
 * Light background, dark text, subtle borders.
 * Subliminal texture. Continuous crawl. Meant to be felt, not read.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLOR, FONT } from "../tokens";

interface TickerTapeProps {
  position?: "top" | "bottom";
  speed?: number;
  opacity?: number;
}

interface MarketEntry {
  name: string;
  direction: "up" | "down";
  count?: number;
}

const MARKETS: MarketEntry[] = [
  { name: "DB Train Delays", direction: "up", count: 847 },
  { name: "McD Ice Cream", direction: "down" },
  { name: "CS2 Players", direction: "up", count: 1241938 },
  { name: "xQcOW Viewers", direction: "down", count: 34201 },
  { name: "/biz/ Velocity", direction: "up" },
  { name: "$PEPE Price", direction: "down" },
  { name: "F-16 Altitude", direction: "up", count: 45200 },
  { name: "Solar Kp Index", direction: "down" },
  { name: "Dota 2 Peak", direction: "up" },
  { name: "4chan /pol/", direction: "down" },
  { name: "$BONK Rug", direction: "down" },
  { name: "NFL Injuries", direction: "up", count: 312 },
  { name: "Uber Surge", direction: "up" },
  { name: "BTC Hashrate", direction: "up" },
  { name: "TSLA Deliveries", direction: "down" },
  { name: "SpaceX Launches", direction: "up", count: 97 },
];

const SEPARATOR = " \u2022 ";
const FONT_SIZE = 11;
const STRIP_HEIGHT = 28;

function estimateTextWidth(markets: MarketEntry[]): number {
  const CHAR_WIDTH = 6.6;
  let totalChars = 0;
  for (const entry of markets) {
    totalChars += 2 + entry.name.length;
    if (entry.count !== undefined) {
      totalChars += 3 + entry.count.toLocaleString().length;
    }
    totalChars += SEPARATOR.length;
  }
  return totalChars * CHAR_WIDTH;
}

const MarketItem: React.FC<{ entry: MarketEntry }> = ({ entry }) => {
  const arrowColor = entry.direction === "up" ? COLOR.up : COLOR.down;
  const arrow = entry.direction === "up" ? "\u25B2" : "\u25BC";

  return (
    <span>
      <span style={{ color: arrowColor, fontSize: 9, marginRight: 3 }}>
        {arrow}
      </span>
      <span style={{ color: COLOR.textSecondary, fontWeight: 400 }}>
        {entry.name}
      </span>
      {entry.count !== undefined && (
        <span style={{ color: COLOR.textMuted, fontSize: 10, marginLeft: 3 }}>
          ({entry.count.toLocaleString()})
        </span>
      )}
    </span>
  );
};

export const TickerTape: React.FC<TickerTapeProps> = ({
  position = "top",
  speed = 2.5,
  opacity = 0.35,
}) => {
  const frame = useCurrentFrame();
  const contentWidth = estimateTextWidth(MARKETS);
  const rawOffset = (frame * speed) % contentWidth;

  const positionStyle: React.CSSProperties =
    position === "top" ? { top: 0 } : { bottom: 0 };

  const borderStyle: React.CSSProperties =
    position === "top"
      ? { borderBottom: `1px solid ${COLOR.borderLight}` }
      : { borderTop: `1px solid ${COLOR.borderLight}` };

  const renderStrip = () =>
    MARKETS.map((entry, i) => (
      <span key={i}>
        <MarketItem entry={entry} />
        <span style={{ color: COLOR.textDim }}>{SEPARATOR}</span>
      </span>
    ));

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: STRIP_HEIGHT,
          backgroundColor: COLOR.surfaceAlt,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          opacity,
          ...positionStyle,
          ...borderStyle,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              whiteSpace: "nowrap",
              fontFamily: FONT.mono,
              fontSize: FONT_SIZE,
              fontWeight: 400,
              lineHeight: 1,
              transform: `translateX(${-rawOffset}px)`,
              willChange: "transform",
            }}
          >
            <span>{renderStrip()}</span>
            <span>{renderStrip()}</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
