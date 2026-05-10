import React from "react";
import { SlideFrame } from "../SlideFrame";
import { COLOR, FONT, SLIDE_COUNT } from "../tokens";

const Column: React.FC<{ label: string; lines: string[] }> = ({
  label,
  lines,
}) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
    <div
      style={{
        fontFamily: FONT.text,
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: COLOR.blue,
      }}
    >
      {label}
    </div>
    {lines.map((line, i) => (
      <div
        key={i}
        style={{
          fontFamily: FONT.display,
          fontSize: 28,
          fontWeight: 400,
          color: i === 0 ? COLOR.ink : COLOR.muted,
          lineHeight: 1.35,
          letterSpacing: "-0.018em",
        }}
      >
        {line}
      </div>
    ))}
  </div>
);

export const Slide04Insight: React.FC = () => {
  return (
    <SlideFrame eyebrow="The Insight" pageNumber={4} pageTotal={SLIDE_COUNT}>
      <h1
        style={{
          fontFamily: FONT.display,
          fontSize: 120,
          fontWeight: 600,
          color: COLOR.ink,
          lineHeight: 1.02,
          letterSpacing: "-0.03em",
          margin: 0,
          marginBottom: 64,
        }}
      >
        Success ={" "}
        <span style={{ color: COLOR.blue }}>LTV</span>
        {" − "}
        <span style={{ color: COLOR.blue }}>CAC</span>
      </h1>

      <div
        style={{
          display: "flex",
          gap: 96,
          width: "100%",
          paddingTop: 32,
          borderTop: `1px solid ${COLOR.line}`,
        }}
      >
        <Column
          label="LTV — higher"
          lines={[
            "Polymarket users lose 99% in twelve months.",
            "You cannot have a customer who isn't there.",
            "GM users keep their money — so they keep using GM.",
          ]}
        />
        <Column
          label="CAC — lower"
          lines={[
            "Traders go where they see others winning.",
            "Bots that win in public are tutorials with a balance attached.",
            "Acquisition collapses into product.",
          ]}
        />
      </div>
    </SlideFrame>
  );
};
