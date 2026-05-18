import React from "react";
import { AbsoluteFill } from "remotion";
import { C, FONT_DISPLAY } from "../tokens";

export const Chart03: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
    <div style={{ color: C.inkDim, fontFamily: FONT_DISPLAY, fontSize: 32 }}>
      Chart 03 — placeholder
    </div>
  </AbsoluteFill>
);
