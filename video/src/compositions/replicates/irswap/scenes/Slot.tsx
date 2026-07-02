// Frames 4263-4690: the rate "slot" — a floating readout row (teal fixed
// box, red base-rate window, ghost reel column) in the same paper room.
// The UI pops in fully formed at 4268 and pops out after 4684; one
// continuous reel crawl up (2.50→4.50), dwell, and back down.
// 3D: row artwork on a z=0 plane; camera dolly solved from the tracked
// teal digit block (position + width→depth). World = screen at f4498.

import React, { useCallback, useEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from "remotion";
import { loadFont as loadTitillium } from "@remotion/google-fonts/TitilliumWeb";
import { lerp1 } from "../lib/helpers";
import { CameraRig, CanvasPlane, Room, Vignette, DCAM } from "../lib/world";
import type { V3 } from "../lib/world";
import { FloorPaper } from "./floorPaper";

const { fontFamily: FONT, waitUntilDone } = loadTitillium("normal", {
  subsets: ["latin"],
  weights: ["400", "600", "700"],
});

const F0 = 4263;

// ── camera (teal digit block track: u, v, width) ─────────────────
const T_U: [number, number][] = [
  [4268, 290], [4280, 284], [4295, 276], [4310, 266], [4325, 252], [4340, 239], [4355, 227],
  [4370, 218], [4385, 214], [4415, 206], [4430, 201], [4445, 197], [4460, 194], [4475, 191],
  [4490, 189], [4505, 189], [4520, 189], [4535, 191], [4550, 193], [4565, 196], [4580, 198],
  [4595, 200], [4610, 203], [4640, 209], [4655, 211], [4690, 216],
];
const T_V: [number, number][] = [
  [4268, 201], [4280, 203], [4295, 206], [4310, 213], [4325, 220], [4340, 227], [4355, 235],
  [4370, 239], [4385, 240], [4415, 239], [4430, 239], [4445, 239], [4460, 239], [4475, 239],
  [4490, 238], [4520, 238], [4550, 238], [4580, 239], [4610, 238], [4655, 238], [4690, 238],
];
const T_WD: [number, number][] = [
  [4268, 48], [4280, 50], [4310, 55], [4340, 62], [4370, 70], [4415, 75], [4460, 79],
  [4490, 81], [4520, 81], [4580, 79], [4640, 73], [4690, 69],
];
const W_TEAL = { x: -238.5, y: 1.5 };
const camSlot = (f: number): V3 => {
  const wd = lerp1(T_WD, f);
  const cz = (DCAM * 81) / wd;
  const u = lerp1(T_U, f);
  const v = lerp1(T_V, f);
  return [
    W_TEAL.x - ((u - 427) * cz) / DCAM,
    W_TEAL.y - ((240 - v) * cz) / DCAM,
    cz,
  ];
};

// ── reel: value at window center over time ───────────────────────
const O_TABLE: [number, number][] = [
  [4268, 2.5], [4321, 3.0], [4375, 3.5], [4427, 4.0], [4490, 4.5], [4500, 4.53],
  [4508, 4.5], [4547, 4.0], [4581, 3.5], [4617, 3.0], [4651, 2.5], [4684, 2.06],
];

const C = {
  teal: "#137F86",
  red: "#7A0E18",
  ghost: "#C5C5C5",
  border: "#A7A7A7",
  label: "#777777",
} as const;

// artwork canvas maps screen@4498 rect [90,60]-[790,440] 1:1
const AX = 90;
const AY = 60;
const ART_W = 700;
const ART_H = 380;

const ghostAlpha = (steps: number) => {
  const n = Math.abs(steps);
  if (n <= 1) return 0.31;
  if (n <= 2) return 0.24;
  if (n <= 3) return 0.08;
  return 0;
};

const SlotArt: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number, _w: number, _h: number) => {
    if (f < 4268 || f >= 4685) return;
    const S = (u: number, v: number): [number, number] => [u - AX, v - AY];
    // slight tilt of the whole row (right side high)
    const [pcx, pcy] = S(443, 237.5);
    ctx.save();
    ctx.translate(pcx, pcy);
    ctx.rotate((-1.5 * Math.PI) / 180);
    ctx.translate(-pcx, -pcy);
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
    ctx.font = `700 41px ${FONT}`;
    ctx.fillStyle = C.teal;
    const [tdx, tdy] = S(188.5, 239.5);
    ctx.fillText("3.50", tdx, tdy);
    // labels + percent signs
    ctx.font = `400 28px ${FONT}`;
    ctx.fillStyle = C.label;
    const lbl = (text: string, cxu: number, cyv: number, weight = 400, size = 28) => {
      ctx.font = `${weight} ${size}px ${FONT}`;
      const [x, y] = S(cxu, cyv);
      ctx.fillText(text, x, y);
    };
    lbl("%", 268.5, 239.5);
    lbl("Fixed Rate", 339.5, 238.5);
    lbl("Base Rate", 529, 239.5);
    lbl("%", 745, 237.5);
    // ghost reel column
    const o = lerp1(O_TABLE, f);
    const colX = S(652.5, 0)[0];
    const digitAt = (v: number): [number, number] => [colX, S(0, 237.5 + (o - v) * 90)[1]];
    ctx.font = `700 41px ${FONT}`;
    for (let v = 2.0; v <= 6.01; v += 0.5) {
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
    const [wbx, wby] = S(597, 215);
    ctx.save();
    rr(wbx, wby, 116, 45, 6);
    ctx.clip();
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(wbx, wby, 116, 45);
    ctx.fillStyle = C.red;
    for (let v = 2.0; v <= 6.01; v += 0.5) {
      if (Math.abs((v - o) / 0.5) > 1.2) continue;
      const [x, y] = digitAt(v);
      ctx.fillText(v.toFixed(2), x, y);
    }
    ctx.restore();
    rr(wbx, wby, 116, 45, 6);
    ctx.strokeStyle = "#CFCFCF";
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

const useFonts = () => {
  const [, setReady] = useState(false);
  const [handle] = useState(() => delayRender("slot-fonts"));
  useEffect(() => {
    Promise.resolve(waitUntilDone()).then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [handle]);
};

export const Slot: React.FC = () => {
  const local = useCurrentFrame();
  const frame = local + F0;
  useFonts();
  return (
    <AbsoluteFill>
      <Vignette />
      <Room>
        <CameraRig position={camSlot(frame)} />
        <FloorPaper frame={frame} />
        <SlotArt frame={frame} />
      </Room>
    </AbsoluteFill>
  );
};
