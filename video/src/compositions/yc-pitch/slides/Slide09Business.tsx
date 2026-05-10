import React from "react";
import { SlideFrame } from "../SlideFrame";
import { COLOR, FONT, SLIDE_COUNT } from "../tokens";

export const Slide09Business: React.FC = () => {
  return (
    <SlideFrame
      eyebrow="Business Model"
      pageNumber={9}
      pageTotal={SLIDE_COUNT}
    >
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 240,
          fontWeight: 600,
          color: COLOR.ink,
          lineHeight: 0.95,
          letterSpacing: "-0.04em",
          marginBottom: 32,
        }}
      >
        0.1%
      </div>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 44,
          fontWeight: 400,
          color: COLOR.muted,
          lineHeight: 1.3,
          letterSpacing: "-0.02em",
          marginBottom: 64,
          maxWidth: 1200,
        }}
      >
        A flat fee on trade volume. Nothing else.
      </div>

      <div
        style={{
          display: "flex",
          gap: 48,
          width: "100%",
          paddingTop: 32,
          borderTop: `1px solid ${COLOR.line}`,
        }}
      >
        <Stat
          label="Per trade"
          value="0.1%"
          note="on notional volume"
        />
        <Stat
          label="On deposits"
          value="—"
          note="no listing fee, no spread"
        />
        <Stat
          label="On withdrawals"
          value="—"
          note="no exit fee, no hidden tier"
        />
      </div>
    </SlideFrame>
  );
};

const Stat: React.FC<{ label: string; value: string; note: string }> = ({
  label,
  value,
  note,
}) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
    <div
      style={{
        fontFamily: FONT.text,
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: COLOR.blue,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: FONT.display,
        fontSize: 56,
        fontWeight: 500,
        color: COLOR.ink,
        letterSpacing: "-0.025em",
        lineHeight: 1,
      }}
    >
      {value}
    </div>
    <div
      style={{
        fontFamily: FONT.text,
        fontSize: 17,
        color: COLOR.muted,
        letterSpacing: "-0.022em",
      }}
    >
      {note}
    </div>
  </div>
);
