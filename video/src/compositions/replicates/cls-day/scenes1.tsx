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
  ClsWordmark,
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
// gen19: THE REF HAS TWO LOCKUP POSES, AND THEY ARE ONE POSE UNDER A SIMILARITY.
// Measured ink (ref f80 = intro settled · ref f3700 = end card):
//              intro                       end card
//   mark    x454..666  y187..401      x422..648  y162..388
//   letters x696..1465 y187..400      x679..1497 y162..388
//   tagline x472..1449 y434..495      x442..1479 y424..489
//   iconS   x599..780                 x577..768
//   iconD   x1165..1319               x1177..1341
//   labS/labD centres 689.5 / 1226    672.5 / 1242
// Solve intro = s·(end − P) + P on the x extremes: s = 0.9405, P = (960, 592) —
// and every remaining feature falls out to <=1px. So the CSS below IS the END-CARD
// pose (S19 mounts it bare); S1Intro passes `scale` and gets the intro pose free.
//
// The old code was a MIXTURE — mark/letters at the end-card pose, icons fitted to
// the intro, and a tagline (fs66/ls1 → ink 674x49) that was wrong in BOTH: the ref's
// is 1038x66 here and 978x62 in the intro. 2.4x too little ink on ~250 frames.
//
// The intro is a DRAW-ON reveal (measured from ref f0..62, 25fps — the ink
// mechanism, not the old opacity fade): the mark+letters wipe on L-to-R
// under one soft-edged front (mark done ~f2, C ~f8, L ~f14, S ~f23); the
// tagline fades in at rest; the whole lockup then RISES ~180px into place
// (f31..48; ref mark-ink top 368@f10 → 187@f50, so the rise is 181) while each
// pillar icon draws on L-to-R (Settlement leads). The reveal props are all
// optional and default to fully-shown, so S19's end card stays static.
// Reveal fronts are CARD-space x (inside the scale wrapper), refitted to the new
// card-space ink spans.
// L-to-R soft reveal: everything left of `front` is opaque, a ~52px feather
// straddles it. `undefined` ⇒ no mask (fully shown, for the end card).
const revealMask = (front?: number): React.CSSProperties =>
  front === undefined
    ? {}
    : {
        WebkitMaskImage: `linear-gradient(to right, #000 ${front - 46}px, transparent ${front + 6}px)`,
        maskImage: `linear-gradient(to right, #000 ${front - 46}px, transparent ${front + 6}px)`,
      };

// intro pose = end-card pose scaled about this pivot
export const CARD_SCALE = 0.9405;
export const CARD_PIVOT: [number, number] = [960, 592];

export const LogoCard: React.FC<{
  logoFront?: number; // L-to-R reveal front x (CARD space) for mark+letters
  taglineOpacity?: number;
  labelOpacity?: number;
  iconFronts?: [number, number, number]; // per-pillar reveal front x (CARD space)
  riseY?: number; // whole-content vertical offset (intro lift-in), VIDEO px
  scale?: number; // 1 = end-card pose; CARD_SCALE = intro pose
  pack: Pack;
  BrandLogo?: React.FC<{ markP: number; lettersP: number }>;
}> = ({ logoFront, taglineOpacity = 1, labelOpacity = 1, iconFronts, riseY = 0, scale = 1, pack, BrandLogo }) => {
  // per-icon left/top/size in CARD space. S and D are the intro fit (which landed
  // ref f80 to 1-2px) pushed out through the similarity; P is re-CENTRED on the
  // ref's ink (our IconProcess art is 14px narrow — an aspect error in lib.tsx,
  // left alone: centring beats left-aligning when the art is the wrong width).
  const icons = [
    { X: 577.2, ty: 670.7, size: 191.4, Icon: IconHandshake, label: pack.pillars[0], cx: 672.4 },
    { X: 864.3, ty: 656.9, size: 191.4, Icon: IconProcess, label: pack.pillars[1], cx: 960 },
    { X: 1159.9, ty: 648.4, size: 191.4, Icon: IconData, label: pack.pillars[2], cx: 1242.8 },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, background: C.navyBg }}>
      <div style={{ position: "absolute", inset: 0, transform: riseY ? `translateY(${riseY}px)` : undefined }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: scale === 1 ? undefined : `scale(${scale})`,
            transformOrigin: `${CARD_PIVOT[0]}px ${CARD_PIVOT[1]}px`,
          }}
        >
          {/* mark + letters, revealed under one L-to-R front */}
          <div style={{ position: "absolute", inset: 0, ...revealMask(logoFront) }}>
            {BrandLogo ? (
              <BrandLogo markP={1} lettersP={1} />
            ) : (
              <>
                <div style={{ position: "absolute", left: 416, top: 156 }}>
                  <ClsMark size={239} />
                </div>
                {/* ClsLetters' glyph runs w/h 3.658; the ref's is 3.60 — scaleX lands
                    the S's right edge without moving the C's left */}
                <div style={{ position: "absolute", left: 679, top: 162, transform: "scaleX(0.985)", transformOrigin: "0 0" }}>
                  <ClsLetters height={235} />
                </div>
              </>
            )}
          </div>
          <div
            style={{
              position: "absolute",
              left: 4,
              top: 401,
              width: 1920,
              textAlign: "center",
              fontFamily: pack.sans,
              fontWeight: 300,
              fontSize: 89,
              letterSpacing: 7,
              color: "#FCFCFC",
              opacity: taglineOpacity,
            }}
          >
            {pack.tagline}
          </div>
          {icons.map(({ X, ty, size, Icon, label, cx }, i) => (
            <div key={i}>
              {/* line-art icon draws on L-to-R */}
              <div style={{ position: "absolute", inset: 0, ...revealMask(iconFronts?.[i]) }}>
                <div style={{ position: "absolute", left: X, top: ty }}>
                  <Icon size={size} />
                </div>
              </div>
              <div
                style={{
                  position: "absolute",
                  left: cx - 150,
                  top: 874,
                  width: 300,
                  textAlign: "center",
                  fontFamily: pack.serif,
                  fontSize: 46,
                  color: "#FCFCFC",
                  opacity: labelOpacity,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// intro draw-on tables (ref f0..62, 25fps — measured per-pixel). gen19: all four
// fronts are now CARD-space x (they live inside the scale wrapper) — each remapped
// from its old ink span onto the new card-space one, so every letter/icon still
// clears at the frame the ref clears it.
// LOGO_FRONT — the mark+letters L-to-R wipe front. Mark+letters ink 422..1497
// clears f0..23 (mark ~f2, C ~f8, L ~f14, S ~f23).
const LOGO_FRONT = lutS([[0, 434], [2, 751], [5, 870], [8, 1004], [11, 1063], [14, 1306], [17, 1395], [20, 1476], [23, 1534]]);
// RISE — the lockup lifts from a centered-low rest into the settled layout:
// translateY +180 held f0..31, eased to 0 by f48. Confirmed gen19 against the ref's
// mark-ink top (368@f10/f20 · 347@f34 · 257@f38 · 202@f42 · 190@f46 · 187@f50 —
// settled 187, so RISE(f) = ref_top − 187 reproduces this table to <=2px). VIDEO px:
// the rise rides OUTSIDE the scale wrapper.
const RISE = lutS([[0, 180], [31, 180], [32, 171], [34, 160], [36, 137], [38, 70], [40, 30], [44, 7], [48, 1], [50, 0]]);
// per-pillar icon draw-on fronts (CARD x; Settlement leads, Data trails — ref shows
// all three tracing ~f36..62). Card-space icon ink: S 577..769, P 875..1045,
// D 1176..1343; the soft mask clears only where x <= front-46, so each front must
// reach icon_right+46 or the right edge sits permanently dimmed (was ~27%, the S1
// "grey right edge" defect).
const ICON_S = lutS([[36, 564], [58, 778], [64, 821]]);
const ICON_P = lutS([[38, 851], [58, 1065], [64, 1109]]);
const ICON_D = lutS([[40, 1147], [60, 1361], [66, 1405]]);

// ─── S1: intro (f0..123) — draw-on reveal, then rise + icon draw ───
// Exit f108..122: a white slash splits the card in two; both pieces are
// STATIC content clipped by the moving slash edges (measured bar extents),
// while the S2 ruler wipe levels in underneath.
export const S1Intro: React.FC<{ frame: number; pack: Pack; BrandLogo?: React.FC<{ markP: number; lettersP: number }> }> = ({
  frame,
  pack,
  BrandLogo,
}) => {
  if (frame >= 124) return null;
  const logoFront = LOGO_FRONT(frame);
  const taglineOpacity = interpolate(frame, [16, 24], [0, 1], clamp);
  const labelOpacity = interpolate(frame, [34, 44], [0, 1], clamp);
  const iconFronts: [number, number, number] = [ICON_S(frame), ICON_P(frame), ICON_D(frame)];
  const riseY = RISE(frame);
  const card = (
    <LogoCard
      pack={pack}
      BrandLogo={BrandLogo}
      logoFront={logoFront}
      taglineOpacity={taglineOpacity}
      labelOpacity={labelOpacity}
      iconFronts={iconFronts}
      riseY={riseY}
      scale={CARD_SCALE}
    />
  );
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
// Early phase f118..224: the FIRST pair (USD/JPY) SLIDES in from the right
// over f119..150 (long ease-out tail — measured USD_XIN, not the r5 f119..129
// slam) and settles with the top baseline ON the ruler; the SECOND pair
// (DKK/GBP) does NOT slide — it CROSSFADES in at the settled straddle
// f167..173 (ref shows no off-frame navy at f170, DKK already at x298 by
// f172). USD/JPY holds then sinks into the line f160..169 (USD_SINK), DKK/GBP
// is swallowed f224..231. (ref caps 251px → fs349; ref f150 USD x337,
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
// serif calibration (r7, face-specific — measured on rendered stills vs
// ref by probing JPY capTop + P/Y baselines): rendered baseline = CSS_top
// + SER_B·fs; rendered cap-top = CSS_top + SER_CT·fs; cap = (SER_B −
// SER_CT)·fs. Measured factor sets: Georgia 0.825/0.122 @FS 349/338 ·
// Times NR 0.798/0.139 @381/367 · Hoefler Text 0.692/−0.018 @354/341.
// SER_SX: the ref face is CONDENSED — every macOS serif renders codes
// wide (ref JPY 507 vs Georgia 616 / Times 622 / Hoefler 627 at cap 251;
// USD ref 686 vs 695/746/726). scaleX about the left edge pulls the ink
// back toward the ref's width.
const FS_PLG = 341; // plunging pairs — ref cap 242
const SER_B = 0.692; // baseline factor
const SER_CT = -0.018; // cap-top factor
const SER_SX = 0.9; // plunge-code width compression (mean of measured pairs)
// per-settled-pair calibration (ref ink probes f150/f200): pair1 DKK/GBP
// is SMALLER than pair0 (cap 245 vs 251) and its bottom capTop sits at
// 559 not 565. sx = ref ink width / Hoefler natural width at the pair fs
// (USD 686/726, JPY 507/627 @fs354; DKK 749/819, GBP 645/697 @fs345).
const SET_CAL = [
  { fs: 354, topBase: 530, botCap: 565, sxTop: 0.945, sxBot: 0.809 },
  { fs: 345, topBase: 530, botCap: 559, sxTop: 0.915, sxBot: 0.926 },
] as const;
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
// USD/JPY pan-in — measured ref left-edge minus our settled edge (356),
// a SLOW right-to-left slide with a long ease-out tail (settles ~f150, not
// f129). The r5 rebuild slid it in over f119..129 and then parked it for
// ~25f; the ref keeps creeping until f148 (USD left 1672@f122 → 550@f134 →
// 360@f150). xIn shared by top+bottom code (they pan as one).
const USD_XIN = lutS([[119, 1548], [122, 1316], [124, 1084], [126, 786], [128, 544], [130, 382], [132, 272], [134, 194], [136, 136], [138, 94], [140, 62], [142, 38], [145, 18], [150, 2]]);
// USD/JPY exit — HOLDS on the ruler until ~f160, then sinks into the line
// (top-code cap-top 283→414 over f162..169, bottom pinned at the line; ref
// measured). Was f154..168 — started the sink ~7f early.
const USD_SINK = lutS([[160, 0], [162, 6], [164, 20], [166, 58], [168, 135], [169, 200], [171, 320], [173, 430]]);

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
            {/* settled pairs: USD/JPY SLIDES in from the right f119..150
                (measured LUT), holds, then sinks into the line f160..169;
                DKK/GBP CROSSFADES in at the settled straddle f167..173 (the
                ref does NOT slide it in — measured: no navy off-frame at f170,
                DKK already at x298 by f172), holds, swallowed f224..231 */}
            {frame >= 119 && frame <= 172 && (
              <SettledCode pack={pack} i={0} top xIn={USD_XIN(frame)} x={325} sink={USD_SINK(frame)} />
            )}
            {frame >= 168 && frame <= 232 && (
              <SettledCode pack={pack} i={1} top xIn={0} opacity={interpolate(frame, [167, 173], [0, 1], clamp)} x={234 - 1.55 * (frame - 190)} sink={lutS([[224, 0], [225, 26], [226, 49], [227, 81], [228, 125], [229, 180], [230, 238], [231, 280]])(frame)} />
            )}
            {/* plunging top codes */}
            {PLUNGES.map((P) => {
              const pair = pack.currencyPairs[P.i];
              if (!pair || frame < P.base[0][0] || frame > P.end) return null;
              const base = lutS(P.base)(frame);
              return (
                <div key={`pt${P.i}`} style={{ position: "absolute", left: lutS(P.xT)(frame), top: base - SER_B * FS_PLG, fontFamily: pack.serif, fontSize: FS_PLG, lineHeight: 0.93, color: pairColor(pair.topColor), transform: `scaleX(${SER_SX})`, transformOrigin: "0 0" }}>
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
              <SettledCode pack={pack} i={0} xIn={USD_XIN(frame)} x={419} sink={-USD_SINK(frame)} />
            )}
            {frame >= 168 && frame <= 232 && (
              <SettledCode pack={pack} i={1} xIn={0} opacity={interpolate(frame, [167, 173], [0, 1], clamp)} x={287 - 1.55 * (frame - 190)} sink={-lutS([[224, 0], [225, 26], [226, 49], [227, 81], [228, 125], [229, 180], [230, 238], [231, 280]])(frame)} />
            )}
            {/* plunging bottom codes — mirror the top about y1081 */}
            {PLUNGES.map((P) => {
              const pair = pack.currencyPairs[P.i];
              if (!pair || frame < P.xB[0][0] || frame > P.end) return null;
              const capTop = 1081 - lutS(P.base)(frame);
              return (
                <div key={`pb${P.i}`} style={{ position: "absolute", left: lutS(P.xB)(frame), top: capTop - SER_CT * FS_PLG, fontFamily: pack.serif, fontSize: FS_PLG, lineHeight: 0.93, color: pairColor(pair.topColor === "red" ? "navy" : "red"), transform: `scaleX(${SER_SX})`, transformOrigin: "0 0" }}>
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
const SettledCode: React.FC<{ pack: Pack; i: number; top?: boolean; xIn: number; x: number; sink: number; opacity?: number }> = ({ pack, i, top, xIn, x, sink, opacity }) => {
  const pair = pack.currencyPairs[i];
  if (!pair) return null;
  const color = top ? pair.topColor : pair.topColor === "red" ? "navy" : "red";
  const cal = SET_CAL[Math.min(i, 1)];
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: top ? cal.topBase - SER_B * cal.fs : cal.botCap - SER_CT * cal.fs,
        fontFamily: pack.serif,
        fontSize: cal.fs,
        lineHeight: 0.93,
        opacity: opacity ?? 1,
        color: color === "red" ? C.red : C.navyInk,
        transform: `translate(${xIn}px, ${sink}px) scaleX(${top ? cal.sxTop : cal.sxBot})`,
        transformOrigin: "0 50%",
      }}
    >
      {top ? pair.top : pair.bottom}
    </div>
  );
};

// ─── S3: globe clock (f300..460) ───
// ─── S3: globe clock (f283..470) — MEASURED per-pixel (r11) ───
// Docks in from upper-right (f285-305), settles at cx958, then PANS LEFT
// to cx715 (f333-350) and holds while the padlock slides in from the
// right. Blue disk r291 cy554; grey annulus r303-349 + navy hairline r300;
// 24 hourly navy ticks (base deg 7+15k) + red milestone ticks/labels at
// 23:00/00:00/06:00/06:30/09:00 + navy 07:00; marker fixed at globe top.
// The whole clock face (ticks + labels) ROTATES CCW rigidly at
// θ = -0.93·(f-330.5)° (all 6 milestones fit at f410 θ=-74.6); continents
// scroll horizontally (longitude); marker does NOT rotate.
const G_CX = lutS([[285, 1819], [290, 1349], [295, 1102], [300, 1004], [305, 965], [320, 958], [330, 948], [335, 919], [340, 783], [345, 731], [350, 717], [410, 716], [420, 701], [435, 560]]);
const G_CY = lutS([[285, 495], [290, 529], [295, 545], [300, 552], [305, 554], [420, 552], [435, 505]]);
const G_S = lutS([[285, 0.505], [290, 0.829], [295, 0.936], [300, 0.982], [305, 1], [420, 1], [435, 0.95]]);
const G_DISK = 291;
const G_BCX = 715;
const G_BCY = 554;
// hourly ticks at base deg 7+15k; milestone hours drawn separately
const G_HOURS = Array.from({ length: 24 }, (_, k) => 7 + 15 * k);
const G_MDEG = new Set([22, 37, 127, 142, 172]);
const G_MILE: { deg: number; red: boolean; label: string }[] = [
  { deg: 22, red: true, label: "23:00" },
  { deg: 37, red: true, label: "00:00" },
  { deg: 127, red: true, label: "06:00" },
  { deg: 134.5, red: true, label: "06:30" },
  { deg: 142, red: false, label: "07:00" },
  { deg: 172, red: true, label: "09:00" },
];
const gpt = (cx: number, cy: number, deg: number, rad: number): [number, number] => [
  cx + Math.sin((deg * Math.PI) / 180) * rad,
  cy - Math.cos((deg * Math.PI) / 180) * rad,
];

export const S3Globe: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 283 || frame >= 470) return null;
  const exitP = interpolate(frame, [424, 440], [0, 1], clamp); // gone by f440 (S4 enters)
  const scroll = interpolate(frame, [300, 460], [0, -170], clamp); // continent longitude
  const theta = -0.93 * (frame - 330.5); // clock-face rotation (deg)
  const lockClosed = frame >= 400;
  // padlock DRAWS ON in place (measured ref f330..350) — NOT a slide-in.
  // shackle+body+navy dots fade f330..339; red combination dashes populate
  // f340..351 (ref: the red dashes appear only after the body is solid).
  const padIn = interpolate(frame, [330, 339], [0, 1], clamp);
  const padDash = interpolate(frame, [340, 351], [0, 1], clamp);
  const cx = G_BCX;
  const cy = G_BCY;
  const r = G_DISK;
  const tx = G_CX(frame) - cx;
  const ty = G_CY(frame) - cy;
  const s = G_S(frame);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${tx}px, ${ty}px) scale(${s})`, transformOrigin: `${cx}px ${cy}px`, opacity: 1 - exitP }}>
        <svg width={1920} height={1080} style={{ position: "absolute" }}>
          {/* grey annulus */}
          <circle cx={cx} cy={cy} r={326} fill="none" stroke={C.bandGrey} strokeWidth={46} />
          {/* hourly navy ticks (skip milestone hours) */}
          {G_HOURS.filter((d) => !G_MDEG.has(d)).map((d, i) => {
            const [x0, y0] = gpt(cx, cy, d + theta, 305);
            const [x1, y1] = gpt(cx, cy, d + theta, 360);
            return <line key={"h" + i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={C.navyDeep} strokeWidth={2} />;
          })}
          {/* milestone ticks (long) */}
          {G_MILE.map((m, i) => {
            const [x0, y0] = gpt(cx, cy, m.deg + theta, 303);
            const [x1, y1] = gpt(cx, cy, m.deg + theta, m.red ? 394 : 378);
            return <line key={"m" + i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={m.red ? C.red : C.navyDeep} strokeWidth={m.red ? 4 : 3} />;
          })}
          {/* navy hairline ring */}
          <circle cx={cx} cy={cy} r={300} fill="none" stroke={C.navyInk} strokeWidth={7} />
          {/* globe disk + scrolling continents */}
          <circle cx={cx} cy={cy} r={r} fill={C.blue} />
          <g clipPath="url(#globeClip)">
            {/* +85 registers the traced pattern (read off the f380 view) to the
                ref's longitude; a third tile guards the left edge under the offset */}
            <g transform={`translate(${scroll + 85} 0)`}>
              <Continents cx={cx - 2 * r} cy={cy} r={r} />
              <Continents cx={cx} cy={cy} r={r} />
              <Continents cx={cx + 2 * r} cy={cy} r={r} />
            </g>
          </g>
          <defs>
            <clipPath id="globeClip">
              <circle cx={cx} cy={cy} r={r - 2} />
            </clipPath>
          </defs>
        </svg>
        {/* clock labels — tangential, rotate with the face */}
        {G_MILE.map((m, i) => {
          const [lx, ly] = gpt(cx, cy, m.deg + theta, 400);
          return (
            <div key={"l" + i} style={{ position: "absolute", left: lx, top: ly, fontFamily: SANS, fontSize: 30, color: C.navyInk, whiteSpace: "nowrap", transform: `translateY(-50%) rotate(${m.deg + theta}deg)`, transformOrigin: "0 50%" }}>
              {m.label}
            </div>
          );
        })}
        <MarkerTriangle x={cx} y={cy - 466} size={62} />
      </div>
      {/* padlock — draws on in place (shackle→body→dots→red dashes), measured */}
      <div style={{ position: "absolute", inset: 0, opacity: padIn * (1 - exitP) }}>
        <Padlock x={1338} y={372} size={163} closed={lockClosed} dashOpacity={padDash} />
      </div>
    </>
  );
};

// white map outlines — stylized ANGULAR coastlines (flat-design world map),
// traced from the ref globe f380 in this 470-space: recognizable N.America,
// S.America (via the isthmus), Africa (west bulge tapering to a south point),
// Europe, Greenland and an island. The old two blobs read as rushed.
const Continents: React.FC<{ cx: number; cy: number; r: number }> = ({ cx, cy, r }) => (
  <g transform={`translate(${cx - r} ${cy - r}) scale(${(r * 2) / 470})`} fill="none" stroke="#FDFDFD" strokeWidth={4.6} strokeLinejoin="round" strokeLinecap="round">
    {/* enlarged ~13% about the disk centre so the landmasses fill the disk like
        the ref (the traced shapes alone read a touch small/sparse) */}
    <g transform="translate(235 235) scale(1.13) translate(-235 -235)">
      {/* north america */}
      <path d="M 92 30 L 128 34 L 126 54 L 150 50 L 176 72 L 170 100 L 140 116 L 152 142 L 124 172 L 104 150 L 112 122 L 82 128 L 66 98 L 90 86 L 64 66 L 74 40 Z" />
      {/* south america — chunky at the north, tapering south (isthmus from central america) */}
      <path d="M 146 198 L 196 204 L 212 234 L 230 284 L 220 334 L 202 388 L 184 446 L 166 400 L 158 350 L 142 304 L 152 258 L 138 224 Z" />
      {/* greenland */}
      <path d="M 246 16 L 288 20 L 282 44 L 252 52 L 238 34 Z" />
      {/* europe */}
      <path d="M 352 104 L 402 100 L 424 120 L 402 140 L 372 134 L 356 148 L 340 132 L 352 116 Z" />
      {/* island (uk/iceland) */}
      <path d="M 350 130 L 366 128 L 370 150 L 356 160 L 348 146 Z" />
      {/* africa */}
      <path d="M 342 162 L 398 156 L 428 184 L 418 224 L 432 258 L 414 302 L 388 352 L 366 408 L 350 452 L 336 406 L 326 350 L 310 302 L 296 252 L 308 206 L 326 178 Z" />
    </g>
  </g>
);

// ─── S4: trade executed diagram (f440..674) ───
//
// gen18 — the whole diagram re-registered PER FRAME off the ref's two badge
// discs (work/cls-day/gen18-s1/probe_s4.py). The old model was structurally
// wrong for 100 frames: it held BOTH hexes on one baseline (y527) and merely
// spread them in x while scaling each about its own centre. The ref does
// something else entirely, and it is the largest single error in the video:
//
//   f446–480  the hexes sit OVERLAPPED and DIAGONAL at 1.53x — A up-left at
//             (723, 527), B down-right at (1191, 738). B was drawn 212px TOO
//             HIGH for the whole draw-in: a 584×431 element (12% of frame)
//             almost disjoint from its ref.
//   f482–504  they punch apart AND DOWN to a wide low pose, s 1.53 → 1.25.
//   f504–536  frozen wide: A(349,569) B(1572,569), s=1.25. The old model had
//             them already at the settled x and s=1.10 — 120px off in x.
//   f538–556  they pull back in and UP to the settled registration.
//   f556+     settled A(471,527) B(1450,527) s=1 — unchanged, byte-identical.
//
// hex centre = badge centroid + s·offset; s = badge diameter / 91 (the settled
// diameter). Every other part of the diagram (arrow, label, connectors) is
// rigidly attached to those two centres and rides the same s — verified: the
// arrow tips land at Ax + 186.5·s / Bx − 187·s to ±2px across the window.
const S4_S = lutS([[446, 1.5275], [480, 1.5275], [482, 1.5165], [484, 1.5165], [486, 1.5055], [488, 1.4945], [490, 1.4725], [491, 1.4505], [492, 1.4176], [493, 1.3681], [494, 1.3297], [495, 1.3077], [496, 1.2912], [497, 1.2802], [498, 1.2747], [500, 1.2637], [502, 1.2637], [504, 1.2527], [538, 1.2527], [540, 1.2418], [542, 1.2418], [544, 1.2198], [546, 1.1868], [548, 1.1099], [550, 1.0549], [552, 1.033], [554, 1.011], [556, 1], [660, 1], [662, 1], [663, 1.011], [664, 1.022], [665, 1.044], [666, 1.066], [667, 1.077], [668, 1.121], [669, 1.165], [670, 1.242], [671, 1.36], [672, 1.55], [673, 1.8]]);
const S4_AX = lutS([[446, 722.8], [480, 722.8], [482, 720.1], [484, 715.1], [486, 704.4], [488, 685.6], [490, 650.2], [491, 618.7], [492, 561.6], [493, 469], [494, 418.8], [495, 395.3], [496, 380.5], [497, 370.7], [498, 364.1], [500, 355.4], [502, 351.4], [504, 348.7], [538, 349.7], [540, 352], [542, 358], [544, 366.5], [546, 384.3], [548, 420.3], [550, 446.6], [552, 459.2], [554, 464.7], [556, 468], [560, 471], [660, 471], [661, 468], [662, 461], [663, 448.7], [664, 428.4], [665, 400.9], [666, 360.4], [667, 302.1], [668, 224], [669, 104.4], [670, -79.2], [671, -346], [672, -727], [673, -1212]]);
const S4_AY = lutS([[446, 526.5], [480, 526.5], [482, 525.5], [484, 526.5], [486, 527.5], [488, 530], [490, 534.5], [491, 538.5], [492, 545.9], [493, 559.1], [494, 564.3], [495, 566.3], [496, 567.5], [497, 567.5], [498, 568.3], [500, 568.3], [502, 569.8], [504, 568.8], [538, 568.3], [540, 566.7], [542, 566.2], [544, 563.2], [546, 557.2], [548, 545.1], [550, 536.1], [552, 532], [554, 528.5], [556, 527], [660, 527], [661, 527.5], [662, 529.5], [663, 535.5], [664, 543], [665, 555.1], [666, 570.6], [667, 588.6], [668, 616.6], [669, 653.2], [670, 706], [671, 780], [672, 880], [673, 1000]]);
const S4_BX = lutS([[446, 1190.7], [480, 1190.7], [482, 1193.4], [484, 1198.4], [486, 1209.1], [488, 1228.9], [490, 1264.3], [491, 1296.8], [492, 1355], [493, 1449.1], [494, 1499.9], [495, 1524.4], [496, 1539.7], [497, 1549.5], [498, 1556.6], [500, 1565.3], [502, 1569.3], [504, 1572.1], [538, 1571.1], [540, 1568.8], [542, 1562.8], [544, 1554.3], [546, 1536.5], [548, 1500.6], [550, 1474.3], [552, 1461.8], [554, 1456.3], [556, 1453], [560, 1450], [660, 1450], [661, 1449], [662, 1446], [663, 1438.8], [664, 1428], [665, 1412], [666, 1389.6], [667, 1359.3], [668, 1312.9], [669, 1244.9], [670, 1136.8], [671, 985], [672, 790], [673, 550]]);
const S4_BY = lutS([[446, 738.4], [480, 738.4], [482, 736.5], [484, 735], [486, 729.5], [488, 721], [490, 705.1], [491, 690.6], [492, 667.2], [493, 633], [494, 610.3], [495, 597.4], [496, 588.7], [497, 582.7], [498, 579.5], [500, 573.5], [502, 571.5], [504, 569], [538, 568.5], [540, 567], [542, 566.5], [544, 563.6], [546, 557.6], [548, 544.8], [550, 535.9], [552, 531.9], [554, 529], [556, 527], [660, 527], [661, 527.5], [662, 529.5], [663, 535.5], [664, 543], [665, 555.1], [666, 570.4], [667, 588.4], [668, 616.7], [669, 653.2], [670, 706], [671, 780], [672, 880], [673, 1000]]);

// EXIT (f661-673): the diagram is not just clipped by the S5 front — the ref
// ZOOMS IT IN and pans it left/down with the band whip (badge d 91→113, hex A
// off the left edge by f670). The LUTs above carry that; the pill rides the
// same affine (world→screen: P' = A(f) + (P − (471,527))·s) from f660, where
// the affine is still identity, so f560-660 stay byte-identical.
// f671-673 are extrapolated — by then the S5 front has eaten all but a sliver.

// Connector draw-on (fraction of the path: 70 down · r52 arc · 214.5 across).
// The ref DRAWS the line from f538 — the old opacity fade f544-560 was invented.
const S4_CONN = lutS([[538, 0], [540, 0.02], [542, 0.05], [543, 0.08], [544, 0.123], [545, 0.178], [546, 0.226], [547, 0.32], [548, 0.45], [549, 0.69], [550, 0.78], [552, 0.87], [553, 0.918], [554, 0.949], [556, 0.986], [558, 0.997], [560, 1]]);
// CLS pill: the ref SCALES it up about (946,835) from f549 to f560 (measured
// box 239×108 @f550 → 437×197 @f560) — not the L→R box wipe we had. The
// wordmark still wipes O→C→L→S inside it, to ~f570.
const S4_PILL = lutS([[549, 0], [550, 0.53], [551, 0.66], [552, 0.76], [553, 0.83], [554, 0.89], [555, 0.925], [556, 0.955], [557, 0.975], [558, 0.99], [560, 1]]);
const S4_LOGO = lutS([[549, 0], [550, 0.18], [554, 0.4], [558, 0.55], [564, 0.78], [570, 1]]);

// The two settlement docs. There is NO coin: the ref slides a $ doc out from
// under hex A and a € doc out from under hex B (identical art to S5's
// SettleDoc, 1.084x), rides each DOWN its connector and ALONG the arm into the
// CLS pill, where it is occluded — gone by f632. We drew a static red coin
// under A that faded in at f606 and then NEVER LEFT: fiction that persisted
// for 56 frames. Tracks are the red ring's centroid, per frame.
const S4_DOC_SCALE = 1.084;
const S4_DOCL_X = lutS([[600, 475], [611, 474.5], [612, 478], [613, 492], [614, 516.5], [615, 544], [616, 571], [617, 598], [618, 622], [619, 644], [620, 664], [621, 682], [622, 697], [623, 710.5], [624, 721], [626, 741], [628, 760], [631, 788]]);
const S4_DOCL_Y = lutS([[600, 625], [601, 630], [602, 637], [603, 644], [604, 652], [605, 662], [606, 672], [607, 684], [608, 699.5], [609, 715], [610, 732.5], [611, 752.5], [612, 774], [613, 792.5], [614, 797.5], [616, 798]]);
const S4_DOCR_X = lutS([[600, 1443], [611, 1443.5], [612, 1444.5], [613, 1432.5], [614, 1407.5], [615, 1379.5], [616, 1351], [617, 1324.5], [618, 1299], [619, 1276.5], [620, 1256], [621, 1238], [622, 1222], [623, 1208], [624, 1198], [626, 1178], [628, 1159], [631, 1131]]);
const S4_DOCR_Y = lutS([[600, 617.5], [601, 623], [602, 629], [603, 637], [604, 645], [605, 655], [606, 666], [607, 678], [608, 693.5], [609, 709.5], [610, 727.5], [611, 747.5], [612, 770.5], [613, 791.5], [614, 798.5], [616, 797.5], [618, 796.5]]);

export const S4Trade: React.FC<{ frame: number; pack: Pack; PillLogo?: React.FC<{ h: number }> }> = ({
  frame,
  pack,
  PillLogo,
}) => {
  if (frame < 440 || frame >= 674) return null;
  const bandIn = interpolate(frame, [440, 462], [0, 1], clamp);
  // measured: marker fixed at 960; 23:00 under it at f550; pan -1.3px/f
  const hourAt = 23 + (frame - 550) * 0.00917;
  // ANIM-FIDELITY (ref f440-618, dense-frame traced): the hexes draw in place
  // at overlap positions (right/B leads ~f446, left/A ~f452), badges snap on
  // full-size and STAGGERED (B~f458, A~f461, NO overshoot — the old back(1.6)
  // pop at f528-540 was invented), the hexes SPREAD f483-506 (measured f486
  // A680/B1200 → f504 A480/B1450), the arrow draws CENTRE-OUTWARD f506-514
  // (not left→right from A), connectors lead the pill f544-560, and the CLS
  // pill/logo WIPES on left→right f551-573 (box grows L→R + logo O→C→L→S — not
  // an opacity fade). Coin timing unchanged. See work/cls-day/s4/*_strip.png.
  const hexInB = interpolate(frame, [446, 466], [0, 1], { ...clamp, easing: EASE });
  const hexInA = interpolate(frame, [452, 472], [0, 1], { ...clamp, easing: EASE });
  const badgePB = interpolate(frame, [456, 462], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const badgePA = interpolate(frame, [460, 466], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const arrowP = interpolate(frame, [506, 514], [0, 1], { ...clamp, easing: EASE });
  const pillP = S4_PILL(frame);
  const logoP = S4_LOGO(frame);
  const connP = S4_CONN(frame);
  // gen12: settled hexes registered to ref f640 (A cx471 cy527, B cx1450;
  // outline flat-to-flat 273 → HH282, vertex 370 → HW382).
  const HW = 382;
  const HH = 282;
  const s = S4_S(frame);
  const ax = S4_AX(frame);
  const ay = S4_AY(frame);
  const bx = S4_BX(frame);
  const by = S4_BY(frame);
  // the diagram's rigid furniture, all riding s off the two hex centres
  const arrowY = (ay + by) / 2;
  const tipL = ax + 186.5 * s;
  const tipR = bx - 187 * s;
  const midX = (ax + bx) / 2;
  const armY = ay + 263 * s;
  const armYR = by + 263 * s;
  const dropL = ax + 3.5 * s;
  const dropR = bx - 6.5 * s;
  const rad = 52 * s;
  const headP = interpolate(connP, [0.95, 1], [0, 1], clamp);
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
      {/* CONNECTORS — under the hexes (the ref's droppers leave the hex bottom
          edge), drawn progressively from f538. Measured: 2px ink, corner
          radius 52 (we had ~27), arm at hexcy+263·s (we had a flat y=812),
          and an OPEN CHEVRON head at the pill edge (we had a filled triangle). */}
      {connP > 0 && (
        <svg width={1920} height={1080} style={{ position: "absolute" }}>
          <path
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - connP}
            d={`M ${dropL} ${ay + 141 * s} V ${armY - rad} A ${rad} ${rad} 0 0 0 ${dropL + rad} ${armY} H ${ax + 270 * s}`}
            fill="none"
            stroke={C.navyDeep}
            strokeWidth={2.5 * s}
          />
          <path
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - connP}
            d={`M ${dropR} ${by + 141 * s} V ${armYR - rad} A ${rad} ${rad} 0 0 1 ${dropR - rad} ${armYR} H ${bx - 273 * s}`}
            fill="none"
            stroke={C.navyDeep}
            strokeWidth={2.5 * s}
          />
          {headP > 0 && (
            <g opacity={headP} fill="none" stroke={C.navyDeep} strokeWidth={8 * s}>
              <path d={`M ${ax + 270 * s - 26 * s} ${armY - 15 * s} L ${ax + 270 * s} ${armY} L ${ax + 270 * s - 26 * s} ${armY + 15 * s}`} />
              <path d={`M ${bx - 273 * s + 26 * s} ${armYR - 15 * s} L ${bx - 273 * s} ${armYR} L ${bx - 273 * s + 26 * s} ${armYR + 15 * s}`} />
            </g>
          )}
        </svg>
      )}
      {/* the two settlement docs riding the connectors into the pill (f600-631):
          out from under the hexes (occluded by them), down, along, gone behind
          the pill. 1.084x SettleDoc — the same art S5 drops from its towers. */}
      {frame >= 599 && frame < 632 && (
        <>
          {(() => {
            const lx = S4_DOCL_X(frame);
            const ly = S4_DOCL_Y(frame);
            const rx = S4_DOCR_X(frame);
            const ry = S4_DOCR_Y(frame);
            return (
              <>
                <div style={{ position: "absolute", inset: 0, transform: `scale(${S4_DOC_SCALE})`, transformOrigin: `${lx}px ${ly}px` }}>
                  <SettleDoc cx={lx} cy={ly} glyph="$" />
                </div>
                <div style={{ position: "absolute", inset: 0, transform: `scale(${S4_DOC_SCALE})`, transformOrigin: `${rx}px ${ry}px` }}>
                  <SettleDoc cx={rx} cy={ry} glyph="€" />
                </div>
              </>
            );
          })()}
        </>
      )}
      {(() => {
        const hexA = <HexCity x={ax} y={ay} w={HW} h={HH} letter="A" badgeP={badgePA} variant={0} opacity={hexInA} />;
        const hexB = <HexCity x={bx} y={by} w={HW} h={HH} letter="B" badge="tr" badgeP={badgePB} variant={1} opacity={hexInB} />;
        if (s === 1) return <>{hexA}{hexB}</>;
        return (
          <>
            <div style={{ position: "absolute", inset: 0, transform: `scale(${s})`, transformOrigin: `${ax}px ${ay}px` }}>{hexA}</div>
            <div style={{ position: "absolute", inset: 0, transform: `scale(${s})`, transformOrigin: `${bx}px ${by}px` }}>{hexB}</div>
          </>
        );
      })()}
      {/* trade-executed arrow — tips ON the hex vertices (ax+186.5·s / bx−187·s),
          line at the hex baseline, chevron heads. Still draws centre-outward
          (f507 centre mark → f513 full); the label rides the same s. */}
      {arrowP > 0 && (
        <>
          <svg width={1920} height={1080} style={{ position: "absolute" }}>
            {(() => {
              const cx = (tipL + tipR) / 2;
              const x1 = cx - (cx - tipL) * arrowP;
              const x2 = cx + (tipR - cx) * arrowP;
              return (
                <>
                  <line x1={x1} y1={arrowY} x2={x2} y2={arrowY} stroke={C.skyBlue} strokeWidth={2.5 * s} />
                  <g fill="none" stroke={C.skyBlue} strokeWidth={9 * s}>
                    <path d={`M ${x1 + 25 * s} ${arrowY - 15 * s} L ${x1} ${arrowY} L ${x1 + 25 * s} ${arrowY + 15 * s}`} />
                    <path d={`M ${x2 - 25 * s} ${arrowY - 15 * s} L ${x2} ${arrowY} L ${x2 - 25 * s} ${arrowY + 15 * s}`} />
                  </g>
                </>
              );
            })()}
          </svg>
          <div
            style={{
              position: "absolute",
              left: midX - 5 - 200,
              top: arrowY - 18.5 * s - 18.9,
              width: 400,
              textAlign: "center",
              fontFamily: pack.sans,
              fontSize: 32,
              color: C.skyBlue,
              opacity: arrowP,
              transform: `scale(${s})`,
              transformOrigin: "200px 18.9px",
            }}
          >
            {pack.tradeExecuted}
          </div>
        </>
      )}
      {/* CLS pill — measured 437×197 at (741,692) with the brand CHIP radius
          (rounded TL+BR, square TR+BL). We drew a 250×107 all-round pill 67px
          too low: less than a third of the ref's area. It SCALES up about
          (946,835) f549-560; the wordmark wipes O→C→L→S inside it to f570. */}
      {pillP > 0 && (() => {
        // settled screen frame while the diagram is settled; the exit affine
        // from f660 on (identity at f660, so no seam).
        const es = frame >= 660 ? s : 1;
        const pl = frame >= 660 ? ax + 270 * s : 741;
        const pt = frame >= 660 ? ay + 165 * s : 692;
        return (
          <div
            style={{
              position: "absolute",
              left: pl,
              top: pt,
              width: 437 * es,
              height: 197 * es,
              background: C.navyBg,
              borderRadius: `${52 * es}px 0 ${52 * es}px 0`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              transform: `scale(${pillP})`,
              transformOrigin: `${205 * es}px ${143 * es}px`,
            }}
          >
            <div style={{ clipPath: `inset(0 ${(1 - logoP) * 100}% 0 0)` }}>
              {PillLogo ? <PillLogo h={98 * es} /> : <ClsWordmark height={78 * es} />}
            </div>
          </div>
        );
      })()}
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
  // gen18 — sy is 1.0000 for the WHOLE cruise. The old [916, 0.988] key had no
  // frame under it: lutS interpolated it back to [684, 1] and quietly
  // compressed the entire world vertically by up to 1.2% for 232 frames (the
  // above-band tick tops rendered at y184 against the ref's 180, the below-band
  // tick feet at 878 against 884 — every line of art in the frame sat wrong).
  // Measured off the above-band tick line (world y180, screen y = 532.5 −
  // 352.5·sy) at f690/700/720/750/780/800/830/850/880/900/910/914/916: 180 at
  // EVERY ONE. The exit keys from f918 are untouched.
  // NB this also retires the gen17 "unprojection trap": with sy = 1 in the
  // cruise, screen y IS world y, and 532.5 + (y − 532.5)/sy is the identity.
  const sy = lutS([
    [674, 0.824], [675, 0.855], [676, 0.88], [677, 0.918], [678, 0.941], [679, 0.953],
    [680, 0.965], [681, 0.978], [682, 0.988], [683, 0.994], [684, 1],
    [916, 1], [918, 0.988], [920, 0.976], [922, 0.929], [924, 0.929], [926, 0.835],
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
  // towers/docs fade f928..930; the tick chain stays crisp until S6's band
  // takes over at f929 (measured: 14:00/15:00 labels still sharp @f928).
  // gen14 retime [924,930]->[928,930]: the ref holds the towers SOLID until
  // they are hidden — at f927 ClG (14:00) is still on-screen (screen ~174,
  // navy sweep front @830 has not reached it) and the ref shows it FULL red,
  // but the old [924,930] had inkP=0.5 there (pale, wrong). By f928 x9=-1601
  // so every above-band tower has panned off-screen left; the navy sweep +
  // pan do the hiding, so the fade only needs to clear any residual f928..930
  // (ref red mass y60-470: 6046@924 -> 3294@927 solid-but-navy-covered ->
  // 1335@928 off-screen -> ~gone@930). PERCEPTUAL SPEND (lesson 8): the eye
  // montage (ref/old/new f927) is unambiguous — old inkP=0.5 rendered ClG +
  // the left towers GHOSTED/pale, ref shows them FULL solid red, new matches
  // ref. SSIM disagrees by -0.002 @f927 (full .858->.856) because the exit
  // whip leaves a small tower positional offset that is cheaper to hide under
  // faded ink than solid ink; the metric cannot veto eye-clear bright content.
  // f924/f930/f935 SSIM byte-identical (inkP unchanged there).
  const inkP = interpolate(frame, [928, 930], [1, 0], clamp);
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
          {/* mirrored (below-band) hour ticks + labels (+6h). These sit UNDER
              the below clusters and always read, because those clusters are
              outline-only. */}
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
            {/* rising instruction docs (BEHIND the towers — the white-filled
                tower bodies do the occluding for free). gen17 re-registered
                the whole set off the ref's ring track: the 09:00 doc was
                MISSING, the 12:00 doc carried the wrong glyph AND sat 60px
                right, and all of them rose 2.65px/f too slow. */}
            {ABOVE_DOCS.map((d, i) =>
              frame >= d.from && frame <= d.to ? (
                <SettleDoc key={`ad${i}`} cx={d.cx} cy={532.5 + (d.cy(frame) - 532.5) / sy} glyph={d.glyph} />
              ) : null,
            )}
            {/* gen17 — the MIRRORED world's docs. This region rendered BLANK:
                the ref drops four instruction docs OUT of the hanging towers
                (white-on-navy twins of the rising ones, $ € € $) and we had
                none. Tracked per-frame off the red ring's centroid
                (work/cls-day/gen17/probe_ring.py): world x fixed, cy
                ACCELERATES ~27 → 39 px/f (the above-band docs, by contrast,
                rise at a flat rate — the ref is hand-animated, so each doc
                carries its own measured table, lesson 14). */}
            {BELOW_DOCS.map((d, i) =>
              frame >= d.from && frame <= d.to ? (
                // the tables are SCREEN y (that is what the tracker reads);
                // this div rides scaleY(sy) about y=532.5, and sy drifts
                // 1 → 0.988 across the cruise, so unproject before placing.
                // Skipping this put the last doc 4px high and LOST SSIM.
                <SettleDoc key={`bd${i}`} cx={d.cx} cy={532.5 + (d.cy(frame) - 532.5) / sy} glyph={d.glyph} below />
              ) : null,
            )}
            {/* opaque hanging-tower bodies. The ref hides each doc until it
                clears its tower's base; the ABOVE clusters occlude for free
                (their bodies are white-filled) but the BELOW clusters are
                outline-only, so the navy fill lives here. Reveal edges from
                row scans of the ref, unprojected to world y: D 855 (+ the
                base-beam foot notch down to 873), E 731 (+ the two capsule
                legs down to 792 — they hide the doc's side edges), F 861.
                Drawn AFTER the docs and BEFORE the clusters, which repaint
                their own ink over it. */}
            <svg width={5200} height={1200} viewBox="0 0 5200 1200" style={{ position: "absolute", left: 0, top: 0 }}>
              <g fill={C.navyBg}>
                <rect x={67} y={576} width={150} height={279} />
                <rect x={94.5} y={855} width={40} height={18} />
                <rect x={687} y={576} width={120} height={155} />
                <path d="M 687 731 L 687 777 Q 687 792 702 792 Q 717 792 717 777 L 717 731 Z" />
                <path d="M 777 731 L 777 777 Q 777 792 792 792 Q 807 792 807 777 L 807 731 Z" />
                <rect x={1287} y={576} width={117} height={285} />
              </g>
            </svg>
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
          {/* gen18 — the ABOVE-band hour chain draws OVER the skyline. We had it
              under: the white-filled tower bodies swallowed whole ticks (probe:
              at f880 the ref reads 7 full-height ticks above the band, we read
              5 — the 12:00 and 15:00 lines were painted out by ClC and ClG).
              The below chain stays under, where the outline-only clusters let
              it through — that one already matched the ref 7-for-7. */}
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

// gen17 settlement doc, traced 1:1 off ref f829 (outer ink box 83x108, so the
// svg is 84x109 and its origin IS the doc's outer top-left): rounded
// bottom-left (r14), square bottom-right, top-right fold at x58/y25, two rule
// lines, a red currency ring (cx 41.5, cy 61, r 22.75). Placed by RING CENTRE
// — that is what the per-frame tracker measures. `below` flips the doc into
// the mirrored world: white outline, no fill, navy showing through.
const SettleDoc: React.FC<{ cx: number; cy: number; glyph: string; below?: boolean }> = ({ cx, cy, glyph, below }) => {
  const ink = below ? WHT : C.navyDeep;
  return (
    <svg width={84} height={109} viewBox="0 0 84 109" style={{ position: "absolute", left: cx - 41.5, top: cy - 61 }}>
      <path
        d="M 1.75 1.75 L 58 1.75 L 81.25 25 L 81.25 105.25 L 15.75 105.25 Q 1.75 105.25 1.75 91.25 Z"
        fill={below ? "none" : C.white}
        stroke={ink}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M 58 1.75 L 58 25 L 81.25 25" fill="none" stroke={ink} strokeWidth="3.5" strokeLinejoin="round" />
      <line x1={12} y1={11} x2={41} y2={11} stroke={ink} strokeWidth="3.5" />
      <line x1={12} y1={21} x2={30} y2={21} stroke={ink} strokeWidth="3.5" />
      <circle cx={41.5} cy={61} r={22.75} fill="none" stroke={C.red} strokeWidth="3.5" />
      <text x={41.5} y={73} textAnchor="middle" fontFamily="Georgia, serif" fontSize="33" fill={C.red}>
        {glyph}
      </text>
    </svg>
  );
};

// The four ABOVE-band docs, re-registered off the ref's ring track (screen y;
// the caller unprojects). One doc per cluster, 52 frames apart. The old table
// had three docs, all "$", rising 33.75px/f from a hand-set top:
//   · the 09:00 doc (ClA's) was MISSING outright;
//   · the 12:00 doc is a €, not a $, and its ring sat at world 1137 vs the
//     ref's 1076.5 — 60px right, half a doc width;
//   · the true rise is a FLAT 36.4px/f (18 intervals across B/C/G, no drift),
//     so the old 33.75 fell 18px behind by the time the doc left frame.
// The 09:00 doc is the odd one: it rises at 27.7px/f, just as flat. Measured
// is measured — the ref is hand-animated and owes us no consistency.
const ABOVE_DOCS: { cx: number; glyph: string; from: number; to: number; cy: (f: number) => number }[] = [
  // from f693, not earlier: ClA's shell fill stops at world 369, so a doc
  // launched sooner pokes out below the tower into the open leg span.
  { cx: -155.3, glyph: "€", from: 693, to: 706, cy: (f) => 195.6 - 27.7 * (f - 697) },
  { cx: 472.1, glyph: "$", from: 748, to: 758, cy: (f) => 170.0 - 36.4 * (f - 752) },
  { cx: 1076.5, glyph: "€", from: 799, to: 809, cy: (f) => 170.1 - 36.4 * (f - 803) },
  { cx: 1661.6, glyph: "$", from: 851, to: 861, cy: (f) => 172.1 - 36.4 * (f - 855) },
];

// The four BELOW-band docs. cy = the ref's red-ring centroid, world y (at the
// cruise sy=1 so world y == screen y). Frames before the reveal edge are
// free — the doc is fully behind its tower — so only the visible keys are
// measured; the leading keys just carry it up out of sight.
const BELOW_DOCS: { cx: number; glyph: string; from: number; to: number; cy: (f: number) => number }[] = [
  {
    cx: 141.6, glyph: "$", from: 717, to: 735,
    cy: lutS([
      [718, 660], [722, 703], [724, 757], [725, 788.8], [726, 822.8], [727, 858.8], [728, 894.8],
      [729, 932.8], [730, 970.6], [731, 1008.7], [732, 1047.7], [733, 1086], [735, 1166],
    ]),
  },
  {
    cx: 143.9, glyph: "€", from: 766, to: 782,
    cy: lutS([
      [767, 705], [771, 766], [772, 793], [773, 823.8], [774, 856.8], [775, 889.8], [776, 925.2],
      [777, 960.9], [778, 997.4], [779, 1034.6], [780, 1072], [782, 1149],
    ]),
  },
  {
    cx: 750.1, glyph: "€", from: 817, to: 835,
    cy: lutS([
      [818, 638], [820, 657], [821, 677], [822, 700.5], [823, 727.5], [824, 758.6], [825, 790.8],
      [826, 824.6], [827, 859.4], [828, 895.2], [829, 931.7], [830, 968.8], [831, 1006.7],
      [832, 1045], [833, 1084], [835, 1163],
    ]),
  },
  {
    cx: 1341.6, glyph: "$", from: 869, to: 885,
    cy: lutS([
      [870, 700], [874, 762], [875, 790], [876, 822], [877, 856.8], [878, 889.8], [879, 925],
      [880, 960.8], [881, 997.2], [882, 1034.5], [883, 1072], [885, 1149],
    ]),
  },
];

// ── traced skyline clusters (r3, per-tower tracing from ref f750/f900) ──
// Above-world slots are 604x330 SVGs at world (center-230), y170; local
// coords = (screen@f750 - slotLeft - 288, screen_y - 170). Below-world
// slots are 604x330 at y570. All geometry from 2x crops of the ref frames.
const NAVY = "#0B2341";
const WHT = "#FDFDFD";

// 09:00 cluster — gen17 FULL RE-REGISTRATION. Every other tower in this
// skyline had been re-traced against the ref; this one never was, and it
// showed. Re-read per-pixel off ref f690, where the world is settled and
// x9 = 384 exactly, so ClA-local = (screen_x - 2, screen_y - 170) — the
// cleanest frame in the whole cruise for this slot.
//
// What the old model got wrong (all four are POSITION errors first — the ink
// was not misdrawn so much as misplaced, lesson 4):
//   · the red tower was 105 wide against the ref's 149 (x158..307), and its
//     crown sat at y42 against y44 with the shell top at y66 against y74 —
//     so the whole tower read tall and thin. The 8px shell-top error also
//     mistimed the 09:00 doc's reveal, which rides this white fill.
//   · the tower's LEGS are separate boxes below a shell that STOPS at y199;
//     the old model ran one shell to the band with wings bolted on.
//   · the left bridge is a CURVE into the band (r≈20 at x28.5), not a square
//     step running off the frame edge at x-60.
//   · the right side is a dotted building + a two-rail gantry that STOPS at
//     x435. The old model stepped on toward the 10:00 slot at x519 — ink the
//     ref does not have.
const ClA: React.FC = () => (
  <svg width={604} height={330} viewBox="0 0 604 330">
    {/* grey slabs, behind everything (measured #D7D7D7 == the band grey) */}
    <rect x={308} y={212} width={12} height={108} fill={C.bandGrey} />
    <rect x={356} y={244} width={11} height={76} fill={C.bandGrey} />
    {/* left bridge — the ref curves down to the band */}
    <path d="M 109 242.5 L 48 242.5 Q 28.5 242.5 28.5 262 L 28.5 320" fill="none" stroke={NAVY} strokeWidth="3.5" />
    {/* navy barred building + roof box + antenna */}
    <line x1={149.5} y1={163} x2={149.5} y2={177} stroke={NAVY} strokeWidth="3" />
    <rect x={137.5} y={176.5} width={20.5} height={11} fill={WHT} stroke={NAVY} strokeWidth="3" />
    <rect x={109.5} y={187.5} width={50} height={132.5} fill={WHT} stroke={NAVY} strokeWidth="3.5" />
    {[0, 1, 2, 3, 4, 5, 6].map((r) => (
      <rect key={r} x={130} y={197 + r * 11} width={15} height={3.5} fill={NAVY} />
    ))}
    {/* red tower — antenna, crown, shell (square top-left, ROUNDED top-right),
        5 hanging stripes. The white shell fill is what hides the rising doc. */}
    <line x1={197} y1={44} x2={197} y2={58} stroke={C.red} strokeWidth="3" />
    <rect x={189.5} y={59.5} width={42} height={12} fill={WHT} stroke={C.red} strokeWidth="3" />
    <path d="M 179.5 199 L 179.5 75.5 L 271.5 75.5 Q 281.5 75.5 281.5 85.5 L 281.5 199" fill={WHT} stroke={C.red} strokeWidth="3.5" />
    {[201, 215.5, 231, 245.5, 259.5].map((x, i) => (
      <line key={i} x1={x} y1={86} x2={x} y2={117} stroke={C.red} strokeWidth="3" />
    ))}
    {/* bar panel: two columns run all the way to the band; 7 rungs at a 16.3
        pitch (the first gap is wider — it holds the solid band); short ticks
        sit in the 4th and 6th gaps */}
    <line x1={191} y1={115} x2={191} y2={320} stroke={C.red} strokeWidth="3" />
    <line x1={273} y1={115} x2={273} y2={320} stroke={C.red} strokeWidth="3" />
    {[116.5, 138.5, 154.5, 171.5, 187.5, 203.5, 219.5].map((y, i) => (
      <line key={i} x1={190} y1={y} x2={274} y2={y} stroke={C.red} strokeWidth="3.5" />
    ))}
    <rect x={204} y={141} width={56} height={12} fill={C.red} />
    {[174, 206].map((y) =>
      [205, 259].map((x) => <line key={`${x}-${y}`} x1={x} y1={y} x2={x} y2={y + 11} stroke={C.red} strokeWidth="3" />),
    )}
    {/* legs: top bars, outer walls to the band, one dashed riser each */}
    <path d="M 158 198.5 L 192 198.5 M 272 198.5 L 306 198.5" fill="none" stroke={C.red} strokeWidth="3.5" />
    <line x1={159.5} y1={198} x2={159.5} y2={320} stroke={C.red} strokeWidth="3.5" />
    <line x1={304} y1={198} x2={304} y2={320} stroke={C.red} strokeWidth="3.5" />
    <line x1={175} y1={206} x2={175} y2={300} stroke={C.red} strokeWidth="3" strokeDasharray="11 15" />
    <line x1={288.5} y1={206} x2={288.5} y2={300} stroke={C.red} strokeWidth="3" strokeDasharray="11 15" />
    {/* base box under the open span */}
    <line x1={218} y1={307} x2={250} y2={307} stroke={C.red} strokeWidth="3" />
    {[219.5, 233, 248.5].map((x, i) => (
      <line key={i} x1={x} y1={307} x2={x} y2={320} stroke={C.red} strokeWidth="3" />
    ))}
    {/* navy dotted building — OPEN on the left, so the grey slab reads through */}
    <path d="M 307 208.5 L 342.5 208.5 Q 352.5 208.5 352.5 218.5 L 352.5 320" fill="none" stroke={NAVY} strokeWidth="3.5" />
    {[0, 1].map((r) =>
      [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={312 + c * 13.5} y={217 + r * 17} width={4} height={7.5} fill={NAVY} />),
    )}
    <line x1={307} y1={274.5} x2={358} y2={274.5} stroke={NAVY} strokeWidth="3.5" />
    {/* right gantry: two rails, one leg to the band — and it STOPS at x434 */}
    <line x1={352} y1={239} x2={434} y2={239} stroke={NAVY} strokeWidth="3" />
    <line x1={352} y1={249.5} x2={434} y2={249.5} stroke={NAVY} strokeWidth="3" />
    <line x1={432.5} y1={239} x2={432.5} y2={320} stroke={NAVY} strokeWidth="3.5" />
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
    {/* gen14 ClB RIGHT re-reg (ref f850, probe: fine window/wall scan):
        (a) the r3 3-row wide navy building was a full white rect that hid
        the grey slab — ref shows a NARROW window-wall: grey slab (screen
        675..684) reads THROUGH a 2x2 window box (localY 223..250, right
        wall localX 355 to band), (b) the far-right L-bridge (localX
        360..430) + stepped outline building (440..505) do NOT exist — right
        of the 11:00 tick the ref is empty white but for one small L-notch
        at localX 403 (screen 749). Removing the phantom stepped tower is
        the r15 r2c3 win (misplaced ink → white). */}
    <rect x={328.5} y={216} width={10} height={104} fill="#DCDCDC" />
    <line x1={355} y1={188} x2={355} y2={320} stroke={NAVY} strokeWidth="3.5" />
    <rect x={330} y={222} width={25} height={29} fill="none" stroke={NAVY} strokeWidth="3.5" />
    <line x1={330} y1={236} x2={355} y2={236} stroke={NAVY} strokeWidth="3" />
    <line x1={342} y1={222} x2={342} y2={251} stroke={NAVY} strokeWidth="3" />
    {/* small L-notch right of the 11:00 tick */}
    <path d="M 393 260 L 406 260" fill="none" stroke={NAVY} strokeWidth="3.5" />
    <line x1={403} y1={260} x2={403} y2={320} stroke={NAVY} strokeWidth="3.5" />
  </svg>
);

// 12:00 cluster: twin-column square-window tower
const ClC: React.FC = () => (
  <svg width={604} height={330} viewBox="0 0 604 330">
    {/* far-left thin outline bridge */}
    <path d="M 49.5 320 L 49.5 270 Q 49.5 262.5 57 262.5 L 107 262.5 L 107 320" fill={WHT} stroke={NAVY} strokeWidth="3.5" />
    {/* left WHITE building w/ shelf glyphs (r7 re-trace, ink runs f860:
        the r3 navy-block-with-slots read was inverted — ref body is white,
        4 "⊓" shelves y227+15.7k x110.5 w26, roof bar y214 spanning to 163,
        ticks ON the roof at 106.5/118.5/134.5/152.5) */}
    <rect x={100.5} y={216.5} width={47} height={103.5} fill={WHT} />
    <line x1={102.3} y1={219} x2={102.3} y2={320} stroke={NAVY} strokeWidth="3.5" />
    <line x1={145.7} y1={219} x2={145.7} y2={320} stroke={NAVY} strokeWidth="3.5" />
    <rect x={100.5} y={214} width={62.5} height={5} fill={NAVY} />
    {[106.5, 118.5, 134.5, 152.5].map((x) => (
      <line key={x} x1={x} y1={204} x2={x} y2={214} stroke={NAVY} strokeWidth="3" />
    ))}
    {[0, 1, 2, 3].map((k) => (
      <React.Fragment key={k}>
        <rect x={110.5} y={227 + k * 15.7} width={26} height={4.5} fill={NAVY} />
        <rect x={110.5} y={231.5 + k * 15.7} width={3.5} height={3.5} fill={NAVY} />
        <rect x={133} y={231.5 + k * 15.7} width={3.5} height={3.5} fill={NAVY} />
      </React.Fragment>
    ))}
    {/* grey slab (behind the dots building) */}
    <rect x={302} y={207.5} width={17.5} height={112.5} fill="#DCDCDC" />
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
    {/* right navy building w/ dots (r7 re-trace f860: 2 rows x 3 cols at
        306.5/318.5/332.5 y220/237.5, inner rail y277) + measured L-pipe
        right furniture (rail y236.5 -> drop pipe x394 -> band; tall thin
        post x374.5; the r3 "y270 bridge to 452" does not exist in ref) */}
    <path d="M 302 320 L 302 215 Q 302 208 309.5 208 L 340 208 Q 348.5 208 348.5 215.5 L 348.5 320" fill={WHT} stroke={NAVY} strokeWidth="3.5" />
    {[0, 1].map((r) =>
      [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={306.5 + c * 13} y={220 + r * 17.5} width={4} height={8.5} fill={NAVY} />),
    )}
    <rect x={302} y={277} width={48} height={3} fill={NAVY} />
    <rect x={348.5} y={236.5} width={50} height={6.5} fill={NAVY} />
    <rect x={374.5} y={200} width={4.5} height={120} fill={NAVY} />
    <rect x={394} y={240} width={5} height={80} fill={NAVY} />
  </svg>
);

// 14:00 cluster: capped tower w/ twin window slots + dash-grid base (f900)
const ClG: React.FC = () => (
  <svg width={604} height={330} viewBox="0 0 604 330">
    {/* left low bridge */}
    <path d="M 56 320 L 56 267.5 L 118 267.5 L 118 320" fill={WHT} stroke={NAVY} strokeWidth="3.5" />
    {/* left navy building (r7 re-trace f860: rooftop box x152.5 w21 h8.5
        no mast; 7 dashes x146 w14 at y201.5+11k — the r3 8-dash stack sat
        24px low and 10px left) */}
    <rect x={152.5} y={180.5} width={21} height={8.5} fill={WHT} stroke={NAVY} strokeWidth="3" />
    <rect x={118} y={190} width={53} height={130} fill={WHT} stroke={NAVY} strokeWidth="3.5" />
    {[0, 1, 2, 3, 4, 5, 6].map((r) => (
      <rect key={r} x={146} y={201.5 + r * 11} width={14} height={3.5} fill={NAVY} />
    ))}
    {/* grey slab (thin, right of the body wall — the ref shows a slim grey
        sliver between the red body and the navy building; the r7 wide slab
        sat under both fills and never read) */}
    <rect x={294} y={205} width={11} height={125} fill="#DCDCDC" />
    {/* gen13 ClG RE-REGISTRATION (ref f877/897/907, probe_clg2.py):
        the red tower sat ~7px LEFT and its broad-body RIGHT wall was hidden
        under the navy building's white fill (navy started local 285, body
        wall 290) → att body read w105 vs ref w120, npx 4900 vs 6300. Fix:
        (a) head shifted right + narrowed about its center (att center 226 →
        ref 233.5, ×0.94), (b) body walls 170/290 → 175/294 (right wall now
        VISIBLE), (c) navy building moved right (+15) so the body wall + grey
        slab show, (d) dash grid re-pitched 186→196 to match ref cols. */}
    {/* crown + masts */}
    <line x1={226} y1={57.5} x2={226} y2={70} stroke={C.red} strokeWidth="3.5" />
    <line x1={235.5} y1={57.5} x2={235.5} y2={70} stroke={C.red} strokeWidth="3.5" />
    <rect x={190} y={70} width={92} height={22} fill={WHT} stroke={C.red} strokeWidth="3.5" />
    <line x1={195} y1={100} x2={276} y2={100} stroke={C.red} strokeWidth="3.5" />
    {/* upper shaft + inner panel w/ twin slots (left solid, right pale) */}
    <rect x={186.5} y={97.5} width={94} height={107.5} fill={WHT} stroke={C.red} strokeWidth="3.5" />
    <rect x={207.5} y={122.5} width={63.5} height={82.5} fill="none" stroke={C.red} strokeWidth="3.5" />
    <rect x={216.5} y={135} width={17} height={25} fill={C.red} />
    <rect x={238} y={135} width={16} height={25} fill="#F2C7A9" />
    <rect x={216.5} y={160} width={17} height={45} fill="none" stroke={C.red} strokeWidth="3" />
    <rect x={238} y={160} width={16} height={45} fill="none" stroke={C.red} strokeWidth="3" />
    {/* broad body w/ dash windows — walls 175/294 (ref-registered, right
        wall visible) */}
    <path d="M 175 320 L 175 215 Q 175 205 185 205 L 284 205 Q 294 205 294 215 L 294 320" fill={WHT} stroke={C.red} strokeWidth="3.5" />
    {[0, 1, 2, 3].map((r) =>
      [0, 1, 2, 3, 4].map((c) => (
        <rect key={`${r}${c}`} x={196 + c * 19.5} y={224 + r * 25} width={4} height={11} fill={C.red} />
      )),
    )}
    <path d="M 218.5 330 L 218.5 307.5 L 250.5 307.5 L 250.5 330" fill="none" stroke={C.red} strokeWidth="3.5" />
    {/* right navy building (r7 re-trace f860 + gen13 +15px shift so the body
        right wall/grey slab read: window section = 4 horizontal rails
        y214.5/226.5/240/252 x310.5..363.5 with short dividers at 336.5/350.5
        between rail pairs; bridge rails right at y263/y302 to the 15:00
        rounded outline) */}
    <path d="M 300 320 L 300 195 Q 300 187.5 307.5 187.5 L 355.5 187.5 Q 363.5 187.5 363.5 195 L 363.5 320" fill={WHT} stroke={NAVY} strokeWidth="3.5" />
    {[214.5, 226.5, 240, 252].map((y, i) => (
      <rect key={i} x={310.5} y={y} width={53} height={i < 2 ? 3.5 : 4} fill={NAVY} />
    ))}
    {[336.5, 350.5].map((x) => (
      <React.Fragment key={x}>
        <rect x={x} y={218} width={3.5} height={8.5} fill={NAVY} />
        <rect x={x} y={244} width={3.5} height={8} fill={NAVY} />
      </React.Fragment>
    ))}
    <rect x={363.5} y={263} width={24.5} height={3} fill={NAVY} />
    <rect x={363.5} y={302} width={24.5} height={4.5} fill={NAVY} />
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
    {/* red hanging tower — r10 re-trace (ref f750, per-pixel): outer walls
        y6..282, roof beam y45, crown box y6..21, base beam y282 + left foot
        + twin right masts. The r7 body stopped at y250 (32px short → base
        sat high, tower read compressed) — this was the S5 PERSISTENT worst
        cluster (crop SSIM .52 vs .70-.75 for every other cluster). Grid
        re-registered: left cols x167.5/197.5 (w19), right x271.5 (w18);
        7 rows tops 70..237 (pitch 28, h19); solids per-row unchanged. */}
    <line x1={156.5} y1={6} x2={156.5} y2={282} stroke={C.red} strokeWidth="4" />
    <line x1={303} y1={6} x2={303} y2={282} stroke={C.red} strokeWidth="4" />
    <rect x={211.5} y={6} width={35} height={15} fill="none" stroke={C.red} strokeWidth="3.5" />
    <line x1={229.5} y1={6} x2={229.5} y2={21} stroke={C.red} strokeWidth="3" />
    <line x1={155} y1={45} x2={304.5} y2={45} stroke={C.red} strokeWidth="4" />
    <line x1={244.5} y1={45} x2={244.5} y2={282} stroke={C.red} strokeWidth="3.5" />
    {([[70, 0, 0, 0], [98, 1, 0, 0], [126, 0, 0, 0], [154, 0, 1, 1], [182, 0, 0, 0], [209, 0, 0, 0], [237, 1, 0, 1]] as const).map(([y, s1, s2, s3], i) => (
      <React.Fragment key={i}>
        <rect x={167.5} y={y} width={19} height={19} fill={s1 ? C.red : "none"} stroke={C.red} strokeWidth="3" />
        <rect x={197.5} y={y} width={19} height={19} fill={s2 ? C.red : "none"} stroke={C.red} strokeWidth="3" />
        <rect x={271.5} y={y} width={18} height={19} fill={s3 ? C.red : "none"} stroke={C.red} strokeWidth="3" />
      </React.Fragment>
    ))}
    {/* base beam w/ left foot notch + twin right masts (measured y282..315) */}
    <path d="M 155 282 L 182.5 282 L 182.5 300 L 222.5 300 L 222.5 282 L 304.5 282" fill="none" stroke={C.red} strokeWidth="4" />
    <line x1={272.5} y1={282} x2={272.5} y2={297} stroke={C.red} strokeWidth="3" />
    <line x1={288.5} y1={282} x2={288.5} y2={315} stroke={C.red} strokeWidth="3.5" />
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

// ─── S7: netting donuts (f1170..1478) ───
// Motion re-traced frame-exact (GEN-15, ref probes in work/cls-day/s7). The
// grey ring draw-in (f1170..1188, r289.5/thick131/outer355 at 958,517) is
// faithful and untouched; everything else was invented or mistimed:
//   • "0%" label + donut SLIDE right 958→1352 measured f1200..1220 (old
//     1192..1212 ran ~8f early; label was gated f1214 — ref shows it at f1194).
//   • ONE icon circle (511,511 r237) DRAWS IN clockwise from the top f1206..1220
//     (ref grows the stroke top→around; it never faded). Old code FADED it in
//     ~32f late at f1238..1250.
//   • dashed connector icon→donut (horiz at y517) wipes in f1222..1250, then
//     morphs to a bracket at the split. The old code drew NO connector; the ref
//     has one the whole scene.
//   • count 0→96% f1230..1252 — measured 1/11/62/87/94/96 (ref digit reads).
//     GEN-9's curve gave 21/48/75 across the 11→62 jump: too slow mid-sweep.
//   • single icon SPLITS to two (516,313)+(515,721) r150 + bracket connector
//     over f1300..1308 (old 1352..1364 crossfade ran ~50f late).
//   • count 96→99% f1320..1340 (ref 96/97/98/99; old 1344..1360).
export const S7Netting: React.FC<{ frame: number; pack: Pack }> = ({ frame, pack }) => {
  if (frame < 1170 || frame >= 1478) return null;
  const bgP = interpolate(frame, [1170, 1174], [0, 1], clamp);
  const outP = interpolate(frame, [1464, 1476], [0, 1], clamp);
  const ringIn = lutS([[1170, 0.05], [1172, 0.115], [1174, 0.26], [1176, 0.7], [1178, 0.86], [1180, 0.94], [1182, 0.975], [1188, 1]])(frame);
  const cx = interpolate(frame, [1200, 1220], [958, 1352], { ...clamp, easing: EASE });
  const cy = 517;
  const t1 = parseFloat(pack.percents[1]) / 100;
  const t2 = parseFloat(pack.percents[2]) / 100;
  const cnt1 = lutS([[1229, 0], [1230, 0.01], [1236, 0.115], [1240, 0.646], [1244, 0.906], [1248, 0.979], [1252, 1]])(frame) * t1;
  const progress = frame < 1320 ? cnt1 : interpolate(frame, [1320, 1340], [t1, t2], clamp);
  const pct = `${Math.round(progress * 100)}%`;
  const iconDraw = interpolate(frame, [1206, 1220], [0, 1], clamp); // clockwise arc draw-in
  const connWipe = interpolate(frame, [1222, 1250], [0, 1], clamp); // connector left→right
  const splitP = interpolate(frame, [1300, 1308], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", inset: 0, background: C.blue, opacity: bgP * (1 - outP) }}>
      {/* dashed connectors sit behind the donut + icons */}
      {frame >= 1206 && splitP < 1 && <NetConnector mode="single" wipe={connWipe} opacity={1 - splitP} />}
      {splitP > 0 && <NetConnector mode="bracket" wipe={1} opacity={splitP} />}
      <Donut
        cx={cx}
        cy={cy}
        r={289.5}
        thick={131}
        progress={progress}
        pct={frame >= 1192 ? pct : ""}
        ringBg={C.donutGrey}
        ringFg={C.navyBg}
        center="none"
        textColor="#FCFCFC"
        fontSize={170}
        pctDy={16}
        bgSweep={ringIn}
      />
      {progress > 0.2 && <MarkerTriangle x={1352} y={cy - 289.5 - 131 / 2 - 55} size={40} />}
      {/* icon circles: one (draws in), then two (split) */}
      {frame >= 1206 && splitP < 1 && <NetIcon x={511} y={511} r={237} p={1 - splitP} draw={iconDraw} kind="in" />}
      {splitP > 0 && (
        <>
          <NetIcon x={516} y={313} r={150} p={splitP} kind="in" />
          <NetIcon x={515} y={721} r={150} p={splitP} kind="out" />
        </>
      )}
    </div>
  );
};

// dashed netting connector — measured y517, x-band 765→998 (single) with a
// vertical bracket at x827 once the icon splits (dash pitch 17 on / 19 off).
const NetConnector: React.FC<{ mode: "single" | "bracket"; wipe: number; opacity: number }> = ({ mode, wipe, opacity }) => {
  const dash = "17 19";
  const stroke = "#FDFDFD";
  const sw = 3;
  const donutLeft = 998;
  const midY = 517;
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", opacity }}>
      {mode === "single" ? (
        <line x1={765} y1={midY} x2={765 + (donutLeft - 765) * wipe} y2={midY} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} strokeLinecap="butt" />
      ) : (
        // upper icon → bar, lower icon → bar, bar spans the two, mid → donut
        <path d={`M 668 313 H 827 M 667 721 H 827 M 827 313 V 721 M 827 ${midY} H ${donutLeft}`} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
      )}
    </svg>
  );
};

const NetIcon: React.FC<{ x: number; y: number; r: number; p: number; kind: "in" | "out"; draw?: number }> = ({ x, y, r, p, kind, draw = 1 }) => {
  const s = r / 110; // glyph scale
  const circ = 2 * Math.PI * r;
  const glyphP = interpolate(draw, [0.4, 1], [0, 1], clamp); // glyph appears once the arc is mostly drawn
  return (
    <div style={{ position: "absolute", inset: 0, opacity: p }}>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <circle
          cx={x}
          cy={y}
          r={r}
          fill="none"
          stroke="#FDFDFD"
          strokeWidth={4}
          strokeDasharray={draw >= 1 ? undefined : `${draw * circ} ${circ}`}
          transform={draw >= 1 ? undefined : `rotate(-90 ${x} ${y})`}
        />
        {/* chip stack glyph */}
        <g opacity={glyphP} transform={`translate(${x} ${y}) scale(${s}) translate(-56 -40)`}>
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
