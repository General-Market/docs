import React from "react";
import { interpolate } from "remotion";
import { C } from "./data";
import { useBrand } from "./brand";
import { TracedArt } from "./TracedArt";

export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const lerp = (
  frame: number,
  range: [number, number],
  out: [number, number],
) => interpolate(frame, range, out, clamp);

// ─── Hexagon (pointed left/right, flat top/bottom) ───
export const hexPoints = (w: number, h: number) =>
  `${0.25 * w},1.5 ${0.75 * w},1.5 ${w - 1.5},${h / 2} ${0.75 * w},${h - 1.5} ${0.25 * w},${h - 1.5} 1.5,${h / 2}`;

export const Hexagon: React.FC<{
  cx: number;
  cy: number;
  w: number;
  h?: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  opacity?: number;
  drawP?: number; // 0-1 outline draw progress
  children?: React.ReactNode;
}> = ({
  cx,
  cy,
  w,
  h = w * 0.906,
  stroke = C.navy,
  strokeWidth = 3,
  fill = "none",
  opacity = 1,
  drawP = 1,
  children,
}) => {
  if (opacity <= 0) return null;
  const per = 4 * Math.hypot(0.25 * w, h / 2) * 0.5 + w; // approx perimeter
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ position: "absolute", left: cx - w / 2, top: cy - h / 2, opacity, overflow: "visible" }}
    >
      {children}
      <polygon
        points={hexPoints(w, h)}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeDasharray={drawP < 1 ? per : undefined}
        strokeDashoffset={drawP < 1 ? per * (1 - drawP) : undefined}
      />
    </svg>
  );
};

// Hexagon with white fill + traced art clipped inside.
export const HexIcon: React.FC<{
  art: string;
  cx: number;
  cy: number;
  w: number;
  opacity?: number;
  artScale?: number;
  drawP?: number;
}> = ({ art, cx, cy, w, opacity = 1, artScale, drawP = 1 }) => {
  if (opacity <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, opacity }}>
      <TracedArt
        name={art}
        x={cx - w / 2}
        y={cy - (w * 0.906) / 2}
        scale={artScale ?? w / 340}
      />
      {drawP < 1 && <Hexagon cx={cx} cy={cy} w={w} drawP={drawP} stroke="rgba(0,39,83,0.001)" />}
    </div>
  );
};

// ─── CLSNet logo box ───
export const ClsNetBox: React.FC<{
  x: number;
  y: number;
  w?: number;
  opacity?: number;
  label?: boolean;
  labelFs?: number;
  border?: "none" | "orange";
  bg?: string;
  markP?: number;
}> = ({ x, y, w = 274, opacity = 1, label = true, labelFs = 34, border = "none", bg = C.navy, markP = 1 }) => {
  const brand = useBrand();
  if (opacity <= 0) return null;
  const h = (w / 274) * 300;
  const scale = w / 274;
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity }}>
      <div
        style={{
          position: "absolute",
          width: w,
          height: h * 0.94,
          borderRadius: 40 * scale,
          backgroundColor: bg,
          border: border === "orange" ? `${3 * scale}px solid ${C.orange}` : undefined,
        }}
      />
      {markP > 0 && (
        <TracedArt name="logoMark" x={0} y={0} scale={scale} opacity={markP} />
      )}
      {label && (
        <div
          style={{
            position: "absolute",
            top: h * 0.94 + 10 * scale,
            width: w,
            textAlign: "center",
            fontFamily: brand.sans,
            fontWeight: 700,
            fontSize: labelFs,
            color: C.navy,
          }}
        >
          {brand.boxLabel}
        </div>
      )}
    </div>
  );
};

// ─── Serif label (USD/CNH/EUR…) ───
export const SerifLabel: React.FC<{
  text: string;
  x: number;
  capTop: number;
  fs: number;
  color?: string;
  opacity?: number;
  align?: "left" | "right" | "center";
  width?: number;
  tracking?: number;
}> = ({ text, x, capTop, fs, color = C.navy, opacity = 1, align = "left", width, tracking }) => {
  const brand = useBrand();
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: capTop - 0.3 * fs, // serif cap sits ~0.30em below box top at lh 1
        width,
        fontFamily: brand.serif,
        fontWeight: 400,
        fontSize: fs,
        lineHeight: 1,
        color,
        opacity,
        whiteSpace: "pre",
        textAlign: align,
        letterSpacing: tracking,
      }}
    >
      {text}
    </div>
  );
};

// ─── Sans text ───
export const SansText: React.FC<{
  text: string;
  x: number;
  y: number;
  fs: number;
  color?: string;
  weight?: number;
  opacity?: number;
  align?: "left" | "right" | "center";
  width?: number;
  lineHeight?: number;
}> = ({ text, x, y, fs, color = C.white, weight = 400, opacity = 1, align = "left", width, lineHeight = 1.15 }) => {
  const brand = useBrand();
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        fontFamily: brand.sans,
        fontWeight: weight,
        fontSize: fs,
        lineHeight,
        color,
        opacity,
        whiteSpace: "pre-wrap",
        textAlign: align,
      }}
    >
      {text}
    </div>
  );
};

// ─── Payment pill ───
export const Pill: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  color: string;
  opacity?: number;
  variant?: "leaf" | "round";
}> = ({ x, y, w = 62, h = 26, color, opacity = 1, variant = "leaf" }) => {
  if (opacity <= 0) return null;
  // "leaf": rounded with one square corner (ref pills read as leaf-shaped)
  const r = h / 2;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        backgroundColor: color,
        borderRadius: variant === "leaf" ? `${r}px ${r}px ${r}px 4px` : r,
        opacity,
      }}
    />
  );
};

// ─── A/B badge ───
export const Badge: React.FC<{
  letter: string;
  cx: number;
  cy: number;
  r?: number;
  opacity?: number;
}> = ({ letter, cx, cy, r = 42, opacity = 1 }) => {
  const brand = useBrand();
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: cx - r,
        top: cy - r,
        width: 2 * r,
        height: 2 * r,
        borderRadius: r,
        backgroundColor: C.navy,
        color: C.white,
        fontFamily: brand.serif,
        fontSize: r * 1.15,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
      }}
    >
      {letter}
    </div>
  );
};

// ─── Orange elbow connector (H then V or V then H) with optional arrowhead ───
export const Elbow: React.FC<{
  points: [number, number][];
  color?: string;
  width?: number;
  opacity?: number;
  arrow?: "end" | "none";
  drawP?: number;
}> = ({ points, color = C.orange, width = 3, opacity = 1, arrow = "none", drawP = 1 }) => {
  if (opacity <= 0 || points.length < 2 || drawP <= 0) return null;
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`)
    .join(" ");
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const ang = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
  const ah = 12;
  return (
    <svg
      width={1920}
      height={1080}
      viewBox="0 0 1920 1080"
      style={{ position: "absolute", left: 0, top: 0, opacity, pointerEvents: "none" }}
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={drawP < 1 ? len : undefined}
        strokeDashoffset={drawP < 1 ? len * (1 - drawP) : undefined}
      />
      {arrow === "end" && drawP >= 1 && (
        <g transform={`translate(${last[0]},${last[1]}) rotate(${(ang * 180) / Math.PI})`}>
          <path d={`M0,0 L${-ah},${-ah * 0.6} M0,0 L${-ah},${ah * 0.6}`} stroke={color} strokeWidth={width} fill="none" />
        </g>
      )}
    </svg>
  );
};

// ─── Document icon (paper with folded corner + rule lines) ───
export const Doc: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  opacity?: number;
  lines?: { color: string; w: number }[];
  label?: string;
  labelColor?: string;
}> = ({ x, y, w = 90, h = 110, opacity = 1, lines, label, labelColor = C.orangeDeep }) => {
  const brand = useBrand();
  if (opacity <= 0) return null;
  const fold = w * 0.22;
  const ls = lines ?? [
    { color: C.navy, w: 0.55 },
    { color: C.orangeDeep, w: 0.4 },
    { color: C.navy, w: 0.5 },
  ];
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ position: "absolute", left: x, top: y, opacity }}
    >
      <path
        d={`M2,2 H${w - fold - 2} L${w - 2},${fold + 2} V${h - 2} H2 Z`}
        fill={C.white}
        stroke={C.navy}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <path d={`M${w - fold - 2},2 V${fold + 2} H${w - 2}`} fill="none" stroke={C.navy} strokeWidth={2.5} />
      {label ? (
        <text
          x={w * 0.14}
          y={h * 0.45}
          fontFamily={brand.sans}
          fontSize={w * 0.19}
          fill={labelColor}
        >
          {label.split("\n").map((s, i) => (
            <tspan key={i} x={w * 0.14} dy={i === 0 ? 0 : w * 0.2}>
              {s}
            </tspan>
          ))}
        </text>
      ) : (
        ls.map((l, i) => (
          <rect
            key={i}
            x={w * 0.14}
            y={h * (0.3 + i * 0.16)}
            width={w * l.w}
            height={h * 0.06}
            rx={h * 0.03}
            fill={l.color}
          />
        ))
      )}
    </svg>
  );
};
