// cls-day scenes: revised schedule → end card (f1466..f3750).
import React from "react";
import { interpolate, Easing } from "remotion";
import { C, clamp, Pack } from "./data";
import {
  TimelineBand,
  MarkerTriangle,
  Milestone,
  Chip,
  HexCity,
  BankHex,
  HandshakePill,
  CheckCircle,
} from "./lib";
import { SchedDoc, ClsPillSlot, LogoCard } from "./scenes1";

const EASE = Easing.bezier(0.4, 0, 0.2, 1);

// ─── S8: revised pay-in schedule 06:30 (f1466..1700) ───
export const S8Revised: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 1466 || frame >= 1712) return null;
  const outP = interpolate(frame, [1700, 1712], [0, 1], clamp);
  // phase A (1466..1500): standard band + gantt doc; zooms in 1500..1522
  // (measured f1520: band h173 pitch ~507 = 3.58×, doc fold at 446..670/570..800)
  // phase B (1535..1600): 06:30 text + chip stack; phase C: revised staircase
  const zoom = interpolate(frame, [1500, 1522], [1, 3.58], { ...clamp, easing: EASE });
  const phaseB = interpolate(frame, [1535, 1550], [0, 1], clamp);
  const phaseC = interpolate(frame, [1595, 1612], [0, 1], clamp);
  const hourAt = interpolate(frame, [1466, 1535], [3.2, 4.4], clamp);
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: 1 - outP }}>
      {phaseB < 1 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${zoom})`,
            transformOrigin: "340px 340px",
            opacity: 1 - phaseB,
          }}
        >
          <TimelineBand originX={960} originHour={hourAt} pxPerHour={141.6} />
          <MarkerTriangle x={958} y={27} size={60} />
          <SchedDoc frame={frame} docP={1} axisP={1} bars={[0, 1, 2, 3, 4]} x={140} y={560} w={500} h={480} fillFrom={0} />
        </div>
      )}
      {/* 06:30 milestone view */}
      {phaseB > 0 && phaseC < 1 && (
        <div style={{ opacity: phaseB * (1 - phaseC) }}>
          <TimelineBand y={0} h={110} originX={1140} originHour={6.5} pxPerHour={340} labelSize={44} tickBelow={34} />
          <Milestone x={1140} lineTop={0} lineBottom={780} />
          <div style={{ position: "absolute", left: 540, top: 660, fontFamily: pack.sans, fontWeight: 700, fontSize: 110, color: C.navyInk }}>
            {pack.milestones.m0630.time}
          </div>
          <div style={{ position: "absolute", left: 546, top: 800, fontFamily: pack.sans, fontSize: 34, color: C.navyInk, lineHeight: 1.3 }}>
            {pack.milestones.m0630.label.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
          {/* chip stack right */}
          {[0, 1, 2, 3, 4, 5].map((k) => {
            const p = interpolate(frame, [1552 + k * 5, 1560 + k * 5], [0, 1], clamp);
            return (
              <Chip
                key={k}
                x={1218}
                y={640 + k * 54}
                w={90}
                h={42}
                color={k === 5 ? C.chipNavy : C.chipGrey}
                opacity={p * 0.95}
              />
            );
          })}
        </div>
      )}
      {/* revised staircase bars (zoomed schedule, grey → navy) */}
      {phaseC > 0 && (
        <div style={{ opacity: phaseC }}>
          <TimelineBand y={0} h={110} originX={interpolate(frame, [1600, 1700], [980, 620], clamp)} originHour={7} pxPerHour={340} labelSize={44} tickBelow={34} />
          <Milestone x={interpolate(frame, [1600, 1700], [980, 620], clamp) - 170} lineTop={0} lineBottom={1080} />
          {[0, 1, 2, 3, 4].map((b) => {
            const navyAt = 1640 + b * 10;
            const isNavy = frame >= navyAt;
            const slide = interpolate(frame, [1600 + b * 6, 1622 + b * 6], [300, 0], { ...clamp, easing: EASE });
            return (
              <div
                key={b}
                style={{
                  position: "absolute",
                  left: 40 + b * 330 + slide,
                  top: 905 - (4 - b) * 60,
                  width: 300 + (b === 4 ? 80 : 0),
                  height: 52,
                  borderRadius: 16,
                  background: isNavy ? C.navyBg : C.chipGrey,
                  border: `3px solid ${C.navyDeep}`,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── S9: zoom times 06:00 | 07:00 → settle band (f1700..1837) ───
export const S9ZoomTimes: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 1700 || frame >= 1850) return null;
  // giant labels sweep left as the clock runs 06:00→07:00
  const sweep = interpolate(frame, [1700, 1790], [500, -900], clamp);
  const zoomOut = interpolate(frame, [1790, 1825], [0, 1], { ...clamp, easing: EASE });
  const scale = interpolate(zoomOut, [0, 1], [1, 0.22]);
  const bandInP = interpolate(frame, [1810, 1830], [0, 1], clamp);
  const labelP = interpolate(frame, [1825, 1840], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white }}>
      {zoomOut < 1 && (
        <div style={{ position: "absolute", inset: 0, transform: `scale(${scale})`, transformOrigin: "960px 200px", opacity: 1 - zoomOut }}>
          {[0, 1].map((i) => {
            const x = 380 + i * 780 + sweep;
            return (
              <React.Fragment key={i}>
                <div style={{ position: "absolute", left: x, top: 130, width: 8, height: 180, background: C.navyInk }} />
                <div style={{ position: "absolute", left: x + 24, top: 152, fontFamily: pack.sans, fontSize: 96, color: C.navyInk }}>
                  {i === 0 ? "06:00" : "07:00"}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}
      {/* settled band with 07:00 milestone */}
      <div style={{ opacity: bandInP }}>
        <TimelineBand originX={960} originHour={7} pxPerHour={141.6} />
        <MarkerTriangle x={958} y={27} size={60} />
        <Milestone
          x={960}
          lineTop={84}
          lineBottom={330}
          time={pack.milestones.m0700.time}
          label={pack.milestones.m0700.label}
          textY={170}
          timeSize={40}
          labelSize={24}
          opacity={labelP}
        />
      </div>
    </div>
  );
};

// ─── S10: settlement flows A/CLS/B + central banks (f1837..2075) ───
export const S10Settle: React.FC<{ frame: number; pack: Pack; PillLogo?: React.FC<{ h: number }> }> = ({
  frame,
  pack,
  PillLogo,
}) => {
  if (frame < 1837 || frame >= 2090) return null;
  const outP = interpolate(frame, [2075, 2090], [0, 1], clamp);
  const hexP = interpolate(frame, [1845, 1868], [0, 1], { ...clamp, easing: EASE });
  const pillP = interpolate(frame, [1872, 1890], [0, 1], clamp);
  const bankP = interpolate(frame, [1900, 1916], [0, 1], clamp);
  const connP = interpolate(frame, [1890, 1912], [0, 1], clamp);
  const ax = 571;
  const bx = 1438;
  const hy = 404;
  // chips travel: A→pill (red, pay-in), central bank→pill, pill→both (pay-outs)
  const chips: { p: number; from: [number, number]; to: [number, number]; color: string }[] = [
    { p: travel(frame, 1930, 1990), from: [ax, hy + 190], to: [880, 812], color: C.chipRed },
    { p: travel(frame, 1960, 2020), from: [1370, 700], to: [1130, 812], color: C.chipGrey },
    { p: travel(frame, 1990, 2050), from: [1060, 812], to: [bx, hy + 190], color: C.chipNavy },
    { p: travel(frame, 2010, 2065), from: [900, 812], to: [ax, hy + 190], color: C.chipCream },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: 1 - outP }}>
      <TimelineBand originX={958} originHour={7} pxPerHour={141.6} />
      <MarkerTriangle x={958} y={27} size={60} />
      <Milestone x={958} lineTop={84} lineBottom={148} time={pack.milestones.m0700.time} label={pack.milestones.m0700.label} textY={160} timeSize={28} labelSize={18} />
      <HexCity x={ax} y={hy} w={380} h={390} letter="A" variant={0} opacity={hexP} />
      <HexCity x={bx} y={hy} w={380} h={390} letter="B" badge="tr" variant={1} opacity={hexP} />
      {bankP > 0 && <BankHex x={1370} y={648} size={100} opacity={bankP} />}
      {connP > 0 && (
        <svg width={1920} height={1080} style={{ position: "absolute", opacity: connP }}>
          <path d={`M ${ax + 10} ${hy + 186} L ${ax + 10} 782 Q ${ax + 10} 812 ${ax + 40} 812 L 796 812`} fill="none" stroke={C.navyDeep} strokeWidth={3.5} />
          <path d="M 796 812 l -22 -12 v 24 z" fill={C.navyDeep} transform="translate(22 0)" />
          <path d={`M 1370 698 L 1370 782 Q 1370 812 1340 812 L 1124 812`} fill="none" stroke={C.navyDeep} strokeWidth={3.5} />
          <path d={`M 1124 812 l 22 -12 v 24 z`} fill={C.navyDeep} transform="translate(-22 0)" />
          <path d={`M ${bx - 10} ${hy + 186} L ${bx - 10} 598`} fill="none" stroke={C.navyDeep} strokeWidth={3.5} />
        </svg>
      )}
      {pillP > 0 && <ClsPillSlot x={826} y={759} w={250} h={107} p={pillP} PillLogo={PillLogo} />}
      {chips.map((c, i) => {
        if (c.p <= 0 || c.p >= 1) return null;
        const x = c.from[0] + (c.to[0] - c.from[0]) * c.p;
        const y = c.from[1] + (c.to[1] - c.from[1]) * c.p;
        return <Chip key={i} x={x - 43} y={y - 17} w={86} h={34} color={c.color} />;
      })}
    </div>
  );
};

const travel = (frame: number, t0: number, t1: number) =>
  interpolate(frame, [t0, t1], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });

// ─── S11: payment instruction docs row (f2075..2237) ───
// Measured f2150 (row is STATIC once settled — f2150 == f2200): 6 regular
// docs 228x285 at y390 (3 navy/grey-blue left, 3 red/cream right) + the
// 2-page focus doc 355x457 at (750,288) under the 07:00 marker.
export const S11DocsRow: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 2075 || frame >= 2250) return null;
  const inP = interpolate(frame, [2092, 2110], [0, 1], { ...clamp, easing: EASE });
  const outP = interpolate(frame, [2237, 2250], [0, 1], clamp);
  const docs = [
    { x: -62, seal: "lines" as const, red: false },
    { x: 208, seal: "square" as const, red: false },
    { x: 475, seal: "circle" as const, red: false },
    { x: 1228, seal: "square" as const, red: true },
    { x: 1493, seal: "triangle" as const, red: true },
    { x: 1763, seal: "circle" as const, red: true },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: 1 - outP }}>
      <TimelineBand originX={958} originHour={7} pxPerHour={141.6} />
      <MarkerTriangle x={958} y={27} size={60} />
      <div style={{ opacity: inP, transform: `scale(${0.92 + 0.08 * inP})`, transformOrigin: "960px 500px" }}>
        {docs.map((d, i) => (
          <RefDoc key={i} x={d.x} y={390} seal={d.seal} red={d.red} />
        ))}
        <FocusDoc x={750} y={288} />
      </div>
    </div>
  );
};

// regular instruction doc, 228x285 (traced f2150)
const RefDoc: React.FC<{ x: number; y: number; seal: "lines" | "square" | "circle" | "triangle"; red: boolean }> = ({
  x,
  y,
  seal,
  red,
}) => {
  const acc = red ? C.red : C.navyBg;
  const fill = red ? C.chipCream : C.chipGrey;
  return (
    <svg width={232} height={289} viewBox="0 0 232 289" style={{ position: "absolute", left: x, top: y }}>
      <path d="M 2 287 L 2 2 L 190 2 L 230 42 L 230 287 Z" fill={C.white} stroke={C.navyDeep} strokeWidth="3" strokeLinejoin="round" />
      <path d="M 190 2 L 190 42 L 230 42" fill="none" stroke={C.navyDeep} strokeWidth="3" />
      {seal === "square" && <rect x={24} y={20} width={26} height={26} fill={acc} />}
      {seal === "circle" && <circle cx={37} cy={33} r={13} fill={acc} />}
      {seal === "triangle" && <path d="M 37 19 L 51 46 L 23 46 Z" fill={acc} />}
      {seal === "lines" && (
        <>
          <rect x={24} y={22} width={44} height={3} fill={C.navyDeep} />
          <rect x={24} y={30} width={34} height={3} fill={C.navyDeep} />
        </>
      )}
      <rect x={62} y={24} width={40} height={2.5} fill={C.navyDeep} />
      <rect x={62} y={32} width={28} height={2.5} fill={C.navyDeep} />
      {/* field row: filled + outline cells */}
      <rect x={118} y={64} width={44} height={20} fill={fill} />
      <rect x={162} y={64} width={44} height={20} fill="none" stroke={C.navyDeep} strokeWidth="2.5" />
      {/* banner with filled inner bar */}
      <rect x={18} y={105} width={192} height={62} fill="none" stroke={C.navyDeep} strokeWidth="3" />
      <rect x={24} y={112} width={180} height={22} fill={fill} />
      {/* text lines */}
      <rect x={18} y={185} width={150} height={3} fill={C.navyDeep} />
      <rect x={18} y={195} width={118} height={3} fill={C.navyDeep} />
      <rect x={18} y={203} width={132} height={3} fill={C.navyDeep} />
      {/* bottom: divider + lines + block */}
      <rect x={36} y={240} width={3} height={32} fill={C.navyDeep} />
      <rect x={46} y={245} width={70} height={2.5} fill={C.navyDeep} />
      <rect x={46} y={253} width={54} height={2.5} fill={C.navyDeep} />
      <rect x={150} y={238} width={56} height={36} fill={fill} />
    </svg>
  );
};

// 2-page focus doc (re-traced f2150 @1.5x): WHITE page 2 with its own
// fold offset (+64,+22), a GREY shadow sliver hugging page 1's right and
// bottom edges, page-2 content fragments peeking on the sliver, and a
// rounded bottom-LEFT corner on page 1 — the old three side tabs were
// invented
const FocusDoc: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <svg width={430} height={500} viewBox="0 0 430 500" style={{ position: "absolute", left: x - 5, top: y - 5 }}>
    {/* page 2 behind (white, own fold) */}
    <path d="M 30 484 L 30 40 L 355 40 L 422 105 L 422 484 Z" fill={C.white} stroke={C.navyDeep} strokeWidth="3" />
    <path d="M 355 40 L 355 105 L 422 105" fill="none" stroke={C.navyDeep} strokeWidth="3" />
    {/* grey drop shadow: page-1 silhouette shifted (+20,+16) */}
    <path d="M 380 478 L 55 478 Q 25 478 25 448 L 25 21 L 310 21 L 380 91 Z" fill="#DFE3E8" />
    {/* page-2 content fragments on the sliver */}
    <rect x={362} y={147} width={33} height={37} fill={C.white} stroke={C.navyDeep} strokeWidth="3" />
    <rect x={362} y={214} width={35} height={86} fill={C.white} stroke={C.navyDeep} strokeWidth="3" />
    {/* page 1 (rounded bottom-left) */}
    <path d="M 360 462 L 35 462 Q 5 462 5 432 L 5 5 L 290 5 L 360 75 Z" fill={C.white} stroke={C.navyDeep} strokeWidth="3.5" strokeLinejoin="round" />
    <path d="M 290 5 L 290 75 L 360 75" fill="none" stroke={C.navyDeep} strokeWidth="3.5" />
    {/* navy pill seal + heading lines */}
    <rect x={32} y={27} width={93} height={40} rx={12} fill={C.navyBg} />
    <rect x={135} y={30} width={75} height={3} fill={C.navyDeep} />
    <rect x={135} y={38} width={58} height={3} fill={C.navyDeep} />
    <rect x={135} y={46} width={66} height={3} fill={C.navyDeep} />
    {/* field row */}
    <rect x={190} y={110} width={70} height={34} fill={C.chipGrey} />
    <rect x={260} y={110} width={70} height={34} fill="none" stroke={C.navyDeep} strokeWidth="3" />
    {/* banner + inner bar */}
    <rect x={32} y={172} width={298} height={85} fill="none" stroke={C.navyDeep} strokeWidth="3.5" />
    <rect x={40} y={182} width={282} height={22} fill={C.chipGrey} />
    {/* lines */}
    <rect x={32} y={297} width={200} height={3.5} fill={C.navyDeep} />
    <rect x={32} y={309} width={160} height={3.5} fill={C.navyDeep} />
    <rect x={240} y={297} width={40} height={3.5} fill={C.navyDeep} />
    {/* bottom: block + divider + lines */}
    <rect x={32} y={367} width={103} height={30} fill={C.chipGrey} />
    <rect x={165} y={367} width={3.5} height={35} fill={C.navyDeep} />
    <rect x={178} y={372} width={150} height={3} fill={C.navyDeep} />
    <rect x={178} y={382} width={120} height={3} fill={C.navyDeep} />
  </svg>
);

export const MiniDoc: React.FC<{ x: number; yMid: number; w: number; h: number; big?: boolean; seed: number }> = ({
  x,
  yMid,
  w,
  h,
  big,
  seed,
}) => {
  const ink = C.navyDeep;
  const accents = [C.navyBg, C.chipGrey, C.red, C.chipCream];
  const acc = accents[seed % 4];
  return (
    <div style={{ position: "absolute", left: x, top: yMid - h / 2 - (big ? 40 : 0) }}>
      {big && (
        <div
          style={{
            position: "absolute",
            left: 14,
            top: 14,
            width: w,
            height: h,
            background: C.white,
            border: `3px solid ${ink}`,
            borderRadius: 4,
          }}
        />
      )}
      <div style={{ position: "relative", width: w, height: h, background: C.white, border: `3px solid ${ink}`, borderRadius: 4 }}>
        <div style={{ position: "absolute", left: w * 0.1, top: h * 0.08, width: w * 0.28, height: h * 0.09, background: acc }} />
        <div style={{ position: "absolute", left: w * 0.1, top: h * 0.3, width: w * 0.8, height: h * 0.1, border: `2px solid ${ink}` }} />
        <div style={{ position: "absolute", left: w * 0.1, top: h * 0.48, width: w * 0.55, height: 3, background: ink }} />
        <div style={{ position: "absolute", left: w * 0.1, top: h * 0.58, width: w * 0.4, height: 3, background: ink }} />
        <div style={{ position: "absolute", left: w * 0.1, top: h * 0.74, width: w * 0.3, height: h * 0.1, background: acc, opacity: 0.6 }} />
      </div>
    </div>
  );
};

// ─── S12: checks on the big doc (f2237..2362) ───
export const S12Checks: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 2237 || frame >= 2375) return null;
  const outP = interpolate(frame, [2362, 2375], [0, 1], clamp);
  const checks = [
    { x: 640, y: 620, at: 2255, tx: 850, ty: 640 },
    { x: 1275, y: 590, at: 2290, tx: 1080, ty: 690 },
    { x: 1320, y: 830, at: 2320, tx: 1090, ty: 800 },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: 1 - outP }}>
      <TimelineBand originX={958} originHour={7} pxPerHour={141.6} />
      <MarkerTriangle x={958} y={27} size={60} />
      <MiniDoc x={840} yMid={720} w={260} h={330} big seed={0} />
      {checks.map((c, i) => {
        const p = interpolate(frame, [c.at, c.at + 10], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) });
        const lineP = interpolate(frame, [c.at + 4, c.at + 14], [0, 1], clamp);
        if (frame < c.at) return null;
        return (
          <React.Fragment key={i}>
            <svg width={1920} height={1080} style={{ position: "absolute", opacity: lineP }}>
              <line x1={c.x} y1={c.y} x2={c.x + (c.tx - c.x) * lineP} y2={c.y + (c.ty - c.y) * lineP} stroke={C.marker} strokeWidth={3} />
              <circle cx={c.tx} cy={c.ty} r={5} fill="none" stroke={C.marker} strokeWidth={2.5} opacity={lineP} />
            </svg>
            <CheckCircle x={c.x} y={c.y} size={74 * Math.min(p, 1.15)} opacity={Math.min(p * 2, 1)} />
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── S13: PvP handshake (f2362..2737) ───
// Measured f2450/f2550/f2700: two FIXED asymmetric city capsules (left top
// y222/bottom y690, vertex 497,455; right top y390/bottom y855, vertex
// 1428,622), an S-rail from the pill (top: left-arrow at x415 y290; bottom:
// right-arrow at x1465 y770), chips spawn at the pill arcs and travel
// OUTWARD at ~7.2px/f (red/cream leftward on top, slate rightward below).
export const S13Pvp: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 2362 || frame >= 2750) return null;
  const outP = interpolate(frame, [2737, 2750], [0, 1], clamp);
  const cityP = interpolate(frame, [2380, 2405], [0, 1], { ...clamp, easing: EASE });
  const pillP = interpolate(frame, [2370, 2390], [0, 1], clamp);
  const pathP = interpolate(frame, [2410, 2440], [0, 1], { ...clamp, easing: EASE });
  // chip schedule (r5, per-frame identity tracking f2490-2735): FOUR
  // waves ~62f apart, each a TRIPLET per rail — top cream/cream/red
  // leftward, bottom grey/navy/grey rightward. Chips ease out of the
  // pill (offsets 0/10/21/39/63 then 27px/f) and are ABSORBED into the
  // rail arrows (leading edge freezes at x393 / x1503, chip compresses).
  const spawnD = (dt: number) => (dt <= 4 ? lut(dt, [[0, 0], [1, 10], [2, 21], [3, 39], [4, 63]]) : 63 + 27 * (dt - 4));
  const waveT0 = [2510.6, 2572.5, 2634.8, 2696.6];
  const waves = waveT0.flatMap((t0) => [
    { t0, dir: -1 as const, color: C.chipCream },
    { t0: t0 + 9.3, dir: -1 as const, color: C.chipCream },
    { t0: t0 + 20.2, dir: -1 as const, color: C.chipRed },
    { t0: t0 - 0.7, dir: 1 as const, color: C.chipGrey },
    { t0: t0 + 8.8, dir: 1 as const, color: C.chipNavy },
    { t0: t0 + 19.3, dir: 1 as const, color: C.chipGrey },
  ]);
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: 1 - outP }}>
      {/* band touches the top edge in this scene (y0 h57), static, no marker */}
      <TimelineBand y={0} h={57} originX={101} originHour={4} pxPerHour={285.7} tickAbove={0} tickBelow={22} labelSize={30} />
      <div style={{ opacity: cityP }}>
        <PvpLeftCity />
        <PvpRightCity />
      </div>
      {/* S-rail: pill top → arc → leftward arrow; pill bottom → arc → rightward arrow */}
      <svg width={1920} height={1080} style={{ position: "absolute", opacity: pathP }}>
        <path d="M 950 425 L 950 345 Q 950 290 895 290 L 445 290" fill="none" stroke={C.navyDeep} strokeWidth={3.5} />
        <path d="M 447 290 l 30 -15 v 30 z" fill={C.navyDeep} transform="rotate(180 462 290)" />
        <path d="M 950 635 L 950 715 Q 950 770 1005 770 L 1435 770" fill="none" stroke={C.navyDeep} strokeWidth={3.5} />
        <path d="M 1433 770 l 30 -15 v 30 z" fill={C.navyDeep} />
      </svg>
      <HandshakePill x={759} y={435} w={380} h={213} opacity={pillP} />
      {waves.map((w, i) => {
        const dt = frame - w.t0;
        if (dt < 0) return null;
        const d = spawnD(dt);
        if (w.dir < 0) {
          const right = 942 - d + 62.5;
          const left = Math.max(942 - d - 62.5, 393);
          if (right - left < 8) return null;
          return <Chip key={i} x={left} y={262} w={right - left} h={55} color={w.color} />;
        }
        const left = 942 + d - 62.5;
        const right = Math.min(942 + d + 62.5, 1503);
        if (right - left < 8) return null;
        return <Chip key={i} x={left} y={743} w={right - left} h={55} color={w.color} />;
      })}
    </div>
  );
};

// left PvP city capsule (traced from ref f2550 crop, absolute coords)
const PvpLeftCity: React.FC = () => (
  <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute" }}>
    {/* capsule frame */}
    <path
      d="M -80 222 L 330 222 Q 365 222 385 255 L 477 415 Q 497 455 477 495 L 405 655 Q 385 690 350 690 L -80 690"
      fill="none"
      stroke={C.navyDeep}
      strokeWidth={4}
    />
    {/* far-left navy building w/ dash windows */}
    <rect x={0} y={405} width={95} height={255} fill={C.white} stroke={C.navyDeep} strokeWidth={3.5} />
    {[0, 1, 2].map((r) =>
      [0, 1, 2].map((c) => (
        <rect key={`${r}${c}`} x={22 + c * 26} y={425 + r * 36} width={6} height={19} fill={C.navyDeep} />
      )),
    )}
    {/* red temple tower: crown + door slots */}
    <line x1={177} y1={252} x2={177} y2={268} stroke={C.red} strokeWidth={3.5} />
    <rect x={107} y={268} width={140} height={18} fill={C.white} stroke={C.red} strokeWidth={3.5} />
    <rect x={100} y={286} width={152} height={16} fill={C.white} stroke={C.red} strokeWidth={3.5} />
    <rect x={115} y={302} width={124} height={183} fill={C.white} stroke={C.red} strokeWidth={3.5} />
    <line x1={130} y1={302} x2={130} y2={485} stroke={C.red} strokeWidth={3.5} />
    <line x1={224} y1={302} x2={224} y2={485} stroke={C.red} strokeWidth={3.5} />
    <rect x={143} y={330} width={28} height={155} fill={C.white} stroke={C.red} strokeWidth={3.5} />
    <rect x={181} y={330} width={28} height={155} fill="#F2C7A9" stroke={C.red} strokeWidth={3.5} />
    <line x1={143} y1={395} x2={171} y2={395} stroke={C.red} strokeWidth={3.5} />
    <line x1={181} y1={395} x2={209} y2={395} stroke={C.red} strokeWidth={3.5} />
    {/* red dash-window block below */}
    <path d="M 85 660 L 85 500 Q 85 485 100 485 L 265 485 L 265 660" fill={C.white} stroke={C.red} strokeWidth={3.5} />
    {[0, 1, 2].map((r) =>
      [0, 1, 2, 3, 4].map((c) => (
        <rect key={`${r}${c}`} x={113 + c * 30} y={512 + r * 45} width={6} height={22} fill={C.red} />
      )),
    )}
    {/* grey slab + right sections building */}
    <rect x={265} y={430} width={35} height={230} fill="#DCDCDC" />
    <rect x={330} y={350} width={100} height={310} fill={C.white} stroke={C.navyDeep} strokeWidth={3.5} />
    {[0, 1].map((r) => (
      <React.Fragment key={r}>
        <rect x={330} y={408 + r * 42} width={100} height={24} fill="none" stroke={C.navyDeep} strokeWidth={3} />
        <line x1={363} y1={408 + r * 42} x2={363} y2={432 + r * 42} stroke={C.navyDeep} strokeWidth={3} />
        <line x1={396} y1={408 + r * 42} x2={396} y2={432 + r * 42} stroke={C.navyDeep} strokeWidth={3} />
      </React.Fragment>
    ))}
    {/* street: car, shed, bollards, posts */}
    <path d="M 55 655 Q 55 640 70 640 L 78 640 L 88 622 L 112 622 L 120 640 Q 132 641 132 652 L 132 655" fill="none" stroke={C.red} strokeWidth={3.5} />
    <circle cx={75} cy={653} r={7} fill="none" stroke={C.red} strokeWidth={3} />
    <circle cx={113} cy={653} r={7} fill="none" stroke={C.red} strokeWidth={3} />
    <rect x={148} y={628} width={52} height={32} fill="none" stroke={C.red} strokeWidth={3.5} />
    <line x1={165} y1={628} x2={165} y2={660} stroke={C.red} strokeWidth={3} />
    <line x1={182} y1={628} x2={182} y2={660} stroke={C.red} strokeWidth={3} />
    <rect x={2} y={632} width={6} height={28} fill={C.blue} />
    <rect x={228} y={632} width={6} height={28} fill={C.blue} />
    <rect x={255} y={638} width={5} height={22} fill={C.chipGrey} />
    {[0, 1, 2].map((i) => (
      <rect key={i} x={300 + i * 11} y={640} width={5} height={20} fill={C.navyDeep} />
    ))}
    {/* ground */}
    <line x1={-80} y1={660} x2={432} y2={660} stroke={C.navyDeep} strokeWidth={4} />
  </svg>
);

// right PvP city capsule (traced from ref f2550 crop, absolute coords)
const PvpRightCity: React.FC = () => (
  <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute" }}>
    {/* capsule frame (vertex on the left) */}
    <path
      d="M 2000 390 L 1595 390 Q 1560 390 1540 423 L 1448 582 Q 1428 622 1448 662 L 1520 822 Q 1540 855 1575 855 L 2000 855"
      fill="none"
      stroke={C.navyDeep}
      strokeWidth={4}
    />
    {/* background building top-left w/ hanging verticals */}
    <rect x={1495} y={440} width={125} height={385} fill={C.white} stroke={C.navyDeep} strokeWidth={3.5} />
    {[0, 1, 2].map((c) => (
      <line key={c} x1={1520 + c * 24} y1={440} x2={1520 + c * 24} y2={498} stroke={C.navyDeep} strokeWidth={3} />
    ))}
    {/* navy rounded building w/ double-line window rows */}
    <path d="M 1465 825 L 1465 530 Q 1465 515 1480 515 L 1580 515 Q 1595 515 1595 530 L 1595 825" fill={C.white} stroke={C.navyDeep} strokeWidth={3.5} />
    {[0, 1, 2, 3].map((r) => (
      <React.Fragment key={r}>
        <rect x={1487} y={600 + r * 44} width={34} height={20} fill="none" stroke={C.navyDeep} strokeWidth={3} />
        <rect x={1537} y={600 + r * 44} width={34} height={20} fill="none" stroke={C.navyDeep} strokeWidth={3} />
      </React.Fragment>
    ))}
    {/* grey slabs */}
    <rect x={1635} y={540} width={20} height={285} fill="#DCDCDC" />
    <rect x={1820} y={620} width={35} height={205} fill="#DCDCDC" />
    {/* central banded red tower */}
    <line x1={1716} y1={390} x2={1716} y2={412} stroke={C.red} strokeWidth={3.5} />
    <rect x={1685} y={412} width={70} height={38} fill={C.white} stroke={C.red} strokeWidth={3.5} />
    <rect x={1665} y={450} width={120} height={375} fill={C.white} stroke={C.red} strokeWidth={3.5} />
    {[0, 1, 2, 3, 4].map((c) => (
      <line key={c} x1={1695 + c * 22} y1={468} x2={1695 + c * 22} y2={515} stroke={C.red} strokeWidth={3.5} />
    ))}
    <line x1={1665} y1={530} x2={1785} y2={530} stroke={C.red} strokeWidth={3} />
    <rect x={1665} y={552} width={95} height={22} fill="#F2C7A9" />
    <line x1={1665} y1={588} x2={1785} y2={588} stroke={C.red} strokeWidth={3} />
    <rect x={1665} y={595} width={120} height={28} fill={C.red} />
    <rect x={1690} y={600} width={26} height={17} fill={C.white} />
    <rect x={1735} y={600} width={26} height={17} fill={C.white} />
    <line x1={1665} y1={648} x2={1785} y2={648} stroke={C.red} strokeWidth={3} />
    <line x1={1665} y1={668} x2={1785} y2={668} stroke={C.red} strokeWidth={3} />
    {/* lower body w/ dashed columns + door */}
    <line x1={1692} y1={690} x2={1692} y2={808} stroke={C.red} strokeWidth={3.5} strokeDasharray="10 9" />
    <line x1={1758} y1={690} x2={1758} y2={808} stroke={C.red} strokeWidth={3.5} strokeDasharray="10 9" />
    <rect x={1718} y={788} width={45} height={37} fill="none" stroke={C.red} strokeWidth={3.5} />
    {[0, 1, 2, 3].map((i) => (
      <rect key={i} x={1724 + i * 9} y={806} width={4} height={19} fill={C.navyDeep} />
    ))}
    {/* right white building w/ double-dash rows */}
    <path d="M 1855 825 L 1855 560 L 1880 560 L 1880 540 L 1920 540" fill={C.white} stroke={C.navyDeep} strokeWidth={3.5} />
    {[0, 1, 2, 3, 4, 5, 6, 7].map((r) => (
      <React.Fragment key={r}>
        <rect x={1868} y={592 + r * 21} width={12} height={5} fill={C.navyDeep} />
        <rect x={1888} y={592 + r * 21} width={12} height={5} fill={C.navyDeep} />
      </React.Fragment>
    ))}
    {/* street: truck, bollards, shed, posts */}
    <path d="M 1472 820 Q 1472 800 1490 800 L 1495 800 L 1495 775 Q 1495 765 1505 765 L 1560 765 Q 1572 765 1572 777 L 1572 820" fill="none" stroke={C.red} strokeWidth={3.5} />
    <line x1={1495} y1={790} x2={1572} y2={790} stroke={C.red} strokeWidth={3} />
    <circle cx={1492} cy={818} r={7} fill="none" stroke={C.red} strokeWidth={3} />
    <circle cx={1552} cy={818} r={7} fill="none" stroke={C.red} strokeWidth={3} />
    {[0, 1, 2].map((i) => (
      <rect key={i} x={1588 + i * 11} y={800} width={5} height={25} fill={C.navyDeep} />
    ))}
    <rect x={1710} y={800} width={5} height={25} fill={C.blue} />
    <rect x={1795} y={800} width={5} height={25} fill={C.blue} />
    {/* ground */}
    <line x1={1497} y1={825} x2={2000} y2={825} stroke={C.navyDeep} strokeWidth={4} />
  </svg>
);

// ─── S14: 09:00 settlement completion target (f2737..2837) ───
export const S14Target: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 2737 || frame >= 2850) return null;
  const inP = interpolate(frame, [2745, 2760], [0, 1], clamp);
  const outP = interpolate(frame, [2837, 2850], [0, 1], clamp);
  // measured: hourAt(960) = 8.15 @f2800 → 8.4 @f2900
  const hourAt = 8.15 + (frame - 2800) * 0.0025;
  const x9 = 960 + (9 - hourAt) * 249;
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: 1 - outP }}>
      <TimelineBand y={221} h={69} originX={960} originHour={hourAt} pxPerHour={249} tickAbove={4} tickBelow={28} labelSize={34} />
      <MarkerTriangle x={955} y={123} size={90} />
      {/* red line at 09:00 from band bottom down */}
      <Milestone x={x9} lineTop={290} lineBottom={880} opacity={inP} />
      <div style={{ position: "absolute", right: 1920 - x9 + 36, top: 570, textAlign: "right", fontFamily: pack.sans, color: C.navyInk, opacity: inP }}>
        <div style={{ fontSize: 100, fontWeight: 700, lineHeight: 1 }}>{pack.milestones.m0900.time}</div>
        <div style={{ fontSize: 36, lineHeight: 1.35, marginTop: 10 }}>
          {pack.milestones.m0900.label.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── S15: brackets + 8.0+ USD trillion (f2837..3040) ───
export const S15Brackets: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 2837 || frame >= 3055) return null;
  const outP = interpolate(frame, [3040, 3055], [0, 1], clamp);
  const hourAt = 8.4;
  const x7 = 960 + (7 - hourAt) * 248;
  const x9 = 960 + (9 - hourAt) * 248;
  const x12 = 960 + (12 - hourAt) * 248;
  const dropP = interpolate(frame, [2845, 2862], [0, 1], { ...clamp, easing: EASE });
  const b1P = interpolate(frame, [2858, 2888], [0, 1], { ...clamp, easing: EASE });
  const b2P = interpolate(frame, [2880, 2915], [0, 1], { ...clamp, easing: EASE });
  const figP = interpolate(frame, [2930, 2955], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: 1 - outP }}>
      <TimelineBand y={221} h={69} originX={960} originHour={hourAt} pxPerHour={248} tickAbove={4} tickBelow={28} labelSize={34} />
      <MarkerTriangle x={955} y={123} size={90} />
      {/* red drop lines at 07:00 and 09:00 (band bottom → settlement bar top) */}
      <div style={{ position: "absolute", left: x7 - 2.5, top: 290, width: 5, height: (500 - 290) * dropP, background: C.marker }} />
      <div style={{ position: "absolute", left: x9 - 2.5, top: 290, width: 5, height: (500 - 290) * dropP, background: C.marker }} />
      <BracketBar x={x7} w={(x9 - x7) * b1P} y={500} h={148} label={pack.brackets.settlement} p={b1P} pack={pack} />
      <BracketBar x={x7} w={(x12 - x7) * b2P} y={692} h={152} label={pack.brackets.funding} p={b2P} pack={pack} />
      {/* 8.0+ USD trillion */}
      <div style={{ position: "absolute", left: 180, top: 545, opacity: figP }}>
        <div style={{ width: 250, height: 6, background: C.red }} />
        <div style={{ fontFamily: pack.serif, fontSize: 195, color: C.red, lineHeight: 1.02 }}>
          {pack.trillion.figure}
          <span style={{ fontSize: 95, verticalAlign: "super" }}>{pack.trillion.sup}</span>
        </div>
        <div style={{ fontFamily: pack.serif, fontSize: 62, color: "#7C8AA4", borderBottom: `5px solid ${C.navyInk}`, display: "inline-block", lineHeight: 1.3 }}>
          {pack.trillion.unit}
        </div>
      </div>
    </div>
  );
};

const BracketBar: React.FC<{ x: number; w: number; y: number; h?: number; label: string; p: number; pack: Pack }> = ({
  x,
  w,
  y,
  h = 148,
  label,
  p,
  pack,
}) => {
  if (p <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: Math.max(w, 10),
        height: h,
        background: C.marker,
        borderRadius: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#FCFCFC",
        fontFamily: pack.sans,
        fontSize: 44,
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      <span style={{ marginRight: 24, fontSize: 50 }}>⟵</span>
      {label}
      <span style={{ marginLeft: 24, fontSize: 50 }}>⟶</span>
    </div>
  );
};

// ─── S16: pay-outs to members A..H (f3040..3200) ───
export const S16Payouts: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 3040 || frame >= 3215) return null;
  const inP = interpolate(frame, [3040, 3055], [0, 1], clamp);
  const outP = interpolate(frame, [3200, 3215], [0, 1], clamp);
  // measured fast pan: hourAt(960) 11.2 @f3100 → 12.1 @f3150
  const hourAt = 11.2 + (frame - 3100) * 0.018;
  const stacks = [2, 4, 3, 2, 5, 3, 2, 4];
  const colors = [C.chipRed, C.chipNavy, C.chipRed, C.chipGrey, C.chipCream, C.chipNavy, C.chipGrey, C.chipNavy];
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: inP * (1 - outP) }}>
      <TimelineBand y={221} h={69} originX={960} originHour={hourAt} pxPerHour={249} tickAbove={4} tickBelow={28} labelSize={34} />
      <MarkerTriangle x={955} y={123} size={90} />
      {pack.members.map((m, i) => {
        const x = 608 + i * 123;
        const flyAt = 3110 + i * 9;
        const fly = interpolate(frame, [flyAt, flyAt + 40], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: "absolute",
                left: x - 28,
                top: 828,
                width: 56,
                height: 56,
                borderRadius: 28,
                background: C.navyBg,
                color: "#FCFCFC",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: pack.serif,
                fontSize: 32,
              }}
            >
              {m}
            </div>
            {Array.from({ length: stacks[i] }, (_, k) => {
              const appear = interpolate(frame, [3050 + i * 6 + k * 4, 3058 + i * 6 + k * 4], [0, 1], clamp);
              const dx = fly * (1400 + i * 100);
              const op = appear * (1 - fly);
              if (op <= 0) return null;
              return (
                <Chip
                  key={k}
                  x={x - 40 + dx}
                  y={780 - k * 46}
                  w={80}
                  h={36}
                  color={k === stacks[i] - 1 ? colors[i] : k % 2 ? C.chipGrey : C.chipCream}
                  opacity={op}
                />
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── S17: summary diagram (f3200..3440) ───
export const S17Summary: React.FC<{ frame: number; pack: Pack; PillLogo?: React.FC<{ h: number }> }> = ({
  frame,
  pack,
  PillLogo,
}) => {
  if (frame < 3200 || frame >= 3394) return null;
  const inP = interpolate(frame, [3208, 3228], [0, 1], clamp);
  const rowsP = [0, 1, 2, 3].map((i) => interpolate(frame, [3250 + i * 14, 3262 + i * 14], [0, 1], clamp));
  // measured band: 02:00 tick at x62, pitch 144.4, y92 h40
  const hx = (h: number) => 62 + (h - 2) * 144.4;
  // exit: accelerating left pan + band drop toward the outro pivot
  // (measured f3372..3393; S18 owns the band from f3394)
  const panX =
    frame < 3372
      ? 0
      : -lut(frame, [
          [3372, 0], [3378, 90], [3382, 220], [3385, 400], [3387, 560], [3388, 680],
          [3389, 820], [3390, 1000], [3391, 1250], [3392, 1800], [3393, 2600],
        ]);
  const drop =
    frame < 3384
      ? 0
      : lut(frame, [
          [3384, 5], [3385, 9], [3386, 15], [3387, 22], [3388, 31], [3389, 44],
          [3390, 61], [3391, 87], [3392, 130], [3393, 211],
        ]);
  const markerP = interpolate(frame, [3388, 3391], [1, 0], clamp);
  const ms = pack.milestones;
  const milestones = [
    { h: 6.5, m: ms.m0630, below: true },
    { h: 7, m: ms.m0700, below: false },
    { h: 9, m: ms.m0900, below: false },
    { h: 12, m: ms.m1200, below: false },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: inP }}>
      <TimelineBand y={92 + drop} originX={hx(7) + panX} originHour={7} pxPerHour={144.4} labels={frame < 3393} labelSize={28} tickBelow={18} />
      <div style={{ opacity: markerP }}>
        <MarkerTriangle x={955} y={27 + drop} size={56} />
      </div>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${panX}px, ${drop}px)` }}>
      {milestones.map(({ h, m, below }, i) => (
        <React.Fragment key={i}>
          {/* red ticks rise ABOVE the band top (measured f3300: y56) */}
          <div style={{ position: "absolute", left: hx(h) - 2.5, top: 56, width: 5, height: below ? 145 : 80, background: C.marker }} />
          <div
            style={{ position: "absolute", left: hx(h) + 8, top: below ? 200 : 140, fontFamily: pack.sans, color: C.navyInk, lineHeight: 1.25 }}
          >
            <div style={{ fontSize: 22, fontWeight: 700 }}>{m.time}</div>
            {m.label.map((l, k) => (
              <div key={k} style={{ fontSize: 17 }}>
                {l}
              </div>
            ))}
          </div>
        </React.Fragment>
      ))}
      {/* hexes + pill + shield (measured centers) */}
      <HexCity x={547} y={413} w={290} h={235} variant={0} dense />
      <HexCity x={1351} y={413} w={290} h={235} variant={1} dense />
      {/* trade executed arrow y393 */}
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <line x1={710} y1={393} x2={1195} y2={393} stroke={C.skyBlue} strokeWidth={3.5} />
        <path d="M 725 393 l 18 -10 v 20 z" fill={C.skyBlue} transform="rotate(180 734 393)" />
        <path d="M 1180 393 l 18 -10 v 20 z" fill={C.skyBlue} />
        {/* connectors flow OUT of the shield sides and UP into the hexes
            (measured f3300: legs y814, verticals x512/x1408, arrowheads UP) */}
        <path d="M 782 814 L 512 814 L 512 545" fill="none" stroke={C.navyDeep} strokeWidth={3} />
        <path d="M 512 548 l -12 20 h 24 z" fill={C.navyDeep} transform="translate(0 -20)" />
        <path d="M 1160 814 L 1408 814 L 1408 545" fill="none" stroke={C.navyDeep} strokeWidth={3} />
        <path d="M 1408 548 l -12 20 h 24 z" fill={C.navyDeep} transform="translate(0 -20)" />
        {/* prior to value date dashed (slate, measured span) */}
        <line x1={575} y1={786} x2={1370} y2={786} stroke={C.chipGrey} strokeWidth={2.5} strokeDasharray="10 8" />
      </svg>
      <div style={{ position: "absolute", left: 860, top: 358, width: 200, textAlign: "center", fontFamily: pack.sans, fontSize: 24, color: C.skyBlue }}>
        {pack.tradeExecuted}
      </div>
      <div style={{ position: "absolute", left: 592, top: 764, fontFamily: pack.sans, fontSize: 20, color: C.skyBlue }}>
        {pack.priorToValueDate}
      </div>
      {/* shield (measured f3300: bottom V at y~880 → h305) */}
      <svg width={384} height={310} viewBox="0 0 384 357" preserveAspectRatio="none" style={{ position: "absolute", left: 777, top: 575 }}>
        <path
          d="M 28 8 Q 8 8 8 30 L 8 250 Q 8 266 23 275 L 180 350 Q 192 356 204 350 L 361 275 Q 376 266 376 250 L 376 30 Q 376 8 356 8 Z"
          fill="#FDFDFD"
          stroke={C.navyDeep}
          strokeWidth={3}
        />
      </svg>
      {/* doc sheet peeking behind the pill (fold top-right, measured) */}
      <svg width={264} height={152} viewBox="0 0 264 152" style={{ position: "absolute", left: 835, top: 445 }}>
        <path d="M 4 148 L 4 4 L 216 4 L 260 48 L 260 148 Z" fill={C.white} stroke={C.navyDeep} strokeWidth="3" strokeLinejoin="round" />
        <path d="M 216 4 L 216 48 L 260 48" fill="none" stroke={C.navyDeep} strokeWidth="3" />
      </svg>
      <ClsPillSlot x={845} y={470} w={245} h={120} p={1} PillLogo={PillLogo} logoScale={0.425} />
      {pack.summaryRows.map((row, i) => {
        const y = [618, 692, 756, 822][i];
        return (
          <div key={i} style={{ opacity: rowsP[i] }}>
            <RowIcon kind={i} x={790} y={y} />
            <div style={{ position: "absolute", left: 872, top: y - 4, fontFamily: pack.sans, fontSize: 22, color: C.navyInk, lineHeight: 1.3 }}>
              {row.map((l, k) => (
                <div key={k}>{l}</div>
              ))}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
};

const RowIcon: React.FC<{ kind: number; x: number; y: number }> = ({ kind, x, y }) => (
  <svg width={54} height={54} viewBox="0 0 44 44" style={{ position: "absolute", left: x, top: y - 12 }}>
    {kind === 0 && (
      <>
        <path d="M 8 40 L 8 4 L 28 4 L 36 12 L 36 40 Z" fill="none" stroke={C.navyDeep} strokeWidth={2.5} />
        <circle cx="22" cy="24" r="7" fill="none" stroke={C.red} strokeWidth={2} />
      </>
    )}
    {(kind === 1 || kind === 3) && (
      <>
        {[0, 1, 2].map((r) => (
          <rect key={r} x={4} y={6 + r * 12} width={22} height={8} rx={4} fill="none" stroke={r ? C.navyDeep : C.red} strokeWidth={2.2} />
        ))}
        <path d={kind === 1 ? "M 30 10 L 42 10 M 37 5 L 42 10 L 37 15" : "M 42 10 L 30 10 M 35 5 L 30 10 L 35 15"} stroke={kind === 1 ? C.red : C.navyDeep} strokeWidth={2.2} fill="none" />
      </>
    )}
    {kind === 2 && <IconHandshakeMini />}
  </svg>
);

const IconHandshakeMini: React.FC = () => (
  <g>
    <path d="M 6 18 L 16 10 L 26 16 L 38 10" fill="none" stroke={C.navyDeep} strokeWidth={2.2} />
    {[0, 1, 2].map((i) => (
      <ellipse key={i} cx={14 + i * 7} cy={24 + i * 3} rx={5} ry={3.6} transform={`rotate(-30 ${14 + i * 7} ${24 + i * 3})`} fill="none" stroke={C.red} strokeWidth={2} />
    ))}
    <path d="M 26 30 Q 32 34 28 38 M 6 34 L 16 38" fill="none" stroke={C.navyDeep} strokeWidth={2.2} />
  </g>
);

// ─── S18: outro world rotation (f3394..3561) ───
// One rigid world: the timeline band sweeps 0→90° (navy plate + shield ride
// in), reverses 90→0 (navy now on top, gauge slides in), red wedge fills
// 0→180°, then the world flips a further 180° with a damped-pendulum settle
// (chips glide in above the band) and rises off before the end-card cut.
// Every curve below is a per-frame measured table
// (.claude/rounds/work/cls-day/r2/outro_measure.csv) — do NOT replace with
// analytic easings; single-anchor fits died in r1.
type Lut = [number, number][];
const lut = (frame: number, t: Lut): number => {
  if (frame <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    if (frame <= t[i][0]) {
      const [f0, v0] = t[i - 1];
      const [f1, v1] = t[i];
      return v0 + ((frame - f0) / (f1 - f0)) * (v1 - v0);
    }
  }
  return t[t.length - 1][1];
};

// band angle (deg, unwrapped: 0→90 up, back to 0, on to 180 + oscillation)
const THETA: Lut = [
  [3406, 0], [3407, 2.4], [3408, 10.7], [3409, 22.6], [3410, 33.9], [3411, 43.5],
  [3412, 51.4], [3413, 57.9], [3414, 63.5], [3415, 68], [3416, 72], [3417, 75.3],
  [3418, 78.1], [3419, 80.6], [3420, 82.6], [3421, 84.3], [3422, 85.8], [3423, 87.1],
  [3424, 88], [3425, 88.8], [3426, 89.3], [3427, 89.7], [3429, 90], [3431, 89.8],
  [3433, 89.4], [3434, 88.8], [3435, 88.2], [3436, 87.4], [3437, 86.4], [3438, 85],
  [3439, 83.5], [3440, 81.4], [3441, 78.6], [3442, 74.7], [3443, 68.7], [3444, 57.2],
  [3445, 32.9], [3446, 21.3], [3447, 15.2], [3448, 11.5], [3449, 8.7], [3450, 6.6],
  [3451, 5], [3452, 3.8], [3453, 2.5], [3454, 1.8], [3455, 1.3], [3456, 0.9],
  [3457, 0.6], [3458, 0.3], [3460, 0], [3481, 0.2], [3482, 0.3], [3483, 0.9],
  [3484, 1.5], [3485, 2.8], [3486, 4.4], [3487, 5.9], [3488, 8.6], [3489, 11.7],
  [3490, 15.5], [3491, 20.7], [3492, 27.7], [3493, 37.5], [3494, 54.5], [3495, 96],
  [3496, 137.4], [3497, 154.5], [3498, 164.3], [3499, 171.3], [3500, 176.6],
  [3501, 180.6], [3502, 183.5], [3503, 185.8], [3504, 187.6], [3505, 189.2],
  [3506, 190.5], [3508, 191.8], [3510, 191.9], [3512, 190.5], [3514, 187.8],
  [3516, 184.6], [3518, 181.8], [3520, 179.3], [3522, 177.1], [3524, 175.4],
  [3526, 174.4], [3528, 173.6], [3530, 172.9], [3533, 172.9], [3536, 173.8],
  [3539, 175.7], [3541, 177.5], [3543, 178.6], [3545, 179.4], [3547, 179.9],
  [3549, 180], [3560, 180],
];
// band centerline y at x960 (P0 drop from the summary handoff, then settle)
const BANDC: Lut = [
  [3394, 404], [3395, 446], [3396, 472], [3397, 489], [3398, 502], [3399, 512],
  [3400, 519], [3401, 524], [3402, 528], [3403, 531], [3405, 533], [3428, 533],
  [3448, 585], [3560, 585],
];
// tick pitch (world scale breathes 136→166 across the rotations)
const PITCH: Lut = [[3394, 138], [3398, 136], [3406, 136], [3430, 145], [3455, 166], [3560, 166]];
// navy plate leading edge, world-x from pivot (slides in along the band)
const PLATE_S: Lut = [[3406, 1100], [3408, 784], [3410, 554], [3412, 305], [3414, 120], [3416, -450], [3420, -1600], [3424, -3200]];
// gauge world-x offset: slides in decelerating, dwells, accelerates out
const GAUGE_X: Lut = [
  [3444, 1000], [3445, 695], [3446, 449], [3447, 323], [3448, 241], [3449, 181],
  [3450, 136], [3451, 102], [3452, 75], [3453, 54], [3454, 37], [3455, 24],
  [3456, 14], [3457, 6], [3458, 0], [3480, 0], [3481, -3], [3482, -8], [3483, -18],
  [3484, -32], [3485, -52], [3486, -79], [3487, -114], [3488, -158], [3489, -215],
  [3490, -289], [3491, -385], [3492, -513], [3493, -680], [3494, -900], [3496, -1500],
];
// red wedge sweep angle (deg from the left horizon, from red-area fractions)
const WEDGE: Lut = [
  [3452, 0], [3453, 1.6], [3454, 3.7], [3455, 7.2], [3456, 12], [3457, 19],
  [3458, 30], [3459, 49], [3460, 91], [3461, 132], [3462, 151], [3463, 162],
  [3464, 168], [3465, 173], [3466, 176], [3467, 178], [3469, 180],
];
// shield slide-out along the band (world-x delta from its dwell spot)
const SHIELD_X: Lut = [
  [3431, 0], [3432, -20], [3433, -32], [3434, -47], [3435, -66], [3436, -90],
  [3437, -119], [3438, -157], [3439, -203], [3440, -260], [3441, -327],
  [3442, -394], [3443, -491], [3444, -685], [3445, -1000], [3446, -1350],
];
// chip flock glide (flip-frame offset rel. settled layout; L-path: drop then glide left)
const CHIP_DX: Lut = [
  [3496, 300], [3499, 306], [3502, 322], [3505, 330], [3508, 332], [3511, 334],
  [3514, 342], [3517, 346], [3520, 342], [3523, 327], [3526, 297], [3529, 244],
  [3532, 167], [3535, 102], [3538, 59], [3541, 29], [3544, 13], [3547, 3], [3550, 0],
];
const CHIP_DY: Lut = [
  [3496, -300], [3499, -202], [3502, -107], [3505, -49], [3508, -27], [3511, -22],
  [3514, -13], [3517, -5], [3520, 1], [3523, 8], [3526, 11], [3529, 13], [3532, 15],
  [3535, 14], [3538, 12], [3541, 6], [3544, 3], [3547, 2], [3550, 0],
];
// exit rise into the end-card cut (band centerline 575→426)
const RISE: Lut = [[3552, -1], [3553, -3], [3554, -7], [3555, -14], [3556, -24], [3557, -37], [3558, -58], [3559, -91], [3560, -149]];

// settled chip layout, flip-frame screen rects at f3550 (x, y, colorKey)
const CHIP_LAYOUT: [number, number, "g" | "n" | "c" | "r"][] = [
  [591, 86, "g"], [592, 166, "g"], [593, 248, "g"], [588, 334, "n"], [588, 422, "n"],
  [782, 248, "c"], [784, 334, "c"], [784, 420, "c"],
  [1002, 248, "g"], [1003, 334, "g"], [1003, 420, "g"],
  [1210, 84, "c"], [1207, 164, "c"], [1208, 246, "c"], [1202, 332, "r"], [1203, 420, "r"],
];

const GAUGE_GREY = "#CFD9DD"; // annulus is a touch blue vs the band grey (probed)

export const S18Outro: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 3394 || frame >= 3561) return null;
  const theta = lut(frame, THETA);
  const bandC = lut(frame, BANDC);
  const pitch = lut(frame, PITCH);
  const bandH = 40 * (pitch / 144.4);
  // rotation anchor: on the band through P1, drifts with it, fixed 580 for the flip
  const pv = frame < 3475 ? bandC : lut(frame, [[3475, 585], [3481, 580], [3560, 580]]);
  const rise = frame >= 3552 ? lut(frame, RISE) : 0;
  const shieldScale = interpolate(frame, [3414, 3424], [0.06, 1], { ...clamp, easing: EASE });
  const shieldX = lut(frame, SHIELD_X);
  const wedge = lut(frame, WEDGE);
  const gx = lut(frame, GAUGE_X);
  const preTicks = frame < 3495;
  const gaugeOn = frame >= 3444 && frame < 3497;
  const shieldOn = frame >= 3414 && frame < 3447;
  const chipsOn = frame >= 3496;
  // gauge geometry (probed f3475): chord at band bottom, disc R198,
  // hairline arc R210, annulus 232..282, base ring r20 at bandC+43
  const chordY = bandC + 25;
  const gcx = 960 + gx;
  const sector = (cx: number, cy: number, r: number, degFrom: number, degSweep: number) => {
    // degrees measured from the left horizon (180°=left), sweeping clockwise over the top
    const a0 = Math.PI - (degFrom * Math.PI) / 180;
    const a1 = Math.PI - ((degFrom + degSweep) * Math.PI) / 180;
    const large = degSweep > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${cx + r * Math.cos(a0)} ${cy - r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy - r * Math.sin(a1)} Z`;
  };
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translateY(${rise}px) rotate(${theta}deg)`,
          transformOrigin: `960px ${pv}px`,
        }}
      >
        {/* navy plate glued above the band, leading edge slides in along it */}
        <div
          style={{
            position: "absolute",
            left: 960 + lut(frame, PLATE_S),
            top: bandC - bandH / 2 - 6000,
            width: 9000,
            height: 6000,
            background: C.navyBg,
          }}
        />
        {/* the band */}
        <div style={{ position: "absolute", left: -1540, top: bandC - bandH / 2, width: 5000, height: bandH, background: C.bandGrey }} />
        {/* pre-flip ticks */}
        {preTicks &&
          (frame < 3444
            ? // grid phased at x110 + 136k (f3404 probe), scaled about the pivot as the world breathes
              Array.from({ length: 30 }, (_, i) => {
                const x = 960 + (110 + (i - 14) * 136 - 960) * (pitch / 136);
                return <div key={i} style={{ position: "absolute", left: x, top: bandC - bandH / 2, width: 3, height: bandH, background: C.navyDeep }} />;
              })
            : [
                ...Array.from({ length: 5 }, (_, i) => 14.5 + i * 166),
                ...Array.from({ length: 5 }, (_, i) => 1238.5 + i * 165.5),
              ].map((x, i) => (
                <div key={i} style={{ position: "absolute", left: x, top: bandC - bandH / 2, width: 3, height: bandH, background: C.navyDeep }} />
              )))}
        {/* shield straddling the band (drawn side-on; upright once the world is vertical) */}
        {shieldOn && (
          <div
            style={{
              position: "absolute",
              left: 950 + shieldX - 275,
              top: bandC - 357,
              width: 550,
              height: 700,
              transform: `rotate(-90deg) scale(${shieldScale})`,
              transformOrigin: "275px 350px",
            }}
          >
            <OutroShield frame={frame} />
          </div>
        )}
        {/* gauge riding the band */}
        {gaugeOn && (
          <svg width={640} height={420} viewBox="0 0 640 420" style={{ position: "absolute", left: gcx - 320, top: chordY - 330 }}>
            {/* annulus */}
            <path d={`M 38 330 A 282 282 0 0 1 602 330 L 552 330 A 232 232 0 0 0 88 330 Z`} fill={GAUGE_GREY} />
            {/* annulus ticks 45/90/135° */}
            {[45, 90, 135].map((a) => {
              const r0 = 232;
              const r1 = 282;
              const ca = Math.cos((Math.PI * (180 - a)) / 180);
              const sa = Math.sin((Math.PI * (180 - a)) / 180);
              return <line key={a} x1={320 + r0 * ca} y1={330 - r0 * sa} x2={320 + r1 * ca} y2={330 - r1 * sa} stroke={C.navyDeep} strokeWidth={3} />;
            })}
            {/* dial interior */}
            <path d={`M 88 330 A 232 232 0 0 1 552 330 Z`} fill={C.white} />
            {/* red hairline arc */}
            <path d={`M 110 330 A 210 210 0 0 1 530 330`} fill="none" stroke={C.red} strokeWidth={5} />
            {/* red wedge fill, sweeping from the left horizon */}
            {wedge > 0 && <path d={sector(320, 330, 198, 0, wedge)} fill={C.red} />}
            {/* base ring */}
            <circle cx={320} cy={348} r={20} fill={C.white} stroke={C.navyDeep} strokeWidth={7} />
          </svg>
        )}
        {/* post-flip layer: chips + re-phased ticks (reads upright after the 180° flip) */}
        <div style={{ position: "absolute", inset: 0, transform: "rotate(180deg)", transformOrigin: "960px 580px" }}>
          {!preTicks &&
            Array.from({ length: 12 }, (_, i) => (
              <div key={i} style={{ position: "absolute", left: 140.5 + i * 166, top: 552, width: 3, height: 46, background: C.navyDeep }} />
            ))}
          {chipsOn &&
            CHIP_LAYOUT.map(([x, y, k], i) => (
              <Chip
                key={i}
                x={x + lut(frame, CHIP_DX)}
                y={y + lut(frame, CHIP_DY)}
                w={133}
                h={61}
                color={k === "g" ? C.chipGrey : k === "n" ? C.chipNavy : k === "c" ? C.chipCream : C.chipRed}
              />
            ))}
        </div>
      </div>
    </div>
  );
};

// Outro shield: split along its vertical center line (the band axis) —
// red-outline/red-fill half over the white world, white-outline half over
// the navy plate. Traced from ref f3430 (bbox 550×700 centered on the band).
const OutroShield: React.FC<{ frame: number }> = ({ frame }) => {
  const sparkP = interpolate(frame, [3420, 3424], [0, 1], clamp);
  // shield outline path, local 550×700, tip at bottom center
  const outline =
    "M 28 18 Q 275 46 522 18 L 522 300 Q 522 460 448 556 Q 372 648 275 692 Q 178 648 102 556 Q 28 460 28 300 Z";
  const inner =
    "M 52 44 Q 275 68 498 44 L 498 298 Q 498 448 432 536 Q 362 620 275 664 Q 188 620 118 536 Q 52 448 52 298 Z";
  return (
    <svg width={550} height={700} viewBox="0 0 550 700">
      <defs>
        <clipPath id="clsOutroL">
          <rect x={0} y={0} width={275} height={700} />
        </clipPath>
        <clipPath id="clsOutroR">
          <rect x={275} y={0} width={275} height={700} />
        </clipPath>
      </defs>
      {/* left half: red outline + red inner fill on the white world */}
      <g clipPath="url(#clsOutroL)">
        <path d={outline} fill={C.white} stroke={C.red} strokeWidth={9} />
        <path d={inner} fill={C.red} />
      </g>
      {/* right half: white outline + white inner fill against the navy plate */}
      <g clipPath="url(#clsOutroR)">
        <path d={outline} fill={C.navyBg} stroke="#FDFDFD" strokeWidth={9} />
        <path d={inner} fill="#FDFDFD" />
      </g>
      {/* sparkle near the top right */}
      <g opacity={sparkP} transform="translate(516 176)">
        <path d="M 0 -14 L 3 -3 L 14 0 L 3 3 L 0 14 L -3 3 L -14 0 L -3 -3 Z" fill="#FDFDFD" />
      </g>
    </svg>
  );
};

// ─── S19: end card (f3561..3750) ───
export const S19EndCard: React.FC<{ frame: number; pack: Pack; BrandLogo?: React.FC<{ markP: number; lettersP: number }> }> = ({
  frame,
  pack,
  BrandLogo,
}) => {
  if (frame < 3561) return null;
  return <LogoCard pack={pack} BrandLogo={BrandLogo} />;
};
