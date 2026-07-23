// Strategy revenue breakdown per market.
// Sourced from the parallel agent research (US equities, FX spot, DEX, commodities,
// crypto spot, sports betting, prediction markets, 0DTE SPX). Numbers are
// triangulated from public 10-Ks, regulatory filings, BIS surveys, on-chain data,
// and peer-reviewed papers — see docs/itp-solvency-audit and project notes for
// the full citation trail.

export type StrategyRow = {
  name: string;
  percentage: string;
  sourceBasis: string;
  fundsPool?: boolean;
};

export type Market = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  poolSize: string;
  closer: string;
  strategies: StrategyRow[];
};

export const MARKETS: Market[] = [
  {
    id: "us-equities",
    eyebrow: "Market 01 / 08",
    title: "US Equities",
    subtitle: "Wholesalers eat first.",
    poolSize: "≈ $50–70B annual gross profit pool",
    closer:
      "Eighty-three percent of retail flow runs through three doors.",
    strategies: [
      {
        name: "Wholesaler internalization",
        percentage: "25–32%",
        sourceBasis:
          "Citadel Sec $9.7B (2024); Virtu MM ~$1.4B; PFOF $3.9B/yr; top 3 = 83% of retail flow",
      },
      {
        name: "HFT market making",
        percentage: "22–28%",
        sourceBasis:
          "Jane Street $20.5B firmwide 2024; Tabb HFT band $4–6B",
      },
      {
        name: "Long-short equity fundamental",
        percentage: "14–20%",
        sourceBasis: "L/S funds ~+10% in 2024 (Goldman PB)",
      },
      {
        name: "Stat arb / quant equity",
        percentage: "12–18%",
        sourceBasis:
          "Two Sigma Spectrum +10.9% on $60B; Medallion 39% net historically",
      },
      {
        name: "Latency / cross-venue arb",
        percentage: "4–7%",
        sourceBasis: "Brogaard, Hendershott, Riordan",
      },
      {
        name: "Index rebalance arb",
        percentage: "2–4%",
        sourceBasis: "Petajisto — $1–2.1B/yr",
      },
      {
        name: "Active management alpha",
        percentage: "~0%",
        sourceBasis: "SPIVA: 65% underperform 1Y, 88% over 15Y",
      },
      {
        name: "Retail directional",
        percentage: "net negative",
        sourceBasis:
          "Barber/Odean; 2022 retail drawdown ~$350B (JPM/Vanda)",
        fundsPool: true,
      },
    ],
  },
  {
    id: "fx-spot",
    eyebrow: "Market 02 / 08",
    title: "FX Spot",
    subtitle: "Five banks. One spread.",
    poolSize: "≈ $40–60B annual pool",
    closer: "The corporate hedger funds the city.",
    strategies: [
      {
        name: "Bank dealer intermediation",
        percentage: "35–45%",
        sourceBasis:
          "JPM ~$5.5B FX FY23; top 5 = 44% volume (Euromoney 2022)",
      },
      {
        name: "HFT / electronic MM",
        percentage: "15–20%",
        sourceBasis:
          "XTX UK net £1.28B FY24; volume share 3.87% → 7.14%",
      },
      {
        name: "Carry trade",
        percentage: "5–10%",
        sourceBasis:
          "Lustig-Roussanov-Verdelhan Sharpe 0.6; 4.8% p.a. excess",
      },
      {
        name: "Global macro discretionary",
        percentage: "3–8%",
        sourceBasis: "Episodic — SNB 2015, BoJ 2022/24",
      },
      {
        name: "Trend / momentum (CTAs)",
        percentage: "3–7%",
        sourceBasis: "Menkhoff et al. — 10% gross, eroded by costs",
      },
      {
        name: "Triangular / latency arb",
        percentage: "2–5%",
        sourceBasis: "Captured by HFT firms above; halved post-2010",
      },
      {
        name: "Residual (corp prop, sovereigns, PB)",
        percentage: "5–10%",
        sourceBasis: "Heterogeneous, unmeasured",
      },
      {
        name: "Retail FX",
        percentage: "net negative",
        sourceBasis:
          "ESMA: 74–89% lose; FCA ~80% UK; avg loss €1,600–€29,000",
        fundsPool: true,
      },
    ],
  },
  {
    id: "dex",
    eyebrow: "Market 03 / 08",
    title: "DEX Trading",
    subtitle: "Code is honest. The data is brutal.",
    poolSize: "≈ $1.5B/yr extraction (Ethereum + Solana)",
    closer: "Half the LPs lose. The data confirms it daily.",
    strategies: [
      {
        name: "LP fee earnings (gross)",
        percentage: "~45%",
        sourceBasis: "$600–800M/yr Uniswap-class fees (Dune)",
      },
      {
        name: "CEX-DEX arbitrage (LVR realization)",
        percentage: "~25%",
        sourceBasis:
          "$233.8M / 19 mo (arXiv 2507.13023); top 3 = 73–90%",
      },
      {
        name: "Sandwich MEV (Solana)",
        percentage: "~20%",
        sourceBasis: "$370–500M Jan-24 → May-25 (Helius, DL News)",
      },
      {
        name: "Sandwich MEV (Ethereum)",
        percentage: "~18%",
        sourceBasis: "$289.8M = 51.56% of MEV (ESMA TRV July 2025)",
      },
      {
        name: "Liquidation bots",
        percentage: "~7%",
        sourceBasis:
          "Aave $3.3B+ collateral; Oct-25 = $1.23B Hyperliquid alone",
      },
      {
        name: "Cross-DEX cyclic arb",
        percentage: "~6%",
        sourceBasis: "Flashbots, EigenPhi",
      },
      {
        name: "JIT liquidity",
        percentage: "<1%",
        sourceBasis: "Wang et al. — 7,498 ETH across 36k events",
      },
      {
        name: "Passive LPs (volatile pairs)",
        percentage: "net negative",
        sourceBasis:
          "Milionis-Moallemi-Roughgarden — 11% annual loss at 5% σ",
        fundsPool: true,
      },
    ],
  },
  {
    id: "commodities",
    eyebrow: "Market 04 / 08",
    title: "Commodity Futures",
    subtitle: "Hedgers pay the trend.",
    poolSize: "≈ $20–35B speculative pool, zero-sum gross of fees",
    closer:
      "The producer hedges his crop. The CTA collects his fear.",
    strategies: [
      {
        name: "CTA / managed futures / trend",
        percentage: "30–40%",
        sourceBasis:
          "$300B+ AUM; Hurst-Ooi-Pedersen Sharpe ~0.4 net per market",
      },
      {
        name: "Roll yield / carry",
        percentage: "20–25%",
        sourceBasis:
          "Levine et al. — carry explains majority of long-run premium",
      },
      {
        name: "Discretionary global macro",
        percentage: "10–15%",
        sourceBasis: "Concentrated in oil, grains, metals",
      },
      {
        name: "Hedger flow capture (HP premium)",
        percentage: "10–15%",
        sourceBasis:
          "Bessembinder 1992 — significant in ags + FX, weak in metals",
      },
      {
        name: "Index roll arb (Goldman roll)",
        percentage: "5–10%",
        sourceBasis: "Mou — $26B forgone 2000–2010, ~$2.5B/yr peak",
      },
      {
        name: "HFT spread capture (Globex)",
        percentage: "5–10%",
        sourceBasis:
          "TABB/Viens — total HFT $1–5B all futures; commodities thin",
      },
      {
        name: "Statistical arb (calendars, crush, crack)",
        percentage: "5–10%",
        sourceBasis: "Diffuse, low-Sharpe, high-capacity",
      },
      {
        name: "Commercial hedgers (producers, airlines, farms)",
        percentage: "net negative",
        sourceBasis:
          "Keynes' normal backwardation; >50% of OI in physicals (CFTC COT)",
        fundsPool: true,
      },
    ],
  },
  {
    id: "crypto-spot",
    eyebrow: "Market 05 / 08",
    title: "Crypto Spot",
    subtitle: "Five desks. Eighty percent of the spread.",
    poolSize: "≈ $4–8B/yr, wash-volume excluded",
    closer: "Retail enters via app. Exits via spread.",
    strategies: [
      {
        name: "HFT market making (Jump, Wintermute, GSR, B2C2)",
        percentage: "35–45%",
        sourceBasis:
          "Robinhood Q1-25 PFOF: B2C2 12%, Wintermute 11%; top 5 dominate",
      },
      {
        name: "OTC desk spread (block flow)",
        percentage: "15–20%",
        sourceBasis:
          "Wintermute single-day OTC $2.24B (Nov 2024)",
      },
      {
        name: "Token launch / ICO / airdrop farming",
        percentage: "10–20%",
        sourceBasis:
          "ICOs +179% first-day; ARB 22–48% Sybil-captured",
      },
      {
        name: "Cross-exchange arbitrage",
        percentage: "5–10%",
        sourceBasis:
          "Makarov-Schoar peak $1.9B / 4 mo; spreads collapsed post-2018",
      },
      {
        name: "CEX-DEX arbitrage",
        percentage: "5–10%",
        sourceBasis: "~$120M/yr top searchers (arXiv 2507.13023)",
      },
      {
        name: "Geographic arbitrage (KR, JP, AR)",
        percentage: "2–5%",
        sourceBasis: "KR premium peak 55% Dec-17 → Feb-18",
      },
      {
        name: "Stablecoin arb / depeg trading",
        percentage: "2–5%",
        sourceBasis: "USDC $0.88 (Mar-23); UST <$0.01 (May-22)",
      },
      {
        name: "Retail directional",
        percentage: "net negative",
        sourceBasis:
          "BIS: 73–81% retail BTC investors underwater (Aug-15 → Dec-22)",
        fundsPool: true,
      },
    ],
  },
  {
    id: "sports-betting",
    eyebrow: "Market 06 / 08",
    title: "Sports Betting",
    subtitle: "Parlays fund the building.",
    poolSize: "≈ $14B GGR US legal + offshore overlay",
    closer:
      "Sharps win. The book bans them in three weeks.",
    strategies: [
      {
        name: "Sportsbook hold on parlays + SGPs",
        percentage: "50–55%",
        sourceBasis:
          "NJ DGE: 72.5% of GGR from 32.2% handle; FanDuel SGP 21.28%",
      },
      {
        name: "Sportsbook hold on straight bets",
        percentage: "25–30%",
        sourceBasis: "4.5–7% blended margin; Levitt biased-line +1.2pp",
      },
      {
        name: "Sportsbook hold on player props",
        percentage: "10–12%",
        sourceBasis: "8–15% hold; fastest-growing line",
      },
      {
        name: "Promo / matched betting / bonus abuse",
        percentage: "1–3%",
        sourceBasis:
          "iGaming Business — ~£20M/month industry-wide pre-limit",
      },
      {
        name: "Sharp / syndicate alpha",
        percentage: "1–2%",
        sourceBasis: "<1% accounts; banned within weeks at DK/FD",
      },
      {
        name: "Cross-book arb / middling",
        percentage: "0.5–1%",
        sourceBasis:
          "Stake-factored within months (BetMGM ~1% accounts limited)",
      },
      {
        name: "Live / in-play arbitrage",
        percentage: "0.3–0.7%",
        sourceBasis: "Latency-sensitive, soccer-dominant",
      },
      {
        name: "Recreational SGP / parlay players",
        percentage: "net negative",
        sourceBasis:
          "30–40% theoretical hold on multi-leg correlated bets",
        fundsPool: true,
      },
    ],
  },
  {
    id: "prediction-markets",
    eyebrow: "Market 07 / 08",
    title: "Prediction Markets",
    subtitle: "Conviction pays modeling.",
    poolSize: "Polymarket + Kalshi — small pool, fully on-chain",
    closer: "Eighty-four percent of addresses are donors.",
    strategies: [
      {
        name: "Sharp informed bettors (whales, journos)",
        percentage: "35–45%",
        sourceBasis:
          "Théo $85M (2024); top 0.04% capture ~70% of all profits",
      },
      {
        name: "Cross-market arbitrage",
        percentage: "15–20%",
        sourceBasis: "$40M+ extracted Apr-24 → Apr-25 (IMDEA)",
      },
      {
        name: "Market maker spread capture",
        percentage: "10–15%",
        sourceBasis:
          "Polymarket CLOB; reward program 1–3% APR atop spread",
      },
      {
        name: "Calibration arbitrage",
        percentage: "8–12%",
        sourceBasis:
          "Wolfers-Zitzewitz longshot pattern; 2024 partisan skew",
      },
      {
        name: "Resolution arb / oracle disputes",
        percentage: "2–5%",
        sourceBasis:
          "UMA Ukraine minerals: 9% → 100% YES via 5M UMA",
      },
      {
        name: "LP earnings on AMM pools",
        percentage: "2–5%",
        sourceBasis: "Most yield = reward subsidies, not organic spread",
      },
      {
        name: "Recreational / partisan bettors",
        percentage: "net negative",
        sourceBasis: "84% of Polymarket addresses unprofitable",
        fundsPool: true,
      },
    ],
  },
  {
    id: "zero-dte",
    eyebrow: "Market 08 / 08",
    title: "0DTE SPX Options",
    subtitle: "Lottery tickets. Sold by the hour.",
    poolSize: "≈ 62% of SPX options volume (Aug 2025, Cboe)",
    closer:
      "Three hundred fifty-eight thousand dollars a day, contributed by the hopeful.",
    strategies: [
      {
        name: "Market makers (spread + intraday VRP + PFOF)",
        percentage: "35–45%",
        sourceBasis:
          "Big Three wholesalers ~90% retail flow; 12.6% spread on weeklies",
      },
      {
        name: "Systematic vol-selling (JHEQX-style, defined-outcome)",
        percentage: "20–30%",
        sourceBasis:
          "JHEQX ~$20B AUM; quarterly collar ~35k contracts/leg",
      },
      {
        name: "Iron condor / spread sellers",
        percentage: "10–15%",
        sourceBasis:
          "Beckmeyer et al. — credit orders +$4.55/contract",
      },
      {
        name: "Dealer hedging flow (delta into ES)",
        percentage: "5–10%",
        sourceBasis:
          "Cboe — $170M–$670M intraday gamma; 0.04–0.17% ES daily",
      },
      {
        name: "Pin-risk / gamma squeeze plays",
        percentage: "3–7%",
        sourceBasis: "Trade against dealer hedging direction",
      },
      {
        name: "Cross-expiry calendar arb",
        percentage: "2–5%",
        sourceBasis: "Thin pool, capacity-limited",
      },
      {
        name: "Retail directional (lottery-ticket calls/puts)",
        percentage: "net negative",
        sourceBasis:
          "Beckmeyer: −$8.05/contract debit; ~$358K/day; 75% retail SPX",
        fundsPool: true,
      },
    ],
  },
];
