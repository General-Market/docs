import React from "react";
import { SlideFrame } from "../SlideFrame";
import { COLOR, FONT, SLIDE_COUNT } from "../tokens";

export const Slide08Business: React.FC = () => {
  return (
    <SlideFrame
      eyebrow="Business Model"
      pageNumber={8}
      pageTotal={SLIDE_COUNT}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 32, marginBottom: 24 }}>
        <div
          style={{
            fontFamily: FONT.display,
            fontSize: 180,
            fontWeight: 600,
            color: COLOR.ink,
            lineHeight: 0.95,
            letterSpacing: "-0.04em",
          }}
        >
          0.1%
        </div>
        <div
          style={{
            fontFamily: FONT.display,
            fontSize: 32,
            fontWeight: 400,
            color: COLOR.muted,
            letterSpacing: "-0.018em",
            paddingBottom: 12,
            maxWidth: 600,
            lineHeight: 1.3,
          }}
        >
          Flat fee on trade volume. Nothing else.
        </div>
      </div>

      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 36,
          fontWeight: 500,
          color: COLOR.ink,
          letterSpacing: "-0.02em",
          marginTop: 48,
          marginBottom: 32,
          paddingTop: 32,
          borderTop: `1px solid ${COLOR.line}`,
        }}
      >
        Success ={" "}
        <span style={{ color: COLOR.blue }}>LTV</span>
        {" − "}
        <span style={{ color: COLOR.blue }}>CAC</span>
      </div>

      <div style={{ display: "flex", gap: 64, width: "100%" }}>
        <Column
          label="LTV — higher"
          lines={[
            "Polymarket users lose 99% in twelve months.",
            "GM users keep their money. So they keep using GM.",
          ]}
        />
        <Column
          label="CAC — lower"
          lines={[
            "Traders go where they see others winning.",
            "Bots that win in public are tutorials with a balance attached.",
          ]}
        />
      </div>
    </SlideFrame>
  );
};

const Column: React.FC<{ label: string; lines: string[] }> = ({
  label,
  lines,
}) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
    <div
      style={{
        fontFamily: FONT.text,
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: COLOR.blue,
        marginBottom: 4,
      }}
    >
      {label}
    </div>
    {lines.map((line, i) => (
      <div
        key={i}
        style={{
          fontFamily: FONT.display,
          fontSize: 22,
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
