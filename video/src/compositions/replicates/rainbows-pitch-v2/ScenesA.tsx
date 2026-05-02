import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { LightGradient, DarkBg, SolidBlue, GridOverlay } from "./backgrounds";
import { useGsapProxy } from "./gsapUtils";
import { SERIES } from "./scene01-data";
import { PrismIcon, BLSBadge, NodeGraph, StackedBars, CornerProp } from "./visualProps";

const { fontFamily } = loadFont("normal", { subsets: ["latin"], weights: ["400", "700", "800"] });
const BLUE = "#000000";

// One use only — reserved for the word "rainbows" in the Scene 03 title.
const RAINBOW_GRADIENT =
  "linear-gradient(90deg, #ff3b3b 0%, #ff8a00 18%, #ffd400 36%, #2cd36f 54%, #2dabff 72%, #7e3bff 88%, #ff3bd1 100%)";

const baseText: React.CSSProperties = {
  fontFamily,
  fontWeight: 800,
  fontStyle: "italic",
  lineHeight: 1.15,
  display: "inline-block",
};

/* ═══════════════════════════════════════════════════════
   Scene 01 — Intro  (48 frames = 2s @ 24fps)
   TradingView-lite chrome. Two 2×2 candlestick panels swap
   under the existing word-stagger.
     Phrase A → vision watchlist  (4 popular categories)
     Phrase B → crash watchlist   (PEPE / BTC / BTC-put / PF rug)
   Real OHLC from VPS 1 Postgres; PUT chart synthesized from
   the BTC series.
   ═══════════════════════════════════════════════════════ */

const SCENE01_A = ["Trading", "market", "like", "this"] as const;
const SCENE01_B = ["Is", "simpler", "than", "trading", "market", "like", "this"] as const;

type Quad = {
  key: keyof typeof SERIES;
  symbol: string;
  category: string;
  logoBg: string;
  logoFg: string;
  logoChar: string;
  fmt: (v: number) => string;
};

// Phase A — 4 distinct Vision categories, most popular asset in each.
const VISION_QUADS: ReadonlyArray<Quad> = [
  {
    key: "twitch_justchat",
    symbol: "TWITCH:JUST_CHATTING",
    category: "Streaming",
    logoBg: "#9146ff",
    logoFg: "#fff",
    logoChar: "T",
    fmt: (v) => `${(v / 1000).toFixed(0)}K`,
  },
  {
    key: "steam_cs2",
    symbol: "STEAM:CS2",
    category: "Gaming",
    logoBg: "#1b2838",
    logoFg: "#66c0f4",
    logoChar: "S",
    fmt: (v) => `${(v / 1000).toFixed(0)}K`,
  },
  {
    key: "lichess_players",
    symbol: "LICHESS:TOURNAMENTS",
    category: "Chess",
    logoBg: "#161512",
    logoFg: "#fff",
    logoChar: "♞",
    fmt: (v) => `${v.toFixed(0)}`,
  },
  {
    key: "mta_nyc",
    symbol: "MTA:NYC_TRIPS",
    category: "Transit",
    logoBg: "#ffce00",
    logoFg: "#000",
    logoChar: "M",
    fmt: (v) => `${v.toFixed(0)}`,
  },
];

// Phase B — 4 crypto/scam markets.
const CRASH_QUADS: ReadonlyArray<Quad> = [
  {
    key: "pepe",
    symbol: "BITGET:PEPEUSDT",
    category: "Memecoin",
    logoBg: "#4d9b41",
    logoFg: "#fff",
    logoChar: "🐸",
    fmt: (v) => `$${v.toFixed(8)}`,
  },
  {
    key: "btc_put",
    symbol: "DERIBIT:BTC-PUT-65K",
    category: "Option",
    logoBg: "#1f2937",
    logoFg: "#ef5350",
    logoChar: "P",
    fmt: (v) => `$${v.toFixed(0)}`,
  },
  {
    key: "btc",
    symbol: "BITGET:BTCUSDT",
    category: "Crypto",
    logoBg: "#f7931a",
    logoFg: "#fff",
    logoChar: "₿",
    fmt: (v) => `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
  },
  {
    key: "pf_mex",
    symbol: "PUMPFUN:MEXICANUNC",
    category: "Rug-pull",
    logoBg: "#ff67c5",
    logoFg: "#fff",
    logoChar: "💊",
    fmt: (v) => `$${v.toFixed(7)}`,
  },
];

const TV_BG = "#0d1117";
const TV_PANEL = "#131722";
const TV_LINE = "rgba(255,255,255,0.06)";
const TV_TEXT = "rgba(255,255,255,0.55)";
const TV_TEXT_DIM = "rgba(255,255,255,0.35)";
const TV_GREEN = "#26a69a";
const TV_RED = "#ef5350";
const TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "1D", "1W"] as const;


const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

const TVTopBar: React.FC<{
  symbol: string;
  meta: string;
  metaColor: string;
  activeTf: string;
  height?: number;
}> = ({ symbol, meta, metaColor, activeTf, height = 56 }) => (
  <div
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height,
      background: "rgba(13,17,23,0.96)",
      borderBottom: `1px solid ${TV_LINE}`,
      display: "flex",
      alignItems: "center",
      padding: "0 28px",
      gap: 22,
      zIndex: 4,
    }}
  >
    <span style={{ fontFamily, fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>
      {symbol}
    </span>
    <span style={{ fontFamily, fontSize: 15, fontWeight: 700, color: metaColor }}>{meta}</span>
    <div style={{ marginLeft: 16, display: "flex", gap: 4 }}>
      {TIMEFRAMES.map((t) => (
        <span
          key={t}
          style={{
            padding: "6px 12px",
            fontSize: 13,
            borderRadius: 4,
            fontFamily: MONO,
            background: t === activeTf ? "rgba(255,255,255,0.10)" : "transparent",
            color: t === activeTf ? "#fff" : TV_TEXT_DIM,
            fontWeight: t === activeTf ? 700 : 500,
            letterSpacing: "0.02em",
          }}
        >
          {t}
        </span>
      ))}
    </div>
    <div
      style={{
        marginLeft: "auto",
        display: "flex",
        gap: 22,
        color: TV_TEXT_DIM,
        fontSize: 13,
        fontFamily,
        letterSpacing: "0.01em",
      }}
    >
      <span>Indicators</span>
      <span>Templates</span>
      <span>Alert</span>
      <span>·</span>
    </div>
  </div>
);

// Shared axis chrome (gridlines + labels + watermark).
const TVAxes: React.FC<{
  width: number;
  height: number;
  padT: number;
  yLo: number;
  yHi: number;
  yFmt: (v: number) => string;
  xLabels: ReadonlyArray<{ pos: number; label: string }>;
  watermark?: string;
  yAxisWidth?: number;
}> = ({ width, height, padT, yLo, yHi, yFmt, xLabels, watermark, yAxisWidth = 88 }) => {
  const padB = 32;
  const innerW = width - yAxisWidth;
  const innerH = height - padT - padB;
  const yTicks = 6;
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const f = i / yTicks;
        const Y = padT + f * innerH;
        const v = yHi - f * (yHi - yLo);
        return (
          <g key={i}>
            <line x1={0} y1={Y} x2={innerW} y2={Y} stroke={TV_LINE} strokeWidth={1} />
            <text
              x={width - 12}
              y={Y + 4}
              fill={TV_TEXT}
              fontSize={12}
              textAnchor="end"
              fontFamily={MONO}
            >
              {yFmt(v)}
            </text>
          </g>
        );
      })}
      {xLabels.map((xl, i) => {
        const X = xl.pos * innerW;
        return (
          <g key={i}>
            <line x1={X} y1={padT} x2={X} y2={padT + innerH} stroke={TV_LINE} strokeWidth={1} />
            <text
              x={X}
              y={height - 10}
              fill={TV_TEXT}
              fontSize={11}
              textAnchor="middle"
              fontFamily={MONO}
            >
              {xl.label}
            </text>
          </g>
        );
      })}
      {watermark && (
        <text
          x={innerW / 2}
          y={padT + innerH / 2 + 28}
          fill="rgba(255,255,255,0.04)"
          fontSize={Math.min(180, Math.floor(innerW / 8))}
          textAnchor="middle"
          fontFamily={fontFamily}
          fontWeight={800}
          fontStyle="italic"
          letterSpacing="-0.02em"
        >
          {watermark}
        </text>
      )}
    </svg>
  );
};

// Round logo with a brand color + character/emoji.
const Logo: React.FC<{ bg: string; fg: string; char: string; size?: number }> = ({
  bg,
  fg,
  char,
  size = 32,
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: bg,
      color: fg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily,
      fontSize: size * 0.55,
      fontWeight: 800,
      letterSpacing: "-0.02em",
      flexShrink: 0,
      boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
    }}
  >
    {char}
  </div>
);

// One TradingView quadrant: header (logo + symbol + price + %) + candlestick chart.
const TVQuadPanel: React.FC<{
  width: number;
  height: number;
  quad: Quad;
  candles: readonly (readonly [number, number, number, number, number])[];
  draw: number;
}> = ({ width, height, quad, candles, draw }) => {
  const headerH = 64;
  const padR = 78;
  const padT = headerH + 8;
  const padB = 28;
  const innerW = width - padR;
  const innerH = height - padT - padB;

  let yMin = Infinity;
  let yMax = -Infinity;
  for (const [, , h, l] of candles) {
    if (l < yMin) yMin = l;
    if (h > yMax) yMax = h;
  }
  const yPad = (yMax - yMin) * 0.10 || 1;
  const yLo = yMin - yPad;
  const yHi = yMax + yPad;
  const tMin = candles[0]![0];
  const tMax = candles[candles.length - 1]![0];
  const xCenter = (t: number) => ((t - tMin) / (tMax - tMin)) * innerW;
  const yPx = (v: number) => padT + (1 - (v - yLo) / (yHi - yLo)) * innerH;

  const drawClamped = Math.max(0, Math.min(1, draw));
  const visible = Math.max(1, Math.floor(candles.length * drawClamped));
  const cw = Math.max(2, (innerW / candles.length) * 0.66);

  const startV = candles[0]![4];
  const endV = candles[candles.length - 1]![4];
  const pct = ((endV - startV) / startV) * 100;
  const pctColor = pct >= 0 ? TV_GREEN : TV_RED;

  const xLabels = [0, 0.5, 1].map((f) => ({ pos: f, label: f === 0 ? "start" : f === 1 ? "now" : "·" }));

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        background: TV_PANEL,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* header */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: headerH,
          padding: "12px 18px 8px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          zIndex: 3,
          background: "linear-gradient(180deg, rgba(13,17,23,0.72) 0%, rgba(13,17,23,0) 100%)",
        }}
      >
        <Logo bg={quad.logoBg} fg={quad.logoFg} char={quad.logoChar} size={36} />
        <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 14,
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {quad.symbol}
            </span>
            <span
              style={{
                padding: "2px 7px",
                fontSize: 10,
                fontFamily: MONO,
                fontWeight: 700,
                letterSpacing: "0.08em",
                background: `${quad.logoBg}33`,
                color: quad.logoFg === "#fff" ? "#fff" : quad.logoBg,
                borderRadius: 3,
                border: `1px solid ${quad.logoBg}55`,
              }}
            >
              {quad.category.toUpperCase()}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800, color: "#fff" }}>
              {quad.fmt(endV)}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: pctColor }}>
              {pct >= 0 ? "+" : ""}
              {pct.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* gridlines + axis */}
      <TVAxes
        width={width}
        height={height}
        padT={padT}
        yLo={yLo}
        yHi={yHi}
        yFmt={quad.fmt}
        xLabels={xLabels}
        yAxisWidth={padR}
      />

      {/* candlesticks */}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {candles.slice(0, visible).map(([t, o, h, l, c], i) => {
          const xc = xCenter(t);
          const isUp = c >= o;
          const color = isUp ? TV_GREEN : TV_RED;
          const wickTop = yPx(h);
          const wickBot = yPx(l);
          const bodyTop = yPx(Math.max(o, c));
          const bodyBot = yPx(Math.min(o, c));
          const bodyH = Math.max(1, bodyBot - bodyTop);
          return (
            <g key={i}>
              <line x1={xc} y1={wickTop} x2={xc} y2={wickBot} stroke={color} strokeWidth={1.1} />
              <rect x={xc - cw / 2} y={bodyTop} width={cw} height={bodyH} fill={color} />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

function buildScene01Proxies() {
  const init: Record<string, Record<string, number>> = {
    phraseA: { opacity: 1 },
    phraseB: { opacity: 0 },
    tilesDraw: { v: 0 },
    crashDraw: { v: 0 },
  };
  SCENE01_A.forEach((w, i) => { init[`a_${i}`] = { opacity: i === 0 ? 1 : 0, y: i === 0 ? 0 : 15 }; });
  SCENE01_B.forEach((_, i) => { init[`b_${i}`] = { opacity: 0, y: 15 }; });
  return init;
}

const TOPBAR_H = 56;
const PANEL_W = 1920 / 2;
const PANEL_H = (1080 - TOPBAR_H) / 2;

const QuadGrid: React.FC<{
  quads: ReadonlyArray<Quad>;
  draw: number;
}> = ({ quads, draw }) => (
  <div
    style={{
      position: "absolute",
      top: TOPBAR_H,
      left: 0,
      right: 0,
      bottom: 0,
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: "1fr 1fr",
      gap: 1,
      background: TV_LINE,
    }}
  >
    {quads.map((q) => (
      <TVQuadPanel
        key={q.key as string}
        width={PANEL_W}
        height={PANEL_H}
        quad={q}
        candles={SERIES[q.key].candles}
        draw={draw}
      />
    ))}
  </div>
);

export const Scene01_Intro: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Phrase A — words stagger in 0.0 → 0.45s, hold to 1.30s, fade 1.30s.
      SCENE01_A.forEach((_, i) => {
        if (i === 0) return;
        tl.to(p[`a_${i}`]!, { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" }, i * 0.15);
      });
      tl.to(p.tilesDraw, { v: 1, duration: 0.85, ease: "power2.out" }, 0.05);
      tl.to(p.phraseA, { opacity: 0, duration: 0.18, ease: "power2.in" }, 1.30);
      // Phrase B — fades in 1.40s, words stagger 1.40 → 2.12s, hold to 3.0s.
      tl.to(p.phraseB, { opacity: 1, duration: 0.15, ease: "power2.out" }, 1.40);
      tl.to(p.crashDraw, { v: 1, duration: 1.10, ease: "power2.out" }, 1.40);
      SCENE01_B.forEach((_, i) => {
        tl.to(p[`b_${i}`]!, { opacity: 1, y: 0, duration: 0.14, ease: "power2.out" }, 1.40 + i * 0.12);
      });
    },
    buildScene01Proxies(),
  );

  const phraseStyle: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "0 32px",
    maxWidth: "92%",
    whiteSpace: "nowrap",
    zIndex: 5,
    pointerEvents: "none",
  };

  return (
    <AbsoluteFill style={{ background: TV_BG }}>
      {/* ── Vision panel — phrase A ────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, opacity: s.phraseA.opacity }}>
        <TVTopBar
          symbol="VISION:WATCHLIST"
          meta="4 markets · live"
          metaColor={TV_TEXT}
          activeTf="1H"
        />
        <QuadGrid quads={VISION_QUADS} draw={s.tilesDraw.v} />
      </div>

      {/* ── Crash panel — phrase B ─────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, opacity: s.phraseB.opacity }}>
        <TVTopBar
          symbol="CRYPTO:WATCHLIST"
          meta="4 markets · live"
          metaColor={TV_RED}
          activeTf="1H"
        />
        <QuadGrid quads={CRASH_QUADS} draw={s.crashDraw.v} />
      </div>

      {/* ── Scrim for text legibility ──────────────────────── */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 65% 40% at 50% 50%, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0) 70%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Phrase A — 150pt centered ──────────────────────── */}
      <div style={{ ...phraseStyle, opacity: s.phraseA.opacity }}>
        {SCENE01_A.map((word, i) => {
          const proxy = s[`a_${i}`]!;
          return (
            <span
              key={word + i}
              style={{
                ...baseText,
                fontSize: 150,
                color: "#fff",
                opacity: proxy.opacity,
                transform: `translateY(${proxy.y}px)`,
                textShadow: "0 4px 32px rgba(0,0,0,0.85), 0 0 80px rgba(0,0,0,0.7)",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>

      {/* ── Phrase B — 130pt centered ──────────────────────── */}
      <div style={{ ...phraseStyle, opacity: s.phraseB.opacity }}>
        {SCENE01_B.map((word, i) => {
          const proxy = s[`b_${i}`]!;
          return (
            <span
              key={word + i}
              style={{
                ...baseText,
                fontSize: 130,
                color: "#fff",
                opacity: proxy.opacity,
                transform: `translateY(${proxy.y}px)`,
                textShadow: "0 4px 32px rgba(0,0,0,0.85), 0 0 80px rgba(0,0,0,0.7)",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 02 — Numbers  (48 frames = 2s @ 24fps)
   "regaining / 70% / of your profits" — three lines, one frame.
   ═══════════════════════════════════════════════════════ */

export const Scene02_Numbers: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // "regaining" fades in first
      tl.to(p.regaining, { opacity: 1, y: 0, duration: 0.22, ease: "power2.out" }, 0.0);
      // Counter rolls 0 → 70
      tl.to(p.num, { opacity: 1, duration: 0.15 }, 0.2);
      tl.to(p.num, { value: 70, duration: 0.6, ease: "power2.out", snap: { value: 1 } }, 0.2);
      tl.to(p.num, { scale: 1, duration: 0.5, ease: "back.out(1.6)" }, 0.2);
      // "%" reveals
      tl.to(p.pct, { opacity: 1, duration: 0.15, ease: "power2.out" }, 0.65);
      // "of your profits" cascades in last
      tl.to(p.caption, { opacity: 1, y: 0, duration: 0.22, ease: "power2.out" }, 0.95);
      // Stacked bars fade in faintly behind, fill rises with the counter
      tl.to(p.bars, { opacity: 0.42, duration: 0.3, ease: "power2.out" }, 0.15);
      tl.to(p.bars, { fill: 1, duration: 0.7, ease: "power2.out" }, 0.25);
    },
    {
      regaining: { opacity: 0, y: 12 },
      num: { value: 0, opacity: 0, scale: 0.7 },
      pct: { opacity: 0 },
      caption: { opacity: 0, y: 14 },
      bars: { opacity: 0, fill: 0 },
    },
  );

  const blueGradientText: React.CSSProperties = {
    backgroundImage: `linear-gradient(180deg, #000 0%, #3a3a3a 50%, #000 100%)`,
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
  };

  return (
    <AbsoluteFill>
      <LightGradient />
      {/* Stacked bars — faint, behind the number */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          opacity: s.bars.opacity,
          pointerEvents: "none",
        }}
      >
        <StackedBars fill={s.bars.fill} />
      </div>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          whiteSpace: "nowrap",
          zIndex: 2,
        }}
      >
        {/* "regaining" */}
        <span
          style={{
            ...baseText,
            fontSize: 96,
            fontWeight: 700,
            color: BLUE,
            opacity: s.regaining.opacity,
            transform: `translateY(${s.regaining.y}px)`,
            letterSpacing: "-0.01em",
          }}
        >
          regaining
        </span>

        {/* 70% */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            opacity: s.num.opacity,
            transform: `scale(${s.num.scale})`,
          }}
        >
          <span
            style={{
              ...baseText,
              ...blueGradientText,
              fontSize: 360,
              letterSpacing: "-0.04em",
            }}
          >
            {Math.round(s.num.value)}
          </span>
          <span
            style={{
              ...baseText,
              ...blueGradientText,
              fontSize: 260,
              marginLeft: 12,
              opacity: s.pct.opacity,
            }}
          >
            %
          </span>
        </div>

        {/* "of your profits" */}
        <span
          style={{
            ...baseText,
            fontSize: 110,
            fontWeight: 700,
            color: BLUE,
            opacity: s.caption.opacity,
            transform: `translateY(${s.caption.y}px)`,
            marginTop: 8,
          }}
        >
          of your profits
        </span>
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 03 — DarkGrid  (84 frames = 3.5s @ 24fps)
   Phase 1: "But / what / are / rainbows?" word flash
   Phase 2: title "What are rainbows?" slides in (rainbow gradient on "rainbows")
   ═══════════════════════════════════════════════════════ */

export const Scene03_DarkGrid: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Compressed for 60-frame (2.5s) budget. Phase 1 ends at 1.20s,
      // phase 2 lands fast and holds briefly — the rainbow flourish was
      // overstaying its welcome.
      // Phase 1 — five-word statement, ~0.20s per word.
      tl.to(p.but, { opacity: 0, duration: 0.05, ease: "power2.in" }, 0.20);
      tl.to(p.only, { opacity: 1, y: 0, duration: 0.07, ease: "power2.out" }, 0.20);
      tl.to(p.only, { opacity: 0, duration: 0.05, ease: "power2.in" }, 0.42);
      tl.to(p.tradable, { opacity: 1, y: 0, duration: 0.08, ease: "power2.out" }, 0.42);
      tl.to(p.tradable, { opacity: 0, duration: 0.05, ease: "power2.in" }, 0.66);
      tl.to(p.with_, { opacity: 1, y: 0, duration: 0.06, ease: "power2.out" }, 0.66);
      tl.to(p.with_, { opacity: 0, duration: 0.05, ease: "power2.in" }, 0.84);
      tl.to(p.rainbows, { opacity: 1, y: 0, duration: 0.10, ease: "power2.out" }, 0.84);
      // Phase 1 cross-fades out at 1.25s.
      tl.to(p.phase1, { opacity: 0, duration: 0.12, ease: "power2.in" }, 1.25);
      // Phase 2 — title slides in fast at 1.35s, holds the rest.
      tl.to(p.phase2, { opacity: 1, duration: 0.12, ease: "power2.out" }, 1.35);
      tl.to(p.title, { x: 0, duration: 0.30, ease: "power2.out" }, 1.35);
    },
    {
      phase1: { opacity: 1 },
      but: { opacity: 1, y: 0 },
      only: { opacity: 0, y: 15 },
      tradable: { opacity: 0, y: 15 },
      with_: { opacity: 0, y: 15 },
      rainbows: { opacity: 0, y: 15 },
      phase2: { opacity: 0 },
      title: { x: 60 },
    },
  );

  const flashStyle: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    fontSize: 165,
    color: "#fff",
    whiteSpace: "nowrap",
  };

  const rainbowText: React.CSSProperties = {
    backgroundImage: RAINBOW_GRADIENT,
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
  };

  return (
    <AbsoluteFill>
      <DarkBg />
      <GridOverlay color="rgba(255,255,255,0.18)" cols={10} rows={7} />

      {/* Phase 1 — single words, centered */}
      <div style={{ opacity: s.phase1.opacity }}>
        {s.but.opacity > 0.01 && (
          <span style={{ ...baseText, fontStyle: "normal", ...flashStyle, transform: `translate(-50%, calc(-50% + ${s.but.y}px))`, opacity: s.but.opacity }}>
            But
          </span>
        )}
        {s.only.opacity > 0.01 && (
          <span style={{ ...baseText, fontStyle: "normal", ...flashStyle, transform: `translate(-50%, calc(-50% + ${s.only.y}px))`, opacity: s.only.opacity }}>
            only
          </span>
        )}
        {s.tradable.opacity > 0.01 && (
          <span style={{ ...baseText, fontStyle: "normal", ...flashStyle, transform: `translate(-50%, calc(-50% + ${s.tradable.y}px))`, opacity: s.tradable.opacity }}>
            tradable
          </span>
        )}
        {s.with_.opacity > 0.01 && (
          <span style={{ ...baseText, fontStyle: "normal", ...flashStyle, transform: `translate(-50%, calc(-50% + ${s.with_.y}px))`, opacity: s.with_.opacity }}>
            with
          </span>
        )}
        {s.rainbows.opacity > 0.01 && (
          <span
            style={{
              ...baseText,
              fontStyle: "normal",
              ...flashStyle,
              ...rainbowText,
              fontSize: 195,
              transform: `translate(-50%, calc(-50% + ${s.rainbows.y}px))`,
              opacity: s.rainbows.opacity,
            }}
          >
            rainbows.
          </span>
        )}
      </div>

      {/* Phase 2 — title card, left-aligned */}
      <div
        style={{
          position: "absolute",
          top: "55%",
          left: "8%",
          transform: `translateX(${s.title.x}px)`,
          opacity: s.phase2.opacity,
          maxWidth: "85%",
          display: "flex",
          flexWrap: "wrap",
          gap: "0 28px",
        }}
      >
        <span style={{ ...baseText, fontSize: 200, color: "#fff" }}>What</span>
        <span style={{ ...baseText, fontSize: 200, color: "#fff" }}>are</span>
        <span style={{ ...baseText, fontSize: 200, ...rainbowText }}>rainbows?</span>
      </div>

      {/* Corner props — prism top-left, BLS badge bottom-right */}
      <CornerProp corner="tl" offset={120} opacity={s.phase2.opacity * 0.95}>
        <PrismIcon size={180} />
      </CornerProp>
      <CornerProp corner="br" offset={120} opacity={s.phase2.opacity}>
        <BLSBadge />
      </CornerProp>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 04 — CubeExplode  (72 frames = 3s @ 24fps)
   "Rainbows filters out illegal activities."
   White square → isometric cube → 10-shard explosion.
   ═══════════════════════════════════════════════════════ */

const SMALL_CUBE = 120;

function seededRand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const EXPLOSION_TARGETS = Array.from({ length: 10 }, (_, i) => {
  const angle = seededRand(i * 7 + 3) * Math.PI * 2;
  const dist = 300 + seededRand(i * 13 + 1) * 300;
  return {
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist * 0.8,
    rot: seededRand(i * 19 + 5) * 720 - 360,
  };
});

const CubeFace: React.FC<{ size: number; transform: string; shade: string }> = ({ size, transform, shade }) => (
  <div
    style={{
      position: "absolute",
      width: size,
      height: size,
      background: shade,
      border: "1.5px solid rgba(0,0,0,0.25)",
      transform,
      backfaceVisibility: "hidden",
    }}
  />
);

const IsoCube: React.FC<{ size: number; opacity?: number }> = ({ size, opacity = 1 }) => {
  const half = size / 2;
  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        transformStyle: "preserve-3d",
        transform: "rotateX(-30deg) rotateY(45deg)",
        opacity,
      }}
    >
      <CubeFace size={size} transform={`translateZ(${half}px)`} shade="rgba(255,255,255,0.95)" />
      <CubeFace size={size} transform={`rotateX(90deg) translateZ(${half}px)`} shade="rgba(255,255,255,0.8)" />
      <CubeFace size={size} transform={`rotateY(90deg) translateZ(${half}px)`} shade="rgba(230,230,240,0.85)" />
    </div>
  );
};

const SCENE04_WORDS = ["Rainbows", "filters", "out", "illegal", "activities"] as const;
const SCENE04_CHIPS = ["FRONTRUN", "SPOOF", "INSIDER"] as const;

type Scene04Proxies = {
  graph: { opacity: number };
  [key: `w_${number}`]: { opacity: number; y: number };
  [key: `chip_${number}`]: { appear: number; struck: number };
  [key: `shard${number}`]: { x: number; y: number; rotation: number; opacity: number };
};

function buildScene04Proxies(): Scene04Proxies {
  const base: Record<string, Record<string, number>> = {
    graph: { opacity: 0 },
  };
  SCENE04_WORDS.forEach((_, i) => { base[`w_${i}`] = { opacity: 0, y: 15 }; });
  SCENE04_CHIPS.forEach((_, i) => { base[`chip_${i}`] = { appear: 0, struck: 0 }; });
  for (let i = 0; i < 10; i++) {
    base[`shard${i}`] = { x: 0, y: 0, rotation: 0, opacity: 0 };
  }
  return base as unknown as Scene04Proxies;
}

export const Scene04_CubeExplode: React.FC = () => {
  const s = useGsapProxy<Scene04Proxies>(
    (tl, p) => {
      // Word-by-word — 5 words across 0–0.7s
      SCENE04_WORDS.forEach((_, i) => {
        tl.to(p[`w_${i}` as keyof Scene04Proxies], { opacity: 1, y: 0, duration: 0.14, ease: "power2.out" }, i * 0.16);
      });

      // Center node fades in at 0.3s
      tl.to(p.graph, { opacity: 1, duration: 0.2, ease: "power2.out" }, 0.3);

      // Three chips appear and get struck through one by one
      SCENE04_CHIPS.forEach((_, i) => {
        const start = 0.55 + i * 0.32;
        tl.to(p[`chip_${i}` as keyof Scene04Proxies], { appear: 1, duration: 0.18, ease: "power2.out" }, start);
        tl.to(p[`chip_${i}` as keyof Scene04Proxies], { struck: 1, duration: 0.18, ease: "power2.inOut" }, start + 0.18);
      });

      // Graph fades out as explosion begins
      tl.to(p.graph, { opacity: 0, duration: 0.18, ease: "power2.in" }, 1.55);

      // Explosion at 1.6s — each shard flies out (kept as closing beat)
      for (let i = 0; i < 10; i++) {
        const target = EXPLOSION_TARGETS[i];
        const shard = p[`shard${i}` as keyof Scene04Proxies] as { x: number; y: number; rotation: number; opacity: number };
        const offset = 1.6 + i * 0.02;
        tl.to(shard, { opacity: 1, duration: 0.08 }, offset);
        tl.to(shard, { x: target.x, y: target.y, rotation: target.rot, duration: 1.0, ease: "power2.out" }, offset);
        tl.to(shard, { opacity: 0, duration: 0.3, ease: "power2.in" }, offset + 0.8);
      }
    },
    buildScene04Proxies(),
  );

  const chips = SCENE04_CHIPS.map((label, i) => {
    const proxy = s[`chip_${i}` as keyof Scene04Proxies] as { appear: number; struck: number };
    return { label, appear: proxy.appear, struck: proxy.struck };
  });

  return (
    <AbsoluteFill>
      <SolidBlue />
      <GridOverlay color="rgba(255,255,255,0.12)" />

      {/* Sentence */}
      <div
        style={{
          position: "absolute",
          top: "12%",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0 22px",
          maxWidth: "90%",
        }}
      >
        {SCENE04_WORDS.map((word, i) => {
          const proxy = s[`w_${i}` as keyof Scene04Proxies] as { opacity: number; y: number };
          return (
            <span
              key={word + i}
              style={{
                ...baseText,
                fontSize: 130,
                color: "#fff",
                opacity: proxy.opacity,
                transform: `translateY(${proxy.y}px)`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>

      {/* Node graph — center ORDER node + three threat chips */}
      <div
        style={{
          position: "absolute",
          top: "60%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          opacity: s.graph.opacity,
        }}
      >
        <NodeGraph centerLabel="ORDER" chips={chips} scale={1} />
      </div>

      {/* Explosion — 10 small cubes (closing beat) */}
      <div
        style={{
          position: "absolute",
          top: "60%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          perspective: 800,
        }}
      >
        {EXPLOSION_TARGETS.map((_, i) => {
          const shard = s[`shard${i}` as keyof Scene04Proxies] as { x: number; y: number; rotation: number; opacity: number };
          if (shard.opacity < 0.01) return null;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: -SMALL_CUBE / 2,
                top: -SMALL_CUBE / 2,
                transform: `translate(${shard.x}px, ${shard.y}px) rotate(${shard.rotation}deg)`,
                opacity: shard.opacity,
              }}
            >
              <IsoCube size={SMALL_CUBE} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ── Meta ── */

export const sceneAMetas = [
  { id: "RP-Scene01", component: Scene01_Intro, durationInFrames: 48 },
  { id: "RP-Scene02", component: Scene02_Numbers, durationInFrames: 48 },
  { id: "RP-Scene03", component: Scene03_DarkGrid, durationInFrames: 84 },
  { id: "RP-Scene04", component: Scene04_CubeExplode, durationInFrames: 72 },
];
