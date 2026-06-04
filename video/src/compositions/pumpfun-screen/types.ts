export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface RawTrade {
  t: number;
  kind: "buy" | "sell";
  usd: number;
  trader: string;
}

export interface PriceTick {
  t: number;
  price: number; // token price in USD
  usd: number;
  kind: "buy" | "sell";
}

export interface PumpWindow {
  startT: number;
  endT: number;
  basePrice: number;
  peakPrice: number;
}

export interface ChartData {
  token: {
    name: string;
    symbol: string;
    avatar: string | null;
    mcapPerPrice: number;
  };
  pool: {
    liquidityUsd: number;
    reserveBase: number | null;
    reserveQuote: number | null;
  };
  candles: Candle[];
  ticks: PriceTick[];
  pumpWindow: PumpWindow;
  fetchedAt: string;
  source: string;
}

/** A candle positioned in the viewport. x is in candle-units from the right edge
 *  (0 = right edge, increasing leftwards), so the chart can scroll sub-candle. */
export interface ViewCandle {
  o: number;
  h: number;
  l: number;
  c: number;
  x: number;
  forming: boolean;
}

export interface TapeRow {
  key: string;
  kind: "buy" | "sell";
  usd: number;
  mcap: number;
  trader: string;
  ageSec: number;
}

/** The green diamond entry marker on its vertical dotted line. */
export interface EntryMarker {
  mcap: number; // y position (the entry mcap)
  vx: number; // x in candle-units from the right edge
}

export interface FrameView {
  mcap: number;
  multiple: number; // current mcap / entry, green counter
  peakMultiple: number; // DYNAMIC — ticks up as new highs print
  holders: number;
  scaleMin: number;
  scaleMax: number;
  ladder: number[];
  candles: ViewCandle[];
  viewCount: number;
  liveMcap: number;
  liveUp: boolean;
  liveX: number | null;
  entry: EntryMarker | null;
  tfLabel: string;
  axisTimes: { label: string; vx: number }[];
  tape: TapeRow[];
}

export interface EngineConfig {
  totalFrames: number;
  fps: number;
}
