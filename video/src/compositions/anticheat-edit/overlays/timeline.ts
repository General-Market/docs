// Section title → chart timeline.
//
// Timestamps are the position (seconds) of each section-title marker
// inside the baked final.mp4. They were computed by walking cuts.json
// (sum of segment durations through that marker); see overlays/README.
//
// Each entry mounts the named chart starting at `at` for `duration` seconds.
// The chart appears fullscreen on top of the OffthreadVideo and the audio
// keeps playing under it.

import type { FC } from "react";
import {
  MechanismsChart,
  ColocationChart,
  FeeTierChart,
  MaxingCostChart,
  VenueBleedChart,
  VenueReceiptsChart,
} from "./charts";

export type OverlaySlot = {
  /** Final.mp4 seconds. */
  at: number;
  /** Seconds the chart stays on screen. */
  duration: number;
  component: FC;
};

// Each chart sits on screen for ~6s — enough for the eye to read all bars,
// short enough to keep the cut moving. The first overlay (mechanisms) opens
// the video as a chapter card; the last (receipts) closes it.
export const OVERLAYS: OverlaySlot[] = [
  // Hook → opening chapter card. Sits for 6s right at the start.
  { at: 0.5, duration: 6, component: MechanismsChart },

  // Title: Colocation
  { at: 30.2, duration: 6, component: ColocationChart },

  // Title: unfair fee tier
  { at: 114.5, duration: 6, component: FeeTierChart },

  // Title: maxing out advantages
  { at: 213.9, duration: 6, component: MaxingCostChart },

  // Title: order flows (also covers PFOF / b-book → use venue bleed)
  { at: 386.1, duration: 6, component: VenueBleedChart },

  // Title: maker rebate tiers — closes on the receipt count
  { at: 693.9, duration: 6, component: VenueReceiptsChart },
];
