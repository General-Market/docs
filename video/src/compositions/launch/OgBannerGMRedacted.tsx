import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { font, monoFont } from "../../common/fonts";

const PAPER = "#F4F0E5";
const PAPER_GRAIN = "#EDE8D8";
const INK = "#1A1614";
const INK_FADED = "#7A6F60";
const RED_STAMP = "#B81E1E";
const GREEN_STAMP = "#0F8A4D";

const Stamp: React.FC<{
  text: string;
  color: string;
  rotate: number;
  size?: number;
}> = ({ text, color, rotate, size = 1 }) => (
  <div
    style={{
      position: "relative",
      transform: `rotate(${rotate}deg)`,
      padding: `${4 * size}px ${10 * size}px`,
      border: `${2.5 * size}px solid ${color}`,
      borderRadius: 4 * size,
      fontFamily: font,
      fontWeight: 900,
      fontSize: 16 * size,
      letterSpacing: "0.16em",
      color,
      textTransform: "uppercase",
      opacity: 0.86,
      background: "rgba(244,240,229,0.55)",
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </div>
);

const RedactedRow: React.FC<{
  index: string;
  category: string;
  width: number;
}> = ({ index, category, width }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 18,
      width,
    }}
  >
    <div
      style={{
        fontFamily: monoFont,
        fontSize: 18,
        fontWeight: 600,
        color: INK_FADED,
        width: 28,
      }}
    >
      {index}
    </div>
    <div
      style={{
        height: 30,
        width: 220,
        background: INK,
        borderRadius: 2,
        position: "relative",
        boxShadow: "0 1px 0 rgba(0,0,0,0.30)",
      }}
    >
      {/* Faint redaction texture: subtle horizontal lines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 4px)",
          borderRadius: 2,
        }}
      />
    </div>
    <div
      style={{
        fontFamily: font,
        fontSize: 22,
        fontWeight: 600,
        color: INK,
        letterSpacing: "-0.012em",
        flex: 1,
        whiteSpace: "nowrap",
      }}
    >
      {category}
    </div>
    <Stamp text="VOID" color={RED_STAMP} rotate={-6} />
  </div>
);

export const OgBannerGMRedacted: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: PAPER,
        backgroundImage: `
          radial-gradient(circle at 20% 30%, ${PAPER_GRAIN} 0%, transparent 40%),
          radial-gradient(circle at 80% 70%, ${PAPER_GRAIN} 0%, transparent 50%),
          repeating-linear-gradient(
            45deg,
            transparent 0px,
            transparent 6px,
            rgba(0,0,0,0.012) 6px,
            rgba(0,0,0,0.012) 7px
          )
        `,
      }}
    >
      {/* Top brand bar */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 36,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Img
          src={staticFile("gm-logo.svg")}
          style={{ width: 36, height: 36, borderRadius: 6 }}
        />
        <div
          style={{
            fontFamily: font,
            fontSize: 24,
            fontWeight: 800,
            color: INK,
            letterSpacing: "-0.018em",
          }}
        >
          General
        </div>
      </div>

      {/* Top-right document header */}
      <div
        style={{
          position: "absolute",
          right: 60,
          top: 40,
          textAlign: "right",
          fontFamily: monoFont,
          fontSize: 13,
          fontWeight: 500,
          color: INK_FADED,
          letterSpacing: "0.10em",
          lineHeight: 1.6,
        }}
      >
        FILE NO. 0001 · CLASSIFIED
        <br />
        EFFECTIVE BLOCK 0
      </div>

      {/* Document title */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 110,
          fontFamily: font,
          fontSize: 36,
          fontWeight: 900,
          color: INK,
          letterSpacing: "-0.025em",
          lineHeight: 1.0,
        }}
      >
        Insider access list
      </div>
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 156,
          fontFamily: font,
          fontSize: 14,
          fontWeight: 500,
          color: INK_FADED,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        Persons denied entry
      </div>

      {/* Horizontal divider */}
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          top: 196,
          height: 2,
          background: INK,
          opacity: 0.85,
        }}
      />

      {/* Redacted rows */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 220,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          width: 760,
        }}
      >
        <RedactedRow index="01" category="Insider Traders" width={760} />
        <RedactedRow index="02" category="Front Runners" width={760} />
        <RedactedRow index="03" category="Market Manipulators" width={760} />
        <RedactedRow index="04" category="Orderflow Buyers" width={760} />
      </div>

      {/* @you VERIFIED card — right side */}
      <div
        style={{
          position: "absolute",
          right: 60,
          top: 220,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            background: "#FFFFFF",
            border: `2px solid ${INK}`,
            padding: "14px 22px 16px 22px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            boxShadow: "3px 3px 0 rgba(0,0,0,0.85)",
          }}
        >
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 11,
              fontWeight: 700,
              color: INK_FADED,
              letterSpacing: "0.18em",
            }}
          >
            HOLDER
          </div>
          <div
            style={{
              fontFamily: font,
              fontSize: 30,
              fontWeight: 800,
              color: INK,
              letterSpacing: "-0.025em",
              lineHeight: 1,
            }}
          >
            @you
          </div>
        </div>
        <Stamp text="VERIFIED" color={GREEN_STAMP} rotate={4} size={1.05} />
      </div>
    </AbsoluteFill>
  );
};
