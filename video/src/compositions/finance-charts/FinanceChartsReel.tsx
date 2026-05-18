import React from "react";
import { AbsoluteFill, Series, useCurrentFrame, interpolate } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { C, FPS } from "./tokens";

import { Chart01 } from "./charts/Chart01_IVvsRV";
import { Chart02 } from "./charts/Chart02_PnLHeatmap";
import { Chart03 } from "./charts/Chart03_ShortStraddleStep";
import { Chart04 } from "./charts/Chart04_HourlyRVHeatmap";
import { Chart05 } from "./charts/Chart05_VolCone";
import { Chart06 } from "./charts/Chart06_StraddleScatter";
import { Chart07 } from "./charts/Chart07_BTCMultiPanel";
import { Chart08 } from "./charts/Chart08_MonteCarlo";
import { Chart09 } from "./charts/Chart09_VegaCurves";
import { Chart10 } from "./charts/Chart10_PerInstrumentPnL";
import { Chart11 } from "./charts/Chart11_IndexBasis";
import { Chart12 } from "./charts/Chart12_FridayStraddles";

loadInter("normal", { subsets: ["latin"], weights: ["400", "500", "600", "700"] });

const SHORT = 150;
const LONG = 180;

const SCHEDULE: { id: string; component: React.FC; durationInFrames: number }[] = [
  { id: "01", component: Chart01, durationInFrames: SHORT },
  { id: "02", component: Chart02, durationInFrames: SHORT },
  { id: "03", component: Chart03, durationInFrames: SHORT },
  { id: "04", component: Chart04, durationInFrames: SHORT },
  { id: "05", component: Chart05, durationInFrames: SHORT },
  { id: "06", component: Chart06, durationInFrames: SHORT },
  { id: "07", component: Chart07, durationInFrames: LONG },
  { id: "08", component: Chart08, durationInFrames: LONG },
  { id: "09", component: Chart09, durationInFrames: SHORT },
  { id: "10", component: Chart10, durationInFrames: LONG },
  { id: "11", component: Chart11, durationInFrames: SHORT },
  { id: "12", component: Chart12, durationInFrames: SHORT },
];

export const REEL_DURATION =
  SCHEDULE.reduce((n, s) => n + s.durationInFrames, 0);

const SegmentWithFade: React.FC<{
  Component: React.FC;
  durationInFrames: number;
}> = ({ Component, durationInFrames }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, 12, durationInFrames - 18, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <AbsoluteFill style={{ opacity }}>
      <Component />
    </AbsoluteFill>
  );
};

export const FinanceChartsReel: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Series>
        {SCHEDULE.map(({ id, component: Component, durationInFrames }) => (
          <Series.Sequence key={id} durationInFrames={durationInFrames}>
            <SegmentWithFade
              Component={Component}
              durationInFrames={durationInFrames}
            />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};

export const financeChartsReelMeta = {
  id: "FinanceChartsReel",
  component: FinanceChartsReel,
  durationInFrames: REEL_DURATION,
  fps: FPS,
  width: 1920,
  height: 1080,
};
