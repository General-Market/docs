// Single source of truth for the AntiCheat "13 ways" overview and the
// per-mechanism title cards. Names, rank, group, and a short Alexandrian
// "Therefore" line live here so both compositions stay in sync.
//
// Ranks 1..13 mirror data-edge-ways.ts on the anticheat-flags page
// (descending by amortized bps per round-trip). Groups are the editorial
// reduction used in the video — four families of cheat, not eleven.

export type FlagGroup =
  | "Pre-trade leak"
  | "Middleman fee"
  | "On-chain ambush"
  | "Forced moves";

export type Flag = {
  rank: number;
  slug: string;
  // The hero title — short enough to land in one breath on screen.
  display: string;
  // The longer name used on the page; kept here for cross-reference.
  longName: string;
  group: FlagGroup;
  // Short "Therefore:" line — General Market's structural answer.
  fix: string;
  // Punchy amortized cost line, one phrase.
  bite: string;
};

export const THIRTEEN: Flag[] = [
  {
    rank: 1,
    slug: "jito-mev",
    display: "Sandwich MEV",
    longName: "Jito-bundle MEV (Solana)",
    group: "On-chain ambush",
    fix: "Sealed bets. No mempool to sandwich.",
    bite: "60 bps per round-trip",
  },
  {
    rank: 2,
    slug: "pfof",
    display: "PFOF markup",
    longName: "PFOF wholesaler markup",
    group: "Middleman fee",
    fix: "No order flow to sell. Bets post to the pool.",
    bite: "17 bps per round-trip",
  },
  {
    rank: 3,
    slug: "b-book",
    display: "Internal book",
    longName: "Internal book (b-book)",
    group: "Middleman fee",
    fix: "No internal book. The pool is the counterparty.",
    bite: "15 bps per round-trip",
  },
  {
    rank: 4,
    slug: "vip-fee-tier",
    display: "VIP fee tiers",
    longName: "VIP fee-tier subsidy",
    group: "Middleman fee",
    fix: "One flat fee. One tier for everyone.",
    bite: "11 bps per round-trip",
  },
  {
    rank: 5,
    slug: "order-flow-vis",
    display: "Order-book visibility",
    longName: "Order-flow visibility",
    group: "Pre-trade leak",
    fix: "Sealed bets. The book is private until the round resolves.",
    bite: "2 bps per round-trip",
  },
  {
    rank: 6,
    slug: "region-cluster",
    display: "Region clustering",
    longName: "AWS region clustering",
    group: "Pre-trade leak",
    fix: "Global pricing. Geography is not an input.",
    bite: "2 bps per round-trip",
  },
  {
    rank: 7,
    slug: "listing-frontrun",
    display: "Listing front-run",
    longName: "Listing front-running",
    group: "On-chain ambush",
    fix: "Sealed bets resolved by BLS oracle. No listing pipeline to leak.",
    bite: "1.6 bps per round-trip",
  },
  {
    rank: 8,
    slug: "maker-rebate",
    display: "Maker rebate",
    longName: "Maker rebate / inverted fees",
    group: "Middleman fee",
    fix: "No maker / taker model. One fee, whoever posts.",
    bite: "1.5 bps per round-trip",
  },
  {
    rank: 9,
    slug: "oracle-peek",
    display: "Oracle peek",
    longName: "Oracle / price-feed peek",
    group: "On-chain ambush",
    fix: "BLS-aggregated oracle consensus. No single peek.",
    bite: "0.6 bps per round-trip",
  },
  {
    rank: 10,
    slug: "colocation",
    display: "Colocation",
    longName: "Colocation latency edge",
    group: "Pre-trade leak",
    fix: "A parimutuel pool. No matching engine to game.",
    bite: "0.5 bps per round-trip",
  },
  {
    rank: 11,
    slug: "api-rate-ceiling",
    display: "API rate ceiling",
    longName: "API rate ceiling",
    group: "Pre-trade leak",
    fix: "One rate for everyone. The pool resolves once per round.",
    bite: "0.5 bps per round-trip",
  },
  {
    rank: 12,
    slug: "last-look",
    display: "Last-look reject",
    longName: "Last-look quote rejection",
    group: "Forced moves",
    fix: "A sealed-bid auction. No last-look rejection step.",
    bite: "0.2 bps per round-trip",
  },
  {
    rank: 13,
    slug: "adl-visibility",
    display: "Liquidation cascade",
    longName: "ADL / liquidation visibility",
    group: "Forced moves",
    fix: "No leverage. No forced-liquidation pathway to exploit.",
    bite: "0.004 bps per round-trip",
  },
];

// Stable column order for the overview tree.
export const GROUP_ORDER: FlagGroup[] = [
  "Pre-trade leak",
  "Middleman fee",
  "On-chain ambush",
  "Forced moves",
];

export const byGroup = (g: FlagGroup): Flag[] =>
  THIRTEEN.filter((f) => f.group === g).sort((a, b) => a.rank - b.rank);

export const bySlug = (slug: string): Flag => {
  const f = THIRTEEN.find((x) => x.slug === slug);
  if (!f) throw new Error(`No flag with slug "${slug}"`);
  return f;
};

export const byRank = (rank: number): Flag => {
  const f = THIRTEEN.find((x) => x.rank === rank);
  if (!f) throw new Error(`No flag with rank ${rank}`);
  return f;
};

export const romanize = (n: number): string => {
  const map: [number, string][] = [
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  let r = n;
  for (const [v, s] of map) {
    while (r >= v) {
      out += s;
      r -= v;
    }
  }
  return out;
};
