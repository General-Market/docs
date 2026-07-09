import React from "react";
import { ART } from "./art";

// Renders a traced reference asset at its native ref-pixel size (scale to
// resize). Layers carry potrace's own transform; we wrap in an <svg> with the
// crop's viewBox so placement = the crop's top-left in ref coordinates.
export const TracedArt: React.FC<{
  name: string;
  x?: number;
  y?: number;
  scale?: number;
  opacity?: number;
  style?: React.CSSProperties;
  recolor?: Record<string, string>;
}> = ({ name, x = 0, y = 0, scale = 1, opacity = 1, style, recolor }) => {
  const a = ART[name];
  if (!a || opacity <= 0) return null;
  return (
    <svg
      width={a.w * scale}
      height={a.h * scale}
      viewBox={`0 0 ${a.w} ${a.h}`}
      style={{ position: "absolute", left: x, top: y, opacity, ...style }}
    >
      {a.layers.map((l, i) => (
        <g key={i} transform={l.transform}>
          <path d={l.d} fill={recolor?.[l.fill] ?? l.fill} />
        </g>
      ))}
    </svg>
  );
};
