// THE chart. Scrubs through 10 markets, ordered from "fairest" to "most
// rigged". Same question every frame: how much of the profit pot does the
// top N% take. The curve gets MORE bowed each frame.

import React from "react";
import { ChartEngine, computeChartDuration } from "./ChartEngine";
import { MARKETS_CONCENTRATION } from "./data";

const FPS = 30;
const W = 1080;
const H = 1080;

export const RetailPnLMarkets: React.FC = () => (
  <ChartEngine dataset={MARKETS_CONCENTRATION} />
);

export const retailPnLMarketsMeta = {
  id: "RetailPnLMarkets",
  component: RetailPnLMarkets,
  durationInFrames: computeChartDuration(MARKETS_CONCENTRATION, FPS),
  fps: FPS,
  width: W,
  height: H,
};
