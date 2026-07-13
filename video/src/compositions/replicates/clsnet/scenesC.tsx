import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { C, CIRCLE, LEDGE, MAP, MOS, REPORT, SEG, STRIP2, ENDCARD } from "./data";
import { clamp } from "./ui";
import { useBrand, useCopy } from "./brand";
import { TracedArt } from "./TracedArt";
import { Badge, ClsNetBox, Doc, Elbow, Pill, SansText, SerifLabel, lerp } from "./ui";
import { TitleCard } from "./scenesA";
import { GANTT_PAGE_DY, SmallHex, stripPushY } from "./scenesB";

const PILL_COL: Record<string, string> = {
  lavender: C.lavender,
  tan: C.tan,
  orangeDeep: C.orangeDeep,
};

// ═══ Scene 16: gantt cascade (f2127-2324) ═══
// Measured: page rides up from below 2129-2143 (bracket at screen y≈892 at
// f2133), rows cascade 2145+i*3.2, detail card 2240-2266, dissolves BACK into
// the gantt 2279-2291, full gantt holds to 2303, then the whole panel shrinks
// into a document (fr_2312 mid, settled fr_2330) while the CLSNet box slides in.
//
// r18 TRANSCRIPTION. The gantt page is pixel-identical in the ref across
// f2178..f2288 (row0 pill/label byte-stable at every probed frame) — so its
// geometry is TRANSCRIBED, not fitted. Every number below is a scan of
// work/clsnet/r18/vf/v_2178.png (full gantt, no card, no shrink) or v_2240.png
// (settled detail card). The old GANTT.rows / GANTT.ruler / DETAIL values in
// data.ts are measurably wrong (rows drift up to 39px left and are 5-20px
// narrow; ruler 19px right and 11px short; labels 22% small) — left in place
// because sibling agents hold data.ts this round; the truth lives here.
// lx/ly = the label's transcribed left and its cap-top offset above the pill top
// (they are NOT uniform — row 2 sits 8px down, row 8 fifteen).
const G_ROWS = [
  { x: 205, y: 175, w: 142, lx: 380, ly: 10, color: "lavender" },
  { x: 242, y: 274, w: 389, lx: 666, ly: 10, color: "lavender" },
  { x: 505, y: 377, w: 175, lx: 721, ly: 8, color: "tan" },
  { x: 606, y: 469, w: 224, lx: 860, ly: 11, color: "orangeDeep" },
  { x: 739, y: 554, w: 355, lx: 1122, ly: 10, color: "lavender" },
  { x: 981, y: 634, w: 175, lx: 1185, ly: 9, color: "orangeDeep" },
  { x: 1008, y: 723, w: 355, lx: 1396, ly: 11, color: "lavender" },
  { x: 1244, y: 815, w: 184, lx: 1449, ly: 10, color: "tan" },
  { x: 1352, y: 900, w: 123, lx: 1504, ly: 15, color: "orangeDeep" },
] as const;
const G_PILL_H = 51; // measured fills 48-53, mean 50.6
// ═══ THE ROW ENTRY — one curve, nine starts ═══════════════════════════════════
// Tracked per frame f2140-2172 (outline-band tops, all nine rows). The settled y's
// above are confirmed exact to the pixel; the ENTRY was pure fiction. Every row
// flies up from below on the SAME decelerating curve, and the nine offset columns
// are the SAME sequence shifted in time — 796·646·379·231·154·105·71·47·30·17·8·3·0,
// reproducing all nine tracks to ≤2px. Only the spawn frame differs. They do NOT
// fade: the pill's fill reads (171,179,203) at f2140 and at f2178 — identical. We
// were fading nine pills up at their settled positions over 5 frames, so at f2145
// we drew NOTHING while the ref had two rows on screen in mid-flight.
const ROW_START = [2140, 2142, 2146, 2148, 2149, 2150, 2151, 2152, 2153];
const ROW_D = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const ROW_DY = [796, 646, 379, 231, 154, 105, 71, 47, 30, 17, 8, 3, 0];
const rowEntryDy = (f: number, i: number) =>
  f < ROW_START[i] ? null : interpolate(f - ROW_START[i], ROW_D, ROW_DY, clamp);
const G_LABEL_FS = 36; // ref cap-height 27 (ours was 21 at fs28)
// SansText(lineHeight 1.15) puts the cap-top fs*0.179 below its `y`.
const G_CAP_OFF = G_LABEL_FS * 0.179;
// ruler bracket — every number sub-pixel, coverage-integrated off v_2178.
// (Instrument note: a coverage centroid computed over pixel INDICES sits half a
// pixel below the truth — pixel i covers [i, i+1). Every value here is corrected.)
//   stroke   4.30 (bar thickness 4.26/4.30/4.29/4.29 at four clear x; drop widths
//            4.25-4.40). We drew 3 — 30% thin, over the ~190 frames it is on screen.
//   barY     90.4 (bar centroid, identical at all four x)
//   drops    centres 193.0 → 1679.0, pitch 247.667. With THAT anchor, even spacing
//            reproduces all five interior centroids to 0.02px (440.67/688.33/936.00/
//            1183.67/1431.33 predicted vs 440.68/688.33/936.02/1183.68/1431.31
//            measured). The end drops read 0.36px inward of it because the bar's
//            miter corner adds ink on their outer side. Old x191/pitch-248: 2px left.
//   dropY    135.4 (butt caps: the painted bottom IS the path endpoint)
const G_RULER = { x: 193, w: 1486, barY: 90.4, dropY: 135.4, sw: 4.3 };
// detail card (v_2240 scan): outer 536,270,760,666; 5px WHITE border; corners
// DIAGONAL — TL+BR r30, TR+BL square (the house motif, cf. the r17 reportCard).
// Row separators are WHITE 5px bands spanning the FULL card width (we drew them
// navy, 1.5px, inset 30px each side — a contrast inversion over 24% of the
// frame, and the whole reason this window sat at 0.87).
const D_CARD = { x: 536, y: 270, w: 760, h: 666, r: 30, bw: 5 };
const D_RULES = [131, 251, 376, 498]; // y rel to card top (abs 401/521/646/768)
const D_VRULE = { x: 324, y: 50, h: 581 }; // abs x860-864, y320-900
const D_FS = 37; // measured from four strings: 36.9 (we drew 30)
const D_LABEL_X = 39; // div left rel to card (abs 575)
const D_VALUE_X = 369; // abs 905 — we drew 885, 20px left of the ref
// cap-tops abs 337/458/582/705/831; a plain div (line-height normal) puts the
// cap-top fs*0.2333 below its `top`.
const D_CAP_TOPS = [67, 188, 312, 435, 561];
const D_TEXT_DY = -D_FS * 0.2333;
// the grid draws itself in over 2196-2208 (rules wipe L→R, verticals top→down,
// horizontals staggered 2f apart) — one shared eased clock, measured to the px.
const D_DRAW = (f: number, at: number) =>
  interpolate(f - at, [0, 2, 4, 6, 8, 10, 12], [0, 0.19, 0.66, 0.89, 0.96, 0.99, 1], clamp);

// ═══ THE REPORT TABLEAU — one rigid object (f2303-2334) ═══════════════════
// r18 TAIL. The gantt page does not "shrink into a doc while a box slides in
// from the right". The left document, the mini gantt panel inside it, the right
// document, the ClsNetBox, the two orange verticals and the two orange stubs are
// ONE object, arriving as a single uniform SCALE of the settled report about a
// fixed pivot. Solved by least squares on every navy blob the ref shows across
// f2312-2334 (docL, docR, box, panel): pivot (374.8, 534.3), RMS 1.24px. It then
// reproduces, to ≤2px and with no free parameters, things it was never fitted on:
// the doc's right edge entering at f2304, its left edge at f2311, its top edge
// crossing y=0 at exactly f2315, the box's first sliver at f2313, docR's left
// edge at f2321, the left orange vertical appearing at f2316, and the length of
// every orange stub at every frame. It is the ref's own transform.
//
// The old code had four separate invented clocks here — a doc that fades in over
// 2306-2311 and lands SETTLED by 2315, hand-keyed box slides, an orange stub from
// the box to the screen edge, and a docR that fades up in place — so from f2315
// to f2333 we drew a fully-settled report while the ref was still 2.5× oversized
// and converging. That is the whole f2306-2333 defect (f2313 0.834, f2316 0.842).
const T_PIV = { x: 374.8, y: 534.3 };
// s(f): doc-bbox width / 254, transcribed frame by frame (the ref is not eased —
// it is hand-animated, and only a per-frame table reproduces it).
const T_SF = [
  2303, 2304, 2305, 2306, 2307, 2308, 2309, 2310, 2311, 2312, 2313, 2314, 2315, 2316, 2317, 2318,
  2319, 2320, 2321, 2322, 2323, 2324, 2325, 2326, 2327, 2328, 2329, 2330, 2331, 2332, 2333,
];
const T_SS = [
  9.2, 8.54, 8.36, 8.14, 7.86, 7.51, 7.02, 6.3, 5.2, 4.1, 3.378, 2.89, 2.535, 2.264, 2.043, 1.862,
  1.713, 1.59, 1.48, 1.39, 1.315, 1.252, 1.193, 1.146, 1.106, 1.075, 1.051, 1.031, 1.016, 1.008, 1,
];
const tScale = (f: number) => interpolate(f, T_SF, T_SS, clamp);
// SETTLED report, transcribed from the ref's frozen f2334-2348 bboxes. These
// supersede REPORT.docL/docR/vertLx/vertRx/horizY (measurably wrong: docR sat
// 34px right of the ref, both docs 12px wide and 6px tall, the stubs 8-27px out).
// docL/docR are the SVG boxes; the drawn navy outline insets to (307,322,254,335)
// and (1358,322,254,335) — exactly what the ref shows.
const RT = {
  docL: { x: 305, y: 320, w: 258, h: 339 },
  docR: { x: 1356, y: 320, w: 258, h: 339 },
  docTop: 322, // navy top edge of both docs = where the orange verticals stop
  vertLx: 357.5,
  vertRx: 1548,
  horizY: 547.5,
  stubL: [562, 688] as const, // stops 107px short of the box — the ref leaves the gap
  stubR: [1218, 1358] as const,
};
// the doc as the ref draws it during the shrink: outline + fold + two header
// rules + the orange pill. No mesh, no scatter dots, no fill (the navy page is
// inside it), and no fade — it arrives by geometry alone.
const DocOutline: React.FC<{ x: number; y: number; w: number; h: number }> = ({ x, y, w, h }) => (
  <svg width={w} height={h} viewBox="0 0 270 345" preserveAspectRatio="none" style={{ position: "absolute", left: x, top: y }}>
    <path d="M4,4 H206 L266,64 V341 H44 Q4,341 4,301 Z" fill="none" stroke={C.navy} strokeWidth={4} strokeLinejoin="round" />
    <path d="M206,4 V64 H266" fill="none" stroke={C.navy} strokeWidth={4} />
    <rect x={24} y={22} width={62} height={6} fill={C.navy} />
    <rect x={24} y={36} width={40} height={5} fill={C.navy} />
    <rect x={177} y={293} width={67} height={22} rx={8} fill={C.orangeDeep} />
  </svg>
);

export const GanttScene: React.FC<{ frame: number }> = ({ frame }) => {
  const COPY = useCopy();
  const f = frame;
  if (f < 2129 || f >= 2324) return null;
  // THE PAGE DOES NOT RIDE IN. It is nailed to the strip, 1090px below the
  // band's top edge, and the two leave together as one rigid object — see
  // scenesB's stripPushY, where the law is derived and cross-proven on two
  // tracers. Transcribed off the ref's own white ruler bar (barTop − 88):
  // 973@2132 · 893@2133 · 725@2134 · 366@2135 · 198@2136 · 118@2137 · 0@2143.
  // Our old t^1.4 crawl sat up to 470px low AND disagreed with the strip's push,
  // which is what tore the white slit open at f2130.
  const pageY = GANTT_PAGE_DY + stripPushY(f);
  // The bracket is not wiped in. The ref shows the bar FULL WIDTH (x191-1679)
  // with both end drops at full 47px length on the very first frame it is
  // visible (f2134) — the dash-wipe drew a bar 250px short at f2134 and then,
  // worse, five INTERIOR drops from f2137 that the ref does not have yet. Those
  // grow separately, from nothing at f2142 to full at f2155 (measured per frame
  // at all five x's — they are identical to the pixel, one shared clock).
  // growth = ink mass below the bar at the five drop cores, normalised against the
  // settled frame (identical at all five to ≤0.5px — one shared clock, transcribed)
  const interiorDropY = interpolate(
    f,
    [2142, 2143, 2144, 2145, 2146, 2147, 2148, 2149, 2150, 2151],
    [92.55, 94.3, 97.9, 105.4, 119.3, 126.7, 130.6, 132.7, 134, G_RULER.dropY],
    clamp,
  );
  // THE WEDGE. The rows below the card are not faded out and back in — the card
  // SHOVES them down as one rigid block and rows 3-8 simply ride off the bottom
  // of the screen. Blob-tracked per frame: every one of rows 2..8 carries the
  // SAME dy to the pixel (e.g. f2190: 42/42/42/42/43/43/42), and row 2 lands at
  // 377+628 = 1005, which is exactly where the PO1I pill sits under the card.
  // The return is the same block riding back up. We were fading seven pills in
  // and out at their settled positions — misplaced ink for ~20 frames at each
  // end, and the reason f2190 sat at 0.81 and f2288 at 0.79.
  const wedgeDy = interpolate(
    f,
    [2187, 2188, 2189, 2190, 2191, 2192, 2193, 2194, 2195, 2196, 2197, 2283, 2284, 2285, 2286, 2287, 2288, 2289, 2290, 2291, 2292, 2293, 2294],
    [0, 3, 15, 42, 102, 314, 526, 586, 613, 625, 628, 628, 625, 616, 595, 554, 453, 174, 74, 33, 13, 3, 0],
    clamp,
  );
  // row 1 alone does not ride the wedge: it blinks out at f2181 (before the card
  // even starts) and back at f2292, in place.
  const row1Op = Math.min(1, lerp(f, [2179, 2182], [1, 0]) + lerp(f, [2290, 2293], [0, 1]));
  // shrink-into-doc: the full gantt page becomes the mini panel inside the left
  // doc. Origin-scale toward the panel's SETTLED rect — and the settled rect is
  // (337,478,201,112), not data.ts's (340,470,205,120): the ref's frozen f2334-48
  // frames say so. With the true target, x=337·sp, y=478·sp, w=1920−1719·sp,
  // h=1080−968·sp reproduces the measured panel bbox to ≤3px at EVERY frame of
  // the shrink — so sp is transcribed from those bboxes, one key per frame.
  // The old curve reached sp=1 at f2315; the ref does not get there until f2333.
  // Eighteen frames of a fully-shrunk page while the ref was still 2.5× oversized.
  const sp = interpolate(
    f,
    [
      2289, 2290, 2291, 2292, 2293, 2294, 2295, 2296, 2297, 2298, 2299, 2300, 2301, 2302, 2303,
      2304, 2305, 2306, 2307, 2308, 2309, 2310, 2311, 2312, 2313, 2314, 2315, 2316, 2317, 2318,
      2319, 2320, 2321, 2322, 2323,
    ],
    [
      0, 0.002, 0.0023, 0.0047, 0.0064, 0.0097, 0.0136, 0.0182, 0.0234, 0.0298, 0.0381, 0.0475,
      0.0576, 0.071, 0.0858, 0.1033, 0.1249, 0.1508, 0.184, 0.2258, 0.2828, 0.3688, 0.5006, 0.6321,
      0.7179, 0.7765, 0.8186, 0.8499, 0.8766, 0.8978, 0.915, 0.9299, 0.943, 0.954, 0.9627,
    ],
    clamp,
  );
  const R = {
    x: 337 * sp,
    y: 478 * sp + pageY,
    w: 1920 - 1719 * sp,
    h: 1080 - 968 * sp,
  };
  const s = tScale(f);
  return (
    <AbsoluteFill>
      {/* white ground appears behind the shrinking panel */}
      {sp > 0 && <div style={{ position: "absolute", inset: 0, backgroundColor: C.white }} />}
      {/* navy page (shrinks to the doc's mini panel) */}
      <div
        style={{
          position: "absolute",
          left: R.x,
          top: R.y,
          width: R.w,
          height: R.h,
          backgroundColor: C.navy,
          borderRadius: 14 * sp,
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${R.w / 1920}, ${R.h / 1080})`, transformOrigin: "0 0" }}>
      {/* the bracket: bar + both end drops, WHOLE from the first frame it is
          visible (ref f2134: full width x191-1679, both drops at full 47px). The
          old dash-wipe drew a bar 250px short at f2134 and then five interior
          drops from f2137 that the ref does not grow until f2143. */}
      <svg width={1920} height={150} style={{ position: "absolute", top: 0, left: 0 }}>
        <path
          d={`M${G_RULER.x},${G_RULER.dropY} V${G_RULER.barY} H${G_RULER.x + G_RULER.w} V${G_RULER.dropY}${
            interiorDropY > 92.6
              ? " " +
                Array.from(
                  { length: 5 },
                  (_, i) => `M${G_RULER.x + ((i + 1) * G_RULER.w) / 6},${G_RULER.barY} V${interiorDropY}`,
                ).join(" ")
              : ""
          }`}
          fill="none"
          stroke={C.white}
          strokeWidth={G_RULER.sw}
        />
      </svg>
      {/* rows */}
      {G_ROWS.map((r, i) => {
        // THE ROWS SLIDE. They do not fade in at their settled y — each one flies
        // up from below and DECELERATES into place. We faded nine pills in on the
        // spot (2145 + i·3.2, 5f ramp) and so drew nothing at all at f2145 while
        // the ref already had two rows on screen, mid-flight.
        const dy = rowEntryDy(f, i);
        if (dy === null) return null; // not spawned yet
        // row 0 is pinned above the card; row 1 blinks; rows 2-8 ride the wedge
        // (row 2 = PO1I ends up under the card at 1005; 3-8 leave the screen).
        const rowOp = i === 1 ? row1Op : 1;
        if (rowOp <= 0) return null;
        const y = (i === 0 || i === 1 ? r.y : r.y + wedgeDy) + dy;
        if (y > 1080) return null;
        return (
          // width:1920 so the absolutely-positioned label has a real containing
          // block — without it the wrapper is shrink-to-fit ZERO and any label
          // with a break opportunity wraps to one glyph per line (the CLSNet ids
          // have none, so it never showed; the CRX brand's hyphenated RFQ ids
          // shattered into four lines).
          <div key={i} style={{ position: "absolute", left: 0, top: 0, width: 1920, opacity: rowOp }}>
            <Pill x={r.x - 4} y={y - 4} w={r.w + 8} h={G_PILL_H + 8} color={C.white} />
            <Pill x={r.x} y={y} w={r.w} h={G_PILL_H} color={PILL_COL[r.color]} />
            <SansText text={COPY.ganttIds[i]} x={r.lx} y={y + r.ly - G_CAP_OFF} fs={G_LABEL_FS} color={C.white} />
          </div>
        );
      })}
      {/* footnote rules bottom-left: PRE-DETAIL ONLY. The ref shows them
          f2166-2188, the detail card covers them, and they NEVER return — probed
          navy(absent) at f2280/f2300 (the f2312 white there is the shrinking
          panel's white ground, not a rule). The old `(1 - detailP)` factor made
          them REAPPEAR across the 2279-2303 restore (detailP falls back to 0),
          painting white lines the ref lacks — the dominant f2300 defect (0.817,
          the window's worst frame). Fade out with the card grow, stay gone. */}
      <div style={{ position: "absolute", left: 193, top: 971, width: 530, height: 2, backgroundColor: C.white, opacity: lerp(f, [2188, 2196], [1, 0]) * lerp(f, [2166, 2172], [0, 1]) }} />
      <div style={{ position: "absolute", left: 192, top: 1010, width: 395, height: 2, backgroundColor: C.white, opacity: lerp(f, [2188, 2196], [1, 0]) * lerp(f, [2170, 2176], [0, 1]) }} />
      {/* detail card. The ref grows it out of the TOP-LEFT corner (top edge
          pinned at y270 and left edge at x536 from f2184 on — a center-scale is
          measurably wrong ink), draws the white grid in over 2196-2208, cascades
          the field text, then COLLAPSES the card back to that corner over
          2283-2290 (it does not fade — a fade leaves a translucent full-size
          ghost for nine frames the ref never shows). Grow/collapse both scanned
          per frame from the card's own white border. */}
      {f >= 2184 && f < 2290 && <DetailCard f={f} />}
        </div>
      </div>
      {/* The report tableau arrives as ONE scaled group. Everything in here is at
          its SETTLED position; the wrapper's scale about the pivot is the entire
          animation — no per-element clocks, no fades. It also scales the strokes,
          which is what the ref does (its doc outline is ~50px thick at f2306 and
          5px at rest). Off-screen at f<2304 by geometry: at s=9.2 the doc's right
          edge sits at x=2088 and the box at x=4241. */}
      {f >= 2303 && (
        <div style={{ position: "absolute", inset: 0, transform: `scale(${s})`, transformOrigin: `${T_PIV.x}px ${T_PIV.y}px` }}>
          <Elbow points={[[RT.vertLx, 0], [RT.vertLx, RT.docTop]]} />
          <Elbow points={[[RT.vertRx, 0], [RT.vertRx, RT.docTop]]} />
          <Elbow points={[[RT.stubL[0], RT.horizY], [RT.stubL[1], RT.horizY]]} />
          <Elbow points={[[RT.stubR[0], RT.horizY], [RT.stubR[1], RT.horizY]]} />
          <DocOutline {...RT.docL} />
          <DocOutline {...RT.docR} />
          <ClsNetBox x={REPORT.box.x} y={REPORT.box.y} w={REPORT.box.w} />
        </div>
      )}
    </AbsoluteFill>
  );
};

const DetailCard: React.FC<{ f: number }> = ({ f }) => {
  const COPY = useCopy();
  const { sans: SANS } = useBrand();
  // grow (top-left anchored, scanned from the card's own white border):
  //   width full by 2186 · height 62px@2186 · 103@2190 · 364@2192 · 625@2194 · 666@2198
  // collapse (same corner): w 760/746/710/617/483 and h 666/-/625/540/373 at
  //   2283/2284/2285/2286/2287 → gone by 2290, one frame before the rows return.
  const sx = interpolate(f, [2183, 2184, 2186, 2283, 2285, 2287, 2289, 2290], [0.3, 0.925, 1, 1, 0.934, 0.636, 0.28, 0], clamp);
  const sy = interpolate(
    f,
    [2184, 2186, 2188, 2190, 2192, 2194, 2196, 2198, 2283, 2285, 2287, 2289, 2290],
    [0.02, 0.093, 0.098, 0.155, 0.547, 0.938, 0.995, 1, 1, 0.938, 0.56, 0.06, 0],
    clamp,
  );
  if (sx <= 0 || sy <= 0) return null;
  // the grid retracts (bottom rule first) a few frames ahead of the collapse
  const gridOut = (i: number) => lerp(f, [2280 - i * 1.3, 2288 - i * 1.3], [1, 0]);
  return (
    <div
      style={{
        position: "absolute",
        left: D_CARD.x,
        top: D_CARD.y,
        width: D_CARD.w,
        height: D_CARD.h,
        borderRadius: `${D_CARD.r}px 0 ${D_CARD.r}px 0`,
        backgroundColor: C.white,
        transform: `scale(${sx}, ${sy})`,
        transformOrigin: "0 0",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: D_CARD.bw,
          borderRadius: `${D_CARD.r - D_CARD.bw}px 0 ${D_CARD.r - D_CARD.bw}px 0`,
          backgroundColor: C.lavender,
        }}
      />
      {/* white grid: 4 full-width rules + 1 vertical, drawn in 2196-2208 */}
      {D_RULES.map((ry, i) => {
        const p = D_DRAW(f, 2196 + i * 2) * gridOut(3 - i);
        if (p <= 0) return null;
        return (
          <div
            key={ry}
            style={{
              position: "absolute",
              left: 0,
              top: ry,
              width: D_CARD.w * p,
              height: D_CARD.bw,
              backgroundColor: C.white,
            }}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          left: D_VRULE.x,
          top: D_VRULE.y,
          width: D_CARD.bw,
          height: D_VRULE.h * D_DRAW(f, 2196) * lerp(f, [2282, 2288], [1, 0]),
          backgroundColor: C.white,
        }}
      />
      {COPY.detail.map(([k, v], i) => {
        // labels land 2201+2i..2206+2i, values 2204+2.6i..2213+2.6i; on the way
        // out the card empties bottom-up (row4 gone by 2281, row0 by 2289)
        const out = lerp(f, [2278 + 2 * (4 - i), 2281 + 2 * (4 - i)], [1, 0]);
        const kOp = lerp(f, [2201 + 2 * i, 2206 + 2 * i], [0, 1]) * out;
        const vOp = lerp(f, [2204 + 2.6 * i, 2213 + 2.6 * i], [0, 1]) * out;
        const top = D_CAP_TOPS[i] + D_TEXT_DY;
        return (
          <React.Fragment key={k}>
            <div style={{ position: "absolute", left: D_LABEL_X, top, fontFamily: SANS, fontSize: D_FS, color: C.navy, opacity: kOp }}>{k}</div>
            <div style={{ position: "absolute", left: D_VALUE_X, top, fontFamily: SANS, fontSize: D_FS, color: C.orangeDeep, opacity: vOp }}>{v}</div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ═══ Scene 17: report out of CLSNet (f2324-2412) ═══
// Measured fr_2330 (settled) / fr_2360 (after +125px drift, mesh icons on docs):
// left doc + CLSNet box + right doc, orange verticals from the top edge,
// orange horizontal stubs at y547 between the elements.
// the mesh's edges, flattened once at module scope so the reveal order is fixed
const MESH_NODES = [
  [135, 55], [175, 62], [200, 90], [198, 125], [170, 152], [130, 155], [102, 128], [104, 88], [150, 105],
] as const;
const MESH_EDGES: [number, number, number, number][] = MESH_NODES.flatMap(([mx, my], i) =>
  MESH_NODES.slice(i + 1)
    .filter(([nx, ny]) => Math.hypot(nx - mx, ny - my) <= 78)
    .map(([nx, ny]): [number, number, number, number] => [mx, my, nx, ny]),
);

const ReportDoc: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  pillColor: string;
  meshP: number;
}> = ({ x, y, w, h, pillColor, meshP }) => {
  return (
    <svg width={w} height={h} viewBox="0 0 270 345" style={{ position: "absolute", left: x, top: y }}>
      <path d="M4,4 H206 L266,64 V341 H44 Q4,341 4,301 Z" fill={C.white} stroke={C.navy} strokeWidth={4} strokeLinejoin="round" />
      <path d="M206,4 V64 H266" fill="none" stroke={C.navy} strokeWidth={4} />
      <rect x={24} y={22} width={62} height={6} fill={C.navy} />
      <rect x={24} y={36} width={40} height={5} fill={C.navy} />
      {/* Geodesic mesh. The ref DRAWS it in — solid edge fragments appearing one by
          one over f2329-2348 — it does not fade a whole ghost mesh up, and it draws
          no scatter dots first (probed: the head is bare white at f2328). An opacity
          ramp put a grey haze over the whole head and lost 0.06 on the crop; solid
          sparse edges are what the ref actually shows. Reveal by count. */}
      {meshP > 0 &&
        MESH_EDGES.slice(0, Math.round(meshP * MESH_EDGES.length)).map(([mx, my, nx, ny], i) => (
          <line key={`m${i}`} x1={mx} y1={my} x2={nx} y2={ny} stroke={C.navy} strokeWidth={1.2} />
        ))}
      {/* mini gantt panel */}
      <rect x={40} y={155} width={205} height={120} rx={10} fill={C.navy} />
      <path d={`M58,172 H228 M58,172 V178 M92,172 V178 M126,172 V178 M160,172 V178 M194,172 V178 M228,172 V178`} stroke={C.white} strokeWidth={1.5} fill="none" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect
          key={i}
          x={56 + i * 16}
          y={186 + i * 12}
          width={34}
          height={8}
          rx={3}
          fill={[C.lavender, C.lavender, C.tan, C.orangeDeep][i % 4]}
        />
      ))}
      <rect x={177} y={293} width={67} height={22} rx={8} fill={pillColor} />
    </svg>
  );
};

export const ReportOutScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < 2324 || f >= SEG.handshake[0] + 40) return null;
  // gen10: the ref holds the settled report to ~f2360 then EXITS it f2362-2377
  // (docs slide DOWN + out as the handshake hexes rise) — was held to f2396,
  // the r11 worst window #4 f2352-2402 (report layout lingered vs rising hexes).
  // r18 EXIT. The "+125px drift over 2332-2358" is FICTION. The ref FREEZES the
  // settled report — every navy bbox byte-stable f2334-2348 — and then drops it,
  // accelerating, straight off the bottom: dy 0@2348 · 12@2352 · 76@2358 · 273@2364
  // · 579@2367 · off by 2368. We were 38px low at f2340 and 86px low at f2350 (the
  // whole tableau, the largest ink in the scene) and still only halfway down when
  // the ref had already gone. Box x stays 795 and doc x stays 307 throughout — the
  // fall is purely vertical, and there is no fade: the navy is at full mass in the
  // last frame that shows it. Transcribed per frame from the box's top edge.
  const dy = interpolate(
    f,
    [2348, 2349, 2350, 2351, 2352, 2353, 2354, 2355, 2356, 2357, 2358, 2359, 2360, 2361, 2362, 2363, 2364, 2365, 2366, 2367, 2368],
    [0, 2, 4, 7, 12, 18, 26, 35, 46, 60, 76, 95, 118, 146, 180, 221, 273, 342, 436, 579, 800],
    clamp,
  );
  // hard cut, not a fade — the docs and the box are off the bottom by f2368 and the
  // two orange verticals (which stay pinned to the screen top) are gone by f2369.
  const out = f < 2369 ? 1 : 0;
  if (!out) return <AbsoluteFill style={{ backgroundColor: C.white }} />;
  // the mesh draws itself in over f2329-2348 — keyed off the ref's own navy-pixel
  // count in the doc head (bare at f2328; 38% of final ink at f2334; 75% at f2340;
  // complete by f2348). It was a 2342-2352 opacity fade, so we showed eight invented
  // scatter dots for the whole window and then ghosted a mesh up after the ref's
  // was already finished.
  const meshP = interpolate(f, [2333, 2334, 2338, 2340, 2344, 2348], [0, 0.38, 0.57, 0.75, 0.87, 1], clamp);
  // The tableau is still CONVERGING across the 2324 scene boundary — the ref does
  // not settle it until f2333 (s: 1.252@2324 → 1.075@2328 → 1.0@2333). Same pivot,
  // same table as GanttScene: the two scenes now hand the SAME object to each
  // other instead of each running its own clock. The old code snapped everything
  // to its settled rect at 2324 and faded the right doc up in place — the ref
  // slides it in from the screen edge at f2321 and shrinks it like everything else.
  const s = tScale(f);
  // The verticals are pinned to the SCREEN top and stretch to the doc's top edge,
  // so they can neither be scaled nor translated as a body — they are drawn in
  // screen space off the same transform.
  // and they do not merely stretch as the report falls — they lean INWARD, both
  // tracked frame by frame at y=3: the left rides +0.20·dy (357→516), the right
  // −0.18·dy (1548→1404). Two ratios, constant to 10% across the whole fall.
  const vLx = T_PIV.x + s * (RT.vertLx - T_PIV.x) + 0.2 * dy;
  const vRx = T_PIV.x + s * (RT.vertRx - T_PIV.x) - 0.18 * dy;
  const vBot = T_PIV.y + s * (RT.docTop - T_PIV.y) + dy;
  return (
    <AbsoluteFill style={{ backgroundColor: C.white }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <Elbow points={[[vLx, 0], [vLx, vBot]]} width={3 * s} />
        <Elbow points={[[vRx, 0], [vRx, vBot]]} width={3 * s} />
        <div style={{ position: "absolute", inset: 0, transform: `translateY(${dy}px) scale(${s})`, transformOrigin: `${T_PIV.x}px ${T_PIV.y}px` }}>
          <Elbow points={[[RT.stubL[0], RT.horizY], [RT.stubL[1], RT.horizY]]} />
          <Elbow points={[[RT.stubR[0], RT.horizY], [RT.stubR[1], RT.horizY]]} />
          <ReportDoc {...RT.docL} pillColor={C.orangeDeep} meshP={meshP} />
          <ReportDoc {...RT.docR} pillColor={C.pillNavy} meshP={meshP} />
          <ClsNetBox x={REPORT.box.x} y={REPORT.box.y} w={REPORT.box.w} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ═══ Scene 18: handshake (f2372-2480) ═══
export const HandshakeScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < SEG.handshake[0] || f >= SEG.payment[0] + 16) return null;
  // gen10: the ref exits the report docs ~f2362-2372, then the A/B hexes RISE
  // from below and settle 2372-2392 (measured montage_hsrise: hexes solid, not
  // fading; near-final by ~f2385); the handshake graphic + horizontal arrows
  // form LATER ~2405-2425. Was inOp=lerp[2404,2420] for the WHOLE scene = the
  // report 3-doc layout held f2372-2404 while the ref showed rising hexes (r11
  // worst window #4 f2352-2402). ReportOut's white bg backs us until f2412.
  const bgOp = lerp(f, [2372, 2384], [0, 1]);
  const hexOp = lerp(f, [2370, 2379], [0, 1]);
  const hexRise = lerp(f, [2372, 2392], [210, 0]);
  // ref un-hexes A/B into the two cities-on-a-line by ~f2480 (boundary scan
  // vf 2474/2478/2480): the cities are SOLID at the payment scene's first frame.
  // Was out=[2470,2484] + payment in=[2482,2496] = a crossfade DIP (ghost hexes
  // at f2480, cities only 29% at f2486). Now handshake exits over the SAME
  // window payment enters (2472-2482) so the sum holds ~1 (reads as the un-hex
  // morph) and the cities are solid by 2482.
  const out = lerp(f, [2472, 2482], [1, 0]);
  const graphicOp = lerp(f, [2405, 2420], [0, 1]);
  const arrowP = lerp(f, [2424, 2440], [0, 1]);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: "absolute", inset: 0, backgroundColor: C.white, opacity: bgOp }} />
      <div style={{ position: "absolute", inset: 0, opacity: hexOp, transform: `translateY(${hexRise}px)` }}>
        <SmallHex art="cityA" cx={427} cy={372} w={385} artW={1150} letter="A" />
        <SmallHex art="cityB" cx={1512} cy={755} w={396} artW={1190} letter="B" />
        <Doc x={255} y={510} w={91} h={110} />
        <Doc x={1611} y={900} w={90} h={110} />
      </div>
      {/* handshake graphic + horizontal arrows form later (~2405-2425) */}
      <div style={{ position: "absolute", inset: 0, opacity: graphicOp }}>
        <TracedArt name="handshake" x={715} y={490} />
        <Elbow points={[[1010, 460], [690, 460]]} arrow="end" drawP={arrowP} />
        <Elbow points={[[930, 830], [1245, 830]]} arrow="end" drawP={arrowP} />
      </div>
    </AbsoluteFill>
  );
};

// Full-width hairline with sub-pixel edges: the integer core is one solid box,
// each boundary row is its own 1px div at its measured coverage (Chrome snaps
// painted boxes, so a fractional top/height would otherwise render solid).
const HLine: React.FC<{ top: number; h: number }> = ({ top, h }) => {
  const bot = top + h;
  const c0 = Math.ceil(top);
  const c1 = Math.floor(bot);
  const edge = (y: number, cov: number) =>
    cov > 0.004 ? <div style={{ position: "absolute", left: 0, top: y, width: 1920, height: 1, backgroundColor: C.navy, opacity: cov }} /> : null;
  return (
    <>
      {edge(c0 - 1, c0 - top)}
      {c1 > c0 && <div style={{ position: "absolute", left: 0, top: c0, width: 1920, height: c1 - c0, backgroundColor: C.navy }} />}
      {edge(c1, bot - c1)}
    </>
  );
};

// ═══ Scene 19: payment complete (f2480-2612) ═══
export const PaymentScene: React.FC<{ frame: number }> = ({ frame }) => {
  const COPY = useCopy();
  const f = frame;
  // mount 8f early so the cities crossfade in as the handshake hexes un-hex
  // (kills the f2480 dip — cities solid by 2482 like the ref)
  if (f < SEG.payment[0] - 8 || f >= 2652) return null;
  const inOp = lerp(f, [2472, 2482], [0, 1]);
  // r18: the tableau is whipped off by f2635 and the ref is blank white behind
  // it, so `out` now only governs the horizon line — which does NOT fade, it
  // DESCENDS into Strip2's band. Hand it over at 2640, the frame Strip2 mounts.
  const out = lerp(f, [2639, 2641], [1, 0]);
  const arrOp = lerp(f, [2505, 2518], [0, 1]);
  const belowOp = lerp(f, [2520, 2538], [0, 1]);
  // r5: ref shows the orange return plumbing SOLID by 2560 (was fading in 2556-2580)
  const orangeP = lerp(f, [2532, 2546], [0, 1]);
  // r18 HORIZON. The ref's line is y364-367 (4px, full width) at EVERY frame
  // 2480-2632 — we drew it at 368-370 while the traced cities carry their own
  // baseline at 364-366, so the replica showed a SEVEN-pixel double line across
  // the whole 1920px frame for the entire scene. That full-width misplaced band
  // is why this window sat flat at ~0.888 with no timing spike anywhere in it.
  // It then descends into Strip2, transcribed frame by frame from the ref's own
  // dark rows: 365@2633 · 366@2634 · 367@2635 · 369@2636 · 374@2638 · 381@2640.
  // Sub-pixel: Chrome SNAPS a painted box to whole device pixels, so the ref's
  // partial edge rows (coverage 0.77/0.98/0.96/0.75) are painted as their own
  // 1px divs at the measured alpha — line = top 364.23, height 3.52.
  const lineY = interpolate(f, [2632, 2633, 2634, 2635, 2636, 2638, 2640], [364.2, 365.2, 366.2, 367.2, 369.0, 374.2, 381.15], clamp);
  // r15: the ref does NOT hold this layout static — it whip-scrolls the whole
  // payment tableau LEFT and off-screen, then Strip2 grows from the bare line.
  // Measured rigidly (badge/box/text move as one): 0 until f2615, then an
  // accelerating exit −11@2620 −104@2625 −468@2630, fully off-frame by ~2635.
  // The horizon line stays put (it is the shared baseline Strip2's line
  // continues), so only the tableau rides the offset. Kills the invented static
  // hold + fade the ref never had (lesson 5).
  const scrollX = interpolate(f, [2615, 2620, 2625, 2630, 2635], [0, -11, -104, -468, -1730], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: C.white, opacity: inOp * out }}>
      <HLine top={lineY} h={3.52} />
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${scrollX}px)` }}>
      <div style={{ position: "absolute", left: 215, top: 368 - 295 * 0.47, opacity: 1 }}>
        <TracedArt name="cityA" scale={0.47} />
      </div>
      {/* r5: the ref payment cityB is a WIDER arrangement than the intro art
          (w873×h277 vs uniform-scale 630) — traced at native scale from
          ref_2610 (badge painted out) */}
      <TracedArt name="cityBPay" x={1000} y={80} />
      <Badge letter="A" cx={188} cy={265} r={40} />
      <Badge letter="B" cx={1728} cy={265} r={40} />
      {/* Payment complete double arrow */}
      {arrOp > 0 && (
        <>
          <SansText text={COPY.paymentComplete} x={760} y={148} fs={36} color={C.serifNavy} opacity={arrOp} width={400} align="center" />
          <svg width={1920} height={1080} style={{ position: "absolute", opacity: arrOp }}>
            <path d="M735,197 H1180 M735,197 l16,-9 M735,197 l16,9 M1180,197 l-16,-9 M1180,197 l-16,9" stroke={C.serifNavy} strokeWidth={3} fill="none" />
          </svg>
        </>
      )}
      {/* below-line settlement plumbing */}
      {belowOp > 0 && (
        <div style={{ position: "absolute", inset: 0, opacity: belowOp }}>
          <svg width={1920} height={1080} style={{ position: "absolute" }}>
            {/* r18. The plumbing does NOT spring from the horizon line, and it does
                not turn a square corner. Traced from the ref (f2560/2580/2600, all
                identical): it starts at y384 — a deliberate SIXTEEN-pixel gap below
                the line's y364-367 — drops to y560 at x509 (mirrored at x1413, the
                pair is symmetric about x961), then turns through a ~19px ROUNDED
                corner into a horizontal at y579 that runs into the document's left
                edge. We drew it 372→520 with a hard right angle, so the whole
                horizontal leg — 80px of ink — sat 59px above the ref's and the
                vertical stopped 59px short. */}
            <path
              d="M509.5,384 V560 Q509.5,579 528.5,579 H565 M1412.5,384 V560 Q1412.5,579 1393.5,579 H1357"
              stroke={C.navy}
              strokeWidth={2.5}
              fill="none"
            />
            <path d="M895,660 V800 M895,800 l-9,-15 M895,800 l9,-15 M1035,660 V800 M1035,800 l-9,-15 M1035,800 l9,-15" stroke={C.navy} strokeWidth={2.5} fill="none" />
          </svg>
          <SmallHex art="mHexCity2" cx={785} cy={590} w={240} artW={215} />
          <SmallHex art="mHexHeli" cx={1148} cy={592} w={240} artW={215} />
          <Doc x={565} y={548} w={72} h={90} />
          <Doc x={1292} y={548} w={72} h={90} />
          {/* r18 REFUTATION — this site's `labelFs` must STAY, and the reason is
              NOT its box. The box is right (moving it to the sub-pixel bbox read,
              876/832, LOSES 0.014 on the crop — the read was biased by the corner
              radius; 875/835 is the true seat). Adopting the label law makes the
              ink exact in every dimension the law governs — centre 954.5 vs ref
              954.5, cap-height 22 vs 22, ink mass 1150 vs 1156, against the old
              hand-fit's +5.0px centre / −3px cap / −20% mass — and it still LOSES
              0.0006 on the crop, because it lands 3px LOW. ui.tsx seats the cap-top
              at 301.8·scale below the box top; the ref seats it at 296.6·scale HERE
              (flows 301, locks 302 — the seat is not the constant it is taken for).
              The bigger, correctly-placed glyph makes that 3px error MORE visible,
              so the metric prefers the small wrong one. Fix the seat in ui.tsx —
              per-site, or scale-corrected — and this `labelFs` deletes for a clean
              win. Blocked here only because ui.tsx is another lane. */}
          <ClsNetBox x={875} y={835} w={170} labelFs={26} />
        </div>
      )}
      {/* orange return paths */}
      {orangeP > 0 && (
        <div style={{ position: "absolute", inset: 0, opacity: orangeP }}>
          <Elbow points={[[875, 930], [396, 930], [396, 490]]} />
          <Elbow points={[[1045, 930], [1528, 930], [1528, 490]]} />
          <Doc x={360} y={392} w={70} h={95} />
          <Doc x={1495} y={392} w={70} h={95} />
        </div>
      )}
      {/* r18: the two orange up-arrows (x396/x1415, y205-366, rising off the
          horizon into the cities) are FICTION — an orange-arrowhead scan of the
          ref at x384-412 and x1402-1430, y200-240 returns ZERO at every frame
          2490-2612 while ours carried 163/191px. The ref's return plumbing stops
          AT the line; nothing is ever drawn above it. Deleted (lesson: deleting
          fiction is the highest-yield move in this codebase). */}
      </div>
    </AbsoluteFill>
  );
};

// ═══ Scene 20: strip reprise with navy band + CLSNet box (f2612-2833) ═══
// r8 ground-truth: band y404-676, five wide re-traced composites anchored
// at their trace-crop origins, 16 vertical pill traversals clipped to the
// band, and the measured EXIT — the band expands into the full-navy report
// card 2814-2827 (no fade; the old fade-out was invented). Box fades
// 2826-2832 (orange mass 4500@2820 → 3445@2824 → 2264@2828 → 0@2832).
export const Strip2Scene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < 2640 || f >= 2833) return null;
  // entry (fr_2650 → fr_2680): the payment line descends to y455, then grows
  // into the band while clusters + box fade in. r18: the descent is measured off
  // the ref's own line (dark rows at x60) — 381@2640 · 412@2645 · 456@2650 — and
  // continues PaymentScene's, which now hands over at exactly f2640. It was
  // 368@2640 → 455@2654: seven frames late at the top, four at the bottom.
  const lineY = interpolate(f, [2640, 2645, 2650], [381, 412, 455], clamp);
  const growP = lerp(f, [2656, 2678], [0, 1]);
  const grownTop = interpolate(f, STRIP2.expandF as unknown as number[], STRIP2.expandTop as unknown as number[], clamp);
  const grownBot = interpolate(f, STRIP2.expandF as unknown as number[], STRIP2.expandBot as unknown as number[], clamp);
  const bandTop = lineY + (grownTop - 455) * growP;
  const bandBottom = lineY + 3 + (grownBot - 458) * growP;
  const contentOp = lerp(f, [2660, 2680], [0, 1]);
  const sx = (x0: number) => x0 - (f - STRIP2.anchorF) * STRIP2.rate;
  return (
    <AbsoluteFill style={{ backgroundColor: C.white }}>
      <div style={{ position: "absolute", inset: 0, opacity: contentOp }}>
      {/* recolor: the traces' white fill plane is #FFFFFF but the page is
          #FDFDFD — the plate edge reads as a faint rectangle otherwise */}
      {STRIP2.ups.map((u, i) => {
        const x = sx(u.sx);
        if (x + u.w < -50 || x > 1970) return null;
        return <TracedArt key={i} name={u.art} x={x} y={u.y} scale={1} recolor={{ "#FFFFFF": C.white }} />;
      })}
      {STRIP2.dns.map((d, i) => {
        const x = sx(d.sx);
        if (x + d.w < -50 || x > 1970) return null;
        return <TracedArt key={i} name={d.art} x={x} y={d.y} scale={1} recolor={{ "#FFFFFF": C.white }} />;
      })}
      </div>
      <div style={{ position: "absolute", left: 0, top: bandTop, width: 1920, height: Math.max(3, bandBottom - bandTop), backgroundColor: C.navy, overflow: "hidden" }}>
        {/* vertical pill traversals (screen-fixed x, ~30px/f), clipped to the band */}
        {contentOp >= 1 && STRIP2.vpills.map((p, i) => {
          const top = p.top0 + 30 * p.dir * (f - p.f0);
          if (top + p.h < bandTop || top > bandBottom) return null;
          return <Pill key={i} x={p.x} y={top - bandTop} w={p.w} h={p.h} color={p.c} />;
        })}
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: contentOp }}>
      {/* CLSNet box fixed at center, orange border, no label. side/artD*
          measured r8: ref outer 200.5² at (860,436), content +3/+4 vs
          pure scaling */}
      <ClsNetBox x={STRIP2.box.x} y={STRIP2.box.y} w={STRIP2.box.w} label={false} border="orange" markP={lerp(f, [2668, 2690], [0, 1])} side={200.5} artDx={3} artDy={4} opacity={lerp(f, [2826, 2832], [1, 0])} />
      </div>
    </AbsoluteFill>
  );
};

// ═══ Scene 21+22: netting report card → collapse → building pop (f2822-3104) ═══
// Measured: card holds to 2976, collapses into a wide outline pill (fr_2982:
// 365-1555 × 137-295), pill shrinks to (365,520,430,95) by ~3003; navy top edge
// drops 0→390→543 (fr_3009 / fr_3021); cluster rides the edge; tan pill at
// (210,540) by fr_3060; orange pill bottom-right (1355,940) from ~3018.
export const ReportCardScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < SEG.reportCard[0] - 12 || f >= SEG.mapBadges[0]) return null;
  // strip2's band expansion IS the navy fill (complete 2827); this short
  // navy-over-navy ramp just hands the background off invisibly
  const bgOp = lerp(f, [2825, 2827], [0, 1]);
  // ── r17 STRUCTURAL REWRITE ─────────────────────────────────────────────────
  // The whole card was re-measured off the ref (pixel scans of vf 2822..2990).
  // FOUR structural errors, each of which cost more than any re-draw could win:
  //
  //  1. CARD EXTENT. Ref outline is x[364,1555] y[139,940] = 1192×802 with a 4px
  //     stroke and DIAGONAL corners (TL + BR rounded r64; TR + BL square — the
  //     same leaf motif the pills use). We drew 840×700 at (530,190), 2.5px, four
  //     40px corners. Everything inside the card inherited the error.
  //
  //  2. EIGHT SEGMENTS PER ROW, not six — at 3-4px gaps, not 10 — spanning
  //     x[496,1475], not the bunched x[600,1175] we drew. Each pill carries a 3px
  //     WHITE STROKE (the old bare Pill had none), so the outer box insets by 3.
  //     Exact per-segment (x,w) tables below; they are pixel-identical across every
  //     settled frame, so they are transcribed, not modelled.
  //
  //  3. THE MERGE IS FICTION. The ref rows draw in by f2926 and then hold FROZEN
  //     TO THE PIXEL through f2978 — the segments never net down into 3 blocks.
  //     The old mergeP swapped in 3 fat blocks at f2940 and held them to f2976,
  //     i.e. it corrupted f2940-2976 — precisely the r13 worst window. Deleted.
  //
  //  4. THE CLOCK RAN LATE. Measured: outline + rules draw f2856-2874 (we started
  //     at 2874 and only finished at 2898, so we showed empty navy for 24 frames
  //     in which the ref already had a complete card); rows draw f2906-2926 (ours
  //     settled at 2942); rules RETRACT rightward f2970-2983; and the rows HARD-CUT
  //     — no fade — tan f2979, org f2980, lav f2981 (we cross-faded 2972-2982).
  //
  // The collapse is untouched: the f>=2982 pill trajectory is hardcoded and
  // card-independent, so only the 6-frame f2976-2982 handoff moves, and it moves
  // the RIGHT way — the ref card compresses vertically IN PLACE (top y139, left
  // x364), which the new card.{x,w} now feed straight into the wide pill instead
  // of the old 530→365 sideways jump (lesson 3: express through consistent transforms).
  const card = { x: 364, y: 139, w: 1192, h: 802 };
  const R = 64; // diagonal corner radius (TL + BR); TR + BL are square
  const STROKE = 4;
  // Outline + rules are drawn by ONE pen, and the per-frame edge scan (2854..2876)
  // pins both its ROUTE and its speed. Route: counter-clockwise from the bottom-
  // right — bottom edge, then left, then top, then right (B fills 2856-2863, L
  // 2863-2864, T 2864-2865, R 2865-2869). Speed: a hard S — 6% at 2860, 18% at
  // 2862, 66% at 2864, 96% at 2868. A straight lerp put the pen on the TOP edge at
  // 2860 while the ref was still on the BOTTOM, and that misplaced ink cost more
  // than drawing nothing (lesson 4) — it was the one frame this round regressed.
  // The rules ride the same clock (measured 0.666 at 2864 vs the card's 0.663).
  const cardP = interpolate(
    f,
    [2855, 2858, 2860, 2862, 2863, 2864, 2865, 2866, 2867, 2868, 2869, 2872],
    [0, 0.018, 0.063, 0.18, 0.33, 0.663, 0.813, 0.887, 0.93, 0.958, 0.97, 1],
    clamp,
  );
  // path length: two straight pairs + two quarter arcs — derived, so it cannot drift
  const dash = 2 * (card.w - R) + 2 * (card.h - R) + Math.PI * R;
  // segment FILL rects (x,w), transcribed from the settled ref; the 3px white
  // stroke sits outside them, so the outer box is (x-3, w+6). Fill height 44.
  const SEG_FILL_H = 44;
  const SEG_STROKE = 3;
  const rows: { fy: number; cut: number; color: string; segs: [number, number][] }[] = [
    {
      fy: 372,
      cut: 2981,
      color: C.lavender,
      segs: [[496, 168], [667, 83], [753, 83], [839, 182], [1025, 167], [1196, 83], [1282, 83], [1368, 83]],
    },
    {
      fy: 520,
      cut: 2980,
      color: C.orangeDeep,
      segs: [[496, 94], [594, 76], [674, 174], [854, 164], [1032, 82], [1124, 82], [1210, 179], [1394, 82]],
    },
    {
      fy: 667,
      cut: 2979,
      color: C.tan,
      segs: [[496, 168], [667, 83], [754, 82], [840, 180], [1024, 95], [1122, 76], [1202, 175], [1380, 83]],
    },
  ];
  // rules ride the card's pen in, hold full, then RETRACT rightward (measured)
  const ruleTopP = cardP * lerp(f, [2970, 2982], [1, 0]);
  const ruleBotP = cardP * lerp(f, [2970, 2979], [1, 0]);
  // navy ground edge drops, revealing white above (measured keys)
  const edgeY = interpolate(f, [2997, 3009, 3015], [0, 390, 543], clamp);
  // card outline → wide pill → small pill → slides left (keyframed rects)
  const pill = {
    x: interpolate(f, [2976, 2982, 3003, 3030], [card.x, 365, 365, 210], clamp),
    y: interpolate(f, [2976, 2982, 3003, 3030], [card.y, 137, 520, 540], clamp),
    w: interpolate(f, [2976, 2982, 3003, 3030], [card.w, 1190, 430, 345], clamp),
    h: interpolate(f, [2976, 2982, 3003, 3030], [card.h, 158, 95, 95], clamp),
  };
  const collapseP = lerp(f, [2976, 2982], [0, 1]);
  const outlineOp = lerp(f, [3012, 3022], [1, 0]);
  const tanOp = lerp(f, [3040, 3052], [0, 1]);
  // cluster rises from behind the dropping edge
  const clipRise = lerp(f, [2999, 3010], [0, 1]);
  const clusterS = 1.15;
  const clusterH = 255 * clusterS;
  const orangeOp = lerp(f, [3017, 3023], [0, 1]);
  return (
    <AbsoluteFill style={{ opacity: bgOp }}>
      {/* white ground above the dropping navy edge */}
      <div style={{ position: "absolute", inset: 0, backgroundColor: C.white }} />
      <div style={{ position: "absolute", left: 0, top: edgeY, width: 1920, height: 1080 - edgeY, backgroundColor: C.navy }} />
      {/* cluster pinned to the navy edge */}
      {clipRise > 0 && (
        <div style={{ position: "absolute", left: 960 - (370 * clusterS) / 2, top: edgeY - clusterH * clipRise, width: 370 * clusterS, height: clusterH * clipRise, overflow: "hidden" }}>
          <TracedArt name="stripTowerUp" x={0} y={0} scale={clusterS} />
        </div>
      )}
      {/* card outline (dash-draw, then it becomes the collapse pill) */}
      {collapseP <= 0 ? (
        <svg width={1920} height={1080} style={{ position: "absolute" }}>
          <path
            /* counter-clockwise from the bottom-right, so the dash reveals the
               edges in the ref's order: bottom → left → top → right */
            d={`M${card.x + card.w - R},${card.y + card.h - STROKE / 2} H${card.x + STROKE / 2} V${card.y + R} Q${card.x + STROKE / 2},${card.y + STROKE / 2} ${card.x + R},${card.y + STROKE / 2} H${card.x + card.w - STROKE / 2} V${card.y + card.h - R} Q${card.x + card.w - STROKE / 2},${card.y + card.h - STROKE / 2} ${card.x + card.w - R},${card.y + card.h - STROKE / 2}`}
            fill="none"
            stroke={C.white}
            strokeWidth={STROKE}
            strokeDasharray={dash}
            strokeDashoffset={dash * (1 - cardP)}
          />
        </svg>
      ) : (
        outlineOp > 0 && (
          <div
            style={{
              position: "absolute",
              left: pill.x,
              top: pill.y,
              width: pill.w,
              height: pill.h,
              border: `3px solid ${C.white}`,
              borderRadius: `${Math.min(80, pill.h / 2)}px ${Math.min(80, pill.h / 2)}px ${Math.min(80, pill.h / 2)}px 8px`,
              opacity: outlineOp,
            }}
          />
        )
      )}
      {/* tan pill straddling the edge (fr_3060) */}
      {tanOp > 0 && (
        <div
          style={{
            position: "absolute",
            left: 210,
            top: 540,
            width: 345,
            height: 95,
            backgroundColor: C.tan,
            border: `4px solid ${C.white}`,
            borderRadius: "48px 48px 48px 8px",
            opacity: tanOp,
          }}
        />
      )}
      {/* orange filled pill bottom-right */}
      {orangeOp > 0 && (
        <div
          style={{
            position: "absolute",
            left: 1355,
            top: 940,
            width: 170,
            height: 100,
            backgroundColor: C.orangeDeep,
            border: `4px solid ${C.white}`,
            borderRadius: "50px 50px 50px 8px",
            opacity: orangeOp,
          }}
        />
      )}
      {/* rules — measured x/y/w, 6px thick; they draw with the card and retract right */}
      {ruleTopP > 0 && (
        <div style={{ position: "absolute", left: 469, top: 214, width: 1037 * ruleTopP, height: 6, backgroundColor: C.white }} />
      )}
      {ruleBotP > 0 && (
        <>
          <div style={{ position: "absolute", left: 469, top: 869, width: 311 * ruleBotP, height: 6, backgroundColor: C.white }} />
          <div style={{ position: "absolute", left: 889, top: 869, width: 89 * ruleBotP, height: 6, backgroundColor: C.white }} />
        </>
      )}
      {/* netting rows — 8 stroked pills each, at their transcribed positions. They
          draw in f2906-2926, hold FROZEN, then hard-cut per row (no fade). */}
      {rows.map((r, ri) =>
        f >= r.cut ? null : (
          <React.Fragment key={ri}>
            {r.segs.map(([fx, fw], i) => {
              // scattered-but-settled stagger: every segment is up by f2926, as in the ref
              const t0 = 2906 + ri * 1.5 + i * 1.4;
              const op = lerp(f, [t0, t0 + 8], [0, 1]);
              if (op <= 0) return null;
              return (
                <div
                  key={`${ri}-${i}`}
                  style={{
                    position: "absolute",
                    left: fx - SEG_STROKE,
                    top: r.fy - SEG_STROKE,
                    width: fw + SEG_STROKE * 2,
                    height: SEG_FILL_H + SEG_STROKE * 2,
                    boxSizing: "border-box",
                    backgroundColor: r.color,
                    border: `${SEG_STROKE}px solid ${C.white}`,
                    // leaf, matching the card: TL + BR rounded, TR + BL square
                    borderRadius: `${SEG_FILL_H / 2}px 0px ${SEG_FILL_H / 2}px 0px`,
                    opacity: op,
                  }}
                />
              );
            })}
          </React.Fragment>
        ),
      )}
    </AbsoluteFill>
  );
};

// ═══ Scene 23: map with FX Global Code badges (f3104-3364) ═══
// gen9 re-trace: the second-map hexes carried the FIRST-map r1 traces
// (wrong buildings — temple where the ref shows a city cluster) UPSCALED to
// 254 (r7's "1.18x bigger" read was wrong — measured native is ~215×190, the
// same size as the first map). Re-traced from the settled badge-free frame
// regular_0254 (f3162) at each hex's measured centre + native bbox.
const MB_AW = 216;
const MB_AH = 196;
const MB_HEXES: { art: string; cx: number; cy: number }[] = [
  { art: "mbHexHeli", cx: 386, cy: 410 },
  { art: "mbHexOffice", cx: 662, cy: 248 },
  { art: "mbHexBank", cx: 577, cy: 788 },
  { art: "mbHexBank2", cx: 1092, cy: 418 },
  { art: "mbHexTowers2", cx: 916, cy: 725 },
  { art: "mbHexSail", cx: 1513, cy: 344 },
  { art: "mbHexCity2", cx: 1432, cy: 768 },
];
const BADGE_POS: [number, number][] = [
  [412, 428], [685, 264], [599, 824], [1116, 448], [933, 750], [1520, 371], [1441, 801],
];

export const MapBadgesScene: React.FC<{ frame: number }> = ({ frame }) => {
  const { sans: SANS, serif: SERIF } = useBrand();
  const f = frame;
  if (f < SEG.mapBadges[0] || f >= 3396) return null;
  // ref: the world map is BRIGHT/full by ~f3112 (vf 3104/3112/3120), not a 26f
  // dim fade to 3130 — the old ramp left a grey half-lit map through the whole
  // hex cascade. Draw it in fast.
  const mapP = lerp(f, [3104, 3113], [0, 1]);
  // implode: crisp shrink (no fade). r9 ground truth (measure_implode.py,
  // white map-content bbox ratio vs settled 0264): scale 0.804 at f3300,
  // 0.037 at f3312.5, gone by 3318 — a slow lead-in then a fast collapse.
  // The old montage-eyeballed curve hit 0.70 at f3300 (shrinking too early),
  // costing the f3300 keyframe (window #1 worst, idx66 0.802).
  const scale = interpolate(f, [3288, 3300, 3312.5, 3318], [1, 0.804, 0.037, 0], clamp);
  // light-blue field collapses to a dot (fr_3350: r41 at 960,540), holds,
  // then grows back to the settled circle (fr_3396: r≈458)
  const navyBehind = f >= 3318;
  const circleR = interpolate(
    f,
    [3320, 3327, 3331, 3336, 3342, 3375, 3396],
    [1250, 560, 150, 50, CIRCLE.dotR, CIRCLE.dotR, CIRCLE.r],
    clamp,
  );
  const showCircle = f >= 3320;
  const circleCx = CIRCLE.cx;
  const circleCy = interpolate(f, [3375, 3396], [540, CIRCLE.cy], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: navyBehind ? C.navy : C.blue }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${scale})`,
          transformOrigin: "960px 537px", // r9 measured implode origin (bbox-center solve)
        }}
      >
        <TracedArt name="worldMap" x={MAP.x} y={MAP.y} opacity={mapP} />
        {/* r6/r7 probed at f3280 vs f700: map outline IDENTICAL (bbox
            206-1711/60-1015) but hexes ~1.18x bigger at shifted centers
            (fill-offset method); badges 104x102 at measured absolute spots,
            35-badges GREY-BLUE #5A7593 / 50-badges TEAL #006F88 (corner-
            sampled — r5's all-teal read was text-polluted). */}
        {MB_HEXES.map((hx, i) => {
          // ref has the first hex present WITH the map (~f3112) then ~1 more
          // every 9f (vf 3112→1, 3120→2, 3160→6, 3180→7). Old 3116+i*7 with a
          // 10f grow put hex0 full only at ~f3126 — the whole cascade ran late.
          const pop = 3106 + i * 9;
          const s = lerp(f, [pop, pop + 8], [0, 1]);
          if (s <= 0) return null;
          return (
            <div key={hx.art} style={{ position: "absolute", left: hx.cx - (MB_AW * s) / 2, top: hx.cy - (MB_AH * s) / 2 }}>
              <TracedArt name={hx.art} scale={s} />
            </div>
          );
        })}
        {/* badges */}
        {MB_HEXES.map((hx, i) => {
          const at = 3160 + i * 9;
          const op = lerp(f, [at, at + 8], [0, 1]);
          if (op <= 0) return null;
          const fifty = [false, true, false, false, true, true, false][i];
          const [bx, by] = BADGE_POS[i];
          return (
            <div
              key={`b${hx.art}`}
              style={{
                position: "absolute",
                left: bx,
                top: by,
                width: 104,
                height: 102,
                backgroundColor: fifty ? "#006F88" : "#5A7593",
                opacity: op,
                padding: "9px 9px",
              }}
            >
              <div style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.1, color: C.white, textAlign: "center", whiteSpace: "pre" }}>{"FX Global\nCode"}</div>
              <div style={{ fontFamily: SANS, fontSize: 11, color: "rgba(235,237,244,0.75)", marginTop: 1, textAlign: "center" }}>Principle</div>
              <div style={{ fontFamily: SERIF, fontSize: 42, lineHeight: 0.85, color: "rgba(235,237,244,0.85)", textAlign: "center" }}>{fifty ? "50" : "35"}</div>
            </div>
          );
        })}
      </div>
      {showCircle && (
        <div
          style={{
            position: "absolute",
            left: circleCx - circleR,
            top: circleCy - circleR,
            width: circleR * 2,
            height: circleR * 2,
            borderRadius: circleR,
            backgroundColor: C.blue,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ═══ Scene 24: circle handshake / PvP (f3396-3480) ═══
// Measured fr_3396/fr_3460: circle static at (960,540) r≈460; the navy
// handshake pill GROWS from (875,505,180×92) to (790,460,350×185).
export const CircleScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  // r5 measured exit: the circle group slides LEFT from 3466 (cx keys probed
  // per frame), the dot/elbows/square cut out 3467-3468 and the handshake pill
  // fades 3468-3471 riding the slide; the bare circle then shrink-morphs into
  // page 1's line-2 col-2 big blue pill (526,472,86,68) — landed by 3485-3486,
  // after which the mosaic page owns it (no fade anywhere).
  if (f < 3396 || f >= 3487) return null;
  const artOp = lerp(f, [3400, 3414], [0, 1]);
  const g = lerp(f, [3400, 3450], [0, 1]);
  const MF = [3466, 3467, 3468, 3469, 3470, 3471, 3472, 3473, 3474, 3475, 3476, 3477, 3478, 3479, 3481, 3483, 3485];
  const cx = interpolate(f, MF, [958, 956, 953, 948, 941, 932, 919, 900, 871, 814, 713, 657, 627, 605, 586, 575, 569], clamp);
  const cy = interpolate(f, MF, [538, 538, 538, 538, 538, 537, 536, 535, 533, 530, 517, 512, 510, 509, 508, 507, 506], clamp);
  const mw = interpolate(f, MF, [917, 917, 917, 917, 917, 917, 917, 917, 917, 917, 800, 521, 377, 280, 180, 122, 86], clamp);
  const mh = interpolate(f, MF, [917, 917, 917, 917, 917, 917, 917, 917, 917, 917, 623, 406, 294, 216, 144, 96, 68], clamp);
  const mr = interpolate(f, MF, [458, 458, 458, 458, 458, 458, 458, 458, 458, 458, 118, 57, 41, 25, 16, 14, 14], clamp);
  const dotOp = lerp(f, [3466, 3468], [1, 0]);
  const pillOp = lerp(f, [3467, 3471], [1, 0]);
  const slideX = cx - 958;
  const slideY = cy - 538;
  const pill = {
    x: CIRCLE.pillFrom.x + (CIRCLE.pillTo.x - CIRCLE.pillFrom.x) * g,
    y: CIRCLE.pillFrom.y + (CIRCLE.pillTo.y - CIRCLE.pillFrom.y) * g,
    w: CIRCLE.pillFrom.w + (CIRCLE.pillTo.w - CIRCLE.pillFrom.w) * g,
    h: CIRCLE.pillFrom.h + (CIRCLE.pillTo.h - CIRCLE.pillFrom.h) * g,
  };
  return (
    <AbsoluteFill style={{ backgroundColor: f < SEG.mosaic[0] ? C.navy : undefined, opacity: 1 }}>
      <div
        style={{
          position: "absolute",
          left: cx - mw / 2,
          top: cy - mh / 2,
          width: mw,
          height: mh,
          borderRadius: f >= 3480 ? "2px 14px 2px 14px" : mr,
          backgroundColor: C.blue,
        }}
      />
      <div style={{ position: "absolute", inset: 0, transform: `translate(${slideX}px, ${slideY}px)` }}>
        {/* navy handshake pill grows in place, then fades 3468-3471 on the slide */}
        {pillOp > 0 && (
          <div
            style={{
              position: "absolute",
              left: pill.x,
              top: pill.y,
              width: pill.w,
              height: pill.h,
              backgroundColor: C.navy,
              borderRadius: `${pill.h * 0.28}px ${pill.h * 0.28}px ${pill.h * 0.28}px ${pill.h * 0.55}px`,
              opacity: pillOp,
            }}
          >
            <div style={{ position: "absolute", left: pill.w / 2 - (490 * 0.55 * (pill.w / 350)) / 2, top: pill.h / 2 - (320 * 0.55 * (pill.w / 350)) / 2 }}>
              <TracedArt name="handshake" scale={0.55 * (pill.w / 350)} style={{ position: "relative" }} />
            </div>
          </div>
        )}
        {artOp * dotOp > 0 && (
          <div style={{ position: "absolute", inset: 0, opacity: artOp * dotOp }}>
            {/* white dot + elbows + orange square (fr_3460) */}
            <div style={{ position: "absolute", left: CIRCLE.whiteDot.cx - CIRCLE.whiteDot.r, top: CIRCLE.whiteDot.cy - CIRCLE.whiteDot.r, width: CIRCLE.whiteDot.r * 2, height: CIRCLE.whiteDot.r * 2, borderRadius: CIRCLE.whiteDot.r, backgroundColor: C.white }} />
            <svg width={1920} height={1080} style={{ position: "absolute" }}>
              <path d="M965,455 V388 H755 M755,388 l16,-9 M755,388 l16,9" stroke={C.white} strokeWidth={3} fill="none" />
              <path d="M965,650 V712 H1160 M1160,712 l-16,-9 M1160,712 l-16,9" stroke={C.white} strokeWidth={3} fill="none" />
            </svg>
            <div style={{ position: "absolute", left: CIRCLE.square.x, top: CIRCLE.square.y, width: CIRCLE.square.w, height: CIRCLE.square.w, backgroundColor: C.orangeDeep }} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ═══ Scene 25: currency mosaic (f3477-3645) — r5 ground truth ═══
// Three grey bars draw L→R in cascade (extent keys probed); four pill pages
// pop in/out on a fixed 7-column grid (windows from per-frame ink mass).
// Pop-in: pills approach the line from ~92px outside over 4f (linear),
// scaleY 0.25→1, stack-outer pills lag 2f. Pop-out: the whole stack collapses
// INTO the line (scaleY 1-t^2.5, origin on the line, 4f — bbox-tracked).
// Then the bars converge to y549 (3606-3615) and the merged bar rotates about
// (948,549) to vertical (keys 0/4.2/15/56/90°), becoming the shield zipper.
// corner insets measured row-by-row on page_3505: line-side outer corner is
// square (2px AA), the opposite diagonal carries a 13-14px radius
const MOS_ABOVE_BIG = "2px 14px 2px 14px";
const MOS_ABOVE_SMALL = "2px 13px 2px 13px";
const MOS_BELOW_BIG = "14px 2px 14px 2px";
const MOS_BELOW_SMALL = "13px 2px 13px 2px";

const MosStack: React.FC<{
  cell: string;
  x: number;
  lineTop: number;
  f: number;
  inF: number;
  preLanded?: boolean; // page-1 L2-c2 big blue = the landed circle morph — no pop
}> = ({ cell, x, lineTop, f, inF, preLanded }) => {
  const [above = "", below = ""] = cell.split("/");
  const pills: { x: number; y: number; w: number; h: number; color: string; radius: string; k: number; dir: 1 | -1 }[] = [];
  let yBot = lineTop; // above cursor: next pill's bottom edge
  above.split("").forEach((tk, k) => {
    const big = tk === "B";
    const h = big ? 68 : 34;
    const bottom = k === 0 ? lineTop - (big ? 5 : 6) : yBot - 9;
    pills.push({
      x,
      y: bottom - h,
      w: big ? 86 : 83,
      h,
      color: C.blue,
      radius: big ? MOS_ABOVE_BIG : MOS_ABOVE_SMALL,
      k,
      dir: -1,
    });
    yBot = bottom - h;
  });
  let yTop = lineTop; // below cursor: next pill's top edge
  below.split("").forEach((tk, k) => {
    const big = tk === "O";
    const h = big ? 68 : 35;
    const top = k === 0 ? lineTop + 21 : yTop + (big ? 8 : 8);
    pills.push({
      x: big ? x - 1 : x,
      y: top,
      w: big ? 87 : 83,
      h,
      color: big ? MOS.orange : MOS.tan,
      radius: big ? MOS_BELOW_BIG : MOS_BELOW_SMALL,
      k,
      dir: 1,
    });
    yTop = top + h;
  });
  return (
    <>
      {pills.map((p, i) => {
        const t = preLanded && p.dir === -1 && p.k === 0 ? 1 : Math.min(1, Math.max(0, (f - inF - p.k * 2) / 4));
        if (t <= 0) return null;
        const dy = 92 * (1 - t) * p.dir;
        const sc = 0.25 + 0.75 * t;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: p.w,
              height: p.h,
              backgroundColor: p.color,
              borderRadius: p.radius,
              transform: `translateY(${dy}px) scaleY(${sc})`,
              opacity: Math.min(1, 3 * t),
            }}
          />
        );
      })}
    </>
  );
};

export const MosaicScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < SEG.mosaic[0] || f >= SEG.mosaic[1]) return null;
  const rot = f >= MOS.rotate.f[0];
  const lineY = [
    interpolate(f, MOS.converge.f as unknown as number[], MOS.converge.l0 as unknown as number[], clamp),
    549,
    interpolate(f, MOS.converge.f as unknown as number[], MOS.converge.l2 as unknown as number[], clamp),
  ];
  return (
    <AbsoluteFill style={{ backgroundColor: C.navy }}>
      {!rot &&
        MOS.lines.map((_, li) => {
          const ext = interpolate(f, MOS.draw[li].f as unknown as number[], MOS.draw[li].x as unknown as number[], clamp);
          if (ext <= 0) return null;
          return (
            <div key={li} style={{ position: "absolute", left: 0, top: lineY[li] - 4, width: ext, height: 8, backgroundColor: C.grey }} />
          );
        })}
      {rot && (
        <div
          style={{
            position: "absolute",
            left: 948 - 1200,
            top: 545,
            width: 2400,
            height: 8,
            backgroundColor: C.grey,
            transform: `rotate(${-interpolate(f, MOS.rotate.f as unknown as number[], MOS.rotate.deg as unknown as number[], clamp)}deg)`,
            transformOrigin: "1200px 4px",
          }}
        />
      )}
      {MOS.pages.map((pg, pi) => {
        if (f < pg.in || f >= pg.out + 5) return null;
        const tOut = Math.min(1, Math.max(0, (f - pg.out) / 4));
        const sOut = 1 - Math.pow(tOut, 2.5);
        const labelOp = Math.min(1, (f - pg.in) / 2) * (1 - Math.min(1, Math.max(0, (f - pg.out) / 3)));
        return (
          <React.Fragment key={pi}>
            {pg.rows.map((row, li) => (
              <div
                key={li}
                style={{ position: "absolute", inset: 0, transform: `scaleY(${sOut})`, transformOrigin: `960px ${MOS.lines[li] + 4}px` }}
              >
                {row.split("|").map((cell, ci) =>
                  cell === "/" ? null : (
                    <MosStack
                      key={ci}
                      cell={cell}
                      x={MOS.cols[ci]}
                      lineTop={MOS.lines[li]}
                      f={f}
                      inF={pg.in}
                      preLanded={pi === 0 && li === 1 && ci === 2}
                    />
                  ),
                )}
              </div>
            ))}
            {pg.labels.map(([txt, colr], li) => (
              <SerifLabel
                key={li}
                text={txt}
                x={MOS.labelSlots[li].cx - 310}
                width={620}
                align="center"
                capTop={MOS.labelSlots[li].capTop}
                fs={MOS.labelFs}
                tracking={MOS.labelTracking}
                color={colr === "o" ? C.orange : C.white}
                opacity={labelOp}
              />
            ))}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

// ═══ Scene 26: shield (f3641-3700) ═══
// Probed: zipper draws at x930-966 from f3642; white wipes LEFT from it
// (left edge 928→0 over 3645-3657, ≈t^2.1); shield pops 3661-3672, holds to
// 3690, then shrinks away down-left while the band starts rotating (LedgeScene
// owns the band from 3690 — this scene draws only the shield after that).
export const ShieldScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < 3641 || f >= 3702) return null;
  const split = 928;
  const zipDraw = lerp(f, [3641, 3645], [0, 1]);
  const wipeT = lerp(f, [3645, 3657], [0, 1]);
  const leftEdge = split * (1 - Math.pow(wipeT, 2.1));
  const shieldP = lerp(f, [3661, 3672], [0, 1]);
  // exit: shrink + fall down-left with a slight rotation (montage 3693-3699)
  const exitP = lerp(f, [3690, 3700], [0, 1]);
  const bg = f < 3690;
  return (
    <AbsoluteFill style={{ backgroundColor: bg ? C.navy : undefined }}>
      {bg && (
        <>
          {/* white region wiping left from the zipper */}
          <div style={{ position: "absolute", left: leftEdge, top: 0, width: split - leftEdge, height: 1080, backgroundColor: C.white }} />
          {/* zipper band, fixed at x930 (draws downward) */}
          <div style={{ position: "absolute", left: 930, top: 0, width: 36, height: 1080 * zipDraw, backgroundColor: C.band }} />
          {Array.from({ length: 9 }, (_, i) => {
            const ty = i * 127 + 47;
            if (ty > 1080 * zipDraw) return null;
            return <div key={i} style={{ position: "absolute", left: 930, top: ty, width: 36, height: 2, backgroundColor: C.navy, opacity: 0.8 }} />;
          })}
        </>
      )}
      {shieldP > 0 && exitP < 1 && (
        <div
          style={{
            position: "absolute",
            left: 690,
            top: 222,
            width: 520,
            height: 643,
            transform: `translate(${-250 * exitP}px, ${250 * exitP}px) scale(${shieldP * (1 - 0.8 * exitP)}) rotate(${-24 * exitP}deg)`,
            transformOrigin: "46% 50%",
            opacity: 1 - Math.pow(exitP, 1.5),
          }}
        >
          <ShieldSVG />
        </div>
      )}
    </AbsoluteFill>
  );
};

// Shield re-shaped against fr_3672: square shoulders, near-vertical sides to
// ~55% height, fill inset ~42px following the outline.
const ShieldSVG: React.FC = () => (
  <svg width={520} height={643} viewBox="0 0 520 643">
    {/* left half: orange outline + orange fill (sits on the white side) */}
    <g>
      <path d="M240,2 C185,32 105,48 4,50 L4,345 C4,470 100,570 240,640 Z" fill="none" stroke={C.orange} strokeWidth={6} />
      <path d="M240,50 C190,74 128,87 46,90 L46,340 C46,445 125,528 240,590 Z" fill={C.orangeDeep} />
    </g>
    {/* right half: white outline + white fill (sits on the navy side) */}
    <g>
      <path d="M280,2 C335,32 415,48 516,50 L516,345 C516,470 420,570 280,640 Z" fill="none" stroke={C.white} strokeWidth={6} />
      <path d="M280,50 C330,74 392,87 474,90 L474,340 C474,445 395,528 280,590 Z" fill={C.white} />
    </g>
    {/* sparkle right of the outline */}
    <path d="M505,168 l14,14 M519,168 l-14,14" stroke={C.white} strokeWidth={4} />
  </svg>
);

// ═══ Scene 27: band rotation + stacks + cities (f3690-3946) ═══
// One continuous band: vertical zipper (θ=90 reproduces x928-968) rotating
// through a see-saw to flat (θ keys probed at fr_3708/3732/3762, pivot
// (948,575)). Stacks are axis-aligned leaf pills (135×62, pitch 90) dropping
// in while the group settles; at ~3800 the stacks shrink+slide left/inward and
// the two cities rise on the band (fr_3840).
export const LedgeScene: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < SEG.ledge[0] || f >= 3948) return null;
  const theta = interpolate(
    f,
    LEDGE.thetaKeys as unknown as number[],
    LEDGE.thetaVals as unknown as number[],
    clamp,
  );
  const [pcx, pcy] = LEDGE.center;
  // group settle: stacks ride slightly high, sink to rest (fr_3732 vs fr_3762)
  const settleDy = interpolate(f, [3705, 3732, 3762], [90, 40, 0], clamp);
  // citiesStacks phase: stacks shrink+slide, cities fade in on the band
  const slideP = lerp(f, [3800, 3835], [0, 1]);
  const citiesOp = lerp(f, [3815, 3838], [0, 1]);
  // hold the ledge fully opaque through f3940 (was [3936,3946], which greyed it
  // as it faded to the dark behind while the ref stays white through ~f3938).
  // The endcard navy wipes in over the top from f3938-3940 (EndCardScene enterOp)
  // and fully covers the ledge by f3940, so this delayed fade is only ever seen
  // as full white ledge at f3936-3939 — matching the ref's late, fast handoff.
  const out = lerp(f, [3940, 3946], [1, 0]);
  const S = LEDGE.stacks;
  return (
    <AbsoluteFill style={{ backgroundColor: C.white, opacity: out }}>
      {/* rotating band with attached navy half-plane below it */}
      <div
        style={{
          position: "absolute",
          left: pcx - 2500,
          top: pcy - LEDGE.bandH / 2,
          width: 5000,
          height: LEDGE.bandH,
          backgroundColor: C.band,
          transform: `rotate(${-theta}deg)`,
          transformOrigin: "50% 50%",
        }}
      >
        {Array.from({ length: 40 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: i * LEDGE.tickEvery, top: 0, width: 2, height: LEDGE.bandH, backgroundColor: C.navy, opacity: 0.75 }} />
        ))}
        {/* navy half-plane hanging off the band's lower side */}
        <div style={{ position: "absolute", left: -1000, top: LEDGE.bandH, width: 7000, height: 4000, backgroundColor: C.navy }} />
      </div>
      {/* stack groups (axis-aligned; drop in, settle, then shrink+slide) */}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${-170 * slideP}px, 0) scale(${1 - 0.48 * slideP})`, transformOrigin: `${S.leftX}px ${S.baseline + 62}px` }}>
        <StackCols
          x={S.leftX}
          cols={[[C.pillNavy, C.pillNavy, C.steel, C.steel, C.steel], [C.steel, C.steel, C.steel]]}
          f={f}
          at={3703}
          dy={settleDy}
        />
      </div>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${-325 * slideP}px, 0) scale(${1 - 0.48 * slideP})`, transformOrigin: `${S.rightX}px ${S.baseline + 62}px` }}>
        <StackCols
          x={S.rightX}
          cols={[[C.tan, C.tan, C.tan], [C.orangeDeep, C.orangeDeep, C.tan, C.tan, C.tan]]}
          f={f}
          at={3712}
          dy={settleDy}
        />
      </div>
      {/* cities standing on the flat band (fr_3840: bases at y555) */}
      {citiesOp > 0 && (
        <>
          <div style={{ position: "absolute", left: 370, top: 557 - 295 * 0.44, opacity: citiesOp }}>
            <TracedArt name="cityA" scale={0.44} />
          </div>
          <div style={{ position: "absolute", left: 1210, top: 557 - 545 * 0.42, opacity: citiesOp }}>
            <TracedArt name="cityB" scale={0.42} />
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};

// Columns of leaf pills dropping in bottom-up (per-pill fade + fall).
const StackCols: React.FC<{
  x: number;
  cols: string[][];
  f: number;
  at: number;
  dy: number;
}> = ({ x, cols, f, at, dy }) => {
  const S = LEDGE.stacks;
  return (
    <>
      {cols.map((col, ci) => (
        <React.Fragment key={ci}>
          {col.map((c, i) => {
            const start = at + ci * 9 + i * 6;
            const p = lerp(f, [start, start + 12], [0, 1]);
            if (p <= 0) return null;
            const ease = 1 - (1 - p) * (1 - p);
            const yFinal = S.baseline - S.pillH - i * S.pitch + dy;
            return (
              <Pill
                key={i}
                x={x + ci * S.colGap}
                y={yFinal - 300 * (1 - ease)}
                w={S.pillW}
                h={S.pillH}
                color={c}
                opacity={p}
              />
            );
          })}
        </React.Fragment>
      ))}
    </>
  );
};

// ═══ Scene 28+29: end card assembles in place (f3926-4168) ═══
// Measured w9 montage + fr_3966/fr_3981/fr_4011: empty navy to ~3957, then the
// title layout assembles element by element on the SAME navy — no crossfade.
export const EndCardScene: React.FC<{ frame: number }> = ({ frame }) => {
  const COPY = useCopy();
  const { sans: SANS } = useBrand();
  const f = frame;
  if (f < SEG.outro[0]) return null;
  const extrasOp = lerp(f, [4028, 4048], [0, 1]);
  // TitleCard paints a full navy AbsoluteFill, and EndCardScene renders LAST
  // (on top of LedgeScene). SEG.outro[0]=3926 mounted that navy over the STILL
  // LIVE ledge outro — the ref holds the ledge cities+stacks through ~f3933
  // (probed white top at 3930/3933, navy by 3946) then hands off to the navy
  // endcard, but the comp buried the ledge under navy from 3926 (f3930 = 0.598,
  // the video's single worst frame). Ramp the endcard in over the ledge's own
  // out-window [3936,3946] so 3926-3936 stays transparent (ledge shows) and the
  // handoff reads as the measured ledge fade. Full opacity well before the
  // endcard content assembles (logo/mark from 3957), so nothing downstream moves.
  // The ref hands off FAST (edge-in wipe, not a uniform crossfade: white through
  // f3936-3938, ~80% navy by f3940, full navy f3946). Per-frame ref-gated:
  // ledge-showing beats navy through f3938 (0.82 vs 0.68), navy wins from f3940
  // (0.79 vs ~0.5). So hold the ledge (enterOp=0) through f3938 then snap to full
  // navy by f3940 — every transition frame then scores >= the old full-navy cover.
  const enterOp = lerp(f, [3938, 3940], [0, 1]);
  return (
    <AbsoluteFill style={{ opacity: enterOp }}>
      <TitleCard frame={f} endcard />
      {/* disclaimer: measured against ref_4110 — the ref runs larger, looser and
          dimmer than the data defaults (fs 34 / lh 1.15 / α0.75). Probed line1
          cap-top y879, cap-height ~30px (fs≈43), line pitch 60px (lh≈1.4), glyph
          colour (94,115,155) ≈ α0.5. Override inline (ENDCARD is data.ts). */}
      <SansText
        text={COPY.disclaimer}
        x={ENDCARD.disclaimer.x}
        y={864}
        fs={43}
        lineHeight={1.4}
        color="rgba(200,206,220,0.5)"
        opacity={extrasOp}
      />
      <div
        style={{
          position: "absolute",
          left: ENDCARD.urlBox.x,
          top: ENDCARD.urlBox.y,
          width: ENDCARD.urlBox.w,
          height: ENDCARD.urlBox.h,
          backgroundColor: C.white,
          opacity: extrasOp,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: SANS,
          fontSize: ENDCARD.urlFs,
          color: C.navy,
        }}
      >
        {COPY.url}
      </div>
    </AbsoluteFill>
  );
};
