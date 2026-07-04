import React from "react";
import { Img, staticFile } from "remotion";
import { PNL_CARD, CARD_TRACK } from "./copy/outro";

// The PnL share-card that flies over the blurred UI (f1678-1876).
// Art = cleaned plate extract (text inpainted away); all copy is DOM.

const trackAt = (f: number): [number, number, number, number] | null => {
  const T = CARD_TRACK;
  if (f < T[0][0] || f > T[T.length - 1][0]) return null;
  for (let i = 0; i < T.length - 1; i++) {
    const [f0, x0, y0, s0, r0] = T[i];
    const [f1, x1, y1, s1, r1] = T[i + 1];
    if (f >= f0 && f <= f1) {
      const t = f1 === f0 ? 0 : (f - f0) / (f1 - f0);
      return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, s0 + (s1 - s0) * t, r0 + (r1 - r0) * t];
    }
  }
  return null;
};

const W = 809;
const H = 498;

export const PnlCard: React.FC<{ frame: number }> = ({ frame }) => {
  const p = trackAt(frame);
  if (!p) return null;
  const [cx, cy, s, rot] = p;
  const fadeIn = Math.min(1, Math.max(0, (frame - CARD_TRACK[0][0]) / 5));
  return (
    <div
      style={{
        position: "absolute",
        left: cx - W / 2,
        top: cy - H / 2,
        width: W,
        height: H,
        transform: `rotate(${rot.toFixed(2)}deg) scale(${s.toFixed(4)})`,
        transformOrigin: "center",
        opacity: fadeIn,
        filter: "drop-shadow(0 18px 40px rgba(0,0,0,0.55))",
      }}
    >
      <Img
        src={staticFile("realist-assets/ui/pnl-card-art.png")}
        style={{ position: "absolute", inset: 0, width: W, height: H }}
      />
      {/* brand top right */}
      <div style={{ position: "absolute", left: 566, top: 22, fontSize: 34, fontWeight: 700, color: "#e9e9ec", letterSpacing: "0.01em" }}>
        {PNL_CARD.brand}
        <span style={{ fontWeight: 400, fontSize: 26 }}>{PNL_CARD.brandSuffix}</span>
      </div>
      {/* token name */}
      <div style={{ position: "absolute", left: 32, top: 94, fontSize: 38, fontWeight: 500, color: "#e9e9ec" }}>
        {PNL_CARD.token}
      </div>
      {/* pnl black box */}
      <div
        style={{
          position: "absolute",
          left: 30,
          top: 143,
          width: 250,
          height: 74,
          background: "#0a0a0c",
          display: "flex",
          alignItems: "center",
          paddingLeft: 18,
          fontSize: 47,
          fontWeight: 700,
          color: "#ffffff",
        }}
      >
        {PNL_CARD.pnl}
      </div>
      {/* rows */}
      {PNL_CARD.rows.map((r, i) => (
        <React.Fragment key={r.label}>
          <div style={{ position: "absolute", left: 40, top: 290 + i * 40, fontSize: 27, color: "#dcdce0" }}>
            {r.label}
          </div>
          <div style={{ position: "absolute", left: 291, top: 284 + i * 40, fontSize: 27, fontWeight: 600, color: "#f2f2f5" }}>
            {r.value}
          </div>
        </React.Fragment>
      ))}
      {/* handle */}
      <div style={{ position: "absolute", left: 98, top: 396, fontSize: 36, fontWeight: 500, color: "#ececf0" }}>
        {PNL_CARD.handle}
      </div>
      {/* footer */}
      <div style={{ position: "absolute", left: 46, top: 450, fontSize: 17, color: "#d3d3d8" }}>
        {PNL_CARD.footerLeft}
      </div>
      <div style={{ position: "absolute", left: 172, top: 450, fontSize: 17, color: "#e9e9ec", fontWeight: 500 }}>
        {PNL_CARD.footerRight}
      </div>
    </div>
  );
};
