import React, { useEffect, useRef } from "react";
import { continueRender, delayRender } from "remotion";
import {
  createChart,
  CandlestickSeries,
  ColorType,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  UTCTimestamp,
} from "lightweight-charts";
import {
  CANDLE_PITCH,
  CANDLE_ANCHOR,
  CANDLE_ENTS,
  BUBBLE_TRACKS,
  BubbleTrack,
  CHIP_HIGH_Y,
  CHIP_LOW_Y,
  CHIP_CUR,
  CHIP_EXIT,
  CHIP_COST,
  HIGH_TEXT,
  CURSOR,
  CROSSHAIR,
  TIME_SLOT0,
} from "./chart-data";
import {
  CHART_COLORS as C,
  eraMapAt,
  fmtK,
  fmtChip,
  EXIT_LABEL,
  COST_LABEL,
  COST_BADGE,
  LOW_CHIP_TEXT,
} from "./copy/chart";

// The chart interior, drawn in FULL-FRAME 1920×1080 coordinates (all track
// data is measured in that space, r3 per-plate detection).
const CHART_FREEZE = 1656; // detection ends where the outro blur starts
const VIEW_L = 57;
const VIEW_R = 1556;
const PLOT_TOP = 196;
const PLOT_BOT = 918;

// ── track lookups ────────────────────────────────────────────────
// [f,v,...] pairs, step-hold; null before first keyframe
const stepPairs = (k: number[], f: number): number | null => {
  if (k.length === 0 || f < k[0]) return null;
  let v = k[1];
  for (let i = 0; i < k.length; i += 2) {
    if (k[i] <= f) v = k[i + 1];
    else break;
  }
  return v;
};

// [f,v,...] pairs with linear interpolation (pan anchor)
const lerpPairs = (k: number[], f: number): number => {
  if (f <= k[0]) return k[1];
  for (let i = 0; i + 3 < k.length; i += 2) {
    if (f >= k[i] && f <= k[i + 2]) {
      const t = k[i + 2] === k[i] ? 0 : (f - k[i]) / (k[i + 2] - k[i]);
      return k[i + 1] + (k[i + 3] - k[i + 1]) * t;
    }
  }
  return k[k.length - 1];
};

// [f,a,b,...] triplets, step-hold
const stepTriple = (k: number[], f: number): [number, number] | null => {
  if (k.length === 0 || f < k[0]) return null;
  let a = k[1];
  let b = k[2];
  for (let i = 0; i < k.length; i += 3) {
    if (k[i] <= f) {
      a = k[i + 1];
      b = k[i + 2];
    } else break;
  }
  return [a, b];
};

// [f,x,y,kind] quads, step-hold
const stepQuad = (k: number[], f: number): [number, number, number] | null => {
  if (k.length === 0 || f < k[0]) return null;
  let out: [number, number, number] = [k[1], k[2], k[3]];
  for (let i = 0; i < k.length; i += 4) {
    if (k[i] <= f) out = [k[i + 1], k[i + 2], k[i + 3]];
    else break;
  }
  return out;
};

// candle keyframes: [f,bt,bb,wt,wb]* step-hold; null before first
const candleGeom = (k: number[], f: number): [number, number, number, number] | null => {
  if (k.length === 0 || f < k[0]) return null;
  let g: [number, number, number, number] = [k[1], k[2], k[3], k[4]];
  for (let i = 0; i < k.length; i += 5) {
    if (k[i] <= f) g = [k[i + 1], k[i + 2], k[i + 3], k[i + 4]];
    else break;
  }
  return g;
};

const stepText = (table: [number, string][], f: number): string | null => {
  let cur: string | null = null;
  for (const [kf, t] of table) {
    if (kf <= f) cur = t;
    else break;
  }
  return cur;
};

// ── REAL chart engine (r4, owner directive): lightweight-charts 5.x ──
// The candle layer is a real TradingView OSS candlestick series. Everything
// is pinned per frame from the measured tables so the engine is a pure
// deterministic rasterizer:
//   x: setVisibleLogicalRange — barSpacing = W/(to-from+1); bar center
//      x(s) = W-1-(to+0.5)·bs+s·bs  (source: time-scale indexToCoordinate),
//      solved so slot s lands at CANDLE_ANCHOR + s·CANDLE_PITCH.
//   y: autoscaleInfoProvider pins priceRange to [yV(917), yV(196)] with zero
//      margins — the engine maps min→pane(h-1), max→0 (source:
//      barPricesToCoordinates uses internalHeight-1), so price→pixel
//      round-trips the measured era map exactly.
// Interactions, axes, grid, crosshair, attribution logo: all OFF. The plate
// TV logo stays as measured DOM in TokenChartChrome (engine logo sits at the
// pane corner, wrong place/size vs plate).
const PANE_W = VIEW_R - VIEW_L; // 1499
const PANE_H = PLOT_BOT - PLOT_TOP; // 722

type EngineRefs = { chart: IChartApi; series: ISeriesApi<"Candlestick"> };

const EngineCandles: React.FC<{ f: number; A: number; K: number; anchor: number }> = ({
  f,
  A,
  K,
  anchor,
}) => {
  const yV = (y: number) => (A - y) / K;
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
    rangeRef.current = { min: yV(PLOT_TOP + PANE_H - 1), max: yV(PLOT_TOP) };

    // candles known at this plate frame, in measured pixel space → prices
    const data: CandlestickData<UTCTimestamp>[] = [];
    for (const t of CANDLE_ENTS) {
      const g = candleGeom(t.k, f);
      if (!g) continue;
      const [bt, bb, wt, wb] = g;
      const flip = t.cc ? stepPairs(t.cc, f) : null;
      const green = flip === null ? t.c === "g" : flip === 1;
      const pTop = yV(bt);
      const pBot = yV(bb);
      const open = green ? pBot : pTop;
      const close = green ? pTop : pBot;
      const high = Math.max(yV(wt), pTop);
      const low = Math.min(yV(wb), pBot);
      const col = green ? C.candleGreen : C.candleRed;
      data.push({ time: t.s as UTCTimestamp, open, high, low, close, color: col, wickColor: col });
    }
    data.sort((a, b) => (a.time as number) - (b.time as number));
    series.setData(data);

    // pin x: slot s center at anchor + s·pitch (pane-relative: -VIEW_L)
    if (data.length > 0) {
      const to = (PANE_W - 1 - (anchor - VIEW_L)) / CANDLE_PITCH - 0.5;
      const from = to + 1 - PANE_W / CANDLE_PITCH;
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
  }, [f, A, K, anchor]);

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

const Bubble: React.FC<{ t: BubbleTrack; f: number }> = ({ t, f }) => {
  // k = [f,x,y]* keyframes, lerp between
  const k = t.k;
  if (f < k[0] || f > k[k.length - 3]) return null;
  let x = k[1];
  let y = k[2];
  for (let i = 0; i + 5 < k.length; i += 3) {
    if (f >= k[i] && f <= k[i + 3]) {
      const tt = k[i + 3] === k[i] ? 0 : (f - k[i]) / (k[i + 3] - k[i]);
      x = k[i + 1] + (k[i + 4] - k[i + 1]) * tt;
      y = k[i + 2] + (k[i + 5] - k[i + 2]) * tt;
      break;
    }
    x = k[i + 3 + 1];
    y = k[i + 3 + 2];
  }
  const born = k[0];
  const pop = Math.min((f - born) / 5, 1);
  const scale = 0.5 + 0.5 * (1 - (1 - pop) ** 3);
  const fill =
    t.c === "g"
      ? C.bubbleGreenFill
      : t.c === "r"
        ? C.bubbleRedFill
        : t.c === "y"
          ? C.bubbleYellowFill
          : t.c === "p"
            ? C.bubblePurpleFill
            : C.bubbleWhiteFill;
  const letter = isLetterGlyph(t.g);
  return (
    <div
      style={{
        position: "absolute",
        left: x - t.r,
        top: y - t.r,
        width: t.r * 2,
        height: t.r * 2,
        borderRadius: "50%",
        background: fill,
        border: `1.5px solid rgba(10,14,20,0.55)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: letter ? (t.g.length > 1 ? t.r * 0.85 : t.r * 1.1) : t.r * 1.35,
        fontWeight: 800,
        color: t.c === "p" ? C.bubblePurpleInk : "#fff",
        lineHeight: 1,
        opacity: pop,
        transform: `scale(${scale.toFixed(3)})`,
      }}
    >
      {t.g}
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

  // Era mapping, blended across the plate-measured rescale windows so the
  // label grid SLIDES at era boundaries instead of cutting (plates never cut).
  const { era, A, K } = eraMapAt(f);
  const pY = (v: number) => A - K * v;
  const yV = (y: number) => (A - y) / K;
  const nLabels = Math.round((era.top - era.bottom) / era.step);
  const rows: { text: string; y: number }[] = [];
  for (let i = 0; i <= nLabels; i++) {
    const y = pY(era.top - i * era.step);
    if (y < PLOT_TOP - 2 || y > PLOT_BOT + 6) continue; // pane clips sliding rows
    rows.push({ text: fmtK(era.top - i * era.step), y });
  }

  const anchor = lerpPairs(CANDLE_ANCHOR, f);
  const slotX = (s: number) => anchor + s * CANDLE_PITCH;

  const exitY = stepPairs(CHIP_EXIT, f);
  const costY = stepPairs(CHIP_COST, f);
  const curChip = stepTriple(CHIP_CUR, f);
  const highY = stepPairs(CHIP_HIGH_Y, f) ?? 258;
  const lowY = stepPairs(CHIP_LOW_Y, f) ?? 872;
  const highText = stepText(HIGH_TEXT, f) ?? "High";
  const cursor = stepQuad(CURSOR, f);
  const cross = f <= CHART_FREEZE ? stepTriple(CROSSHAIR, f) : null;
  const crossOn = cursor && cursor[2] === 1 && cross !== null;

  const dash = (color: string, y: number, dashW = 7, gap = 6, h = 3) => (
    <div
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

  // time-axis: minute marks every 60 slots from TIME_SLOT0 ("15:03"), with
  // :14/:28/:42 sub-labels between (TV drops :56 in favor of the minute mark).
  const timeCols: { text: string; x: number }[] = [];
  for (let m = 0; m < 4; m++) {
    for (const [off, suffix] of [
      [0, ""],
      [14, ":14"],
      [28, ":28"],
      [42, ":42"],
    ] as const) {
      const x = slotX(TIME_SLOT0 + m * 60 + off);
      if (x > VIEW_L - 40 && x < VIEW_R + 40) timeCols.push({ text: `15:0${3 + m}${suffix}`, x });
    }
  }

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
      {/* dashed strategy lines + labels (plate dashes ~14px/10px) */}
      {exitY !== null && (
        <>
          {dash(C.exitLine, exitY, 14, 10)}
          <div
            style={{
              position: "absolute",
              right: 1920 - 1592,
              top: exitY - 18,
              fontSize: 12,
              color: "#c9535e",
            }}
          >
            {EXIT_LABEL}
          </div>
          {chip(fmtChip(yV(exitY)), exitY, C.exitBadgeBg)}
        </>
      )}
      {costY !== null && (
        <>
          {dash(C.costLine, costY, 9, 7)}
          <div
            style={{
              position: "absolute",
              right: 1920 - 1592,
              top: costY - 18,
              fontSize: 12,
              color: "#dfe4ee",
            }}
          >
            {COST_LABEL}
          </div>
          {chip(COST_BADGE, costY, C.costBadgeBg, C.costBadgeText)}
        </>
      )}
      {/* candles: REAL lightweight-charts candlestick series (r4) */}
      <EngineCandles f={f} A={A} K={K} anchor={anchor} />
      {/* current-price dotted line */}
      {curChip && (
        <div
          style={{
            position: "absolute",
            left: VIEW_L - 1,
            width: VIEW_R - VIEW_L,
            top: curChip[0] - 1,
            height: 1,
            opacity: 0.65,
            backgroundImage: `repeating-linear-gradient(90deg, ${curChip[1] ? C.curChipGreen : C.curChipRed} 0 2px, transparent 2px 5px)`,
          }}
        />
      )}
      {/* bubbles */}
      {BUBBLE_TRACKS.map((t: BubbleTrack, i: number) => (
        <Bubble key={`b${i}`} t={t} f={f} />
      ))}
      {/* crosshair (only during grab-cursor spans) */}
      {crossOn && cross && (
        <>
          <div
            style={{
              position: "absolute",
              left: cross[0],
              top: PLOT_TOP,
              width: 1,
              height: PLOT_BOT - PLOT_TOP,
              backgroundImage: `repeating-linear-gradient(180deg, ${C.crossDash} 0 5px, transparent 5px 9px)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: VIEW_L - 1,
              width: VIEW_R - VIEW_L,
              top: cross[1],
              height: 1,
              backgroundImage: `repeating-linear-gradient(90deg, ${C.crossDash} 0 5px, transparent 5px 9px)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 1564,
              top: cross[1] - 8,
              fontSize: 13,
              fontWeight: 700,
              color: C.crossLabel,
            }}
          >
            {fmtChip(yV(cross[1]))}
          </div>
        </>
      )}
      {/* chips */}
      {chip(highText, highY, C.highChipBg)}
      {chip(LOW_CHIP_TEXT, lowY, C.lowChipBg)}
      {curChip && chip(fmtChip(yV(curChip[0])), curChip[0], curChip[1] ? C.curChipGreen : C.curChipRed)}
      {/* cursor (above TokenPopup via zIndex; popup root has no stacking ctx) */}
      {cursor && frame <= CHART_FREEZE && (cursor[2] === 1 ? <GrabHand x={cursor[0]} y={cursor[1]} /> : <PointerHand x={cursor[0]} y={cursor[1]} />)}
    </div>
  );
};
