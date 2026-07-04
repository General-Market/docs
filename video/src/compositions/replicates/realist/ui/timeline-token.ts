// ═══════════════════════════════════════════════════════════════════
// PUMPWHEEL TOKEN PAGE — sampled timelines.
// Every table is a list of {f, v} samples measured from the plates via
// contact sheets (crop grids). Lookup is STEP-HOLD: a value holds until
// the next sample. Sampling grids per the measurement brief:
//   MC every 20f · balance every 30f · token-info/rail-stats/OHLC/popup
//   every 60f · header cols / 24h stats / trades rows every 100f ·
//   toasts every 10f.
// Blur starts ~f1668 on the plates; tables hold their last readable
// value from there (the blur overlay is another agent's).
// ═══════════════════════════════════════════════════════════════════

export type Sample<T> = { f: number; v: T };

export function sampleAt<T>(table: readonly Sample<T>[], frame: number): T {
  let v = table[0].v;
  for (const s of table) {
    if (s.f <= frame) v = s.v;
    else break;
  }
  return v;
}

const T = <T,>(pairs: [number, T][]): Sample<T>[] =>
  pairs.map(([f, v]) => ({ f, v }));

// ─── Market cap (header headline). '' = loading skeleton. ────────────
export const mcTable: Sample<string>[] = T([
  [418, ""], [422, "$34.2K"], [442, "$23.3K"], [450, "$23.5K"],
  [458, "$240K"], [478, "$273K"], [498, "$365K"], [518, "$347K"],
  [538, "$154K"], [558, "$154K"], [578, "$322K"], [598, "$95.8K"],
  [618, "$52.4K"], [638, "$103K"], [658, "$100K"], [678, "$161K"],
  [698, "$215K"], [718, "$199K"], [738, "$392K"], [758, "$402K"],
  [778, "$354K"], [798, "$280K"], [818, "$392K"], [838, "$336K"],
  [858, "$376K"], [878, "$330K"], [898, "$312K"], [918, "$327K"],
  [938, "$217K"], [958, "$220K"], [978, "$225K"], [998, "$287K"],
  [1018, "$320K"], [1038, "$368K"], [1058, "$363K"], [1078, "$376K"],
  [1098, "$417K"], [1118, "$454K"], [1138, "$459K"], [1158, "$396K"],
  [1178, "$382K"], [1198, "$363K"], [1218, "$461K"], [1238, "$384K"],
  [1258, "$307K"], [1278, "$292K"], [1298, "$324K"], [1318, "$328K"],
  [1338, "$354K"], [1358, "$294K"], [1378, "$263K"], [1398, "$289K"],
  [1418, "$275K"], [1438, "$266K"], [1458, "$264K"], [1478, "$234K"],
  [1498, "$230K"], [1518, "$217K"], [1538, "$214K"], [1558, "$167K"],
  [1578, "$178K"], [1598, "$203K"], [1618, "$226K"], [1638, "$214K"],
  [1658, "$226K"], // holds through the blur
]);

// Price column derives from MC (supply 1B): price = mc/1e9 rounded to one
// significant digit in 0.0ₙd subscript notation. Verified on plates:
// $365K→$0.0₃4, $312K→$0.0₃3, $52.4K→$0.0₄5, $34.2K→$0.0₄3, $199K→$0.0₃2.
export const priceFromMc = (mc: string): { zeros: number; digit: string } | null => {
  const m = mc.match(/^\$([\d.]+)([KM])$/);
  if (!m) return null;
  const v = parseFloat(m[1]) * (m[2] === "K" ? 1e3 : 1e6);
  const p = v / 1e9;
  if (p <= 0) return null;
  const exp = Math.floor(Math.log10(p));
  let digit = Math.round(p / 10 ** exp);
  let e = exp;
  if (digit >= 10) { digit = 1; e += 1; }
  return { zeros: -e - 1, digit: String(digit) };
};

// ─── Nav wallet balance (every 30f) ──────────────────────────────────
export const balanceTable: Sample<string>[] = T([
  [418, "390.1"], [448, "389.9"], [478, "401.3"], [508, "431.2"],
  [538, "431.2"], [568, "431.2"], [598, "433"], [628, "438.8"],
  [658, "439.6"], [688, "439.6"], [718, "448.2"], [748, "455.8"],
  [778, "482"], [808, "520"], [838, "541.4"], [868, "552"],
  [898, "560.6"], [928, "584.6"], [958, "584.6"], [988, "606.8"],
  [1018, "606.8"], [1048, "638"], [1078, "643"], [1108, "653.3"],
  [1138, "665.1"], [1168, "671.1"], [1198, "677.2"], [1228, "683.4"],
  [1258, "707.8"], [1288, "718.8"], [1318, "740.6"], [1348, "752"],
  [1378, "761.5"], [1408, "780.9"], [1438, "795.2"], [1468, "816.2"],
  [1498, "825.4"], [1528, "837.5"], [1558, "837.5"], [1588, "868"],
]);

// ─── Header row extras (age / views / liquidity / global fees) ───────
// f418 renders the loading skeleton; liq+gfp before f498 hold the first
// measured values backward (sub-sample resolution).
export const ageTable: Sample<string>[] = T([
  [422, "7s"], [438, "8s"], [442, "0s"], [498, "2s"], [618, "6s"],
  [718, "8s"], [818, "10s"], [918, "12s"], [1018, "15s"], [1118, "17s"],
  [1218, "20s"], [1318, "22s"], [1418, "24s"], [1518, "26s"], [1618, "29s"],
]);
export const viewsTable: Sample<string>[] = T([
  [422, "6"], [498, "157"], [618, "407"], [718, "538"], [818, "653"],
  [918, "815"], [1018, "939"], [1118, "1114"], [1218, "1236"],
  [1318, "1348"], [1418, "1400"], [1518, "1545"], [1618, "1598"],
]);
export const liqTable: Sample<string>[] = T([
  [422, "$46.3K"], [518, "$45.2K"], [618, "$17.6K"], [718, "$34.4K"],
  [818, "$48.4K"], [918, "$44.4K"], [1018, "$44K"], [1118, "$52.4K"],
  [1218, "$52.9K"], [1318, "$44.7K"], [1418, "$41K"], [1518, "$36.5K"],
  [1618, "$37.3K"],
]);
export const gfpTable: Sample<string>[] = T([
  [422, "6.399"], [518, "6.923"], [618, "14.65"], [718, "17.66"],
  [818, "23.75"], [918, "29.13"], [1018, "34.47"], [1118, "38.78"],
  [1218, "42.74"], [1318, "47.76"], [1418, "51.23"], [1518, "55.19"],
  [1618, "57.73"],
]);

// ─── Rail 24h stats (every 100f; f498 from f0500) ────────────────────
export type Stats24 = {
  vol: string;
  buysN: string; buysUsd: string;
  sellsN: string; sellsUsd: string;
  net: string;
  ratio: number; // green share of the buys/sells bar (buys$ fraction)
};
const s24 = (
  vol: string, buysN: string, buysUsd: string,
  sellsN: string, sellsUsd: string, net: string, ratio: number,
): Stats24 => ({ vol, buysN, buysUsd, sellsN, sellsUsd, net, ratio });
export const stats24Table: Sample<Stats24>[] = T([
  [418, s24("$0", "0", "$0", "0", "$0", "-$0", 0.5)],
  [498, s24("$37.8K", "163", "$30.4K", "24", "$7.3K", "+$23.1K", 0.81)],
  [518, s24("$43.5K", "183", "$33.2K", "40", "$10.3K", "+$22.8K", 0.76)],
  [618, s24("$106K", "327", "$58K", "142", "$48.3K", "+$9.64K", 0.55)],
  [718, s24("$137K", "467", "$77.5K", "193", "$59.2K", "+$18.3K", 0.57)],
  [818, s24("$187K", "586", "$106K", "200", "$80.3K", "+$25.3K", 0.57)],
  [918, s24("$231K", "751", "$128K", "434", "$103K", "+$24.1K", 0.55)],
  [1018, s24("$277K", "971", "$151K", "570", "$126K", "+$24.3K", 0.55)],
  [1118, s24("$312K", "1.14K", "$170K", "675", "$142K", "+$27.7K", 0.54)],
  [1218, s24("$342K", "1.31K", "$186K", "777", "$156K", "+$29.3K", 0.54)],
  [1318, s24("$377K", "1.48K", "$201K", "920", "$176K", "+$25.5K", 0.53)],
  [1418, s24("$405K", "1.6K", "$214K", "1.05K", "$191K", "+$23.9K", 0.53)],
  [1518, s24("$432K", "1.7K", "$227K", "1.15K", "$205K", "+$21.9K", 0.53)],
  [1618, s24("$454K", "1.84K", "$238K", "1.23K", "$216K", "+$22.5K", 0.52)],
]);

// ─── Position stats: Bought / Sold / Holding / PnL (every 60f) ───────
// pnlPct is numeric so the rail can print "(+4870%)" and the popup
// "(+4.87K%)" from the same sample.
export type PosStats = { bought: string; sold: string; holding: string; pnl: string; pnlPct: number };
const ps = (bought: string, sold: string, holding: string, pnl: string, pnlPct: number): PosStats =>
  ({ bought, sold, holding, pnl, pnlPct });
export const posStatsTable: Sample<PosStats>[] = T([
  [418, ps("0", "0", "0", "+0", 0)],
  [478, ps("10.54", "11.5", "456.6", "+457.6", 4341)],
  [538, ps("10.54", "41.62", "243.8", "+274.8", 2607)],
  [598, ps("10.54", "43.36", "151", "+183.9", 1744)],
  [658, ps("10.54", "50.03", "150.7", "+190.2", 1805)],
  [718, ps("10.54", "50.03", "292.3", "+331.8", 3148)],
  [778, ps("10.54", "92.68", "484.4", "+566.5", 5375)],
  [838, ps("10.54", "152.5", "398.7", "+540.6", 5129)],
  [898, ps("10.54", "169.8", "354.1", "+513.3", 4870)],
  [958, ps("10.54", "196", "227.8", "+413.2", 3921)],
  [1018, ps("10.54", "218.3", "300.3", "+508", 4820)],
  [1078, ps("10.54", "254.7", "312.4", "+556.6", 5281)],
  [1138, ps("10.54", "265.1", "355.8", "+610.4", 5792)],
  [1198, ps("10.54", "289.2", "271.5", "+550.2", 5220)],
  [1258, ps("10.54", "320", "201.9", "+511.4", 4852)],
  [1318, ps("10.54", "342.3", "179.4", "+511.2", 4851)],
  [1378, ps("10.54", "374", "126.7", "+490.1", 4650)],
  [1438, ps("10.54", "398.6", "95.54", "+483.6", 4588)],
  [1498, ps("10.54", "438.4", "49.3", "+477.1", 4527)],
  [1558, ps("10.54", "450.6", "30.13", "+470.1", 4461)],
  [1618, ps("10.54", "481.2", "0", "+470.7", 4466)],
]);
// popup/pill formatting: 4870 → "+4.87K%"
export const pctK = (pct: number): string =>
  pct >= 1000
    ? `+${(Math.round(pct / 10) / 100).toString().replace(/\.?0+$/, "")}K%`
    : `+${pct}%`;

// ─── Token-info grid + holder counts (every 60f) ─────────────────────
export type TokenInfo = {
  top10: string; dev: string; snipers: string;
  insiders: string; bundlers: string; lp: string;
  holders: string; pro: string;
};
const ti = (
  top10: string, dev: string, snipers: string, insiders: string,
  bundlers: string, lp: string, holders: string, pro: string,
): TokenInfo => ({ top10, dev, snipers, insiders, bundlers, lp, holders, pro });
export const tokenInfoTable: Sample<TokenInfo>[] = T([
  [418, ti("", "", "", "", "", "", "", "")], // skeleton
  [478, ti("54.94%", "9.75%", "0%", "0%", "57.83%", "100%", "87", "63")],
  [538, ti("50.72%", "9.75%", "0%", "0%", "52.45%", "100%", "125", "94")],
  [598, ti("49.36%", "9.75%", "0%", "0%", "51.08%", "100%", "143", "112")],
  [658, ti("38.08%", "7.32%", "0%", "0%", "32.74%", "100%", "205", "170")],
  [718, ti("36.14%", "5.49%", "0%", "0%", "30.68%", "100%", "239", "195")],
  [778, ti("34.63%", "4.94%", "0%", "0%", "29.66%", "100%", "266", "215")],
  [838, ti("32.92%", "4.94%", "0%", "0%", "27.7%", "100%", "286", "230")],
  [898, ti("32.12%", "4.44%", "0%", "0%", "26.18%", "100%", "334", "268")],
  [958, ti("31.63%", "4.44%", "0%", "0%", "22.83%", "100%", "389", "290")],
  [1018, ti("30.97%", "3.6%", "0%", "0%", "20.68%", "100%", "454", "343")],
  [1078, ti("30.23%", "3.24%", "0%", "0.02%", "19.08%", "100%", "482", "364")],
  [1138, ti("30.11%", "3.24%", "0%", "0.02%", "18.13%", "100%", "497", "377")],
  [1198, ti("29.68%", "2.92%", "0%", "0.02%", "17.78%", "100%", "513", "391")],
  [1258, ti("27.76%", "2.62%", "0%", "0.03%", "16.04%", "100%", "584", "448")],
  [1318, ti("27%", "2.62%", "0%", "0.03%", "15.02%", "100%", "611", "465")],
  [1378, ti("25.71%", "2.36%", "0%", "0.04%", "13.92%", "100%", "653", "502")],
  [1438, ti("24.65%", "2.36%", "0%", "0.04%", "12.75%", "100%", "685", "526")],
  [1498, ti("23.43%", "2.36%", "0%", "0.54%", "10.67%", "100%", "717", "551")],
  [1558, ti("22.61%", "2.13%", "0%", "0.54%", "8.79%", "100%", "743", "566")],
  [1618, ti("20.93%", "1.91%", "0%", "0.54%", "5.9%", "100%", "755", "583")],
]);
// Holders at f0500 reads 106 on the plate; the 60f grid brackets it
// (87@478 → 125@538) — sampling resolution, accepted per brief.

// ─── OHLC readout (every 60f). null = not yet populated. ────────────
export type Ohlc = { o: string; h: string; l: string; c: string; d: string; dp: string; up: boolean };
const oh = (o: string, h: string, l: string, c: string, d: string, dp: string, up: boolean): Ohlc =>
  ({ o, h, l, c, d, dp, up });
export const ohlcTable: Sample<Ohlc | null>[] = T<Ohlc | null>([
  [418, null],
  [478, oh("230K", "280K", "217K", "280K", "49.9K", "+21.68%", true)],
  [538, oh("364K", "377K", "154K", "154K", "-210K", "-57.70%", false)],
  [598, oh("126K", "127K", "96.9K", "98.4K", "-27.3K", "-21.69%", false)],
  [658, oh("97.2K", "125K", "90.7K", "106K", "9.12K", "+9.38%", true)],
  [718, oh("226K", "232K", "177K", "189K", "-36.6K", "-16.22%", false)],
  [778, oh("455K", "453K", "357K", "357K", "-97.7K", "-21.46%", false)], // H as read
  [838, oh("397K", "395K", "338K", "339K", "-57.4K", "-14.46%", false)],
  [898, oh("376K", "379K", "268K", "311K", "-64.7K", "-17.21%", false)],
  [958, oh("254K", "260K", "254K", "260K", "6.26K", "+2.46%", true)],
  [1018, oh("216K", "337K", "215K", "299K", "83.6K", "+38.76%", true)],
  [1078, oh("365K", "391K", "355K", "382K", "17.4K", "+4.76%", true)],
  [1138, oh("453K", "478K", "405K", "459K", "5.5K", "+1.21%", true)],
  [1198, oh("397K", "393K", "363K", "393K", "-3.62K", "-0.91%", false)],
  [1258, oh("344K", "354K", "276K", "312K", "-32.2K", "-9.36%", false)], // dp est
  [1318, oh("292K", "327K", "292K", "325K", "32.3K", "+11.1%", true)], // dp est
  [1378, oh("370K", "397K", "261K", "264K", "-106K", "-28.6%", false)], // dp est
  [1438, oh("242K", "286K", "238K", "268K", "26.4K", "+10.89%", true)],
  [1498, oh("220K", "238K", "200K", "235K", "15K", "+6.8%", true)], // dp est
  [1558, oh("171K", "167K", "167K", "167K", "-4.25K", "-2.4%", false)], // dp est
]);

// ─── Popup: buy total, sell row, preset flip (every 60f) ─────────────
export const buyTotalTable: Sample<string>[] = T([
  [418, "322.3"], [478, "333.6"], [538, "363.4"], [598, "365.2"],
  [658, "371.8"], [718, "380.4"], [778, "414.2"], [838, "473.6"],
  [898, "492.8"], [958, "516.8"], [1018, "539"], [1078, "575.2"],
  [1138, "597.3"], [1198, "609.5"], [1258, "640"], [1318, "672.8"],
  [1378, "693.7"], [1438, "727.4"], [1498, "757.6"], [1558, "769.7"],
  [1618, "800.2"],
]);
export type SellRow = { tokens: string; usd: string; sol: string };
const sr = (tokens: string, usd: string, sol: string): SellRow => ({ tokens, usd, sol });
export const sellRowTable: Sample<SellRow>[] = T([
  [418, sr("0", "$0", "0")],
  [478, sr("3.62M", "$930.3", "11.17")],
  [538, sr("3.43M", "$503.6", "6.044")],
  [598, sr("3.41M", "$314.3", "3.772")],
  [658, sr("3.27M", "$313.8", "3.767")],
  [718, sr("3.18M", "$602.7", "7.234")],
  [778, sr("2.96M", "$990.4", "11.89")],
  [838, sr("762K", "$249.9", "3")],
  [898, sr("94.7M", "$29.5K", "354.1")],
  [958, sr("4.02M", "$833.1", "10")],
  [1018, sr("1.34M", "$416.6", "5")],
  [1078, sr("1.14M", "$416.6", "5")],
  [1138, sr("935K", "$416.6", "5")],
  [1198, sr("1.18M", "$416.6", "5")],
  [1258, sr("1.4M", "$416.8", "5")],
  [1318, sr("1.31M", "$416.8", "5")],
  [1378, sr("1.64M", "$416.8", "5")],
  [1438, sr("1.62M", "$416.8", "5")],
  [1498, sr("1.88M", "$416.8", "5")],
  [1558, sr("2.6M", "$416.8", "5")],
  [1618, sr("0", "$0", "0")],
]);
// Sell mode label "%" → "SOL" and red presets flip 13.37/…→1/3/5/10,
// measured between f818 (old) and f828 (new).
export const SELL_MODE_FLIP_F = 823;
// …and flips BACK to "%" presets late (SOL at f1610, % at f1615).
export const SELL_MODE_FLIP2_F = 1613;

// ─── Bottom trades table first row (every 100f) ──────────────────────
export type TradeRow = { age: string; type: "Buy" | "Sell"; mc: string; amount: string; sol: string };
const tr = (type: "Buy" | "Sell", mc: string, amount: string, sol: string): TradeRow =>
  ({ age: "2s", type, mc, amount, sol });
export const tradeRowTable: Sample<TradeRow | null>[] = T<TradeRow | null>([
  [418, null],
  [518, tr("Buy", "$346K", "119K", "0.5")],
  [618, tr("Buy", "$51.9K", "1.59M", "1")],
  [718, tr("Buy", "$199K", "41K", "0.099")],
  [818, tr("Sell", "$396K", "620K", "2.916")],
  [918, tr("Buy", "$315K", "2.59M", "9.9")],
  [1018, tr("Buy", "$319K", "256K", "0.99")],
  [1118, tr("Buy", "$453K", "45.1K", "0.248")],
  [1218, tr("Buy", "$461K", "1.77K", "0.01")],
  [1318, tr("Buy", "$325K", "679K", "2.675")],
  [1418, tr("Sell", "$280K", "1.51M", "5.014")],
  [1518, tr("Buy", "$217K", "37.9K", "0.1")],
  [1618, tr("Sell", "$226K", "32.8K", "0.088")],
]);

// ─── Chart clock, bottom right. Anchors measured; linear interp. ─────
// 15:02:59 @ f500 … 15:03:26 @ f1660 (~+1s per 41.4 frames).
const CLOCK_ANCHORS: [number, number][] = [
  // [frame, seconds since 15:02:59]
  [500, 0], [600, 3], [700, 5], [900, 10], [1100, 15],
  [1300, 20], [1400, 22], [1500, 24], [1600, 26], [1660, 27],
];
export const clockAt = (frame: number): string => {
  const f = Math.max(500, Math.min(frame, 3000));
  let sec: number;
  if (f >= 1660) sec = 27 + Math.floor((f - 1660) / 41.4);
  else {
    let i = 0;
    while (i < CLOCK_ANCHORS.length - 1 && CLOCK_ANCHORS[i + 1][0] <= f) i++;
    const [f0, s0] = CLOCK_ANCHORS[i];
    const [f1, s1] = CLOCK_ANCHORS[Math.min(i + 1, CLOCK_ANCHORS.length - 1)];
    sec = f1 === f0 ? s0 : Math.floor(s0 + ((f - f0) / (f1 - f0)) * (s1 - s0));
  }
  const total = 2 * 60 + 59 + sec; // seconds past 15:00:00
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `15:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

// ─── Toast stack schedule (sampled every 10f, f418–f1668; step-hold) ──
// DSL tokens:
//   aN            → "Attempting transaction (Ns)"
//   s4            → "All 4 transactions succeeded"
//   tc            → "Transaction confirmed!"
//   p2|p3|p4      → "1/N transactions succeeded: Transaction confirmed!"
//   m1|m2|m3      → "N wallets missing token balances"
//   ffc|ffi|fft|fft2 → wide failure toasts (copy/token.ts TOASTS)
//   ne            → "Error getting tokens to sell: …"
//   c:name:verb:token:amt:mc → notification card, e.g.
//                    c:jsol:bought:eight:1.631:$3K
export type ToastStack = string[];
export const toastTable: Sample<ToastStack>[] = T<ToastStack>([
  [418, ["c:jsol:bought:eight:1.631:$3K"]],
  [458, ["s4", "c:samsrep:bought:Pumpwheel:3:$24.6K", "c:jsol:bought:eight:1.631:$3K"]],
  [468, ["c:samsrep:bought more:Pumpwheel:3:$129K", "s4", "c:samsrep:bought:Pumpwheel:3:$24.6K", "c:jsol:bought:eight:1.631:$3K"]],
  [478, ["a16", "c:samsrep:bought more:Pumpwheel:3:$259K", "s4", "c:samsrep:bought more:Pumpwheel:3:$129K", "c:samsrep:bought:Pumpwheel:3:$24.6K"]],
  [488, ["a16", "a16", "c:samsrep:bought more:Pumpwheel:3:$259K", "s4", "c:samsrep:bought more:Pumpwheel:3:$129K"]],
  [498, ["a16", "s4", "s4", "c:samsrep:bought more:Pumpwheel:3:$259K", "s4"]],
  [518, ["a16", "a16", "s4", "s4", "c:samsrep:bought more:Pumpwheel:3:$259K"]],
  [528, ["c:miki:bought:Pumpwheel:12.5:$363K", "a16", "ffc", "s4"]],
  [538, ["a16", "a16", "c:miki:bought:Pumpwheel:12.5:$363K", "a16", "ffc"]],
  [568, ["a16", "a15", "a14", "a14"]],
  [578, ["c:samsrep:bought more:Pumpwheel:3:$318K", "a16", "a14", "a14"]],
  [588, ["c:samsrep:bought more:Pumpwheel:3:$318K", "a16", "a16", "a14", "a14"]],
  [598, ["a16", "a16", "c:samsrep:bought more:Pumpwheel:3:$318K", "a16", "a14"]],
  [608, ["c:miki:bought more:Pumpwheel:12.5:$236K", "c:samsrep:bought more:Pumpwheel:3:$156K", "a16", "a13", "a13"]],
  [618, ["c:miki:bought more:Pumpwheel:12.5:$236K", "s4", "a15", "a13", "a13"]],
  [628, ["s4", "ffc", "a13", "a13"]],
  [638, ["s4", "ffc", "ffc", "a13", "a13"]],
  [648, ["s4", "ffc", "a13", "a12"]],
  [658, ["s4", "ffc", "ffc", "a13", "a12"]],
  [668, ["ffc", "ffc", "a13", "a12"]],
  [678, ["a16", "ffc", "a12", "a12"]],
  [698, ["c:ethan (prosper):bought:Pumpwheel:1.605:$200K", "s4", "a12", "a12", "ffc"]],
  [708, ["s4", "c:ethan (prosper):bought:Pumpwheel:1.605:$200K", "s4", "a12", "a12"]],
  [718, ["c:ethan (prosper):bought more:Pumpwheel:1.605:$199K", "s4", "c:ethan (prosper):bought:Pumpwheel:1.605:$200K", "s4", "a11"]],
  [728, ["c:ethan (prosper):bought more:Pumpwheel:1.605:$213K", "a16", "c:ethan (prosper):bought more:Pumpwheel:1.605:$199K", "a11", "a11"]],
  [738, ["a16", "c:ethan (prosper):bought more:Pumpwheel:1.605:$213K", "s4", "c:ethan (prosper):bought:Pumpwheel:1.605:$199K", "a11"]],
  [748, ["a16", "a16", "c:ethan (prosper):bought more:Pumpwheel:1.605:$213K", "s4", "a10"]],
  [758, ["c:ethan (prosper):bought more:Pumpwheel:3.183:$444K", "a16", "s4", "a10"]],
  [768, ["a16", "a16", "c:ethan (prosper):bought more:Pumpwheel:3.183:$444K", "a10", "a10"]],
  [778, ["c:ethan (prosper):bought more:Pumpwheel:3.183:$377K", "s4", "s4", "a10"]],
  [788, ["a16", "s4", "s4", "s4", "s4"]],
  [798, ["s4", "a16", "s4", "s4", "s4"]],
  [808, ["a16", "s4", "s4", "s4", "a9"]],
  [818, ["a16", "s4", "s4", "a9", "a9"]],
  [828, ["a16", "s4", "a15", "a9", "a9"]],
  [838, ["a16", "s4", "s4", "a9", "a9"]],
  [848, ["a16", "s4", "s4", "a9", "a8"]],
  [858, ["s4", "s4", "s4", "a8", "a8"]],
  [868, ["s4", "s4", "a8", "a8"]],
  [878, ["a16", "tc", "s4", "a8", "a8"]],
  [888, ["a16", "tc", "s4", "a8", "a7"]],
  [898, ["c:ethan (prosper):bought more:Pumpwheel:3.745:$271K", "a16", "tc", "a7", "a7"]],
  [908, ["c:ethan (prosper):bought more:Pumpwheel:3.745:$271K", "a16", "a16", "tc", "a7"]],
  [918, ["c:ethan (prosper):bought more:Pumpwheel:3.745:$271K", "a16", "tc", "a7", "a7"]],
  [928, ["a16", "c:ethan (prosper):bought more:Pumpwheel:3.745:$271K", "tc", "tc", "a6"]],
  [938, ["a16", "a16", "tc", "a6", "a6"]],
  [968, ["a16", "tc", "tc", "tc", "a5"]],
  [988, ["m1", "a16", "tc", "tc"]],
  [998, ["m1", "a16", "ffi", "tc", "tc"]],
  [1008, ["m1", "a16", "ffi", "a4", "a4"]],
  [1018, ["m1", "a16", "p2", "a4", "a4"]],
  [1028, ["m1", "a16", "m1", "p2", "p2"]],
  [1038, ["m1", "a16", "m1", "a16", "a3"]],
  [1048, ["m1", "a16", "a16", "p2", "a3"]],
  [1058, ["m1", "a16", "m1", "a16", "p2"]],
  [1078, ["m1", "a16", "a16", "p2", "a2"]],
  [1088, ["m1", "a16", "m1", "a16", "a2"]],
  [1098, ["m1", "a16", "a16", "p2", "a2"]],
  [1108, ["m1", "a16", "m1", "a16", "p2"]],
  [1118, ["m1", "a16", "a16", "p2", "p2"]],
  [1128, ["m1", "a16", "p2", "p2", "a1"]],
  [1148, ["m1", "a16", "p2", "a1", "a1"]],
  [1158, ["m1", "a16", "a16", "p2", "a1"]],
  [1168, ["m1", "a16", "a16", "p2", "p2"]],
  [1188, ["m2", "m2", "a16", "a16", "ffc"]],
  [1198, ["m2", "a16", "m2", "a0", "a0"]],
  [1208, ["m2", "a16", "a16", "a0", "a0"]],
  [1218, ["m2", "a16", "a15", "p2", "fft"]],
  [1228, ["m2", "a16", "a15", "a15", "fft2"]],
  [1238, ["p3", "p3", "p3", "p3"]],
  [1248, ["m2", "a16", "m2", "a16", "ffc"]],
  [1268, ["m2", "a16", "p3", "p3", "p3"]],
  [1278, ["m2", "a16", "m2", "a16", "p3"]],
  [1288, ["m2", "a16", "a16", "p3", "p3"]],
  [1398, ["m2", "a16", "m2", "p3", "p3"]],
  [1408, ["m2", "a16", "a16", "p3", "p3"]],
  [1418, ["m2", "a16", "m2", "a16", "p3"]],
  [1428, ["m2", "m2", "a16", "p3"]],
  [1438, ["m2", "a16", "a16", "p3", "p3"]],
  [1448, ["m2", "a16", "p3", "p3", "p3"]],
  [1458, ["m2", "a16", "a16", "p3", "p3"]],
  [1468, ["m2", "a16", "m2", "p3", "p3"]],
  [1478, ["m2", "a16", "a16", "p3", "p3"]],
  [1498, ["c:jijo:sold all:TST:16.16:$169K", "m2", "a16", "a16", "p3"]],
  [1508, ["m2", "a16", "c:jijo:sold all:TST:16.16:$169K", "m2", "p3"]],
  [1518, ["m2", "a16", "a16", "p3", "p3"]],
  [1528, ["m3", "a16", "m2", "a16", "p3"]],
  [1538, ["m3", "a16", "m3", "a16", "ffc"]],
  [1548, ["m3", "a16", "m3", "a16", "a16"]],
  [1568, ["a16", "p4", "p4", "p4", "p4"]],
  [1578, ["ne", "m3", "ffc", "p4", "p4"]],
  [1598, ["c:jsol:sold all:eight:1.378:$2.6K", "ne", "m3", "ffc", "p4"]],
  // holds from f1598 through the blur / outro
]);

// ═══════════════════════════════════════════════════════════════════
// LOADING VARIANT TABLES (frames 333–391)
// ═══════════════════════════════════════════════════════════════════

export const loadMcTable: Sample<string>[] = T([
  [333, ""], [370, "$2.90K"], [375, "$2.95K"], [387, "$20.2K"], [391, "$32.3K"],
]);
export type LoadCols = { price: string[]; liq: string; supply: string; fees: string; curve: string };
export const loadColsTable: Sample<LoadCols>[] = T<LoadCols>([
  [333, { price: [], liq: "", supply: "", fees: "", curve: "" }],
  [360, { price: [], liq: "", supply: "1B", fees: "", curve: "0%" }],
  [375, { price: ["0.0", "5", "295"], liq: "", supply: "1B", fees: "", curve: "0%" }],
  [381, { price: ["0.0", "5", "295"], liq: "$5.75K", supply: "1B", fees: "0.034", curve: "18%" }],
  [387, { price: ["0.0", "4", "202"], liq: "$9.43K", supply: "1B", fees: "0.034", curve: "64%" }],
  [391, { price: ["0.0", "4", "323"], liq: "$9.43K", supply: "1B", fees: "0.034", curve: "64%" }],
]);
// popup footer cells: [bought, sold, holding, pnl, pnlPct] ('' = skeleton)
export const loadFooterTable: Sample<string[] | null>[] = T<string[] | null>([
  [333, null],
  [360, ["10.1", "0", "5.055", "-5.044", "(-50%)"]],
  [387, ["10.1", "0", "34.61", "24.51", "(243%)"]],
  [391, ["10.1", "0", "55.44", "45.35", "(449%)"]],
]);
// dialog + popup shared SOL total, and the token amount chip
export const loadSolTable: Sample<string>[] = T([[333, "326.58"], [376, "322.25"]]);
export const loadTokenAmtTable: Sample<string>[] = T([[333, ""], [376, "143.00M"]]);
export const loadSellValTable: Sample<string>[] = T([[333, "0"], [376, "4.40"]]);
export const loadHoldersTable: Sample<string>[] = T([[333, "0"], [376, "3"]]);
// toasts: phase A (both "Executing orders"), phase B from ~f374
export const loadToastPhaseTable: Sample<"a" | "b">[] = T<"a" | "b">([[333, "a"], [374, "b"]]);
// token-data card phases: 4-card skeleton → top10 fills → full 10-card grid
export type LoadCards = { phase: "dash" | "partial" | "full"; top10: string; top10Neg: boolean };
export const loadCardsTable: Sample<LoadCards>[] = T<LoadCards>([
  [333, { phase: "dash", top10: "-", top10Neg: false }],
  [370, { phase: "partial", top10: "13.9%", top10Neg: false }],
  [381, { phase: "full", top10: "13.9%", top10Neg: false }],
  [388, { phase: "full", top10: "23.8%", top10Neg: true }],
  [390, { phase: "full", top10: "39.8%", top10Neg: true }],
]);
// chart area: black → solid blue #053BA5 → chart prop (candles)
export const LOAD_BLUE_FROM = 372;
export const LOAD_BLUE_TO = 386; // inclusive
