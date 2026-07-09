// CrxSettlementDay — the publishable deliverable: the CLS "Settlement in a
// Day" choreography carried by CRX props. Brand grammar per
// CrxAnomaComposition: self-hosted Diatype, crx-assets lockup.
import React from "react";
import { loadFont } from "@remotion/fonts";
import { Img, staticFile } from "remotion";
import { ClsDayScenes } from "./ClsDayReplicate";
import { CRX_PACK } from "./crx-data";

loadFont({
  family: "Diatype",
  url: staticFile("crx-assets/fonts/Diatype-Regular.ttf"),
  weight: "400",
  display: "block",
});
loadFont({
  family: "Diatype",
  url: staticFile("crx-assets/fonts/Diatype-Bold.otf"),
  weight: "700",
  display: "block",
});

// CRX lockup replaces the CLS wordmark on the intro/end cards…
const CrxBrandLogo: React.FC<{ markP: number; lettersP: number }> = ({ lettersP }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: 150,
      width: 1920,
      display: "flex",
      justifyContent: "center",
      opacity: lettersP,
    }}
  >
    <Img src={staticFile("crx-assets/crx-lockup-white.png")} style={{ height: 210 }} />
  </div>
);

// …and inside the routing pills.
const CrxPillLogo: React.FC<{ h: number }> = ({ h }) => (
  <Img src={staticFile("crx-assets/crx-lockup-white.png")} style={{ height: h * 0.82 }} />
);

export const CrxSettlementDay: React.FC = () => (
  <ClsDayScenes pack={CRX_PACK} BrandLogo={CrxBrandLogo} PillLogo={CrxPillLogo} />
);
