import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { LightGradient, DarkBg, SolidBlue, GridOverlay } from "./backgrounds";
import { useGsapProxy } from "./gsapUtils";
import { CRASH, CRASH_T0, VISION } from "./scene01-data";

const { fontFamily } = loadFont("normal", { subsets: ["latin"], weights: ["400", "700", "800"] });
const BLUE = "#0040FF";

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
   TradingView-lite chrome. Phrase A rides on a 2×2 watchlist
   of four real Vision categories (twitch / steam / lichess /
   nyc-mta). Phrase B rides on a full-bleed TRUMPUSDT
   candlestick chart. Both pulled from VPS 1 Postgres,
   continuous over a 7-day window.
   ═══════════════════════════════════════════════════════ */

const SCENE01_A = ["Trade", "market", "like", "this"] as const;
const SCENE01_B = ["Is", "simpler", "than", "trading", "market", "like", "this"] as const;

// Four distinct Vision categories — most popular asset in each.
const VISION_QUADS = [
  {
    key: "twitch_justchat",
    label: "TWITCH:JUST_CHATTING",
    category: "Streaming",
    color: "#b19cd9",
    fmt: (v: number) => `${(v / 1000).toFixed(0)}K`,
  },
  {
    key: "steam_cs2",
    label: "STEAM:CS2",
    category: "Gaming",
    color: "#6aa9ff",
    fmt: (v: number) => `${(v / 1000).toFixed(0)}K`,
  },
  {
    key: "lichess_players",
    label: "LICHESS:TOURNAMENTS",
    category: "Chess",
    color: "#f7a35c",
    fmt: (v: number) => `${v.toFixed(0)}`,
  },
  {
    key: "mta_nyc",
    label: "MTA:NYC_TRIPS",
    category: "Transit",
    color: "#74e0a3",
    fmt: (v: number) => `${v.toFixed(0)}`,
  },
] as const;

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

// One quadrant of the 2×2 vision watchlist.
const TVMiniPanel: React.FC<{
  width: number;
  height: number;
  label: string;
  category: string;
  color: string;
  pts: readonly (readonly [number, number])[];
  fmt: (v: number) => string;
  draw: number;
}> = ({ width, height, label, category, color, pts, fmt, draw }) => {
  const headerH = 56;
  const padR = 76;
  const padT = headerH + 8;
  const padB = 28;
  const innerW = width - padR;
  const innerH = height - padT - padB;
  const ys = pts.map((p) => p[1]);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const yPad = (yMax - yMin) * 0.1 || 1;
  const yLo = yMin - yPad;
  const yHi = yMax + yPad;
  const tMin = pts[0]![0];
  const tMax = pts[pts.length - 1]![0];

  const xy = (t: number, y: number): readonly [number, number] => {
    const X = ((t - tMin) / (tMax - tMin)) * innerW;
    const Y = padT + (1 - (y - yLo) / (yHi - yLo)) * innerH;
    return [X, Y];
  };

  const linePath = pts
    .map(([t, y], i) => {
      const [X, Y] = xy(t, y);
      return `${i === 0 ? "M" : "L"}${X.toFixed(2)} ${Y.toFixed(2)}`;
    })
    .join(" ");

  const [x0] = xy(pts[0]![0], pts[0]![1]);
  const [xN] = xy(pts[pts.length - 1]![0], pts[pts.length - 1]![1]);
  const yBottom = padT + innerH;
  const areaPath = `${linePath} L${xN.toFixed(2)} ${yBottom.toFixed(2)} L${x0.toFixed(2)} ${yBottom.toFixed(2)} Z`;

  const drawClamped = Math.max(0, Math.min(1, draw));
  const startV = pts[0]![1];
  const endV = pts[pts.length - 1]![1];
  const pct = ((endV - startV) / startV) * 100;
  const pctColor = pct >= 0 ? TV_GREEN : TV_RED;

  const xLabels = [0, 0.5, 1].map((f) => ({ pos: f, label: `${Math.round((1 - f) * 7)}d` }));
  const fillId = `mini-${label.replace(/[^a-z0-9]/gi, "")}`;

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
          padding: "10px 16px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          zIndex: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              padding: "3px 8px",
              fontSize: 11,
              fontFamily: MONO,
              fontWeight: 700,
              letterSpacing: "0.06em",
              background: `${color}22`,
              color,
              borderRadius: 4,
            }}
          >
            {category.toUpperCase()}
          </span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "0.02em",
            }}
          >
            {label}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: "#fff" }}>
            {fmt(endV)}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: pctColor }}>
            {pct >= 0 ? "+" : ""}
            {pct.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* axes + watermark */}
      <TVAxes
        width={width}
        height={height}
        padT={padT}
        yLo={yLo}
        yHi={yHi}
        yFmt={fmt}
        xLabels={xLabels}
        yAxisWidth={padR}
      />

      {/* line + area */}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${fillId})`} opacity={Math.min(1, drawClamped * 1.4)} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - drawClamped}
          style={{ filter: `drop-shadow(0 0 8px ${color}55)` }}
        />
      </svg>
    </div>
  );
};

// Full-bleed candlestick chart (TRUMPUSDT crash).
const TVCandleChart: React.FC<{
  width: number;
  height: number;
  candles: readonly (readonly [number, number, number, number, number])[];
  draw: number;
  t0: number;
}> = ({ width, height, candles, draw, t0 }) => {
  const padR = 110;
  const padT = 80;
  const padB = 40;
  const innerW = width - padR;
  const innerH = height - padT - padB;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const [, , h, l] of candles) {
    if (l < yMin) yMin = l;
    if (h > yMax) yMax = h;
  }
  const yPad = (yMax - yMin) * 0.08;
  const yLo = yMin - yPad;
  const yHi = yMax + yPad;
  const tMin = candles[0]![0];
  const tMax = candles[candles.length - 1]![0];
  const xCenter = (t: number) => ((t - tMin) / (tMax - tMin)) * innerW;
  const yPx = (v: number) => padT + (1 - (v - yLo) / (yHi - yLo)) * innerH;

  const drawClamped = Math.max(0, Math.min(1, draw));
  const visible = Math.max(1, Math.floor(candles.length * drawClamped));
  const cw = (innerW / candles.length) * 0.66;

  const xLabels = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const ts = t0 + tMin + f * (tMax - tMin);
    const d = new Date(ts * 1000);
    return { pos: f, label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
  });

  const lastVis = candles[Math.min(visible - 1, candles.length - 1)]!;
  const lastClose = lastVis[4];
  const lastY = yPx(lastClose);

  return (
    <div style={{ position: "relative", width, height }}>
      <TVAxes
        width={width}
        height={height}
        padT={padT}
        yLo={yLo}
        yHi={yHi}
        yFmt={(v) => `$${v.toFixed(3)}`}
        xLabels={xLabels}
        watermark="TRUMP/USDT · 2H"
        yAxisWidth={padR}
      />
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
              <line x1={xc} y1={wickTop} x2={xc} y2={wickBot} stroke={color} strokeWidth={1.2} />
              <rect x={xc - cw / 2} y={bodyTop} width={cw} height={bodyH} fill={color} />
            </g>
          );
        })}
        {/* live price pin */}
        <line
          x1={0}
          y1={lastY}
          x2={innerW}
          y2={lastY}
          stroke={TV_RED}
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.6}
        />
        <rect x={innerW + 4} y={lastY - 12} width={padR - 8} height={24} fill={TV_RED} rx={3} />
        <text
          x={innerW + padR / 2}
          y={lastY + 5}
          fill="#fff"
          fontSize={13}
          fontWeight={700}
          textAnchor="middle"
          fontFamily={MONO}
        >
          {`$${lastClose.toFixed(3)}`}
        </text>
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

export const Scene01_Intro: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      SCENE01_A.forEach((_, i) => {
        if (i === 0) return;
        tl.to(p[`a_${i}`]!, { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" }, i * 0.15);
      });
      tl.to(p.tilesDraw, { v: 1, duration: 0.7, ease: "power2.out" }, 0.05);
      tl.to(p.phraseA, { opacity: 0, duration: 0.18, ease: "power2.in" }, 0.75);
      tl.to(p.phraseB, { opacity: 1, duration: 0.15, ease: "power2.out" }, 0.85);
      tl.to(p.crashDraw, { v: 1, duration: 0.95, ease: "power2.out" }, 0.85);
      SCENE01_B.forEach((_, i) => {
        tl.to(p[`b_${i}`]!, { opacity: 1, y: 0, duration: 0.14, ease: "power2.out" }, 0.85 + i * 0.12);
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

  const lastC = CRASH.candles[CRASH.candles.length - 1]!;
  const startV = CRASH.candles[0]![1];
  const pctChange = ((lastC[4] - startV) / startV) * 100;

  // 2×2 watchlist geometry — under the 56px topbar.
  const TOPBAR_H = 56;
  const PANEL_W = 1920 / 2;
  const PANEL_H = (1080 - TOPBAR_H) / 2;

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
          {VISION_QUADS.map((q) => {
            const series = VISION[q.key];
            return (
              <TVMiniPanel
                key={q.key}
                width={PANEL_W}
                height={PANEL_H}
                label={q.label}
                category={q.category}
                color={q.color}
                pts={series.points}
                fmt={q.fmt}
                draw={s.tilesDraw.v}
              />
            );
          })}
        </div>
      </div>

      {/* ── Crash panel — phrase B ─────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, opacity: s.phraseB.opacity }}>
        <TVTopBar
          symbol="BITGET:TRUMPUSDT"
          meta={`${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(2)}%`}
          metaColor={pctChange < 0 ? TV_RED : TV_GREEN}
          activeTf="1H"
        />
        <div style={{ position: "absolute", top: TOPBAR_H, left: 0, right: 0, bottom: 0, background: TV_PANEL }}>
          <TVCandleChart
            width={1920}
            height={1080 - TOPBAR_H}
            candles={CRASH.candles}
            draw={s.crashDraw.v}
            t0={CRASH_T0}
          />
        </div>
      </div>

      {/* ── Scrim for text legibility ──────────────────────── */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% 50%, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0) 70%)",
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
    },
    {
      regaining: { opacity: 0, y: 12 },
      num: { value: 0, opacity: 0, scale: 0.7 },
      pct: { opacity: 0 },
      caption: { opacity: 0, y: 14 },
    },
  );

  const blueGradientText: React.CSSProperties = {
    backgroundImage: `linear-gradient(180deg, ${BLUE} 0%, #2a5cff 60%, ${BLUE} 100%)`,
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
  };

  return (
    <AbsoluteFill>
      <LightGradient />
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
      // "But" visible at 0
      tl.to(p.but, { opacity: 0, duration: 0.08, ease: "power2.in" }, 0.35);
      // "what" enters
      tl.to(p.what, { opacity: 1, y: 0, duration: 0.1, ease: "power2.out" }, 0.35);
      tl.to(p.what, { opacity: 0, duration: 0.08, ease: "power2.in" }, 0.7);
      // "are"
      tl.to(p.are, { opacity: 1, y: 0, duration: 0.1, ease: "power2.out" }, 0.7);
      tl.to(p.are, { opacity: 0, duration: 0.08, ease: "power2.in" }, 1.0);
      // "rainbows?" — held longer, with rainbow gradient
      tl.to(p.rainbows, { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, 1.0);
      // Phase 1 cross-fades out at 1.6s
      tl.to(p.phase1, { opacity: 0, duration: 0.18, ease: "power2.in" }, 1.6);
      // Phase 2 — title slides in from right at 1.7s
      tl.to(p.phase2, { opacity: 1, duration: 0.15, ease: "power2.out" }, 1.7);
      tl.to(p.title, { x: 0, duration: 0.45, ease: "power2.out" }, 1.7);
    },
    {
      phase1: { opacity: 1 },
      but: { opacity: 1, y: 0 },
      what: { opacity: 0, y: 15 },
      are: { opacity: 0, y: 15 },
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
        {s.what.opacity > 0.01 && (
          <span style={{ ...baseText, fontStyle: "normal", ...flashStyle, transform: `translate(-50%, calc(-50% + ${s.what.y}px))`, opacity: s.what.opacity }}>
            what
          </span>
        )}
        {s.are.opacity > 0.01 && (
          <span style={{ ...baseText, fontStyle: "normal", ...flashStyle, transform: `translate(-50%, calc(-50% + ${s.are.y}px))`, opacity: s.are.opacity }}>
            are
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
            rainbows?
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
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 04 — CubeExplode  (72 frames = 3s @ 24fps)
   "Rainbows filters out illegal activities."
   White square → isometric cube → 10-shard explosion.
   ═══════════════════════════════════════════════════════ */

const CUBE_SIZE = 500;
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

type Scene04Proxies = {
  cube: { opacity: number; rotX: number; rotY: number };
  cubeFade: { opacity: number };
  [key: `w_${number}`]: { opacity: number; y: number };
  [key: `shard${number}`]: { x: number; y: number; rotation: number; opacity: number };
};

function buildScene04Proxies(): Scene04Proxies {
  const base: Record<string, Record<string, number>> = {
    cube: { opacity: 0, rotX: 0, rotY: 0 },
    cubeFade: { opacity: 1 },
  };
  SCENE04_WORDS.forEach((_, i) => { base[`w_${i}`] = { opacity: 0, y: 15 }; });
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

      // White square appears at 0.3s
      tl.to(p.cube, { opacity: 1, duration: 0.15, ease: "power2.out" }, 0.3);
      // Morph to isometric cube from 0.85s–1.25s
      tl.to(p.cube, { rotX: -30, rotY: 45, duration: 0.4, ease: "power2.out" }, 0.85);
      // Big cube fades out as explosion starts
      tl.to(p.cubeFade, { opacity: 0, duration: 0.15, ease: "power2.in" }, 1.45);

      // Explosion at 1.5s — each shard flies out
      for (let i = 0; i < 10; i++) {
        const target = EXPLOSION_TARGETS[i];
        const shard = p[`shard${i}` as keyof Scene04Proxies] as { x: number; y: number; rotation: number; opacity: number };
        const offset = 1.5 + i * 0.02;
        tl.to(shard, { opacity: 1, duration: 0.08 }, offset);
        tl.to(shard, { x: target.x, y: target.y, rotation: target.rot, duration: 1.0, ease: "power2.out" }, offset);
        tl.to(shard, { opacity: 0, duration: 0.3, ease: "power2.in" }, offset + 0.8);
      }
    },
    buildScene04Proxies(),
  );

  const showBigCube = s.cube.opacity > 0.01 && s.cubeFade.opacity > 0.01;

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

      {/* Big cube — morphs from flat square to isometric */}
      {showBigCube && (
        <div
          style={{
            position: "absolute",
            top: "55%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            perspective: 800,
            opacity: s.cube.opacity * s.cubeFade.opacity,
          }}
        >
          <div
            style={{
              width: CUBE_SIZE,
              height: CUBE_SIZE,
              position: "relative",
              transformStyle: "preserve-3d",
              transform: `rotateX(${s.cube.rotX}deg) rotateY(${s.cube.rotY}deg)`,
            }}
          >
            <CubeFace size={CUBE_SIZE} transform={`translateZ(${CUBE_SIZE / 2}px)`} shade="rgba(255,255,255,0.95)" />
            <CubeFace size={CUBE_SIZE} transform={`rotateX(90deg) translateZ(${CUBE_SIZE / 2}px)`} shade="rgba(255,255,255,0.8)" />
            <CubeFace size={CUBE_SIZE} transform={`rotateY(90deg) translateZ(${CUBE_SIZE / 2}px)`} shade="rgba(230,230,240,0.85)" />
          </div>
        </div>
      )}

      {/* Explosion — 10 small cubes */}
      <div
        style={{
          position: "absolute",
          top: "55%",
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
