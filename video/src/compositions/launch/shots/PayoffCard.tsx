import React from "react";
import { AbsoluteFill } from "remotion";
import { font } from "../../../common/fonts";

interface PayoffCardProps {
  statement: string;
}

export const PayoffCard: React.FC<PayoffCardProps> = ({ statement }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#ffffff",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 72,
          fontWeight: 900,
          color: "#0e0f0c",
          textAlign: "center",
          lineHeight: 1.1,
          letterSpacing: "-0.03em",
          whiteSpace: "pre-line",
          maxWidth: 1400,
        }}
      >
        {statement}
      </div>
    </AbsoluteFill>
  );
};
