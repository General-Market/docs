import React from "react";
import { AbsoluteFill, Img } from "remotion";
import {
  BAR_TOPS,
  CALLOUT_SCALES,
  CALLOUT_TEXT_ALPHAS,
  ChartCopy,
  ChartTheme,
  CIRCLE_SCALES,
  COUNTERS,
  DOT_SCALES,
  GEOM,
  RING_ALPHA,
  SEG_FRACS,
  tab,
} from "./data";

/**
 * One measured build-cycle of the FNA settlement-frequency chart, rendered at
 * cycle frame `cf` (0..374). All motion comes from the per-frame tables in
 * data.ts; this component only mounts geometry. The same engine renders the
 * 1:1 replica (FNA_THEME/FNA_COPY) and the CRX-branded cut (crx-data.ts).
 */

const G = GEOM;
const BAR_BOTTOM = 578; // bars run under the axis line; the line draws on top

// Single-line label centered on its ink center (digits and cap-height text:
// with lineHeight 1 the box center sits within ~0.5px of the digit ink center
// for Helvetica Neue — verified by A/B stills).
const Label: React.FC<{
  cx?: number;
  cy: number;
  right?: number; // right-aligned mode: ink right edge
  left?: number; // left-aligned mode: ink left edge
  size: number;
  weight?: number;
  color: string;
  font: string;
  rotate?: boolean;
  opacity?: number;
  scaleX?: number; // ink-box width match against the reference face
  children: React.ReactNode;
}> = ({
  cx,
  cy,
  right,
  left,
  size,
  weight = 400,
  color,
  font,
  rotate,
  opacity = 1,
  scaleX = 1,
  children,
}) => {
  const base: React.CSSProperties = {
    position: "absolute",
    top: cy,
    fontFamily: font,
    fontSize: size,
    fontWeight: weight,
    color,
    lineHeight: 1,
    whiteSpace: "nowrap",
    opacity,
  };
  const sx = scaleX === 1 ? "" : ` scaleX(${scaleX})`;
  if (right !== undefined) {
    return (
      <div
        style={{
          ...base,
          right: 1280 - right,
          transform: `translateY(-50%)${sx}`,
          transformOrigin: "right center",
        }}
      >
        {children}
      </div>
    );
  }
  if (left !== undefined) {
    return (
      <div
        style={{
          ...base,
          left,
          transform: `translateY(-50%)${sx}`,
          transformOrigin: "left center",
        }}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      style={{
        ...base,
        left: cx,
        transform: `translate(-50%, -50%)${rotate ? " rotate(-90deg)" : ""}${sx}`,
      }}
    >
      {children}
    </div>
  );
};

// Counter/callout value: digits keep their (matching) advances; only the '%'
// glyph is narrowed to the reference face's width.
const Pct: React.FC<{ text: string; signScaleX: number }> = ({ text, signScaleX }) => (
  <>
    {text.replace("%", "")}
    <span
      style={{
        display: "inline-block",
        transform: `scaleX(${signScaleX})`,
        transformOrigin: "left center",
        // narrow the layout box too, so centered labels keep their ink center
        marginRight: "-0.24em",
      }}
    >
      %
    </span>
  </>
);

export const FnaLoopChart: React.FC<{
  cf: number;
  theme: ChartTheme;
  copy: ChartCopy;
  lockupSrc?: string;
}> = ({ cf, theme, copy, lockupSrc }) => {
  const font = theme.fontFamily;

  // per-frame state from the measured tables
  const tops = BAR_TOPS.map((t) => tab(t.v, t.start, cf, BAR_BOTTOM));
  const counters = COUNTERS.map((t) => (cf < t.start ? null : tab(t.v, t.start, cf)));
  const dotS = DOT_SCALES.map((t) => (cf < t.start ? 0 : tab(t.v, t.start, cf)));
  const circS = CIRCLE_SCALES.map((t) => (cf < t.start ? 0 : tab(t.v, t.start, cf)));
  const callS = CALLOUT_SCALES.map((t) => (cf < t.start ? 0 : tab(t.v, t.start, cf)));
  const callA = CALLOUT_TEXT_ALPHAS.map((t) => (cf < t.start ? 0 : tab(t.v, t.start, cf)));
  const segF = SEG_FRACS.map((t) => (cf < t.start ? 0 : tab(t.v, t.start, cf)));
  const ringA = cf < RING_ALPHA.start ? 0 : tab(RING_ALPHA.v, RING_ALPHA.start, cf);

  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <svg width={1280} height={720} style={{ position: "absolute", inset: 0 }}>
        {/* bars */}
        {G.bars.map((b, i) =>
          tops[i] >= BAR_BOTTOM ? null : (
            <rect
              key={`bar${i}`}
              x={b.x}
              y={tops[i]}
              width={b.w}
              height={BAR_BOTTOM - tops[i]}
              fill={theme.barColors[i]}
            />
          ),
        )}
        {/* callout bubbles */}
        {G.callouts.map((c, i) =>
          callS[i] <= 0 ? null : (
            <circle
              key={`call${i}`}
              cx={0}
              cy={0}
              r={c.r}
              fill={theme.calloutFills[i]}
              transform={`translate(${c.cx}, ${c.cy}) scale(${callS[i]})`}
            />
          ),
        )}
        {/* connector segments, drawn left→right */}
        {segF.map((f, i) => {
          if (f <= 0) {
            return null;
          }
          const a = G.dots[i];
          const b = G.dots[i + 1];
          return (
            <line
              key={`seg${i}`}
              x1={a.cx}
              y1={a.cy}
              x2={a.cx + (b.cx - a.cx) * f}
              y2={a.cy + (b.cy - a.cy) * f}
              stroke={theme.navy}
              strokeWidth={G.connectorWidth}
            />
          );
        })}
        {/* efficiency dots */}
        {G.dots.map((d, i) =>
          dotS[i] <= 0 ? null : (
            <circle
              key={`dot${i}`}
              cx={0}
              cy={0}
              r={d.r}
              fill={theme.dotColors[i]}
              transform={`translate(${d.cx}, ${d.cy}) scale(${dotS[i]})`}
            />
          ),
        )}
        {/* dot3 ring */}
        {ringA > 0 ? (
          <circle
            cx={G.dots[2].cx}
            cy={G.dots[2].cy}
            r={G.ringOuterR}
            fill="none"
            stroke={theme.ringColor}
            strokeWidth={G.ringStroke}
            opacity={ringA}
          />
        ) : null}
        {/* knockout circles inside bars */}
        {G.circles.map((c, i) =>
          circS[i] <= 0 ? null : (
            <circle
              key={`circ${i}`}
              cx={0}
              cy={0}
              r={c.r}
              fill={theme.circleFill}
              transform={`translate(${c.cx}, ${c.cy}) scale(${circS[i]})`}
            />
          ),
        )}
        {/* axis lines, over the bars (measured z-order) */}
        <rect
          x={G.leftAxisX}
          y={G.axisTopY}
          width={G.axisStroke}
          height={BAR_BOTTOM - G.axisTopY}
          fill={theme.axisLine}
        />
        <rect
          x={G.rightAxisX}
          y={G.axisTopY}
          width={G.axisStroke}
          height={BAR_BOTTOM - G.axisTopY}
          fill={theme.axisLine}
        />
        <rect
          x={G.leftAxisX}
          y={G.baselineY}
          width={G.rightAxisX + G.axisStroke - G.leftAxisX}
          height={G.axisStroke}
          fill={theme.axisLine}
        />
      </svg>

      {/* static axis labels */}
      {copy.leftLabels.map((s, i) => (
        <Label
          key={`ll${i}`}
          right={G.leftLabelRight}
          cy={G.labelYs[i]}
          size={G.axisFontSize}
          weight={theme.textWeight}
          color={theme.axisText}
          font={font}
        >
          {s}
        </Label>
      ))}
      {copy.rightLabels.map((s, i) => (
        <Label
          key={`rl${i}`}
          left={G.rightLabelLeft}
          cy={G.labelYs[i]}
          size={G.axisFontSize}
          weight={theme.textWeight}
          color={theme.axisText}
          font={font}
        >
          {s}
        </Label>
      ))}
      {copy.ticks.map((s, i) => (
        <Label
          key={`tk${i}`}
          cx={G.tickXs[i]}
          cy={G.tickCY}
          size={G.axisFontSize}
          weight={theme.textWeight}
          color={theme.axisText}
          font={font}
        >
          {s}
        </Label>
      ))}
      <Label
        cx={G.xTitleC.x}
        cy={G.xTitleC.y}
        size={G.axisFontSize}
        weight={theme.textWeight}
        color={theme.axisText}
        font={font}
        scaleX={G.xTitleScaleX}
      >
        {copy.xTitle}
      </Label>
      <Label
        cx={G.leftTitleC.x}
        cy={G.leftTitleC.y}
        size={G.axisFontSize}
        weight={theme.textWeight}
        color={theme.axisText}
        font={font}
        rotate
        scaleX={G.leftTitleScaleX}
      >
        {copy.leftTitle}
      </Label>
      <Label
        cx={G.rightTitleC.x}
        cy={G.rightTitleC.y}
        size={G.axisFontSize}
        weight={theme.textWeight}
        color={theme.axisText}
        font={font}
        rotate
        scaleX={G.rightTitleScaleX}
      >
        {copy.rightTitle}
      </Label>

      {/* % counters */}
      {counters.map((v, i) =>
        v === null ? null : (
          <Label
            key={`pct${i}`}
            cx={G.barCenters[i] + G.pctDX}
            cy={G.pctCY}
            size={G.pctSize}
            weight={theme.boldWeight}
            color={theme.axisText}
            font={font}
          >
            <Pct text={`${v.toFixed(1)}%`} signScaleX={G.pctSignScaleX} />
          </Label>
        ),
      )}

      {/* callout texts */}
      {copy.callouts.map((s, i) =>
        callA[i] <= 0 ? null : (
          <Label
            key={`ct${i}`}
            cx={G.callouts[i].cx}
            cy={G.calloutTextCY}
            size={G.calloutFontSize}
            weight={theme.boldWeight}
            color={theme.calloutText}
            font={font}
            opacity={callA[i]}
          >
            {s}
          </Label>
        ),
      )}

      {/* in-bar USD labels, revealed by the rising bar edge (clip container
          rides the bar top; the text keeps its global position) */}
      {G.usd.map((u, i) => {
        const b = G.bars[i];
        const top = tops[i];
        if (top >= BAR_BOTTOM) {
          return null;
        }
        const g = copy.groups[i];
        return (
          <div
            key={`usd${i}`}
            style={{
              position: "absolute",
              left: b.x,
              top,
              width: b.w,
              height: BAR_BOTTOM - top,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: u.cx - b.x,
                top: u.cy - top,
                transform: "translate(-50%, -50%)",
                fontFamily: font,
                fontSize: G.usdSize,
                fontWeight: theme.textWeight,
                color: theme.usdText,
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              {g.usdPre}
              <span style={{ fontWeight: theme.boldWeight }}>{g.usdBold}</span>
              {g.usdPost}
            </div>
          </div>
        );
      })}

      {/* knockout-circle text, scaling with its circle */}
      {G.circles.map((c, i) => {
        if (circS[i] <= 0) {
          return null;
        }
        const lines = copy.groups[i].circleLines;
        return (
          <div
            key={`ctx${i}`}
            style={{
              position: "absolute",
              left: c.cx,
              top: G.circleTextCY[i],
              transform: `translate(-50%, -50%) scale(${circS[i]})`,
              fontFamily: font,
              fontSize: G.circleFontSize,
              fontWeight: theme.boldWeight,
              color: theme.circleText[i],
              lineHeight: `${G.circleLineHeight}px`,
              whiteSpace: "nowrap",
              textAlign: "center",
            }}
          >
            {lines.map((l, j) => (
              <div key={j}>{l}</div>
            ))}
          </div>
        );
      })}

      {/* CRX-cut extras: headline + lockup (absent in the 1:1 replica) */}
      {copy.title ? (
        <div
          style={{
            position: "absolute",
            left: 100,
            top: 62,
            fontFamily: font,
            color: theme.axisText,
          }}
        >
          <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.15 }}>{copy.title.head}</div>
          <div style={{ fontSize: 19, fontWeight: 400, opacity: 0.62, marginTop: 8 }}>
            {copy.title.sub}
          </div>
        </div>
      ) : null}
      {lockupSrc ? (
        <Img
          src={lockupSrc}
          style={{ position: "absolute", right: 40, bottom: 30, height: 22, opacity: 0.9 }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
