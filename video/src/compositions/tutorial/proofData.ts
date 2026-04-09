/**
 * Real-world proof data researched from public sources.
 * Used as "evidence overlays" throughout the tutorial video.
 * Every number is real and sourced.
 */

// ── Prediction Markets ──────────────────────────────────────────────────────
export const PREDICTION_MARKETS = {
  polymarketVolume2025: "$21.5B", // Polymarket 2025 total volume
  kalshiVolume2025: "$17.1B",
  totalVolume2025: "$44B+", // All prediction markets combined
  monthlyVolume2026: "$21B/month", // Early 2026
  polymarketTraders: "450,000+", // Active traders early 2026
  polymarketWallets: "840,000", // Monthly unique wallets
  avgTradesPerDay: "25", // Per active participant in 2026
  avgTradesPerDay2025: "3-5", // Mid-2025
  source: "TRM Labs, The Block, Phemex",
};

// ── Hedge Funds ─────────────────────────────────────────────────────────────
export const HEDGE_FUNDS = {
  totalAUM: "$5.7T", // 2026 total
  totalAUM_raw: 5_700_000_000_000,
  growth2025: "+11.2%", // Average return 2025
  netInflows2025: "$71B", // First 3 quarters
  northAmericaShare: "60%",
  source: "HFR, Barclays, Semper Signum",
};

// ── HFT (The Competition) ───────────────────────────────────────────────────
export const HFT = {
  usEquityShare: "50-60%", // Of all US equity trading
  globalEquityShare: "50-60%",
  marketSize2026: "$14.7B",
  peakShare: "~70% (2009)",
  source: "Grand View Research, Research and Markets",
};

// ── Twitch ──────────────────────────────────────────────────────────────────
export const TWITCH = {
  avgConcurrent: "2.55M", // Concurrent viewers
  avgConcurrent_raw: 2_550_000,
  liveChannels: "90K-120K", // At any time
  uniqueChannels2026: "7.06M", // Went live in 2026
  partners: "79,928",
  watchHours: "23.2B hours/year",
  peakViewer: "14.1M", // Ibai La Velada 2026
  source: "TwitchTracker, StreamScheme",
};

// ── Deutsche Bahn ───────────────────────────────────────────────────────────
export const DEUTSCHE_BAHN = {
  onTimeRate2025: "60.1%", // Worst ever
  onTimeRate2024: "62.5%",
  onTimeRateFeb2026: "59.4%",
  delayThreshold: "6 min", // What DB counts as "late"
  compensationPaid2025: "€156.1M", // Delay compensation
  headline: "Worst punctuality EVER recorded",
  source: "Deutsche Bahn Interim Report, NPR, Daily Sabah",
};

// ── Steam ───────────────────────────────────────────────────────────────────
export const STEAM = {
  peakConcurrent: "42M", // All-time peak Jan 2026
  peakConcurrent_raw: 42_042_778,
  monthlyActive: "147M",
  dailyActive: "69M",
  totalGames: "117,881",
  newGames2025: "16,774",
  revenue2025: "$16.2B",
  marketShare: "75%", // PC digital distribution
  source: "SteamDB, Alinea Analytics",
};

// ── Pump.fun ────────────────────────────────────────────────────────────────
export const PUMP_FUN = {
  totalTokens: "13M+", // Launched since inception
  totalTokens_raw: 13_000_000,
  solanaShare: "70%+", // Of all Solana token launches
  cumulativeRevenue: "$1.08B",
  rugPullRate: "98.6%", // Of tokens
  source: "Messari, CoinDesk, CoinMarketCap",
};

// ── Parimutuel / Horse Racing ───────────────────────────────────────────────
export const PARIMUTUEL = {
  horseRacingMarket: "$491.7B", // 2025
  bettingShareOfSports: "9%", // Handle across all sports
  model: "Invented 1867, Paris",
  onlineGrowth2024: "+17% YoY", // BHA
  source: "Market Intelligence, BHA",
};

// ── Key Comparisons (for visual impact) ─────────────────────────────────────
export const COMPARISONS = {
  // Traditional PM vs GM
  polymarketPositionsPerDay: "<100", // Per trader
  gmPositionsPerDay: "10,000,000+", // Per batch cycle
  ratio: "100,000x",

  // Settlement speed
  polymarketSettlement: "Days-Weeks", // With dispute period
  gmSettlement: "10 minutes",

  // Market count
  polymarketMarkets: "~500", // Active at any time
  gmMarkets: "500,000+",
  marketRatio: "1,000x",

  // Fees
  polymarketFees: "2-5%", // Maker/taker
  gmFees: "$0",
};
