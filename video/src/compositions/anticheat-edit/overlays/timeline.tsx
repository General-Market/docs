import { type FC } from "react";
import { MechanismsOverview } from "./charts";
import { TitleSlide } from "./TitleSlide";
import { ExchangeBreakdown } from "./ExchangeBreakdown";
import { ILLUSTRATIONS_BY_SLUG } from "../illustrations/registry";

// Overlay timeline — what shows on top of the talking head, and when.
//
// `at` = position (seconds) inside the baked final.mp4 (the 1.2× cut) where
// the talk reaches that beat. Positions come from AntiCheat-current-cut.txt
// (play timecodes) and scripts/talking-head-edit/05_title_cards.py.
//
// Each mechanism gets three beats:
//   title    — the blue section card, dropped over the baked title card.
//   explain  — the schematic (one of the 24 illustrations) — enters with the
//              chunky pixel dissolve.
//   subchart — the venues documented to run it (ExchangeBreakdown).
//
// The title/subchart fade; only the explanation cards pixel-dissolve. The
// two reusable motifs (slow bleed, subsidy flow) reprise where the script
// repeats the argument.
//
// Timecodes are kept clear of the article-proof flashes in ./articles
// (the court-case screenshots). Where an article already proves a mechanism
// at the same beat (funding, liquidation), its subchart is dropped rather
// than stacked. "Maxing out" has no venue analogue, so no subchart.
//
// Subcharts are keyed to the bps-rank taxonomy (data.ts), bridged to the
// spoken mechanism.

export type OverlaySlot = {
  /** final.mp4 seconds. */
  at: number;
  /** seconds the card stays on screen. */
  duration: number;
  component: FC;
  /** Explanation cards dissolve in as pixels; titles/subcharts fade. */
  pixel?: boolean;
};

const HOLD = 5.5;
const TITLE = 2.2;

// A schematic by slug — fail loudly if a slug is renamed.
const ill = (slug: string): FC => {
  const entry = ILLUSTRATIONS_BY_SLUG[slug];
  if (!entry) throw new Error(`timeline: unknown illustration slug "${slug}"`);
  return entry.component;
};

// A blue section title card, with the spoken mechanism name.
const titleCard =
  (num: number, name: string): FC =>
  function Title() {
    return (
      <TitleSlide
        kicker={`MECHANISM ${String(num).padStart(2, "0")} / 13`}
        title={name}
      />
    );
  };

// The venue subchart for a bps-rank mechanism slug.
const subchart =
  (slug: string): FC =>
  function Subchart() {
    return <ExchangeBreakdown mechanismSlug={slug} />;
  };

export const OVERLAYS: OverlaySlot[] = [
  // Opener — the whole ranking at once.
  { at: 0.5, duration: 6, component: MechanismsOverview, pixel: true },

  // ── 01 Colocation
  { at: 24.0, duration: TITLE, component: titleCard(1, "Colocation") },
  { at: 28, duration: HOLD, component: ill("m01-colocation"), pixel: true },
  { at: 44, duration: HOLD, component: ill("motif-latency-map"), pixel: true },
  { at: 60, duration: HOLD, component: subchart("colocation") },
  { at: 79, duration: HOLD, component: ill("motif-backtest-vs-live"), pixel: true },

  // ── 02 Unfair fee tiers  (article: vip-fee-tier @130)
  { at: 91.8, duration: TITLE, component: titleCard(2, "Unfair Fee Tiers") },
  { at: 99, duration: HOLD, component: ill("motif-bps-ruler"), pixel: true },
  { at: 116, duration: HOLD, component: ill("m02-fee-tiers"), pixel: true },
  { at: 150, duration: HOLD, component: subchart("vip-fee-tier") },

  // ── 03 Maxing out advantages (no venue analogue → no subchart)
  { at: 160.5, duration: TITLE, component: titleCard(3, "Maxing Out Advantages") },
  { at: 169.5, duration: HOLD, component: ill("m03-maxing-out"), pixel: true },
  { at: 190, duration: HOLD, component: ill("motif-subsidy-flow"), pixel: true },

  // ── 04 Listing front-running  (article: listing-frontrun @214.9)
  { at: 203.1, duration: TITLE, component: titleCard(4, "Listing Front-Running") },
  { at: 207, duration: HOLD, component: ill("m04-listing-frontrun"), pixel: true },
  { at: 222, duration: HOLD, component: ill("motif-slow-bleed"), pixel: true },
  { at: 229, duration: HOLD, component: subchart("listing-frontrun") },

  // ── 05 Dealer flow visibility  (article: order-flow-vis @255)
  { at: 235.8, duration: TITLE, component: titleCard(5, "Dealer Flow Visibility") },
  { at: 241, duration: HOLD, component: ill("m05-dealer-flow"), pixel: true },
  { at: 263, duration: HOLD, component: subchart("order-flow-vis") },

  // ── 06 Order flow  (article: pfof @308.6)
  { at: 288.5, duration: TITLE, component: titleCard(6, "Order Flow") },
  { at: 295, duration: HOLD, component: ill("m06-order-flow-pfof"), pixel: true },
  { at: 302, duration: HOLD, component: subchart("pfof") },

  // ── 07 Feed latency
  { at: 318.6, duration: TITLE, component: titleCard(7, "Feed Latency") },
  { at: 323, duration: HOLD, component: ill("m07-feed-latency"), pixel: true },
  { at: 338, duration: HOLD, component: subchart("region-cluster") },

  // ── 08 Matching & queue priority  (articles: jito-mev @368, matching @388)
  { at: 352.4, duration: TITLE, component: titleCard(8, "Matching & Queue Priority") },
  { at: 357, duration: HOLD, component: ill("m08-queue-priority"), pixel: true },
  { at: 376, duration: HOLD, component: subchart("jito-mev") },

  // ── 09 Cancellation priority
  { at: 395.4, duration: TITLE, component: titleCard(9, "Cancellation Priority") },
  { at: 400, duration: HOLD, component: ill("m09-cancel-priority"), pixel: true },
  { at: 414, duration: HOLD, component: ill("motif-slow-bleed"), pixel: true },
  { at: 421, duration: HOLD, component: subchart("last-look") },

  // ── 10 API rate limits (short section → tighter subchart)
  { at: 429.3, duration: TITLE, component: titleCard(10, "API Rate Limits") },
  { at: 432.5, duration: HOLD, component: ill("m10-api-rate-limits"), pixel: true },
  { at: 438, duration: 5.0, component: subchart("api-rate-ceiling") },

  // ── 11 Funding rate edge  (article: funding @451 — it carries the proof)
  { at: 443.1, duration: TITLE, component: titleCard(11, "Funding Rate Edge") },
  { at: 445.3, duration: HOLD, component: ill("m11-funding-edge"), pixel: true },

  // ── 12 Market-maker rebates  (article: maker-rebate @478)
  { at: 461.7, duration: TITLE, component: titleCard(12, "Market-Maker Rebates") },
  { at: 466, duration: HOLD, component: ill("m12-maker-rebates"), pixel: true },
  { at: 486, duration: HOLD, component: ill("motif-subsidy-flow"), pixel: true },
  { at: 505, duration: HOLD, component: subchart("maker-rebate") },

  // ── 13 Liquidation engine quirks  (article: adl-visibility @560 — carries proof)
  { at: 534.2, duration: TITLE, component: titleCard(13, "Liquidation Engine Quirks") },
  { at: 539, duration: HOLD, component: ill("m13-liquidation"), pixel: true },

  // ── The turn — problem to answer  (article: long-list @736)
  { at: 597, duration: HOLD, component: ill("turn-thin-field"), pixel: true },
  { at: 627, duration: HOLD, component: ill("turn-batch-pool"), pixel: true },
  { at: 634, duration: HOLD, component: ill("turn-one-vs-ten-thousand"), pixel: true },
  { at: 687, duration: HOLD, component: ill("turn-iceberg"), pixel: true },
  { at: 722, duration: HOLD, component: ill("turn-pareto"), pixel: true },
  { at: 745, duration: HOLD, component: ill("turn-infra-gap"), pixel: true },
];
