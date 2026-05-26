import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { FIELD_BG, Stage } from "./chrome";
import { C, EASE, font, FPS, H, monoFont, PILL_GRADIENT, sec, W } from "./theme";
import { LineRow, Packet, TraderChip } from "./flow";
import { cardButtonPos, Cursor, ProductUI } from "./ui";
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

// BatchFlowReel — ONE element handed down the whole pipeline, the camera riding
// it, using the real rich stations (dashboard, traders, lines, payout cards).
// The ten picks on the live dashboard fold into a packet; the packet flies into
// the pool with four other traders; the pool spreads into matched lines; the
// lines settle; the winning lines collect into the payout; the payout
// multiplies; the throughput unlocks a billion in liquidity. No cuts.

const YOUR_PICKS = MARKETS.map((m) => m.you);
const TRADER_TICKETS = TRADER_NAMES.map((_n, t) => MARKETS.map((_m, i) => PICKS_BY_MARKET[i][t]));
const TRADER_COLORS = ["#0071E3", "#FF7A59", "#7B5CFF", "#17B0A6", "#FF6FB5"];
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// ── the track the camera flies over ──────────────────────────────────────────
const AX = 1000; // dashboard → packet (the dashboard is full-frame, centred here)
const BX = 3120; // pool → match → settle
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

// ── beats (frames @60fps) — deliberately uneven lengths ──────────────────────
const T = {
  pickEnd: SEL_START + 10 * SEL_STEP + sec(0.4), // ~5.3s
  foldEnd: 0, // set below
  travel1: [0, 0] as [number, number],
  poolHold: 0,
  spread: [0, 0] as [number, number],
  match: 0,
  settle: [0, 0] as [number, number],
  travel2: [0, 0] as [number, number],
  payoutHold: 0,
  multiply: [0, 0] as [number, number],
  unlock: [0, 0] as [number, number],
};
T.foldEnd = T.pickEnd + sec(1.3);
T.travel1 = [T.foldEnd, T.foldEnd + sec(2.6)];
T.poolHold = T.travel1[1] + sec(1.2);
T.spread = [T.poolHold, T.poolHold + sec(1.6)];
T.match = T.spread[1] + sec(1.8);
T.settle = [T.match, T.match + sec(3.2)];
T.travel2 = [T.settle[1] + sec(0.6), T.settle[1] + sec(3.0)];
T.payoutHold = T.travel2[1] + sec(2.6);
T.multiply = [T.payoutHold + sec(0.5), T.payoutHold + sec(4.8)];
T.unlock = [T.multiply[1] + sec(0.6), T.multiply[1] + sec(4.2)];
const TOTAL = T.unlock[1] + sec(1.2);
const STEP_AT = [T.multiply[0] + sec(0.3), T.multiply[0] + sec(1.7), T.multiply[0] + sec(3.1)];

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
    [T.multiply[0], STEP_AT[2], T.unlock[0], TOTAL],
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

const Caption: React.FC<{ x: number; y: number; at: number; text: string; until?: number }> = ({ x, y, at, text, until }) => {
  const frame = useCurrentFrame();
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
  const click = frame < SEL_START ? 0 : (p - i0) < 0.3 ? 1 - (p - i0) / 0.3 : 0;
  const activeIndex = frame < SEL_START ? null : Math.min(MARKETS.length - 1, Math.round((frame - SEL_START) / SEL_STEP));
  const dashOp = ci(frame, T.pickEnd, T.foldEnd, 1, 0, EASE.inOut);
  const cursorVisible = frame > sec(0.4) && frame < T.pickEnd;

  // ── Stage 1→2: the You packet folds out of the picks, then flies to the pool
  const packetIn = ci(frame, T.pickEnd, T.foldEnd, 0, 1, EASE.out);
  const packetX = interpolate(frame, T.travel1, [AX, BX], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOut });
  const packetGone = ci(frame, T.spread[0], T.spread[1], 1, 0);

  // ── Stage 3: four other traders converge into the pool ─────────────────────
  const arrived = TRADER_NAMES.slice(1).filter((_n, k) => ci(frame, T.travel1[0] + sec(0.3) + k * sec(0.2), T.travel1[1], 0, 1) >= 1).length + 1;
  const poolFill = Math.min(1, arrived / N_TRADERS);
  const poolOp = Math.min(ci(frame, T.travel1[0], T.travel1[0] + sec(0.5), 0, 1), packetGone);

  // ── Stage 4–5: the ten matched lines, then settlement ──────────────────────
  const rowsOp = Math.min(ci(frame, T.spread[0], T.spread[1], 0, 1), ci(frame, T.travel2[0], T.travel2[1], 1, 0));

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

        {/* Stage 1 — the real dashboard, full-frame, centred on AX */}
        {dashOp > 0.01 && (
          <div style={{ position: "absolute", left: AX - W / 2, top: 0, width: W, height: H, opacity: dashOp }}>
            <ProductUI picks={picks} activeIndex={activeIndex} />
            {cursorVisible ? <Cursor x={cursorX} y={cursorY} click={click} /> : null}
          </div>
        )}

        {/* Stage 1→2 — the You packet (the folded picks) flying to the pool */}
        {packetIn > 0.01 && packetGone > 0.01 && (
          <div style={{ position: "absolute", left: packetX, top: CY, transform: `translate(-50%,-50%) scale(${(0.6 + 0.4 * packetIn).toFixed(3)})`, opacity: Math.min(packetIn, packetGone) }}>
            <Packet picks={YOUR_PICKS} label="You" glow={C.blue} w={300} />
          </div>
        )}

        {/* Stage 3 — four traders converge; the five become the pool */}
        {poolOp > 0.01 && (
          <div style={{ opacity: poolOp }}>
            {[1, 2, 3, 4].map((k, idx) => {
              const angle = (idx / 4) * Math.PI * 2;
              const t = ci(frame, T.travel1[0] + sec(0.3) + idx * sec(0.2), T.travel1[1], 0, 1, EASE.inOut);
              const ox = Math.cos(angle) * 520;
              const oy = Math.sin(angle) * 360;
              const x = lerp(BX + ox, BX, t);
              const y = lerp(CY + oy, CY, t);
              const op = t < 0.85 ? 1 : interpolate(t, [0.85, 1], [1, 0.35]);
              return (
                <div key={k} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${lerp(0.62, 0.34, t).toFixed(3)})`, opacity: op }}>
                  <Packet picks={TRADER_TICKETS[k]} label={TRADER_NAMES[k]} glow={TRADER_COLORS[k]} w={210} />
                </div>
              );
            })}
            {/* trader chips ring */}
            {[1, 2, 3, 4].map((k, idx) => {
              const angle = (idx / 4) * Math.PI * 2;
              return (
                <div key={`c${k}`} style={{ position: "absolute", left: BX + Math.cos(angle) * 560, top: CY + Math.sin(angle) * 390, transform: "translate(-50%,-50%) scale(0.9)", opacity: ci(frame, T.travel1[0], T.travel1[0] + sec(0.4), 0, 1) }}>
                  <TraderChip name={TRADER_NAMES[k]} color={TRADER_COLORS[k]} />
                </div>
              );
            })}
            <div
              style={{
                position: "absolute",
                left: BX,
                top: CY,
                transform: "translate(-50%,-50%)",
                width: 460,
                height: 150,
                borderRadius: 24,
                border: `2px solid ${C.blue}`,
                background: "linear-gradient(160deg, rgba(255,255,255,0.72), rgba(255,255,255,0.48))",
                boxShadow: `0 18px 44px rgba(70,74,140,0.2), 0 0 ${(20 + poolFill * 60).toFixed(0)}px ${C.blue}66, inset 0 1px 0 rgba(255,255,255,0.85)`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ fontFamily: font, fontSize: 42, fontWeight: 800, color: C.text }}>POOL</div>
              <div style={{ fontFamily: monoFont, fontSize: 22, fontWeight: 700, color: C.dim, marginTop: 4 }}>{arrived} / 5 packets · ${arrived * 10}</div>
            </div>
          </div>
        )}

        {/* Stage 4–5 — matched lines, then settlement */}
        {rowsOp > 0.01 && (
          <div style={{ position: "absolute", left: BX, top: CY, transform: "translate(-50%,-50%)", opacity: rowsOp }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {MARKETS.map((_m, i) => {
                const reveal = Math.min(1, spring({ fps, frame: frame - (T.spread[0] + i * 4), config: { damping: 16, stiffness: 120, mass: 0.6 }, durationInFrames: 20 }));
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
        <Caption x={AX} y={CY + 470} at={sec(0.6)} text="Pick up or down on ten markets" until={T.pickEnd} />
        <Caption x={(AX + BX) / 2} y={CY - 230} at={T.foldEnd - sec(0.3)} text="Ten calls — one packet" until={T.travel1[1]} />
        <Caption x={BX} y={CY - 280} at={T.poolHold} text="Everyone sends the same packet" until={T.spread[0]} />
        <Caption x={BX} y={CY - 320} at={T.spread[1]} text="Every line matched, then settled" until={T.travel2[0]} />
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
