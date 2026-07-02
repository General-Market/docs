import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";

// ═══════════════════════════════════════════════════════════════
// PROPOSITION — "Full-bleed, the product is the set."
// The swap page of app.crxfx.com fills the whole 1280×720 frame,
// rebuilt from the real screenshot: sandbox banner, nav, "Open a
// hedge" card left-of-center, SIDE / TENOR / MARGIN TOKEN rail on
// the right. The copy lives on a glass panel that floats over the
// page and always keeps clear of the region the beat is about. The
// camera does slow purposeful push-ins only — it aims, settles,
// and holds. A cursor causes every state change.
//
// beat A f7–53   "Access rate locks"      — rate ticks, locks at f35
// beat B f61–103 "In Any Corridor"        — corridor picker → USD/BRL
// beat C f106–153 "At your preferred date and notional"
//                                          — tenor Jun 30 2027, types 2.5M
// ═══════════════════════════════════════════════════════════════

const { fontFamily: INTER } = loadInter("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});
const { fontFamily: POPPINS } = loadPoppins("normal", {
  weights: ["300"],
  subsets: ["latin"],
});

// ─── app.crxfx.com tokens (hex-resolved from globals.css) ───
const INK = "#1e1e2a";
const SEC = "#5b5b66";
const TER = "#8a8a96";
const TEAL = "#0fb6ab";
const TEAL_SOFT = "rgba(15, 182, 171, 0.10)";
const TEAL_RING = "rgba(15, 182, 171, 0.28)";
const WELL = "#f2f3f6";
const BG = "#f7f8fa";
const BORDER = "rgba(23, 23, 33, 0.08)";
const AMBER = "#c77d0a";
const BRASS = "#8a5d12";
const BRASS_RING = "rgba(192, 138, 46, 0.32)";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const flag = (cc: string) => staticFile(`crx-assets/flags/${cc}.svg`);

const label: React.CSSProperties = {
  fontFamily: INTER,
  fontSize: 11.5,
  fontWeight: 600,
  letterSpacing: 1.1,
  color: TER,
  textTransform: "uppercase",
};
const tnum: React.CSSProperties = { fontFeatureSettings: "'tnum'" };
const CARD_SHADOW =
  "0 1px 2px rgba(23,23,33,0.04), 0 10px 30px rgba(23,23,33,0.06)";

// Element settle: the reference physics (drop, exponential decay).
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
const stepSlide = (frame: number, steps: number[], dur = 5) => {
  let v = 0;
  for (const s of steps) {
    v += smooth(interpolate(frame, [s, s + dur], [0, 1], clamp));
  }
  return v;
};

// ─── camera: aim, push, settle, HOLD — never breathe ───
const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const seg = (f: number, a: number, b: number) =>
  EASE(interpolate(f, [a, b], [0, 1], clamp));

// Zooms about the focus point: the region of the beat stays pinned
// while the rest of the page slides gently past it.
const cameraAt = (f: number) => {
  const a = seg(f, 7, 34); // push toward the rate row
  const b = seg(f, 53, 64); // re-aim at the pair region
  const c = seg(f, 106, 134); // ease back out to 1.00
  const s = 1 + 0.05 * a + 0.006 * b - 0.056 * c;
  const fx = 560 + (438 - 560) * b + (640 - 438) * c;
  const fy = 446 + (366 - 446) * b + (380 - 366) * c;
  return { s, tx: (1 - s) * (fx - 640), ty: (1 - s) * (fy - 360) };
};

// ─── shared chrome (copied from CrxAppCards) ───
const CrxMark: React.FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 100 100" width={size} height={size}>
    <defs>
      <linearGradient id="fbCrxMark" gradientUnits="userSpaceOnUse" x1="50" y1="8" x2="50" y2="92">
        <stop offset="0" stopColor="#2AD4BB" />
        <stop offset="0.5" stopColor="#1CC8C6" />
        <stop offset="1" stopColor="#19B6DD" />
      </linearGradient>
    </defs>
    <g fill="none" stroke="url(#fbCrxMark)" strokeWidth="11" strokeLinecap="round">
      <line x1="50" y1="8" x2="50" y2="92" />
      <line x1="13.6" y1="71" x2="86.4" y2="29" />
      <line x1="13.6" y1="29" x2="86.4" y2="71" />
    </g>
  </svg>
);

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

// ─── cursor: the operator's hand (pattern from CrxAppCards) ───
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
}> = ({ frame, keys, clicks, appear }) => {
  if (frame < appear) return null;
  const { x, y } = cursorAt(frame, keys);
  const op = fadeIn(frame, appear, 4);
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

// ─── story data ───
const CORRIDORS = [
  { a: "us", b: "mx", pair: "USD/MXN", sub: "Dollars / Mexican pesos", rate: "17.5104", spot: "17.499" },
  { a: "us", b: "in", pair: "USD/INR", sub: "Dollars / Indian rupees", rate: "84.212", spot: "84.155" },
  { a: "us", b: "tr", pair: "USD/TRY", sub: "Dollars / Turkish lira", rate: "38.905", spot: "38.822" },
  { a: "us", b: "br", pair: "USD/BRL", sub: "Dollars / Brazilian reais", rate: "5.4310", spot: "5.418" },
];
const LOCK_AT = 35;
const SELECT_AT = 92; // the click that makes USD/BRL the pair
const HOVER_STEPS = [73, 80, 87];
const RATE_TICKS = ["17.5081", "17.5104", "17.5092", "17.5110", "17.5087", "17.5104"];
const SPOT_FLICK = ["1", "3", "0", "4", "2", "5"];
const TENOR_AT = 111; // tenor swap after the f110 click
const FOCUS_AT = 122; // notional field takes focus
const NOTIONAL = "2,500,000";
const TYPE_START = 126;
const ARM_AT = 144;

const CURSOR_KEYS: CursorKey[] = [
  { f: 55, x: 745, y: 300 },
  { f: 62, x: 672, y: 374 }, // "Change ⌄" on the pair well
  { f: 64, x: 672, y: 374 },
  { f: 68, x: 430, y: 456 }, // row 0 (USD/MXN)
  { f: 71, x: 430, y: 456 },
  { f: 76, x: 430, y: 504 }, // row 1
  { f: 78, x: 430, y: 504 },
  { f: 83, x: 430, y: 552 }, // row 2
  { f: 85, x: 430, y: 552 },
  { f: 90, x: 430, y: 600 }, // row 3 (USD/BRL) — click selects
  { f: 94, x: 430, y: 600 },
  { f: 108, x: 958, y: 368 }, // tenor well
  { f: 114, x: 958, y: 368 },
  { f: 121, x: 250, y: 245 }, // notional amount
  { f: 127, x: 348, y: 302 }, // rest aside while it types
  { f: 143, x: 438, y: 565 }, // settles on the armed CTA
  { f: 153, x: 438, y: 565 },
];
const CURSOR_CLICKS = [63, SELECT_AT, 110, FOCUS_AT];

// ─── the page, drawn full-bleed in page space (1280×720) ───

const Banner: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 0,
      width: 1280,
      height: 30,
      backgroundColor: AMBER,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      fontSize: 12.5,
      fontWeight: 500,
      color: "#fff",
    }}
  >
    <svg viewBox="0 0 24 24" width={12} height={12}>
      <path
        d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    Sandbox — Base Sepolia testnet. No real funds at risk.
  </div>
);

const NAV_TABS = ["Swap", "Transfer", "Portfolio", "Compliance"];

const Nav: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 30,
      width: 1280,
      height: 58,
      backgroundColor: "#fff",
      borderBottom: `1px solid ${BORDER}`,
      display: "flex",
      alignItems: "center",
      padding: "0 32px",
    }}
  >
    <CrxMark size={22} />
    <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.6, marginLeft: 9 }}>CRX</span>
    <div style={{ display: "flex", gap: 6, marginLeft: 36 }}>
      {NAV_TABS.map((t) => {
        const active = t === "Swap";
        return (
          <div
            key={t}
            style={{
              fontSize: 14,
              fontWeight: active ? 600 : 500,
              color: active ? INK : SEC,
              padding: "8px 14px",
              borderRadius: 10,
              backgroundColor: active ? "#eef0f3" : undefined,
            }}
          >
            {t}
            {!active && <span style={{ color: TER, fontSize: 12, marginLeft: 5 }}>⌄</span>}
          </div>
        );
      })}
    </div>
    <div
      style={{
        marginLeft: "auto",
        backgroundColor: TEAL,
        color: "#fff",
        fontSize: 13.5,
        fontWeight: 600,
        borderRadius: 980,
        padding: "10px 20px",
      }}
    >
      Connect wallet
    </div>
  </div>
);

// Hedge card — x128 y118 w620 h500, padding 26. All positions absolute
// in page space so the dropdown and cursor share one coordinate system.
const HedgeCard: React.FC<{ frame: number }> = ({ frame }) => {
  const cor = CORRIDORS[frame < SELECT_AT ? 0 : 3];
  const reQuote = frame >= SELECT_AT ? settle(frame, SELECT_AT + 1, 9, 0.74) : {};

  // Beat A — rate ticks until it locks at f35; the re-quote re-rates it.
  const locked = frame >= LOCK_AT;
  const rate = !locked
    ? RATE_TICKS[Math.floor(frame / 4) % RATE_TICKS.length]
    : cor.rate;
  const lockPulse =
    interpolate(frame, [LOCK_AT, LOCK_AT + 3], [0, 1], clamp) *
    interpolate(frame, [48, 58], [1, 0], clamp);

  // Spot keeps breathing — the market moves, the locked rate does not.
  const spot = cor.spot + SPOT_FLICK[Math.floor(frame / 5) % SPOT_FLICK.length];

  // Beat C — notional focus + typing.
  const focused = frame >= FOCUS_AT;
  const typedChars =
    frame < TYPE_START
      ? 0
      : Math.min(Math.floor((frame - TYPE_START) / 2) + 1, NOTIONAL.length);
  const typing = typedChars > 0 && typedChars < NOTIONAL.length;
  const caretOn = focused && (typing || Math.floor(frame / 8) % 2 === 0);
  const wellRing =
    fadeIn(frame, FOCUS_AT, 3) * interpolate(frame, [146, 152], [1, 0], clamp);
  const armed = frame >= ARM_AT;
  const ctaSettle = armed ? settle(frame, ARM_AT, 6, 0.72) : {};

  const tenorDate = frame < TENOR_AT ? "Aug 1, 2026" : "Jun 30, 2027";

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 128,
          top: 118,
          width: 620,
          height: 500,
          backgroundColor: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: 16,
          boxShadow: CARD_SHADOW,
        }}
      />
      <div style={{ position: "absolute", left: 154, top: 140, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: TER, fontSize: 19, lineHeight: 1 }}>‹</span>
        <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: -0.3 }}>Open a hedge</span>
      </div>

      {/* Forward notional well */}
      <div
        style={{
          position: "absolute",
          left: 154,
          top: 182,
          width: 568,
          height: 122,
          backgroundColor: WELL,
          borderRadius: 14,
          padding: "15px 20px",
          boxShadow: wellRing > 0 ? `0 0 0 3px rgba(15,182,171,${(0.28 * wellRing).toFixed(3)})` : undefined,
        }}
      >
        <div style={label}>Forward notional</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              fontSize: 34,
              fontWeight: 600,
              letterSpacing: -0.8,
              marginTop: 3,
              color: typedChars > 0 ? INK : TER,
              ...tnum,
            }}
          >
            {typedChars > 0 ? NOTIONAL.slice(0, typedChars) : focused ? "" : "0.0"}
            {caretOn && <span style={{ color: TEAL, fontWeight: 400, marginLeft: 1 }}>|</span>}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              backgroundColor: "#fff",
              border: `1px solid ${BORDER}`,
              borderRadius: 980,
              padding: "6px 14px 6px 8px",
            }}
          >
            <UsdcMark size={22} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>USDC</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: TEAL }} />
          <span style={{ fontSize: 12.5, color: SEC, ...tnum }}>
            Spot price {spot} {cor.pair.slice(4)}
          </span>
        </div>
      </div>

      {/* PAIR well */}
      <div
        style={{
          position: "absolute",
          left: 154,
          top: 318,
          width: 568,
          height: 100,
          backgroundColor: WELL,
          borderRadius: 14,
          padding: "13px 16px",
        }}
      >
        <div style={{ ...label, marginLeft: 4 }}>Pair</div>
        <div
          style={{
            marginTop: 8,
            height: 52,
            backgroundColor: "#fff",
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, ...reQuote }}>
            <FlagPair a={cor.a} b={cor.b} />
            <div>
              <div style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.15 }}>{cor.pair}</div>
              <div style={{ fontSize: 12, color: TER }}>{cor.sub}</div>
            </div>
          </div>
          <span style={{ fontSize: 13, color: SEC }}>Change ⌄</span>
        </div>
      </div>

      {/* Forward rate row — beat A's object. Brass is the binding moment. */}
      <div
        style={{
          position: "absolute",
          left: 154,
          top: 430,
          width: 568,
          height: 46,
          backgroundColor: WELL,
          borderRadius: 12,
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: lockPulse > 0 ? `0 0 0 3px ${BRASS_RING}` : undefined,
          outline: lockPulse > 0 ? `1.5px solid rgba(192,138,46,${lockPulse.toFixed(2)})` : undefined,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: SEC }}>Forward rate</span>
          {!locked ? (
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: TER,
                backgroundColor: "#fff",
                border: `1px solid ${BORDER}`,
                borderRadius: 980,
                padding: "3px 10px",
                opacity: 0.75 + 0.25 * Math.sin(frame / 3),
              }}
            >
              Indicative
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                backgroundColor: "rgba(192,138,46,0.12)",
                borderRadius: 980,
                padding: "3.5px 10px",
                ...settle(frame, LOCK_AT, 12, 0.74),
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
              <span style={{ fontSize: 12, fontWeight: 600, color: BRASS }}>
                Locked · firm 120s
              </span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, ...(frame >= SELECT_AT ? reQuote : {}) }}>
          <span style={{ fontSize: 16, fontWeight: 600, ...tnum }}>{rate}</span>
          <span style={{ fontSize: 12, color: TER }}>{cor.pair.slice(4)} per USD</span>
        </div>
      </div>

      {/* Convert line */}
      <div
        style={{
          position: "absolute",
          left: 128,
          top: 500,
          width: 620,
          textAlign: "center",
          fontSize: 12,
          color: SEC,
          ...tnum,
          ...(frame >= SELECT_AT ? reQuote : {}),
        }}
      >
        Convert {cor.pair.slice(4)} → USD on {tenorDate} at the {locked ? "locked" : "quoted"} rate
      </div>

      {/* CTA */}
      <div
        style={{
          position: "absolute",
          left: 154,
          top: 538,
          width: 568,
          height: 54,
          borderRadius: 14,
          backgroundColor: armed ? TEAL : "#a9e4de",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 15.5,
          fontWeight: 600,
          color: "#fff",
        }}
      >
        <span style={{ ...ctaSettle }}>{armed ? "Request quotes" : "Enter an amount"}</span>
      </div>
    </>
  );
};

// Right rail — SIDE / TENOR / MARGIN TOKEN, x772 w380.
const railCard = (top: number, height: number): React.CSSProperties => ({
  position: "absolute",
  left: 772,
  top,
  width: 380,
  height,
  backgroundColor: "#fff",
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  boxShadow: CARD_SHADOW,
  padding: "18px 20px",
});

const TOKENS = [
  { name: "USDC", sub: "USD Coin", selected: true },
  { name: "USDT", sub: "Tether", bg: "#26A17B", glyph: "T" },
  { name: "aUSD", sub: "Agora Dollar", bg: "#c9a24b", glyph: "a" },
  { name: "EURC", sub: "Euro Coin", bg: "#2775CA", glyph: "€" },
];

const RightRail: React.FC<{ frame: number }> = ({ frame }) => {
  const tenorFocus =
    interpolate(frame, [109, 112], [0, 1], clamp) *
    interpolate(frame, [124, 130], [1, 0], clamp);
  const tenor =
    frame < TENOR_AT
      ? ["Aug 1, 2026", "30 days from today"]
      : ["Jun 30, 2027", "363 days from today"];
  const tenorSwap = frame >= TENOR_AT ? settle(frame, TENOR_AT, 8, 0.74) : {};
  return (
    <>
      {/* SIDE */}
      <div style={railCard(118, 158)}>
        <div style={label}>Side</div>
        <div
          style={{
            position: "absolute",
            left: 20,
            top: 44,
            width: 340,
            height: 46,
            borderRadius: 12,
            backgroundColor: "rgba(15,182,171,0.04)",
            boxShadow: `inset 0 0 0 1.6px ${TEAL}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: TEAL }}>Buy / Long</span>
          <Check size={15} color={TEAL} stroke={14} />
        </div>
        <div
          style={{
            position: "absolute",
            left: 20,
            top: 98,
            width: 340,
            height: 46,
            borderRadius: 12,
            backgroundColor: WELL,
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            fontSize: 14,
            fontWeight: 500,
            color: INK,
          }}
        >
          Sell / Short
        </div>
      </div>

      {/* TENOR */}
      <div style={railCard(296, 122)}>
        <div style={label}>Tenor</div>
        <div
          style={{
            position: "absolute",
            left: 20,
            top: 44,
            width: 340,
            height: 56,
            borderRadius: 12,
            backgroundColor: WELL,
            display: "flex",
            alignItems: "center",
            gap: 11,
            padding: "0 14px",
            boxShadow:
              tenorFocus > 0
                ? `0 0 0 3px rgba(15,182,171,${(0.28 * tenorFocus).toFixed(3)})`
                : undefined,
          }}
        >
          <svg viewBox="0 0 24 24" width={16} height={16}>
            <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" fill="none" stroke={TER} strokeWidth="1.8" />
            <line x1="3.5" y1="10" x2="20.5" y2="10" stroke={TER} strokeWidth="1.8" />
            <line x1="8" y1="3" x2="8" y2="7" stroke={TER} strokeWidth="1.8" strokeLinecap="round" />
            <line x1="16" y1="3" x2="16" y2="7" stroke={TER} strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <div style={{ flex: 1, ...tenorSwap }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.2, ...tnum }}>{tenor[0]}</div>
            <div style={{ fontSize: 11.5, color: TER }}>{tenor[1]}</div>
          </div>
          <span style={{ color: TER, fontSize: 13 }}>⌄</span>
        </div>
      </div>

      {/* MARGIN TOKEN */}
      <div style={railCard(438, 180)}>
        <div style={label}>Margin token</div>
        {TOKENS.map((t, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          return (
            <div
              key={t.name}
              style={{
                position: "absolute",
                left: 20 + col * 175,
                top: 44 + row * 64,
                width: 165,
                height: 54,
                borderRadius: 12,
                backgroundColor: t.selected ? "#fff" : WELL,
                boxShadow: t.selected ? `inset 0 0 0 1.6px ${TEAL}` : undefined,
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "0 12px",
              }}
            >
              {t.selected ? (
                <UsdcMark size={26} />
              ) : (
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: t.bg,
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {t.glyph}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{t.name}</div>
                <div style={{ fontSize: 10.5, color: TER }}>{t.sub}</div>
              </div>
              {t.selected && <Check size={14} color={TEAL} stroke={14} />}
            </div>
          );
        })}
      </div>
    </>
  );
};

// Corridor dropdown — anchored under the pair well during beat B.
const CorridorDropdown: React.FC<{ frame: number }> = ({ frame }) => {
  const panelIn = fadeIn(frame, 64, 3) * interpolate(frame, [93, 97], [1, 0], clamp);
  if (frame < 64 || frame >= 97 || panelIn <= 0) return null;
  const hoverIdx = stepSlide(frame, HOVER_STEPS, 5);
  const hoverOp = fadeIn(frame, 68, 3);
  const selIdx = frame < SELECT_AT ? 0 : 3;
  return (
    <div
      style={{
        position: "absolute",
        left: 154,
        top: 424,
        width: 568,
        borderRadius: 14,
        backgroundColor: "#fff",
        border: `1px solid ${BORDER}`,
        boxShadow: "0 18px 44px rgba(28,28,35,0.16), 0 2px 8px rgba(28,28,35,0.08)",
        padding: 8,
        opacity: panelIn,
        transform: `scaleY(${(0.96 + 0.04 * panelIn).toFixed(3)})`,
        transformOrigin: "center top",
      }}
    >
      {hoverOp > 0 && (
        <div
          style={{
            position: "absolute",
            left: 8,
            top: 8 + 48 * hoverIdx,
            width: 552,
            height: 48,
            borderRadius: 10,
            backgroundColor: TEAL_SOFT,
            boxShadow: `inset 0 0 0 1.5px ${TEAL_RING}`,
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
            height: 48,
            padding: "0 14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <FlagPair a={c.a} b={c.b} size={20} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>{c.pair}</span>
            <span style={{ fontSize: 12.5, color: TER }}>{c.sub}</span>
          </div>
          {selIdx === i && <Check size={16} color={TEAL} stroke={14} />}
        </div>
      ))}
    </div>
  );
};

// ─── the glass copy panel — screen space, never over the active region ───
type CopyWordSpec = { t: string; f: number };

// The master cut's word physics, scaled to 40px copy: −38px drop, 0.74 decay,
// full opacity from the start frame.
const copyWord = (frame: number, start: number): React.CSSProperties => {
  if (frame < start) return { opacity: 0 };
  const dt = frame - start;
  return {
    transform: `translateY(${(-(38 * Math.pow(0.74, dt))).toFixed(2)}px)`,
    opacity: 1,
  };
};

const GlassPanel: React.FC<{
  frame: number;
  x: number;
  y: number;
  w: number;
  h: number;
  inAt: number;
  outAt?: number; // fully gone by this frame
  lines: CopyWordSpec[][];
}> = ({ frame, x, y, w, h, inAt, outAt, lines }) => {
  let op = fadeIn(frame, inAt, 3);
  if (outAt !== undefined) {
    op *= interpolate(frame, [outAt - 4, outAt], [1, 0], clamp);
    if (frame >= outAt) return null;
  }
  if (op <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.80)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        border: `1px solid ${BORDER}`,
        boxShadow: "0 12px 40px rgba(30,30,42,0.10)",
        opacity: op,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 36px",
        overflow: "hidden",
      }}
    >
      {lines.map((words, li) => (
        <div
          key={li}
          style={{
            fontFamily: POPPINS,
            fontWeight: 300,
            fontSize: 40,
            lineHeight: 1.25,
            color: INK,
            whiteSpace: "pre",
          }}
        >
          {words.map((w, i) => (
            <span
              key={i}
              style={{ display: "inline-block", whiteSpace: "pre", ...copyWord(frame, w.f) }}
            >
              {w.t + (i < words.length - 1 ? " " : "")}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};

// ─── composition ───
export const FullBleedProp: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = cameraAt(frame);
  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: INTER, color: INK }}>
      {/* the page — camera zooms about the beat's region */}
      <div
        style={{
          position: "absolute",
          width: 1280,
          height: 720,
          backgroundColor: BG,
          transformOrigin: "640px 360px",
          transform: `translate(${cam.tx.toFixed(2)}px, ${cam.ty.toFixed(2)}px) scale(${cam.s.toFixed(4)})`,
        }}
      >
        <Banner />
        <Nav />
        <HedgeCard frame={frame} />
        <RightRail frame={frame} />
        <CorridorDropdown frame={frame} />
        <Cursor frame={frame} keys={CURSOR_KEYS} clicks={CURSOR_CLICKS} appear={55} />
      </div>

      {/* beat A — over the rail's SIDE card; the rate row stays clear */}
      <GlassPanel
        frame={frame}
        x={756}
        y={150}
        w={424}
        h={110}
        inAt={4}
        outAt={53}
        lines={[
          [
            { t: "Access", f: 7 },
            { t: "rate", f: 11 },
            { t: "locks", f: 15 },
          ],
        ]}
      />
      {/* beat B — same slot; the pair well and dropdown stay clear */}
      <GlassPanel
        frame={frame}
        x={756}
        y={150}
        w={424}
        h={110}
        inAt={58}
        outAt={103}
        lines={[
          [
            { t: "In", f: 61 },
            { t: "Any", f: 65 },
            { t: "Corridor", f: 69 },
          ],
        ]}
      />
      {/* beat C — spans the pair + rate rows exactly (both idle in this
          beat) so it never slices a row mid-glyph; tenor, notional and
          CTA stay clear */}
      <GlassPanel
        frame={frame}
        x={154}
        y={322}
        w={568}
        h={172}
        inAt={103}
        lines={[
          [
            { t: "At", f: 106 },
            { t: "your", f: 110 },
            { t: "preferred", f: 114 },
          ],
          [
            { t: "date", f: 118 },
            { t: "and", f: 121 },
            { t: "notional", f: 125 },
          ],
        ]}
      />
    </AbsoluteFill>
  );
};

export const fullBleedPropMeta = {
  id: "CRX-Anoma-Prop-Full",
  component: FullBleedProp,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 153,
};
