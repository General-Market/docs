import React from "react";
import { AbsoluteFill } from "remotion";
import { C, CITIES, MATCH, STRIP, STRIP_ENTRY, STRIP_PILLS, SEG } from "./data";
import { ART } from "./art";
import { useBrand, useCopy } from "./brand";
import { TracedArt } from "./TracedArt";
import { interpolate } from "remotion";
import { Badge, ClsNetBox, Doc, Elbow, Hexagon, Pill, SansText, SerifLabel, clamp, lerp } from "./ui";

// r18 — the collapse is ONE measured progress curve. Tracked per frame off the
// ref video (work/clsnet/r18/fitp.py): the orange-building bboxes of BOTH cities,
// both horizon-line row spans, and the two badge discs all ride the SAME p, to
// ≤1px. It runs f1051→f1080 on a hard S-curve (p=0.5 exactly at f1065), not the
// old linear [1062,1075] — which was 10f late, 5f short, and at f1065 sat at
// p=0.23 while the ref was HALF collapsed. Every large element in the window
// (two cities, two badges, two full-width lines) was therefore misplaced across
// the whole 1052-1080 motion; lesson 4, at scene scale.
const COLLAPSE_F = [1051, 1052, 1053, 1054, 1055, 1056, 1057, 1058, 1059, 1060, 1061, 1062, 1063, 1064, 1065, 1066, 1067, 1068, 1069, 1070, 1071, 1072, 1073, 1074, 1075, 1076, 1077, 1078, 1079, 1080];
const COLLAPSE_P = [0, 0.001, 0.006, 0.009, 0.016, 0.024, 0.035, 0.050, 0.068, 0.091, 0.122, 0.162, 0.223, 0.320, 0.500, 0.679, 0.776, 0.837, 0.878, 0.910, 0.934, 0.950, 0.966, 0.976, 0.986, 0.995, 0.996, 0.997, 0.999, 1];
// settled origins of the BIG traces, solved from the ref's settled orange bbox
// (A x404-701 y190-377, B x1136-1307 y592-933) through each trace's own local
// orange box — so the scaled path lands EXACTLY on the native cityASmall /
// cityBSmall traces the scene swaps to at f1076 (the old path landed cityA 11px
// right + 12px low and cityB ~100px left, then SNAPPED at the swap).
const CITY_A_END = { x: 138.5, y: 186.7 };
const CITY_B_END = { x: 897.9, y: 578.0 };
// horizon lines — SUB-PIXEL top+thickness, coverage-fitted at an empty column
// (x1750 / x300) on the settled ref: coverage = (253−v)/(253−40) per row.
//   L1 pre  391(.50) 392-396(1.0) 397(.75)  → top 391.5  h 6.29
//   L1 post 378-381(1.0) 382(.25)           → top 378.0  h 4.27
//   L2 pre  991-996(1.0) 997(.51)           → top 991.0  h 6.54
//   L2 post 935-938(1.0) 939(.23)           → top 935.0  h 4.28
// r18 drew ONE integer height (7→5) for both lines: at every settled frame that
// painted row 382 AND row 939 solid navy where the ref has 25% coverage — 3840px
// of MISPLACED ink per frame, full-width, across the whole f913-1300 region, and
// the single largest disagreeing-pixel block in the settled frame (18% of it).
// Each line now carries its own measured pair; the collapse lerp reproduces the
// ref mid-motion for free (f1064: L1 top 387.18/h 5.64 vs ref 387.26/5.57).
const LINE1 = { top: [391.5, 378.0], h: [6.29, 4.27] };
const LINE2 = { top: [991.0, 935.0], h: [6.54, 4.28] };

// Chrome SNAPS a painted box to whole device pixels (probed: top 391.5 / height
// 6.29 rendered as a solid 392-397 band — no edge antialiasing), so the ref's
// genuinely-partial edge rows have to be painted as their own 1px divs at the
// measured coverage. Integer core solid; each boundary row at its own alpha.
const HLine: React.FC<{ top: number; h: number; opacity: number }> = ({ top, h, opacity }) => {
  if (opacity <= 0) return null;
  const bot = top + h;
  const c0 = Math.ceil(top);
  const c1 = Math.floor(bot);
  const edge = (y: number, cov: number) =>
    cov > 0.004 ? (
      <div style={{ position: "absolute", left: 0, top: y, width: 1920, height: 1, backgroundColor: C.navy, opacity: cov * opacity }} />
    ) : null;
  return (
    <>
      {edge(c0 - 1, c0 - top)}
      {c1 > c0 && (
        <div style={{ position: "absolute", left: 0, top: c0, width: 1920, height: c1 - c0, backgroundColor: C.navy, opacity }} />
      )}
      {edge(c1, bot - c1)}
    </>
  );
};
// badges do not fade in — they GROW from a point, solid from the first pixel
// (disc radius probed every frame: A from f1007, B from f1024, same 18f curve).
const BADGE_GROW_D = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const BADGE_GROW_R = [0, 2, 4, 5.8, 8, 11.8, 16.8, 24, 35, 45, 53, 58, 61, 64, 65.8, 67, 68, 68.8, 69.2];
const badgeGrow = (f: number, f0: number) =>
  interpolate(f - f0, BADGE_GROW_D, BADGE_GROW_R, clamp);

// ═══ Road furniture — the traffic on both horizon lines ═══
// The ref draws pavement ticks and a car out to x≈1860 on BOTH lines; we drew
// nothing past our city crops (cityA ends x1485, cityBSmall x1610). It is NOT
// static art that can be traced and pinned: each mark is a rigid object in its
// CITY's world, moving at a constant WORLD velocity and riding the very same
// collapse transform as the city. Proven on three independent objects —
//   tick  u=1692 @f1044, v=+3.20  → predicts screen 1830.9 @f1084 (ref 1833)
//   car   u0=1489.9,     v=−7.65  → predicts screen 1611.5 @f1084 (ref 1611.5)
//   ticks travel at HALF the L2 speed on L1, exactly the 0.667 scale ratio
// so world→screen is x = cityX(f) + s(f)·(u − cropX), with (cityX, s) already
// solved by the collapse curve above. Speeds: L2 ±3.20/−4.51, L1 +1.50/−2.33.
//
// Two disciplines here, both load-bearing:
//  1. LIFE WINDOWS. The ref's traffic RECYCLES — objects despawn mid-road. Without
//     a per-object [f0,f1] a track back-projects into frames before it existed and
//     paints 50 false marks (measured). With them: precision 92-96%.
//  2. PRECISION OVER RECALL. Only marks the tracker could place to ≤2.5px across
//     ≥85% of their life are listed; the rest of the ref's traffic stays ABSENT.
//     A 7px bar 3px off is pure misplaced ink, and misplaced ink loses to absent
//     ink (lesson 4, 4 confirmations + r16's −0.14). We ship 50%/55% of the marks
//     and 0 knowingly-wrong ones.
// Marks are CLIPPED to the open road right of the drawn city trace, so they slide
// out from behind the last building instead of popping — and can never double-draw
// over the frozen copies of themselves that the traces baked in (see below).
const T = { B: "#54A0C8", G: "#919AA6", N: "#0E243E" } as const;
type Mark = [number, number, number, number, string, number, number]; // u0@f1084, v, w, h, colour, f0, f1
const TICKS_1: Mark[] = [
  [1692.2, -2.33, 5.0, 13.0, T.N, 986, 1054],
  [1569.6, 1.5, 5.0, 12.0, T.N, 1030, 1140],
  [1437.6, 1.5, 6.0, 12.0, T.B, 1114, 1228],
  [1421.8, 1.5, 6.0, 12.0, T.N, 1126, 1239],
  [1894.3, -2.33, 6.0, 12.0, T.N, 1187, 1259],
  [1910.6, -2.33, 6.0, 12.0, T.G, 1194, 1266],
];
const TICKS_2: Mark[] = [
  [1345.7, -4.51, 7.0, 24.0, T.B, 961, 1024],
  [2215.7, 3.2, 7.0, 24.0, T.N, 965, 992],
  [1260.0, -4.51, 7.0, 24.0, T.N, 966, 1006],
  [1304.8, -4.51, 7.0, 24.0, T.B, 966, 1016],
  [2014.6, 3.2, 7.0, 24.0, T.N, 966, 1055],
  [1438.3, -4.51, 7.0, 24.0, T.G, 977, 1046],
  [1717.2, -4.51, 7.5, 24.0, T.B, 1038, 1133],
  [1755.0, -4.51, 7.5, 24.0, T.G, 1046, 1142],
  [1721.0, 3.2, 7.5, 24.0, T.G, 1050, 1150],
  [1855.8, -4.51, 7.5, 24.0, T.G, 1066, 1164],
  [2046.1, -4.51, 7.5, 24.0, T.N, 1105, 1205],
  [2068.3, -4.51, 7.5, 24.0, T.G, 1114, 1131],
  [2163.0, -4.51, 7.5, 24.0, T.B, 1133, 1148],
  [2079.8, -4.51, 7.5, 24.0, T.N, 1134, 1151],
  [2269.7, -4.51, 7.5, 24.0, T.G, 1158, 1171],
  [2245.9, -4.51, 7.5, 24.0, T.N, 1159, 1251],
  [2091.7, -4.51, 7.5, 24.0, T.N, 1161, 1176],
  [2123.6, -4.51, 6.0, 24.0, T.B, 1161, 1178],
  [2224.0, -4.51, 7.5, 24.0, T.G, 1165, 1239],
  [2318.2, -4.51, 7.5, 24.0, T.N, 1165, 1240],
  [2278.9, -4.51, 7.5, 24.0, T.G, 1177, 1190],
  [2190.6, -4.51, 7.5, 24.0, T.B, 1185, 1200],
  [2119.6, -4.51, 13.5, 24.0, T.N, 1208, 1222],
  [2163.9, -4.51, 7.5, 24.0, T.B, 1212, 1226],
  [2211.3, -4.51, 7.5, 24.0, T.G, 1223, 1239],
  [2303.5, -4.51, 7.5, 24.0, T.G, 1223, 1237],
  [2585.0, -4.51, 7.5, 24.0, T.B, 1226, 1239],
  [2317.3, -4.51, 9.0, 24.0, T.N, 1245, 1266],
  [2648.2, -4.51, 7.5, 24.0, T.G, 1273, 1287],
];
// The cars are the same icon at two sizes — traced once per line (roadCar 51×27
// from the L2 car at f1036, roadCarA 52×23 from the L1 car at f1044) and mounted
// as world objects like the ticks. Both are NEW art entries: every pre-existing
// asset in the store is byte-identical (60 assets, 0 changed, key order preserved).
type Car = { u0: number; v: number; w: number; h: number; art: string; f0: number; f1: number };
const CAR_1: Car = { u0: 1883.0, v: 4.83, w: 52, h: 23, art: "roadCarA", f0: 1003, f1: 1063 };
const CAR_2: Car = { u0: 1489.9, v: -7.65, w: 51, h: 27, art: "roadCar", f0: 1027, f1: 1110 };

const RoadFurniture: React.FC<{
  f: number; cityX: number; cropX: number; s: number; lineTop: number;
  right: number; ticks: Mark[]; car: Car; opacity: number;
}> = ({ f, cityX, cropX, s, lineTop, right, ticks, car, opacity }) => {
  if (opacity <= 0) return null;
  const at = (u: number) => cityX + s * (u - cropX);
  const bottom = lineTop - 2 * s;
  return (
    // clipped to the open road: marks emerge from behind the last building rather
    // than popping in, and never overlap the trace's own (frozen) copies of them
    <div style={{ position: "absolute", left: right, top: 0, width: Math.max(0, 1920 - right), height: 1080, overflow: "hidden", opacity }}>
      {ticks.map((t, i) => {
        const [u0, v, w, h, col, f0, f1] = t;
        if (f < f0 || f > f1) return null;
        const x = at(u0 + v * (f - 1084)) - (w * s) / 2 - right;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: bottom - h * s, width: w * s, height: h * s, backgroundColor: col }} />
        );
      })}
      {f >= car.f0 && f <= car.f1 && (
        <TracedArt
          name={car.art}
          x={at(car.u0 + car.v * (f - 1084)) - (car.w * s) / 2 - right}
          y={bottom - car.h * s}
          scale={s}
        />
      )}
    </div>
  );
};

// ═══ Scenes 9-10: two cities + currency pairs (f913-1302) ═══
export const CitiesScene: React.FC<{ frame: number }> = ({ frame }) => {
  const COPY = useCopy();
  const f = frame;
  if (f < SEG.citiesIntro[0] || f >= SEG.hexify[0] + 30) return null;
  const aOp = lerp(f, [915, 925], [0, 1]);
  const bOp = lerp(f, [950, 960], [0, 1]);
  const cp = interpolate(f, COLLAPSE_F, COLLAPSE_P, clamp);
  const at = (a: number, b: number) => a + (b - a) * cp;
  const s = at(1, CITIES.smallScale);
  // line1/line2 stay the CITY + pair-label anchors (unchanged at both ends); the
  // drawn horizon line has its own measured top/height (they are not the same y).
  const line1 = at(CITIES.line1, 380);
  const line2 = at(CITIES.line2, 938);
  const badgeA = { cx: at(409, 189), cy: at(181.5, 237.5), r: badgeGrow(f, 1007) * at(1, 45.8 / 69.2) };
  const badgeB = { cx: at(1577.5, 1669.5), cy: at(744.5, 770.5), r: badgeGrow(f, 1024) * at(1, 46 / 69.2) };
  const aX = at(CITIES.cityA.x, CITY_A_END.x);
  const aY = at(CITIES.line1 - CITIES.cityA.h + 2, CITY_A_END.y);
  const bX = at(CITIES.cityB.x, CITY_B_END.x);
  const bY = at(CITIES.line2 - CITIES.cityB.h + 2, CITY_B_END.y);
  // hexify handoff: the ref fades the horizon LINES + pill stacks + currency
  // labels out (f1290-1304) while the CITIES stay put; then HexifyScene draws
  // hexagons around the stationary cities (its opaque bg takes the frame at
  // f1302). So only the lines/pills/labels fade here — the cities hold to the
  // handoff (matching hex-cities appear at their exact positions).
  const linesOut = lerp(f, [1290, 1303], [1, 0]);

  // pair carousel: each pair CONVERGES onto its horizon line — the above-line
  // word DROPS in from the frame top (glyph-tracked y62→316 over in..in+12,
  // ease-out cubic) while the below-line word RISES from y548→381 (in+2..in+10).
  // Old pair fades IN PLACE at its settled slot; entrance is motion, not opacity
  // (ref labels are solid the instant they appear). Prior "rises ~90px" was a
  // partial mis-measure — it is a ~253px drop / ~165px rise (glyph-tracked
  // f1098-1112 & the f1135 EUR/RUB handoff; identical for every pair).
  const sched = COPY.pairSchedule;
  const easeRem = (start: number, dur: number) =>
    Math.pow(1 - lerp(f, [start, start + dur], [0, 1]), 3); // 1→0 ease-out cubic
  const activePairs = sched
    .map((p) => {
      const drop = 253 * easeRem(p.in, 12); // above-line words fall from frame top
      const rise = 165 * easeRem(p.in + 2, 10); // below-line words rise from below
      const op = f < p.in ? 0 : lerp(f, [p.out, p.out + 8], [1, 0]);
      return { ...p, drop, rise, op };
    })
    .filter((p) => p.op > 0);

  // pill stacks REBUILD with every carousel pair — full through a pair, then
  // collapse the instant the next pair enters, then re-stack outward from the
  // line (glyph-tracked: full f1134, near-empty f1136, refilled ~f1148). Tie the
  // reveal base to the active pair's in-time; the collapse falls out for free
  // when it switches. First reveal pops fully-opaque ~f1102 (no fade); the last
  // pair holds until the f1290 line/pill/label exit fade.
  const activePairIn = sched.reduce((a, p) => (p.in <= f ? p.in : a), -1);
  const pillBase = activePairIn + 2;
  const stacksOp = activePairIn >= 0 ? 1 : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: C.white }}>
      {/* horizon lines — coverage-fitted sub-pixel top/height per line (see LINE1/LINE2) */}
      <HLine top={at(LINE1.top[0], LINE1.top[1])} h={at(LINE1.h[0], LINE1.h[1])} opacity={aOp * linesOut} />
      <HLine top={at(LINE2.top[0], LINE2.top[1])} h={at(LINE2.h[0], LINE2.h[1])} opacity={bOp * linesOut} />
      {/* cities ride the collapse curve to the solved settled origins; once there
          the scaled big traces swap to cityASmall/cityBSmall traced AT final scale
          from fr_1150 (downscaling the big traces blurs the ~1.5px strokes) */}
      {f < 1076 ? (
        <>
          <div style={{ position: "absolute", left: aX, top: aY, opacity: aOp }}>
            <TracedArt name="cityA" scale={s} />
          </div>
          <div style={{ position: "absolute", left: bX, top: bY, opacity: bOp }}>
            <TracedArt name="cityB" scale={s} />
          </div>
        </>
      ) : (
        <>
          <TracedArt name="cityASmall" x={240} y={188} />
          <TracedArt name="cityBSmall" x={760} y={575} />
        </>
      )}
      {/* traffic on both lines — clipped to the road right of the drawn city trace */}
      <RoadFurniture
        f={f} cityX={aX} cropX={CITIES.cityA.x} s={s} lineTop={at(LINE1.top[0], LINE1.top[1])}
        right={f < 1076 ? aX + CITIES.cityA.w * s : 240 + ART.cityASmall.w}
        ticks={TICKS_1} car={CAR_1} opacity={aOp * linesOut}
      />
      <RoadFurniture
        f={f} cityX={bX} cropX={CITIES.cityB.x} s={s} lineTop={at(LINE2.top[0], LINE2.top[1])}
        right={f < 1076 ? bX + CITIES.cityB.w * s : 760 + ART.cityBSmall.w}
        ticks={TICKS_2} car={CAR_2} opacity={bOp * linesOut}
      />
      <Badge letter="A" cx={badgeA.cx} cy={badgeA.cy} r={badgeA.r} />
      <Badge letter="B" cx={badgeB.cx} cy={badgeB.cy} r={badgeB.r} />
      {/* pair labels converge on the lines (fr_1150: cap −64 above, +5 below);
          above-line words descend (−drop), below-line words rise (+rise) */}
      {activePairs.map((p, i) => (
        <React.Fragment key={`${p.top}${p.bottom}${i}`}>
          <SerifLabel text={p.top} x={1648} capTop={line1 - 64 - p.drop} fs={CITIES.pairFs} color={C.serifNavy} opacity={p.op * linesOut} />
          <SerifLabel text={p.bottom} x={1648} capTop={line1 + 5 + p.rise} fs={CITIES.pairFs} color={C.orangeDeep} opacity={p.op * linesOut} />
          <SerifLabel text={p.bottom} x={113} capTop={line2 - 64 - p.drop} fs={CITIES.pairFs} color={C.serifNavy} opacity={p.op * linesOut} />
          <SerifLabel text={p.top} x={113} capTop={line2 + 2 + p.rise} fs={CITIES.pairFs} color={C.orangeDeep} opacity={p.op * linesOut} />
        </React.Fragment>
      ))}
      {/* pill stacks at measured column centers (fr_1150) */}
      {stacksOp > 0 && (
        <>
          <PairStacks cols={PAIR_STACKS_R} lineY={line1} f={f} base={pillBase} opacity={stacksOp * linesOut} />
          <PairStacks cols={PAIR_STACKS_L} lineY={line2} f={f} base={pillBase} opacity={stacksOp * linesOut} />
        </>
      )}
    </AbsoluteFill>
  );
};

// r5: exact pill rects CC-scanned at fr_1150 (lines settled 380/938).
// Colors probed: light steel #8A9DB2, mid #4B6686, navy #002753, orange
// #CC441E accents (taller, hugging the line from below), tan #F0C8AF.
// Corner grammar mirrors the mosaic pills (line-side outer corner square).
const PAIR_STEEL = "#8A9DB2";
const PAIR_MID = "#4B6686";
const PAIR_ORANGE = "#CC441E";
const PAIR_TAN = "#F0C8AF";
type PairPill = [number, number, number, number, string]; // x,y,w,h,color
// listed line-first per column so the reveal grows away from the line
const PAIR_STACKS_R: PairPill[][] = [
  [
    [1194, 355, 58, 25, PAIR_STEEL], [1193, 326, 58, 25, PAIR_STEEL], [1193, 296, 58, 25, PAIR_STEEL], [1193, 267, 58, 25, PAIR_STEEL],
    [1191, 384, 61, 36, PAIR_ORANGE], [1194, 424, 58, 24, PAIR_TAN], [1194, 452, 58, 26, PAIR_TAN],
  ],
  [
    [1303, 344, 60, 36, C.navy], [1303, 315, 58, 24, PAIR_MID], [1302, 263, 60, 47, PAIR_MID], [1303, 233, 58, 25, PAIR_STEEL],
    [1302, 384, 60, 24, PAIR_TAN], [1304, 410, 58, 25, PAIR_TAN], [1304, 440, 58, 25, PAIR_TAN],
  ],
  [
    [1414, 331, 60, 45, PAIR_MID], [1414, 302, 58, 24, PAIR_STEEL], [1414, 273, 58, 24, PAIR_STEEL],
    [1415, 384, 59, 24, PAIR_TAN], [1416, 411, 59, 25, PAIR_TAN],
  ],
];
const PAIR_STACKS_L: PairPill[][] = [
  [
    [368, 910, 58, 24, PAIR_STEEL], [367, 884, 58, 24, PAIR_STEEL], [367, 854, 58, 24, PAIR_STEEL],
    [367, 942, 59, 22, PAIR_TAN], [368, 968, 59, 24, PAIR_TAN],
  ],
  [
    [478, 910, 58, 24, C.navy], [478, 882, 57, 26, C.navy], [478, 854, 57, 24, PAIR_MID], [478, 825, 57, 24, PAIR_STEEL],
    [476, 942, 61, 44, PAIR_ORANGE], [478, 990, 58, 25, PAIR_TAN], [478, 1019, 58, 25, PAIR_TAN],
  ],
  [
    [588, 888, 60, 46, C.navy], [588, 858, 58, 25, PAIR_MID], [587, 806, 60, 47, PAIR_MID], [588, 777, 58, 24, PAIR_STEEL], [588, 748, 58, 24, PAIR_STEEL],
    [588, 942, 62, 34, PAIR_ORANGE], [591, 980, 58, 25, PAIR_TAN], [591, 1009, 58, 25, PAIR_TAN],
  ],
];

const PairStacks: React.FC<{
  cols: PairPill[][];
  lineY: number;
  f: number;
  base: number;
  opacity: number;
}> = ({ cols, lineY, f, base, opacity }) => (
  <>
    {cols.map((col, si) => (
      <React.Fragment key={si}>
        {col.map(([x, y, w, h, color], i) => {
          // build outward from the line: each pill pops when the reveal front,
          // travelling ~1 row / 1.3f, reaches its distance from the line (ref:
          // nearest pill f1102, farthest ~1110). Above & below grow in parallel.
          const cy = y + h / 2;
          if (f < base + Math.round(Math.abs(cy - lineY) / 20)) return null;
          const above = cy < lineY;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: w,
                height: h,
                backgroundColor: color,
                borderRadius: above ? "2px 13px 2px 13px" : "13px 2px 13px 2px",
                opacity,
              }}
            />
          );
        })}
      </React.Fragment>
    ))}
  </>
);

// ═══ Scene 11: hexify + trade executed (f1302-1462) ═══
export const HexifyScene: React.FC<{ frame: number }> = ({ frame }) => {
  const COPY = useCopy();
  const f = frame;
  if (f < SEG.hexify[0] || f >= SEG.matching[0] + 20) return null;
  // HEXAGONS DRAW around the two STATIONARY cities, in place (measured city/hex
  // centres A 549/282, B 1255/730, hex w~479 — the ref draws the outline on
  // around the cities, which do NOT move), HOLD to f1334, then TRAVEL + shrink
  // to the trade-executed row (A 508/408, B 1425/403, w~359) by f1348. Per-frame
  // measured travel table (work/clsnet/anim/hexify). Replaces the invented fade
  // where tiny hexes rose at the wrong spot while the cities faded out.
  const drawP = lerp(f, [1306, 1320], [0, 1]);
  const TF = [1334, 1336, 1338, 1340, 1342, 1344, 1346, 1348];
  const ax = interpolate(f, TF, [549, 548, 546, 539, 518, 512, 509, 508], clamp);
  const ay = interpolate(f, TF, [282, 286, 293, 313, 376, 396, 404, 408], clamp);
  const bx = interpolate(f, TF, [1255, 1261, 1271, 1298, 1383, 1410, 1419, 1425], clamp);
  const by = interpolate(f, TF, [730, 720, 701, 649, 485, 433, 413, 403], clamp);
  const hexW = interpolate(f, TF, [479, 475, 468, 449, 389, 370, 363, 359], clamp);
  const badgeR = hexW * 0.11;
  const labelOp = lerp(f, [1380, 1392], [0, 1]);
  const boxOp = lerp(f, [1385, 1398], [0, 1]);
  const docsP = lerp(f, [1412, 1450], [0, 1]);
  const out = lerp(f, [1462, 1476], [1, 0]);
  return (
    <AbsoluteFill style={{ backgroundColor: C.white, opacity: out }}>
      {/* gen9: fillHex with the native lock city REGRESSED here (f1350 .917->.909,
          f1420 .868->.861) — during the hexify the ref city is still mid-
          compression, so the crushed-clip matches better than a filled hex.
          Kept clip mode; the fill win is steady-state only (MatchingScene). */}
      <HexCity art="cityA" cx={ax} cy={ay} w={hexW} drawP={drawP} artW={1150} artH={295} dxFrac={-0.065} />
      <HexCity art="cityB" cx={bx} cy={by} w={hexW} drawP={drawP} artW={1190} artH={545} dxFrac={0.084} dyFrac={0.061} />
      <Badge letter="A" cx={ax - hexW * 0.42} cy={ay - hexW * 0.42} r={badgeR} />
      <Badge letter="B" cx={bx + hexW * 0.42} cy={by - hexW * 0.42} r={badgeR} />
      {/* Trade executed arrow */}
      {labelOp > 0 && (
        <>
          {/* gen14: "Trade executed" callout measured EXACT video (stable across
              f1405-1450): label ink y369-408 (cap-h 39 → fs 56, calibrated off
              the fs34 render's 23px cap) centred x965 (CSS-top y356 w/ the strut
              offset); double-headed arrow at y425 spanning ONLY the gap between
              the hex inner edges x716-1221. The old label sat 60px low + half
              size (fs34 y430), and the arrow ran the FULL width x470-1480 at
              y505-512 (~85px low) — that pair drove the negative-SSIM r2c3/r2c4
              cells across the whole window. */}
          <SansText text={COPY.tradeExecuted} x={755} y={356} fs={56} color={C.serifNavy} opacity={labelOp} width={420} align="center" />
          <Elbow points={[[716, 425], [1221, 425]]} color={C.orange} opacity={labelOp} arrow="end" />
          <Elbow points={[[1221, 425], [716, 425]]} color={C.orange} opacity={labelOp} arrow="end" />
        </>
      )}
      {/* CLSNet box + docs flying in */}
      {/* r18: the ref's box here is PIXEL-IDENTICAL across f1400-1450 — x823.5
          y660.5 side 270.8, frame after frame. Transcribed, not fitted. We sat
          14px low and 1px left (the size was already right). */}
      <ClsNetBox x={824} y={661} opacity={boxOp} />
      {docsP > 0 && docsP < 1 && (
        <>
          <Doc x={lerp(docsP, [0, 1], [430, 760])} y={lerp(docsP, [0, 1], [640, 760])} opacity={1} />
          <Doc x={lerp(docsP, [0, 1], [1500, 1105])} y={lerp(docsP, [0, 1], [640, 760])} opacity={1} />
        </>
      )}
    </AbsoluteFill>
  );
};

const HexCity: React.FC<{
  art: string;
  cx: number;
  cy: number;
  w: number;
  drawP: number;
  artW: number;
  artH: number;
  dxFrac?: number;
  dyFrac?: number;
}> = ({ art, cx, cy, w, drawP, artW, artH, dxFrac = 0, dyFrac = 0 }) => {
  const h = w * 0.906;
  // The city fills the hex the way the ref does — measured: cityA orange
  // building ~62% of hex width, vertically centred (orange cy == hex cy). K
  // lands cityA orange at w295 inside the w479 draw hex (was ~0.34 fill,
  // bottom-anchored and tiny). Scales with the hex through the travel-shrink.
  // dxFrac/dyFrac (× hex width) nudge each building onto the measured ref
  // centre — the illustration is not centred in its own art canvas.
  const scale = (w * 1.67) / artW;
  const aw = artW * scale;
  const ah = artH * scale;
  return (
    <div style={{ position: "absolute", left: 0, top: 0 }}>
      <div
        style={{
          position: "absolute",
          left: cx - w / 2,
          top: cy - h / 2,
          width: w,
          height: h,
          overflow: "hidden",
          clipPath: `polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)`,
          backgroundColor: C.white,
        }}
      >
        <TracedArt name={art} x={w / 2 - aw / 2 + dxFrac * w} y={h / 2 - ah / 2 + dyFrac * w} scale={scale} />
      </div>
      <Hexagon cx={cx} cy={cy} w={w} drawP={drawP} />
    </div>
  );
};

// ═══ Scene 12: matching (f1462-1662) ═══
export const MatchingScene: React.FC<{ frame: number }> = ({ frame }) => {
  const COPY = useCopy();
  const f = frame;
  if (f < SEG.matching[0] - 14 || f >= SEG.matching[1] + 16) return null;
  const inOp = lerp(f, [1462, 1478], [0, 1]);
  const panelOp = lerp(f, [1482, 1494], [0, 1]);
  // counts
  const keys = MATCH.counts.keys as unknown as number[][];
  const fr = keys.map((k) => k[0]) as unknown as [number, number];
  const un = Math.round(interpolate(f, fr as unknown as number[], keys.map((k) => k[1]), clamp));
  const ma = Math.round(interpolate(f, fr as unknown as number[], keys.map((k) => k[2]), clamp));
  const checkOp = lerp(f, [1612, 1622], [0, 1]);
  const out = lerp(f, [1648, 1662], [1, 0]);
  return (
    <AbsoluteFill style={{ backgroundColor: C.white }}>
      <EdgeRulers f={f} />
      <div style={{ position: "absolute", inset: 0, opacity: inOp * out }}>
        {/* gen9: reuse the native-scale lock city traces (r8, 385 bbox) instead
            of clipping the 1150/1190 full-city traces at 0.184 — the ref hex is
            FILLED by the building, mine was crushed tiny at the bottom (the
            r5 downscale-loses-strokes defect, same as the pre-r8 locks hexes). */}
        {/* gen13: matching badge measured EXACT video: A (344,210) B (1442,210)
            r30 — the SmallHex default (dx-0.38/dy-0.40) sat 11px left + 6px high.
            dx-0.327/dy-0.374 lands both on the ref; r stays 0.14*w=30. */}
        <SmallHex art="lockCityA" cx={MATCH.hexA.cx} cy={MATCH.hexA.cy} w={MATCH.hexA.w} artW={385} letter="A" badge={{ dx: -0.327, dy: -0.374, r: 30 }} fillHex />
        <SmallHex art="lockCityB" cx={MATCH.hexB.cx} cy={MATCH.hexB.cy} w={MATCH.hexB.w} artW={385} letter="B" badge={{ dx: -0.327, dy: -0.374, r: 30 }} fillHex />
        {/* elbows + pill columns */}
        <Elbow points={[[MATCH.hexA.cx, 400], [MATCH.hexA.cx, 648], [652, 648]]} arrow="end" opacity={panelOp} />
        <Elbow points={[[MATCH.hexB.cx, 400], [MATCH.hexB.cx, 648], [1298, 648]]} arrow="end" opacity={panelOp} />
        <PillColumn x={612} f={f} base={1482} />
        <PillColumn x={1292} f={f} base={1556} />
        {/* panel */}
        <div
          style={{
            position: "absolute",
            left: MATCH.panel.x,
            top: MATCH.panel.y,
            width: MATCH.panel.w,
            height: MATCH.panel.h,
            backgroundColor: C.panel,
            opacity: panelOp,
          }}
        />
        <ClsNetBox x={MATCH.box.x} y={MATCH.box.y} w={MATCH.box.w} opacity={panelOp} />
        {panelOp > 0 && (
          <>
            <LegendRow y={588} swatch={C.swatchBlue} label={COPY.unmatched} value={un} />
            <LegendRow y={650} swatch={C.orangeDeep} label={COPY.matched} value={ma} />
          </>
        )}
        {/* check badge */}
        {checkOp > 0 && (
          <div
            style={{
              position: "absolute",
              left: MATCH.check.cx - MATCH.check.r,
              top: MATCH.check.cy - MATCH.check.r,
              width: MATCH.check.r * 2,
              height: MATCH.check.r * 2,
              borderRadius: MATCH.check.r,
              backgroundColor: C.orangeDeep,
              opacity: checkOp,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width={44} height={34} viewBox="0 0 44 34">
              <path d="M4,18 L16,30 L40,4" fill="none" stroke={C.white} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

const LegendRow: React.FC<{ y: number; swatch: string; label: string; value: number }> = ({
  y,
  swatch,
  label,
  value,
}) => (
  <>
    <div style={{ position: "absolute", left: 864, top: y, width: 24, height: 24, backgroundColor: swatch }} />
    <SansText text={label} x={906} y={y - 3} fs={28} color={C.navy} />
    <SansText text={String(value)} x={1050} y={y - 3} fs={28} color={C.navy} width={100} align="right" />
  </>
);

const PillColumn: React.FC<{ x: number; f: number; base: number }> = ({ x, f, base }) => {
  const cols = [C.steel, C.steelDark, C.pillNavy, C.orangeDeep, C.tan, C.tan, C.tan];
  const n = Math.max(0, Math.min(7, Math.floor((f - base) / 7)));
  return (
    <>
      {cols.slice(0, n).map((c, i) => (
        <Pill key={i} x={x - 37} y={448 + i * 44} w={75} h={34} color={c} />
      ))}
    </>
  );
};

export const SmallHex: React.FC<{
  art: string;
  cx: number;
  cy: number;
  w: number;
  artW: number;
  letter?: string;
  opacity?: number;
  badge?: { dx: number; dy: number; r: number }; // fractions of w + radius
  artScale?: number; // override: ref locks hexes CLIP a ~0.6-scale city
  // fillHex: art was traced at the hex bounding box (native artW = hex bbox
  // width) so it fills the hex 1:1 — used by the locks hexes, whose interiors
  // are re-traced native-scale (gen-8) instead of clipping a downscaled city.
  fillHex?: boolean;
}> = ({ art, cx, cy, w, artW, letter, opacity = 1, badge, artScale, fillHex }) => {
  if (opacity <= 0) return null;
  const h = w * 0.906;
  const scale = artScale ?? (w * 0.92) / artW;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, opacity }}>
      <div
        style={{
          position: "absolute",
          left: cx - w / 2,
          top: cy - h / 2,
          width: w,
          height: h,
          clipPath: `polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)`,
          backgroundColor: C.white,
        }}
      >
        {fillHex ? (
          <TracedArt name={art} scale={w / artW} style={{ position: "absolute", left: 0, top: 0 }} />
        ) : (
          <div style={{ position: "absolute", left: w / 2 - (artW * scale) / 2, bottom: h * 0.16 }}>
            <TracedArt name={art} scale={scale} style={{ position: "relative" }} />
          </div>
        )}
      </div>
      <Hexagon cx={cx} cy={cy} w={w} />
      {letter && <Badge letter={letter} cx={cx + w * (badge?.dx ?? -0.38)} cy={cy + w * (badge?.dy ?? -0.40)} r={badge?.r ?? 30} />}
    </div>
  );
};

// Edge time rulers (grey verticals + hour labels + orange hour lines).
// r8 ground-truth (orange deadline-line scan regular_0120..0152): the ruler
// glides UP and DECELERATES to rest by ~f1900 (velocity 4.8->0 px/f), not a
// constant drift. pitch 113.9px/hour; deadline lines at hours ≡1 mod4 (01,05,
// 09,13,17,21). y21 = measured screen-y of the 21:00 tick per frame. Labels
// derive from POSITION and wrap mod 24 — the old code pinned each label to a
// row index over a 14h (1540px) modulus, so every wrap jumped the sequence 14h
// (the 14:00->02:00 break, and the shared 21:00 line ~380px off in y).
const RULER_F = [1462, 1487.5, 1512.5, 1537.5, 1562.5, 1587.5, 1612.5, 1637.5, 1662.5, 1687.5, 1712.5, 1737.5, 1762.5, 1787.5, 1812.5, 1837.5, 1862.5, 1887.5, 1930];
const RULER_Y21 = [1812, 1754, 1637, 1507, 1387, 1267, 1150, 1035, 925, 821, 722, 630, 546, 471, 407, 358, 323, 308, 305];
const RULER_PITCH = 113.9;

export const EdgeRulers: React.FC<{ f: number }> = ({ f }) => {
  const { sans: SANS } = useBrand();
  const y21 = interpolate(f, RULER_F, RULER_Y21, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const kMin = Math.ceil((y21 - 1130) / RULER_PITCH);
  const kMax = Math.floor((y21 + 40) / RULER_PITCH);
  const ks = Array.from({ length: Math.max(0, kMax - kMin + 1) }, (_, i) => kMin + i);
  return (
    <>
      {/* r5: both edges carry a 36px #A8A8A8 band through the whole
          matching/locks phase (probed f1500/1700/1900) */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 36, height: 1080, backgroundColor: C.grey }} />
      <div style={{ position: "absolute", left: 1884, top: 0, width: 36, height: 1080, backgroundColor: C.grey }} />
      {[14, 1906].map((x, side) => (
        <div key={side} style={{ position: "absolute", left: x - 12, top: 0, width: 24, height: 1080, overflow: "visible" }}>
          {ks.map((k) => {
            const y = y21 - k * RULER_PITCH;
            const hour = (((21 + k) % 24) + 24) % 24;
            const isOrange = hour % 4 === 1;
            return (
              <React.Fragment key={k}>
                <div
                  style={{
                    position: "absolute",
                    left: side === 0 ? 10 : -66,
                    top: y,
                    width: 88,
                    height: isOrange ? 3 : 1.5,
                    backgroundColor: isOrange ? C.orangeDeep : C.navy,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: side === 0 ? 14 : -60,
                    // r8: label sits ~13px BELOW its tick line (ref regular_0146:
                    // "21:00" text top y424 vs its red line top y405). The old
                    // y-30 put every label above its line — a ~48px miss.
                    top: y + 13,
                    fontFamily: SANS,
                    fontSize: 22,
                    color: C.navy,
                  }}
                >
                  {`${String(hour).padStart(2, "0")}:00`}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      ))}
    </>
  );
};

// ═══ Scenes 13-14: reports up + doc locks (f1662-1930) ═══
export const LocksScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < SEG.reportsUp[0] - 10 || f >= SEG.strip[0] + 10) return null;
  const phase1 = f < 1770; // reports beside CLSNet box, arrows up to small hexes
  // r15: the ref HOLDS the hexes at phase-1 size to ~f1757, then a fast S-curve
  // settles them by ~f1780 — NOT the old linear [1752,1785] ramp, which lagged
  // 73px at f1770 (ours cx522 vs ref cx594). growP keyed per-frame off the ref
  // navy-hex bbox (meashex.py): cx 414/418/427/436/454/531/581/594/601/608/612
  // & w 215/219/226/235/249/314/356/367/374/379/383 at the frames below (≤2px
  // each). Endpoints byte-identical to the old lerp: 0 for f≤1752, 1 by f1780.
  const growP = interpolate(
    f,
    [1752, 1755, 1758, 1760, 1762, 1765, 1768, 1770, 1772, 1775, 1780],
    [0, 0.025, 0.066, 0.117, 0.203, 0.588, 0.836, 0.902, 0.94, 0.972, 1],
    clamp,
  );
  // r9 phase-1 ground truth (regular_0137-0139, f1700-1725; measure_phase1.py):
  // hexes cx413/1512 cy283 w215 — the whole triple GROWS+drops into the r8
  // locks-settled cx612/1306 w385 cy413 (=239 top-anchor + 385*0.453). r8 had
  // phase-1 pinned to the locks top-anchor (cy 343) — 60px too low, the biggest
  // ink-mass miss in the f1720-1770 window (whole layout sat ~75px low).
  const hexW = 215 + (385 - 215) * growP;
  const hexAx = 413 + (612 - 413) * growP;
  const hexBx = 1512 + (1306 - 1512) * growP;
  const hexY = 283 + (413 - 283) * growP;
  // gen14: the phase-1 hub (CLSNet box + docs + connectors) does NOT fade in
  // place — it DROPS DOWN and out as the parties take focus (measured EXACT
  // video, box-top navy blob + doc-outline bbox): box top 550(rest to f1748)→
  // 559@1752→595@1756→688@1760, gone by ~f1765; docs co-descend but slower
  // (doc-top 536→637@1760, ~0.73× the box). The old code held them at rest y
  // and cross-faded (boxOut [1756,1772]) → at f1760 the ref box sits full-navy
  // at y688 while ours was a 75%-washed slate block still at y550 (the biggest
  // bright miss in the f1760 diff). Ride each down its measured curve and fade
  // only at the END (box stays full through the drop, gone by 1766).
  const boxOut = lerp(f, [1760, 1766], [1, 0]);
  const boxDy = interpolate(f, [1748, 1752, 1756, 1760, 1764], [0, 9, 45, 138, 235], clamp);
  const docDy = interpolate(f, [1748, 1752, 1756, 1760, 1764], [0, 7, 33, 101, 172], clamp);
  const docOp = lerp(f, [1800, 1815], [0, 1]);
  // gen13: the A/B badge GROWS with the hex (measured EXACT video: r≈0.14·w —
  // phase1 w215→r29, settled w385→r54; the old fixed r36 was too big at phase1
  // and 18px too SMALL + 26px too LOW settled). Offset ratio drifts across the
  // grow (badge sits on the top-left vertex of the growing hex): dy -0.335@phase1
  // → -0.382@settled lands the disk on the ref at BOTH ends (cy 211→266).
  // r15: rides growP (not a time-lerp) so the disk tracks the vertex through the
  // fast S-curve — byte-identical at growP 0/1, faithful in between.
  const badge = { dx: -0.31, dy: -0.335 - 0.047 * growP, r: hexW * 0.14 };
  const lockClosedP = f >= 1838 ? 1 : 0;
  // no exit fade: ref keeps the locks layout intact until the strip's band
  // wipe (1909-1930) has fully covered it (measured: content static at f1914)
  return (
    <AbsoluteFill style={{ backgroundColor: C.white }}>
      <EdgeRulers f={f} />
      {phase1 && (
        <>
          {/* r9 measured (regular_0137-0139): navy box (850,550) side 219=>w224;
              up-arrow risers on each hex-cx (413/1512) from y636 into the hex
              bottom (y418). gen14: docs measured at cx414/1506 (x340/1432, not
              the old x439/1340 which sat 99px too far inboard); box+docs+
              connectors ride the measured DROP (boxDy/docDy) as they exit. */}
          <ClsNetBox x={850} y={550 + boxDy} w={224} opacity={lerp(f, [1662, 1672], [0, 1]) * boxOut} />
          <Doc x={340} y={556 + docDy} w={149} h={198} opacity={lerp(f, [1668, 1680], [0, 1]) * boxOut} />
          <Doc x={1432} y={556 + docDy} w={149} h={198} opacity={lerp(f, [1668, 1680], [0, 1]) * boxOut} />
          <Elbow points={[[489, 666 + docDy], [850, 666 + docDy]]} opacity={lerp(f, [1685, 1700], [0, 1]) * boxOut} />
          <Elbow points={[[1069, 666 + docDy], [1432, 666 + docDy]]} opacity={lerp(f, [1685, 1700], [0, 1]) * boxOut} />
          <Elbow points={[[413, 636], [413, 418]]} arrow="end" opacity={lerp(f, [1690, 1705], [0, 1]) * boxOut} />
          <Elbow points={[[1512, 636], [1512, 418]]} arrow="end" opacity={lerp(f, [1690, 1705], [0, 1]) * boxOut} />
        </>
      )}
      <SmallHex art="lockCityA" cx={hexAx} cy={hexY} w={hexW} artW={385} letter="A" badge={badge} fillHex />
      <SmallHex art="lockCityB" cx={hexBx} cy={hexY} w={hexW} artW={385} letter="B" badge={badge} fillHex />
      {/* orange rising lines under the doc+lock groups (ref x632/1313, from y872) */}
      {!phase1 && (
        <>
          <Elbow points={[[hexAx + 20, 1080], [hexAx + 20, 872]]} opacity={docOp} />
          <Elbow points={[[hexBx + 7, 1080], [hexBx + 7, 872]]} opacity={docOp} />
          <DocWithLock x={hexAx - 58} y={643} closed={lockClosedP} opacity={docOp} />
          <DocWithLock x={hexBx - 76} y={643} closed={lockClosedP} opacity={docOp} />
        </>
      )}
    </AbsoluteFill>
  );
};

const DocWithLock: React.FC<{ x: number; y: number; closed: number; opacity: number }> = ({
  x,
  y,
  closed,
  opacity,
}) => {
  if (opacity <= 0) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity }}>
      <Doc x={0} y={0} w={150} h={190} />
      <TracedArt
        name={closed >= 1 ? "lockClosed" : "lockList"}
        x={70}
        y={85}
        scale={0.38}
      />
    </div>
  );
};

// ═══ Scene 15: day/night strip (f1909-2141) ═══
// Strip scrolls left at probed 9.0 px/f (pitch 290.7, "06:00" line at x=963
// @f2000). r4: full inventory re-derived from strip-space panoramas (stitch.py,
// exit + entry state) + per-region lifecycle scans; every cluster traced from
// the strip's own frames (the r1 "row*" reuse from the rows scene had 3-6x
// too little ink). `pad` = legacy hang/stand fudge (new traces are crop-exact).
const STRIP_CLUSTERS_UP: { art: string; hour: number; w: number; pad?: number }[] = [
  { art: "stripEarlyTower", hour: 2.33, w: 244 }, // entry-phase actor; exits left by f2010
  { art: "stripBankWide", hour: 4.25, w: 453 },
  { art: "stripTowerUp", hour: 7.01, w: 362, pad: 3 },
  { art: "stripBigCity", hour: 9.99, w: 417 },
  { art: "stripTowerUp", hour: 12.84, w: 370, pad: 3 },
  { art: "rowBank", hour: 14.9, w: 440, pad: 3 },
];
const STRIP_CLUSTERS_DN: { art: string; hour: number; w: number; pad?: number }[] = [
  { art: "stripInvEarly", hour: 3.6, w: 449 },
  { art: "stripInvOffice", hour: 5.73, w: 566 },
  { art: "stripInvCity2", hour: 8.69, w: 411 },
  { art: "stripInvBrickWide", hour: 11.66, w: 425 },
  { art: "stripInvSail", hour: 14.4, w: 575, pad: -12 },
];
// entry offset vs steady scroll (see STRIP_ENTRY in data.ts)
const entryDx = (f: number) => {
  if (f >= 1978) return 0;
  const K = STRIP_ENTRY.dxKeys as unknown as number[];
  const V = STRIP_ENTRY.dxVals as unknown as number[];
  if (f <= K[0]) return V[0] + (K[0] - f) * 210;
  return interpolate(f, K, V, clamp);
};

// ═══ THE EXIT PUSH — the strip and the gantt page are ONE rigid object ══════
// r18. The strip does not "fade up while a page rides in from below". The whole
// world slides up as one piece, and the gantt page is nailed to it 1090px below
// the band's top edge. Proven twice over, on two independent tracers:
//   band top (grey, x60)  384@f2132 · 304@f2133 · 136@f2134  → pushY -118/-198/-366
//   ruler bar (white)     973@f2132 · 893@f2133 · 725@f2134  → pageY  973/ 893/ 725
// pageY − pushY = 1090 at all three, to the pixel. So ONE table drives both, and
// GanttScene reads pageY = 1090 + stripPushY(f). The old code had two invented
// clocks — a quad-in push (2127-2141) and a t^1.4 ride-in (2129-2143) — that
// disagreed by up to 470px and tore a 1920×23px WHITE SLIT open between the
// retreating band and the arriving page at f2130 (whole-frame SSIM 0.785, the
// worst frame in the file: a white stripe across a flat navy cell collapses that
// cell's SSIM to 0.009).
//
// The second half of the slit was structural: the night half was drawn
// `height: 1080 - bandBot` inside a 1080-tall wrapper, so the navy ENDED at the
// wrapper's bottom edge and rode up with it, uncovering white beneath. The ref's
// night half is semi-infinite — navy to y=1079 at EVERY frame of the exit. It is
// now drawn 2160px past the band, so no push can lift it off the frame edge.
//
// Past f2134 the band is off-screen and the ruler carries the table alone; the
// values reproduce, with no free parameters, exactly how deep the inverted
// clusters still hang into the frame (ref non-navy rows 0-179 at f2135, 0-11 at
// f2136, none at f2137 — we predict 178, 10, gone).
const PUSH_F = [2126, 2127, 2128, 2129, 2130, 2131, 2132, 2133, 2134, 2135, 2136, 2137, 2138, 2139, 2140, 2141, 2142, 2143];
const PUSH_Y = [0, -1, -8, -19, -39, -69, -117, -197, -365, -724, -892, -972, -1020, -1050, -1070, -1082, -1088, -1090];
export const stripPushY = (f: number) => interpolate(f, PUSH_F, PUSH_Y, clamp);
export const GANTT_PAGE_DY = 1090;

export const StripScene: React.FC<{ frame: number; from?: number; to?: number }> = ({
  frame,
  to = SEG.strip[1],
}) => {
  const f = frame;
  const ENTRY_START = 1909; // wipe stripes enter (LocksScene stays put beneath)
  if (f < ENTRY_START || f >= to + 2) return null;
  const px = STRIP_ENTRY.pivotX;

  // Phase A (1909-1930): white/navy fields sweep in, 76px grey leading stripes
  if (f < 1930) {
    const d = interpolate(
      f,
      STRIP_ENTRY.wipeKeys as unknown as number[],
      STRIP_ENTRY.wipeD as unknown as number[],
      clamp,
    );
    return (
      <AbsoluteFill>
        <div style={{ position: "absolute", left: 0, top: 0, width: Math.max(0, px - d - 38), height: 1080, backgroundColor: C.white }} />
        <div style={{ position: "absolute", left: px - d - 38, top: 0, width: 76, height: 1080, backgroundColor: C.grey }} />
        <div style={{ position: "absolute", left: px + d - 38, top: 0, width: 76, height: 1080, backgroundColor: C.grey }} />
        <div style={{ position: "absolute", left: px + d + 38, top: 0, width: Math.max(0, 1920 - px - d - 38), height: 1080, backgroundColor: C.navy }} />
      </AbsoluteFill>
    );
  }

  // Phase B (1930-1950): the vertical band rotates flat about (974,540)
  const rot = interpolate(
    f,
    STRIP_ENTRY.rotKeys as unknown as number[],
    STRIP_ENTRY.rotDeg as unknown as number[],
    clamp,
  );

  const pushY = stripPushY(f);
  const dx = entryDx(f);
  const hourX = (h: number) =>
    STRIP.anchorX + (h - STRIP.anchorHour) * STRIP.hourPx - (f - STRIP.anchorF) * STRIP.rate + dx;
  const stripX = (sx: number) => sx - (f - STRIP.anchorF) * STRIP.rate + dx;
  const bandBot = STRIP.bandY + STRIP.bandH;
  const hours = Array.from({ length: 13 }, (_, i) => i + 2); // ref draws h2..14 only
  const pillOp = (p: (typeof STRIP_PILLS)[number]) => {
    let op = p.in ? lerp(f, [p.in[0], p.in[1]], [0, 1]) : 1;
    if (p.out) op *= lerp(f, [p.out[0], p.out[1]], [1, 0]);
    return op;
  };

  if (f < 1950) {
    // white above / navy below / band, all rotated as one rigid plane
    return (
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: px - 2500,
            top: 540 - 2500,
            width: 5000,
            height: 5000,
            transform: `rotate(${rot}deg)`,
          }}
        >
          <div style={{ position: "absolute", left: 0, top: 0, width: 5000, height: 2500 - 38, backgroundColor: C.white }} />
          <div style={{ position: "absolute", left: 0, top: 2500 - 38, width: 5000, height: 76, backgroundColor: C.grey }} />
          <div style={{ position: "absolute", left: 0, top: 2500 + 38, width: 5000, height: 2500 - 38, backgroundColor: C.navy }} />
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${pushY}px)`, backgroundColor: C.white }}>
      {/* night half — semi-infinite. It must NOT end at the wrapper's bottom
          edge: the exit push lifts the wrapper, and a 1080-tall navy field lifts
          the frame's bottom edge with it (the r18 white slit). */}
      <div style={{ position: "absolute", left: 0, top: bandBot, width: 1920, height: 3240 - bandBot, backgroundColor: C.navy }} />
      {/* hour grid + labels */}
      {hours.map((h) => {
        const x = hourX(h);
        if (x < -80 || x > 2000) return null;
        return (
          <React.Fragment key={h}>
            <div style={{ position: "absolute", left: x, top: 210, width: 2, height: STRIP.bandY - 210, backgroundColor: C.navy, opacity: 0.8 }} />
            <div style={{ position: "absolute", left: x, top: bandBot, width: 2, height: 905 - bandBot, backgroundColor: C.white, opacity: 0.8 }} />
            <SansText text={`${String(h % 24).padStart(2, "0")}:00`} x={x + STRIP.labelDx} y={STRIP.labelTopY - 15} fs={STRIP.fs} color={C.navy} />
            <SansText text={`${String((h + 12) % 24).padStart(2, "0")}:00`} x={x + STRIP.labelDx} y={STRIP.labelBotY - 8} fs={STRIP.fs} color={C.white} />
          </React.Fragment>
        );
      })}
      {/* upright clusters (stand on band top; new traces are crop-exact to the band) */}
      {STRIP_CLUSTERS_UP.map((cl, i) => {
        const x = hourX(cl.hour);
        if (x < -700 || x > 2100) return null;
        const art = ART[cl.art];
        const scale = cl.w / art.w;
        return <TracedArt key={`u${i}`} name={cl.art} x={x - cl.w / 2} y={STRIP.bandY - art.h * scale + (cl.pad ?? 0)} scale={scale} />;
      })}
      {/* inverted clusters (hang from band bottom) */}
      {STRIP_CLUSTERS_DN.map((cl, i) => {
        const x = hourX(cl.hour);
        if (x < -700 || x > 2100) return null;
        const art = ART[cl.art];
        const scale = cl.w / art.w;
        return <TracedArt key={`d${i}`} name={cl.art} x={x - cl.w / 2} y={bandBot + (cl.pad ?? 0)} scale={scale} />;
      })}
      {/* pill groups riding the strip (lifecycles measured; see data.ts) */}
      {STRIP_PILLS.map((p, i) => {
        const x = stripX(p.x);
        if (x < -300 || x > 2000) return null;
        const op = pillOp(p);
        if (op <= 0) return null;
        const y = p.fallKeys ? interpolate(f, p.fallKeys as unknown as number[], p.fallY as unknown as number[], clamp) : p.y;
        return <Pill key={`p${i}`} x={x} y={y} w={p.w} h={p.h} color={p.c} opacity={op} />;
      })}
      {/* grey band on top of clusters */}
      <div style={{ position: "absolute", left: 0, top: STRIP.bandY, width: 1920, height: STRIP.bandH, backgroundColor: C.grey }} />
      {/* strip-fixed orange deadline lines (measured h 5.02/9.03/13.09) */}
      {[5.02, 9.03, 13.09].map((h, i) => {
        const x = hourX(h);
        if (x < -20 || x > 1960) return null;
        return <div key={i} style={{ position: "absolute", left: x, top: 210, width: 4, height: 695, backgroundColor: "#D14B2B" }} />;
      })}
      {/* triangle marker (rides the sheet in, then screen-fixed) */}
      <svg width={56} height={40} viewBox="0 0 56 40" style={{ position: "absolute", left: 932 + dx, top: 152 }}>
        <path d="M6,5 H50 L28,35 Z" fill="none" stroke={C.orange} strokeWidth={5} strokeLinejoin="round" />
      </svg>
      </div>
    </AbsoluteFill>
  );
};
