import { type FC } from "react";
import { MechanismsOverview } from "./charts";
import { TitleSlide } from "./TitleSlide";
import { topicChart } from "./LogoBarChart";
import { ILLUSTRATIONS_BY_SLUG } from "../illustrations/registry";
import { CHAPTERS } from "./chapters";

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
//   subchart — the per-venue bar chart from /anticheat-flags (TOPIC_BARS):
//              venue logos, the sourced value per venue, General at zero. Full
//              height beside the 1/3 webcam.
//
// The title/subchart fade; only the explanation cards pixel-dissolve. The
// two reusable motifs (slow bleed, subsidy flow) reprise where the script
// repeats the argument.
//
// All thirteen mechanisms carry a bar chart. Funding and Liquidation also have
// an article-proof flash in ./articles; funding's chart takes its schematic
// slot (the section is tight), liquidation's sits after the article. "Maxing
// out" draws the market-maker-subsidy chart.
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

// A blue section title card for chapter `num` (1-based), sourced from CHAPTERS
// so the card's number, name, and time can never drift from the ChapterRail.
// The inner function MUST stay named "Title" — panelEvents.ts keys the
// side-flip on `component.name === "Title"`.
const titleCard = (num: number): FC =>
  function Title() {
    const ch = CHAPTERS[num - 1];
    return (
      <TitleSlide
        kicker={`MECHANISM ${String(ch.n).padStart(2, "0")} / 13`}
        title={ch.name}
      />
    );
  };

// A title OverlaySlot built straight from CHAPTERS — one source for name + time.
const titleSlot = (num: number): OverlaySlot => ({
  at: CHAPTERS[num - 1].at,
  duration: TITLE,
  component: titleCard(num),
});

// Per-venue subchart for a mechanism — the /anticheat-flags "unfair matrix"
// rendered as a full-height horizontal bar chart: venue logos as labels, the
// sourced value per venue, General at zero. Keyed by the video mechanism slug;
// the data lives in venue-bars.ts (TOPIC_BARS).
const subchart = (slug: string): FC => topicChart(slug);

export const OVERLAYS: OverlaySlot[] = [
  // Opener — the whole ranking at once.
  { at: 0.5, duration: 6, component: MechanismsOverview, pixel: true },

  // ── 01 Colocation
  titleSlot(1),
  { at: 29.807, duration: HOLD, component: ill("m01-colocation"), pixel: true },
  { at: 37.796, duration: HOLD, component: ill("motif-latency-map"), pixel: true },
  { at: 57.187, duration: HOLD, component: subchart("colocation") },
  { at: 60.734, duration: HOLD, component: ill("motif-backtest-vs-live"), pixel: true },

  // ── 02 Unfair fee tiers  (article: vip-fee-tier @110.66)
  titleSlot(2),
  { at: 79.287, duration: HOLD, component: ill("motif-bps-ruler"), pixel: true },
  { at: 90.05, duration: HOLD, component: ill("m02-fee-tiers"), pixel: true },
  { at: 102.561, duration: HOLD, component: subchart("vip-fee-tier") },

  // ── 03 Maxing out advantages  (chart: market-maker subsidy programs)
  titleSlot(3),
  { at: 118.658, duration: HOLD, component: ill("m03-maxing-out"), pixel: true },
  { at: 128.711, duration: HOLD, component: ill("motif-subsidy-flow"), pixel: true },
  { at: 137.5, duration: HOLD, component: subchart("maxing-out") },

  // ── 04 Listing front-running  (article: listing-frontrun @160.48)
  titleSlot(4),
  { at: 153.588, duration: HOLD, component: ill("m04-listing-frontrun"), pixel: true },
  { at: 168.426, duration: HOLD, component: subchart("listing-frontrun") },
  { at: 175.363, duration: HOLD, component: ill("motif-slow-bleed"), pixel: true },

  // ── 05 Dealer flow visibility  (article: order-flow-vis @191.69)
  titleSlot(5),
  { at: 183.925, duration: HOLD, component: ill("m05-dealer-flow"), pixel: true },
  { at: 212.419, duration: HOLD, component: subchart("order-flow-vis") },

  // ── 06 Order flow  (article: pfof @242.36)
  titleSlot(6),
  { at: 236.465, duration: HOLD, component: ill("m06-order-flow-pfof"), pixel: true },
  { at: 248.769, duration: HOLD, component: subchart("pfof") },

  // ── 07 Feed latency
  titleSlot(7),
  { at: 258.7, duration: HOLD, component: ill("m07-feed-latency"), pixel: true },
  { at: 264.512, duration: HOLD, component: subchart("region-cluster") },

  // ── 08 Matching & queue priority  (articles: jito-mev @302.69, matching @312.88)
  titleSlot(8),
  { at: 282.038, duration: HOLD, component: ill("m08-queue-priority"), pixel: true },
  { at: 296.642, duration: HOLD, component: subchart("jito-mev") },

  // ── 09 Cancellation priority
  titleSlot(9),
  { at: 321.172, duration: HOLD, component: ill("m09-cancel-priority"), pixel: true },
  { at: 329.201, duration: HOLD, component: subchart("last-look") },
  { at: 345.686, duration: HOLD, component: ill("motif-slow-bleed"), pixel: true },

  // ── 10 API rate limits (short section → tighter subchart)
  titleSlot(10),
  { at: 354.0, duration: HOLD, component: ill("m10-api-rate-limits"), pixel: true },
  { at: 360.657, duration: 5.0, component: subchart("api-rate-ceiling") },

  // ── 11 Funding rate edge  (tight section: chart takes the schematic slot; article @373.4)
  titleSlot(11),
  { at: 367.688, duration: HOLD, component: subchart("funding-edge") },

  // ── 12 Market-maker rebates  (article: maker-rebate @404.6)
  titleSlot(12),
  { at: 383.0, duration: HOLD, component: ill("m12-maker-rebates"), pixel: true },
  { at: 396.775, duration: HOLD, component: ill("motif-subsidy-flow"), pixel: true },
  { at: 423.99, duration: HOLD, component: subchart("maker-rebate") },

  // ── 13 Liquidation engine quirks  (article: adl-visibility @455.19; chart after it)
  titleSlot(13),
  { at: 444.267, duration: HOLD, component: ill("m13-liquidation"), pixel: true },
  { at: 463.0, duration: HOLD, component: subchart("liquidation") },

  // ── The turn — problem to answer  (article: long-list @556.42)
  { at: 482.045, duration: HOLD, component: ill("turn-thin-field"), pixel: true },
  { at: 508.58, duration: HOLD, component: ill("turn-batch-pool"), pixel: true },
  { at: 521.585, duration: HOLD, component: ill("turn-one-vs-ten-thousand"), pixel: true },
  { at: 527.085, duration: HOLD, component: ill("turn-iceberg"), pixel: true },
  { at: 601.483, duration: HOLD, component: ill("turn-pareto"), pixel: true },
  { at: 618.815, duration: HOLD, component: ill("turn-infra-gap"), pixel: true },
];
