/**
 * Diatype — the dev.crxfx.com landing's self-hosted brand face.
 *
 * The whole CRX-Anoma video wears this one face: the app cards and the floating
 * headline copy alike, exactly as the landing does. Only the two weights the
 * landing ships exist here — Regular 400 and Bold 700 — so every earlier
 * 500/600 step collapses onto this 400/700 ramp by role (body/labels → 400,
 * titles/hero/emphasis → 700). Strong contrast, which is correct for a grotesque.
 *
 * Readiness is guaranteed, not hoped for. `@remotion/fonts` `loadFont` opens its
 * own `delayRender()` and only `continueRender()`s once the FontFace has loaded
 * and joined `document.fonts` — so the render is HELD until Diatype is real. The
 * first frame never rasterizes against a system-serif fallback (the "clown" bug).
 * Because this module is imported at the top of both anoma files, the load fires
 * before any frame is drawn.
 *
 * Format is auto-derived from the extension (.ttf → truetype, .otf → opentype).
 */

import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

export const DIATYPE = "Diatype";

loadFont({
  family: DIATYPE,
  url: staticFile("crx-assets/fonts/Diatype-Regular.ttf"),
  weight: "400",
  display: "block",
});

loadFont({
  family: DIATYPE,
  url: staticFile("crx-assets/fonts/Diatype-Bold.otf"),
  weight: "700",
  display: "block",
});
