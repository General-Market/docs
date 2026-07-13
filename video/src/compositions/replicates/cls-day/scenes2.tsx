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
  // ── phase A (f1466..1535): the standard band zooms into the revised pay-in doc.
  // r22 EYE-FIDELITY REBUILD. The old phaseA was measurably wrong (measure_s8): band
  // pitch 141.6 not 205; the doc a small 500×480 fixed at 140,560 where the ref is
  // 822×577 with its LEFT edge pinned to the panning 00:00 tick; NO red playhead; and a
  // scale-3.58 zoom about 340,340 that evicted the too-small doc so cleanly it matched
  // the ref's near-white tail BY ACCIDENT (law 8 — an undersized wrong doc vanishes into
  // white; a correct larger one cannot). Rebuilt from exact frames (work/cls-day/
  // r22-scenes2, measure.py/measure2.py): pitch 205, doc 822×577 tracking the 00:00 tick,
  // a red 00:00 playhead down the doc's left edge. The band and doc EVICT on SEPARATE
  // measured motions — one shared scale does NOT fit both: at f1518 the band pitch is
  // ×1.473 (ticks spread about x≈422) but the doc's own internal span only ×1.085 while
  // it translates down-left (dx−150 dy+77 → doc-right 826 / top 407 / bottom 1033, all
  // matching the ref). So the band is a scaled group about (422,171); the doc a
  // translate-down-left + mild-scale group from its top-left. Content is EXACT f1466-1511;
  // the doc is fully off-frame (near-white) by ~f1528, like the ref.
  const phaseB = interpolate(frame, [1535, 1550], [0, 1], clamp);
  // 00:00 tick / doc-left / playhead screen x — the zoom=1 pan (accelerates into the
  // zoom), frozen at 88 once the zoom takes over at f1515:
  const tick00 = interpolate(frame, [1466, 1478, 1490, 1500, 1505, 1511, 1515], [240, 224, 208, 180, 158, 122, 88], clamp);
  // band zoom-spread about (422,171): flat 1.0 through f1515, then flings the band off:
  const bandZoom = interpolate(frame, [1508, 1515, 1518, 1522, 1528], [1, 1, 1.473, 3.8, 10], { ...clamp, easing: EASE });
  // doc eviction: translate down-left + mild scale from the doc's own top-left corner:
  const docDx = interpolate(frame, [1515, 1518, 1522, 1528], [0, -150, -820, -2050], { ...clamp, easing: EASE });
  const docDy = interpolate(frame, [1515, 1518, 1522, 1528], [0, 77, 430, 1300], { ...clamp, easing: EASE });
  const docSc = interpolate(frame, [1515, 1518, 1522, 1528], [1, 1.085, 1.7, 3], { ...clamp, easing: EASE });
  // grey strip: thin during the pan, then GROWS into the tall milestone band (y0..259)
  // the ref morphs into by f1535 (measured strip y114-171 → y87-172 → y0-176 → y0-224 →
  // y0-259 — this IS phaseB's band arriving, so the f1535 handoff stays continuous):
  const stripTop = interpolate(frame, [1515, 1518, 1522], [114, 87, 0], clamp);
  const stripBottom = interpolate(frame, [1515, 1518, 1522, 1528, 1535], [171, 172, 176, 224, 259], clamp);
  // ticks/labels fade as they fly off, so no giant label lingers (ref navy→0 by ~f1528):
  const tickFade = interpolate(frame, [1519, 1527], [1, 0], clamp);
  // the top-centre marker leaves with the timeline view (ref: gone once the grey band
  // has grown, ~f1528 — the milestone view carries its own red rule instead):
  const triFade = interpolate(frame, [1521, 1528], [1, 0], clamp);

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
        <div style={{ position: "absolute", inset: 0, opacity: 1 - phaseB }}>
          {/* grey band strip — thin (y114 h57) during the pan, then GROWS to the tall
              milestone band (y0 h259) the ref morphs into by f1535, handing to phaseB */}
          <div style={{ position: "absolute", left: 0, top: stripTop, width: 1920, height: stripBottom - stripTop, background: C.bandGrey }} />
          {/* hour ticks/labels: pitch 205, pan with the 00:00 tick, zoom-spread about
              (422,171), then fly off + fade as the band collapses (ref navy→0 by ~f1528) */}
          <div style={{ position: "absolute", inset: 0, transform: `scale(${bandZoom})`, transformOrigin: "422px 171px", opacity: tickFade }}>
            <TimelineBand originX={tick00} originHour={0} pxPerHour={205} y={114} h={57} tickAbove={0} tickBelow={32} labelSize={32} labelDy={6} />
          </div>
          {/* fixed top-centre marker — does NOT pan or zoom; leaves with the band collapse */}
          <div style={{ opacity: triFade }}>
            <MarkerTriangle x={960} y={30} size={60} />
          </div>
          {/* doc (822×577, left edge on the 00:00 tick) + red 00:00 playhead; the group
              translates down-left and mildly scales to evict, from the doc's top-left */}
          <div style={{ position: "absolute", inset: 0, transform: `translate(${docDx}px, ${docDy}px) scale(${docSc})`, transformOrigin: "84px 330px" }}>
            <SchedDoc frame={frame} docP={1} axisP={1} bars={[0, 1, 2, 3, 4]} x={tick00 - 4} y={330} w={822} h={577} fillFrom={0} />
            <div style={{ position: "absolute", left: tick00 - 2, top: 114, width: 5, height: 789, background: C.marker }} />
          </div>
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
// gen18 — S10 HAD NO EXIT. The scene held its whole diagram at full opacity until
// S11's opaque white background covered it at f2075. The ref does what S13 does:
// it SLIDES the diagram (hexes, pill, bank, connectors, chips) straight DOWN and
// off-frame while the band, the marker and the 07:00 milestone stay put. Tracked
// the CLS pill body per frame — the fall starts at f2049 and grows ~1.35x/frame;
// the ref is blank below the band by f2069 (below-band ink 172k@f2058 -> 13k@f2068
// -> the milestone label alone from f2070). We were drawing the entire diagram over
// white for 26 frames.
const S10_EXIT: Lut = [
  [2048, 0], [2049, 0], [2050, 1], [2051, 3], [2052, 6], [2053, 12], [2054, 18],
  [2055, 28], [2056, 40], [2057, 56], [2058, 76], [2059, 102], [2060, 135],
  [2061, 180], [2062, 242], [2063, 325], [2064, 440], [2065, 590], [2066, 790],
  [2067, 1060], [2069, 1600],
];

export const S10Settle: React.FC<{ frame: number; pack: Pack; PillLogo?: React.FC<{ h: number }> }> = ({
  frame,
  pack,
  PillLogo,
}) => {
  if (frame < 1837 || frame >= 2090) return null;
  const outP = interpolate(frame, [2075, 2090], [0, 1], clamp);
  const exitDy = lut(frame, S10_EXIT);
  const hexP = interpolate(frame, [1845, 1868], [0, 1], { ...clamp, easing: EASE });
  const pillP = interpolate(frame, [1872, 1890], [0, 1], clamp);
  // gen19: the bank hex SNAPS IN at f1951-1957 (ref dark-ink in its box, probed per
  // frame: f1930 84 · f1950 0 · f1955 2556 · f1958 2857 · steady 2861). We faded it in
  // over f1900-1916 — fifty frames early, drawing a hex on white the ref leaves blank.
  const bankP = interpolate(frame, [1951, 1957], [0, 1], clamp);
  // gen19 — the connector lane was MIS-SCHEDULED and mis-placed, and it owns the two
  // worst grid cells in S10 (round lead: 240x180+480+720 at .077, +1200+720 at .041).
  // Ref navy px in the left connector, split by segment (probe f1892..f2040):
  //   vert 160 / elbow 165 from f1892 — FULL DARK, complete, in two frames.
  //   lane  3 -> 208 @f1894 -> settled. chevron 240 -> 454 @f1898 -> 860 @f1910.
  // So the line SNAPS ON dark by f1894 and the chevron arrives after. We ran a 22-frame
  // OPACITY fade instead: at f1900 our line is 45% grey where the ref's is solid navy —
  // which is why the lead measured ~1000 ref dark-px against zero of ours.
  const connP = interpolate(frame, [1890, 1895], [0, 1], clamp);
  const chevP = interpolate(frame, [1896, 1910], [0, 1], clamp);
  // gen12: hexes re-registered to the exact ref (A cx479 cy451, B cx1434 cy449;
  // outline flat-to-flat 274 → HH282, vertex-to-vertex 362 → HW378). Old geom
  // (571/1438, hy404, 380×390) sat A 92px right, both 47px high, 108px too tall.
  const ax = 479;
  const bx = 1434;
  const hy = 451;
  // NEGATIVE A/B — gen19. The hexes ARE 5.3% narrow: measured on ref f2000/f2040
  // (identical), the outer vertex-to-vertex span at the mid row (y451) is x295..663.5 =
  // 368.5 against our 350; centres agree to 0.75px and the HEIGHT already matches (ref top
  // edge y315 at x479, ours y313.5). So HW 378 -> 398 is the correct outline. It LOST:
  // against true HEAD, f1900 +.00004 · f1950 -.00047 · f2000 +.0002 · f2040 -.0002 — flat,
  // regressing at half the gated frames. Cause: HexCity scales its INTERIOR with w, and our
  // interior is not the ref's (probe col x=380: the ref has a solid 18px run at y553..570
  // and a rule at y506, we have three 2px ticks at y537/549/557 and nothing at 506). Widening
  // fixes the outline and drags the invented interior further off, and the two cancel.
  // The ink deficit is real (ref 29.9k vs our 23.3k) and it is ABSENT CONTENT, not stroke
  // weight — but it must be TRACED first. Re-scaling before the trace is refuted.
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
      {/* the diagram — it, and only it, slides down and off at the exit */}
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${exitDy}px)` }}>
        <HexCity x={ax} y={hy} w={HW} h={HH} letter="A" variant={0} opacity={hexP} />
        <HexCity x={bx} y={hy} w={HW} h={HH} letter="B" badge="tr" variant={1} opacity={hexP} />
        {/* gen19: the bank hex was 60px left, 38px high and 40% too small. Measured off
            ref f2040: flat top y624..627 (x1388..1472), flat bottom y744..747, widest at
            y690 spanning x1348..1512 — so 164 wide x 123 tall, centred (1430, 686). We
            drew 100x92 at (1370, 648). BankHex renders 0.92*size wide by 0.86*size tall
            (h/w = 0.935); the ref's hex is FLATTER (h/w = 0.75), so size 178 gives the
            true 164 width and a scaleY of 0.80 about the centre gives the true height. */}
        {bankP > 0 && (
          <div style={{ position: "absolute", inset: 0, transform: "scaleY(0.8)", transformOrigin: "1430px 686px" }}>
            <BankHex x={1430} y={686} size={178} opacity={bankP} />
          </div>
        )}
        {/* Geometry, all measured off ref f2040 (navy runs, 1px):
              · lane runs at y815 (x=650 and x=1300 both read 815..816); we had 812.
              · left leg is at x484 (we had ax+10 = 489), 3px not 3.5.
              · the elbows are r=55, not 30 — the arc reproduces the ref to 1px at every
                probed y (y770 x485, y780 x487.5, y790 x491.5, y800 x500, y810 x513).
              · the right leg drops from the BANK at x1429.5, not 1370.
              · each lane ENDS IN A BIG SWEPT CHEVRON at the pill's edge, apex on the
                edge itself (left 743, right 1176), arms 33 out and 24 up/down, stroke 9.
                Our solid triangles sat at x796 / x1124 — INSIDE the pill (742..1175), so
                they rendered invisible. Zero ink where the ref draws ~530px, twice.
              · the hex-B stub runs 592 -> 626 (down to the bank hex top), not 592 -> 598. */}
        {connP > 0 && (
          <svg width={1920} height={1080} style={{ position: "absolute" }}>
            <g opacity={connP}>
              <path d="M 484 592 L 484 760 Q 484 815 539 815 L 743 815" fill="none" stroke={C.navyDeep} strokeWidth={3} />
              <path d="M 1429.5 747 L 1429.5 760 Q 1429.5 815 1374.5 815 L 1176 815" fill="none" stroke={C.navyDeep} strokeWidth={3} />
              <path d="M 1429.5 592 L 1429.5 626" fill="none" stroke={C.navyDeep} strokeWidth={3} />
            </g>
            <g opacity={chevP} fill="none" stroke={C.navyDeep} strokeWidth={9}>
              <path d="M 709 791 L 743 816 L 709 840" />
              <path d="M 1208 792 L 1176 816 L 1208 839" />
            </g>
          </svg>
        )}
        {/* gen18 — the CLS pill was under a THIRD of its true area. Measured off the
            ref's solid-navy bbox at f1950/f2000/f2040 (identical to the pixel): the
            pill is 433x196 at (742, 718). We drew 250x107 at (826, 759) — 26.7k px
            against the ref's 84.9k — and the wordmark, sized off that small h, spilled
            past the pill's right edge and got clipped by its overflow:hidden.
            The ref's wordmark is 318x67, so ClsWordmark height = 67/0.935 = 71.7 and
            logoScale = 71.7/196 = 0.366 (the default 0.5 would render it half again
            too tall). The scenes1 builder found the same undersize in S4 — same pill,
            same rig. */}
        {/* Chips ride UNDER the pill — the ref lets them slide behind it and the pill
            occludes them (f2015: a grey chip reads only 39px wide against its true 130,
            the rest hidden by the pill's right edge). Drawn before the pill, so the
            occlusion is free — and with the pill now at its true size, chips drawn after
            it sat ON TOP OF THE WORDMARK.
            NEGATIVE A/B (reverted): the ref's chips are 127x57, not 86x34 — but resizing
            them LOST (f1950 −.0011, f2020 −.0014, f2045 −.0013, net negative). Our chip
            PATHS are still invented: they fly diagonally out of the hex bottoms, where
            the ref runs them flat along the y≈813 connector lane and parks them at the
            pill's edges. A bigger chip in the wrong place is more misplaced ink, not less
            (lesson 4). Re-measure the paths and the schedule FIRST, then the size. */}
        {chips.map((c, i) => {
          if (c.p <= 0 || c.p >= 1) return null;
          const x = c.from[0] + (c.to[0] - c.from[0]) * c.p;
          const y = c.from[1] + (c.to[1] - c.from[1]) * c.p;
          return <Chip key={i} x={x - 43} y={y - 17} w={86} h={34} color={c.color} />;
        })}
        {pillP > 0 && <ClsPillSlot x={742} y={718} w={433} h={196} p={pillP} PillLogo={PillLogo} logoScale={0.366} />}
      </div>
    </div>
  );
};

const travel = (frame: number, t0: number, t1: number) =>
  interpolate(frame, [t0, t1], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });

// ─── S11: payment instruction docs row (f2075..2250) ───
// Measured f2150 (row is STATIC once settled — f2150 == f2200): 6 regular
// docs 228x285 at y390 (3 navy/grey-blue left, 3 red/cream right) + the
// 2-page focus doc 355x457 at (750,288) under the 07:00 marker.
//
// gen18 — THE EXIT WAS FICTION. The old scene held all 7 docs frozen at their
// settled pose until an outP fade at f2237-2250. The ref (probe_exit2.py /
// probe_cols.py / probe_tail.py, work/cls-day/gen18-s2) does something else
// entirely, starting at f2200:
//   • the SIX side docs fly OUTWARD off-frame (left three leftward, right three
//     rightward), accelerating ~1.4x/frame, staggered from the outside in — the
//     leftmost/rightmost leave first. All six are GONE by f2217 (ref ink in the
//     doc bands drops to the focus doc's edge alone: 20.7k@f2213 -> 2.7k@f2216
//     -> 0@f2217). We were drawing 6 docs x 65k px (≈19% of the frame) on white
//     for ~33 frames.
//   • the FOCUS doc stays and SCALES UP 1.0 -> 1.219 about (1022, 474) over
//     f2205..f2228 — page-1 left border 753->694, right 1107->1126, top 289.5->249,
//     bottom 745->803. It then holds that pose right through S12 (ref f2230 ==
//     f2260 == f2300 to the pixel).
// Per-doc dx = dir * EXIT(frame + shift) * gain — one measured base curve, a
// per-doc time offset and gain (lesson 14: per-event tables, not one easing).
// Anchored on the ref's LEFT doc borders — the one edge the stretch (below) leaves
// alone, so it reads dx directly: f2205 −10.5, f2208 −48.5, f2210 −103.5, f2212
// −215.5, f2214 −448.5 (probe_cols.py, doc3). A clean 1.44×/frame exponential; the
// tail past f2214 continues it (every doc is off-frame by f2217, as the ref is).
const S11_EXIT: Lut = [
  [2200, 0], [2201, 0], [2202, 0], [2203, 1], [2204, 5], [2205, 10.5], [2206, 19],
  [2207, 32], [2208, 48.5], [2209, 71], [2210, 103.5], [2211, 149], [2212, 215.5],
  [2213, 310], [2214, 448], [2215, 646], [2216, 930], [2217, 1340], [2219, 2800],
];
// focus-doc scale (measured per frame off the page-1 left/right borders)
const S11_FOCUS_S: Lut = [
  [2204, 1], [2205, 1.002], [2206, 1.0085], [2207, 1.0155], [2208, 1.0226],
  [2209, 1.0311], [2210, 1.0452], [2211, 1.0621], [2212, 1.0932], [2213, 1.1271],
  [2214, 1.1568], [2215, 1.1751], [2216, 1.1879], [2217, 1.1977], [2218, 1.2048],
  [2219, 1.209], [2220, 1.2119], [2221, 1.2147], [2228, 1.2203],
];
// the pose S11 hands to S12 — the ref holds the doc here, unmoving, for the whole scene
export const S11_FOCUS_GROWN = 1.2203;

// gen20/r20 — THE ENTRANCE WAS FICTION (twin of the exit defect). The old scene
// FADED the seven docs in over f2092-2110 (an inP opacity ramp + a 0.92->1 scale
// about (960,500)). The ref never fades them: it SLIDES ALL SEVEN IN FROM THE
// RIGHT, staggered, each easing to its slot (law 26 — the replica was on the wrong
// clock, and drawing a fade the ref never draws, law 17). Measured off ref seal
// tracks (work r20 seals.py/solidseal.py, per-frame f2092-2115):
//   • the three RED docs (3,4,5) stream in from the right and ease down to their
//     slots WITHOUT overshoot — one shared decay curve, staggered 1 frame each
//     (doc3 seal 1916@f2096 -> 1258@f2111; doc4 1899@f2101 -> 1527@f2112; doc5
//     1885@f2105 -> 1776@f2113). dx-from-settle at τ=-6 is +49 for all three.
//   • doc1/doc2 (navy) WHIP past their slots off the left edge and SPRING BACK from
//     the left (doc2 seal 312@f2102 -> 507@f2111; doc1 46@f2103 -> 242@f2112);
//     amplitude at τ=-6 is -56, larger than the red docs and negative (from −x).
//   • the FOCUS doc is the hero: it sweeps in from the right (pill 1854@f2093),
//     overshoots so its left edge hits the far-left (pill 62@f2100), then eases
//     right to home (pill 828@f2112) — a full sweep-through, its own LUT below.
// All 7 share ONE ease-out decay D(τ) (τ = frame − settle), scaled by a signed
// per-doc amplitude (ea) and a per-doc settle frame (es). Normalised off the red
// docs; reproduces every measured seal to <=12px (D(-11)*49=372 vs doc3 +371;
// D(-6)*-75=-75 vs focus; D(-9)*-56=-186 vs doc2 -195). Right docs (ea>0) are
// visible the whole sweep; left docs (ea<0) sit off-screen-left until they spring
// back at τ=-9. Stretch (scaleX) rides the entrance velocity, same rig as the exit.
const S11_DECAY: Lut = [
  [-18, 40], [-16, 20], [-15, 13.43], [-14, 12.92], [-13, 11.84], [-12, 10.16],
  [-11, 7.57], [-10, 5.02], [-9, 3.33], [-8, 2.24], [-7, 1.53], [-6, 1.0],
  [-5, 0.633], [-4, 0.388], [-3, 0.204], [-2, 0.082], [-1, 0.041], [0, 0],
];
// focus doc entrance — direct measured pill-centre dx (settled pill x828). It is the
// only doc that crosses its own target (sweeps right->left past home, then eases
// back), so it gets a table, not the one-sided decay.
const S11_FOCUS_ENTER: Lut = [
  [2091, 2400], [2092, 1150], [2093, 1026], [2094, 998], [2095, 930], [2096, 731],
  [2097, 535], [2098, 397], [2099, -185], [2100, -766], [2101, -572], [2102, -377],
  [2103, -250], [2104, -169], [2105, -114], [2106, -75], [2107, -48], [2108, -28],
  [2109, -15], [2110, -6], [2111, -1], [2112, 0],
];
const S11_DOCS = [
  { x: -62, seal: "lines" as const, red: false, dir: -1, sh: 2, g: 0.94, ea: -56, es: 2112 },
  { x: 208, seal: "square" as const, red: false, dir: -1, sh: 1, g: 1.01, ea: -56, es: 2112 },
  { x: 475, seal: "circle" as const, red: false, dir: -1, sh: 0, g: 1.0, ea: -56, es: 2111 },
  { x: 1224, seal: "square" as const, red: true, dir: 1, sh: 0, g: 0.855, ea: 49, es: 2111 },
  { x: 1493, seal: "triangle" as const, red: true, dir: 1, sh: 1, g: 0.895, ea: 49, es: 2112 },
  { x: 1742, seal: "circle" as const, red: true, dir: 1, sh: 2, g: 0.9, ea: 49, es: 2113 },
];
// per-doc entrance offset: shared decay scaled by ea, off-screen-left before the
// spring for the left (ea<0) docs.
const s11EnterDx = (d: { ea: number; es: number }, f: number): number => {
  const tau = f - d.es;
  if (tau >= 0) return 0;
  if (d.ea < 0 && tau < -9) return -1600;
  return d.ea * lut(tau, S11_DECAY);
};

export const S11DocsRow: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 2075 || frame >= 2250) return null;
  const outP = interpolate(frame, [2237, 2250], [0, 1], clamp);
  const fs = lut(frame, S11_FOCUS_S);
  // focus doc slides in from the right and eases back to home (translateX), stretching
  // with its own velocity — same left-edge-anchored scaleX rig as the side docs.
  const fDx = lut(frame, S11_FOCUS_ENTER);
  const fSx = Math.min(1 + 0.0011 * Math.abs(lut(frame + 0.5, S11_FOCUS_ENTER) - lut(frame - 0.5, S11_FOCUS_ENTER)), 1.16);
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: 1 - outP }}>
      {/* r8: S10-S12 hour labels remeasured — ref cap-height 14 (fs21, not
          the default 30); at fs21 the label auto-sits at ref cap-top y135. */}
      <TimelineBand originX={958} originHour={7} pxPerHour={141.6} labelSize={21} />
      <MarkerTriangle x={958} y={27} size={60} />
      {/* docs stream in from the right (f2091+) — no group fade, no group scale; the
          white below-band ground is empty until the first doc arrives, as in the ref. */}
      {frame >= 2091 && (
        <>
          {S11_DOCS.map((d, i) => {
            // total horizontal offset = entrance slide (in) + exit fly-out (out); the two
            // windows never overlap, so one drives velocity for the shared stretch rig.
            const at = (f: number) => s11EnterDx(d, f) + d.dir * lut(f + d.sh, S11_EXIT) * d.g;
            const dx = at(frame);
            if (d.x + 232 + dx < -40 || d.x + dx > 1960) return null;
            // The flying docs STRETCH. Measured: every doc's LEFT border lands exactly
            // on dx, while its RIGHT border runs ahead — width 221 settled, 226 @f2208,
            // 230 @f2210, 240 @f2212. It scales with speed and anchors on the doc's own
            // left edge regardless of travel direction (so it is a scaleX in the ref's
            // rig, not a motion blur — a symmetric two-ghost smear was tried and LOST at
            // every fly-out frame: f2210 .8756->.8729, f2212 .8773->.8708).
            const sx = Math.min(1 + 0.0011 * Math.abs(at(frame + 0.5) - at(frame - 0.5)), 1.16);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  transform: `translateX(${dx}px) scaleX(${sx})`,
                  transformOrigin: `${d.x + 2}px 500px`,
                }}
              >
                <RefDoc x={d.x} y={387} seal={d.seal} red={d.red} />
              </div>
            );
          })}
          {/* gen13: focus doc re-reg from ref f2150 (page-1 left border 753, top 289) */}
          <div style={{ position: "absolute", transform: `translateX(${fDx}px) scaleX(${fSx})`, transformOrigin: "748px 500px" }}>
            <div style={{ position: "absolute", transform: `scale(${fs})`, transformOrigin: "1022px 474px" }}>
              <FocusDoc x={753} y={291} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Regular instruction doc — gen18 RE-TRACED per pixel off ref f2130 (probe_doc.py,
// work/cls-day/gen18-s2). Every doc in the row is the SAME body (verified across
// doc2/doc3/doc5: feature offsets from the top rule agree to 0.5px; the ref just
// jitters each doc's y by ~2px). Doc-local svg y = trace y − 3.5.
//
// What the old model had wrong — all of it POSITION, none of it texture:
//   • banner box 62 tall at y105  → ref is 39 tall at y110; inner bar 22 tall → 15
//   • field row = two loose cells → ref is ONE bordered box (117..208, y69..92)
//     with a centre divider at x162 and the fill INSET (124..157)
//   • the three body lines sat at y185/195/203 → the ref's are at y160/167/174,
//     25px high, and the first runs the FULL doc width (x17..208)
//   • bottom divider at x36 → x18; fill block at (150,238) → (141,231)
//   • only 2 header lines, 2.5px → the ref has THREE, 5px thick, from x55
//   • right border at x230 → 223 (doc is 221 wide, not 228). gen13's NEGATIVE A/B
//     narrowed the whole svg — which dragged the interior off its registration and
//     lost. Moving the border alone, with the interior re-registered to the trace,
//     is a different change.
//   • square bottom-left corner → the ref rounds it, r22
//   • fold corner at x190/depth40 → x176/depth 49
//   • the CIRCLE-seal docs MIRROR their bottom block (fill left, divider+lines
//     right) — a per-doc variant the old model never had.
const RefDoc: React.FC<{ x: number; y: number; seal: "lines" | "square" | "circle" | "triangle"; red: boolean }> = ({
  x,
  y,
  seal,
  red,
}) => {
  const acc = red ? C.red : C.navyBg;
  const fill = red ? C.chipCream : C.chipGrey;
  const ink = C.navyDeep;
  return (
    <svg width={232} height={289} viewBox="0 0 232 289" style={{ position: "absolute", left: x, top: y }}>
      <path d="M 176 2 L 223 51 L 223 285 L 24 285 Q 2 285 2 263 L 2 2 Z" fill={C.white} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
      <path d="M 176 2 L 176 51 L 223 51" fill="none" stroke={ink} strokeWidth="3" />
      {seal === "square" && <rect x={20} y={16} width={29} height={27} fill={acc} />}
      {seal === "circle" && <circle cx={33} cy={30} r={13} fill={acc} />}
      {seal === "triangle" && <path d="M 35 20 L 49 42 L 21 42 Z" fill={acc} />}
      {seal === "lines" && (
        <>
          <rect x={20} y={18} width={44} height={5} fill={ink} />
          <rect x={20} y={28} width={34} height={5} fill={ink} />
        </>
      )}
      {/* three header lines */}
      <rect x={55} y={21} width={48} height={5} fill={ink} />
      <rect x={55} y={28} width={25} height={5} fill={ink} />
      <rect x={55} y={35} width={48} height={5} fill={ink} />
      {/* field row: one bordered box, centre divider, inset fill in the left cell */}
      <rect x={117} y={69.5} width={91} height={22} fill="none" stroke={ink} strokeWidth="3.5" />
      <rect x={160.5} y={69.5} width={3} height={22} fill={ink} />
      <rect x={124} y={73.5} width={33} height={14} fill={fill} />
      {/* banner: box + inner filled bar at its top */}
      <rect x={18} y={110} width={190} height={39} fill="none" stroke={ink} strokeWidth="3.5" />
      <rect x={25} y={114.5} width={175} height={15} fill={fill} />
      {/* body lines: one full-width rule, then two short rows */}
      <rect x={17} y={159.5} width={191} height={5} fill={ink} />
      <rect x={18} y={166.5} width={46} height={5} fill={ink} />
      <rect x={67} y={166.5} width={19} height={5} fill={ink} />
      <rect x={18} y={173.5} width={31} height={5} fill={ink} />
      {/* bottom block — circle docs mirror it (fill left, divider + lines right) */}
      {seal === "circle" ? (
        <>
          <rect x={18} y={231} width={64} height={18} fill={fill} />
          <rect x={104} y={229} width={4} height={23} fill={ink} />
          <rect x={115} y={231} width={29} height={6} fill={ink} />
          <rect x={149} y={231} width={39} height={6} fill={ink} />
          <rect x={193} y={231} width={13} height={6} fill={ink} />
          <rect x={113} y={239} width={54} height={5} fill={ink} />
          <rect x={174} y={239} width={34} height={5} fill={ink} />
          <rect x={114} y={245} width={30} height={6} fill={ink} />
        </>
      ) : (
        <>
          <rect x={18} y={228.5} width={4} height={24} fill={ink} />
          <rect x={28} y={231.5} width={30} height={5} fill={ink} />
          <rect x={63} y={231.5} width={40} height={5} fill={ink} />
          <rect x={105} y={231.5} width={15} height={5} fill={ink} />
          <rect x={28} y={239.5} width={55} height={4} fill={ink} />
          <rect x={87} y={239.5} width={33} height={4} fill={ink} />
          <rect x={28} y={245.5} width={31} height={6} fill={ink} />
          <rect x={141} y={231.5} width={63} height={35} fill={fill} />
        </>
      )}
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

// ─── S12: checks on the big doc (f2237..2362) ───
// gen19 — S12 WAS DRAWING THE WRONG DOCUMENT. The ref's S12 is the SAME 2-page focus doc
// S11 grows, held at the grown pose and never touched again: ref ink below the band is a
// flat 52,140 px at f2240 with bbox x692..1203 y247..846, and f2230 == f2260 == f2300 on
// the doc to the pixel. We drew a generic 260x330 MiniDoc at (840,720) — a fifth of the
// area, in the wrong place. S11 already hands the grown doc over (scale 1.2203 about
// (1022,474)), so S12 just mounts the same thing at the same pose.
//
// The CHECKS were wrong too. Ref discs (red mask, eroded to isolate them from their
// leaders): d=160 at (456,428), (1360,312), (1550,714). We drew d=74 at (640,620),
// (1275,590), (1320,830). Each disc is ~19k px — three of them is 58k, half the scene.
// Arrival, from the ref's ink steps below the band (52.1k doc-only @f2240 -> 70.0k @f2250
// -> 91.9k @f2270 -> 111.7k @f2290, then FLAT to f2335): ~f2243 / f2263 / f2283, not
// 2255/2290/2320. Each leader is an L: disc -> elbow -> a small ring on the doc.
// S12's EXIT, measured per frame (ink below the band + doc top + red mask):
//   checks hold at 58,127 red px to f2336, then 10,344 @f2338 -> 140 @f2340 -> 0 @f2342.
//   the doc then FALLS: top 247 (f2342) -> 289 (f2344) -> 303 (f2346) -> 349 (f2348) ->
//   396 (f2350), i.e. it starts moving only once the checks are gone.
// We held the whole scene frozen and fade-covered it at f2362 — so the tail regressed hard
// once the doc was drawn at its true (much larger) size: f2340 .9122 -> .8921 and
// f2350 .9038 -> .8657 before this exit was added.
const S12_DOC_EXIT: Lut = [
  [2341, 0], [2342, 3], [2344, 42], [2346, 56], [2348, 102], [2350, 149],
];
const S12_CHECKS = [
  { cx: 456, cy: 428, at: 2243, path: "M 536 428 L 757 428 L 757 302", rx: 757, ry: 298 },
  { cx: 1360, cy: 312, at: 2263, path: "M 1360 392 L 1360 522 L 1037 522", rx: 1029, ry: 522 },
  { cx: 1550, cy: 714, at: 2283, path: "M 1470 714 L 1034 714", rx: 1026, ry: 714 },
];

export const S12Checks: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 2237 || frame >= 2375) return null;
  // The ref CUTS to S13 at ~f2347 — at f2350 it is already showing S13's band at y0, the
  // handshake pill and the city capsules, and the doc is gone. S12 was holding its content
  // to f2362 and fading out to f2375, fifteen frames of a document the ref has replaced.
  // (S13's own mount still starts at f2362 — the ref begins it ~14f earlier. Noted, not
  // fixed here: retiming S13's entrance moves its band, pill, cities and rails together.)
  // And the doc does not merely fall: it DISINTEGRATES — its ink breaks into fragments in
  // place while the sheet drifts down (ref ink 48.0k @f2342 -> 32.9k @f2344 -> 25.5k @f2346
  // -> gone). Solid ink over broken ink loses to WHITE over broken ink, so a fast dissolve
  // beats every attempt to draw the doc through it: holding the doc to f2348 cost f2345
  // .0138; matching the ink-decay ramp still cost it .0138; dissolving over f2341-2343.5
  // GAINS .0332 there. SPEND: f2342 (the one frame where the ref's doc is 92% intact and
  // ours is half-faded) −.0049, against +.010..+.036 across the ~110 frames around it.
  const outP = interpolate(frame, [2341, 2343.5], [0, 1], clamp);
  const checkOut = interpolate(frame, [2336, 2339.5], [1, 0], clamp);
  const docDy = lut(frame, S12_DOC_EXIT);
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: 1 - outP }}>
      {/* r8: S10-S12 hour labels remeasured — ref cap-height 14 (fs21, not
          the default 30); at fs21 the label auto-sits at ref cap-top y135.
          gen20: the band is HANDED to S13 at f2339, which morphs it (it does not
          cut) — see the S13 entrance block. Keeping it here past f2338 fades the
          band out with the doc, and the ref's band never fades: 18 frames of our
          comp had NO BAND AT ALL. */}
      {frame < 2339 && (
        <>
          <TimelineBand originX={958} originHour={7} pxPerHour={141.6} labelSize={21} />
          <MarkerTriangle x={958} y={27} size={60} />
        </>
      )}
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${docDy}px)` }}>
        <div style={{ position: "absolute", transform: `scale(${S11_FOCUS_GROWN})`, transformOrigin: "1022px 474px" }}>
          <FocusDoc x={753} y={291} />
        </div>
      </div>
      {checkOut > 0 && S12_CHECKS.map((c, i) => {
        const p = interpolate(frame, [c.at, c.at + 10], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) });
        const lineP = interpolate(frame, [c.at + 4, c.at + 14], [0, 1], clamp);
        if (frame < c.at) return null;
        return (
          <React.Fragment key={i}>
            <svg width={1920} height={1080} style={{ position: "absolute", opacity: lineP }}>
              <path d={c.path} fill="none" stroke={C.marker} strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - lineP} opacity={checkOut} />
              <circle cx={c.rx} cy={c.ry} r={5} fill="none" stroke={C.marker} strokeWidth={2.5} opacity={lineP * checkOut} />
            </svg>
            <CheckCircle x={c.cx} y={c.cy} size={160 * Math.min(p, 1.15)} opacity={Math.min(p * 2, 1) * checkOut} />
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── S13: PvP handshake (f2339..2737) ───
// Measured f2450/f2550/f2700: two FIXED asymmetric city capsules (left top
// y222/bottom y690, vertex 497,455; right top y390/bottom y855, vertex
// 1428,622), an S-rail from the pill (top: left-arrow at x415 y290; bottom:
// right-arrow at x1465 y770), chips spawn at the pill arcs and travel
// OUTWARD at ~7.2px/f (red/cream leftward on top, slate rightward below).
// content descent, measured off the ref pill's top edge (probe_s13.py)
const S13_EXIT: Lut = [
  [2712, 0], [2713, 0], [2714, 3], [2715, 9], [2716, 21], [2717, 43], [2718, 75],
  [2719, 125], [2720, 207], [2721, 352], [2722, 568], [2723, 926], [2725, 2400],
];

// ══ S13's ENTRANCE — rebuilt gen20 from a per-frame ref sweep (f2335-2425) ══
//
// S13 did not start 14 frames late. It started NINETY-FOUR frames late, and it
// never had an entrance at all. OLD: mount f2362 (band only) → pill fades in
// f2370-2390 → cities f2380-2405 → rails f2410-2440. The ref is FULLY SETTLED at
// f2378. From f2344 to f2361 our comp rendered a COMPLETELY BLANK WHITE FRAME
// (verified: zero ink below y140 at f2372 too — 40 frames of an empty scene under
// a band). Everything below was white where the ref draws the whole scene.
//
// What the ref actually does — five clocks, none of them shared (ink.py/geo.py in
// work/cls-day/r17-scenes2b):
//
// 1. THE BAND NEVER CUTS. It MORPHS. S12's band (y88 h40, pxPerHour 141.6, 21px
//    labels) grows continuously into S13's (y0 h57, pxPerHour 286, 42px labels)
//    over f2339-2361, and 07:00 stays pinned at x959 in EVERY frame of the morph
//    (measured: the tick nearest 958 reads 959.0 at f2336 and at f2400). So the
//    whole morph is ONE parameter — z = (pxPerHour-141.6)/144.4 — and every other
//    band prop is linear in it: labelSize 21+21z, labelDx 8+7z, labelDy 2+2z,
//    tickAbove 4(1-z), tickBelow 20+25z. At z=0 those ARE S12's props; at z=1 they
//    are S13's, exactly. The band's y/bottom do NOT follow z (the strip fattens to
//    71px at f2351 then settles back to 57) so they get their own measured tables.
//    S12's MarkerTriangle rides the morph and clips off the top edge at f2350.
//
// 2. THE CONTENT SCALES UP about (723, 219) — one global scale for pill AND both
//    capsules. Cross-checked three ways and they agree to 0.003: pill height/213,
//    left-capsule height/476, right-capsule height/646 all give the same s per
//    frame. That origin also predicts the pill's x0/x1 to ±6px at every frame.
//    s: 0.40 @f2346 → 0.81 @f2349 → 0.94 @f2352 → 0.99 @f2357 → 1 @f2361.
//
// 3. THE CAPSULES OPEN SIDEWAYS. Each hexagon is X-COMPRESSED to a vertical line
//    and swings open — at f2349 the left capsule is a 6px-wide, 388px-tall navy
//    SLIVER at x275; at f2356 a leaf 74px wide; at f2362 it is fully open. The
//    STROKE does not compress with it (a 4-6px line at k=0.01), so the reveal is a
//    non-scaling-stroke scaleX, not a shape scale. And the two are NOT in step:
//    the RIGHT capsule leads the LEFT by ~4 frames (right first ink f2352, left
//    f2349, but right reaches k=0.3 at f2356 and left only at f2358; the red-tower
//    tracer confirms it — right snaps in over f2357-2359, left over f2359-2361).
//    The flock is not rigid. Measure each element or you will move them together.
//
// 4. THE RAILS DRAW. They do not fade. The vertical stub + elbow appear ~f2355,
//    then the horizontal extends OUT of the pill at ~44px/frame: the top rail's
//    left end runs 848 (f2357) → 401 (f2369), the bottom's right end 1051 → 1499
//    on the same curve. The arrowheads land only when the line arrives (f2369).
//
// 5. THE CITY INTERIORS ARRIVE IN TWO WAVES, after their capsule is open — ~70%
//    of the ink by f2362, a plateau to f2368, then the rest by f2378 (row-band ink
//    at f2364-2368 is 79%/65%/61%/90% top-to-bottom, so it is NOT a directional
//    wipe: the middle floors simply finish last). Fitted as one opacity ramp per
//    city off the measured ink curve.
const S13_BAND_Y: Lut = [
  [2338, 88], [2339, 87], [2340, 86], [2341, 85], [2342, 84], [2343, 82], [2344, 79],
  [2345, 76], [2346, 71], [2347, 64], [2348, 54], [2349, 38], [2350, 19], [2351, 5], [2352, 0],
];
// band BOTTOM (exclusive). Once the top clips at y0 the strip keeps shrinking from
// below — top and bottom are separately measured, not one height.
const S13_BAND_B: Lut = [
  [2338, 128], [2340, 127], [2341, 126], [2342, 125], [2343, 124], [2344, 122], [2345, 120],
  [2346, 117], [2347, 113], [2348, 107], [2349, 97], [2350, 85], [2351, 76], [2352, 70],
  [2353, 67], [2354, 64], [2355, 62], [2356, 61], [2357, 59], [2358, 59], [2359, 58], [2361, 57],
];
const S13_BAND_PPH: Lut = [
  [2338, 141.6], [2339, 142.5], [2340, 143.8], [2341, 145], [2342, 147], [2343, 149.5],
  [2344, 153], [2345, 157.5], [2346, 163.5], [2347, 172], [2348, 185], [2349, 205.5],
  [2350, 230.5], [2351, 248.5], [2352, 260], [2353, 267.8], [2354, 273], [2355, 277],
  [2356, 280], [2357, 282.2], [2358, 284], [2359, 285], [2360, 285.8], [2361, 286],
];
// global content scale about (723,219)
//
// RE-DERIVED gen20/r17-scenes2c against the CORRECTED settled pill (752,426,390,213), from
// the ref's own per-frame pill box (pill.py over the dense sweep). The origin needed NO
// change — it was fitted against the REF all along, and it was our settled pose that was
// wrong. With the pill home, ox + (752-ox)*s predicts the ref's x0 (and x1/y0/y1) to <=1.5px
// at EVERY uniform-scale frame:
//   f2348 s.639: pred x0 741.5 / ref 740 · y0 351.2 / 350 · x1 989.9 / 989 · y1 486.5 / 485
//   f2352 s.944: pred x0 750.4 / ref 751 · y0 414.4 / 414 · x1 1117.5 / 1117 · y1 614.4 / 614
//   f2356 s.991: pred x0 751.7 / ref 752 · y0 424.1 / 424 · x1 1137.1 / 1137 · y1 634.1 / 634
// With the OLD pose the same origin predicted x0 758.5 / y0 432.2 at f2356 — the settled
// error times s. The entrance was never mis-scaled. It was correctly scaling a wrong box.
//
// TWO THINGS THE SWEEP FOUND AND THIS ROUND DID NOT SPEND (both small, both real):
//  · the ref's pill is SETTLED AT f2359, not f2361 (h=213 at f2359). Our last two keys are
//    0.998/1 — under 0.8px. Retiming them would drag the capsule LUTs, which key to 2362.
//  · f2344-2347 is NOT a uniform scale: the ref's pill is SQUAT there (w/h 2.30 vs the
//    settled 1.83; it only reaches the settled aspect at f2348). A single s cannot fit it.
//    Our s (0.40/0.47) already sits between the ref's h-scale (.34/.39) and w-scale
//    (.43/.49) — the right compromise for a one-parameter model. The honest fix is a second
//    (independent sx) LUT for f2344-2347. Four frames.
const S13_S: Lut = [
  [2346, 0.4], [2347, 0.47], [2348, 0.635], [2349, 0.812], [2350, 0.878], [2351, 0.915],
  [2352, 0.94], [2353, 0.957], [2354, 0.972], [2355, 0.98], [2356, 0.987], [2357, 0.992],
  [2358, 0.996], [2359, 0.998], [2361, 1],
];
// capsule swing-open: scaleX k about a per-frame origin, expressed as (k, tx) so the
// shape's own span maps onto the measured ref span at every frame. Solved off the ref
// ink edges back-projected through S13_S; the last keys land exactly on (1, 0) so every
// settled frame renders byte-identical to before.
const S13_LCAP_K: Lut = [
  [2348, 0], [2349, 0.0059], [2350, 0.0069], [2351, 0.0101], [2352, 0.0189], [2353, 0.0329],
  [2354, 0.0519], [2355, 0.0815], [2356, 0.123], [2357, 0.1887], [2358, 0.3011], [2359, 0.554],
  [2360, 0.7626], [2361, 0.8534], [2362, 1],
];
const S13_LCAP_TX: Lut = [
  [2348, 170], [2349, 170.1], [2350, 172], [2351, 171.7], [2352, 170.1], [2353, 166.5],
  [2354, 164.3], [2355, 157], [2356, 148.2], [2357, 134.3], [2358, 111.5], [2359, 58.9],
  [2360, 27.4], [2361, 15.9], [2362, 0],
];
const S13_RCAP_K: Lut = [
  [2352, 0], [2353, 0.0799], [2354, 0.1212], [2355, 0.1873], [2356, 0.3016], [2357, 0.5529],
  [2358, 0.7626], [2359, 0.8548], [2360, 0.9029], [2361, 0.9408], [2362, 1],
];
const S13_RCAP_TX: Lut = [
  [2352, 1610], [2353, 1607.3], [2354, 1534.1], [2355, 1423], [2356, 1227.2], [2357, 796.6],
  [2358, 424.8], [2359, 260], [2360, 173.5], [2361, 105.2], [2362, 0],
];
// city interiors, fitted to the measured ink ramp (right leads left by 2f)
// ── city interiors: the ONLY schedule that pays, and it is not the ref's ──
// The ref starts its buildings at f2358 and finishes them at ~f2378. We hold ours
// back to f2371/f2374 and snap. That is deliberate, and it is measured. THREE
// interior schedules were rendered and gated against the same OLD baseline:
//   f2359 / f2362 / f2366 / f2372, ΔSSIM vs OLD
//   • ink-fitted opacity RAMP (the ref's own curve):   −.0074 / −.0186 / −.0036 / +.0106
//   • binary SNAP at the ref's 50% ink crossing:       +.0099 / −.0193 / −.0041 / +.0106
//   • the same ramp, with the interior riding the capsule's X-compression
//     (the physically right model — the ref DOES pile its interior ink into a
//     narrow column early, 249% of settled ink in x0..90 at f2360):
//                                                      +.0013 / −.0186 / −.0036 / +.0106
//   • HOLD, then snap when the ref is ~95% in:         +.0323 / +.0118 / +.0176 / +.0145
// Every form of drawing our interior early LOSES; holding it back WINS at every
// frame, by a lot. The cause is the defect gen19 measured and could not fix: our
// capsules carry 62-71% of the ref's ink with line CENTRES 1-4px off. Against a
// ref that is mid-animation (buildings still sliding and scaling in), that art is
// worse than white — the same law that governed S12's dissolving doc, running the
// other way. It becomes drawable early only after the per-edge re-registration.
// Classified: reference-self-contradiction FOR OUR RIG, not for the reference.
const S13_LINT: Lut = [[2373, 0], [2374, 1]];
const S13_RINT: Lut = [[2370, 0], [2371, 1]];
// rail draw, as a fraction of the S-path's length (stub+elbow = the first 0.256)
const S13_RAIL: Lut = [
  [2354, 0], [2355, 0.12], [2356, 0.256], [2357, 0.32], [2358, 0.387], [2359, 0.454],
  [2360, 0.524], [2361, 0.594], [2362, 0.661], [2363, 0.724], [2364, 0.782], [2365, 0.839],
  [2366, 0.889], [2367, 0.928], [2368, 0.962], [2369, 1],
];
// the arrowhead RIDES the drawing tip and grows with it (ref: nothing at f2360 when the
// tip is at x714; an 11px stub at f2362; 29px arms at f2366; full 52px at f2369).
const S13_ARROW: Lut = [[2361, 0], [2362, 0.21], [2366, 0.56], [2369, 1]];

export const S13Pvp: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 2339 || frame >= 2726) return null;
  // gen13: exit RE-TIMED to the ref — the content (cities/rails/pill/chips) SLIDES
  // straight DOWN off-frame while the top band stays; blank below the band by f2725.
  // gen18: the CURVE was still wrong. Tracked the navy pill's top edge per ref frame
  // (probe_s13.py): the fall STARTS at f2713, four frames before our f2717, and it is
  // a ~1.65x/frame exponential, not a quadratic — by f2719 the ref is 125px down and
  // we were only 88. That one frame scored .787 against a .874 steady state. Measured
  // table, no easing (lesson 14).
  const exitDy = lut(frame, S13_EXIT);
  // entrance (gen20, all measured — see the block above)
  const bandY = lut(frame, S13_BAND_Y);
  const bandB = lut(frame, S13_BAND_B);
  const pph = lut(frame, S13_BAND_PPH);
  const z = (pph - 141.6) / 144.4; // 0 = S12's band, 1 = S13's
  const s = frame >= 2361 ? 1 : lut(frame, S13_S);
  const lcapK = frame >= 2362 ? 1 : lut(frame, S13_LCAP_K);
  const lcapTx = frame >= 2362 ? 0 : lut(frame, S13_LCAP_TX);
  const rcapK = frame >= 2362 ? 1 : lut(frame, S13_RCAP_K);
  const rcapTx = frame >= 2362 ? 0 : lut(frame, S13_RCAP_TX);
  const lInt = frame >= 2378 ? 1 : lut(frame, S13_LINT);
  const rInt = frame >= 2374 ? 1 : lut(frame, S13_RINT);
  const railP = frame >= 2369 ? 1 : lut(frame, S13_RAIL);
  const mz = pph / 141.6; // S12's marker rides the band's x-zoom and clips off the top
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
  // the S-rail dash-draw: dasharray only while drawing, so every settled frame is
  // byte-identical to the pre-gen20 render.
  const dash = railP < 1 ? { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - railP } : {};
  // the chevrons ride the line's tip (top path ~655 long, stub+elbow the first 166;
  // bottom ~658 / 179 — one draw LUT for both, the 2% difference is sub-pixel)
  const arrowP = frame >= 2369 ? 1 : lut(frame, S13_ARROW);
  const tipT = Math.max(401, 890 - (railP * 655 - 166));
  const tipB = Math.min(1499, 1020 + (railP * 658 - 179));
  // the band morph re-expressed at S13's own origin: originX 959 / hour 7 with
  // pxPerHour 286 puts 04:00 at x101 — identical ticks to the old (101, hour 4).
  return (
    <div style={{ position: "absolute", inset: 0, background: frame >= 2344 ? C.white : "transparent" }}>
      {/* band: ONE morph from S12's strip to S13's. r8 (still true at z=1): ref digits
          cap-height 29 (fs42), digit x-start 118 (labelDx 15), ticks to y102
          (tickBelow 45). At z=0 every prop below collapses onto S12's band. */}
      <TimelineBand
        y={bandY}
        h={bandB - bandY}
        originX={959}
        originHour={7}
        pxPerHour={pph}
        tickAbove={4 * (1 - z)}
        tickBelow={20 + 25 * z}
        labelSize={21 + 21 * z}
        labelDx={8 + 7 * z}
        labelDy={2 + 2 * z}
      />
      {z < 1 && <MarkerTriangle x={959} y={bandY - 61 * mz} size={60 * mz} />}
      {/* content (cities/rails/pill/chips) slides DOWN off-frame at exit; band stays.
          On entry the same group SCALES UP about (723,219) — see S13_S. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: "723px 219px",
          transform: s < 1 ? `translateY(${exitDy}px) scale(${s})` : `translateY(${exitDy}px)`,
          opacity: frame >= 2346 ? 1 : 0,
        }}
      >
      <PvpLeftCity k={lcapK} tx={lcapTx} interior={lInt} />
      <PvpRightCity k={rcapK} tx={rcapTx} interior={rInt} />
      {/* S-rail: pill top → elbow → leftward chevron; pill bottom → elbow → rightward
          chevron. gen20 RE-MEASURED off ref f2400, and every number was wrong:
            · the BOTTOM lane sat at y770; the ref's is at y774 (rows 772..776) — a
              490px line 4.5px off its centre, and it owned grid cells r4c3/r4c4/r4c5.
            · the stroke is 5, not 3.5 (ref rows 288..292 / 772..776).
            · the top line ends at x401, not 445; the bottom at x1499, not 1435.
            · the arrowheads are OPEN SWEPT CHEVRONS — tip on the lane, arms 52 back
              and ±32, stroke 8 — not the small solid triangles we drew. And the TOP
              one pointed the WRONG WAY: `rotate(180)` put its apex at x477, to the
              RIGHT of its own base, so it aimed back at the pill.
          Same family as gen19's S10 connector arrowheads (apex on the edge, big sweep). */}
      {railP > 0 && (
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <path d="M 950 425 L 950 370 C 950 325.8 923.1 290 890 290 L 401 290" fill="none" stroke={C.navyDeep} strokeWidth={5} {...dash} />
        {arrowP > 0 && (
          <path
            d={`M ${tipT + 52 * arrowP} ${290 - 32 * arrowP} L ${tipT} 290 L ${tipT + 52 * arrowP} ${290 + 32 * arrowP}`}
            fill="none"
            stroke={C.navyDeep}
            strokeWidth={5 + 3 * arrowP}
          />
        )}
        <path d="M 950 635 L 950 704 C 950 742.7 981.3 774 1020 774 L 1499 774" fill="none" stroke={C.navyDeep} strokeWidth={5} {...dash} />
        {arrowP > 0 && (
          <path
            d={`M ${tipB - 52 * arrowP} ${774 - 32 * arrowP} L ${tipB} 774 L ${tipB - 52 * arrowP} ${774 + 32 * arrowP}`}
            fill="none"
            stroke={C.navyDeep}
            strokeWidth={5 + 3 * arrowP}
          />
        )}
      </svg>
      )}
      {/* THE PILL — measured directly, not back-projected (gen20, r17-scenes2c/pill.py).
          The pill is the cleanest signal in S13: a solid (0,39,83) fill. But it is NOT an
          isolated navy component — the rails leave its edges — so a flood-fill walks out of
          it and returns x752..1919. Erode by 5 first (every other navy thing in the frame is
          a stroke <= 8px: rails 5, capsule outlines 4, band ticks 3), label, take the largest
          component in the centre, add the 5 back. The instrument recovers our OWN known
          759/435/380/213 exactly, and the ref reads the SAME BOX at seven settled frames
          (f2400/2450/2500/2550/2600/2650/2700, to the pixel):

            ref   x752..1141  y426..638   w390  h213
            ours  x759..1138  y435..647   w380  h213     -> 7px right, 9px low, 10px narrow

          h was already right. This is a pure translate + widen on a 60,000px navy block that
          sits mid-frame for 350 frames.

          WHAT MOVED WITH IT: nothing. That is the finding, and it is worth more than the fix.
          Every element that "hangs off the pill" is already pinned to the REF's pill, not to
          ours, because each was fitted against the ref independently:
            · the rail stubs start at (950,425) and (950,635). The ref's pill top is 426 —
              so the top stub lands exactly ON its edge. OURS started at 435, and the stub
              ended at 424: a TEN-ROW WHITE GAP at x950, y425..434, in every settled frame.
              The rail was not detached from the pill; the PILL was detached from the rail.
              (Probed col x950: ref runs 360..425 then 427..; ours 360..424 then 435...)
            · the chips spawn at x942 on the rail lanes (y262/y743), fitted per-frame off the
              ref in r5. They never touch the pill's box (y426..638) — they ride the RAILS.
            · the entrance scale about (723,219) was fitted against the REF's geometry. With
              the corrected settled pose it predicts the ref's pill to <=1.5px at every
              uniform-scale frame of the entrance (f2348-2358) — see the re-derivation above.
          A misplaced object drags nothing with it when everything else was measured honestly.

          NOT FIXABLE HERE (lib owns them, both sub-pixel-scale):
            · TR/BL corner radius is 8 in lib; the ref's is ~2 (ref hits full width 2 rows in,
              we take 8). ~30px of area, on 60,000.
            · the handshake icon is flex-centred and sized w*0.46, so it rides the pill. Ours
              sat at ink-centre (948.5,531) against the ref's (948.5,527.5) — 3.5px out, i.e.
              lib's translateY(-8px) was quietly PROPPING UP the misplaced pill. Moving the
              pill home moves the icon to ~(946.5,522) — 5.9px out. A 2.4px regression on
              4,700px of icon ink, bought with a 7-9px correction on 60,000px of pill. The
              gate confirmed the trade at every frame. The honest fix is lib's: translateY
              -8 -> -2.5 once the pill is home. */}
      <HandshakePill x={752} y={426} w={390} h={213} opacity={1} />
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

// NEGATIVE A/B — gen19, do not re-run without doing the registration first.
// We draw only 62-71% of the ref's ink in these two capsules (measured f2450/2600/2690:
// ref 34.5k/36.9k px vs ours 22.2k/26.1k). Every line in the ref is 6.5-7px wide; ours are
// 3-4. Widening ALL city strokes to the measured width lost at all 8 gated frames (-.0031 to
// -.0035): our line CENTRES sit 1-4px off the ref's (a whole-city translate recovers only
// 5-15% of the SSD, and the red tower's internal rules disagree in BOTH directions), so a
// wider stroke just doubles the error band. Misplaced ink loses to absent ink. The ink is
// there to be collected, but only AFTER each element's centre is re-registered per-edge.
// left PvP city capsule (traced from ref f2550 crop, absolute coords).
// gen20: the capsule OUTLINE swings open (scaleX k about a per-frame origin, stroke
// NOT scaled — see the S13 entrance block); the INTERIOR only arrives once the
// capsule is open, so it carries its own opacity and no transform. At k=1/tx=0/
// interior=1 both branches below render exactly the pre-gen20 markup.
// r18: THE SAME DEFECT AS THE RIGHT CAPSULE, AND THE SAME CAUSE. Re-measured by tracking
// the navy RUN and taking its MIDPOINT (the chip at y262..317 and the top arrowhead at
// x393..460 sit ON the upper diagonal and poison any fixed-window scan — track the run
// nearest the predicted centre and reject any that touches the window edge):
//
//                       ref f2600                    ours (old)              error
//   upper diagonal      xc = +0.5770y + 238.20       +0.5913y + 234.02       slope
//   lower diagonal      xc = -0.5773y + 766.46       -0.4762y + 716.26       SLOPE, badly
//   top edge yc         223.0                        221.5
//   bottom edge yc      692.5  (x40 693, x120 692.5) 690
//   apex centre x       492.5  (y452..464)           492.5  (y452..460)      already right
//   stroke              7.7 / 7.8 h-extent  -> 7     4.4 / 3.8               HALF WIDTH
//   rms of the fits     0.20 / 0.21 px               0.14 / 0.22
//
// Our lower diagonal ran at -0.476 against the ref's -0.577 — an 11px error by y600. Both
// ref capsules are symmetric hexagons with diagonals at exactly +/-tan(30 deg), and this
// one's axis is y=457.75 ((223+692.5)/2), where the two fitted diagonals cross at 502.32
// and 502.20 — 0.12px apart. Sharp vertex (502.26, 457.75), blunted by the ref to 492.5
// (9.76px — the right capsule's is 9.65px, the same pen).
//
// The apexes were NEVER the error, on either capsule. Reading a 4px stroke's outer edge
// against a 7px stroke's is what invented one.
const L_CAPSULE = "M -80 223 L 331.9 223 Q 366.9 223 384.4 253.3 L 482.8 423.9 Q 502.3 457.75 482.7 491.6 L 384.2 662.2 Q 366.7 692.5 331.7 692.5 L -80 692.5";
const L_CAP_W = 7;
// r18: THE INTERIOR PEN. gen19 refuted this ("widening ALL city strokes LOSES", -.0031 to
// -.0035 at 8 frames). THAT REFUTATION WAS THE MIS-REGISTERED CAPSULE OUTLINE CANCELLING A
// REAL GAIN — law 24 run backwards: a NEGATIVE A/B can be two effects cancelling too. With
// the capsule home, widening the interiors WINS at every frame: f2400 +.0041 · f2600 +.0042
// · f2700 +.0041 · f2372 +.0001. Tuned: 1.85 beats 2.0 at all three settled frames
// (.9194/.9151/.9170 vs .9189/.9146/.9163). Interior pen multiplier. ref interior strokes measured 6-7px
// (horizontal rules, where a run's height IS the stroke): L top rule 405..411, L floor
// 553..559, L ground 657..663, R bg-bldg top 510..516, R crown 454..459, R panel rail
// 550..555. Ours are 3-4. IW=1 is the pre-r18 render, byte-identical.
const IW = 1.85;
const PvpLeftCity: React.FC<{ k?: number; tx?: number; interior?: number }> = ({
  k = 1,
  tx = 0,
  interior = 1,
}) => (
  <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute" }}>
    {/* capsule frame */}
    {k < 1 ? (
      <g transform={`translate(${tx},0) scale(${k},1)`}>
        <path d={L_CAPSULE} fill="none" stroke={C.navyDeep} strokeWidth={L_CAP_W} vectorEffect="non-scaling-stroke" />
      </g>
    ) : (
      <path d={L_CAPSULE} fill="none" stroke={C.navyDeep} strokeWidth={L_CAP_W} />
    )}
    {interior <= 0 ? null : (
    <g {...(interior < 1 ? { opacity: interior } : {})}>
    {/* far-left navy building w/ dash windows. gen19: probed col x=27 — the ref has
        TWO dash rows (y429..447, y466..484), not three; the third row we drew at y497
        is fiction. Dashes are 7 wide on a 29px pitch (ref row y=437: 22..28, 51..57,
        80..87), not 6 on 26. A horizontal floor rule at y556 that we never drew. */}
    <rect x={0} y={405} width={95} height={255} fill={C.white} stroke={C.navyDeep} strokeWidth={3.5 * IW} />
    <line x1={0} y1={556} x2={95} y2={556} stroke={C.navyDeep} strokeWidth={3.5 * IW} />
    {[0, 1].map((r) =>
      [0, 1, 2].map((c) => (
        <rect key={`${r}${c}`} x={22 + c * 29} y={429 + r * 37} width={7} height={19} fill={C.navyDeep} />
      )),
    )}
    {/* ── right-of-tower cluster, RE-TRACED gen19 ──
        We drew ONE white building at x330..430 y350..660 with two window rows. The ref
        draws something else entirely (probed rows y=350/430/470/520/630 and cols
        x=258/285/312/340/420):
          · building A — x246..325, top rule y348, floor rules y408/436/465/490,
            two window bands split by verticals at x270 and x299, and its LEFT column
            (x249..270) GREY-filled from y352 to y488 (plus one grey cell at 273,468).
            Nothing of ours stood here — we had a bare grey slab.
          · a low block x325..428 behind it, top rule y512, floor rule y603, grey fills
            at x330..357. Its right wall (x428) is CLIPPED by the capsule at y583.
          · a grey slab x268..290, y497..656 under building A.
        Drawn BEFORE the red tower/dash-block so they occlude it, as the ref does. */}
    <rect x={246} y={348} width={79} height={312} fill={C.white} stroke={C.navyDeep} strokeWidth={3.5 * IW} />
    <rect x={249} y={352} width={21} height={136} fill="#DCDCDC" />
    <rect x={273} y={468} width={16} height={22} fill="#DCDCDC" />
    {[408, 436, 465, 490].map((y) => (
      <line key={y} x1={246} y1={y} x2={325} y2={y} stroke={C.navyDeep} strokeWidth={3 * IW} />
    ))}
    {[270, 299].map((x) => (
      <React.Fragment key={x}>
        <line x1={x} y1={408} x2={x} y2={436} stroke={C.navyDeep} strokeWidth={3 * IW} />
        <line x1={x} y1={465} x2={x} y2={490} stroke={C.navyDeep} strokeWidth={3 * IW} />
      </React.Fragment>
    ))}
    <rect x={268} y={497} width={22} height={159} fill="#DCDCDC" />
    <rect x={330} y={516} width={27} height={84} fill="#DCDCDC" />
    <rect x={330} y={608} width={27} height={48} fill="#DCDCDC" />
    <line x1={428} y1={425} x2={428} y2={583} stroke={C.navyDeep} strokeWidth={3.5 * IW} />
    <line x1={325} y1={512} x2={428} y2={512} stroke={C.navyDeep} strokeWidth={3.5 * IW} />
    <line x1={325} y1={603} x2={420} y2={603} stroke={C.navyDeep} strokeWidth={3.5 * IW} />
    {/* red temple tower — r8 re-trace from the f2550 silhouette (min/max red
        per row): body is x102-248 (w146, was 124 too narrow), crown box
        x102-250 y282-310, inner frame x124-228 y358. TWO windows: LEFT has a
        white top + RED-SOLID middle + white bottom; RIGHT has a CREAM top +
        white bottom with a low divider (r7 had them swapped/plain). Twin mast. */}
    <line x1={172} y1={266} x2={172} y2={282} stroke={C.red} strokeWidth={3.5 * IW} />
    <line x1={182} y1={266} x2={182} y2={282} stroke={C.red} strokeWidth={3.5 * IW} />
    <rect x={102} y={282} width={148} height={28} fill={C.white} stroke={C.red} strokeWidth={4 * IW} />
    <line x1={116} y1={318} x2={236} y2={318} stroke={C.red} strokeWidth={3.5 * IW} />
    <rect x={102} y={324} width={146} height={158} fill={C.white} stroke={C.red} strokeWidth={4 * IW} />
    <rect x={124} y={358} width={104} height={124} fill="none" stroke={C.red} strokeWidth={3.5 * IW} />
    {/* left window: white / red-solid / white */}
    <rect x={144} y={378} width={26} height={104} fill={C.white} stroke={C.red} strokeWidth={3.5 * IW} />
    <rect x={144} y={404} width={26} height={58} fill={C.red} />
    {/* right window: cream top, white below, low divider */}
    <rect x={181} y={378} width={26} height={104} fill={C.white} stroke={C.red} strokeWidth={3.5 * IW} />
    <rect x={181} y={381} width={26} height={46} fill="#F2C7A9" />
    <line x1={181} y1={456} x2={207} y2={456} stroke={C.red} strokeWidth={3.5 * IW} />
    {/* red dash-window block below */}
    <path d="M 85 660 L 85 500 Q 85 485 100 485 L 265 485 L 265 660" fill={C.white} stroke={C.red} strokeWidth={3.5 * IW} />
    {[0, 1, 2].map((r) =>
      [0, 1, 2, 3, 4].map((c) => (
        <rect key={`${r}${c}`} x={113 + c * 30} y={512 + r * 45} width={6} height={22} fill={C.red} />
      )),
    )}
    {/* street: shed, bollards, posts. gen18: the red CAR that stood here was
        INVENTED — the ref's street at (50..140, 615..665) carries only the red
        building's own bottom wall (probe: 246 red px, all of it the wall) and the
        blue/navy ticks. Its twin in PvpRightCity was even clearer: ZERO red pixels
        in the ref where we drew a truck. Both deleted (law: kill fiction). */}
    <rect x={148} y={628} width={52} height={32} fill="none" stroke={C.red} strokeWidth={3.5 * IW} />
    <line x1={165} y1={628} x2={165} y2={660} stroke={C.red} strokeWidth={3 * IW} />
    <line x1={182} y1={628} x2={182} y2={660} stroke={C.red} strokeWidth={3 * IW} />
    <rect x={2} y={632} width={6} height={28} fill={C.blue} />
    <rect x={228} y={632} width={6} height={28} fill={C.blue} />
    <rect x={255} y={638} width={5} height={22} fill={C.chipGrey} />
    {[0, 1, 2].map((i) => (
      <rect key={i} x={300 + i * 11} y={640} width={5} height={20} fill={C.navyDeep} />
    ))}
    {/* ground */}
    <line x1={-80} y1={660} x2={432} y2={660} stroke={C.navyDeep} strokeWidth={4 * IW} />
    </g>
    )}
  </svg>
);

// right PvP city capsule.
//
// ══ r18: THE "BLUNT VERTEX" WAS NEVER A VERTEX PROBLEM. IT WAS A STROKE PROBLEM. ══
//
// Three rounds have chased grid cell r3c5 (.595) by reading the ref's OUTER navy edge
// per row and comparing it to ours. That instrument cannot work here, and it produced a
// fiction: "the ref's point is BLUNT — it holds x1420 across a 24px flat; ours holds it
// over 8px." It does not. **The outer edge of a 4px stroke hugs its own centreline; the
// outer edge of an 8px stroke stands 2px off it.** Measure the RUN and take its MIDPOINT
// and the two capsules' apexes agree to half a pixel: ref 1422.0, ours 1421.5.
//
// The instrument that finds the real error is the same run, read for its WIDTH:
//   ref stroke h-extent @y520 / y580 / y700:  8 / 8 / 7 px      (perpendicular ~7)
//   ours                                   :  4 / 4 / 5 px      (strokeWidth 4)
// The whole outline is drawn at HALF the reference's weight — and (law 23) gen19's
// "widening city strokes LOSES" does NOT transfer here: it lost because the INTERIOR's
// line centres sit 1-4px off, so a wider stroke doubles the error band. The outline's
// centres are fitted below to <1px RMS over 50+ rows. Different mechanism, own gate.
//
// Centreline fits, ref f2600 (identical at f2450 — the capsule is a static hold):
//                       ref                          ours (old)              error
//   top edge  yc        393.0                        389.5                   3.5px HIGH
//   bottom edge yc      862.0                        854.5                   7.5px HIGH
//   upper diagonal      xc = -0.5770y + 1774.46      -0.6524y + 1814.95      SLOPE
//   lower diagonal      xc = +0.5942y + 1038.46      +0.5810y + 1041.70      6px LEFT @y700
//   sharp vertex        (1411.8, 628.4)              (1405.9, 626.9)
//   apex centre         1422.0  (y622..634)          1421.5  (y624..636)     — already right
// The ref's capsule is SYMMETRIC about y=627.5 ((393+862)/2), and its vertex sits on that
// axis. Ours was centred on 622.5. **The capsule is 5px high and 4px short**, its upper
// diagonal leans too steep, and its lower diagonal runs 6px inside the ref's.
//
// Rebuilt from those fits: corners are Q fillets with tangent length 35 (our old value —
// the ref's corner rows are stroke-merged and cannot be read), anchored on the ref's own
// sharp corners (1547.7,393) and (1550.6,862). The vertex is a Q whose control IS the
// sharp intersection, with endpoints solved so t=0.5 lands on the measured apex (1422.0,
// 628.0): it reproduces the ref's apex centre to <=1px at every probed row (y604 1426.9
// vs 1426 · y612 1424.1 vs 1424 · y648 1425.2 vs 1425).
// r18b: the lower diagonal re-fitted by run-TRACKING over y660..798 (n=70) instead of a
// fixed x-window: +0.5747, and a slope FORCED to 0.5773 fits it just as well (rms .72 vs
// .71). BOTH ref capsules run at exactly +/-0.577 = tan(30 deg). With that, the two
// diagonals meet the symmetry axis y=627.5 ((393+862)/2) at 1412.39 and 1412.32 — they
// agree to 0.07px, which is the proof the shape is a symmetric hexagon and the fits are
// right. Sharp vertex (1412.35, 627.5); the ref blunts it to 1422.0, i.e. by 9.65px.
const R_CAPSULE = "M 2000 393 L 1582.7 393 Q 1547.7 393 1530.2 423.3 L 1431.4 594.6 Q 1412.35 627.5 1431.9 661.4 L 1530.2 831.7 Q 1547.7 862 1582.7 862 L 2000 862";
// the ref's outline stroke, read directly off its HORIZONTAL edges (a horizontal run's
// height IS the stroke, with no slope correction to get wrong): top 390..396, bottom
// 859..865 — SEVEN. The diagonals agree: h-extent 8 at slope 0.577 is 8*cos(30) = 6.9.
// Gated on its own, AFTER the centreline re-fit above, precisely because gen19's
// "widening loses" refutation is scoped to strokes whose centres are off (law 23).
const R_CAP_W = 7;
const PvpRightCity: React.FC<{ k?: number; tx?: number; interior?: number }> = ({
  k = 1,
  tx = 0,
  interior = 1,
}) => (
  <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute" }}>
    {/* capsule frame (vertex on the left) */}
    {k < 1 ? (
      <g transform={`translate(${tx},0) scale(${k},1)`}>
        <path d={R_CAPSULE} fill="none" stroke={C.navyDeep} strokeWidth={R_CAP_W} vectorEffect="non-scaling-stroke" />
      </g>
    ) : (
      <path d={R_CAPSULE} fill="none" stroke={C.navyDeep} strokeWidth={R_CAP_W} />
    )}
    {interior <= 0 ? null : (
    <g {...(interior < 1 ? { opacity: interior } : {})}>
    {/* r7 re-trace from the f2550 two-color ink map (rows/cols probed at
        1px): bg building top is y512 NOT 440 with verticals HANGING BELOW
        it; the front building has 4 WIDE window boxes (not 2x4 small); the
        red tower is 162 wide with a legged base (ledges y640, dash columns
        x1657/x1829, navy-grilled door); right building has ONE dash column
        at the frame edge. */}
    {/* background building: top y512 x1489..1621, 3 verticals hanging to the front building's roof */}
    <rect x={1489} y={512} width={132} height={313} fill={C.white} stroke={C.navyDeep} strokeWidth={3.5 * IW} />
    {[1509, 1545, 1581].map((x) => (
      <line key={x} x1={x} y1={516} x2={x} y2={592} stroke={C.navyDeep} strokeWidth={3 * IW} />
    ))}
    {/* front building: top rail y592 runs to the red tower; body x1469..1567.
        gen19: the 4 windows are ⊓ — an OPEN BOTTOM. Probed col x=1520 (mid-window):
        the ref has ink ONLY at y618..624; we drew a closed rect and its bottom bar
        (row y=632 reads a solid 1491..1550 in ours against two 7px stubs in the ref).
        ~900px of invented ink across the four. Top bar centred y621, legs to y639. */}
    <rect x={1469} y={592} width={192} height={4} fill={C.navyDeep} />
    <rect x={1469} y={592} width={98} height={236} fill={C.white} stroke={C.navyDeep} strokeWidth={3.5 * IW} />
    {[621, 656, 691, 726].map((y) => (
      <path
        key={y}
        d={`M 1492 ${y + 18} L 1492 ${y} L 1548 ${y} L 1548 ${y + 18}`}
        fill="none"
        stroke={C.navyDeep}
        strokeWidth={3.5 * IW}
      />
    ))}
    {/* grey slabs. gen19: the slab at x1635 was FICTION — the ref has 105 grey px in
        (1630..1665, 500..830) against our 5,700. Deleted. The real slab is a staircase
        on the far right (grey y-runs probed every 10px: x1830/1840 → y570..639,
        x1860 → y621..803, x1870 → y621..825): two blocks, not one. */}
    <rect x={1826} y={570} width={22} height={70} fill="#DCDCDC" />
    <rect x={1856} y={621} width={22} height={205} fill="#DCDCDC" />
    {/* central red tower — mast, crown, round-shouldered shaft, 6 ticks */}
    <line x1={1693} y1={410} x2={1693} y2={428} stroke={C.red} strokeWidth={3.5 * IW} />
    <rect x={1677} y={428} width={70} height={24} fill={C.white} stroke={C.red} strokeWidth={3.5 * IW} />
    <path d="M 1663 640 L 1663 456 L 1799 456 Q 1811 456 1816 466 L 1821 478 L 1821 640" fill={C.white} stroke={C.red} strokeWidth={3.5 * IW} />
    {/* gen19: the ref draws FIVE ticks, not six (row y=495: 1693/1716/1738/1760/1782).
        The sixth at x1801 was invented. */}
    {[1696, 1719, 1741, 1763, 1785].map((x) => (
      <line key={x} x1={x} y1={476} x2={x} y2={508} stroke={C.red} strokeWidth={3 * IW} />
    ))}
    {/* inner panel: rails, cream band, gate row w/ right solid block */}
    <rect x={1681} y={516} width={128} height={112} fill="none" stroke={C.red} strokeWidth={3.5 * IW} />
    <line x1={1681} y1={550} x2={1809} y2={550} stroke={C.red} strokeWidth={3 * IW} />
    <rect x={1705} y={556} width={84} height={14} fill="#F2C7A9" />
    <line x1={1681} y1={574} x2={1809} y2={574} stroke={C.red} strokeWidth={3 * IW} />
    <line x1={1681} y1={602} x2={1809} y2={602} stroke={C.red} strokeWidth={3 * IW} />
    <rect x={1781} y={604} width={28} height={20} fill={C.red} />
    <rect x={1687} y={606} width={8} height={14} fill={C.red} />
    <rect x={1701} y={606} width={5} height={14} fill={C.red} />
    {/* legged base: ledges y640, band w/ solid center, legs + dash columns to ground */}
    <rect x={1633} y={640} width={52} height={8} fill={C.red} />
    <rect x={1805} y={640} width={52} height={8} fill={C.red} />
    <rect x={1661} y={648} width={148} height={28} fill="none" stroke={C.red} strokeWidth={3.5 * IW} />
    <rect x={1705} y={656} width={84} height={12} fill={C.red} />
    <line x1={1633} y1={648} x2={1633} y2={825} stroke={C.red} strokeWidth={3 * IW} />
    <line x1={1683} y1={676} x2={1683} y2={825} stroke={C.red} strokeWidth={3.5 * IW} />
    <line x1={1807} y1={676} x2={1807} y2={825} stroke={C.red} strokeWidth={3.5 * IW} />
    <line x1={1855} y1={648} x2={1855} y2={825} stroke={C.red} strokeWidth={3 * IW} />
    <line x1={1657} y1={656} x2={1657} y2={810} stroke={C.red} strokeWidth={3 * IW} strokeDasharray="11 10" />
    <line x1={1829} y1={656} x2={1829} y2={810} stroke={C.red} strokeWidth={3 * IW} strokeDasharray="11 10" />
    {/* door: red frame + centre mullion. gen19: the NAVY GRILL BLOCK was fiction —
        probed col x=1760, the ref is blank from y806 to y824 (we filled 28x19 of navy). */}
    <path d="M 1722 825 L 1722 802 L 1778 802 L 1778 825" fill="none" stroke={C.red} strokeWidth={3.5 * IW} />
    <line x1={1750} y1={805} x2={1750} y2={825} stroke={C.red} strokeWidth={3 * IW} />
    {/* right white building. gen19, probed by navy y-runs every 8px from x1860:
        the ref has NO LEFT WALL — x1860/1868 read only the y565 rule and the ground.
        Our 259px vertical at x1857 was fiction. What is there: a y565 rule running the
        full 1855..1920, a step up at x1876 to a y541 rule, and SEVEN dash windows that
        only appear at x>=1912 (x1908 reads clean) — we drew NINE starting at 1908. */}
    <line x1={1855} y1={565} x2={1920} y2={565} stroke={C.navyDeep} strokeWidth={3.5 * IW} />
    <line x1={1876} y1={565} x2={1876} y2={541} stroke={C.navyDeep} strokeWidth={3.5 * IW} />
    <line x1={1876} y1={541} x2={1920} y2={541} stroke={C.navyDeep} strokeWidth={3.5 * IW} />
    {[594, 618, 643, 665, 691, 715, 740].map((y) => (
      <rect key={y} x={1912} y={y} width={8} height={6} fill={C.navyDeep} />
    ))}
    {/* street: post + shed, posts. gen18: the red TRUCK here was INVENTED — the ref
        has ZERO red pixels in (1490..1600, 780..830). Deleted; see PvpLeftCity. */}
    <rect x={1589} y={804} width={5} height={21} fill={C.navyDeep} />
    <rect x={1605} y={804} width={13} height={22} fill={C.navyDeep} />
    <rect x={1710} y={800} width={5} height={25} fill={C.blue} />
    <rect x={1795} y={800} width={5} height={25} fill={C.blue} />
    {/* ground */}
    <line x1={1497} y1={825} x2={2000} y2={825} stroke={C.navyDeep} strokeWidth={4 * IW} />
    </g>
    )}
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
  // r22 EYE-FIX: the ref's "09:00" headline VANISHES fast — full @f2800, ~7% @f2805,
  // gone by f2808 — as the ref transitions into the S15 drop-lines/brackets. The old
  // scene held the headline at full opacity to the outP fade at f2837, drawing a phantom
  // headline for ~30 frames the ref does not (law 17). Fade it out on the ref's own
  // schedule; f2760/f2800 stay full (headP=1), so the size-fix gate frames are unchanged.
  const headP = interpolate(frame, [2801, 2807], [1, 0], clamp);
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
      {/* r22 EYE-FIX: the "09:00" headline rendered at HALF size (measured f2800: cap-height
          73 / width 246 vs ref's 133 / 451 — a 1.83x undersize) AND sat 75px LOW (cap-top
          586 vs ref 511). fontSize 100->183 (cap/em 0.725 -> cap 133, width 451). The block
          was ONE top-anchored flow div, so a bigger font would only push it lower — split
          into two right-aligned ABSOLUTE blocks placed on the measured ref bands (headline
          cap-top 511 -> top 482; Settlement 668 / completion 735 -> top 657, pitch 67). The
          subtitle was undersized too (width 171 vs 262): fontSize 36->55, lineHeight 1.22.
          Right edge (1920 - x9 + 36) is unchanged — the replica's right edge already sat on
          the ref's (x1133 vs 1127). */}
      <div style={{ position: "absolute", right: 1920 - x9 + 36, top: 482, textAlign: "right", fontFamily: pack.sans, fontWeight: 700, fontSize: 183, lineHeight: 1, color: C.navyInk, opacity: inP * headP }}>
        {pack.milestones.m0900.time}
      </div>
      <div style={{ position: "absolute", right: 1920 - x9 + 36, top: 657, textAlign: "right", fontFamily: pack.sans, fontSize: 55, lineHeight: 1.22, color: C.navyInk, opacity: inP * headP }}>
        {pack.milestones.m0900.label.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
};

// ─── S15: brackets + 8.0+ USD trillion (f2837..3040) ───
// gen19 — S15's EXIT was 30 frames late, and it owns the ranked f2999-3049 window.
// The ref DISINTEGRATES this scene the way it does S12's doc, then cuts. Ink below the
// band, per frame (settled = 302k): 303k @f2990 · 297k @f3000 · 256k @f3005 · 49k @f3010 ·
// 9k @f3015 · then S16 arrives (66k @f3020 -> 127k @f3025 -> settled 132k @f3030).
// We held S15 fully settled to f3040 and faded it to f3055 — so at f3010, where the ref
// has 16% of its ink left, we were drawing 100% of it. The ramp below is the measured
// ink-decay curve, not an easing.
// (The decay's FIRST frames are a spend we decline: a uniform 84%-opacity scene at f3005
// scored .0032 BELOW the untouched settled scene, because the ref's remaining 84% of ink
// is fully dark and broken, not uniformly pale. So the ramp holds at 0 until f3006 and
// then falls fast — all the gain is in f3008-3017, where the ref is nearly empty.)
const S15_OUT: Lut = [
  [3006, 0], [3008, 0.4], [3010, 0.84], [3013, 0.94], [3015, 0.97], [3017, 1],
];

export const S15Brackets: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 2837 || frame >= 3020) return null;
  const outP = lut(frame, S15_OUT);
  // gen21: the band + brackets PAN LEFT the whole scene — measured off the 07:00/09:00
  // red drop lines (measure_pan.py): hour@960 = 8.241@f2837 → 8.574@f2980, pitch a
  // CONSTANT 249 (pure pan, no zoom). The old static hourAt=8.4/pitch248 sat ~38px
  // LEFT of the ref at entry and ~45px RIGHT by f2980 — a static band CROSSING the ref,
  // and both ranked windows (f2835-2885, f2930-2980) sit where it is worst. The pan also
  // makes the f2837 handoff CONTINUOUS with S14 (whose band is at hour 8.2425 there),
  // killing the ~39px doubled-band ghost that rode the S14→S15 crossfade (f2837-2850).
  const hourAt = 8.241 + (frame - 2837) * 0.0023287;
  const PITCH = 249;
  const x7 = 960 + (7 - hourAt) * PITCH;
  const x9 = 960 + (9 - hourAt) * PITCH;
  const x12 = 960 + (12 - hourAt) * PITCH;
  // gen21: the ref draws the drop lines + both brackets in the PRE-2837 transition
  // (S14's tail: "09:00" text gone by ~f2810, the 07:00/09:00 drop lines grow DOWN
  // f2810-2818, then both brackets grow RIGHT f2818-2837). By the S15 mount (f2837)
  // they are already FULL, and stay full+static (only panning) through the scene. The
  // old grows (dropP 2845-2862, b1 2858-2888, b2 2880-2915) under-drew both big red
  // bars all the way through f2843-2915, exactly across the rank-9 window, where the
  // ref is already complete. Full from mount (tiny settle only to soften the cut).
  const dropP = interpolate(frame, [2837, 2841], [0, 1], clamp);
  const b1P = interpolate(frame, [2837, 2842], [0, 1], clamp);
  const b2P = interpolate(frame, [2838, 2843], [0, 1], clamp);
  // gen21: the "8.0+ USD trillion" figure DRAWS right→left (measure_fig.py — rule right
  // end x559@f2908, x446@f2911, x214@f2915, full x150@f2925; glyphs in by ~f2918). The
  // old figP faded the whole block in over f2930-2955 — 25f LATE: across the ENTIRE
  // rank-5 window (f2930-2980) the ref figure is fully drawn while we ramped 0→1 from
  // blank. Now a right→left clip reveal, settled by f2924 (before the window).
  const figWipe = interpolate(frame, [2906, 2924], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white, opacity: 1 - outP }}>
      <TimelineBand y={221} h={69} originX={960} originHour={hourAt} pxPerHour={PITCH} tickAbove={4} tickBelow={28} labelSize={34} />
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
      <div style={{ position: "absolute", inset: 0, clipPath: `inset(0px 0px 0px ${552 - figWipe * 446}px)` }}>
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
  // gen19: S16 arrived 23 frames late. The ref cuts to it as S15 finishes dissolving —
  // ink 66k @f3020, 127k @f3025, settled 132k from f3030. Its pan and exit are keyed on
  // absolute frames (f3100/f3150), so only the mount and the entrance move.
  if (frame < 3016 || frame >= 3215) return null;
  const inP = interpolate(frame, [3017, 3029], [0, 1], clamp);
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
        {/* r18: labelSize 28 -> 23. The ref's hour glyphs ink a 61x26 bbox (402-410 px of
            ink); ours inked 79x31 (636-660). The label's LEFT ink edge and its ink TOP
            (y130) were both already right — only the size was wrong. 14,514px/frame, the
            largest single error in this window. labelSize is a PROP here: TimelineBand is
            shared with four other scenes and its default is NOT touched. */}
        <TimelineBand y={92} originX={x07} originHour={7} pxPerHour={144.4} labelSize={23} tickBelow={18} skipHours={[7, 9, 12]} tickAbove={0} />
        <div style={{ opacity: markerP }}>
          <MarkerTriangle x={955} y={27} size={56} />
        </div>
        {milestones.map(({ h, m, below }, i) => (
          <React.Fragment key={i}>
            {/* r18 FICTION: the red ticks did NOT rise above the band. gen13 read y56 off a
                frame where the band sat elsewhere. The ref starts every milestone tick at
                the band TOP (y92) and runs it DOWN to the foot of its own label block:
                07:00 and 12:00 -> y190 (h98), 09:00 -> y207 (h115), 06:30 -> y239 (h147).
                We drew 36px of tick ABOVE the band that does not exist, and stopped 55px
                short below. Width 5 -> 4. */}
            <div
              style={{
                position: "absolute",
                left: hx(h) - 2,
                top: 92,
                width: 4,
                height: below ? 147 : h === 9 ? 115 : 98,
                background: C.marker,
              }}
            />
            <div style={{ position: "absolute", left: hx(h) + 8, top: below ? 200 : 133.5, fontFamily: pack.sans, color: C.navyInk, lineHeight: 1.25 }}>
              {/* r18 JOINT FIX (with the band's skipHours={[7,9,12]}): the ref's bold
                  milestone TIME is the hour label BOLDED — same slot, same size. Ref ink
                  y140..157 (18 rows, ~34 px/row), top row y140 == the plain 08:00 label's
                  top. gen13 drew it at fontSize 19 from block top 140: ink y145..158, 25%
                  small and 5px low, and the band's plain 23px label filled the empty slot
                  underneath — an illegible smear at 07:00/09:00/12:00 (~10,900 px/frame).
                  Deleting the smear ALONE loses (law 24: two errors cancelling). time
                  19->23 (weight 700), block top 140->133.5 so ink lands on y140 like ref;
                  descriptor label stays 14. */}
              <div style={{ fontSize: 23, fontWeight: 700 }}>{m.time}</div>
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
          {/* r18: "TRADE EXECUTED" — the arrow POINTED THE WRONG WAY. The ref draws a
              DOUBLE-HEADED arrow pointing OUTWARD (city <- -> city); ours were solid
              triangles aimed INWARD (the left one carried a rotate(180) that flipped its
              apex to the right of its own base — the same defect gen20 found on S13's top
              rail). They are OPEN SWEPT CHEVRONS in the ref, as everywhere else in this
              film. Line y393 -> 410, right end 1195 -> 1239, text 24 -> 19 (ref ink
              123x14 = 599px; ours 164x17 = 1023px), text ink at y386..399. */}
          <svg width={1920} height={1080} style={{ position: "absolute" }}>
            <line x1={710} y1={410} x2={1239} y2={410} stroke={C.skyBlue} strokeWidth={3.5} />
            <path d="M 728 397 L 710 410 L 728 423" fill="none" stroke={C.skyBlue} strokeWidth={4.5} />
            <path d="M 1221 397 L 1239 410 L 1221 423" fill="none" stroke={C.skyBlue} strokeWidth={4.5} />
            {/* r18: the bottom payment lane sat 15px HIGH and had square corners and no
                chevrons where it enters the shield. Measured: lane y829, verticals x515 /
                x1414, leg tops y495, corner radius ~20. The chevrons point INTO the shield
                (whose walls the ref puts at x773.5 / x1155): LEFT apex (772,830) with arms
                back to x755, RIGHT apex (1156,830) with arms back to x1173. */}
            <path d="M 773 829 L 535 829 Q 515 829 515 809 L 515 495" fill="none" stroke={C.navyDeep} strokeWidth={3} />
            <path d="M 515 498 l -12 20 h 24 z" fill={C.navyDeep} transform="translate(0 -20)" />
            <path d="M 1155 829 L 1394 829 Q 1414 829 1414 809 L 1414 495" fill="none" stroke={C.navyDeep} strokeWidth={3} />
            <path d="M 1414 498 l -12 20 h 24 z" fill={C.navyDeep} transform="translate(0 -20)" />
            <path d="M 755 817 L 772 830 L 755 843" fill="none" stroke={C.navyDeep} strokeWidth={4.5} />
            <path d="M 1173 817 L 1156 830 L 1173 843" fill="none" stroke={C.navyDeep} strokeWidth={4.5} />
            {/* r18: "prior to value date" is a BLUE dashed line, not a grey one — the ref's
                dash core reads rgb(6,117,179), the same family as its label text; we drew
                C.chipGrey rgb(139,157,175). y786 -> 790.5, right end 1370 -> 1352, dash
                "10 8" -> "12 9.5", 2.5 -> 2. (The measured core is darker than the palette's
                skyBlue #2E96D6; the palette colour is used rather than invent a shade — the
                hue was the error, and the exact value is left on record here.) */}
            <line x1={575} y1={790.5} x2={1352} y2={790.5} stroke={C.skyBlue} strokeWidth={2} strokeDasharray="12 9.5" />
          </svg>
          <div style={{ position: "absolute", left: 860, top: 381, width: 200, textAlign: "center", fontFamily: pack.sans, fontSize: 19, color: C.skyBlue }}>
            {pack.tradeExecuted}
          </div>
          <div style={{ position: "absolute", left: 592, top: 764, fontFamily: pack.sans, fontSize: 20, color: C.skyBlue }}>
            {pack.priorToValueDate}
          </div>
          {/* r18: the shield is 13.5px NARROW and 15px SHORT. Ref walls x773.5 / x1155
              (ours 784.5 / 1152.5), bottom-V tip (960, 894.5) (ours 879.5). Top edge y585
              was already right. width 384 -> 398, height 310 -> 327, left 777 -> 765.5. */}
          <svg width={398} height={327} viewBox="0 0 384 357" preserveAspectRatio="none" style={{ position: "absolute", left: 765.5, top: 575 }}>
            <path
              d="M 28 8 Q 8 8 8 30 L 8 250 Q 8 266 23 275 L 180 350 Q 192 356 204 350 L 361 275 Q 376 266 376 250 L 376 30 Q 376 8 356 8 Z"
              fill="#FDFDFD"
              stroke={C.navyDeep}
              strokeWidth={3}
            />
          </svg>
          {/* r18 FICTION, DELETED: a 264x152 folded-corner doc sheet sat behind the pill.
              The ref has NO sheet there at ANY frame of f3326-3388 — checked at f3330,
              f3350, f3360, f3370: the pill stands alone. What the ref actually runs through
              that space is the upper payment lane and its travelling $/EUR documents (see
              the RESIDUAL note at the foot of S17Summary). 1,350px of invented navy ink;
              2,460px of frame difference. */}
          {/* gen18: pill re-measured off the ref's solid-navy fill at f3260/3300/3340/
              3370 (identical to the pixel) — 259x117 at (834, 473), not 245x120 at
              (845, 470). The wordmark was the real error: logoScale 0.425 rendered a
              48px glyph against the ref's 40. The ref's logo-height/pill-height is
              0.342 in BOTH pills (S10 and S17), and ClsWordmark's glyph is 0.935x its
              height prop, so logoScale = 0.366 is the law for this rig — not a
              per-scene number. */}
          <ClsPillSlot x={834} y={473} w={259} h={117} p={1} PillLogo={PillLogo} logoScale={0.366} />
          {pack.summaryRows.map((row, i) => {
            const y = [618, 692, 756, 822][i];
            return (
              <div key={i} style={{ opacity: rowsP[i] }}>
                {/* r18: the panel column sits 16px LEFT and 5px LOW, and the text is 4.5%
                    small. Ref line-1 first-ink per row: (889,613) (889,687) (889,751)
                    (889,816); ours (873,618) (873,692) (873,756) (873,822). Ref icon left
                    ink 800..807 (ours 790). Text 16 -> 17 ("Payment instructions settled"
                    inks 210px in the ref against our 201). */}
                <RowIcon kind={i} x={802} y={y} />
                {/* gen13: row text fs22->16 (measured ref cap-height ~13.5px vs
                    replica's ~19px; the oversize text also overflowed the panel width) */}
                <div style={{ position: "absolute", left: 889, top: y - 9, fontFamily: pack.sans, fontSize: 17, color: C.navyInk, lineHeight: 1.3 }}>
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

// gen14: RowIcon glyphs re-traced from ref f3300 (icon column x790, 54px each).
// kind0 was a doc + EMPTY red circle; ref is a doc (folded corner) with 2 header
// lines, a red COIN ($ inside a circle), and a coral shadow-doc peeking behind.
// kinds1/3 were a single pill column; ref is a 2-COLUMN pill grid (netting) with
// the flow arrow at the empty top cell. kind2's zigzag+ellipses read as nothing;
// ref is two clasped forearms (coral left, navy right) with interlocked fingers.
const RowIcon: React.FC<{ kind: number; x: number; y: number }> = ({ kind, x, y }) => (
  <svg width={54} height={54} viewBox="0 0 44 44" style={{ position: "absolute", left: x, top: y - 12 }}>
    {kind === 0 && (
      <>
        {/* coral shadow doc behind (peeks right + bottom) */}
        <path d="M 11 41 L 11 6 L 30 6 L 38 14 L 38 41 Z" fill="none" stroke={C.red} strokeWidth={1.8} strokeLinejoin="round" />
        {/* navy doc (white page) + folded corner */}
        <path d="M 7 39 L 7 4 L 27 4 L 35 12 L 35 39 Z" fill={C.white} stroke={C.navyDeep} strokeWidth={2.2} strokeLinejoin="round" />
        <path d="M 27 4 L 27 12 L 35 12" fill="none" stroke={C.navyDeep} strokeWidth={2.2} />
        {/* two header lines top-left */}
        <rect x={11} y={9} width={10} height={1.7} fill={C.navyDeep} />
        <rect x={11} y={13} width={6.5} height={1.7} fill={C.navyDeep} />
        {/* red coin: circle + $ (drawn, not a font glyph) */}
        <circle cx={20} cy={26} r={7.3} fill="none" stroke={C.red} strokeWidth={1.8} />
        <path d="M 20 20.6 L 20 31.4" stroke={C.red} strokeWidth={1.5} strokeLinecap="round" />
        <path d="M 23 22.6 Q 23 21 20 21 Q 16.8 21 16.8 23.9 Q 16.8 26 20 26 Q 23 26 23 28.4 Q 23 31 20 31 Q 17 31 17 29.4" fill="none" stroke={C.red} strokeWidth={1.5} strokeLinecap="round" />
      </>
    )}
    {kind === 1 && (
      <>
        {/* pay-ins: left col 3 coral pills, right col 2 navy pills, arrow → top-right.
            ref pills are rounded-RECTS (rx2), sit high in the box (top pill at y0). */}
        {[0, 1, 2].map((r) => (
          <rect key={"l" + r} x={3} y={r * 11} width={16} height={7} rx={2} fill="none" stroke={C.red} strokeWidth={2} />
        ))}
        {[1, 2].map((r) => (
          <rect key={"r" + r} x={23} y={r * 11} width={16} height={7} rx={2} fill="none" stroke={C.navyDeep} strokeWidth={2} />
        ))}
        <path d="M 23 4 L 40 4 M 35 0 L 40 4 L 35 8" stroke={C.red} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      </>
    )}
    {kind === 3 && (
      <>
        {/* pay-outs: mirror — right col 3 navy pills, left col 2 coral pills, arrow ← top-left */}
        {[0, 1, 2].map((r) => (
          <rect key={"r" + r} x={23} y={r * 11} width={16} height={7} rx={2} fill="none" stroke={C.navyDeep} strokeWidth={2} />
        ))}
        {[1, 2].map((r) => (
          <rect key={"l" + r} x={3} y={r * 11} width={16} height={7} rx={2} fill="none" stroke={C.red} strokeWidth={2} />
        ))}
        <path d="M 19 4 L 2 4 M 7 0 L 2 4 L 7 8" stroke={C.navyDeep} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      </>
    )}
    {kind === 2 && <IconHandshakeMini />}
  </svg>
);

// two clasped forearms: coral hand from the left, navy hand from the right,
// fingers interlocked in the middle (ref f3300 row-2). gen14 NEGATIVE: two
// cleaner variants were tried — a diagonal-arms clasp (v2, SSIM 0.287) and a
// coral finger-scallop + navy wrap (v3, 0.286) — both scored marginally higher
// but read by eye as a "pointing arm"/"scribble", NOT a handshake. This form
// (two colour-coded arms meeting with a finger suggestion, SSIM 0.276 vs old
// 0.239) reads most like two parties clasping. 54px hand-detail is the residual.
const IconHandshakeMini: React.FC = () => (
  <g strokeLinecap="round" fill="none">
    {/* coral forearm + wrist from the left */}
    <path d="M 2 19 L 13 19 Q 19 19 23 23" stroke={C.red} strokeWidth={2.4} />
    {/* navy forearm + wrist from the right */}
    <path d="M 42 17 L 31 17 Q 25 17 21 21" stroke={C.navyDeep} strokeWidth={2.4} />
    {/* coral fingers curling over the clasp */}
    <path d="M 13.5 25 q 5 -2.5 8.5 1.5 M 12.5 29 q 5.5 -2.5 9 1.5 M 12.5 33 q 5.5 -2.5 9 1" stroke={C.red} strokeWidth={2} />
    {/* navy thumb + lower grip */}
    <path d="M 23.5 22 q 5.5 2 7.5 7.5 M 22 34 q 5.5 1.5 8.5 -1" stroke={C.navyDeep} strokeWidth={2} />
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
// exit rise into the end-card cut — the band+chips keep lifting OFF the top through
// f3564 (ref navyTop 450@3560 → 279 → 107 → 49 → gone by 3565: band bottom = 598+rise
// at the clamped 180° flip, so rise = navyTop − 598). r19: the ref does not slit-cut to
// the end card here; the whole world rises off and the logo rises up in the navy behind
// it (S19 renders that lockup rise-in).
const RISE: Lut = [[3552, -1], [3553, -3], [3554, -7], [3555, -14], [3556, -24], [3557, -37], [3558, -58], [3559, -91], [3560, -149], [3561, -319], [3562, -491], [3563, -549], [3564, -588]];

// settled chip layout, flip-frame screen rects at f3550 (x, y, colorKey)
const CHIP_LAYOUT: [number, number, "g" | "n" | "c" | "r"][] = [
  [591, 86, "g"], [592, 166, "g"], [593, 248, "g"], [588, 334, "n"], [588, 422, "n"],
  [782, 248, "c"], [784, 334, "c"], [784, 420, "c"],
  [1002, 248, "g"], [1003, 334, "g"], [1003, 420, "g"],
  [1210, 84, "c"], [1207, 164, "c"], [1208, 246, "c"], [1202, 332, "r"], [1203, 420, "r"],
];

const GAUGE_GREY = "#CFD9DD"; // annulus is a touch blue vs the band grey (probed)

export const S18Outro: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 3394 || frame >= 3565) return null;
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

// ─── S19: end card (f3556..3750) — a RISE-IN, not a hard cut ───
// The ref does NOT slit-cut to a settled lockup. It mirrors the S1 intro draw-on: the
// whole world (band + chips + navy floor + the logo planted ~400px below the band) lifts
// rigidly — band and mark measured rising at the SAME rate (f3560→3561 both −171/−176 px,
// f3561→3562 −172/−174) — the band+chips exit off the top (S18, extended to f3564), the
// navy fills the frame, and the lockup rises from the floor. Then a two-phase settle:
//   • fast rise into a PLATEAU (markTop 354, f3571..3585) while the letters wipe on L-to-R
//     (lettR 954→1496 f3561..3575) and the tagline fades in (bbox bottom 580→707 f3575..78);
//   • a second rise to the settled top (markTop 162, f3611) while the three pillar icons
//     draw on L-to-R (ref f3595 shows them just breaking as dots) and the labels fade in.
// Measured off ref ink (refs/ref35xx.png + rise.py). riseY = markTop − 162 (settled ink
// top); FLOOR = ref navyTop (= S18's own navy-floor top, so the two navies coincide);
// LOGOFRONT / ICON_* are card-space reveal fronts (S19 has scale 1, so card x == video x).
const OUTRO_FLOOR: Lut = [[3556, 576], [3558, 541], [3560, 450], [3561, 279], [3562, 107], [3563, 49], [3564, 15], [3565, 0]];
const OUTRO_RISE: Lut = [
  [3556, 928], [3558, 810], [3560, 699], [3561, 523], [3562, 349], [3563, 289],
  [3565, 232], [3568, 200], [3571, 192], [3585, 191], [3590, 176], [3593, 120],
  [3595, 74], [3598, 30], [3600, 12], [3603, 3], [3605, 1], [3611, 0],
];
const OUTRO_LOGOFRONT: Lut = [[3556, 700], [3558, 1000], [3563, 1000], [3565, 1060], [3568, 1070], [3571, 1210], [3575, 1543]];
const OUTRO_ICON_S: Lut = [[3592, 560], [3606, 821]];
const OUTRO_ICON_P: Lut = [[3594, 851], [3608, 1109]];
const OUTRO_ICON_D: Lut = [[3596, 1147], [3610, 1405]];

export const S19EndCard: React.FC<{ frame: number; pack: Pack; BrandLogo?: React.FC<{ markP: number; lettersP: number }> }> = ({
  frame,
  pack,
  BrandLogo,
}) => {
  if (frame < 3556) return null;
  const floor = lut(frame, OUTRO_FLOOR);
  const riseY = lut(frame, OUTRO_RISE);
  const logoFront = frame < 3576 ? lut(frame, OUTRO_LOGOFRONT) : undefined;
  const taglineOpacity = interpolate(frame, [3575, 3580], [0, 1], clamp);
  const labelOpacity = interpolate(frame, [3599, 3610], [0, 1], clamp);
  const iconFronts: [number, number, number] = [lut(frame, OUTRO_ICON_S), lut(frame, OUTRO_ICON_P), lut(frame, OUTRO_ICON_D)];
  const card = (
    <LogoCard
      pack={pack}
      BrandLogo={BrandLogo}
      riseY={riseY}
      logoFront={logoFront}
      taglineOpacity={taglineOpacity}
      labelOpacity={labelOpacity}
      iconFronts={iconFronts}
    />
  );
  // Until the navy floor has filled the frame, clip the card to below the rising floor so
  // S18's band+chips+white still read above it (both navies coincide at the seam).
  if (floor <= 0) return card;
  return (
    <div style={{ position: "absolute", left: 0, top: floor, right: 0, bottom: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: -floor, width: 1920, height: 1080 }}>{card}</div>
    </div>
  );
};
