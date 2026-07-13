import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { C, TITLE, HEXROW, FLOWS, GLOBE, MAP, SEG, H } from "./data";
import { useBrand } from "./brand";
import { TracedArt } from "./TracedArt";
import { ClsNetBox, Hexagon, HexIcon, SansText, SerifLabel, clamp, lerp } from "./ui";
import { ClsMark } from "../cls-shared/logo";

// Faithful swirl mark placement (measured from ref f110: white-swirl bbox
// frame x135-198 / y83-147, ~63px square). The potrace `clsLogo` mark was a
// thin crescent missing the inner comma; the shared ClsMark is the real
// swirl-with-inner-comma. Its navy disc (= background navy) also covers the
// old mark's bottom-half that still rides in the clsLogo tagline clip.
const MARK = { x: 132, y: 81, size: 68 };

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
          {/* mark: faithful shared swirl (replaces the rushed potrace
              crescent). Drawn first so its opaque navy disc covers the old
              mark's lower sliver that persists in the tagline clip below. */}
          <div style={{ position: "absolute", left: MARK.x, top: MARK.y, opacity: markOp }}>
            <ClsMark size={MARK.size} ink={C.white} bg={C.navy} />
          </div>
          <TracedArt
            name={logoArt}
            x={TITLE.logo.x}
            y={TITLE.logo.y}
            scale={1}
            opacity={lettersWipe > 0 ? 1 : 0}
            style={{ clipPath: `inset(0 ${(1 - lettersWipe) * 76.3}% 45% 23.7%)` }}
          />
          {/* bottom band, split to exclude the mark column: right part =
              CLS letter bottoms + tagline right of the mark */}
          <TracedArt
            name={logoArt}
            x={TITLE.logo.x}
            y={TITLE.logo.y}
            scale={1}
            opacity={taglineOp}
            style={{ clipPath: "inset(55% 0 0 23.7%)" }}
          />
          {/* tagline directly under the mark ("tru…") — top at 73% (frame
              y151) clears the old mark bottom (y147), tagline starts y156 */}
          <TracedArt
            name={logoArt}
            x={TITLE.logo.x}
            y={TITLE.logo.y}
            scale={1}
            opacity={taglineOp}
            style={{ clipPath: "inset(73% 76.3% 0 0)" }}
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
      {/* Supporting line — inline geometry override (data.ts untouched;
          disp-A round 2026-07-12). Measured ref-vs-replica ink bbox at f110
          (static window f100-130): ref 896×43, ink-top y283, ink-left x861;
          replica @fs38 rendered 773×36, ink-top y290 — ~19% too small and 7px
          low, the most prominent doubling in the settled-title diff. Helvetica
          cap/fs 0.947, width/fs 20.34: fs44 lands width 895≈896 (every glyph's
          left-anchored x aligned — lesson 4, position before density) + cap
          41.7≈43; fs45.4 would perfect the cap but push width to 923 (rightmost
          glyph +27px misplaced), so fs44 wins. y275 lands ink-top y283 (fs44
          strut offset ~8px). x unchanged (ink-left already 861). Same TitleCard
          renders the endcard, whose ref geometry (ENDCARD.supporting 283/38) is
          identical, so the fix carries there too. */}
      <SansText
        text={COPY.supporting}
        x={TITLE.supporting.x}
        y={275}
        fs={44}
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
        stripDy={11}
        stripLh={1.0086}
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
  // per-card strip-label vertical offset below stripY (disp-A): a 1-line label
  // sits low in the strip (card1 →+32), a 2-line block starts high (card2 →+7).
  stripDy?: number;
  // per-card strip-label line pitch (disp-A r15): the ref's 2-line block opens
  // its lines WIDER than lineHeight 1.15 puts them — card2 pitch measured 47px
  // (=fs36·1.3), not 41px. 1-line labels are pitch-agnostic, so card1 keeps 1.15.
  stripLh?: number;
}> = ({ x, y, w, h, stripY, body, strip, num, kicker, stripText, opacity = 1, growP = 1, parts, stripDy = 31, stripLh = 1.15 }) => {
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
          // strip label sized+placed to the ref (disp-A 2026-07-12). Card1
          // "Settlement risk" ink bbox at f110: ref 310×28 ink-top y642, cur
          // @fs30 rendered 200×23 ink-top y623 — ~22% short and 19px high (the
          // settled diff's second doubling; color confirmed matching dark-navy,
          // so pure size+position). fs36 lands cap 27.6≈28 for BOTH cards.
          // Vertical offset is PER-CARD (stripDy): the 1-line card1 sits low in
          // the strip (ink-top ref 642 → stripDy 32), the 2-line card2 block
          // starts high (line1 ink-top ref 621, 21px above card1 → stripDy 11).
          // A uniform +32 dropped card2 to 643 (22px low) and REGRESSED its
          // crop SSIM even though the size was right — the ink-top Y-offset
          // stayed measurable through the faded-'50'-numeral contamination and
          // exposed it. Width stays ~23% short of ref (line1 191/line2 384 vs
          // our 147/305): our Helvetica is narrower than the ref face; closing
          // it needs letterSpacing, deferred (SSIM-blind low-contrast; the ref
          // is dark-navy on teal, low-ish contrast — the FONT-FACE TEXTURE FLOOR
          // for card2). left/24 unchanged (ink-left 1358≈ref 1358).
          //
          // r15 (per-LINE probe, dark-navy R<45 mask over the label window,
          // static f110≡f120): the 2-line block's INTER-LINE PITCH was the
          // residual, not size. Ref line1 cap-top 621 / line2 cap-top 668 →
          // pitch 47px; ours (lineHeight 1.15 = fs36·1.15 = 41px) sat line2 at
          // 663, 5px HIGH. lineHeight 1.3 (=47/36) opens the pitch to the ref;
          // but the extra half-leading also drops line1 ~2.7px, so stripDy 11→7
          // re-seats line1 at 621. Both lines now land ≤1px of ref. lineHeight
          // is PER-CARD (stripLh) — card1 is 1-line and pitch-agnostic, keeps
          // 1.15. The \n is explicit + no width on this div, so opening the
          // pitch cannot re-wrap the block.
          //
          // ═══ r20: THE CAPTION WAS 23% TOO SMALL, AND THE CAP-HEIGHT READ THAT
          // SET fs36 WAS SIMPLY WRONG. ═══
          // r15 measured "ref 310×28" and fitted fs36 to the 28. The ref ink is
          // **311 × 35.5**, not 311 × 28. Both dimensions then say the SAME thing:
          //   cap1  width ref 311 / ours 240 = 1.296  ·  height ref 35 / ours 28 = 1.29
          //   cap2  width ref 395 / ours 305 = 1.295  ·  ink mass ref/ours = 1.63
          // A width ratio and a height ratio agreeing to 0.5% are not a font-face
          // problem — they are a SIZE problem. r15 saw the 23% width shortfall, blamed
          // "our Helvetica is narrower than the ref face", and deferred it to
          // letterSpacing. There was never a face-width gap: at the correct size the
          // widths land within 1.4%. **A wrong measurement was enshrined as a law and
          // then defended with a theory** (r19's payment box, again).
          // fs 46.6 lands BOTH widths exactly (240→311, 305→395) and the cap at 36.
          // Measured identically at the TITLE (f110/f120) and the ENDCARD (f4090/
          // f4141) — one component, one ref geometry — so the fix pays at both, and
          // the endcard holds it for a 130-frame hold.
          // Pitch stays 47px, so stripLh follows the size: 47/46.6 = 1.0086.
          top: stripY - y + stripDy,
          fontFamily: SANS,
          fontSize: 46.6,
          lineHeight: stripLh,
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

// ═══ Title outro (f133-151): the title TURNS, and a slit opens down its spine ═══
//
// r20. The old build was fiction: a white diagonal wipe sweeping in from the RIGHT
// while the title drifted up-left, with the panel held HORIZONTAL ("no rotation —
// the −10° tilt was invented"). The reference does none of that. At f140 that wipe
// painted WHITE over ~950×1080 of frame that the ref still holds NAVY — half the
// frame at maximum contrast. It was the worst frame in the file: **f140 = 0.707**.
//
// What the reference actually does, measured two independent ways that agree:
//
//   1. The WHOLE title rotates CLOCKWISE about the frame centre (960,540), with
//      ZERO translation. Tracking two features on opposite sides of the frame —
//      the CLS logo (x≈288) and the Principle-50 card (x≈1540) — a pure rotation
//      about (960,540) predicts BOTH to ≤3px through f141 (logo +1.1,-0.3 @f134
//      … +5.2,+2.3 @f141; card50 +0.1,+0.9 … -3.8,+1.1). The r19-era `dx`/`dy`
//      drift does not exist.
//   2. A white SLIT opens down the panel's spine and widens. Its two edges stay
//      exactly PARALLEL at every frame, and its centre line passes through
//      (959.5, 540) at EVERY frame — 959.5 at f136, f138, f140, f142, f144, f146,
//      f147, f148. Dead constant. The slit is a vertical strip in the panel's own
//      frame, centred on the pivot.
//
// The proof the two are one motion: the slit-edge angle and the CONTENT rotation
// angle, measured from completely different pixels, agree to <0.15° at every
// frame — 0.77/0.82 · 1.90/1.99 · 3.79/3.87 · 6.67/6.89 · 11.67/11.63 · 15.45/15.60.
//
// So: rotate the panel, cut a widening vertical slit at local x=959.5, let white
// through. Two tables, no free parameters. The model reproduces every measured
// screen edge to ≤3.4px — at f148 it predicts the navy edges at x=858.5 / 2140.5
// and the ref measures 858 / 2139.
//
// The navy plane is SEMI-INFINITE (an oversized rect behind the children). A
// 1920×1080 fill rotated 45° would expose white at the corners where the ref is
// still navy — the same class of bug as the r18 strip slit.
const OUT_F = [132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151];
// clockwise degrees, screen coords (CSS rotate positive = CW)
const OUT_A = [0, 0.10, 0.20, 0.45, 0.79, 1.28, 1.94, 2.77, 3.83, 5.16, 6.78, 8.94, 11.65, 15.52, 20.81, 29.49, 45.0, 60.4, 69.0, 73.0];
// HORIZONTAL width of the slit at y=540 (screen px). Perpendicular width = G·cos A.
const OUT_G = [0, 0, 2.5, 7.2, 14.9, 25.2, 38.9, 56.6, 79.3, 107.6, 142.3, 188.2, 248.8, 332.8, 459.7, 696.1, 1282, 2422, 3767, 5042];
const SPLIT_X = 959.5; // slit centre in panel-local coords == the pivot
const PIVOT = { x: 960, y: 540 };

const NavyPlane: React.FC = () => (
  <div style={{ position: "absolute", left: -2000, top: -2000, width: 5920, height: 5080, backgroundColor: C.navy }} />
);

export const TitleOutro: React.FC<{ frame: number; children: React.ReactNode }> = ({
  frame,
  children,
}) => {
  // Static title. Returned bare so the settled window (f0-132) stays byte-identical.
  if (frame < 133) return <>{children}</>;
  const A = interpolate(frame, OUT_F, OUT_A, clamp);
  const G = interpolate(frame, OUT_F, OUT_G, clamp);
  const rot = { transform: `rotate(${A}deg)`, transformOrigin: `${PIVOT.x}px ${PIVOT.y}px` } as const;
  // Slit half-width measured PERPENDICULAR to the panel's local vertical.
  const p = (G / 2) * Math.cos((A * Math.PI) / 180);
  // Below ~1.5px the slit is sub-pixel; drawing it as two adjacent clips would
  // only risk an antialiased hairline through a still-whole panel.
  if (G < 1.5) {
    return (
      <AbsoluteFill style={rot}>
        <NavyPlane />
        {children}
      </AbsoluteFill>
    );
  }
  const L = SPLIT_X - p;
  const R = SPLIT_X + p;
  return (
    <AbsoluteFill style={rot}>
      <AbsoluteFill style={{ clipPath: `polygon(-2000px -2000px, ${L}px -2000px, ${L}px 3080px, -2000px 3080px)` }}>
        <NavyPlane />
        {children}
      </AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `polygon(${R}px -2000px, 3920px -2000px, 3920px 3080px, ${R}px 3080px)` }}>
        <NavyPlane />
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
// r18: the flows hex row was drawn 6% SMALL and ~5px off — a structural error a
// prior round mis-filed as the "hex line-art texture floor". Measured navy-outline
// bboxes (ref v_330..v_450 — PIXEL-IDENTICAL at every frame, so one static fit):
//   ref  h0 x[215,530] y[197,477]   h1 x[610,925] y[202,482]
//        h2 x[999,1315] y[202,483]  h3 x[1380,1696] y[202,482]   (w 316-317, h 281-282)
//   ours (HEXROW hexW 320 → HexIcon scale 320/340 = 0.941) rendered w 298, h 264.
// Back out the trace's native size: 298/0.941 = 316.6, 264/0.941 = 280.5 — i.e. the
// potrace IS the ref's own art at scale 1.0. So hexW must be 340, not 320. With
// scale 1.0 the per-art native ink offsets (backed out of the OLD render, per hex)
// put the ref bboxes at cx 370/760/1150/1540 (pitch 390 held) and cy 334.
// Re-deriving every rendered edge from these lands within 1px of the ref at all
// four hexes. NOT a re-draw (lesson: re-drawing traced art LOSES) — the same trace,
// at its true size and place. data.ts HEXROW is left alone (scenesA is its only
// consumer; kept as the historical value).
const HEXFIT = { centers: [370, 760, 1150, 1540], cy: 334, hexW: 340 } as const;
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

// Pill ENTRY (r18). Each pill flies in toward the band and they land one per
// frame, innermost first — so a pill's only parameter is its RANK outward from
// the band within its own stack-half. Measured dy curve (identical for every
// pill of every stack, both pages, up and down): 179 → 98 → 48 → 19 → 4 → 0.
// Ref check, unfitted: the last-ranked pill of page 1 starts f370 and settles
// f375; of page 2 starts f423 and settles f428 — exactly where the ref settles.
const pillDy = (t: number) =>
  interpolate(t, [0, 1, 2, 3, 4, 5], [179, 98, 48, 19, 4, 0], clamp);

// Pill COLLAPSE, page 1 (r18). The page does NOT squash. We scaled it (scaleY
// 1→0 about the band), which shrinks every pill; the ref keeps pill HEIGHTS
// exactly — as the ENTRY does — and slides each half RIGIDLY into the band,
// where the pills vanish underneath it. Solved by cross-correlating each frame's
// ink profile against the settled (f405) profile, per stack; all four stacks
// agree (ncc .994-1.000):
//     f      405  406  407  408  409  410  411    412
//   above      0    1    6   17   41  128  215*   gone
//   below      0    1    5   14   34  105  176    gone
// The halves are NOT symmetric — above travels 1.21× below at every frame.
// (*by f411 every above pill is past the clip at every stack, so its dy is
//  unmeasurable; 215 is the 1.21 ratio, and ANY value ≥ 178 renders identically.)
// The model is self-validating. At f411 it predicts that only stack 1 still shows
// ink — its lowest pill (settled top 1001) lands at 825-854 and the band eats all
// but rows 846-854, while every other stack's lowest pill ends above 846. Stack 1
// is exactly the one the ref still shows there: a 9-row tan sliver at 846-855.
const collapseAbove = (f: number) =>
  interpolate(f, [405, 406, 407, 408, 409, 410, 411], [0, 1, 6, 17, 41, 128, 215], clamp);
const collapseBelow = (f: number) =>
  interpolate(f, [405, 406, 407, 408, 409, 410, 411], [0, 1, 5, 14, 34, 105, 176], clamp);

const rankField = (field: FlowPill[]): number[] => {
  const groups = new Map<string, FlowPill[]>();
  for (const p of field) {
    const k = `${Math.round(p[0] / 100)}|${p[1] < 819 ? "a" : "b"}`;
    const g = groups.get(k);
    if (g) g.push(p);
    else groups.set(k, [p]);
  }
  const rank = new Map<FlowPill, number>();
  groups.forEach((ps) => {
    const above = ps[0][1] < 819;
    [...ps]
      .sort((a, b) => (above ? b[1] - a[1] : a[1] - b[1]))
      .forEach((p, i) => rank.set(p, i));
  });
  return field.map((p) => rank.get(p) ?? 0);
};
const RANK1 = rankField(FLOW_FIELD1);
const RANK2 = rankField(FLOW_FIELD2);

export const HexRowFlows: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  if (f < SEG.hexRow[0] || f >= 468) return null;
  const inOp = lerp(f, [322, 334], [0, 1]);
  // CURRENCY LABELS — r18 re-measure. A prior pass fitted fs from a cap height of
  // ~117; the real ref cap is 101-102 (USD f400 y[702,803], EUR f440 y[704,803],
  // CNH/CZK y[846,946]). fs120 renders cap 87 — 15% SHORT. fs139 lands cap 101.
  // They are also CENTRE-anchored, not left: ref ink centres are USD 1688.0 /
  // CNH 1688.5 / EUR 1690.0 / CZK 1690.5 — one axis at x≈1689, which the old
  // left-x pair (1547/1553) could not hold (CNH is 35px wider than CZK, so a
  // shared left edge throws it off-axis). align=center about 1689 fixes all four.
  // FILL — probed as the MODE of the deepest glyph pixels (v_400 + v_440, so the
  // AA fringe cannot drag the reading): the ref's top label is plain brand navy
  // (0,39,83), not C.serifNavy (18,54,91); the bottom is (231,81,38), far brighter
  // and more saturated than C.orangeDeep (199,77,51). ~30k px of solid glyph each.
  // Passed inline — data.ts's serifNavy/orangeDeep keep serving their other sites.
  const LAB = { cx: 1689, boxW: 500, fs: 139, topCap: 703, botCap: 844 };
  const LAB_TOP_COLOR = C.navy;
  const LAB_BOT_COLOR = "#E75126";
  const labX = LAB.cx - LAB.boxW / 2;
  // ENTRY — the pair FLIES IN, converging on the band; we faded it up in place.
  // Ref ink-top tracked per frame (navy y500-802 / orange y800-1079, v_365..v_377
  // and v_418..v_430): the two pages ride ONE curve, offset by exactly 53f (page1
  // opens f365, page2 f418), symmetric top-vs-bottom to ±1px, and there is NO
  // opacity ramp — the glyphs pop on at full colour (darkest-decile value is flat
  // 30-35 navy / 110-113 orange from the first frame). Tables ARE the measurement;
  // both are anchored in the SAME predicate family as topCap/botCap (mixing a
  // generic-ink anchor with an orange-ink table put the bottom label 5px high and
  // that alone turned the f420 gate NEGATIVE — lesson 4, again).
  const dyTop = (t: number) =>
    interpolate(t, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      [-157, -157, -113, -80, -54, -35, -21, -11, -5, -1, 0], clamp);
  const dyBot = (t: number) =>
    interpolate(t, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [226, 162, 116, 82, 56, 36, 22, 12, 5, 0], clamp);
  // EXIT — page 1 does NOT fade out: it COLLAPSES into the band, the same gesture
  // the pill field makes. Measured heights (USD 102 → 86/54/31/14/3 over f406-410,
  // CNH 101 → 82/45/17/gone) = a scaleY about the band, s below.
  const aScale = interpolate(f, [405, 406, 407, 408, 409, 410, 411],
    [1, 0.85, 0.5, 0.24, 0.1, 0.02, 0], clamp);
  const pageAOn = f >= 365 && f < 411;
  const pageBOn = f >= 418;
  // box draws with the hexes (ref video: box bar starts ~f324, near-full by
  // f332); the old 330-344 left it a faint grey ghost through the hexify
  const boxOp = lerp(f, [324, 336], [0, 1]);
  // EXIT — the whole layout slides LEFT with acceleration, NO fade; band stays.
  // r6 keyed it every other frame; r18 re-tracked it EVERY frame (hex-band navy
  // left AND right edges move identically, so the slide is rigid — v_448..v_466).
  // The old table's even frames were right but its interpolated odd frames sat
  // 3-9px off, and f464/f465 were off by 26/177px. On hex line-art a 3px
  // misregistration is not small: it took the hex-row crop from .961 to .706 at
  // f455. Per-frame keys, exactly as measured.
  const shift = interpolate(
    f,
    [448, 449, 450, 451, 452, 453, 454, 455, 456, 457, 458,
     459, 460, 461, 462, 463, 464, 465, 466],
    [0, 0, -1.5, -7.5, -17, -31, -51, -77, -111, -153, -207,
     -273, -358, -466, -608, -803, -1094, -1595, -2200],
    clamp
  );

  // RULER BAND — r18. The band was drawn 0→1920 linearly over f366-384. The ref
  // starts it at f349 and finishes at f374, on a hard ease (slow → ~320px/f at
  // f356-357 → a long decel tail). Right-edge tracked per frame off the ref
  // (grey run at row 825, v_346..v_378) — the whole table below IS the measurement.
  // OLD drew NOTHING at f360 where the ref has 1539px of band, and 427px at f370
  // where the ref has 1883: ~63k px of flat grey missing, every frame of the entry.
  // Also probed: band rows y805-845 (h 41) — FLOWS.rulerY/rulerH (806/38) sat 1px
  // low and 3px short. Inline; data.ts untouched (GlobeScene's f468+ band, which
  // takes over at 805/h40, is unaffected — HexRowFlows is gone by then).
  const BAND_Y = 805;
  const BAND_H = 41;
  const bandW = interpolate(
    f,
    [348, 349, 350, 351, 352, 353, 354, 355, 356, 357, 358, 359, 360, 361,
     362, 363, 364, 365, 366, 367, 368, 369, 370, 371, 372, 373, 374],
    [0, 23, 63, 121, 192, 275, 397, 579, 821, 1143, 1327, 1449, 1539, 1611,
     1663, 1713, 1751, 1783, 1811, 1835, 1855, 1871, 1883, 1897, 1907, 1913, 1920],
    clamp
  );
  return (
    <AbsoluteFill>
      {/* ruler band: STATIC — content slides off over it (r6 probed: band
          y805-843 stays put through the push; ticks ride the slide) */}
      {bandW > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: BAND_Y,
            width: bandW,
            height: BAND_H,
            backgroundColor: C.band,
          }}
        />
      )}
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${shift}px)` }}>
        {/* ticks ride inside the band as it sweeps right (ref: present from the
            first frames of the grow, not only at settle). The ref's tick phase
            drifts a few px/f; not modelled — 13 ticks × 2.5×20px is 650px of ink,
            below the noise floor, and the settled phase already lands within 2.5px. */}
        {Array.from({ length: 14 }, (_, i) => {
          const tx = FLOWS.tickX0 + i * FLOWS.tickEvery;
          if (tx + 2.5 > bandW) return null;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: tx,
                top: BAND_Y + 2,
                width: 2.5,
                height: 20,
                backgroundColor: C.navy,
              }}
            />
          );
        })}
        {/* hexagons */}
        {HEX_ARTS.map((a, i) => (
          <HexIcon
            key={a}
            art={a}
            cx={HEXFIT.centers[i]}
            cy={HEXFIT.cy}
            w={HEXFIT.hexW}
            opacity={inOp}
          />
        ))}
        {/* CLSNet box. The ref's navy RECT is x824-1092 / y673-941 (pixel-identical
            at f400 and f430); HEXROW.box draws it at 823/675 — 1px left, 2px low.
            But the MARK inside it is already pixel-exact at 823/675 (moving the box
            alone took the mark crop from .936 to .736), so the ref offsets the mark
            from the rect by (−1,+2) — the same human-layout slip artDx/artDy were
            added for at strip2. Move the rect, hold the mark. The label follows the
            rect, which is what the ref does.
            Nudged HERE, not in data.ts: scenesB's tradeDocs box reuses these numbers
            and the ref puts THAT one 12px higher (y661 at f1450) — one constant, two
            different truths. */}
        <ClsNetBox x={HEXROW.box.x + 1} y={HEXROW.box.y - 2} artDx={-1} artDy={2} opacity={boxOp} />
        {/* pill fields — the ENTRY was backwards. We squashed the whole page
            INWARD toward the band (scaleY 0.15→1) and let it expand out. The ref
            does the opposite and does it per pill: every pill FLIES IN from far
            outside, converging on the band, and the pills arrive one per frame,
            innermost first. Decoded by tracking each stack's pill spans frame by
            frame (v_365..v_377 stacks 1 and 4): pill heights never change — only
            their POSITIONS converge — and every pill rides ONE curve, offset by
            its rank outward from the band. Page 2 is the same curve +53f, exactly
            like the labels. Both settle where the ref settles (page1 f375,
            page2 f428) with no fitting.
            The COLLAPSE is the same grammar, reversed: page 1 slides each half
            rigidly INTO the band and the band eats it — heights never change
            there either (tables above). The old scaleY squashed the pills, which
            the ref never does. Each half is clipped at its own band edge, so a
            pill that reaches the band disappears instead of emerging out the far
            side; that clip is a no-op at every other frame (settled above pills
            end at y800 < 805, below pills start at y846 > 845, and the entry only
            ever moves them AWAY from the band). */}
        {[FLOW_FIELD1, FLOW_FIELD2].map((field, fi) => {
          const base = fi === 0 ? 366 : 419;
          const ranks = fi === 0 ? RANK1 : RANK2;
          if (f < base || (fi === 0 && f >= 412)) return null;
          const cA = fi === 0 ? collapseAbove(f) : 0;
          const cB = fi === 0 ? collapseBelow(f) : 0;
          return (
            <React.Fragment key={fi}>
              {[true, false].map((above) => (
                <div
                  key={String(above)}
                  style={{
                    position: "absolute",
                    inset: 0,
                    // page 1 only: page 2 never reaches the band, and clipping it
                    // re-rasterised 6 AA pixels on the pills that sit exactly on
                    // the y846 line — a regression for nothing
                    clipPath:
                      fi === 0
                        ? above
                          ? `inset(0 0 ${H - BAND_Y}px 0)`
                          : `inset(${BAND_Y + BAND_H}px 0 0 0)`
                        : undefined,
                  }}
                >
                  {field.map(([x, y, w, h, color], i) => {
                    if (y < 819 !== above) return null;
                    const t = f - base - ranks[i];
                    if (t < 0) return null;
                    const dy = above ? cA - pillDy(t) : pillDy(t) - cB;
                    return (
                      <div
                        key={i}
                        style={{
                          position: "absolute",
                          left: x,
                          top: y + dy,
                          width: w,
                          height: h,
                          backgroundColor: color,
                          borderRadius: above ? "2px 13px 2px 13px" : "13px 2px 13px 2px",
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </React.Fragment>
          );
        })}
        {/* currency pair labels — fly in converging on the band, page 1 collapses
            back into it (f406-410), page 2 rides the scene off on `shift` */}
        {pageAOn && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `scaleY(${aScale})`,
              transformOrigin: "960px 828px",
            }}
          >
            <SerifLabel text="USD" x={labX} width={LAB.boxW} align="center" capTop={LAB.topCap + dyTop(f - 365)} fs={LAB.fs} color={LAB_TOP_COLOR} />
            <SerifLabel text="CNH" x={labX} width={LAB.boxW} align="center" capTop={LAB.botCap + dyBot(f - 365)} fs={LAB.fs} color={LAB_BOT_COLOR} />
          </div>
        )}
        {pageBOn && (
          <>
            <SerifLabel text="EUR" x={labX} width={LAB.boxW} align="center" capTop={LAB.topCap + dyTop(f - 418)} fs={LAB.fs} color={LAB_TOP_COLOR} />
            <SerifLabel text="CZK" x={labX} width={LAB.boxW} align="center" capTop={LAB.botCap + dyBot(f - 418)} fs={LAB.fs} color={LAB_BOT_COLOR} />
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ═══ Scene 5: Globe + lock (f462-566) ═══
//
// ═══ r20: THE WHOLE GLOBE ASSEMBLY WAS ~3% TOO SMALL ═══
// The disc is STATIC f484-556 — every per-frame read of its bbox is identical to
// the pixel — so this is measured on bedrock, not on a moving target:
//   ref navy disc stroke, row y=540:  x 661-665  and  1253-1257
//        → OUTER radius 298.2 · stroke 5px · centre x 959.0
//   ref column x=959: navy y 242-245 / 834-837   → centre y 539.5
//   ref grey ring OUTER edge: x=615 at row 540, y=884 at col 959 → radius 344.3
// We drew r=293 (outer) with a 4px stroke, and ringR=335. So:
//   · our navy circle sat at r 289-293 where the ref draws 293-298. **FULLY
//     DISJOINT** — ~9,000px of navy ink lighting BOTH edges (lesson 4: misplaced
//     ink loses to absent ink), against the brightest possible ground.
//   · our grey annulus stopped 10px short, leaving a ~21,000px white ring the ref
//     fills with grey. Gain ∝ area (law 18); this is the area.
// SAFE TO RESCALE (law 21): the continents are a disc-clipped WINDOW onto worldMap
// whose SCREEN origin is `mox`/`moy` — computed independently of `dr`. Growing the
// disc does not drag the interior off; it only uncovers map the ref already shows.
// This is an EDGE-POSITION fix on drawn primitives, not a re-scale of an invented
// interior — which is exactly the case law 21 says pays.
// Local, because data.ts is another lane's file this round. GLOBE.r/ringR there are
// now stale; fold these back and delete these constants.
const G_CX = 959;
const G_CY = 539.5;
const G_R = 298; // disc OUTER radius (was 293)
const G_RING = 344; // grey ring OUTER radius (was 335)
const G_STROKE = 5; // navy disc border (was 4)
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
  // r21: the padlock CLOSES at f522, not f528. Shackle crops f515/517/519/521/523
  // show it open (hook leaning right) through f521 and fully closed (symmetric
  // arch) at f523 — the ref lock is CLOSED at both gated globe frames (523, 548).
  // The old 528 threshold left it "lockList" (open shackle, bottom dot still grey)
  // at f523. Only f522-527 change (open→closed), all toward the ref; no regression.
  const lockState = f < 500 ? "lockOpen" : f < 522 ? "lockList" : "lockClosed";
  const lockOp = lerp(f, [470, 480], [0, 1]);
  // GLOBE→MAP ZOOM (anim round, eye-measured; work/clsnet/anim/zoom). The disc
  // is a WINDOW onto the same worldMap the MapScene shows in full. At the
  // handoff the disc GROWS to full-bleed (center pinned 960/539) while its map
  // ramps to MapScene's scale (0.76→1.0) and origin (→MAP.x/y), so continents
  // zoom SEAMLESSLY into the full map — the disc IS the zoom. Radius measured
  // clean from the disc's left edge (ring hides it ≤f561): r 293 held to f556,
  // then 424(f562) 569(f564) 830(f566) → full-bleed f568. Replaces the old
  // cross-dissolve (globe FADED out under an expanding blue rect + fading map).
  // NOTE (r20): the zoom keys below (330/375/424/569/830) are NOT re-verified —
  // only the f556 anchor changes here, because that anchor IS the settled radius.
  // Measuring the ref's disc edge mid-zoom defeats a run-scan (the white continent
  // outlines cut the blue run, and the grey ring hides the border to f561), so the
  // curve needs a real edge tracker. Left as a named residual, not guessed at.
  const dr = interpolate(
    f,
    [556, 558, 560, 562, 564, 566, 568],
    [G_R, 330, 375, 424, 569, 830, 1200],
    clamp
  );
  const mapScale = interpolate(f, [556, 568], [MAP_SCALE, 1], clamp);
  const mox = f < 556 ? mapOx : interpolate(f, [556, 568], [525, MAP.x], clamp);
  const moy = interpolate(f, [556, 568], [mapOy, MAP.y], clamp);
  const discLeft = G_CX - dr;
  const discTop = G_CY - dr;
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
          width={2 * G_RING + 40}
          height={2 * G_RING + 40}
          viewBox={`0 0 ${2 * G_RING + 40} ${2 * G_RING + 40}`}
          style={{
            position: "absolute",
            left: G_CX - G_RING - 20,
            top: G_CY - G_RING - 20,
            opacity: ringFade,
          }}
        >
          <g transform={`rotate(${ringSpin} ${G_RING + 20} ${G_RING + 20})`}>
            {/* grey annulus: spans the disc's outer edge (G_R) to G_RING — the ref
                fills 298→344; we filled 293→335. */}
            <circle
              cx={G_RING + 20}
              cy={G_RING + 20}
              r={(G_RING + G_R) / 2}
              fill="none"
              stroke={C.band}
              strokeWidth={G_RING - G_R}
            />
            {Array.from({ length: 48 }, (_, i) => {
              const a = (i * Math.PI * 2) / 48;
              const long = i % 2 === 0;
              const r0 = G_R - 4;
              const r1 = long ? G_RING + 14 : G_RING - 4;
              return (
                <line
                  key={i}
                  x1={G_RING + 20 + r0 * Math.sin(a)}
                  y1={G_RING + 20 - r0 * Math.cos(a)}
                  x2={G_RING + 20 + r1 * Math.sin(a)}
                  y2={G_RING + 20 - r1 * Math.cos(a)}
                  stroke={C.navy}
                  strokeWidth={1.6}
                />
              );
            })}
            {["23:00", "00:00", "06:30", "07:00", "09:00"].map((t, i) => {
              const a = ((i * 47 - 8) * Math.PI) / 180;
              const rr = G_RING + 28;
              return (
                <text
                  key={i}
                  x={G_RING + 20 + rr * Math.sin(a)}
                  y={G_RING + 20 - rr * Math.cos(a)}
                  fontFamily={SANS}
                  fontSize={20}
                  fill={C.navy}
                  transform={`rotate(${(a * 180) / Math.PI} ${G_RING + 20 + rr * Math.sin(a)} ${G_RING + 20 - rr * Math.cos(a)})`}
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
        {/* lock — beneath the disc; covered as the disc grows past it.
            r20: the lock's DROP SHADOW was TAN. All three lock traces carry an
            `#E9C8B0` layer (233,200,176 — peach); the ref's shadow is flat GREY,
            **#D7D7D7** (215,215,215, n=2991 exact pixels in the lock box at f522).
            potrace put a warm colour on a neutral shadow and eighteen rounds read
            past it. Recoloured at the call site because art.ts is another lane's
            file this round — the layer itself should be re-fill'd there.
            The shadow is also ~2× too BIG (ours 6019px of flat fill vs the ref's
            2991): a geometry error in the trace, NOT fixable from here. Reported. */}
        <TracedArt
          name={lockState}
          x={GLOBE.lock.x}
          y={GLOBE.lock.y}
          opacity={lockOp}
          recolor={{ "#E9C8B0": "#D7D7D7" }}
        />
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
            border: `${G_STROKE}px solid ${C.navy}`,
            boxSizing: "border-box",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ═══ Scenes 6-7: full-bleed map, hexes, 120 currencies (f568-745) ═══
//
// ═══ r21: THE SEVEN MINI-HEXES POPPED IN 60 FRAMES TOO LATE, AND TWO OF THEM
//          NEVER GREW A WHITE HEX AT ALL ═══
// SCHEDULE (law 26 — schedule errors dominate). The pop was `pop = 600 + i*9`,
// so mHexHeli (i0) opened f600 but mHexCity2 (i6) not until f654. At f606 only
// Heli had started and the OTHER SIX HEXES WERE ABSENT — six white hexes of
// missing content on a flat map, every frame f600-654. The reference pops them
// ALL together by ~f605: each hex SCALES up from ~0.7 and is full by then
// (ref Towers2 crop f600 ~70% → f606 100%). Office & Sail lead (~f586-600),
// Heli/Bank/Bank2 next (~f590-602), Towers2/City2 trail to ~f605. Per-hex
// [start,end] below is that measurement; ALL full by ~f604, so the earliest
// gated frame f606 sees seven full hexes — the r21a first cut ran the trail
// pair to f610 and left them 67%-scale at f606, which REGRESSED it (partial
// hex vs the ref's full one), a scale-transient the gate caught.
const HEX_POP: Record<string, [number, number]> = {
  mHexHeli: [590, 602],
  mHexOffice: [586, 599],
  mHexBank: [588, 601],
  mHexBank2: [589, 602],
  mHexTowers2: [594, 604],
  mHexSail: [588, 600],
  mHexCity2: [594, 604],
};
// MISSING WHITE HEX (law 17/18, ~5% of frame across the two). mHexHeli and
// mHexCity2's potrace arts carry ONLY [#002753 buildings, #D45837, #A8A8A8] —
// they lack the #FFFFFF fill AND the navy hex-border path that the other five
// arts bake as their first two layers. Both therefore rendered as bare building
// line-art floating on blue; white(ref)−blue(mine) is the solid-orange fill the
// difference composite lit up over each hex. The ref draws all seven as a white
// hex + navy border. Measured ref navy-border outer bbox (f723): w199 h177,
// flat-top span 100 (= 0.5·w) → the existing Hexagon at w199/h177 reproduces it
// (its default h=0.906w renders 4px too tall, so h is passed). Centres are the
// ref navy-border centres. The backing rides the same pop scale s and returns
// null with the hex; NetworkScene already backs these two from f756+, so this
// only fills the MapScene gap. NOT a hex-slope edit (that is the reserved lane).
const HEX_BG: Record<string, { cx: number; cy: number }> = {
  mHexHeli: { cx: 378, cy: 405 },
  mHexCity2: { cx: 1463, cy: 709 },
};
export const MapScene: React.FC<{ frame: number }> = ({ frame }) => {
  // (the label copy is no longer one string — see the label block below)
  const f = frame;
  // Picks up exactly where the GlobeScene zoom ends (f568): full-bleed blue +
  // the full worldMap at scale 1.0 / MAP origin — identical to the disc's
  // final state, so the handoff is a seamless continuation, not a cross-fade.
  if (f < 568 || f >= 766) return null;
  // ═══ r20: "120 currencies" — three errors, one of them a returning ghost ═══
  // Ref, settled (f730) and ink-counted per frame f660-746:
  //   digits "120"   x 764-872 (w 108) · ink-top 951 · h 52
  //   word "currencies" x 895-1217 (w 322) · ink-top 951 · h 52
  //   Both 52px tall from the same top: the ref's figures are LINING.
  // Ours (fs64 SerifLabel from x760): ink 764-1168 — w 405, **11% narrow** — and
  // ink-top 969, **18px LOW**. Worse: Georgia's figures are OLDSTYLE, so our "120"
  // rendered ink-top 982 / height 36 — 16px short and 31px BELOW the word's cap,
  // where the ref's digits are flush with it. `PrincipleCard` already hit this exact
  // trap and moved its numerals to Didot; the lesson never reached this label.
  // (Law 27, one level up: the same defect twice, because the knowledge lived in a
  // comment at one call site instead of in the primitive.)
  //
  // SCHEDULE — the fiction. The ref draws NO "currencies" AT ALL before f688: ink is
  // exactly 0 from f660 to f688, first appears f690 (50px), and settles f704. We
  // faded the whole label in over f672-684 — ~3,580px of word ink, ~18 frames early,
  // held against a flat blue ground. Ink-count the reference per element per frame
  // BEFORE fitting any curve (law 26); the count is unambiguous here.
  //
  // The digits are an ODOMETER. Their ink oscillates while the glyphs visibly roll
  // (263 · 1093 · 325 · 1081 · 1377 · 1656), gaining a third digit ~f688 and settling
  // on 120 at f702. NOT MODELLED — reproducing the roll needs per-slot scroll tables
  // I did not measure. A static "120" in the ref's own box is still far closer than an
  // oldstyle "120" 31px below it. Named residual; do not read this as "the digits are
  // done".
  const labelOut = lerp(f, [756, 764], [1, 0]);
  const digitsOp = lerp(f, [668, 702], [0, 1]) * labelOut;
  const wordOp =
    interpolate(f, [688, 690, 692, 694, 696, 704], [0, 0.02, 0.47, 0.72, 0.95, 1], clamp) * labelOut;
  // Didot for the digits: LINING figures. fs from the ref's 52px digit height
  // (Didot cap/fs 0.786, measured off PrincipleCard's '35': 173px ink at fs220).
  // Fitted on a probe render (not guessed): at digFs 66 / digX 760 / digTop 942 the
  // Didot "120" rendered x 765-861 (w 97) ink-top 947 h 50, so its left side-bearing
  // and its top gap are BOTH 0.0758·fs. Ref wants w 108, ink-top 951.
  // Width says fs 73.5, height says fs 68.6 — Didot's digit proportions are not the
  // ref face's, so they cannot both land. WIDTH WINS (lesson 4: the advances set every
  // glyph's x; a height overshoot only thickens the row). fs 72 splits it: w 105.8
  // (ref 108) and h 54.5 (ref 52). Residual: the digit row runs ~3px deep.
  // The word landed on the probe at x 894-1216 (ref 895-1217) with ink-top 951 EXACT
  // — +1 on wordX closes it.
  const LBL = {
    digX: 758,
    digTop: 945,
    digFs: 72,
    wordX: 893,
    wordCap: 954,
    wordFs: 71.3,
  };
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
          const [p0, p1] = HEX_POP[hx.art];
          let s = lerp(f, [p0, p1], [0, 1]);
          if (start === undefined) s *= lerp(f, [750 + i * 2, 756 + i * 2], [1, 0]);
          if (s <= 0) return null;
          const bg = HEX_BG[hx.art];
          return (
            <React.Fragment key={hx.art}>
              {bg && (
                <Hexagon
                  cx={bg.cx}
                  cy={bg.cy}
                  w={199 * s}
                  h={177 * s}
                  fill={C.white}
                  stroke={C.navy}
                  strokeWidth={3 * s}
                />
              )}
              <div
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
            </React.Fragment>
          );
        })}
        {/* digits — own element, own clock, Didot for LINING figures */}
        {digitsOp > 0 && (
          <div
            style={{
              position: "absolute",
              left: LBL.digX,
              top: LBL.digTop,
              fontFamily: "Didot, 'Times New Roman', serif",
              fontWeight: 400,
              fontSize: LBL.digFs,
              lineHeight: 1,
              color: C.serifNavy,
              opacity: digitsOp,
              whiteSpace: "pre",
            }}
          >
            120
          </div>
        )}
        {/* word — does not exist in the ref before f688 */}
        <SerifLabel
          text="currencies"
          x={LBL.wordX}
          capTop={LBL.wordCap}
          fs={LBL.wordFs}
          color={C.serifNavy}
          opacity={wordOp}
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
// GREY_FACE: the r6 network traces mis-classified the light-grey building
// faces of the heli/bank2 hexes as tan #E9C8B0 (probed f890: ref neutral
// grey ~215/215/215 where the trace paints peach). Recolour those two hexes'
// tan layer back to light grey; the bank/city2 hexes keep tan (their few tan
// px sit on genuinely warm orange edges — ref R−B ≈ 76 there, confirmed).
const GREY_FACE: Record<string, string> = { "#E9C8B0": "#D6D6D6" };
type NetHex = { art: string; from: [number, number]; to: [number, number]; f0: number; f1: number; recolor?: Record<string, string> };
const NET_HEXES: NetHex[] = [
  { art: "mHexHeliL", from: [375, 405], to: [393, 409], f0: 758, f1: 770, recolor: GREY_FACE },
  { art: "mHexBankL", from: [555, 765], to: [774, 678], f0: 760, f1: 772 },
  { art: "mHexBank2L", from: [1105, 425], to: [1179, 414], f0: 758, f1: 770, recolor: GREY_FACE },
  { art: "mHexCity2L", from: [1460, 715], to: [1594, 650], f0: 756, f1: 768 },
];

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
      {/* White hex-interior backing. The mHex*L potrace faces are a stack of
          separate per-colour polygons (white/navy/orange/grey/tan) that do
          NOT perfectly abut — sub-pixel gaps thread the whole face. Against
          the blue scene bg those gaps read as ghost blue hairlines beside
          every stroke ("doubled/rushed" look; probed f890: #4CA0D3 = 76,160,211
          bleeding through, 8119 interior px). The ref hex interior is solid
          white. One clean vector hex behind each art fills every gap; sized to
          land just inside the navy border (ratio 0.887, inset 1.5%) which the
          art re-draws on top, so nothing spills over the blue. This is the
          model un-rushing — NOT a re-trace (gen12 proved finer tracing loses). */}
      {NET_HEXES.map((hx) => {
        if (f < hx.f0) return null;
        const p = lerp(f, [hx.f0, hx.f1], [0, 1]);
        const cx = hx.from[0] + (hx.to[0] - hx.from[0]) * p;
        const cy = hx.from[1] + (hx.to[1] - hx.from[1]) * p;
        const w = 215 + (375 - 215) * p;
        const bw = w * 0.985;
        return (
          <Hexagon
            key={`bg-${hx.art}`}
            cx={cx}
            cy={cy}
            w={bw}
            h={bw * 0.887}
            fill={C.white}
            stroke={C.white}
            strokeWidth={3}
          />
        );
      })}
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
            <TracedArt name={hx.art} scale={scale} recolor={hx.recolor} />
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
