// Overlay timeline — what shows on top of the talking head, and when.
//
// `at` = position (seconds) inside the baked final.mp4 (the 1.2× cut) where
// the talk reaches that idea. Each overlay is a full-screen schematic that
// covers the camera for `duration` seconds while the audio keeps playing
// underneath. Positions are read from AntiCheat-current-cut.txt (the play
// timecodes of the current video).
//
// The opener is the bar-chart overview; everything after is a schematic from
// the illustrations kit, placed at the line that names it. The two reusable
// motifs (slow bleed, subsidy flow) reprise where the script repeats the
// argument.

import type { FC } from "react";
import { MechanismsOverview } from "./charts";
import { ILLUSTRATIONS_BY_SLUG } from "../illustrations/registry";

export type OverlaySlot = {
  /** final.mp4 seconds. */
  at: number;
  /** seconds the schematic stays on screen. */
  duration: number;
  component: FC;
};

const HOLD = 5.5;

// Pull a schematic by slug; fail loudly if a slug is renamed.
const ill = (slug: string): FC => {
  const entry = ILLUSTRATIONS_BY_SLUG[slug];
  if (!entry) throw new Error(`timeline: unknown illustration slug "${slug}"`);
  return entry.component;
};

export const OVERLAYS: OverlaySlot[] = [
  // Opener — the whole ranking at once.
  { at: 0.5, duration: 6, component: MechanismsOverview },

  // 01 Colocation — racks, then the Paris→Tokyo distance.
  { at: 28, duration: HOLD, component: ill("m01-colocation") },
  { at: 44, duration: HOLD, component: ill("motif-latency-map") },

  // Motif — the edge that vanishes between backtest and live.
  { at: 79, duration: HOLD, component: ill("motif-backtest-vs-live") },

  // 02 Unfair fee tiers — the bps ruler, then the tier ladder.
  { at: 99, duration: HOLD, component: ill("motif-bps-ruler") },
  { at: 150, duration: HOLD, component: ill("m02-fee-tiers") },

  // 03 Maxing out advantages — paying for the edge, then who funds it.
  { at: 169.5, duration: HOLD, component: ill("m03-maxing-out") },
  { at: 195.5, duration: HOLD, component: ill("motif-subsidy-flow") },

  // 04 Listing front-running — knowing before the news, then the slow bleed.
  { at: 211, duration: HOLD, component: ill("m04-listing-frontrun") },
  { at: 224, duration: HOLD, component: ill("motif-slow-bleed") },

  // 05 Dealer flow visibility — two views of one book.
  { at: 241, duration: HOLD, component: ill("m05-dealer-flow") },

  // 06 Order flow / PFOF — the zero-fee trap.
  { at: 295, duration: HOLD, component: ill("m06-order-flow-pfof") },

  // 07 Feed latency — the feed that arrives first.
  { at: 323, duration: HOLD, component: ill("m07-feed-latency") },

  // 08 Matching & queue priority — cutting the line.
  { at: 357, duration: HOLD, component: ill("m08-queue-priority") },

  // 09 Cancellation priority — pulling out first, then the slow bleed reprise.
  { at: 400, duration: HOLD, component: ill("m09-cancel-priority") },
  { at: 424, duration: HOLD, component: ill("motif-slow-bleed") },

  // 10 API rate limits — more calls, more sight.
  { at: 432.5, duration: HOLD, component: ill("m10-api-rate-limits") },

  // 11 Funding rate edge — the window you can't reach.
  { at: 447.5, duration: HOLD, component: ill("m11-funding-edge") },

  // 12 Maker rebates — paid to win, then the subsidy reprise.
  { at: 464, duration: HOLD, component: ill("m12-maker-rebates") },
  { at: 486, duration: HOLD, component: ill("motif-subsidy-flow") },

  // 13 Liquidation engine quirks — the wick they catch.
  { at: 536, duration: HOLD, component: ill("m13-liquidation") },

  // The turn — problem to answer.
  { at: 597, duration: HOLD, component: ill("turn-thin-field") },
  { at: 627, duration: HOLD, component: ill("turn-batch-pool") },
  { at: 634, duration: HOLD, component: ill("turn-one-vs-ten-thousand") },
  { at: 687, duration: HOLD, component: ill("turn-iceberg") },
  { at: 722, duration: HOLD, component: ill("turn-pareto") },
  { at: 745, duration: HOLD, component: ill("turn-infra-gap") },
];
