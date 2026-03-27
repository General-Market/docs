/**
 * VisionVC3 — Chart scenes (scatter + bar)
 *
 * Split from VisionVC2. Two scenes:
 *   1. Cost vs Markets scatter plot
 *   2. Settlements per Day bar chart
 */
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { CostMarketsScene } from "../vision-vc2/CostMarketsChart";
import { SettlementsBarChart } from "../vision-vc2/SettlementsBarChart";

const FPS = 30;

const CHART_DURATION = 120;
const TRANSITION = 8;
const BAR_DURATION = 120;
const TOTAL = CHART_DURATION + BAR_DURATION - TRANSITION;

export const VisionVC3Composition: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#F5F4EF" }}>
    <Sequence durationInFrames={CHART_DURATION}>
      <CostMarketsScene />
    </Sequence>

    <Sequence from={CHART_DURATION - TRANSITION} durationInFrames={BAR_DURATION}>
      <SettlementsBarChart />
    </Sequence>
  </AbsoluteFill>
);

export const visionVC3Meta = {
  id: "VisionVC3",
  component: VisionVC3Composition,
  durationInFrames: TOTAL,
  fps: FPS as 30,
  width: 1920 as 1920,
  height: 1080 as 1080,
};
