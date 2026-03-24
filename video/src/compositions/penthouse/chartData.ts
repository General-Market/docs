// Seeded PRNG (mulberry32)
export function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller normal distribution
function normalRandom(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2);
}

// OHLC candle type
export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Generate OHLC candles using geometric Brownian motion
export function generateCandles(seed: number, count: number): Candle[] {
  const rng = seededRandom(seed);
  const candles: Candle[] = [];
  let price = 100 + rng() * 50; // Start between 100-150

  for (let i = 0; i < count; i++) {
    const drift = 0.001;
    const volatility = 0.02;
    const change = drift + volatility * normalRandom(rng);

    const open = price;
    const close = open * (1 + change);
    const wick = Math.abs(close - open) * (0.5 + rng());
    const high = Math.max(open, close) + wick * rng();
    const low = Math.min(open, close) - wick * rng();
    const volume = 1000 + rng() * 9000;

    candles.push({ open, high, low, close, volume });
    price = close;
  }

  return candles;
}

// Simple Moving Average
export function calculateSMA(candles: Candle[], period: number): (number | null)[] {
  return candles.map((_, i) => {
    if (i < period - 1) return null;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += candles[j].close;
    }
    return sum / period;
  });
}

// Generate smooth line data
export function generateLineData(seed: number, points: number): number[] {
  const rng = seededRandom(seed);
  const data: number[] = [];
  let value = 50 + rng() * 50;

  for (let i = 0; i < points; i++) {
    value += normalRandom(rng) * 1.5;
    value = Math.max(10, Math.min(200, value));
    data.push(value);
  }

  return data;
}

// Order book level
export interface OrderLevel {
  price: number;
  size: number;
}

// Generate order book data
export function generateOrderBook(
  seed: number,
  levels: number,
  midPrice: number
): { bids: OrderLevel[]; asks: OrderLevel[] } {
  const rng = seededRandom(seed);
  const spread = midPrice * 0.001;

  const bids: OrderLevel[] = [];
  const asks: OrderLevel[] = [];

  for (let i = 0; i < levels; i++) {
    const bidPrice = midPrice - spread / 2 - i * spread * (0.5 + rng() * 0.5);
    const askPrice = midPrice + spread / 2 + i * spread * (0.5 + rng() * 0.5);
    // Deeper levels tend to have more size
    const bidSize = (rng() * 50 + 10) * (1 + i * 0.3);
    const askSize = (rng() * 50 + 10) * (1 + i * 0.3);

    bids.push({ price: bidPrice, size: bidSize });
    asks.push({ price: askPrice, size: askSize });
  }

  return { bids, asks };
}

// Ticker symbol data
export interface TickerItem {
  symbol: string;
  price: string;
  change: number;
}

export const TICKER_SYMBOLS: TickerItem[] = [
  { symbol: "BTC/USD", price: "97,432.50", change: 2.34 },
  { symbol: "ETH/USD", price: "3,287.80", change: -1.12 },
  { symbol: "SOL/USD", price: "198.45", change: 5.67 },
  { symbol: "SPX", price: "6,124.30", change: 0.43 },
  { symbol: "TSLA", price: "412.88", change: -2.89 },
  { symbol: "AAPL", price: "236.50", change: 1.22 },
  { symbol: "NVDA", price: "892.15", change: 3.45 },
  { symbol: "AVAX/USD", price: "42.30", change: -0.78 },
  { symbol: "DOGE/USD", price: "0.1823", change: 8.92 },
  { symbol: "ARB/USD", price: "1.45", change: -3.21 },
  { symbol: "LINK/USD", price: "18.92", change: 1.56 },
  { symbol: "QQQ", price: "542.10", change: 0.87 },
];

// Mini chart configs
export interface MiniChartConfig {
  label: string;
  color: string;
  change: number;
  seed: number;
}

export const MINI_CHARTS: MiniChartConfig[] = [
  { label: "BTC/USD", color: "#F7931A", change: 2.34, seed: 1001 },
  { label: "ETH/USD", color: "#627EEA", change: -1.12, seed: 1002 },
  { label: "SPX", color: "#00e676", change: 0.43, seed: 1003 },
  { label: "TSLA", color: "#cc0000", change: -2.89, seed: 1004 },
  { label: "SOL/USD", color: "#9945FF", change: 5.67, seed: 1005 },
  { label: "NVDA", color: "#76B900", change: 3.45, seed: 1006 },
];
