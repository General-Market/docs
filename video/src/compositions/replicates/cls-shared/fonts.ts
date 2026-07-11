// cls-shared — type decisions for the CLS explainer lanes.
//
// SANS — both references measured Helvetica (bold digits, regular
// labels/body). One stack, shared. Renders are local-only, so the macOS
// system face is deterministic.
//
// SERIF — the references share one Financier-like high-contrast
// transitional serif (wordmark, currency codes, percentages), but each
// lane calibrated its own stand-in against its own rendered ink and those
// calibrations are load-bearing:
//   - cls-day: HOEFLER TEXT (data.ts SERIF, adopted r7). SET_CAL fs354/345,
//     scaleX 0.945/0.809 and capTop factor -0.018 were measured on Hoefler
//     ink — a face swap invalidates them. (Georgia was the r1-r6 stand-in.)
//   - clsnet: GEORGIA (clsnet/fonts.ts, adopted r8). SerifLabel capTop 0.14*fs
//     and wordmark scaleX 0.976 are Georgia-measured. (Playfair Display was
//     the r1-r7 google stand-in.)
// netgrowth's measured face (Libre Caslon Display, self-hosted at
// public/netgrowth-assets/fonts) won ITS reference quantitatively, so it
// was A/B'd against THESE explainers' own headline crops (2026-07-10,
// binarized ink meandiff, cap-height-normalized; script + crops in
// .claude/rounds/work/cls-shared/fontab/). VERDICT — Caslon LOSES both:
//   clsnet 'CLSNet' wordmark crop (regular_0010): Georgia 0.173 <
//     Caslon 0.246 < Times 0.255 < Playfair-current ~0.30 (0.326 raw from
//     the render crop; same-provenance correction ~-0.025). GEORGIA is the
//     measured lead for the clsnet title/serif quality round.
//   cls-day 'USD' S2 code crop (f150): Times 0.120 < Caslon 0.148 <
//     Georgia-current 0.175 (Pillow-rendered same-provenance). TIMES NEW
//     ROMAN is the measured lead for cls-day — confirms the r1 hunch.
// Single-crop leads, not adoptions. Adopting a face is a QUALITY-round
// change: re-run the A/B on 3+ crops of that lane, swap the serif, then
// re-measure every serif calibration in the lane (cls-day S2 fs/baseline
// model, clsnet capTop/scaleX/tracking) and still-gate the replica AND its
// CRX cut. Never adopt inside a refactor round.
//
// cls-day r7 RESOLUTION (2026-07-10): the Times lead did NOT survive the
// render — shape-normalized meandiff hides ASPECT, and Times ships
// +8.7%/+23% wider than the ref's condensed face (S2 f150 SSIM fell
// .907→.9006). Pillow widths understate Chromium's by ~7%: screen faces
// IN-RENDER, never adopt on Pillow numbers alone. An 8-face in-render
// screen picked HOEFLER TEXT + per-string scaleX compression (f150
// .907→.9274); Hoefler needs fontVariantNumeric lining-nums on every
// digit site (old-style figures by default). cls-day face + calibration
// live in cls-day/data.ts (SERIF, SERIF_CAL) and scenes1.tsx (SET_CAL).
// The same in-render screen + width discipline applies to any clsnet
// serif quality round (its Georgia lead is also Pillow-based — verify
// in-render with width before adopting).
//
// ─── GEN-8 typeface screen (2026-07-11) — FULL FIELD, IN-RENDER ───
// Screened 11 macOS system faces + 10 Google display/text serifs (Prata,
// Playfair, DM Serif Display, Noto Serif Display, Newsreader, Source Serif 4,
// Spectral, PT Serif, Lora, STIX Two) at TRUE Chromium metrics via a
// throwaway FontLab still harness (rows at fs200, natural width) — the law is
// screen in-render, never Pillow. Cap-normalized ink-overlap diff (lower =
// better) + width/ref, then ffmpeg SSIM on the REAL scene frames + eye strips.
// Artifacts: work/cls-shared/fontab/gen8/ (prefilter.py, measure.py,
// montage-*.png, strip-word-*.png, clsnet-{georgia,playfair}/).
//
// cls-day 'USD' (S2 f150, the dominant code) IN-RENDER overlap:
//   Hoefler 0.092 (w/r 1.01) < Times 0.123 < STIX 0.135 < Newsreader 0.151 <
//   Georgia 0.187 < ... No obtainable face is within 0.03 of Hoefler, and its
//   natural width already matches the ref (w/r 1.01). The whole field is a
//   flat plateau behind it. VERDICT — HOEFLER TEXT IS THE FLOOR; no change.
//
// clsnet 'CLSNet' wordmark + 'AED' mosaic IN-RENDER overlap — the field
//   SPLITS from cls-day. Current Georgia is mid/bottom-pack (0.285 / 0.329),
//   beaten on overlap by Charter 0.190/0.119 (SYSTEM but the eye REJECTS it —
//   low contrast, wrong category; the lesson-8 trap), Playfair 0.162/0.215,
//   Prata 0.190/0.149, Noto Serif 0.197/0.220, DM Serif 0.209/0.185.
//   EYE (montage-CLSNet.png): the ref is HIGH-CONTRAST; PLAYFAIR DISPLAY is
//   the truest match (N thick-diagonal/thin-verticals, elegant S, small e/t),
//   Prata second; Georgia is a lower-contrast / wider compromise.
//   BUT SSIM (the SCORING metric) does NOT reward Playfair IN SCOPE: the
//   wordmark scaleX 0.976 fits Playfair (natWidth 665 ≈ Georgia 671), yet
//   Playfair's cap-top factor is +0.190 vs Georgia's +0.135, so a fonts.ts-
//   only swap (keeping the 0.14 capTop hardcoded in ui.tsx/scenesA) sits ~12px
//   LOW and LOSES full-frame SSIM: f125 .9159->.9093, f4075 .8669->.8603,
//   f3550 ~flat, f425 +.001. Every truer face needs its OWN capTop -> no
//   fonts.ts-only swap beats Georgia. VERDICT — GEORGIA IS THE IN-SCOPE
//   (system, deterministic) FLOOR; keep it.
//   HANDOFF (needs ui.tsx/scenesA/data.ts — OUT of the typeface front's file
//   scope): a PROPERLY cap-calibrated Playfair (capTop factor 0.14->0.20;
//   wordmark scaleX stays ~0.976; mosaic capTop shift ~+7px at fs138) BEATS
//   Georgia on the wordmark crop +0.0033 at BOTH f125 and f4075 (vertical-
//   swept optimum) and is eye-truest. It is a Google font (network, non-
//   deterministic — r8 left it for exactly that) worth ~sub-hundredth globally
//   (lifts the title f99-149 + endcard worst-windows). Adopt only when those
//   geometry files are free and the owner's eye is prioritised over the ~0
//   score delta.
//
// FLOOR HONESTY: the reference face is Klim's FINANCIER (proprietary,
// unobtainable). Both lanes sit AT the obtainable-typeface floor — cls-day
// optimally (Hoefler), clsnet within +0.003 (Playfair, out of scope). The
// typeface is NOT a broad remaining lever toward 96; it is spent.
export const HELVETICA = "'Helvetica Neue', Helvetica, Arial, sans-serif";
