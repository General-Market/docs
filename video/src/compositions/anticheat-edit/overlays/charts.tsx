import React from "react";
import { GlowBars } from "./GlowBars";
import {
  MECHANISM_BARS,
  VENUE_BLEED_BARS,
  COLOCATION_BARS,
  FEE_TIER_BARS,
  MAXING_COST_BARS,
  VENUE_RECEIPTS_BARS,
} from "./data";

// One chart per anticheat-flags section. Each one is just a `<GlowBars>`
// configured with title, subtitle, bars, and corner stamps. Keeping them
// thin lets the primitive carry the visual language.

export const MechanismsChart: React.FC = () => (
  <GlowBars
    title="Thirteen mechanisms"
    subtitle="Effective bps per round-trip · sorted, descending"
    bars={MECHANISM_BARS}
    footer="data · anticheat-flags · effective = peak × frequency"
    stamp="01 / 13 mechanisms"
  />
);

export const ColocationChart: React.FC = () => (
  <GlowBars
    title="Colocation tax"
    subtitle="Latency gap a retail VPS cannot buy past"
    bars={COLOCATION_BARS}
    footer="data · 11 venues · gated milliseconds only"
    stamp="02 / colocation"
  />
);

export const FeeTierChart: React.FC = () => (
  <GlowBars
    title="Fee tier gap"
    subtitle="MM round-trip rebate over retail · basis points"
    bars={FEE_TIER_BARS}
    footer="data · disclosed VIP 0 vs VIP 9 deltas"
    stamp="03 / fee tier"
  />
);

export const MaxingCostChart: React.FC = () => (
  <GlowBars
    title="Maxing out advantages"
    subtitle="Monthly burn to keep the MM seat · USD"
    bars={MAXING_COST_BARS}
    footer="data · infra + capital · staff not shown"
    stamp="04 / maxing out"
  />
);

export const VenueBleedChart: React.FC = () => (
  <GlowBars
    title="Per-venue bleed"
    subtitle="Cumulative % loss at 1,000 round-trips"
    bars={VENUE_BLEED_BARS}
    footer="data · sum of active mechanism bps"
    stamp="05 / per-venue bleed"
  />
);

export const VenueReceiptsChart: React.FC = () => (
  <GlowBars
    title="The receipts on file"
    subtitle="Documented incidents per venue · 56 total"
    bars={VENUE_RECEIPTS_BARS}
    footer="data · anticheat-flags · public dockets only"
    stamp="06 / receipts"
  />
);
