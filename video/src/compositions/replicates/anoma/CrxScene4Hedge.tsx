import React from "react";
import { interpolate } from "remotion";
import { DIATYPE } from "./diatype";
import { clamp } from "./AnomaComposition";
import { BORDER, BRASS, BRASS_SOFT, CARD, CalendarGlyph, CalendarPicker, Card, Check, Cursor, type CursorKey, FOCUS_RING, FlagPair, INK, OVERLAY_SHADOW, SEC, SURFACE2, TEAL, TEAL_HOVER, TER, UsdcMark, WELL, fadeIn, label, settle, stepSlide, tag, tnum } from "./CrxCardKit";

// ─── Scene 4/5 (f348-610): "Open a hedge" on the slow pulse ───
// A: the forward rate ticks live (Indicative) from the f369 snare (as
//    "Access" appears), then LOCKS on the f391 snare — brass, because the
//    app reserves brass for the binding moment ("locks" lands there).
// B: the cursor opens the corridor list (click f435, a snare); the hover
//    ring walks the quarter grid (444/450/456); the click on the f457 snare
//    selects USD/BRL and the card re-quotes ("Corridor" lands there).
// C: tenor clicks ride the snares (f501, f523); typing starts on the f545
//    snare and completes on the f567 snare (as "notional" lands); the CTA
//    arms there, is pressed on the f589 snare; card cuts on the f611 snare.
const CORRIDORS: { a: string; b: string; pair: string; sub: string; rate: string; spot: string }[] = [
  { a: "us", b: "mx", pair: "USD/MXN", sub: "Dollars / Mexican pesos", rate: "17.5104", spot: "17.499" },
  { a: "us", b: "in", pair: "USD/INR", sub: "Dollars / Indian rupees", rate: "84.212", spot: "84.155" },
  { a: "us", b: "tr", pair: "USD/TRY", sub: "Dollars / Turkish lira", rate: "38.905", spot: "38.822" },
  { a: "us", b: "br", pair: "USD/BRL", sub: "Dollars / Brazilian reais", rate: "5.4310", spot: "5.418" },
];
const SELECT_AT = 457; // the click that makes USD/BRL the pair — on the f457 snare
const HOVER_STEPS = [444, 450, 456]; // hover ring hops on quarters after landing on row 0 at f439

const RATE_TICKS = ["17.5081", "17.5104", "17.5092", "17.5110", "17.5087", "17.5104"];
// Spot keeps breathing after the forward locks — the market moves,
// the locked rate does not. Last-digit flicker, deterministic.
const SPOT_FLICK = ["1", "3", "0", "4", "2", "5"];

const NOTIONAL = "2,500,000";
const NOTIONAL_DIGITS = NOTIONAL.replace(/,/g, ""); // "2500000" — the 7 raw digits
const TYPE_START = 545; // first digit on the f545 snare
const TYPE_END = 567; // 7th digit lands on the f567 snare; the CTA arms there

// A person types the seven DIGITS of 2500000 one at a time; the field re-groups
// with thousands separators as digits accrue ("2"→"25"→"250"→"2,500"→…→
// "2,500,000"), never showing a trailing comma. Grouping the raw digit string
// (not slicing the pre-formatted value) is what makes commas appear only where a
// group is complete.
const formatAmount = (digits: number) =>
  NOTIONAL_DIGITS.slice(0, digits).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// Deterministic [0,1) hash of a keystroke index — a seeded jitter so the
// cadence reads human, NOT Math.random / Date.now, so the render stays
// byte-deterministic.
const keyJitter = (i: number) => {
  let h = Math.imul(i + 1, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h ^= h >>> 13;
  return ((h >>> 0) % 1000) / 1000;
};

// Frame at which each of the 7 digits becomes visible. Base cadence + a small
// per-keystroke jitter, with a tiny hesitation before the final group, then
// scaled so digit 1 lands on TYPE_START and digit 7 lands exactly on TYPE_END.
const TYPE_KEYFRAMES: number[] = (() => {
  const gaps: number[] = [];
  for (let i = 1; i < NOTIONAL_DIGITS.length; i++) {
    const jitter = (keyJitter(i) - 0.5) * 2.0; // ±1f around the base beat
    const hesitation = i === NOTIONAL_DIGITS.length - 1 ? 1.8 : 0; // pause before the last digit
    gaps.push(3.0 + jitter + hesitation);
  }
  const total = gaps.reduce((s, g) => s + g, 0);
  const scale = (TYPE_END - TYPE_START) / total;
  const frames = [TYPE_START];
  let acc = TYPE_START;
  for (let j = 0; j < gaps.length; j++) {
    acc += gaps[j] * scale;
    frames.push(j === gaps.length - 1 ? TYPE_END : acc); // pin the last to TYPE_END
  }
  return frames;
})();

// Cursor keyframes on the slow pulse: every CLICK lands on a snare (open 435,
// select 457, tenor 501/523, notional-focus 545, press 589), with a quarter-beat
// dwell before each so the hand moves musically, not mechanically.
const CURSOR_KEYS: CursorKey[] = [
  { f: 421, x: 640, y: 452 },
  { f: 430, x: 618, y: 224 }, // "Change ⌄" on the pair well
  { f: 435, x: 618, y: 224 }, // open click (snare)
  { f: 440, x: 420, y: 296 }, // row 0 (USD/MXN)
  { f: 446, x: 420, y: 340 }, // row 1
  { f: 452, x: 420, y: 384 }, // row 2
  { f: 456, x: 420, y: 428 }, // row 3 (USD/BRL) — arrives
  { f: 457, x: 420, y: 428 }, // row 3 — click selects on the snare
  { f: 470, x: 470, y: 400 },
  { f: 492, x: 170, y: 308 }, // approach the tenor field
  { f: 501, x: 170, y: 308 }, // click opens the calendar (snare)
  { f: 512, x: 205, y: 288 }, // move up into the month grid
  { f: 523, x: 222, y: 228 }, // click day 12 in the grid (snare) — the delivery pick
  { f: 534, x: 150, y: 116 }, // to the notional field
  { f: 545, x: 150, y: 116 }, // focus click (snare) — typing begins
  { f: 556, x: 236, y: 148 }, // rest aside while it types
  { f: 580, x: 355, y: 384 }, // CTA (arms as typing completes)
  { f: 589, x: 355, y: 384 }, // press (snare)
];
const CURSOR_CLICKS = [435, 457, 501, 523, 545, 589];

export const CrxScene4Hedge: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 348 || frame >= 611) return null;
  const opacity = interpolate(frame, [347, 351], [0, 1], clamp);
  // Subtle mount settle off the f348 snare — a 1.5% rise that resolves to the
  // canonical card size within ~8 frames (was a 4.5% pop; owner: no size-variance).
  const scale = 1 + 0.015 * Math.pow(0.7, Math.max(0, frame - 348));

  const cor = CORRIDORS[frame < SELECT_AT ? 0 : 3];
  const reQuote = frame >= SELECT_AT ? settle(frame, SELECT_AT, 9, 0.74) : {};

  // Beat A — Indicative ticks from the f369 snare, locks on the f391 snare.
  const locked = frame >= 391;
  const rate =
    frame < 369
      ? RATE_TICKS[0]
      : frame < 391
        ? RATE_TICKS[Math.floor((frame - 369) / 4) % RATE_TICKS.length]
        : cor.rate;
  const lockPulse =
    interpolate(frame, [391, 394], [0, 1], clamp) * interpolate(frame, [402, 413], [1, 0], clamp);

  // Spot flicker: last digit changes every 5 frames, forever.
  const spot = cor.spot + SPOT_FLICK[Math.floor(frame / 5) % SPOT_FLICK.length];

  // Beat B — corridor dropdown f435-467.
  const panelIn = fadeIn(frame, 435, 3) * interpolate(frame, [463, 468], [1, 0], clamp);
  const panelOpen = frame >= 435 && frame < 468;
  const hoverIdx = stepSlide(frame, HOVER_STEPS, 4); // 0→3, eased hops
  const hoverOp = fadeIn(frame, 439, 3);
  const selIdx = frame < SELECT_AT ? 0 : 3;

  // Beat C — the tenor CLICK on the f501 snare opens the calendar; the delivery
  // day is PICKED on the f523 snare; notional types from the f545 snare; CTA arms
  // as typing completes (f567). The field shows the default Aug 1 until the pick
  // commits Aug 12 on f523 (matching the day the cursor clicks in the grid).
  const tenor =
    frame < 523
      ? ["Aug 1, 2026", "30 days from today"]
      : ["Aug 12, 2026", "41 days from today"];
  const tenorSwap = frame >= 523 ? settle(frame, 523, 8, 0.74) : {};
  const tenorFocus =
    interpolate(frame, [499, 502], [0, 1], clamp) * interpolate(frame, [541, 545], [1, 0], clamp);

  // Calendar popover: fades in on the f501 open-click, the teal fill jumps from
  // Aug 1 to the picked Aug 12 on the f523 snare, then it fades as the cursor
  // leaves for the notional field (~f534). August 2026 — day 1 is a Saturday
  // (firstDow 6), 31 days.
  const calOpen = frame >= 501 && frame < 536;
  const calOp =
    fadeIn(frame, 501, 4) * interpolate(frame, [530, 536], [1, 0], clamp);
  const calSettle = settle(frame, 501, 10, 0.76);
  const calSelected = frame >= 523 ? 12 : 1;
  const focused = frame >= 542;
  const typedDigits =
    frame < TYPE_START ? 0 : TYPE_KEYFRAMES.filter((f) => frame >= f).length;
  const typedStr = formatAmount(typedDigits); // "" while empty, "2,500,000" when settled
  const typing = typedDigits > 0 && typedDigits < NOTIONAL_DIGITS.length;
  // Caret blinks while idle-focused, holds solid while typing.
  const caretOn = focused && (typing || Math.floor(frame / 8) % 2 === 0);
  const armed = frame >= 567;
  const ctaSettle = armed ? settle(frame, 567, 6, 0.72) : {};
  const ctaPressed = frame >= 589 && frame < 611;

  return (
    <Card
      x={CARD.left}
      y={CARD.top}
      w={CARD.w}
      h={CARD.h}
      opacity={opacity}
      scale={scale}
    >
      <div style={{ position: "absolute", inset: 0, padding: "26px 30px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: TER, fontSize: 16, lineHeight: 1 }}>‹</span>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Open a hedge</span>
        </div>

        {/* Forward notional well */}
        <div
          style={{
            position: "absolute",
            left: 30,
            top: 62,
            width: 650,
            height: 108,
            backgroundColor: WELL,
            borderRadius: 16,
            padding: "14px 18px",
            boxShadow: focused && frame < TYPE_END + 8 ? FOCUS_RING : undefined,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            {/* SwapPage renders this one sentence-case — 12.5px/500
                tertiary, not the uppercase eyebrow */}
            <div style={{ fontFamily: DIATYPE, fontSize: 12.5, fontWeight: 400, color: TER }}>
              Forward notional
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
              <span style={{ color: TER, ...tnum }}>Balance $30,440</span>
              <span style={{ color: TEAL, fontWeight: 700 }}>Max</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                fontSize: 38,
                fontWeight: typedDigits > 0 ? 700 : 400,
                letterSpacing: -1,
                marginTop: 2,
                color: typedDigits > 0 ? INK : "#b8bac4",
                ...tnum,
              }}
            >
              {typedDigits > 0 ? typedStr : focused ? "" : "0.0"}
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
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>USDC</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: TEAL }} />
            <span style={{ fontSize: 12, color: SEC }}>
              Spot price{" "}
              <span style={{ color: INK, fontWeight: 700, ...tnum }}>
                {spot} {cor.pair.slice(4)}
              </span>
            </span>
          </div>
        </div>

        {/* Pair well — the app nests a white row inside the grey well */}
        <div
          style={{
            position: "absolute",
            left: 30,
            top: 182,
            width: 650,
            height: 74,
            backgroundColor: WELL,
            borderRadius: 16,
            padding: "9px 18px 0 18px",
          }}
        >
          <div style={label}>Pair</div>
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
                <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.15 }}>{cor.pair}</div>
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
            left: 30,
            top: 268,
            width: 319,
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
              <div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.15, ...tnum }}>
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
            left: 361,
            top: 268,
            width: 319,
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
            <div style={{ fontSize: 15.5, fontWeight: 700, marginTop: 5, lineHeight: 1.15, ...tnum }}>
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
                  opacity: 0.5 + 0.5 * Math.cos((frame * Math.PI) / 22),
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
                ...settle(frame, 394, 12, 0.74),
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
              <span style={{ fontSize: 12, fontWeight: 400, color: BRASS }}>
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
            left: 30,
            top: 358,
            width: 650,
            height: 52,
            borderRadius: 16,
            backgroundColor: ctaPressed ? TEAL_HOVER : TEAL,
            opacity: armed ? 1 : 0.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
            fontWeight: 400,
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
              left: 30,
              top: 262,
              width: 650,
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
                  width: 634,
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
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{c.pair}</span>
                  <span style={{ fontSize: 12.5, color: TER }}>{c.sub}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 400, color: SEC, ...tnum }}>
                    {c.rate}
                  </span>
                  {selIdx === i && <Check size={16} color={TEAL} stroke={14} />}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Calendar picker — opens from the tenor field on the f501 click,
            floats up over the form, delivery day picked on the f523 click */}
        {calOpen && calOp > 0 && (
          <CalendarPicker
            left={30}
            top={44}
            w={384}
            monthLabel="August 2026"
            firstDow={6}
            daysInMonth={31}
            selected={calSelected}
            caption={frame >= 523 ? "41 days from today" : "30 days from today"}
            op={calOp}
            settleStyle={calSettle}
          />
        )}

        <Cursor
          frame={frame}
          keys={CURSOR_KEYS}
          clicks={CURSOR_CLICKS}
          appear={421}
        />
      </div>
    </Card>
  );
};
