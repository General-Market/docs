// ─────────────────────────────────────────────────────────────────────────────
// Screen Configuration — Centralized management for all trading monitor screens
// ─────────────────────────────────────────────────────────────────────────────
//
// Each phase maps to exactly 4 screen entries for the 2×2 monitor grid:
//   [top-left, top-right, bottom-left, bottom-right]
//
// Entry types:
//   ScreenDef   — static PNG + optional animated chart overlay on top
//   null        — pure procedural canvas chart (drawFn fallback)
//
// Overlay types:
//   candlestick — scrolling candles (for chart screenshots)
//   line        — scrolling line (for line chart screenshots)
//   orderbook   — animated bid/ask bars (for table/orderbook screenshots)
//   ticker      — flickering numbers only, no chart (for data-heavy screens)
//
// All images: 512×384 PNG in public/shorts/short-02/screens/
// Coordinates mapped by visually inspecting each screenshot.
// ─────────────────────────────────────────────────────────────────────────────

export interface ChartOverlay {
  type: "candlestick" | "line" | "orderbook" | "ticker";
  // Region within 512×384 canvas (pixel coordinates)
  x: number;
  y: number;
  w: number;
  h: number;
  seed?: number;
  // Platform-specific colors (defaults: green/red)
  upColor?: string;   // bullish candle / line color / bid
  downColor?: string; // bearish candle / ask
  bgColor?: string;   // chart area background (must match screenshot)
}

export interface ScreenDef {
  image: string;
  overlay?: ChartOverlay;
  scale?: number; // 0-1, shrink image within monitor (default 1.0)
}

export type ScreenEntry = ScreenDef | null;

const S = "shorts/short-02/screens"; // base path in public/

function img(path: string, overlay?: ChartOverlay, scale?: number): ScreenDef {
  return { image: `${S}/${path}`, overlay, scale };
}

// ── Screen Sets ──────────────────────────────────────────────────────────────
// Overlay bounds are measured from each screenshot at 512×384.
// Screens with no meaningful chart area → no overlay or ticker-only.

// -- FOREX (MT5 + DexScreener) -----------------------------------------------
// forex-1: MT5 candlestick, light gray bg — overlaying dark candles on light bg
//          looks wrong, but the toolbar area is dark. Best: small ticker only.
// forex-2: MT5 FTMO, blue-gray bg with small green line chart top-left + table.
//          Chart area is tiny. ticker flicker on the table numbers.
// forex-3: DexScreener dark bg, teal/red candles, left sidebar ~100px.
// forex-4: DexScreener expanded dark bg, teal/red candles, price axis right.
const FOREX_GOOD: ScreenEntry[] = [
  img("forex-1.png",  { type: "ticker", x: 5, y: 50, w: 500, h: 290, seed: 100,
                         upColor: "#000000", downColor: "#cc0000" }),
  img("forex-2.png",  { type: "ticker", x: 55, y: 85, w: 300, h: 155, seed: 110,
                         upColor: "#00c853", downColor: "#ff1744" }),
  img("forex-3.png",  { type: "candlestick", x: 105, y: 65, w: 395, h: 305, seed: 120,
                         upColor: "#26a69a", downColor: "#ef5350", bgColor: "#131722" }),
  img("forex-4.png",  { type: "candlestick", x: 5, y: 55, w: 465, h: 310, seed: 130,
                         upColor: "#26a69a", downColor: "#ef5350", bgColor: "#131722" }),
];

// -- BLOOMBERG ----------------------------------------------------------------
// bloomberg-1: Dark navy bg, candlestick chart with MAs, volume/RSI below.
// bloomberg-2: World Equity Indices — data tables only, green/red numbers.
// bloomberg-3: Portfolio Analytics — multi-line performance chart.
// bloomberg-4: Depth of Market — orderbook left, depth chart, volume profile.
const BLOOMBERG: ScreenEntry[] = [
  img("bloomberg-1.png", { type: "candlestick", x: 10, y: 48, w: 490, h: 230, seed: 200,
                           upColor: "#00e676", downColor: "#ff3d00", bgColor: "#0a0e27" }),
  img("bloomberg-2.png", { type: "ticker", x: 10, y: 15, w: 490, h: 355, seed: 210,
                           upColor: "#00e676", downColor: "#ff3d00" }),
  img("bloomberg-3.png", { type: "line", x: 10, y: 55, w: 375, h: 175, seed: 220,
                           upColor: "#00e676", downColor: "#ff6e40", bgColor: "#0a0e27" }),
  img("bloomberg-4.png", { type: "orderbook", x: 8, y: 60, w: 170, h: 250, seed: 230,
                           upColor: "#00c853", downColor: "#ff3d00", bgColor: "#0a0e27" }),
];

// -- CRYPTO (Binance / FTX) ---------------------------------------------------
// crypto-1: Binance BTC/USDT dark bg, candlestick bottom half. Binance colors.
// crypto-2: FTX BTC-PERP dark bg, candlestick center, P&L box top-right.
// crypto-3: Binance ETH/USDT, yellow/gold line chart on dark bg.
// crypto-4: FTX Order Book, green bid bars / red ask bars, recent trades right.
const CRYPTO_GOOD: ScreenEntry[] = [
  img("crypto-1.png", { type: "candlestick", x: 12, y: 155, w: 488, h: 190, seed: 300,
                         upColor: "#0ecb81", downColor: "#f6465d", bgColor: "#161a1e" }),
  img("crypto-2.png", { type: "candlestick", x: 15, y: 88, w: 350, h: 235, seed: 310,
                         upColor: "#26a69a", downColor: "#ef5350", bgColor: "#0d1117" }),
  img("crypto-3.png", { type: "line", x: 15, y: 98, w: 485, h: 245, seed: 320,
                         upColor: "#f0b90b", downColor: "#f6465d", bgColor: "#161a1e" }),
  img("crypto-4.png", { type: "orderbook", x: 12, y: 42, w: 282, h: 315, seed: 330,
                         upColor: "#0ecb81", downColor: "#ff4976", bgColor: "#0d1117" }),
];

// -- ROBINHOOD LEGEND (dark bg) -----------------------------------------------
// robinhood-1: Candlestick + Bollinger bands, sidebars left/right.
// robinhood-2: Options view, small candlestick top-left, options chain center.
// robinhood-3: Zoomed candlestick + Bollinger, left sidebar market movers.
// robinhood-4: Options chain tables — data rows, no chart. Ticker flicker.
const ROBINHOOD_GOOD: ScreenEntry[] = [
  img("robinhood-1.png", { type: "candlestick", x: 115, y: 85, w: 265, h: 225, seed: 500,
                           upColor: "#00e676", downColor: "#ff3d00", bgColor: "#1e2124" }),
  img("robinhood-2.png", { type: "ticker", x: 15, y: 50, w: 185, h: 150, seed: 510,
                           upColor: "#00e676", downColor: "#ff3d00" }),
  img("robinhood-3.png", { type: "candlestick", x: 128, y: 120, w: 275, h: 200, seed: 520,
                           upColor: "#00e676", downColor: "#ff3d00", bgColor: "#1e2124" }),
  img("robinhood-4.png", { type: "ticker", x: 30, y: 40, w: 450, h: 300, seed: 530,
                           upColor: "#00e676", downColor: "#ff3d00" }),
];

// -- ROBINHOOD CRASH (red-tinted versions) ------------------------------------
const ROBINHOOD_CRASH: ScreenEntry[] = [
  img("robinhood-crash-1.png", { type: "candlestick", x: 115, y: 85, w: 265, h: 225, seed: 550,
                                 upColor: "#ff9500", downColor: "#ff3333", bgColor: "#2a0a0a" }),
  img("robinhood-crash-2.png", { type: "ticker", x: 15, y: 50, w: 185, h: 150, seed: 560,
                                 upColor: "#ff9500", downColor: "#ff3333" }),
  img("robinhood-crash-3.png", { type: "candlestick", x: 128, y: 108, w: 275, h: 212, seed: 570,
                                 upColor: "#ff9500", downColor: "#ff3333", bgColor: "#2a0a0a" }),
  img("robinhood-crash-4.png", { type: "ticker", x: 30, y: 40, w: 450, h: 300, seed: 580,
                                 upColor: "#ff9500", downColor: "#ff3333" }),
];

// -- PUMPFUN GOOD (DexScreener charts with GREEN candles for pump phase) ------
// Reuse DexScreener screenshots (neutral dark bg) with green/bullish overlays.
// pumpfun-crash-1,2 have neutral dark DexScreener backgrounds, perfect for green.
// pumpfun-2,4: Token board with ticker flicker for variety.
const PUMPFUN_GOOD: ScreenEntry[] = [
  img("pumpfun-crash-1.png", { type: "candlestick", x: 98, y: 58, w: 392, h: 300, seed: 600,
                                upColor: "#26a69a", downColor: "#ef5350", bgColor: "#131722" }),
  img("pumpfun-2.png", { type: "ticker", x: 65, y: 55, w: 380, h: 320, seed: 605,
                         upColor: "#00e676", downColor: "#ff3d00" }),
  img("pumpfun-crash-2.png", { type: "candlestick", x: 135, y: 72, w: 365, h: 295, seed: 610,
                                upColor: "#26a69a", downColor: "#ef5350", bgColor: "#131722" }),
  img("pumpfun-4.png", { type: "ticker", x: 65, y: 55, w: 380, h: 320, seed: 615,
                         upColor: "#00e676", downColor: "#ff3d00" }),
];

// -- PUMPFUN CRASH (DexScreener charts) ---------------------------------------
// These are DexScreener screenshots showing pump-and-dump candles.
// pumpfun-crash-1: Full DexScreener view with left sidebar.
// pumpfun-crash-2: DexScreener with sidebar, smaller chart.
// pumpfun-crash-3: DexScreener red-tinted, big red candles.
// pumpfun-crash-4: DexScreener expanded, red-tinted candles.
const PUMPFUN_CRASH: ScreenEntry[] = [
  img("pumpfun-crash-1.png", { type: "candlestick", x: 98, y: 58, w: 392, h: 300, seed: 650,
                               upColor: "#26a69a", downColor: "#ef5350", bgColor: "#131722" }),
  img("pumpfun-crash-2.png", { type: "candlestick", x: 135, y: 72, w: 365, h: 295, seed: 660,
                               upColor: "#26a69a", downColor: "#ef5350", bgColor: "#131722" }),
  img("pumpfun-crash-3.png", { type: "candlestick", x: 102, y: 62, w: 398, h: 322, seed: 670,
                               upColor: "#cc5544", downColor: "#ff3333", bgColor: "#2a1010" }),
  img("pumpfun-crash-4.png", { type: "candlestick", x: 82, y: 58, w: 388, h: 318, seed: 680,
                               upColor: "#cc5544", downColor: "#ff3333", bgColor: "#2a1010" }),
];

// -- POLYMARKET (election charts) ---------------------------------------------
// polymarket-1: Dual-line chart (Trump coral/red, Harris blue). Chart center.
// polymarket-2: Positions/bets list. Text rows. No chart → ticker flicker.
// polymarket-3,4: Dropped (too zoomed) → procedural canvas charts.
const POLYMARKET_GOOD: ScreenEntry[] = [
  img("polymarket-1.png", { type: "line", x: 12, y: 88, w: 488, h: 168, seed: 700,
                            upColor: "#e17055", downColor: "#74b9ff", bgColor: "#1c2127" }, 0.82),
  img("polymarket-2.png", { type: "ticker", x: 10, y: 10, w: 490, h: 370, seed: 710,
                            upColor: "#00e676", downColor: "#ff3d00" }),
  null,
  null,
];

// -- POLYMARKET LOSS (red-tinted) ---------------------------------------------
const POLYMARKET_LOSS: ScreenEntry[] = [
  img("polymarket-loss-1.png", { type: "line", x: 12, y: 88, w: 488, h: 168, seed: 750,
                                 upColor: "#cc5544", downColor: "#882233", bgColor: "#2a1015" }, 0.82),
  img("polymarket-loss-2.png", { type: "ticker", x: 10, y: 10, w: 490, h: 370, seed: 760,
                                 upColor: "#ff5544", downColor: "#ff3333" }),
  null,
  null,
];

// -- AGIARENA (final scene) ---------------------------------------------------
const AGIARENA: ScreenEntry[] = [
  { image: "shorts/short-01/backgrounds/agi-logo.png" },
  null,
  { image: "shorts/short-02/logos/agiarena-home.png" },
  { image: "shorts/short-02/logos/agiarena-markets.png" },
];

// ── Phase → Screen Mapping ───────────────────────────────────────────────────

export const PHASE_SCREENS: Record<string, ScreenEntry[]> = {
  "forex-intro": FOREX_GOOD,
  forex:         FOREX_GOOD,

  "stocks-intro": BLOOMBERG,
  stocks:         BLOOMBERG,

  "bitcoin-intro": CRYPTO_GOOD,
  bitcoin:         CRYPTO_GOOD,

  // goldman: not listed → pure canvas crash charts

  "0dte":    ROBINHOOD_GOOD,
  ambush:    ROBINHOOD_CRASH,

  "memecoins-solo": PUMPFUN_GOOD,
  memecoins:        PUMPFUN_CRASH,

  polymarket: POLYMARKET_GOOD,
  defeat:     POLYMARKET_LOSS,

  "car-lot-final": AGIARENA,
};

// Helper: collect all image paths for preloading
export function getAllScreenImages(): string[] {
  const set = new Set<string>();
  for (const screens of Object.values(PHASE_SCREENS)) {
    for (const entry of screens) {
      if (entry && typeof entry === "object" && entry.image) {
        set.add(entry.image);
      }
    }
  }
  return [...set];
}
