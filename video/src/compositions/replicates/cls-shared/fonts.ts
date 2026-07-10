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
//   - cls-day: Georgia (data.ts SERIF). S2 sizes fs349/338 and the
//     placement model (baseline = CSS_top + 0.825*fs, capTop = CSS_top +
//     0.122*fs) were measured on Georgia ink — a face swap invalidates them.
//   - clsnet: Playfair Display (clsnet/fonts.ts). Mosaic capTop +16 and
//     wordmark scaleX 1.14 / tracking 8 are Playfair-measured.
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
export const HELVETICA = "'Helvetica Neue', Helvetica, Arial, sans-serif";
