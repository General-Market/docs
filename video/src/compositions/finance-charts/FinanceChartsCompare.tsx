import React from "react";
import { AbsoluteFill, Img, Series, staticFile } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { C, FONT_DISPLAY, FONT_TEXT, FPS } from "./tokens";

loadInter("normal", { subsets: ["latin"], weights: ["400", "500", "600"] });

const W = 2400;
const H = 1080;
const PER_SCENE = 150;

const TITLES: Record<string, string> = {
  "01": "BTCUSD 7-day ATM IV vs Forward RV",
  "02": "MTM PnL by Weekday and UTC Hour",
  "03": "BTC Short Weekly Straddle",
  "04": "BTC Hourly Realized Volatility",
  "05": "BTC realized vol cone",
  "06": "BTC-29MAY26-STRADDLE",
  "07": "BTCUSD multi-panel",
  "08": "Monte Carlo option pricing",
  "09": "Vega curves for combo",
  "10": "Per-Instrument PnL",
  "11": "BTC Index Price + Basis Carry",
  "12": "1W Straddle Sold Each Friday",
};

const IDS = Object.keys(TITLES);

const Panel: React.FC<{
  label: string;
  src: string;
  fallback: string;
}> = ({ label, src, fallback }) => {
  const [errored, setErrored] = React.useState(false);
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: 32,
        gap: 16,
      }}
    >
      <div
        style={{
          fontFamily: FONT_TEXT,
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: C.inkDim,
        }}
      >
        {label}
      </div>
      <div
        style={{
          flex: 1,
          border: `1px solid ${C.grid}`,
          borderRadius: 8,
          overflow: "hidden",
          background: "#070707",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {errored ? (
          <div
            style={{
              fontFamily: FONT_TEXT,
              fontSize: 16,
              color: C.inkFaint,
              textAlign: "center",
              padding: 24,
              lineHeight: 1.5,
            }}
          >
            {fallback}
          </div>
        ) : (
          <Img
            src={src}
            onError={() => setErrored(true)}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
          />
        )}
      </div>
    </div>
  );
};

const CompareScene: React.FC<{ id: string }> = ({ id }) => {
  const sourceSrc = staticFile(`source-charts/source-${id}.png`);
  const renderSrc = staticFile(`finance-stills/chart-${id}.png`);
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 0,
          right: 0,
          textAlign: "center",
          color: C.ink,
          fontFamily: FONT_DISPLAY,
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: "-0.014em",
        }}
      >
        Chart {id} — {TITLES[id]}
      </div>
      <div
        style={{
          position: "absolute",
          top: 84,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "row",
        }}
      >
        <Panel
          label="Source"
          src={sourceSrc}
          fallback={`drop ${`source-${id}.png`} into video/public/source-charts/`}
        />
        <Panel
          label="Remotion"
          src={renderSrc}
          fallback={`expected at video/public/finance-stills/chart-${id}.png`}
        />
      </div>
    </AbsoluteFill>
  );
};

export const FinanceChartsCompare: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Series>
        {IDS.map((id) => (
          <Series.Sequence key={id} durationInFrames={PER_SCENE}>
            <CompareScene id={id} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};

export const financeChartsCompareMeta = {
  id: "FinanceChartsCompare",
  component: FinanceChartsCompare,
  durationInFrames: IDS.length * PER_SCENE,
  fps: FPS,
  width: W,
  height: H,
};
