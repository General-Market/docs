/**
 * FxScreenSequence — the MacBook's screen, played as a real trade.
 *
 * 2560×1600 (the screen texture's native 16:10), 150 frames @30fps. Rendered
 * ONCE to a PNG sequence (public/fx-screenseq/f{n}.png) which FxHedgingSquare
 * draws frame-exact into the 3D screen canvas. DOM, not canvas drawing.
 *
 * The page is app.crxfx.com/swap rebuilt full-bleed — no page margins, the
 * trade UI fills the display — in the app's own tokens (CrxCardKit, hex-
 * resolved from ui/frontend) fused with the CRX-Anoma film's motion grammar:
 * the Catmull-Rom cursor with click ripples, char-by-char typing with seeded
 * jitter, settle() physics on populating rows, and the Scene-9 RFQ card with
 * dealer quotes rolling in and the best rate ringed.
 *
 * Layout: logical 1280×800, scaled ×2 to the texture. Left card = "Open a
 * hedge" (the real /swap form: notional, pair, locked collateral, CTA).
 * Right column = SIDE / TENOR / MARGIN TOKEN (the real page), which cuts to
 * the film's "Request for quote" card when the CTA is pressed.
 *
 * ── Timing table (frames, 30fps — the ONE place to retune the story) ──
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { DIATYPE } from "../replicates/anoma/diatype";
import { clamp } from "../replicates/anoma/AnomaComposition";
import {
  BG,
  BORDER,
  BORDER_STRONG,
  BRASS,
  BRASS_SOFT,
  Check,
  CrxMark,
  FOCUS_RING,
  FlagPair,
  INK,
  SEC,
  SUCCESS,
  SURFACE2,
  TEAL,
  TEAL_HOVER,
  TEAL_RING,
  TEAL_SOFT,
  TER,
  UsdcMark,
  UsdtMark,
  WELL,
  cursorAt,
  fadeIn,
  label,
  settle,
  smooth,
  tag,
  type CursorKey,
} from "../replicates/anoma/CrxCardKit";

// ═══ THE timing table ═══════════════════════════════════════════════════
export const SEQ = {
  cursorAppear: 45, // cursor flies in on the spline (lid has settled)
  notionalClick: 54, // click ripple on the notional field — focus ring on
  typeStart: 57, // first digit of 250,000
  typeEnd: 74, // 6th digit lands — "250,000" complete
  collateralAt: 76, // Locked collateral 2.5% · $6,250 settles in; CTA arms
  ctaClick: 88, // "Request quotes" pressed (dip + ripple + 0.98 press)
  rfqSwap: 93, // right column cuts to the RFQ card, skeletons pulsing
  quoteLands: [102, 114, 126], // dealer rates roll in, one per dealer
  bestAt: 136, // best-rate ring + non-best dim
  // f140–150: hold — nothing moves but the spot flicker and skeleton pulse
} as const;

// ═══ trade data ═══
const NOTIONAL_DIGITS = "250000"; // typed one digit at a time → "250,000"
const SPOT_BASE = "17.472"; // + flickering last digit → "17.4724" etc.
const SPOT_FLICK = ["4", "6", "3", "7", "5", "4"]; // deterministic, film-style
const TENOR_LINE = ["Aug 11, 2026", "30 days from today"];
const DEALERS = [
  { name: "Dealer 1", sub: "Tier-1 bank", rate: 17.6412, lands: SEQ.quoteLands[0], t: "0.6s" },
  { name: "Dealer 2", sub: "Global FX desk", rate: 17.6288, lands: SEQ.quoteLands[1], t: "0.8s" },
  { name: "Dealer 3", sub: "Regional specialist", rate: 17.6351, lands: SEQ.quoteLands[2], t: "1.1s" },
];
const BEST = 1; // converting MXN → USD: fewest pesos per dollar wins

// ═══ typing cadence — the film's seeded-jitter keystrokes, re-pinned ═══
const keyJitter = (i: number) => {
  let h = Math.imul(i + 1, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h ^= h >>> 13;
  return ((h >>> 0) % 1000) / 1000;
};
const TYPE_KEYFRAMES: number[] = (() => {
  const gaps: number[] = [];
  for (let i = 1; i < NOTIONAL_DIGITS.length; i++) {
    const jitter = (keyJitter(i) - 0.5) * 2.0;
    const hesitation = i === NOTIONAL_DIGITS.length - 1 ? 1.8 : 0;
    gaps.push(3.0 + jitter + hesitation);
  }
  const total = gaps.reduce((s, g) => s + g, 0);
  const scale = (SEQ.typeEnd - SEQ.typeStart) / total;
  const frames = [SEQ.typeStart as number];
  let acc: number = SEQ.typeStart;
  for (let j = 0; j < gaps.length; j++) {
    acc += gaps[j] * scale;
    frames.push(j === gaps.length - 1 ? SEQ.typeEnd : acc);
  }
  return frames;
})();
const formatAmount = (digits: number) =>
  NOTIONAL_DIGITS.slice(0, digits).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// ═══ cursor flight — screen-global logical coords, clicks on the table ═══
const CURSOR_KEYS: CursorKey[] = [
  { f: SEQ.cursorAppear, x: 1300, y: 700 }, // enters from the lower right
  { f: 49, x: 900, y: 420 }, // arcs across the page
  { f: 52, x: 320, y: 262 }, // arrives at the notional figure
  { f: SEQ.notionalClick, x: 320, y: 262 }, // click — focus
  { f: 60, x: 545, y: 335 }, // rests aside while the amount types
  { f: 80, x: 420, y: 600 }, // approaches the CTA
  { f: 84, x: 390, y: 694 }, // hand settles over "Request quotes"
  { f: SEQ.ctaClick, x: 390, y: 694 }, // press
  { f: 98, x: 700, y: 560 }, // drifts toward the quotes
  { f: 118, x: 1030, y: 520 }, // rests beside the dealer list
  { f: 134, x: 1014, y: 420 }, // hovers the winning row as it rings
];
const CURSOR_CLICKS = [SEQ.notionalClick, SEQ.ctaClick];

// The film's cursor, sized up for the laptop-screen viewing distance: same
// spline (cursorAt), same click grammar (3f dip, 9f ripple), same arrow path —
// only the scale differs, because this DOM is watched from across a desk.
const CURSOR_SCALE = 2.1;
const ScreenCursor: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < SEQ.cursorAppear) return null;
  const { x, y } = cursorAt(frame, CURSOR_KEYS);
  const op = fadeIn(frame, SEQ.cursorAppear, 4);
  let dip = 1;
  const rings: { p: number; cx: number; cy: number }[] = [];
  for (const c of CURSOR_CLICKS) {
    if (frame >= c && frame < c + 3) dip = 0.85;
    if (frame >= c && frame < c + 9) {
      const at = cursorAt(c, CURSOR_KEYS);
      rings.push({ p: (frame - c) / 9, cx: at.x, cy: at.y });
    }
  }
  const S = CURSOR_SCALE;
  return (
    <>
      {rings.map((ring, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: ring.cx - (14 * ring.p + 3) * S,
            top: ring.cy - (14 * ring.p + 3) * S,
            width: (28 * ring.p + 6) * S,
            height: (28 * ring.p + 6) * S,
            borderRadius: "50%",
            border: `${(1.6 * S).toFixed(1)}px solid rgba(30,30,42,0.30)`,
            opacity: 1 - ring.p,
          }}
        />
      ))}
      <svg
        viewBox="0 0 14 20"
        width={15 * S}
        height={21 * S}
        style={{
          position: "absolute",
          left: x - 1,
          top: y - 1,
          opacity: op,
          transform: `scale(${dip})`,
          transformOrigin: "2px 2px",
          filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.28))",
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

// ═══ small chrome ═══
const CoinDisc: React.FC<{ bg: string; glyph: string; size?: number }> = ({
  bg,
  glyph,
  size = 34,
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      backgroundColor: bg,
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.52,
      fontWeight: 700,
      flexShrink: 0,
      boxShadow: `0 0 0 1px ${BORDER}`,
    }}
  >
    {glyph}
  </div>
);

const CARD_SHADOW_FULL =
  "0 1px 2px rgba(28, 28, 35, 0.04), 0 14px 36px -10px rgba(28, 28, 35, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04)";

const Panel: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  opacity?: number;
  children: React.ReactNode;
}> = ({ x, y, w, h, opacity = 1, children }) => {
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 24,
        backgroundColor: "#fff",
        boxShadow: CARD_SHADOW_FULL,
        opacity,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
};

const eyebrow: React.CSSProperties = { ...label, fontSize: 15, letterSpacing: "0.08em" };

// ═══ layout constants (logical 1280×800) ═══
const NAV_H = 60;
const PAD = 26; // page gutter
const LEFT = { x: PAD, y: NAV_H + 22, w: 726, h: 692 };
const RIGHT = { x: 778, y: NAV_H + 22, w: 476, h: 692 };
const R_GAP = 16;
const SIDE_H = 186;
const TENOR_H = 148;
const MARGIN_H = RIGHT.h - SIDE_H - TENOR_H - R_GAP * 2; // fills the column

// ═══ the composition ═══
export const FxScreenSequence: React.FC = () => {
  const frame = useCurrentFrame();

  // ── typing state (film grammar) ──
  const focused = frame >= SEQ.notionalClick;
  const typedDigits =
    frame < SEQ.typeStart ? 0 : TYPE_KEYFRAMES.filter((f) => frame >= f).length;
  const typedStr = formatAmount(typedDigits);
  const typing = typedDigits > 0 && typedDigits < NOTIONAL_DIGITS.length;
  const caretOn =
    focused && frame < SEQ.ctaClick && (typing || Math.floor(frame / 8) % 2 === 0);

  // ── spot flicker — the market breathes, deterministic ──
  const spot = SPOT_BASE + SPOT_FLICK[Math.floor(frame / 5) % SPOT_FLICK.length];

  // ── collateral row + CTA ──
  const collateralIn = frame >= SEQ.collateralAt;
  const armed = frame >= SEQ.collateralAt;
  const ctaPressed = frame >= SEQ.ctaClick && frame < SEQ.ctaClick + 4;

  // ── RFQ phase ──
  const rfq = frame >= SEQ.rfqSwap;
  const rfqIn = fadeIn(frame, SEQ.rfqSwap, 3);
  const rated = frame >= DEALERS[0].lands;
  const allIn = frame >= DEALERS[2].lands;
  const highlighted = frame >= SEQ.bestAt;
  const countdown = rated ? 120 - Math.floor((frame - DEALERS[0].lands) / 30) : 120;

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <div
        style={{
          width: 1280,
          height: 800,
          position: "relative",
          transform: "scale(2)",
          transformOrigin: "top left",
          fontFamily: DIATYPE,
          color: INK,
        }}
      >
        {/* ── nav bar — the real app chrome ── */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 1280,
            height: NAV_H,
            backgroundColor: "#fff",
            borderBottom: `1px solid ${BORDER}`,
            display: "flex",
            alignItems: "center",
            padding: "0 28px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CrxMark size={26} />
            <span style={{ fontSize: 21, fontWeight: 700, letterSpacing: 6 }}>CRX</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 40 }}>
            <div
              style={{
                backgroundColor: SURFACE2,
                borderRadius: 10,
                padding: "8px 18px",
                fontSize: 16.5,
                fontWeight: 700,
              }}
            >
              Swap
            </div>
            {["Transfer", "Portfolio", "Compliance"].map((it) => (
              <div key={it} style={{ padding: "8px 16px", fontSize: 16.5, color: SEC }}>
                {it} <span style={{ fontSize: 12, color: TER }}>⌄</span>
              </div>
            ))}
          </div>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 9,
              border: `1px solid ${BORDER}`,
              backgroundColor: SURFACE2,
              borderRadius: 980,
              padding: "8px 18px",
              fontSize: 15.5,
              color: SEC,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: SUCCESS }} />
            0x7e2B…c23a
          </div>
        </div>

        {/* ── left card: Open a hedge (the real /swap form, full-bleed) ── */}
        <Panel x={LEFT.x} y={LEFT.y} w={LEFT.w} h={LEFT.h}>
          <div style={{ position: "absolute", inset: 0, padding: "26px 32px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: TER, fontSize: 22, lineHeight: 1 }}>‹</span>
              <span style={{ fontSize: 25, fontWeight: 700, letterSpacing: -0.4 }}>
                Open a hedge
              </span>
            </div>

            {/* forward notional well */}
            <div
              style={{
                position: "absolute",
                left: 32,
                top: 78,
                width: LEFT.w - 64,
                height: 168,
                backgroundColor: WELL,
                borderRadius: 20,
                padding: "20px 26px",
                boxShadow:
                  focused && frame < SEQ.typeEnd + 8 ? FOCUS_RING : undefined,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ fontSize: 17, color: TER }}>Forward notional</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15 }}>
                  <span style={{ color: TER }}>Balance $30,440</span>
                  <span style={{ color: TEAL, fontWeight: 700 }}>Max</span>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 2,
                }}
              >
                <div
                  style={{
                    fontSize: 58,
                    fontWeight: typedDigits > 0 ? 700 : 400,
                    letterSpacing: -1.6,
                    color: typedDigits > 0 ? INK : "#b8bac4",
                    lineHeight: 1.1,
                  }}
                >
                  {typedDigits > 0 ? typedStr : focused ? "" : "0.0"}
                  {caretOn && (
                    <span style={{ color: TEAL, fontWeight: 400, marginLeft: 2 }}>|</span>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    backgroundColor: "#fff",
                    border: `1px solid ${BORDER}`,
                    borderRadius: 980,
                    padding: "9px 20px 9px 10px",
                  }}
                >
                  <UsdcMark size={32} />
                  <span style={{ fontSize: 20, fontWeight: 700 }}>USDC</span>
                </div>
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}
              >
                <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TEAL }} />
                <span style={{ fontSize: 16, color: SEC }}>
                  Spot price{" "}
                  <span style={{ color: INK, fontWeight: 700 }}>{spot} MXN</span> · indicative
                </span>
              </div>
            </div>

            {/* pair well */}
            <div
              style={{
                position: "absolute",
                left: 32,
                top: 264,
                width: LEFT.w - 64,
                height: 122,
                backgroundColor: WELL,
                borderRadius: 20,
                padding: "14px 26px 0 26px",
              }}
            >
              <div style={eyebrow}>Pair</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 8,
                  backgroundColor: "#fff",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 12,
                  padding: "9px 18px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <FlagPair a="us" b="mx" size={38} />
                  <div>
                    <div style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.15 }}>
                      USD/MXN
                    </div>
                    <div style={{ fontSize: 15.5, color: TER }}>Dollars / Mexican pesos</div>
                  </div>
                </div>
                <span style={{ fontSize: 17, color: SEC }}>Change ⌄</span>
              </div>
            </div>

            {/* locked collateral — populates when the amount is in */}
            <div
              style={{
                position: "absolute",
                left: 32,
                top: 404,
                width: LEFT.w - 64,
                height: 74,
                backgroundColor: WELL,
                borderRadius: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 26px",
              }}
            >
              <span style={{ fontSize: 18, color: SEC }}>Locked collateral</span>
              {collateralIn ? (
                <span style={{ fontSize: 18, ...settle(frame, SEQ.collateralAt, 10, 0.74) }}>
                  <span style={{ fontWeight: 700 }}>2.5%</span>
                  <span style={{ color: SEC }}> · $6,250</span>
                </span>
              ) : (
                <span style={{ fontSize: 18, color: TER }}>—</span>
              )}
            </div>

            <div
              style={{
                position: "absolute",
                left: 0,
                width: LEFT.w,
                top: 508,
                textAlign: "center",
                fontSize: 16.5,
                color: SEC,
              }}
            >
              Convert MXN → USD on {TENOR_LINE[0]} at the quoted rate
            </div>

            {/* CTA — the app's swap primary, armed and pressed on the table */}
            <div
              style={{
                position: "absolute",
                left: 32,
                top: 556,
                width: LEFT.w - 64,
                height: 76,
                borderRadius: 20,
                backgroundColor: ctaPressed ? TEAL_HOVER : TEAL,
                opacity: armed ? 1 : 0.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 21,
                color: "#fff",
                transform: ctaPressed ? "scale(0.98)" : undefined,
              }}
            >
              <span style={armed ? settle(frame, SEQ.collateralAt, 8, 0.72) : undefined}>
                {armed ? "Request quotes" : "Enter an amount"}
              </span>
            </div>
          </div>
        </Panel>

        {/* ── right column, phase A: SIDE / TENOR / MARGIN (the real page) ── */}
        {!rfq && (
          <>
            <Panel x={RIGHT.x} y={RIGHT.y} w={RIGHT.w} h={SIDE_H}>
              <div style={{ padding: "22px 26px" }}>
                <div style={eyebrow}>Side</div>
                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "#fff",
                    border: `1px solid ${TEAL}`,
                    boxShadow: `0 0 0 1px ${TEAL_RING}`,
                    borderRadius: 12,
                    padding: "12px 18px",
                    color: TEAL,
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  Buy / Long
                  <Check size={20} color={TEAL} stroke={14} />
                </div>
                <div
                  style={{
                    marginTop: 10,
                    border: `1px solid ${BORDER_STRONG}`,
                    borderRadius: 12,
                    padding: "12px 18px",
                    fontSize: 18,
                    color: INK,
                  }}
                >
                  Sell / Short
                </div>
              </div>
            </Panel>

            <Panel x={RIGHT.x} y={RIGHT.y + SIDE_H + R_GAP} w={RIGHT.w} h={TENOR_H}>
              <div style={{ padding: "22px 26px" }}>
                <div style={eyebrow}>Tenor</div>
                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: WELL,
                    borderRadius: 12,
                    padding: "12px 18px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <svg viewBox="0 0 24 24" width={22} height={22}>
                      <rect x="3" y="5" width="18" height="16" rx="2.5" fill="none" stroke={TER} strokeWidth="2" />
                      <line x1="3" y1="10" x2="21" y2="10" stroke={TER} strokeWidth="2" />
                      <line x1="8" y1="2.5" x2="8" y2="6.5" stroke={TER} strokeWidth="2" strokeLinecap="round" />
                      <line x1="16" y1="2.5" x2="16" y2="6.5" stroke={TER} strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <div>
                      <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.15 }}>
                        {TENOR_LINE[0]}
                      </div>
                      <div style={{ fontSize: 14.5, color: TER }}>{TENOR_LINE[1]}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 16, color: TER }}>⌄</span>
                </div>
              </div>
            </Panel>

            <Panel
              x={RIGHT.x}
              y={RIGHT.y + SIDE_H + TENOR_H + R_GAP * 2}
              w={RIGHT.w}
              h={MARGIN_H}
            >
              <div style={{ padding: "22px 26px" }}>
                <div style={eyebrow}>Margin token</div>
                <div
                  style={{
                    marginTop: 12,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  {[
                    { mark: <UsdcMark size={34} />, name: "USDC", sub: "USD Coin", sel: true },
                    { mark: <UsdtMark size={34} />, name: "USDT", sub: "Tether", sel: false },
                    { mark: <CoinDisc bg="#111114" glyph="e" />, name: "USTRY", sub: "Etherfuse US Tre…", sel: false },
                    { mark: <CoinDisc bg="#9a8a4a" glyph="a" />, name: "aUSD", sub: "Agora Dollar", sel: false },
                  ].map((tkn) => (
                    <div
                      key={tkn.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        border: tkn.sel ? `1px solid ${TEAL}` : `1px solid ${BORDER_STRONG}`,
                        boxShadow: tkn.sel ? `0 0 0 1px ${TEAL_RING}` : undefined,
                        borderRadius: 12,
                        padding: "11px 14px",
                      }}
                    >
                      {tkn.mark}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 16.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
                          {tkn.name}
                          {tkn.sel && <Check size={15} color={TEAL} stroke={14} />}
                        </div>
                        <div style={{ fontSize: 13, color: TER, whiteSpace: "nowrap" }}>{tkn.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    border: `1px solid ${BORDER_STRONG}`,
                    borderRadius: 12,
                    padding: "11px 14px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <UsdcMark size={34} />
                    <div>
                      <div style={{ fontSize: 16.5, fontWeight: 700 }}>USDC</div>
                      <div style={{ fontSize: 13, color: TER, display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#2151f5", display: "inline-block" }} />
                        Base
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 16, color: TER }}>⌄</span>
                </div>
              </div>
            </Panel>
          </>
        )}

        {/* ── right column, phase B: the film's RFQ card, full height ── */}
        {rfq && (
          <Panel x={RIGHT.x} y={RIGHT.y} w={RIGHT.w} h={RIGHT.h} opacity={rfqIn}>
            <div style={{ position: "absolute", inset: 0, padding: "24px 26px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: 23, fontWeight: 700, letterSpacing: -0.4 }}>
                  Request for quote
                </span>
                {rated ? (
                  <div
                    style={{
                      fontSize: 15,
                      color: BRASS,
                      backgroundColor: BRASS_SOFT,
                      borderRadius: 980,
                      padding: "5px 13px",
                    }}
                  >
                    Firm · {countdown}s
                  </div>
                ) : (
                  <div style={{ ...tag, gap: 7, fontSize: 14.5, padding: "4px 11px" }}>
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor: TEAL,
                        opacity: 0.5 + 0.5 * Math.cos((frame * Math.PI) / 22),
                      }}
                    />
                    Quoting…
                  </div>
                )}
              </div>

              <div
                style={{
                  position: "absolute",
                  left: 26,
                  right: 26,
                  top: 72,
                  height: 1,
                  backgroundColor: BORDER,
                }}
              />

              <div style={{ display: "flex", gap: 9, marginTop: 26 }}>
                {[
                  <span key="p" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <FlagPair a="us" b="mx" size={21} />
                    <span>USD/MXN</span>
                  </span>,
                  <span key="n">$250,000</span>,
                  <span key="d">{TENOR_LINE[0]}</span>,
                ].map((chip, i) => (
                  <div
                    key={i}
                    style={{ ...tag, height: 32, padding: "0 13px", fontSize: 14.5 }}
                  >
                    {chip}
                  </div>
                ))}
              </div>

              <div style={{ position: "absolute", left: 26, top: 152, fontSize: 15, color: TER }}>
                {allIn
                  ? "3 of 3 dealers responded"
                  : rated
                    ? `${DEALERS.filter((d) => frame >= d.lands).length} of 3 dealers responded`
                    : "Quoting 3 dealers…"}
              </div>

              {DEALERS.map((d, i) => {
                const isBest = i === BEST;
                const dimT = highlighted && !isBest ? fadeIn(frame, SEQ.bestAt, 4) : 0;
                const dim = 1 - 0.45 * dimT;
                const landed = frame >= d.lands;
                const rollT = smooth(
                  interpolate(frame, [d.lands, d.lands + 9], [0, 1], clamp),
                );
                const shown = (d.rate - 0.0165 * (1 - rollT)).toFixed(4);
                const ringOp = highlighted && isBest ? fadeIn(frame, SEQ.bestAt, 4) : 0;
                return (
                  <div
                    key={d.name}
                    style={{
                      position: "absolute",
                      left: 26,
                      top: 186 + i * 130,
                      width: RIGHT.w - 52,
                      height: 114,
                      borderRadius: 20,
                      backgroundColor: ringOp > 0 ? TEAL_SOFT : WELL,
                      boxShadow:
                        ringOp > 0
                          ? `0 0 0 2px rgba(15,182,171,${(0.28 * ringOp).toFixed(3)})`
                          : undefined,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0 24px",
                      opacity: dim,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.25 }}>
                        {d.name}
                      </div>
                      <div style={{ fontSize: 14.5, color: TER }}>
                        {landed ? `${d.sub} · answered ${d.t}` : d.sub}
                      </div>
                      {highlighted && isBest && (
                        <div
                          style={{
                            marginTop: 6,
                            display: "inline-block",
                            fontSize: 13.5,
                            color: TEAL,
                            backgroundColor: TEAL_SOFT,
                            borderRadius: 980,
                            padding: "3px 11px",
                            ...settle(frame, SEQ.bestAt, 10, 0.74),
                          }}
                        >
                          Best rate
                        </div>
                      )}
                    </div>
                    {landed ? (
                      <div style={{ textAlign: "right", opacity: fadeIn(frame, d.lands, 4) }}>
                        <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: -0.4 }}>
                          {shown}
                        </div>
                        <div style={{ fontSize: 14, color: TER }}>MXN per USD</div>
                      </div>
                    ) : (
                      <div
                        style={{
                          width: 104,
                          height: 17,
                          borderRadius: 8,
                          backgroundColor: BORDER_STRONG,
                          opacity: 0.5 + 0.5 * Math.cos(((frame + i * 11) * Math.PI) / 22),
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        <ScreenCursor frame={frame} />
      </div>
    </AbsoluteFill>
  );
};

export const fxScreenSequenceMeta = {
  id: "FxScreenSequence",
  component: FxScreenSequence,
  width: 2560,
  height: 1600,
  fps: 30,
  durationInFrames: 150,
};
