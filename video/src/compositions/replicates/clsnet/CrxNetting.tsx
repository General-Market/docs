import React from "react";
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";
import { DURATION, FPS, H, W } from "./data";
import { Brand, BrandProvider } from "./brand";
import { CRX_COPY } from "./crx-data";
import { ClsNetComposition } from "./ClsNetComposition";

// Diatype — CRX's self-hosted brand face (same files dev.crxfx.com ships).
const DIATYPE = "Diatype";
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

const CRX_BRAND: Brand = {
  copy: CRX_COPY,
  serif: DIATYPE,
  sans: DIATYPE,
  boxLabel: "CRX",
  logoArt: null,
  logoText: "CRX",
};

export const CrxNetting: React.FC = () => (
  <BrandProvider brand={CRX_BRAND}>
    <ClsNetComposition />
  </BrandProvider>
);

export const crxNettingMetaInner = {
  id: "CrxNetting",
  component: CrxNetting,
  durationInFrames: DURATION,
  fps: FPS,
  width: W,
  height: H,
};
