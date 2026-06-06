/**
 * The CRX app's own UI font (Hanken Grotesk), loaded so the video's overlays —
 * the typed amount, the rolling figures — render in the SAME glyphs as the
 * screenshots underneath, not a fallback. Without this the overlay reads as
 * pasted-on. Captured fontFamily strings from the manifest already name it; this
 * just guarantees the face is available to the renderer.
 */
import { loadFont } from "@remotion/google-fonts/HankenGrotesk";

export const { fontFamily: APP_FONT } = loadFont();
