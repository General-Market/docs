import React from "react";
import { AbsoluteFill } from "remotion";
import { measureText } from "@remotion/layout-utils";
import { fmtValue, type NetGrowthCopy, COLORS } from "./data";
import {
  cycleOf,
  tab,
  H1_RISE,
  H2_RISE,
  SUB_RISE,
  LAB_IN,
  TRK1_IN,
  TRK2_IN,
  DIV_IN,
  SQ_IN,
  LEG1_IN,
  LEG2_IN,
  FN_IN,
  LOGO_IN,
  WORD_IN,
  WORD_STARTS,
  POP_Y,
  POP_T,
  CX_Y,
  CX_T,
  D_Y,
  D_T,
  BREATH_D,
  ROW1_OUT,
  ROW2_OUT,
  H1_OUT,
  H2_OUT,
  SUB_OUT,
  LEG1_OUT,
  LEG2_OUT,
  SQ_OUT,
  LOGO_OUT,
  DIV_OUT,
  WORD_OUT,
  FN_SINK,
} from "./motion";

// ═══════════════════════════════════════════════════════════════
// One cycle of the CLSNet growth choreography, driven entirely by
// measured per-frame tables (motion.ts / genTables.ts). The video is
// this cycle three times; the background plates drift underneath on
// the absolute clock. All copy/colors arrive via `theme` so the CRX
// cut mounts the identical motion with its own brand.
// ═══════════════════════════════════════════════════════════════

export type SceneTheme = {
  serifFamily: string;
  sansFamily: string;
  serifWeight: string;
  sansWeight: string; // headline line 2 / labels / legend / footnote / tagline
  boldWeight: string; // subtitle
  digitWeight: string; // bubble digits
  serifCapOffset: number; // (box-top → cap-top) / fontSize, calibrated
  sansCapOffset: number;
  // Replica mode stretches every line to the reference's measured ink box.
  // Brand cuts (CRX) set true: lines run at the face's natural width.
  naturalWidths?: boolean;
  copy: NetGrowthCopy;
  colors: typeof COLORS;
};

// ─── Measured layout (px in the 1080×1080 frame) ───
// `fix` = comparator-measured render trim (att vs ref at settled f180,
// r2 pass): plain-div glyphs land 0-4px high and lsb-shifted vs the
// measured ink anchors (strut law, lesson 11). Trims shift the whole
// motion path rigidly — entrance/exit tables are offsets from settled.
const L = {
  h1: { x: 64, capTop: 79, fs: 82.9, inkW: 523, clipTop: 71, clipBottom: 157, fix: { dx: -5, dy: 0 } },
  h2: { x: 68, capTop: 164, fs: 77, inkW: 605, clipTop: 158, clipBottom: 238, fix: { dx: -5, dy: 1 } },
  sub: { x: 69, capTop: 256, fs: 32.2, inkW: 432, clipTop: 248, clipBottom: 292, fix: { dx: 1, dy: 1 } },
  rows: [
    {
      y: 411, labelCapTop: 391, trackEnd: 945, finalCx: 923.5, finalD: 162.2,
      labStart: 36, trkStart: 31, trkTab: TRK1_IN, popStart: 44, popTab: POP_Y,
      cxTab: CX_Y, dTab: D_Y, outTab: ROW1_OUT, dir: 1, fix: { dx: 0, dy: 2, digitDy: 1.5, digitSx: 0.97 },
    },
    {
      y: 658.5, labelCapTop: 639, trackEnd: 943, finalCx: 837, finalD: 163.1,
      labStart: 41, trkStart: 40, trkTab: TRK2_IN, popStart: 43, popTab: POP_T,
      cxTab: CX_T, dTab: D_T, outTab: ROW2_OUT, dir: -1, fix: { dx: 0, dy: 3, digitDy: -2.7, digitSx: 0.955 },
    },
  ],
  labelX: 56, labelInkW: 374, labelFs: 35,
  trackX0: 450, trackH: 10,
  digitFs: 56,
  legend: [
    { sqX: 57, textX: 125, inkW: 276, inTab: LEG1_IN, inStart: 37, outTab: LEG1_OUT, fix: { dx: 3, dy: 1 } },
    { sqX: 459, textX: 526, inkW: 270, inTab: LEG2_IN, inStart: 36, outTab: LEG2_OUT, fix: { dx: -1, dy: 1 } },
  ],
  legendSqY: 838, legendSq: 33, legendCapTop: 841, legendFs: 34,
  fn: { x: 57, capTop: 900, fs: 25.2, inkW: 864, fix: { dx: -1, dy: 1 } },
  divider: { y: 945, x0: 55, h: 1.5 },
  logo: { x: 58, capTop: 971, fs: 51.4, inkW: 173, clipLeft: 51, fix: { dx: -3, dy: 2 } },
  tag: {
    capTop: 1025, fs: 29.4, fix: { dy: 4 },
    // Ink-truth boxes re-measured r2 (r1 had word2/3 wrong: 247/198, 469/116).
    words: [
      { x: 58, w: 177, dx: -1 },
      { x: 243, w: 206, dx: -1 },
      { x: 457, w: 133, dx: -2 },
    ],
  },
};

const natWidth = (
  text: string,
  fontFamily: string,
  fontSize: number,
  fontWeight: string,
): number => measureText({ text, fontFamily, fontSize, fontWeight }).width;

// A single line of ink, placed by measured cap-top and stretched to the
// measured ink width (anoma technique — no invented tracking).
const Line: React.FC<{
  text: string;
  x: number;
  capTop: number;
  fs: number;
  inkW: number;
  family: string;
  weight: string;
  capOffset: number;
  color: string;
  dy?: number;
  dx?: number;
  opacity?: number;
  natural?: boolean;
}> = ({ text, x, capTop, fs, inkW, family, weight, capOffset, color, dy = 0, dx = 0, opacity = 1, natural = false }) => {
  if (opacity <= 0) return null;
  const nat = natWidth(text, family, fs, weight);
  const sx = natural || nat <= 0 ? 1 : inkW / nat;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: capTop - capOffset * fs,
        fontFamily: family,
        fontWeight: weight as React.CSSProperties["fontWeight"],
        fontSize: fs,
        lineHeight: 1,
        color,
        whiteSpace: "pre",
        transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scaleX(${sx.toFixed(4)})`,
        transformOrigin: "left top",
        opacity,
      }}
    >
      {text}
    </div>
  );
};

// Vertical-clip window for the rising headline lines.
const RiseClip: React.FC<{ top: number; bottom: number; children: React.ReactNode }> = ({
  top,
  bottom,
  children,
}) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top,
      width: 1080,
      height: bottom - top,
      overflow: "hidden",
    }}
  >
    <div style={{ position: "absolute", left: 0, top: -top, width: 1080, height: 1080 }}>
      {children}
    </div>
  </div>
);

const Headline: React.FC<{ rf: number; exitAt: number; th: SceneTheme }> = ({ rf, exitAt, th }) => {
  const h1dy = rf < 9 ? null : rf < exitAt ? tab(H1_RISE, 9, rf) : tab(H1_OUT, exitAt, rf);
  const h2dy = rf < 20 ? null : rf < exitAt ? tab(H2_RISE, 20, rf) : tab(H2_OUT, exitAt, rf);
  const subdy = rf < 25 ? null : rf < exitAt ? tab(SUB_RISE, 25, rf) : tab(SUB_OUT, exitAt, rf);
  return (
    <>
      {h1dy !== null && (
        <RiseClip top={L.h1.clipTop} bottom={L.h1.clipBottom}>
          <Line
            text={th.copy.headlineSerif}
            x={L.h1.x + L.h1.fix.dx}
            capTop={L.h1.capTop + L.h1.fix.dy}
            fs={L.h1.fs}
            inkW={L.h1.inkW}
            family={th.serifFamily}
            weight={th.serifWeight}
            capOffset={th.serifCapOffset}
            color={th.colors.ink}
            natural={th.naturalWidths}
            dy={h1dy}
          />
        </RiseClip>
      )}
      {h2dy !== null && (
        <RiseClip top={L.h2.clipTop} bottom={L.h2.clipBottom}>
          <Line
            text={th.copy.headlineSans}
            x={L.h2.x + L.h2.fix.dx}
            capTop={L.h2.capTop + L.h2.fix.dy}
            fs={L.h2.fs}
            inkW={L.h2.inkW}
            family={th.sansFamily}
            weight={th.sansWeight}
            capOffset={th.sansCapOffset}
            color={th.colors.ink}
            natural={th.naturalWidths}
            dy={h2dy}
          />
        </RiseClip>
      )}
      {subdy !== null && (
        <RiseClip top={L.sub.clipTop} bottom={L.sub.clipBottom}>
          <Line
            text={th.copy.subtitle}
            x={L.sub.x + L.sub.fix.dx}
            capTop={L.sub.capTop + L.sub.fix.dy}
            fs={L.sub.fs}
            inkW={L.sub.inkW}
            family={th.sansFamily}
            weight={th.boldWeight}
            capOffset={th.sansCapOffset}
            color={th.colors.ink}
            natural={th.naturalWidths}
            dy={subdy}
          />
        </RiseClip>
      )}
    </>
  );
};

const StatRow: React.FC<{ i: 0 | 1; rf: number; exitAt: number; th: SceneTheme }> = ({
  i,
  rf,
  exitAt,
  th,
}) => {
  const R = L.rows[i];
  const row = th.copy.rows[i];
  // Row-level exit slide (rigid: label + track + fill + bubble together).
  const rowDx = rf >= exitAt ? R.dir * tab(R.outTab, exitAt, rf) : 0;
  if (Math.abs(rowDx) > 1500) return null;

  // Track draw-on
  const trackRight = rf < R.trkStart ? L.trackX0 : tab(R.trkTab, R.trkStart, rf);
  const trackW = Math.max(0, trackRight - L.trackX0);

  // Bubble state
  let cx = R.cxTab[0];
  let D: number | null = null;
  if (rf >= R.popStart && rf < 50) {
    D = tab(R.popTab, R.popStart, rf);
  } else if (rf >= 50 && rf <= 98) {
    cx = tab(R.cxTab, 50, rf);
    D = tab(R.dTab, 50, rf);
  } else if (rf > 98) {
    cx = R.finalCx;
    D = R.finalD;
    if (rf >= 114 && rf <= 166) {
      D = R.finalD * (tab(BREATH_D, 114, rf) / BREATH_D[0]);
    }
  }

  // Displayed value
  const v =
    rf < 50 ? row.values[0] : rf <= 98 ? tab(row.values, 50, rf) : row.values[row.values.length - 1];

  // Label slide-in
  const labDx = rf < R.labStart ? null : -tab(LAB_IN, R.labStart, rf);

  const fillW = Math.max(0, cx - L.trackX0);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* The label lives in a SCREEN-space clip ending just before the
          track zone (measured: exit ink pinned at x≈434+AA) — on exit it
          slides right and is consumed at x=436 while the row flies on. */}
      {labDx !== null && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: R.labelCapTop - 12,
            width: 436,
            height: 60,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: -(R.labelCapTop - 12),
              width: 1080,
              height: 1080,
            }}
          >
            <Line
              text={row.label}
              x={L.labelX + R.fix.dx}
              capTop={R.labelCapTop + R.fix.dy}
              fs={L.labelFs}
              inkW={L.labelInkW}
              family={th.sansFamily}
              weight={th.sansWeight}
              capOffset={th.sansCapOffset}
              color={th.colors.label}
              natural={th.naturalWidths}
              dx={labDx + rowDx}
            />
          </div>
        </div>
      )}
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${rowDx.toFixed(2)}px)` }}>
      {trackW > 0 && (
        <div
          style={{
            position: "absolute",
            left: L.trackX0,
            top: R.y - L.trackH / 2,
            width: trackW,
            height: L.trackH,
            borderRadius: L.trackH / 2,
            backgroundColor: th.colors.track,
          }}
        />
      )}
      {D !== null && fillW > 0 && (
        <div
          style={{
            position: "absolute",
            left: L.trackX0,
            top: R.y - L.trackH / 2,
            width: fillW,
            height: L.trackH,
            borderRadius: `${L.trackH / 2}px 0 0 ${L.trackH / 2}px`,
            backgroundColor: row.bubble,
          }}
        />
      )}
      {D !== null && D > 1 && (
        <div
          style={{
            position: "absolute",
            left: cx - D / 2,
            top: R.y - D / 2,
            width: D,
            height: D,
            borderRadius: "50%",
            backgroundColor: row.bubble,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily: th.sansFamily,
              fontWeight: th.digitWeight as React.CSSProperties["fontWeight"],
              fontSize: L.digitFs * (D / R.finalD),
              lineHeight: 1,
              color: row.digits,
              // Per-row digit trims (comparator vs ref at f75+f180): ref row2
              // digits ride ~2.5px ABOVE bubble center (row1 below); HN digits
              // set ~4% wider than the ref face.
              transform: `translateY(${(R.fix.digitDy * D / R.finalD).toFixed(2)}px) scaleX(${R.fix.digitSx})`,
              whiteSpace: "pre",
            }}
          >
            {fmtValue(v)}
          </span>
        </div>
      )}
      </div>
    </div>
  );
};

const Legend: React.FC<{ i: 0 | 1; rf: number; exitAt: number; th: SceneTheme }> = ({
  i,
  rf,
  exitAt,
  th,
}) => {
  const G = L.legend[i];
  const row = th.copy.rows[i];
  // Square scale (entrance f30-37, exit from exitAt+11)
  let sqW = 0;
  if (rf >= 30 && rf < exitAt + 11) sqW = tab(SQ_IN, 30, rf);
  else if (rf >= exitAt + 11) sqW = tab(SQ_OUT, exitAt + 11, rf);
  const sqC = G.sqX + L.legendSq / 2;
  // Text slide (entrance + exit both behind the clip at the square edge)
  const dxIn = rf < G.inStart ? null : tab(G.inTab, G.inStart, rf);
  const dxOut = rf >= exitAt ? tab(G.outTab, exitAt, rf) : 0;
  const clipLeft = G.sqX + L.legendSq + 4;
  return (
    <>
      {sqW > 0.5 && (
        <div
          style={{
            position: "absolute",
            left: sqC - sqW / 2,
            top: L.legendSqY + (L.legendSq - sqW) / 2,
            width: sqW,
            height: sqW,
            borderRadius: 2 * (sqW / L.legendSq),
            backgroundColor: row.bubble,
          }}
        />
      )}
      {dxIn !== null && (
        <div
          style={{
            position: "absolute",
            left: clipLeft,
            top: L.legendSqY - 10,
            width: G.textX + G.inkW + (th.naturalWidths ? 140 : 20) - clipLeft,
            height: 55,
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", left: -clipLeft, top: -(L.legendSqY - 10), width: 1080, height: 1080 }}>
            <Line
              text={row.legendLabel}
              x={G.textX + G.fix.dx}
              capTop={L.legendCapTop + G.fix.dy}
              fs={L.legendFs}
              inkW={G.inkW}
              family={th.sansFamily}
              weight={th.sansWeight}
              capOffset={th.sansCapOffset}
              color={row.legendText}
              natural={th.naturalWidths}
              dx={-dxIn - dxOut}
            />
          </div>
        </div>
      )}
    </>
  );
};

const Footnote: React.FC<{ rf: number; exitAt: number; th: SceneTheme }> = ({ rf, exitAt, th }) => {
  if (rf < 58) return null;
  const dx = -tab(FN_IN, 58, rf);
  // Exit: sinks at FULL opacity behind a clip at y=944, just above the
  // divider (measured; r1's 3-frame fade was refuted — see FN_SINK).
  const dy = rf >= exitAt ? tab(FN_SINK, exitAt, rf) : 0;
  if (dy > 50) return null; // fully consumed by the clip
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 890,
        width: 1080,
        height: 54,
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", left: 0, top: -890, width: 1080, height: 1080 }}>
        <Line
          text={th.copy.footnote}
          x={L.fn.x + L.fn.fix.dx}
          capTop={L.fn.capTop + L.fn.fix.dy}
          fs={L.fn.fs}
          inkW={L.fn.inkW}
          family={th.sansFamily}
          weight={th.sansWeight}
          capOffset={th.sansCapOffset}
          color={th.colors.footnote}
          natural={th.naturalWidths}
          dx={dx}
          dy={dy}
        />
      </div>
    </div>
  );
};

const Divider: React.FC<{ rf: number; exitAt: number; th: SceneTheme }> = ({ rf, exitAt, th }) => {
  if (rf < 34) return null;
  const right =
    rf >= exitAt + 4 ? tab(DIV_OUT, exitAt + 4, rf) : tab(DIV_IN, 34, rf);
  const w = Math.max(0, right - L.divider.x0);
  if (w <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: L.divider.x0,
        top: L.divider.y,
        width: w,
        height: L.divider.h,
        backgroundColor: th.colors.divider,
      }}
    />
  );
};

const Logo: React.FC<{ rf: number; exitAt: number; th: SceneTheme }> = ({ rf, exitAt, th }) => {
  if (rf < 54) return null;
  const dx = rf >= exitAt ? -tab(LOGO_OUT, exitAt, rf) : -tab(LOGO_IN, 54, rf);
  return (
    <div
      style={{
        position: "absolute",
        left: L.logo.clipLeft,
        top: 960,
        width: 400,
        height: 55,
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", left: -L.logo.clipLeft, top: -960, width: 1080, height: 1080 }}>
        <Line
          text={th.copy.logo}
          x={L.logo.x + L.logo.fix.dx}
          capTop={L.logo.capTop + L.logo.fix.dy}
          fs={L.logo.fs}
          inkW={L.logo.inkW}
          family={th.serifFamily}
          weight={th.serifWeight}
          capOffset={th.serifCapOffset}
          color={th.colors.ink}
          natural={th.naturalWidths}
          dx={dx}
        />
      </div>
    </div>
  );
};

const Tagline: React.FC<{ rf: number; exitAt: number; th: SceneTheme }> = ({ rf, exitAt, th }) => (
  <>
    {th.copy.taglineWords.map((word, wi) => {
      const start = WORD_STARTS[wi];
      if (rf < start) return null;
      const s = rf >= exitAt ? tab(WORD_OUT, exitAt, rf) : tab(WORD_IN, start, rf);
      if (s <= 0.01) return null;
      const box = L.tag.words[wi];
      const nat = natWidth(word, th.sansFamily, L.tag.fs, th.sansWeight);
      const sx = th.naturalWidths || nat <= 0 ? 1 : box.w / nat;
      return (
        <div
          key={wi}
          style={{
            position: "absolute",
            left: box.x + box.dx,
            top: L.tag.capTop + L.tag.fix.dy - th.sansCapOffset * L.tag.fs,
            width: box.w,
            height: L.tag.fs,
            transform: `scale(${s.toFixed(4)})`,
            transformOrigin: "center center",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              fontFamily: th.sansFamily,
              fontWeight: th.sansWeight as React.CSSProperties["fontWeight"],
              fontSize: L.tag.fs,
              lineHeight: 1,
              color: th.colors.ink,
              whiteSpace: "pre",
              transform: `scaleX(${sx.toFixed(4)})`,
              transformOrigin: "left top",
            }}
          >
            {word}
          </div>
        </div>
      );
    })}
  </>
);

export const NetGrowthScene: React.FC<{ frame: number; theme: SceneTheme }> = ({
  frame,
  theme,
}) => {
  const { rf, exitAt } = cycleOf(frame);
  return (
    <AbsoluteFill>
      <StatRow i={0} rf={rf} exitAt={exitAt} th={theme} />
      <StatRow i={1} rf={rf} exitAt={exitAt} th={theme} />
      <Legend i={0} rf={rf} exitAt={exitAt} th={theme} />
      <Legend i={1} rf={rf} exitAt={exitAt} th={theme} />
      <Footnote rf={rf} exitAt={exitAt} th={theme} />
      <Divider rf={rf} exitAt={exitAt} th={theme} />
      <Logo rf={rf} exitAt={exitAt} th={theme} />
      <Tagline rf={rf} exitAt={exitAt} th={theme} />
      <Headline rf={rf} exitAt={exitAt} th={theme} />
    </AbsoluteFill>
  );
};
