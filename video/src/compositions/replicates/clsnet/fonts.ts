// CLSNet replica fonts.
// The CLS wordmark face is Financier-like: high-contrast transitional serif.
// Playfair Display is the closest hosted match (A/B'd against the ref crop).
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";

export const { fontFamily: SERIF } = loadPlayfair("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
});
