import React from "react";
import {
  BUBBLE_TRACKS,
  CANDLE_TRACKS,
  COST_BASIS_Y,
  BubbleTrack,
  CandleTrack,
} from "./chart-data";
import {
  CHART_COLORS as C,
  SCALE_ERAS,
  EXIT_Y,
  HIGH_CHIP,
  LOW_CHIP,
  EXIT_LABEL,
  EXIT_BADGE,
  COST_LABEL,
  COST_BADGE,
  CURRENT_CHIP,
  TIME_AXIS,
  BUBBLE_GLYPHS,
  fmtK,
} from "./copy/chart";

// The chart interior, drawn in FULL-FRAME 1920×1080 coordinates (all track
// data is measured in that space). The parent places it inside the chart
// viewport and passes the viewport origin so we can counter-offset.
const CHART_FREEZE = 1656; // detection ends where the outro blur starts

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// piecewise-linear lookup over keyframe triples [f,x,y,...]
const trackAt = (k: number[], f: number): [number, number] | null => {
  const n = k.length / 3;
  if (f < k[0] || f > k[(n - 1) * 3]) return null;
  for (let i = 0; i < n - 1; i++) {
    const f0 = k[i * 3];
    const f1 = k[(i + 1) * 3];
    if (f >= f0 && f <= f1) {
      const t = f1 === f0 ? 0 : (f - f0) / (f1 - f0);
      return [
        k[i * 3 + 1] + (k[(i + 1) * 3 + 1] - k[i * 3 + 1]) * t,
        k[i * 3 + 2] + (k[(i + 1) * 3 + 2] - k[i * 3 + 2]) * t,
      ];
    }
  }
  return null;
};

const ctrackAt = (k: number[], f: number): [number, number, number] | null => {
  const n = k.length / 4;
  if (f < k[0] || f > k[(n - 1) * 4]) return null;
  for (let i = 0; i < n - 1; i++) {
    const f0 = k[i * 4];
    const f1 = k[(i + 1) * 4];
    if (f >= f0 && f <= f1) {
      const t = f1 === f0 ? 0 : (f - f0) / (f1 - f0);
      const lerp = (a: number, b: number) => a + (b - a) * t;
      return [
        lerp(k[i * 4 + 1], k[(i + 1) * 4 + 1]),
        lerp(k[i * 4 + 2], k[(i + 1) * 4 + 2]),
        lerp(k[i * 4 + 3], k[(i + 1) * 4 + 3]),
      ];
    }
  }
  return null;
};

const stepAt = <T extends { f: number }>(table: T[], f: number): T => {
  let cur = table[0];
  for (const row of table) {
    if (row.f <= f) cur = row;
    else break;
  }
  return cur;
};

const sampleY = (table: number[][], f: number): number | null => {
  let cur: number | null = null;
  for (const [sf, y] of table) {
    if (sf <= f) cur = y;
    else break;
  }
  return cur;
};

const Bubble: React.FC<{ t: BubbleTrack; i: number; f: number }> = ({ t, i, f }) => {
  const p = trackAt(t.k, f);
  if (!p) return null;
  const born = t.k[0];
  const pop = clamp((f - born) / 6, 0, 1);
  const scale = 0.4 + 0.6 * (1 - (1 - pop) ** 3);
  const glyphs = BUBBLE_GLYPHS[t.c];
  const glyph = glyphs[i % glyphs.length];
  const isLetter = glyph === "S" || glyph === "DS";
  const fill =
    t.c === "g" ? C.bubbleGreenFill : t.c === "r" ? C.bubbleRedFill : t.c === "y" ? C.bubbleYellowFill : C.bubbleWhiteFill;
  const ring = t.c === "g" ? C.bubbleGreenRing : t.c === "r" ? C.bubbleRedRing : "rgba(0,0,0,0.45)";
  return (
    <div
      style={{
        position: "absolute",
        left: p[0] - t.r,
        top: p[1] - t.r,
        width: t.r * 2,
        height: t.r * 2,
        borderRadius: "50%",
        background: isLetter || t.c === "g" || t.c === "r" ? fill : "transparent",
        border: isLetter ? `2px solid ${ring}` : undefined,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: isLetter ? t.r * 1.05 : t.r * 1.75,
        fontWeight: 800,
        color: "#fff",
        lineHeight: 1,
        opacity: pop,
        transform: `scale(${scale.toFixed(3)})`,
        boxShadow: isLetter ? "0 1px 3px rgba(0,0,0,0.5)" : undefined,
      }}
    >
      {glyph}
    </div>
  );
};

export const ChartArea: React.FC<{ frame: number }> = ({ frame }) => {
  const f = Math.min(frame, CHART_FREEZE);
  if (frame < 418) return null;

  const era = stepAt(
    SCALE_ERAS.map((e) => ({ f: e.from, e })),
    f,
  ).e;
  const nLabels = Math.round((era.top - era.bottom) / era.step);
  const rows: { text: string; y: number }[] = [];
  for (let i = 0; i <= nLabels; i++) {
    rows.push({
      text: fmtK(era.top - i * era.step),
      y: era.yTop + ((era.yBottom - era.yTop) * i) / nLabels,
    });
  }

  const high = stepAt(HIGH_CHIP, f);
  const exitBadge = stepAt(EXIT_BADGE, f);
  const cur = stepAt(CURRENT_CHIP, f);
  const exitY = stepAt(EXIT_Y, f).y;
  const costY = sampleY(COST_BASIS_Y, f) ?? 855;

  const dash = (color: string, y: number, dashW = 7, gap = 6) => (
    <div
      style={{
        position: "absolute",
        left: 56,
        right: 1920 - 1560,
        top: y,
        height: 2,
        backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 ${dashW}px, transparent ${dashW}px ${dashW + gap}px)`,
      }}
    />
  );

  const chip = (text: string, y: number, bg: string, color: string = C.chipText) => (
    <div
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

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* grid */}
      {rows.map((r, i) => (
        <div
          key={`h${i}`}
          style={{ position: "absolute", left: 56, width: 1500, top: r.y, height: 1, background: C.gridLine }}
        />
      ))}
      {TIME_AXIS.map((t, i) => (
        <div
          key={`v${i}`}
          style={{ position: "absolute", left: t.x, top: 195, height: 723, width: 1, background: C.gridLine }}
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
      {TIME_AXIS.map((t, i) => (
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
      {/* dashed strategy lines + labels + badges */}
      {dash(C.exitLine, exitY)}
      <div
        style={{
          position: "absolute",
          right: 1920 - 1558,
          top: exitY - 18,
          fontSize: 12,
          color: "#c9535e",
        }}
      >
        {EXIT_LABEL}
      </div>
      {chip(exitBadge.text, exitY, C.exitBadgeBg)}
      {dash(C.costLine, costY, 9, 7)}
      <div
        style={{
          position: "absolute",
          right: 1920 - 1558,
          top: costY - 18,
          fontSize: 12,
          color: "#dfe4ee",
        }}
      >
        {COST_LABEL}
      </div>
      {chip(COST_BADGE, costY, C.costBadgeBg, C.costBadgeText)}
      {/* candles */}
      {CANDLE_TRACKS.map((t: CandleTrack, i: number) => {
        const p = ctrackAt(t.k, f);
        if (!p) return null;
        return (
          <div
            key={`c${i}`}
            style={{
              position: "absolute",
              left: p[0] - t.w / 2,
              top: p[1],
              width: t.w,
              height: Math.max(p[2] - p[1], 2),
              background: t.c === "g" ? C.candleGreen : C.candleRed,
              borderRadius: 1,
            }}
          />
        );
      })}
      {/* bubbles */}
      {BUBBLE_TRACKS.map((t: BubbleTrack, i: number) => (
        <Bubble key={`b${i}`} t={t} i={i} f={f} />
      ))}
      {/* chips */}
      {chip(high.text, high.y, C.highChipBg)}
      {chip(LOW_CHIP.text, LOW_CHIP.y, C.lowChipBg)}
      {chip(cur.text, cur.y, cur.up ? C.curChipGreen : C.curChipRed)}
    </div>
  );
};
