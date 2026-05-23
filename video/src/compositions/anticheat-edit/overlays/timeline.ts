// Mechanism → chart timeline.
//
// `at` = position (seconds) inside the baked final.mp4 where the video
// starts explaining that mechanism. Computed by walking cuts.json's
// segment durations to the source-second of each explanation
// (scripts/anticheat-final-times). Each chart fades in over the video
// for `duration` seconds; the audio keeps playing under it.
//
// Thirteen mechanism charts, plus an overview card that opens the video.

import type { FC } from "react";
import { MechanismsOverview, MECHANISM_CHARTS } from "./charts";

export type OverlaySlot = {
  /** final.mp4 seconds. */
  at: number;
  /** seconds the chart stays on screen. */
  duration: number;
  component: FC;
};

const HOLD = 5.5;

export const OVERLAYS: OverlaySlot[] = [
  { at: 0.5, duration: 6, component: MechanismsOverview },

  { at: 29.1, duration: HOLD, component: MECHANISM_CHARTS["colocation"] },
  { at: 47.8, duration: HOLD, component: MECHANISM_CHARTS["region-cluster"] },
  { at: 106.3, duration: HOLD, component: MECHANISM_CHARTS["vip-fee-tier"] },
  { at: 238.5, duration: HOLD, component: MECHANISM_CHARTS["listing-frontrun"] },
  { at: 275.9, duration: HOLD, component: MECHANISM_CHARTS["order-flow-vis"] },
  { at: 339.3, duration: HOLD, component: MECHANISM_CHARTS["pfof"] },
  { at: 352.0, duration: HOLD, component: MECHANISM_CHARTS["b-book"] },
  { at: 433.3, duration: HOLD, component: MECHANISM_CHARTS["jito-mev"] },
  { at: 460.2, duration: HOLD, component: MECHANISM_CHARTS["last-look"] },
  { at: 499.1, duration: HOLD, component: MECHANISM_CHARTS["api-rate-ceiling"] },
  { at: 516.8, duration: HOLD, component: MECHANISM_CHARTS["oracle-peek"] },
  { at: 602.1, duration: HOLD, component: MECHANISM_CHARTS["maker-rebate"] },
  { at: 619.6, duration: HOLD, component: MECHANISM_CHARTS["adl-visibility"] },
];
