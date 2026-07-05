// ═══════════════════════════════════════════════════════════════
// CHART copy — strings/colors/eras for the chart plot area.
// Geometry tracks (candles, bubbles, chips, cursor) live in
// ../chart-data.ts (auto-generated from the reference plates, r3).
// All frames are plate frames, all y in 1920×1080 px.
// ═══════════════════════════════════════════════════════════════

export const CHART_COLORS = {
  plotBg: "#11161f",
  gridLine: "rgba(84, 98, 122, 0.12)",
  scaleText: "#8b95a7",
  candleGreen: "#148a6d", // plate probe (20,139,111)
  candleRed: "#d04656", // plate probe (208,70,86)
  bubbleGreenFill: "#199c74", // rim probe (25,140,115)
  bubbleGreenRing: "#0b3f2b",
  bubbleRedFill: "#dd4a52",
  bubbleRedRing: "#6e1a20",
  bubbleYellowFill: "#e0c433",
  bubbleWhiteFill: "#f2efe9",
  bubblePurpleFill: "#6e6bde", // plate bright-quartile probe (110,107,222)
  bubblePurpleInk: "#1a2267", // M glyph is DARK navy on the plates (26,34,103)
  exitLine: "rgb(90,72,76)", // measured dash blend at f620
  exitBadgeBg: "#c96342", // ORANGE badge (plate f620/f900/f1300)
  costLine: "#d7dce6",
  costBadgeBg: "#f4f6f9",
  costBadgeText: "#10151d",
  highChipBg: "#1e2f63",
  lowChipBg: "#1e2f63",
  chipText: "#e8ecf4",
  curChipGreen: "#0fa878",
  curChipRed: "#e34056", // plate probe (227,64,86)
  crossDash: "#4a5260", // crosshair dash (39,46,54)+
  crossLabel: "#e6ebf2", // bold white price label at crosshair y
} as const;

// Price-scale eras — re-measured r3 from label-row signatures + eye reads
// (.claude/rounds/work/realist-r3/chart/crops/scale_eras.png). Six eras;
// transitions animate ~6 frames on the plates, stepped here.
export type ScaleEra = {
  from: number; // frame
  top: number; // top label value, thousands
  bottom: number; // bottom label value, thousands
  step: number; // thousands
  yTop: number; // y of top label row
  yBottom: number; // y of bottom label row
};
export const SCALE_ERAS: ScaleEra[] = [
  { from: 418, top: 34, bottom: 0, step: 2, yTop: 224, yBottom: 899 },
  { from: 455, top: 280, bottom: -20, step: 20, yTop: 235, yBottom: 897 },
  { from: 479, top: 400, bottom: -20, step: 20, yTop: 200, yBottom: 896 },
  { from: 520, top: 400, bottom: -20, step: 20, yTop: 220, yBottom: 896 },
  { from: 736, top: 500, bottom: -25, step: 25, yTop: 199, yBottom: 896 },
  { from: 1097, top: 550, bottom: -25, step: 25, yTop: 209, yBottom: 896 },
];

export const eraAt = (f: number): ScaleEra => {
  let cur = SCALE_ERAS[0];
  for (const e of SCALE_ERAS) {
    if (e.from <= f) cur = e;
    else break;
  }
  return cur;
};

// price (thousands) -> y and inverse, per era
export const priceToY = (v: number, e: ScaleEra): number =>
  e.yTop + ((e.top - v) / (e.top - e.bottom)) * (e.yBottom - e.yTop);
export const yToPrice = (y: number, e: ScaleEra): number =>
  e.top - ((y - e.yTop) / (e.yBottom - e.yTop)) * (e.top - e.bottom);

export const fmtK = (v: number): string => (v === 0 ? "0" : v < 0 ? `-${Math.abs(v)}K` : `${v}K`);

// 3-sig-fig chip value format (matches TradingView label rounding)
export const fmtChip = (vK: number): string => {
  const v = Math.abs(vK);
  if (v >= 100) return `${Math.round(vK)}K`;
  if (v >= 10) return `${vK.toFixed(1)}K`;
  return `${vK.toFixed(2)}K`;
};

// Dashed strategy-line labels (right-aligned inside the plot).
export const EXIT_LABEL = "Current Average Exit Price";
export const COST_LABEL = "Current Average Cost Basis";
export const COST_BADGE = "5.75K";
export const LOW_CHIP_TEXT = "Low 2.56K";

// Time axis: 1s candles, labels every 14 candle-slots. Label x positions are
// derived per-frame from the candle pan transform in chart-data.ts.
export const TIME_LABELS = ["15:03", "15:03:14", "15:03:28", "15:03:42", "15:04", "15:04:14", "15:04:28", "15:04:42", "15:05", "15:05:14", "15:05:28", "15:05:42"];
