// 2D overlays: the education card (rebuilt natively — layout matched to the
// reference, copy paraphrased), the photographed hand sprite, vignette + grain.
import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import { CARD, FPS, HAND_TRACK, clamp01, easeOutCubic, lerpTable } from "./data";

// diagram geometry (viewBox 758 x 470)
const Diagram: React.FC = () => {
  const supY = 300;
  const arcX0 = 40;
  const arcX1 = 470;
  const apexY = 95;
  // zigzag under the arc
  const zig: string[] = [];
  const nZ = 12;
  for (let i = 0; i <= nZ; i++) {
    const x = arcX0 + ((arcX1 - arcX0) * i) / nZ;
    const tt = i / nZ;
    const arcY = supY - (supY - apexY) * Math.pow(Math.sin(Math.PI * tt), 0.9);
    const y = i % 2 === 0 ? Math.min(supY - 4, arcY + 38) : arcY + 4;
    zig.push(`${x},${y}`);
  }
  const arcPath = (() => {
    let d = `M ${arcX0} ${supY}`;
    for (let i = 1; i <= 40; i++) {
      const tt = i / 40;
      const x = arcX0 + (arcX1 - arcX0) * tt;
      const y = supY - (supY - apexY) * Math.pow(Math.sin(Math.PI * tt), 0.9);
      d += ` L ${x} ${y}`;
    }
    return d;
  })();
  return (
    <svg viewBox="0 0 758 470" style={{ width: "100%", height: "100%" }}>
      {/* support line */}
      <line x1={18} y1={supY} x2={740} y2={supY} stroke="#1c7a5e" strokeWidth={2.4} />
      <text x={330} y={supY + 26} fill="#1c7a5e" fontSize={20} fontStyle="italic">
        Support line
      </text>
      {/* arc + zigzag fill */}
      <polyline points={zig.join(" ")} fill="rgba(190,230,190,0.45)" stroke="#666" strokeWidth={1.4} />
      <path d={arcPath} fill="none" stroke="#c99" strokeWidth={2.6} />
      {/* 100% center measure */}
      <line x1={255} y1={apexY + 12} x2={255} y2={supY - 6} stroke="#2b6cb0" strokeWidth={2} markerEnd="url(#arr)" />
      <text x={264} y={200} fill="#2b6cb0" fontSize={19}>100%</text>
      {/* handle channel + breakout */}
      <polyline
        points="470,300 505,360 540,300 560,320 580,285 600,308 620,272 640,296 655,262"
        fill="rgba(230,200,150,0.35)"
        stroke="#b8860b"
        strokeWidth={2}
      />
      <line x1={655} y1={262} x2={700} y2={430} stroke="#c22" strokeWidth={2.4} />
      <circle cx={668} cy={310} r={9} fill="none" stroke="#2a9d5c" strokeWidth={2.4} />
      <text x={648} y={230} fill="#5a2ca0" fontSize={20} fontStyle="italic">Breakout</text>
      <line x1={664} y1={238} x2={668} y2={296} stroke="#5a2ca0" strokeWidth={1.6} markerEnd="url(#arr2)" />
      <line x1={640} y1={318} x2={640} y2={412} stroke="#2b6cb0" strokeWidth={2} markerEnd="url(#arr)" />
      <text x={594} y={370} fill="#2b6cb0" fontSize={19}>100%</text>
      <text x={648} y={432} fill="#2b6cb0" fontSize={20} fontStyle="italic">Target</text>
      {/* simple bull / bear marks */}
      <g stroke="#333" strokeWidth={1.6} fill="none">
        <path d="M 60 380 q 18 -26 44 -10 q 22 12 10 32 q -14 22 -38 12 q -22 -8 -16 -34 M 58 372 l -10 -14 M 100 368 l 12 -12" />
        <path d="M 620 120 q 24 -18 46 0 q 18 16 4 36 q -16 20 -38 8 q -20 -12 -12 -34 M 634 108 l -6 -14 M 660 110 l 8 -12" />
      </g>
      <defs>
        <marker id="arr" markerWidth="8" markerHeight="8" refX="4" refY="6" orient="auto">
          <path d="M1,1 L4,7 L7,1" fill="none" stroke="#2b6cb0" strokeWidth={1.4} />
        </marker>
        <marker id="arr2" markerWidth="8" markerHeight="8" refX="4" refY="6" orient="auto">
          <path d="M1,1 L4,7 L7,1" fill="none" stroke="#5a2ca0" strokeWidth={1.4} />
        </marker>
      </defs>
    </svg>
  );
};

const PARAS = [
  "The bearish cup and handle starts as a bullish move that slowly bends over and rolls into a gradual decline, painting a rounded figure on the chart.",
  "Once the cup is complete, the second required element forms — the handle: after the low on the right side of the cup, a small pullback builds just to the right of it.",
  "Volume is usually at its lowest at the top of the inverted cup, then builds steadily while the second half of the figure forms.",
];

export const CardOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  if (t < CARD.tIn0 || t > CARD.tOut1 + 0.1) return null;
  const inP = easeOutCubic(clamp01((t - CARD.tIn0) / (CARD.tIn1 - CARD.tIn0)));
  const outP = clamp01((t - CARD.tOut0) / (CARD.tOut1 - CARD.tOut0));
  const scale = 0.16 + 0.84 * inP;
  const dx = -900 * outP * outP;
  const opacity = (0.35 + 0.65 * inP) * (1 - outP * 0.9);
  return (
    <div
      style={{
        position: "absolute",
        left: CARD.x,
        top: CARD.y,
        width: CARD.w,
        height: CARD.h,
        transform: `translateX(${dx}px) scale(${scale})`,
        opacity,
        borderRadius: 26,
        background: "#fdfdfd",
        boxShadow: "0 0 0 3px rgba(120,220,235,0.9), 0 0 34px rgba(140,230,245,0.45), 0 22px 60px rgba(0,0,0,0.55)",
        overflow: "hidden",
        fontFamily: "'Bricolage Grotesque', Georgia, serif",
      }}
    >
      <div
        style={{
          background: "linear-gradient(180deg,#f3b8ec 0%,#fbe3f6 55%,#fdfdfd 100%)",
          padding: "26px 30px 14px",
          textAlign: "center",
          fontSize: 34,
          fontWeight: 700,
          color: "#1c1c24",
        }}
      >
        Pattern “Cup and handle” (bearish)
      </div>
      <div style={{ padding: "18px 34px 0", color: "#22222a" }}>
        {PARAS.map((p, i) => (
          <p key={i} style={{ fontSize: 21.5, lineHeight: 1.34, margin: "0 0 18px" }}>
            {"– "}
            {p}
          </p>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, height: 470 }}>
        <Diagram />
      </div>
    </div>
  );
};

export const HandOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const t0 = HAND_TRACK[0][0];
  const t1 = HAND_TRACK[HAND_TRACK.length - 1][0];
  if (t < t0 - 0.15 || t > t1 + 0.15) return null;
  const xs: [number, number][] = HAND_TRACK.map(([tt, x]) => [tt, x]);
  const ys: [number, number][] = HAND_TRACK.map(([tt, , y]) => [tt, y]);
  const tipX = lerpTable(xs, t);
  const tipY = lerpTable(ys, t);
  // sprite pen tip sits at (150, 6) of the 778x572 sprite
  const enter = clamp01((t - (t0 - 0.15)) / 0.3);
  const exit = 1 - clamp01((t - t1) / 0.15);
  return (
    <Img
      src={staticFile("short3d-assets/hand.png")}
      style={{
        position: "absolute",
        left: tipX - 150,
        top: tipY - 6,
        width: 778,
        height: 572,
        opacity: Math.min(enter, exit),
        pointerEvents: "none",
      }}
    />
  );
};

// vignette + animated grain
export const Atmosphere: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 90% 75% at 50% 42%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.34) 100%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: -8,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
          backgroundPosition: `${(frame * 37) % 140}px ${(frame * 61) % 140}px`,
          opacity: 0.045,
          mixBlendMode: "overlay",
          pointerEvents: "none",
        }}
      />
    </>
  );
};
