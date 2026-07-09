import React from "react";
import { Img, interpolate, staticFile } from "remotion";
import { DIATYPE } from "./diatype";
import { clamp } from "./AnomaComposition";

// ─── app.crxfx.com tokens, hex-resolved from ui/frontend ───
// (globals.css :root + components/desk/ui.tsx — nothing invented here)
export const INK = "#1e1e2a"; // --text
export const SEC = "#5b5b66"; // --text-secondary
export const TER = "#8a8a96"; // --text-tertiary
export const TEAL = "#0fb6ab"; // --accent
export const TEAL_HOVER = "#0c8a82"; // --accent-hover
export const TEAL_SOFT = "rgba(15, 182, 171, 0.10)"; // bg-accent/10
export const TEAL_RING = "rgba(15, 182, 171, 0.28)"; // --accent-ring
export const WELL = "#eef1f1"; // --surface-sunken (wells, inset tracks)
export const SURFACE2 = "#f5f7f7"; // --surface-2 (hover, active nav pill, Tag bg)
export const BG = "#f7f8fa"; // --bg
export const BORDER = "rgba(23, 23, 33, 0.08)"; // --border (the only hairline)
export const BORDER_STRONG = "#e4e5ea"; // --border-strong (inputs, tracks)
export const SUCCESS = "#0e7a4a"; // --success
export const SUCCESS_SOFT = "rgba(14, 122, 74, 0.15)"; // bg-success/15
export const BRASS = "#8a5d12"; // --accent-2 (AA text brass)
export const BRASS_SOFT = "rgba(138, 93, 18, 0.15)"; // bg-accent2/15
// --accent-2-ring (lock-ignite) = rgba(184,132,58,0.32); the lock
// pulse animates its alpha inline.

export const flag = (cc: string) => staticFile(`crx-assets/flags/${cc}.svg`);

// ─── One canonical popup-card frame ───
// Every floating app-card window — portfolio (S3), hedge (S4), onboarding
// stepper (S8), RFQ (S9), compliance checklist (S10) — renders in EXACTLY this
// box: one width, one height, one on-stage anchor, scene to scene. The popup
// never resizes or jumps on a cut, and no card grows with its content — every
// Card takes an explicit w/h, so nothing is content-sized; rows fade/tick in
// WITHIN the fixed frame. The height clears the richest card (the RFQ 3-dealer
// list and the hedge form are the tallest). The scene-12 full-app dashboard is
// the finale reveal, NOT a popup — it keeps its own full-width frame (S12).
export const CARD_W = 710;
export const CARD_H = 476;
export const CARD = { left: 504, top: 122, w: CARD_W, h: CARD_H };

// The app's section eyebrow: 12px/600 uppercase, tracking 0.08em.
export const label: React.CSSProperties = {
  fontFamily: DIATYPE,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.08em",
  color: TER,
  textTransform: "uppercase",
};

// The landing renders Diatype proportional (no `tnum`). Diatype's tabular
// feature monospaces punctuation and the space glyph too, so it is left off
// here; this stays an empty style so the figure call-sites read unchanged.
export const tnum: React.CSSProperties = {};

// Element settle: the reference word physics (drop, exponential decay).
export const settle = (
  frame: number,
  start: number,
  drop = 14,
  r = 0.76,
): React.CSSProperties => {
  if (frame < start) return { opacity: 0 };
  const dt = frame - start;
  return {
    transform: `translateY(${(-(drop * Math.pow(r, dt))).toFixed(2)}px)`,
    opacity: Math.min((dt + 1) / 3, 1),
  };
};

export const fadeIn = (frame: number, start: number, dur = 3) =>
  interpolate(frame, [start, start + dur], [0, 1], clamp);

export const smooth = (t: number) => t * t * (3 - 2 * t);

// Continuous index that walks a list of step frames, easing each hop.
export const stepSlide = (frame: number, steps: number[], dur = 4) => {
  let v = 0;
  for (const s of steps) {
    v += smooth(interpolate(frame, [s, s + dur], [0, 1], clamp));
  }
  return v;
};

// ─── shared chrome ───

// App chrome carries the FLAT teal mark (what app.crxfx.com renders);
// the gradient mark belongs to the end lockup on black only.
export const CrxMark: React.FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 100 100" width={size} height={size}>
    <g fill="none" stroke={TEAL} strokeWidth="11" strokeLinecap="round">
      <line x1="50" y1="8" x2="50" y2="92" />
      <line x1="13.6" y1="71" x2="86.4" y2="29" />
      <line x1="13.6" y1="29" x2="86.4" y2="71" />
    </g>
  </svg>
);

// Money as MoneyAmount renders it (components/desk/ui.tsx): cents at
// 0.7em / weight 400 / opacity 0.6 — the cents inherit the figure's
// color, they do not go grey. Figures stay proportional, like the landing.
export const Money: React.FC<{ d: string; c?: string; fs?: number; color?: string }> = ({
  d,
  c = ".00",
  fs = 14,
  color = INK,
}) => (
  <span style={{ fontSize: fs, fontWeight: 400, color, ...tnum }}>
    {d}
    <span style={{ fontSize: "0.7em", fontWeight: 400, opacity: 0.6 }}>{c}</span>
  </span>
);

// Rotating arc for "Running…" states — the app shows live work, the
// mock must too.
export const Spinner: React.FC<{ frame: number; size?: number }> = ({ frame, size = 14 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    style={{ transform: `rotate(${(frame * 14) % 360}deg)` }}
  >
    <circle cx="12" cy="12" r="9" fill="none" stroke={BORDER_STRONG} strokeWidth="3" />
    <path d="M12 3 a9 9 0 0 1 9 9" fill="none" stroke={TEAL} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

// Tether roundel, drawn to read at row size.
export const UsdtMark: React.FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 32 32" width={size} height={size}>
    <circle cx="16" cy="16" r="16" fill="#26A17B" />
    <path
      d="M9 8h14v3.2h-5.3v2.3c3.9.2 6.8 1 6.8 2s-2.9 1.8-6.8 2v6.7h-3.4v-6.7c-3.9-.2-6.8-1-6.8-2s2.9-1.8 6.8-2v-2.3H9V8zm7.3 8.3c3.2 0 5.8-.5 5.8-1.1 0-.5-2.3-1-5.1-1.1v1.6c-.2 0-.5.0-.7.0s-.5 0-.7-.0v-1.6c-2.8.1-5.1.6-5.1 1.1 0 .6 2.6 1.1 5.8 1.1z"
      fill="#fff"
    />
  </svg>
);

export const CalendarGlyph: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <rect x="3" y="5" width="18" height="16" rx="2.5" fill="none" stroke={TER} strokeWidth="2" />
    <line x1="3" y1="10" x2="21" y2="10" stroke={TER} strokeWidth="2" />
    <line x1="8" y1="2.5" x2="8" y2="6.5" stroke={TER} strokeWidth="2" strokeLinecap="round" />
    <line x1="16" y1="2.5" x2="16" y2="6.5" stroke={TER} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// The USDC mark — the app's exact coin face (public/tokens/usdc.svg from
// app.crxfx.com, copied byte-for-byte into crx-assets/tokens). Rendered the way
// the desk's TokenLogo renders it: a round disc with the app's hairline ring
// (rounded-pill ring-1 ring-line). The svg is already a #0B53BF circle, so the
// square box is clipped to a circle and the ring follows the rounded edge.
export const UsdcMark: React.FC<{ size: number }> = ({ size }) => (
  <Img
    src={staticFile("crx-assets/tokens/usdc.svg")}
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      display: "block",
      boxShadow: `0 0 0 1px ${BORDER}`,
    }}
  />
);

export const Check: React.FC<{ size: number; color?: string; stroke?: number }> = ({
  size,
  color = "#fff",
  stroke = 12,
}) => (
  <svg viewBox="0 0 100 100" width={size} height={size}>
    <path
      d="M22 52 L42 72 L78 32"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// The app's SOFT_CARD (components/desk/ui.tsx, used 58×): one soft
// diffuse shadow plus a 1px ring — no border, radius 20. This is the
// only card elevation the app has.
export const CARD_SHADOW =
  "0 1px 2px rgba(28, 28, 35, 0.04), 0 14px 36px -10px rgba(28, 28, 35, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04)";
// --shadow-overlay: drawers, modals, floating dropdowns only.
export const OVERLAY_SHADOW =
  "0 10px 16px rgba(28, 28, 35, 0.04), 0 6px 10px rgba(28, 28, 35, 0.04), 0 0 3px rgba(28, 28, 35, 0.09)";
// focus-visible:ring-2 ring-accent — the app's one focus treatment.
export const FOCUS_RING = `0 0 0 2px ${TEAL_RING}`;

// Neutral Tag (side/pair chips): rounded-sm, hairline, surface-2.
export const tag: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  backgroundColor: SURFACE2,
  padding: "2px 8px",
  fontSize: 12,
  fontWeight: 400,
  color: SEC,
};

export const Card: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  blur?: number;
  scale?: number;
  radius?: number;
  bg?: string;
  children: React.ReactNode;
}> = ({ x, y, w, h, opacity, blur = 0, scale = 1, radius = 20, bg = "#fff", children }) => {
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        opacity,
        borderRadius: radius,
        backgroundColor: bg,
        boxShadow: CARD_SHADOW,
        overflow: "hidden",
        fontFamily: DIATYPE,
        color: INK,
        // No tabular figures — the landing doesn't force them, and Diatype's
        // `tnum` is a whole-tabular set that snaps not just digits but the
        // space, comma, period, slash and colon to a uniform 600-unit advance
        // (space 237→600), reading as "$30 , 440 . 00" / "USD / BRL". Match the
        // landing: leave the face proportional so every figure and separator
        // sits tight. Columns still align — value cells are right-anchored.
        transform: scale !== 1 ? `scale(${scale.toFixed(4)})` : undefined,
        filter: blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : undefined,
      }}
    >
      {children}
    </div>
  );
};

// A currency pair, drawn the way app.crxfx.com draws it (components/desk/
// CurrencyLogo.tsx → PairLogo): two overlapping ROUND flag discs, base in front
// with a white ring separating it from the quote nudged behind at 0.9 opacity,
// each disc object-cover with a hairline ring. A coin-stack, not the old
// rectangular pair — so the video reads like the real app.
export const FlagPair: React.FC<{ a: string; b: string; size?: number }> = ({ a, b, size = 24 }) => (
  <div style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
    <Img
      src={flag(a)}
      style={{
        position: "relative",
        zIndex: 1,
        width: size,
        height: size,
        objectFit: "cover",
        borderRadius: "50%",
        boxShadow: "0 0 0 2px #fff",
      }}
    />
    <Img
      src={flag(b)}
      style={{
        width: size,
        height: size,
        marginLeft: -size * 0.38,
        opacity: 0.9,
        objectFit: "cover",
        borderRadius: "50%",
        boxShadow: `0 0 0 1px ${BORDER}`,
      }}
    />
  </div>
);

// ─── cursor: the operator's hand ───
// A Catmull-Rom spline threaded THROUGH the keyframe points, so the path
// arcs like a real hand yet passes exactly through every keyframe — the
// click ripples, which anchor at keyframe positions, stay pixel-exact on
// their targets. TIMING is unchanged: the per-segment smoothstep still sets
// the arrival, only the in-between shape is now curved. Dwell segments
// (identical endpoints — the hold before a click) return the point flat, so
// the spline never bulges during a still hold. Card-local coordinates.
export type CursorKey = { f: number; x: number; y: number };

// Uniform Catmull-Rom basis on one axis; q(0)=p1, q(1)=p2.
export const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
};

export const cursorAt = (frame: number, keys: CursorKey[]) => {
  if (frame <= keys[0].f) return { x: keys[0].x, y: keys[0].y };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (frame <= b.f) {
      if (a.x === b.x && a.y === b.y) return { x: b.x, y: b.y };
      const t = smooth((frame - a.f) / (b.f - a.f));
      const p0 = keys[i - 1] ?? a;
      const p3 = keys[i + 2] ?? b;
      return {
        x: catmull(p0.x, a.x, b.x, p3.x, t),
        y: catmull(p0.y, a.y, b.y, p3.y, t),
      };
    }
  }
  const last = keys[keys.length - 1];
  return { x: last.x, y: last.y };
};

export const Cursor: React.FC<{
  frame: number;
  keys: CursorKey[];
  clicks: number[];
  appear: number;
  vanish?: number;
}> = ({ frame, keys, clicks, appear, vanish }) => {
  if (frame < appear) return null;
  if (vanish !== undefined && frame >= vanish) return null;
  const { x, y } = cursorAt(frame, keys);
  const op = fadeIn(frame, appear, 4);
  // Click dip: quick 0.85 scale for 3 frames around each click. The
  // ripple stays anchored where the click happened, not on the cursor.
  let dip = 1;
  const rings: { p: number; cx: number; cy: number }[] = [];
  for (const c of clicks) {
    if (frame >= c && frame < c + 3) dip = 0.85;
    if (frame >= c && frame < c + 9) {
      const at = cursorAt(c, keys);
      rings.push({ p: (frame - c) / 9, cx: at.x, cy: at.y });
    }
  }
  return (
    <>
      {rings.map((ring, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: ring.cx - 14 * ring.p - 3,
            top: ring.cy - 14 * ring.p - 3,
            width: 28 * ring.p + 6,
            height: 28 * ring.p + 6,
            borderRadius: "50%",
            border: "1.6px solid rgba(30,30,42,0.30)",
            opacity: 1 - ring.p,
          }}
        />
      ))}
      <svg
        viewBox="0 0 14 20"
        width={15}
        height={21}
        style={{
          position: "absolute",
          left: x - 1,
          top: y - 1,
          opacity: op,
          transform: `scale(${dip})`,
          transformOrigin: "2px 2px",
          filter: "drop-shadow(0 1.5px 3px rgba(0,0,0,0.28))",
        }}
      >
        <path
          d="M1 1 L1 15.5 L4.6 12.2 L7.2 18.2 L9.9 17 L7.3 11.2 L12.2 10.8 Z"
          fill="#1e1e2a"
          stroke="#fff"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
};

// ─── date picker: the month grid the tenor field opens ───
// app.crxfx.com's TENOR control opens a calendar popover; the mock must too —
// a floating month grid (OVERLAY_SHADOW, like the corridor dropdown) with the
// delivery day filled teal, the today ring, the weekday header, month-nav
// chevrons, and the "N days from today" caption the app shows. Because the card
// is short and the tenor sits low, the picker opens UPWARD over the form, the
// way a real date field does when there is no room beneath it. Pure and
// deterministic: given the month's layout and the selected day, it renders the
// same every frame. Day-cell centres are on a fixed grid so the cursor can land
// on the delivery day and its click-ripple reads as a real pick.
export const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
export const CalendarPicker: React.FC<{
  left: number;
  top: number;
  w: number;
  monthLabel: string; // "August 2026"
  firstDow: number; // weekday of day 1 (0=Su … 6=Sa)
  daysInMonth: number;
  selected: number; // delivery day — teal fill
  today?: number; // reference day — hairline teal ring
  caption: string; // "41 days from today"
  op: number;
  settleStyle?: React.CSSProperties;
}> = ({ left, top, w, monthLabel, firstDow, daysInMonth, selected, today, caption, op, settleStyle }) => {
  if (op <= 0) return null;
  const PAD = 16;
  const cell = (w - PAD * 2) / 7;
  const rows = Math.ceil((firstDow + daysInMonth) / 7);
  const weeks: (number | null)[][] = [];
  let d = 1 - firstDow;
  for (let r = 0; r < rows; r++) {
    const week: (number | null)[] = [];
    for (let c = 0; c < 7; c++) {
      week.push(d >= 1 && d <= daysInMonth ? d : null);
      d++;
    }
    weeks.push(week);
  }
  const chev: React.CSSProperties = {
    width: 22,
    textAlign: "center",
    color: TER,
    fontSize: 17,
    lineHeight: 1,
  };
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: w,
        backgroundColor: "#fff",
        borderRadius: 14,
        boxShadow: OVERLAY_SHADOW,
        opacity: op,
        padding: PAD,
        boxSizing: "border-box",
        ...settleStyle,
      }}
    >
      {/* month header with nav chevrons */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span style={chev}>‹</span>
        <span style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: -0.2 }}>{monthLabel}</span>
        <span style={chev}>›</span>
      </div>
      {/* weekday header */}
      <div style={{ display: "flex", marginBottom: 2 }}>
        {WEEKDAYS.map((dw) => (
          <div
            key={dw}
            style={{
              width: cell,
              textAlign: "center",
              fontSize: 10.5,
              fontWeight: 700,
              color: TER,
              letterSpacing: "0.04em",
            }}
          >
            {dw}
          </div>
        ))}
      </div>
      {/* day grid */}
      {weeks.map((week, r) => (
        <div key={r} style={{ display: "flex" }}>
          {week.map((day, c) => {
            const isSel = day === selected;
            const isToday = day != null && day === today && !isSel;
            return (
              <div
                key={c}
                style={{
                  width: cell,
                  height: cell,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {day != null && (
                  <div
                    style={{
                      width: cell - 10,
                      height: cell - 10,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: isSel ? 700 : 400,
                      color: isSel ? "#fff" : INK,
                      backgroundColor: isSel ? TEAL : "transparent",
                      boxShadow: isToday ? `0 0 0 1.5px ${TEAL_RING}` : undefined,
                    }}
                  >
                    {day}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {/* delivery caption */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          marginTop: 10,
          paddingTop: 10,
          borderTop: `1px solid ${BORDER}`,
          fontSize: 12.5,
          color: SEC,
        }}
      >
        <CalendarGlyph size={13} />
        <span>
          Delivery · <span style={{ color: INK, fontWeight: 700 }}>{caption}</span>
        </span>
      </div>
    </div>
  );
};

// ─── chart engine ───
// Product-grade bar marks: ≤24px thick, 4px rounded data-end, square
// at the baseline; history rides a de-emphasized teal step and the
// current month carries the full accent; hairline gridlines with
// clean money ticks; the latest reading is named once — in ink, at
// the cap, because text never wears the data color. No gradients:
// the app has zero. Container-local; bars rise from (x, y).
export const BarChart: React.FC<{
  frame: number;
  growth: (fr: number) => number;
  bars: number[];
  months: string[];
  x: number;
  y: number;
  barW: number;
  gap: number;
  plotH: number;
  gridLabels: [string, string, string];
  labelGutter: number;
  pill: { at: number; text: string };
}> = ({ frame, growth, bars, months, x, y, barW, gap, plotH, gridLabels, labelGutter, pill }) => {
  const plotW = (bars.length - 1) * gap + barW;
  return (
    <>
      {gridLabels.map((gl, i) => {
        const gy = y - (plotH * (i + 1)) / 3;
        return (
          <React.Fragment key={gl}>
            <div
              style={{
                position: "absolute",
                left: x - 6,
                top: gy,
                width: plotW + 12,
                height: 1,
                backgroundColor: "rgba(23,23,33,0.06)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: labelGutter - 60,
                top: gy - 6,
                width: 60,
                textAlign: "right",
                fontSize: 10,
                color: TER,
                ...tnum,
              }}
            >
              {gl}
            </div>
          </React.Fragment>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: x - 6,
          top: y,
          width: plotW + 12,
          height: 1,
          backgroundColor: "rgba(23,23,33,0.12)",
        }}
      />
      {bars.map((h, i) => {
        const bh = h * growth(frame - i * 2);
        const current = i === bars.length - 1;
        return (
          <React.Fragment key={i}>
            {bh >= 1 && (
              <div
                style={{
                  position: "absolute",
                  left: x + i * gap + (barW - 22) / 2,
                  top: y - bh,
                  width: 22,
                  height: bh,
                  backgroundColor: current ? TEAL : "rgba(15, 182, 171, 0.35)",
                  borderRadius: "4px 4px 0 0",
                }}
              />
            )}
            <div
              style={{
                position: "absolute",
                left: x + i * gap,
                top: y + 8,
                width: barW,
                textAlign: "center",
                fontSize: 11,
                color: current ? SEC : TER,
                fontWeight: 400,
              }}
            >
              {months[i]}
            </div>
          </React.Fragment>
        );
      })}
      {frame >= pill.at && (
        <div
          style={{
            position: "absolute",
            left: x + (bars.length - 1) * gap + barW / 2 - 52,
            top: y - plotH - 24,
            width: 104,
            textAlign: "center",
            fontSize: 12,
            fontWeight: 700,
            color: INK,
            whiteSpace: "nowrap",
            ...tnum,
            ...settle(frame, pill.at, 10, 0.74),
          }}
        >
          {pill.text}
        </div>
      )}
    </>
  );
};
