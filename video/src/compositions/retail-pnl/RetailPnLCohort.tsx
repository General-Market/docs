// Variant D — Polymarket cohort by year of first trade. Six ghost lines
// (2020-2025), one highlighted, scrubbing through cohort years to show
// retail PnL eroding for later joiners. Numbers placeholder until the
// Dune query lands; shape is the rhetorical claim.

import React from "react";
import { ChartEngine, computeChartDuration } from "./ChartEngine";
import { POLYMARKET_COHORT_FAN } from "./data";

const FPS = 30;
const W = 1920;
const H = 1080;

export const RetailPnLCohort: React.FC = () => (
  <ChartEngine dataset={POLYMARKET_COHORT_FAN} />
);

export const retailPnLCohortMeta = {
  id: "RetailPnLCohort",
  component: RetailPnLCohort,
  durationInFrames: computeChartDuration(POLYMARKET_COHORT_FAN, FPS),
  fps: FPS,
  width: W,
  height: H,
};
