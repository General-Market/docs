import React from "react";
import { C, font, monoFont } from "./theme";
import { glassCard } from "./chrome";
import { MARKETS, N_TRADERS, sideCount, type Market } from "./data";

// Shared pieces for the abstract flow beats (after the UI): a trader's packet,
// a trader chip, and a per-market pool bar that can also show its verdict —
// all in the frosted-glass language.

// ── Packet — a trader's ten-line ticket ─────────────────────────────────────
export const Packet: React.FC<{
  picks: ("up" | "down")[];
  label: string;
  amount?: string;
  w?: number;
  dim?: number;
  glow?: string;
}> = ({ picks, label, amount = "$10", w = 248, dim = 1, glow }) => (
  <div
    style={{
      ...glassCard(16),
      width: w,
      border: glow ? `1.5px solid ${glow}` : "1px solid rgba(255,255,255,0.6)",
      boxShadow: glow
        ? `0 16px 38px ${glow}55, inset 0 1px 0 rgba(255,255,255,0.85)`
        : "0 10px 28px rgba(70,74,140,0.14), inset 0 1px 0 rgba(255,255,255,0.85)",
      padding: "14px 16px 16px",
      opacity: dim,
      boxSizing: "border-box",
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
      <span style={{ fontFamily: font, fontSize: 19, fontWeight: 800, color: C.text }}>{label}</span>
      <span style={{ fontFamily: monoFont, fontSize: 15, fontWeight: 700, color: C.dim }}>{amount}</span>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
      {picks.map((p, i) => {
        const up = p === "up";
        const color = up ? C.up : C.down;
        return (
          <div
            key={i}
            style={{
              height: 30,
              borderRadius: 8,
              background: up ? C.upSoft : C.downSoft,
              border: `1px solid ${color}`,
              color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            {up ? "▲" : "▼"}
          </div>
        );
      })}
    </div>
  </div>
);

// ── TraderChip ──────────────────────────────────────────────────────────────
export const TraderChip: React.FC<{ name: string; color: string; size?: number }> = ({
  name,
  color,
  size = 64,
}) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: `linear-gradient(150deg, ${color}, ${color}DD)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font,
        fontSize: size * 0.42,
        fontWeight: 800,
        color: "#fff",
        textShadow: "0 1px 2px rgba(40,40,90,0.3)",
        boxShadow: `0 12px 28px ${color}55, inset 0 1px 0 rgba(255,255,255,0.4)`,
      }}
    >
      {name === "You" ? "Y" : name.replace("Trader ", "")}
    </div>
    <div style={{ fontFamily: font, fontSize: 19, fontWeight: 700, color: C.text }}>{name}</div>
  </div>
);

// ── LineRow — one market's up/down pools, and its verdict ─────────────────────
//
// reveal: 0..1 grows the split bar in. settle: 0..1 resolves it — the losing
// side drains into the winner, which lands full-width with a check.

export const LineRow: React.FC<{
  index: number;
  barW: number;
  nameW?: number;
  reveal?: number;
  settle?: number;
  highlightYou?: boolean;
}> = ({ index, barW, nameW = 230, reveal = 1, settle = 0, highlightYou = false }) => {
  const m: Market = MARKETS[index];
  const up = sideCount(index, "up");
  const down = sideCount(index, "down");
  const total = N_TRADERS;
  const upFrac = up / total;
  const downFrac = down / total;
  const outcomeUp = m.outcome === "up";

  // pool widths at settle=0; at settle=1 winner = full, loser = 0.
  const upW0 = upFrac * barW * reveal;
  const downW0 = downFrac * barW * reveal;
  const upW = outcomeUp ? upW0 + (barW * reveal - upW0) * settle : upW0 * (1 - settle);
  const downW = !outcomeUp ? downW0 + (barW * reveal - downW0) * settle : downW0 * (1 - settle);

  const youWon = m.you === m.outcome;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, height: 52 }}>
      <div
        style={{
          width: nameW,
          textAlign: "right",
          fontFamily: font,
          fontSize: 21,
          fontWeight: highlightYou ? 800 : 600,
          color: highlightYou ? C.text : C.dim,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {m.name}
      </div>
      <div
        style={{
          width: barW,
          height: 30,
          display: "flex",
          borderRadius: 9,
          overflow: "hidden",
          background: "rgba(255,255,255,0.4)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "inset 0 1px 2px rgba(60,64,130,0.12)",
        }}
      >
        <div style={{ width: upW, background: C.up, opacity: outcomeUp ? 1 : 1 - settle * 0.7 }} />
        <div style={{ width: downW, background: C.down, opacity: !outcomeUp ? 1 : 1 - settle * 0.7 }} />
      </div>
      {/* counts / verdict */}
      <div style={{ width: 120, display: "flex", alignItems: "center", gap: 10, fontFamily: monoFont, fontSize: 16, fontWeight: 700 }}>
        {settle < 0.5 ? (
          <>
            <span style={{ color: C.up }}>▲{up}</span>
            <span style={{ color: C.down }}>▼{down}</span>
          </>
        ) : (
          <span style={{ color: outcomeUp ? C.up : C.down, display: "flex", alignItems: "center", gap: 6 }}>
            {outcomeUp ? "▲" : "▼"} {outcomeUp ? "UP" : "DOWN"}
            {highlightYou ? (
              <span style={{ color: youWon ? C.up : C.down, fontWeight: 800 }}>{youWon ? "✓" : "✗"}</span>
            ) : null}
          </span>
        )}
      </div>
    </div>
  );
};
