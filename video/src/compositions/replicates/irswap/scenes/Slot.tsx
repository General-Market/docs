// Frames 4263-4690: the rate "slot" — a floating readout row (teal fixed
// box, red base-rate window, ghost reel column) in the same paper room.
// The UI pops in fully formed at 4268 and pops out after 4684; one
// continuous reel crawl up (2.50→4.50), dwell, and back down.
// 3D: row artwork on a z=0 plane; camera dolly solved from the tracked
// teal digit block (position + width→depth). World = screen at f4498.

import React, { useCallback } from "react";
import { loadFont as loadTitillium } from "@remotion/google-fonts/TitilliumWeb";
import { lerp1 } from "../lib/helpers";
import { CanvasPlane } from "../lib/world";

const { fontFamily: FONT } = loadTitillium("normal", {
  subsets: ["latin"],
  weights: ["400", "600", "700"],
});


// ── reel: value at window center over time ───────────────────────
const O_TABLE: [number, number][] = [
  [4268, 2.5], [4321, 3.0], [4375, 3.5], [4427, 4.0], [4490, 4.5], [4500, 4.53],
  [4508, 4.5], [4547, 4.0], [4581, 3.5], [4617, 3.0], [4651, 2.5], [4684, 2.06],
];

const C = {
  teal: "#2E8B93",
  red: "#8A2E3D",
  ghost: "#C2C2C2",
  border: "#A0A0A0",
  label: "#777777",
} as const;

// artwork canvas maps screen@4498 rect [90,60]-[790,440] 1:1
const AX = 90;
const AY = 60;
const ART_W = 700;
const ART_H = 380;

const ghostAlpha = (steps: number) => {
  const n = Math.abs(steps);
  if (n <= 1) return 0.5;
  if (n <= 2) return 0.42;
  if (n <= 3) return 0.33;
  if (n <= 4) return 0.15;
  return 0;
};

const SlotArt: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number, _w: number, _h: number) => {
    if (f < 4268 || f >= 4685) return;
    // measured coordinates already include the row's slight tilt
    const S = (u: number, v: number): [number, number] => [u - AX, v - AY];
    ctx.save();
    const rr = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };
    // teal box + value
    const [tbx, tby] = S(126, 214);
    rr(tbx, tby, 119, 48, 6);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 41px ${FONT}`;
    ctx.fillStyle = C.teal;
    const [tdx, tdy] = S(188.5, 239.5);
    ctx.fillText("3.50", tdx, tdy);
    // labels + percent signs (labels drawn condensed to match the ref
    // square-techno widths: Fixed Rate 91px, Base Rate 106px)
    ctx.fillStyle = C.label;
    const condensed = (text: string, cxu: number, cyv: number, size: number, k: number) => {
      const [x, y] = S(cxu, cyv);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(k, 1);
      ctx.font = `400 ${size}px ${FONT}`;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    };
    condensed("%", 268.5, 239.5, 27, 1);
    condensed("Fixed Rate", 338.5, 238.5, 28, 0.72);
    condensed("Base Rate", 529, 239.5, 28, 0.95);
    condensed("%", 738, 237, 46, 1);
    // ghost reel column (strip runs 1.50-5.50)
    const o = lerp1(O_TABLE, f);
    const colX = S(652.5, 0)[0];
    const digitAt = (v: number): [number, number] => [colX, S(0, 241 + (o - v) * 90)[1]];
    ctx.font = `400 37px ${FONT}`;
    for (let v = 1.5; v <= 5.51; v += 0.5) {
      const steps = (v - o) / 0.5;
      const a = ghostAlpha(steps);
      if (a <= 0) continue;
      const [x, y] = digitAt(v);
      ctx.globalAlpha = a;
      ctx.fillStyle = C.ghost;
      ctx.fillText(v.toFixed(2), x, y);
      ctx.globalAlpha = 1;
    }
    // window: white fill + red digits clipped inside
    const [wbx, wby] = S(597, 213);
    ctx.save();
    rr(wbx, wby, 116, 50, 6);
    ctx.clip();
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(wbx, wby, 116, 50);
    ctx.fillStyle = C.red;
    ctx.font = `600 37px ${FONT}`;
    for (let v = 1.5; v <= 5.51; v += 0.5) {
      if (Math.abs((v - o) / 0.5) > 1.2) continue;
      const [x, y] = digitAt(v);
      ctx.fillText(v.toFixed(2), x, y);
    }
    ctx.restore();
    rr(wbx, wby, 116, 50, 6);
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }, []);
  return (
    <CanvasPlane
      frame={frame}
      width={ART_W}
      height={ART_H}
      res={2.5}
      position={[AX + ART_W / 2 - 427, 240 - (AY + ART_H / 2), 0]}
      rotation={[0, 0, 0]}
      draw={draw}
      renderOrder={2}
    />
  );
};


// FloorPaper is mounted by the ground layer; SlotWorld owns the readout only.
export const SlotWorld: React.FC<{ frame: number }> = ({ frame }) => {
  return <SlotArt frame={frame} />;
};


