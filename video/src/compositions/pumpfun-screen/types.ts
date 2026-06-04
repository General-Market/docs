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

export interface ChartData {
  token: {
    name: string;
    symbol: string;
    avatar: string | null;
    mcapPerPrice: number;
    poolCreatedAt?: string;
  };
  candles: Candle[];
  trades: RawTrade[];
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

export interface FrameView {
  mcap: number;
  multiple: number;
  peakMultiple: number;
  scaleMin: number;
  scaleMax: number;
  ladder: number[];
  candles: ViewCandle[];
  viewCount: number;
  liveMcap: number;
  liveUp: boolean;
  liveX: number | null;
  tfLabel: string;
  axisTimes: { label: string; vx: number }[];
  tape: TapeRow[];
}

export interface EngineConfig {
  totalFrames: number;
  fps: number;
  godIdx: number;
}
