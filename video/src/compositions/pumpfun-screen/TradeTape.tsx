import React from "react";
import { C, FONT_MONO, FONT_UI } from "./theme";
import { mcapLabel } from "./engine";
import type { FrameView } from "./types";

const ageLabel = (s: number) => (s <= 0 ? "now" : `${s}s`);

const Cell: React.FC<{
  children: React.ReactNode;
  flex: number;
  align?: "left" | "right";
  color?: string;
}> = ({ children, flex, align = "left", color = C.text }) => (
  <span
    style={{
      flex,
      display: "flex",
      alignItems: "center",
      justifyContent: align === "right" ? "flex-end" : "flex-start",
      gap: 8,
      color,
      fontFamily: FONT_MONO,
      fontSize: 25,
      fontVariantNumeric: "tabular-nums",
      whiteSpace: "nowrap",
      overflow: "hidden",
    }}
  >
    {children}
  </span>
);

/** Tiny grey holder dot drawn after the trader handle. */
const HolderDot: React.FC = () => (
  <svg width={20} height={20} viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
    <circle cx={10} cy={10} r={8} fill="none" stroke={C.textFaint} strokeWidth={1.5} />
  </svg>
);

export const TradeTape: React.FC<{ view: FrameView }> = ({ view }) => {
  return (
    <div style={{ padding: "8px 30px 0" }}>
      {/* tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 30,
          paddingBottom: 14,
          borderBottom: `1px solid ${C.hairline}`,
        }}
      >
        <span
          style={{ color: C.text, fontFamily: FONT_UI, fontSize: 26, fontWeight: 600 }}
        >
          Trades
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: C.textMute,
            fontFamily: FONT_UI,
            fontSize: 26,
          }}
        >
          Holders ({view.holders.toLocaleString()})
          <span style={{ fontSize: 22 }}>All ⇅</span>
        </span>
        <span style={{ color: C.textMute, fontFamily: FONT_UI, fontSize: 26 }}>
          Top Trades
        </span>
      </div>

      {/* column heads */}
      <div style={{ display: "flex", padding: "14px 0 6px" }}>
        <Cell flex={1.1} color={C.textFaint}>Age ⌄</Cell>
        <Cell flex={1.6} color={C.textFaint}>USD ⇄</Cell>
        <Cell flex={1.4} color={C.textFaint}>Market Cap</Cell>
        <Cell flex={1.7} align="right" color={C.textFaint}>Trader ▽</Cell>
      </div>

      {/* rows */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {view.tape.map((r) => {
          const col = r.kind === "buy" ? C.green : C.red;
          return (
            <div
              key={r.key}
              style={{
                display: "flex",
                alignItems: "center",
                height: 52,
                borderBottom: `1px solid ${C.bgRow}`,
              }}
            >
              <Cell flex={1.1} color={C.textMute}>{ageLabel(r.ageSec)}</Cell>
              <Cell flex={1.6} color={col}>
                {r.kind === "buy" ? "↑" : "↓"} ${r.usd.toFixed(2)}
              </Cell>
              <Cell flex={1.4} color={C.textMute}>{mcapLabel(r.mcap)}</Cell>
              <Cell flex={1.7} align="right" color={C.textMute}>
                {r.trader}
                <HolderDot />
              </Cell>
            </div>
          );
        })}
      </div>
    </div>
  );
};
