// Variant B — % of wallets profitable, by wallet size, year-over-year.
// 2024 anchored on ENVY's Hyperliquid cohort cut. Pre-2024 illustrative
// pending dYdX/GMX historical pulls.

import React from "react";
import { ChartEngine, computeChartDuration } from "./ChartEngine";
import { PROFITABLE_BY_BUCKET } from "./data";

const FPS = 30;
const W = 1920;
const H = 1080;

export const RetailPnLBuckets: React.FC = () => (
  <ChartEngine dataset={PROFITABLE_BY_BUCKET} />
);

export const retailPnLBucketsMeta = {
  id: "RetailPnLBuckets",
  component: RetailPnLBuckets,
  durationInFrames: computeChartDuration(PROFITABLE_BY_BUCKET, FPS),
  fps: FPS,
  width: W,
  height: H,
};
