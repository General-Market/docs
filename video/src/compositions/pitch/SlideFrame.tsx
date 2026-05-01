import React from "react";
import { AbsoluteFill } from "remotion";
import { COLOR, FONT, PAD } from "./tokens";

type Props = {
  eyebrow?: string;
  pageNumber?: number;
  pageTotal?: number;
  children: React.ReactNode;
};

export const SlideFrame: React.FC<Props> = ({
  eyebrow,
  pageNumber,
  pageTotal,
  children,
}) => {
  return (
    <AbsoluteFill style={{ background: COLOR.bg }}>
      <div
        style={{
          position: "absolute",
          top: 64,
          left: PAD.x,
          fontFamily: FONT.serif,
          fontSize: 22,
          color: COLOR.muted,
          letterSpacing: "-0.005em",
        }}
      >
        General Market
      </div>

      {pageNumber !== undefined && pageTotal !== undefined && (
        <div
          style={{
            position: "absolute",
            bottom: 64,
            right: PAD.x,
            fontFamily: FONT.sans,
            fontSize: 20,
            color: COLOR.muted,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {String(pageNumber).padStart(2, "0")} / {String(pageTotal).padStart(2, "0")}
        </div>
      )}

      <AbsoluteFill
        style={{
          padding: `${PAD.y}px ${PAD.x}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        <div style={{ width: "100%", maxWidth: 1500 }}>
          {eyebrow && (
            <div
              style={{
                fontFamily: FONT.sans,
                fontSize: 18,
                fontWeight: 500,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: COLOR.muted,
                marginBottom: 56,
              }}
            >
              {eyebrow}
            </div>
          )}
          {children}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
