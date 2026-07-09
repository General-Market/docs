/**
 * CrxLiquidityLoop — the CRX-branded cut of the FNA settlement-frequency
 * loop. Same measured choreography (data.ts tables untouched); the skin and
 * the words are ours.
 *
 * Brand per the CrxAnoma precedent: Diatype (the dev.crxfx.com landing's
 * self-hosted face, 400/700 only), paper ink #F5F5F7 on a dark ground, the
 * landing's teal accent ramp. Everything a producer would edit — copy,
 * values, colors — lives here.
 */

import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";
import type { ChartCopy, ChartTheme } from "./data";

export const DIATYPE = "Diatype";

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

export const CRX_THEME: ChartTheme = {
  bg: "#101017",
  navy: "#F5F5F7", // connector line — paper ink on the dark ground
  blue: "#2AD4BB",
  slate: "#5B5B66",
  axisLine: "#3A3A44",
  axisText: "#F5F5F7",
  circleFill: "#101017", // knockout circles read as punched holes in the bars
  circleText: ["#2AD4BB", "#37B795", "#8A8A96"],
  barColors: ["#2AD4BB", "#37B795", "#5B5B66"],
  dotColors: ["#F5F5F7", "#F5F5F7", "#F5F5F7"],
  calloutFills: ["#37B795", "#5B5B66"],
  calloutText: "#101017",
  usdText: "#101017",
  ringColor: "#2AD4BB",
  fontFamily: `'${DIATYPE}', 'Helvetica Neue', Helvetica, sans-serif`,
  textWeight: 400, // Diatype ships 400/700 only
  boldWeight: 700,
};

// The same economic story — each extra settlement cycle per day undoes
// netting and demands more standing liquidity — told in our own words.
export const CRX_COPY: ChartCopy = {
  leftLabels: ["250", "200", "150", "100", "50", "0"],
  rightLabels: ["100", "80", "60", "40", "20", "0"],
  ticks: ["1", "2", "3"],
  xTitle: "Settlement cycles per day",
  leftTitle: "Liquidity required (USD bn)",
  rightTitle: "Netting rate %",
  groups: [
    { usdPre: "USD ", usdBold: "178.9", usdPost: " bn", circleLines: ["One cycle"] },
    {
      usdPre: "USD ",
      usdBold: "205.7",
      usdPost: " bn",
      circleLines: ["+26.8", "USD bn", "more", "funding"],
    },
    {
      usdPre: "USD ",
      usdBold: "227.2",
      usdPost: " bn",
      circleLines: ["+48.3", "USD bn", "more", "funding"],
    },
  ],
  callouts: ["-0.6%", "-1.0%"],
  title: {
    head: "The price of settling faster",
    sub: "More cycles a day, less netting, more liquidity on the table.",
  },
};

// Small white lockup, bottom right. Lives in public/crx-assets (shared brand
// shelf); cloned into the slim pubdir for still work.
export const CRX_LOCKUP = "crx-assets/crx-lockup-white.png";
