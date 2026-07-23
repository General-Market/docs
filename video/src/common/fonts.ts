/**
 * Brand fonts — Bricolage Grotesque (sans) + Commit Mono (mono).
 *
 * Self-hosted in public/fonts and loaded via @remotion/fonts (neither is in the
 * installed @remotion/google-fonts). Chosen for the premium-grotesque + financial-
 * mono aura — the Coinbase Sans / Söhne feeling — without using a competitor's
 * typeface. Bricolage also ships an optical-size axis; we use its weight cuts here.
 */

import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

const SANS = "Bricolage Grotesque";
const MONO = "Commit Mono";

const SANS_WEIGHTS = ["400", "500", "600", "700", "800"];
const MONO_WEIGHTS = ["400", "500", "700"];

for (const weight of SANS_WEIGHTS) {
  loadFont({
    family: SANS,
    url: staticFile(`fonts/bricolage-grotesque-${weight}.woff2`),
    weight,
    display: "swap",
  });
}

for (const weight of MONO_WEIGHTS) {
  loadFont({
    family: MONO,
    url: staticFile(`fonts/commit-mono-${weight}.woff2`),
    weight,
    display: "swap",
  });
}

export const font = `"${SANS}", "Inter", "Helvetica Neue", Arial, sans-serif`;
export const monoFont = `"${MONO}", "JetBrains Mono", ui-monospace, monospace`;
