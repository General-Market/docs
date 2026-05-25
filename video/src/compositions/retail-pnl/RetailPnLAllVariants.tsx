// All four variants chained into a single scrubable composition. Each variant
// gets its own Series.Sequence with a caption identifying it. Use this for
// direct visual comparison; pick the winner; ship it on its own from then on.

import React from "react";
import { Series } from "remotion";
import { ChartEngine, computeChartDuration } from "./ChartEngine";
import {
  HYPERLIQUID_BY_HORIZON,
  POLYMARKET_COHORT_FAN,
  PROFITABLE_BY_BUCKET,
  PNL_PERCENTILE_FAN,
  PROFIT_CONCENTRATION,
  TAX_PER_WALLET,
} from "./data";

const FPS = 30;
const W = 1920;
const H = 1080;

const sequence = [
  {
    dataset: PROFIT_CONCENTRATION,
    caption: "VARIANT E · CONCENTRATION — WHO TAKES THE POT",
  },
  {
    dataset: TAX_PER_WALLET,
    caption: "VARIANT F · TAX — WHAT EACH TIER MAKES",
  },
  {
    dataset: HYPERLIQUID_BY_HORIZON,
    caption: "VARIANT A · REAL · HYPERLIQUID 4 HORIZONS",
  },
  {
    dataset: POLYMARKET_COHORT_FAN,
    caption: "VARIANT B · PLACEHOLDER · POLYMARKET COHORT 2020-2025",
  },
  {
    dataset: PROFITABLE_BY_BUCKET,
    caption: "VARIANT C · MIXED · % PROFITABLE BY WALLET SIZE",
  },
  {
    dataset: PNL_PERCENTILE_FAN,
    caption: "VARIANT D · ILLUSTRATIVE · ANNUAL RETURN BY PERCENTILE",
  },
];

export const RetailPnLAllVariants: React.FC = () => {
  return (
    <Series>
      {sequence.map(({ dataset, caption }) => (
        <Series.Sequence
          key={dataset.id}
          durationInFrames={computeChartDuration(dataset, FPS)}
        >
          <ChartEngine dataset={dataset} caption={caption} />
        </Series.Sequence>
      ))}
    </Series>
  );
};

const totalDuration = sequence.reduce(
  (acc, s) => acc + computeChartDuration(s.dataset, FPS),
  0,
);

export const retailPnLAllVariantsMeta = {
  id: "RetailPnLAllVariants",
  component: RetailPnLAllVariants,
  durationInFrames: totalDuration,
  fps: FPS,
  width: W,
  height: H,
};
