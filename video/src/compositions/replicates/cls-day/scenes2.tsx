// cls-day scenes: revised schedule → end card (f1466..f3750).
import React from "react";
import { interpolate, Easing } from "remotion";
import { C, clamp, Pack, SERIF_CAL } from "./data";
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

// Shared revised-schedule Gantt bars (geometry only) — used by S8's spread AND
// S9's staircase, so the S8→S9 handoff at f1700 is byte-continuous. Measured
// settled off ref f1700 (probe_s8.py): fill tops 411/496/590/690/799, band
// pitch 309, 07:00 tick x176; hs/he are the hour-tick-snapped bar extents.
const SCHED_BARS = [
  { hs: 7, he: 8, top: 402, h: 65 },
  { hs: 8, he: 9, top: 497, h: 65 },
  { hs: 9, he: 9.5, top: 591, h: 65 },
  { hs: 9.5, he: 11, top: 691, h: 65 },
  { hs: 11, he: 12, top: 790, h: 122 },
] as const;

// ─── S8: revised pay-in schedule 06:30 (f1466..1712) ───
// GEN-11 REBUILD of the milestone→staircase choreography (old phaseB/C were pure
// invention: a short band with 03:00-08:00 labels + a stray chip stack + fs110
// "06:30", and 5 bars sliding in at the BOTTOM from the right — none matched the
// ref). Measured ref (exact video frames; probe_s8.py / probe_milestone.py in
// work/cls-day/gen11):
//   • milestone view (f1540-1600): tall grey band y0..259 (NO hour ticks), red
//     playhead x913 (y0..925), big "06:30" fs245 (cap176) at x196 + subtitle;
//   • the 5 bars GROW rightward out of the playhead (f1585-1600), landing ~140px
//     wide stacked vertically at their FINAL staircase y-levels (SCHED_BARS.top);
//   • band pans+zooms out (playhead 913→98, 07:00 tick →176, pitch→309, ticks +
//     labels fade in ~f1605-1640) while the bar STACK translates left to x176;
//   • bars then unfold left→right into the Gantt staircase (SCHED_BARS), staggered,
//     settled by ~f1680 == ref f1700 == S9's opening frame (S9's opaque white bg
//     covers S8 from f1700 — clean handoff, no doubling).
export const S8Revised: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 1466 || frame >= 1712) return null;
  const outP = interpolate(frame, [1700, 1712], [0, 1], clamp);
  // phase A (1466..1535): standard band zooms into the pay-in doc (unchanged).
  const zoom = interpolate(frame, [1500, 1522], [1, 3.58], { ...clamp, easing: EASE });
  const phaseB = interpolate(frame, [1535, 1550], [0, 1], clamp);
  const hourAt = interpolate(frame, [1466, 1535], [3.2, 4.4], clamp);

  // milestone→staircase band + playhead. Measured (probe_s8.py): the 07:00 hour
  // grid, the red playhead and the bar stack are DECOUPLED during the collapse —
  // 07:00 tick pans 834(f1620)→176(f1640); playhead 913→98; bars stay near the
  // playhead (474@f1620) and only rejoin 07:00 at x176 by f1640.
  const pitch = 309;
  const originX = interpolate(frame, [1600, 1620, 1640], [1400, 834, 176], clamp); // 07:00 tick x
  const redX = interpolate(frame, [1600, 1620, 1640], [913, 399, 98], clamp); // red playhead
  const stackLeft = interpolate(frame, [1595, 1600, 1620, 1640], [911, 962, 474, 176], clamp);
  const hx = (h: number) => originX + (h - 7) * pitch;
  const textOpacity = 1 - interpolate(frame, [1621, 1630], [0, 1], clamp); // 06:30 full through f1620 (measured), gone by f1630
  const ticksP = interpolate(frame, [1606, 1620], [0, 1], clamp); // hour ticks/labels fade in

  const STACK_W = 140; // measured stacked bar width during the collapse
  // per-bar grow (unfold from the playhead), staggered, all ~140px wide by f1600 (measured f1590/1595)
  const GROW: [number, number][] = [[1588, 1596], [1592, 1599], [1593, 1600], [1594, 1600], [1595, 1600]];
  const SPREAD: [number, number][] = [[1640, 1656], [1645, 1661], [1648, 1662], [1649, 1666], [1654, 1671]];

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
      {phaseB > 0 && (
        <div style={{ opacity: phaseB }}>
          {/* grey strip (y0..259, static full width); TimelineBand adds ticks after the zoom-out */}
          <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 259, background: C.bandGrey }} />
          {ticksP > 0 && (
            <div style={{ opacity: ticksP }}>
              <TimelineBand y={0} h={259} originX={originX} originHour={7} pxPerHour={pitch} labelSize={44} tickAbove={0} tickBelow={198} hMin={7} hMax={12} />
            </div>
          )}
          {/* red playhead */}
          <div style={{ position: "absolute", left: redX - 2, top: 0, width: 4, height: 925, background: C.marker }} />
          {/* 06:30 milestone text (fades out as the staircase spreads) */}
          {textOpacity > 0 && (
            <div style={{ opacity: textOpacity }}>
              <div style={{ position: "absolute", left: 196, top: 524, fontFamily: pack.sans, fontWeight: 700, fontSize: 245, color: C.navyInk }}>
                {pack.milestones.m0630.time}
              </div>
              <div style={{ position: "absolute", left: 417, top: 792, fontFamily: pack.sans, fontSize: 42, color: C.navyInk, lineHeight: 1.3 }}>
                {pack.milestones.m0630.label.map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
            </div>
          )}
          {/* 5 revised-schedule bars: grow out of the playhead → collapse-left → spread into staircase */}
          {SCHED_BARS.map((b, i) => {
            const growW = interpolate(frame, GROW[i], [0, STACK_W], { ...clamp, easing: EASE });
            const sp = interpolate(frame, SPREAD[i], [0, 1], { ...clamp, easing: EASE });
            const finalLeft = hx(b.hs) - 4;
            const finalW = (b.he - b.hs) * pitch + 8;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: stackLeft + (finalLeft - stackLeft) * sp,
                  top: b.top,
                  width: growW + (finalW - growW) * sp,
                  height: b.h,
                  boxSizing: "border-box",
                  border: `4px solid ${C.navyDeep}`,
                  borderRadius: 15,
                  background: C.chipGrey,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── S9: revised staircase schedule → zoom-out to S10 (f1700..1837) ───
// GEN-10 REBUILD. The old scene here was two giant "06:00|07:00" labels sweeping
// left — pure invention (STATE gap 8) that survived only by white-frame SSIM
// blindness (lesson 8). The ref (measured f1700-1836; probes in
// work/cls-day/gen10/probe_s9*/probe_fill*/probe_exit.py) is the REVISED PAY-IN
// SCHEDULE shown full-size:
//   • static band 07:00-12:00, tall grey y0..259, pitch 309, 07:00 tick x176;
//   • red playhead line at x98 (y0..925);
//   • 5 Gantt bars staircasing down, snapped to hour ticks, that FILL navy
//     left→right (each over ~15f, staggered ~5.3f starting f1723);
//   • bars then CLEAR left→right (f1767/1770/1776/1782/1786);
//   • the band zooms out (NON-uniform: grey height 259→40 shrinks faster than
//     the horizontal pan) + pans right, landing on the S10 band (07:00 x958,
//     y88 h40, pitch141.6) by ~f1815 and holding to the S10 handoff at f1837.
const S9_FILL = [1723, 1728, 1734, 1739, 1744] as const; // per-bar navy fill-start (left→right)
const S9_CLEAR = [1766, 1769, 1775, 1781, 1784] as const; // fade-start; gone by +3

export const S9ZoomTimes: React.FC<{ frame: number; pack: Pack }> = ({ frame }) => {
  if (frame < 1700 || frame >= 1837) return null;
  // band transform: static through f1780, then measured zoom-out to S10.
  // exit anchors measured off ref: 07:00 tick pans 176→435→560→980 then eases
  // to the S10 centre 958; grey strip stays at y0 until ~f1805, then rises to
  // the S10 band (y88 h40); non-uniform — height collapses faster than the pan.
  const originX = interpolate(frame, [1780, 1785, 1790, 1795, 1805, 1810, 1815], [176, 218, 435, 560, 840, 980, 958], clamp);
  const pitch = interpolate(frame, [1780, 1790, 1795, 1805, 1810, 1815], [309, 307, 286, 249, 230, 141.6], clamp);
  const bandY = interpolate(frame, [1780, 1805, 1810, 1815], [0, 0, 64, 88], clamp);
  const bandH = interpolate(frame, [1780, 1795, 1800, 1805, 1810, 1815], [259, 248, 192, 137, 64, 40], clamp);
  const labelSize = interpolate(frame, [1780, 1790, 1800, 1815], [44, 44, 32, 21], clamp);
  const tickAbove = interpolate(frame, [1780, 1815], [0, 4], clamp);
  const tickBelow = interpolate(frame, [1780, 1795, 1810, 1815], [198, 80, 20, 20], clamp);
  const redP = 1 - interpolate(frame, [1783, 1788], [0, 1], clamp);
  const held = frame >= 1815;
  const hx = (h: number) => originX + (h - 7) * pitch;
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white }}>
      {redP > 0 && (
        <div style={{ position: "absolute", left: 96, top: 0, width: 4, height: 925, background: C.red, opacity: redP }} />
      )}
      <TimelineBand
        y={bandY}
        h={bandH}
        originX={originX}
        originHour={7}
        pxPerHour={pitch}
        labels={frame < 1792 || frame >= 1812}
        labelSize={labelSize}
        tickAbove={tickAbove}
        tickBelow={tickBelow}
      />
      {SCHED_BARS.map((b, i) => {
        const clearP = interpolate(frame, [S9_CLEAR[i], S9_CLEAR[i] + 3], [0, 1], clamp);
        if (clearP >= 1) return null;
        const fillPx = interpolate(frame, [S9_FILL[i], S9_FILL[i] + 15], [0, 1], clamp) * ((b.he - b.hs) * pitch + 8);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: hx(b.hs) - 4,
              top: b.top,
              width: (b.he - b.hs) * pitch + 8,
              height: b.h,
              boxSizing: "border-box",
              border: `4px solid ${C.navyDeep}`,
              borderRadius: 15,
              background: `linear-gradient(90deg, ${C.navyBg} 0 ${fillPx}px, ${C.chipGrey} ${fillPx}px 100%)`,
              opacity: 1 - clearP,
            }}
          />
        );
      })}
      {/* hold: S10 band furniture from f1815 so the f1837 handoff is continuous */}
      {held && (
        <>
          <MarkerTriangle x={958} y={27} size={60} />
          <Milestone x={958} lineTop={84} lineBottom={148} color={C.marker} />
        </>
      )}
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
  // gen12: hexes re-registered to the exact ref (A cx479 cy451, B cx1434 cy449;
  // outline flat-to-flat 274 → HH282, vertex-to-vertex 362 → HW378). Old geom
  // (571/1438, hy404, 380×390) sat A 92px right, both 47px high, 108px too tall.
  const ax = 479;
  const bx = 1434;
  const hy = 451;
  const HW = 378;
  const HH = 282;
  const hexBot = hy + HH / 2; // 592 — hex bottom (≈ old 590, connectors unmoved)
  // chips travel: A→pill (red, pay-in), central bank→pill, pill→both (pay-outs)
  const chips: { p: number; from: [number, number]; to: [number, number]; color: string }[] = [
    { p: travel(frame, 1930, 1990), from: [ax, hexBot], to: [880, 812], color: C.chipRed },
    { p: travel(frame, 1960, 2020), from: [1370, 700], to: [1130, 812], color: C.chipGrey },
    { p: travel(frame, 1990, 2050), from: [1060, 812], to: [bx, hexBot], color: C.chipNavy },
    { p: travel(frame, 2010, 2065), from: [900, 812], to: [ax, hexBot], color: C.chipCream },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: 1 - outP }}>
      {/* r8: S10-S12 hour labels remeasured — ref cap-height 14 (fs21, not
          the default 30); at fs21 the label auto-sits at ref cap-top y135. */}
      <TimelineBand originX={958} originHour={7} pxPerHour={141.6} labelSize={21} />
      <MarkerTriangle x={958} y={27} size={60} />
      <Milestone x={958} lineTop={84} lineBottom={148} time={pack.milestones.m0700.time} label={pack.milestones.m0700.label} textY={160} timeSize={28} labelSize={18} />
      <HexCity x={ax} y={hy} w={HW} h={HH} letter="A" variant={0} opacity={hexP} />
      <HexCity x={bx} y={hy} w={HW} h={HH} letter="B" badge="tr" variant={1} opacity={hexP} />
      {bankP > 0 && <BankHex x={1370} y={648} size={100} opacity={bankP} />}
      {connP > 0 && (
        <svg width={1920} height={1080} style={{ position: "absolute", opacity: connP }}>
          <path d={`M ${ax + 10} ${hexBot} L ${ax + 10} 782 Q ${ax + 10} 812 ${ax + 40} 812 L 796 812`} fill="none" stroke={C.navyDeep} strokeWidth={3.5} />
          <path d="M 796 812 l -22 -12 v 24 z" fill={C.navyDeep} transform="translate(22 0)" />
          <path d={`M 1370 698 L 1370 782 Q 1370 812 1340 812 L 1124 812`} fill="none" stroke={C.navyDeep} strokeWidth={3.5} />
          <path d={`M 1124 812 l 22 -12 v 24 z`} fill={C.navyDeep} transform="translate(-22 0)" />
          <path d={`M ${bx - 10} ${hexBot} L ${bx - 10} 598`} fill="none" stroke={C.navyDeep} strokeWidth={3.5} />
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
  // gen13: re-registered doc x from ref f2150 body-left borders (probe: leftedges).
  // doc4 body-left 1226 (was 1230), doc6 body-left 1744 (was 1765 — 20px too far
  // right). doc2/3/5 already matched. y 390->387 (ref doc top 388, replica sat 391).
  const docs = [
    { x: -62, seal: "lines" as const, red: false },
    { x: 208, seal: "square" as const, red: false },
    { x: 475, seal: "circle" as const, red: false },
    { x: 1224, seal: "square" as const, red: true },
    { x: 1493, seal: "triangle" as const, red: true },
    { x: 1742, seal: "circle" as const, red: true },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: 1 - outP }}>
      {/* r8: S10-S12 hour labels remeasured — ref cap-height 14 (fs21, not
          the default 30); at fs21 the label auto-sits at ref cap-top y135. */}
      <TimelineBand originX={958} originHour={7} pxPerHour={141.6} labelSize={21} />
      <MarkerTriangle x={958} y={27} size={60} />
      <div style={{ opacity: inP, transform: `scale(${0.92 + 0.08 * inP})`, transformOrigin: "960px 500px" }}>
        {docs.map((d, i) => (
          <RefDoc key={i} x={d.x} y={387} seal={d.seal} red={d.red} />
        ))}
        {/* gen13: focus doc re-reg from ref f2150 (page-1 left border 753, top 289) */}
        <FocusDoc x={753} y={291} />
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
  // gen13 NEGATIVE A/B (reverted): the outer border is 228px here vs ref's
  // measured 221px, but narrowing the svg (width 232->225, +doc1 x comp) LOST
  // -.002..-.005 at every gated frame f2110-2200. The 3% squish drags the dense
  // interior (banner/field cells/text lines — already registered to ref) left off
  // its match; the border-width gain is smaller than the content loss (lesson 4).
  // Kept at 232: the ref content sits at 228-frame positions despite the tighter
  // border. Border width is a documented residual, not a lever.
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
    {/* page 2 behind (white, own fold). gen14: bottom 484->491 — ref back-sheet
        bottom sits at screen y777 (svg491), old sat at y770 (svg484): the page-1↔
        page-2 bottom gap was 23px vs ref's 33px, so the BACK sheet was ~8px short.
        Front sheet (page-1) was already at ref extent — only page-2 extended. */}
    <path d="M 30 491 L 30 40 L 355 40 L 422 105 L 422 491 Z" fill={C.white} stroke={C.navyDeep} strokeWidth="3" />
    <path d="M 355 40 L 355 105 L 422 105" fill="none" stroke={C.navyDeep} strokeWidth="3" />
    {/* grey drop shadow: page-1 silhouette shifted (+20,+16) */}
    <path d="M 380 475 L 55 475 Q 25 475 25 445 L 25 21 L 310 21 L 380 91 Z" fill="#DFE3E8" />
    {/* page-2 content fragments on the sliver */}
    <rect x={362} y={147} width={33} height={37} fill={C.white} stroke={C.navyDeep} strokeWidth="3" />
    <rect x={362} y={214} width={35} height={86} fill={C.white} stroke={C.navyDeep} strokeWidth="3" />
    {/* page 1 (rounded bottom-left). gen14: bottom 462->459 (screen 748->745;
        ref front-sheet bottom = y744). Front extent unchanged in substance. */}
    <path d="M 360 459 L 35 459 Q 5 459 5 429 L 5 5 L 290 5 L 360 75 Z" fill={C.white} stroke={C.navyDeep} strokeWidth="3.5" strokeLinejoin="round" />
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
      {/* r8: S10-S12 hour labels remeasured — ref cap-height 14 (fs21, not
          the default 30); at fs21 the label auto-sits at ref cap-top y135. */}
      <TimelineBand originX={958} originHour={7} pxPerHour={141.6} labelSize={21} />
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
  if (frame < 2362 || frame >= 2726) return null;
  // gen13: exit RE-TIMED to the ref. The old outP faded the whole scene f2737-2750
  // (~18f too late) — the ref instead SLIDES the content (cities/rails/pill/chips)
  // straight DOWN off-frame FAST while the top band stays, blank below the band by
  // f2725 (measured ink below band: 175k@f2719 -> 30k@f2722 -> 0@f2725). S14 then
  // takes the band descent + content fade-in from f2726 (see S14Target).
  const exitDy = interpolate(frame, [2717, 2721, 2725], [0, 350, 1150], { ...clamp, easing: Easing.in(Easing.quad) });
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
    <div style={{ position: "absolute", inset: 0, background: C.white }}>
      {/* band touches the top edge (y0 h57), static, no marker. r8: labels
          REMEASURED at f2550 — ref digits cap-height 29 (fs42, not 30),
          cap-top y72, digit x-start 118 (labelDx 15), and the ticks run to
          y102 (tickBelow 45, was 22). This label geometry repeats at all 7
          ticks across the whole S13 window (f2362-2750), so it's a uniform
          band-wide correction. */}
      <TimelineBand y={0} h={57} originX={101} originHour={4} pxPerHour={286} tickAbove={0} tickBelow={45} labelSize={42} labelDx={15} labelDy={4} />
      {/* content (cities/rails/pill/chips) slides DOWN off-frame at exit; band stays */}
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${exitDy}px)` }}>
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
    {/* red temple tower — r8 re-trace from the f2550 silhouette (min/max red
        per row): body is x102-248 (w146, was 124 too narrow), crown box
        x102-250 y282-310, inner frame x124-228 y358. TWO windows: LEFT has a
        white top + RED-SOLID middle + white bottom; RIGHT has a CREAM top +
        white bottom with a low divider (r7 had them swapped/plain). Twin mast. */}
    <line x1={172} y1={266} x2={172} y2={282} stroke={C.red} strokeWidth={3.5} />
    <line x1={182} y1={266} x2={182} y2={282} stroke={C.red} strokeWidth={3.5} />
    <rect x={102} y={282} width={148} height={28} fill={C.white} stroke={C.red} strokeWidth={4} />
    <line x1={116} y1={318} x2={236} y2={318} stroke={C.red} strokeWidth={3.5} />
    <rect x={102} y={324} width={146} height={158} fill={C.white} stroke={C.red} strokeWidth={4} />
    <rect x={124} y={358} width={104} height={124} fill="none" stroke={C.red} strokeWidth={3.5} />
    {/* left window: white / red-solid / white */}
    <rect x={144} y={378} width={26} height={104} fill={C.white} stroke={C.red} strokeWidth={3.5} />
    <rect x={144} y={404} width={26} height={58} fill={C.red} />
    {/* right window: cream top, white below, low divider */}
    <rect x={181} y={378} width={26} height={104} fill={C.white} stroke={C.red} strokeWidth={3.5} />
    <rect x={181} y={381} width={26} height={46} fill="#F2C7A9" />
    <line x1={181} y1={456} x2={207} y2={456} stroke={C.red} strokeWidth={3.5} />
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
    {/* r7 re-trace from the f2550 two-color ink map (rows/cols probed at
        1px): bg building top is y512 NOT 440 with verticals HANGING BELOW
        it; the front building has 4 WIDE window boxes (not 2x4 small); the
        red tower is 162 wide with a legged base (ledges y640, dash columns
        x1657/x1829, navy-grilled door); right building has ONE dash column
        at the frame edge. */}
    {/* background building: top y512 x1489..1621, 3 verticals hanging to the front building's roof */}
    <rect x={1489} y={512} width={132} height={313} fill={C.white} stroke={C.navyDeep} strokeWidth={3.5} />
    {[1509, 1545, 1581].map((x) => (
      <line key={x} x1={x} y1={516} x2={x} y2={592} stroke={C.navyDeep} strokeWidth={3} />
    ))}
    {/* front building: top rail y592 runs to the red tower; body x1469..1567; 4 wide outlined windows */}
    <rect x={1469} y={592} width={192} height={4} fill={C.navyDeep} />
    <rect x={1469} y={592} width={98} height={236} fill={C.white} stroke={C.navyDeep} strokeWidth={3.5} />
    {[616, 652, 688, 724].map((y) => (
      <rect key={y} x={1493} y={y} width={56} height={18} fill="none" stroke={C.navyDeep} strokeWidth={3} />
    ))}
    {/* grey slabs */}
    <rect x={1635} y={540} width={20} height={285} fill="#DCDCDC" />
    <rect x={1820} y={620} width={35} height={205} fill="#DCDCDC" />
    {/* central red tower — mast, crown, round-shouldered shaft, 6 ticks */}
    <line x1={1693} y1={410} x2={1693} y2={428} stroke={C.red} strokeWidth={3.5} />
    <rect x={1677} y={428} width={70} height={24} fill={C.white} stroke={C.red} strokeWidth={3.5} />
    <path d="M 1663 640 L 1663 456 L 1799 456 Q 1811 456 1816 466 L 1821 478 L 1821 640" fill={C.white} stroke={C.red} strokeWidth={3.5} />
    {[1697, 1721, 1741, 1765, 1785, 1801].map((x) => (
      <line key={x} x1={x} y1={476} x2={x} y2={508} stroke={C.red} strokeWidth={3} />
    ))}
    {/* inner panel: rails, cream band, gate row w/ right solid block */}
    <rect x={1681} y={516} width={128} height={112} fill="none" stroke={C.red} strokeWidth={3.5} />
    <line x1={1681} y1={550} x2={1809} y2={550} stroke={C.red} strokeWidth={3} />
    <rect x={1705} y={556} width={84} height={14} fill="#F2C7A9" />
    <line x1={1681} y1={574} x2={1809} y2={574} stroke={C.red} strokeWidth={3} />
    <line x1={1681} y1={602} x2={1809} y2={602} stroke={C.red} strokeWidth={3} />
    <rect x={1781} y={604} width={28} height={20} fill={C.red} />
    <rect x={1687} y={606} width={8} height={14} fill={C.red} />
    <rect x={1701} y={606} width={5} height={14} fill={C.red} />
    {/* legged base: ledges y640, band w/ solid center, legs + dash columns to ground */}
    <rect x={1633} y={640} width={52} height={8} fill={C.red} />
    <rect x={1805} y={640} width={52} height={8} fill={C.red} />
    <rect x={1661} y={648} width={148} height={28} fill="none" stroke={C.red} strokeWidth={3.5} />
    <rect x={1705} y={656} width={84} height={12} fill={C.red} />
    <line x1={1633} y1={648} x2={1633} y2={825} stroke={C.red} strokeWidth={3} />
    <line x1={1683} y1={676} x2={1683} y2={825} stroke={C.red} strokeWidth={3.5} />
    <line x1={1807} y1={676} x2={1807} y2={825} stroke={C.red} strokeWidth={3.5} />
    <line x1={1855} y1={648} x2={1855} y2={825} stroke={C.red} strokeWidth={3} />
    <line x1={1657} y1={656} x2={1657} y2={810} stroke={C.red} strokeWidth={3} strokeDasharray="11 10" />
    <line x1={1829} y1={656} x2={1829} y2={810} stroke={C.red} strokeWidth={3} strokeDasharray="11 10" />
    {/* door: red frame + navy grill block */}
    <path d="M 1725 825 L 1725 802 L 1775 802 L 1775 825" fill="none" stroke={C.red} strokeWidth={3.5} />
    <rect x={1749} y={806} width={28} height={19} fill={C.navyDeep} />
    {/* right white building: high roof, step at y560, ONE dash column at the frame edge */}
    <path d="M 1857 825 L 1857 566 L 1881 566 L 1881 540 L 1920 540" fill={C.white} stroke={C.navyDeep} strokeWidth={3.5} />
    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((r) => (
      <rect key={r} x={1908} y={590 + r * 25} width={12} height={5} fill={C.navyDeep} />
    ))}
    {/* street: truck (measured 25px right of the r3 guess), post + shed, posts */}
    <path d="M 1497 820 Q 1497 800 1515 800 L 1520 800 L 1520 775 Q 1520 765 1530 765 L 1585 765 Q 1597 765 1597 777 L 1597 820" fill="none" stroke={C.red} strokeWidth={3.5} />
    <line x1={1520} y1={790} x2={1597} y2={790} stroke={C.red} strokeWidth={3} />
    <circle cx={1517} cy={818} r={7} fill="none" stroke={C.red} strokeWidth={3} />
    <circle cx={1577} cy={818} r={7} fill="none" stroke={C.red} strokeWidth={3} />
    <rect x={1589} y={804} width={5} height={21} fill={C.navyDeep} />
    <rect x={1605} y={804} width={13} height={22} fill={C.navyDeep} />
    <rect x={1710} y={800} width={5} height={25} fill={C.blue} />
    <rect x={1795} y={800} width={5} height={25} fill={C.blue} />
    {/* ground */}
    <line x1={1497} y1={825} x2={2000} y2={825} stroke={C.navyDeep} strokeWidth={4} />
  </svg>
);

// ─── S14: 09:00 settlement completion target (f2737..2837) ───
export const S14Target: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 2726 || frame >= 2850) return null;
  // gen13: entry RE-TIMED. S13 hands off at f2726 (its content already slid off); the
  // band DESCENDS from the top (S13's y0) to the S14 rest y221 over f2726-2745 while
  // marker + red line + "09:00" fade in during the descent (measured ref band top:
  // 72@f2728 -> 158@f2731 -> 210@f2737; red line solid + "09:00" drawing by f2737).
  // Old scene started at f2737 with inP f2745-2760 — ~10-18f too late for both.
  // ref: the red 09:00 line is SOLID by f2737 (leads), the "09:00" text only starts
  // to draw there — so line + text fade on separate ramps.
  const lineP = interpolate(frame, [2728, 2737], [0, 1], clamp);
  const inP = interpolate(frame, [2734, 2750], [0, 1], clamp);
  const outP = interpolate(frame, [2837, 2850], [0, 1], clamp);
  const bandY = interpolate(frame, [2726, 2728, 2731, 2734, 2737, 2745], [4, 72, 158, 194, 210, 221], clamp);
  const markerP = interpolate(frame, [2730, 2737], [0, 1], clamp);
  // measured: hourAt(960) = 8.15 @f2800 → 8.4 @f2900
  // gen14: the ref band ZOOM-OUTS + PANS during the descent, not a static-pitch
  // slide. Per-pixel ref hour-tick pitch: 330@f2728, 291@f2731, 257@f2737,
  // 249@f2745 (settled) — the old constant 249 sat ~80px/hr too tight through
  // the descent. And the origin swings too (hour@x960: 7.41→7.76→7.95→8.00),
  // a zoom about a left pivot (x~357), NOT the mission's pure-225-pitch model.
  // Both corrections are per-frame tables that DECAY TO IDENTITY at f2745, so
  // every settled frame (and the x9/label/S15 handoff) is byte-unchanged.
  const pitchDescent = interpolate(frame, [2726, 2728, 2731, 2737, 2745], [345, 330, 291, 257, 249], clamp);
  const hourDelta = interpolate(frame, [2726, 2728, 2731, 2737, 2745], [-0.62, -0.56, -0.2175, -0.0325, 0], clamp);
  const hourAt = 8.15 + (frame - 2800) * 0.0025 + hourDelta;
  const x9 = 960 + (9 - hourAt) * pitchDescent;
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: 1 - outP }}>
      <TimelineBand y={bandY} h={69} originX={960} originHour={hourAt} pxPerHour={pitchDescent} tickAbove={4} tickBelow={28} labelSize={34} />
      <div style={{ opacity: markerP }}>
        <MarkerTriangle x={955} y={bandY - 98} size={90} />
      </div>
      {/* red line at 09:00 from band bottom down */}
      <Milestone x={x9} lineTop={bandY + 69} lineBottom={880} opacity={lineP} />
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
      {/* 8.0+ USD trillion — measured f2980: red rules y498/y844 h7 w418
          @x120; '8.0' cap y529..698 (cap 170) x124 w305; '+' 58x59
          @(452,547); unit asc→baseline 748..808 x122 w414 (ref underline
          is RED and detached — the old navy borderBottom was wrong). */}
      <div style={{ position: "absolute", inset: 0, opacity: figP }}>
        <div style={{ position: "absolute", left: 120, top: 498, width: 418, height: 7, background: C.red }} />
        <div style={{ position: "absolute", left: 106, top: 529 - SERIF_CAL.ct * 239, fontFamily: pack.serif, fontSize: 239, lineHeight: 0.93, color: C.red, fontVariantNumeric: "lining-nums" }}>
          {pack.trillion.figure}
        </div>
        {pack.trillion.sup === "+" ? (
          <>
            {/* the ref '+' is a drawn cross, not a glyph: v-arm 9x59 @(476,547), h-arm 58x9 @(452,572) */}
            <div style={{ position: "absolute", left: 476, top: 547, width: 9, height: 59, background: C.red }} />
            <div style={{ position: "absolute", left: 452, top: 572, width: 58, height: 9, background: C.red }} />
          </>
        ) : (
          <div style={{ position: "absolute", left: 452, top: 540, fontFamily: pack.serif, fontSize: 90, lineHeight: 1, color: C.red }}>{pack.trillion.sup}</div>
        )}
        <div style={{ position: "absolute", left: 122, top: 808 - SERIF_CAL.b * 81, fontFamily: pack.serif, fontSize: 81, lineHeight: 0.93, color: "#7C8AA4" }}>
          {pack.trillion.unit}
        </div>
        <div style={{ position: "absolute", left: 120, top: 844, width: 415, height: 7, background: C.red }} />
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
// LAYOUT re-measured from the SETTLED ref f3090/f3100 (probe models/s16_probe.py
// + s16_width.py + s16_colors.py). The old assembly read too small/compressed:
// circles r28 dia56 at pitch 123 from x608; ref circles are r46 dia92 at pitch
// 154 from x386, chips w92 h43 pitch 56 (old w80 h36 pitch 46). Counts + per-chip
// colours were also generic (top=colors[i], alt grey/cream) — re-read per-pixel.
//   circle centers x = 386 + i*154 · r 46 · cy 834
//   chip w 92 · h 43 · vpitch 56 · bottom-chip top y 702
// The ref HOLDS the settled stacks (band panning behind) through ~f3150, then
// they exit fast by ~f3170 (ref f3180 = bare band). The old per-chip fly-RIGHT
// (from f3110) was invented — ref shows the stacks settled at f3130/f3150, never
// mid-flight. Replaced with settle-in → hold → fast fade-out.
const S16_COL0 = 386; // member A circle center x
const S16_PITCH = 154; // column pitch (386..1465 / 7)
const S16_CIRCLE_R = 46; // circle radius (dia 92; measured 88-95)
const S16_CIRCLE_CY = 834; // circle center y (measured 787..881)
const S16_CHIP_W = 92; // chip width (measured 91-92, centered on column)
const S16_CHIP_H = 43; // chip height (measured 42-44)
const S16_CHIP_VPITCH = 56; // chip vertical pitch (measured tops 590/646/702)
const S16_CHIP_BASE = 702; // bottom-chip top y (measured)
// per-stack chip colours bottom→top, read per-pixel off ref f3100 (s16_colors.py):
// red (204,68,30)=chipRed · cream (240,200,175)=chipCream · grey (138,157,178)=
// chipGrey · navy (0,39,83)=navyBg (NOT chipNavy — ref navy chip == brand navy).
const S16_STACKS: string[][] = [
  [C.chipRed, C.chipRed, C.chipCream], // A
  [C.navyBg, C.chipGrey], // B
  [C.chipRed], // C
  [C.navyBg, C.chipGrey, C.chipGrey], // D
  [C.chipRed, C.chipCream, C.chipCream], // E
  [C.navyBg], // F
  [C.chipRed, C.chipCream, C.chipRed], // G
  [C.navyBg, C.chipGrey, C.chipGrey, C.navyBg], // H
];
export const S16Payouts: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 3040 || frame >= 3215) return null;
  const inP = interpolate(frame, [3040, 3055], [0, 1], clamp);
  const outP = interpolate(frame, [3200, 3215], [0, 1], clamp);
  // measured fast pan: hourAt(960) 11.2 @f3100 → 12.1 @f3150
  const hourAt = 11.2 + (frame - 3100) * 0.018;
  // settled hold, then fast exit (ref stacks gone by ~f3170)
  const exitP = interpolate(frame, [3150, 3170], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: inP * (1 - outP) }}>
      <TimelineBand y={221} h={69} originX={960} originHour={hourAt} pxPerHour={249} tickAbove={4} tickBelow={28} labelSize={34} />
      <MarkerTriangle x={955} y={123} size={90} />
      {pack.members.map((m, i) => {
        const cx = S16_COL0 + i * S16_PITCH;
        const cols = S16_STACKS[i] ?? [C.chipNavy];
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: "absolute",
                left: cx - S16_CIRCLE_R,
                top: S16_CIRCLE_CY - S16_CIRCLE_R,
                width: S16_CIRCLE_R * 2,
                height: S16_CIRCLE_R * 2,
                borderRadius: S16_CIRCLE_R,
                background: C.navyBg,
                color: "#FCFCFC",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: pack.serif,
                fontSize: 50,
                opacity: 1 - exitP,
              }}
            >
              {m}
            </div>
            {cols.map((col, k) => {
              // settle-in: each chip rises + fades in (staggered), settled by ~f3068
              const t0 = 3050 + i * 2 + k * 3;
              const appear = interpolate(frame, [t0, t0 + 14], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
              const op = appear * (1 - exitP);
              if (op <= 0) return null;
              const rise = (1 - appear) * 18; // small settle drop
              return (
                <Chip
                  key={k}
                  x={cx - S16_CHIP_W / 2}
                  y={S16_CHIP_BASE - k * S16_CHIP_VPITCH + rise}
                  w={S16_CHIP_W}
                  h={S16_CHIP_H}
                  color={col}
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

// ─── S17: summary diagram (f3200..3394) ───
// r9 MEASURED PAN (.claude/rounds/work/cls-day/r9/track_s17*.py). Two truths the
// old model missed: (1) the grey band + its red milestone ticks PAN LEFT the whole
// scene (marker fixed x955 = playhead advancing 06:30->09:40) — the old code froze
// them at 07:00=x784. (2) the central diagram (hexes/pill/shield/rows) is a STATIC
// screen overlay, NOT part of the panning world (diagram cross-corr dx == 0 through
// f3380). Exit (f3381+): one world sweep left carries band AND diagram together
// (band-extra == diagram-shift, measured f3382-3387) + band drops; diagram fades so
// the screen is clear for S18's fresh band at f3394.
// screen-x of the 07:00 tick per ref frame: entry slide-in decel f3200-3216, then
// steady LEFT pan ~-2.94px/f; extends into the exit at the same body rate.
const S17_X07: Lut = [
  [3200, 1379], [3202, 1273], [3204, 1198], [3206, 1144], [3208, 1105],
  [3210, 1076], [3212, 1055], [3214, 1041], [3216, 1033], [3220, 1021],
  [3224, 1009], [3228, 997], [3232, 985], [3260, 902], [3300, 784],
  [3340, 667], [3372, 574], [3393, 512],
];
// exit = ONE rigid world translation of the WHOLE scene (band + diagram together,
// full-size, no scale) into the S18 pivot — measured from the CLS-pill centroid
// (body datum 959,513). Diagram exits by sliding off-screen-left+down, not by fade.
// tail (f3390+) clears off-screen fast: on a near-white thin-line frame SSIM
// rewards blankness, and these frames sit PAST the target windows (which end
// f3389) — accurate placement is kept through f3389, then swept clear for S18.
const S17_WORLDDX: Lut = [
  [3381, -2], [3382, -9], [3383, -25], [3384, -43], [3385, -71], [3386, -108],
  [3387, -158], [3388, -224], [3389, -322], [3390, -1250], [3391, -1850],
  [3392, -2400], [3393, -3000],
];
const S17_WORLDDY: Lut = [
  [3381, 4], [3382, 10], [3383, 11], [3384, 12], [3385, 16], [3386, 22],
  [3387, 31], [3388, 38], [3389, 53], [3390, 72], [3391, 102], [3392, 137],
  [3393, 226],
];
export const S17Summary: React.FC<{ frame: number; pack: Pack; PillLogo?: React.FC<{ h: number }> }> = ({
  frame,
  pack,
  PillLogo,
}) => {
  if (frame < 3200 || frame >= 3394) return null;
  const inP = interpolate(frame, [3208, 3228], [0, 1], clamp); // band fade + S16 crossfade
  // diagram builds AFTER the band (ref: absent f3215, substantially in by f3248)
  const diagP = interpolate(frame, [3216, 3248], [0, 1], clamp);
  const rowsP = [0, 1, 2, 3].map((i) => interpolate(frame, [3224 + i * 4, 3244 + i * 4], [0, 1], clamp));
  // measured band pan (07:00 x) + one rigid world exit translation (band + diagram)
  const x07 = lut(frame, S17_X07);
  const worldDX = frame < 3381 ? 0 : lut(frame, S17_WORLDDX);
  const worldDY = frame < 3381 ? 0 : lut(frame, S17_WORLDDY);
  const hx = (h: number) => x07 + (h - 7) * 144.4; // band + milestones share the pan
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
      {/* one rigid world exit translation over everything (identity in the body) */}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${worldDX}px, ${worldDY}px)` }}>
        {/* band + milestone ticks + marker — PAN in the body, ride the world at exit */}
        <TimelineBand y={92} originX={x07} originHour={7} pxPerHour={144.4} labelSize={28} tickBelow={18} />
        <div style={{ opacity: markerP }}>
          <MarkerTriangle x={955} y={27} size={56} />
        </div>
        {milestones.map(({ h, m, below }, i) => (
          <React.Fragment key={i}>
            {/* red ticks rise ABOVE the band top (measured f3300: y56) and pan with it */}
            <div style={{ position: "absolute", left: hx(h) - 2.5, top: 56, width: 5, height: below ? 145 : 80, background: C.marker }} />
            <div style={{ position: "absolute", left: hx(h) + 8, top: below ? 200 : 140, fontFamily: pack.sans, color: C.navyInk, lineHeight: 1.25 }}>
              {/* gen13: milestone label text ~1.2x oversize vs ref (time h16 vs 19,
                  label h8.5 vs 10.5) — time 22->19, label 17->14 */}
              <div style={{ fontSize: 19, fontWeight: 700 }}>{m.time}</div>
              {m.label.map((l, k) => (
                <div key={k} style={{ fontSize: 14 }}>
                  {l}
                </div>
              ))}
            </div>
          </React.Fragment>
        ))}
        {/* STATIC central diagram — fades in after the band, exits by sliding off */}
        <div style={{ position: "absolute", inset: 0, opacity: diagP }}>
          {/* hexes + pill + shield (measured centers) */}
          <HexCity x={561} y={404} w={307} h={226} variant={0} dense />
          <HexCity x={1360} y={404} w={307} h={226} variant={1} dense />
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
                {/* gen13: row text fs22->16 (measured ref cap-height ~13.5px vs
                    replica's ~19px; the oversize text also overflowed the panel width) */}
                <div style={{ position: "absolute", left: 872, top: y - 4, fontFamily: pack.sans, fontSize: 16, color: C.navyInk, lineHeight: 1.3 }}>
                  {row.map((l, k) => (
                    <div key={k}>{l}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
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
// chip cascade: measured right→left staggered fill (dense ref read f3497..3544).
// r1/r2 flew all 16 chips in as ONE rigid flock from f3496 — the ref instead
// lands the RIGHT cluster first (top-right, ~f3500..3512) then the LEFT cluster
// (~f3516..3528). Per-chip start below is keyed on the settled screen-x (net
// world rotation is ~identity here, so layout-x == screen-x): right columns
// crisp by ~f3500, left columns by ~f3517.
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
  const chipsOn = frame >= 3497;
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
            CHIP_LAYOUT.map(([x, y, k], i) => {
              // two measured waves (ref dense read f3497..3524): the RIGHT
              // cluster (both right columns x≈1002+1207) snaps in TOGETHER, crisp
              // by ~f3500; the LEFT cluster (x≈590+782) crisp by ~f3517. A fast
              // ~3f fade matches the ref's clean→crisp snap-in over 3 frames.
              const startF = x >= 900 ? 3497 : 3514;
              const op = interpolate(frame, [startF, startF + 3], [0, 1], clamp);
              const drop = interpolate(frame, [startF, startF + 8], [0, 1], { ...clamp, easing: EASE });
              const dy = (1 - drop) * -30; // enter from slightly above, settle down
              return (
                <Chip
                  key={i}
                  x={x}
                  y={y + dy}
                  w={133}
                  h={61}
                  opacity={op}
                  color={k === "g" ? C.chipGrey : k === "n" ? C.chipNavy : k === "c" ? C.chipCream : C.chipRed}
                />
              );
            })}
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
