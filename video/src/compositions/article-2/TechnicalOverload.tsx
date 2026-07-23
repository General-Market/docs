import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame } from "remotion";
import { noise2D } from "@remotion/noise";
import { FPS, W, H, NAVY, SANS, SANS_TEXT } from "./theme";
import { BrandMark } from "../../components/BrandMark";

// Wall 1 · Technical Overload — the constraint, not a count.
// ONE matching engine. Every market is a live order book it must run every
// instant — so the LOAD is the number of books, not the trades. The engine has
// a fixed ceiling. A cursor clicks the markets up ×10 a beat; books pour in and
// collide; the LOAD gauge climbs toward MAX; the engine lights up and strains.
// Past the ceiling there is simply no machine: it browns out, a red ✕ strikes.

// ── the escalation ───────────────────────────────────────────────────────────
// count of live order books · load in units of capacity (1.0 = MAX ceiling).
type Step = { count: number; load: number };
const STEPS: Step[] = [
  { count: 1e3, load: 0.05 },
  { count: 1e4, load: 0.11 },
  { count: 1e5, load: 0.22 },
  { count: 1e6, load: 0.4 },
  { count: 1e7, load: 0.66 },
  { count: 1e8, load: 1.0 }, // hits the ceiling — overload
  { count: 1e9, load: 1.18 }, // over the top — ✕
];
const LAST = STEPS.length - 1;
const OVERLOAD = 5; // first step at/over the ceiling

// Each step is a click. Step 0 is settled before frame 0 (the composed opener);
// clicks 1..6 ratchet it to 1B. Accelerating, then a longer hold for the verdict.
const STARTS = [-18, 24, 64, 100, 134, 168, 210];
const CLICK = STARTS.map((s) => s + 14); // the cursor lands 14f into each step
const END = CLICK[LAST];
const HOLD = 116;
const DURATION = END + HOLD;

const MID_Y = H * 0.5;
const ENGINE_CX = 470;
const ENGINE_W = 220;
const ENGINE_H = 470;
const GAUGE_X = ENGINE_CX + ENGINE_W / 2 + 56;
const GAUGE_W = 36;
const GAUGE_H = 470;
const RIGHT_CX = W * 0.72;
const FAIL = "#F2566B";

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
const smoother = (t: number): number => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const easeOut = (t: number): number => Easing.out(Easing.cubic)(clamp01(t));
const quadBezier = (t: number, a: number, b: number, c: number): number => {
  const m = 1 - t;
  return m * m * a + 2 * m * t * b + t * t * c;
};

// Abbreviated count — 1K, 10K, 100K, 1M … 1B. Never a wall of zeros.
const strip = (v: number): string => {
  const r = Math.round(v * 10) / 10;
  return r % 1 === 0 ? r.toFixed(0) : r.toFixed(1);
};
const abbrev = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1e9) return strip(n / 1e9) + "B";
  if (a >= 1e6) return strip(n / 1e6) + "M";
  if (a >= 1e3) return strip(n / 1e3) + "K";
  return Math.round(n).toString();
};

const mix = (a: number[], b: number[], t: number): string =>
  `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)}, ${Math.round(a[1] + (b[1] - a[1]) * t)}, ${Math.round(a[2] + (b[2] - a[2]) * t)})`;
const BLUE = [41, 151, 255];
const AMBER = [232, 161, 58];
const RED = [242, 86, 107];
const loadColor = (l: number): string =>
  l < 0.55 ? mix(BLUE, AMBER, clamp01(l / 0.55)) : mix(AMBER, RED, clamp01((l - 0.55) / 0.55));

// ── the matching engine ────────────────────────────────────────────────────
// A single lit blade — metal chassis, status LEDs, a core that brightens with
// load. It vibrates as it strains and browns out at overload.
const Engine: React.FC<{ load: number; frame: number; overloaded: number }> = ({ load, frame, overloaded }) => {
  const col = loadColor(load);
  const strain = Math.max(0, load - 0.45);
  const amp = strain * strain * 7;
  const vx = amp * noise2D("ex", frame * 0.6, 0);
  const vy = amp * noise2D("ey", frame * 0.6, 9);
  const coreGlow = 0.25 + clamp01(load) * 0.75;
  const dim = 1 - overloaded * 0.55; // browns out at overload
  const leds = 11;
  return (
    <div
      style={{
        position: "absolute",
        left: ENGINE_CX - ENGINE_W / 2,
        top: MID_Y - ENGINE_H / 2,
        width: ENGINE_W,
        height: ENGINE_H,
        transform: `translate(${vx.toFixed(2)}px, ${vy.toFixed(2)}px)`,
        filter: `brightness(${dim.toFixed(3)})`,
      }}
    >
      {/* contact shadow */}
      <div
        style={{
          position: "absolute",
          left: -30,
          bottom: -34,
          width: ENGINE_W + 60,
          height: 60,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(0,0,0,0.6), transparent 75%)",
        }}
      />
      {/* chassis */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 18,
          background: "linear-gradient(150deg, #232a38 0%, #141926 42%, #0b0e16 100%)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: `inset 0 2px 0 rgba(255,255,255,0.14), inset 0 -30px 60px rgba(0,0,0,0.6), 0 30px 70px rgba(0,0,0,0.55), 0 0 ${(50 * coreGlow).toFixed(0)}px ${col}66`,
          overflow: "hidden",
        }}
      >
        {/* moving key-light sweep */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.10) 50%, transparent 70%)",
            transform: `translateX(${(Math.sin(frame * 0.04) * 60).toFixed(1)}px)`,
          }}
        />
        {/* status LEDs */}
        <div style={{ position: "absolute", left: 22, top: 34, bottom: 34, width: 18, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          {Array.from({ length: leds }).map((_, i) => {
            const on = 0.4 + 0.6 * Math.abs(noise2D("led" + i, frame * (0.1 + load * 0.3), i));
            return (
              <div
                key={i}
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: "50%",
                  background: col,
                  opacity: on,
                  boxShadow: `0 0 10px ${col}`,
                }}
              />
            );
          })}
        </div>
        {/* the core — a vertical light slot that brightens with load */}
        <div
          style={{
            position: "absolute",
            left: ENGINE_W * 0.46,
            top: 40,
            bottom: 40,
            width: ENGINE_W * 0.30,
            borderRadius: 8,
            background: `linear-gradient(180deg, ${col} 0%, rgba(0,0,0,0.2) 100%)`,
            opacity: coreGlow,
            boxShadow: `0 0 ${(40 * coreGlow).toFixed(0)}px ${col}, inset 0 0 24px rgba(255,255,255,0.25)`,
            filter: `blur(0.4px)`,
          }}
        />
        {/* core scanlines */}
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: ENGINE_W * 0.46,
              width: ENGINE_W * 0.3,
              top: 48 + i * ((ENGINE_H - 96) / 9),
              height: 2,
              background: "rgba(0,0,0,0.35)",
            }}
          />
        ))}
      </div>
      {/* name plate */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: -42,
          textAlign: "center",
          fontFamily: SANS_TEXT,
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: "2.5px",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        ONE MATCHING ENGINE
      </div>
    </div>
  );
};

// ── the load gauge — the ceiling made visible ───────────────────────────────
const LoadGauge: React.FC<{ load: number }> = ({ load }) => {
  const shown = Math.min(load, 1.15);
  const top = MID_Y - GAUGE_H / 2;
  const fillH = (shown / 1.15) * GAUGE_H;
  const maxY = (1 - 1.0 / 1.15) * GAUGE_H; // y of the MAX line, from the top
  const col = loadColor(load);
  const over = load >= 1.0;
  return (
    <div style={{ position: "absolute", left: GAUGE_X, top, width: GAUGE_W, height: GAUGE_H }}>
      {/* label */}
      <div style={{ position: "absolute", top: -34, left: -6, fontFamily: SANS_TEXT, fontSize: 16, fontWeight: 700, letterSpacing: "2px", color: "rgba(255,255,255,0.5)" }}>
        LOAD
      </div>
      {/* track */}
      <div style={{ position: "absolute", inset: 0, borderRadius: GAUGE_W / 2, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }} />
      {/* fill */}
      <div
        style={{
          position: "absolute",
          left: 3,
          right: 3,
          bottom: 3,
          height: Math.max(0, fillH - 6),
          borderRadius: GAUGE_W / 2,
          background: `linear-gradient(180deg, ${col} 0%, ${loadColor(Math.max(0, load - 0.3))} 100%)`,
          boxShadow: `0 0 ${(22 * clamp01(load)).toFixed(0)}px ${col}, 0 0 ${(over ? 40 : 0)}px ${FAIL}`,
        }}
      />
      {/* MAX ceiling line */}
      <div style={{ position: "absolute", left: -10, right: -10, top: maxY, height: 0, borderTop: `2px dashed ${over ? FAIL : "rgba(255,255,255,0.55)"}` }} />
      <div style={{ position: "absolute", top: maxY - 22, right: -54, fontFamily: SANS_TEXT, fontSize: 15, fontWeight: 800, letterSpacing: "1px", color: over ? FAIL : "rgba(255,255,255,0.55)" }}>
        MAX
      </div>
    </div>
  );
};

// ── one live order-book tile ─────────────────────────────────────────────────
// A tiny market: a few bid/ask ticks that flicker, so the grid reads as live
// books running — not a static count.
const LiveBook: React.FC<{ size: number; seed: number; frame: number; dim: number }> = ({ size, seed, frame, dim }) => {
  const t = frame * 0.18 + seed;
  const bid = 0.4 + 0.6 * Math.abs(Math.sin(t));
  const ask = 0.4 + 0.6 * Math.abs(Math.cos(t * 1.3 + seed));
  const pad = Math.max(1.5, size * 0.16);
  const tick = Math.max(1.5, size * 0.12);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(2, size * 0.14),
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.10)",
        position: "relative",
        opacity: dim,
      }}
    >
      <div style={{ position: "absolute", left: pad, right: size * 0.5, top: pad, height: tick, borderRadius: tick, background: "#1FB877", opacity: bid }} />
      <div style={{ position: "absolute", left: pad, right: size * 0.55, top: pad + tick + 2, height: tick, borderRadius: tick, background: "#1FB877", opacity: bid * 0.7 }} />
      <div style={{ position: "absolute", right: pad, left: size * 0.5, bottom: pad, height: tick, borderRadius: tick, background: FAIL, opacity: ask }} />
      <div style={{ position: "absolute", right: pad, left: size * 0.55, bottom: pad + tick + 2, height: tick, borderRadius: tick, background: FAIL, opacity: ask * 0.7 }} />
    </div>
  );
};

// ── the markets box — swells with the count, fills with live books ───────────
const MarketsBox: React.FC<{ count: number; boxSide: number; impact: number; frame: number; dim: number }> = ({
  count,
  boxSide,
  impact,
  frame,
  dim,
}) => {
  const boxMag = clamp01((Math.log10(Math.max(1, count)) - 3) / 6);
  const left = RIGHT_CX - boxSide / 2;
  const top = MID_Y - boxSide / 2;

  // how many live-book tiles to show (a sample; the label is the true count)
  const tiles = Math.round(interpolate(boxMag, [0, 1], [4, 132]));
  const cols = Math.ceil(Math.sqrt(tiles));
  const inner = boxSide - 56;
  const gap = Math.max(2, inner * 0.012);
  const tileSize = (inner - gap * (cols - 1)) / cols;

  const num = abbrev(count);
  const numSize = Math.min(60 + 70 * boxMag, (boxSide - 90) / (num.length * 0.62));

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: boxSide,
        height: boxSide,
        borderRadius: 10,
        border: "2px solid rgba(255,255,255,0.85)",
        background: "rgba(10,14,22,0.55)",
        boxShadow: `0 0 ${(46 * boxMag).toFixed(0)}px rgba(10,132,255,${(0.26 + 0.42 * boxMag).toFixed(2)})`,
        transform: `scale(${(1 + impact * 0.03).toFixed(3)})`,
        opacity: dim,
        overflow: "hidden",
      }}
    >
      {/* the live-book field */}
      <div style={{ position: "absolute", inset: 28, display: "flex", flexWrap: "wrap", gap, alignContent: "center", justifyContent: "center", opacity: 0.5 }}>
        {Array.from({ length: tiles }).map((_, i) => (
          <LiveBook key={i} size={tileSize} seed={i * 3.3} frame={frame} dim={1} />
        ))}
      </div>
      {/* the count, centred over the field */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            fontSize: numSize,
            fontWeight: 800,
            letterSpacing: "-1px",
            color: "#fff",
            textShadow: "0 4px 30px rgba(0,0,0,0.8)",
          }}
        >
          {num}
        </span>
        <span style={{ fontFamily: SANS_TEXT, fontSize: numSize * 0.34, fontWeight: 700, letterSpacing: "0.5px", color: "rgba(255,255,255,0.62)", marginTop: numSize * 0.1, textShadow: "0 2px 16px rgba(0,0,0,0.8)" }}>
          live order books
        </span>
      </div>
    </div>
  );
};

const ARROW =
  "M4.5 3 L4.5 19 L8.5 15.5 L11 21 L13.4 20 L10.9 14.6 L16.5 14.6 Z";

export const TechnicalOverload: React.FC = () => {
  const frame = useCurrentFrame();

  let active = 0;
  for (let i = 0; i < STEPS.length; i++) if (frame >= STARTS[i]) active = i;
  const cur = STEPS[active];
  const prev = STEPS[active > 0 ? active - 1 : 0];
  const clickF = CLICK[active];

  // the ×10 happens ON the click — the count and load jump, then settle
  const r = smoother((frame - clickF) / 12);
  const baseCount = active > 0 ? prev.count : cur.count;
  const baseLoad = active > 0 ? prev.load : cur.load;
  const count = baseCount + (cur.count - baseCount) * r;
  const load = baseLoad + (cur.load - baseLoad) * r;

  const boxMag = clamp01((Math.log10(Math.max(1, count)) - 3) / 6);
  const boxSide = 300 + 460 * boxMag;

  // latched once the 100M click strikes the ceiling — never flickers off
  const broken = frame >= CLICK[OVERLOAD] + 6;
  const overloaded = clamp01((frame - (CLICK[OVERLOAD] + 6)) / 26);

  // click impact — the box recoils, a burst fires, books collide in
  const impact = active > 0 ? interpolate(frame, [clickF, clickF + 4, clickF + 16], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;

  // single restrained push at overload, otherwise locked
  const camScale = 1 + overloaded * 0.04;

  // cursor: arcs to the (growing) box's top-left corner each step, clicks there
  const cornerX = RIGHT_CX - boxSide / 2 - 6;
  const cornerY = MID_Y - boxSide / 2 - 6;
  const prevMag = clamp01((Math.log10(Math.max(1, prev.count)) - 3) / 6);
  const prevSide = 300 + 460 * prevMag;
  // step 1 is the grand entrance from off-screen; later steps hop corner→corner
  const fromX = active === 1 ? W * 0.92 : RIGHT_CX - prevSide / 2 - 6;
  const fromY = active === 1 ? H * 1.06 : MID_Y - prevSide / 2 - 6;
  const moveStart = STARTS[active] + 2;
  const tMove = clamp01((frame - moveStart) / (clickF - moveStart));
  const em = easeOut(tMove);
  const dist = Math.hypot(cornerX - fromX, cornerY - fromY);
  const arc = -Math.min(150, dist * 0.32) * Math.sin(Math.PI * tMove); // lift scales with the move
  const curX = fromX + (cornerX - fromX) * em;
  const curY = fromY + (cornerY - fromY) * em + arc;
  const squish = interpolate(frame, [clickF - 2, clickF, clickF + 5], [1, 0.8, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cursorVisible = active >= 1 && (!broken || frame < clickF + 8);

  return (
    <AbsoluteFill style={{ backgroundColor: NAVY, fontFamily: SANS, overflow: "hidden" }}>
      <BrandMark surface="dark" />

      <AbsoluteFill style={{ transform: `scale(${camScale.toFixed(4)})` }}>
        {/* god-rays behind the engine — intensify with load */}
        <div
          style={{
            position: "absolute",
            left: ENGINE_CX - 520,
            top: MID_Y - 520,
            width: 1040,
            height: 1040,
            background: `repeating-conic-gradient(from ${(frame * 0.15).toFixed(1)}deg at 50% 50%, ${loadColor(load)}00 0deg, ${loadColor(load)}55 6deg, ${loadColor(load)}00 12deg)`,
            WebkitMaskImage: "radial-gradient(circle, #000 0%, transparent 62%)",
            maskImage: "radial-gradient(circle, #000 0%, transparent 62%)",
            mixBlendMode: "screen",
            opacity: 0.1 + clamp01(load) * 0.28,
          }}
        />

        {/* the engine + its label */}
        <Engine load={load} frame={frame} overloaded={overloaded} />
        <LoadGauge load={load} />

        {/* the markets */}
        <MarketsBox count={count} boxSide={boxSide} impact={impact} frame={frame} dim={1} />

        {/* books colliding into the box on each click */}
        {active > 0 && <Collision clickF={clickF} frame={frame} targetX={RIGHT_CX} targetY={MID_Y} fromX={curX} fromY={curY} />}

        {/* the click burst */}
        {active > 0 && <ClickBurst clickF={clickF} frame={frame} x={cornerX} y={cornerY} />}

        {/* overload bloom (soft, no flash) + the ✕ on the engine */}
        {overloaded > 0 && (
          <div
            style={{
              position: "absolute",
              left: ENGINE_CX - 460,
              top: MID_Y - 460,
              width: 920,
              height: 920,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${FAIL}88 0%, transparent 58%)`,
              mixBlendMode: "screen",
              opacity: overloaded * 0.5,
            }}
          />
        )}
        {broken && <EngineCross frame={frame} startF={CLICK[OVERLOAD]} />}

        {/* cursor */}
        {cursorVisible && (
          <div
            style={{
              position: "absolute",
              left: curX,
              top: curY,
              width: 34,
              height: 34,
              transform: `scale(${squish})`,
              transformOrigin: "4px 4px",
              filter: "drop-shadow(0 5px 12px rgba(0,0,0,0.45))",
              zIndex: 20,
            }}
          >
            <svg viewBox="0 0 24 24" width={34} height={34}>
              <path d={ARROW} fill="#ffffff" stroke="#0a0a0a" strokeWidth={1.4} strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </AbsoluteFill>

      {/* the verdict */}
      {broken && active === LAST && <Verdict frame={frame} startF={CLICK[LAST]} />}
    </AbsoluteFill>
  );
};

// books fan in along bezier arcs and slam the box (the collision)
const Collision: React.FC<{ clickF: number; frame: number; targetX: number; targetY: number; fromX: number; fromY: number }> = ({
  clickF,
  frame,
  targetX,
  targetY,
  fromX,
  fromY,
}) => {
  const local = frame - clickF;
  if (local < 0 || local > 22) return null;
  const N = 10;
  return (
    <>
      {Array.from({ length: N }).map((_, i) => {
        const start = i * 0.8;
        const t = clamp01((local - start) / 12);
        if (t <= 0 || t >= 1) return null;
        const ex = targetX; // land at the box centre
        const ey = targetY;
        const spread = (i - N / 2) * 26;
        const ctrlX = (fromX + ex) / 2 + spread;
        const ctrlY = Math.min(fromY, ey) - 140 - (i % 3) * 30;
        const x = quadBezier(easeOut(t), fromX, ctrlX, ex);
        const y = quadBezier(easeOut(t), fromY, ctrlY, ey);
        const s = interpolate(t, [0, 1], [0.4, 1]);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - 13,
              top: y - 13,
              width: 26,
              height: 26,
              borderRadius: 5,
              background: "rgba(13,18,28,0.9)",
              border: "1px solid rgba(41,151,255,0.7)",
              boxShadow: "0 0 12px rgba(41,151,255,0.5)",
              transform: `scale(${s.toFixed(2)}) rotate(${(t * (i % 2 ? 30 : -30)).toFixed(0)}deg)`,
              opacity: interpolate(t, [0, 0.1, 0.92, 1], [0, 1, 1, 0]),
            }}
          />
        );
      })}
    </>
  );
};

// concentric ring + core at the click — the AntiCheatReassure vocabulary
const ClickBurst: React.FC<{ clickF: number; frame: number; x: number; y: number }> = ({ clickF, frame, x, y }) => {
  const t = clamp01((frame - clickF) / 22);
  if (frame < clickF - 1 || t >= 1) return null;
  const ringScale = interpolate(t, [0, 1], [0.3, 3.2]);
  const ringOp = interpolate(t, [0, 0.15, 1], [0, 0.6, 0]);
  const coreOp = interpolate(t, [0, 0.08, 0.4], [0, 1, 0]);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, pointerEvents: "none", zIndex: 18 }}>
      <div style={{ position: "absolute", left: -60, top: -60, width: 120, height: 120, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.9)", transform: `scale(${ringScale})`, opacity: ringOp }} />
      <div style={{ position: "absolute", left: -22, top: -22, width: 44, height: 44, borderRadius: "50%", background: "#fff", filter: "blur(4px)", opacity: coreOp }} />
    </div>
  );
};

// the ✕ struck across the engine on overload — strokes wipe in by length
const EngineCross: React.FC<{ frame: number; startF: number }> = ({ frame, startF }) => {
  const S = 300;
  const cx = ENGINE_CX;
  const cy = MID_Y;
  const len = S * Math.SQRT2;
  const p1 = clamp01((frame - startF - 6) / 13);
  const p2 = clamp01((frame - startF - 12) / 13);
  if (p1 <= 0) return null;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, zIndex: 15 }}>
      <g stroke={FAIL} strokeWidth={18} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 20px ${FAIL}aa)` }}>
        <line x1={cx - S / 2} y1={cy - S / 2} x2={cx + S / 2} y2={cy + S / 2} strokeDasharray={len} strokeDashoffset={len * (1 - p1)} />
        <line x1={cx + S / 2} y1={cy - S / 2} x2={cx - S / 2} y2={cy + S / 2} strokeDasharray={len} strokeDashoffset={len * (1 - p2)} />
      </g>
    </svg>
  );
};

const Verdict: React.FC<{ frame: number; startF: number }> = ({ frame, startF }) => {
  const t = clamp01((frame - startF - 18) / 18);
  if (t <= 0) return null;
  const spring0 = spring({ frame: frame - startF - 18, fps: FPS, config: { damping: 16, mass: 0.6, stiffness: 120 } });
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 78,
        textAlign: "center",
        fontFamily: SANS,
        fontSize: 60,
        fontWeight: 800,
        letterSpacing: "-1.5px",
        lineHeight: 1.05,
        color: "#fff",
        opacity: easeOut(t),
        filter: t < 1 ? `blur(${(1 - t) * 14}px)` : undefined,
        transform: `translateY(${((1 - spring0) * 20).toFixed(1)}px)`,
        textShadow: "0 8px 50px rgba(0,0,0,0.8)",
      }}
    >
      No machine runs a billion live order books
    </div>
  );
};

export const technicalOverloadMeta = {
  id: "TechnicalOverload",
  component: TechnicalOverload,
  durationInFrames: DURATION,
  fps: FPS,
  width: W,
  height: H,
};
