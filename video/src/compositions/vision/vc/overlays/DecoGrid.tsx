/**
 * DecoGrid — Decorative SVG background grids.
 *
 * Matches the visual language from visuals.html:
 * Fine horizontal/vertical lines at 0.3 opacity + domain-specific patterns.
 *
 * Variants:
 * - "candlestick" — for trading/privacy scenes
 * - "bars" — ascending bars for volume/points scenes
 * - "allocation" — donut rings for breadth/index scenes
 * - "grid" — plain grid lines
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { COLOR } from "../tokens";

type Variant = "candlestick" | "bars" | "allocation" | "grid";

interface DecoGridProps {
  variant?: Variant;
  opacity?: number;
}

const GRID_COLOR = COLOR.gridLine;

const BaseGrid: React.FC = () => (
  <>
    {/* Horizontal grid lines */}
    <line x1="0" y1="270" x2="1920" y2="270" stroke={GRID_COLOR} strokeWidth="0.5" />
    <line x1="0" y1="540" x2="1920" y2="540" stroke={GRID_COLOR} strokeWidth="0.5" />
    <line x1="0" y1="810" x2="1920" y2="810" stroke={GRID_COLOR} strokeWidth="0.5" />
    {/* Vertical grid lines */}
    <line x1="480" y1="0" x2="480" y2="1080" stroke={GRID_COLOR} strokeWidth="0.5" />
    <line x1="960" y1="0" x2="960" y2="1080" stroke={GRID_COLOR} strokeWidth="0.5" />
    <line x1="1440" y1="0" x2="1440" y2="1080" stroke={GRID_COLOR} strokeWidth="0.5" />
  </>
);

const CandlestickPattern: React.FC = () => (
  <g opacity="0.5">
    {[120, 240, 360, 480, 600, 720].map((x, i) => {
      const top = 300 + Math.sin(i * 1.7) * 80;
      const bot = top + 120 + Math.sin(i * 2.3) * 60;
      const bodyTop = top + 30;
      const bodyH = 60 + Math.sin(i * 3.1) * 20;
      const isGreen = i % 3 !== 1;
      return (
        <g key={i}>
          <line x1={x} y1={top} x2={x} y2={bot} stroke={GRID_COLOR} strokeWidth="1" />
          <rect
            x={x - 10}
            y={bodyTop}
            width={20}
            height={bodyH}
            fill={isGreen ? COLOR.brand : COLOR.down}
            opacity={0.08}
            rx="1"
          />
        </g>
      );
    })}
  </g>
);

const BarsPattern: React.FC = () => (
  <g opacity="0.4">
    {[1200, 1280, 1360, 1440, 1520, 1600, 1680].map((x, i) => {
      const h = 120 + i * 50;
      return (
        <rect
          key={i}
          x={x}
          y={1080 - h - 40}
          width={50}
          height={h}
          fill={COLOR.brand}
          opacity={0.04 + i * 0.015}
          rx="2"
        />
      );
    })}
    {/* Trend line */}
    <path
      d="M1225,900 C1300,820 1400,700 1500,580 C1600,480 1680,420 1720,400"
      stroke={COLOR.brand}
      strokeWidth="1.5"
      fill="none"
      opacity="0.1"
    />
  </g>
);

const AllocationPattern: React.FC = () => (
  <g opacity="0.4">
    {/* Large donut ring — top right */}
    <circle cx="1650" cy="250" r="150" stroke="#2563EB" strokeWidth="2" fill="none" opacity="0.06" strokeDasharray="250 120 80 60" />
    <circle cx="1650" cy="250" r="110" stroke="#2563EB" strokeWidth="1.5" fill="none" opacity="0.04" strokeDasharray="160 80 100 70" />
    {/* Small ring — bottom left */}
    <circle cx="250" cy="850" r="80" stroke={GRID_COLOR} strokeWidth="1" fill="none" opacity="0.4" />
    <circle cx="250" cy="850" r="80" stroke="#2563EB" strokeWidth="3" fill="none" opacity="0.08" strokeDasharray="130 370" transform="rotate(-90 250 850)" />
  </g>
);

export const DecoGrid: React.FC<DecoGridProps> = ({
  variant = "grid",
  opacity = 0.35,
}) => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 0 }}>
      <svg
        width="1920"
        height="1080"
        viewBox="0 0 1920 1080"
        style={{ width: "100%", height: "100%", opacity }}
      >
        <BaseGrid />
        {variant === "candlestick" && <CandlestickPattern />}
        {variant === "bars" && <BarsPattern />}
        {variant === "allocation" && <AllocationPattern />}
      </svg>
    </AbsoluteFill>
  );
};
