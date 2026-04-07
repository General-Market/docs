import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { DUR, TOTAL_DURATION, THEME } from "./theme";
import { Scene00Intro, scene00IntroMeta } from "./Scene00Intro";
import {
  Scene01Liquidity,
  scene01LiquidityMeta,
} from "./Scene01Liquidity";
import {
  Scene02ProfitableSize,
  scene02ProfitableSizeMeta,
} from "./Scene02ProfitableSize";
import { Scene03Markets, scene03MarketsMeta } from "./Scene03Markets";
import {
  Scene04Unlistable,
  scene04UnlistableMeta,
} from "./Scene04Unlistable";
import {
  Scene05Settlement,
  scene05SettlementMeta,
} from "./Scene05Settlement";
import { Scene06Formula, scene06FormulaMeta } from "./Scene06Formula";
import { Scene07Outro, scene07OutroMeta } from "./Scene07Outro";

const { fontFamily: inter } = loadInter();

const S0 = 0;
const S1 = S0 + DUR.intro;
const S2 = S1 + DUR.beat1;
const S3 = S2 + DUR.beat2;
const S4 = S3 + DUR.beat3;
const S5 = S4 + DUR.beat4;
const S6 = S5 + DUR.beat5;
const S7 = S6 + DUR.beat6;

export const GeneralMarketReplicate: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: THEME.bg, fontFamily: inter }}>
    <Sequence from={S0} durationInFrames={DUR.intro} name="Intro">
      <Scene00Intro />
    </Sequence>
    <Sequence from={S1} durationInFrames={DUR.beat1} name="Liquidity">
      <Scene01Liquidity />
    </Sequence>
    <Sequence
      from={S2}
      durationInFrames={DUR.beat2}
      name="Profitable Size"
    >
      <Scene02ProfitableSize />
    </Sequence>
    <Sequence from={S3} durationInFrames={DUR.beat3} name="Markets">
      <Scene03Markets />
    </Sequence>
    <Sequence from={S4} durationInFrames={DUR.beat4} name="Unlistable">
      <Scene04Unlistable />
    </Sequence>
    <Sequence from={S5} durationInFrames={DUR.beat5} name="Settlement">
      <Scene05Settlement />
    </Sequence>
    <Sequence from={S6} durationInFrames={DUR.beat6} name="Formula">
      <Scene06Formula />
    </Sequence>
    <Sequence from={S7} durationInFrames={DUR.outro} name="Outro">
      <Scene07Outro />
    </Sequence>
  </AbsoluteFill>
);

export const generalMarketReplicateMeta = {
  id: "GeneralMarketReplicate",
  component: GeneralMarketReplicate,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: TOTAL_DURATION,
};

// Side-by-side wrapper — mirrors CouncilSideBySide structure.
// Left panel is a placeholder for a future reference video.
export const GeneralMarketSideBySide: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundColor: "#000",
      display: "flex",
      flexDirection: "row",
      fontFamily: inter,
    }}
  >
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        flexShrink: 0,
        backgroundColor: "#0A0A0A",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          color: "#333",
          fontSize: 64,
          fontWeight: 500,
          letterSpacing: 6,
          textTransform: "uppercase",
        }}
      >
        reference tbd
      </div>
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 24,
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          padding: "6px 16px",
          borderRadius: 6,
          fontFamily: "monospace",
          fontSize: 18,
        }}
      >
        ORIGINAL
      </div>
    </div>
    <div style={{ width: 4, background: "#222", flexShrink: 0 }} />
    <div
      style={{
        width: 1920,
        height: 1080,
        position: "relative",
        flexShrink: 0,
      }}
    >
      <GeneralMarketReplicate />
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 24,
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          padding: "6px 16px",
          borderRadius: 6,
          fontFamily: "monospace",
          fontSize: 18,
        }}
      >
        REPLICA
      </div>
    </div>
  </AbsoluteFill>
);

export const generalMarketSideBySideMeta = {
  id: "GeneralMarketSideBySide",
  component: GeneralMarketSideBySide,
  width: 3844,
  height: 1080,
  fps: 30,
  durationInFrames: TOTAL_DURATION,
};

export const generalMarketSceneMetas = [
  scene00IntroMeta,
  scene01LiquidityMeta,
  scene02ProfitableSizeMeta,
  scene03MarketsMeta,
  scene04UnlistableMeta,
  scene05SettlementMeta,
  scene06FormulaMeta,
  scene07OutroMeta,
];
