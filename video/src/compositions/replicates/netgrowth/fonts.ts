/**
 * NetGrowth replica faces.
 *
 * Serif — Libre Caslon Display, self-hosted (public/netgrowth-assets/fonts).
 * Chosen by quantitative A/B against the reference headline crop
 * (meandiff 0.143 vs Baskerville 0.154, Playfair 0.163, DM Serif 0.186;
 * natural line width within 1.6% of the reference ink — see
 * .claude/rounds/work/netgrowth/serif-ab2.png). loadFont holds the render
 * until the face is real, so frame 0 never rasterizes against a fallback.
 *
 * Sans — Helvetica Neue, the macOS system face. Best A/B against the
 * reference grotesque (0.2098 vs Arial 0.2210); renders are local-only,
 * so the system font is deterministic here.
 */
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

export const CASLON = "LibreCaslonDisplay";
export const HELVETICA = "Helvetica Neue, Helvetica, Arial, sans-serif";

loadFont({
  family: CASLON,
  url: staticFile("netgrowth-assets/fonts/LibreCaslonDisplay-Regular.ttf"),
  weight: "400",
  display: "block",
});
