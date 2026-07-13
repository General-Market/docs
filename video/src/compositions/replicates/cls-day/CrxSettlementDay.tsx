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

// CRX lockup replaces the CLS wordmark on the intro/end cards. Sized to the CLS
// wordmark's on-screen MASS: at height 210 the lockup ink was only ~60% of the
// CLS mark's (h127 vs 226, w581 vs 1010) and sat ~20px high. The PNG carries
// ~17.5% padding top+bottom (ink is 0.651 of PNG height), so height 347 at
// top 102 lands the ink at CLS's own extents — end card y175-399 vs CLS y174-401
// (h224 vs 227, w1022 vs 1074); intro y188-399 vs CLS y188-401. The residual
// lighter read is the CRX mark's thinner stroke (a property of the asset).
const CrxBrandLogo: React.FC<{ markP: number; lettersP: number }> = ({ lettersP }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: 102,
      width: 1920,
      display: "flex",
      justifyContent: "center",
      opacity: lettersP,
    }}
  >
    <Img src={staticFile("crx-assets/crx-lockup-white.png")} style={{ height: 347 }} />
  </div>
);

// …and inside the routing pills.
const CrxPillLogo: React.FC<{ h: number }> = ({ h }) => (
  <Img src={staticFile("crx-assets/crx-lockup-white.png")} style={{ height: h * 0.82 }} />
);

export const CrxSettlementDay: React.FC = () => (
  <ClsDayScenes pack={CRX_PACK} BrandLogo={CrxBrandLogo} PillLogo={CrxPillLogo} />
);
