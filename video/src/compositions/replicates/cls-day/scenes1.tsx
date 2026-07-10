// cls-day scenes: intro → netting (f0..f1466). All positions/timings
// measured from reference contact sheets (0.5s grid) and per-pixel probes;
// refined per-round via still A/Bs.
import React from "react";
import { interpolate, Easing } from "remotion";
import { C, clamp, Pack, SANS } from "./data";
import {
  ClsMark,
  ClsLetters,
  IconHandshake,
  IconProcess,
  IconData,
  TimelineBand,
  MarkerTriangle,
  Milestone,
  Chip,
  ClsPill,
  HexCity,
  Donut,
  Padlock,
} from "./lib";

const EASE = Easing.bezier(0.4, 0, 0.2, 1);

// piecewise-linear table sampler (scene-local)
const lutS =
  (t: [number, number][]) =>
  (frame: number): number => {
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

// ─── Logo card (intro + end card share this layout) ───
// End-card geometry: mark x422 y166 size 235; letters x702 y166 h230;
// tagline x442 y426 (65px light sans); icons y651 h170; labels y866 serif 34.
export const LogoCard: React.FC<{
  markP?: number;
  lettersP?: number;
  taglineP?: number;
  iconsP?: number;
  pack: Pack;
  BrandLogo?: React.FC<{ markP: number; lettersP: number }>;
}> = ({ markP = 1, lettersP = 1, taglineP = 1, iconsP = 1, pack, BrandLogo }) => {
  const icons = [
    { X: 572, Icon: IconHandshake, label: pack.pillars[0], cx: 672 },
    { X: 857, Icon: IconProcess, label: pack.pillars[1], cx: 950 },
    { X: 1177, Icon: IconData, label: pack.pillars[2], cx: 1260 },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: C.navyBg }}>
      {BrandLogo ? (
        <BrandLogo markP={markP} lettersP={lettersP} />
      ) : (
        <>
          <div style={{ position: "absolute", left: 422, top: 166, opacity: markP }}>
            <ClsMark size={235} />
          </div>
          <div style={{ position: "absolute", left: 702, top: 168, opacity: lettersP }}>
            <ClsLetters height={230} />
          </div>
        </>
      )}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 420,
          width: 1920,
          textAlign: "center",
          fontFamily: pack.sans,
          fontWeight: 300,
          fontSize: 66,
          letterSpacing: 1,
          color: "#FCFCFC",
          opacity: taglineP,
        }}
      >
        {pack.tagline}
      </div>
      {icons.map(({ X, Icon, label, cx }, i) => (
        <div key={i} style={{ opacity: iconsP }}>
          <div style={{ position: "absolute", left: X, top: 651 }}>
            <Icon size={180} />
          </div>
          <div
            style={{
              position: "absolute",
              left: cx - 150,
              top: 862,
              width: 300,
              textAlign: "center",
              fontFamily: pack.serif,
              fontSize: 34,
              color: "#FCFCFC",
            }}
          >
            {label}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── S1: intro (f0..123) — mark draws, letters+tagline+icons reveal ───
// Exit f108..122: a white slash splits the card in two; both pieces are
// STATIC content clipped by the moving slash edges (measured bar extents),
// while the S2 ruler wipe levels in underneath.
export const S1Intro: React.FC<{ frame: number; pack: Pack; BrandLogo?: React.FC<{ markP: number; lettersP: number }> }> = ({
  frame,
  pack,
  BrandLogo,
}) => {
  if (frame >= 124) return null;
  const markP = interpolate(frame, [0, 18], [0.15, 1], { ...clamp, easing: EASE });
  const lettersP = interpolate(frame, [8, 30], [0, 1], clamp);
  const taglineP = interpolate(frame, [26, 44], [0, 1], clamp);
  const iconsP = interpolate(frame, [40, 58], [0, 1], clamp);
  const card = <LogoCard markP={markP} lettersP={lettersP} taglineP={taglineP} iconsP={iconsP} pack={pack} BrandLogo={BrandLogo} />;
  if (frame < 107) return card;
  // slash edge tables at y540 (probed white runs f107..117); the slit opens
  // at x~975 and both edges accelerate apart while the ruler plane rises
  const slashL = lutS([[107, 896], [109, 888], [110, 878], [111, 856], [112, 792], [113, 660], [114, 488], [115, 230], [116, -60], [117, -420]])(frame);
  const slashR = lutS([[107, 975], [108, 986], [109, 1000], [110, 1040], [111, 1110], [112, 1240], [113, 1510], [114, 1859], [115, 2400]])(frame);
  // edges lean ~14° from vertical (top toward the right)
  const dx = 0.25;
  return (
    <>
      <div style={{ position: "absolute", inset: 0, clipPath: `polygon(-300px -200px, ${slashL + 740 * dx}px -200px, ${slashL - 760 * dx}px 1300px, -300px 1300px)` }}>
        {card}
      </div>
      <div style={{ position: "absolute", inset: 0, clipPath: `polygon(${slashR + 740 * dx}px -200px, 2300px -200px, 2300px 1300px, ${slashR - 760 * dx}px 1300px)` }}>
        {card}
      </div>
    </>
  );
};

// The intro wipe is the S2 ruler itself sweeping up from the bottom-right
// with the white world glued below it (measured: line at -17°, y960
// 1300@f100 → 725@f110 → 534@f124); WipeIn stays exported as a no-op for
// mount-order stability.
export const WipeIn: React.FC<{ frame: number }> = () => null;

// ─── S2: currency carousel (f100..300) — r5 measured rebuild ───
// Early phase f118..224: pairs pan in from the right and settle with the
// top baseline ON the ruler (ref caps 251px → fs349; ref f150 USD x337,
// JPY x431 cap-top 565). The whole assembly (codes, chips, ticks) drifts
// left ~1.5px/f throughout (DKK x246@f190 → 199@f220; cream column
// 1561@f150 → 1457@f220). Chips are w129 h58, tight pitch ~78, and creep
// THROUGH the ruler (L col up 1.1px/f, R col down 1.75px/f; f220 rows
// measured). Ruler ticks every 49.5px (not 22 — grid probed f230-288).
// Accelerated phase f224..283 — the world funnels INTO the ruler:
//  · DKK/GBP is swallowed f224-230 (baseline 534→772 measured);
//  · six pairs plunge vertically through the frame into the line with NO
//    settle (per-frame baseline LUTs from ink tracking; bottom code
//    mirrors the top about y1081: capTop = 1081 − baseline; fs338,
//    cap 242); x anchors drift left, accelerating pair by pair
//    (189 → 168 → 146 → sliding off the left edge);
//  · the tight chip stack drains into the line f227-236, then a pitch-150
//    stream converges on it at ±48px/f (chip inventory anchored to ref
//    f250), columns riding a measured x LUT off the left edge by f283;
//  · from f254 the whole assembly DESCENDS (hairline 535→772@f290,
//    per-frame LUT) while the band STRETCHES about x≈−428 (tick pitch
//    49.5→125.5@f288) and the S3 globe docks onto it from the top right.
type PlungeLUT = {
  i: number; // pack.currencyPairs index
  base: [number, number][]; // TOP-code baseline y (ruler space)
  xT: [number, number][]; // top-code CSS left
  xB: [number, number][]; // bottom-code CSS left
  end: number;
};
const PLUNGES: PlungeLUT[] = [
  { i: 2, end: 243, base: [[230, 64], [231, 148], [232, 253], [233, 366], [234, 470], [235, 554], [236, 619], [237, 668], [238, 706], [239, 734], [240, 756], [242, 795]], xT: [[230, 177]], xB: [[230, 207]] },
  { i: 3, end: 249, base: [[238, 27], [239, 118], [240, 238], [241, 373], [242, 493], [243, 591], [244, 657], [245, 705], [246, 739], [248, 795]], xT: [[238, 156]], xB: [[238, 188]] },
  { i: 4, end: 258, base: [[247, 28], [248, 119], [249, 239], [250, 374], [251, 494], [252, 589], [253, 655], [254, 703], [255, 738], [257, 795]], xT: [[247, 140], [250, 136], [252, 132], [253, 127], [254, 120], [255, 112]], xB: [[247, 191], [250, 187], [252, 183], [254, 173], [255, 165]] },
  { i: 5, end: 266, base: [[255, 26], [256, 117], [257, 236], [258, 372], [259, 494], [260, 581], [261, 649], [262, 698], [263, 734], [265, 795]], xT: [[255, 164], [256, 156], [257, 140], [258, 124], [259, 108], [260, 86], [261, 62], [262, 36], [263, 6], [264, -22]], xB: [[255, 180], [256, 168], [257, 154], [258, 139], [259, 121], [260, 100], [261, 76], [262, 54], [263, 32], [264, 8]] },
  { i: 6, end: 271, base: [[262, 65], [263, 209], [264, 383], [265, 518], [266, 613], [267, 683], [268, 733], [270, 795]], xT: [[262, 62], [263, 20], [264, -22], [265, -64], [266, -106], [267, -148], [268, -190], [269, -232]], xB: [[262, -4], [263, -46], [264, -88], [265, -130], [266, -172], [267, -214], [268, -256], [269, -298]] },
  { i: 7, end: 277, base: [[266, -13], [267, 35], [268, 181], [269, 366], [270, 508], [271, 520], [274, 517]], xT: [[266, -180], [267, -290], [268, -330], [269, -350], [270, -370], [271, -420], [272, -480], [273, -540], [274, -600]], xB: [[268, 28], [269, -92], [270, -212], [271, -252], [272, -312], [273, -392], [274, -472]] },
  { i: 8, end: 277, base: [[271, 95], [272, 199], [273, 253], [274, 349], [275, 459], [276, 514]], xT: [[271, -150], [272, -270], [273, -390], [274, -520], [275, -650], [276, -780]], xB: [[274, -12], [275, -52], [276, -162]] },
];
// serif calibration (measured on rendered stills vs ref): rendered
// baseline = CSS_top + 0.825·fs; rendered cap-top = CSS_top + 0.122·fs.
const FS_SET = 349; // settled pairs — ref cap 251
const FS_PLG = 338; // plunging pairs — ref cap 242
// early chips sit on a FIXED lattice (rows identical at f150 and f220,
// x drifting left with the assembly); occupancy/colors BLINK between the
// two measured states ("-" = empty slot). Blink placed mid-hold (f185).
const EARLY_L: [number, string, string][] = [[254, "-", "G"], [330, "G", "G"], [407, "G", "G"], [484, "G", "-"], [550, "N", "G"], [630, "G", "G"], [710, "G", "G"], [792, "G", "-"]];
const EARLY_R: [number, string, string][] = [[255, "C", "-"], [331, "C", "C"], [408, "C", "C"], [484, "R", "C"], [550, "C", "R"], [630, "C", "R"], [709, "C", "C"], [793, "-", "C"], [877, "-", "C"]];
// funnel streams: chip top y AT F250 (ruler space); above chips fall at
// +48px/f, below chips rise at −48px/f, all swallowed by the line.
const FUN_L_AB: [number, string][] = [[357, "G"], [206, "G"], [68, "N"], [-76, "N"], [-220, "G"], [-336, "N"], [-486, "G"], [-630, "G"], [-780, "N"], [-930, "G"], [-1080, "G"], [-1230, "N"], [-1380, "G"], [-1530, "G"], [-1680, "N"]];
const FUN_L_BE: [number, string][] = [[619, "G"], [775, "G"], [917, "N"], [1065, "N"], [1214, "G"], [1349, "N"], [1500, "G"], [1650, "G"], [1800, "N"], [1950, "G"], [2100, "G"], [2250, "N"], [2400, "G"], [2550, "N"], [2700, "G"]];
const FUN_R_AB: [number, string][] = [[463, "R"], [302, "C"], [156, "C"], [24, "R"], [-122, "R"], [-268, "C"], [-420, "C"], [-570, "R"], [-720, "C"], [-870, "C"], [-1020, "R"], [-1170, "C"], [-1320, "C"], [-1470, "R"], [-1620, "C"]];
const FUN_R_BE: [number, string][] = [[550, "R"], [670, "C"], [821, "C"], [958, "R"], [1109, "R"], [1237, "C"], [1390, "C"], [1540, "R"], [1690, "C"], [1840, "C"], [1990, "R"], [2140, "C"], [2290, "C"], [2440, "R"], [2590, "C"]];
const CHIP_C: Record<string, string> = { G: C.chipGrey, N: C.chipNavy, C: C.chipCream, R: C.chipRed };
// right chip-column left edge (cream-column scans f150-283); L = R − 180
const X_COL_R = lutS([[150, 1497], [200, 1421], [220, 1392], [225, 1384], [232, 1372], [238, 1367], [244, 1360], [250, 1351], [255, 1339], [258, 1313], [260, 1293], [262, 1263], [264, 1224], [266, 1177], [268, 1120], [270, 1049], [272, 964], [274, 854], [276, 732], [278, 570], [280, 367], [282, 102], [284, -170]]);
// band descent (hairline row probes f254-290, extrapolated off-frame)
const DESCENT = lutS([[253, 0], [256, 1], [258, 3], [260, 5], [262, 7], [264, 9], [265, 11], [266, 13], [267, 15], [268, 18], [269, 20], [270, 22], [271, 25], [272, 29], [273, 32], [274, 36], [275, 41], [276, 46], [277, 51], [278, 57], [279, 65], [280, 73], [281, 81], [282, 91], [283, 103], [284, 117], [285, 136], [286, 155], [287, 177], [288, 199], [289, 220], [290, 237], [294, 325], [298, 425], [302, 540], [306, 660]]);
// band stretch: tick pitch + grid phase (probed rows f230-288)
const TICK_P = lutS([[255, 49.5], [260, 51], [265, 54], [270, 58], [274, 63.5], [278, 71.5], [282, 85], [285, 100.7], [288, 125.6], [292, 150]]);
const TICK_PHI = lutS([[150, 36], [230, 39], [250, 14.5], [270, -8], [278, -32.5], [285, -52.7], [288, -87.6], [292, -120]]);

export const S2Currencies: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 96 || frame >= 308) return null;
  const bgP = interpolate(frame, [117, 122], [0, 1], clamp);
  // ruler-led wipe (measured f104..126): the line rises steeply from the
  // bottom-right, then levels onto y534; the white world rides below it.
  const rulerY = lutS([[104, 1300], [106, 1113], [108, 943], [110, 768], [112, 660], [114, 556], [116, 541], [118, 539], [122, 536], [126, 534]])(frame);
  const rulerRot = lutS([[106, -30], [114, -33], [116, -19], [118, -10], [120, -5], [122, -2.4], [124, -0.8], [126, 0]])(frame);
  const dy = DESCENT(frame);
  const pairColor = (c: "red" | "navy") => (c === "red" ? C.red : C.navyInk);
  const rulerXf = `translate(0px, ${rulerY - 534}px) rotate(${rulerRot}deg)`;
  const xR = X_COL_R(frame);
  const xL = xR - 180;
  const pT = TICK_P(frame);
  const sc = pT / 49.5;
  const phi = TICK_PHI(frame);
  // early chips: fixed lattice; whole stack drains INTO the line f227-236
  // (measured ink collapse). Rendered into BOTH clips (the line splits them).
  const drain = interpolate(frame, [227, 236], [0, 300], { ...clamp, easing: Easing.in(Easing.quad) });
  const earlyChip = (col: "L" | "R", row: [number, string, string], k: number) => {
    if (frame > 238) return null;
    const cc = frame < 185 ? row[1] : row[2];
    if (cc === "-") return null;
    const start = (col === "R" ? 114 : 118) + k * 4;
    if (frame < start) return null;
    const p = interpolate(frame, [start, start + 6], [0, 1], clamp);
    const above = row[0] + 29 < 534;
    const y = row[0] + (above ? drain : -drain);
    return <Chip key={`e${col}${k}`} x={col === "L" ? xL : xR} y={y} w={129} h={58} color={CHIP_C[cc]} opacity={p} />;
  };
  // funnel chips: converge on the line at ±48px/f from both frame edges
  const funChip = (col: "L" | "R", side: 1 | -1, y250: number, cc: string, k: number) => {
    const y = y250 + side * 48 * (frame - 250);
    if (y < -120 || y > 1140) return null;
    if (side > 0 && y250 > 520) return null; // above stream stops at the line
    if (side < 0 && y250 < 545) return null;
    return <Chip key={`f${col}${side}${k}`} x={col === "L" ? xL : xR} y={y} w={129} h={58} color={CHIP_C[cc]} opacity={1} />;
  };
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 }}>
      <div style={{ position: "absolute", inset: 0, background: C.white, opacity: bgP }} />
      {/* white world below the sweeping line (the wipe) — under the pairs/chips */}
      {frame < 126 && (
        <div style={{ position: "absolute", inset: 0, transform: rulerXf, transformOrigin: "960px 534px" }}>
          <div style={{ position: "absolute", left: -700, top: 548, width: 3400, height: 2600, background: C.white }} />
        </div>
      )}
      {/* descent wrapper — pairs, chips and band all ride the sinking line */}
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${dy}px)` }}>
        {/* above-the-line clip */}
        <div style={{ position: "absolute", left: 0, top: -1200, width: 1920, height: 1734, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 1200 }}>
            {/* settled pairs: USD/JPY pans in f119, collapses f154-168;
                DKK/GBP pans in f168, swallowed f224-230 (measured LUT) */}
            {frame >= 119 && frame <= 172 && (
              <SettledCode pack={pack} i={0} top xIn={interpolate(frame, [119, 129], [1500, 0], { ...clamp, easing: EASE })} x={325} sink={interpolate(frame, [154, 168], [0, 350], { ...clamp, easing: Easing.in(Easing.quad) })} />
            )}
            {frame >= 168 && frame <= 232 && (
              <SettledCode pack={pack} i={1} top xIn={interpolate(frame, [168, 180], [1500, 0], { ...clamp, easing: EASE })} x={234 - 1.55 * (frame - 190)} sink={lutS([[224, 0], [225, 26], [226, 49], [227, 81], [228, 125], [229, 180], [230, 238], [231, 280]])(frame)} />
            )}
            {/* plunging top codes */}
            {PLUNGES.map((P) => {
              const pair = pack.currencyPairs[P.i];
              if (!pair || frame < P.base[0][0] || frame > P.end) return null;
              const base = lutS(P.base)(frame);
              return (
                <div key={`pt${P.i}`} style={{ position: "absolute", left: lutS(P.xT)(frame), top: base - 0.825 * FS_PLG, fontFamily: pack.serif, fontSize: FS_PLG, lineHeight: 0.93, color: pairColor(pair.topColor) }}>
                  {pair.top}
                </div>
              );
            })}
            {/* chips (each clip shows its side of the line) */}
            {EARLY_L.map((row, k) => earlyChip("L", row, k))}
            {EARLY_R.map((row, k) => earlyChip("R", row, k))}
            {frame > 236 && FUN_L_AB.map(([y, cc], k) => funChip("L", 1, y, cc, k))}
            {frame > 236 && FUN_R_AB.map(([y, cc], k) => funChip("R", 1, y, cc, k))}
          </div>
        </div>
        {/* below-the-line clip */}
        <div style={{ position: "absolute", left: 0, top: 548, width: 1920, height: 1300, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: -548 }}>
            {frame >= 119 && frame <= 172 && (
              <SettledCode pack={pack} i={0} xIn={interpolate(frame, [119, 129], [1500, 0], { ...clamp, easing: EASE })} x={419} sink={-interpolate(frame, [154, 168], [0, 350], { ...clamp, easing: Easing.in(Easing.quad) })} />
            )}
            {frame >= 168 && frame <= 232 && (
              <SettledCode pack={pack} i={1} xIn={interpolate(frame, [168, 180], [1500, 0], { ...clamp, easing: EASE })} x={287 - 1.55 * (frame - 190)} sink={-lutS([[224, 0], [225, 26], [226, 49], [227, 81], [228, 125], [229, 180], [230, 238], [231, 280]])(frame)} />
            )}
            {/* plunging bottom codes — mirror the top about y1081 */}
            {PLUNGES.map((P) => {
              const pair = pack.currencyPairs[P.i];
              if (!pair || frame < P.xB[0][0] || frame > P.end) return null;
              const capTop = 1081 - lutS(P.base)(frame);
              return (
                <div key={`pb${P.i}`} style={{ position: "absolute", left: lutS(P.xB)(frame), top: capTop - 0.122 * FS_PLG, fontFamily: pack.serif, fontSize: FS_PLG, lineHeight: 0.93, color: pairColor(pair.topColor === "red" ? "navy" : "red") }}>
                  {pair.bottom}
                </div>
              );
            })}
            {EARLY_L.map((row, k) => earlyChip("L", row, k))}
            {EARLY_R.map((row, k) => earlyChip("R", row, k))}
            {frame > 236 && FUN_L_BE.map(([y, cc], k) => funChip("L", -1, y, cc, k))}
            {frame > 236 && FUN_R_BE.map(([y, cc], k) => funChip("R", -1, y, cc, k))}
          </div>
        </div>
        {/* the band — hairline + grey strip + tick grid; leads the white
            wipe in, stretches (about the tick grid) as it descends out */}
        <div style={{ position: "absolute", inset: 0, transform: rulerXf, transformOrigin: "960px 534px" }}>
          <div style={{ position: "absolute", left: -200, top: 534 - 3 * sc, width: 2600, height: 3 * sc, background: C.navyDeep }} />
          <div style={{ position: "absolute", left: -200, top: 534, width: 2600, height: 14 * sc, background: C.bandGrey }} />
          {Array.from({ length: 46 }, (_, i) => {
            const x = phi + (i - 3) * pT;
            if (x < -10 || x > 1930) return null;
            return <div key={i} style={{ position: "absolute", left: x, top: 534, width: 1.5 * sc, height: 14 * sc, background: C.navyDeep }} />;
          })}
        </div>
      </div>
    </div>
  );
};

// settled serif code (baseline on the ruler; calibrated placement)
const SettledCode: React.FC<{ pack: Pack; i: number; top?: boolean; xIn: number; x: number; sink: number }> = ({ pack, i, top, xIn, x, sink }) => {
  const pair = pack.currencyPairs[i];
  if (!pair) return null;
  const color = top ? pair.topColor : pair.topColor === "red" ? "navy" : "red";
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: top ? 530 - 0.825 * FS_SET : 565 - 0.122 * FS_SET,
        fontFamily: pack.serif,
        fontSize: FS_SET,
        lineHeight: 0.93,
        color: color === "red" ? C.red : C.navyInk,
        transform: `translate(${xIn}px, ${sink}px)`,
      }}
    >
      {top ? pair.top : pair.bottom}
    </div>
  );
};

// ─── S3: globe clock (f300..460) ───
// Globe cx960 cy690: blue disc r235, grey ring r240..276, ticks, red
// time marks; marker triangle above y560. Padlock right x1310 y610.
const GLOBE = { cx: 960, cy: 690, r: 235, ringW: 36 };

export const S3Globe: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 283 || frame >= 470) return null;
  // dock from the top right, smaller (measured f285: cx≈1870 cy≈490 r≈180)
  const dockP = 1 - interpolate(frame, [283, 310], [1, 0], { ...clamp, easing: Easing.bezier(0.6, 0, 0.2, 1) });
  const exitP = interpolate(frame, [452, 468], [0, 1], clamp);
  const rot = interpolate(frame, [300, 460], [0, -120], clamp); // map drift
  const lockIn = interpolate(frame, [345, 358], [0, 1], clamp);
  const lockClosed = frame >= 400;
  const { cx, cy, r, ringW } = GLOBE;
  return (
    <div style={{ position: "absolute", inset: 0, transform: `translate(${910 * (1 - dockP)}px, ${-200 * (1 - dockP)}px) scale(${0.77 + 0.23 * dockP})`, transformOrigin: `${cx}px ${cy}px`, opacity: 1 - exitP }}>
      {/* ring */}
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <circle cx={cx} cy={cy} r={r + ringW / 2 + 2} fill="none" stroke={C.bandGrey} strokeWidth={ringW} />
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
          const r0 = r + 2;
          const r1 = r + ringW + 6;
          return (
            <line
              key={i}
              x1={cx + Math.cos(a) * r0}
              y1={cy + Math.sin(a) * r0}
              x2={cx + Math.cos(a) * r1}
              y2={cy + Math.sin(a) * r1}
              stroke={i % 6 === 0 ? C.red : C.navyDeep}
              strokeWidth={i % 6 === 0 ? 3.5 : 2}
            />
          );
        })}
        {/* globe */}
        <circle cx={cx} cy={cy} r={r} fill={C.blue} />
        {/* simplified drifting continents */}
        <g clipPath="url(#globeClip)">
          <g transform={`translate(${rot} 0)`}>
            <Continents cx={cx} cy={cy} r={r} />
            <Continents cx={cx + 940} cy={cy} r={r} />
          </g>
        </g>
        <defs>
          <clipPath id="globeClip">
            <circle cx={cx} cy={cy} r={r - 2} />
          </clipPath>
        </defs>
      </svg>
      {/* clock labels */}
      <div style={{ position: "absolute", left: cx + r + 28, top: cy - r - 10, fontFamily: "Helvetica", fontSize: 17, color: C.navyDeep, transform: "rotate(55deg)" }}>
        00:00
      </div>
      <MarkerTriangle x={cx} y={cy - r - ringW - 46} size={34} />
      <Padlock x={1290} y={600} closed={lockClosed} opacity={lockIn} />
    </div>
  );
};

// white map outlines (very simplified continents, stroke only)
const Continents: React.FC<{ cx: number; cy: number; r: number }> = ({ cx, cy, r }) => (
  <g transform={`translate(${cx - r} ${cy - r}) scale(${(r * 2) / 470})`} fill="none" stroke="#FDFDFD" strokeWidth={5} strokeLinejoin="round">
    {/* americas */}
    <path d="M 120 40 L 180 55 L 175 95 L 145 130 L 150 175 L 125 225 L 130 280 L 105 340 L 95 400 L 80 340 L 88 270 L 70 210 L 85 150 L 70 95 Z" />
    {/* europe/africa */}
    <path d="M 300 60 L 360 70 L 385 110 L 360 150 L 390 200 L 375 270 L 340 330 L 315 290 L 300 220 L 280 160 L 295 110 Z" />
  </g>
);

// ─── S4: trade executed diagram (f460..674) ───
// Band top (standard), marker slides toward 00:00 at center. Hexes A/B
// y380 centers x480/1408; pill center (968,720) 300×110; blue arrow y372.
export const S4Trade: React.FC<{ frame: number; pack: Pack; PillLogo?: React.FC<{ h: number }> }> = ({
  frame,
  pack,
  PillLogo,
}) => {
  if (frame < 440 || frame >= 674) return null;
  const bandIn = interpolate(frame, [440, 462], [0, 1], clamp);
  // measured: marker fixed at 960; 23:00 under it at f550; pan -1.3px/f
  const hourAt = 23 + (frame - 550) * 0.00917;
  const hexIn = interpolate(frame, [462, 486], [0, 1], { ...clamp, easing: EASE });
  const hexSpread = interpolate(frame, [500, 528], [0, 1], { ...clamp, easing: EASE });
  const badgeP = interpolate(frame, [528, 540], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
  const arrowP = interpolate(frame, [540, 562], [0, 1], { ...clamp, easing: EASE });
  const pillP = interpolate(frame, [548, 566], [0, 1], clamp);
  const connP = interpolate(frame, [560, 585], [0, 1], { ...clamp, easing: EASE });
  const coinP = interpolate(frame, [606, 618], [0, 1], clamp);
  const ax = interpolate(hexSpread, [0, 1], [700, 435]);
  const bx = interpolate(hexSpread, [0, 1], [1220, 1473]);
  const hy = 475;
  const HW = 402;
  const HH = 415;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 }}>
      {frame < 656 ? (
        <div style={{ opacity: bandIn }}>
          <TimelineBand y={96} originX={960} originHour={hourAt} pxPerHour={141.7} />
          <MarkerTriangle x={960} y={27} size={60} />
        </div>
      ) : (
        <S4ExitBand frame={frame} />
      )}
      {/* diagram content dies behind the incoming S5 front (f667..673) */}
      <div style={{ position: "absolute", inset: 0, clipPath: frame >= 666 ? `inset(0 ${Math.max(0, 1920 - lutS(S4X_FRONT)(frame))}px 0 0)` : undefined }}>
      <HexCity x={ax} y={hy} w={HW} h={HH} letter="A" badgeP={badgeP} variant={0} opacity={hexIn} />
      <HexCity x={bx} y={hy} w={HW} h={HH} letter="B" badge="tr" badgeP={badgeP} variant={1} opacity={hexIn} />
      {/* trade executed arrow y531 */}
      {arrowP > 0 && (
        <>
          <svg width={1920} height={1080} style={{ position: "absolute", opacity: arrowP }}>
            <line x1={ax + HW / 2 + 10} y1={531} x2={ax + HW / 2 + 10 + (bx - ax - HW - 20) * arrowP} y2={531} stroke={C.skyBlue} strokeWidth={4} />
            <path d={`M ${ax + HW / 2 + 24} 531 l 20 -11 v 22 z`} fill={C.skyBlue} transform={`rotate(180 ${ax + HW / 2 + 34} 531)`} />
            <path d={`M ${bx - HW / 2 - 44} 531 l 20 -11 v 22 z`} fill={C.skyBlue} />
          </svg>
          <div
            style={{
              position: "absolute",
              left: 960 - 150,
              top: 488,
              width: 300,
              textAlign: "center",
              fontFamily: pack.sans,
              fontSize: 28,
              color: C.skyBlue,
              opacity: arrowP,
            }}
          >
            {pack.tradeExecuted}
          </div>
        </>
      )}
      {/* connectors into pill */}
      {connP > 0 && (
        <svg width={1920} height={1080} style={{ position: "absolute", opacity: connP }}>
          <path
            d={`M ${ax + 10} ${hy + HH / 2 - 8} L ${ax + 10} 785 Q ${ax + 10} 812 ${ax + 40} 812 L 796 812`}
            fill="none"
            stroke={C.navyDeep}
            strokeWidth={3.5}
          />
          <path d="M 796 812 l -22 -12 v 24 z" fill={C.navyDeep} transform="translate(22 0)" />
          <path
            d={`M ${bx - 10} ${hy + HH / 2 - 8} L ${bx - 10} 785 Q ${bx - 10} 812 ${bx - 40} 812 L 1124 812`}
            fill="none"
            stroke={C.navyDeep}
            strokeWidth={3.5}
          />
          <path d={`M 1124 812 l 22 -12 v 24 z`} fill={C.navyDeep} transform="translate(-22 0)" />
        </svg>
      )}
      {pillP > 0 && <ClsPillSlot x={826} y={759} w={250} h={107} p={pillP} PillLogo={PillLogo} />}
      {/* money icon under A */}
      {coinP > 0 && (
        <svg width={64} height={64} viewBox="0 0 60 60" style={{ position: "absolute", left: ax - 90, top: hy + HH / 2 + 20, opacity: coinP }}>
          <rect x="4" y="10" width="52" height="40" rx="12" fill="none" stroke={C.red} strokeWidth="3" />
          <circle cx="30" cy="30" r="11" fill="none" stroke={C.red} strokeWidth="2.5" />
          <text x="30" y="36" textAnchor="middle" fontFamily="Helvetica" fontSize="16" fill={C.red}>
            $
          </text>
        </svg>
      )}
      </div>
    </div>
  );
};

// ── S4 exit (f656..673) — r6 measured transition into S5 ──
// The ref never hard-cuts: from f661 the band DESCENDS (y96→325@673,
// S5's entry LUT picks up at 376@674) while the hour axis whips left and
// STRETCHES (pitch 142.3→235; per-frame tick probes), the marker rides
// its hour off the left edge, and the S5 world (white above / navy below
// + scaled tick chains) wipes in behind a measured front (1858@667 →
// 0@673). Phase values are measured AT integer frames (mod-pitch wraps
// between frames are unsampled and harmless).
const S4X_TOP: [number, number][] = [[656, 96], [660, 96], [661, 97], [662, 98], [663, 100], [664, 104], [665, 109], [666, 115], [667, 124], [668, 136], [669, 153], [670, 176], [671, 210], [672, 261], [673, 325]];
const S4X_PITCH: [number, number][] = [[656, 142.3], [662, 142.7], [664, 145.5], [666, 150], [667, 153.7], [668, 158.4], [669, 165], [670, 174.4], [671, 188.5], [672, 208.8], [673, 235]];
const S4X_PHASE: [number, number][] = [[656, 111], [660, 108], [662, 90], [664, 26], [666, 42], [667, 89], [668, 104], [669, 68], [670, 122], [671, 45], [672, 134], [673, 60]];
const S4X_H0: [number, number][] = [[656, 18], [662, 18], [664, 19], [666, 20], [667, 21], [668, 22], [669, 23], [670, 24], [671, 25], [672, 26], [673, 27]];
const S4X_MARKX: [number, number][] = [[656, 961], [664, 961], [666, 900], [668, 835], [669, 745], [670, 640], [671, 480], [672, 270], [673, 40]];
const S4X_FRONT: [number, number][] = [[666, 1980], [667, 1858], [668, 1770], [669, 1640], [670, 1434], [671, 1084], [672, 451], [673, 0]];

const S4ExitBand: React.FC<{ frame: number }> = ({ frame }) => {
  const btop = lutS(S4X_TOP)(frame);
  const pitch = lutS(S4X_PITCH)(frame);
  const phase = lutS(S4X_PHASE)(frame);
  const h0 = Math.round(lutS(S4X_H0)(frame));
  const markX = lutS(S4X_MARKX)(frame);
  const front = frame >= 666 ? lutS(S4X_FRONT)(frame) : 1980;
  const bh = (40 * pitch) / 142.3;
  const syp = pitch / 301.5; // S5-world scale implied by the shared pitch
  const ticks = Array.from({ length: 15 }, (_, k) => ({ x: phase + k * pitch, h: h0 + k }));
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* S5 world wiping in behind the front: white above, navy below */}
      {front < 1920 && (
        <>
          <div style={{ position: "absolute", left: front, top: 0, width: 1980 - front, height: btop, background: C.white }} />
          <div style={{ position: "absolute", left: front, top: btop + bh, width: 1980 - front, height: 1080 - btop - bh, background: C.navyBg }} />
          {/* incoming S5 tick chains (above navy-on-white, below mirrored white) */}
          <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, clipPath: `inset(0 0 0 ${front}px)` }}>
            {ticks.map(({ x, h }) => (
              <React.Fragment key={h}>
                <div style={{ position: "absolute", left: x, top: btop - 310 * syp, width: 3, height: 310 * syp, background: C.navyDeep }} />
                <div style={{ position: "absolute", left: x + 16 * syp, top: btop - 314 * syp, fontFamily: "Helvetica", fontSize: 21 * syp, color: C.navyDeep }}>
                  {String(((h % 24) + 24) % 24).padStart(2, "0")}:00
                </div>
                <div style={{ position: "absolute", left: x, top: btop + bh, width: 3, height: 308 * syp, background: "#FDFDFD" }} />
                <div style={{ position: "absolute", left: x + 19 * syp, top: btop + bh + 292 * syp, fontFamily: "Helvetica", fontSize: 21 * syp, color: "#FDFDFD" }}>
                  {String(((h + 6) % 24 + 24) % 24).padStart(2, "0")}:00
                </div>
              </React.Fragment>
            ))}
          </div>
        </>
      )}
      {/* the shared band — one continuous strip, descending + stretching
          (tick/label styling mirrors TimelineBand exactly) */}
      <div style={{ position: "absolute", left: 0, top: btop, width: 1920, height: bh, background: C.bandGrey }} />
      {ticks.map(({ x, h }) => (
        <div key={`t${h}`} style={{ position: "absolute", left: x - 1.5, top: btop - 4, width: 3, height: bh + 4 + 20, background: C.navyDeep }} />
      ))}
      {/* S4-side hour labels (below the strip), only left of the front */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, clipPath: `inset(0 ${Math.max(0, 1920 - front)}px 0 0)` }}>
        {ticks.map(({ x, h }) => (
          <div key={`l${h}`} style={{ position: "absolute", left: x + 8, top: btop + bh + 2, fontFamily: SANS, fontSize: (30 * pitch) / 142.3, color: C.navyDeep, whiteSpace: "pre" }}>
            {String(((h % 24) + 24) % 24).padStart(2, "0")}:00
          </div>
        ))}
        <MarkerTriangle x={markX} y={btop - 69} size={60} />
      </div>
    </div>
  );
};

export const ClsPillSlot: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  p: number;
  PillLogo?: React.FC<{ h: number }>;
  logoScale?: number;
}> = ({ x, y, w, h, p, PillLogo, logoScale = 0.5 }) =>
  PillLogo ? (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        background: C.navyBg,
        borderRadius: h * 0.28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: p,
      }}
    >
      <PillLogo h={h * 0.5} />
    </div>
  ) : (
    <ClsPill x={x} y={y} w={w} h={h} opacity={p} logoScale={logoScale} />
  );

// ─── S5: skyline (f674..940) ───
// Band mid y490 h85; one ornate cluster every ~2h (603px); mirrored navy
// world below. Exit f920..940: the world rises + shrinks into the S6 band
// (y152 h54) while the city ink fades — the ref never crossfades.
export const S5Skyline: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 674 || frame >= 941) return null;
  const bandY = 490;
  const bandH = 85;
  // ── r4 per-frame measured camera (tick tracking, work/cls-day/r4) ──
  // ENTRY f674..684: the cut lands zoomed OUT (pitch 255.5, band 377..447)
  // on hours 02..08, then whips left ~1800px decelerating into the cruise
  // while the world zooms/settles onto the band. CRUISE f690..916:
  // x9 piecewise-measured (≈ -1.596px/f; the old -1.54 drifted 10px @f860).
  // EXIT f916..930: the band whips left AGAIN (09:00 tick +25.5@916 →
  // -1097@928, hours pan 10:00→24:00 into S6's 00:00@293) and the shrink
  // is NON-uniform: pitch 301.5→~199 (sx→0.66) vs h 85→54 (sy→0.635).
  const px = 301.5;
  const sx = lutS([
    [674, 0.8475], [675, 0.885], [676, 0.9254], [677, 0.945], [678, 0.9642], [679, 0.9761],
    [680, 0.9847], [681, 0.9911], [682, 0.996], [684, 1],
    [916, 1], [918, 0.988], [920, 0.988], [922, 0.975], [924, 0.902], [926, 0.81],
    [928, 0.803], [930, 0.73], [932, 0.68], [934, 0.67], [936, 0.663], [940, 0.66],
  ])(frame);
  const sy = lutS([
    [674, 0.824], [675, 0.855], [676, 0.88], [677, 0.918], [678, 0.941], [679, 0.953],
    [680, 0.965], [681, 0.978], [682, 0.988], [683, 0.994], [684, 1],
    [916, 0.988], [918, 0.988], [920, 0.976], [922, 0.929], [924, 0.929], [926, 0.835],
    [928, 0.776], [930, 0.718], [932, 0.671], [934, 0.647], [938, 0.647], [940, 0.635],
  ])(frame);
  // band center (rest 532.5): entry descend + exit rise, both measured
  const riseC = lutS([
    [674, 412], [675, 447.5], [676, 474.5], [677, 490], [678, 503], [679, 512.5],
    [680, 520], [681, 525], [682, 529], [683, 530.5], [684, 532.5],
    [918, 532.5], [920, 521.5], [922, 506.5], [924, 481.5], [926, 430.5], [928, 327],
    [930, 250.5], [932, 214.5], [934, 195.5], [936, 185.5], [938, 179.5], [940, 179],
  ])(frame);
  // inner x of the 09:00 tick (screen tick positions unprojected through
  // the sx scale about x=960; cruise points are direct measurements)
  const x9 = lutS([
    [674, 2184.8], [675, 1751], [676, 1438.7], [677, 1150.5], [678, 911.3], [679, 744.9],
    [680, 621.3], [681, 530.7], [682, 467], [683, 425.6], [684, 400.5], [685, 391.5],
    [686, 390.5], [688, 387], [690, 384],
    [750, 288.5], [800, 206], [850, 124.5], [896, 55.5], [916, 25.5],
    [918, 5.2], [920, -63.7], [922, -177.4], [924, -423], [926, -905.5],
    [928, -1601.5], [930, -4013], [940, -4574],
  ])(frame);
  // towers/docs fade f924..930; the tick chain stays crisp until S6's band
  // takes over at f929 (measured: 14:00/15:00 labels still sharp @f928)
  const inkP = interpolate(frame, [924, 930], [1, 0], clamp);
  const tickP = frame >= 929 ? 0 : 1;
  // S6 navy front (same LUT as S6Schedule's sweep) — ticks it has passed
  // repaint white (ref f924: white 16:00 tick+label inside the navy field)
  const sweepS5 = lutS([
    [922, 1920], [923, 1671], [924, 1548], [925, 1382], [926, 1152], [927, 830],
    [928, 400], [929, 50], [930, -10],
  ])(frame);
  // S6-chain replacement front (dup of S6Schedule's): the ABOVE-band S5
  // chain dies behind it (ref f928: S5 16:00@597, S6 23:00@854); the
  // BELOW-band mirror chain survives it (ref f930: 22:00@192, 23:00@412)
  const front5 = lutS([
    [926, 1920], [928, 760], [929, 610], [930, 428], [932, 202], [934, 90],
    [936, 32], [938, 4], [940, 0],
  ])(frame);
  const frontLocal = 960 + (front5 - 960) / sx - x9;
  // instruction docs pop from tower tops (measured: emerge hidden behind the
  // tower, rise 33.75px/f, world-fixed x; B@f747, C@f799, G@f851)
  const docPops = [
    { wx: 427, top0: 276, t0: 747 }, // B tower (doc top y276@t0, tower top 235)
    { wx: 1090, top0: 297, t0: 799 }, // C tower (fold clears y240 ~f801)
    { wx: 1612, top0: 219, t0: 851 }, // G tower (screen 1725..1815 @f860)
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: C.white }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translateY(${riseC - 532.5}px) scaleX(${sx}) scaleY(${sy})`,
          transformOrigin: "960px 532.5px",
        }}
      >
        {/* navy lower world (tall so the shrink never exposes the floor) */}
        <div style={{ position: "absolute", left: -3200, top: bandY + bandH, width: 8000, height: 2000, background: C.navyBg }} />
        <div style={{ position: "absolute", left: x9, top: 0, width: 5200 }}>
          {/* hour ticks + labels above and mirrored below (+6h); all 24h —
              the entry whip shows hours 02..08, the exit whip 10..17 */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 5200,
              height: bandY,
              opacity: tickP,
              clipPath: frame >= 924 ? `inset(0 ${Math.max(0, 5200 - frontLocal)}px 0 0)` : undefined,
            }}
          >
            {Array.from({ length: 24 }, (_, i) => {
              const x = (i - 9) * px;
              return (
                <React.Fragment key={i}>
                  <div style={{ position: "absolute", left: x, top: 180, width: 3, height: bandY - 180, background: C.navyDeep }} />
                  <div style={{ position: "absolute", left: x + 16, top: 176, fontFamily: "Helvetica", fontSize: 21, color: C.navyDeep }}>
                    {String(i).padStart(2, "0")}:00
                  </div>
                </React.Fragment>
              );
            })}
          </div>
          <div style={{ opacity: frame >= 934 ? 0 : 1 }}>
            {Array.from({ length: 24 }, (_, i) => {
              const x = (i - 9) * px;
              return (
                <React.Fragment key={i}>
                  <div style={{ position: "absolute", left: x, top: bandY + bandH, width: 3, height: 308, background: "#FDFDFD" }} />
                  <div
                    style={{ position: "absolute", left: x + 19, top: bandY + bandH + 292, fontFamily: "Helvetica", fontSize: 21, color: "#FDFDFD" }}
                  >
                    {String((i + 6) % 24).padStart(2, "0")}:00
                  </div>
                </React.Fragment>
              );
            })}
          </div>
          <div style={{ opacity: inkP }}>
            {/* rising instruction docs (BEHIND the towers) */}
            {docPops.map(({ wx, top0, t0 }, i) => {
              if (frame < t0 || frame > t0 + 14) return null;
              const top = top0 - 33.75 * (frame - t0);
              return <DocPop key={i} x={wx} y={top} />;
            })}
            {/* distinct traced clusters (ref f750/f900), world-fixed.
                Above: A@-152 B@452 C@1060 G@1657 (center world x, slot 604).
                Below: E@-691* D@-88 E@519 F@1115 D@1721 (slot left x, *edge reuse). */}
            <div style={{ position: "absolute", left: -382, top: 170 }}><ClA /></div>
            <div style={{ position: "absolute", left: 222, top: 170 }}><ClB /></div>
            <div style={{ position: "absolute", left: 830, top: 170 }}><ClC /></div>
            <div style={{ position: "absolute", left: 1427, top: 170 }}><ClG /></div>
            <div style={{ position: "absolute", left: -691, top: bandY + bandH - 5 }}><ClE /></div>
            <div style={{ position: "absolute", left: -88, top: bandY + bandH - 5 }}><ClD /></div>
            <div style={{ position: "absolute", left: 519, top: bandY + bandH - 5 }}><ClE /></div>
            <div style={{ position: "absolute", left: 1115, top: bandY + bandH - 5 }}><ClF /></div>
            {/* ref: the 21:00 zone (world 1721+) is EMPTY — no cluster there */}
            {/* entry-whip left tiles (hours 2..7, visible only f674..~690):
                designs cycle on — real per-slot identity unreadable at
                100..300px/f; position+mass carry the window (lesson 4) */}
            {frame < 692 && (
              <>
                <div style={{ position: "absolute", left: -986, top: 170 }}><ClG /></div>
                <div style={{ position: "absolute", left: -1590, top: 170 }}><ClC /></div>
                <div style={{ position: "absolute", left: -2194, top: 170 }}><ClB /></div>
                <div style={{ position: "absolute", left: -1295, top: bandY + bandH - 5 }}><ClF /></div>
                <div style={{ position: "absolute", left: -1899, top: bandY + bandH - 5 }}><ClE /></div>
                <div style={{ position: "absolute", left: -2503, top: bandY + bandH - 5 }}><ClD /></div>
              </>
            )}
          </div>
        </div>
        {/* grey band on top of buildings */}
        <div style={{ position: "absolute", left: -3200, top: bandY, width: 8000, height: bandH, background: C.bandGrey }} />
      </div>
      {/* S6 navy front (screen space, moved here from S6Schedule so the
          passed ticks can repaint WHITE above it — ref f924..928) */}
      {frame >= 922 && (
        <>
          <div
            style={{ position: "absolute", left: sweepS5, top: 0, width: 1980 - sweepS5, height: riseC - 42.5 * sy, background: C.navyBg }}
          />
          {frame < 929 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                transform: `translateY(${riseC - 532.5}px) scaleX(${sx}) scaleY(${sy})`,
                transformOrigin: "960px 532.5px",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: x9,
                  top: 0,
                  width: 5200,
                  height: 600,
                  clipPath: `inset(0 ${Math.max(0, 5200 - frontLocal)}px 0 ${960 + (sweepS5 - 960) / sx - x9}px)`,
                }}
              >
                {Array.from({ length: 24 }, (_, i) => {
                  const x = (i - 9) * px;
                  return (
                    <React.Fragment key={i}>
                      <div style={{ position: "absolute", left: x, top: 180, width: 3, height: bandY - 180, background: "#FDFDFD" }} />
                      <div style={{ position: "absolute", left: x + 16, top: 176, fontFamily: "Helvetica", fontSize: 21, color: "#FDFDFD" }}>
                        {String(i).padStart(2, "0")}:00
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// rising settlement-instruction doc (traced f754: 95x120, navy outline,
// two text lines, top-right fold, red $ ring at (47,66) r24)
const DocPop: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <svg width={95} height={120} viewBox="0 0 95 120" style={{ position: "absolute", left: x, top: y }}>
    <path d="M 4 116 L 4 4 L 68 4 L 91 27 L 91 116 Z" fill="#FDFDFD" stroke={C.navyDeep} strokeWidth="4.5" strokeLinejoin="round" />
    <path d="M 68 4 L 68 27 L 91 27" fill="none" stroke={C.navyDeep} strokeWidth="4.5" />
    <line x1={16} y1={20} x2={52} y2={20} stroke={C.navyDeep} strokeWidth="4.5" />
    <line x1={16} y1={32} x2={40} y2={32} stroke={C.navyDeep} strokeWidth="4.5" />
    <circle cx="47" cy="70" r="24" fill="none" stroke={C.red} strokeWidth="4" />
    <text x="47" y="80" textAnchor="middle" fontFamily="Georgia, serif" fontSize="30" fill={C.red}>
      $
    </text>
  </svg>
);

// ── traced skyline clusters (r3, per-tower tracing from ref f750/f900) ──
// Above-world slots are 604x330 SVGs at world (center-230), y170; local
// coords = (screen@f750 - slotLeft - 288, screen_y - 170). Below-world
// slots are 604x330 at y570. All geometry from 2x crops of the ref frames.
const NAVY = "#0B2341";
const WHT = "#FDFDFD";

// 08:00 cluster: red tower w/ horizontal-bar panel + dashed wings
const ClA: React.FC = () => (
  <svg width={604} height={330} viewBox="0 0 604 330">
    {/* left low bridge into frame edge */}
    <path d="M -60 320 L -60 240 L 111 240 L 111 320" fill={WHT} stroke={NAVY} strokeWidth="3.5" />
    {/* grey slab + right low bridge */}
    <rect x={310} y={195} width={50} height={125} fill="#DCDCDC" />
    <path d="M 354 320 L 354 238 L 425 238 L 425 262 L 519 262 L 519 320" fill={WHT} stroke={NAVY} strokeWidth="3.5" />
    {/* left navy building + stepped antenna + solid bar windows */}
    <line x1={146.5} y1={162} x2={146.5} y2={176} stroke={NAVY} strokeWidth="3.5" />
    <rect x={141.5} y={176} width={11.5} height={10} fill="none" stroke={NAVY} strokeWidth="3.5" />
    <rect x={111.5} y={186} width={51} height={134} fill={WHT} stroke={NAVY} strokeWidth="3.5" />
    {[0, 1, 2, 3, 4, 5, 6, 7].map((r) => (
      <rect key={r} x={128} y={200 + r * 9} width={18} height={4.5} fill={NAVY} />
    ))}
    {/* dominant red tower: crown, stripes, bar panel w/ solid band, wings */}
    <line x1={247} y1={42} x2={247} y2={56.5} stroke={C.red} strokeWidth="3.5" />
    <rect x={235.5} y={56.5} width={47} height={15} fill="none" stroke={C.red} strokeWidth="3.5" />
    <path d="M 178 320 L 178 74 Q 178 66 186 66 L 274 66 Q 283 66 283 75 L 283 320" fill={WHT} stroke={C.red} strokeWidth="3.5" />
    {[0, 1, 2, 3, 4].map((c) => (
      <line key={c} x1={200 + c * 14} y1={85} x2={200 + c * 14} y2={110} stroke={C.red} strokeWidth="3" />
    ))}
    <line x1={200} y1={104} x2={256} y2={104} stroke={C.red} strokeWidth="3" />
    <rect x={190.5} y={116.5} width={84.5} height={87.5} fill="none" stroke={C.red} strokeWidth="3.5" />
    <line x1={190.5} y1={130} x2={275} y2={130} stroke={C.red} strokeWidth="3" />
    <rect x={195} y={137.5} width={75} height={17.5} fill={C.red} />
    <rect x={200} y={141} width={9} height={10} fill={WHT} />
    <rect x={256} y={141} width={9} height={10} fill={WHT} />
    <line x1={190.5} y1={174} x2={275} y2={174} stroke={C.red} strokeWidth="3" />
    <line x1={190.5} y1={190} x2={275} y2={190} stroke={C.red} strokeWidth="3" />
    <rect x={192} y={204} width={79.5} height={18.5} fill="none" stroke={C.red} strokeWidth="3.5" />
    <line x1={192} y1={213} x2={271.5} y2={213} stroke={C.red} strokeWidth="3" />
    {/* wings */}
    <path d="M 159.5 320 L 159.5 197.5 L 178 197.5" fill={WHT} stroke={C.red} strokeWidth="3.5" />
    <path d="M 283 197.5 L 304 197.5 L 304 320" fill={WHT} stroke={C.red} strokeWidth="3.5" />
    {[168, 192, 269, 293].map((x, i) => (
      <line key={i} x1={x} y1={228} x2={x} y2={315} stroke={C.red} strokeWidth="3" strokeDasharray="9 8" />
    ))}
    <path d="M 217 320 L 217 304 L 247 304 L 247 320" fill="none" stroke={C.red} strokeWidth="3.5" />
    {/* right navy building w/ dot windows */}
    <path d="M 306 320 L 306 215 Q 306 207.5 313.5 207.5 L 346 207.5 Q 354 207.5 354 215 L 354 320" fill={WHT} stroke={NAVY} strokeWidth="3.5" />
    {[0, 1, 2].map((r) =>
      [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={314 + c * 15} y={218 + r * 15} width={5.5} height={7} fill={NAVY} />),
    )}
  </svg>
);

// 10:00 cluster: square-column tower + striped round-top tower (doc source)
const ClB: React.FC = () => (
  <svg width={604} height={330} viewBox="0 0 604 330">
    {/* left navy building */}
    <line x1={132} y1={172.5} x2={132} y2={187.5} stroke={NAVY} strokeWidth="3.5" />
    <rect x={127} y={187.5} width={11} height={12.5} fill="none" stroke={NAVY} strokeWidth="3.5" />
    <rect x={110} y={200} width={52.5} height={120} fill={WHT} stroke={NAVY} strokeWidth="3.5" />
    {[0, 1, 2, 3, 4, 5, 6].map((r) => (
      <rect key={r} x={124} y={212.5 + r * 9.7} width={18.5} height={4.5} fill={NAVY} />
    ))}
    {/* slim white slab behind-left of the column tower */}
    <rect x={164} y={65} width={25} height={255} fill={WHT} stroke={C.red} strokeWidth="3.5" />
    {/* narrow column tower + mast + square column */}
    <line x1={198} y1={17.5} x2={198} y2={42.5} stroke={C.red} strokeWidth="3.5" />
    <rect x={189} y={42.5} width={46} height={277.5} fill={WHT} stroke={C.red} strokeWidth="3.5" />
    {([[75, 1], [101, 0], [126, 0], [147.5, 1], [172.5, 0]] as const).map(([y, solid], i) => (
      <rect key={i} x={201.5} y={y} width={20} height={16} fill={solid ? C.red : "none"} stroke={C.red} strokeWidth="3" />
    ))}
    {/* step-roof + main striped tower, rounded top-right */}
    <path d="M 235 65 L 235 53 L 264 53 L 264 65" fill="none" stroke={C.red} strokeWidth="3.5" />
    <path d="M 235 320 L 235 65 L 305 65 Q 325 65 325 85 L 325 320" fill={WHT} stroke={C.red} strokeWidth="3.5" />
    {/* pinstripes measured f750: five at local x 249.5 + 14.5c (the sixth
        "stripe" in the old model was the body's own right edge) */}
    {[0, 1, 2, 3, 4].map((c) => (
      <line key={c} x1={249.5 + c * 14.5} y1={114} x2={249.5 + c * 14.5} y2={302} stroke={C.red} strokeWidth="3" />
    ))}
    <path d="M 195 320 L 195 302.5 L 227.5 302.5 L 227.5 320" fill="none" stroke={C.red} strokeWidth="3.5" />
    {/* grey slab + right navy building w/ 2x3 square windows */}
    <rect x={318} y={185} width={20} height={135} fill="#DCDCDC" />
    <rect x={323.5} y={182.5} width={36.5} height={137.5} fill={WHT} stroke={NAVY} strokeWidth="3.5" />
    {[0, 1, 2].map((r) =>
      [0, 1].map((c) => (
        <rect key={`${r}${c}`} x={326 + c * 16} y={210 + r * 19} width={11} height={11} fill="none" stroke={NAVY} strokeWidth="3" />
      )),
    )}
    {/* far-right navy L bridge + stepped outline building near 11:00 */}
    <path d="M 360 257.5 L 430 257.5 L 430 320" fill="none" stroke={NAVY} strokeWidth="3.5" />
    <path d="M 440 320 L 440 255 L 472 255 L 472 275 L 505 275 L 505 320" fill={WHT} stroke={NAVY} strokeWidth="3.5" />
  </svg>
);

// 12:00 cluster: twin-column square-window tower
const ClC: React.FC = () => (
  <svg width={604} height={330} viewBox="0 0 604 330">
    {/* far-left thin outline bridge */}
    <path d="M 49.5 320 L 49.5 270 Q 49.5 262.5 57 262.5 L 107 262.5 L 107 320" fill={WHT} stroke={NAVY} strokeWidth="3.5" />
    {/* left navy building: striped top + navy block w/ white ladder marks */}
    <path d="M 107 320 L 107 188 Q 107 180 115 180 L 159 180 Q 167 180 167 188 L 167 320" fill={WHT} stroke={NAVY} strokeWidth="3.5" />
    {[0, 1, 2, 3].map((c) => (
      <line key={c} x1={119.5 + c * 12.5} y1={190} x2={119.5 + c * 12.5} y2={212.5} stroke={NAVY} strokeWidth="3" />
    ))}
    <rect x={102} y={217.5} width={45} height={102.5} fill={NAVY} />
    {[0, 1, 2, 3].map((r) => (
      <React.Fragment key={r}>
        <rect x={112} y={235 + r * 22} width={6} height={14} fill={WHT} />
        <rect x={130} y={235 + r * 22} width={6} height={14} fill={WHT} />
      </React.Fragment>
    ))}
    {/* grey slabs */}
    <rect x={302} y={207.5} width={17.5} height={112.5} fill="#DCDCDC" />
    <rect x={387} y={260} width={15} height={60} fill="#DCDCDC" />
    {/* twin red tower: left col w/ 2 masts, right col w/ stepped crown */}
    <line x1={179.5} y1={42.5} x2={179.5} y2={70} stroke={C.red} strokeWidth="3.5" />
    <line x1={194.5} y1={57.5} x2={194.5} y2={70} stroke={C.red} strokeWidth="3.5" />
    <path d="M 239.5 70 L 239.5 55 L 277 55 L 277 70" fill="none" stroke={C.red} strokeWidth="3.5" />
    <rect x={167} y={70} width={55} height={250} fill={WHT} stroke={C.red} strokeWidth="3.5" />
    <rect x={222} y={70} width={80} height={250} fill={WHT} stroke={C.red} strokeWidth="3.5" />
    {([[97.5, 1], [122.5, 0], [147.5, 0], [172.5, 1], [197.5, 0], [222.5, 0], [247.5, 0]] as const).map(([y, solid], i) => (
      <rect key={i} x={180} y={y} width={17} height={16} fill={solid ? C.red : "none"} stroke={C.red} strokeWidth="3" />
    ))}
    {([[97.5, 0, 1], [122.5, 0, 0], [147.5, 0, 0], [172.5, 1, 0], [197.5, 0, 0], [222.5, 0, 1], [247.5, 0, 0]] as const).map(([y, sL, sR], i) => (
      <React.Fragment key={i}>
        <rect x={238} y={y} width={17} height={16} fill={sL ? C.red : "none"} stroke={C.red} strokeWidth="3" />
        <rect x={263} y={y} width={17} height={16} fill={sR ? C.red : "none"} stroke={C.red} strokeWidth="3" />
      </React.Fragment>
    ))}
    <line x1={167} y1={282.5} x2={302} y2={282.5} stroke={C.red} strokeWidth="3.5" />
    <path d="M 219.5 320 L 219.5 305 L 252 305 L 252 320" fill="none" stroke={C.red} strokeWidth="3.5" />
    {/* right navy building w/ dots + low bridge toward 13:00 */}
    <path d="M 302 320 L 302 215 Q 302 207.5 309.5 207.5 L 344 207.5 Q 352 207.5 352 215 L 352 320" fill={WHT} stroke={NAVY} strokeWidth="3.5" />
    {[0, 1, 2].map((r) =>
      [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={310 + c * 15} y={218 + r * 15} width={5.5} height={7} fill={NAVY} />),
    )}
    <path d="M 352 320 L 352 270 L 452 270 L 452 320" fill={WHT} stroke={NAVY} strokeWidth="3.5" />
  </svg>
);

// 14:00 cluster: capped tower w/ twin window slots + dash-grid base (f900)
const ClG: React.FC = () => (
  <svg width={604} height={330} viewBox="0 0 604 330">
    {/* left low bridge */}
    <path d="M 56 320 L 56 267.5 L 118 267.5 L 118 320" fill={WHT} stroke={NAVY} strokeWidth="3.5" />
    {/* left navy building */}
    <line x1={156} y1={165} x2={156} y2={177} stroke={NAVY} strokeWidth="3.5" />
    <rect x={150} y={177} width={12} height={13} fill="none" stroke={NAVY} strokeWidth="3.5" />
    <rect x={118} y={190} width={53} height={130} fill={WHT} stroke={NAVY} strokeWidth="3.5" />
    {[0, 1, 2, 3, 4, 5, 6, 7].map((r) => (
      <rect key={r} x={136} y={225 + r * 8.5} width={20} height={4.5} fill={NAVY} />
    ))}
    {/* grey slab */}
    <rect x={296} y={205} width={15} height={125} fill="#DCDCDC" />
    {/* crown + masts */}
    <line x1={218} y1={57.5} x2={218} y2={70} stroke={C.red} strokeWidth="3.5" />
    <line x1={228} y1={57.5} x2={228} y2={70} stroke={C.red} strokeWidth="3.5" />
    <rect x={180} y={70} width={98} height={22} fill={WHT} stroke={C.red} strokeWidth="3.5" />
    <line x1={185} y1={100} x2={271} y2={100} stroke={C.red} strokeWidth="3.5" />
    {/* upper shaft + inner panel w/ twin slots (left solid, right pale) */}
    <rect x={176} y={97.5} width={100} height={107.5} fill={WHT} stroke={C.red} strokeWidth="3.5" />
    <rect x={198.5} y={122.5} width={67.5} height={82.5} fill="none" stroke={C.red} strokeWidth="3.5" />
    <rect x={208} y={135} width={18} height={25} fill={C.red} />
    <rect x={231} y={135} width={17} height={25} fill="#F2C7A9" />
    <rect x={208} y={160} width={18} height={45} fill="none" stroke={C.red} strokeWidth="3" />
    <rect x={231} y={160} width={17} height={45} fill="none" stroke={C.red} strokeWidth="3" />
    {/* broad body w/ dash windows */}
    <path d="M 170 320 L 170 215 Q 170 205 180 205 L 280 205 Q 290 205 290 215 L 290 320" fill={WHT} stroke={C.red} strokeWidth="3.5" />
    {[0, 1, 2, 3].map((r) =>
      [0, 1, 2, 3, 4].map((c) => (
        <rect key={`${r}${c}`} x={186 + c * 21} y={225 + r * 25} width={4} height={11} fill={C.red} />
      )),
    )}
    <path d="M 225 330 L 225 307.5 L 257 307.5 L 257 330" fill="none" stroke={C.red} strokeWidth="3.5" />
    {/* right navy building w/ 3x2 outline windows */}
    <path d="M 285 320 L 285 195 Q 285 187.5 292.5 187.5 L 335 187.5 Q 343 187.5 343 195 L 343 320" fill={WHT} stroke={NAVY} strokeWidth="3.5" />
    {[0, 1].map((r) =>
      [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={306 + c * 13} y={248 + r * 17} width={9} height={11} fill="none" stroke={NAVY} strokeWidth="2.5" />),
    )}
    {/* far-right rounded outline w/ L-marks (toward 15:00) */}
    <path d="M 388 320 L 388 278 Q 388 270 396 270 L 462 270 L 462 320" fill={WHT} stroke={NAVY} strokeWidth="3.5" />
    <path d="M 408 285 L 408 298 L 420 298" fill="none" stroke={NAVY} strokeWidth="3" />
    <path d="M 428 292 L 428 305 L 440 305" fill="none" stroke={NAVY} strokeWidth="3" />
  </svg>
);

// below 15:00: hanging twin-column square-window tower + white neighbors
const ClD: React.FC = () => (
  <svg width={604} height={330} viewBox="0 0 604 330">
    {/* left white building w/ dot grid (rounded bottom) */}
    <path d="M 40 0 L 40 157 Q 40 165 48 165 L 147 165 Q 155 165 155 157 L 155 0" fill="none" stroke={WHT} strokeWidth="3.5" />
    {[0, 1, 2].map((r) =>
      [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={112 + c * 12} y={90 + r * 15} width={5.5} height={6.5} fill={WHT} />),
    )}
    <path d="M 0 47.5 L 40 47.5" fill="none" stroke={WHT} strokeWidth="3.5" />
    {/* red hanging tower */}
    <rect x={212.5} y={0} width={37.5} height={22.5} fill="none" stroke={C.red} strokeWidth="3.5" />
    <line x1={231} y1={0} x2={231} y2={22.5} stroke={C.red} strokeWidth="3" />
    <rect x={155} y={0} width={90} height={250} fill={C.navyBg} stroke={C.red} strokeWidth="4" />
    <rect x={245} y={0} width={60} height={250} fill={C.navyBg} stroke={C.red} strokeWidth="4" />
    {([[75, 0, 0, 0], [104, 1, 0, 0], [133, 0, 0, 0], [162, 0, 1, 1], [191, 0, 0, 0], [220, 0, 0, 0], [249, 1, 0, 1]] as const).map(([y, s1, s2, s3], i) => (
      <React.Fragment key={i}>
        <rect x={167} y={y - 10} width={18} height={17} fill={s1 ? C.red : "none"} stroke={C.red} strokeWidth="3" />
        <rect x={195} y={y - 10} width={18} height={17} fill={s2 ? C.red : "none"} stroke={C.red} strokeWidth="3" />
        <rect x={266} y={y - 10} width={18} height={17} fill={s3 ? C.red : "none"} stroke={C.red} strokeWidth="3" />
      </React.Fragment>
    ))}
    {/* stepped hanging base + mast */}
    <path d="M 155 250 L 180 250 L 180 270 L 220 270 L 220 250 L 305 250" fill="none" stroke={C.red} strokeWidth="4" />
    <line x1={280} y1={250} x2={280} y2={317} stroke={C.red} strokeWidth="3.5" />
    {/* right white building w/ comb marks */}
    <path d="M 305 0 L 305 157 Q 305 165 313 165 L 372 165 Q 380 165 380 157 L 380 0" fill="none" stroke={WHT} strokeWidth="3.5" />
    {[0, 1, 2, 3].map((r) => (
      <path key={r} d={`M 365 ${47 + r * 14} L 337 ${47 + r * 14} L 337 ${57 + r * 14} L 365 ${57 + r * 14}`} fill="none" stroke={WHT} strokeWidth="3" />
    ))}
    <path d="M 318 125 L 352 125" fill="none" stroke={WHT} strokeWidth="3" />
    {[0, 1, 2, 3].map((c) => (
      <line key={c} x1={322 + c * 9} y1={125} x2={322 + c * 9} y2={140} stroke={WHT} strokeWidth="3" />
    ))}
    {/* rails toward the next slot */}
    <path d="M 380 38 L 448 38 Q 468 38 468 58 L 468 88 L 540 88" fill="none" stroke={WHT} strokeWidth="3.5" />
  </svg>
);

// below 17:00: symmetric legged structure w/ capsule feet
const ClE: React.FC = () => (
  <svg width={604} height={330} viewBox="0 0 604 330">
    {/* rails left */}
    <path d="M 33 75 L 108 75 Q 120 75 120 87 L 120 110" fill="none" stroke={WHT} strokeWidth="3.5" />
    <rect x={103} y={77.5} width={7} height={9} fill={C.red} />
    <rect x={103} y={92.5} width={7} height={9} fill={C.red} />
    {/* outer wings */}
    <path d="M 118 0 L 118 92 L 153 92 L 153 0" fill="none" stroke={C.red} strokeWidth="4" />
    <line x1={140} y1={35} x2={140} y2={92} stroke={C.red} strokeWidth="3" />
    <path d="M 308 0 L 308 92 L 343 92 L 343 0" fill="none" stroke={C.red} strokeWidth="4" />
    <line x1={321} y1={35} x2={321} y2={92} stroke={C.red} strokeWidth="3" />
    {/* legs + capsule feet + dashed interiors */}
    <path d="M 168 0 L 168 177.5 M 198 0 L 198 177.5" stroke={C.red} strokeWidth="4" fill="none" />
    <path d="M 168 177.5 L 168 205 Q 168 220 183 220 Q 198 220 198 205 L 198 177.5" fill="none" stroke={C.red} strokeWidth="4" />
    <line x1={183} y1={20} x2={183} y2={165} stroke={C.red} strokeWidth="3" strokeDasharray="10 12" />
    <path d="M 258 0 L 258 177.5 M 288 0 L 288 177.5" stroke={C.red} strokeWidth="4" fill="none" />
    <path d="M 258 177.5 L 258 205 Q 258 220 273 220 Q 288 220 288 205 L 288 177.5" fill="none" stroke={C.red} strokeWidth="4" />
    <line x1={273} y1={20} x2={273} y2={165} stroke={C.red} strokeWidth="3" strokeDasharray="10 12" />
    {/* center body: attachment, comb, cross bar */}
    <rect x={215} y={7.5} width={35} height={17.5} fill="none" stroke={C.red} strokeWidth="3.5" />
    <line x1={232.5} y1={7.5} x2={232.5} y2={25} stroke={C.red} strokeWidth="3" />
    <line x1={200} y1={75} x2={260} y2={75} stroke={C.red} strokeWidth="3.5" />
    {[0, 1, 2, 3, 4].map((c) => (
      <line key={c} x1={207 + c * 12} y1={75} x2={207 + c * 12} y2={155} stroke={C.red} strokeWidth="3.5" />
    ))}
    <line x1={198} y1={159} x2={258} y2={159} stroke={C.red} strokeWidth="3.5" />
    {/* white right building w/ bars + hanging mast */}
    <path d="M 323 92 L 323 155 Q 323 162.5 330.5 162.5 L 365 162.5 Q 373 162.5 373 155 L 373 92" fill="none" stroke={WHT} strokeWidth="3.5" />
    {[0, 1, 2].map((r) => (
      <rect key={r} x={338} y={100 + r * 15} width={20} height={7} fill={WHT} />
    ))}
    <path d="M 348 145 L 348 162 M 341 152 L 355 152" stroke={WHT} strokeWidth="3" fill="none" />
    {/* rails right */}
    <path d="M 373 100 L 420 100 Q 435 100 435 115 L 435 135 L 500 135" fill="none" stroke={WHT} strokeWidth="3.5" />
  </svg>
);

// below 19:00: monolithic block w/ finned shaft + trapezoid cap
const ClF: React.FC = () => (
  <svg width={604} height={330} viewBox="0 0 604 330">
    {/* left white building w/ solid bars */}
    <path d="M 37 0 L 37 160 L 102 160 L 102 0" fill="none" stroke={WHT} strokeWidth="3.5" />
    <rect x={47} y={85} width={45} height={12.5} fill={WHT} />
    <rect x={47} y={115} width={45} height={12.5} fill={WHT} />
    <line x1={69} y1={0} x2={69} y2={85} stroke={WHT} strokeWidth="3" />
    {/* big red block */}
    <path d="M 172 7.5 L 172 260 Q 172 270 182 270 L 279 270 Q 289 270 289 260 L 289 7.5" fill={C.navyBg} stroke={C.red} strokeWidth="4.5" />
    {/* center shaft + squares + fins + footing */}
    <line x1={212} y1={7.5} x2={212} y2={225} stroke={C.red} strokeWidth="3.5" />
    <line x1={247} y1={7.5} x2={247} y2={225} stroke={C.red} strokeWidth="3.5" />
    {([[93, 0], [120, 0], [148, 1], [175, 0], [203, 1]] as const).map(([y, solid], i) => (
      <rect key={i} x={222} y={y - 8} width={15} height={17} fill={solid ? C.red : "none"} stroke={C.red} strokeWidth="3" />
    ))}
    {[155, 172.5, 190].map((y, i) => (
      <React.Fragment key={i}>
        <line x1={177} y1={y} x2={212} y2={y} stroke={C.red} strokeWidth="3.5" />
        <line x1={247} y1={y} x2={284} y2={y} stroke={C.red} strokeWidth="3.5" />
      </React.Fragment>
    ))}
    <rect x={209.5} y={225} width={40} height={12.5} fill="none" stroke={C.red} strokeWidth="3.5" />
    {/* hanging steps + trapezoid cap */}
    <path d="M 179.5 270 L 179.5 282.5 L 282 282.5 L 282 270" fill="none" stroke={C.red} strokeWidth="4" />
    <path d="M 194.5 282.5 L 264.5 282.5 L 252.5 310 L 207 310 Z" fill="none" stroke={C.red} strokeWidth="4" />
    {/* right white building w/ comb marks + rail */}
    <path d="M 312 0 L 312 157 Q 312 165 320 165 L 369 165 Q 377 165 377 157 L 377 0" fill="none" stroke={WHT} strokeWidth="3.5" />
    {[0, 1, 2, 3].map((r) => (
      <path key={r} d={`M 362 ${47 + r * 14} L 334 ${47 + r * 14} L 334 ${57 + r * 14} L 362 ${57 + r * 14}`} fill="none" stroke={WHT} strokeWidth="3" />
    ))}
    <path d="M 320 120 L 354 120" fill="none" stroke={WHT} strokeWidth="3" />
    {[0, 1, 2, 3].map((c) => (
      <line key={c} x1={324 + c * 9} y1={120} x2={324 + c * 9} y2={135} stroke={WHT} strokeWidth="3" />
    ))}
    {/* small hanging box right of the 20:00 tick (ref f900) */}
    <rect x={392} y={-4} width={32} height={80} fill="none" stroke={WHT} strokeWidth="3.5" />
  </svg>
);

// ─── S6: pay-in schedule 00:00 (f923..1176) ───
// Arrival: navy sweeps in from top-right f923..930 (no crossfade); the band
// ticks + red 00:00 line pan in from the right, decelerating (red line
// x630@f930 → x293@f940 measured). Exit: the camera dives into the doc's
// last blue bar f1152..1176 (zoom, focus 1016,755) — S7's blue field IS
// that bar.
export const S6Schedule: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 923 || frame >= 1177) return null;
  // navy arrival sweep now lives in S5Skyline (so passed ticks repaint
  // white above it); from f938 S6 owns the whole frame
  const panIn = lutS([[928, 803], [929, 480], [930, 337], [932, 159], [934, 71], [936, 25], [938, 3], [940, 0]])(frame);
  // ── r4 measured arrival (work/cls-day/r4) ──
  // The S6 chain replaces the S5 chain behind a right→left front (S5 16:00
  // white @597 f928 while S6 23:00 already shows @854); the S6 band rides
  // the S5 band's morph (y152 static was floating in the sky f929..937).
  const front = lutS([
    [926, 1920], [928, 760], [929, 610], [930, 428], [932, 202], [934, 90],
    [936, 32], [938, 4], [940, 0],
  ])(frame);
  const sxDup = lutS([[928, 0.803], [930, 0.73], [932, 0.676], [934, 0.664], [936, 0.6615], [940, 0.66]])(frame);
  const syDup = lutS([[928, 0.776], [930, 0.718], [932, 0.671], [934, 0.647], [938, 0.647], [940, 0.635]])(frame);
  const riseC6 = lutS([[928, 327], [930, 250.5], [932, 214.5], [934, 195.5], [936, 185.5], [938, 179.5], [940, 179]])(frame);
  const s6x = frame < 941 ? (301.5 * sxDup) / 199 : 1;
  const s6y = frame < 941 ? (85 * syDup) / 54 : 1;
  const bandTop6 = frame < 941 ? riseC6 - 42.5 * syDup : 152;
  // big text: digits h228→206 (fs≈287), cap-top 754→635, arriving clipped
  // at the window front (=00:00 line); old 130px/y585 was half the ref size
  const textP = interpolate(frame, [929, 932], [0, 1], clamp);
  const tScale = lutS([[930, 1.107], [932, 1.03], [936, 1.005], [938, 1]])(frame);
  const tTop = lutS([[930, 754], [932, 697], [934, 663], [936, 646], [938, 638], [940, 635]])(frame);
  const tLeft = lutS([[930, 407], [934, 399], [936, 393], [938, 380], [944, 358]])(frame);
  // text exit: slides left INTO the 00:00 line clip (right edge 1105@990 →
  // 1010@995 → 361@1000; left edge pinned at the x293 clip throughout)
  const textX = lutS([[990, 0], [995, -95], [1000, -744], [1005, -1315]])(frame);
  // right preview: WHITE label + red band tick, both sliding in from the
  // right with the morph (screen-measured tick 1691@934 → 1586@940) +
  // red drop line under the tick appearing f938..944
  const pOut = interpolate(frame, [997, 1002], [1, 0], clamp); // gone by f1003 (probed)
  const pP = interpolate(frame, [930, 936], [0, 1], clamp) * pOut;
  const pTop = lutS([[932, 483], [934, 457], [936, 442], [940, 434]])(frame);
  const pLeft = lutS([[932, 1811], [934, 1692], [936, 1638], [938, 1610], [940, 1602]])(frame);
  const tickX = lutS([[930, 1905], [932, 1785], [934, 1691], [936, 1626], [938, 1596], [940, 1586]])(frame);
  const lineP = interpolate(frame, [938, 944], [0, 1], clamp);
  // ── doc-phase camera push f1002..1020 (measured): the whole band zooms
  // (pitch 199→244.75, h→66.4) and rises off the top (y152→-9.4) while
  // the 00:00 red line grows to the doc bottom (931) at x≈304
  const bandY6 = lutS([
    [1000, 152], [1006, 138], [1008, 120], [1010, 70], [1012, 22], [1014, 4], [1017, -7], [1020, -9.4],
  ])(frame);
  const pph6 = lutS([[1006, 199], [1008, 208.4], [1010, 222], [1012, 235.6], [1014, 241], [1018, 244.75]])(frame);
  const x006 = lutS([[1006, 293], [1010, 296], [1013, 304], [1020, 303.75]])(frame);
  const zb = pph6 / 199;
  const docLineTop = lutS([[1002, 152], [1014, 0]])(frame);
  const docLineBot = lutS([[1002, 207], [1008, 560], [1016, 931]])(frame);
  const docP = interpolate(frame, [988, 1015], [0, 1], { ...clamp, easing: EASE });
  const axisP = interpolate(frame, [1025, 1042], [0, 1], clamp);
  // exit zoom into the last bar (blue-area growth table, f1152..1176)
  const zoomS = lutS([[1152, 1], [1156, 1.35], [1158, 1.7], [1160, 2.1], [1162, 2.7], [1164, 4], [1166, 7], [1168, 11], [1170, 15], [1172, 20], [1176, 26]])(frame);
  const bars = [0, 1, 2, 3, 4];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${zoomS})`, transformOrigin: "1016px 755px" }}>
        {/* navy field (the arrival sweep itself is painted by S5Skyline) */}
        {frame >= 938 && <div style={{ position: "absolute", inset: 0, background: C.navyBg }} />}
        {/* NOTE: the clip wrapper MUST be a full-frame box — clip-path
            inset() on a zero-height plain div clips everything away
            (this exact bug hid the whole band f929..940 through r2/r3) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: frame >= 927 ? 1 : 0,
            clipPath: frame < 941 ? `inset(0 0 0 ${front}px)` : undefined,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `translate(${panIn + 293 - s6x * 293}px, ${bandTop6 - s6y * 152}px) scale(${s6x}, ${s6y})`,
              transformOrigin: "0 0",
            }}
          >
            <TimelineBand
              y={bandY6}
              h={54 * zb}
              originX={x006}
              originHour={24}
              pxPerHour={pph6}
              ink="#FDFDFD"
              labelSize={32 * zb}
              tickBelow={24 * zb}
            />
            {/* red 00:00 line: grows down with the arriving window
                (bottom 641@930 → 913@936, measured), then SNAPS to the
                band tick at f938 — the settled state has NO long line
                (probed f950/f1000: red rows 152..207 only). From f1002
                it regrows to the doc bottom while the band rises off. */}
            {frame >= 929 && frame < 1002 && (
              <Milestone
                x={293}
                lineTop={152}
                lineBottom={
                  frame < 938
                    ? lutS([[929, 422], [930, 524.6], [932, 806], [934, 875.7], [936, 893.4], [937, 895]])(frame)
                    : 207
                }
              />
            )}
            {frame >= 1002 && (
              <div
                style={{ position: "absolute", left: x006, top: docLineTop, width: 4.6, height: docLineBot - docLineTop, background: C.marker }}
              />
            )}
          </div>
        </div>
        {/* 06:30 preview (screen-measured: tick + label slide in from the
            right while the band morphs; tick rides the band's y) */}
        <div style={{ opacity: pP }}>
          <div style={{ position: "absolute", left: tickX, top: bandTop6, width: 5, height: 54 * s6y, background: C.marker }} />
          <div style={{ position: "absolute", left: pLeft, top: pTop - 8, fontFamily: pack.sans, fontSize: 40, color: "#FDFDFD", lineHeight: "42px" }}>
            {pack.milestones.m0630.label.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        </div>
        <div style={{ position: "absolute", left: tickX, top: bandTop6 + 54 * s6y, width: 5, height: 501 - (bandTop6 + 54 * s6y), background: C.marker, opacity: lineP * pOut }} />
        <div
          style={{
            opacity: textP,
            transform: `translateX(${textX}px)`,
            clipPath: frame < 941 || frame >= 985 ? `inset(0 0 0 ${panIn + 293}px)` : undefined,
            position: "absolute",
            inset: 0,
          }}
        >
          <div style={{ position: "absolute", left: tLeft, top: tTop, transform: `scale(${tScale})`, transformOrigin: "0 0" }}>
            {/* digits: ref glyphs 355..1112 × 626..848 ⇒ fs 308 (calibrated
                against our f950 render: 287 came out 7% small) */}
            <div style={{ position: "absolute", left: -23, top: -60, fontFamily: pack.sans, fontWeight: 700, fontSize: 308, lineHeight: 1, color: "#FCFCFC" }}>
              {pack.milestones.m0000.time}
            </div>
            <div style={{ position: "absolute", left: 0, top: 222, fontFamily: pack.sans, fontSize: 59, lineHeight: 1, color: "#FCFCFC", whiteSpace: "nowrap" }}>
              {pack.milestones.m0000.label.join(" ")}
            </div>
          </div>
        </div>
        {/* schedule document with gantt — measured (310,260) 966×671 */}
        {docP > 0 && frame >= 988 && (
          <SchedDoc frame={frame} docP={docP} axisP={axisP} bars={bars} x={310} y={260} w={966} h={671} dark />
        )}
      </div>
    </div>
  );
};

export const SchedDoc: React.FC<{
  frame: number;
  docP: number;
  axisP: number;
  bars: number[];
  x: number;
  y: number;
  w: number;
  h: number;
  dark?: boolean;
  fillFrom?: number;
}> = ({ frame, docP, axisP, bars, x, y, w, h, dark, fillFrom = 1055 }) => {
  const ink = dark ? "#FDFDFD" : C.navyDeep;
  // bar rects measured on ref f1142, as fractions of the 966×671 page;
  // the last bar is double height — it is the S7 zoom target.
  const RECTS: [number, number, number, number][] = [
    [0.0838, 0.2578, 0.1014, 0.0537],
    [0.1988, 0.3487, 0.2143, 0.0537],
    [0.4203, 0.4531, 0.1004, 0.0537],
    [0.557, 0.5633, 0.1014, 0.0537],
    [0.6791, 0.6796, 0.1046, 0.1163],
  ];
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity: docP }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {/* page outline w/ top-right fold */}
        <path
          d={`M 4 ${h - 4} L 4 4 L ${w - w * 0.1} 4 L ${w - 4} ${w * 0.1} L ${w - 4} ${h - 4} Z`}
          fill="none"
          stroke={ink}
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path d={`M ${w - w * 0.1} 4 L ${w - w * 0.1} ${w * 0.1} L ${w - 4} ${w * 0.1}`} fill="none" stroke={ink} strokeWidth="4" />
        {/* axis with hanging ticks */}
        {axisP > 0 && (
          <g opacity={axisP}>
            <line x1={w * 0.078} y1={h * 0.115} x2={w * 0.787} y2={h * 0.115} stroke={ink} strokeWidth="3" />
            {Array.from({ length: 8 }, (_, i) => (
              <line
                key={i}
                x1={w * 0.078 + i * (w * 0.1)}
                y1={h * 0.115}
                x2={w * 0.078 + i * (w * 0.1)}
                y2={h * 0.164}
                stroke={ink}
                strokeWidth="2.5"
              />
            ))}
          </g>
        )}
        {/* bars staircase */}
        {bars.map((b) => {
          const [fx, fy, fw, fh] = RECTS[b];
          const outlineAt = fillFrom - 25 + b * 8;
          // fills cascade left→right f1058..1075 (per-bar blue probed:
          // bars 0-1 full @1064, bar2 partial, bar4 grows 1066→1075)
          const fillAt = fillFrom + 3 + b * 2.2;
          if (frame < outlineAt) return null;
          const fillP = interpolate(frame, [fillAt, fillAt + (b === 4 ? 9 : 6)], [0, 1], clamp);
          return (
            <rect
              key={b}
              x={fx * w}
              y={fy * h}
              width={fw * w}
              height={fh * h}
              rx={h * 0.0537 * 0.3}
              fill={C.blue}
              fillOpacity={fillP}
              stroke={ink}
              strokeWidth="3"
            />
          );
        })}
        {/* footer text lines */}
        <line x1={w * 0.09} y1={h * 0.865} x2={w * 0.8} y2={h * 0.865} stroke={ink} strokeWidth="3" />
        <line x1={w * 0.09} y1={h * 0.915} x2={w * 0.62} y2={h * 0.915} stroke={ink} strokeWidth="3" />
        <line x1={w * 0.09} y1={h * 0.96} x2={w * 0.16} y2={h * 0.96} stroke={ink} strokeWidth="3" />
        <line x1={w * 0.18} y1={h * 0.96} x2={w * 0.23} y2={h * 0.96} stroke={ink} strokeWidth="3" />
      </svg>
    </div>
  );
};

// ─── S7: netting donuts (f1170..1466) ───
// Measured: grey ring draws in at (958,517) f1170..1188, slides right to
// (1352,517) f1192..1212 (outer R 355, thick 131); one big icon circle
// r237 at (511,511), later two r150 circles; no dashed connectors.
export const S7Netting: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 1170 || frame >= 1478) return null;
  const bgP = interpolate(frame, [1170, 1174], [0, 1], clamp);
  const outP = interpolate(frame, [1464, 1476], [0, 1], clamp);
  const ringIn = lutS([[1170, 0.05], [1172, 0.115], [1174, 0.26], [1176, 0.7], [1178, 0.86], [1180, 0.94], [1182, 0.975], [1188, 1]])(frame);
  const cx = interpolate(frame, [1192, 1212], [958, 1352], { ...clamp, easing: EASE });
  const cy = 517;
  // phases
  const p96 = interpolate(frame, [1240, 1285], [0, 0.96], { ...clamp, easing: EASE });
  const p99 = interpolate(frame, [1345, 1385], [0.96, 0.99], clamp);
  const progress = frame < 1240 ? 0 : frame < 1345 ? p96 : p99;
  const pct = frame < 1248 ? pack.percents[0] : frame < 1352 ? pack.percents[1] : pack.percents[2];
  const icon1P = interpolate(frame, [1238, 1250], [0, 1], clamp);
  const splitP = interpolate(frame, [1352, 1364], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", inset: 0, background: C.blue, opacity: bgP * (1 - outP) }}>
      <Donut
        cx={cx}
        cy={cy}
        r={289.5}
        thick={131}
        progress={progress}
        pct={frame >= 1230 ? pct : ""}
        ringBg={C.donutGrey}
        ringFg={C.navyBg}
        center="none"
        textColor="#FCFCFC"
        fontSize={130}
        bgSweep={ringIn}
      />
      {progress > 0.2 && <MarkerTriangle x={cx} y={cy - 289.5 - 131 / 2 - 52} size={40} />}
      {/* icon circles (one big, then two) */}
      {icon1P > 0 && splitP < 1 && <NetIcon x={511} y={511} r={237} p={icon1P * (1 - splitP)} kind="in" />}
      {splitP > 0 && (
        <>
          <NetIcon x={516} y={313} r={150} p={splitP} kind="in" />
          <NetIcon x={515} y={721} r={150} p={splitP} kind="out" />
        </>
      )}
    </div>
  );
};

const NetIcon: React.FC<{ x: number; y: number; r: number; p: number; kind: "in" | "out" }> = ({ x, y, r, p, kind }) => {
  const s = r / 110; // glyph scale
  return (
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <circle cx={x} cy={y} r={r} fill="none" stroke="#FDFDFD" strokeWidth={4} />
        {/* chip stack glyph */}
        <g transform={`translate(${x} ${y}) scale(${s}) translate(-56 -40)`}>
          {[0, 1, 2].map((row) => (
            <rect key={row} x={0} y={row * 30} width={58} height={21} rx={9} fill="none" stroke="#FDFDFD" strokeWidth={3.5} />
          ))}
          {kind === "in" ? (
            <path d="M 68 12 L 102 12 M 90 0 L 102 12 L 90 24 M 68 42 L 96 42 M 68 72 L 88 72" stroke="#FDFDFD" strokeWidth={4.5} fill="none" />
          ) : (
            <path d="M 102 12 L 68 12 M 80 0 L 68 12 L 80 24 M 68 42 L 96 42" stroke="#FDFDFD" strokeWidth={4.5} fill="none" />
          )}
        </g>
      </svg>
    </div>
  );
};
