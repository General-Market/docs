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
  // hexify handoff (r23): the ref HOLDS the horizon LINES at full through ~f1301
  // (line-ink solid f1295-1300), then HexifyScene's opaque white bg takes the
  // frame at f1302 — the r18 [1290,1303] ramp had faded the line to 23% by f1300,
  // where the ref draws it solid. Holding the line full is a clean +0.19 on the
  // line crop at f1300 (0.804→0.993). So the LINES hold to f1301.
  //   BUT the PILLS do the opposite (pillsOut, below). Our pair-stack rects were
  // measured for ONE pair (fr_1150); the ref's final pair here is USD/THB, whose
  // bar arrangement differs — so our full stack is MISPLACED ink. r23 A/B: holding
  // the pills full LOSES −0.043/−0.058 on the pill crops (lesson 4, misplaced ink
  // loses to absent ink). They keep the r18 fade. The real fix is the USD/THB
  // pair + its pill arrangement in COPY.pairSchedule (data.ts) — out of this lane,
  // recorded for that owner; the pair LABEL is absent for the same reason.
  const linesOut = lerp(f, [1301, 1304], [1, 0]);
  const pillsOut = lerp(f, [1290, 1303], [1, 0]);

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
      {/* pill stacks at measured column centers (fr_1150). r23: on pillsOut (the
          r18 fade), NOT linesOut — our stack is the wrong pair's arrangement, so
          holding it full through the ref's solid USD/THB stack LOSES (see above). */}
      {stacksOp > 0 && (
        <>
          <PairStacks cols={PAIR_STACKS_R} lineY={line1} f={f} base={pillBase} opacity={stacksOp * pillsOut} />
          <PairStacks cols={PAIR_STACKS_L} lineY={line2} f={f} base={pillBase} opacity={stacksOp * pillsOut} />
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
  // r21: the hexes settled 10px too HIGH — ref hex A equator y=418 (we drew 408),
  // hex B y=413 (we drew 403), both measured on the widest-navy-row at f1430
  // (cx/w already exact: ref A cx509 w358, B cx1426 w359). Travel tail shifted
  // +10 so the settle lands on the ref; the draw/travel start (cy282) is unchanged.
  // Gate (with the dyFrac + badge fixes below): f1430 .9175->.9304, f1455
  // .9337->.9465 (+.0129 each, the settled hexify hold). Documented spend: the
  // f1462-1476 crossfade edge into matching (hexes at cy290) costs -.0017 @f1470 —
  // the fading hexify hex is now 10px lower during the blend; dwarfed by the hold.
  const ay = interpolate(f, TF, [282, 286, 293, 313, 376, 396, 414, 418], clamp);
  const bx = interpolate(f, TF, [1255, 1261, 1271, 1298, 1383, 1410, 1419, 1425], clamp);
  const by = interpolate(f, TF, [730, 720, 701, 649, 485, 433, 423, 413], clamp);
  const hexW = interpolate(f, TF, [479, 475, 468, 449, 389, 370, 363, 359], clamp);
  const badgeR = hexW * 0.13;
  const labelOp = lerp(f, [1380, 1392], [0, 1]);
  const boxOp = lerp(f, [1385, 1398], [0, 1]);
  // r24 [defect 5]: two netted-report pages slide INTO the box, one from each side,
  // absorbed BEHIND it (measured x-tracks, work/clsnet/r24/refB). docIn fades them in
  // ~f1426; the box's z-order (drawn after) eats them as they arrive.
  const docIn = lerp(f, [1423, 1429], [0, 1]);
  const docLX = interpolate(f, [1426, 1432, 1435, 1438, 1442, 1448], [560, 674, 714, 760, 815, 860], clamp);
  const docRX = interpolate(f, [1426, 1435, 1440, 1445, 1450, 1455, 1462], [1300, 1218, 1150, 1078, 1010, 940, 842], clamp);
  const out = lerp(f, [1462, 1476], [1, 0]);
  return (
    <AbsoluteFill style={{ backgroundColor: C.white, opacity: out }}>
      {/* gen9: fillHex with the native lock city REGRESSED here (f1350 .917->.909,
          f1420 .868->.861) — during the hexify the ref city is still mid-
          compression, so the crushed-clip matches better than a filled hex.
          Kept clip mode; the fill win is steady-state only (MatchingScene). */}
      {/* r21: the hex OUTLINE moved down +10 (cy fix above) but the BUILDING was
          already correct (ref bank base y468 = old base y468) — so dyFrac is
          compensated -10/w so the building stays put while the outline+badge take
          the +10. Keeps building base 468 (A) / centre 425 (B) unchanged. */}
      <HexCity art="cityA" cx={ax} cy={ay} w={hexW} drawP={drawP} artW={1150} artH={295} dxFrac={-0.065} dyFrac={-0.028} />
      <HexCity art="cityB" cx={bx} cy={by} w={hexW} drawP={drawP} artW={1190} artH={545} dxFrac={0.084} dyFrac={0.033} />
      {/* r21: BOTH badges sit on the hex's TOP-LEFT vertex — measured disc
          centres ref A (394,288) r46, B (1307,284) r47. The old B was on the
          top-RIGHT (bx + 0.42w ≈ x1580) — the ref draws it top-LEFT (x1307), a
          ~275px misplacement (matching + locks already put badge B top-left).
          Common offset dx -0.325, dy -0.36, r 0.13·w lands both on the ref. */}
      <Badge letter="A" cx={ax - hexW * 0.325} cy={ay - hexW * 0.36} r={badgeR} />
      <Badge letter="B" cx={bx - hexW * 0.325} cy={by - hexW * 0.36} r={badgeR} />
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
      {/* r24 [defect 5]: the ref draws TWO netted-report pages sliding INTO the
          CLSNet box — one from each side (A left, B right) — absorbed BEHIND the box,
          NOT two small generic icons parked beside it. Drawn BEFORE the box so the
          navy square occludes them as they arrive. Measured (work/clsnet/r24/refB):
          the RIGHT page slides left from x~1300 (f1426) to hug the box's right edge at
          f1445 (folded corner + bars out), then vanishes behind the box by ~f1456; the
          LEFT page peeks left of the box f1428-1440 and is eaten first. Both are the
          detailed folded report (Doc variant="full", w110 h152 — the ref doc measured
          ~110×154). The old code: two w90 "plain" 3-bar icons ON TOP of the box,
          entering f1412 and gone at f1450. The "full" variant costs −0.0017 SSIM at
          f1430 (ui.tsx Doc note) — an accepted EYE-round spend: it is the report the
          ref actually draws. */}
      {docIn > 0 && (
        <>
          <Doc variant="full" x={docLX} y={738} w={110} h={152} opacity={docIn} />
          <Doc variant="full" x={docRX} y={738} w={110} h={152} opacity={docIn} />
        </>
      )}
      {/* r18: the ref's box here is PIXEL-IDENTICAL across f1400-1450 — x823.5
          y660.5 side 270.8, frame after frame. Transcribed, not fitted. We sat
          14px low and 1px left (the size was already right). */}
      <ClsNetBox x={824} y={661} opacity={boxOp} />
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
  const h = w * 0.866; // r22 hex-shape: was 0.906 (slope 1.812) → 0.866 (ref 1.731)
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
  // r19: THE EXIT IS TWO DIFFERENT MOTIONS, and the old 14-frame opacity ramp
  // from f1648 was neither. The pill columns CONVERGE on the line and are eaten
  // by it (measured; see PillColumn) — they hold full colour to the f1656 cut and
  // leave through geometry. The panel/box/legend/check leave a different way: the
  // check disc SHRINKS away (r44 -> 36 @f1646 -> 28 -> 14 -> gone @f1649) and the
  // whole card TRANSLATES down-right (panel top-left 771,399 @f1646 -> 791,463
  // @f1654 -> 820,525 @f1656, the box widening with it). That translation is NOT
  // modelled here — so the card leaves as ABSENT ink, not misplaced ink: holding
  // it at full through the ref's move costs f1654 .904 -> .887 (lesson 4, seventh
  // confirmation). Ramp it from the frame the ref starts moving it.
  // r24 [defect 4]: the ref's orange check GROWS from a point at f1578-1579 (the
  // frame the count settles to 0/298) and is full by f1586 — measured. The old
  // [1612,1622] fired ~33f LATE, only as the ref had already begun collapsing the
  // card away. It sits inside the cardOut wrapper, so it still leaves with the card.
  const checkOp = lerp(f, [1579, 1586], [0, 1]);
  // r24 [defect 4]: on completion the card FLASHES pink, then relaxes back to grey.
  // Measured g-channel at p{1000,720}: 225(grey) → 180(salmon peak, f1586) → 225 by
  // f1618. A transient pulse synced to the match completing, NOT a held tint — the
  // old card stayed flat grey #E1E1E1 through the whole celebration. Peak #E1B4A9.
  const pinkT = interpolate(f, [1580, 1583, 1586, 1590, 1595, 1600, 1610, 1618], [0, 0.49, 1, 0.96, 0.78, 0.6, 0.13, 0], clamp);
  const panelColor = pinkT > 0 ? `rgb(225, ${Math.round(225 - 45 * pinkT)}, ${Math.round(225 - 56 * pinkT)})` : MATCH_PANEL;
  // r21: the old [1646,1653] fade left the card at 43% by f1650 — but the ref
  // holds it FULL and settled until ~f1648 (navy logo square top-left tracked at
  // (773,351)@1648, still there at f1652), then COLLAPSES down-right f1650-1664
  // (grey panel retracts, legend fades, box slides down-right, gone by f1664).
  // The dominant win is f1646-1650 (ref FULL, we were fading to 43%). Past f1650
  // the card TRANSLATES away, so a held full-opacity card is MISplaced ink — a
  // slower fade tested +.0008@1650 but -.005@1652 (holding the settled card
  // through the ref's collapse loses, lesson 4). So hold full to f1650, then
  // REJOIN the old [1646,1653] curve at f1651/1652 (0.286/0.143) — new >= old at
  // EVERY frame, strict gains at f1647-1650, provably no regression at the tail.
  const cardOut = interpolate(f, [1650, 1651, 1653], [1, 0.286, 0], clamp);
  const pillOut = f < 1656 ? 1 : 0;
  // r19: MatchingScene mounts at f1448 but its content does not start until
  // f1462 — and its root AbsoluteFill was OPAQUE WHITE, so for 14 frames it
  // painted over a still-live HexifyScene (the ref is showing the hexes, the
  // "Trade executed" callout and the box at f1450). The r16 series steps from
  // .935 to .897 at exactly f1450, the mount. The composition root is already
  // white; the fill is only needed once Hexify has faded itself out (f1476).
  return (
    <AbsoluteFill style={{ backgroundColor: f < 1476 ? undefined : C.white }}>
      <EdgeRulers f={f} />
      <div style={{ position: "absolute", inset: 0, opacity: inOp * cardOut }}>
        {/* gen9: reuse the native-scale lock city traces (r8, 385 bbox) instead
            of clipping the 1150/1190 full-city traces at 0.184 — the ref hex is
            FILLED by the building, mine was crushed tiny at the bottom (the
            r5 downscale-loses-strokes defect, same as the pre-r8 locks hexes). */}
        {/* gen13: matching badge measured EXACT video: A (344,210) B (1442,210)
            r30 — the SmallHex default (dx-0.38/dy-0.40) sat 11px left + 6px high.
            dx-0.327/dy-0.374 lands both on the ref; r stays 0.14*w=30. */}
        <SmallHex art="lockCityA" cx={MATCH.hexA.cx} cy={MATCH.hexA.cy} w={MATCH.hexA.w} artW={385} letter="A" badge={{ dx: -0.327, dy: -0.374, r: 30 }} fillHex fillDyFrac={0} />
        <SmallHex art="lockCityB" cx={MATCH.hexB.cx} cy={MATCH.hexB.cy} w={MATCH.hexB.w} artW={385} letter="B" badge={{ dx: -0.327, dy: -0.374, r: 30 }} fillHex fillDyFrac={0} />
        {/* elbows — the SAME path the locks scene uses: shafts at x412.5 / 1519.5
            (we had the right one on the hex centre, 6.5px in), horizontal at
            y661 (we drew 648), arrow tips x653 / x1296. */}
        <Elbow points={[[412.5, 400], [412.5, 661], [653, 661]]} arrow="end" opacity={panelOp} />
        <Elbow points={[[1519.5, 400], [1519.5, 661], [1296, 661]]} arrow="end" opacity={panelOp} />
        {/* panel — ref x769-1180 y419-750 (we drew x776 w405), shade E1E1E1 not
            E8E8E8: 7 levels too light over 412x332 = 137k px of flat grey. */}
        <div
          style={{
            position: "absolute",
            left: 769,
            top: 419,
            width: 412,
            height: 332,
            backgroundColor: panelColor,
            opacity: panelOp,
          }}
        />
        <ClsNetBox x={MATCH.box.x} y={MATCH.box.y} w={MATCH.box.w} opacity={panelOp} />
        {panelOp > 0 && (
          <>
            <LegendRow y={586} swatch={C.swatchBlue} label={COPY.unmatched} value={un} />
            <LegendRow y={646} swatch={C.orangeDeep} label={COPY.matched} value={ma} />
          </>
        )}
        {/* check badge — ref disc cx1181.5 cy418 r44 (we drew cx1191.5 cy427.5 r41.5) */}
        {checkOp > 0 && (
          <div
            style={{
              position: "absolute",
              left: 1181.5 - 44,
              top: 418 - 44,
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: C.orangeDeep,
              opacity: checkOp,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width={46} height={36} viewBox="0 0 44 34">
              <path d="M4,18 L16,30 L40,4" fill="none" stroke={C.white} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>
      {/* the pills leave through geometry, not opacity — after the elbow so they
          sit on top of it, exactly as the ref stacks them */}
      <div style={{ position: "absolute", inset: 0, opacity: inOp * pillOut }}>
        <PillColumn col={MATCH_PILLS_L} x={545} f={f} lineY={661} />
        <PillColumn col={MATCH_PILLS_R} x={1325} f={f} lineY={661} />
      </div>
    </AbsoluteFill>
  );
};

// Measured at f1625 (settled): swatch 26px at x822, rows at y586/646 (pitch 60,
// not 62). Label ink starts x871 — we drew it at 908, 37px right. The VALUE is
// LEFT-ALIGNED at x1094 ("0" reads x1094-1107 and "298" reads x1094-1140, both
// starting on the same column) — we right-aligned it at x1148. fs 29 (ref
// "Unmatched" ink is 149px wide against our 142 at fs 28, "Matched" 111 vs 107).
const LegendRow: React.FC<{ y: number; swatch: string; label: string; value: number }> = ({
  y,
  swatch,
  label,
  value,
}) => (
  <>
    <div style={{ position: "absolute", left: 822, top: y, width: 26, height: 26, backgroundColor: swatch }} />
    <SansText text={label} x={869} y={y - 4} fs={29} color={C.navy} />
    <SansText text={String(value)} x={1092} y={y - 4} fs={29} color={C.navy} />
  </>
);

// ═══ The matching pill columns ══════════════════════════════════════════════
// r19. We drew seven identical 75x34 pills on a 44px pitch, in a 298px stack,
// entering one every 7 frames at their final position. NONE of that is in the
// ref. The ref's left column is EIGHT pills of two heights (31 and 61) on an
// irregular pitch spanning 445px; the right is SIX. Both columns are 78px wide,
// and both are in the wrong place (left 545 not 575; right 1325 not 1255 — 70px
// out, the width of the pills themselves).
//
// The corner grammar is the pair-stack grammar, mirrored about the line: an
// above-line pill has its LINE-SIDE outer corner square (probed on the navy pill
// at f1625 — top-left square at x546 from row one, top-right rounded r~12 over
// rows 582-590, bottom-left rounded, bottom-right square).
//
// The entry is the r18 flows law, again: each pill FLIES IN along the column and
// DECELERATES onto its slot — offsets from the settled top, in frames after the
// pill's own spawn, are [190, 104, 52, 20, 4, 0], the same six-frame curve for
// every pill in both columns and both directions (blob-tracked; the model
// reproduces every measured bbox to <=2px, including the ones clipped off-frame).
// Pills above the line fall DOWN into place, pills below RISE. Spawn is one
// frame apart, INNERMOST FIRST — the pill nearest the line lands first. They
// never fade: the fill is full colour on the first frame they exist.
const P_STEEL = "#8A9DB2";
const P_MID = "#4B6686";
const P_NAVY = "#002753";
const P_ORANGE = "#CC441E";
const P_TAN = "#F0C8AF";
const MATCH_PANEL = "#E1E1E1";
type MPill = [number, number, string, number]; // top, height, colour, spawn frame
const MATCH_PILLS_L: MPill[] = [
  [438, 31, P_STEEL, 1508],
  [476, 61, P_MID, 1507],
  [544, 31, P_MID, 1506],
  [582, 61, P_NAVY, 1505],
  [678, 61, P_ORANGE, 1512],
  [747, 31, P_TAN, 1513],
  [786, 60, P_TAN, 1514],
  [852, 31, P_TAN, 1515],
];
const MATCH_PILLS_R: MPill[] = [
  [506, 31, P_STEEL, 1542],
  [544, 31, P_STEEL, 1541],
  [582, 61, P_MID, 1540],
  [678, 61, P_ORANGE, 1544],
  [747, 31, P_TAN, 1545],
  [785, 31, P_TAN, 1546],
];
const FLY_K = [0, 1, 2, 3, 4, 5, 6];
const FLY_D = [190, 190, 104, 52, 20, 4, 0];

// And they leave the way they came, inverted: from f1647 the whole column
// CONVERGES on the line and the line EATS it. Blob-tracked on the left column —
// every pill's offset from its settled top, above and below alike, is the same
// accelerating table, and each pill vanishes as it crosses the line (the navy
// pill's bottom stays clamped at 653 from f1652 while its top keeps falling).
// So the columns are clipped to their own side of the line: the clip changes
// NOTHING while they are settled (the innermost pills stop at 643 and 678) and
// reproduces the swallow for free. The old code fanned the whole scene out on a
// 14-frame opacity ramp instead; holding a settled column through the ref's
// convergence LOSES (f1654 .904 -> .887 when tried) — misplaced ink again.
const EXIT_F = [1647, 1648, 1649, 1650, 1651, 1652, 1653, 1654, 1655, 1656];
const EXIT_D = [0, 3, 6, 10, 15.5, 23.5, 35.5, 55, 91, 163];
const LINE_TOP = 654; // above-line pills are eaten here
const LINE_BOT = 660; // below-line pills are eaten here (probed at x560, clear
//                       of the arrow: the ref clamps their top edge to exactly
//                       660 from f1652, and the above-line pills to 653)

const PillColumn: React.FC<{ col: MPill[]; x: number; f: number; lineY: number }> = ({
  col,
  x,
  f,
  lineY,
}) => {
  const e = interpolate(f, EXIT_F, EXIT_D, clamp);
  const draw = (above: boolean) =>
    col
      .map((p, i) => [p, i] as const)
      .filter(([[top, h]]) => top + h / 2 < lineY === above)
      .map(([[top, h, color, f0], i]) => {
        if (f < f0) return null;
        const d = interpolate(f - f0, FLY_K, FLY_D, clamp);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: top + (above ? e - d : d - e),
              width: 78,
              height: h,
              backgroundColor: color,
              borderRadius: above ? "0 12px 0 12px" : "12px 0 12px 0",
            }}
          />
        );
      });
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: LINE_TOP, overflow: "hidden" }}>
        {draw(true)}
      </div>
      <div style={{ position: "absolute", left: 0, top: LINE_BOT, width: 1920, height: 1080 - LINE_BOT, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: -LINE_BOT, width: 1920, height: 1080 }}>{draw(false)}</div>
      </div>
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
  // r22: vertical seat of the fillHex trace as a fraction of w. Default -0.02
  // HOLDS the gen8-fit trace at its old absolute seat while the box shrank
  // 0.906→0.866 (locks: the temple was already ref-true, holding it gained).
  // Matching's OLD temple sat ~3px HIGH, so it passes 0 and rides down into the
  // corrected hex (+0.141 hex-crop) — the ref seats these two cities differently.
  fillDyFrac?: number;
}> = ({ art, cx, cy, w, artW, letter, opacity = 1, badge, artScale, fillHex, fillDyFrac = -0.02 }) => {
  if (opacity <= 0) return null;
  const h = w * 0.866; // r22 hex-shape: was 0.906 (slope 1.812) → 0.866 (ref 1.731)
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
          // r22: fillDyFrac seats the TOP-anchored trace (see prop comment).
          <TracedArt name={art} scale={w / artW} style={{ position: "absolute", left: 0, top: w * fillDyFrac }} />
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

// ═══ Edge time rulers — TWO CLOCKS, RUNNING IN OPPOSITE DIRECTIONS ═══════════
// r19. Every round since r5 has drawn ONE ruler and mirrored it to the other
// edge. The ref does not do that. It runs two independent clocks that CONVERGE:
//   left  hour-at-top   12 → 10 → 07 → 04 → 03 → 01 → 23   (glides UP)
//   right hour-at-top   08 → 11 → 15 → 18 → 20 → 22 → 23   (glides DOWN)
// at f1490/1550/1625/1700/1735/1800/1900. They meet at f1896 and come to rest
// together (y21 = 308 on BOTH sides) — the two banks' clocks arriving at the
// same time is the whole point of the scene, and we were drawing bank A's clock
// twice. Every tick and every label on the right edge was in the wrong place for
// all 470 frames of matching + locks.
//
// y21 = screen y of the 21:00 tick CENTRE. Solved per frame off the ref's orange
// deadline lines (hours ≡ 1 mod 4, unambiguous): phase = circular mean of
// (tick_y mod 4·pitch), unwrapped by continuity from the f1896 rest anchor, and
// the branch fixed by the ref's own labels (predicting the top label to the hour
// at every sampled frame). The right ruler's y21 runs NEGATIVE early — it is
// simply the same lattice, far below.
//
// The old LEFT table was also 13-35px HIGH across the whole span (it was fitted
// from a coarser scan): measured 1766.8 at f1490 vs 1742 drawn, 1123 vs 1092 at
// f1625, 659 vs 639 at f1735. Re-measured on the same instrument here.
// Solved per frame by LEAST SQUARES over EVERY detected tick (thin hour bars and
// thick deadline bars alike), not from the orange lines alone: a 7px-thick bar's
// coverage centroid is biased against a 2.5px one, and fitting only those gave a
// pitch of 113.9 and a phase 5px high. All-tick LS returns pitch 113.558 across
// 54 frame-sides. Hours anchored per frame by the ref's own labels (the model
// then predicts the top label to the hour at every sampled frame), unwrapped by
// continuity. The two series rest at 312.5 and 3037.9 — a difference of exactly
// 24·113.558, i.e. the SAME clock at the SAME phase. The convergence is exact.
const RULER_F = [1481, 1484, 1491, 1498, 1505, 1512, 1519, 1526, 1533, 1540, 1547, 1554, 1561, 1568, 1575, 1582, 1589, 1596, 1603, 1610, 1617, 1624, 1631, 1638, 1645, 1652, 1659, 1666, 1673, 1680, 1687, 1694, 1701, 1708, 1715, 1722, 1729, 1736, 1743, 1750, 1757, 1764, 1771, 1778, 1785, 1792, 1799, 1806, 1813, 1820, 1827, 1834, 1841, 1848, 1855, 1862, 1869, 1876, 1883, 1890, 1897, 1930];
const RULER_YL = [1801.0, 1788.1, 1758.1, 1727.1, 1693.3, 1660.3, 1627.1, 1594.1, 1560.7, 1528.2, 1494.2, 1459.8, 1426.3, 1392.9, 1359.8, 1324.7, 1290.2, 1257.2, 1226.0, 1192.4, 1160.3, 1128.3, 1096.3, 1065.4, 1033.4, 1001.5, 970.8, 940.3, 910.3, 878.9, 849.1, 821.0, 792.4, 765.1, 737.6, 710.5, 684.0, 657.9, 632.9, 609.0, 585.5, 561.2, 538.5, 517.2, 496.5, 476.5, 458.1, 441.4, 423.9, 407.4, 392.3, 377.7, 364.8, 353.3, 342.4, 334.1, 326.1, 320.1, 316.1, 313.1, 312.5, 312.5];
const RULER_YR = [1284.8, 1300.2, 1336.2, 1374.4, 1411.9, 1450.8, 1490.2, 1529.2, 1568.2, 1608.1, 1647.6, 1687.8, 1729.5, 1769.6, 1809.1, 1850.0, 1888.7, 1928.7, 1962.7, 2001.5, 2040.0, 2076.7, 2114.8, 2152.8, 2188.3, 2224.3, 2260.8, 2295.3, 2329.3, 2363.8, 2399.8, 2434.2, 2466.7, 2500.2, 2532.2, 2564.2, 2595.2, 2624.5, 2654.5, 2682.8, 2711.3, 2736.7, 2762.7, 2789.9, 2814.3, 2839.3, 2862.3, 2883.8, 2906.1, 2925.1, 2943.1, 2960.5, 2976.0, 2990.0, 3002.5, 3013.5, 3021.5, 3028.5, 3033.9, 3037.0, 3037.9, 3037.9];
const RULER_PITCH = 113.558;

// The rulers do NOT exist before f1481 — no band, no tick, no label (probed: the
// edge columns read pure white 253 at f1478/1479/1480, grey 168 from f1483). We
// were painting two full-height 36px grey bands + 18 ticks + 18 labels from the
// MatchingScene mount at f1448: ~78,000px of grey the ref has nowhere, for 33
// frames. The bands GROW IN from their own frame edge over ~6 frames.
const RULER_IN = 1481;
const BAND_F = [1481, 1482, 1483, 1484, 1485, 1486, 1487];
const BAND_WL = [10, 20, 27, 32, 34, 36, 36];
const BAND_WR = [6, 16, 23, 27, 30, 31, 32];
// measured at f1625 (settled): band L x0-35 (w36) · band R x1888-1919 (w32).
// hour ticks abut the band and run INWARD — L x36-105, R x1823-1887 — they are
// NOT the 88px bars we drew from x12 (which started INSIDE the band and ended
// short). The orange deadline lines are more than twice as long and start at the
// FRAME EDGE, crossing the band: L x0-199, R x1724-1919, 7px thick vs the hour
// tick's 2.5px. Label ink: x42-99 left, 17px digit height (fs 24, not 22), its
// top 11px below the tick centre — and clear of the band, not printed over it.
const BAND_L_W = 36;
const BAND_R_W = 32;

export const EdgeRulers: React.FC<{ f: number }> = ({ f }) => {
  const { sans: SANS } = useBrand();
  if (f < RULER_IN) return null;
  const bandWL = interpolate(f, BAND_F, BAND_WL, clamp);
  const bandWR = interpolate(f, BAND_F, BAND_WR, clamp);
  const y21s = [
    interpolate(f, RULER_F, RULER_YL, clamp),
    interpolate(f, RULER_F, RULER_YR, clamp),
  ];
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, width: bandWL, height: 1080, backgroundColor: C.grey }} />
      <div style={{ position: "absolute", left: 1920 - bandWR, top: 0, width: bandWR, height: 1080, backgroundColor: C.grey }} />
      {y21s.map((y21, side) => {
        const kMin = Math.ceil((y21 - 1130) / RULER_PITCH);
        const kMax = Math.floor((y21 + 40) / RULER_PITCH);
        const ks = Array.from({ length: Math.max(0, kMax - kMin + 1) }, (_, i) => kMin + i);
        return (
          <React.Fragment key={side}>
            {ks.map((k) => {
              const y = y21 - k * RULER_PITCH;
              const hour = (((21 + k) % 24) + 24) % 24;
              const isOrange = hour % 4 === 1;
              const tickW = isOrange ? (side === 0 ? 200 : 196) : side === 0 ? 70 : 65;
              const tickX = isOrange
                ? side === 0
                  ? 0
                  : 1920 - 196
                : side === 0
                  ? BAND_L_W
                  : 1920 - BAND_R_W - 65;
              return (
                <React.Fragment key={k}>
                  <div
                    style={{
                      position: "absolute",
                      left: tickX,
                      top: y - (isOrange ? 3.5 : 1.25),
                      width: tickW,
                      height: isOrange ? 7 : 2.5,
                      backgroundColor: isOrange ? C.orangeDeep : C.navy,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: side === 0 ? 42 : 1821,
                      top: y + 11 - 5.5, // ink top = tick centre + 11; strut ≈ 5.5 at fs 24
                      fontFamily: SANS,
                      fontSize: 24,
                      color: C.navy,
                    }}
                  >
                    {`${String(hour).padStart(2, "0")}:00`}
                  </div>
                </React.Fragment>
              );
            })}
          </React.Fragment>
        );
      })}
    </>
  );
};

// ═══ The hub: a fixed elbow pair, and two documents that slide across it ═════
// Per-frame tables, tracked off the ref's navy doc outline (r19). DOC_* is the
// document's own bbox — grown from a point at the box, slid out, then dropped.
const DOC_F = [1696, 1699, 1700, 1701, 1702, 1703, 1704, 1705, 1706, 1707, 1708, 1709, 1710, 1711, 1712, 1713, 1714, 1715, 1716, 1717, 1718, 1719, 1720, 1721, 1722, 1723, 1724, 1725, 1726, 1727, 1728, 1729, 1730, 1731, 1732, 1733, 1734, 1735, 1736, 1737, 1738, 1739, 1740, 1741, 1742, 1743, 1744, 1745, 1746, 1747, 1748, 1749, 1750, 1751, 1752, 1753, 1754, 1755, 1756, 1757, 1758, 1759, 1760, 1761, 1762];
const DOC_LX = [748, 720, 709, 698, 688, 682, 676, 671, 666, 662, 659, 655, 651, 647, 643, 639, 635, 630, 625, 619, 612, 605, 597, 588, 578, 567, 554, 540, 524, 507, 489, 471, 454, 438, 424, 412, 400, 390, 382, 374, 366, 360, 355, 350, 346, 344, 342, 340, 339, 338, 337, 337, 337, 336, 336, 336, 336, 336, 336, 337, 338, 339, 341, 345, 347];
const DOC_LY = [653, 618, 605, 591, 581, 574, 569, 566, 563, 561, 559, 558, 557, 556, 556, 555, 555, 555, 555, 555, 555, 555, 555, 555, 555, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 555, 555, 555, 555, 554, 553, 551, 549, 546, 542, 539, 536, 532, 530, 527, 525, 524, 525, 527, 531, 537, 545, 556, 569, 586, 608, 637, 674, 731];
const DOC_RX = [1172, 1145, 1136, 1128, 1121, 1118, 1116, 1115, 1115, 1116, 1117, 1119, 1121, 1124, 1128, 1132, 1136, 1141, 1147, 1153, 1159, 1166, 1175, 1184, 1194, 1206, 1220, 1234, 1250, 1268, 1287, 1305, 1323, 1340, 1354, 1368, 1379, 1390, 1399, 1407, 1414, 1420, 1425, 1429, 1432, 1434, 1436, 1437, 1438, 1439, 1439, 1440, 1440, 1440, 1440, 1441, 1441, 1441, 1441, 1440, 1439, 1438, 1434, 1432, 1427];
const DOC_RY = [653, 618, 605, 591, 581, 574, 569, 566, 563, 561, 560, 558, 557, 556, 556, 555, 555, 555, 555, 555, 555, 555, 555, 555, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 555, 555, 554, 553, 550, 546, 542, 538, 534, 530, 528, 524, 520, 518, 516, 514, 516, 518, 522, 528, 536, 547, 560, 578, 599, 628, 664, 722];
// size is a pure grow — constant 151x199 from f1713 on
const GROW_F = [1696, 1699, 1700, 1701, 1702, 1703, 1704, 1705, 1706, 1707, 1708, 1709, 1710, 1711, 1712, 1713];
const GROW_W = [5, 56, 76, 95, 111, 121, 129, 135, 140, 142, 145, 147, 149, 150, 151, 151];
const GROW_H = [5, 73, 99, 127, 147, 161, 171, 177, 183, 188, 191, 194, 196, 197, 198, 199];

const HubElbow: React.FC<{ dy: number; opacity: number }> = ({ dy, opacity }) => {
  if (opacity <= 0) return null;
  return (
    <svg
      width={1920}
      height={1080}
      viewBox="0 0 1920 1080"
      style={{ position: "absolute", left: 0, top: dy, opacity, pointerEvents: "none" }}
    >
      <path d="M412.5,415 V636 Q412.5,661 437.5,661 H777" fill="none" stroke={C.orange} strokeWidth={3} />
      <path d="M398.5,435 L412.5,415 L426.5,435" fill="none" stroke={C.orange} strokeWidth={3} strokeLinejoin="round" />
      <path d="M1519.5,414 V636 Q1519.5,661 1494.5,661 H1158" fill="none" stroke={C.orange} strokeWidth={3} />
      <path d="M1505.5,434 L1519.5,414 L1533.5,434" fill="none" stroke={C.orange} strokeWidth={3} strokeLinejoin="round" />
    </svg>
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
  // r19: the phase-1 hex was 7px HIGH and 2px narrow — the ref's widest row is
  // y288 spanning x305-521 (cx 413, w 217) at f1718; we rendered y281, w215. The
  // corrected cy 290 is MATCH.hexA.cy, which the matching scene already used.
  // growP endpoints untouched: 0 for f<=1752, 1 by f1780.
  const hexW = 217 + (385 - 217) * growP;
  const hexAx = 413 + (612 - 413) * growP;
  const hexBx = 1513 + (1306 - 1513) * growP;
  const hexY = 290 + (413 - 290) * growP;
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
  const docP = f >= DOC_F[0] && f <= 1763 ? 1 : 0;
  const docLX = interpolate(f, DOC_F, DOC_LX, clamp);
  const docLY = interpolate(f, DOC_F, DOC_LY, clamp);
  const docRX = interpolate(f, DOC_F, DOC_RX, clamp);
  const docRY = interpolate(f, DOC_F, DOC_RY, clamp);
  const docW = interpolate(f, GROW_F, GROW_W, clamp);
  const docH = interpolate(f, GROW_F, GROW_H, clamp);
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
  // r19: LocksScene mounts at f1652 but the ref is still showing the FULL
  // matching scene (panel 225, pills solid) at f1652-1655 — this opaque white
  // root was painting over it, the same mount-fill defect MatchingScene had.
  // The frame goes white at f1656 in the ref; the fill starts there.
  return (
    <AbsoluteFill style={{ backgroundColor: f < 1656 ? undefined : C.white }}>
      <EdgeRulers f={f} />
      {phase1 && (
        <>
          {/* r19: THE HUB ELBOWS ARE ONE FIXED PAIR, AND THE DOCS SLIDE ACROSS THEM.
              They are also the SAME elbows the matching scene draws — probed at
              (412,500) and (1519,500), the ink is unbroken orange at f1656, 1660,
              1670, 1680, 1690, 1700. We were fading a second pair in at f1685-1705
              and leaving a 32-frame hole where the ref has them solid. The old
              connectors also RODE docDy and were drawn AFTER the docs, painting an
              80px orange bar straight across each document's face — the ref has
              none: its riser stops dead at the doc's top edge (y551 at f1735)
              because the doc is simply on top of it. Draw the elbow, then the doc.
              Path scanned at f1718: shaft x412.5 / 1519.5 (2px), horizontal y661
              (we drew 666), ends x777 / x1158 — 73px and 89px SHORT of the box,
              not touching it. Arrowhead apex y415, barbs +-14 x +20 (ours was half
              that). The whole path rides boxDy on the exit (elbow apex +9 at f1752,
              +43 at f1756 — boxDy is 9 and 45) and is gone by f1759. */}
          <HubElbow dy={boxDy} opacity={f >= 1759 ? 0 : 1} />
          {/* r19: the box was 1px narrow and 1px right — sub-pixel coverage scan of
              the ref's navy fill at f1718/1730/1740 (stable to 0.03px): left 849.22,
              right 1069.94, top 549.98, bottom 770.93 => side 220.84. We drew x850
              w224, which Chrome paints as side 220 at x850. That error had been
              CANCELLING the old wordmark seat's 0.8%-too-low error; the r19 ui.tsx
              seat law exposed it. side 220.84 => w = 220.84 * 274/268.5 = 225.4. */}
          <ClsNetBox x={849.2} y={550 + boxDy} w={225.4} opacity={lerp(f, [1662, 1672], [0, 1]) * boxOut} />
          {/* r19: THE DOCS ARE NOT WHERE WE PUT THEM AT ANY FRAME BEFORE f1748. They
              GROW OUT OF THE BOX — born as a 5px point at (748,653) on f1696, full
              size by f1713 — and then SLIDE outward across the fixed elbow, reaching
              their settled x337 / x1439 only at f1748. We drew them parked at their
              settled position from f1668, so through the whole f1713-1748 slide our
              left doc sat up to 275px away from the ref's (f1718: ref x612, we drew
              340). Two 150x199 documents in the wrong place for 35 frames — the
              whole of this window's defect. Tracked per frame off the navy outline
              bbox; the table IS the animation (lesson 14). They also rise ~30px
              before they fall (settled y555 -> 524 at f1750 -> 731 at f1762). */}
          {docP > 0 && (
            <>
              {/* r19: these two are the ONLY Docs that draw the ref's real document
                  (`variant="full"`, transcribed in ui.tsx from THIS pair at f1740).
                  The ref draws at least two documents — payment's is a different one
                  (orange square badge, two-cell strip, peach band) and tradeDocs'
                  loses under "full" too — so `variant` defaults to "plain" and only
                  these opt in. The inner pill of the lower panel is ORANGE in the
                  left document and NAVY in the right; that is the only difference
                  between them. */}
              <Doc x={docLX} y={docLY} w={docW} h={docH} opacity={boxOut} variant="full" />
              <Doc x={docRX} y={docRY} w={docW} h={docH} opacity={boxOut} variant="full" innerPill={C.pillNavy} />
            </>
          )}
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
        // r23: the 21:00 trio (out[0]===2127) does NOT ride the exit push. The
        // ref keeps it screen-fixed (measured f2133: pill tops 578/609/684 vs
        // data 596/641/688 — barely a drift) while the whole strip band lifts
        // ~197px away: the trade at the settlement deadline persists as the strip
        // clears. The pushY wrapper lifts everything, so cancel it for the trio
        // (X still scrolls at rate 9; only the vertical push is exempted). The
        // 22:00 pair (no out) correctly rides the push and is left untouched.
        const trioFixed = p.out?.[0] === 2127;
        const y = trioFixed
          ? p.y - pushY
          : p.fallKeys
            ? interpolate(f, p.fallKeys as unknown as number[], p.fallY as unknown as number[], clamp)
            : p.y;
        return <Pill key={`p${i}`} x={x} y={y} w={p.w} h={p.h} color={p.c} opacity={op} />;
      })}
      {/* grey band on top of clusters */}
      <div style={{ position: "absolute", left: 0, top: STRIP.bandY, width: 1920, height: STRIP.bandH, backgroundColor: C.grey }} />
      {/* strip-fixed orange deadline lines, re-measured PER LINE at settled frames
          (each has its own sub-hour offset — they are NOT uniform): h5 at 5.02
          (ref x228 @f2050, the old value was right), h9 at 9.0 (ref x935 @f2100 /
          x665 @f2130 — old 9.03 sat 9px right, doubling the navy gridline), h13 at
          13.0 (ref x1830 @f2130 — old 13.09 sat 24px right, the largest miss). On
          the hour the 4px orange covers the 2px navy gridline, as the ref does. */}
      {[5.02, 9, 13].map((h, i) => {
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
