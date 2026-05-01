import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";

const { fontFamily: sans } = loadInter("normal", {
  subsets: ["latin"],
  weights: ["300", "400", "500", "600"],
});

const { fontFamily: serif } = loadFraunces("normal", {
  subsets: ["latin"],
  weights: ["300", "400", "500"],
});

export const FPS = 30;
export const W = 1920;
export const H = 1080;
export const SLIDE_FRAMES = FPS;
export const SLIDE_COUNT = 14;
export const ACCENT = "#7A1A1A";

export const COLOR = {
  bg: "#F4F1EA",
  ink: "#0F0F0F",
  muted: "#6B6B6B",
  line: "rgba(15, 15, 15, 0.12)",
  lineStrong: "rgba(15, 15, 15, 0.32)",
};

export const FONT = {
  sans,
  serif,
};

export const PAD = {
  x: 192,
  y: 144,
};
