import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { FIELD_BG, Stage } from "./chrome";
import { BrandMark } from "../../components/BrandMark";
import { C, EASE, font, FPS, H, monoFont, PILL_GRADIENT, sec, W } from "./theme";
import { LineRow, Packet, TraderChip } from "./flow";
import { CARD_H, CARD_W, cardButtonPos, cardOrigin, Cursor, MarketCard, ProductUI } from "./ui";
import { GlassFlow, GlassLine, GlassQuestion } from "./concepts";
import { DayTimeline, PersonIcon, SourceStack, TradeFan } from "./throughput";
import {
  BATCHES_PER_DAY,
  LINES_PER_BATCH,
  MARKETS,
  N_TRADERS,
  PER_SOURCE_PER_DAY,
  PICKS_BY_MARKET,
  THROUGHPUT_SOURCES,
  THROUGHPUT_TOTAL,
  TRADER_NAMES,
  YOUR_COLLECT,
  YOUR_NET,
  YOUR_STAKE,
  YOUR_WINS,
  yourReturn,
} from "./data";

// BatchFlowReel — ONE continuous element handed down the whole pipeline, all in
// the same frosted-glass world. The three explainer ideas are adapted INTO the
// flow as glass beats, never cutting away to another field:
//   · "one question" opens it — a single binary call, in glass;
//   · "the oracle's line" plays just before the lines settle;
//   · "losers pay the winners" plays just before the payout.
// Between them the product ride: ten picks COLLAPSE into one packet of all ten
// votes; the packet flies into the pool with four other traders; the five
// packets GATHER into the pool, which UNFOLDS into the ten matched lines; the
// lines settle; the winners collect; the payout multiplies; the throughput
// unlocks a billion in liquidity. Every handoff is a transform — one object
// becoming the next — never a crossfade of two diagrams on the same spot.

const YOUR_PICKS = MARKETS.map((m) => m.you);
const TRADER_TICKETS = TRADER_NAMES.map((_n, t) => MARKETS.map((_m, i) => PICKS_BY_MARKET[i][t]));
const TRADER_COLORS = ["#0071E3", "#FF7A59", "#7B5CFF", "#17B0A6", "#FF6FB5"];
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// ── the track the camera flies over ──────────────────────────────────────────
const AX = 1000; // one question → dashboard → merge → packet
const BX = 3120; // pool → gather → unfold → the line → settle
const DX = 5240; // losers pay winners → payout
const MX1 = DX + 1500; // one person, one trade
const MX2 = MX1 + 1500; // the trade fans into 10,000 lines
const MX3 = MX2 + 1700; // a day repeats it ×100, then ten sources pull into view
const CY = 540;
const TRACK_W = MX3 + 1500;

// The closing pull-back: the camera dezooms and pans down so the ten-source
// stack (row 0 lands at CY, nine more fall below it) frames whole.
const ZOOM_SCALE = 0.6;
const STACK_CAM_Y = 980;

const ci = (
  frame: number,
  a: number,
  b: number,
  from: number,
  to: number,
  easing?: (t: number) => number,
): number =>
  interpolate(frame, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

// ── opening: the one-question beat, then the cursor walks the ten cards ───────
const OPEN_Q: [number, number] = [sec(0.3), sec(3.0)]; // glass "one question" builds, holds at AX
const SEL_START = sec(3.5);
const SEL_STEP = sec(0.42);

// ── beats (frames @60fps) — deliberately uneven lengths ──────────────────────
const T = {
  pickEnd: SEL_START + 10 * SEL_STEP + sec(0.4),
  mergeEnd: 0, // the ten cards collapse into one packet
  travel1: [0, 0] as [number, number], // packet flies to the pool
  poolHold: 0,
  gather: [0, 0] as [number, number], // five packets collapse into the pool
  unfold: [0, 0] as [number, number], // the pool unfolds into ten lines
  linesHold: 0,
  line: [0, 0] as [number, number], // the oracle's line — glass beat at BX
  settle: [0, 0] as [number, number],
  travel2: [0, 0] as [number, number],
  flow: [0, 0] as [number, number], // losers pay winners — glass beat at DX
  payoutHold: 0,
  payoutOut: [0, 0] as [number, number], // payout fades, camera leaves DX → MX1
  trade: [0, 0] as [number, number], // one person fires one trade @ MX1
  fanFly: [0, 0] as [number, number], // camera MX1 → MX2, the trade travels
  fan: [0, 0] as [number, number], // 1 trade → 10,000 lines @ MX2
  dayFly: [0, 0] as [number, number], // camera MX2 → MX3
  day: [0, 0] as [number, number], // ×100 batches a day → 1,000,000 @ MX3
  zoom: [0, 0] as [number, number], // pull back: nine more sources fall in
  tenM: [0, 0] as [number, number], // grand total → 10,000,000
};
T.mergeEnd = T.pickEnd + sec(1.5);
T.travel1 = [T.mergeEnd, T.mergeEnd + sec(2.4)];
T.poolHold = T.travel1[1] + sec(1.1);
T.gather = [T.poolHold, T.poolHold + sec(0.9)];
T.unfold = [T.gather[1] + sec(0.25), T.gather[1] + sec(0.25) + sec(1.5)];
T.linesHold = T.unfold[1] + sec(0.7);
T.line = [T.linesHold + sec(0.3), T.linesHold + sec(0.3) + sec(2.8)];
T.settle = [T.line[1] + sec(0.5), T.line[1] + sec(0.5) + sec(3.0)];
T.travel2 = [T.settle[1] + sec(0.6), T.settle[1] + sec(2.8)];
T.flow = [T.travel2[1] + sec(0.3), T.travel2[1] + sec(0.3) + sec(2.9)];
T.payoutHold = T.flow[1] + sec(2.2);
T.payoutOut = [T.payoutHold + sec(0.4), T.payoutHold + sec(0.4) + sec(1.9)];
T.trade = [T.payoutOut[1] - sec(0.6), T.payoutOut[1] + sec(1.3)];
T.fanFly = [T.trade[1] + sec(0.2), T.trade[1] + sec(0.2) + sec(1.6)];
T.fan = [T.fanFly[0] + sec(0.5), T.fanFly[1] + sec(1.7)];
T.dayFly = [T.fan[1] + sec(0.5), T.fan[1] + sec(0.5) + sec(1.6)];
T.day = [T.dayFly[0] + sec(0.5), T.dayFly[1] + sec(1.9)];
T.zoom = [T.day[1] + sec(0.7), T.day[1] + sec(0.7) + sec(2.3)];
T.tenM = [T.zoom[0] + sec(0.9), T.zoom[1] + sec(1.1)];
const TOTAL = T.tenM[1] + sec(1.8);

// Camera rides the element along x — to the pool, to the payout, then right
// across the throughput stations — and at the end pulls back and pans down to
// frame the ten-source stack whole.
const camera = (frame: number): { x: number; y: number; scale: number } => {
  const x = interpolate(
    frame,
    [T.travel1[0], T.travel1[1], T.travel2[0], T.travel2[1], T.payoutOut[0], T.payoutOut[1], T.fanFly[0], T.fanFly[1], T.dayFly[0], T.dayFly[1]],
    [AX, BX, BX, DX, DX, MX1, MX1, MX2, MX2, MX3],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOut },
  );
  const y = interpolate(frame, [T.zoom[0], T.zoom[1]], [CY, STACK_CAM_Y], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.inOut,
  });
  const scale = interpolate(frame, [T.zoom[0], T.zoom[1]], [1, ZOOM_SCALE], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.inOut,
  });
  return { x, y, scale };
};

const heroNumber = (size: number): React.CSSProperties => ({
  fontFamily: font,
  fontSize: size,
  fontWeight: 800,
  letterSpacing: "-0.035em",
  lineHeight: 0.95,
  fontVariantNumeric: "tabular-nums",
  background: PILL_GRADIENT,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  filter: "drop-shadow(0 14px 36px rgba(94,120,255,0.4))",
});

const Caption: React.FC<{ frame: number; x: number; y: number; at: number; text: string; until?: number }> = ({ frame, x, y, at, text, until }) => {
  const op = Math.min(ci(frame, at, at + 12, 0, 1), until ? ci(frame, until - 12, until, 1, 0) : 1);
  const ty = ci(frame, at, at + 14, 16, 0, EASE.out);
  if (op <= 0.01) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, ${ty.toFixed(1)}px)`,
        opacity: op,
        whiteSpace: "nowrap",
        display: "inline-flex",
        padding: "14px 34px",
        borderRadius: 999,
        background: PILL_GRADIENT,
        fontFamily: font,
        fontSize: 36,
        fontWeight: 800,
        color: "#fff",
        boxShadow: "0 16px 40px rgba(94,120,255,0.42), inset 0 1px 0 rgba(255,255,255,0.5)",
        textShadow: "0 1px 2px rgba(40,40,90,0.28)",
      }}
    >
      {text}
    </div>
  );
};

export const BatchFlowReel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { x: camX, y: camY, scale } = camera(frame);
  const tx = W / 2 - camX * scale;
  const ty = H / 2 - camY * scale;

  // ── Concept 1: one question — a single binary call, in glass, at AX ────────
  const qReveal = ci(frame, OPEN_Q[0], OPEN_Q[0] + sec(1.0), 0, 1, EASE.out);
  const qOp = Math.min(ci(frame, OPEN_Q[0], OPEN_Q[0] + sec(0.4), 0, 1), ci(frame, OPEN_Q[1] - sec(0.1), OPEN_Q[1] + sec(0.4), 1, 0));
  const qScale = lerp(1, 0.94, ci(frame, OPEN_Q[1] - sec(0.3), OPEN_Q[1] + sec(0.3), 0, 1, EASE.inOut));

  // ── Stage 1: the live dashboard, cursor picking ten markets ────────────────
  const picks = MARKETS.map((m, i) => (frame >= SEL_START + i * SEL_STEP ? m.you : null));
  const p = Math.max(0, Math.min(MARKETS.length - 1.0001, (frame - SEL_START) / SEL_STEP));
  const i0 = Math.floor(p);
  const i1 = Math.min(MARKETS.length - 1, i0 + 1);
  const f = interpolate(p - i0, [0, 1], [0, 1], { easing: EASE.inOut });
  const a = cardButtonPos(i0, MARKETS[i0].you);
  const b = cardButtonPos(i1, MARKETS[i1].you);
  const cursorX = lerp(a.x, b.x, f);
  const cursorY = lerp(a.y, b.y, f);
  const click = frame < SEL_START ? 0 : p - i0 < 0.3 ? 1 - (p - i0) / 0.3 : 0;
  const activeIndex = frame < SEL_START ? null : Math.min(MARKETS.length - 1, Math.round((frame - SEL_START) / SEL_STEP));
  const cursorVisible = frame > SEL_START - sec(0.2) && frame < T.pickEnd;

  // dashboard fades in after the question, recedes as the merge begins
  const dashIn = ci(frame, OPEN_Q[1] - sec(0.2), OPEN_Q[1] + sec(0.5), 0, 1, EASE.out);
  const dashMerge = frame < T.pickEnd ? 1 : ci(frame, T.pickEnd, lerp(T.pickEnd, T.mergeEnd, 0.5), 1, 0, EASE.inOut);
  const dashChromeOp = Math.min(dashIn, dashMerge);
  const dashScale = lerp(0.96, 1, dashIn);

  // ── Stage 1→2: the MERGE — the ten picked cards collapse into one packet ────
  const cardsMerging = frame >= T.pickEnd && frame < T.mergeEnd;
  const cardStagger = sec(0.025);
  const cardDur = sec(0.85);
  const packetBloom = ci(frame, lerp(T.pickEnd, T.mergeEnd, 0.42), T.mergeEnd, 0, 1, EASE.out);

  // ── Stage 3: You + four traders fly into the pool ──────────────────────────
  const RX = 380;
  const RY = 255;
  const ringPos = (k: number): { x: number; y: number } => {
    const ang = (k / N_TRADERS) * Math.PI * 2 - Math.PI / 2;
    return { x: BX + Math.cos(ang) * RX, y: CY + Math.sin(ang) * RY };
  };
  const gatherP = ci(frame, T.gather[0], T.gather[1], 0, 1, EASE.inOut);
  const arrivedCount =
    1 + [1, 2, 3, 4].filter((k) => ci(frame, T.travel1[0] + k * sec(0.18), T.travel1[1], 0, 1) >= 1).length;
  const poolPacketsOp = Math.min(
    ci(frame, T.travel1[0], T.travel1[0] + sec(0.4), 0, 1),
    ci(frame, T.gather[1] - sec(0.05), T.gather[1] + sec(0.05), 1, 0),
  );

  // ── Stage 3→4: the pool box morphs into a header as the lines unfold ───────
  const poolMorph = ci(frame, T.unfold[0], T.unfold[0] + sec(0.55), 0, 1, EASE.inOut);
  const poolBoxY = lerp(CY, CY - 322, poolMorph);
  const poolBoxScale = lerp(1, 0.6, poolMorph);
  const poolBoxOp = Math.min(
    ci(frame, T.travel1[0], T.travel1[0] + sec(0.4), 0, 1),
    ci(frame, T.travel2[0], T.travel2[0] + sec(0.4), 1, 0),
  );

  // ── Concept 2: the oracle's line — glass beat at BX, before the lines settle.
  // The matched lines dim back while the line beat plays, then return to settle.
  const glLineReveal = ci(frame, T.line[0], T.line[0] + sec(1.4), 0, 1, EASE.out);
  const glLineOp = Math.min(ci(frame, T.line[0], T.line[0] + sec(0.4), 0, 1), ci(frame, T.line[1] - sec(0.3), T.line[1], 1, 0));
  const lineDim = 1 - 0.85 * Math.min(ci(frame, T.line[0] - sec(0.3), T.line[0] + sec(0.2), 0, 1), ci(frame, T.line[1] - sec(0.2), T.line[1] + sec(0.3), 1, 0));

  // ── Stage 4–5: the ten matched lines unfold downward, then settle ──────────
  const rowsUnfold = ci(frame, T.unfold[0], T.unfold[0] + sec(1.2), 0, 1, EASE.out);
  const rowsBase = Math.min(ci(frame, T.unfold[0], T.unfold[0] + sec(0.3), 0, 1), ci(frame, T.travel2[0], T.travel2[1], 1, 0));
  const rowsOp = rowsBase * lineDim;

  // ── Concept 3: losers pay the winners — glass beat at DX, before the payout ─
  const glFlowReveal = ci(frame, T.flow[0], T.flow[0] + sec(1.0), 0, 1, EASE.out);
  const glFlow = ci(frame, T.flow[0] + sec(0.4), T.flow[1] - sec(0.2), 0, 1, EASE.inOut);
  const glFlowOp = Math.min(ci(frame, T.flow[0], T.flow[0] + sec(0.4), 0, 1), ci(frame, T.flow[1] - sec(0.3), T.flow[1], 1, 0));

  // ── Stage 6: the payout — winning lines collect (after the flow beat) ───────
  const collected = ci(frame, T.flow[1], T.payoutHold - sec(0.4), 0, YOUR_COLLECT, EASE.out);
  const payoutOp = Math.min(ci(frame, T.flow[1] - sec(0.2), T.flow[1] + sec(0.5), 0, 1), ci(frame, T.payoutOut[0], T.payoutOut[0] + sec(0.6), 1, 0));
  const netOp = ci(frame, T.payoutHold - sec(1.0), T.payoutHold - sec(0.2), 0, 1);

  // ── Throughput 1 — one person fires one trade @ MX1 ────────────────────────
  const personIn = ci(frame, T.payoutOut[1] - sec(0.9), T.payoutOut[1] - sec(0.1), 0, 1, EASE.out);
  const personOp = Math.min(personIn, ci(frame, T.fanFly[0] + sec(0.5), T.fanFly[1], 1, 0));
  // the fired trade travels MX1 → MX2 during the fly, becoming the fan's origin
  const tradeFly = ci(frame, T.fanFly[0], T.fanFly[1], 0, 1, EASE.inOut);
  const tradeDotX = lerp(MX1 + 150, MX2 - 410, tradeFly);
  const tradeDotOp = Math.min(ci(frame, T.trade[1] - sec(0.5), T.trade[1], 0, 1), ci(frame, T.fanFly[1] - sec(0.2), T.fanFly[1], 1, 0));

  // ── Throughput 2 — the trade fans into 10,000 lines @ MX2 ──────────────────
  const fanReveal = ci(frame, T.fan[0], T.fan[1] - sec(0.3), 0, 1, EASE.out);
  const fanCount = ci(frame, T.fan[0] + sec(0.3), T.fan[1] - sec(0.2), 0, LINES_PER_BATCH, EASE.out);
  const fanOp = Math.min(ci(frame, T.fan[0] - sec(0.2), T.fan[0] + sec(0.4), 0, 1), ci(frame, T.dayFly[0] + sec(0.4), T.dayFly[1], 1, 0));

  // ── Throughput 3 — a day repeats it ×100 → 1,000,000 @ MX3 ─────────────────
  const dayStamps = ci(frame, T.day[0], T.day[1] - sec(0.3), 0, BATCHES_PER_DAY, EASE.out);
  const dayProduct = ci(frame, T.day[0] + sec(0.2), T.day[1] - sec(0.2), 0, PER_SOURCE_PER_DAY, EASE.out);
  const dayOp = Math.min(ci(frame, T.day[0] - sec(0.2), T.day[0] + sec(0.4), 0, 1), ci(frame, T.zoom[0], T.zoom[0] + sec(0.6), 1, 0));

  // ── Throughput 4 — pull back: ten sources, grand total → 10,000,000 ────────
  const sourceRise = ci(frame, T.zoom[0] + sec(0.3), T.zoom[1], 0, 1, EASE.out);
  const grandTotal = ci(frame, T.tenM[0], T.tenM[1], PER_SOURCE_PER_DAY, THROUGHPUT_TOTAL, EASE.out);
  const stackOp = ci(frame, T.zoom[0], T.zoom[0] + sec(0.5), 0, 1);

  return (
    <Stage>
      <BrandMark surface="light" />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: TRACK_W,
          height: H,
          transformOrigin: "0 0",
          transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${scale.toFixed(5)})`,
          willChange: "transform",
          background: FIELD_BG,
          backgroundImage: "radial-gradient(circle, rgba(0,113,227,0.22) 1.2px, transparent 1.5px)",
          backgroundSize: "14px 14px",
        }}
      >
        {/* flow spine */}
        <div style={{ position: "absolute", left: AX, top: CY - 1, width: MX2 - AX, height: 2, background: "linear-gradient(90deg, rgba(0,113,227,0.3), rgba(158,123,255,0.3))", opacity: 0.45 }} />

        {/* Concept 1 — one question, in glass, at AX */}
        {qOp > 0.01 && (
          <div style={{ position: "absolute", left: AX, top: CY, transform: `translate(-50%,-50%) scale(${qScale.toFixed(3)})`, opacity: qOp, zIndex: 45 }}>
            <GlassQuestion reveal={qReveal} />
          </div>
        )}

        {/* Stage 1 — the real dashboard, full-frame, centred on AX */}
        {dashChromeOp > 0.01 && (
          <div style={{ position: "absolute", left: AX - W / 2, top: 0, width: W, height: H, opacity: dashChromeOp, transform: `scale(${dashScale.toFixed(3)})`, transformOrigin: "center center" }}>
            <ProductUI picks={picks} activeIndex={activeIndex} />
            {cursorVisible ? <Cursor x={cursorX} y={cursorY} click={click} /> : null}
          </div>
        )}

        {/* Stage 1→2 — the ten picked cards fly to centre and collapse */}
        {cardsMerging &&
          MARKETS.map((m, i) => {
            const o = cardOrigin(i);
            const cx0 = AX - W / 2 + o.x + CARD_W / 2;
            const cy0 = o.y + CARD_H / 2;
            const conv = ci(frame, T.pickEnd + i * cardStagger, T.pickEnd + i * cardStagger + cardDur, 0, 1, EASE.inOut);
            const x = lerp(cx0, AX, conv);
            const y = lerp(cy0, CY, conv);
            const s = lerp(1, 0.11, conv);
            const op = conv < 0.82 ? 1 : interpolate(conv, [0.82, 1], [1, 0], { extrapolateRight: "clamp" });
            return (
              <div key={`merge-${i}`} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${s.toFixed(3)})`, opacity: op, zIndex: 30 }}>
                <MarketCard market={m} index={i} picked={m.you} active={false} />
              </div>
            );
          })}

        {/* Stage 2 — the packet of all ten votes blooms at centre */}
        {frame < T.mergeEnd && packetBloom > 0.01 && (
          <div style={{ position: "absolute", left: AX, top: CY, transform: `translate(-50%,-50%) scale(${lerp(0.55, 1, packetBloom).toFixed(3)})`, opacity: packetBloom, zIndex: 40 }}>
            <Packet picks={YOUR_PICKS} label="You" glow={C.blue} w={320} />
          </div>
        )}

        {/* Stage 3 — You + four traders fly into the pool, then gather in ───── */}
        {poolPacketsOp > 0.01 && (
          <div style={{ opacity: poolPacketsOp }}>
            {[0, 1, 2, 3, 4].map((k) => {
              const ring = ringPos(k);
              const arrive = ci(frame, T.travel1[0] + k * sec(0.18), T.travel1[1], 0, 1, EASE.inOut);
              // You (k=0) enters from the dashboard at AX; the others sweep in from far out.
              const entry =
                k === 0
                  ? { x: AX, y: CY }
                  : { x: BX + (ring.x - BX) * 2.4, y: CY + (ring.y - CY) * 2.4 };
              let x = lerp(entry.x, ring.x, arrive);
              let y = lerp(entry.y, ring.y, arrive);
              let s = k === 0 ? lerp(1.0, 0.66, arrive) : 0.6;
              if (gatherP > 0) {
                x = lerp(ring.x, BX, gatherP);
                y = lerp(ring.y, CY, gatherP);
                s = lerp(s, 0.16, gatherP);
              }
              const op = gatherP > 0 ? 1 - gatherP * 0.92 : 1;
              return (
                <div key={`pk-${k}`} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${s.toFixed(3)})`, opacity: op, zIndex: k === 0 ? 12 : 10 }}>
                  <Packet picks={TRADER_TICKETS[k]} label={TRADER_NAMES[k]} glow={TRADER_COLORS[k]} w={k === 0 ? 320 : 210} />
                </div>
              );
            })}
            {/* trader chips ring */}
            {[1, 2, 3, 4].map((k) => {
              const ring = ringPos(k);
              const chipOp = Math.min(ci(frame, T.travel1[0] + sec(0.3), T.travel1[0] + sec(0.7), 0, 1), 1 - gatherP);
              return (
                <div key={`c${k}`} style={{ position: "absolute", left: ring.x, top: ring.y - 150, transform: "translate(-50%,-50%) scale(0.82)", opacity: chipOp }}>
                  <TraderChip name={TRADER_NAMES[k]} color={TRADER_COLORS[k]} />
                </div>
              );
            })}
          </div>
        )}

        {/* Stage 3 — the POOL box: catches the packets, then morphs into the
            header above the lines */}
        {poolBoxOp > 0.01 && (
          <div
            style={{
              position: "absolute",
              left: BX,
              top: poolBoxY,
              transform: `translate(-50%,-50%) scale(${poolBoxScale.toFixed(3)})`,
              width: 460,
              height: 150,
              borderRadius: 24,
              border: `2px solid ${C.blue}`,
              background: "linear-gradient(160deg, rgba(255,255,255,0.72), rgba(255,255,255,0.48))",
              boxShadow: `0 18px 44px rgba(70,74,140,0.2), 0 0 ${(20 + (arrivedCount / N_TRADERS) * 60).toFixed(0)}px ${C.blue}66, inset 0 1px 0 rgba(255,255,255,0.85)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              opacity: poolBoxOp,
              zIndex: 8,
            }}
          >
            <div style={{ fontFamily: font, fontSize: 42, fontWeight: 800, color: C.text }}>POOL</div>
            <div style={{ fontFamily: monoFont, fontSize: 22, fontWeight: 700, color: C.dim, marginTop: 4 }}>{arrivedCount} / {N_TRADERS} packets · ${arrivedCount * 10}</div>
          </div>
        )}

        {/* Stage 4–5 — the ten matched lines unfold downward, then settle */}
        {rowsOp > 0.01 && (
          <div style={{ position: "absolute", left: BX, top: CY - 250, transform: "translate(-50%, 0)", opacity: rowsOp, maxHeight: (rowsUnfold * 600).toFixed(0) + "px", overflow: "hidden", zIndex: 6 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {MARKETS.map((_m, i) => {
                const reveal = Math.min(1, spring({ fps, frame: frame - (T.unfold[0] + sec(0.2) + i * 3), config: { damping: 16, stiffness: 120, mass: 0.6 }, durationInFrames: 18 }));
                const settle = ci(frame, T.settle[0] + i * 9, T.settle[0] + i * 9 + sec(0.5), 0, 1, EASE.inOut);
                return <LineRow key={i} index={i} barW={440} nameW={220} reveal={reveal} settle={settle} highlightYou />;
              })}
            </div>
          </div>
        )}

        {/* Concept 2 — the oracle's line, in glass, at BX */}
        {glLineOp > 0.01 && (
          <div style={{ position: "absolute", left: BX, top: CY, transform: "translate(-50%,-50%)", opacity: glLineOp, zIndex: 20 }}>
            <GlassLine reveal={glLineReveal} />
          </div>
        )}

        {/* Stage 6 — payout: the ten result cards + the collected total */}
        {payoutOp > 0.01 && (
          <div style={{ position: "absolute", left: DX, top: CY, transform: "translate(-50%,-50%)", textAlign: "center", opacity: payoutOp }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 22 }}>
              {MARKETS.map((m, i) => {
                const won = m.you === m.outcome;
                const r = Math.min(1, spring({ fps, frame: frame - (T.flow[1] + sec(0.1) + i * 4), config: { damping: 15, stiffness: 130, mass: 0.6 }, durationInFrames: 20 }));
                return (
                  <div key={i} style={{ width: 124, padding: "12px 8px 10px", borderRadius: 13, background: "linear-gradient(160deg, rgba(255,255,255,0.66), rgba(255,255,255,0.4))", border: `1.5px solid ${won ? C.up : "rgba(255,255,255,0.6)"}`, boxShadow: won ? `0 12px 28px ${C.up}3D, inset 0 1px 0 rgba(255,255,255,0.85)` : "0 8px 20px rgba(70,74,140,0.12), inset 0 1px 0 rgba(255,255,255,0.8)", opacity: r, transform: `translateY(${((1 - r) * 14).toFixed(1)}px)` }}>
                    <div style={{ fontFamily: font, fontSize: 24, fontWeight: 800, color: m.you === "up" ? C.up : C.down }}>{m.you === "up" ? "▲" : "▼"}</div>
                    <div style={{ fontFamily: font, fontSize: 26, fontWeight: 800, color: won ? C.up : C.down, margin: "3px 0 2px" }}>{won ? "✓" : "✗"}</div>
                    <div style={{ fontFamily: monoFont, fontSize: 15, fontWeight: 700, color: won ? C.text : C.faint }}>{won ? `+$${yourReturn(i).toFixed(2)}` : "—"}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontFamily: monoFont, fontSize: 26, fontWeight: 700, letterSpacing: "0.04em", color: C.dim }}>{YOUR_WINS} OF 10 LINES WON</div>
            <div style={{ ...heroNumber(150), marginTop: 4 }}>${collected.toFixed(2)}</div>
            <div style={{ fontFamily: font, fontSize: 38, fontWeight: 700, color: C.up, opacity: netOp, marginTop: 6 }}>collected — net +${YOUR_NET.toFixed(2)} on ${YOUR_STAKE}</div>
          </div>
        )}

        {/* Concept 3 — losers pay the winners, in glass, at DX (before payout) */}
        {glFlowOp > 0.01 && (
          <div style={{ position: "absolute", left: DX, top: CY, transform: "translate(-50%,-50%)", opacity: glFlowOp, zIndex: 20 }}>
            <GlassFlow reveal={glFlowReveal} flow={glFlow} />
          </div>
        )}

        {/* Throughput 1 — one person, one trade @ MX1 */}
        {personOp > 0.01 && (
          <div style={{ position: "absolute", left: MX1, top: CY, transform: "translate(-50%,-50%)", opacity: personOp, zIndex: 18, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <PersonIcon />
            <div style={{ marginTop: 24, fontFamily: font, fontSize: 42, fontWeight: 800, letterSpacing: "-0.02em", color: C.text }}>One trade</div>
          </div>
        )}
        {/* the fired trade — a glowing packet that travels MX1 → MX2 */}
        {tradeDotOp > 0.01 && (
          <div style={{ position: "absolute", left: tradeDotX, top: CY, transform: "translate(-50%,-50%)", opacity: tradeDotOp, zIndex: 22 }}>
            <div style={{ width: 26, height: 26, borderRadius: 999, background: PILL_GRADIENT, boxShadow: "0 0 28px rgba(94,120,255,0.7), 0 8px 20px rgba(94,120,255,0.5)" }} />
          </div>
        )}

        {/* Throughput 2 — the trade fans into 10,000 lines @ MX2 */}
        {fanOp > 0.01 && (
          <div style={{ position: "absolute", left: MX2 - 450, top: CY, transform: "translate(0,-40%)", opacity: fanOp, zIndex: 16 }}>
            <TradeFan reveal={fanReveal} count={fanCount} />
          </div>
        )}

        {/* Throughput 3 — a day repeats it ×100 → 1,000,000 @ MX3 */}
        {dayOp > 0.01 && (
          <div style={{ position: "absolute", left: MX3, top: CY, transform: "translate(-50%,-50%)", opacity: dayOp, zIndex: 14 }}>
            <DayTimeline stamps={dayStamps} product={dayProduct} />
          </div>
        )}

        {/* Throughput 4 — pull back: ten sources, grand total → 10,000,000 @ MX3 */}
        {stackOp > 0.01 && (
          <div style={{ position: "absolute", left: MX3, top: CY, transform: "translate(-50%,-57px)", opacity: stackOp, zIndex: 12 }}>
            <SourceStack sources={THROUGHPUT_SOURCES} rise={sourceRise} total={grandTotal} perSource={PER_SOURCE_PER_DAY} />
          </div>
        )}

        {/* captions */}
        <Caption frame={frame} x={AX} y={CY + 470} at={SEL_START - sec(0.1)} text="Pick up or down on ten markets" until={T.pickEnd} />
        <Caption frame={frame} x={AX} y={CY + 300} at={lerp(T.pickEnd, T.mergeEnd, 0.45)} text="Ten calls — one packet" until={T.travel1[0] + sec(0.6)} />
        <Caption frame={frame} x={BX} y={CY + 320} at={T.poolHold - sec(0.4)} text="Everyone sends the same packet" until={T.gather[0]} />
        <Caption frame={frame} x={BX} y={CY + 330} at={T.settle[0] + sec(0.4)} text="Every line matched, then settled" until={T.travel2[0]} />
        <Caption frame={frame} x={MX2} y={CY - 300} at={T.fan[0] + sec(0.2)} text="One trade → 10,000 lines" until={T.dayFly[0]} />
        <Caption frame={frame} x={MX3} y={CY + 300} at={T.day[0] + sec(0.3)} text="Same engine. Ten different sources." until={T.zoom[0]} />
      </div>
    </Stage>
  );
};

export const batchFlowReelMeta = {
  id: "BatchFlowReel",
  component: BatchFlowReel,
  durationInFrames: TOTAL,
  fps: FPS,
  width: W,
  height: H,
};
