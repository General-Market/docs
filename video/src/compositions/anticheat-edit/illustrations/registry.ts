// The illustration catalogue — every schematic that overlays the AntiCheat
// edit, in screen order: the five reusable motifs, the thirteen mechanisms
// (script numbering 01–13), then the turn from problem to answer.
//
// One source of truth. The reel and the per-scene metas both read this list,
// and the overlay timeline will pull components from it by slug.

import type { FC } from "react";

import { LatencyMap } from "./LatencyMap";
import { BacktestVsLive } from "./BacktestVsLive";
import { SlowBleed } from "./SlowBleed";
import { SubsidyFlow } from "./SubsidyFlow";
import { BpsRuler } from "./BpsRuler";

import { Colocation } from "./Colocation";
import { FeeTiers } from "./FeeTiers";
import { MaxingOut } from "./MaxingOut";
import { ListingFrontrun } from "./ListingFrontrun";
import { DealerFlowVisibility } from "./DealerFlowVisibility";
import { OrderFlowPfof } from "./OrderFlowPfof";
import { FeedLatency } from "./FeedLatency";
import { QueuePriority } from "./QueuePriority";
import { CancelPriority } from "./CancelPriority";
import { ApiRateLimits } from "./ApiRateLimits";
import { FundingEdge } from "./FundingEdge";
import { MakerRebates } from "./MakerRebates";
import { LiquidationQuirks } from "./LiquidationQuirks";

import { ThinField } from "./ThinField";
import { BatchPool } from "./BatchPool";
import { OneVsTenThousand } from "./OneVsTenThousand";
import { Iceberg } from "./Iceberg";
import { ParetoSplit } from "./ParetoSplit";
import { InfraGap } from "./InfraGap";

export type IllustrationEntry = {
  /** Stable key for the overlay timeline. */
  slug: string;
  /** Component name, used for the studio composition id. */
  name: string;
  component: FC;
};

export const ILLUSTRATIONS: IllustrationEntry[] = [
  // ── Recurring motifs
  { slug: "motif-latency-map", name: "LatencyMap", component: LatencyMap },
  { slug: "motif-backtest-vs-live", name: "BacktestVsLive", component: BacktestVsLive },
  { slug: "motif-slow-bleed", name: "SlowBleed", component: SlowBleed },
  { slug: "motif-subsidy-flow", name: "SubsidyFlow", component: SubsidyFlow },
  { slug: "motif-bps-ruler", name: "BpsRuler", component: BpsRuler },

  // ── Thirteen mechanisms, script order
  { slug: "m01-colocation", name: "Colocation", component: Colocation },
  { slug: "m02-fee-tiers", name: "FeeTiers", component: FeeTiers },
  { slug: "m03-maxing-out", name: "MaxingOut", component: MaxingOut },
  { slug: "m04-listing-frontrun", name: "ListingFrontrun", component: ListingFrontrun },
  { slug: "m05-dealer-flow", name: "DealerFlowVisibility", component: DealerFlowVisibility },
  { slug: "m06-order-flow-pfof", name: "OrderFlowPfof", component: OrderFlowPfof },
  { slug: "m07-feed-latency", name: "FeedLatency", component: FeedLatency },
  { slug: "m08-queue-priority", name: "QueuePriority", component: QueuePriority },
  { slug: "m09-cancel-priority", name: "CancelPriority", component: CancelPriority },
  { slug: "m10-api-rate-limits", name: "ApiRateLimits", component: ApiRateLimits },
  { slug: "m11-funding-edge", name: "FundingEdge", component: FundingEdge },
  { slug: "m12-maker-rebates", name: "MakerRebates", component: MakerRebates },
  { slug: "m13-liquidation", name: "LiquidationQuirks", component: LiquidationQuirks },

  // ── The turn — problem to answer
  { slug: "turn-thin-field", name: "ThinField", component: ThinField },
  { slug: "turn-batch-pool", name: "BatchPool", component: BatchPool },
  { slug: "turn-one-vs-ten-thousand", name: "OneVsTenThousand", component: OneVsTenThousand },
  { slug: "turn-iceberg", name: "Iceberg", component: Iceberg },
  { slug: "turn-pareto", name: "ParetoSplit", component: ParetoSplit },
  { slug: "turn-infra-gap", name: "InfraGap", component: InfraGap },
];

export const ILLUSTRATIONS_BY_SLUG: Record<string, IllustrationEntry> =
  Object.fromEntries(ILLUSTRATIONS.map((e) => [e.slug, e]));
