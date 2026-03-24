import type { Emotion } from "../types";

export interface ColorPalette {
  gradient: [string, string, string];
  accent: string;
  captionHighlight: string;
  particles: string;
  surface: string;
}

// IndexMaker DA — derived from https://github.com/IndexMaker/indexmaker_frontend
// Brand blue: #2470ff | Dark base: #15181a | Wallet gradient: #A5FECA → #3EDCEB → #2594FF → #53F
const palettes: Record<Emotion, ColorPalette> = {
  neutral: {
    gradient: ["#15181a", "#1a1e22", "#15181a"],
    accent: "#2470ff",
    captionHighlight: "#FFFFFF",
    particles: "rgba(36,112,255,0.08)",
    surface: "#202426",
  },
  excited: {
    gradient: ["#15181a", "#151e2a", "#0f1f30"],
    accent: "#3EDCEB",
    captionHighlight: "#88F5FF",
    particles: "rgba(62,220,235,0.12)",
    surface: "#1a2530",
  },
  confused: {
    gradient: ["#15181a", "#1a1525", "#201028"],
    accent: "#5533FF",
    captionHighlight: "#8866FF",
    particles: "rgba(85,51,255,0.10)",
    surface: "#201a2a",
  },
  panicking: {
    gradient: ["#15181a", "#1f1518", "#28101a"],
    accent: "#ef4444",
    captionHighlight: "#FF6680",
    particles: "rgba(239,68,68,0.14)",
    surface: "#251a1e",
  },
  happy: {
    gradient: ["#15181a", "#152218", "#102a18"],
    accent: "#A5FECA",
    captionHighlight: "#C8FFE0",
    particles: "rgba(165,254,202,0.10)",
    surface: "#1a2520",
  },
  sad: {
    gradient: ["#15181a", "#15161e", "#131420"],
    accent: "#5566AA",
    captionHighlight: "#8899CC",
    particles: "rgba(85,102,170,0.06)",
    surface: "#1a1c22",
  },
  angry: {
    gradient: ["#15181a", "#1f1215", "#2a0f12"],
    accent: "#FF2244",
    captionHighlight: "#FF4466",
    particles: "rgba(255,34,68,0.16)",
    surface: "#251518",
  },
};

export const getPalette = (emotion: Emotion): ColorPalette => palettes[emotion];
export const getGradientCSS = (colors: [string, string, string], angle: number): string =>
  `linear-gradient(${angle}deg, ${colors[0]}, ${colors[1]}, ${colors[2]})`;
