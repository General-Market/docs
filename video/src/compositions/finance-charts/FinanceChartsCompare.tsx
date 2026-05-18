import React from "react";
import { AbsoluteFill, Img, Series, staticFile } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { C, FONT_DISPLAY, FONT_TEXT, FPS } from "./tokens";

import { Chart01 } from "./charts/Chart01_IVvsRV";
import { Chart02 } from "./charts/Chart02_PnLHeatmap";
import { Chart03 } from "./charts/Chart03_ShortStraddleStep";
import { Chart04 } from "./charts/Chart04_HourlyRVHeatmap";
import { Chart05 } from "./charts/Chart05_VolCone";
import { Chart06 } from "./charts/Chart06_StraddleScatter";
import { Chart07 } from "./charts/Chart07_BTCMultiPanel";
import { Chart08 } from "./charts/Chart08_MonteCarlo";
import { Chart09 } from "./charts/Chart09_VegaCurves";
import { Chart10 } from "./charts/Chart10_PerInstrumentPnL";
import { Chart11 } from "./charts/Chart11_IndexBasis";
import { Chart12 } from "./charts/Chart12_FridayStraddles";

loadInter("normal", { subsets: ["latin"], weights: ["400", "500", "600"] });

const W = 2400;
const H = 1080;
const PER_SCENE = 150;

const CHART_W = 1920;
const CHART_H = 1080;

const SCENES: { id: string; title: string; component: React.FC }[] = [
  { id: "01", title: "BTCUSD 7-day ATM IV vs Forward RV", component: Chart01 },
  { id: "02", title: "MTM PnL by Weekday and UTC Hour", component: Chart02 },
  { id: "03", title: "BTC Short Weekly Straddle", component: Chart03 },
  { id: "04", title: "BTC Hourly Realized Volatility", component: Chart04 },
  { id: "05", title: "BTC realized vol cone", component: Chart05 },
  { id: "06", title: "BTC-29MAY26-STRADDLE", component: Chart06 },
  { id: "07", title: "BTCUSD multi-panel", component: Chart07 },
  { id: "08", title: "Monte Carlo option pricing", component: Chart08 },
  { id: "09", title: "Vega curves for combo", component: Chart09 },
  { id: "10", title: "Per-Instrument PnL", component: Chart10 },
  { id: "11", title: "BTC Index Price + Basis Carry", component: Chart11 },
  { id: "12", title: "1W Straddle Sold Each Friday", component: Chart12 },
];

const PanelShell: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div
    style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      padding: 32,
      gap: 16,
      minWidth: 0,
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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 0,
      }}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: "16 / 9",
          border: `1px solid ${C.grid}`,
          borderRadius: 8,
          overflow: "hidden",
          background: C.bg,
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  </div>
);

const SourcePanel: React.FC<{ id: string }> = ({ id }) => {
  const [errored, setErrored] = React.useState(false);
  const src = staticFile(`source-charts/source-${id}.png`);
  if (errored) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT_TEXT,
          fontSize: 16,
          color: C.inkFaint,
          textAlign: "center",
          padding: 24,
          lineHeight: 1.5,
        }}
      >
        drop source-{id}.png into video/public/source-charts/
      </div>
    );
  }
  return (
    <Img
      src={src}
      onError={() => setErrored(true)}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
      }}
    />
  );
};

// Compare layout: each panel is half of the 2400px stage minus padding/borders.
// Panel inner box is aspect-locked at 16:9, ~1136×639 → scale 1920×1080 by 0.5916.
const DEFAULT_SCALE = 1136 / CHART_W;

const LivePanel: React.FC<{ Component: React.FC }> = ({ Component }) => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = React.useState(DEFAULT_SCALE);

  React.useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const { width, height } = el.getBoundingClientRect();
      const s = Math.min(width / CHART_W, height / CHART_H);
      if (s > 0 && Number.isFinite(s)) setScale(s);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: CHART_W,
          height: CHART_H,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          position: "relative",
        }}
      >
        <Component />
      </div>
    </div>
  );
};

const CompareScene: React.FC<{
  id: string;
  title: string;
  Component: React.FC;
}> = ({ id, title, Component }) => {
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
        Chart {id} — {title}
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
        <PanelShell label="Source">
          <SourcePanel id={id} />
        </PanelShell>
        <PanelShell label="Remotion">
          <LivePanel Component={Component} />
        </PanelShell>
      </div>
    </AbsoluteFill>
  );
};

export const FinanceChartsCompare: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Series>
        {SCENES.map((s) => (
          <Series.Sequence key={s.id} durationInFrames={PER_SCENE}>
            <CompareScene id={s.id} title={s.title} Component={s.component} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};

export const financeChartsCompareMeta = {
  id: "FinanceChartsCompare",
  component: FinanceChartsCompare,
  durationInFrames: SCENES.length * PER_SCENE,
  fps: FPS,
  width: W,
  height: H,
};
