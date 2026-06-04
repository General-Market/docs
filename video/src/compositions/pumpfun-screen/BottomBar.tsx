import React from "react";
import { C, FONT_UI } from "./theme";

export const BottomBar: React.FC = () => (
  <div
    style={{
      display: "flex",
      gap: 16,
      padding: "16px 30px 40px",
      alignItems: "center",
    }}
  >
    <div
      style={{
        flex: 1.4,
        height: 78,
        borderRadius: 18,
        background: C.greenBar,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        color: C.bg,
        fontFamily: FONT_UI,
        fontSize: 30,
        fontWeight: 700,
      }}
    >
      ⬗ Buy
    </div>
    <div
      style={{
        flex: 1,
        height: 78,
        borderRadius: 18,
        background: "#11151c",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        color: C.textMute,
        fontFamily: FONT_UI,
        fontSize: 30,
        fontWeight: 500,
      }}
    >
      ⌕ Search
    </div>
  </div>
);
