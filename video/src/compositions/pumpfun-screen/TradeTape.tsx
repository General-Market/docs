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
      textAlign: align,
      color,
      fontFamily: FONT_MONO,
      fontSize: 25,
      whiteSpace: "nowrap",
      overflow: "hidden",
    }}
  >
    {children}
  </span>
);

export const TradeTape: React.FC<{ view: FrameView }> = ({ view }) => {
  return (
    <div style={{ padding: "8px 30px 0" }}>
      {/* tabs */}
      <div
        style={{
          display: "flex",
          gap: 34,
          paddingBottom: 14,
          borderBottom: `1px solid ${C.hairline}`,
        }}
      >
        <span style={{ color: C.text, fontFamily: FONT_UI, fontSize: 26, fontWeight: 600 }}>
          Trades
        </span>
        <span style={{ color: C.textMute, fontFamily: FONT_UI, fontSize: 26 }}>
          Holders (3,599)
        </span>
        <span style={{ color: C.textMute, fontFamily: FONT_UI, fontSize: 26 }}>
          Top Trades
        </span>
      </div>

      {/* column heads */}
      <div style={{ display: "flex", padding: "14px 0 6px" }}>
        <Cell flex={1.1} color={C.textFaint}>Age</Cell>
        <Cell flex={1.6} color={C.textFaint}>USD</Cell>
        <Cell flex={1.3} color={C.textFaint}>MCap</Cell>
        <Cell flex={1.7} align="right" color={C.textFaint}>Trader</Cell>
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
              <Cell flex={1.3} color={C.textMute}>{mcapLabel(r.mcap)}</Cell>
              <Cell flex={1.7} align="right" color={C.textMute}>{r.trader}</Cell>
            </div>
          );
        })}
      </div>
    </div>
  );
};
