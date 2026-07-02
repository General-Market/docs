import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { ChartRoom } from "./scenes/ChartRoom";
import { Buildings } from "./scenes/Buildings";
import { Chart2 } from "./scenes/Chart2";
import { AdvDis } from "./scenes/AdvDis";
import { Slot } from "./scenes/Slot";
import { Vignette } from "./lib/world";

export const FPS = 25;
export const DURATION = 5433; // 217.32s — matches reference irswap-original.mp4 (25fps/5433f)

// Scene frame ranges (reference frame N = composition frame N)
const RANGES = {
  chartRoom: [0, 1705], // title card + 3-chapter chart room
  buildings: [1705, 3588], // S05-S09 lender/company/bank map
  // chart2 overlaps buildings from 3572: the wall gridlines start drawing
  // while the buildings scene is still fading (continuous room, no cut).
  chart2: [3572, 4138], // S10 settlement chart room
  // advDis starts 4131 to own the paper-dashboard tumble after the chart
  // fly-out; slot runs to 4690 because the reel UI pops out at 4684/4685.
  advDis: [4131, 4263], // S11 "Advantages & Disadvantages"
  slot: [4263, 4690], // S12 rate reel
  community: [4690, 5276], // S13-S14 community map + cube + break-up
  outro: [5276, 5433], // S15 credits card
} as const;

const Placeholder: React.FC = () => <Vignette />;

const seq = (range: readonly [number, number], node: React.ReactNode, name: string) => (
  <Sequence from={range[0]} durationInFrames={range[1] - range[0]} name={name}>
    {node}
  </Sequence>
);

export const IRSwapComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#EFEFEF" }}>
      {seq(RANGES.chartRoom, <ChartRoom />, "ChartRoom")}
      {seq(RANGES.buildings, <Buildings />, "Buildings")}
      {seq(RANGES.chart2, <Chart2 />, "Chart2")}
      {seq(RANGES.advDis, <AdvDis />, "AdvDis")}
      {seq(RANGES.slot, <Slot />, "Slot")}
      {seq(RANGES.community, <Placeholder />, "Community")}
      {seq(RANGES.outro, <Placeholder />, "Outro")}
    </AbsoluteFill>
  );
};

export const irswapReplicateMeta = {
  id: "IRSwap-Replicate",
  component: IRSwapComposition,
  width: 854,
  height: 480,
  fps: FPS,
  durationInFrames: DURATION,
};
