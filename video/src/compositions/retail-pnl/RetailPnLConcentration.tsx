// Variant E — Concentration curve. "What share of the profit pot the top N%
// captures." Year over year, the line stays glued at 100% for longer — i.e.
// even smaller and smaller elite tiers swallow the whole pie. The 2025 line
// is visibly above 2020 everywhere.

import React from "react";
import { ChartEngine, computeChartDuration } from "./ChartEngine";
import { PROFIT_CONCENTRATION } from "./data";

const FPS = 30;
const W = 1920;
const H = 1080;

export const RetailPnLConcentration: React.FC = () => (
  <ChartEngine dataset={PROFIT_CONCENTRATION} />
);

export const retailPnLConcentrationMeta = {
  id: "RetailPnLConcentration",
  component: RetailPnLConcentration,
  durationInFrames: computeChartDuration(PROFIT_CONCENTRATION, FPS),
  fps: FPS,
  width: W,
  height: H,
};
