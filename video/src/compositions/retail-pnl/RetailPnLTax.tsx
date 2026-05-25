// Variant F — Tax per wallet, by tier. Six bins from "Bottom 50%" to
// "Top 0.01%". Bottom tiers lose money, top tiers win money. The stats
// callout calls out the win/loss ratio between top and bottom.

import React from "react";
import { ChartEngine, computeChartDuration } from "./ChartEngine";
import { TAX_PER_WALLET } from "./data";

const FPS = 30;
const W = 1920;
const H = 1080;

export const RetailPnLTax: React.FC = () => (
  <ChartEngine dataset={TAX_PER_WALLET} />
);

export const retailPnLTaxMeta = {
  id: "RetailPnLTax",
  component: RetailPnLTax,
  durationInFrames: computeChartDuration(TAX_PER_WALLET, FPS),
  fps: FPS,
  width: W,
  height: H,
};
