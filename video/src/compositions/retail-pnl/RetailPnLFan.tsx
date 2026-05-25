// Variant C — annualised return on capital by trader percentile, year-over-year.
// Saez/Zucman shape. Numbers anchored on Taiwan tail + Hyperliquid current.
// Years are illustrative until per-year per-percentile DEX data is fetched.

import React from "react";
import { ChartEngine, computeChartDuration } from "./ChartEngine";
import { PNL_PERCENTILE_FAN } from "./data";

const FPS = 30;
const W = 1920;
const H = 1080;

export const RetailPnLFan: React.FC = () => (
  <ChartEngine dataset={PNL_PERCENTILE_FAN} />
);

export const retailPnLFanMeta = {
  id: "RetailPnLFan",
  component: RetailPnLFan,
  durationInFrames: computeChartDuration(PNL_PERCENTILE_FAN, FPS),
  fps: FPS,
  width: W,
  height: H,
};
