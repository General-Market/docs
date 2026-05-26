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

// The climax — one trade explodes into ten million, per user, per day.
//   1 trade settles 10,000 markets in a single transaction,
//   × 100 batches a day, × the 10 markets you pick = 10,000,000 trades/user.
export const CHAIN_STEPS: { factor: number; head: string; sub: string }[] = [
  { factor: 10_000, head: "× 10,000", sub: "markets / transaction" },
  { factor: 100, head: "× 100", sub: "batches / day" },
  { factor: 10, head: "× 10", sub: "markets you pick" },
];
export const CHAIN_TOTAL = CHAIN_STEPS.reduce((n, s) => n * s.factor, 1); // 10,000,000

// Hyperliquid ~1.5M est. fills/day (May 2026) — one GM user clears more.
export const HYPERLIQUID_TRADES_PER_DAY = 1_500_000;

// What that throughput backs: a billion in addressable liquidity.
export const LIQUIDITY_UNLOCKED = 1_000_000_000; // $1B
