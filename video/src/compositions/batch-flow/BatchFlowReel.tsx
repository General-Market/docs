import React from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { FIELD_BG, Stage } from "./chrome";
import { BrandMark } from "../../components/BrandMark";
import { C, EASE, font, FPS, H, monoFont, PILL_GRADIENT, sec, W } from "./theme";
import { LineRow, Packet, TraderChip } from "./flow";
import { CARD_H, CARD_W, cardButtonPos, cardOrigin, Cursor, MarketCard, ProductUI } from "./ui";
import { BlueField } from "../anticheat-edit/props/BlueField";
import { scene } from "../anticheat-edit/props/tokens";
import { FlowBeat, QuestionBeat, ThresholdBeat } from "../parimutuel/beats";
import {
  CHAIN_STEPS,
  LIQUIDITY_UNLOCKED,
  MARKETS,
  N_TRADERS,
  PICKS_BY_MARKET,
  TRADER_NAMES,
  YOUR_COLLECT,
  YOUR_NET,
  YOUR_STAKE,
  YOUR_WINS,
  yourReturn,
} from "./data";

// BatchFlowReel — the batch market, told in sections. Three concept beats (the
// binary question, the oracle's line, losers-pay-winners) cut in on the dark
// field between the glass product stations. The glass pipeline itself is ONE
// element handed down the whole pipeline: ten picks COLLAPSE into one packet of
// all ten votes; the packet flies into the pool with four other traders; the
// five packets GATHER into the pool, which then UNFOLDS into the ten matched
// lines; the lines settle; the winning lines collect into the payout; the payout
// multiplies; the throughput unlocks a billion in liquidity. Every handoff is a
// transform — one object becoming the next — never a crossfade on the same spot.
// Under each dark beat the glass holds a stable frame, then resumes: clean cuts,
// no skipped motion.

const YOUR_PICKS = MARKETS.map((m) => m.you);
const TRADER_TICKETS = TRADER_NAMES.map((_n, t) => MARKETS.map((_m, i) => PICKS_BY_MARKET[i][t]));
const TRADER_COLORS = ["#0071E3", "#FF7A59", "#7B5CFF", "#17B0A6", "#FF6FB5"];
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// ── the track the camera flies over ──────────────────────────────────────────
const AX = 1000; // dashboard → merge → packet (the dashboard is full-frame, centred here)
const BX = 3120; // pool → gather → unfold → settle
const DX = 5240; // payout → multiply → unlock
const CY = 540;
const TRACK_W = 6300;

const ci = (
  frame: number,
  a: number,
  b: number,
  from: number,
  to: number,
  easing?: (t: number) => number,
): number =>
  interpolate(frame, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

// ── pick choreography (the cursor walks the ten cards) ───────────────────────
const SEL_START = sec(0.7);
const SEL_STEP = sec(0.42);

// ── glass-pipeline beats (frames @60fps) — deliberately uneven lengths ───────
const T = {
  pickEnd: SEL_START + 10 * SEL_STEP + sec(0.4), // ~5.3s — ten calls made
  mergeEnd: 0, // the ten cards collapse into one packet
  travel1: [0, 0] as [number, number], // packet flies to the pool
  poolHold: 0,
  gather: [0, 0] as [number, number], // five packets collapse into the pool
  unfold: [0, 0] as [number, number], // the pool unfolds into ten lines
  linesHold: 0,
  settle: [0, 0] as [number, number],
  travel2: [0, 0] as [number, number],
  payoutHold: 0,
  multiply: [0, 0] as [number, number],
  unlock: [0, 0] as [number, number],
};
T.mergeEnd = T.pickEnd + sec(1.5);
T.travel1 = [T.mergeEnd, T.mergeEnd + sec(2.4)];
T.poolHold = T.travel1[1] + sec(1.1);
T.gather = [T.poolHold, T.poolHold + sec(0.9)];
T.unfold = [T.gather[1] + sec(0.25), T.gather[1] + sec(0.25) + sec(1.5)];
T.linesHold = T.unfold[1] + sec(0.8);
T.settle = [T.linesHold, T.linesHold + sec(3.0)];
T.travel2 = [T.settle[1] + sec(0.6), T.settle[1] + sec(2.8)];
T.payoutHold = T.travel2[1] + sec(2.4);
T.multiply = [T.payoutHold + sec(0.5), T.payoutHold + sec(4.6)];
T.unlock = [T.multiply[1] + sec(0.6), T.multiply[1] + sec(4.0)];
const GLASS_TOTAL = T.unlock[1] + sec(1.2);
const STEP_AT = [T.multiply[0] + sec(0.3), T.multiply[0] + sec(1.7), T.multiply[0] + sec(3.1)];

// ── the sectioned reel ───────────────────────────────────────────────────────
//
// The dark concept beats cut in at the narrative seams. The glass timeline is
// split at two points; under each dark beat the glass holds the split frame,
// then resumes from it on the cut back.
const Q_DUR = sec(4.0); // "one question" — opens the reel
const TH_DUR = sec(4.0); // "the oracle draws the line" — before the lines settle
const FL_DUR = sec(4.2); // "the losers pay the winners" — before the payout
const SPLIT_SETTLE = T.linesHold; // section A ends with the lines formed, unsettled
const SPLIT_PAYOUT = T.settle[1]; // section B ends with the lines settled

const Q_FROM = 0;
const A_FROM = Q_FROM + Q_DUR; // glass [0, SPLIT_SETTLE)
const TH_FROM = A_FROM + SPLIT_SETTLE;
const B_FROM = TH_FROM + TH_DUR; // glass [SPLIT_SETTLE, SPLIT_PAYOUT)
const FL_FROM = B_FROM + (SPLIT_PAYOUT - SPLIT_SETTLE);
const C_FROM = FL_FROM + FL_DUR; // glass [SPLIT_PAYOUT, GLASS_TOTAL)
const OUTER_TOTAL = C_FROM + (GLASS_TOTAL - SPLIT_PAYOUT);

// Map the outer frame to the glass timeline: linear inside each glass section,
// held at the split point while a dark beat plays.
const glassFrameAt = (outer: number): number => {
  if (outer < A_FROM) return 0;
  if (outer < TH_FROM) return outer - A_FROM;
  if (outer < B_FROM) return SPLIT_SETTLE;
  if (outer < FL_FROM) return SPLIT_SETTLE + (outer - B_FROM);
  if (outer < C_FROM) return SPLIT_PAYOUT;
  return SPLIT_PAYOUT + (outer - C_FROM);
};

const commas = (n: number): string => Math.round(n).toLocaleString("en-US");

// Camera rides the element along x, pushing in a touch for the multiply climax.
const camera = (frame: number): { x: number; scale: number } => {
  const x = interpolate(
    frame,
    [T.travel1[0], T.travel1[1], T.travel2[0], T.travel2[1]],
    [AX, BX, BX, DX],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOut },
  );
  const scale = interpolate(
    frame,
    [T.multiply[0], STEP_AT[2], T.unlock[0], GLASS_TOTAL],
    [1, 1.06, 1.06, 1.03],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOut },
  );
  return { x, scale };
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

// ── GlassPipeline — the product ride, driven by a frame fed from the outside ──
// (the orchestrator holds this frame steady under each dark beat).
const GlassPipeline: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps } = useVideoConfig();
  const { x: camX, scale } = camera(frame);
  const tx = W / 2 - camX * scale;
  const ty = H / 2 - CY * scale;

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
  const cursorVisible = frame > sec(0.4) && frame < T.pickEnd;

  // ── Stage 1→2: the MERGE — the ten picked cards collapse into one packet ────
  // The non-card chrome (chart, header, panels) recedes first; then each card
  // flies to the packet centre, shrinking, while the packet of all ten votes
  // blooms to receive them. You watch ten calls become one card.
  const dashChromeOp = frame < T.pickEnd ? 1 : ci(frame, T.pickEnd, lerp(T.pickEnd, T.mergeEnd, 0.5), 1, 0, EASE.inOut);
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

  // ── Stage 4–5: the ten matched lines unfold downward, then settle ──────────
  const rowsUnfold = ci(frame, T.unfold[0], T.unfold[0] + sec(1.2), 0, 1, EASE.out);
  const rowsOp = Math.min(ci(frame, T.unfold[0], T.unfold[0] + sec(0.3), 0, 1), ci(frame, T.travel2[0], T.travel2[1], 1, 0));

  // ── Stage 6: the payout — winning lines collect ────────────────────────────
  const collected = ci(frame, T.travel2[0], T.payoutHold - sec(0.4), 0, YOUR_COLLECT, EASE.out);
  const payoutOp = Math.min(ci(frame, T.travel2[0] + sec(0.3), T.travel2[1], 0, 1), ci(frame, T.multiply[0], T.multiply[0] + sec(0.6), 1, 0));
  const netOp = ci(frame, T.payoutHold - sec(1.0), T.payoutHold - sec(0.2), 0, 1);

  // ── Stage 7: multiply ──────────────────────────────────────────────────────
  let mulValue = 1;
  const cum = [1, 10000, 1000000, 10000000];
  for (let i = 0; i < CHAIN_STEPS.length; i++) {
    const t = ci(frame, STEP_AT[i], STEP_AT[i] + sec(0.5), 0, 1, EASE.out);
    if (t > 0) mulValue = cum[i] + (cum[i + 1] - cum[i]) * t;
  }
  const mulOp = Math.min(ci(frame, T.multiply[0], T.multiply[0] + sec(0.5), 0, 1), ci(frame, T.unlock[0], T.unlock[0] + sec(0.6), 1, 0));

  // ── Stage 8: unlock ────────────────────────────────────────────────────────
  const dollars = ci(frame, T.unlock[0] + sec(0.3), T.unlock[1], 0, LIQUIDITY_UNLOCKED, EASE.out);
  const unlockOp = ci(frame, T.unlock[0], T.unlock[0] + sec(0.5), 0, 1);

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
        <div style={{ position: "absolute", left: AX, top: CY - 1, width: DX - AX, height: 2, background: "linear-gradient(90deg, rgba(0,113,227,0.3), rgba(158,123,255,0.3))", opacity: 0.45 }} />

        {/* Stage 1 — the real dashboard, full-frame, centred on AX; its chrome
            recedes as the merge begins */}
        {dashChromeOp > 0.01 && (
          <div style={{ position: "absolute", left: AX - W / 2, top: 0, width: W, height: H, opacity: dashChromeOp }}>
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

        {/* Stage 6 — payout: the ten result cards + the collected total */}
        {payoutOp > 0.01 && (
          <div style={{ position: "absolute", left: DX, top: CY, transform: "translate(-50%,-50%)", textAlign: "center", opacity: payoutOp }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 22 }}>
              {MARKETS.map((m, i) => {
                const won = m.you === m.outcome;
                const r = Math.min(1, spring({ fps, frame: frame - (T.travel2[0] + sec(0.3) + i * 4), config: { damping: 15, stiffness: 130, mass: 0.6 }, durationInFrames: 20 }));
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

        {/* Stage 7 — multiply */}
        {mulOp > 0.01 && (
          <div style={{ position: "absolute", left: DX, top: CY, transform: "translate(-50%,-50%)", textAlign: "center", opacity: mulOp }}>
            <div style={heroNumber(184)}>{commas(mulValue)}</div>
            <div style={{ fontFamily: monoFont, fontSize: 30, fontWeight: 700, letterSpacing: "0.08em", color: C.dim, marginTop: 10 }}>TRADES · PER USER · PER DAY</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 26 }}>
              {CHAIN_STEPS.map((s, i) => {
                const r = Math.min(1, spring({ fps, frame: frame - STEP_AT[i], config: { damping: 14, stiffness: 130, mass: 0.6 }, durationInFrames: 20 }));
                return (
                  <div key={i} style={{ opacity: r, transform: `translateY(${((1 - r) * 14).toFixed(1)}px)`, padding: "13px 20px", borderRadius: 14, background: PILL_GRADIENT, fontFamily: font, fontWeight: 800, fontSize: 30, color: "#fff", boxShadow: "0 12px 30px rgba(94,120,255,0.36)" }}>{s.head}</div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stage 8 — liquidity unlocked */}
        {unlockOp > 0.01 && (
          <div style={{ position: "absolute", left: DX, top: CY, transform: "translate(-50%,-50%)", textAlign: "center", opacity: unlockOp }}>
            <div style={heroNumber(196)}>${commas(dollars)}</div>
            <div style={{ fontFamily: font, fontSize: 42, fontWeight: 700, color: C.text, marginTop: 18 }}>Liquidity unlocked — <span style={{ color: C.up, fontWeight: 800 }}>more than Hyperliquid</span></div>
          </div>
        )}

        {/* captions */}
        <Caption frame={frame} x={AX} y={CY + 470} at={sec(0.6)} text="Pick up or down on ten markets" until={T.pickEnd} />
        <Caption frame={frame} x={AX} y={CY + 300} at={lerp(T.pickEnd, T.mergeEnd, 0.45)} text="Ten calls — one packet" until={T.travel1[0] + sec(0.6)} />
        <Caption frame={frame} x={BX} y={CY + 320} at={T.poolHold - sec(0.4)} text="Everyone sends the same packet" until={T.gather[0]} />
        <Caption frame={frame} x={BX} y={CY + 330} at={T.unfold[1]} text="Every line matched, then settled" until={T.travel2[0]} />
      </div>
    </Stage>
  );
};

// ── DarkBeat — a concept beat on the deep-blue field (the explainer's world) ──
const DarkBeat: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ backgroundColor: scene.blueAbyss }}>
    <BlueField />
    {children}
  </AbsoluteFill>
);

export const BatchFlowReel: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: scene.blueAbyss }}>
      <GlassPipeline frame={glassFrameAt(frame)} />
      <Sequence from={Q_FROM} durationInFrames={Q_DUR} name="1 · one question">
        <DarkBeat>
          <QuestionBeat durationInFrames={Q_DUR} />
        </DarkBeat>
      </Sequence>
      <Sequence from={TH_FROM} durationInFrames={TH_DUR} name="2 · the line">
        <DarkBeat>
          <ThresholdBeat durationInFrames={TH_DUR} />
        </DarkBeat>
      </Sequence>
      <Sequence from={FL_FROM} durationInFrames={FL_DUR} name="3 · losers pay winners">
        <DarkBeat>
          <FlowBeat durationInFrames={FL_DUR} />
        </DarkBeat>
      </Sequence>
    </AbsoluteFill>
  );
};

export const batchFlowReelMeta = {
  id: "BatchFlowReel",
  component: BatchFlowReel,
  durationInFrames: OUTER_TOTAL,
  fps: FPS,
  width: W,
  height: H,
};
