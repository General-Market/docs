// The ten markets are taken straight from the product screenshot (TOP 10 BY
// PRICE). `you` is the call the cursor makes in beat 1; `outcome` is how the
// market actually settles in beat 5. Where they match, you win that line.

export type Market = {
  id: string;
  name: string;
  price: number;
  you: "up" | "down";
  outcome: "up" | "down";
  seed: number;
};

export const MARKETS: Market[] = [
  { id: "F", name: "Fartcoin", price: 0.18, you: "down", outcome: "down", seed: 11 },
  { id: "C", name: "Comedian", price: 0.09, you: "up", outcome: "up", seed: 27 },
  { id: "A", name: "Alchemist AI", price: 0.07, you: "down", outcome: "up", seed: 5 },
  { id: "A", name: "AI Rig Complex", price: 0.06, you: "up", outcome: "up", seed: 42 },
  { id: "J", name: "jelly-my-jelly", price: 0.06, you: "down", outcome: "down", seed: 18 },
  { id: "P", name: "Peanut the Squirrel", price: 0.05, you: "down", outcome: "up", seed: 63 },
  { id: "N", name: "NotInEmployment", price: 0.04, you: "down", outcome: "down", seed: 9 },
  { id: "P", name: "PYTHIA", price: 0.03, you: "down", outcome: "up", seed: 31 },
  { id: "V", name: "Verse World", price: 0.03, you: "down", outcome: "down", seed: 55 },
  { id: "M", name: "Manifesting", price: 0.02, you: "up", outcome: "up", seed: 24 },
];

export const STAKE_PER_MARKET = 1; // $1 × 10 markets
export const N_MARKETS = MARKETS.length;

// Beat 3 — you plus four others fire the same kind of packet into the pool.
export const TRADER_NAMES = ["You", "Trader 2", "Trader 3", "Trader 4", "Trader 5"];
export const N_TRADERS = TRADER_NAMES.length;

// Every trader's call on every market — trader order [You, 2, 3, 4, 5], one row
// per market (same order as MARKETS). Row 0 of each = MARKETS[i].you. Tuned so
// each line's pools differ and your seven winning lines sit on small winning
// sides (bigger parimutuel payout) — a clean, positive net for the payout beat.
type Side = "up" | "down";
export const PICKS_BY_MARKET: Side[][] = [
  ["down", "up", "up", "down", "up"], // Fartcoin   out down → down 2
  ["up", "down", "up", "up", "down"], // Comedian   out up   → up 3
  ["down", "up", "up", "down", "up"], // Alchemist  out up   → up 3 (you lose)
  ["up", "down", "down", "up", "down"], // AI Rig    out up   → up 2
  ["down", "up", "down", "down", "up"], // jelly     out down → down 3
  ["down", "down", "up", "up", "up"], // Peanut      out up   → up 3 (you lose)
  ["down", "up", "up", "down", "up"], // NotInEmp    out down → down 2
  ["down", "up", "up", "up", "down"], // PYTHIA      out up   → up 3 (you lose)
  ["down", "down", "down", "up", "up"], // Verse     out down → down 3
  ["up", "down", "up", "down", "up"], // Manifesting out up   → up 3
];

export const sideCount = (i: number, side: Side): number =>
  PICKS_BY_MARKET[i].filter((s) => s === side).length;

// $1 per trader per line; the winning side splits the whole line pool.
export const linePool = (): number => N_TRADERS * STAKE_PER_MARKET;

// What You collect on line i (0 if you lose it), and the running totals.
export const yourReturn = (i: number): number => {
  const m = MARKETS[i];
  if (m.you !== m.outcome) return 0;
  const winners = sideCount(i, m.outcome);
  return linePool() / winners;
};
export const YOUR_WINS = MARKETS.filter((m) => m.you === m.outcome).length;
export const YOUR_COLLECT = MARKETS.reduce((s, _m, i) => s + yourReturn(i), 0);
export const YOUR_STAKE = N_MARKETS * STAKE_PER_MARKET;
export const YOUR_NET = YOUR_COLLECT - YOUR_STAKE;

// Beat 7 — the zoom-out. Each line is one batch, one transaction.
export const SCALE_STEPS: { n: string; label: string; sub: string }[] = [
  { n: "10,000", label: "Polymarket markets", sub: "one transaction" },
  { n: "18,000", label: "crypto pairs", sub: "one transaction" },
  { n: "10,000", label: "Twitch streamers", sub: "one transaction" },
];

// 38,000 markets per batch × 100 batches a day.
export const PER_BATCH = 38_000;
export const BATCHES_PER_DAY = 100;
export const GM_PER_DAY = PER_BATCH * BATCHES_PER_DAY; // 3,800,000

// Beat 8 — real trades (executed fills, not order churn) per day, and the
// users it took. The point: General Market does it with ONE user. Figures are
// May 2026: Hyperliquid ~1.4M users + ~$5.75B/day vol → ~1.5M est. fills/day;
// Polymarket ~478K monthly traders (ATH Oct 2025) + ~260K trades/day. Swap
// HYPERLIQUID_TRADES_PER_DAY if a clean fill count surfaces.
export const HYPERLIQUID_TRADES_PER_DAY = 1_500_000;
export type Bar = { id: string; name: string; value: number; users: string; accent: string; note: string };
export const BARS: Bar[] = [
  { id: "generalmarket", name: "General Market", value: GM_PER_DAY, users: "1 user", accent: "#1F6FEB", note: "projected · 38k × 100 batches" },
  { id: "hyperliquid", name: "Hyperliquid", value: HYPERLIQUID_TRADES_PER_DAY, users: "1.4M users", accent: "#109A8E", note: "est. fills · $5.75B/day" },
  { id: "polymarket", name: "Polymarket", value: 260_000, users: "478K users", accent: "#16B33F", note: "~478K traders · May 2026" },
];
