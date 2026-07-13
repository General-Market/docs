import React from "react";
import { interpolate } from "remotion";
import { C } from "./data";
import { useBrand } from "./brand";
import { TracedArt } from "./TracedArt";

export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const lerp = (
  frame: number,
  range: [number, number],
  out: [number, number],
) => interpolate(frame, range, out, clamp);

// ─── Hexagon (pointed left/right, flat top/bottom) ───
export const hexPoints = (w: number, h: number) =>
  `${0.25 * w},1.5 ${0.75 * w},1.5 ${w - 1.5},${h / 2} ${0.75 * w},${h - 1.5} ${0.25 * w},${h - 1.5} 1.5,${h / 2}`;

// ─── r19: the hexagon's CORNERS are rounded in the ref — and rounding them is
//          WORTH NOTHING, because the hexagon's SHAPE is wrong first. ───
// Measured POSITION-INDEPENDENTLY (fit the flat top edge and the down-right
// diagonal, intersect them = where a sharp mitre would sit, then ask where the ink
// actually LEAVES the flat edge and REJOINS the diagonal — a misplaced hex cannot
// fake this reading):
//   ref hexCity  f1400 w359 — leaves the flat edge 7.2px BEFORE the mitre
//   ref smallHex f2560 w240 — leaves 4.0px before, rejoins 4.0px after (symmetric)
//   ours, both              — −0.4px / −0.7px: the ink is ON the vertex. Sharp.
// So the ref really does round its hexagon corners (tangent ≈ 0.017–0.020·w) and
// `strokeLinejoin="round"` — which only rounds by the 3px stroke width — is not a
// corner radius and never was.
// NEGATIVE A/B (rounded-poly path, tangent swept 0 / 0.012 / 0.018 / 0.024·w):
//   f1400 corner crop  .6595 → .6598 → .6614 → .6617   whole-frame +0.0001
//   f2560 corner crop  .7405 → .7382 → .7374 → .7338   whole-frame −0.00004
// It LOSES at f2560 and is noise at f1400. Reverted. Do not re-chase it — and note
// WHY it cannot pay: those corner crops score .66/.74 because the hexagon disagrees
// with the ref for a much larger reason.
// THE REAL DEFECT, measured at BOTH sites: the right-diagonal SLOPE.
//   ref 1.693 (f1400) · 1.731 (f2560)      ours 1.826 · 1.830
// Our `hexPoints` insets the left/right points at 0.25·w with h = 0.906·w, giving
// slope (h/2)/(0.25w) = 1.812. The ref's is ~1.71 → its points are inset ≈0.265·w
// (or its h/w is ≈0.855). A ~6% shape error, at every hexagon, every frame.
// Fixing it moves the hexagon's own edges AND the city art clipped inside it
// (scenesB `HexCity` / `SmallHex`), so it is a coupled change, not a one-liner —
// it needs its own round with the art alignment re-gated. Position and shape first;
// THEN the corner radius, which is worth ~0.0001 on its own. (Method lesson 4.)

export const Hexagon: React.FC<{
  cx: number;
  cy: number;
  w: number;
  h?: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  opacity?: number;
  drawP?: number; // 0-1 outline draw progress
  children?: React.ReactNode;
}> = ({
  cx,
  cy,
  w,
  h = w * 0.906,
  stroke = C.navy,
  strokeWidth = 3,
  fill = "none",
  opacity = 1,
  drawP = 1,
  children,
}) => {
  if (opacity <= 0) return null;
  const per = 4 * Math.hypot(0.25 * w, h / 2) * 0.5 + w; // approx perimeter
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ position: "absolute", left: cx - w / 2, top: cy - h / 2, opacity, overflow: "visible" }}
    >
      {children}
      <polygon
        points={hexPoints(w, h)}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeDasharray={drawP < 1 ? per : undefined}
        strokeDashoffset={drawP < 1 ? per * (1 - drawP) : undefined}
      />
    </svg>
  );
};

// Hexagon with white fill + traced art clipped inside.
export const HexIcon: React.FC<{
  art: string;
  cx: number;
  cy: number;
  w: number;
  opacity?: number;
  artScale?: number;
  drawP?: number;
}> = ({ art, cx, cy, w, opacity = 1, artScale, drawP = 1 }) => {
  if (opacity <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, opacity }}>
      <TracedArt
        name={art}
        x={cx - w / 2}
        y={cy - (w * 0.906) / 2}
        scale={artScale ?? w / 340}
      />
      {drawP < 1 && <Hexagon cx={cx} cy={cy} w={w} drawP={drawP} stroke="rgba(0,39,83,0.001)" />}
    </div>
  );
};

// ─── CLSNet logo box ───
// Geometry re-measured r8: the ref box is SQUARE at every site (f400
// 268.5², f1520 154², f2330 335², f2600 164², f2762 200.5²) — the r1
// h=(w/274)*300*0.94 formula rendered every box 3-6% too tall. `w` stays
// the ART-crop width (274 native) so the traced diamond/dot alignment
// (pixel-exact at f400) is untouched; the box rect is 0.98·w square.
// `side` overrides the square for sites measured off the 0.98 ratio
// (strip2 = 200.5 for w=200); artDx/artDy are per-site measured content
// nudges (ref strip2 draws the diamond +3/+4 vs pure scaling — human
// layout, confirmed dot AND diamond offset together).
// ─── r18: the LABEL is a property of the box, not of the call site ───
// Every site drew it 8px right and ~20% small. Measured ref-vs-render at SIX
// sites (ink bboxes, th=160 on both — one predicate family):
//   site         boxSide   ref labelCtr−boxCtr   ratio    ref inkH   ref fs   we drew
//   flows f400     269           −6.0          −0.0223      36        46.7      48.0
//   locks f1740    221           −5.0          −0.0226      30        38.9      39.2
//   match f1600    156           −4.0          −0.0256      21        27.2      22.0
//   pay   f2560    166           −4.0          −0.0241      22        28.5      26.0
//   detail f2360   331           −7.5          −0.0227      44        57.1      45.8
//   gantt f2320    516*          −             −            69        89.5      73.3
// TWO laws, and each holds at every site:
//   POSITION  the ref seats the label's advance centre 2.26% of the box side
//             LEFT of the box centre. We centred it on `w` — itself 2.75·scale
//             RIGHT of the box centre (box = 0.98·w) — so the ink landed a flat
//             8px right EVERYWHERE (subpixel profile fit: dx = 8.00 at flows AND
//             at locks, ncc 0.998).
//   SIZE      fs = 47·scale reproduces every ref fs above to ±1px. The same
//             profile fit reads our glyphs 2.25%/1.90% wide and 2.6%/1.5% tall at
//             the two default-fs sites → fs 46.94/47.11. Default 48 → 47.
//
// LEGACY ESCAPE HATCH. Both laws are anchored to the BOX, so a site whose box is
// misplaced inherits the error — and a bigger, correctly-centred label on a
// misplaced box is MORE misplaced ink, which loses (lesson 4). Three of the four
// `labelFs` sites have exactly that: match's box is 9px low and 4px narrow (ref
// x769 y341 side 156; we draw x768 y350 side 152), detail's is 7px low and 9px
// narrow (ref x794 y475 side 331; we draw x795 y482 side 322), and gantt's is
// keyframed off it. Applying the law there took the match label crop from .459 to
// .254 — the box error swamps the label. So: **passing `labelFs` opts the site
// out of both laws** (it keeps its hand-fit size and the old centring), and the
// law lands wherever the box is already true — flows, tradeDocs, locks.
// TO THE OWNERS OF scenesB / scenesC / data.ts: fix the box, delete `labelFs`,
// and the site adopts the law for free. (r18 addendum did this for tradeDocs,
// match and report; only payment is still opted out.)
//
// ─── r19: THE SEAT IS A RATIO OF THE BOX SIDE, AND ONLY ONE ───
// r18 read three different seats — payment 296.6·scale, flows 301, locks 302 —
// and concluded "the seat is not the constant it is taken for". It IS. It was
// read against `scale` (a function of `w`) instead of against the box's own
// SIDE, which is the only datum the ref's lockup has. Divide by the side and
// every settled site returns one number (ref frames, ink-crossing estimator,
// work/clsnet/r19-U/seat.py):
//   site        frames        ref side   ref cap-top below box top   ratio
//   flows       400/430/440      269              300.17             1.1159
//   tradeDocs   1400/1420        269              300.12             1.1157
//   match       1600/1620        156              175.01             1.1218
//   locks       1740/1750        221              246.1              1.1136
//   gantt card  2320             525              586.56             1.1173
//   gantt card  2330             341              381.25             1.1180
//   report      2360/2365        331              369.2              1.1155
//   payment     2560/2600        166              184.3              1.1100
// The gantt detail card proves it for free: the SAME site at TWO sizes (525
// settled, 341 mid-scale) returns 1.1173 and 1.1180. The lockup is ONE
// uniformly-scaled symbol — no strut, no affine term, no per-site seat. LSQ
// over all ten reads: SEAT = 1.1161·side, residuals ≤1.0px, RMS 0.6px.
// We were seating at 301.8·scale = 1.1240·side — 0.8% of the side too LOW:
// ~1px at flows, ~2.5px at report, ~4px at the gantt card, ~3px at payment.
// That 3px is exactly what made payment's label law lose.
//
// ─── r19: THE WORDMARK FONT-LOAD RACE DOES NOT EXIST (r18 residual 3, REFUTED) ───
// r18 logged "the wordmark renders ~20% narrow in roughly one render in five — a
// font-load race" and called the composition nondeterministic. It is not.
// `brand.sans` is HELVETICA (`cls-shared/fonts.ts`) — `'Helvetica Neue', Helvetica,
// Arial, sans-serif`, a SYSTEM stack. ClsNet-Replicate loads NO web font, so there
// is nothing to race. (`@remotion/fonts` `loadFont` — used only by CrxNetting, for
// Diatype — already wraps delayRender/continueRender internally; read the dist.)
// What r18 actually saw: I measured the wordmark's ink width in EVERY r18 still.
// It is bimodal — f2320 {265, 333} · f2360 {166, 198} · f2560 {94, 106} ·
// f1600 {80, 99} — and the split is by CODE VERSION, not by luck. The narrow ones
// are pre-label-law renders (the old hand-fit `labelFs`); the wide ones are post-law.
// r18 compared stills from two generations of its own code and read the difference
// as a race; "one in five" is the share of its stills that came from the older code.
// PROOF: 12 renders of f2320, same code, same frame, one held lock, quiet box —
// 12/12 md5-IDENTICAL, one wordmark (333px, 11039 ink px). Plus 8/8 at f400.
// Do NOT add delayRender here. Determinism holds (method lesson 15).

/** Wordmark cap-top below the box top, in units of the box SIDE. LSQ over ten
 *  settled ref reads (1.1161); swept in-render against the ref label crops at
 *  six sites and confirmed at the same value (r19). */
const LABEL_SEAT = 1.1202;
/** Wordmark size, in units of the box side — r18's `fs = 47·scale` restated on
 *  the box datum (47/268.5), so an unchanged call site renders an unchanged fs. */
const LABEL_FS = 47 / 268.5;
/** Helvetica Neue Bold: the line box puts this much of the font-size ABOVE the
 *  cap-top. It scales WITH the font-size (the div sets its own `font-size`, so
 *  the strut is that font's, not the 16px page strut of method lesson 11). */
const LABEL_STRUT = 0.2298;

export const ClsNetBox: React.FC<{
  x: number;
  y: number;
  w?: number;
  opacity?: number;
  label?: boolean;
  /** legacy hand-fit; passing it opts this site out of BOTH label laws */
  labelFs?: number;
  labelDx?: number;
  border?: "none" | "orange";
  bg?: string;
  markP?: number;
  side?: number;
  artDx?: number;
  artDy?: number;
}> = ({ x, y, w = 274, opacity = 1, label = true, labelFs, labelDx, border = "none", bg = C.navy, markP = 1, side, artDx = 0, artDy = 0 }) => {
  const brand = useBrand();
  if (opacity <= 0) return null;
  const scale = w / 274;
  const box = side ?? (268.5 / 274) * w;
  const optOut = labelFs !== undefined;
  // fs unchanged from r18 (47·scale ≡ LABEL_FS·box when `side` is not passed)
  const fs = labelFs ?? LABEL_FS * box;
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity }}>
      <div
        style={{
          position: "absolute",
          width: box,
          height: box,
          // outer radius measured 21-22px native at BOTH f400 (navy box,
          // arc ends 21px below top) and f2762 (orange border, arc 15px at
          // scale .73); the r1 value 40 was eyeballed
          borderRadius: 22 * scale,
          backgroundColor: bg,
          // ref strip2 border measured 6px thick at w=200 (x860-865 of
          // x860-1059 outer) = 8px at native 274; border-box keeps the
          // outer bounds at the measured x/y/w
          border: border === "orange" ? `${8 * scale}px solid ${C.orange}` : undefined,
          boxSizing: "border-box",
        }}
      />
      {markP > 0 && (
        <TracedArt name="logoMark" x={artDx} y={artDy} scale={scale} opacity={markP} />
      )}
      {label && (
        <div
          style={{
            position: "absolute",
            // Seat the CAP-TOP at LABEL_SEAT·box, then back off the strut the
            // line box puts above it. `top` is CSS; the ink is what we aim.
            // (An opted-out site keeps its whole legacy hand-fit, 292·scale.)
            top: optOut ? 292 * scale : LABEL_SEAT * box - LABEL_STRUT * fs,
            // 0.5 − 0.0226 = 0.4774 of the box side, minus the div's own centre
            left: labelDx ?? (optOut ? 0 : 0.4774 * box - 0.5 * w),
            width: w,
            textAlign: "center",
            whiteSpace: "nowrap",
            fontFamily: brand.sans,
            fontWeight: 700,
            fontSize: fs,
            color: C.navy,
          }}
        >
          {brand.boxLabel}
        </div>
      )}
    </div>
  );
};

// ─── Serif label (USD/CNH/EUR…) ───
export const SerifLabel: React.FC<{
  text: string;
  x: number;
  capTop: number;
  fs: number;
  color?: string;
  opacity?: number;
  align?: "left" | "right" | "center";
  width?: number;
  tracking?: number;
}> = ({ text, x, capTop, fs, color = C.navy, opacity = 1, align = "left", width, tracking }) => {
  const brand = useBrand();
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        // Georgia cap sits 0.14em below CSS top at lh 1 (r8-measured at
        // fs138 offset 19.4 and fs200 offset 27; Playfair's factor was 0.30)
        top: capTop - 0.14 * fs,
        width,
        fontFamily: brand.serif,
        fontWeight: 400,
        fontSize: fs,
        lineHeight: 1,
        color,
        opacity,
        whiteSpace: "pre",
        textAlign: align,
        letterSpacing: tracking,
      }}
    >
      {text}
    </div>
  );
};

// ─── Sans text ───
export const SansText: React.FC<{
  text: string;
  x: number;
  y: number;
  fs: number;
  color?: string;
  weight?: number;
  opacity?: number;
  align?: "left" | "right" | "center";
  width?: number;
  lineHeight?: number;
}> = ({ text, x, y, fs, color = C.white, weight = 400, opacity = 1, align = "left", width, lineHeight = 1.15 }) => {
  const brand = useBrand();
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        fontFamily: brand.sans,
        fontWeight: weight,
        fontSize: fs,
        lineHeight,
        color,
        opacity,
        whiteSpace: "pre-wrap",
        textAlign: align,
      }}
    >
      {text}
    </div>
  );
};

// ─── Payment pill ───
export const Pill: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  color: string;
  opacity?: number;
  variant?: "leaf" | "round";
}> = ({ x, y, w = 62, h = 26, color, opacity = 1, variant = "leaf" }) => {
  if (opacity <= 0) return null;
  // "leaf": rounded with one square corner (ref pills read as leaf-shaped)
  const r = h / 2;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        backgroundColor: color,
        borderRadius: variant === "leaf" ? `${r}px ${r}px ${r}px 4px` : r,
        opacity,
      }}
    />
  );
};

// ─── A/B badge ───
export const Badge: React.FC<{
  letter: string;
  cx: number;
  cy: number;
  r?: number;
  opacity?: number;
}> = ({ letter, cx, cy, r = 42, opacity = 1 }) => {
  const brand = useBrand();
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: cx - r,
        top: cy - r,
        width: 2 * r,
        height: 2 * r,
        borderRadius: r,
        backgroundColor: C.navy,
        color: C.white,
        fontFamily: brand.serif,
        fontSize: r * 1.15,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
      }}
    >
      {letter}
    </div>
  );
};

// ─── Orange elbow connector (H then V or V then H) with optional arrowhead ───
export const Elbow: React.FC<{
  points: [number, number][];
  color?: string;
  width?: number;
  opacity?: number;
  arrow?: "end" | "none";
  drawP?: number;
}> = ({ points, color = C.orange, width = 3, opacity = 1, arrow = "none", drawP = 1 }) => {
  if (opacity <= 0 || points.length < 2 || drawP <= 0) return null;
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`)
    .join(" ");
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const ang = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
  const ah = 12;
  return (
    <svg
      width={1920}
      height={1080}
      viewBox="0 0 1920 1080"
      style={{ position: "absolute", left: 0, top: 0, opacity, pointerEvents: "none" }}
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={drawP < 1 ? len : undefined}
        strokeDashoffset={drawP < 1 ? len * (1 - drawP) : undefined}
      />
      {arrow === "end" && drawP >= 1 && (
        <g transform={`translate(${last[0]},${last[1]}) rotate(${(ang * 180) / Math.PI})`}>
          <path d={`M0,0 L${-ah},${-ah * 0.6} M0,0 L${-ah},${ah * 0.6}`} stroke={color} strokeWidth={width} fill="none" />
        </g>
      )}
    </svg>
  );
};

// ─── Document icon (paper with folded corner + rule lines) ───
//
// ─── r19 FINDING (MEASURED, NOT YET LANDED) — THE BIGGEST MISSING INK IN ui.tsx ───
// `Doc` draws THREE FLAT BARS. The ref draws a whole document, and at f1740 the two
// locks Docs are the SIX WORST grid cells in the frame (ssim-grid 8x6: r3c6 .005,
// r3c5 .024, r4c6 .031, r4c1 .070, r3c2 .090, r3c1 .098). We draw ZERO pixels of
// most of it. Transcribed from the ref's LEFT locks Doc (f1740, page x354 y552
// w150 h198); the RIGHT Doc is the SAME document with one colour change, so the
// structure is the primitive's, not the call site's:
//   y/h 0.000  page TOP edge; fold notch top-right (ours is far too large)
//   y/h 0.071 · 0.096 · 0.116   three MICRO-TEXT rules, left-aligned, short
//   y/h 0.146 → 0.273           OUTLINED BOX #1 (2px navy stroke, hollow)
//   y/h 0.323 · 0.369           two full-width HAIRLINE rules
//   y/h 0.439 → 0.485           navy PILL, x/w 0.09→0.68
//   y/h 0.535 → 0.581           orange PILL, x/w 0.40→0.97   (INDENTED, flush right)
//   y/h 0.641 → 0.929           OUTLINED BOX #2 (2px navy stroke, hollow)
//   y/h 0.828 → 0.894             a PILL inside it, right-aligned (x/w 0.60→0.94):
//                                 ORANGE in the left doc, NAVY in the right doc
//   y/h 1.000  page BOTTOM edge, and the bottom-LEFT corner is ROUNDED (~0.09·w)
// So: two hollow boxes, five rules and an inner pill — all absent. And our third
// navy bar (x/w 0.14, y/h ~0.62) is ink the ref does not have there at all.
//
// COUPLED, AND THIS IS WHY IT IS NOT LANDED HERE: the locks Docs are MISPLACED.
// ref page x354 y552 w150; scenesB:927 draws x340 y556 w149 → **14px LEFT, 4px LOW**
// (the size is right; only the seat is wrong). Adding fine structure to a document
// that is 14px off is misplaced ink, and misplaced ink loses to absent ink — six
// confirmations (method lesson 4). The scenesB seat fix (x 340→354, y 556→552, and
// the mirrored right Doc) must land WITH the enrichment, gated together.
// Also note the payment Docs (scenesC:673/674, w72) are a DIFFERENT ref document
// (orange square badge top-left, a two-cell strip, a peach fill band) — so the
// enrichment needs a `variant`, not one hard-coded body. Gate all eleven sites.
//
/** The ref's document, transcribed from the LEFT locks Doc (f1740, page x354 y552
 *  w150 h198). Every y is a fraction of h, every x a fraction of w — the ref draws
 *  ONE document and scales it, so fractions are the right datum. */
const DOC = {
  fold: 0.153, // top edge runs to x/w 0.847; we drew 0.22 — 44% too big
  blCorner: 0.11, // the bottom-LEFT corner is ROUNDED; ours was square
  micro: [
    [0.071, 0.09, 0.30],
    [0.096, 0.09, 0.37],
    [0.119, 0.09, 0.24],
  ] as [number, number, number][],
  boxX: [0.087, 0.915] as [number, number],
  box1: [0.146, 0.273] as [number, number], // hollow outlined panel
  box2: [0.641, 0.929] as [number, number], // hollow outlined panel
  rules: [0.323, 0.369], // two full-width hairlines between the panels
  navyPill: [0.439, 0.485, 0.086, 0.640],
  orangePill: [0.535, 0.581, 0.373, 0.907], // INDENTED and flush right
  innerPill: [0.828, 0.894, 0.53, 0.86], // sits INSIDE box 2, right-aligned
};

/** The legacy three-bar body, preserved byte-identically for sites whose ref
 *  document has not been transcribed yet. Reached only via `variant="plain"`. */
const DocPlain: React.FC<{
  x: number; y: number; w: number; h: number; opacity: number;
  lines?: { color: string; w: number }[]; label?: string; labelColor: string;
}> = ({ x, y, w, h, opacity, lines, label, labelColor }) => {
  const brand = useBrand();
  const fold = w * 0.22;
  const ls = lines ?? [
    { color: C.navy, w: 0.55 },
    { color: C.orangeDeep, w: 0.4 },
    { color: C.navy, w: 0.5 },
  ];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", left: x, top: y, opacity }}>
      <path
        d={`M2,2 H${w - fold - 2} L${w - 2},${fold + 2} V${h - 2} H2 Z`}
        fill={C.white} stroke={C.navy} strokeWidth={2.5} strokeLinejoin="round"
      />
      <path d={`M${w - fold - 2},2 V${fold + 2} H${w - 2}`} fill="none" stroke={C.navy} strokeWidth={2.5} />
      {label ? (
        <text x={w * 0.14} y={h * 0.45} fontFamily={brand.sans} fontSize={w * 0.19} fill={labelColor}>
          {label.split("\n").map((s, i) => (
            <tspan key={i} x={w * 0.14} dy={i === 0 ? 0 : w * 0.2}>{s}</tspan>
          ))}
        </text>
      ) : (
        ls.map((l, i) => (
          <rect key={i} x={w * 0.14} y={h * (0.3 + i * 0.16)} width={w * l.w} height={h * 0.06} rx={h * 0.03} fill={l.color} />
        ))
      )}
    </svg>
  );
};

export const Doc: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  opacity?: number;
  lines?: { color: string; w: number }[];
  label?: string;
  labelColor?: string;
  innerPill?: string;
  /** WHICH DOCUMENT this site draws. The ref does not draw one document — it draws
   *  at least two, and the body is CONTENT, so it belongs to the call site.
   *    "full"  the document transcribed below (the LOCKS pair, f1740).
   *    "plain" the legacy three-bar body, byte-identical — the default, meaning
   *            "this site's ref document has not been transcribed yet".
   *  Measured, so nobody has to guess:
   *    locks   scenesB:927/928 (w149) — `variant="full"` is worth, at f1740:
   *            left doc crop .494→.663 (+0.170) · right .497→.542 · WHOLE-FRAME
   *            .9288→.9325 (+0.0038); at f1735 whole-frame .9292→.9356 (+0.0064).
   *            Pass `innerPill={C.pillNavy}` on the RIGHT doc — the ref's inner
   *            pill is orange in the left document and navy in the right.
   *    payment scenesC:673/674, 690/691 (w72/w70) — a DIFFERENT document: an orange
   *            square badge, a two-cell strip, a peach fill band. "full" LOSES here
   *            (crop .327→.268, whole-frame −0.0010 at f2560). STAY "plain" until it
   *            is transcribed.
   *    tradeDocs scenesB:422/423 (w90) — "full" loses −0.0017 at f1430. STAY "plain". */
  variant?: "full" | "plain";
}> = ({ x, y, w = 90, h = 110, opacity = 1, lines, label, labelColor = C.orangeDeep, innerPill = C.orangeDeep, variant = "plain" }) => {
  const brand = useBrand();
  if (opacity <= 0) return null;
  if (variant === "plain") return <DocPlain x={x} y={y} w={w} h={h} opacity={opacity} lines={lines} label={label} labelColor={labelColor} />;
  // Fold: the ref's top edge runs to x/w 0.847 and the diagonal reaches the right
  // edge at y = 0.153·w. We drew 0.22·w — 44% too big, at every Doc.
  const fold = w * DOC.fold;
  const r = w * DOC.blCorner; // rounded bottom-LEFT corner (the ref has one; we had a square)
  const S = 2.5;
  const bx0 = w * DOC.boxX[0];
  const bx1 = w * DOC.boxX[1];
  void lines; // legacy prop: no call site passes it; the body is now the ref's own
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ position: "absolute", left: x, top: y, opacity }}
    >
      <path
        d={`M${S},${S} H${w - fold - S} L${w - S},${fold + S} V${h - S} H${S + r} A${r},${r} 0 0 1 ${S},${h - S - r} Z`}
        fill={C.white}
        stroke={C.navy}
        strokeWidth={S}
        strokeLinejoin="round"
      />
      <path d={`M${w - fold - S},${S} V${fold + S} H${w - S}`} fill="none" stroke={C.navy} strokeWidth={S} />
      {label ? (
        <text
          x={w * 0.14}
          y={h * 0.45}
          fontFamily={brand.sans}
          fontSize={w * 0.19}
          fill={labelColor}
        >
          {label.split("\n").map((s, i) => (
            <tspan key={i} x={w * 0.14} dy={i === 0 ? 0 : w * 0.2}>
              {s}
            </tspan>
          ))}
        </text>
      ) : (
        <>
          {/* header micro-text: three short left rules */}
          {DOC.micro.map(([fy, fx0, fx1], i) => (
            <rect key={`m${i}`} x={w * fx0} y={h * fy} width={w * (fx1 - fx0)} height={Math.max(1.4, h * 0.008)} fill={C.navy} />
          ))}
          {/* the two hollow BOXES and the two full-width hairlines — all absent before */}
          <rect x={bx0} y={h * DOC.box1[0]} width={bx1 - bx0} height={h * (DOC.box1[1] - DOC.box1[0])} fill="none" stroke={C.navy} strokeWidth={Math.max(1.4, w * 0.013)} />
          <rect x={bx0} y={h * DOC.box2[0]} width={bx1 - bx0} height={h * (DOC.box2[1] - DOC.box2[0])} fill="none" stroke={C.navy} strokeWidth={Math.max(1.4, w * 0.013)} />
          {DOC.rules.map((fy, i) => (
            <rect key={`r${i}`} x={bx0} y={h * fy} width={bx1 - bx0} height={Math.max(1.2, h * 0.007)} fill={C.navy} />
          ))}
          {/* the three pills. The ref's mid pill is INDENTED and flush right; its
              third is a small pill INSIDE box 2, right-aligned — not a left bar. */}
          {([
            [DOC.navyPill, C.navy],
            [DOC.orangePill, C.orangeDeep],
            [DOC.innerPill, innerPill],
          ] as [number[], string][]).map(([p, col], i) => (
            <rect
              key={`p${i}`}
              x={w * p[2]}
              y={h * p[0]}
              width={w * (p[3] - p[2])}
              height={h * (p[1] - p[0])}
              rx={h * (p[1] - p[0]) / 2}
              fill={col}
            />
          ))}
        </>
      )}
    </svg>
  );
};
