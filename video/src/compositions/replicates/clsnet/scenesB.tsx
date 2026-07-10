import React from "react";
import { AbsoluteFill } from "remotion";
import { C, CITIES, MATCH, STRIP, STRIP_ENTRY, STRIP_PILLS, SEG } from "./data";
import { ART } from "./art";
import { useBrand, useCopy } from "./brand";
import { TracedArt } from "./TracedArt";
import { interpolate } from "remotion";
import { Badge, ClsNetBox, Doc, Elbow, Hexagon, Pill, SansText, SerifLabel, clamp, lerp } from "./ui";

// ═══ Scenes 9-10: two cities + currency pairs (f913-1302) ═══
export const CitiesScene: React.FC<{ frame: number }> = ({ frame }) => {
  const COPY = useCopy();
  const f = frame;
  if (f < SEG.citiesIntro[0] || f >= SEG.hexify[0] + 30) return null;
  const aOp = lerp(f, [915, 925], [0, 1]);
  const bOp = lerp(f, [950, 960], [0, 1]);
  const badgeOp = lerp(f, [1000, 1012], [0, 1]);
  // cities shrink to small state f1040-1075; the ground lines RISE with them
  // (fr_1150: line1 380, line2 938, badge B at 770, cityA center ~525)
  const s = lerp(f, [1040, 1075], [1, CITIES.smallScale]);
  const line1 = lerp(f, [1040, 1075], [CITIES.line1, 380]);
  const line2 = lerp(f, [1040, 1075], [CITIES.line2, 938]);
  const badgeBcy = lerp(f, [1040, 1075], [CITIES.badgeB.cy, 770]);
  const aX = lerp(f, [1040, 1075], [CITIES.cityA.x, 525 - (CITIES.cityA.w * CITIES.smallScale) / 2]);
  const bX = lerp(f, [1040, 1075], [CITIES.cityB.x, CITIES.bSmallCx - (CITIES.cityB.w * CITIES.smallScale) / 2]);
  // hexify: everything fades as hex scene takes over (f1302-1330)
  const out = lerp(f, [1302, 1326], [1, 0]);

  // active currency pair
  const sched = COPY.pairSchedule;
  let pair = sched[0];
  for (const p of sched) if (f >= p.from) pair = p;
  const pairOp =
    lerp(f, [1075, 1088], [0, 1]) *
    // dip at each swap
    Math.min(
      1,
      ...sched.slice(1).map((p) => 0.25 + Math.abs(f - p.from) / 8),
    );

  const stacksOp = lerp(f, [1085, 1100], [0, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: C.white, opacity: out }}>
      {/* horizon lines */}
      <div style={{ position: "absolute", left: 0, top: line1, width: 1920, height: 3, backgroundColor: C.navy, opacity: aOp }} />
      <div style={{ position: "absolute", left: 0, top: line2, width: 1920, height: 3, backgroundColor: C.navy, opacity: bOp }} />
      {/* cities (anchor to their ground lines while scaling) */}
      <div style={{ position: "absolute", left: aX, top: line1 - CITIES.cityA.h * s + 2, opacity: aOp }}>
        <TracedArt name="cityA" scale={s} />
      </div>
      <div style={{ position: "absolute", left: bX, top: line2 - CITIES.cityB.h * s + 2, opacity: bOp }}>
        <TracedArt name="cityB" scale={s} />
      </div>
      <Badge letter="A" cx={CITIES.badgeA.cx} cy={CITIES.badgeA.cy} opacity={badgeOp} />
      <Badge letter="B" cx={CITIES.badgeB.cx} cy={badgeBcy} opacity={badgeOp} />
      {/* pair labels hug the lines (fr_1150: cap −66 above, +5 below) */}
      <SerifLabel text={pair.top} x={1650} capTop={line1 - 66} fs={CITIES.pairFs} color={C.serifNavy} opacity={pairOp} />
      <SerifLabel text={pair.bottom} x={1650} capTop={line1 + 5} fs={CITIES.pairFs} color={C.orangeDeep} opacity={pairOp} />
      <SerifLabel text={pair.bottom} x={110} capTop={line2 - 66} fs={CITIES.pairFs} color={C.serifNavy} opacity={pairOp} />
      <SerifLabel text={pair.top} x={110} capTop={line2 + 5} fs={CITIES.pairFs} color={C.orangeDeep} opacity={pairOp} />
      {/* pill stacks at measured column centers (fr_1150) */}
      {stacksOp > 0 && (
        <>
          <PairStacks cols={PAIR_COLS_R} lineY={line1} f={f} base={1085} opacity={stacksOp} />
          <PairStacks cols={PAIR_COLS_L} lineY={line2} f={f} base={1095} opacity={stacksOp} />
        </>
      )}
    </AbsoluteFill>
  );
};

const TAN_LIGHT = "#F0DCC9";
type PairCol = { x: number; up: string[]; dn: string[] };
// bottom-up per column; first entry renders taller (the accent pill on the line)
const PAIR_COLS_R: PairCol[] = [
  { x: 1222, up: [C.steel, C.steel, C.steel, C.steel], dn: [C.orangeDeep, C.tan, TAN_LIGHT] },
  { x: 1332, up: [C.pillNavy, C.steelDark, C.steel, C.steel, C.steel], dn: [C.tan, C.tan, TAN_LIGHT] },
  { x: 1442, up: [C.steelDark, C.steel, C.steel], dn: [C.tan, TAN_LIGHT] },
];
const PAIR_COLS_L: PairCol[] = [
  { x: 392, up: [C.steel, C.steel, C.steel], dn: [C.tan, TAN_LIGHT] },
  { x: 507, up: [C.pillNavy, C.steelDark, C.steel], dn: [C.orangeDeep, C.tan, TAN_LIGHT] },
  { x: 617, up: [C.pillNavy, C.steel, C.steelDark, C.steel], dn: [C.orangeDeep, C.tan, TAN_LIGHT] },
];

const PairStacks: React.FC<{
  cols: PairCol[];
  lineY: number;
  f: number;
  base: number;
  opacity: number;
}> = ({ cols, lineY, f, base, opacity }) => (
  <>
    {cols.map((col, si) => {
      const n = Math.max(0, Math.floor((f - base - si * 5) / 6));
      let yu = lineY - 6;
      let yd = lineY + 8;
      return (
        <React.Fragment key={si}>
          {col.up.slice(0, n).map((c2, i) => {
            const h = i === 0 ? 42 : 28;
            yu -= h + 8;
            return <Pill key={`u${i}`} x={col.x - 28} y={yu + 8} w={56} h={h} color={c2} opacity={opacity} />;
          })}
          {col.dn.slice(0, n).map((c2, i) => {
            const h = i === 0 ? 42 : 28;
            const el = <Pill key={`d${i}`} x={col.x - 28} y={yd} w={56} h={h} color={c2} opacity={opacity} />;
            yd += h + 8;
            return el;
          })}
        </React.Fragment>
      );
    })}
  </>
);

// ═══ Scene 11: hexify + trade executed (f1302-1462) ═══
export const HexifyScene: React.FC<{ frame: number }> = ({ frame }) => {
  const COPY = useCopy();
  const f = frame;
  if (f < SEG.hexify[0] || f >= SEG.matching[0] + 20) return null;
  // hexagons draw around shrunken cities, then settle to final layout
  const drawP = lerp(f, [1306, 1330], [0, 1]);
  // A hex: large at (430,690) → settles (300,510); B: (1140,900) → (1660,510)
  const t = lerp(f, [1340, 1372], [0, 1]);
  const ax = 430 + (300 - 430) * t;
  const ay = 690 + (505 - 690) * t;
  const bx = 1140 + (1655 - 1140) * t;
  const by = 900 + (505 - 900) * t;
  const hexW = 260 - 30 * t;
  const labelOp = lerp(f, [1380, 1392], [0, 1]);
  const boxOp = lerp(f, [1385, 1398], [0, 1]);
  const docsP = lerp(f, [1412, 1450], [0, 1]);
  const out = lerp(f, [1462, 1476], [1, 0]);
  return (
    <AbsoluteFill style={{ backgroundColor: C.white, opacity: out }}>
      <HexCity art="cityA" cx={ax} cy={ay} w={hexW} drawP={drawP} artW={1150} />
      <HexCity art="cityB" cx={bx} cy={by} w={hexW} drawP={drawP} artW={1190} />
      <Badge letter="A" cx={ax - hexW * 0.42} cy={ay - hexW * 0.42} r={34} />
      <Badge letter="B" cx={bx + hexW * 0.42} cy={by - hexW * 0.42} r={34} />
      {/* Trade executed arrow */}
      {labelOp > 0 && (
        <>
          <SansText text={COPY.tradeExecuted} x={800} y={430} fs={34} color={C.serifNavy} opacity={labelOp} width={320} align="center" />
          <Elbow points={[[470, 505], [1480, 505]]} color={C.orange} opacity={labelOp} arrow="end" />
          <Elbow points={[[1480, 512], [470, 512]]} color={C.orange} opacity={labelOp} arrow="end" />
        </>
      )}
      {/* CLSNet box + docs flying in */}
      <ClsNetBox x={823} y={675} opacity={boxOp} />
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
}> = ({ art, cx, cy, w, drawP, artW }) => {
  const h = w * 0.906;
  const scale = (w * 0.92) / artW;
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
        <TracedArt name={art} x={w / 2 - (artW * scale) / 2} y={h * 0.62 - 0} scale={scale} style={{ top: undefined, bottom: h * 0.18 }} />
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
        <SmallHex art="cityA" cx={MATCH.hexA.cx} cy={MATCH.hexA.cy} w={MATCH.hexA.w} artW={1150} letter="A" />
        <SmallHex art="cityB" cx={MATCH.hexB.cx} cy={MATCH.hexB.cy} w={MATCH.hexB.w} artW={1190} letter="B" />
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
        <ClsNetBox x={MATCH.box.x} y={MATCH.box.y} w={MATCH.box.w} opacity={panelOp} labelFs={22} />
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
}> = ({ art, cx, cy, w, artW, letter, opacity = 1 }) => {
  if (opacity <= 0) return null;
  const h = w * 0.906;
  const scale = (w * 0.92) / artW;
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
        <div style={{ position: "absolute", left: w / 2 - (artW * scale) / 2, bottom: h * 0.16 }}>
          <TracedArt name={art} scale={scale} style={{ position: "relative" }} />
        </div>
      </div>
      <Hexagon cx={cx} cy={cy} w={w} />
      {letter && <Badge letter={letter} cx={cx - w * 0.38} cy={cy - w * 0.40} r={30} />}
    </div>
  );
};

// Edge time rulers (grey verticals + hour labels + orange hour lines)
export const EdgeRulers: React.FC<{ f: number }> = ({ f }) => {
  const { sans: SANS } = useBrand();
  const scroll = (f - 1462) * 1.35; // px downward drift
  const rows = Array.from({ length: 14 }, (_, i) => i);
  return (
    <>
      {[14, 1906].map((x, side) => (
        <div key={side} style={{ position: "absolute", left: x - 12, top: 0, width: 24, height: 1080, overflow: "visible" }}>
          <div style={{ position: "absolute", left: 10, top: 0, width: 4, height: 1080, backgroundColor: C.band }} />
          {rows.map((i) => {
            const y = ((i * 110 + scroll) % 1540) - 230;
            const hour = (26 - i + 24 * 10) % 24;
            const isOrange = hour % 4 === 1;
            return (
              <React.Fragment key={i}>
                <div
                  style={{
                    position: "absolute",
                    left: side === 0 ? 10 : -66,
                    top: y,
                    width: side === 0 ? 88 : 88,
                    height: isOrange ? 3 : 1.5,
                    backgroundColor: isOrange ? C.orangeDeep : C.navy,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: side === 0 ? 14 : -60,
                    top: y - 30,
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
  const growP = lerp(f, [1755, 1785], [0, 1]);
  const hexW = 230 + 170 * growP;
  const hexAx = 415 + (640 - 415) * growP;
  const hexBx = 1512 + (1290 - 1512) * growP;
  const hexY = 400 + (330 - 400) * growP;
  const docOp = lerp(f, [1800, 1815], [0, 1]);
  const lockClosedP = f >= 1868 ? 1 : 0;
  // no exit fade: ref keeps the locks layout intact until the strip's band
  // wipe (1909-1930) has fully covered it (measured: content static at f1914)
  return (
    <AbsoluteFill style={{ backgroundColor: C.white }}>
      <EdgeRulers f={f} />
      {phase1 && (
        <>
          <ClsNetBox x={823} y={620} opacity={lerp(f, [1662, 1672], [0, 1])} />
          <Doc x={610} y={640} w={110} h={135} opacity={lerp(f, [1668, 1680], [0, 1])} />
          <Doc x={1200} y={640} w={110} h={135} opacity={lerp(f, [1668, 1680], [0, 1])} />
          <Elbow points={[[560, 700], [415, 700], [415, 520]]} arrow="end" opacity={lerp(f, [1690, 1705], [0, 1])} />
          <Elbow points={[[1360, 700], [1512, 700], [1512, 515]]} arrow="end" opacity={lerp(f, [1690, 1705], [0, 1])} />
        </>
      )}
      <SmallHex art="cityA" cx={hexAx} cy={hexY} w={hexW} artW={1150} letter="A" />
      <SmallHex art="cityB" cx={hexBx} cy={hexY} w={hexW} artW={1190} letter="B" />
      {/* orange rising lines under hexes */}
      {!phase1 && (
        <>
          <Elbow points={[[hexAx, 1080], [hexAx, hexY + hexW * 0.5 + 250]]} opacity={docOp} />
          <Elbow points={[[hexBx, 1080], [hexBx, hexY + hexW * 0.5 + 250]]} opacity={docOp} />
          <DocWithLock x={hexAx - 70} y={hexY + 210} closed={lockClosedP} opacity={docOp} />
          <DocWithLock x={hexBx - 70} y={hexY + 210} closed={lockClosedP} opacity={docOp} />
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
      <Doc x={0} y={0} w={130} h={160} />
      <TracedArt
        name={closed >= 1 ? "lockClosed" : "lockList"}
        x={60}
        y={70}
        scale={0.32}
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

  // ref pushes the whole strip up (no fade): measured -200px at f2133, quad-in
  const pushT = lerp(f, [2127, 2141], [0, 1]);
  const pushY = -1080 * pushT * pushT;
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
      {/* night half */}
      <div style={{ position: "absolute", left: 0, top: bandBot, width: 1920, height: 1080 - bandBot, backgroundColor: C.navy }} />
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
