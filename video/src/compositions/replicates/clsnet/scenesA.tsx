import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { C, TITLE, HEXROW, FLOWS, GLOBE, MAP, SEG, W, H } from "./data";
import { useBrand, useCopy } from "./brand";
import { TracedArt } from "./TracedArt";
import { ClsNetBox, HexIcon, SansText, SerifLabel, clamp, lerp } from "./ui";

// ═══ Scene 1: Title (f0-150) ═══
// CLSNet reveals right-to-left; CLS logo + tagline fade; supporting text;
// principle cards slide-fade in with transient loader bars; outro = slight
// CCW tilt + white diagonal wipe (f130-150).
// In endcard mode the SAME layout assembles element by element on navy
// (measured fr_3966/fr_3981/fr_4011): logo 3957-3977, wordmark reveal
// 3959-3973, supporting 3974-3980, card 35 as bar→body 3978-3996, card 50
// 3997-4013.
export const TitleCard: React.FC<{ frame: number; endcard?: boolean }> = ({
  frame,
  endcard = false,
}) => {
  const { copy: COPY, serif: SERIF, logoArt, logoText } = useBrand();
  const f = frame;
  // ── Intro reveal, all timings ink-scanned from the exact ref video
  // (work/clsnet/anim). The logo lockup DRAWS ITSELF IN: swirl mark first
  // (f0-6), the CLS letters wipe LEFT→RIGHT (f4-20: C→CL→CLS), the tagline
  // fades (f16-24). The wordmark reveals RIGHT→LEFT (f5-14, ~"…et" at f8,
  // whole by f14 — measured leftmost-ink column, was a too-fast f0-11 wipe).
  // The two Principle cards GROW out of a loader bar, staggered (card35
  // f23-31, card50 f43-52), content filling AFTER each box grows.
  const logoOp = endcard ? lerp(f, [3957, 3977], [0, 1]) : lerp(f, [2, 18], [0, 1]); // text-logo fallback (CRX)
  const markOp = endcard ? lerp(f, [3957, 3963], [0, 1]) : lerp(f, [0, 6], [0, 1]);
  const lettersWipe = endcard ? lerp(f, [3960, 3974], [0, 1]) : lerp(f, [4, 20], [0, 1]);
  const taglineOp = endcard ? lerp(f, [3974, 3980], [0, 1]) : lerp(f, [17, 24], [0, 1]);
  // supporting line ("Supporting adherence to the FX Global Code:") ink-ramps
  // f20-28 in the ref (8→61→165→203 at f18/22/24/26).
  const supportOp = endcard ? lerp(f, [3974, 3980], [0, 1]) : lerp(f, [20, 28], [0, 1]);
  const wordP = endcard
    ? lerp(f, [3959, 3973], [0, 1])
    : interpolate(f, [5, 6, 8, 10, 12, 14], [0, 0.01, 0.14, 0.63, 0.82, 1], clamp);
  const card1Op = endcard ? lerp(f, [3979, 3983], [0, 1]) : lerp(f, [20, 23], [0, 1]);
  const card2Op = endcard ? lerp(f, [3998, 4002], [0, 1]) : lerp(f, [40, 43], [0, 1]);
  const card1Grow = endcard ? lerp(f, [3982, 3990], [0, 1]) : lerp(f, [23, 30], [0, 1]);
  const card2Grow = endcard ? lerp(f, [4001, 4008], [0, 1]) : lerp(f, [43, 51], [0, 1]);
  const card1Parts = endcard
    ? { kicker: lerp(f, [3985, 3990], [0, 1]), num: lerp(f, [3988, 3993], [0, 1]), strip: lerp(f, [3991, 3996], [0, 1]) }
    : { kicker: lerp(f, [26, 31], [0, 1]), num: lerp(f, [28, 32], [0, 1]), strip: lerp(f, [30, 34], [0, 1]) };
  const card2Parts = endcard
    ? { kicker: lerp(f, [4003, 4008], [0, 1]), num: lerp(f, [4005, 4010], [0, 1]), strip: lerp(f, [4008, 4013], [0, 1]) }
    : { kicker: lerp(f, [47, 51], [0, 1]), num: lerp(f, [49, 53], [0, 1]), strip: lerp(f, [50, 54], [0, 1]) };
  // bar1Op removed: it drew a spurious second grey bar at the card's bottom
  // edge that the ref never shows — the real card now grows out of its own
  // bar (growP), so the fake loader is redundant.
  const bar1Op = 0;
  const bar2Op = endcard ? 0 : lerp(f, [34, 38], [0, 1]) * lerp(f, [46, 52], [1, 0]);
  const wmBarOp = endcard ? 0 : lerp(f, [15, 18], [0, 1]) * lerp(f, [21, 24], [1, 0]);

  return (
    <AbsoluteFill style={{ backgroundColor: C.navy }}>
      {/* CLS logo (traced white art) + tagline */}
      {logoArt ? (
        // Staged draw-on over the measured traced lockup. Three disjoint
        // region-clips of the SAME traced asset — mark (art-x 0-71), CLS
        // letters (art-x 71-300, y 0-55), tagline (art-y 55-100) — so the
        // settled pixels are byte-unchanged and only the reveal is new.
        // 76.3% = (1 − 71/300); 23.7% = 71/300; 45% = 1 − 55/100. Letters
        // wipe L→R by shrinking the right inset from 76.3%→0.
        <>
          <TracedArt
            name={logoArt}
            x={TITLE.logo.x}
            y={TITLE.logo.y}
            scale={1}
            opacity={markOp}
            style={{ clipPath: "inset(0 76.3% 45% 0)" }}
          />
          <TracedArt
            name={logoArt}
            x={TITLE.logo.x}
            y={TITLE.logo.y}
            scale={1}
            opacity={lettersWipe > 0 ? 1 : 0}
            style={{ clipPath: `inset(0 ${(1 - lettersWipe) * 76.3}% 45% 23.7%)` }}
          />
          <TracedArt
            name={logoArt}
            x={TITLE.logo.x}
            y={TITLE.logo.y}
            scale={1}
            opacity={taglineOp}
            style={{ clipPath: "inset(55% 0 0 0)" }}
          />
        </>
      ) : (
        <div
          style={{
            position: "absolute",
            left: TITLE.logo.x,
            top: TITLE.logo.y,
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: 64,
            color: C.white,
            opacity: logoOp,
          }}
        >
          {logoText}
        </div>
      )}
      {/* Supporting line */}
      <SansText
        text={COPY.supporting}
        x={TITLE.supporting.x}
        y={TITLE.supporting.y}
        fs={TITLE.supporting.fs}
        color={C.white}
        opacity={supportOp}
      />
      {/* CLSNet wordmark — reveal right-to-left via clip */}
      <div
        style={{
          position: "absolute",
          // -8 = Georgia 'C' left side bearing at fs200 (ink left must land
          // at the measured x)
          left: TITLE.wordmark.x - 8,
          top: TITLE.wordmark.capTop - 0.14 * 200,
          width: TITLE.wordmark.right - TITLE.wordmark.x + 20,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontFamily: SERIF,
            fontWeight: 400,
            fontSize: 200,
            lineHeight: 1,
            color: C.white,
            // ref reveals the trailing letters first (t=0 shows only "t")
            clipPath: `inset(0 0 0 ${(1 - wordP) * 100}%)`,
            whiteSpace: "pre",
            // Georgia natural 669px at fs200 vs ref ink 653 (Playfair
            // needed 1.14; measured on the rendered still)
            transform: "scaleX(0.976)",
            transformOrigin: "left top",
          }}
        >
          {COPY.brand}
        </div>
      </div>
      {/* transient loader bar right of wordmark */}
      <div
        style={{
          position: "absolute",
          left: 930,
          top: 592,
          width: 200,
          height: 8,
          backgroundColor: "#5E6E8C",
          opacity: wmBarOp,
        }}
      />
      {/* Principle cards */}
      <PrincipleCard
        x={TITLE.card1.x}
        y={TITLE.card1.y}
        w={TITLE.card1.w}
        h={TITLE.card1.h}
        stripY={TITLE.card1.stripY}
        body={C.card35}
        strip={C.card35Strip}
        num={COPY.p35.num}
        kicker={COPY.p35.kicker}
        stripText={COPY.p35.strip}
        opacity={card1Op}
        growP={card1Grow}
        parts={card1Parts}
      />
      <PrincipleCard
        x={TITLE.card2.x}
        y={TITLE.card2.y}
        w={TITLE.card2.w}
        h={TITLE.card2.h}
        stripY={TITLE.card2.stripY}
        body={C.card50}
        strip={C.card50Strip}
        num={COPY.p50.num}
        kicker={COPY.p50.kicker}
        stripText={COPY.p50.strip}
        opacity={card2Op}
        growP={card2Grow}
        parts={card2Parts}
      />
      {/* transient loader bars under/next to cards */}
      <div style={{ position: "absolute", left: 875, top: 708, width: 430, height: 22, backgroundColor: "#8286A0", opacity: bar1Op }} />
      <div style={{ position: "absolute", left: 1340, top: 560, width: 300, height: 10, backgroundColor: C.card50Strip, opacity: bar2Op }} />
    </AbsoluteFill>
  );
};

export const PrincipleCard: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  stripY: number;
  body: string;
  strip: string;
  num: string;
  kicker: string;
  stripText: string;
  opacity?: number;
  // endcard assembly: body grows vertically out of a bar at y560 (fr_3981);
  // kicker/num/strip fade in separately
  growP?: number;
  parts?: { kicker: number; num: number; strip: number };
}> = ({ x, y, w, h, stripY, body, strip, num, kicker, stripText, opacity = 1, growP = 1, parts }) => {
  const { serif: SERIF, sans: SANS } = useBrand();
  if (opacity <= 0) return null;
  // bar rect in card-local coords: y 204-244 (screen 560-600)
  const bodyTop = 204 * (1 - growP);
  const bodyBottom = 244 + (h - 244) * growP;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity }}>
      <div style={{ position: "absolute", left: 0, top: bodyTop, width: w, height: bodyBottom - bodyTop, backgroundColor: body }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: stripY - y,
          width: w,
          height: h - (stripY - y),
          backgroundColor: strip,
          opacity: (parts?.strip ?? 1) * (growP >= 1 ? 1 : 0),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 26,
          top: 19,
          fontFamily: SERIF,
          // ref kicker ink 239x59 (887-1126, 380-439); Georgia fs62 lands it
          // (the r1 fs44 was ~30% small — Playfair-era, never re-measured)
          fontSize: 62,
          color: C.cardText,
          lineHeight: 1,
          opacity: parts?.kicker ?? 1,
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          position: "absolute",
          right: -5,
          top: stripY - y - 182,
          // Didot for the numerals: ref digits are LINING; Georgia's
          // oldstyle figures lose the digit A/B (0.403 vs Didot 0.317).
          // fs/right fitted on ink: ref '35' 249x173 ending 3px off the
          // card edge
          fontFamily: "Didot, 'Times New Roman', serif",
          fontSize: 220,
          lineHeight: 1,
          color: "rgba(230,232,240,0.55)",
          opacity: parts?.num ?? 1,
        }}
      >
        {num}
      </div>
      <div
        style={{
          position: "absolute",
          left: 24,
          top: stripY - y + 14,
          fontFamily: SANS,
          fontSize: 30,
          lineHeight: 1.15,
          color: C.navy,
          whiteSpace: "pre-wrap",
          opacity: (parts?.strip ?? 1) * (growP >= 1 ? 1 : 0),
        }}
      >
        {stripText}
      </div>
    </div>
  );
};

// Title outro: a white diagonal wipe sweeps in from the RIGHT (f139-152) while
// the title drifts UP, revealing the next scene behind. Measured from the exact
// ref video (work/clsnet/anim): the wordmark stays HORIZONTAL (no panel
// rotation — the old −10° tilt + left-wipe were invented) and its centroid
// rises ~57px by f142; the white/navy boundary is a diagonal whose LEFT edge
// (navy→white) sweeps top 1920→0 / bottom 1920→0, top leading. Clipping the
// title away (not painting a white rect) exposes the real RowsBuild/white bg.
export const TitleOutro: React.FC<{ frame: number; children: React.ReactNode }> = ({
  frame,
  children,
}) => {
  const dy = interpolate(frame, [136, 142, 150], [0, -50, -150], clamp);
  const dx = interpolate(frame, [136, 150], [0, 25], clamp);
  const edgeTop = interpolate(frame, [139, 142, 144, 146, 148, 150, 152], [W, 944, 928, 888, 744, 168, 0], clamp);
  const edgeBot = interpolate(frame, [139, 142, 144, 146, 148, 150, 152], [W, 840, 752, 568, 0, 0, 0], clamp);
  return (
    <AbsoluteFill
      style={{ clipPath: `polygon(0 0, ${edgeTop}px 0, ${edgeBot}px ${H}px, 0 ${H}px)` }}
    >
      <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px)` }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ═══ Scene 2: Rows build (f148-320) ═══
// r5 ground truth (dense-core column tracking, work/clsnet/r5/rows2): the four
// clusters rest in a STAIRCASE at ink-left 222/534/858/1354 (r1's 60/120/210
// were misplaced by 160-640px) and each settles ~200/224/241/266 — the scene
// then HOLDS static to the hexify morph. Entries slide in from the right with
// a fast decel (x keys measured per ~6f) while the art unveils (clip grow).
// Art-origin→ink offsets calibrated on the r4 render: +0/+3/+9/+260 (sail's
// left 260px bakes the helicopter+plane props, which ref flies separately but
// which land at our baked spots by f308 — documented static-prop spend).
const ROW_LINES = [220, 462, 765, 1035];
// static ground ticks measured at f280 (x, w, h), sitting on their line;
// they fade in with the row's cluster settle
const ROW_TICKS: [number, number, number][][] = [
  [[751, 2, 7], [788, 2, 7], [802, 2, 7], [907, 2, 7], [941, 2, 7], [957, 2, 7], [1381, 2, 7], [1476, 3, 7], [1484, 2, 7], [1622, 2, 7], [1778, 2, 7], [1812, 2, 7]],
  [[1015, 4, 14], [1054, 3, 13], [1105, 3, 13], [1115, 4, 14], [1126, 4, 14], [1149, 6, 14], [1170, 3, 13], [1216, 3, 13], [1357, 3, 14], [1371, 8, 14], [1393, 3, 13], [1414, 3, 13], [1427, 2, 13], [1461, 2, 13], [1522, 4, 14], [1561, 3, 14], [1601, 3, 13], [1611, 4, 13], [1620, 6, 14], [1659, 3, 14], [1671, 3, 13], [1750, 4, 14], [1766, 4, 14], [1805, 3, 13], [1856, 3, 13], [1866, 4, 14], [1903, 3, 14]],
  [[1475, 2, 9], [1490, 2, 9], [1642, 6, 10], [1691, 3, 9], [1744, 3, 10], [1791, 2, 9], [1843, 2, 9]],
  [[32, 2, 7], [58, 3, 7], [67, 2, 6], [104, 2, 6], [204, 2, 6], [242, 2, 6], [256, 2, 6], [385, 3, 7], [412, 3, 7], [420, 2, 6], [458, 2, 6], [487, 2, 7], [558, 2, 6], [595, 2, 6], [609, 3, 6], [1277, 3, 7], [1855, 3, 6]],
];
const ROW_SETTLE = [202, 226, 244, 268];
// xKeys place the TRACE-CROP origin (bank crop x280, office x575, towers
// x850, sail x1100 — regular_0025); entry deltas from the measured leading
// edge. rowBankL/rowOfficeL are the left blocks the r1 crops cut off — they
// LEAD each slide at a fixed dx.
const ROW_ART: {
  art: string;
  y: number;
  fKeys: number[];
  xKeys: number[];
  growEnd: number;
  left?: { art: string; dx: number; y: number };
}[] = [
  { art: "rowBank", y: 77, fKeys: [178, 184, 190, 196, 202], xKeys: [1888, 634, 432, 338, 280], growEnd: 198, left: { art: "rowBankL", dx: -62, y: 146 } },
  { art: "rowOffice", y: 253, fKeys: [194, 202, 208, 214, 220, 226], xKeys: [1142, 788, 662, 616, 586, 575], growEnd: 218, left: { art: "rowOfficeL", dx: -47, y: 379 } },
  { art: "rowTowers", y: 500, fKeys: [214, 220, 226, 232, 238, 244], xKeys: [1777, 1339, 1045, 897, 861, 850], growEnd: 236 },
  { art: "rowSail", y: 800, fKeys: [244, 250, 256, 262, 268], xKeys: [1412, 1246, 1118, 1100, 1100], growEnd: 262 },
];

// converge → compact-row targets (gen11, measured from the ref VIDEO
// f312-326): the four skylines slide off their four stacked lines into ONE
// compact horizontal row BEFORE any hexagon draws. Per-city converged art
// placement is ground-aligned to the compact row (each art_bottom = the
// measured orange ground 389/422/435/439) and x-aligned on the defining
// orange landmark (bank temple cx369, office tower cx770). Scale 0.88 (orange
// widths shrink 221→195 / 117→103). The wide outer buildings drop as the hex
// crops them — exactly the ref motion. cp is the ref temple-ground curve
// (slow f312-318, fast f318-322, settled f326).
const CONV_X = [214, 600, 897, 1150];
const CONV_Y = [261, 237, 202, 232];
const CONV_S = 0.88;
export const RowsBuild: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < SEG.rows[0] || f >= 340) return null;
  const lineP = lerp(f, [148, 162], [0, 1]);
  const cp = interpolate(f, [312, 318, 320, 322, 326], [0, 0.2, 0.77, 0.92, 1], clamp);
  // ground lines/ticks vanish as the cities lift off their lines (ref f320:
  // no full-width lines, just cities on a converging staircase)
  const lineFade = lerp(f, [311, 320], [1, 0]);
  // whole layer fades under the incoming hexes AFTER the converge lands, so
  // the hex art crossfades over cities already in position (not a dissolve).
  // Fast fade (323-333) so the WIDE row skylines don't linger and spill ghost
  // buildings between the hexes — the ref hexes are clean by f332.
  const out = lerp(f, [323, 333], [1, 0]);
  return (
    <AbsoluteFill style={{ backgroundColor: "transparent", opacity: out }}>
      {lineFade > 0 &&
        ROW_LINES.map((y, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              top: y,
              width: 1920 * lineP,
              height: 3,
              backgroundColor: C.navy,
              opacity: lineFade,
            }}
          />
        ))}
      {lineFade > 0 &&
        ROW_TICKS.map((ticks, li) => {
          const op = lerp(f, [ROW_SETTLE[li] - 6, ROW_SETTLE[li]], [0, 1]) * lineFade;
          if (op <= 0) return null;
          return (
            <React.Fragment key={`t${li}`}>
              {ticks.map(([tx, tw, th], k) => (
                <div key={k} style={{ position: "absolute", left: tx, top: ROW_LINES[li] - th, width: tw, height: th, backgroundColor: C.navy, opacity: op }} />
              ))}
            </React.Fragment>
          );
        })}
      {ROW_ART.map((r, i) => {
        if (f < r.fKeys[0]) return null;
        const xr = interpolate(f, r.fKeys, r.xKeys, clamp);
        const x = xr + (CONV_X[i] - xr) * cp;
        const y = r.y + (CONV_Y[i] - r.y) * cp;
        const scale = 1 + (CONV_S - 1) * cp;
        const grow = lerp(f, [r.fKeys[0], r.growEnd], [0, 1]);
        return (
          <React.Fragment key={i}>
            <TracedArt
              name={r.art}
              x={x}
              y={y}
              scale={scale}
              opacity={1}
              style={{
                clipPath: `inset(0 ${(1 - grow) * 60}% 0 ${(1 - grow) * 30}%)`,
              }}
            />
            {r.left && cp < 1 && (
              <TracedArt
                name={r.left.art}
                x={x + r.left.dx * scale}
                y={r.left.y + (CONV_Y[i] - r.y) * cp}
                scale={scale}
                opacity={1 - cp}
              />
            )}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

// ═══ Scene 3+4: hex row + CLSNet + flows (f320-462) ═══
const HEX_ARTS = ["hexBank", "hexOffice", "hexTowers", "hexSail"];
// r5: flows pill fields CC-scanned (x,y,w,h,color) — field1 at f395, field2 at
// f430. Colors: steel #8A9DB2 / mid #4B6686 / navy / orange #CC441E accents /
// tan #F0C8AF. Ruler band center y830 is the collapse origin.
type FlowPill = [number, number, number, number, string];
const FLOW_FIELD1: FlowPill[] = [
  [197, 703, 71, 31, "#8A9DB2"], [197, 738, 71, 31, "#8A9DB2"], [198, 774, 71, 26, "#8A9DB2"],
  [195, 846, 75, 43, "#CC441E"], [198, 896, 71, 30, "#F0C8AF"], [198, 931, 71, 30, "#F0C8AF"], [198, 966, 71, 30, "#F0C8AF"], [198, 1000, 72, 30, "#F0C8AF"],
  [375, 627, 71, 30, "#8A9DB2"], [373, 662, 74, 58, "#4B6686"], [375, 727, 71, 29, "#4B6686"], [374, 763, 74, 37, "#002753"],
  [375, 846, 71, 28, "#F0C8AF"], [376, 878, 71, 31, "#F0C8AF"], [376, 914, 71, 31, "#F0C8AF"], [376, 950, 71, 30, "#F0C8AF"],
  [565, 704, 71, 30, "#8A9DB2"], [565, 740, 71, 30, "#8A9DB2"], [566, 775, 71, 25, "#8A9DB2"],
  [565, 846, 75, 43, "#CC441E"], [568, 896, 71, 30, "#F0C8AF"], [568, 931, 71, 30, "#F0C8AF"],
  [1251, 706, 71, 30, "#8A9DB2"], [1251, 742, 71, 30, "#8A9DB2"], [1252, 777, 71, 23, "#8A9DB2"],
  [1250, 846, 72, 30, "#CC441E"], [1251, 880, 73, 32, "#CC441E"], [1252, 916, 71, 30, "#F0C8AF"], [1252, 951, 71, 30, "#F0C8AF"],
];
const FLOW_FIELD2: FlowPill[] = [
  [197, 654, 71, 30, "#8A9DB2"], [197, 688, 71, 30, "#8A9DB2"], [197, 726, 71, 30, "#8A9DB2"], [198, 761, 71, 30, "#8A9DB2"],
  [196, 846, 74, 44, "#CC441E"], [198, 896, 71, 30, "#F0C8AF"], [198, 932, 71, 30, "#F0C8AF"],
  [375, 625, 71, 30, "#8A9DB2"], [373, 661, 74, 58, "#4B6686"], [375, 726, 71, 30, "#4B6686"], [374, 763, 74, 37, "#002753"],
  [373, 846, 75, 54, "#CC441E"], [376, 907, 71, 29, "#F0C8AF"], [374, 944, 75, 58, "#CC441E"], [375, 1008, 73, 30, "#CC441E"], [376, 1041, 72, 31, "#F0C8AF"],
  [565, 576, 71, 29, "#8A9DB2"], [565, 609, 71, 30, "#8A9DB2"], [562, 645, 75, 58, "#4B6686"], [565, 710, 71, 30, "#4B6686"], [564, 747, 74, 53, "#002753"],
  [565, 846, 75, 44, "#CC441E"], [568, 896, 71, 30, "#F0C8AF"], [568, 932, 71, 30, "#F0C8AF"], [568, 967, 71, 31, "#F0C8AF"], [568, 1002, 72, 30, "#F0C8AF"],
  [1251, 671, 71, 29, "#8A9DB2"], [1251, 704, 71, 30, "#8A9DB2"], [1251, 742, 71, 30, "#8A9DB2"], [1252, 777, 71, 23, "#8A9DB2"],
  [1250, 846, 72, 29, "#F0C8AF"], [1252, 880, 71, 30, "#F0C8AF"], [1252, 918, 71, 30, "#F0C8AF"], [1252, 952, 71, 30, "#F0C8AF"],
];

export const HexRowFlows: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < SEG.hexRow[0] || f >= 468) return null;
  const inOp = lerp(f, [322, 334], [0, 1]);
  // box draws with the hexes (ref video: box bar starts ~f324, near-full by
  // f332); the old 330-344 left it a faint grey ghost through the hexify
  const boxOp = lerp(f, [324, 336], [0, 1]);
  // r6 measured exit (CLSNet-box left edge track): the whole layout slides
  // LEFT with acceleration, NO fade — content off by f466-467. Band stays.
  const shift = interpolate(
    f,
    [450, 452, 454, 456, 458, 460, 461, 462, 463, 464, 465, 466, 467],
    [0, -17, -51, -111, -206, -358, -466, -608, -803, -1068, -1418, -1888, -2400],
    clamp
  );

  // ruler + pills phase (f366+)
  const rulerP = lerp(f, [366, 384], [0, 1]);
  // pair labels flip with the pill pages (r5 ink-timeline: page1 out 406-412,
  // page2 in 419-428)
  const pairAOp = lerp(f, [364, 372], [0, 1]) * lerp(f, [406, 412], [1, 0]);
  const pairBOp = lerp(f, [420, 428], [0, 1]);

  return (
    <AbsoluteFill>
      {/* ruler band: STATIC — content slides off over it (r6 probed: band
          y805-843 stays put through the push; ticks ride the slide) */}
      {rulerP > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: FLOWS.rulerY,
            width: 1920 * rulerP,
            height: FLOWS.rulerH,
            backgroundColor: C.band,
          }}
        />
      )}
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${shift}px)` }}>
        {rulerP >= 1 &&
          Array.from({ length: 14 }, (_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: FLOWS.tickX0 + i * FLOWS.tickEvery,
                top: FLOWS.rulerY + 2,
                width: 2.5,
                height: 20,
                backgroundColor: C.navy,
              }}
            />
          ))}
        {/* hexagons */}
        {HEX_ARTS.map((a, i) => (
          <HexIcon
            key={a}
            art={a}
            cx={HEXROW.centers[i]}
            cy={HEXROW.cy}
            w={HEXROW.hexW}
            opacity={inOp}
          />
        ))}
        {/* CLSNet box */}
        <ClsNetBox x={HEXROW.box.x} y={HEXROW.box.y} opacity={boxOp} />
        {/* pill fields (r5: TWO static pages CC-scanned at f395/f430; the whole
            field collapses into the ruler 406-412 and the second pops out of
            it 419-428 — page flip, not continuous growth) */}
        {[FLOW_FIELD1, FLOW_FIELD2].map((field, fi) => {
          const sIn = fi === 0 ? lerp(f, [364, 372], [0.15, 1]) : lerp(f, [419, 428], [0.15, 1]);
          const sOut = fi === 0 ? 1 - Math.pow(lerp(f, [406, 412], [0, 1]), 2) : 1;
          const sc = sIn * sOut;
          // gen11: field0 sIn floors at 0.15 (r5), so the page leaked in at 15%
          // from f320 through the hexify — the ref has NO pills there. Gate it
          // to the flows phase (f>=363); r5's f364+ growth is untouched.
          if (sc <= 0 || (fi === 0 && (f < 363 || f >= 413)) || (fi === 1 && f < 419)) return null;
          return (
            <div key={fi} style={{ position: "absolute", inset: 0, transform: `scaleY(${sc})`, transformOrigin: "960px 830px" }}>
              {field.map(([x, y, w, h, color], i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: x,
                    top: y,
                    width: w,
                    height: h,
                    backgroundColor: color,
                    borderRadius: y < 819 ? "2px 13px 2px 13px" : "13px 2px 13px 2px",
                  }}
                />
              ))}
            </div>
          );
        })}
        {/* currency pair labels (flip with the pill pages) */}
        <SerifLabel text="USD" x={FLOWS.labelTop.x} capTop={FLOWS.labelTop.capTop} fs={FLOWS.labelTop.fs} color={C.serifNavy} opacity={pairAOp} />
        <SerifLabel text="CNH" x={FLOWS.labelBot.x} capTop={FLOWS.labelBot.capTop} fs={FLOWS.labelBot.fs} color={C.orangeDeep} opacity={pairAOp} />
        <SerifLabel text="EUR" x={FLOWS.labelTop.x} capTop={FLOWS.labelTop.capTop} fs={FLOWS.labelTop.fs} color={C.serifNavy} opacity={pairBOp} />
        <SerifLabel text="CZK" x={FLOWS.labelBot.x} capTop={FLOWS.labelBot.capTop} fs={FLOWS.labelBot.fs} color={C.orangeDeep} opacity={pairBOp} />
      </div>
    </AbsoluteFill>
  );
};

// ═══ Scene 5: Globe + lock (f462-566) ═══
export const GlobeScene: React.FC<{ frame: number }> = ({ frame }) => {
  const { sans: SANS } = useBrand();
  const f = frame;
  if (f < SEG.globe[0] - 10 || f >= SEG.globe[1] + 10) return null;
  // r6 measured entry (blue-disc bbox track): center 1762@468 → 958.5@482,
  // decelerating; fully off-screen before f464
  const slideIn = interpolate(
    f,
    [464, 466, 468, 470, 472, 474, 476, 478, 480, 482],
    [1750, 1250, 802, 465, 272, 152, 76, 33, 6, 0],
    clamp
  );
  // GLOBE ROTATION — real longitude scroll (anim round, eye-measured).
  // The ref globe is a disc-clipped WINDOW onto the SAME worldMap the scene
  // zooms into at f566+ (proven: the f562-566 disc continents == the f582 full
  // map). Its continents scroll RIGHTWARD, decelerating from ~5.5px/f at f486
  // to rest by ~f550 (2D phase-corr of the white-line masks: dy=0, ~206px
  // total; work/clsnet/anim/measure2d.py). The prior build CROSSFADED two disc
  // snapshots sliding LEFTWARD — invented motion AND the wrong direction.
  // Now: worldMap scaled 0.76 (grid-fit vs the f582 full map, score .88),
  // vertically centred (oy 174), x-origin scrolled per the measured ox table.
  const MAP_SCALE = 0.76;
  const mapOx = interpolate(
    f,
    [478, 486, 494, 502, 510, 518, 526, 534, 542, 550, 558],
    [300, 319, 362, 401, 435, 464, 487, 504, 516, 523, 525],
    clamp
  );
  const mapOy = 174;
  const ringSpin = lerp(f, [478, 566], [0, -38]);
  const lockState = f < 500 ? "lockOpen" : f < 528 ? "lockList" : "lockClosed";
  const lockOp = lerp(f, [470, 480], [0, 1]);
  // GLOBE→MAP ZOOM (anim round, eye-measured; work/clsnet/anim/zoom). The disc
  // is a WINDOW onto the same worldMap the MapScene shows in full. At the
  // handoff the disc GROWS to full-bleed (center pinned 960/539) while its map
  // ramps to MapScene's scale (0.76→1.0) and origin (→MAP.x/y), so continents
  // zoom SEAMLESSLY into the full map — the disc IS the zoom. Radius measured
  // clean from the disc's left edge (ring hides it ≤f561): r 293 held to f556,
  // then 424(f562) 569(f564) 830(f566) → full-bleed f568. Replaces the old
  // cross-dissolve (globe FADED out under an expanding blue rect + fading map).
  const dr = interpolate(
    f,
    [556, 558, 560, 562, 564, 566, 568],
    [GLOBE.r, 330, 375, 424, 569, 830, 1200],
    clamp
  );
  const mapScale = interpolate(f, [556, 568], [MAP_SCALE, 1], clamp);
  const mox = f < 556 ? mapOx : interpolate(f, [556, 568], [525, MAP.x], clamp);
  const moy = interpolate(f, [556, 568], [mapOy, MAP.y], clamp);
  const discLeft = GLOBE.cx - dr;
  const discTop = GLOBE.cy - dr;
  // ring fades as the disc grows over it. The triangle + lock are drawn BENEATH
  // the disc fill (below) so the growing disc OVERTAKES them — exactly the ref.
  const ringFade = lerp(f, [556, 561], [1, 0]);
  // r6 probed band choreography: drops y805→846 (468-480); right end retreats
  // with the globe to x~1028; holds to ~f506; reels IN rightward ~77px/f from
  // f508 until absorbed (~f521). Ticks ride both the landing decel + reel-in.
  const bandTop = interpolate(f, [468, 470, 472, 474, 476, 478, 480], [805, 809, 823, 835, 841, 844, 846], clamp);
  const tickDx = interpolate(f, [468, 470, 472, 474], [41, 16, 1, 0], clamp);
  const bandRight = interpolate(f, [468, 470, 472, 474, 476, 480, 486], [1831, 1493, 1299, 1179, 1103, 1032, 1028], clamp);
  const bandLeft = interpolate(f, [507.8, 521.5], [0, 1060], clamp);
  return (
    <AbsoluteFill>
      {f >= 468 && bandRight - bandLeft > 0 && (
        <>
          <div style={{ position: "absolute", left: bandLeft, top: bandTop, width: bandRight - bandLeft, height: 40, backgroundColor: C.band }} />
          {Array.from({ length: 14 }, (_, i) => {
            const x = FLOWS.tickX0 + i * FLOWS.tickEvery + tickDx + bandLeft;
            if (x < bandLeft - 3 || x > 820) return null;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: x,
                  top: bandTop + 2,
                  width: 2.5,
                  height: 20,
                  backgroundColor: C.navy,
                }}
              />
            );
          })}
        </>
      )}
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${slideIn}px)` }}>
        {/* ring: grey donut with ticks + time labels */}
        <svg
          width={2 * GLOBE.ringR + 40}
          height={2 * GLOBE.ringR + 40}
          viewBox={`0 0 ${2 * GLOBE.ringR + 40} ${2 * GLOBE.ringR + 40}`}
          style={{
            position: "absolute",
            left: GLOBE.cx - GLOBE.ringR - 20,
            top: GLOBE.cy - GLOBE.ringR - 20,
            opacity: ringFade,
          }}
        >
          <g transform={`rotate(${ringSpin} ${GLOBE.ringR + 20} ${GLOBE.ringR + 20})`}>
            <circle
              cx={GLOBE.ringR + 20}
              cy={GLOBE.ringR + 20}
              r={(GLOBE.ringR + GLOBE.r) / 2}
              fill="none"
              stroke={C.band}
              strokeWidth={GLOBE.ringR - GLOBE.r}
            />
            {Array.from({ length: 48 }, (_, i) => {
              const a = (i * Math.PI * 2) / 48;
              const long = i % 2 === 0;
              const r0 = GLOBE.r - 4;
              const r1 = long ? GLOBE.ringR + 14 : GLOBE.ringR - 4;
              return (
                <line
                  key={i}
                  x1={GLOBE.ringR + 20 + r0 * Math.sin(a)}
                  y1={GLOBE.ringR + 20 - r0 * Math.cos(a)}
                  x2={GLOBE.ringR + 20 + r1 * Math.sin(a)}
                  y2={GLOBE.ringR + 20 - r1 * Math.cos(a)}
                  stroke={C.navy}
                  strokeWidth={1.6}
                />
              );
            })}
            {["23:00", "00:00", "06:30", "07:00", "09:00"].map((t, i) => {
              const a = ((i * 47 - 8) * Math.PI) / 180;
              const rr = GLOBE.ringR + 28;
              return (
                <text
                  key={i}
                  x={GLOBE.ringR + 20 + rr * Math.sin(a)}
                  y={GLOBE.ringR + 20 - rr * Math.cos(a)}
                  fontFamily={SANS}
                  fontSize={20}
                  fill={C.navy}
                  transform={`rotate(${(a * 180) / Math.PI} ${GLOBE.ringR + 20 + rr * Math.sin(a)} ${GLOBE.ringR + 20 - rr * Math.cos(a)})`}
                >
                  {t}
                </text>
              );
            })}
          </g>
        </svg>
        {/* orange triangle marker (r6 probed f486: 60x52 at x931-991 y81-133) —
            drawn beneath the disc so the growing disc overtakes it */}
        <svg width={60} height={52} viewBox="0 0 60 52" style={{ position: "absolute", left: GLOBE.triangle.x - 30, top: GLOBE.triangle.y }}>
          <path d="M4,4 H56 L30,48 Z" fill="none" stroke={C.orange} strokeWidth={5} strokeLinejoin="round" />
        </svg>
        {/* lock — beneath the disc; covered as the disc grows past it */}
        <TracedArt name={lockState} x={GLOBE.lock.x} y={GLOBE.lock.y} opacity={lockOp} />
        {/* globe blue disc fill — grows with dr through the zoom */}
        <div
          style={{
            position: "absolute",
            left: discLeft,
            top: discTop,
            width: 2 * dr,
            height: 2 * dr,
            borderRadius: dr,
            backgroundColor: C.blue,
          }}
        />
        {/* continents: a disc-clipped WINDOW onto worldMap. Through the zoom
            the disc grows (dr) and the map ramps to scale 1.0 / MAP origin, so
            at full-bleed (f568) it equals MapScene's full map — continents
            zoom in continuously. Replaces the old crossfade. */}
        <div
          style={{
            position: "absolute",
            left: discLeft,
            top: discTop,
            width: 2 * dr,
            height: 2 * dr,
            borderRadius: dr,
            overflow: "hidden",
          }}
        >
          <TracedArt
            name="worldMap"
            x={mox - discLeft}
            y={moy - discTop}
            scale={mapScale}
            recolor={{ "#FFFFFF": C.white }}
          />
        </div>
        {/* navy border rides the disc edge outward and sweeps off-frame as the
            disc fills the screen */}
        <div
          style={{
            position: "absolute",
            left: discLeft,
            top: discTop,
            width: 2 * dr,
            height: 2 * dr,
            borderRadius: dr,
            border: `4px solid ${C.navy}`,
            boxSizing: "border-box",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ═══ Scenes 6-7: full-bleed map, hexes, 120 currencies (f568-745) ═══
export const MapScene: React.FC<{ frame: number }> = ({ frame }) => {
  const COPY = useCopy();
  const f = frame;
  // Picks up exactly where the GlobeScene zoom ends (f568): full-bleed blue +
  // the full worldMap at scale 1.0 / MAP origin — identical to the disc's
  // final state, so the handoff is a seamless continuation, not a cross-fade.
  if (f < 568 || f >= 766) return null;
  const labelOp = lerp(f, [672, 684], [0, 1]) * lerp(f, [756, 764], [1, 0]);
  // r6 measured map-out (ref f746 full / f758 mid / f766 gone): the map is
  // ERASED edges-inward 750-764 (not faded); non-morphing minis pop out
  // 750-762; the 4 network hexes persist and morph (NetworkScene owns them
  // from NET_MORPH_START).
  const eraseL = interpolate(f, [750, 758, 764], [0, 25, 55], clamp);
  const eraseR = interpolate(f, [750, 758, 764], [0, 36, 45], clamp);
  return (
    <AbsoluteFill style={{ opacity: 1 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: C.blue,
        }}
      />
      <div style={{ position: "absolute", inset: 0 }}>
        <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${eraseR}% 0 ${eraseL}%)` }}>
          <TracedArt
            name="worldMap"
            x={MAP.x}
            y={MAP.y}
            recolor={{ "#FFFFFF": C.white }}
          />
        </div>
        {/* mini hexes pop f600-660 staggered; morphing 4 hand off to
            NetworkScene at NET_MORPH_START, others pop out 750-762 */}
        {MAP.hexes.map((hx, i) => {
          const start = NET_MORPH_START[hx.art];
          if (start !== undefined && f >= start) return null;
          const pop = 600 + i * 9;
          let s = lerp(f, [pop, pop + 12], [0, 1]);
          if (start === undefined) s *= lerp(f, [750 + i * 2, 756 + i * 2], [1, 0]);
          if (s <= 0) return null;
          return (
            <div
              key={hx.art}
              style={{
                position: "absolute",
                left: hx.cx - (MAP.hexW * s) / 2,
                top: hx.cy - (MAP.hexW * 0.906 * s) / 2,
                width: MAP.hexW * s,
                height: MAP.hexW * 0.906 * s,
              }}
            >
              <TracedArt name={hx.art} scale={s} />
            </div>
          );
        })}
        <SerifLabel
          text={COPY.currencies120}
          x={MAP.label.x}
          capTop={MAP.label.capTop}
          fs={MAP.label.fs}
          color={C.serifNavy}
          opacity={labelOp}
        />
      </div>
    </AbsoluteFill>
  );
};

// ═══ Scene 8: network hexes + product docs (f745-913) ═══
// r6 ground-truth rebuild. Hexes re-traced at native 375 from the settled
// network frame f890 with elbow ink painted out (the old mHex* map traces
// carried baked route dashes + a helicopter — the "white dash artifacts").
// Entry = MORPH from the map mini positions (w215) to the network rests
// (w375), staggered (white-fill growth probed f756-772). NO scene fade.
export const NET_MORPH_START: Record<string, number> = {
  mHexHeli: 758,
  mHexBank: 760,
  mHexBank2: 758,
  mHexCity2: 756,
};
const NET_HEXES = [
  { art: "mHexHeliL", from: [375, 405], to: [393, 409], f0: 758, f1: 770 },
  { art: "mHexBankL", from: [555, 765], to: [774, 678], f0: 760, f1: 772 },
  { art: "mHexBank2L", from: [1105, 425], to: [1179, 414], f0: 758, f1: 770 },
  { art: "mHexCity2L", from: [1460, 715], to: [1594, 650], f0: 756, f1: 768 },
] as const;

// Elbow routes probed at f900 (4px navy, rounded corners); each draws
// OUTWARD from its origin hex over f764-788.
const NET_ELBOWS = [
  { d: "M382,572 V726 Q382,750 406,750 H627", len: 413 },
  { d: "M782,512 V324 Q782,300 806,300 H990", len: 410 },
  { d: "M937,764 H1159 Q1183,764 1183,740 V576", len: 424 },
  { d: "M1370,321 H1559 Q1583,321 1583,345 V487", len: 369 },
];

// Product docs RIDE the elbows — per-frame center tables from a white-blob
// tracker over f745-915 (step 5). Two travel simultaneously.
type DocJourney = {
  label: string;
  w: number;
  h: number;
  fs: number;
  bar: boolean;
  fKeys: number[];
  xs: number[];
  ys: number[];
  io: [number, number, number, number]; // fade in f0,f1 / out f0,f1
};
const NET_DOCS: DocJourney[] = [
  // Tom/next day: hex1 bottom → down x388 → right y757 → hex2 (f807-838)
  { label: "Tom/\nnext\nday", w: 71, h: 93, fs: 22, bar: false,
    fKeys: [807, 810, 815, 820, 825, 830, 835, 838],
    xs: [388, 387, 397, 442, 504, 564, 618, 645],
    ys: [600, 638, 697, 738, 752, 757, 759, 760], io: [806, 810, 836, 840] },
  // NDF: hex2 top → up x781 → right y318 → hex3 (f793-824)
  { label: "NDF", w: 91, h: 117, fs: 40, bar: true,
    fKeys: [793, 795, 800, 805, 810, 815, 820, 824],
    xs: [780, 780, 782, 803, 869, 939, 1004, 1055],
    ys: [505, 462, 409, 344, 319, 317, 318, 318], io: [792, 796, 821, 825] },
  // Same day: hex3 right → right y321 → down x1577 → hex4 (f817-849)
  { label: "Same\nday", w: 60, h: 79, fs: 19, bar: false,
    fKeys: [817, 820, 825, 830, 835, 840, 845, 849],
    xs: [1350, 1365, 1420, 1480, 1539, 1573, 1577, 1577],
    ys: [321, 321, 321, 324, 338, 384, 438, 468], io: [816, 820, 847, 851] },
  // Spots: hex2 right → right y762 → up x1184 → hex3 (f853-878)
  { label: "Spots", w: 65, h: 85, fs: 21, bar: true,
    fKeys: [853, 855, 860, 865, 870, 875, 878],
    xs: [960, 987, 1055, 1120, 1173, 1184, 1184],
    ys: [762, 762, 757, 751, 713, 651, 625], io: [852, 856, 876, 880] },
  // Forwards: hex4 top → up x1556 → LEFT y320 → hex3 (f863-894, reverse flow)
  { label: "Forwards", w: 62, h: 84, fs: 15, bar: true,
    fKeys: [863, 870, 875, 880, 885, 890, 894],
    xs: [1556, 1555, 1545, 1504, 1441, 1390, 1360],
    ys: [430, 391, 349, 326, 321, 318, 318], io: [862, 866, 892, 896] },
];

export const NetworkScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < 756 || f >= SEG.network[1]) return null;
  const wipe = lerp(f, [900, 913], [0, 1]); // hard-ish cut to cities at 913
  return (
    <AbsoluteFill style={{ backgroundColor: C.blue }}>
      {/* elbow connectors, drawing outward from their origin hexes */}
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        {NET_ELBOWS.map((e, i) => {
          const p = lerp(f, [764, 788], [0, 1]);
          if (p <= 0) return null;
          return (
            <path
              key={i}
              d={e.d}
              fill="none"
              stroke={C.navy}
              strokeWidth={4}
              strokeDasharray={e.len}
              strokeDashoffset={e.len * (1 - p)}
            />
          );
        })}
      </svg>
      {NET_DOCS.map((d, i) => {
        const op = lerp(f, [d.io[0], d.io[1]], [0, 1]) * lerp(f, [d.io[2], d.io[3]], [1, 0]);
        if (op <= 0 || f < d.fKeys[0] - 4 || f > d.fKeys[d.fKeys.length - 1] + 4) return null;
        const cx = interpolate(f, d.fKeys, d.xs, clamp);
        const cy = interpolate(f, d.fKeys, d.ys, clamp);
        return <NetDoc key={i} spec={d} cx={cx} cy={cy} opacity={op} />;
      })}
      {NET_HEXES.map((hx) => {
        if (f < hx.f0) return null;
        const p = lerp(f, [hx.f0, hx.f1], [0, 1]);
        const cx = hx.from[0] + (hx.to[0] - hx.from[0]) * p;
        const cy = hx.from[1] + (hx.to[1] - hx.from[1]) * p;
        const w = 215 + (375 - 215) * p;
        // large art: 396px crop holding a 375px hex
        const scale = w / 375;
        return (
          <div
            key={hx.art}
            style={{
              position: "absolute",
              left: cx - (396 * scale) / 2,
              top: cy - (360 * scale) / 2,
            }}
          >
            <TracedArt name={hx.art} scale={scale} />
          </div>
        );
      })}
      {wipe > 0 && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: C.white, opacity: wipe }} />
      )}
    </AbsoluteFill>
  );
};

const NetDoc: React.FC<{ spec: DocJourney; cx: number; cy: number; opacity: number }> = ({
  spec,
  cx,
  cy,
  opacity,
}) => {
  const { serif: SERIF } = useBrand();
  const { w, h } = spec;
  const fold = Math.round(w * 0.22);
  const lines = spec.label.split("\n");
  const lineH = spec.fs * 1.08;
  const textTop = h * 0.32 + spec.fs * 0.8;
  return (
    <div style={{ position: "absolute", left: cx - w / 2, top: cy - h / 2, opacity }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <path
          d={`M2,2 H${w - fold - 2} L${w - 2},${fold + 2} V${h - 2} H2 Z`}
          fill={C.white}
          stroke={C.navy}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        <path d={`M${w - fold - 2},2 V${fold + 2} H${w - 2}`} fill="none" stroke={C.navy} strokeWidth={2.5} />
        {/* header: navy dot + grey lines */}
        <circle cx={w * 0.14} cy={h * 0.12} r={w * 0.045} fill={C.navy} />
        <rect x={w * 0.24} y={h * 0.09} width={w * 0.4} height={2} fill="#B9B9B9" />
        <rect x={w * 0.24} y={h * 0.13} width={w * 0.3} height={2} fill="#B9B9B9" />
        {lines.map((s, i) => (
          <text
            key={i}
            x={w / 2}
            y={textTop + i * lineH}
            textAnchor="middle"
            fontFamily={SERIF}
            fontSize={spec.fs}
            fill={C.orangeDeep}
          >
            {s}
          </text>
        ))}
        {spec.bar && (
          <rect x={w * 0.12} y={h * 0.72} width={w * 0.76} height={h * 0.14} fill="none" stroke={C.navy} strokeWidth={1.5} />
        )}
        {spec.bar && (
          <rect x={w * 0.15} y={h * 0.75} width={w * 0.7} height={h * 0.05} fill="#B9B9B9" />
        )}
      </svg>
    </div>
  );
};
