import React from "react";
import { C, font, monoFont } from "./theme";
import { glassCard } from "./chrome";
import { MARKETS, N_TRADERS, sideCount, yourReturn, type Market } from "./data";

// The settle stage as ONE connected graph, not ten stacked bars. The pool is a
// hub; the ten markets are nodes on spokes around it; a single oracle sweep
// rotates from the hub and settles every node in one pass — one transaction,
// one batch. The parimutuel ("losers pay winners") happens INSIDE each node:
// the loser arc drains into the winner as the sweep crosses it. The hub counts
// what You collect as your winning nodes resolve. This hub→spokes shape is the
// same one that scales to hub→10,000 in the throughput climax.

const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const RAD = Math.PI / 180;

export const GRAPH_R = 360; // spoke length, hub centre → node centre
const N = MARKETS.length;
const NODE = 138;

// node i sits at this angle (degrees, 0 = up/top), evenly around the hub
export const nodeAngle = (i: number): number => -90 + i * (360 / N);
export const nodePos = (i: number): { x: number; y: number } => {
  const a = nodeAngle(i) * RAD;
  return { x: Math.cos(a) * GRAPH_R, y: Math.sin(a) * GRAPH_R };
};

// ── one market node — a split donut that resolves to its winning side ─────────
const MarketNode: React.FC<{ index: number; resolve: number }> = ({ index, resolve }) => {
  const m: Market = MARKETS[index];
  const up = sideCount(index, "up");
  const down = sideCount(index, "down");
  const outcomeUp = m.outcome === "up";
  const youWon = m.you === m.outcome;
  const winColor = outcomeUp ? C.up : C.down;

  const r = 52;
  const circ = 2 * Math.PI * r;
  const upFrac = up / N_TRADERS;
  const downFrac = down / N_TRADERS;
  // on resolve the winner arc grows to the full ring, the loser drains to zero
  const upArc = lerp(upFrac, outcomeUp ? 1 : 0, resolve);
  const downArc = lerp(downFrac, outcomeUp ? 0 : 1, resolve);

  const settled = resolve > 0.5;
  const glow = youWon ? resolve : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9 }}>
      <div
        style={{
          ...glassCard(999),
          position: "relative",
          width: NODE,
          height: NODE,
          border: `2px solid ${settled ? winColor : "rgba(255,255,255,0.7)"}`,
          boxShadow: `0 14px 34px rgba(70,74,140,0.16), 0 0 ${(glow * 46).toFixed(0)}px ${winColor}${glow > 0.01 ? "55" : "00"}, inset 0 1px 0 rgba(255,255,255,0.85)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={NODE} height={NODE} style={{ position: "absolute", inset: 0 }}>
          <g transform={`rotate(-90 ${NODE / 2} ${NODE / 2})`}>
            <circle cx={NODE / 2} cy={NODE / 2} r={r} fill="none" stroke="rgba(60,64,130,0.10)" strokeWidth={13} />
            <circle cx={NODE / 2} cy={NODE / 2} r={r} fill="none" stroke={C.up} strokeWidth={13} strokeLinecap="butt" strokeDasharray={`${(upArc * circ).toFixed(2)} ${circ.toFixed(2)}`} />
            <circle cx={NODE / 2} cy={NODE / 2} r={r} fill="none" stroke={C.down} strokeWidth={13} strokeLinecap="butt" strokeDasharray={`${(downArc * circ).toFixed(2)} ${circ.toFixed(2)}`} strokeDashoffset={`${(-upArc * circ).toFixed(2)}`} />
          </g>
        </svg>
        {settled ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1 }}>
            <div style={{ fontFamily: font, fontSize: 30, fontWeight: 800, color: winColor }}>{outcomeUp ? "▲" : "▼"}</div>
            <div style={{ fontFamily: font, fontSize: 20, fontWeight: 800, color: youWon ? C.up : C.faint, marginTop: 2 }}>{youWon ? "✓" : "✗"}</div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, fontFamily: monoFont, fontSize: 17, fontWeight: 800 }}>
            <span style={{ color: C.up }}>▲{up}</span>
            <span style={{ color: C.down }}>▼{down}</span>
          </div>
        )}
      </div>
      <div style={{ fontFamily: font, fontSize: 15, fontWeight: 700, color: C.text, maxWidth: 150, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {m.name}
      </div>
      <div style={{ height: 22, opacity: youWon ? resolve : 0 }}>
        <span style={{ fontFamily: monoFont, fontSize: 16, fontWeight: 800, color: C.up }}>+${yourReturn(index).toFixed(2)}</span>
      </div>
    </div>
  );
};

// ── the graph — hub, spokes, the ten nodes, and the rotating oracle sweep ─────
export const SettleGraph: React.FC<{
  unfold: number; // 0..1 spokes + nodes grow out of the hub
  sweep: number; // 0..1 oracle pass rotates from the top, settling each node
  showNet: number; // 0..1 fades the net line in at the end
}> = ({ unfold, sweep, showNet }) => {
  const BOX = 2 * (GRAPH_R + 130);
  const cx = BOX / 2;
  const cy = BOX / 2;
  const sweepDeg = -90 + sweep * 360;
  const nodeResolve = (i: number): number => clamp01((sweepDeg - nodeAngle(i)) / 26);
  // the hub counts what You collect as each winning node resolves
  const collected = MARKETS.reduce((s, _m, i) => s + yourReturn(i) * nodeResolve(i), 0);

  const sweepRad = sweepDeg * RAD;
  const reach = GRAPH_R + 70;

  return (
    <div style={{ position: "relative", width: BOX, height: BOX }}>
      <svg width={BOX} height={BOX} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <radialGradient id="sg-sweep" cx="0%" cy="0%" r="100%" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={C.blue} stopOpacity={0.0} />
            <stop offset="100%" stopColor={C.blue} stopOpacity={0.22} />
          </radialGradient>
        </defs>
        {/* spokes hub → node, drawn outward */}
        {MARKETS.map((_m, i) => {
          const p = nodePos(i);
          const e = clamp01((unfold - i * 0.03) / 0.5);
          return <line key={`s${i}`} x1={cx} y1={cy} x2={cx + p.x * e} y2={cy + p.y * e} stroke="rgba(0,113,227,0.34)" strokeWidth={2.5} strokeLinecap="round" />;
        })}
        {/* faint ring chords between neighbours — the batch is one connected web */}
        {MARKETS.map((_m, i) => {
          const a = nodePos(i);
          const b = nodePos((i + 1) % N);
          const e = clamp01((unfold - 0.4) / 0.5);
          return <line key={`c${i}`} x1={cx + a.x} y1={cy + a.y} x2={cx + b.x} y2={cy + b.y} stroke="rgba(110,91,255,0.20)" strokeWidth={1.6} opacity={e} />;
        })}
        {/* the oracle sweep — a wedge that rotates from the top */}
        {sweep > 0.001 && sweep < 0.999 ? (
          <g>
            <line x1={cx} y1={cy} x2={cx + Math.cos(sweepRad) * reach} y2={cy + Math.sin(sweepRad) * reach} stroke={C.blue} strokeWidth={3} strokeLinecap="round" opacity={0.9} />
            <circle cx={cx + Math.cos(sweepRad) * reach} cy={cy + Math.sin(sweepRad) * reach} r={7} fill={C.blue} />
          </g>
        ) : null}
      </svg>

      {/* nodes */}
      {MARKETS.map((_m, i) => {
        const p = nodePos(i);
        const e = clamp01((unfold - i * 0.03) / 0.5);
        return (
          <div key={`n${i}`} style={{ position: "absolute", left: cx + p.x, top: cy + p.y, transform: `translate(-50%,-50%) scale(${(0.6 + 0.4 * e).toFixed(3)})`, opacity: e }}>
            <MarketNode index={i} resolve={nodeResolve(i)} />
          </div>
        );
      })}

      {/* the hub — the pool, now counting what You collect */}
      <div
        style={{
          position: "absolute",
          left: cx,
          top: cy,
          transform: "translate(-50%,-50%)",
          width: 300,
          height: 300,
          borderRadius: 999,
          ...glassCard(999),
          border: `2.5px solid ${C.blue}`,
          boxShadow: `0 22px 54px rgba(70,74,140,0.22), 0 0 64px ${C.blue}33, inset 0 1px 0 rgba(255,255,255,0.85)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: monoFont, fontSize: 18, fontWeight: 700, letterSpacing: "0.08em", color: C.faint }}>YOU COLLECT</div>
        <div style={{ fontFamily: font, fontSize: 76, fontWeight: 800, letterSpacing: "-0.03em", color: C.text, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
          ${collected.toFixed(2)}
        </div>
        <div style={{ fontFamily: font, fontSize: 22, fontWeight: 700, color: C.up, marginTop: 4, opacity: showNet }}>
          net +${(collected - 10).toFixed(2)} on $10
        </div>
      </div>
    </div>
  );
};
