import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { clamp } from "./AnomaComposition";

// ═══════════════════════════════════════════════════════════════
// CRX in-app mock cards for the CRX-Anoma cut. Every card is drawn
// in code from the app's own design system, hex-resolved from
// ui/frontend (globals.css + components/desk/ui.tsx): Inter, teal
// #0fb6ab, the SOFT_CARD surface, sunken wells, hairline dividers,
// brass for the lock moment, the app's own flag files. No invented
// shadows, no gradients — if app.crxfx.com doesn't render it, the
// video doesn't either. Mount windows are inherited
// frame-for-frame from the measured Anoma reference; intra-scene
// events (clicks, locks, landings, chart growth) sit on the 97.97 BPM
// grid of loosin-up.mp3 — causes on beats/snares, effects 1-2 frames
// later, charts finished and RESTING before their scene exits.
// Grid: docs/crx-anoma-beat-sync.md. Inside the cards the interface
// moves like a real one — a cursor causes things, values roll rather
// than cut, and a selection slides rather than teleports.
// ═══════════════════════════════════════════════════════════════

const { fontFamily: INTER } = loadInter("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

// ─── app.crxfx.com tokens, hex-resolved from ui/frontend ───
// (globals.css :root + components/desk/ui.tsx — nothing invented here)
const INK = "#1e1e2a"; // --text
const SEC = "#5b5b66"; // --text-secondary
const TER = "#8a8a96"; // --text-tertiary
const TEAL = "#0fb6ab"; // --accent
const TEAL_HOVER = "#0c8a82"; // --accent-hover
const TEAL_SOFT = "rgba(15, 182, 171, 0.10)"; // bg-accent/10
const TEAL_RING = "rgba(15, 182, 171, 0.28)"; // --accent-ring
const WELL = "#eef1f1"; // --surface-sunken (wells, inset tracks)
const SURFACE2 = "#f5f7f7"; // --surface-2 (hover, active nav pill, Tag bg)
const BG = "#f7f8fa"; // --bg
const BORDER = "rgba(23, 23, 33, 0.08)"; // --border (the only hairline)
const BORDER_STRONG = "#e4e5ea"; // --border-strong (inputs, tracks)
const SUCCESS = "#0e7a4a"; // --success
const SUCCESS_SOFT = "rgba(14, 122, 74, 0.15)"; // bg-success/15
const AMBER = "#c77d0a"; // --warning
const AMBER_SOFT = "rgba(199, 125, 10, 0.15)"; // bg-warning/15
const BRASS = "#8a5d12"; // --accent-2 (AA text brass)
const BRASS_SOFT = "rgba(138, 93, 18, 0.15)"; // bg-accent2/15
// --accent-2-ring (lock-ignite) = rgba(184,132,58,0.32); the lock
// pulse animates its alpha inline.

const flag = (cc: string) => staticFile(`crx-assets/flags/${cc}.svg`);

// Card slot shared with the Anoma originals: left 504, top 122, 710×472.
const SLOT = { left: 504, top: 122, w: 710, h: 472 };

// The app's section eyebrow: 12px/600 uppercase, tracking 0.08em.
const label: React.CSSProperties = {
  fontFamily: INTER,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.08em",
  color: TER,
  textTransform: "uppercase",
};

const tnum: React.CSSProperties = { fontFeatureSettings: "'tnum'" };

// Element settle: the reference word physics (drop, exponential decay).
const settle = (
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

const fadeIn = (frame: number, start: number, dur = 3) =>
  interpolate(frame, [start, start + dur], [0, 1], clamp);

const smooth = (t: number) => t * t * (3 - 2 * t);

// Continuous index that walks a list of step frames, easing each hop.
const stepSlide = (frame: number, steps: number[], dur = 4) => {
  let v = 0;
  for (const s of steps) {
    v += smooth(interpolate(frame, [s, s + dur], [0, 1], clamp));
  }
  return v;
};

// ─── shared chrome ───

// App chrome carries the FLAT teal mark (what app.crxfx.com renders);
// the gradient mark belongs to the end lockup on black only.
const CrxMark: React.FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 100 100" width={size} height={size}>
    <g fill="none" stroke={TEAL} strokeWidth="11" strokeLinecap="round">
      <line x1="50" y1="8" x2="50" y2="92" />
      <line x1="13.6" y1="71" x2="86.4" y2="29" />
      <line x1="13.6" y1="29" x2="86.4" y2="71" />
    </g>
  </svg>
);

// Money exactly as MoneyAmount renders it (components/desk/ui.tsx):
// tabular figure, cents at 0.7em / weight 400 / opacity 0.6 — the
// cents inherit the figure's color, they do not go grey.
const Money: React.FC<{ d: string; c?: string; fs?: number; color?: string }> = ({
  d,
  c = ".00",
  fs = 14,
  color = INK,
}) => (
  <span style={{ fontSize: fs, fontWeight: 500, color, ...tnum }}>
    {d}
    <span style={{ fontSize: "0.7em", fontWeight: 400, opacity: 0.6 }}>{c}</span>
  </span>
);

// Rotating arc for "Running…" states — the app shows live work, the
// mock must too.
const Spinner: React.FC<{ frame: number; size?: number }> = ({ frame, size = 14 }) => (
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
const UsdtMark: React.FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 32 32" width={size} height={size}>
    <circle cx="16" cy="16" r="16" fill="#26A17B" />
    <path
      d="M9 8h14v3.2h-5.3v2.3c3.9.2 6.8 1 6.8 2s-2.9 1.8-6.8 2v6.7h-3.4v-6.7c-3.9-.2-6.8-1-6.8-2s2.9-1.8 6.8-2v-2.3H9V8zm7.3 8.3c3.2 0 5.8-.5 5.8-1.1 0-.5-2.3-1-5.1-1.1v1.6c-.2 0-.5.0-.7.0s-.5 0-.7-.0v-1.6c-2.8.1-5.1.6-5.1 1.1 0 .6 2.6 1.1 5.8 1.1z"
      fill="#fff"
    />
  </svg>
);

const CalendarGlyph: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <rect x="3" y="5" width="18" height="16" rx="2.5" fill="none" stroke={TER} strokeWidth="2" />
    <line x1="3" y1="10" x2="21" y2="10" stroke={TER} strokeWidth="2" />
    <line x1="8" y1="2.5" x2="8" y2="6.5" stroke={TER} strokeWidth="2" strokeLinecap="round" />
    <line x1="16" y1="2.5" x2="16" y2="6.5" stroke={TER} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// The USDC mark — dollar core plus the two broken arcs.
const UsdcMark: React.FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 32 32" width={size} height={size}>
    <circle cx="16" cy="16" r="16" fill="#2775CA" />
    <path
      d="M20.5 18.6c0-2.1-1.3-2.9-3.9-3.3-1.9-.3-2.3-.8-2.3-1.7 0-.9.7-1.5 2-1.5 1.2 0 1.9.4 2.2 1.4.1.2.2.3.4.3h1c.2 0 .4-.2.4-.4v-.1c-.3-1.5-1.4-2.6-3-2.8V9c0-.2-.2-.4-.4-.4h-1c-.2 0-.4.2-.4.4v1.5c-1.9.3-3.1 1.5-3.1 3.1 0 2 1.2 2.8 3.8 3.2 1.8.3 2.4.7 2.4 1.7s-.9 1.7-2.2 1.7c-1.7 0-2.3-.7-2.5-1.7-.1-.2-.2-.3-.4-.3h-1.1c-.2 0-.4.2-.4.4v.1c.3 1.6 1.3 2.8 3.4 3.1V23c0 .2.2.4.4.4h1c.2 0 .4-.2.4-.4v-1.5c2-.3 3.3-1.6 3.3-3.3z"
      fill="#fff"
    />
    <path
      d="M13 24.4c-3.5-1.3-5.3-5.2-4-8.7.7-1.9 2.2-3.3 4-4 .2-.1.3-.2.3-.5v-.9c0-.2-.1-.4-.3-.4h-.1c-4.3 1.4-6.7 6-5.3 10.3.8 2.5 2.8 4.5 5.3 5.3.2.1.4 0 .4-.2l.1-.1v-.9c0-.2-.2-.4-.4-.5zm6.1-14.5c-.2-.1-.4 0-.4.2l-.1.1v.9c0 .2.2.4.4.5 3.5 1.3 5.3 5.2 4 8.7-.7 1.9-2.2 3.3-4 4-.2.1-.3.2-.3.5v.9c0 .2.1.4.3.4h.1c4.3-1.4 6.7-6 5.3-10.3-.8-2.6-2.8-4.6-5.3-5.4z"
      fill="#fff"
    />
  </svg>
);

const Check: React.FC<{ size: number; color?: string; stroke?: number }> = ({
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
const CARD_SHADOW =
  "0 1px 2px rgba(28, 28, 35, 0.04), 0 14px 36px -10px rgba(28, 28, 35, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04)";
// --shadow-overlay: drawers, modals, floating dropdowns only.
const OVERLAY_SHADOW =
  "0 10px 16px rgba(28, 28, 35, 0.04), 0 6px 10px rgba(28, 28, 35, 0.04), 0 0 3px rgba(28, 28, 35, 0.09)";
// focus-visible:ring-2 ring-accent — the app's one focus treatment.
const FOCUS_RING = `0 0 0 2px ${TEAL_RING}`;

// Neutral Tag (side/pair chips): rounded-sm, hairline, surface-2.
const tag: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 6,
  border: `1px solid ${BORDER}`,
  backgroundColor: SURFACE2,
  padding: "2px 8px",
  fontSize: 12,
  fontWeight: 500,
  color: SEC,
};

const Card: React.FC<{
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
        fontFamily: INTER,
        color: INK,
        // Every figure in the card is tabular — balances, rates, notionals
        // hold their columns and never shimmy as values roll. One rule at the
        // root, so no digit anywhere in the mock can drift proportional.
        fontVariantNumeric: "tabular-nums",
        fontKerning: "normal",
        transform: scale !== 1 ? `scale(${scale.toFixed(4)})` : undefined,
        filter: blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : undefined,
      }}
    >
      {children}
    </div>
  );
};

const FlagPair: React.FC<{ a: string; b: string; size?: number }> = ({ a, b, size = 24 }) => (
  <div style={{ position: "relative", width: size * 1.65, height: size, flexShrink: 0 }}>
    <Img
      src={flag(a)}
      style={{
        position: "absolute",
        left: 0,
        width: size * 1.33,
        height: size,
        objectFit: "cover",
        borderRadius: 4,
      }}
    />
    <Img
      src={flag(b)}
      style={{
        position: "absolute",
        left: size * 0.62,
        top: 3,
        width: size * 1.05,
        height: size * 0.79,
        objectFit: "cover",
        borderRadius: 3,
        boxShadow: "0 0 0 2px #fff",
      }}
    />
  </div>
);

// ─── cursor: the operator's hand ───
// Piecewise keyframe path with smoothstep hops; clicks dip the arrow
// and ring outward. Card-local coordinates.
type CursorKey = { f: number; x: number; y: number };

const cursorAt = (frame: number, keys: CursorKey[]) => {
  if (frame <= keys[0].f) return { x: keys[0].x, y: keys[0].y };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (frame <= b.f) {
      const t = smooth((frame - a.f) / (b.f - a.f));
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  const last = keys[keys.length - 1];
  return { x: last.x, y: last.y };
};

const Cursor: React.FC<{
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

// ─── chart engine ───
// Product-grade bar marks: ≤24px thick, 4px rounded data-end, square
// at the baseline; history rides a de-emphasized teal step and the
// current month carries the full accent; hairline gridlines with
// clean money ticks; the latest reading is named once — in ink, at
// the cap, because text never wears the data color. No gradients:
// the app has zero. Container-local; bars rise from (x, y).
const BarChart: React.FC<{
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
                fontWeight: current ? 500 : 400,
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
            fontWeight: 600,
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

// ─── Scene 3 (f128-207): portfolio overview under "Introducing CRX" ───
// Card mounts on the f128 snare. Bars grow on the 8th grid from the
// f147 beat and are FINISHED on the f202 snare — the chart rests
// before the blur-out at f203 instead of dying mid-growth. Balance
// column mirrors the live app: number first, "Total value" beneath,
// then Available / Margin Locked / Unrealized P&L and the token rows.
const S3_BARS = { h: [118, 94, 140, 128, 172], months: ["Feb", "Mar", "Apr", "May", "Jun"] };
const S3_ROWS: [string, string, boolean][] = [
  ["Available", "$16,700", false],
  ["Margin Locked", "$12,500", false],
  ["Unrealized P&L", "+$1,240", true],
];
const S3_TOKENS = [
  { name: "USDC", sub: "USD Coin", amt: "25,000", usd: "$25,000" },
  { name: "USDT", sub: "Tether", amt: "4,200", usd: "$4,200" },
];

export const CrxScene3Dash: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 128 || frame >= 208) return null;
  const opacity =
    interpolate(frame, [127, 152], [0, 1], clamp) *
    interpolate(frame, [203, 207], [1, 0], clamp);
  const growth = (fr: number) =>
    interpolate(
      fr,
      [147, 156, 166, 175, 184, 193, 202],
      [0, 0.18, 0.38, 0.58, 0.76, 0.9, 1],
      clamp,
    );
  const blurIn = interpolate(frame, [128, 158], [3.5, 0], clamp);
  const blurOut = interpolate(frame, [203, 207], [0, 6], clamp);
  return (
    <Card
      x={SLOT.left}
      y={SLOT.top + 1}
      w={SLOT.w}
      h={SLOT.h - 2}
      opacity={opacity}
      blur={Math.max(blurIn, blurOut)}
    >
      <div style={{ position: "absolute", inset: 0, padding: 30 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <CrxMark size={20} />
            <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.3 }}>Portfolio</span>
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: AMBER,
              backgroundColor: AMBER_SOFT,
              borderRadius: 980,
              padding: "3px 10px",
            }}
          >
            Sandbox
          </div>
        </div>

        {/* page-grammar hairline under the header */}
        <div
          style={{
            position: "absolute",
            left: 30,
            right: 30,
            top: 66,
            height: 1,
            backgroundColor: BORDER,
          }}
        />

        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.02em", ...tnum }}>
              $30,440
              <span style={{ fontSize: "0.7em", fontWeight: 400, opacity: 0.6 }}>.00</span>
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: SUCCESS,
                backgroundColor: SUCCESS_SOFT,
                borderRadius: 980,
                padding: "3px 10px",
                ...tnum,
              }}
            >
              +4.3% MTD
            </div>
          </div>
          <div style={{ fontSize: 13, color: SEC, marginTop: 2 }}>
            Total value · Updated just now
          </div>
        </div>

        {S3_ROWS.map(([k, v, green], i) => (
          <div
            key={k}
            style={{
              position: "absolute",
              left: 30,
              top: 166 + i * 44,
              width: 290,
              height: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: `1px solid ${BORDER}`,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 500, color: SEC }}>{k}</span>
            <Money d={v} fs={13.5} color={green ? SUCCESS : INK} />
          </div>
        ))}

        {S3_TOKENS.map((t, i) => (
          <div
            key={t.name}
            style={{
              position: "absolute",
              left: 30,
              top: 298 + i * 56,
              width: 290,
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: `1px solid ${BORDER}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {t.name === "USDC" ? <UsdcMark size={26} /> : <UsdtMark size={26} />}
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.2 }}>{t.name}</div>
                <div style={{ fontSize: 11.5, color: TER }}>{t.sub}</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div>
                <Money d={t.amt} fs={13.5} />
              </div>
              <div style={{ fontSize: 11.5, color: TER, ...tnum }}>{t.usd}.00</div>
            </div>
          </div>
        ))}

        <div style={{ position: "absolute", left: 372, top: 172, ...label }}>Hedged notional</div>
        <div style={{ position: "absolute", right: 30, top: 165, ...tag, fontSize: 11.5 }}>6M</div>
        <BarChart
          frame={frame}
          growth={growth}
          bars={S3_BARS.h}
          months={S3_BARS.months}
          x={376}
          y={404}
          barW={34}
          gap={62}
          plotH={180}
          gridLabels={["$0.6M", "$1.2M", "$1.8M"]}
          labelGutter={368}
          pill={{ at: 197, text: "$1.7M" }}
        />
      </div>
    </Card>
  );
};

// ─── Scene 4 (f205-357): "Open a hedge" in three beats ───
// A: the forward rate ticks live (Indicative) from the f221 beat,
//    then LOCKS on the f240 downbeat — brass, because the app
//    reserves brass for the binding moment.
// B: the cursor opens the corridor list (click f263, a 16th); the
//    hover ring walks the 16th grid (272/281/290); the click on the
//    f295 beat selects USD/BRL and the card re-quotes.
// C: tenor clicks ride the snares (f313, f322); typing starts on the
//    f332 beat; the CTA arms on the f349 snare and is pressed on the
//    16th at f354 as the scene cuts.
const CORRIDORS: { a: string; b: string; pair: string; sub: string; rate: string; spot: string }[] = [
  { a: "us", b: "mx", pair: "USD/MXN", sub: "Dollars / Mexican pesos", rate: "17.5104", spot: "17.499" },
  { a: "us", b: "in", pair: "USD/INR", sub: "Dollars / Indian rupees", rate: "84.212", spot: "84.155" },
  { a: "us", b: "tr", pair: "USD/TRY", sub: "Dollars / Turkish lira", rate: "38.905", spot: "38.822" },
  { a: "us", b: "br", pair: "USD/BRL", sub: "Dollars / Brazilian reais", rate: "5.4310", spot: "5.418" },
];
const SELECT_AT = 295; // the click that makes USD/BRL the pair — on the beat
const HOVER_STEPS = [272, 281, 290]; // hover ring hops on 16ths after landing on row 0 at f267

const RATE_TICKS = ["17.5081", "17.5104", "17.5092", "17.5110", "17.5087", "17.5104"];
// Spot keeps breathing after the forward locks — the market moves,
// the locked rate does not. Last-digit flicker, deterministic.
const SPOT_FLICK = ["1", "3", "0", "4", "2", "5"];

const NOTIONAL = "2,500,000";
const TYPE_START = 332; // first char on the beat
const TYPE_END = TYPE_START + (NOTIONAL.length - 1) * 2; // f348

const CURSOR_KEYS: CursorKey[] = [
  { f: 250, x: 640, y: 452 },
  { f: 259, x: 618, y: 224 }, // "Change ⌄" on the pair well
  { f: 264, x: 618, y: 224 },
  { f: 267, x: 420, y: 296 }, // row 0 (USD/MXN)
  { f: 273, x: 420, y: 340 }, // row 1
  { f: 282, x: 420, y: 384 }, // row 2
  { f: 291, x: 420, y: 428 }, // row 3 (USD/BRL) — click selects on the beat
  { f: 302, x: 470, y: 400 },
  { f: 310, x: 170, y: 308 }, // tenor well
  { f: 321, x: 170, y: 308 },
  { f: 324, x: 150, y: 116 }, // notional field
  { f: 331, x: 236, y: 148 }, // rest aside while it types
  { f: 349, x: 355, y: 384 }, // CTA
  { f: 357, x: 355, y: 384 },
];
const CURSOR_CLICKS = [263, 295, 313, 322, 327, 354];

export const CrxScene4Hedge: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 205 || frame >= 358) return null;
  const opacity = interpolate(frame, [204, 207], [0, 1], clamp);
  // Reference zoom beat f206-216 → scale settle.
  const scale = 1 + 0.045 * Math.pow(0.74, Math.max(0, frame - 206));

  const cor = CORRIDORS[frame < SELECT_AT ? 0 : 3];
  const reQuote = frame >= SELECT_AT ? settle(frame, SELECT_AT, 9, 0.74) : {};

  // Beat A — Indicative ticks from the f221 beat, locks on the f240 downbeat.
  const locked = frame >= 240;
  const rate =
    frame < 221
      ? RATE_TICKS[0]
      : frame < 240
        ? RATE_TICKS[Math.floor((frame - 221) / 4) % RATE_TICKS.length]
        : cor.rate;
  const lockPulse =
    interpolate(frame, [240, 243], [0, 1], clamp) * interpolate(frame, [252, 262], [1, 0], clamp);

  // Spot flicker: last digit changes every 5 frames, forever.
  const spot = cor.spot + SPOT_FLICK[Math.floor(frame / 5) % SPOT_FLICK.length];

  // Beat B — corridor dropdown f264-307.
  const panelIn = fadeIn(frame, 264, 3) * interpolate(frame, [303, 307], [1, 0], clamp);
  const panelOpen = frame >= 264 && frame < 308;
  const hoverIdx = stepSlide(frame, HOVER_STEPS, 4); // 0→3, eased hops
  const hoverOp = fadeIn(frame, 267, 3);
  const selIdx = frame < SELECT_AT ? 0 : 3;

  // Beat C — tenor swaps on the snares f313/f322, notional types from
  // the f332 beat, CTA arms on the f349 snare.
  const tenor =
    frame < 313
      ? ["Aug 1, 2026", "30 days from today"]
      : frame < 322
        ? ["Sep 30, 2026", "90 days from today"]
        : ["Jun 30, 2027", "363 days from today"];
  const tenorSwap = frame >= 313 ? settle(frame, frame < 322 ? 313 : 322, 8, 0.74) : {};
  const tenorFocus =
    interpolate(frame, [311, 314], [0, 1], clamp) * interpolate(frame, [328, 334], [1, 0], clamp);
  const focused = frame >= 327;
  const typedChars =
    frame < TYPE_START ? 0 : Math.min(Math.floor((frame - TYPE_START) / 2) + 1, NOTIONAL.length);
  const typing = typedChars > 0 && typedChars < NOTIONAL.length;
  // Caret blinks while idle-focused, holds solid while typing.
  const caretOn = focused && (typing || Math.floor(frame / 8) % 2 === 0);
  const armed = frame >= 349;
  const ctaSettle = armed ? settle(frame, 349, 6, 0.72) : {};
  const ctaPressed = frame >= 354 && frame < 358;

  return (
    <Card
      x={SLOT.left}
      y={SLOT.top - 2}
      w={SLOT.w}
      h={SLOT.h + 3}
      opacity={opacity}
      scale={scale}
    >
      <div style={{ position: "absolute", inset: 0, padding: "24px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: TER, fontSize: 18, lineHeight: 1 }}>‹</span>
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.3 }}>Open a hedge</span>
          <div style={{ marginLeft: "auto", ...tag, fontSize: 11.5 }}>FX Forward</div>
        </div>

        {/* Forward notional well */}
        <div
          style={{
            position: "absolute",
            left: 28,
            top: 62,
            width: 654,
            height: 108,
            backgroundColor: WELL,
            borderRadius: 16,
            padding: "14px 18px",
            boxShadow: focused && frame < TYPE_END + 8 ? FOCUS_RING : undefined,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {/* SwapPage renders this one sentence-case — 12.5px/500
                tertiary, not the uppercase eyebrow */}
            <div style={{ fontFamily: INTER, fontSize: 12.5, fontWeight: 500, color: TER }}>
              Forward notional
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
              <span style={{ color: TER, ...tnum }}>Balance $30,440</span>
              <span style={{ color: TEAL, fontWeight: 600 }}>Max</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                fontSize: 38,
                fontWeight: typedChars > 0 ? 600 : 500,
                letterSpacing: -1,
                marginTop: 2,
                color: typedChars > 0 ? INK : "#b8bac4",
                ...tnum,
              }}
            >
              {typedChars > 0 ? NOTIONAL.slice(0, typedChars) : focused ? "" : "0.0"}
              {caretOn && (
                <span style={{ color: TEAL, fontWeight: 400, marginLeft: 1 }}>|</span>
              )}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                backgroundColor: "#fff",
                border: `1px solid ${BORDER}`,
                borderRadius: 980,
                padding: "6px 13px 6px 7px",
              }}
            >
              <UsdcMark size={21} />
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>USDC</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: TEAL }} />
            <span style={{ fontSize: 12, color: SEC }}>
              Spot price{" "}
              <span style={{ color: INK, fontWeight: 600, ...tnum }}>
                {spot} {cor.pair.slice(4)}
              </span>
            </span>
          </div>
        </div>

        {/* Pair well — the app nests a white row inside the grey well */}
        <div
          style={{
            position: "absolute",
            left: 28,
            top: 182,
            width: 654,
            height: 74,
            backgroundColor: WELL,
            borderRadius: 16,
            padding: "9px 12px 0 12px",
          }}
        >
          <div style={{ ...label, paddingLeft: 6 }}>Pair</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 4,
              backgroundColor: "#fff",
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: "5px 12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, ...reQuote }}>
              <FlagPair a={cor.a} b={cor.b} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.15 }}>{cor.pair}</div>
                <div style={{ fontSize: 11.5, color: TER }}>{cor.sub}</div>
              </div>
            </div>
            <span style={{ fontSize: 13, color: SEC }}>Change ⌄</span>
          </div>
        </div>

        {/* Tenor + forward rate wells */}
        <div
          style={{
            position: "absolute",
            left: 28,
            top: 268,
            width: 320,
            height: 74,
            backgroundColor: WELL,
            borderRadius: 16,
            padding: "10px 18px",
            boxShadow:
              tenorFocus > 0
                ? `0 0 0 2px rgba(15,182,171,${(0.28 * tenorFocus).toFixed(3)})`
                : undefined,
          }}
        >
          <div style={label}>Tenor</div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 5, ...tenorSwap }}>
            <CalendarGlyph />
            <div>
              <div style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.15, ...tnum }}>
                {tenor[0]}
              </div>
              <div style={{ fontSize: 12, color: TER }}>{tenor[1]}</div>
            </div>
          </div>
          <span style={{ position: "absolute", right: 16, top: 32, fontSize: 13, color: TER }}>
            ⌄
          </span>
        </div>
        <div
          style={{
            position: "absolute",
            left: 362,
            top: 268,
            width: 320,
            height: 74,
            backgroundColor: WELL,
            borderRadius: 16,
            padding: "10px 18px",
            boxShadow:
              lockPulse > 0
                ? `0 0 0 2px rgba(184,132,58,${(0.32 * lockPulse).toFixed(3)})`
                : undefined,
          }}
        >
          <div style={label}>Forward rate</div>
          <div style={{ ...(frame >= SELECT_AT ? reQuote : {}) }}>
            <div style={{ fontSize: 15.5, fontWeight: 600, marginTop: 5, lineHeight: 1.15, ...tnum }}>
              {rate}
            </div>
            <div style={{ fontSize: 12, color: TER }}>{cor.pair.slice(4)} per USD</div>
          </div>
          {/* Indicative → Locked badge */}
          {!locked ? (
            <div style={{ position: "absolute", right: 14, top: 11, ...tag, gap: 6 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: TEAL,
                  opacity: 0.5 + 0.5 * Math.cos((frame * Math.PI) / 30),
                }}
              />
              Indicative
            </div>
          ) : (
            <div
              style={{
                position: "absolute",
                right: 14,
                top: 11,
                display: "flex",
                alignItems: "center",
                gap: 5,
                backgroundColor: BRASS_SOFT,
                borderRadius: 980,
                padding: "4px 10px",
                ...settle(frame, 240, 12, 0.74),
              }}
            >
              <svg viewBox="0 0 24 24" width={11} height={11}>
                <path
                  d="M7 10V7a5 5 0 0 1 10 0v3"
                  fill="none"
                  stroke={BRASS}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <rect x="5" y="10" width="14" height="10" rx="2.4" fill={BRASS} />
              </svg>
              <span style={{ fontSize: 12, fontWeight: 500, color: BRASS }}>
                Locked · firm 120s
              </span>
            </div>
          )}
        </div>

        {/* CTA — the app's swap primary: flat teal, rounded-2xl, 15px
            medium; disabled is the same button at half opacity, and a
            press is accent-hover at scale 0.98. No glow — the app's
            primary has no shadow at all. */}
        <div
          style={{
            position: "absolute",
            left: 28,
            top: 358,
            width: 654,
            height: 52,
            borderRadius: 16,
            backgroundColor: ctaPressed ? TEAL_HOVER : TEAL,
            opacity: armed ? 1 : 0.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
            fontWeight: 500,
            color: "#fff",
            transform: ctaPressed ? "scale(0.98)" : undefined,
          }}
        >
          <span style={{ ...ctaSettle }}>{armed ? "Request quotes" : "Enter an amount"}</span>
        </div>

        <div
          style={{
            position: "absolute",
            left: 0,
            width: 710,
            top: 425,
            textAlign: "center",
            fontSize: 12,
            color: SEC,
            ...tnum,
          }}
        >
          Convert {cor.pair.slice(4)} → USD on {tenor[0]} at the{" "}
          {locked ? "locked" : "quoted"} rate
        </div>

        {/* Corridor dropdown — floats over the lower wells during beat B */}
        {panelOpen && panelIn > 0 && (
          <div
            style={{
              position: "absolute",
              left: 28,
              top: 262,
              width: 654,
              borderRadius: 12,
              backgroundColor: "#fff",
              border: `1px solid ${BORDER}`,
              boxShadow: OVERLAY_SHADOW,
              padding: 8,
              opacity: panelIn,
              transform: `scaleY(${(0.96 + 0.04 * panelIn).toFixed(3)})`,
              transformOrigin: "center top",
            }}
          >
            {/* sliding hover ring */}
            {hoverOp > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: 8,
                  top: 8 + 44 * hoverIdx,
                  width: 638,
                  height: 44,
                  borderRadius: 8,
                  backgroundColor: SURFACE2,
                  opacity: hoverOp,
                }}
              />
            )}
            {CORRIDORS.map((c, i) => (
              <div
                key={c.pair}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  height: 44,
                  padding: "0 12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <FlagPair a={c.a} b={c.b} size={20} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{c.pair}</span>
                  <span style={{ fontSize: 12.5, color: TER }}>{c.sub}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: SEC, ...tnum }}>
                    {c.rate}
                  </span>
                  {selIdx === i && <Check size={16} color={TEAL} stroke={14} />}
                </div>
              </div>
            ))}
          </div>
        )}

        <Cursor
          frame={frame}
          keys={CURSOR_KEYS}
          clicks={CURSOR_CLICKS}
          appear={250}
        />
      </div>
    </Card>
  );
};

// ─── Scene 8 (f464-576): compliance onboarding under "Onboard in days" ───
// Sub-states crossfade on the beat grid (469 = 8th, 492/506 = 16ths,
// 496/533 = snares); rows whose KEY is new to a face drop in
// staggered; the success dot expands, then floods the card across the
// f552 beat and resolves to Verified.
type ObRow = { k: string; v: string; state?: "pending" | "done" | "run" };

const OB_STATES: { at: number; step: number; rows: ObRow[] }[] = [
  {
    at: 463,
    step: 0,
    rows: [
      { k: "Legal entity", v: "—", state: "pending" },
      { k: "LEI", v: "—", state: "pending" },
      { k: "Jurisdiction", v: "—", state: "pending" },
    ],
  },
  {
    at: 469,
    step: 0,
    rows: [
      { k: "Legal entity", v: "Acme Treasury Ltd", state: "done" },
      { k: "LEI", v: "—", state: "pending" },
      { k: "Jurisdiction", v: "—", state: "pending" },
    ],
  },
  {
    at: 492,
    step: 0,
    rows: [
      { k: "Legal entity", v: "Acme Treasury Ltd", state: "done" },
      { k: "LEI", v: "5493 00K2 T4YQ 12BC 7A91", state: "done" },
      { k: "Jurisdiction", v: "—", state: "pending" },
    ],
  },
  {
    at: 496,
    step: 1,
    rows: [
      { k: "Legal entity", v: "Acme Treasury Ltd", state: "done" },
      { k: "LEI", v: "5493 00K2 T4YQ 12BC 7A91", state: "done" },
      { k: "Jurisdiction", v: "United Kingdom", state: "done" },
    ],
  },
  {
    at: 506,
    step: 1,
    rows: [
      { k: "KYB documents", v: "Received", state: "done" },
      { k: "Sanctions screening", v: "Running…", state: "run" },
      { k: "Beneficial owners", v: "Verifying…", state: "run" },
    ],
  },
  {
    at: 533,
    step: 2,
    rows: [
      { k: "KYB documents", v: "Verified", state: "done" },
      { k: "Sanctions screening", v: "Clear", state: "done" },
      { k: "Custody wallet", v: "0x12B7…0D1F whitelisted", state: "done" },
    ],
  },
];

const OB_STEPS = ["Entity", "Verification", "Wallet"];

const ObFace: React.FC<{
  frame: number;
  at: number;
  step: number;
  rows: ObRow[];
  prevRows: ObRow[] | null;
}> = ({ frame, at, step, rows, prevRows }) => (
  <div style={{ position: "absolute", inset: 0, padding: "26px 30px", backgroundColor: "#fff" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.3 }}>Compliance</span>
      <span style={{ fontSize: 12, color: TER }}>Institutional onboarding</span>
    </div>
    <div
      style={{
        position: "absolute",
        left: 30,
        right: 30,
        top: 60,
        height: 1,
        backgroundColor: BORDER,
      }}
    />

    {/* stepper */}
    <div style={{ position: "absolute", left: 30, top: 76, width: 650 }}>
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 24 + i * 271 + 24,
            top: 11,
            width: 271 - 48 + 24,
            height: 2,
            backgroundColor: step > i ? TEAL : BORDER_STRONG,
          }}
        />
      ))}
      {OB_STEPS.map((s, i) => {
        const done = step > i;
        const active = step === i;
        return (
          <div key={s} style={{ position: "absolute", left: i * 271, width: 108, textAlign: "center" }}>
            <div
              style={{
                width: 24,
                height: 24,
                margin: "0 auto",
                borderRadius: 12,
                backgroundColor: done || active ? TEAL : "#fff",
                border: done || active ? "none" : `2px solid ${BORDER_STRONG}`,
                boxShadow: active ? FOCUS_RING : undefined,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {done ? (
                <Check size={13} stroke={16} />
              ) : (
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: active ? "#fff" : TER,
                    fontFamily: INTER,
                  }}
                >
                  {i + 1}
                </span>
              )}
            </div>
            <div
              style={{
                marginTop: 7,
                fontSize: 12,
                fontWeight: active || done ? 600 : 500,
                color: active || done ? INK : TER,
              }}
            >
              {s}
            </div>
          </div>
        );
      })}
    </div>

    {/* rows — a row whose key is new to this face drops in staggered */}
    {rows.map((r, i) => {
      const fresh = !prevRows || prevRows[i]?.k !== r.k;
      const drop = fresh ? settle(frame, at + 1 + i * 2, 9, 0.76) : {};
      return (
        <div
          key={r.k}
          style={{
            position: "absolute",
            left: 30,
            top: 168 + i * 66,
            width: 650,
            height: 66,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${BORDER}`,
            ...drop,
          }}
        >
          <span style={{ fontSize: 14.5, fontWeight: 500, color: SEC }}>{r.k}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {r.state === "run" && <Spinner frame={frame} />}
            {r.state === "done" && r.v !== "Received" && (
              <div
                style={{
                  width: 17,
                  height: 17,
                  borderRadius: 9,
                  backgroundColor: SUCCESS,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Check size={10} stroke={18} />
              </div>
            )}
            <span
              style={{
                fontSize: 14,
                fontWeight: r.state === "pending" ? 400 : 500,
                color: r.state === "pending" ? TER : r.state === "run" ? SEC : INK,
                ...tnum,
              }}
            >
              {r.v}
            </span>
          </div>
        </div>
      );
    })}

    <div style={{ position: "absolute", left: 30, bottom: 22, fontSize: 12, color: TER }}>
      Onboard once — trade with every dealer on the network.
    </div>
  </div>
);

export const CrxScene8Onboard: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 464 || frame >= 577) return null;
  const cardOpacity = interpolate(frame, [571, 576], [1, 0], clamp);
  if (cardOpacity <= 0) return null;
  // Success dot: pops on the quarter at f543, holds, then floods the
  // card across the f552 beat; the Verified face resolves out of it.
  const dotD = interpolate(
    frame,
    [543, 546, 549, 551, 553, 556],
    [12, 44, 42, 42, 420, 950],
    clamp,
  );
  const successOp = interpolate(frame, [555, 560], [0, 1], clamp);
  return (
    <Card x={SLOT.left} y={SLOT.top} w={SLOT.w} h={SLOT.h + 5} opacity={cardOpacity}>
      {OB_STATES.map(({ at, step, rows }, i) => {
        const op = fadeIn(frame, at, 3);
        if (op <= 0) return null;
        const next = OB_STATES[i + 1];
        if (next && frame >= next.at + 3) return null;
        return (
          <div key={at} style={{ position: "absolute", inset: 0, opacity: op }}>
            <ObFace
              frame={frame}
              at={at}
              step={step}
              rows={rows}
              prevRows={i > 0 ? OB_STATES[i - 1].rows : null}
            />
          </div>
        );
      })}
      {frame >= 543 && successOp < 1 && (
        <div
          style={{
            position: "absolute",
            left: 349 - dotD / 2,
            top: 257 - dotD / 2,
            width: dotD,
            height: dotD,
            borderRadius: "50%",
            backgroundColor: TEAL,
          }}
        />
      )}
      {successOp > 0 && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: "#fff", opacity: successOp }}>
          <div
            style={{
              position: "absolute",
              left: 349 - 37,
              top: 168,
              width: 74,
              height: 74,
              borderRadius: 37,
              backgroundColor: TEAL,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Check size={40} stroke={13} />
          </div>
          <div
            style={{
              position: "absolute",
              top: 262,
              width: "100%",
              textAlign: "center",
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: -0.5,
              color: INK,
              fontFamily: INTER,
            }}
          >
            Verified
          </div>
          <div
            style={{
              position: "absolute",
              top: 300,
              width: "100%",
              textAlign: "center",
              fontSize: 14.5,
              color: SEC,
              fontFamily: INTER,
            }}
          >
            Ready to trade on CRX
          </div>
        </div>
      )}
    </Card>
  );
};

// ─── Scene 9 (f571-665): RFQ — quotes from multiple dealers ───
// Skeleton rows shimmer; rates ROLL in on the 16th grid (f584/589/593,
// "dealers" lands on the f589 beat with the second quote) with tabular
// digits; the best rate is ringed on the f607 snare once all three are
// on the table. The card continues scene 4's trade: USD/BRL, $2.5M,
// Jun 30 2027. Avatars wear the app's own neutrals — surface-2 with
// secondary ink; only the best dealer carries the teal-soft fill.
const DEALERS = [
  { name: "Dealer 1", sub: "Tier-1 bank", rate: 5.4335, lands: 584, t: "0.6s", bg: SURFACE2, fg: SEC },
  { name: "Dealer 2", sub: "Global FX desk", rate: 5.4298, lands: 589, t: "0.8s", bg: TEAL_SOFT, fg: TEAL },
  { name: "Dealer 3", sub: "Regional specialist", rate: 5.4319, lands: 593, t: "1.1s", bg: SURFACE2, fg: SEC },
];
const BEST = 1;
const HIGHLIGHT_AT = 607;

export const CrxScene9Dealers: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 571 || frame >= 666) return null;
  const rated = frame >= 584;
  const highlighted = frame >= HIGHLIGHT_AT;
  const countdown = rated ? 120 - Math.floor((frame - 584) / 30) : 120;
  return (
    <Card x={SLOT.left} y={SLOT.top} w={SLOT.w + 1} h={SLOT.h} opacity={1}>
      <div style={{ position: "absolute", inset: 0, padding: "26px 30px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.3 }}>
            Request for quote
          </span>
          {rated ? (
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: BRASS,
                backgroundColor: BRASS_SOFT,
                borderRadius: 980,
                padding: "3px 10px",
                ...tnum,
              }}
            >
              Firm · {countdown}s
            </div>
          ) : (
            <div style={{ ...tag, gap: 6 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: TEAL,
                  opacity: 0.5 + 0.5 * Math.cos((frame * Math.PI) / 30),
                }}
              />
              Quoting…
            </div>
          )}
        </div>

        <div
          style={{
            position: "absolute",
            left: 30,
            right: 30,
            top: 60,
            height: 1,
            backgroundColor: BORDER,
          }}
        />

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          {[
            <span key="p" style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <FlagPair a="us" b="br" size={19} />
              <span>USD/BRL</span>
            </span>,
            <span key="n">$2,500,000</span>,
            <span key="d">Jun 30, 2027</span>,
          ].map((chip, i) => (
            <div
              key={i}
              style={{
                ...tag,
                padding: "4px 10px",
                fontSize: 12.5,
                ...tnum,
              }}
            >
              {chip}
            </div>
          ))}
        </div>

        <div style={{ position: "absolute", left: 30, top: 118, fontSize: 12, color: TER }}>
          {rated ? "3 of 3 dealers responded" : "Quoting 3 dealers…"}
        </div>

        {DEALERS.map((d, i) => {
          const isBest = i === BEST;
          const dimT = highlighted && !isBest ? fadeIn(frame, HIGHLIGHT_AT, 4) : 0;
          const dim = 1 - 0.45 * dimT;
          const landed = frame >= d.lands;
          // Rate rolls up to its value over 9 frames, tabular digits.
          const rollT = smooth(interpolate(frame, [d.lands, d.lands + 9], [0, 1], clamp));
          const shown = (d.rate - 0.0165 * (1 - rollT)).toFixed(4);
          const ringOp = highlighted && isBest ? fadeIn(frame, HIGHLIGHT_AT, 4) : 0;
          return (
            <div
              key={d.name}
              style={{
                position: "absolute",
                left: 30,
                top: 146 + i * 84,
                width: 651,
                height: 72,
                borderRadius: 12,
                backgroundColor: ringOp > 0 ? TEAL_SOFT : WELL,
                boxShadow:
                  ringOp > 0
                    ? `0 0 0 2px rgba(15,182,171,${(0.28 * ringOp).toFixed(3)})`
                    : undefined,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 20px",
                opacity: dim,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: d.bg,
                    color: d.fg,
                    fontSize: 13,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  D{i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.2 }}>{d.name}</div>
                  <div style={{ fontSize: 12.5, color: TER }}>
                    {landed ? `${d.sub} · answered ${d.t}` : d.sub}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {highlighted && isBest && (
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: TEAL,
                      backgroundColor: TEAL_SOFT,
                      borderRadius: 980,
                      padding: "3px 10px",
                      ...settle(frame, HIGHLIGHT_AT, 10, 0.74),
                    }}
                  >
                    Best rate
                  </div>
                )}
                {landed ? (
                  <div style={{ textAlign: "right", opacity: fadeIn(frame, d.lands, 4) }}>
                    <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.3, ...tnum }}>
                      {shown}
                    </div>
                    <div style={{ fontSize: 12, color: TER }}>BRL per USD</div>
                  </div>
                ) : (
                  // Skeleton the app's way: a flat bar on animate-pulse
                  // (opacity breathing, 2s period) — no light sweep.
                  <div
                    style={{
                      width: 86,
                      height: 14,
                      borderRadius: 6,
                      backgroundColor: BORDER_STRONG,
                      opacity: 0.5 + 0.5 * Math.cos(((frame + i * 12) * Math.PI) / 30),
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}

        <div style={{ position: "absolute", left: 30, bottom: 20, fontSize: 12, color: TER }}>
          One request — the whole dealer network answers.
        </div>
      </div>
    </Card>
  );
};

// ─── Scene 10 (f641-722): compliance checklist under "Compliance by design" ───
// Crossfades over the RFQ card on the reference curve; checks tick in
// on the 8th grid (f680 is the snare); the All-clear pill is the
// conclusion — it lands on the f699 beat and HOLDS 17 frames before
// the card fades, instead of arriving into its own death.
const COMPLY_ROWS = [
  { at: 666, k: "KYB", v: "Verified" },
  { at: 675, k: "Sanctions screening", v: "Clear — 0 hits" },
  { at: 684, k: "Travel rule", v: "Enabled" },
  { at: 694, k: "Audit export", v: "CSV · PDF ready" },
];
const ALL_CLEAR_AT = 699;

export const CrxScene10Comply: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 641 || frame >= 723) return null;
  const opacity =
    interpolate(frame, [641, 666], [0, 1], clamp) *
    interpolate(frame, [716, 722], [1, 0], clamp);
  return (
    <Card x={SLOT.left} y={SLOT.top} w={SLOT.w} h={SLOT.h} opacity={opacity}>
      <div style={{ position: "absolute", inset: 0, padding: "26px 30px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.3 }}>Compliance</span>
          {frame >= ALL_CLEAR_AT && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 500,
                color: SUCCESS,
                backgroundColor: SUCCESS_SOFT,
                borderRadius: 980,
                padding: "3px 10px",
                ...settle(frame, ALL_CLEAR_AT, 10, 0.74),
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: SUCCESS }} />
              All clear
            </div>
          )}
        </div>
        <div
          style={{
            position: "absolute",
            left: 30,
            right: 30,
            top: 60,
            height: 1,
            backgroundColor: BORDER,
          }}
        />

        {COMPLY_ROWS.map(({ at, k, v }, i) => {
          const on = frame >= at;
          const pop = on ? 1 + 0.18 * Math.pow(0.68, frame - at) : 1;
          const rowOp = fadeIn(frame, at - 4, 4);
          return (
            <div
              key={k}
              style={{
                position: "absolute",
                left: 30,
                top: 92 + i * 74,
                width: 650,
                height: 74,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: `1px solid ${BORDER}`,
                opacity: rowOp,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {/* the app's completed check: soft green well, green
                    glyph (bg-success/15 text-success) — never a solid
                    green disc */}
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: on ? SUCCESS_SOFT : BORDER_STRONG,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: `scale(${pop.toFixed(3)})`,
                  }}
                >
                  {on && <Check size={14} stroke={16} color={SUCCESS} />}
                </div>
                <span style={{ fontSize: 15.5, fontWeight: 600 }}>{k}</span>
              </div>
              <span style={{ fontSize: 13.5, color: on ? SEC : TER, ...tnum }}>{v}</span>
            </div>
          );
        })}

        <div style={{ position: "absolute", left: 30, bottom: 24, fontSize: 12, color: TER }}>
          Every trade screened on-chain, continuously.
        </div>
      </div>
    </Card>
  );
};

// ─── Scene 12 (f769-848): the app, full width, under "CRX Sandbox is Live." ───
// Amber sandbox banner + nav + portfolio, AFTER the story's trade:
// margin locked reflects the $2.5M hedge, and the positions list
// carries it. Bars grow on the beat grid from f783 and are FINISHED
// on the f828 beat — 17 frames of rest before the fade instead of
// growth running into the cut. Positions land on the f791 snare and
// the f800 16th. The Portfolio pill is chrome — the real nav never
// animates it in, so it is present from the scene's first frame.
const S12 = { left: 83, top: 291, w: 1114, h: 429 };
const S12_BARS = { h: [72, 55, 84, 78, 106], months: ["Feb", "Mar", "Apr", "May", "Jun"] };
const S12_TABS = ["Swap", "Transfer", "Portfolio", "Compliance"];

const POSITIONS = [
  { at: 791, a: "us", b: "br", pair: "USD/BRL", side: "Long", notional: "$2.5M", pnl: "+$1,240", health: 0.86 },
  { at: 800, a: "us", b: "mx", pair: "USD/MXN", side: "Short", notional: "$1.0M", pnl: "+$310", health: 0.72 },
];

// The app shell's nav is deliberately NOT Inter — TopNav.tsx sets
// Helvetica Neue for the wordmark and tabs, ink #1a1a1a, and a
// frosted white bar over a hardcoded warm-grey hairline.
const HELV = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const NAV_INK = "#1a1a1a";
const NAV_BORDER = "#e7e7e2";

const Flask: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <path
      d="M9.5 3h5M10 3v6l-5.2 8.8A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-3.2L14 9V3"
      fill="none"
      stroke="#fff"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M8 15.5h8" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
  </svg>
);

export const CrxScene12App: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 769 || frame >= 849) return null;
  const opacity =
    interpolate(frame, [769, 793], [0, 1], clamp) *
    interpolate(frame, [845, 848], [1, 0], clamp);
  if (opacity <= 0) return null;
  const growth = (fr: number) =>
    interpolate(fr, [783, 791, 800, 809, 819, 828], [0, 0.18, 0.42, 0.68, 0.9, 1], clamp);
  const pillOn = 1; // chrome never animates itself in
  return (
    <Card x={S12.left} y={S12.top} w={S12.w} h={S12.h} opacity={opacity} radius={16} bg={BG}>
      {/* sandbox banner — AppShell renders it bg-warning, 13px/500 white */}
      <div
        style={{
          position: "absolute",
          top: 0,
          width: "100%",
          height: 30,
          backgroundColor: AMBER,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          fontSize: 12,
          fontWeight: 500,
          color: "#fff",
        }}
      >
        <Flask />
        Sandbox — Base Sepolia testnet. No real funds at risk.
      </div>

      {/* nav */}
      <div
        style={{
          position: "absolute",
          top: 30,
          width: "100%",
          height: 48,
          backgroundColor: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(12px) saturate(1.8)",
          borderBottom: `1px solid ${NAV_BORDER}`,
          display: "flex",
          alignItems: "center",
          padding: "0 26px",
          fontFamily: HELV,
        }}
      >
        <CrxMark size={19} />
        <span
          style={{
            fontSize: 15.5,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            marginLeft: 8,
            color: NAV_INK,
          }}
        >
          CRX
        </span>
        <div style={{ display: "flex", gap: 4, marginLeft: 40 }}>
          {S12_TABS.map((t) => {
            const active = t === "Portfolio";
            // TopNav: Transfer / Portfolio / Compliance are dropdown
            // menus and carry a small chevron; Swap is a bare link.
            const hasMenu = t !== "Swap";
            return (
              <div
                key={t}
                style={{
                  position: "relative",
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: NAV_INK,
                  opacity: active ? 1 : 0.7,
                  padding: "6px 13px",
                }}
              >
                {active && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 8,
                      backgroundColor: SURFACE2,
                      opacity: pillOn,
                    }}
                  />
                )}
                <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                  {t}
                  {hasMenu && (
                    <svg
                      viewBox="0 0 9 9"
                      width={9}
                      height={9}
                      style={{ marginLeft: 4, opacity: 0.55 }}
                    >
                      <path
                        d="M2 3.5 L4.5 6 L7 3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginLeft: "auto",
            backgroundColor: TEAL,
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            borderRadius: 980,
            padding: "8px 16px",
            boxShadow: "0 1px 1px 0 rgba(0,0,0,0.08), 0 8px 20px -12px rgba(0,0,0,0.4)",
          }}
        >
          Connect wallet
        </div>
      </div>

      {/* balance card — margin reflects the hedge opened in scene 4 */}
      <div
        style={{
          position: "absolute",
          left: 26,
          top: 102,
          width: 300,
          height: 300,
          backgroundColor: "#fff",
          borderRadius: 20,
          padding: "20px 22px",
          boxShadow: CARD_SHADOW,
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.018em", ...tnum }}>
          $30,440
          <span style={{ fontSize: "0.7em", fontWeight: 400, opacity: 0.6 }}>.00</span>
        </div>
        <div style={{ fontSize: 12.5, color: SEC, marginTop: 3 }}>Total value</div>
        {(
          [
            ["Available", "$9,930", false],
            ["Margin Locked", "$10,510", false],
            ["Unrealized P&L", "+$1,550", true],
          ] as [string, string, boolean][]
        ).map(([k, v, green], i) => (
          <div
            key={k}
            style={{
              position: "absolute",
              left: 22,
              top: 116 + i * 52,
              width: 256,
              height: 52,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: `1px solid ${BORDER}`,
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 500, color: SEC }}>{k}</span>
            <Money d={v} fs={13} color={green ? SUCCESS : INK} />
          </div>
        ))}
      </div>

      {/* hedged notional chart */}
      <div
        style={{
          position: "absolute",
          left: 342,
          top: 102,
          width: 400,
          height: 300,
          backgroundColor: "#fff",
          borderRadius: 20,
          padding: "20px 22px",
          boxShadow: CARD_SHADOW,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={label}>Hedged notional</div>
          <div style={{ ...tag, fontSize: 11 }}>6M</div>
        </div>
        <BarChart
          frame={frame}
          growth={growth}
          bars={S12_BARS.h}
          months={S12_BARS.months}
          x={64}
          y={246}
          barW={36}
          gap={64}
          plotH={147}
          gridLabels={["$1.4M", "$2.8M", "$4.2M"]}
          labelGutter={60}
          pill={{ at: 828, text: "$3.0M" }}
        />
      </div>

      {/* positions */}
      <div
        style={{
          position: "absolute",
          left: 758,
          top: 102,
          width: 330,
          height: 300,
          backgroundColor: "#fff",
          borderRadius: 20,
          padding: "20px 22px",
          boxShadow: CARD_SHADOW,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={label}>Positions</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: SEC }}>View all ›</div>
        </div>
        {POSITIONS.map((pos, i) => {
          const op = fadeIn(frame, pos.at, 4);
          return (
            <div
              key={pos.pair}
              style={{
                position: "absolute",
                left: 22,
                top: 52 + i * 96,
                width: 286,
                height: 96,
                borderBottom: i === 0 ? `1px solid ${BORDER}` : undefined,
                opacity: op,
                paddingTop: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <FlagPair a={pos.a} b={pos.b} size={19} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{pos.pair}</span>
                  <span style={{ ...tag, fontSize: 11.5 }}>{pos.side}</span>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: SUCCESS, ...tnum }}>
                  {pos.pnl}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 10,
                }}
              >
                <span style={{ fontSize: 12.5, color: TER, ...tnum }}>{pos.notional} notional</span>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 11.5, color: SUCCESS, fontWeight: 500 }}>Healthy</span>
                  <div
                    style={{
                      position: "relative",
                      width: 56,
                      height: 5,
                      borderRadius: 980,
                      backgroundColor: WELL,
                    }}
                  >
                    <div
                      style={{
                        width: 56 * pos.health * Math.min(1, op * 1.2),
                        height: 5,
                        borderRadius: 980,
                        backgroundColor: SUCCESS,
                      }}
                    />
                    {op >= 1 && (
                      <div
                        style={{
                          position: "absolute",
                          left: 56 * pos.health - 1,
                          top: -1,
                          width: 2,
                          height: 7,
                          backgroundColor: INK,
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

// Convenience wrapper: all six scenes in reference z-order.
export const CrxAppScenes: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill>
    <CrxScene3Dash frame={frame} />
    <CrxScene4Hedge frame={frame} />
    <CrxScene8Onboard frame={frame} />
    <CrxScene9Dealers frame={frame} />
    <CrxScene10Comply frame={frame} />
    <CrxScene12App frame={frame} />
  </AbsoluteFill>
);
