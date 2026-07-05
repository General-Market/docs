import React, { useEffect, useRef } from "react";
import { continueRender, delayRender } from "remotion";
import {
  createChart,
  CandlestickSeries,
  ColorType,
  LineStyle,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  UTCTimestamp,
} from "lightweight-charts";
import { CURSOR, CANDLE_PITCH } from "./chart-data";
import { CHART_COLORS as C } from "./copy/chart";
import {
  activeDataset,
  barStateAt,
  rangeAt,
  frameOfBarUnits,
  linePriceAt,
  fmtCompact,
  niceStep,
  timeTickSeconds,
  startClockSec,
  fmtClock,
  TradeMarker,
} from "./chart-input";

// ═══════════════════════════════════════════════════════════════════
// LIVE CHART (r5, owner reframe) — a real lightweight-charts session
// driven purely by the chart-input.ts dataset. The grammar is a live
// TradingView feed, not a pixel replay:
//   · the rightmost candle FORMS tick-by-tick (deterministic seeded
//     path through its true O/H/L/C — chart-input.tickPathOf),
//   · the time scale autoscrolls smoothly (live edge pinned at
//     liveEdgeX, history sliding left at bar pace),
//   · the price scale autoscales per frame over the printed data —
//     the reference's "era rescales" emerge from the data,
//   · engine-native dotted last-price line + a ticking right-scale
//     price chip, High/Low session chips, strategy price lines and
//     trade-marker bubbles all derive from the dataset.
// Determinism: every value is a pure function of the frame; the
// engine is gated per frame with delayRender until painted (r4
// twin-render byte-identical rig, kept intact).
// ═══════════════════════════════════════════════════════════════════

// The chart interior, drawn in FULL-FRAME 1920×1080 coordinates.
const CHART_FREEZE = 1656; // detection ends where the outro blur starts
const VIEW_L = 57;
const VIEW_R = 1556;
const PLOT_TOP = 196;
const PLOT_BOT = 918;
const PANE_W = VIEW_R - VIEW_L; // 1499
const PANE_H = PLOT_BOT - PLOT_TOP; // 722

// [f,x,y,kind] quads, step-hold (measured mouse cursor)
const stepQuad = (k: number[], f: number): [number, number, number] | null => {
  if (k.length === 0 || f < k[0]) return null;
  let out: [number, number, number] = [k[1], k[2], k[3]];
  for (let i = 0; i < k.length; i += 4) {
    if (k[i] <= f) out = [k[i + 1], k[i + 2], k[i + 3]];
    else break;
  }
  return out;
};

// ── REAL chart engine: lightweight-charts 5.x ───────────────────────
// A pure deterministic rasterizer pinned per frame:
//   x: setVisibleLogicalRange — barSpacing = W/(to-from+1); bar center
//      x(i) = W-1-(to+0.5)·bs+i·bs (time-scale indexToCoordinate),
//      solved so bar i lands at anchor + i·pitch.
//   y: autoscaleInfoProvider pins priceRange to the frame's autoscale
//      range with zero margins — min→pane(h-1), max→0, so price→pixel
//      is the same linear map the DOM overlays use.
// Native affordance kept ON: the series price line (dotted, colored by
// the forming candle's direction) — the live last-price tick.
type EngineRefs = { chart: IChartApi; series: ISeriesApi<"Candlestick"> };

const EngineCandles: React.FC<{
  f: number;
  bars: { open: number; high: number; low: number; close: number; green: boolean }[];
  rangeMin: number;
  rangeMax: number;
  anchor: number;
  pitch: number;
}> = ({ f, bars, rangeMin, rangeMax, anchor, pitch }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<EngineRefs | null>(null);
  const rangeRef = useRef<{ min: number; max: number }>({ min: 0, max: 1 });
  const handleRef = useRef<number | null>(null);
  const gatedRef = useRef<number | null>(null);

  // Remotion capture gate: a fresh delayRender per frame value, released
  // after the engine has painted (double rAF past its own scheduled draw).
  if (gatedRef.current !== f) {
    gatedRef.current = f;
    if (handleRef.current !== null) continueRender(handleRef.current);
    handleRef.current = delayRender(`lwc paint f=${f}`);
  }

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!engineRef.current) {
      const chart = createChart(host, {
        width: PANE_W,
        height: PANE_H,
        autoSize: false,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          attributionLogo: false,
        },
        grid: { vertLines: { visible: false }, horzLines: { visible: false } },
        rightPriceScale: { visible: false },
        leftPriceScale: { visible: false },
        timeScale: { visible: false, minBarSpacing: 0.1 },
        crosshair: {
          vertLine: { visible: false, labelVisible: false },
          horzLine: { visible: false, labelVisible: false },
        },
        handleScroll: false,
        handleScale: false,
        kineticScroll: { touch: false, mouse: false },
      });
      const series = chart.addSeries(CandlestickSeries, {
        upColor: C.candleGreen,
        downColor: C.candleRed,
        wickUpColor: C.candleGreen,
        wickDownColor: C.candleRed,
        borderVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
        autoscaleInfoProvider: () => ({
          priceRange: { minValue: rangeRef.current.min, maxValue: rangeRef.current.max },
        }),
      });
      series.priceScale().applyOptions({ scaleMargins: { top: 0, bottom: 0 }, autoScale: true });
      engineRef.current = { chart, series };
    }
    const { chart, series } = engineRef.current;

    // pin y: engine maps maxValue→pane y 0, minValue→pane y (PANE_H-1)
    rangeRef.current = { min: rangeMin, max: rangeMax };

    const data: CandlestickData<UTCTimestamp>[] = bars.map((b, i) => {
      const col = b.green ? C.candleGreen : C.candleRed;
      return {
        time: i as UTCTimestamp,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        color: col,
        wickColor: col,
      };
    });
    series.setData(data);

    // native last-price line, colored by the forming candle's direction
    const last = bars[bars.length - 1];
    series.applyOptions(
      last
        ? {
            priceLineVisible: true,
            priceLineStyle: LineStyle.Dotted,
            priceLineWidth: 1,
            priceLineColor: last.green ? C.curChipGreen : C.curChipRed,
          }
        : { priceLineVisible: false },
    );

    // pin x: bar i center at anchor + i·pitch (pane-relative: -VIEW_L)
    if (data.length > 0) {
      const to = (PANE_W - 1 - (anchor - VIEW_L)) / pitch - 0.5;
      const from = to + 1 - PANE_W / pitch;
      chart.timeScale().setVisibleLogicalRange({ from, to });
    }

    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        if (handleRef.current !== null) {
          continueRender(handleRef.current);
          handleRef.current = null;
        }
      });
    });
    return () => {
      cancelAnimationFrame(r1);
      if (r2) cancelAnimationFrame(r2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, bars, rangeMin, rangeMax, anchor, pitch]);

  useEffect(
    () => () => {
      if (engineRef.current) {
        engineRef.current.chart.remove();
        engineRef.current = null;
      }
      if (handleRef.current !== null) {
        continueRender(handleRef.current);
        handleRef.current = null;
      }
    },
    [],
  );

  return (
    <div
      ref={hostRef}
      style={{
        position: "absolute",
        left: VIEW_L,
        top: PLOT_TOP,
        width: PANE_W,
        height: PANE_H,
        overflow: "hidden",
      }}
    />
  );
};

// glyphs drawn as bold letters (vs emoji)
const isLetterGlyph = (g: string) => /^[A-Z]{1,2}$/.test(g);

const MARKER_FILL: Record<string, string> = {
  g: C.bubbleGreenFill,
  r: C.bubbleRedFill,
  y: C.bubbleYellowFill,
  p: C.bubblePurpleFill,
  w: C.bubbleWhiteFill,
};

const MarkerBubble: React.FC<{ m: TradeMarker; f: number; appearF: number; x: number; y: number }> = ({
  m,
  f,
  appearF,
  x,
  y,
}) => {
  const r = m.r ?? 11;
  const pop = Math.min((f - appearF) / 5, 1);
  const fade = m.ttl !== undefined ? Math.max(0, Math.min((appearF + m.ttl - f) / 4, 1)) : 1;
  if (pop <= 0 || fade <= 0) return null;
  if (y < PLOT_TOP - r || y > PLOT_BOT + r || x < VIEW_L - r || x > VIEW_R + r) return null;
  const scale = 0.5 + 0.5 * (1 - (1 - pop) ** 3);
  const color = m.color ?? (m.side === "sell" ? "r" : "g");
  const glyph = m.emoji ?? (m.side === "sell" ? "S" : "B");
  const letter = isLetterGlyph(glyph);
  return (
    <div
      style={{
        position: "absolute",
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: "50%",
        background: MARKER_FILL[color] ?? C.bubbleWhiteFill,
        border: `1.5px solid rgba(10,14,20,0.55)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: letter ? (glyph.length > 1 ? r * 0.85 : r * 1.1) : r * 1.35,
        fontWeight: 800,
        color: color === "p" ? C.bubblePurpleInk : "#fff",
        lineHeight: 1,
        opacity: pop * fade,
        transform: `scale(${scale.toFixed(3)})`,
      }}
    >
      {glyph}
    </div>
  );
};

// hand cursor glyphs
const GrabHand: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <svg width={18} height={16} viewBox="0 0 18 16" style={{ position: "absolute", left: x - 9, top: y - 7, zIndex: 12 }}>
    <path
      d="M4.5 7.5 4 4.6c-.1-.9 1.3-1.1 1.5-.2l.4 2.2.5-3.6c.1-.9 1.5-.8 1.5.1l.1 3.2.7-3.4c.2-.9 1.5-.7 1.5.2l-.2 3.4 1-2.6c.4-.8 1.6-.4 1.4.5l-1 3.9c-.4 1.7-1 3.4-2.7 3.4H7.4c-1.2 0-1.9-.7-2.4-1.8Z"
      fill="#f5f8ff"
      stroke="#2a2f3a"
      strokeWidth="0.7"
    />
  </svg>
);

const PointerHand: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <svg width={20} height={24} viewBox="0 0 20 24" style={{ position: "absolute", left: x - 10, top: y - 12, zIndex: 12 }}>
    <path
      d="M8 2.5c0-1.4 2-1.4 2 0v7l.3-2c.2-1.2 1.9-1 1.9.2v2.4l.6-1.6c.4-1 1.9-.6 1.7.5l-.5 2.5.8-1c.7-.8 1.9 0 1.4 1l-2 4.3c-.8 1.8-1.8 3.2-3.9 3.2H9.2c-1.6 0-2.6-1-3.3-2.4L3.6 12c-.5-1 .8-1.9 1.5-1l1.4 1.8V2.5Z"
      fill="#5fc0ea"
      stroke="#eaf6ff"
      strokeWidth="0.8"
    />
  </svg>
);

export const ChartArea: React.FC<{ frame: number }> = ({ frame }) => {
  const f = Math.min(frame, CHART_FREEZE);
  if (frame < 418) return null;

  const ds = activeDataset();
  const pitch = ds.barSpacingPx ?? CANDLE_PITCH;
  const liveEdgeX = ds.liveEdgeX ?? 840;
  const st = barStateAt(ds, f);
  const rng = rangeAt(ds, f);

  // price → y: the same linear map the engine is pinned to
  const yOf = (p: number) => PLOT_TOP + ((rng.max - p) / (rng.max - rng.min)) * (PANE_H - 1);

  // smooth autoscroll: the live edge stays pinned, history slides left.
  // Before the session loads, history holds its place (no jump at load).
  const pre = ds.preloadedBars ?? 0;
  const anchor = liveEdgeX - Math.max(st.barsFormed, pre) * pitch;
  const xOfBar = (i: number) => anchor + i * pitch;

  // ── price gridlines: nice steps over the live autoscale range ──
  const step = niceStep(rng.max - rng.min);
  const rows: { text: string; y: number }[] = [];
  for (let k = Math.ceil(rng.min / step); k * step <= rng.max; k++) {
    const y = yOf(k * step);
    if (y < PLOT_TOP - 2 || y > PLOT_BOT + 6) continue;
    rows.push({ text: fmtCompact(k * step), y });
  }

  // ── time axis: market-clock ticks projected across the pane ──
  const spb = ds.secondsPerBar ?? 1;
  const t0 = startClockSec(ds);
  const tick = timeTickSeconds(ds);
  const timeCols: { text: string; x: number }[] = [];
  const tLo = t0 + ((VIEW_L + 32 - anchor) / pitch) * spb;
  const tHi = t0 + ((VIEW_R - 32 - anchor) / pitch) * spb;
  for (let k = Math.ceil(tLo / tick); k * tick <= tHi; k++) {
    const t = k * tick;
    timeCols.push({ text: fmtClock(t), x: anchor + ((t - t0) / spb) * pitch });
  }

  const dash = (color: string, y: number, dashW = 7, gap = 6, h = 3, key?: string) => (
    <div
      key={key}
      style={{
        position: "absolute",
        left: VIEW_L - 1,
        width: VIEW_R - VIEW_L,
        top: y - h / 2,
        height: h,
        backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 ${dashW}px, transparent ${dashW}px ${dashW + gap}px)`,
      }}
    />
  );

  const chip = (text: string, y: number, bg: string, color: string = C.chipText, key?: string) => (
    <div
      key={key}
      style={{
        position: "absolute",
        left: 1564,
        top: y - 10,
        padding: "2px 6px",
        borderRadius: 3,
        background: bg,
        color,
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );

  // session state for the chips + last-price tick
  const lastBar = st.bars.length > 0 ? st.bars[st.bars.length - 1] : null;
  const clampChipY = (y: number) => Math.min(Math.max(y, PLOT_TOP + 12), PLOT_BOT - 12);
  const highChipY = clampChipY(yOf(st.sessionHigh));
  const lowChipY = clampChipY(yOf(st.sessionLow));
  const cursor = stepQuad(CURSOR, f);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* grid */}
      {rows.map((r, i) => (
        <div
          key={`h${i}`}
          style={{ position: "absolute", left: VIEW_L - 1, width: 1500, top: r.y, height: 1, background: C.gridLine }}
        />
      ))}
      {timeCols.map((t, i) => (
        <div
          key={`v${i}`}
          style={{ position: "absolute", left: t.x, top: PLOT_TOP - 1, height: PLOT_BOT - PLOT_TOP + 5, width: 1, background: C.gridLine }}
        />
      ))}
      {/* price scale labels */}
      {rows.map((r, i) => (
        <div
          key={`l${i}`}
          style={{
            position: "absolute",
            left: 1570,
            top: r.y - 8,
            fontSize: 13,
            color: C.scaleText,
            fontWeight: 500,
          }}
        >
          {r.text}
        </div>
      ))}
      {/* time axis labels */}
      {timeCols.map((t, i) => (
        <div
          key={`t${i}`}
          style={{
            position: "absolute",
            left: t.x - 30,
            top: 926,
            width: 60,
            textAlign: "center",
            fontSize: 12,
            color: C.scaleText,
          }}
        >
          {t.text}
        </div>
      ))}
      {/* dashed strategy lines + right-edge labels + badges */}
      {(ds.lines ?? []).map((spec, i) => {
        const p = linePriceAt(spec, st.barsFormed);
        if (p === null) return null;
        const y = yOf(p);
        if (y < PLOT_TOP || y > PLOT_BOT) return null;
        return (
          <React.Fragment key={`line${i}`}>
            {dash(spec.color, y, spec.dashW ?? 7, spec.gap ?? 6)}
            <div
              style={{
                position: "absolute",
                right: 1920 - 1592,
                top: y - 18,
                fontSize: 12,
                color: spec.labelColor ?? spec.color,
              }}
            >
              {spec.label}
            </div>
            {chip(fmtCompact(p), y, spec.badgeBg, spec.badgeText ?? C.chipText)}
          </React.Fragment>
        );
      })}
      {/* candles: REAL lightweight-charts session, forming bar live */}
      <EngineCandles
        f={f}
        bars={st.bars}
        rangeMin={rng.min}
        rangeMax={rng.max}
        anchor={anchor}
        pitch={pitch}
      />
      {/* trade-marker bubbles */}
      {(ds.markers ?? []).map((m, i) => {
        const appearF = frameOfBarUnits(ds, m.at);
        if (f < appearF) return null;
        const barIdx = Math.min(Math.floor(m.at), ds.bars.length - 1);
        const price = m.price ?? ds.bars[barIdx].close;
        return (
          <MarkerBubble
            key={`m${i}`}
            m={m}
            f={f}
            appearF={appearF}
            x={xOfBar(m.slotX ?? m.at)}
            y={yOf(price)}
          />
        );
      })}
      {/* session High/Low chips + ticking last-price chip (hidden until a
          dataset has printed data or carries pre-history seeds) */}
      {Number.isFinite(st.sessionHigh) && chip(`High ${fmtCompact(st.sessionHigh)}`, highChipY, C.highChipBg)}
      {Number.isFinite(st.sessionLow) && chip(`Low ${fmtCompact(st.sessionLow)}`, lowChipY, C.lowChipBg)}
      {lastBar &&
        chip(
          fmtCompact(lastBar.close),
          clampChipY(yOf(lastBar.close)),
          lastBar.green ? C.curChipGreen : C.curChipRed,
        )}
      {/* cursor (above TokenPopup via zIndex; popup root has no stacking ctx) */}
      {cursor && frame <= CHART_FREEZE && (cursor[2] === 1 ? <GrabHand x={cursor[0]} y={cursor[1]} /> : <PointerHand x={cursor[0]} y={cursor[1]} />)}
    </div>
  );
};
