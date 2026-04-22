import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";

// Replicates the homepage `FeaturedSourceCard` (frontend/components/domain/
// vision/sources/WelcomeHero.tsx): accent bar, logo + name + Live pill,
// "N markets · Unit", four sub-market rows with dot + label + value + %,
// and a multi-line chart at the bottom. Rendered as a dense wall so the
// GM-logo mask pulls back from real product evidence rather than bare logos.

type SubMarket = { name: string; value: string; pct: number; badge?: string; badgeBg?: string };

type FeaturedSource = {
  id: string;
  name: string;
  logo: string; // filename under /source-imgs/
  accent: string; // brand accent for pill + top bar + last chart line
  markets: number;
  unit: string;
  subs: SubMarket[];
};

// Homepage palette for the chart lines
const CHART_COLORS = ["#2563EB", "#059669", "#D97706", "#7C3AED"] as const;

// ─── Sources ───────────────────────────────────────────────────────────────
// The four the user shared, then fifteen more to match "a lot more sources".
// Values are indicative — enough to read plausibly at small scale.

const FEATURED: FeaturedSource[] = [
  {
    id: "twitch", name: "Twitch", logo: "new-twitch.webp",
    accent: "#9146FF", markets: 56660, unit: "Viewers",
    subs: [
      { name: "Fanfan",         value: "1.9K",  pct: -28.27 },
      { name: "DisguisedToast", value: "1.8K",  pct: -25.14 },
      { name: "Erobb221",       value: "3.1K",  pct: -21.15 },
      { name: "Jasontheween",   value: "14.5K", pct: -18.41 },
    ],
  },
  {
    id: "db_trains", name: "Deutsche Bahn", logo: "new-dbtrains.svg",
    accent: "#EC0016", markets: 58, unit: "Avg Delay",
    subs: [
      { name: "Bielefeld Hbf", value: "6.1", pct:  19.61, badge: "BIE", badgeBg: "#0066B3" },
      { name: "Darmstadt Hbf", value: "5.7", pct: 185.00, badge: "DAR", badgeBg: "#0066B3" },
      { name: "Duisburg Hbf",  value: "5.6", pct:  55.56, badge: "DUI", badgeBg: "#0066B3" },
      { name: "Augsburg Hbf",  value: "4.8", pct:  -2.04, badge: "AUG", badgeBg: "#0066B3" },
    ],
  },
  {
    id: "steam", name: "Steam", logo: "new-steam.webp",
    accent: "#171A21", markets: 502, unit: "Players",
    subs: [
      { name: "Counter-Strike: Global O…", value: "1.4M",   pct: -0.11 },
      { name: "PUBG: BATTLEGROUNDS",       value: "266.0K", pct: -4.04 },
      { name: "Rust",                      value: "112.2K", pct: -2.67 },
      { name: "Apex Legends",              value: "89.4K",  pct: -1.97 },
    ],
  },
  {
    id: "earthquake", name: "Earthquakes", logo: "new-usgs.svg",
    accent: "#EF6C00", markets: 20, unit: "Magnitude",
    subs: [
      { name: "Total Seismic Energy", value: "247.9M", pct: -50.33 },
      { name: "Average Depth Of M4.5+", value: "41.7", pct:   1.71 },
      { name: "M6.0+ Earthquakes (This …)", value: "10.0", pct: -16.67 },
      { name: "M4.5+ Earthquakes (Last …)", value: "9.0",  pct: -10.00 },
    ],
  },
  {
    id: "coingecko", name: "CoinGecko", logo: "new-coingecko.webp",
    accent: "#8DC647", markets: 2184, unit: "Price",
    subs: [
      { name: "Bitcoin",  value: "$67.8K", pct:  2.15 },
      { name: "Ethereum", value: "$3.42K", pct: -1.03 },
      { name: "Solana",   value: "$158",   pct:  5.67 },
      { name: "XRP",      value: "$0.58",  pct: -2.44 },
    ],
  },
  {
    id: "polymarket", name: "Polymarket", logo: "new-polymarket.webp",
    accent: "#1652F0", markets: 1124, unit: "Odds",
    subs: [
      { name: "2028 Presidential winner", value: "57%", pct:  3.10 },
      { name: "Fed rate cut — December",  value: "62%", pct: -1.80 },
      { name: "BTC > $100k by Dec 31",    value: "88%", pct:  4.55 },
      { name: "GTA VI ships 2026",        value: "91%", pct:  0.22 },
    ],
  },
  {
    id: "github", name: "GitHub", logo: "new-github.webp",
    accent: "#24292E", markets: 1840, unit: "Stars",
    subs: [
      { name: "vercel/next.js",     value: "131K", pct:  0.42 },
      { name: "openai/whisper",     value: "79.2K", pct:  0.11 },
      { name: "facebook/react",     value: "237K", pct:  0.08 },
      { name: "rust-lang/rust",     value: "103K", pct:  0.31 },
    ],
  },
  {
    id: "reddit", name: "Reddit", logo: "new-reddit.webp",
    accent: "#FF4500", markets: 680, unit: "Subscribers",
    subs: [
      { name: "r/wallstreetbets", value: "17.8M", pct:  0.21 },
      { name: "r/CryptoCurrency", value: "9.1M",  pct:  0.07 },
      { name: "r/StockMarket",    value: "3.2M",  pct: -0.02 },
      { name: "r/investing",      value: "2.9M",  pct:  0.04 },
    ],
  },
  {
    id: "flights", name: "Global Flights", logo: "new-flights.webp",
    accent: "#2A2A2A", markets: 412, unit: "Flights",
    subs: [
      { name: "US airspace",        value: "12.4K", pct: -3.11 },
      { name: "Europe airspace",    value: "9.8K",  pct:  1.04 },
      { name: "Asia-Pacific",       value: "7.1K",  pct: -0.77 },
      { name: "Transatlantic",      value: "1.2K",  pct:  2.18 },
    ],
  },
  {
    id: "nasdaq", name: "Nasdaq", logo: "new-nasdaq.svg",
    accent: "#0079C1", markets: 3200, unit: "Price",
    subs: [
      { name: "NVDA", value: "$921",  pct:  2.41 },
      { name: "AAPL", value: "$226",  pct:  0.66 },
      { name: "MSFT", value: "$418",  pct: -0.22 },
      { name: "TSLA", value: "$241",  pct: -1.95 },
    ],
  },
  {
    id: "queue_times", name: "Theme Park Waits", logo: "new-queuetimes.svg",
    accent: "#6C3FE0", markets: 318, unit: "Wait",
    subs: [
      { name: "Disney — Tron Lightcycle", value: "85m", pct: -3.80 },
      { name: "Universal — Hagrid",        value: "120m", pct: 14.20 },
      { name: "Cedar Point — Steel Veng.", value: "45m",  pct: -8.00 },
      { name: "Six Flags — Superman",      value: "30m",  pct: -2.10 },
    ],
  },
  {
    id: "weather", name: "NOAA Weather", logo: "new-noaa.webp",
    accent: "#1F7FB5", markets: 742, unit: "Temp",
    subs: [
      { name: "KLAX — Los Angeles",    value: "72°F", pct:  3.10 },
      { name: "KJFK — New York",       value: "58°F", pct: -1.60 },
      { name: "KORD — Chicago",        value: "49°F", pct: -4.45 },
      { name: "KMIA — Miami",          value: "81°F", pct:  0.88 },
    ],
  },
  {
    id: "volcano", name: "Volcano Activity", logo: "new-volcano.webp",
    accent: "#C62828", markets: 48, unit: "Alert",
    subs: [
      { name: "Kīlauea (Hawaiʻi)",  value: "ORANGE", pct:  2.00 },
      { name: "Etna (Italy)",         value: "YELLOW", pct:  0.00 },
      { name: "Sakurajima (Japan)",   value: "ORANGE", pct:  4.11 },
      { name: "Popocatépetl (MX)",    value: "YELLOW", pct: -1.20 },
    ],
  },
  {
    id: "pumpfun", name: "Pump.fun", logo: "new-pumpfun.webp",
    accent: "#00D18C", markets: 9800, unit: "Price",
    subs: [
      { name: "MOODENG",  value: "$0.281", pct:  14.80 },
      { name: "GOAT",     value: "$0.662", pct:  -8.42 },
      { name: "FWOG",     value: "$0.041", pct:  22.10 },
      { name: "PNUT",     value: "$1.08",  pct:  -3.30 },
    ],
  },
  {
    id: "congress", name: "Congress Trades", logo: "congress.webp",
    accent: "#1A2744", markets: 92, unit: "Volume",
    subs: [
      { name: "Pelosi, N. — NVDA",  value: "$1M–$5M", pct:  2.40 },
      { name: "Crenshaw, D. — MSFT", value: "$15K–$50K", pct: -0.90 },
      { name: "Tuberville, T. — AAPL", value: "$50K–$100K", pct:  0.70 },
      { name: "Khanna, R. — GOOG",     value: "$1K–$15K",   pct: -1.80 },
    ],
  },
  {
    id: "anilist", name: "AniList", logo: "new-anilist.webp",
    accent: "#152232", markets: 540, unit: "Popularity",
    subs: [
      { name: "Frieren: Beyond Journey's", value: "218K", pct:  4.80 },
      { name: "Solo Leveling",              value: "312K", pct:  6.12 },
      { name: "Jujutsu Kaisen",             value: "451K", pct:  1.10 },
      { name: "Oshi no Ko",                 value: "189K", pct:  2.91 },
    ],
  },
  {
    id: "fred", name: "FRED Rates", logo: "new-fred.webp",
    accent: "#0B5FFF", markets: 184, unit: "Rate",
    subs: [
      { name: "Fed Funds — Effective", value: "5.33%", pct: -0.18 },
      { name: "10Y Treasury",          value: "4.28%", pct:  0.64 },
      { name: "30Y Mortgage",          value: "6.81%", pct: -0.22 },
      { name: "Unemployment U-3",      value: "4.10%", pct:  2.41 },
    ],
  },
  {
    id: "tmdb", name: "Movies & TV", logo: "new-tmdb.svg",
    accent: "#01B4E4", markets: 612, unit: "Popularity",
    subs: [
      { name: "Dune: Part Two",     value: "1,184", pct:  1.10 },
      { name: "The Bear — S3",       value: "  912", pct: -3.22 },
      { name: "Shogun — FX",         value: "  874", pct:  0.45 },
      { name: "True Detective — S4", value: "  612", pct: -5.10 },
    ],
  },
  {
    id: "sec", name: "SEC Filings", logo: "new-sec.svg",
    accent: "#0A3055", markets: 210, unit: "Volume",
    subs: [
      { name: "13F — Berkshire Hathaway", value: "$313B", pct:  1.60 },
      { name: "8-K — Tesla, Inc.",         value: "Filed", pct:  0.00 },
      { name: "10-Q — Apple Inc.",          value: "Filed", pct:  0.00 },
      { name: "S-1 — Reddit, Inc.",         value: "Filed", pct:  0.00 },
    ],
  },
  {
    id: "chaturbate", name: "Chaturbate Live", logo: "new-chaturbate.webp",
    accent: "#F49B20", markets: 380, unit: "Viewers",
    subs: [
      { name: "room_a",  value: "8.2K", pct: -11.8 },
      { name: "room_b",  value: "5.1K", pct:  -4.0 },
      { name: "room_c",  value: "3.4K", pct:   2.2 },
      { name: "room_d",  value: "2.1K", pct:  -7.7 },
    ],
  },
];

// ─── Seeded chart generation ───────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function makeSpline(seed: number, count: number): number[] {
  let s = seed || 1;
  const rand = () => { s = (s * 16807) % 2147483647; return (s & 0x7fffffff) / 0x7fffffff; };
  const drift = (rand() - 0.5) * 0.15;
  const jumpProb = 0.06 + rand() * 0.04;
  const vals: number[] = [];
  let v = 0.15 + rand() * 0.7;
  for (let i = 0; i < count; i++) {
    const isJump = rand() < jumpProb;
    const step = isJump ? (rand() - 0.5) * 0.18 : (rand() - 0.5 + drift) * 0.025;
    v = Math.max(0.02, Math.min(0.98, v + step));
    vals.push(v);
  }
  return vals;
}

// Monotone cubic spline (Fritsch–Carlson) — same curve as homepage
function monotonePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  const n = pts.length;
  const dx: number[] = [], dy: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    dy.push(pts[i + 1].y - pts[i].y);
    m.push(dy[i] / dx[i]);
  }
  const tg: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) tg.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  tg.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(m[i]) < 1e-6) { tg[i] = 0; tg[i + 1] = 0; continue; }
    const a = tg[i] / m[i], b = tg[i + 1] / m[i], sq = a * a + b * b;
    if (sq > 9) { const t = 3 / Math.sqrt(sq); tg[i] = t * a * m[i]; tg[i + 1] = t * b * m[i]; }
  }
  const parts = [`M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`];
  for (let i = 0; i < n - 1; i++) {
    const d = dx[i] / 3;
    parts.push(
      `C${(pts[i].x + d).toFixed(2)},${(pts[i].y + tg[i] * d).toFixed(2)} ` +
      `${(pts[i + 1].x - d).toFixed(2)},${(pts[i + 1].y - tg[i + 1] * d).toFixed(2)} ` +
      `${pts[i + 1].x.toFixed(2)},${pts[i + 1].y.toFixed(2)}`
    );
  }
  return parts.join(" ");
}

type ChartGeom = {
  w: number; h: number;
  grid: number[];
  series: { color: string; linePath: string; areaPath: string; endPt: { x: number; y: number }; endVal: number }[];
};

// Precompute paths once per source at module load — avoids per-frame spline math.
function buildChart(source: FeaturedSource): ChartGeom {
  const W = 460, H = 180;
  const padT = 8, padB = 28, padL = 0, padR = 42;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const POINTS = 48;

  const raw = [0, 1, 2, 3].map((i) => ({
    color: i === 3 ? source.accent : CHART_COLORS[i],
    values: makeSpline(hashStr(source.id + "_" + i), POINTS),
  }));

  const all = raw.flatMap((s) => s.values);
  const lo = Math.min(...all), hi = Math.max(...all), range = hi - lo || 1;
  const norm = raw.map((s) => s.values.map((v) => 0.15 + 0.70 * (v - lo) / range));

  const toY = (v: number) => padT + plotH * (1 - v);
  const ticks = [0.25, 0.5, 0.75, 1];
  const grid = ticks.map((t) => toY(t));

  const series = raw.map((s, i) => {
    const vals = norm[i];
    const pts = vals.map((v, j) => ({ x: padL + (plotW / (POINTS - 1)) * j, y: toY(v) }));
    const linePath = monotonePath(pts);
    const areaPath =
      `${linePath}L${pts[pts.length - 1].x.toFixed(2)},${(padT + plotH).toFixed(2)}` +
      `L${pts[0].x.toFixed(2)},${(padT + plotH).toFixed(2)}Z`;
    return {
      color: s.color,
      linePath,
      areaPath,
      endPt: pts[pts.length - 1],
      endVal: Math.round(vals[vals.length - 1] * 100),
    };
  });

  return { w: W, h: H, grid, series };
}

const CHART_CACHE: Record<string, ChartGeom> = {};
for (const src of FEATURED) CHART_CACHE[src.id] = buildChart(src);

// ─── Card ──────────────────────────────────────────────────────────────────

function formatMarkets(n: number): string {
  if (n >= 1000) return n.toLocaleString();
  return String(n);
}
function pctColor(pct: number): string {
  if (pct > 0.001) return "#059669";
  if (pct < -0.001) return "#DC2626";
  return "#6B7280";
}
function pctText(pct: number): string {
  if (Math.abs(pct) < 0.01) return "0.00%";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

const FeaturedCard: React.FC<{ source: FeaturedSource }> = ({ source }) => {
  const chart = CHART_CACHE[source.id];
  const logoPath = `source-imgs/${source.logo}`;

  return (
    <div
      style={{
        background: "#FFFFFF",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        border: "1px solid #E4E4E7",
        fontFamily: "'Inter', 'Helvetica Neue', system-ui, sans-serif",
        color: "#0A0A0A",
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, ${source.accent}, ${source.accent}44)`,
        }}
      />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 12px 8px" }}>
        <div
          style={{
            width: 36,
            height: 36,
            flexShrink: 0,
            borderRadius: 6,
            background: "#F4F4F5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <Img
            src={staticFile(logoPath)}
            style={{ maxWidth: "86%", maxHeight: "86%", objectFit: "contain" }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>
              {source.name}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 8px",
                borderRadius: 999,
                background: `${source.accent}18`,
                color: source.accent,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: source.accent,
                  display: "inline-block",
                }}
              />
              Live
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#A1A1AA", marginTop: 3 }}>
            <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
              {formatMarkets(source.markets)}
            </span>
            {" "}markets · {source.unit}
          </div>
        </div>
      </div>

      {/* Sub-market rows */}
      <div style={{ borderTop: "1px solid #F4F4F5" }}>
        {source.subs.map((sm, i) => {
          const color = CHART_COLORS[i % 4];
          const first = sm.name.charAt(0).toUpperCase();
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                fontSize: 12,
                lineHeight: 1.15,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />
              {sm.badge ? (
                <span
                  style={{
                    height: 18,
                    minWidth: 28,
                    padding: "0 5px",
                    borderRadius: 4,
                    background: sm.badgeBg ?? "#71717A",
                    color: "#FFF",
                    fontSize: 10,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {sm.badge}
                </span>
              ) : (
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: "#E4E4E7",
                    color: "#71717A",
                    fontSize: 10,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {first}
                </span>
              )}
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  textTransform: "capitalize",
                }}
              >
                {sm.name}
              </span>
              <span style={{ fontFamily: "monospace", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                {sm.value}
              </span>
              <span
                style={{
                  fontFamily: "monospace",
                  fontWeight: 600,
                  fontSize: 11,
                  width: 60,
                  textAlign: "right",
                  color: pctColor(sm.pct),
                }}
              >
                {pctText(sm.pct)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div
        style={{
          borderTop: "1px solid #F4F4F5",
          flex: 1,
          padding: "6px 8px",
          minHeight: 120,
          background: `linear-gradient(180deg, transparent 0%, ${source.accent}08 100%)`,
        }}
      >
        <svg viewBox={`0 0 ${chart.w} ${chart.h}`} style={{ width: "100%", height: "100%", overflow: "visible" }}>
          <defs>
            {chart.series.map((s, i) => (
              <linearGradient key={i} id={`grad-${source.id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                <stop offset="70%" stopColor={s.color} stopOpacity={0.05} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {chart.grid.map((y, i) => (
            <line
              key={i}
              x1={0}
              y1={y}
              x2={chart.w - 42}
              y2={y}
              stroke="#E5E7EB"
              strokeWidth={0.5}
              strokeDasharray="1,3"
            />
          ))}
          {chart.series.map((s, i) => (
            <path key={`fill-${i}`} d={s.areaPath} fill={`url(#grad-${source.id}-${i})`} />
          ))}
          {chart.series.map((s, i) => (
            <path
              key={`line-${i}`}
              d={s.linePath}
              fill="none"
              stroke={s.color}
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {chart.series.map((s, i) => (
            <circle key={`dot-${i}`} cx={s.endPt.x} cy={s.endPt.y} r={3} fill={s.color} />
          ))}
          {chart.series.map((s, i) => (
            <text
              key={`lbl-${i}`}
              x={s.endPt.x + 6}
              y={s.endPt.y + 3.5}
              fill={s.color}
              fontSize={11}
              fontWeight={700}
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {s.endVal}%
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
};

// ─── Wall ──────────────────────────────────────────────────────────────────
// Grid of 5 × 4 = 20 cards arranged to fill a 1920×1080 canvas, repeated
// vertically. `scrollY` parallels the MegaGrid signature for drop-in use.

const COLS = 5;
const WALL_TILT_X = 14;
const WALL_SCROLL_SPEED = 0.7;

export const SourceCardsWall: React.FC<{ scrollY?: number }> = ({ scrollY = 0 }) => {
  // Enough cards to fill the frame and keep scrolling feeling infinite. With
  // 5 cols and rows of ~380px each, eight rows = 40 cards, ~3040px tall — a
  // comfortable runway for a 60-frame pullback.
  const ROWS = 8;
  const tiles = Array.from({ length: COLS * ROWS }, (_, i) => FEATURED[i % FEATURED.length]);

  return (
    <AbsoluteFill style={{ perspective: 1800, perspectiveOrigin: "50% 48%" }}>
      <AbsoluteFill
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridAutoRows: "380px",
          gap: 10,
          padding: 10,
          transform: `rotateX(${WALL_TILT_X}deg) scale(1.22) translateY(${-scrollY * WALL_SCROLL_SPEED}px)`,
          transformStyle: "preserve-3d",
          filter: "saturate(0.95) brightness(0.97)",
        }}
      >
        {tiles.map((source, i) => (
          <FeaturedCard key={i} source={source} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
