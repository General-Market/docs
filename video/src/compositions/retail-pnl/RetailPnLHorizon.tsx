// Variant A — REAL DATA. Hyperliquid leaderboard, 36,005 wallets, snapshot
// 2026-05-15. Scrubs through four time horizons: 24h → 7d → 30d → all-time.
// The chart shows the same wallets at four windows; the curve gets steeper
// the longer you look. Median wallet breaks even on the day, loses $1,310
// over its lifetime.

import React from "react";
import { ChartEngine, computeChartDuration } from "./ChartEngine";
import { HYPERLIQUID_BY_HORIZON } from "./data";

const FPS = 30;
const W = 1920;
const H = 1080;

export const RetailPnLHorizon: React.FC = () => (
  <ChartEngine dataset={HYPERLIQUID_BY_HORIZON} />
);

export const retailPnLHorizonMeta = {
  id: "RetailPnLHorizon",
  component: RetailPnLHorizon,
  durationInFrames: computeChartDuration(HYPERLIQUID_BY_HORIZON, FPS),
  fps: FPS,
  width: W,
  height: H,
};
