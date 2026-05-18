import React from "react";
import { AbsoluteFill } from "remotion";
import { C, FONT_DISPLAY } from "../tokens";

export const Chart04: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
    <div style={{ color: C.inkDim, fontFamily: FONT_DISPLAY, fontSize: 32 }}>
      Chart 04 — placeholder
    </div>
  </AbsoluteFill>
);
