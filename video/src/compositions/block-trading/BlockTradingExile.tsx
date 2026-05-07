import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { FPS, H, W } from "../pitch/tokens";

// Inter is the closest Google-Fonts surrogate for SF Pro. SF Pro Display
// leads the stack so installed Macs render the real thing; Inter and
// Helvetica Neue cover everything else.
loadInter("normal", { subsets: ["latin"], weights: ["400", "500", "600"] });

const FONT_DISPLAY =
  '"SF Pro Display", Inter, "Helvetica Neue", Helvetica, Arial, sans-serif';
const FONT_TEXT =
  '"SF Pro Text", Inter, "Helvetica Neue", Helvetica, Arial, sans-serif';

const C = {
  bg: "#FFFFFF",
  ink: "#1D1D1F",
  inkSecondary: "#6E6E73",
  inkTertiary: "#86868B",
  surface: "#F5F5F7",
  border: "rgba(0, 0, 0, 0.08)",
  borderStrong: "rgba(0, 0, 0, 0.18)",
};

const PAD_X = 168;
const PAD_Y = 96;

type Strategy = {
  name: string;
  blurb: string;
  liveIn: number[];
};

const STRATEGIES: Strategy[] = [
  {
    name: "Cross-venue arbitrage",
    blurb: "Same asset, two exchanges, different prices.",
    liveIn: [0],
  },
  {
    name: "Stop & liquidation hunting",
    blurb: "Push price to trigger stops and forced unwinds.",
    liveIn: [0, 1],
  },
  {
    name: "Orderflow purchase (PFOF)",
    blurb: "Pay brokers for retail orders. Trade against them.",
    liveIn: [0, 1, 2],
  },
  {
    name: "Frontrunning / MEV",
    blurb: "See the order in the mempool. Execute first.",
    liveIn: [0, 1, 2],
  },
  {
    name: "Insider trading",
    blurb: "Trade on information before it reaches the tape.",
    liveIn: [0, 1, 2],
  },
  {
    name: "Latency arbitrage",
    blurb: "Co-locate. Beat the orderbook to the print.",
    liveIn: [0, 1, 2],
  },
  {
    name: "Spoofing & layering",
    blurb: "Fake liquidity. Cancel before it fills.",
    liveIn: [0, 1, 2],
  },
  {
    name: "Toxic-flow market making",
    blurb: "Quote tight. Dump on uninformed counterparty.",
    liveIn: [0, 1, 2],
  },
  {
    name: "Directional bets",
    blurb: "Pick a side. Wait.",
    liveIn: [0, 1, 2, 3],
  },
];

const COLUMNS = [
  { num: "01", name: "Spot", note: "Every predator hunts here." },
  { num: "02", name: "Perpetuals", note: "No spot mirror to arbitrage against." },
  { num: "03", name: "Options", note: "No stops, no liquidations to hunt." },
  { num: "04", name: "Blocks", note: "Sealed bets. No mempool. No retail flow to buy." },
];

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontFamily: FONT_TEXT,
      fontSize: 12,
      fontWeight: 500,
      letterSpacing: "0.011em",
      textTransform: "uppercase",
      color: C.inkTertiary,
    }}
  >
    {children}
  </div>
);

const Headline: React.FC = () => (
  <div>
    <div
      style={{
        fontFamily: FONT_DISPLAY,
        fontSize: 56,
        fontWeight: 600,
        color: C.ink,
        letterSpacing: "-0.016em",
        lineHeight: 1.0714,
        maxWidth: 1380,
      }}
    >
      Each market thins the predators.
    </div>
    <div
      style={{
        fontFamily: FONT_TEXT,
        fontSize: 21,
        fontWeight: 400,
        color: C.inkSecondary,
        letterSpacing: "-0.01em",
        lineHeight: 1.381,
        marginTop: 22,
        maxWidth: 1068,
      }}
    >
      Spot is the open field — every extraction works there. Orderflow buying,
      frontrunning, stop hunting, insider trading, spoofing. Each new product
      structurally refuses one more. Block trading refuses all of them.
    </div>
  </div>
);

const ColumnHeaders: React.FC = () => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "440px repeat(4, 1fr)",
      borderBottom: `1px solid ${C.border}`,
      paddingBottom: 22,
      marginBottom: 12,
    }}
  >
    <div />
    {COLUMNS.map((c) => (
      <div key={c.name} style={{ paddingLeft: 28, paddingRight: 28 }}>
        <div
          style={{
            fontFamily: FONT_TEXT,
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.011em",
            color: C.inkTertiary,
            fontVariantNumeric: "tabular-nums",
            marginBottom: 10,
          }}
        >
          {c.num}
        </div>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 28,
            fontWeight: 600,
            color: C.ink,
            letterSpacing: "-0.016em",
            lineHeight: 1.1428,
            marginBottom: 8,
          }}
        >
          {c.name}
        </div>
        <div
          style={{
            fontFamily: FONT_TEXT,
            fontSize: 14,
            fontWeight: 400,
            color: C.inkSecondary,
            letterSpacing: "-0.016em",
            lineHeight: 1.4,
            minHeight: 36,
          }}
        >
          {c.note}
        </div>
      </div>
    ))}
  </div>
);

const Row: React.FC<{ s: Strategy }> = ({ s }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "440px repeat(4, 1fr)",
      alignItems: "center",
      borderBottom: `1px solid ${C.border}`,
      paddingTop: 14,
      paddingBottom: 14,
    }}
  >
    <div style={{ paddingRight: 32 }}>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 22,
          fontWeight: 500,
          color: C.ink,
          letterSpacing: "-0.016em",
          lineHeight: 1.1666,
          marginBottom: 3,
        }}
      >
        {s.name}
      </div>
      <div
        style={{
          fontFamily: FONT_TEXT,
          fontSize: 14,
          fontWeight: 400,
          color: C.inkSecondary,
          letterSpacing: "-0.016em",
          lineHeight: 1.4,
        }}
      >
        {s.blurb}
      </div>
    </div>

    {COLUMNS.map((_, i) => {
      const live = s.liveIn.includes(i);
      return (
        <div
          key={i}
          style={{
            paddingLeft: 28,
            paddingRight: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
          }}
        >
          {live ? (
            <div
              style={{
                width: 56,
                height: 14,
                background: C.ink,
                borderRadius: 7,
              }}
            />
          ) : (
            <div
              style={{
                width: 56,
                height: 1,
                background: C.borderStrong,
              }}
            />
          )}
        </div>
      );
    })}
  </div>
);

const Closer: React.FC = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      paddingTop: 28,
    }}
  >
    <Eyebrow>Predators present at each market</Eyebrow>
    <div
      style={{
        fontFamily: FONT_DISPLAY,
        fontSize: 24,
        fontWeight: 500,
        color: C.ink,
        letterSpacing: "-0.016em",
        lineHeight: 1.1666,
      }}
    >
      Eight ways to lose. One bet that still works.
    </div>
  </div>
);

export const BlockTradingExile: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div
        style={{
          position: "absolute",
          top: 56,
          left: PAD_X,
          right: PAD_X,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <Eyebrow>Block Trading</Eyebrow>
        <div
          style={{
            fontFamily: FONT_TEXT,
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.011em",
            textTransform: "uppercase",
            color: C.inkTertiary,
          }}
        >
          general market
        </div>
      </div>

      <div
        style={{
          padding: `${PAD_Y}px ${PAD_X}px`,
          width: W,
          height: H,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <Headline />
        <div>
          <ColumnHeaders />
          {STRATEGIES.map((s) => (
            <Row key={s.name} s={s} />
          ))}
        </div>
        <Closer />
      </div>
    </AbsoluteFill>
  );
};

export const BLOCK_TRADING_EXILE_DURATION = Math.round(8 * FPS);

export const blockTradingExileMeta = {
  id: "BlockTradingExile",
  component: BlockTradingExile,
  durationInFrames: BLOCK_TRADING_EXILE_DURATION,
  fps: FPS,
  width: W,
  height: H,
};
