import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: inter } = loadInter("normal", {
  subsets: ["latin"],
  weights: ["300", "400", "500", "600", "700"],
});

export const FPS = 30;
export const W = 1920;
export const H = 1080;
export const SLIDE_FRAMES = FPS * 4;
export const SLIDE_COUNT = 12;

export const COLOR = {
  bg: "#FBFBFD",
  ink: "#1D1D1F",
  muted: "#6E6E73",
  line: "rgba(0, 0, 0, 0.08)",
  lineStrong: "rgba(0, 0, 0, 0.16)",
  placeholder: "rgba(29, 29, 31, 0.32)",
  blue: "#0071E3",
};

export const FONT = {
  display: `"SF Pro Display", ${inter}, "Helvetica Neue", Helvetica, Arial, sans-serif`,
  text: `"SF Pro Text", ${inter}, "Helvetica Neue", Helvetica, Arial, sans-serif`,
};

export const PAD = {
  x: 160,
  y: 128,
};

export const CONTENT_MAX = 1600;
