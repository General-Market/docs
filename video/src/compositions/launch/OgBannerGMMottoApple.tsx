import React from "react";
import { AbsoluteFill } from "remotion";
import { font } from "../../common/fonts";

const BG = "#F5F5F7";
const TEXT = "#1D1D1F";
const ACCENT = "#0071E3";
const SYSTEM_RED = "#FF3B30";

const FilterPill: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 18px 10px 14px",
      borderRadius: 980,
      background: "rgba(255,59,48,0.06)",
      border: "1px solid rgba(255,59,48,0.16)",
    }}
  >
    <svg width="13" height="13" viewBox="0 0 13 13" style={{ display: "block" }}>
      <path
        d="M3.25 3.25 L9.75 9.75 M9.75 3.25 L3.25 9.75"
        stroke={SYSTEM_RED}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
    <div
      style={{
        fontFamily: font,
        fontSize: 14,
        fontWeight: 500,
        color: TEXT,
        letterSpacing: "-0.014em",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  </div>
);

export const OgBannerGMMottoApple: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 38,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: font,
            fontSize: 96,
            fontWeight: 600,
            color: TEXT,
            letterSpacing: "-0.025em",
            lineHeight: 1.0714,
          }}
        >
          Trade easily
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 96,
            fontWeight: 600,
            color: ACCENT,
            letterSpacing: "-0.025em",
            lineHeight: 1.0714,
            marginTop: 4,
          }}
        >
          With an anti-cheat
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 10,
          justifyContent: "center",
          flexWrap: "wrap",
          maxWidth: 1300,
        }}
      >
        <FilterPill label="Front-running" />
        <FilterPill label="Insider trading" />
        <FilterPill label="Stop hunting" />
        <FilterPill label="Spoofing" />
        <FilterPill label="PFOF" />
        <FilterPill label="Latency arb" />
      </div>
    </AbsoluteFill>
  );
};
