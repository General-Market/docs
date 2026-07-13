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
              // NEGATIVE A/B (gen19): the tagline's ink is still ~5.4k px short of the
              // ref's (9.8k vs 15.2k) at the right EXTENTS — the ref's face has a fatter
              // stroke for its advance. Weight 400 LOST (.9252->.9213 @f80, .9169->.9120
              // @f110) and 500 lost more (.9205): Helvetica Regular's advances are wider,
              // so the ink widens to 432..1486 against the ref's 472..1449 and walks off
              // its registration. Misplaced ink loses to absent ink — do not bold in place.
              // The remaining deficit is FACE, not weight, and it is at the floor here.
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

// ─── S1 EXIT — ONE RIG: the card ROTATES AND ZOOMS about the FRAME CENTRE while
// a strip opens down its own centre line (gen19) ───
// Tracked per frame off the eight red icon clusters, rejecting any cluster the
// strip has begun to eat (a shrunken cluster's centroid slides): the transform
// fits as a SIMILARITY with 0.2-0.6px RMS, and its fixed point is (960, 540) —
// the frame centre — at every frame. Not a translation, not an affine, not a
// perspective. A roll and a zoom about the middle of the screen.
//   f  100    102    104    106    108    110    112    113
//   s  1.000  1.000  1.009  1.024  1.048  1.092  1.169  1.254
//   deg 0.00   0.33   1.32   3.55   7.37  14.10  24.73  38.27
// Unproject the white split into card space and it is a VERTICAL band centred on
// card x=959 (dead centre, constant to 0.5px) that opens SYMMETRICALLY. So the
// split is ONE card-space clip, and the slash's lean IS the card's rotation —
// there is no separate slash geometry to fit.
//
// The old model had NO rotation and NO zoom: it drew the card dead still and cut it
// with an asymmetric video-space slit leaning a fixed 14 deg, starting at f107. The
// ref starts the split at f102 and by f110 the card is 14 deg over and 9% zoomed —
// at that frame every pixel of card ink we drew was in the wrong place.
const S1_ROT = lutS([[100, 0], [101, 0.05], [102, 0.33], [103, 0.77], [104, 1.32], [105, 2.27], [106, 3.55], [107, 5.19], [108, 7.37], [109, 10.26], [110, 14.1], [111, 18.6], [112, 24.7], [113, 37], [114, 51.5], [115, 62.8], [116, 69], [117, 74.5], [118, 79], [120, 85]]);
const S1_SCL = lutS([[100, 1], [101, 1.0003], [102, 1.0004], [103, 1.0033], [104, 1.0094], [105, 1.0145], [106, 1.0236], [107, 1.0346], [108, 1.0483], [109, 1.0668], [110, 1.0918], [111, 1.1233], [112, 1.1692], [113, 1.2543], [114, 1.39], [115, 1.58], [116, 1.83], [117, 2.15], [118, 2.5]]);
// strip FULL width in CARD px (per-column navy-fraction of the unprojected frame)
const S1_GAP = lutS([[101, 0], [102, 0], [103, 4], [104, 10], [105, 20], [106, 32], [107, 48], [108, 70], [109, 101], [110, 143], [111, 194], [112, 305], [113, 530], [114, 660], [115, 700], [116, 720], [118, 760]]);
const S1_CX = 959; // strip centre line, CARD x

// The strip in VIDEO space — S2's world lives INSIDE it until the card is gone.
// Card rect (S1_CX±g, ±far) through v = P + s·R·(c − P).
export const s1StripPoly = (frame: number): string | undefined => {
  if (frame < 96 || frame > 117) return undefined;
  const g = S1_GAP(frame) / 2;
  const th = (S1_ROT(frame) * Math.PI) / 180;
  const s = S1_SCL(frame);
  const co = Math.cos(th) * s;
  const si = Math.sin(th) * s;
  const F = 4200;
  const pt = (cx: number, cy: number) => {
    const dx = cx - 960;
    const dy = cy - 540;
    return `${(960 + co * dx - si * dy).toFixed(1)}px ${(540 + si * dx + co * dy).toFixed(1)}px`;
  };
  return `polygon(${pt(S1_CX - g, -F)}, ${pt(S1_CX + g, -F)}, ${pt(S1_CX + g, F)}, ${pt(S1_CX - g, F)})`;
};

// ─── S1: intro (f0..123) — draw-on reveal, then rise + icon draw, then the roll ───
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
  if (frame < 102) return card;
  const g = S1_GAP(frame) / 2;
  const L = S1_CX - g;
  const R = S1_CX + g;
  // LogoCard's own navy is exactly 1920x1080 — under the roll its corners swing off
  // the frame and the white world leaks through. Each half carries an oversized navy.
  const half = (side: "l" | "r") => (
    <div
      style={{
        position: "absolute",
        inset: 0,
        clipPath:
          side === "l"
            ? `polygon(-3200px -3200px, ${L}px -3200px, ${L}px 4300px, -3200px 4300px)`
            : `polygon(${R}px -3200px, 5100px -3200px, 5100px 4300px, ${R}px 4300px)`,
      }}
    >
      <div style={{ position: "absolute", left: -1700, top: -1700, width: 5320, height: 4480, background: C.navyBg }} />
      {card}
    </div>
  );
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `rotate(${S1_ROT(frame)}deg) scale(${S1_SCL(frame)})`,
        transformOrigin: "960px 540px",
      }}
    >
      {half("l")}
      {half("r")}
    </div>
  );
};

// The S2 world arrives INSIDE the S1 strip, not as a plane sweeping up from the
// bottom-right: at ref f106-113 the ONLY white in the frame is the strip, and the
// ruler hairline sits inside it, leaning with the card. WipeIn stays exported as a
// no-op for mount-order stability.
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
  // gen19: S2 is BORN INSIDE THE S1 STRIP. Through f117 the ref shows white ONLY
  // between the two halves of the splitting card — the "ruler sweeping up from the
  // bottom-right with a white world glued below it" was our own invention, and it
  // painted the bottom-right of the frame white from f106 while the ref held it navy.
  // Everything S2 draws is clipped to the strip until the card has flown apart.
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1, clipPath: s1StripPoly(frame) }}>
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
// gen19: THE HEXES DO NOT FADE IN — THEY FLY IN AND UNFURL.
// Per-frame outline bboxes off the ref (navy components below the band, before the
// badges contaminate them): each hex enters as a THIN VERTICAL LENS from off the
// lower-right and opens HORIZONTALLY about its own centre — width 7 -> 560 while the
// HEIGHT stays 420 to the pixel (a Y-axis flip, not a scale-up), and the ink is
// FULL-DARK from the first frame it exists (mean grey 62 at f448, the settled value).
//   hexA  f442 w7   c(1544, 785)  ->  f464 w560 c(722, 526)
//   hexB  f443 w14  c(1898, 912)  ->  f464 w560 c(1190, 738)
// We drew both parked at their settled centres, full width, and cross-faded them up
// (hexInA/hexInB). Every frame of the entrance was a 560x420 element in the wrong
// place at the wrong width. The centre LUTs above now carry the fly-in; these carry
// the unfurl.
const S4_KA = lutS([[442, 0.0125], [443, 0.0143], [444, 0.0179], [445, 0.0268], [446, 0.0393], [447, 0.0571], [448, 0.0821], [449, 0.1196], [450, 0.1786], [451, 0.2821], [452, 0.5107], [453, 0.7375], [454, 0.8393], [455, 0.8982], [456, 0.9339], [457, 0.9589], [458, 0.9768], [459, 0.9893], [460, 0.9946], [461, 1]]);
const S4_KB = lutS([[443, 0.025], [444, 0.0375], [445, 0.0554], [446, 0.0821], [447, 0.1214], [448, 0.1804], [449, 0.2839], [450, 0.5107], [451, 0.7393], [452, 0.8411], [453, 0.9], [454, 0.9375], [455, 0.9607], [456, 0.9786], [457, 0.9893], [458, 0.9946], [459, 0.9982], [460, 1]]);
const S4_AX = lutS([[442, 1544], [443, 1404.5], [444, 1291.5], [445, 1199], [446, 1122.5], [447, 1058.5], [448, 1003.5], [449, 957], [450, 917.5], [451, 883.5], [452, 853.5], [453, 828], [454, 806.5], [455, 788], [456, 772], [457, 759], [458, 748], [459, 739.5], [460, 733], [461, 727.5], [462, 724.5], [464, 722.8], [480, 722.8], [482, 720.1], [484, 715.1], [486, 704.4], [488, 685.6], [490, 650.2], [491, 618.7], [492, 561.6], [493, 469], [494, 418.8], [495, 395.3], [496, 380.5], [497, 370.7], [498, 364.1], [500, 355.4], [502, 351.4], [504, 348.7], [538, 349.7], [540, 352], [542, 358], [544, 366.5], [546, 384.3], [548, 420.3], [550, 446.6], [552, 459.2], [554, 464.7], [556, 468], [560, 471], [660, 471], [661, 468], [662, 461], [663, 448.7], [664, 428.4], [665, 400.9], [666, 360.4], [667, 302.1], [668, 224], [669, 104.4], [670, -79.2], [671, -346], [672, -727], [673, -1212]]);
const S4_AY = lutS([[442, 785.5], [443, 741], [444, 705], [445, 675.5], [446, 651], [447, 630.5], [448, 613.5], [449, 598.5], [450, 586], [451, 574.5], [452, 565.5], [453, 558], [454, 550.5], [455, 545], [456, 540], [457, 536], [458, 532.5], [459, 529.5], [461, 527.5], [464, 526.5], [480, 526.5], [482, 525.5], [484, 526.5], [486, 527.5], [488, 530], [490, 534.5], [491, 538.5], [492, 545.9], [493, 559.1], [494, 564.3], [495, 566.3], [496, 567.5], [497, 567.5], [498, 568.3], [500, 568.3], [502, 569.8], [504, 568.8], [538, 568.3], [540, 566.7], [542, 566.2], [544, 563.2], [546, 557.2], [548, 545.1], [550, 536.1], [552, 532], [554, 528.5], [556, 527], [660, 527], [661, 527.5], [662, 529.5], [663, 535.5], [664, 543], [665, 555.1], [666, 570.6], [667, 588.6], [668, 616.6], [669, 653.2], [670, 706], [671, 780], [672, 880], [673, 1000]]);
const S4_BX = lutS([[443, 1898.5], [444, 1782], [445, 1686], [446, 1606.5], [447, 1540.5], [448, 1484], [449, 1436], [450, 1394.5], [451, 1358.5], [452, 1328], [453, 1302.5], [454, 1280], [455, 1260.5], [456, 1244.5], [457, 1231.5], [458, 1220], [459, 1211], [460, 1204], [461, 1198.5], [462, 1195.5], [464, 1190.7], [480, 1190.7], [482, 1193.4], [484, 1198.4], [486, 1209.1], [488, 1228.9], [490, 1264.3], [491, 1296.8], [492, 1355], [493, 1449.1], [494, 1499.9], [495, 1524.4], [496, 1539.7], [497, 1549.5], [498, 1556.6], [500, 1565.3], [502, 1569.3], [504, 1572.1], [538, 1571.1], [540, 1568.8], [542, 1562.8], [544, 1554.3], [546, 1536.5], [548, 1500.6], [550, 1474.3], [552, 1461.8], [554, 1456.3], [556, 1453], [560, 1450], [660, 1450], [661, 1449], [662, 1446], [663, 1438.8], [664, 1428], [665, 1412], [666, 1389.6], [667, 1359.3], [668, 1312.9], [669, 1244.9], [670, 1136.8], [671, 985], [672, 790], [673, 550]]);
const S4_BY = lutS([[443, 912.5], [444, 894.5], [445, 879.5], [446, 867.5], [447, 849.5], [448, 831], [449, 815.5], [450, 803], [451, 791.5], [452, 782], [453, 773.5], [454, 766], [455, 760], [456, 754.5], [457, 750.5], [459, 744.5], [461, 741], [464, 738.4], [480, 738.4], [482, 736.5], [484, 735], [486, 729.5], [488, 721], [490, 705.1], [491, 690.6], [492, 667.2], [493, 633], [494, 610.3], [495, 597.4], [496, 588.7], [497, 582.7], [498, 579.5], [500, 573.5], [502, 571.5], [504, 569], [538, 568.5], [540, 567], [542, 566.5], [544, 563.6], [546, 557.6], [548, 544.8], [550, 535.9], [552, 531.9], [554, 529], [556, 527], [660, 527], [661, 527.5], [662, 529.5], [663, 535.5], [664, 543], [665, 555.1], [666, 570.4], [667, 588.4], [668, 616.7], [669, 653.2], [670, 706], [671, 780], [672, 880], [673, 1000]]);

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

// r19: THE BAND ENTERS BY SLIDING IN FROM THE LOWER-RIGHT — it does NOT fade in
// place. Measured off the ref's grey-band top edge and the orange marker centroid
// (work/cls-day/r19-scenes1/entrance.py): the whole band-unit (band + labels +
// marker) translates rigidly along a straight diagonal (dx/dy ≈ 3.5, constant) from
// (+579, +165) at f444 to (0, 0) at f464, at FULL opacity — the old `bandIn`
// opacity fade was fiction (ref band is full grey the instant it exists, just 31px
// low at f453). dx = markerCx − 960.7, dy = bandTop − 96; both settle to 0 at f464
// so f464+ is byte-identical to before. A law-26 clock/motion error on a full-width
// element: the largest lever left in the S4 draw-in.
const S4_BAND_DX = lutS([[444, 578.9], [445, 485.5], [446, 407.1], [447, 341.5], [448, 286], [450, 198.4], [452, 133.7], [453, 108], [454, 86.1], [456, 51.2], [458, 27.1], [460, 11.5], [462, 2.7], [464, 0]]);
const S4_BAND_DY = lutS([[444, 165], [445, 138], [446, 116], [447, 97], [448, 81], [450, 57], [452, 38], [453, 31], [454, 25], [456, 15], [458, 8], [460, 4], [462, 1], [464, 0]]);

export const S4Trade: React.FC<{ frame: number; pack: Pack; PillLogo?: React.FC<{ h: number }> }> = ({
  frame,
  pack,
  PillLogo,
}) => {
  if (frame < 440 || frame >= 674) return null;
  // band appears at f444 (nothing before) and slides in from the lower-right; opacity
  // ramps over the first 3 frames only (the ref's marker is ~1/3 ink at f444).
  const bandIn = interpolate(frame, [443, 446], [0, 1], clamp);
  const bandDx = frame < 656 ? S4_BAND_DX(frame) : 0;
  const bandDy = frame < 656 ? S4_BAND_DY(frame) : 0;
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
  // the ink is full-dark from the first frame the hex exists (measured): no fade.
  const kA = frame < 442 ? 0 : S4_KA(frame);
  const kB = frame < 443 ? 0 : S4_KB(frame);
  // The interior is keyed to the UNFURL, not to the clock. The red ink lives only
  // inside a hex — never in its outline — so it reads the contents cleanly, and it is
  // EXACTLY ZERO until the hex passes kx ~ 0.51, then full within two frames:
  //   hexA  kx .511 -> 0.000 | .738 -> 0.854 | .839 -> 1.000
  //   hexB  kx .511 -> 0.016 | .739 -> 0.749 | .841 -> 0.977
  // One law, both hexes, off by ~0.1 at worst. The ref draws the OUTLINE around an
  // EMPTY hex for ten frames and only then fills the skyline in — which is why our old
  // single-opacity ramp had to compromise (it faded the outline too). `contentsP`
  // (lib b6ff6853a) separates them, so the outline can be full-dark from f442 where it
  // belongs.
  const contentsOf = (k: number) => interpolate(k, [0.51, 0.81], [0, 1], clamp);
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
        <div style={{ opacity: bandIn, transform: `translate(${bandDx}px, ${bandDy}px)` }}>
          <TimelineBand y={96} originX={960} originHour={hourAt} pxPerHour={141.7} />
          {/* gen19: measured at THIS mount off ref f600 (rust-masked). y was 8px HIGH
              (our ink top 27, the ref's 35) and the ref's triangle is 62 wide, not 60.
              The lib lane's S10 fit said 50 wide — it does NOT transfer, and that is what
              a per-mount `size` prop is for. The strokeWidth term DOES transfer and is
              corroborated here from a second scene: the ref's marker has MORE extent
              (62x53 vs our 60x49) and 38% LESS ink (696 vs 1123). That excess is lib's. */}
          <MarkerTriangle x={960} y={35} size={62} />
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
        const hexA = <HexCity x={ax} y={ay} w={HW} h={HH} letter="A" badgeP={badgePA} variant={0} contentsP={contentsOf(kA)} />;
        const hexB = <HexCity x={bx} y={by} w={HW} h={HH} letter="B" badge="tr" badgeP={badgePB} variant={1} contentsP={contentsOf(kB)} />;
        if (s === 1 && kA === 1 && kB === 1) return <>{hexA}{hexB}</>;
        // one wrapper per hex: the settled scale s, then the entrance unfurl kx —
        // both about the hex's OWN centre, so scaleX squeezes it in place.
        return (
          <>
            {kA > 0 && (
              <div style={{ position: "absolute", inset: 0, transform: `scale(${s}) scaleX(${kA})`, transformOrigin: `${ax}px ${ay}px` }}>{hexA}</div>
            )}
            {kB > 0 && (
              <div style={{ position: "absolute", inset: 0, transform: `scale(${s}) scaleX(${kB})`, transformOrigin: `${bx}px ${by}px` }}>{hexB}</div>
            )}
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
// gen20 — THE EXIT CARRIES TWO CLOCKS, AND WE WERE DRIVING BOTH OFF ONE.
// The S4 hour axis (labels BELOW the strip, left of the front) and the incoming S5 world
// (labels ABOVE it, right of the front) are DIFFERENT clocks in the ref: the S5 world's
// above-band chain runs SIX HOURS EARLIER than the S4 axis, because it is the S5 world,
// whose below-band mirror is the one that reads +6. We fed the incoming chain the S4 `h`,
// so at f673 every one of its eight labels was six hours wrong; at f670-672 it was worse,
// because h0 itself was drifting behind the ref.
//
// Both clocks re-read off the ref's own label glyphs at the ticks (mont/s4below.png,
// mont/s5lab2.png), tick x from the strip-tick detector:
//   S4 axis, hour at k=0:  f668 22 ✓ · f669 23 ✓ · f670 01:00@122 -> 25 · f671 03:00@45
//                          -> 27 · f672 07:00@134 -> 31   (we had 24 / 25 / 26)
//   S5 chain, hour at k=0: f670 19:00@1518 -> 11 · f671 19:00@1175 -> 13 · f672
//                          21:00@969 -> 17 · f673 01:00@1000 -> 21
// h0 was RIGHT through f669 and drifts from f670 — exactly where the whip accelerates.
// f673's S4 labels are fully clipped (front = 0), so its h0 is cosmetic; f666-669's S5
// labels sit ABOVE the frame (tick top = btop - 314·syp < 0) and are invisible — those
// keys are back-extrapolated and unverifiable, and marked so.
//
// ── r18 — THE FRONT IS THE WORLD'S LEFT EDGE, AND THAT PINS THE UNVERIFIABLE KEYS ──
// gen20 could read h5 off the ref's own labels only from f670 (before that the ABOVE
// labels sit above the frame edge) and marked f666-669 "back-extrapolated and
// unverifiable". They were also WRONG — and the tell is not a label, it is the FRONT.
// Project the measured front through each frame's own lattice into world-local x:
//   local(front) = (front − X0)/syp,  X0 = phase + (33 − h5)·pitch
// and with h5 = 8 at f668 and 9 at f669 it comes out −4367 · −4363 · −4364 · −4368 ·
// −4366 at f668/669/670/671/672 — the SAME world x, to three pixels, at every frame of
// the whip. The incoming world is a finite panel and the front is its left edge. That
// one invariant does three things at once: it CONFIRMS the measured h5 at f670-673, it
// DERIVES h5 at f666-669 (6 · 7 · 8 · 9 — the old 8/9/9/10 put the front 300 world units
// too far right, and drew a whole cluster into a strip the ref leaves empty: at f668 the
// ref carries 402px of above-band ink there and we drew 2,383), and it says the city
// has a LEFT END. See the slot table: it does.
// The BELOW labels are readable from f668 and confirm it independently — the tick at
// screen 1847 reads 01:00 (= h5 + k + 6, k = 11), which is h5 = 8, not 9.
const S4X_H0: [number, number][] = [[656, 18], [662, 18], [664, 19], [666, 20], [667, 21], [668, 22], [669, 23], [670, 25], [671, 27], [672, 31], [673, 35]];
const S4X_H5: [number, number][] = [[666, 6], [667, 7], [668, 8], [669, 9], [670, 11], [671, 13], [672, 17], [673, 21]];
const S4X_MARKX: [number, number][] = [[656, 961], [664, 961], [666, 900], [668, 835], [669, 745], [670, 640], [671, 480], [672, 270], [673, 40]];
const S4X_FRONT: [number, number][] = [[666, 1980], [667, 1858], [668, 1770], [669, 1640], [670, 1434], [671, 1084], [672, 451], [673, 0]];

const S4ExitBand: React.FC<{ frame: number }> = ({ frame }) => {
  const btop = lutS(S4X_TOP)(frame);
  const pitch = lutS(S4X_PITCH)(frame);
  const phase = lutS(S4X_PHASE)(frame);
  const h0 = Math.round(lutS(S4X_H0)(frame));
  const h5 = Math.round(lutS(S4X_H5)(frame)); // the INCOMING S5 world's own clock
  const markX = lutS(S4X_MARKX)(frame);
  const front = frame >= 666 ? lutS(S4X_FRONT)(frame) : 1980;
  const bh = (40 * pitch) / 142.3;
  const syp = pitch / 301.5; // S5-world scale implied by the shared pitch
  // one tick lattice, two hour readings: `h` is the S4 axis (below, left of the front),
  // `hs` the S5 world (above, right of it — and its own +6 mirror below).
  const ticks = Array.from({ length: 15 }, (_, k) => ({ x: phase + k * pitch, h: h0 + k, hs: h5 + k }));
  // ── the incoming world's own frame ──
  // The exit runs one CYCLE behind the cruise's i = 0..23: the tick at k carries the
  // true index h5 + k − 24 (at f673 the ref reads 21:00..04:00, i.e. i = −3..4). Hour i
  // sits at world-local (i − 9)·301.5 exactly as it does in the cruise, so the screen x
  // of local 0 is X0 = phase + (33 − h5)·pitch, and 301.5·syp === pitch by construction:
  // the world needs no fit of its own. It rides the tick lattice.
  const X0 = phase + (33 - h5) * pitch;
  const visLo = (front - X0) / syp;
  const visHi = (1920 - X0) / syp;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* S5 world wiping in behind the front: white above, navy below */}
      {front < 1920 && (
        <>
          <div style={{ position: "absolute", left: front, top: 0, width: 1980 - front, height: btop, background: C.white }} />
          <div style={{ position: "absolute", left: front, top: btop + bh, width: 1980 - front, height: 1080 - btop - bh, background: C.navyBg }} />
          {/* ── r18 — THE EXIT SWEEPS IN A CITY, AND NOW IT SWEEPS IN THE RIGHT ONE ──
              gen20 measured the hole and could not fill it. At f673, where the front has
              crossed the whole frame:
                          above-band ink    RED ink     below-band white
                ref            41,795       42,787          20,589
                ours            7,438            0           7,124
              A whole city, absent, on the frame that scores .8657 — the largest absent-
              content area on the track. gen20 mounted one and it LOST at every frame
              (−.034 at f673), because the tiles cycled the four cruise designs on a
              4-slot period. The period is SIX (see the slot table): the exit shows hours
              21-05, and three of those slots are buildings the cruise never shows.
              With the six real designs the mount is the same twenty lines gen20 wrote —
              and the world needs no fit of its own, it rides the tick lattice.
              PAINT ORDER MATTERS AND IS THE REF'S: the below chain goes UNDER the city
              (the below clusters are outline-only and let it through), the above chain
              goes OVER it (gen18 — the white-filled tower bodies swallow whole ticks
              otherwise). Same order as the cruise. */}
          <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, clipPath: `inset(0 0 0 ${front}px)` }}>
            {/* below chain — under the city */}
            {ticks.map(({ x, h, hs }) => (
              <React.Fragment key={`b${h}`}>
                <div style={{ position: "absolute", left: x, top: btop + bh, width: 3, height: 308 * syp, background: "#FDFDFD" }} />
                <div style={{ position: "absolute", left: x + 19 * syp, top: btop + bh + 292 * syp, fontFamily: "Helvetica", fontSize: 21 * syp, color: "#FDFDFD" }}>
                  {String((((hs + 6) % 24) + 24) % 24).padStart(2, "0")}:00
                </div>
              </React.Fragment>
            ))}
            {/* the city — world coords, scaled onto the incoming lattice. World (L, wy)
                lands at screen (X0 + L·syp, btop + (wy − 490)·syp). */}
            <div style={{ position: "absolute", left: X0, top: btop, width: 1, height: 1, transform: `scale(${syp})`, transformOrigin: "0 0" }}>
              <CityRow slots={tiles(CITY_ABOVE, visLo, visHi)} top={170 - 490} />
              <CityRow slots={tiles(CITY_BELOW, visLo, visHi)} top={570 - 490} />
            </div>
            {/* above chain — over the city */}
            {ticks.map(({ x, h, hs }) => (
              <React.Fragment key={`a${h}`}>
                <div style={{ position: "absolute", left: x, top: btop - 310 * syp, width: 3, height: 310 * syp, background: C.navyDeep }} />
                <div style={{ position: "absolute", left: x + 16 * syp, top: btop - 314 * syp, fontFamily: "Helvetica", fontSize: 21 * syp, color: C.navyDeep }}>
                  {String((((hs % 24) + 24) % 24)).toString().padStart(2, "0")}:00
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

// gen19: ONE PILL, NOT TWO. This slot used to short-circuit ClsPill whenever a
// PillLogo was supplied, into a hand-copied div carrying its own uniform
// borderRadius h*0.28 and a hardcoded logo at h*0.5. So ClsDay-Replicate (no
// PillLogo) inherited every fix the lib lane landed on ClsPill — the brand chip
// radius, the measured logoScale — and CrxSettlementDay, the PUBLISHABLE cut,
// inherited none of them. It was still drawing square corners and a 36%-oversized
// logo. A shared primitive with a hand-copied twin is not shared: it is two
// primitives that agree right up until one of them is fixed.
export const ClsPillSlot: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  p: number;
  PillLogo?: React.FC<{ h: number }>;
  logoScale?: number;
}> = ({ x, y, w, h, p, PillLogo, logoScale = 0.366 }) => (
  <ClsPill x={x} y={y} w={w} h={h} opacity={p} logoScale={logoScale} Logo={PillLogo} />
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
  // gen20 — sx is the ref's TICK PITCH / 301.5, measured off the ticks INSIDE the grey
  // strip (dark columns spanning the whole band — the one detector no building can
  // fool), as a full-span mean over 6-7 ticks. ref: 255.58@674 · 269.42@675 · 278.83@676
  // · 285.60@677 · 290.50@678 · 294.10@679 · 296.83@680 · 298.80@681 · 300.20@682 ·
  // 301.10@683 · 301.67@684. Nine of the eleven keys were already inside the ±0.001
  // measurement band and are LEFT ALONE — only f675 (0.885 → 0.8936, a real 1% error on
  // the frame that scored .766) and f677 (0.945 → 0.9473) moved.
  // NEGATIVE A/B: nudging f676 to the nominal 0.9237 LOST (.8226 → .8145). At f676 a
  // 0.0017 scale change is 4px at the left edge, and the old 0.9254 sits inside the
  // pitch's own error bar. Inside the error bar, do not move a gated key.
  const sx = lutS([
    [674, 0.8475], [675, 0.8936], [676, 0.9254], [677, 0.9473], [678, 0.9642], [679, 0.9761],
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
  //
  // ── r18 — THE ENTRY ZOOM IS UNIFORM. THE SEPARATE ENTRY sy WAS FICTION. ──
  // The entry sy keys were hand-fitted and every one of them was 2-5% LOW, so for
  // ten frames the incoming world was squashed vertically against a horizontal
  // scale that gen20 had measured properly. At f675 that is 9.6px of error on the
  // above-band tick tops AND on the below-band tick feet — the whole world, both
  // halves, every frame of the entry.
  // Measured with the ONE thing in the frame no building can hide: the grey band
  // itself (world 490..575, h=85, spans the full width). Sub-pixel edge crossings
  // (white→grey at 234, grey→navy at 121) over ~1,400 ink-free columns per frame
  // (work/…/r18-scenes1/band2.py). The probe recovers h = 86.01 at f684-690, where
  // sy is KNOWN to be 1.000 — so its bias is +1.01px and sy = (h − 1.01)/85:
  //   f674 .8509 · f675 .8942 · f676 .9240 · f677 .9469 · f678 .9631 · f679 .9748
  //   f680 .9852 · f681 .9892 · f682 .9947 · f684 .9982
  // Set that beside sx (.8475 / .8936 / .9254 / .9473 / .9642 / .9761 / .9847 /
  // .9911 / .996 / 1) and they are THE SAME NUMBER — max |Δ| 0.0034, RMS 0.0016.
  // The band is not an anisotropic squash. It is a zoom.
  // Confirmed independently through the rectifier: rectify a KNOWN cluster out of
  // an entry frame into slot space and correlate it against its own cruise crop —
  // with the old sy, ClA@f677 needed a +4px roll (overlap .854) and ClD@f677 a −4px
  // roll (.812), opposite signs, the signature of a scale error, not an offset.
  // With sy = sx: ClA .933 / ClD .957 / ClD@f676 .964 / ClD@f679 .979, every dy = 0.
  // The entry keys therefore ARE the sx keys. The exit keys (f918+) are NOT — there
  // the band really does compress faster in x than in y — and are left alone.
  const sy = lutS([
    [674, 0.8475], [675, 0.8936], [676, 0.9254], [677, 0.9473], [678, 0.9642], [679, 0.9761],
    [680, 0.9847], [681, 0.9911], [682, 0.996], [683, 0.994], [684, 1],
    [916, 1], [918, 0.988], [920, 0.976], [922, 0.929], [924, 0.929], [926, 0.835],
    [928, 0.776], [930, 0.718], [932, 0.671], [934, 0.647], [938, 0.647], [940, 0.635],
  ])(frame);
  // band center (rest 532.5): entry descend + exit rise, both measured.
  // r18: the same band probe reads the entry centres back to within 0.5px of these
  // keys at every frame but ONE — f676, which sits 1.8px low (472.7, not 474.5).
  const riseC = lutS([
    [674, 412], [675, 447.5], [676, 472.7], [677, 490], [678, 503], [679, 512.5],
    [680, 520], [681, 525], [682, 529], [683, 530.5], [684, 532.5],
    [918, 532.5], [920, 521.5], [922, 506.5], [924, 481.5], [926, 430.5], [928, 327],
    [930, 250.5], [932, 214.5], [934, 195.5], [936, 185.5], [938, 179.5], [940, 179],
  ])(frame);
  // inner x of the 09:00 tick (screen tick positions unprojected through
  // the sx scale about x=960; cruise points are direct measurements)
  //
  // gen20 — THE ENTRY WORLD WAS A FULL HOUR OFF AT f674. A tick chain is PERIODIC:
  // an x9 error of exactly one pitch leaves every tick line landing on the ref's to
  // half a pixel and every LABEL reading one hour late. That is what f674 was doing
  // (2184.8 vs 2487.1 = 302.3 = one pitch), and it went unseen for six rounds because
  // every instrument anyone pointed at it was a tick tracker. The LABELS are the only
  // thing that can see it — read them.
  //   Anchor per frame = (hour, screen x of its tick), off the ref's own label glyphs:
  //   f674 02:00@465 · f675 04:00@421 · f676 06:00@566 · f677 07:00@554 · f678 08:00@622.5
  //   f679 08:00@456 · f680 09:00@626.5 · f684 09:00@400.5 · f690 09:00@384
  //   x9 = 960 + (x − 960)/sx − (i − 9)·301.5.
  // f676/f678/f679/f680 came back EXACT — the old table was right at four of its keys
  // and wrong at three, which is why the whip looked plausible and scored .77.
  // The corrected series is also the only one that is smooth: the world's hour at
  // screen x=0 runs 20.75 → 24.18 → 26.44 → 27.97 → 29.06 → 29.86 (Δ 3.43, 2.26, 1.53,
  // 1.09, 0.80 — a clean deceleration). The old x9 made it stutter.
  const x9 = lutS([
    [674, 2485.8], [675, 1863.8], [676, 1438.7], [677, 1134.4], [678, 911.3], [679, 744.9],
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
  // what the camera can see, in world-local x (the city tiles off this)
  const visLo = 960 - 960 / sx - x9;
  const visHi = 960 + 960 / sx - x9;
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
            {/* the city — ONE periodic law, six designs, 12-hour period, tiled to
                whatever the camera can actually see. The old code carried a settled
                4-slot table plus a hand-cranked `leftAbove(4)/leftBelow(4)` behind a
                `frame < 692` guard, which is how the entry came to draw the wrong
                buildings: the tiles were in the right SLOTS (the 604 pitch is right)
                and carried the wrong DESIGNS. `tiles()` derives both from the world. */}
            <CityRow slots={tiles(CITY_ABOVE, visLo, visHi)} top={170} />
            <CityRow slots={tiles(CITY_BELOW, visLo, visHi)} top={bandY + bandH - 5} />
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
//     ref does not have.// ── r18 — THE SEVEN CRUISE CLUSTERS ARE NOW TRACES, NOT REDRAWS ──
// These were hand-built from measurements over r3/r7/r10/gen13/gen17 and re-registered
// again and again, and they still carried 0.85x of the reference's ink with their line
// CENTRES 1-4px off — which is why gen19's "bold them to the ref's true weight" LOST at
// all eight frames (a wider stroke about a wrong centre lights both edges), and why the
// r18 exit mount had to spend .005 at f672: at syp 0.69 a near-miss thin line costs SSIM
// more than an absent one. Law 19 is the way out. A potrace of the reference's own vector
// art is compression-soft EXACTLY as the reference is soft, sits AT the SSIM ceiling, and
// has no centre error to bold about. Nothing here is drawn by hand.
//
// Cut through the same rectifier that recovers a known cluster at dx=dy=0, off frames
// chosen to be free of the rising docs and the navy sweep. The hour chain is cut OUT of
// the ink layers (S5Skyline draws its own from the lattice), and the white tower BODIES —
// white on a white ground, which no colour separation can find — are recovered as the
// white the background flood cannot reach with the band as a floor. Those bodies are
// load-bearing: the instruction docs rise BEHIND the clusters and it is the fills that
// hide them until they clear the tower base.
// KNOWN LOSS, small and recorded: ClG's pale peach window slot (#F2C7A9) is neither red
// nor grey nor navy, so it traces as white — 16x25px.
// 08:30 (and 20:30) — red bar-panel tower on open legs; navy barred block left, dotted block + gantry right.
// POTRACED off ref f690 (x9=384, sx=1 — the last frame before the first rising doc), slot -382.
const ClA: React.FC = () => (
  <svg width={604} height={330} viewBox="0 0 604 330">
    <g transform="translate(0,330) scale(1,-1)">
      <path fill={WHT} d="M194 269 c-1 0 -1 -3 -1 -6 l0 -5 18 0 18 0 0 6 0 6 -18 0 c-9 0 -17 0 -17 -1z M182 193 l0 -60 3 0 4 0 0 41 1 41 4 0 5 0 0 3 c1 1 1 7 0 13 l0 11 2 0 2 0 0 -13 0 -14 6 0 5 0 0 14 0 14 2 -1 2 0 0 -14 0 -13 5 0 6 1 0 13 0 13 2 0 c0 0 1 -1 1 -1 0 -1 0 -7 0 -13 l1 -12 5 -1 6 0 0 14 0 14 2 -1 2 0 0 -14 0 -13 5 0 5 0 0 12 c0 13 0 15 3 15 l1 0 0 -13 0 -14 7 0 6 0 0 -41 0 -41 3 0 2 0 0 56 0 56 -1 2 c-2 3 -3 4 -5 6 l-2 1 -45 0 -45 0 0 -61z M193 202 l0 -9 39 0 40 1 0 8 0 9 -39 0 -40 0 0 -9z M194 189 c-1 0 -1 -3 -1 -6 l0 -6 5 0 5 0 0 6 0 7 -5 0 c-2 0 -4 -1 -4 -1z M262 189 c-1 0 -1 -3 -1 -6 l0 -6 5 0 5 0 0 6 0 7 -5 0 c-2 0 -4 0 -4 -1z M193 167 l0 -7 39 0 40 1 0 6 0 6 -40 0 -39 0 0 -6z M193 150 l0 -6 5 0 5 0 0 6 0 6 -5 0 -5 0 0 -6z M207 150 l0 -6 25 0 25 0 0 6 0 6 -25 0 -25 0 0 -6z M261 150 l0 -6 5 0 5 0 0 6 0 6 -5 0 -5 0 0 -6z M140 148 l0 -3 8 0 7 0 0 3 0 3 -7 0 -8 0 0 -3z M112 76 l0 -66 23 0 23 0 0 66 0 65 -23 0 -23 0 0 -65z m33 56 l0 -2 -7 0 -8 0 0 2 0 1 8 0 7 0 0 -1z m0 -11 l0 -3 -7 0 -8 0 0 2 -1 3 9 0 8 0 -1 -2z m0 -12 l0 -2 -7 0 -8 0 0 2 -1 3 8 -1 8 0 0 -2z m0 -10 l0 -2 -8 0 -8 0 1 1 0 2 8 0 7 0 0 -1z m0 -12 l0 -2 -8 0 -8 0 1 2 0 2 8 0 7 0 0 -2z m0 -12 l1 -1 -8 0 -9 0 1 1 0 2 8 0 7 0 0 -2z m0 -10 l0 -2 -8 0 -8 0 1 1 0 2 8 0 7 0 0 -1z M193 134 l0 -6 39 0 39 0 1 4 c0 3 0 6 0 6 l-1 2 -39 0 -39 0 0 -6z M162 70 l0 -60 14 0 13 0 0 60 0 59 -13 0 -14 0 0 -59z m15 44 l0 -6 -1 0 -2 0 0 6 0 6 2 0 1 0 0 -6z m0 -24 l0 -6 -1 0 -2 0 0 6 0 5 2 0 1 0 0 -5z m0 -27 l0 -6 -1 0 -2 0 0 6 0 5 2 0 1 0 0 -5z m0 -25 l0 -6 -1 0 -2 0 0 6 0 6 2 0 1 0 0 -6z M276 71 c0 -32 0 -59 -1 -59 l0 -2 13 0 14 0 0 55 c0 30 0 57 1 59 l0 5 -13 0 -14 0 0 -58z m15 46 c0 -1 0 -4 0 -6 l-1 -3 -1 0 -1 1 -1 5 0 6 1 0 2 0 1 -3z m-1 -28 l1 -5 -2 0 -2 0 0 6 0 5 1 0 2 0 0 -6z m1 -27 c-1 -6 -1 -7 -3 -6 l-1 1 0 6 0 5 2 0 2 0 0 -6z m0 -21 c0 -2 0 -4 -1 -6 l0 -3 -2 0 -1 0 0 6 0 7 2 -1 2 0 0 -3z M193 118 l0 -6 5 0 5 0 0 6 0 6 -5 0 -5 0 0 -6z M207 118 l0 -6 25 0 25 0 0 6 0 6 -25 0 -25 0 0 -6z M261 118 l0 -6 5 0 5 0 0 6 0 6 -5 0 -5 0 0 -6z M307 119 c0 -2 -1 -66 0 -66 0 0 0 -10 0 -21 l0 -22 22 0 22 0 0 22 0 21 -21 0 -22 0 0 2 -1 2 22 -1 22 0 0 29 0 29 -1 0 -1 -1 1 1 0 2 -3 2 -3 2 -18 0 -18 0 -1 -1z m9 -1 l4 0 0 -30 0 -30 -6 0 -6 0 0 31 0 30 2 0 c0 -1 3 -1 6 -1z m13 -9 l0 -4 -1 0 -2 0 0 4 0 3 2 0 1 0 0 -3z m13 0 l0 -4 -1 0 -2 0 0 4 0 3 2 0 1 0 0 -3z m-13 -18 l1 -3 -2 0 -3 0 1 3 0 4 2 0 1 0 0 -4z m13 1 l0 -4 -2 0 -2 -1 1 4 0 4 2 0 1 0 0 -3z m-22 -60 l0 -21 -6 0 -6 0 0 21 0 20 6 0 6 0 0 -20z M311 113 c0 -1 0 -3 0 -5 l1 -3 3 -1 3 0 0 4 0 3 -1 2 c-2 1 -5 1 -6 0z m5 -4 l0 -4 -2 0 -2 0 0 4 0 3 2 0 2 0 0 -3z M311 94 c-1 -1 0 -6 1 -7 1 0 2 0 4 0 l2 1 0 4 0 4 -1 0 -1 0 0 -4 0 -4 -2 0 -2 0 0 3 0 4 2 0 2 1 -2 0 c-1 0 -2 -1 -3 -2z M193 59 l0 -49 12 0 12 0 0 8 0 9 17 0 17 0 -1 -9 0 -8 10 0 11 0 0 2 c1 2 1 92 0 94 l0 2 -39 0 -39 0 0 -49z M220 20 c1 0 1 -3 1 -6 l0 -4 6 0 5 0 0 6 0 6 -6 0 -6 0 0 -2z M235 16 l0 -6 6 0 6 0 0 6 0 6 -6 0 -6 0 0 -6z" />
      <path fill="#DCDCDC" d="M308 89 l0 -31 6 0 6 0 0 30 0 30 -4 0 c-3 0 -6 0 -6 1 l-2 0 0 -30z m9 24 l1 -2 0 -3 0 -4 -3 0 -3 1 -1 3 c0 6 2 8 6 5z m1 -21 l0 -4 -2 -1 c-2 0 -3 0 -4 0 -1 1 -2 6 -1 7 l1 2 3 0 3 0 0 -4z M356 85 l0 -3 6 0 5 0 0 3 0 3 -5 0 -6 0 0 -3z M356 71 l0 -5 1 0 c1 0 1 -4 0 -4 l-1 -1 2 -2 2 -2 0 -2 0 -3 -2 -1 -2 -1 0 -20 0 -19 6 0 5 0 0 33 0 32 -5 0 -6 0 0 -5z M308 32 l0 -21 6 0 6 0 0 21 0 20 -6 0 -6 0 0 -20z" />
      <path fill={NAVY} d="M148 160 l0 -6 -5 0 -6 0 0 -5 0 -4 -15 -1 -14 0 0 -28 0 -27 -11 0 -12 0 0 -2 0 -2 12 0 11 0 0 -37 0 -38 2 0 2 0 0 66 0 65 23 0 23 0 0 -4 0 -4 2 0 c0 1 1 1 2 1 0 0 0 2 0 5 l0 5 -1 0 -2 0 0 5 0 5 -3 0 -4 0 0 6 0 6 -2 0 -2 0 0 -6z m7 -12 l0 -3 -7 0 -8 0 0 3 0 3 8 0 7 0 0 -3z M130 132 l0 -2 8 0 7 0 0 2 0 1 -7 0 -8 0 0 -1z M308 122 l0 -2 18 0 17 0 3 -2 c2 0 3 -2 4 -3 l1 -2 0 -28 0 -29 -21 0 -22 0 0 -1 0 -2 22 0 21 0 0 -21 0 -22 1 0 2 0 0 21 1 22 2 0 2 0 0 1 0 2 -2 0 -2 1 0 10 0 11 11 0 11 0 0 2 0 1 -11 0 -11 1 0 3 0 4 11 0 11 0 0 2 0 1 -11 0 -11 1 -1 12 0 12 -4 3 -3 3 -20 0 -19 0 0 -1z M130 120 l0 -2 8 0 7 0 0 2 0 2 -7 0 -8 0 0 -2z M312 109 l0 -4 2 0 2 0 0 4 0 3 -2 0 -2 0 0 -3z M326 109 l0 -4 2 0 1 0 0 4 0 3 -1 0 -2 0 0 -3z M339 109 l0 -4 2 0 1 0 0 4 0 3 -1 0 -2 0 0 -3z M130 109 l0 -2 8 0 7 0 0 2 0 2 -7 0 -8 0 0 -2z M130 99 l0 -2 8 0 7 0 0 2 0 1 -7 0 -8 0 0 -1z M314 95 l-2 0 0 -4 0 -3 2 0 2 0 0 4 c0 2 0 4 0 4 0 0 -1 0 -2 -1z M326 92 l0 -4 2 0 1 0 0 4 0 3 -1 0 -2 0 0 -3z M339 92 l0 -4 2 0 1 0 0 4 0 3 -1 0 -2 0 0 -3z M386 91 l0 -2 23 0 22 0 0 -4 0 -4 -22 0 -23 0 0 -1 0 -2 23 0 22 0 0 -34 0 -34 2 0 2 0 0 41 0 41 -24 0 -25 0 0 -1z M51 88 c-9 -1 -16 -7 -21 -15 l-1 -3 -1 -30 0 -30 1 0 2 0 0 27 0 28 2 5 c3 5 6 9 12 12 l4 2 13 1 14 0 0 2 0 2 -11 0 c-6 0 -12 -1 -14 -1z M130 87 l0 -2 8 0 7 0 0 2 0 2 -7 0 -8 0 0 -2z M130 76 l0 -2 8 0 7 0 0 2 0 1 -7 0 -8 0 0 -1z M130 65 l0 -2 8 0 7 0 0 2 0 1 -7 0 -8 0 0 -1z M79 4 l0 -4 2 0 2 0 0 4 0 4 -2 0 -2 0 0 -4z M380 4 l0 -4 3 0 2 0 0 4 0 4 -2 0 -3 0 0 -4z" />
      <path fill={C.red} d="M196 280 l0 -6 -4 -1 -3 0 0 -8 0 -7 -6 -1 -5 0 0 -62 0 -62 -8 0 c-5 0 -10 0 -10 -1 l-2 0 0 -61 0 -61 2 0 2 0 0 60 0 59 14 0 13 0 0 -59 0 -60 2 0 2 0 0 49 0 49 39 0 39 0 1 -2 c0 -1 0 -24 0 -49 l0 -47 1 0 c1 0 2 1 2 2 1 0 1 27 1 59 l0 58 13 0 14 0 -1 -59 0 -60 2 0 3 0 0 22 1 21 -1 0 c-1 0 -1 1 -1 2 0 1 0 2 1 2 l1 -1 0 32 0 32 -1 0 c-1 0 -1 3 -1 7 l0 6 -11 0 -11 0 0 57 0 57 -3 3 c-1 2 -3 5 -4 5 l-2 2 -21 0 -21 1 -1 7 0 8 -16 0 -16 1 -1 6 0 6 -1 0 -2 0 0 -6z m33 -16 l0 -6 -18 0 -18 0 0 5 c0 3 0 6 1 6 0 1 8 1 17 1 l18 0 0 -6z m45 -11 c2 -2 3 -3 5 -6 l1 -2 0 -56 0 -56 -2 0 -3 0 0 41 0 41 -6 0 -7 0 0 14 0 13 -1 0 c-3 0 -3 -2 -3 -15 l0 -12 -5 0 -5 0 0 14 0 13 -2 0 -2 0 0 -14 0 -13 -6 0 -5 1 -1 12 c0 6 0 12 0 13 0 0 -1 1 -1 1 l-2 0 0 -13 0 -13 -6 -1 -5 0 0 13 0 14 -2 0 -2 0 0 -13 0 -14 -5 0 -6 0 0 14 0 13 -2 0 -2 0 0 -11 c1 -6 1 -12 0 -13 l0 -3 -5 0 -4 0 -1 -41 0 -41 -4 0 -3 0 0 60 0 61 45 0 45 0 2 -1z m-2 -51 l0 -8 -40 -1 -39 0 0 9 0 9 40 0 39 0 0 -9z m-69 -19 l0 -6 -5 0 -5 0 0 6 c0 7 0 7 5 7 l5 0 0 -7z m68 0 l0 -6 -5 0 -5 0 0 6 c0 7 0 7 5 7 l5 0 0 -7z m1 -16 l0 -6 -40 -1 -39 0 0 7 0 6 39 0 40 0 0 -6z m-69 -17 l0 -6 -5 0 -5 0 0 6 0 6 5 0 5 0 0 -6z m54 0 l0 -6 -25 0 -25 0 0 6 0 6 25 0 25 0 0 -6z m14 0 l0 -6 -5 0 -5 0 0 6 0 6 5 0 5 0 0 -6z m1 -12 c0 0 0 -3 0 -6 l-1 -4 -39 0 -39 0 0 6 0 6 39 0 39 0 1 -2z m-69 -20 l0 -6 -5 0 -5 0 0 6 0 6 5 0 5 0 0 -6z m54 0 l0 -6 -25 0 -25 0 0 6 0 6 25 0 25 0 0 -6z m14 0 l0 -6 -5 0 -5 0 0 6 0 6 5 0 5 0 0 -6z M174 114 l0 -6 2 0 1 0 0 6 0 6 -1 0 -2 0 0 -6z M287 114 l1 -5 1 -1 1 0 1 3 c0 2 0 5 0 6 l-1 3 -2 0 -1 0 0 -6z M174 90 l0 -6 2 0 1 0 0 6 0 5 -1 0 -2 0 0 -5z M287 90 l0 -6 2 0 2 0 -1 5 0 6 -2 0 -1 0 0 -5z M174 63 l0 -6 2 0 1 0 0 6 0 5 -1 0 -2 0 0 -5z M287 63 l0 -6 1 -1 c2 -1 2 0 3 6 l0 6 -2 0 -2 0 0 -5z M174 38 l0 -6 2 0 1 0 0 6 0 6 -1 0 -2 0 0 -6z M287 38 l0 -6 1 0 2 0 0 3 c1 2 1 5 1 6 l0 3 -2 0 -2 0 0 -6z M217 18 l0 -8 2 0 2 0 0 6 -1 6 6 0 6 0 0 -6 0 -6 2 0 1 0 0 6 0 6 6 0 6 0 0 -6 0 -6 1 0 2 0 0 7 c0 4 1 8 0 8 0 1 -8 1 -17 1 l-16 0 0 -8z" />
    </g>
  </svg>
);

// 10:30 (and 22:30) — square-column tower beside a pinstriped round-top tower.
// POTRACED off ref f690 (x9=384, sx=1 — the last frame before the first rising doc), slot 222.
const ClB: React.FC = () => (
  <svg width={604} height={330} viewBox="0 0 604 330">
    <g transform="translate(0,330) scale(1,-1)">
      <path fill={WHT} d="M190 148 l0 -138 2 0 2 0 0 6 c0 4 0 8 1 8 l0 2 17 0 16 0 0 -8 0 -8 3 0 4 0 -1 137 0 138 -22 0 -22 0 0 -137z m31 99 l0 -10 -9 0 -10 0 0 10 0 9 10 0 9 0 0 -9z m0 -25 l0 -9 -9 0 -9 1 -1 9 0 9 9 0 10 0 0 -10z m0 -23 l0 -10 -9 0 -10 0 0 9 0 9 1 0 c1 1 5 1 10 1 l8 0 0 -9z m0 -26 l0 -9 -9 0 -10 0 0 9 0 9 10 0 9 0 0 -9z m0 -25 l0 -10 -9 0 -10 0 0 10 0 9 10 0 9 0 0 -9z M206 227 c0 -1 0 -4 0 -6 l1 -3 5 0 5 0 -1 1 c0 0 0 3 0 5 l0 4 -5 0 -4 0 -1 -1z M206 198 l0 -5 5 0 5 0 0 3 c0 2 0 4 0 5 l0 2 -5 0 -5 0 0 -5z M206 147 l1 -4 4 -1 4 0 1 1 c1 1 1 3 1 5 l0 4 -6 0 -5 0 0 -5z M239 271 l-1 -2 1 -2 0 -3 15 0 14 0 0 4 0 4 -14 0 -14 0 -1 -1z M168 135 l0 -125 9 0 9 0 0 125 0 125 -9 0 -9 0 0 -125z M238 135 l0 -125 6 0 5 0 0 103 0 104 2 0 c1 0 2 -1 2 -1 0 -1 0 -48 0 -104 l0 -102 5 0 5 0 0 103 0 103 1 0 c1 0 2 -1 2 -2 1 0 1 -47 1 -102 l0 -101 5 -1 6 0 0 103 0 103 2 0 2 -1 0 -102 0 -103 6 0 5 0 0 102 0 103 1 1 1 0 1 -1 1 -1 0 -102 0 -102 6 0 5 0 0 103 0 103 1 0 c1 0 2 -1 2 -2 1 0 1 -47 1 -103 l0 -101 5 0 6 0 0 2 c1 0 1 52 1 114 l0 112 -2 6 -1 5 -3 4 c-2 2 -5 4 -8 5 l-4 2 -34 0 -34 0 0 -125z M328 144 c-1 0 -1 -6 -1 -12 0 -6 0 -11 1 -11 0 1 0 6 0 12 l0 11 5 0 6 0 0 -9 c1 -5 1 -10 0 -11 l0 -2 -5 0 c-2 0 1 -1 8 -1 l13 0 0 12 0 12 -13 0 c-8 0 -14 0 -14 -1z M127 134 l0 -4 14 0 13 0 0 4 0 3 -13 0 -14 0 0 -3z M114 68 l0 -58 25 0 25 0 0 58 0 58 -25 0 -25 0 0 -58z m26 45 l0 -2 -7 0 -8 0 0 2 0 2 8 0 7 0 0 -2z m0 -11 l0 -2 -8 0 -7 0 0 2 0 3 8 0 8 0 -1 -3z m0 -11 l0 -2 -7 0 -8 0 0 2 0 2 8 0 7 0 0 -2z m0 -10 l0 -2 -7 0 -8 0 0 2 0 1 8 0 7 0 0 -1z m0 -12 l0 -2 -7 0 -8 0 0 2 0 2 8 0 7 0 0 -2z m0 -11 l0 -2 -7 0 -8 0 0 2 0 1 8 0 7 0 0 -1z m0 -11 l0 -2 -7 0 -8 0 0 2 0 1 8 0 7 0 0 -1z M327 111 c0 -4 0 -6 1 -5 0 1 1 2 1 2 l1 0 0 5 0 4 -1 0 -2 0 0 -6z m2 0 l-1 -2 0 4 c0 2 0 3 1 2 0 -1 0 -3 0 -4z M334 113 l0 -5 5 0 4 0 0 5 0 4 -4 0 -5 0 0 -4z m5 0 l0 -4 -1 0 -2 0 0 4 0 3 2 0 1 0 0 -3z M347 113 l0 -5 4 0 4 0 0 5 0 4 -4 0 -4 0 0 -4z M327 100 l0 -5 14 0 14 0 0 5 0 4 -8 0 -8 0 0 -1 c0 -1 0 -3 0 -4 l0 -3 -5 0 -6 0 0 4 -1 5 0 -5z M347 87 l0 -5 4 0 4 0 0 4 0 5 -4 0 -4 1 0 -5z M327 86 l0 -4 1 4 1 5 0 -5 1 -4 0 4 0 5 -1 0 -2 0 0 -5z M334 87 l0 -5 1 0 1 0 0 3 c0 1 1 3 2 4 l1 1 0 -4 0 -4 2 0 2 0 0 5 0 4 -4 0 -5 0 0 -4z M327 44 l0 -34 14 0 14 0 0 34 0 34 -14 0 -14 0 0 -34z m12 0 l0 -33 -4 0 -5 0 0 5 0 4 -1 0 -1 0 0 29 0 28 6 0 5 0 0 -33z M198 16 l0 -6 5 0 6 0 0 2 c0 1 0 3 0 6 l0 4 -6 0 -5 0 0 -6z M213 16 l0 -6 6 0 6 0 0 6 0 6 -6 0 -6 0 0 -6z" />
      <path fill="#DCDCDC" d="M328 132 l0 -11 2 0 c1 1 3 1 5 1 l4 0 0 2 c1 1 1 6 0 11 l0 9 -6 0 -5 0 0 -12z M328 100 l0 -4 5 0 6 0 0 3 c0 1 0 3 0 4 l0 1 -6 0 -5 0 0 -4z M334 77 l-6 0 0 -29 0 -28 1 0 1 0 0 -4 0 -5 5 0 4 0 0 33 0 33 8 0 8 1 -8 0 c-4 0 -10 -1 -13 -1z M109 39 c0 -16 1 -22 1 -14 0 8 0 20 0 28 0 7 -1 1 -1 -14z" />
      <path fill={NAVY} d="M134 149 l0 -9 -5 0 -6 0 0 -5 0 -6 -6 0 -7 0 0 -59 0 -60 2 0 2 0 0 58 0 58 17 -1 c10 0 21 0 25 0 l8 1 0 2 0 1 -3 0 -3 0 0 6 0 5 -10 0 -10 0 0 9 0 9 -2 0 -2 0 0 -9z m20 -15 l0 -4 -13 0 -14 0 0 4 0 3 14 0 13 0 0 -3z M328 147 l0 -2 14 0 13 0 0 -12 0 -12 -13 0 -14 0 0 -2 c0 -1 0 -2 1 -2 l1 0 0 -4 0 -5 -1 0 c-1 0 -1 -1 -1 -2 l0 -2 14 0 13 0 0 -4 0 -5 -13 0 -14 0 0 -2 c0 -1 0 -2 1 -2 l1 0 0 -4 0 -5 -1 0 c-1 0 -1 -1 -1 -2 l0 -2 14 0 13 0 0 -34 0 -34 2 0 2 0 0 30 1 30 8 0 9 0 0 2 0 1 -9 0 -9 0 0 38 0 37 -15 0 -16 0 0 -1z m15 -34 l0 -5 -4 0 -5 0 0 5 0 4 5 0 4 0 0 -4z m12 0 l0 -5 -4 0 -4 0 0 5 0 4 4 0 4 0 0 -4z m0 -27 l0 -4 -4 0 -4 0 0 5 0 5 4 -1 4 0 0 -5z m-12 1 l0 -5 -4 0 -5 0 0 5 0 4 5 0 4 0 0 -4z M125 113 l0 -2 8 0 7 0 0 2 0 2 -7 0 -8 0 0 -2z M125 102 l0 -2 8 0 7 0 0 2 0 2 -7 0 -8 0 0 -2z M125 91 l0 -2 8 0 7 0 0 2 0 2 -7 0 -8 0 0 -2z M125 81 l0 -2 8 0 7 0 0 2 0 1 -7 0 -8 0 0 -1z M386 72 l0 -2 8 0 9 0 0 -30 0 -30 2 0 1 0 0 32 0 31 -10 0 -10 0 0 -1z M125 69 l0 -2 8 0 7 0 0 2 0 2 -7 0 -8 0 0 -2z M125 58 l0 -2 8 0 7 0 0 2 0 1 -7 0 -8 0 0 -1z M125 47 l0 -2 8 0 7 0 0 2 0 1 -7 0 -8 0 0 -1z M78 4 l0 -4 2 0 2 0 0 4 0 4 -2 0 -2 0 0 -4z M380 4 l0 -4 2 0 2 0 0 4 0 4 -2 0 -2 0 0 -4z" />
      <path fill={C.red} d="M197 312 c0 -1 0 -6 0 -12 l0 -11 -6 -1 -5 0 0 -12 0 -12 -11 0 -11 0 0 -127 0 -127 2 0 2 0 0 125 0 125 9 0 9 0 0 -125 0 -125 2 0 2 0 0 138 0 137 22 0 22 0 0 -137 1 -137 1 -1 2 0 0 125 0 125 34 0 35 0 4 -2 c2 -1 5 -3 7 -5 l3 -4 1 -5 2 -6 0 -114 0 -114 1 0 2 0 0 34 c0 19 0 71 0 116 l0 82 -1 3 c-2 8 -9 15 -17 18 l-3 1 -17 0 -17 0 0 5 0 6 -17 0 -16 1 -1 6 0 6 -19 0 -18 0 0 13 0 12 -2 0 c0 0 -1 -1 -2 -1z m71 -44 l0 -4 -14 0 -15 0 0 3 -1 2 1 2 1 1 14 0 14 0 0 -4z M202 247 l0 -10 10 0 9 0 0 10 0 9 -9 0 -10 0 0 -9z M202 223 l1 -9 9 -1 9 0 0 9 0 10 -10 0 -9 0 0 -9z m14 1 c0 -2 0 -5 0 -5 l1 -1 -5 0 -5 0 -1 3 c0 2 0 5 0 6 l1 1 4 0 5 0 0 -4z M249 113 l0 -103 2 0 2 0 0 101 c0 56 0 103 -1 103 0 1 -1 2 -2 2 l-1 0 0 -103z M263 113 l0 -103 2 0 2 0 0 101 c0 56 0 103 -1 103 0 1 -1 2 -2 2 l-1 0 0 -103z M278 113 l0 -103 2 0 2 0 0 103 0 102 -2 1 -2 0 0 -103z M294 215 c-1 0 -1 -46 -1 -103 l0 -102 2 0 2 0 0 101 c0 56 0 103 -1 103 0 2 -1 2 -2 1z M308 113 l0 -103 2 0 2 0 0 101 c0 56 0 103 -1 103 0 1 -1 2 -2 2 l-1 0 0 -103z M203 207 l-1 0 0 -9 0 -9 10 0 9 0 0 10 0 9 -8 0 c-5 0 -9 0 -10 -1z m13 -6 c0 -1 0 -3 0 -5 l0 -3 -5 0 -5 0 0 5 0 5 5 0 5 0 0 -2z M202 173 l0 -9 10 0 9 0 0 9 0 9 -9 0 -10 0 0 -9z M202 148 l0 -10 10 0 9 0 0 10 0 9 -9 0 -10 0 0 -9z m15 0 c0 -2 0 -4 -1 -5 l-1 -1 -4 0 -4 1 -1 4 0 5 5 0 6 0 0 -4z M195 24 c-1 0 -1 -4 -1 -8 l0 -6 2 0 2 0 0 6 0 6 6 0 5 0 0 -4 c0 -3 0 -5 0 -6 l0 -2 2 0 2 0 0 6 0 6 6 0 6 0 0 -6 0 -6 2 0 1 0 0 8 0 8 -16 0 -17 0 0 -2z" />
    </g>
  </svg>
);

// 12:30 (and 00:30) — twin-column square-window tower; shelf-glyph block left, dotted block right.
// POTRACED off ref f690 (x9=384, sx=1 — the last frame before the first rising doc), slot 830.
const ClC: React.FC = () => (
  <svg width={604} height={330} viewBox="0 0 604 330">
    <g transform="translate(0,330) scale(1,-1)">
      <path fill={WHT} d="M243 264 l0 -8 -10 -1 -10 0 0 -105 0 -104 38 0 37 0 0 104 0 105 -11 0 -11 1 -1 8 0 8 -16 0 -16 0 0 -8z m21 -39 l0 -10 -9 0 -9 0 0 10 0 9 9 0 9 0 0 -9z m27 0 l0 -9 -10 -1 -9 0 0 10 0 9 9 0 10 0 0 -9z m-27 -25 l0 -9 -9 0 -9 0 0 9 0 9 9 0 9 0 0 -9z m26 0 l0 -9 -9 0 -9 0 0 9 0 9 9 0 9 0 0 -9z m-26 -24 l0 -9 -9 0 -9 0 0 9 0 9 9 0 9 0 0 -9z m26 0 l0 -9 -9 0 -9 0 0 9 0 9 9 0 9 0 0 -9z m-26 -25 l0 -9 -9 0 -10 0 0 9 0 9 10 0 9 0 0 -9z m26 0 l0 -9 -9 0 -9 0 0 9 0 9 9 0 9 0 0 -9z m-26 -26 l0 -9 -9 0 -9 0 0 9 0 9 9 0 9 0 0 -9z m26 0 l0 -9 -9 0 -9 0 0 9 0 9 9 0 9 0 0 -9z m-26 -24 l0 -9 -9 0 -9 0 0 9 0 10 9 -1 9 0 0 -9z m26 0 l0 -9 -9 0 -9 0 0 9 0 10 9 -1 9 0 0 -9z m-26 -25 l0 -9 -9 0 -8 0 -1 9 0 9 9 0 9 0 0 -9z m26 -1 l0 -9 -9 0 -9 0 0 10 0 9 9 0 9 0 0 -10z M250 229 c-1 0 -1 -3 -1 -5 l0 -5 6 0 5 0 0 6 0 5 -5 0 c-2 0 -5 0 -5 -1z M250 205 c-1 0 -1 -3 -1 -5 l0 -5 5 0 6 0 -1 5 0 6 -4 0 c-3 0 -5 0 -5 -1z M277 205 l-1 0 0 -5 0 -5 5 0 5 0 0 5 0 6 -4 0 c-2 0 -4 0 -5 -1z M250 181 c-1 0 -1 -3 -1 -5 l0 -5 6 0 5 0 0 5 0 6 -5 0 c-3 0 -5 0 -5 -1z M277 181 l-1 0 0 -5 0 -5 5 0 5 0 0 6 0 5 -4 0 c-2 0 -4 0 -5 -1z M276 151 l0 -5 5 0 5 0 0 3 c0 1 0 3 0 5 l0 2 -5 0 -5 0 0 -5z M250 130 c-1 0 -1 -3 -1 -5 l0 -5 5 0 6 0 0 6 0 5 -5 0 c-3 0 -5 0 -5 -1z M276 126 l0 -6 5 0 5 0 0 6 0 5 -5 0 -5 0 0 -5z M249 101 l0 -5 5 0 6 0 0 5 0 5 -6 0 -5 0 0 -5z M249 80 c0 -1 0 -4 0 -6 l1 -3 5 -1 5 0 0 5 0 6 -5 0 -5 0 -1 -1z M276 76 l0 -6 5 0 5 0 0 6 0 5 -5 0 -5 0 0 -5z M170 151 l0 -105 25 0 24 0 0 105 0 104 -24 0 -25 0 0 -104z m28 73 l0 -9 -9 0 -9 1 -1 9 0 9 9 0 10 0 0 -10z m0 -24 l0 -9 -9 0 -9 0 0 9 0 9 9 0 9 0 0 -9z m0 -24 l0 -9 -9 0 -9 0 0 9 0 9 9 0 9 0 0 -9z m0 -25 l0 -9 -9 0 -10 0 0 9 0 10 9 -1 10 0 0 -9z m0 -26 l0 -9 -9 0 -9 0 0 9 0 9 9 0 9 0 0 -9z m0 -24 l0 -9 -9 0 -9 0 0 9 0 10 9 -1 9 0 0 -9z m0 -25 l0 -9 -9 -1 -9 0 0 9 0 10 9 0 9 0 0 -9z M184 205 c-1 0 -1 -3 -1 -5 l0 -5 6 0 5 0 0 5 0 6 -5 0 c-3 0 -5 0 -5 -1z M184 181 l-1 0 0 -5 0 -5 6 0 5 0 0 5 0 6 -4 0 c-3 0 -5 0 -6 -1z M184 130 c-1 0 -1 -3 -1 -5 l0 -5 6 0 5 0 0 6 0 5 -5 0 c-2 0 -5 0 -5 -1z M183 101 l0 -5 6 0 5 0 0 5 0 5 -5 0 -6 0 0 -5z M183 76 l1 -5 5 -1 5 0 0 5 0 6 -6 0 -5 0 0 -5z M117 148 c-1 -1 -4 -3 -4 -4 l-2 -2 0 -14 0 -13 4 -1 4 0 0 9 0 9 2 0 2 0 0 -9 0 -8 6 0 7 0 0 9 0 9 2 -1 1 0 0 -8 c0 -4 0 -8 1 -9 l1 -1 6 0 6 1 0 8 0 9 2 0 1 0 0 -9 1 -8 4 -1 5 0 0 17 0 18 -23 0 -22 0 -4 -1z M302 85 l0 -32 22 0 22 0 0 29 0 30 -2 2 c0 1 -2 2 -2 2 0 -1 -1 -1 -1 0 l0 1 -20 0 -19 1 0 -33z m12 27 l0 -4 -1 1 c-1 1 -3 1 -4 1 l-3 0 0 -4 0 -4 1 -1 c2 -1 5 -1 5 0 0 1 0 1 1 1 l1 0 0 -6 0 -6 -1 0 c-1 0 -1 1 -1 2 l0 2 -2 0 c-3 0 -5 -4 -3 -8 l0 -2 3 0 c1 0 2 0 2 1 0 1 0 1 1 1 l1 0 0 -16 0 -16 -5 0 -5 0 0 31 0 31 5 0 5 0 0 -4z m-3 -6 l0 -4 -1 0 -2 0 0 4 0 3 2 0 1 0 0 -3z m14 0 l0 -4 -2 0 -2 0 0 4 0 3 2 0 2 0 0 -3z m13 -1 l1 -4 -3 1 -2 0 0 4 0 3 2 0 2 0 0 -4z m-13 -17 l0 -3 -2 0 -2 0 0 4 -1 4 3 -1 2 0 0 -4z m13 1 l0 -4 -2 0 -2 0 0 3 0 4 2 0 c1 1 3 1 3 1 0 0 -1 -2 -1 -4z m-27 0 l0 -4 -1 0 -2 0 0 4 0 3 2 0 1 0 0 -3z M104 79 c1 -18 1 -41 1 -51 l0 -18 20 0 20 0 0 51 0 50 -21 0 -20 0 0 -32z m33 21 l0 -4 -1 0 c-1 0 -2 1 -2 2 l-1 2 -9 0 -9 0 0 -2 1 -2 -3 0 -3 0 1 3 0 4 13 0 13 0 0 -3z m0 -16 l0 -4 -2 0 -2 -1 0 2 1 3 -10 0 -9 0 0 -2 0 -2 -2 0 -2 0 1 -1 0 -1 -1 0 -1 1 1 4 0 4 13 0 13 0 0 -3z m0 -16 l0 -4 -2 0 -2 -1 1 2 0 3 -10 0 -9 0 0 -2 1 -2 -3 0 -2 0 0 4 0 4 13 0 13 0 0 -4z m0 -16 l0 -4 -2 0 -2 -1 1 3 0 2 -9 0 -10 0 0 -2 1 -2 -3 0 -3 0 1 3 0 4 13 0 13 0 0 -3z M148 61 l0 -51 9 0 10 0 -1 50 0 51 -9 0 -9 0 0 -50z M350 71 l0 -18 3 0 2 0 0 -1 0 -2 -2 0 -3 0 0 -20 0 -20 13 0 13 0 0 39 0 39 -6 -1 c-4 0 -9 0 -12 0 l-6 -1 0 1 c0 1 0 1 -1 1 l-1 0 0 -17z M58 62 c-3 -1 -9 -7 -10 -10 l-1 -3 0 -20 0 -19 14 0 13 0 0 27 0 27 -6 0 c-4 0 -8 -1 -10 -2z M302 30 l0 -20 22 0 22 0 0 20 0 20 -22 0 -22 0 0 -20z m9 18 l3 0 0 -18 0 -19 -5 0 -5 0 0 19 0 19 2 0 c0 -1 3 -1 5 -1z M170 26 l0 -16 24 0 24 0 0 8 0 7 16 0 16 0 0 -7 0 -8 24 0 24 0 0 16 0 16 -64 0 -64 0 0 -16z M222 16 l0 -6 5 0 5 0 0 6 0 5 -5 0 -5 0 0 -5z M236 16 l0 -6 5 0 5 0 0 6 0 5 -5 0 -5 0 0 -5z" />
      <path fill="#DCDCDC" d="M304 85 l0 -31 5 0 5 0 0 16 0 16 -1 0 c-1 0 -1 0 -1 -1 0 -1 -1 -1 -2 -1 l-3 0 0 2 c-2 4 0 8 3 8 l2 0 0 -2 c0 -1 0 -2 1 -2 l1 0 0 6 0 6 -1 0 c-1 0 -1 0 -1 -1 0 -1 -3 -1 -5 0 l-1 1 0 4 0 4 3 0 c1 0 3 0 4 -1 l1 -1 0 4 0 4 -5 0 -5 0 0 -31z M304 30 l0 -19 5 0 5 0 0 19 0 18 -3 0 c-2 0 -5 0 -5 1 l-2 0 0 -19z" />
      <path fill={NAVY} d="M74 179 l0 -111 -7 0 -8 -1 -5 -3 -4 -3 -3 -4 -3 -5 -1 -21 0 -21 2 0 2 0 0 19 0 20 1 3 c2 4 7 9 11 11 l3 1 6 0 6 0 0 -32 0 -32 2 0 2 0 0 4 0 4 -1 0 -1 0 0 141 0 141 -1 0 -1 0 0 -111z M376 191 l0 -99 -13 0 -13 0 0 10 0 10 -2 3 c-1 1 -3 4 -5 4 l-3 2 -19 0 -19 0 0 -1 c0 -3 2 -3 21 -3 l18 0 3 -2 2 -3 0 -29 0 -30 -22 0 -22 0 0 -1 0 -2 22 0 22 0 0 -20 0 -20 2 0 2 0 0 20 0 20 3 0 2 0 0 2 0 1 -2 0 -3 0 0 18 0 17 13 0 13 0 0 -40 c0 -22 0 -41 0 -44 l0 -4 2 0 2 0 0 4 0 4 -1 0 -2 0 0 141 -1 142 0 -100z M114 150 l-3 -3 -2 -3 -2 -3 0 -14 0 -13 -3 0 -3 0 0 -23 0 -23 -8 0 -8 0 0 -2 0 -2 8 0 8 0 0 -27 0 -27 2 0 2 0 0 51 -1 50 20 0 21 0 0 -50 0 -51 2 0 1 0 0 51 0 50 9 0 9 0 0 1 0 2 -5 0 -4 1 -1 8 0 9 -1 0 -2 0 0 -9 0 -8 -6 -1 -6 0 -1 1 c-1 1 -1 5 -1 9 l0 8 -1 0 -2 1 0 -9 0 -9 -7 0 -6 0 0 8 0 9 -2 0 -2 0 0 -9 0 -9 -4 0 -4 1 0 13 0 14 2 2 c0 1 3 3 5 4 l3 1 22 0 23 0 0 2 0 1 -24 0 -25 0 -3 -2z M308 106 l0 -4 2 0 1 0 0 4 0 3 -1 0 -2 0 0 -3z M321 106 l0 -4 2 0 2 0 0 4 0 3 -2 0 -2 0 0 -3z M334 106 l0 -4 2 0 2 0 0 4 0 3 -2 0 -2 0 0 -3z M111 100 l0 -4 2 0 2 0 0 2 0 2 9 0 9 0 1 -2 c0 -1 1 -2 2 -2 l1 0 0 4 0 3 -13 0 -13 0 0 -3z M308 89 l0 -4 2 0 1 0 0 4 0 3 -1 0 -2 0 0 -3z M321 89 l0 -4 2 0 2 0 0 4 0 3 -2 0 -2 0 0 -3z M334 89 l0 -4 2 0 2 0 0 4 0 3 -2 0 -2 0 0 -3z M386 90 c0 -1 2 -3 4 -4 l4 -2 1 -4 2 -3 0 -34 0 -33 2 0 1 0 0 35 0 34 -2 4 c-2 4 -6 7 -9 8 l-3 0 0 -1z M111 84 l0 -4 2 0 2 0 0 2 0 2 9 0 9 0 1 -2 c0 -1 1 -2 2 -2 l1 0 0 4 0 3 -13 0 -13 0 0 -3z M111 68 l0 -4 2 0 2 0 0 2 0 2 10 0 9 0 0 -2 0 -2 2 0 1 0 0 4 0 4 -13 0 -13 0 0 -4z M111 52 l0 -4 2 0 2 0 0 2 0 2 10 0 9 0 0 -2 0 -2 2 0 1 0 0 4 0 3 -13 0 -13 0 0 -3z" />
      <path fill={C.red} d="M180 274 l0 -14 -7 -1 -6 0 0 -2 c-1 -3 -1 -243 0 -245 0 -1 1 -2 2 -2 l1 0 0 16 0 16 64 0 64 0 0 -16 0 -16 2 0 2 0 0 125 0 124 -11 0 -12 0 0 9 0 8 -20 0 -20 0 0 -8 0 -9 -20 0 -21 0 0 7 0 6 -2 0 -2 0 0 -6 0 -7 -5 0 -6 0 0 15 0 14 -1 0 -2 0 0 -14z m95 -10 l1 -8 11 -1 11 0 0 -105 0 -104 -37 0 -38 0 0 104 0 105 10 0 10 1 0 8 0 8 16 0 16 0 0 -8z m-56 -113 l0 -105 -24 0 -25 0 0 105 0 104 25 0 24 0 0 -104z M246 225 l0 -10 9 0 9 0 0 10 0 9 -9 0 -9 0 0 -9z m14 0 l0 -6 -5 0 -6 0 0 5 c0 2 0 5 1 5 0 1 3 1 5 1 l5 0 0 -5z M272 225 l0 -10 9 0 10 1 0 9 0 9 -10 0 -9 0 0 -9z M246 200 l0 -9 9 0 9 0 0 9 0 9 -9 0 -9 0 0 -9z m14 0 l0 -5 -5 0 -6 0 0 5 c0 6 0 6 6 6 l5 0 0 -6z M272 200 l0 -9 9 0 9 0 0 9 0 9 -9 0 -9 0 0 -9z m14 0 l0 -5 -5 0 -5 0 0 5 0 5 1 0 c1 1 3 1 5 1 l4 0 0 -6z M246 176 l0 -9 9 0 9 0 0 9 0 9 -9 0 -9 0 0 -9z m14 0 l0 -5 -5 0 -6 0 0 5 c0 6 0 6 6 6 l5 0 0 -6z M272 176 l0 -9 9 0 9 0 0 9 0 9 -9 0 -9 0 0 -9z m14 1 l0 -6 -5 0 -5 0 0 5 0 5 1 0 c1 1 3 1 5 1 l4 0 0 -5z M245 151 l0 -9 10 0 9 0 0 9 0 9 -9 0 -10 0 0 -9z M272 151 l0 -9 9 0 9 0 0 9 0 9 -9 0 -9 0 0 -9z m14 3 c0 -1 0 -4 0 -5 l0 -3 -5 0 -5 0 0 5 0 5 5 0 5 0 0 -2z M246 125 l0 -9 9 0 9 0 0 9 0 9 -9 0 -9 0 0 -9z m14 1 l0 -6 -5 0 -6 0 0 5 c0 6 0 6 6 6 l5 0 0 -5z M272 125 l0 -9 9 0 9 0 0 9 0 9 -9 0 -9 0 0 -9z m14 1 l0 -6 -5 0 -5 0 0 6 0 5 5 0 5 0 0 -5z M246 101 l0 -9 9 0 9 0 0 9 0 9 -9 0 -9 0 0 -9z m14 0 l0 -5 -5 0 -6 0 0 5 0 5 6 0 5 0 0 -5z M272 101 l0 -9 9 0 9 0 0 9 0 9 -9 0 -9 0 0 -9z M246 76 l1 -9 8 0 9 0 0 9 0 9 -9 0 -9 0 0 -9z m14 -1 l0 -5 -5 0 -5 1 -1 3 c0 2 0 5 0 6 l1 1 5 0 5 0 0 -6z M272 76 l0 -10 9 0 9 0 0 9 0 10 -9 0 -9 0 0 -9z m14 0 l0 -6 -5 0 -5 0 0 6 0 5 5 0 5 0 0 -5z M179 225 l1 -9 9 -1 9 0 0 9 0 10 -10 0 -9 0 0 -9z M180 200 l0 -9 9 0 9 0 0 9 0 9 -9 0 -9 0 0 -9z m14 0 l0 -5 -5 0 -6 0 0 5 c0 6 0 6 6 6 l5 0 0 -6z M180 176 l0 -9 9 0 9 0 0 9 0 9 -9 0 -9 0 0 -9z m14 0 l0 -5 -5 0 -6 0 0 5 0 5 1 0 c1 1 3 1 6 1 l4 0 0 -6z M179 151 l0 -9 10 0 9 0 0 9 0 9 -9 0 -10 0 0 -9z M180 125 l0 -9 9 0 9 0 0 9 0 9 -9 0 -9 0 0 -9z m14 1 l0 -6 -5 0 -6 0 0 5 c0 6 0 6 6 6 l5 0 0 -5z M180 101 l0 -9 9 0 9 0 0 9 0 9 -9 0 -9 0 0 -9z m14 0 l0 -5 -5 0 -6 0 0 5 0 5 6 0 5 0 0 -5z M180 75 l0 -9 9 0 9 1 0 9 0 9 -9 0 -9 0 0 -10z m14 0 l0 -5 -5 0 -5 1 -1 5 0 5 5 0 6 0 0 -6z M218 18 l0 -8 2 0 2 0 0 6 0 5 5 0 5 0 0 -5 0 -6 2 0 2 0 0 6 0 5 5 0 5 0 0 -5 0 -6 2 0 2 0 0 8 0 7 -16 0 -16 0 0 -7z" />
    </g>
  </svg>
);

// 14:30 (and 02:30) — capped tower with twin window slots over a dash-grid body.
// POTRACED off ref f916 (x9=25.5, sx=1 — the last frame before the navy sweep), slot 1427.
const ClG: React.FC = () => (
  <svg width={604} height={330} viewBox="0 0 604 330">
    <g transform="translate(0,330) scale(1,-1)">
      <path fill={WHT} d="M191 255 l-1 0 0 -7 0 -6 45 0 45 0 0 6 0 7 -2 0 c-1 1 -85 1 -87 0z M199 235 l0 -3 37 0 36 0 0 3 0 3 -36 0 -37 0 0 -3z M189 177 l0 -51 6 0 6 0 0 2 c1 1 1 19 1 41 l-1 40 34 -1 33 0 0 -4 c1 -3 1 -21 1 -41 l0 -37 5 0 5 0 0 5 c1 6 1 69 0 85 l0 12 -45 0 -45 0 0 -51z M205 165 l0 -39 5 0 4 0 0 36 0 35 9 0 10 0 0 -35 1 -35 2 -1 2 0 -1 18 c0 10 0 26 1 36 l0 17 10 0 9 0 0 -35 0 -36 4 0 4 0 0 39 0 39 -30 0 -30 0 0 -39z M242 170 l0 -24 5 0 6 0 1 2 c0 1 0 12 -1 24 l0 21 -6 0 -5 0 0 -23z M217 173 c0 0 0 -6 0 -14 l0 -13 6 0 6 0 0 13 0 14 -3 0 c-4 1 -8 1 -9 0z M157 144 l0 -3 8 0 7 0 0 3 0 3 -7 0 -8 0 0 -3z M217 134 l0 -8 6 0 6 0 0 8 0 8 -6 0 -6 0 0 -8z M242 134 l0 -8 5 0 6 0 0 2 c1 0 1 3 1 6 0 3 0 6 -1 6 l0 2 -6 0 -5 0 0 -8z M295 134 l0 -7 2 1 1 0 0 2 c0 1 0 2 -1 2 l-1 0 0 3 0 3 1 0 c1 0 1 0 1 1 0 1 -1 1 -1 1 l-2 0 0 -6z M312 129 l0 -11 -7 0 c-3 0 -7 0 -8 -1 l-1 -1 26 0 26 1 0 11 0 12 -18 0 -18 0 0 -11z M128 136 c0 -1 0 -29 0 -64 l1 -62 23 0 23 0 0 53 c-1 29 -1 53 0 53 0 0 0 5 0 11 l0 10 -23 0 -23 0 -1 -1z m34 -8 l0 -2 -8 0 -8 0 0 2 -1 1 9 0 8 0 0 -1z m0 -11 l0 -2 -8 0 -8 0 0 2 0 1 8 0 8 0 0 -1z m0 -11 l0 -2 -8 0 -8 0 0 2 0 1 8 0 8 0 0 -1z m0 -11 l0 -2 -8 0 -8 0 0 2 0 2 8 0 8 0 0 -2z m0 -12 l0 -2 -8 0 -8 0 0 2 0 2 8 0 8 0 0 -2z m0 -11 l0 -2 -2 0 c0 -1 -4 -1 -7 -1 l-7 0 0 2 c-1 3 0 3 8 3 l8 0 0 -2z m0 -11 l0 -2 -8 0 -8 0 0 2 0 2 8 0 8 0 0 -2z M296 122 l0 -4 1 0 1 0 0 4 0 4 -1 0 -1 0 0 -4z M184 121 c-1 0 -2 -2 -3 -3 l-1 -1 -1 -54 0 -53 20 0 20 0 0 6 c0 4 0 8 1 8 l0 2 16 0 15 0 0 -8 0 -8 21 0 20 0 0 56 0 56 -53 0 -52 0 -3 -1z m34 -19 l0 -6 -2 0 -3 -1 0 7 0 6 3 -1 2 0 0 -5z m-20 0 l0 -6 -2 0 -2 0 0 6 0 5 2 0 2 0 0 -5z m39 0 l0 -6 -2 0 -1 -1 0 6 0 6 2 0 1 0 0 -5z m20 0 l0 -6 -1 0 c-2 0 -3 2 -3 6 0 4 1 5 3 5 l1 0 0 -5z m19 0 l0 -6 -1 0 c-1 0 -2 0 -2 1 0 0 0 2 -1 3 0 1 0 4 0 5 l1 2 2 0 1 0 0 -5z m-78 -26 l0 -6 -2 0 -2 0 0 6 0 7 2 0 2 0 0 -7z m78 1 l0 -7 -1 0 -2 0 0 3 c-1 2 -1 4 0 6 l0 3 2 0 c1 1 2 1 2 1 0 0 -1 -3 -1 -6z m-58 -1 l0 -6 -2 0 -3 0 0 4 c0 3 0 5 1 6 l0 2 2 0 2 0 0 -6z m19 0 l0 -6 -1 0 -2 0 0 6 0 6 2 0 1 0 0 -6z m20 0 l0 -6 -1 0 c-2 0 -3 2 -3 6 0 4 1 6 3 6 l1 0 0 -6z m-59 -25 l0 -6 -2 0 -2 0 0 5 0 6 2 0 c1 1 3 1 3 1 0 0 -1 -3 -1 -6z m20 0 l0 -6 -3 0 -2 -1 0 6 1 7 2 -1 2 0 0 -5z m19 -1 l0 -5 -1 0 -2 0 0 6 0 6 1 -1 2 0 0 -6z m19 6 l1 0 0 -6 0 -5 -2 0 -1 1 -1 5 -1 6 2 0 c1 -1 2 -1 2 -1z m20 -5 l0 -6 -2 0 -1 1 -1 5 0 6 2 0 3 0 -1 -6z M296 109 l0 -5 1 0 1 0 0 4 0 4 7 0 7 0 0 -4 0 -4 4 0 5 0 0 5 1 4 -13 0 -13 0 0 -4z M326 109 l0 -5 5 0 4 0 0 5 0 4 -4 0 -5 0 0 -4z M339 108 l0 -5 5 1 4 0 0 5 0 4 -4 0 -5 0 0 -5z M436 109 c0 -1 -8 -1 -17 -1 l-16 0 -3 -3 -2 -2 0 -46 0 -47 20 0 20 0 0 49 0 49 -1 0 c0 1 -1 1 -1 1z m-10 -23 l1 -3 -8 1 -8 0 0 -5 0 -5 -2 0 -1 -1 0 8 0 7 9 0 9 0 0 -2z m0 -27 l0 -2 -7 0 -8 0 0 -5 0 -5 -1 0 -2 0 0 7 0 8 9 -1 9 0 0 -2z M298 99 c2 -1 4 -1 4 0 1 0 3 0 6 0 l4 -1 0 -3 0 -3 -5 0 c-3 0 -7 0 -7 -1 l-2 0 0 3 0 4 -1 0 -1 0 0 -4 0 -4 26 0 26 1 0 4 0 5 -26 0 -26 0 2 -1z M296 83 l0 -5 1 0 1 0 0 4 0 4 7 0 7 0 0 -4 0 -4 5 0 5 1 0 4 0 4 -13 0 -13 0 0 -4z M326 82 l0 -4 5 0 4 0 0 5 0 4 -4 0 -5 0 0 -5z M339 83 l0 -5 5 0 4 0 0 5 0 4 -4 0 -5 0 0 -4z M296 43 l0 -31 1 0 1 0 0 31 0 30 5 0 c2 -1 5 -1 7 -1 l2 0 0 -30 0 -31 -8 0 c-5 0 3 -1 17 -1 l26 0 0 28 c0 16 0 30 1 32 l0 4 -26 0 -26 0 0 -31z M223 16 l0 -6 5 0 5 0 0 6 0 6 -5 0 -5 0 0 -6z M237 16 l0 -6 6 0 5 0 0 6 0 6 -6 0 -5 0 0 -6z" />
      <path fill="#DCDCDC" d="M310 145 l-19 -1 30 0 c17 0 31 0 31 0 -1 1 -25 2 -42 1z M297 139 c0 -1 -1 -3 -1 -4 l0 -3 1 0 c1 0 1 -4 0 -4 l-1 -1 1 -1 1 0 0 -4 c0 -2 0 -4 -1 -4 0 0 0 -1 1 0 1 0 4 0 8 0 l6 0 0 11 0 11 -7 0 -6 0 -2 -1z M298 108 l0 -4 7 0 7 0 0 4 0 4 -7 0 -7 0 0 -4z M297 98 l1 0 0 -4 0 -3 2 0 c0 1 4 1 7 1 l5 0 0 3 0 3 -4 0 c-6 1 -13 1 -11 0z M298 82 l0 -4 7 0 7 0 0 4 0 4 -7 0 -7 0 0 -4z M298 43 l0 -31 -1 0 c-1 -1 2 -1 7 -1 l8 0 0 31 0 30 -2 0 c-2 0 -5 0 -7 1 l-5 0 0 -30z M354 57 c-1 -3 -1 -11 -2 -16 l0 -10 1 -2 2 -1 4 0 4 0 0 18 0 18 -4 0 -5 0 0 -7z M354 17 l0 -6 5 0 4 0 0 6 0 5 -4 0 -5 0 0 -5z" />
      <path fill={NAVY} d="M165 156 l0 -5 -6 -1 -6 0 0 -5 0 -5 -14 0 -14 0 0 -39 0 -39 -20 0 -20 0 0 -2 0 -2 20 0 20 0 0 -24 0 -24 2 0 2 1 0 63 0 63 23 0 23 0 0 -10 0 -9 2 2 1 2 0 9 0 9 -1 0 -2 1 0 4 0 5 -3 0 -3 1 0 5 0 6 -2 0 -2 0 0 -6z m7 -12 l0 -3 -7 0 -8 0 0 3 0 3 8 0 7 0 0 -3z M292 135 l0 -9 2 0 2 0 -1 7 0 7 26 0 27 0 0 -12 0 -11 -26 -1 -26 0 0 -2 0 -1 13 0 13 0 0 -4 0 -5 -13 0 -13 0 0 -2 0 -2 26 0 26 0 0 -5 0 -4 -26 -1 -26 0 0 -2 0 -1 13 0 13 0 0 -4 0 -5 -13 0 -13 0 0 -2 0 -2 26 0 26 0 -1 -32 0 -32 2 0 2 0 0 7 1 7 12 0 13 0 0 2 0 1 -13 0 -12 1 0 19 0 19 12 0 13 0 0 2 0 1 -13 0 -13 0 0 38 0 37 -29 0 -30 0 0 -9z m43 -26 l0 -5 -4 0 -5 0 0 5 0 4 5 0 4 0 0 -4z m13 0 l0 -5 -4 0 -5 -1 0 5 0 5 5 0 4 0 0 -4z m-13 -26 l0 -5 -4 0 -5 0 0 5 0 4 5 0 4 0 0 -4z m13 0 l0 -5 -4 0 -5 0 0 5 0 4 5 0 4 0 0 -4z M146 128 l0 -2 8 0 8 0 0 2 0 1 -8 0 -8 0 0 -1z M146 117 l0 -2 8 0 8 0 0 2 0 1 -8 0 -8 0 0 -1z M401 111 c-1 -1 -3 -3 -4 -3 l-1 -2 -1 -18 0 -18 -5 -1 -4 0 0 -2 0 -1 4 0 4 0 0 -19 0 -20 -4 0 -4 0 0 -1 0 -2 4 0 4 0 0 -3 c0 -2 0 -5 1 -7 l0 -4 2 0 1 0 0 27 c0 15 0 36 0 47 l0 19 2 2 2 3 17 0 c10 0 18 0 19 0 0 0 0 -22 0 -49 l0 -49 2 0 1 0 0 51 0 51 -18 0 -18 0 -4 -1z M146 106 l0 -2 8 0 8 0 0 2 0 1 -8 0 -8 0 0 -1z M146 95 l0 -2 8 0 8 0 0 2 0 2 -8 0 -8 0 0 -2z M408 81 l0 -7 2 0 1 0 0 5 0 5 8 0 7 0 0 2 0 2 -9 0 -9 0 0 -7z M146 83 l0 -2 8 0 8 0 0 2 0 2 -8 0 -8 0 0 -2z M146 72 l0 -2 8 0 8 0 0 2 0 2 -8 0 -8 0 0 -2z M146 61 l0 -2 8 0 8 0 0 2 0 2 -8 0 -8 0 0 -2z M74 60 c-1 -1 -3 -2 -4 -4 l-1 -3 0 -21 0 -22 2 0 2 0 0 22 0 22 2 2 c0 1 1 3 1 3 l0 2 -2 -1z M408 54 l0 -7 2 0 1 0 0 5 0 5 8 0 7 0 0 2 0 2 -9 0 -9 0 0 -7z M80 4 l0 -4 3 0 2 0 0 4 0 4 -2 0 -3 0 0 -4z M382 4 l0 -4 2 0 2 0 0 4 0 4 -2 0 -2 0 0 -4z" />
      <path fill={C.red} d="M227 265 l0 -5 -21 -1 -20 0 0 -11 0 -10 5 0 4 0 0 -3 0 -3 -5 0 -5 0 0 -53 0 -54 -3 -1 -4 -2 -1 -3 c-1 -1 -2 -3 -2 -3 -1 0 -1 -24 0 -53 l0 -53 2 0 2 1 0 53 1 53 2 2 2 3 54 0 54 0 0 -1 c0 0 0 -25 0 -56 l0 -55 2 0 2 0 0 58 0 58 -6 0 -7 0 0 53 0 53 -3 0 -4 0 0 3 0 3 4 0 4 0 0 11 0 10 -21 0 -22 0 0 6 0 5 -2 0 -2 0 0 -5 0 -5 -3 -1 -3 0 0 5 0 6 -2 0 -2 0 0 -5z m51 -10 l2 0 0 -7 0 -6 -45 0 -45 0 0 6 0 7 1 0 c2 1 86 1 87 0z m-6 -20 l0 -3 -36 0 -37 0 0 3 0 3 37 0 36 0 0 -3z m7 -19 c1 -16 1 -79 0 -85 l0 -5 -5 0 -5 0 0 37 c0 20 0 38 -1 41 l0 4 -33 0 -33 0 0 -39 c0 -22 0 -40 -1 -41 l0 -2 -6 0 -6 0 0 51 0 51 45 0 45 0 0 -12z m-14 -51 l0 -39 -4 0 -4 0 0 36 0 35 -9 0 -10 0 0 -35 0 -36 -2 0 -3 0 0 35 0 36 -10 0 -9 0 0 -35 0 -36 -4 0 -5 0 0 39 0 39 30 0 30 0 0 -39z m-12 7 c1 -12 1 -23 1 -24 l-1 -2 -6 0 -5 0 0 24 0 23 5 0 6 0 0 -21z m-27 1 l3 0 0 -14 0 -13 -6 0 -6 0 0 13 c0 8 0 14 0 14 1 1 5 1 9 0z m3 -39 l0 -8 -6 0 -6 0 0 8 0 8 6 0 6 0 0 -8z m24 6 c1 0 1 -3 1 -6 0 -3 0 -6 -1 -6 l0 -2 -6 0 -5 0 0 8 0 8 5 0 6 0 0 -2z M194 102 l0 -6 2 0 2 0 0 6 0 5 -2 0 -2 0 0 -5z M214 102 l0 -6 2 0 2 0 0 6 0 5 -2 0 -2 0 0 -5z M234 102 l0 -6 2 0 1 0 0 6 0 5 -1 0 -2 0 0 -5z M254 106 c-2 -2 -1 -10 2 -10 l1 0 0 6 0 5 -1 0 c-1 0 -2 0 -2 -1z M272 105 c0 -1 0 -4 0 -5 1 -1 1 -3 1 -3 0 -1 1 -1 2 -1 l1 0 0 6 0 5 -1 0 -2 0 -1 -2z M194 76 l0 -6 2 0 2 0 0 6 0 6 -2 0 -2 0 0 -6z M214 76 l0 -6 2 0 2 0 0 6 0 6 -2 0 -2 0 0 -6z M234 76 l0 -6 2 0 1 0 0 6 0 6 -1 0 -2 0 0 -6z M254 80 c-2 -4 -1 -10 2 -10 l1 0 0 6 0 6 -1 0 c-1 0 -2 -1 -2 -2z M273 79 c-1 -2 -1 -4 0 -6 l0 -3 2 0 1 0 0 6 0 6 -1 0 -2 0 0 -3z M194 51 l0 -6 2 0 2 0 0 6 0 5 -2 0 -2 0 0 -5z M214 51 l0 -6 2 0 2 0 0 6 0 5 -2 0 -2 0 0 -5z M234 51 l0 -6 2 0 1 0 0 6 0 5 -1 0 -2 0 0 -5z M253 51 l1 -5 1 -1 2 0 0 5 0 6 -2 0 -2 0 0 -5z M272 51 l1 -5 1 -1 2 0 0 5 0 6 -2 0 -2 0 0 -5z M220 24 c-1 0 -1 -4 -1 -8 l0 -6 2 0 2 0 0 6 0 6 5 0 5 0 0 -6 0 -6 2 0 2 0 0 6 0 6 5 0 6 0 0 -6 0 -6 2 0 1 0 0 8 0 8 -15 0 -16 0 0 -2z" />
    </g>
  </svg>
);

// 09:30 (and 21:30) — hanging twin-column square-window tower between two white blocks.
// POTRACED off ref f690 (x9=384, sx=1 — the last frame before the first rising doc), slot -88.
const ClD: React.FC = () => (
  <svg width={604} height={330} viewBox="0 0 604 330">
    <g transform="translate(0,330) scale(1,-1)">
      <path fill={WHT} d="M45 284 l0 -37 1 -3 c2 -5 5 -7 9 -10 l4 -2 12 0 13 0 0 2 0 2 -12 0 -12 0 -3 2 -3 2 -3 4 -2 4 0 37 0 36 -2 0 -2 0 0 -37z M101 300 l0 -22 -2 0 -3 0 0 -2 0 -2 3 0 2 0 0 -19 0 -19 -4 0 -4 0 0 -2 0 -2 4 0 4 0 0 -11 0 -10 1 -3 c1 -2 3 -5 4 -6 l3 -2 23 -1 22 0 0 2 0 2 -21 0 -22 1 -3 2 -2 3 -1 33 0 32 24 0 25 0 0 2 0 2 -24 0 -24 1 -1 21 0 21 -2 0 -2 0 0 -21z M325 266 l0 -56 -9 0 -10 0 0 -2 0 -2 5 0 5 0 0 -10 0 -10 2 0 2 0 0 10 0 10 8 0 7 0 0 -10 0 -10 2 0 2 0 0 10 0 10 8 0 7 0 0 -10 0 -10 2 0 2 0 0 10 0 10 5 0 4 0 0 -15 0 -16 -2 -2 c-2 -1 -4 -3 -6 -4 l-3 -1 -25 0 -25 0 0 -2 0 -2 27 0 28 1 3 2 c1 1 3 3 4 4 l3 3 0 16 0 16 4 0 3 0 0 26 1 27 3 0 4 0 0 2 0 2 -4 0 -4 0 0 29 0 29 -2 0 -2 0 0 -56 0 -55 -22 0 -22 1 -1 55 0 55 -2 0 -2 0 0 -55z M438 300 l0 -20 -2 -5 c-2 -4 -7 -9 -12 -11 l-3 -1 -13 0 -13 0 0 -2 0 -2 14 0 14 0 5 2 5 3 2 3 c2 2 4 5 5 8 l2 4 0 21 0 21 -2 0 -2 0 0 -21z M337 276 l0 -4 15 0 15 0 0 4 0 4 -2 0 -2 0 0 -2 0 -2 -11 0 -11 0 0 2 0 2 -2 0 -2 0 0 -4z M337 258 l0 -4 15 0 15 0 0 4 0 4 -2 0 -2 0 0 -2 -1 -2 -10 0 -11 0 0 2 0 2 -2 0 -2 0 0 -4z M337 241 l0 -4 15 0 15 0 0 4 0 4 -2 0 -2 0 0 -2 0 -2 -11 0 -11 0 0 2 0 2 -2 0 -2 0 0 -4z M115 235 l0 -4 2 0 2 0 0 4 0 4 -2 0 -2 0 0 -4z M129 235 l0 -4 2 0 2 0 0 4 0 4 -2 0 -2 0 0 -4z M144 235 l0 -4 2 0 2 0 0 4 0 4 -2 0 -2 0 0 -4z M337 223 l0 -4 15 0 15 0 0 4 0 4 -2 0 -2 0 0 -2 0 -2 -11 0 -11 0 0 2 0 2 -2 0 -2 0 0 -4z M115 216 l0 -4 2 0 2 0 0 4 0 4 -2 0 -2 0 0 -4z M129 216 l0 -4 2 0 2 0 0 4 0 4 -2 0 -2 0 0 -4z M144 216 l0 -4 2 0 2 0 0 4 0 4 -2 0 -2 0 0 -4z" />
      <path fill={C.red} d="M154 298 c0 -15 1 -26 1 -26 0 0 0 -65 0 -66 0 -2 0 -8 0 -8 0 0 0 -19 0 -41 0 -23 0 -57 1 -76 l0 -35 12 0 12 0 0 -9 0 -8 1 -2 2 -1 20 0 21 0 0 2 c1 0 1 4 1 8 0 4 0 8 1 8 l0 2 22 0 22 0 0 -7 0 -6 2 -2 c2 -2 2 -1 3 7 l1 7 5 1 5 0 0 -16 0 -16 2 0 3 0 0 16 1 16 7 0 7 0 0 139 0 138 -2 0 -2 0 0 -17 0 -18 -2 0 c0 -1 -32 -1 -71 -1 l-69 0 0 18 0 18 -3 0 -3 0 0 -25z m88 -132 l0 -116 -11 0 -11 0 0 -9 c0 -5 0 -9 -1 -9 l-1 -1 -16 0 -16 1 -1 9 0 9 -13 0 -12 0 0 116 0 116 41 0 41 0 0 -116z m59 65 c0 -28 0 -54 0 -58 0 -4 0 -33 1 -65 l0 -58 -27 0 -28 0 0 116 0 116 28 0 27 0 -1 -51z M168 250 l0 -10 2 0 c0 -1 4 -1 8 -1 4 0 8 0 8 1 l2 0 0 10 0 10 -10 0 -10 0 0 -10z m15 5 c1 0 1 -2 1 -5 l0 -6 -6 0 -6 0 0 5 0 5 2 1 c2 1 5 1 9 0z M198 250 l0 -10 2 0 c0 -1 4 -1 8 -1 4 0 8 0 8 1 l2 0 0 10 0 10 -10 0 -10 0 0 -10z m16 -1 l0 -5 -6 0 -6 0 0 6 0 5 6 0 6 0 0 -6z M168 221 l0 -11 10 0 10 0 0 11 0 11 -10 0 -10 0 0 -11z M198 222 l0 -11 10 0 10 0 0 11 0 10 -10 0 -10 0 0 -10z m13 5 l3 -1 0 -5 0 -5 -6 0 -6 0 0 5 0 6 1 0 c2 1 6 1 8 0z M168 194 l0 -10 10 0 10 0 0 10 0 10 -10 0 -10 0 0 -10z m16 0 l0 -6 -6 0 -6 0 0 6 0 6 6 0 6 0 0 -6z M198 194 l0 -10 10 0 10 0 0 10 0 10 -10 0 -10 0 0 -10z m16 2 c0 -3 0 -6 -1 -6 l0 -2 -6 0 -5 0 0 6 0 6 6 0 6 0 0 -4z M168 166 l0 -10 10 0 10 0 0 10 0 10 -10 0 -10 0 0 -10z m16 0 l0 -6 -6 0 -6 0 0 5 0 6 1 0 c1 1 4 1 6 1 l5 0 0 -6z M198 174 c-1 0 -1 -5 -1 -10 l0 -8 11 0 10 0 0 10 0 10 -10 0 -10 0 0 -2z M168 138 l0 -10 10 0 10 0 0 10 0 10 -10 0 -10 0 0 -10z m16 0 l0 -6 -6 0 -6 0 0 5 c0 3 0 6 1 6 0 1 3 1 6 1 l5 0 0 -6z M198 138 l0 -10 10 0 10 0 0 10 0 10 -10 0 -10 0 0 -10z m16 0 l0 -6 -6 0 -6 0 0 6 0 6 6 0 6 0 0 -6z M169 121 l-1 -1 0 -10 1 -9 9 -1 10 0 0 10 0 11 -9 0 c-5 0 -10 0 -10 0z m15 -10 l0 -5 -2 0 c-2 -1 -6 -1 -8 0 l-2 0 0 5 0 5 6 0 6 0 0 -5z M199 121 l-1 0 0 -11 0 -10 10 0 10 0 0 10 0 11 -9 0 c-5 0 -9 0 -10 0z m15 -10 l0 -5 -2 0 c-2 -1 -6 -1 -8 0 l-2 0 0 5 0 5 6 0 6 0 0 -5z M168 84 l0 -10 11 0 10 0 0 8 c0 5 0 10 -1 10 l0 2 -10 0 -10 0 0 -10z M198 84 l0 -10 10 0 10 0 0 10 0 10 -10 0 -10 0 0 -10z m16 1 l0 -5 -1 -1 -1 -1 -5 0 -5 0 0 6 0 6 6 0 6 0 0 -5z M271 259 c-1 0 -1 -5 -1 -10 l0 -9 2 -1 c1 0 6 0 11 0 l8 1 0 10 0 10 -10 0 c-5 0 -10 0 -10 -1z m12 -4 l3 0 0 -6 0 -5 -5 0 -6 0 0 5 0 6 1 0 c2 1 3 1 7 0z M271 231 l-1 -2 0 -8 0 -9 2 -1 c1 0 6 0 11 0 l8 1 0 10 0 10 -9 0 -9 0 -2 -1z m13 -4 l2 0 0 -6 0 -5 -5 0 -6 0 0 5 0 6 4 0 c2 0 4 1 4 1 0 0 1 0 1 -1z M270 194 l0 -10 11 0 10 0 0 10 0 10 -10 0 -11 0 0 -10z m16 0 l0 -6 -5 0 -6 0 0 5 c0 7 0 7 6 7 l5 0 0 -6z M270 166 l0 -10 11 0 10 0 0 10 0 10 -10 0 -11 0 0 -10z M270 138 l0 -10 11 0 10 0 0 10 0 10 -10 0 -11 0 0 -10z m16 0 l0 -6 -5 0 -6 0 0 5 c0 7 0 7 6 7 l5 0 0 -6z M271 120 l-1 0 0 -9 0 -8 1 -2 2 -1 8 0 9 0 1 2 c0 1 0 6 0 11 l0 8 -9 0 c-5 0 -10 0 -11 -1z m15 -9 l0 -5 -2 -1 c-2 0 -4 0 -6 0 l-2 1 -1 5 0 5 5 0 6 0 0 -5z M270 84 l0 -10 11 0 10 0 0 10 0 10 -10 0 -11 0 0 -10z M212 315 l0 -9 18 0 18 0 0 9 0 8 -2 0 -2 0 0 -6 0 -7 -5 0 -6 0 0 7 0 6 -2 0 -3 0 0 -6 0 -7 -5 0 -6 0 0 2 c-1 0 -1 3 -1 6 l0 5 -2 0 -2 0 0 -8z" />
    </g>
  </svg>
);

// 11:30 (and 23:30) — symmetric legged structure with capsule feet.
// POTRACED off ref f690 (x9=384, sx=1 — the last frame before the first rising doc), slot 519.
const ClE: React.FC = () => (
  <svg width={604} height={330} viewBox="0 0 604 330">
    <g transform="translate(0,330) scale(1,-1)">
      <path fill={WHT} d="M11 282 l0 -39 36 0 36 0 0 -101 1 -100 0 140 c0 77 -1 125 -1 108 l0 -32 -34 0 -34 0 0 32 0 31 -2 0 -2 0 0 -39z m72 -31 l0 -3 -34 0 -33 0 -1 3 0 3 34 0 34 0 0 -3z M93 273 l0 -49 2 -3 c2 -2 4 -4 5 -5 l3 -1 16 0 17 0 0 11 0 11 -2 0 -2 0 0 -9 0 -9 -14 0 -14 0 -2 1 -3 1 -1 3 -1 3 0 47 0 47 -2 0 -2 0 0 -48z M368 259 l1 -62 -21 -1 -20 0 0 20 0 21 -2 0 -2 0 0 -22 0 -23 2 0 1 0 0 -4 0 -5 3 0 3 0 0 -5 0 -6 2 0 2 0 0 5 1 6 5 0 5 0 0 5 0 4 13 0 12 0 0 27 0 26 6 0 6 0 0 -102 1 -101 0 140 c0 77 -1 123 -1 103 l0 -36 -6 0 -6 0 0 36 0 36 -3 0 -2 0 0 -62z m-24 -69 l0 -3 -6 0 -7 0 0 3 0 2 7 0 6 0 0 -2z M447 295 l0 -27 -1 -4 c-1 -2 -3 -5 -4 -7 l-2 -3 -5 -3 -5 -2 -18 0 -17 0 0 -2 0 -2 18 0 18 0 4 2 c4 1 11 7 13 13 l3 4 0 28 0 29 -2 0 -2 0 0 -26z M106 246 l0 -4 2 0 2 0 0 4 0 3 -2 0 -2 0 0 -3z M106 230 l0 -4 2 0 2 0 0 4 0 3 -2 0 -2 0 0 -3z M340 226 l0 -2 7 0 7 0 0 2 0 2 -7 0 -7 0 0 -2z M340 215 l0 -2 7 0 7 0 0 2 0 2 -7 0 -7 0 0 -2z M340 205 l0 -2 7 0 7 0 0 2 0 2 -7 0 -7 0 0 -2z" />
      <path fill={C.red} d="M117 281 l0 -43 18 0 18 0 0 8 0 8 6 0 6 0 1 -1 1 -1 0 -50 0 -50 2 0 2 0 0 -18 0 -19 4 -4 3 -3 6 0 6 0 3 3 4 4 0 18 0 18 2 1 3 0 0 8 1 8 28 0 28 0 0 -8 0 -8 2 0 2 0 0 -17 0 -17 1 0 1 0 0 -3 0 -3 3 -2 c3 -2 7 -3 12 -2 l4 0 3 3 3 3 0 19 1 19 2 0 2 0 0 51 0 51 7 0 7 0 0 -8 0 -8 18 0 17 0 0 43 0 42 -2 0 -3 0 0 -40 0 -41 -5 0 -5 0 0 26 0 26 -2 0 c-1 1 -2 1 -2 0 0 0 -1 -11 -1 -24 0 -13 0 -25 -1 -26 l0 -2 -5 0 -5 0 0 41 0 40 -2 0 -2 0 0 -31 0 -32 -1 -1 -1 -1 -6 0 -6 0 0 33 0 32 -3 0 c-2 0 -3 0 -2 -1 l1 0 0 -83 0 -83 -14 0 -14 0 0 83 0 83 1 0 c1 1 0 1 -2 1 l-3 0 0 -33 0 -32 -28 0 -28 1 0 32 0 32 -3 0 -3 0 0 -83 0 -84 -13 0 -13 0 0 84 0 83 -2 0 -2 0 0 -31 c0 -17 0 -32 -1 -32 l0 -2 -7 0 -6 0 0 33 0 32 -18 0 -18 0 0 -42z m31 39 c1 -2 1 -74 0 -76 l0 -2 -6 0 -5 0 0 25 0 25 -2 0 -2 0 0 -25 0 -25 -6 0 -5 1 -1 39 0 40 13 0 14 0 0 -2z m60 -67 l1 -1 0 -25 c0 -13 0 -24 0 -24 1 0 2 0 2 1 l2 0 0 25 0 25 8 0 8 0 0 -25 0 -25 1 0 c1 0 2 0 2 0 l2 0 0 25 1 25 7 0 7 0 0 -25 0 -25 2 0 c0 -1 2 -1 2 -1 l1 1 -1 18 c0 10 0 21 1 25 l1 7 2 0 2 0 0 -41 0 -41 -28 0 -29 0 0 40 c0 23 0 41 1 41 1 1 3 1 5 0z m-16 -102 l1 -1 0 -17 0 -16 -2 -3 -3 -2 -4 0 -4 0 -3 2 -2 3 0 17 0 17 1 0 c2 1 15 0 16 0z m90 0 l3 0 0 -17 0 -17 -2 -3 -2 -2 -5 0 -4 0 -2 2 -1 2 -1 17 0 16 2 2 c2 1 7 1 12 0z M215 315 l0 -9 17 0 16 0 0 9 1 8 -17 0 -17 0 0 -8z m14 1 l0 -6 -3 0 c-2 0 -5 0 -5 1 l-2 0 0 6 0 5 5 0 5 0 0 -6z m14 0 l0 -6 -4 0 -4 1 -1 5 0 6 4 0 5 0 0 -6z M182 255 l-1 -1 0 -5 0 -5 3 0 2 0 0 6 0 6 -1 0 c-1 0 -2 -1 -3 -1z M275 250 l0 -6 2 0 2 0 0 6 0 6 -2 0 -2 0 0 -6z M182 231 c0 -1 -1 -3 -1 -5 l0 -3 1 -2 c1 0 2 -1 3 -1 l1 0 0 6 0 5 -1 1 c-1 0 -2 -1 -3 -1z M275 226 l0 -6 2 0 2 0 0 6 0 6 -2 0 -2 0 0 -6z M181 199 l0 -5 2 0 c2 -1 3 0 3 5 l0 5 -2 0 -3 0 0 -5z M275 199 l0 -6 2 0 2 0 0 6 0 5 -2 0 -2 0 0 -5z M181 174 l0 -6 3 0 2 0 0 6 0 6 -2 0 -3 0 0 -6z M275 174 l0 -6 2 0 2 0 0 6 0 6 -2 0 -2 0 0 -6z" />
    </g>
  </svg>
);

// 13:30 (and 01:30) — monolithic block with a finned shaft and a trapezoid cap.
// POTRACED off ref f916 (x9=25.5, sx=1 — the last frame before the navy sweep), slot 1115.
const ClF: React.FC = () => (
  <svg width={604} height={330} viewBox="0 0 604 330">
    <g transform="translate(0,330) scale(1,-1)">
      <path fill={WHT} d="M40 244 l0 -77 22 0 22 0 0 2 0 2 -20 0 -20 0 0 13 0 13 20 0 20 0 0 2 0 2 -3 0 -3 0 0 5 0 5 3 0 3 0 0 2 0 2 -20 0 -19 1 -1 5 0 5 20 0 20 0 0 2 0 2 -3 0 -3 0 0 5 0 5 3 0 3 0 0 2 0 2 -20 0 -19 1 -1 38 0 38 -2 0 -2 0 0 -77z m34 -9 l0 -5 -15 0 -14 1 -1 4 0 5 15 0 15 0 0 -5z m0 -29 l0 -5 -15 0 -14 1 -1 4 0 5 15 0 15 0 0 -5z M93 182 l0 -140 1 0 1 0 0 63 0 62 6 0 5 0 0 42 0 41 31 0 31 0 0 2 0 2 -31 0 -30 1 0 20 0 21 30 0 31 1 0 1 0 2 -31 0 -30 1 -1 10 0 10 -2 0 -2 0 0 -38 0 -39 -3 0 -4 0 0 39 0 38 -1 0 -1 0 0 -139z m9 53 l0 -5 -3 0 -4 0 0 5 0 5 4 0 3 0 0 -5z m0 -14 l0 -6 -3 0 -4 0 0 6 0 5 4 0 3 0 0 -5z m0 -15 l0 -5 -3 0 -4 0 0 5 0 5 4 0 3 0 0 -5z m0 -22 l0 -13 -3 0 -4 0 0 13 0 13 4 0 3 0 0 -13z M310 265 l0 -56 -10 0 -10 0 0 -2 1 -1 5 -1 6 0 0 -10 0 -10 2 0 2 0 0 10 0 10 7 0 7 0 0 -10 0 -10 2 0 2 0 0 10 0 10 8 0 7 0 0 -10 0 -10 2 0 2 0 0 10 0 10 5 0 4 0 0 -15 0 -14 -2 -3 c0 -2 -2 -4 -4 -4 l-3 -2 -26 0 -26 0 0 -2 0 -2 27 0 26 0 4 2 c2 1 4 3 5 4 l3 4 0 16 0 16 4 0 3 0 0 24 0 23 12 0 11 0 0 2 0 2 -11 0 -11 1 -1 32 0 32 -2 0 -2 0 0 -56 0 -56 -22 0 -23 0 0 56 0 56 -2 0 -2 0 0 -56z M395 182 l0 -140 1 0 1 0 0 105 0 105 18 0 17 0 0 35 0 34 -2 0 -2 0 0 -32 0 -32 -16 -1 -15 0 0 32 0 33 -1 0 -1 0 0 -139z M322 275 l0 -5 15 0 15 0 0 5 0 4 -2 0 -2 0 0 -2 0 -2 -11 0 -10 0 -1 2 0 2 -2 0 -2 0 0 -4z M322 257 l0 -5 15 0 15 0 0 5 0 4 -2 0 -2 0 0 -2 0 -2 -11 0 -10 0 -1 2 0 2 -2 0 -2 0 0 -4z M348 241 l0 -2 -11 0 -10 0 -1 2 0 2 -2 0 -2 0 0 -4 0 -4 15 0 15 0 0 4 0 5 -2 0 -2 0 0 -3z M322 222 l0 -5 15 0 15 0 0 5 0 4 -2 0 -2 0 0 -2 0 -2 -11 0 -10 0 -1 2 0 2 -2 0 -2 0 0 -4z" />
      <path fill={C.red} d="M168 192 l0 -132 5 0 5 0 0 -8 0 -7 1 -2 2 -1 7 1 8 0 1 -1 c1 -1 2 -4 3 -5 0 -2 1 -3 1 -3 1 0 1 -1 1 -2 0 -1 0 -2 1 -2 1 0 1 -1 1 -2 0 -2 0 -3 1 -4 1 0 1 -1 1 -2 l0 -2 23 0 22 1 2 4 c1 2 3 7 4 11 l3 6 9 0 c4 0 9 0 9 1 l2 0 0 9 0 8 5 0 5 0 0 132 0 131 -2 0 -2 0 0 -129 0 -130 -56 0 -57 0 0 72 c0 40 -1 98 -1 130 l1 57 -3 0 -2 0 0 -131z m107 -133 l1 -1 0 -5 0 -5 -46 0 -47 0 0 5 c0 3 0 6 1 6 0 1 20 1 45 1 l45 0 1 -1z m-21 -20 l0 -3 -1 0 c-1 0 -1 -1 -1 -2 0 -1 0 -2 -1 -2 -1 0 -1 -1 -1 -2 0 -1 0 -2 -1 -2 -1 0 -1 -1 -1 -2 l0 -2 -19 0 -19 0 -2 5 c-1 2 -2 5 -2 6 0 0 0 1 -1 1 0 0 -1 2 -1 3 l-1 3 25 0 26 0 0 -3z M210 250 l0 -74 -11 0 -11 0 0 -2 0 -2 11 0 11 0 0 -4 0 -4 -11 0 -11 0 0 -2 0 -2 12 0 11 0 0 -2 c-1 0 -1 -3 -1 -6 l0 -4 -11 0 -11 0 0 -2 0 -2 11 0 11 0 0 -4 0 -4 -11 0 -11 0 0 -2 0 -2 11 0 11 0 0 -13 0 -13 -1 0 c-1 0 -1 -1 -1 -2 0 -1 0 -2 1 -2 l1 0 0 -5 0 -5 19 0 18 0 0 5 0 4 2 1 c0 0 1 1 1 2 0 1 -1 2 -1 2 l-2 1 0 12 0 13 12 0 11 0 0 2 0 2 -11 0 -11 1 -1 3 0 4 11 0 12 0 0 2 0 2 -11 0 -11 1 -1 5 0 6 11 0 12 0 0 2 0 2 -11 0 -11 1 -1 3 0 4 11 0 12 0 0 2 0 2 -11 0 -11 1 -1 73 0 73 -3 0 -2 0 0 -7 0 -7 -5 0 -5 0 0 7 0 7 -3 0 c-2 0 -3 0 -2 -1 l1 0 0 -5 0 -5 -1 -1 -2 -2 -5 0 -4 1 0 6 0 7 -3 0 -3 0 0 -73z m32 -45 l0 -99 -13 0 -13 1 -1 98 0 99 13 0 14 0 0 -99z m0 -106 l0 -3 -13 0 -13 0 -1 2 c0 0 0 2 0 3 l1 1 13 0 13 0 0 -3z M218 236 l0 -10 11 0 10 0 0 10 0 10 -10 0 -11 0 0 -10z m16 0 l0 -6 -5 0 -5 1 -1 4 c0 2 0 5 0 6 l1 1 5 0 5 0 0 -6z M218 209 l0 -11 10 0 11 1 0 10 0 11 -10 0 -11 0 0 -11z m16 1 l0 -6 -5 0 -6 0 0 6 0 5 6 0 5 0 0 -5z M219 192 l-1 0 0 -10 0 -10 11 0 10 0 0 10 0 10 -4 0 c-4 1 -14 1 -16 0z M219 164 l-1 0 0 -10 0 -10 11 0 10 0 0 10 0 10 -2 0 c-3 1 -16 1 -18 0z m15 -9 l0 -6 -5 0 -6 0 0 6 0 5 6 0 5 0 0 -5z M218 126 l0 -10 11 0 10 0 0 10 0 10 -10 0 -11 0 0 -10z" />
    </g>
  </svg>
);

// 16:30 (=04:30) — twin round-turret block; navy slab-tower left, small navy right.
// POTRACED off ref f675, slot -1587 (work/…/r18-scenes1/trace.py). Not hand-drawn:
// law 19 — a trace of the ref's own vector art is soft exactly as the ref is soft and
// sits AT the SSIM ceiling; a hand redraw lands ~1px off on every stroke.
const ClX: React.FC = () => (
  <svg width={604} height={330} viewBox="0 0 604 330">
    <g transform="translate(0,330) scale(1,-1)">
      <path fill="#DCDCDC" d="M176 114 c0 -24 1 -34 1 -22 0 12 0 32 0 44 0 12 -1 2 -1 -22z M259 101 c0 -17 1 -24 1 -15 0 8 0 22 0 30 0 9 -1 2 -1 -15z M105 106 c0 -14 1 -19 1 -12 0 7 0 17 0 24 0 6 -1 1 -1 -12z M311 49 c0 -17 1 -24 1 -15 0 8 0 22 0 30 0 9 -1 2 -1 -15z M388 72 l0 -1 19 0 c24 0 24 1 -1 1 l-18 1 0 -1z M259 44 c0 -12 1 -17 1 -11 0 6 0 16 0 22 0 6 -1 1 -1 -11z" />
      <path fill={NAVY} d="M139 139 l0 -5 -5 0 -5 0 0 -4 0 -4 -11 0 -11 0 0 -1 c-1 -1 -1 -12 -1 -24 l0 -22 -10 -1 -11 0 0 -2 0 -1 11 0 10 0 0 -32 0 -33 2 0 2 0 0 56 0 56 18 0 19 0 0 -18 0 -18 2 0 1 0 0 20 0 20 -1 0 c0 0 -1 2 -1 4 l0 4 -3 0 -3 0 0 5 0 5 -1 0 -2 0 0 -5z m6 -11 l0 -2 -7 0 -6 0 0 3 0 2 6 0 6 0 1 -3z M123 115 l0 -2 7 0 6 0 0 2 0 1 -6 0 -7 0 0 -1z M123 106 l0 -2 7 0 6 0 0 2 0 1 -6 0 -7 0 0 -1z M319 96 l0 -10 1 0 2 0 0 8 1 8 13 0 14 0 2 -3 2 -2 0 -44 0 -43 2 0 2 0 0 29 0 28 10 0 9 0 0 2 0 1 -9 0 -10 0 0 3 0 3 10 0 9 0 0 2 0 1 -9 0 -10 0 0 9 -1 10 -1 2 c-1 2 -3 4 -5 4 l-2 1 -15 0 -15 0 0 -9z M123 96 l1 -1 6 -1 6 0 0 1 0 2 -7 0 -6 0 0 -1z M343 95 c0 0 0 -2 0 -3 l-1 -3 2 0 2 0 0 3 0 3 -1 0 c-1 0 -2 0 -2 0z M123 87 l1 -1 6 0 5 0 1 1 0 1 -6 0 -7 0 0 -1z M343 77 l0 -3 2 0 1 0 0 3 0 3 -1 0 -2 1 0 -4z M408 79 l-22 0 0 -2 0 -1 21 0 21 0 0 -3 0 -2 -21 -1 -21 0 0 -2 0 -1 21 0 21 0 0 -28 0 -29 2 0 1 0 0 35 c0 19 0 35 0 35 0 0 -11 -1 -23 -1z M124 78 c-1 0 -1 -1 -1 -2 l0 -1 5 0 4 0 0 2 0 2 -4 0 c-2 0 -4 0 -4 -1z M50 77 c-1 -1 -5 -4 -7 -6 l-5 -5 -1 -4 -1 -5 0 -24 0 -23 2 0 2 1 0 26 1 26 1 2 c1 2 6 7 10 8 l3 2 10 0 11 0 0 2 0 1 -11 0 -11 0 -4 -1z M123 68 l0 -2 5 0 4 0 0 2 0 1 -4 0 -5 0 0 -1z M124 59 c-1 0 -1 -1 -1 -2 l0 -1 5 0 4 0 0 2 0 2 -4 0 c-2 0 -4 0 -4 -1z M79 4 l0 -4 2 0 1 0 0 4 0 4 -1 0 -2 0 0 -4z M380 4 l0 -4 2 0 1 0 0 4 0 4 -1 0 -2 0 0 -4z" />
      <path fill={C.red} d="M186 200 c-1 -1 -3 -3 -3 -4 -1 -1 -2 -25 -2 -32 l0 -2 -2 0 -1 0 0 -43 c0 -23 0 -44 0 -46 l-1 -3 -6 0 -6 1 -1 7 0 7 -15 0 c-8 -1 -15 -1 -15 -1 l-1 0 0 -37 0 -37 2 0 1 0 0 36 0 35 6 0 5 0 0 -23 0 -24 1 0 2 0 0 23 1 24 5 0 5 0 0 -36 0 -35 2 0 1 0 0 28 0 28 7 0 7 0 0 -28 0 -28 1 0 2 0 0 74 0 74 12 0 12 0 0 -74 0 -74 2 0 2 0 0 28 0 28 25 0 c13 0 24 0 25 0 l1 0 0 -28 0 -28 2 0 2 0 0 74 0 74 13 0 12 0 0 -73 c0 -41 0 -74 0 -74 0 -1 1 -1 1 -1 l2 0 0 28 0 28 7 0 6 0 0 -28 0 -28 1 0 2 0 0 2 c1 1 1 17 1 35 0 17 0 32 0 33 l0 1 5 0 5 0 0 -22 0 -23 1 0 2 0 0 22 1 23 5 0 5 0 0 -36 0 -35 1 0 2 0 0 3 c1 2 1 19 1 38 l0 34 -13 0 c-7 0 -14 0 -16 -1 l-3 0 0 -7 0 -6 -6 0 -6 0 -1 45 0 46 -2 0 -2 1 0 14 0 15 -1 3 c-1 2 -3 4 -4 5 l-3 2 -3 0 c-5 0 -9 -2 -10 -5 l-2 -3 0 -15 0 -16 -2 -1 -2 0 0 -4 c0 -2 0 -5 0 -6 l0 -3 -26 -1 -26 0 0 7 0 7 -2 0 -2 1 -1 14 c0 7 0 15 0 16 l0 2 -3 4 -4 3 -4 0 -3 0 -4 -2z m11 -3 l3 -1 1 -4 c0 -3 0 -10 0 -17 l0 -12 -8 0 -7 0 -1 14 c0 8 0 16 0 17 l1 2 3 2 c4 1 4 1 8 -1z m84 0 c1 0 2 -2 3 -4 l1 -3 0 -12 c0 -6 0 -13 -1 -14 l0 -2 -8 0 -7 1 -1 14 0 15 1 2 c1 1 3 3 4 4 l2 1 3 -1 c1 0 3 0 3 -1z m-21 -90 l0 -37 -3 0 -2 1 -1 22 0 23 -1 0 -1 -1 -1 -22 0 -22 -8 0 -7 0 0 22 c0 13 0 23 -1 23 0 0 -1 0 -1 -1 l-2 0 0 -23 0 -22 -7 0 -7 0 0 23 0 23 -2 0 -2 0 0 -23 0 -23 -2 0 -3 0 0 37 0 37 26 0 25 0 0 -37z M191 142 l1 -4 1 0 2 0 0 4 0 5 -2 0 -2 0 0 -5z M274 142 l0 -5 2 0 2 0 0 5 0 5 -2 0 -2 0 0 -5z M191 120 l0 -5 2 0 2 0 0 5 0 4 -2 1 -2 0 0 -5z M274 120 l0 -5 2 0 2 0 0 5 0 5 -2 0 -2 0 0 -5z M191 96 l0 -5 2 0 2 0 0 5 0 5 -2 0 -2 0 0 -5z M274 96 l0 -5 2 0 2 0 0 5 0 5 -2 0 -2 0 0 -5z M191 79 c0 -1 0 -4 0 -6 l1 -3 1 0 2 0 0 4 0 5 -2 0 -1 1 -1 -1z M274 75 l0 -5 2 0 2 0 0 5 0 4 -2 0 -2 0 0 -4z M219 19 c1 -2 1 -5 1 -6 l0 -3 2 0 1 0 0 5 0 4 5 0 4 0 0 -4 0 -5 1 0 2 0 0 5 1 5 2 0 c1 0 3 0 5 0 l2 -1 0 -5 0 -4 2 0 1 0 0 7 0 6 -15 0 -14 0 0 -4z" />
    </g>
  </svg>
);

// 18:30 (=06:30) — trapezoid-cap tower over a ladder shaft; navy rail-block left, navy gantry right.
// POTRACED off ref f677, slot -984 (work/…/r18-scenes1/trace.py). Not hand-drawn:
// law 19 — a trace of the ref's own vector art is soft exactly as the ref is soft and
// sits AT the SSIM ceiling; a hand redraw lands ~1px off on every stroke.
const ClY: React.FC = () => (
  <svg width={604} height={330} viewBox="0 0 604 330">
    <g transform="translate(0,330) scale(1,-1)">
      <path fill="#DCDCDC" d="M169 198 l0 -43 -1 0 -1 -1 1 0 c2 0 2 1 2 45 l-1 42 0 -43z M169 79 c0 -18 0 -40 0 -50 0 -10 1 5 1 33 l0 50 -1 0 0 0 0 -33z M283 70 l-1 0 0 -18 0 -17 9 0 8 0 0 18 0 18 -7 0 c-4 0 -8 0 -9 -1z M283 27 l-1 0 0 -8 0 -8 9 0 8 0 0 9 0 8 -7 0 c-4 0 -8 0 -9 -1z" />
      <path fill={NAVY} d="M120 153 l-3 -1 -3 -4 -3 -3 0 -14 0 -14 -1 -1 c-1 0 -2 0 -3 0 l-2 0 -1 -21 0 -21 -9 -1 -10 0 0 -2 0 -2 9 0 10 0 0 -29 0 -30 2 0 2 0 0 51 -1 51 20 0 21 0 0 -51 0 -51 2 0 2 0 0 51 0 51 9 0 9 0 0 1 c0 2 -2 3 -7 3 l-4 0 0 9 1 9 -2 0 -2 0 0 -9 0 -9 -7 0 -6 1 0 8 0 9 -2 0 c-1 0 -2 0 -2 -1 0 0 0 -4 0 -9 l0 -8 -6 0 -7 0 0 9 0 9 -1 0 -2 0 0 -9 0 -9 -4 0 -5 0 0 14 0 13 3 4 4 3 24 0 25 0 0 2 0 2 -23 0 -23 0 -4 -1z M336 113 l0 -37 -28 -1 -28 0 0 -2 0 -1 28 0 27 0 0 -18 c0 -11 0 -19 0 -20 0 0 -12 0 -27 0 l-27 0 -1 -2 0 -2 28 0 27 0 0 -10 0 -10 2 0 2 0 0 35 1 36 18 -1 19 0 0 2 0 1 -6 0 -6 1 -1 4 0 5 6 0 7 0 0 1 0 2 -19 0 -18 1 -1 4 0 5 19 0 19 0 0 2 0 2 -6 0 -7 0 0 5 0 4 7 0 6 0 0 1 0 2 -19 0 -18 1 0 12 0 12 18 0 19 0 0 2 0 1 -20 0 -21 0 0 -37z m12 2 l0 -5 -4 0 -5 0 0 5 0 4 5 0 4 0 0 -4z m13 0 l0 -5 -5 0 -5 0 0 5 0 4 5 0 5 0 0 -4z m-13 -27 l0 -4 -4 0 -4 0 -1 4 0 5 5 0 4 0 0 -5z m13 0 l0 -4 -5 0 -4 0 -1 4 0 5 5 0 5 0 0 -5z M386 149 l0 -2 3 0 2 0 0 -12 0 -12 -3 0 -2 0 0 -2 0 -2 3 0 2 0 0 -4 0 -5 -3 0 -2 0 0 -2 1 -1 2 0 2 0 0 -6 0 -5 -2 0 -3 0 0 -1 0 -2 3 0 2 0 0 -5 0 -5 -2 0 -3 0 0 -1 0 -2 2 1 3 0 0 -35 1 -35 1 -1 2 0 0 70 0 70 -5 0 -4 0 0 -1z M118 104 l-3 0 0 -3 c-1 -2 0 -4 2 -4 l1 0 0 2 0 2 9 0 10 0 0 -2 1 -2 1 1 2 0 0 3 0 3 -10 0 c-6 0 -12 0 -13 0z M115 89 c0 0 0 -2 -1 -4 l0 -4 2 0 2 0 0 2 0 2 10 0 9 0 1 -2 c0 -1 1 -2 2 -2 l1 0 0 4 0 4 -13 0 c-7 0 -13 0 -13 0z M43 72 c0 0 0 -14 0 -31 l1 -30 1 0 1 0 0 29 0 29 15 0 15 0 0 2 0 2 -16 0 c-9 0 -17 0 -17 -1z M114 70 l0 -4 2 0 2 -1 0 2 0 3 9 -1 10 0 0 -2 0 -1 2 0 2 0 0 3 0 4 -14 0 -13 0 0 -3z M114 53 l1 -3 1 -1 2 0 0 2 0 3 9 0 c9 0 11 -1 11 -3 l0 -1 1 0 2 0 0 3 0 4 -13 0 -14 0 0 -4z M79 4 l0 -4 2 0 1 0 0 4 0 4 -1 0 -2 0 0 -4z M380 4 l0 -4 2 0 2 0 0 4 0 4 -2 0 -2 0 0 -4z" />
      <path fill={C.red} d="M203 276 c-1 -3 -3 -7 -4 -9 -2 -6 -2 -6 -12 -6 l-8 0 0 -7 0 -7 -5 -1 -4 0 0 -118 c0 -65 0 -118 1 -118 0 -1 1 -1 2 0 l1 0 0 116 0 117 51 -1 51 0 0 -116 0 -115 1 -1 c1 -1 2 -1 2 0 l1 0 0 118 0 118 -3 0 c-2 0 -5 0 -5 1 l-2 0 0 7 0 7 -8 0 -8 1 -5 10 -4 10 -19 0 -20 0 -3 -6z m39 2 l2 0 0 -2 c0 -2 0 -3 1 -3 0 -1 1 -2 2 -4 0 -2 1 -4 1 -5 l1 -2 -23 0 -24 0 0 1 c0 0 2 4 3 8 l4 8 16 0 c9 0 17 0 17 -1z m25 -26 l0 -5 -1 0 c-1 0 -20 0 -42 0 l-41 0 0 5 0 6 42 0 42 -1 0 -5z M210 216 c0 -1 0 -3 0 -3 -1 -1 -1 -2 -1 -3 l0 -2 -1 0 c-2 0 -2 -2 0 -3 l1 -1 0 -10 1 -11 -1 -1 -1 -1 -10 0 -10 0 0 -1 1 -1 10 -1 10 0 1 -3 c0 -1 0 -3 0 -3 l-1 -2 -10 0 -11 0 0 -2 1 -1 10 -1 11 0 0 -2 c0 -1 0 -3 -1 -5 l0 -3 -10 0 -10 0 0 -2 0 -1 9 -1 10 0 1 -1 1 -1 0 -2 -1 -3 -10 0 -10 0 0 -1 c0 -2 0 -2 10 -2 l8 0 1 -1 2 -1 -1 -65 0 -65 2 0 2 0 0 6 0 6 5 0 5 0 0 -6 0 -6 2 0 2 0 0 6 0 6 6 0 5 0 0 -6 0 -7 2 0 2 1 0 66 0 66 8 -1 c4 0 9 0 11 0 l2 1 0 2 0 1 -10 0 -11 0 0 4 0 4 10 0 10 0 1 1 0 2 -10 0 -11 0 0 5 0 6 8 -1 c4 0 9 0 11 0 l2 1 0 2 0 1 -10 0 -11 0 0 4 0 4 11 0 10 0 0 2 0 1 -10 0 -11 0 0 12 0 12 1 0 c1 0 1 1 1 2 0 0 0 1 -1 1 l-1 0 0 4 0 5 -2 0 c0 1 -8 1 -16 1 l-14 0 0 -2z m28 -5 l0 -3 -12 0 -13 0 0 3 0 3 13 0 12 0 0 -3z m0 -96 l0 -89 -12 0 -13 0 0 89 c0 49 0 89 0 89 1 0 6 1 13 1 l12 0 0 -90z M216 195 c0 -1 0 -5 0 -9 l1 -7 2 -1 c1 0 5 0 9 0 l7 0 0 9 0 9 -9 0 -9 0 -1 -1z M217 169 c-1 -3 -1 -13 0 -15 l0 -2 9 0 9 0 0 9 0 9 -9 0 -9 1 0 -2z m14 -8 l0 -4 -5 0 -5 0 -1 4 0 5 6 0 5 0 0 -5z M216 143 c0 -2 0 -5 0 -9 l1 -6 9 -1 9 0 0 9 0 9 -9 0 -9 0 -1 -2z M216 114 c0 -4 0 -8 1 -9 l0 -2 9 0 9 0 0 9 0 9 -9 0 -10 0 0 -7z m15 -2 l0 -5 -5 0 -5 0 0 5 0 5 5 0 5 0 0 -5z M217 96 c-1 0 -1 -4 -1 -9 l0 -8 10 0 9 0 0 9 0 9 -9 0 c-5 0 -9 0 -9 -1z m14 -8 l0 -5 -5 0 -5 0 0 2 c0 1 0 4 0 5 l0 3 5 0 5 0 0 -5z" />
    </g>
  </svg>
);

// 07:30 — hanging dot-grid tower over a nested-frame base.
// POTRACED off ref f679, slot -691 (work/…/r18-scenes1/trace.py). Not hand-drawn:
// law 19 — a trace of the ref's own vector art is soft exactly as the ref is soft and
// sits AT the SSIM ceiling; a hand redraw lands ~1px off on every stroke.
const ClH: React.FC = () => (
  <svg width={604} height={330} viewBox="0 0 604 330">
    <g transform="translate(0,330) scale(1,-1)">
      <path fill={WHT} d="M14 266 l0 -56 20 0 21 0 3 2 3 2 3 3 2 3 0 19 0 19 9 0 9 0 0 2 0 2 -9 0 -9 0 0 21 0 21 9 0 9 0 0 2 0 2 -9 0 -9 0 0 7 0 6 -2 0 -2 0 0 -50 0 -51 -3 -2 -2 -3 -19 0 -19 0 -1 53 0 53 -2 0 -2 0 0 -55z M114 315 l0 -7 -10 0 -11 0 0 -2 0 -2 11 0 10 0 0 -21 0 -21 -10 0 -11 0 0 -2 0 -2 11 0 11 0 -1 -41 0 -42 33 0 33 0 0 9 0 10 -2 0 -2 1 0 -8 0 -8 -29 0 -29 0 0 13 0 13 29 0 28 0 0 2 0 3 -14 0 -14 0 0 5 0 5 14 0 14 0 0 1 0 2 -28 0 -28 1 -1 5 0 5 28 0 29 0 0 2 0 3 -14 0 -14 0 -1 4 0 5 14 0 15 0 0 2 0 3 -20 0 c-11 0 -23 0 -28 0 l-9 0 0 34 0 34 -2 0 -2 0 0 -6z m13 -72 l0 -5 -2 0 c0 1 -2 1 -4 1 l-3 0 0 5 0 4 5 0 4 0 0 -5z m15 0 l0 -4 -5 0 -4 0 -1 4 0 5 5 0 5 0 0 -5z m-15 -29 l0 -5 -4 0 -4 1 -1 3 c0 2 0 5 0 6 l1 1 4 0 4 0 0 -6z m15 1 l0 -5 -5 0 c-5 -1 -5 -1 -5 4 l-1 3 2 1 1 2 4 0 4 0 0 -5z M361 252 l0 -69 -25 0 -26 0 0 11 0 11 -1 -3 c-1 -1 -2 -2 -2 -2 l-1 0 0 -10 0 -11 2 0 1 0 0 -6 0 -6 4 0 4 0 0 -6 0 -6 2 0 2 0 0 6 0 6 7 0 6 0 0 6 0 6 16 0 16 0 0 71 0 71 -2 0 -3 0 0 -69z m-31 -76 c0 -2 0 -4 -1 -4 l-1 -1 -7 0 -8 1 0 3 c0 4 1 4 9 4 l8 0 0 -3z M47 277 l0 -5 -8 -1 -8 0 0 -2 0 -1 10 0 10 0 0 7 0 8 -2 0 -2 0 0 -6z M325 267 l0 -2 8 0 8 0 0 2 0 2 -8 0 -9 0 1 -2z M325 255 l0 -2 8 0 8 0 0 2 0 2 -8 0 -8 0 0 -2z M47 248 l0 -6 -8 0 -8 0 0 -2 0 -3 10 0 10 0 0 8 0 8 -2 0 -2 0 0 -5z M325 243 l0 -2 2 0 c0 -1 4 -1 8 -1 l6 0 0 3 0 2 -8 0 -8 0 0 -2z M325 229 l1 -2 7 0 8 0 0 2 0 2 -9 0 -8 0 1 -2z M325 218 l-1 -2 9 0 8 0 0 2 0 2 -8 0 -8 0 0 -2z M333 207 l-8 0 0 -2 0 -2 8 0 8 0 0 3 c0 1 0 2 0 2 0 0 -4 -1 -8 -1z M325 193 l-1 -2 9 0 8 0 0 2 0 2 -8 0 -8 0 0 -2z" />
      <path fill={C.red} d="M176 259 l0 -64 2 0 c1 0 4 0 6 0 l5 -1 0 -58 c0 -32 1 -59 1 -59 0 0 2 0 5 0 l4 0 0 -3 0 -3 -2 0 c0 -1 -3 -1 -5 -1 l-3 0 0 -12 0 -12 25 0 24 0 0 -6 0 -5 2 0 2 1 0 5 0 5 3 0 3 0 0 -5 0 -5 2 0 c0 -1 1 -1 2 -1 0 0 0 2 0 6 l0 5 23 0 23 0 0 12 0 12 -3 0 c-2 0 -4 0 -6 1 l-2 0 1 3 0 3 6 0 5 0 0 60 0 59 2 0 2 0 0 2 c1 1 1 1 2 1 0 -1 2 1 3 4 l3 5 0 54 c0 29 0 55 -1 57 l0 4 -2 0 -2 0 0 -59 0 -59 -3 -2 -3 -3 -60 0 -59 0 0 62 0 61 -2 0 -3 0 0 -64z m118 -64 l1 -1 0 -56 0 -55 -1 0 c0 -1 -23 -1 -50 -1 l-49 0 0 1 c-1 0 -1 26 -1 56 l1 55 5 1 5 0 0 -45 0 -46 2 0 c0 -1 18 -1 38 -1 l36 0 0 46 0 46 5 0 c3 0 6 1 6 1 0 0 1 -1 2 -1z m-76 -1 l1 0 0 -39 0 -39 11 0 10 0 0 39 0 39 3 0 3 0 0 -39 0 -39 10 0 11 0 1 2 c0 2 0 19 0 39 l0 37 4 0 5 0 0 -43 0 -43 -33 0 -33 0 0 43 0 42 0 1 c1 0 3 1 7 0z m18 -9 l0 -8 -6 0 -6 1 0 8 0 8 5 0 c3 0 6 0 6 0 1 0 1 -4 1 -9z m27 1 l0 -8 -6 0 -6 0 -1 8 0 8 7 0 6 0 0 -8z m-27 -28 l0 -15 -6 -1 -6 0 0 2 c0 1 0 8 0 15 l0 14 6 0 6 0 0 -15z m27 13 c0 -1 0 -8 0 -15 l0 -13 -6 0 -6 0 -1 13 c0 8 0 15 0 16 l1 1 5 0 6 0 1 -2z m-27 -42 l0 -8 -6 -1 -6 0 0 5 c-1 3 -1 7 -1 9 1 1 1 3 1 3 0 1 3 1 6 1 l6 0 0 -9z m47 -55 l0 -3 -40 0 -40 0 0 3 0 3 40 0 40 0 0 -3z m10 -16 l0 -7 -48 0 c-27 0 -50 0 -50 1 l-2 0 0 7 0 6 50 0 50 0 0 -7z M225 315 l1 -8 17 0 18 0 1 2 c0 1 0 5 -1 8 l0 6 -2 0 -2 0 -1 -4 c0 -2 0 -5 0 -6 l0 -2 -5 0 -5 0 0 6 0 6 -2 0 -2 0 0 -4 c0 -3 0 -6 -1 -6 l0 -2 -6 0 -5 0 0 6 0 6 -3 0 -2 0 0 -8z M198 285 l-1 0 0 -7 0 -6 2 0 2 0 0 7 c0 7 0 7 -3 6z M220 284 c-1 0 -1 -4 -1 -7 l0 -5 2 0 3 0 0 5 c-1 3 -1 6 -1 7 l0 2 -1 0 c-1 0 -2 -1 -2 -2z M241 285 l-1 -1 0 -5 0 -4 1 -2 c1 0 3 -1 3 -1 l2 0 -1 6 c0 8 -1 10 -4 7z M264 285 c-1 -1 -2 -8 -2 -11 l1 -2 2 0 2 0 0 6 c0 7 -1 8 -3 7z M285 279 l0 -7 2 0 2 0 0 7 0 7 -2 0 -2 0 0 -7z M197 251 l0 -5 1 -2 c3 -2 3 -1 3 6 l0 7 -2 0 -2 0 0 -6z M219 251 c0 -6 0 -7 3 -6 l2 0 0 3 c0 2 0 4 -1 6 l0 3 -2 0 -2 0 0 -6z M241 256 l-1 -2 0 -4 0 -5 2 -1 2 -1 0 2 c1 0 1 4 1 7 l0 5 -1 0 c-1 0 -2 -1 -3 -1z M263 255 c-1 0 -1 -3 -1 -5 l0 -5 2 -1 2 -1 0 2 c1 0 1 4 1 7 l0 5 -2 0 -2 0 0 -2z M285 251 c0 -6 0 -7 3 -6 l1 0 0 6 0 6 -2 0 -2 0 0 -6z M220 228 c-1 0 -1 -3 -1 -6 l0 -6 2 0 3 1 0 5 0 6 -2 1 c-1 0 -2 0 -2 -1z M241 228 l-1 0 0 -6 0 -6 3 0 2 0 0 6 0 6 -1 1 c-1 0 -2 0 -3 -1z M264 228 l-2 0 0 -6 1 -5 1 -1 c2 -1 3 0 3 6 0 6 0 7 -3 6z M285 223 l0 -7 2 0 2 0 0 6 0 6 -2 0 c0 1 -1 1 -2 1 0 0 0 -3 0 -6z M197 222 l0 -6 2 0 2 0 0 6 0 6 -2 0 -2 0 0 -6z" />
    </g>
  </svg>
);

// 15:30 — hanging rail stack with a solid red bar and a comb foot.
// POTRACED off ref f675, slot -1897 (work/…/r18-scenes1/trace.py). Not hand-drawn:
// law 19 — a trace of the ref's own vector art is soft exactly as the ref is soft and
// sits AT the SSIM ceiling; a hand redraw lands ~1px off on every stroke.
const ClW: React.FC = () => (
  <svg width={604} height={330} viewBox="0 0 604 330">
    <g transform="translate(0,330) scale(1,-1)">
      <path fill={WHT} d="M15 276 l0 -45 35 0 34 0 0 2 0 2 -31 0 c-17 0 -32 0 -33 0 l-1 0 0 4 0 4 33 0 32 0 0 2 0 2 -32 0 -33 0 0 37 0 37 -2 0 -2 0 0 -45z M104 298 l0 -23 -2 0 -3 0 0 -2 0 -2 3 0 2 0 0 -12 0 -12 -5 0 -6 0 0 -2 0 -2 6 0 5 0 0 -4 0 -4 -5 0 -6 0 0 -2 0 -2 5 0 6 0 0 -13 1 -12 1 -3 c1 -1 3 -3 4 -4 l4 -2 21 0 21 0 0 2 0 2 -21 0 -21 0 -3 3 -3 3 0 32 0 32 24 0 24 0 0 2 0 2 -24 0 -24 0 0 23 0 23 -2 0 -2 0 0 -23z M373 249 l0 -72 -25 0 -26 0 0 4 0 4 -2 0 -2 0 0 -6 0 -6 2 0 1 0 0 -5 0 -6 4 0 4 0 0 -6 1 -6 1 -1 2 0 0 6 0 7 6 0 7 0 0 5 0 6 15 0 16 0 0 31 0 31 5 0 4 0 0 2 0 2 -4 0 -4 0 0 41 0 41 -2 0 -3 0 0 -72z m-31 -80 l0 -3 -8 0 -9 0 0 4 0 3 8 0 9 0 0 -4z M463 292 l0 -29 -1 -5 -2 -5 -4 -4 -3 -5 -5 -2 -4 -2 -25 -1 -24 0 0 -2 0 -2 24 0 25 1 5 2 c6 3 10 7 14 13 l3 5 0 32 0 33 -1 0 -2 0 0 -29z M344 263 l-8 0 1 -2 0 -1 8 0 8 0 0 2 c0 1 0 2 0 2 0 0 -4 -1 -9 -1z M337 249 l0 -2 8 0 8 0 0 2 0 2 -8 0 -8 0 0 -2z M337 237 l0 -2 8 0 8 0 0 2 0 2 -8 0 -8 0 0 -2z M118 235 c0 0 -1 -1 0 -2 0 -1 0 -3 0 -4 l0 -2 2 0 1 0 0 5 0 4 -1 0 c-1 0 -2 0 -2 -1z M132 232 l1 -4 1 -1 2 0 0 4 0 5 -2 0 -2 0 0 -4z M147 232 c0 -2 0 -4 0 -4 1 0 2 0 2 -1 l2 0 0 4 0 5 -2 0 -2 0 0 -4z M337 225 c0 -2 2 -3 10 -3 l6 0 0 2 0 2 -8 0 -8 0 0 -1z M118 217 c0 -1 0 -3 0 -4 l0 -4 2 0 1 0 0 4 0 4 -1 0 c-1 0 -2 0 -2 0z M132 213 l0 -4 2 0 2 0 0 4 0 4 -2 0 -2 0 0 -4z M147 213 l0 -4 2 0 2 0 0 4 0 4 -2 0 -2 0 0 -4z M337 212 l0 -2 8 0 8 0 0 2 0 2 -8 0 -8 0 0 -2z M337 200 l-1 -2 9 0 8 0 0 2 0 2 -8 0 -8 0 0 -2z M345 189 l-8 0 0 -1 0 -2 8 0 8 0 0 2 c0 1 0 2 0 2 0 0 -4 -1 -8 -1z" />
      <path fill={C.red} d="M157 255 l0 -69 3 0 c2 0 7 0 12 0 l9 0 0 -1 c1 0 1 -29 1 -64 l1 -63 0 -2 1 -2 2 0 c1 0 2 0 2 -1 0 -1 2 -3 5 -5 l3 -1 21 0 22 0 0 -7 c0 -4 0 -8 1 -9 l0 -2 19 0 18 0 0 -6 0 -7 2 0 2 0 0 7 0 6 3 0 4 0 0 9 0 9 6 0 6 0 0 3 c0 1 0 32 0 68 0 35 0 65 1 66 l0 2 11 0 10 0 0 69 0 68 -2 0 -2 0 0 -66 0 -66 -7 0 c-4 -1 -11 -1 -15 -1 l-7 1 -1 66 0 66 -2 0 -2 0 0 -54 0 -55 -2 0 c0 -1 -20 -1 -43 -1 l-42 0 0 55 0 55 -2 0 -3 0 0 -66 0 -66 -2 0 c-3 -1 -25 -1 -27 0 l-2 1 0 65 1 66 -3 0 -2 0 0 -68z m51 -53 l0 -6 -6 -1 -5 0 0 7 0 7 6 0 5 0 0 -7z m60 0 l0 -7 -28 0 -27 1 0 6 c-1 3 0 6 0 6 l0 1 28 0 27 0 0 -7z m16 1 l0 -7 -2 0 c0 -1 -3 -1 -5 -1 l-4 0 0 2 c-1 2 -1 10 0 11 0 1 3 1 6 1 l5 0 0 -6z m0 -18 l0 -6 -2 0 c0 -1 -20 -1 -43 -1 l-42 0 0 7 0 6 44 0 43 0 0 -6z m-92 -45 l1 -45 6 -1 7 0 0 -15 0 -15 2 0 1 -1 1 1 c1 1 1 8 1 16 l0 14 7 0 6 0 0 -15 0 -16 1 0 c3 0 3 2 3 17 l0 14 5 0 6 0 0 -15 1 -15 2 -1 2 0 0 15 0 16 6 0 5 0 0 -1 c0 -1 0 -8 0 -15 l1 -13 1 -1 c3 -2 3 -1 3 15 l0 15 6 0 7 0 0 -15 c0 -16 0 -17 2 -16 l2 1 0 15 0 15 5 0 6 1 0 45 1 46 2 0 3 0 1 -1 1 -1 0 -66 0 -66 -50 0 -50 0 -3 2 c-1 0 -3 2 -4 3 l-1 1 -1 63 c0 34 0 63 0 64 1 0 2 1 3 1 l2 0 0 -46z m16 27 l0 -7 -2 0 c0 -1 -3 -1 -5 -1 l-4 0 0 7 0 7 6 0 5 0 0 -6z m60 -1 l0 -7 -27 0 -28 0 0 5 c0 2 0 6 -1 7 l0 2 28 0 28 0 0 -7z m16 1 l0 -6 -1 -1 c-2 -1 -7 -1 -9 0 l-1 1 0 5 c0 3 0 6 0 6 l0 1 5 0 6 0 0 -6z m0 -18 l0 -7 -2 0 c0 -1 -20 -1 -43 -1 l-42 0 0 7 0 7 44 0 43 0 0 -6z m-76 -19 l0 -6 -6 -1 -5 0 0 7 0 7 6 0 5 0 0 -7z m76 1 l0 -7 -2 -1 c-3 0 -10 0 -9 1 0 1 0 4 0 7 l0 6 6 0 5 0 0 -6z m-1 -13 l1 -2 0 -8 0 -9 -43 0 -44 0 0 10 0 10 42 0 42 0 2 -1z m1 -76 c0 -3 0 -6 -1 -6 l0 -2 -20 0 -19 0 0 7 0 6 20 0 20 0 0 -5z M219 314 l0 -9 19 0 19 0 0 9 0 9 -2 0 -2 0 0 -6 0 -7 -6 0 -6 0 0 7 0 6 -2 0 -2 0 0 -6 0 -7 -1 0 c-1 0 -4 0 -7 0 l-5 0 0 7 0 6 -2 0 -3 0 0 -9z M175 292 l0 -7 2 0 2 0 0 7 0 6 -2 0 -2 0 0 -6z M302 292 l0 -7 2 0 2 0 0 5 0 6 -1 1 c-2 2 -3 1 -3 -5z M176 270 l-1 0 0 -6 0 -6 2 0 2 0 0 1 c1 4 1 10 0 11 0 1 -1 1 -3 0z M302 264 c-1 -5 0 -7 3 -6 l1 1 0 5 0 5 -2 0 c0 1 -1 1 -1 1 -1 0 -1 -3 -1 -6z M176 240 l-1 0 0 -5 c0 -6 1 -8 3 -8 l1 0 0 7 c0 7 0 7 -3 6z M302 237 c0 -3 0 -5 0 -6 -1 -1 -1 -2 0 -3 l1 -1 1 1 2 2 0 4 0 5 -1 1 c-3 2 -3 1 -3 -3z M175 207 l0 -7 2 0 2 0 0 7 0 6 -2 0 -2 0 0 -6z M302 208 c0 -3 0 -6 -1 -6 l0 -2 2 0 3 0 0 5 c0 6 -1 8 -3 8 l-1 0 0 -5z" />
    </g>
  </svg>
);

// 17:30 — hanging pinstripe monolith beside a square-window column.
// POTRACED off ref f676, slot -1294 (work/…/r18-scenes1/trace.py). Not hand-drawn:
// law 19 — a trace of the ref's own vector art is soft exactly as the ref is soft and
// sits AT the SSIM ceiling; a hand redraw lands ~1px off on every stroke.
const ClZ: React.FC = () => (
  <svg width={604} height={330} viewBox="0 0 604 330">
    <g transform="translate(0,330) scale(1,-1)">
      <path fill={WHT} d="M76 287 l0 -35 4 0 4 0 0 2 0 2 -2 0 -2 0 0 18 c0 10 0 19 1 21 l0 3 2 0 1 0 0 2 0 2 -2 0 -2 1 0 9 0 9 -2 0 -2 0 0 -34z M129 312 l0 -10 -18 0 -18 0 0 -2 0 -2 18 0 18 0 0 -21 0 -20 -18 -1 -18 0 0 -2 0 -2 18 0 18 0 0 -41 0 -42 18 0 17 0 0 2 0 2 -16 0 -15 0 0 13 1 14 15 0 15 0 0 2 0 2 -1 0 -2 0 0 4 0 4 2 1 1 2 0 1 -1 2 -15 0 -14 0 -1 5 0 5 15 0 16 0 0 2 0 2 -1 0 -2 0 0 5 0 5 2 0 1 0 0 2 0 2 -15 0 -16 0 0 38 0 37 -2 0 -2 0 0 -9z m13 -75 l0 -5 -4 0 -5 0 0 5 0 5 5 0 4 0 0 -5z m15 0 l0 -5 -4 0 c-6 0 -7 1 -7 6 l0 4 6 0 5 0 0 -5z m-17 -24 l2 0 0 -4 0 -5 -4 0 -5 0 0 4 c0 5 1 6 3 6 1 -1 2 -1 4 -1z m17 -4 l0 -5 -5 0 -6 0 0 4 0 5 1 0 c1 1 3 1 6 1 l4 0 0 -5z M402 258 l0 -63 -4 -1 -3 0 0 -2 0 -2 6 0 5 0 0 66 0 65 -2 0 -2 0 0 -63z M372 281 l0 -2 7 0 7 0 0 2 0 2 -7 0 -8 0 1 -2z M372 269 l0 -2 7 0 7 0 0 2 0 2 -7 0 -7 0 0 -2z M372 259 c0 0 0 -1 0 -2 l-1 -2 8 0 7 0 0 2 0 2 -7 0 c-4 0 -7 0 -7 0z M372 246 c0 0 0 -1 0 -2 l-1 -2 8 0 7 0 0 2 0 2 -7 0 c-4 0 -7 0 -7 0z M372 234 c0 0 0 -1 0 -2 l-1 -2 8 0 7 0 0 2 0 2 -7 0 c-4 0 -7 0 -7 0z M371 220 l0 -2 8 0 7 0 0 2 0 2 -7 0 -8 0 0 -2z M372 208 l0 -2 7 0 7 0 0 2 0 2 -7 0 -7 0 0 -2z M347 192 l0 -2 3 0 2 0 0 -6 0 -7 12 0 11 0 0 -9 0 -10 2 0 2 0 0 9 0 10 3 0 4 0 0 2 0 2 -15 0 -14 1 -1 3 0 4 15 0 15 0 0 3 0 2 -19 0 -20 0 0 -2z" />
      <path fill={C.red} d="M165 282 c0 -194 0 -225 2 -225 0 0 1 -1 2 -2 1 -4 5 -8 6 -7 0 0 1 -1 1 -2 l1 -2 2 0 c1 0 2 0 2 -1 0 -1 7 -2 26 -3 l19 0 0 -6 0 -6 19 0 18 0 0 -7 0 -7 21 0 20 0 0 -7 0 -7 3 0 2 0 0 4 c0 7 0 7 1 9 l1 1 5 0 5 0 0 13 0 13 12 0 13 0 0 6 c1 3 1 67 1 141 l0 136 -3 0 -3 0 0 -139 0 -139 -8 -1 -8 0 -2 1 -2 1 0 139 0 138 -2 0 -2 0 0 -153 0 -152 -24 0 -24 1 -1 4 c0 2 -1 70 -1 152 l1 148 -3 0 -2 0 0 -139 0 -139 -38 0 -38 1 -5 2 c-5 3 -7 5 -10 11 l-2 4 0 130 0 130 -3 0 -2 0 0 -41z m98 -245 l0 -4 -16 0 -16 0 0 0 c0 1 0 6 0 7 0 0 7 0 16 0 l16 0 0 -3z M181 210 c1 -63 1 -114 1 -115 0 0 1 -1 2 -1 1 0 2 1 2 1 0 1 0 52 0 115 l0 113 -3 0 -2 0 0 -113z M198 209 l0 -115 2 0 2 0 0 115 0 114 -2 0 -2 0 0 -114z M215 209 l0 -115 2 0 2 0 0 2 c1 0 1 52 1 114 l0 113 -2 0 -3 0 0 -114z M232 318 c-1 -7 -1 -220 0 -222 l0 -2 2 0 2 0 0 115 0 114 -2 0 -2 0 0 -5z M248 209 l0 -115 2 0 2 0 0 115 0 114 -2 0 -2 0 0 -114z M274 314 l0 -9 7 0 c3 -1 12 -1 18 -1 l12 1 1 1 c0 1 1 3 0 4 0 2 0 6 0 8 l0 5 -2 0 -2 0 0 -7 0 -6 -6 0 -5 0 -1 6 0 7 -3 0 -2 0 0 -7 0 -7 -6 0 -6 0 0 1 c-1 1 -1 4 -1 7 l0 6 -2 0 -2 0 0 -9z M283 170 l0 -11 11 0 10 0 0 11 0 10 -10 0 -11 0 0 -10z m15 2 c1 -1 1 -4 0 -5 l0 -3 -5 0 -4 1 -1 3 c0 2 0 4 0 5 l1 3 4 -1 4 0 1 -3z M283 142 l0 -11 11 0 10 0 0 11 0 10 -10 0 -11 0 0 -10z M283 114 l0 -11 11 0 10 0 0 11 0 10 -10 0 -11 0 0 -10z m15 5 c0 0 0 -2 1 -5 l0 -4 -1 -2 -1 -1 -4 0 -4 0 0 2 c-1 2 -1 8 0 9 0 1 9 1 9 1z M283 87 l0 -10 3 -1 c2 0 7 0 11 0 l7 1 0 9 0 10 -1 1 c-1 1 -6 1 -11 1 l-9 0 0 -11z m16 2 c0 -2 0 -4 0 -6 l-1 -2 -5 0 -4 1 -1 5 0 5 5 0 6 0 0 -3z M287 70 l-4 0 0 -10 0 -10 10 0 11 0 0 10 0 10 -3 0 c-2 0 -5 0 -7 0 -1 1 -4 1 -7 0z" />
    </g>
  </svg>
);


// ─── the skyline's world-fixed slot table ───
// r18 — THE CITY IS A 12-HOUR CYCLE OF SIX DESIGNS. WE MODELLED IT AS FOUR, AND
// TWO OF THE SIX HAD NEVER BEEN TRACED.
// The cruise only ever shows hours 08-15, so only ClA/ClB/ClC/ClG (above) and
// ClD/ClE/ClF (below) were ever traced, and the tiles outside that span cycled
// them on a 4-slot period. That period is fiction. The reference repeats every
// SIX slots — 12 hours, 3618 world units — and the proof is in the reference's own
// glyphs: ClA sits between 08:00 and 09:00 AND between 20:00 and 21:00 (ref f672,
// unmistakable), ClB at 10-11 and 22-23, ClC at 12-13 and 00-01 (rectified crop vs
// the cruise crop: .734 overlap, against .39/.46 for the wrong designs), ClG at
// 14-15 and 02-03. Between ClG and the next ClA sit two designs the cruise never
// shows — and gen20 filled them with cycled stand-ins, which is why its stand-in
// city LOST at every frame (-.034): right slots, right mass, WRONG SHAPE.
//
// And a fourth reuse was fiction too: `ClE` was mounted at BOTH -691 and 519 (r3
// marked it "edge reuse" — slot -691 is never fully visible in the cruise). It is
// not ClE. Rectify slot -691 out of f679 and correlate it against the canonical ClE
// crop: .485, where the ClD control in the same frame scores .979. It is its own
// building — ClH — and it has been wrong at the left edge of every cruise frame.
//
// The six are now traced end to end. The four new ones (ClX ClY ClH ClW ClZ) are
// POTRACES of the reference's own art, not redraws (law 19).
//
// AND THE CITY IS FINITE — IT IS NOT AN INFINITE TILING. Both ends are measured:
//  · LEFT. Project the S4 exit's own front through its lattice and it lands on world
//    local −4366 at EVERY frame of the whip (see S4X_H5). The front is the world's left
//    edge. The first ABOVE cluster after it is ClA at −4000 (ref f670: bare white from
//    the front until ClA's bridge at screen 1662, exactly as predicted), and the first
//    BELOW cluster is ClH at −4309. Tiling past them draws buildings into a strip the
//    reference leaves empty.
//  · RIGHT. The BELOW city ends after ClF: at f900/f916 the span past below-21:00 is
//    bare navy (r3 saw this and was right). The ABOVE city ends after ClG.
// So the world is exactly TEN slots wide in each half — one and two-thirds of a period.
type Slot = [number, React.FC];
const CITY_PERIOD = 3618; // 12 h × 301.5 world units
const ABOVE_CYCLE: Slot[] = [[-382, ClA], [222, ClB], [830, ClC], [1427, ClG], [2031, ClX], [2634, ClY]];
const BELOW_CYCLE: Slot[] = [[-691, ClH], [-88, ClD], [519, ClE], [1115, ClF], [1721, ClW], [2324, ClZ]];
const cityOf = (cycle: Slot[], lo: number, hi: number): Slot[] =>
  [-1, 0]
    .flatMap((k) => cycle.map(([x, Cl]) => [x + k * CITY_PERIOD, Cl] as Slot))
    .filter(([x]) => x >= lo && x <= hi)
    .sort((a, b) => a[0] - b[0]);
const CITY_ABOVE = cityOf(ABOVE_CYCLE, -4000, 1427);
const CITY_BELOW = cityOf(BELOW_CYCLE, -4309, 1115);
// the slots whose 604-wide box touches the visible local span [from, to]
const tiles = (city: Slot[], from: number, to: number): Slot[] =>
  city.filter(([x]) => x + 604 > from && x < to);
const CityRow: React.FC<{ slots: Slot[]; top: number }> = ({ slots, top }) => (
  <>
    {slots.map(([x, Cl]) => (
      <div key={x} style={{ position: "absolute", left: x, top }}>
        <Cl />
      </div>
    ))}
  </>
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
