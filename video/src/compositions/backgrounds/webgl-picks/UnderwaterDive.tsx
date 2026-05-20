// A 2512-unit dive from a moonlit ship down to a brown sea floor. The source
// CodePen leaned on ScrollTrigger to scrub the camera; the wheel has retired.
// The frame clock now drags the lens under, the rope draws itself as the dive
// deepens, and the creatures keep wiggling whether anyone is watching or not.

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

// ── Geometry ───────────────────────────────────────────────────────────────
const STAGE_H = 4500; // outer composition height in px
const VIEW_H = 1080; // viewport height (16:9 1920)
const SVG_W = 800; // inner SVG viewBox width
const SVG_H = 2512; // inner SVG viewBox height (original CodePen height)

// ── Palette — pulled from the source ───────────────────────────────────────
const NIGHT = "#0a4e5f";
const SURFACE = "#236570";
const MID = "#1c5664";
const DEEP = "#0c3c48";
const FLOOR = "#2b2410";
const HILL = "#063945";
const ROCK = "#34616e";
const ROCK_HI = "#4a7c89";
const FISH_DARK = "#143847";
const FISH_TEAL = "#1d4d5c";
const YELLOW = "#f1c46b";
const YELLOW_HI = "#f6d691";
const YELLOW_LO = "#d8a04a";
const ORANGE = "#e89446";
const ORANGE_LO = "#c47030";
const WHITE = "#ffffff";
const INK = "#1a1a1a";
const ROPE = "#f4e0a8";
const ANCHOR = "#c79548";
const BROWN = "#7a4e2a";
const BROWN_DARK = "#5a371d";
const SEAWEED = "#1e5e5a";

const TAU = Math.PI * 2;
const sway = (frame: number, period: number, amp: number, phase = 0): number =>
  Math.sin((frame / Math.max(1, period)) * TAU + phase) * amp;

// ── Moon + halos ───────────────────────────────────────────────────────────
const Moon: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const breath = 1 + sway(frame, fps * 4, 0.04);
  return (
    <g transform="translate(610 130)">
      <circle r={90 * breath} fill={WHITE} opacity={0.12} />
      <circle r={70 * breath} fill={WHITE} opacity={0.22} />
      <circle r={52 * breath} fill={WHITE} opacity={0.4} />
      <circle r={38} fill={WHITE} />
      <circle cx={-12} cy={-8} r={5} fill="#e6ecee" opacity={0.7} />
      <circle cx={8} cy={10} r={3} fill="#dbe5e8" opacity={0.6} />
    </g>
  );
};

// ── Hill silhouette behind the ship ────────────────────────────────────────
const Hill: React.FC = () => (
  <g>
    <polygon points="430,310 540,200 600,250 660,310" fill={HILL} />
    <polygon points="520,212 540,200 562,220 540,232" fill={WHITE} />
    <polygon points="100,310 180,240 250,310" fill={HILL} opacity={0.85} />
  </g>
);

// ── Steamship — centered at translate(400 232) ─────────────────────────────
const Ship: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const t = frame / fps;
  const puff = (offset: number) => {
    const cycle = ((t + offset) % 2) / 2;
    return {
      scale: 0.3 + cycle * 1.2,
      opacity: Math.max(0, 1 - cycle * 1.05),
    };
  };
  const a = puff(0);
  const b = puff(1);
  return (
    <g transform="translate(400 232)">
      {/* hull */}
      <rect x={-46} y={-4} width={92} height={20} rx={2} fill={WHITE} />
      <path
        d="M -46 16 Q -38 28 -28 30 L 28 30 Q 38 28 46 16 Z"
        fill={WHITE}
      />
      {/* deck rails — two horizontal lines under the body */}
      <line x1={-44} y1={20} x2={44} y2={20} stroke="#cfd8db" strokeWidth={1.2} />
      <line x1={-44} y1={24} x2={44} y2={24} stroke="#cfd8db" strokeWidth={1.2} />
      {/* portholes */}
      <circle cx={-18} cy={6} r={3.4} fill={NIGHT} />
      <circle cx={18} cy={6} r={3.4} fill={NIGHT} />
      {/* chimney — yellow */}
      <rect x={-4} y={-22} width={10} height={18} fill={YELLOW} />
      <rect x={-4} y={-22} width={10} height={3} fill={ORANGE_LO} />
      {/* mast + flag */}
      <line x1={-26} y1={-22} x2={-26} y2={-4} stroke="#cfd8db" strokeWidth={1.5} />
      <polygon points="-26,-22 -14,-17 -26,-12" fill={WHITE} />
      {/* smoke ovals */}
      <g transform={`translate(1 -32)`}>
        <ellipse
          rx={9}
          ry={6}
          fill={WHITE}
          opacity={a.opacity}
          transform={`scale(${a.scale})`}
        />
        <ellipse
          rx={9}
          ry={6}
          fill={WHITE}
          opacity={b.opacity}
          transform={`scale(${b.scale})`}
        />
      </g>
    </g>
  );
};

// ── Water surface band with foam pills ─────────────────────────────────────
const WaterSurface: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const driftA = sway(frame, fps * 6, 30);
  const driftB = sway(frame, fps * 7, 22, Math.PI / 2);
  return (
    <g>
      <rect x={0} y={270} width={SVG_W} height={70} fill={SURFACE} />
      <rect x={0} y={330} width={SVG_W} height={40} fill={MID} opacity={0.7} />
      <g transform={`translate(${driftA} 0)`}>
        <rect x={80} y={280} width={140} height={6} rx={3} fill="#3a8090" />
        <rect x={520} y={290} width={170} height={6} rx={3} fill="#3a8090" />
      </g>
      <g transform={`translate(${driftB} 0)`}>
        <rect x={260} y={296} width={120} height={5} rx={2.5} fill="#347b8a" />
        <rect x={400} y={282} width={90} height={5} rx={2.5} fill="#347b8a" />
      </g>
    </g>
  );
};

// ── Mid-water rocks (with embedded yellow star on the right) ───────────────
const Rocks: React.FC = () => (
  <g>
    {/* Left outcrop */}
    <polygon
      points="0,400 0,1100 110,1100 130,940 90,820 140,720 100,600 50,520 0,460"
      fill={ROCK}
    />
    <polygon
      points="0,400 50,520 100,600 140,720 110,700 60,580 20,500"
      fill={ROCK_HI}
      opacity={0.6}
    />
    {/* Right outcrop */}
    <polygon
      points="800,420 800,1100 700,1100 680,960 720,820 670,700 730,580 770,500 800,460"
      fill={ROCK}
    />
    <polygon
      points="800,420 770,500 730,580 670,700 710,690 750,580 790,490"
      fill={ROCK_HI}
      opacity={0.6}
    />
    {/* Embedded yellow star on the right rock */}
    <g transform="translate(740 740)">
      <polygon
        points="0,-12 3.7,-3.7 12,-3.7 5.3,2.3 7.4,11 0,6 -7.4,11 -5.3,2.3 -12,-3.7 -3.7,-3.7"
        fill={YELLOW}
      />
    </g>
  </g>
);

// ── A single fish shoal row ────────────────────────────────────────────────
const FishShoal: React.FC<{
  frame: number;
  fps: number;
  y: number;
  count: number;
  baseX: number;
  dir: 1 | -1;
  phase: number;
  color: string;
}> = ({ frame, fps, y, count, baseX, dir, phase, color }) => {
  const drift = sway(frame, fps * 5, 28, phase) * dir;
  return (
    <g transform={`translate(${drift} 0)`}>
      {Array.from({ length: count }).map((_, j) => {
        const x = baseX + j * 42;
        const dy = sway(frame, fps * 2.5, 3, j * 0.5 + phase);
        const flip = dir === -1 ? -1 : 1;
        return (
          <g key={j} transform={`translate(${x} ${y + dy}) scale(${flip} 1)`}>
            <ellipse rx={7} ry={2.6} fill={color} />
            <polygon points="-7,0 -12,-3 -12,3" fill={color} />
            <circle cx={3} cy={-0.7} r={0.8} fill={WHITE} />
          </g>
        );
      })}
    </g>
  );
};

// ── Tako (octopus) — orange-yellow, 4 wavy legs, two eyes, big smile ───────
const Tako: React.FC<{ frame: number; fps: number; x: number; y: number }> = ({
  frame,
  fps,
  x,
  y,
}) => {
  const bob = sway(frame, fps * 6, 8);
  return (
    <g transform={`translate(${x} ${y + bob})`}>
      {/* Four wavy legs — under the body */}
      {[-1, -0.5, 0.5, 1].map((side, i) => {
        const wig = sway(frame, fps * 3, 8, i * 0.7);
        const baseX = side * 32;
        const tipX = side * 70 + wig;
        const midX = side * 50 + wig * 1.2;
        return (
          <path
            key={i}
            d={`M ${baseX} 30 Q ${midX} 60 ${tipX} 92 Q ${tipX + wig} 110 ${tipX - wig} 130`}
            stroke={YELLOW}
            strokeWidth={11}
            fill="none"
            strokeLinecap="round"
            opacity={0.95}
          />
        );
      })}
      {/* Body */}
      <circle r={42} fill={YELLOW} />
      <ellipse cy={-10} rx={32} ry={20} fill={YELLOW_HI} opacity={0.55} />
      {/* Eyes */}
      <circle cx={-13} cy={-4} r={7} fill={WHITE} />
      <circle cx={13} cy={-4} r={7} fill={WHITE} />
      <circle cx={-12} cy={-3} r={3} fill={INK} />
      <circle cx={14} cy={-3} r={3} fill={INK} />
      {/* Wide smile */}
      <path
        d="M -16 12 Q 0 26 16 12"
        stroke={INK}
        strokeWidth={2.4}
        fill={WHITE}
        strokeLinecap="round"
      />
      {/* Cheeks */}
      <circle cx={-26} cy={10} r={4.5} fill={ORANGE} opacity={0.55} />
      <circle cx={26} cy={10} r={4.5} fill={ORANGE} opacity={0.55} />
    </g>
  );
};

// ── TakoHi — a small "Hi!" speech bubble cluster ───────────────────────────
const TakoHi: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g transform={`translate(${x} ${y})`}>
    <ellipse rx={22} ry={14} fill={WHITE} />
    <polygon points="-14,12 -20,22 -4,14" fill={WHITE} />
    <text
      x={0}
      y={4}
      textAnchor="middle"
      fontFamily="sans-serif"
      fontSize={14}
      fontWeight={700}
      fill={ORANGE_LO}
    >
      Hi!
    </text>
  </g>
);

// ── Kurage (jellyfish) — orange bell, 5 wavy tentacles ─────────────────────
const Kurage: React.FC<{ frame: number; fps: number; x: number; y: number }> = ({
  frame,
  fps,
  x,
  y,
}) => {
  const drift = sway(frame, fps * 5, 25);
  return (
    <g transform={`translate(${x} ${y + drift})`}>
      {/* Bell — semicircle with flat bottom */}
      <path d="M -50 0 A 50 50 0 0 1 50 0 Z" fill={ORANGE} />
      <path d="M -36 -6 A 36 32 0 0 1 36 -6" fill={YELLOW_HI} opacity={0.5} />
      {/* Lip ruffle */}
      <path
        d="M -50 0 Q -40 6 -30 0 Q -20 6 -10 0 Q 0 6 10 0 Q 20 6 30 0 Q 40 6 50 0"
        fill={ORANGE_LO}
      />
      {/* Tentacles */}
      {[-32, -16, 0, 16, 32].map((tx, i) => {
        const w = sway(frame, fps * 3, 5, i * 0.7);
        return (
          <path
            key={i}
            d={`M ${tx} 2 Q ${tx + w} 18 ${tx - w} 36 Q ${tx + w} 52 ${tx - w / 2} 70 Q ${tx} 84 ${tx - w / 2} 96`}
            stroke={ORANGE}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            opacity={0.85}
          />
        );
      })}
      {/* Face on bell */}
      <circle cx={-10} cy={-14} r={2.4} fill={INK} />
      <circle cx={10} cy={-14} r={2.4} fill={INK} />
      <path
        d="M -5 -4 Q 0 -1 5 -4"
        stroke={INK}
        strokeWidth={1.4}
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
};

// ── Fugu (puffer) — round yellow, side fin, eye, pucker mouth ──────────────
const Fugu: React.FC<{ frame: number; fps: number; x: number; y: number }> = ({
  frame,
  fps,
  x,
  y,
}) => {
  const hover = sway(frame, fps * 4, 6, Math.PI / 4);
  return (
    <g transform={`translate(${x} ${y + hover})`}>
      <circle r={28} fill={YELLOW} />
      <circle r={28} fill={YELLOW_HI} opacity={0.3} />
      {/* Side fin sticking out to the side */}
      <polygon points="-30,-4 -50,-18 -50,8" fill={YELLOW_LO} />
      {/* Tail */}
      <polygon points="28,0 46,-14 46,14" fill={YELLOW_LO} />
      {/* Dorsal */}
      <polygon points="-4,-28 6,-44 14,-28" fill={YELLOW_LO} />
      {/* Eye */}
      <circle cx={10} cy={-6} r={5} fill={WHITE} />
      <circle cx={11} cy={-6} r={2.4} fill={INK} />
      {/* Pucker mouth */}
      <circle cx={22} cy={4} r={3} fill={WHITE} />
      <circle cx={22} cy={4} r={1.6} fill={ORANGE_LO} />
      {/* A few dots for texture */}
      <circle cx={-6} cy={6} r={1.2} fill={YELLOW_LO} />
      <circle cx={4} cy={12} r={1.2} fill={YELLOW_LO} />
      <circle cx={-12} cy={-8} r={1.2} fill={YELLOW_LO} />
    </g>
  );
};

// ── Ika (squid) — yellow triangular head pointing up, 6 tentacles ──────────
const Ika: React.FC<{ frame: number; fps: number; x: number; y: number }> = ({
  frame,
  fps,
  x,
  y,
}) => {
  const hover = sway(frame, fps * 5, 8);
  return (
    <g transform={`translate(${x} ${y + hover})`}>
      {/* Head — triangle pointing up */}
      <polygon points="0,-44 -26,18 26,18" fill={YELLOW} />
      <polygon points="0,-38 -18,12 18,12" fill={YELLOW_HI} opacity={0.55} />
      {/* Side fins */}
      <polygon points="-26,18 -38,4 -32,22" fill={YELLOW_LO} />
      <polygon points="26,18 38,4 32,22" fill={YELLOW_LO} />
      {/* Six tentacles */}
      {[-20, -12, -4, 4, 12, 20].map((tx, i) => {
        const w = sway(frame, fps * 3, 5, i * 0.6);
        return (
          <path
            key={i}
            d={`M ${tx} 18 Q ${tx + w} 38 ${tx - w} 58 Q ${tx + w} 74 ${tx} 88`}
            stroke={YELLOW}
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
          />
        );
      })}
      {/* Big white eyes with pupils */}
      <circle cx={-10} cy={-6} r={6} fill={WHITE} />
      <circle cx={10} cy={-6} r={6} fill={WHITE} />
      <circle cx={-9} cy={-5} r={2.6} fill={INK} />
      <circle cx={11} cy={-5} r={2.6} fill={INK} />
    </g>
  );
};

// ── Submarine — torpedo body, porthole with a frog inside, periscope ───────
const Sub: React.FC<{ frame: number; fps: number; x: number; y: number }> = ({
  frame,
  fps,
  x,
  y,
}) => {
  const drift = sway(frame, fps * 9, 16);
  const bob = sway(frame, fps * 6, 4);
  return (
    <g transform={`translate(${x + drift} ${y + bob})`}>
      {/* Torpedo body */}
      <ellipse rx={58} ry={22} fill={YELLOW} />
      <ellipse rx={54} ry={18} fill={YELLOW_HI} opacity={0.4} />
      {/* Nose cone tip */}
      <polygon points="58,0 76,-8 76,8" fill={YELLOW_LO} />
      {/* Propeller at the back */}
      <line x1={-58} y1={-2} x2={-72} y2={-10} stroke={BROWN_DARK} strokeWidth={1.6} />
      <line x1={-58} y1={2} x2={-72} y2={10} stroke={BROWN_DARK} strokeWidth={1.6} />
      <polygon points="-72,-12 -80,0 -72,12" fill={BROWN} />
      {/* Tower */}
      <rect x={-8} y={-32} width={16} height={14} rx={3} fill={YELLOW_LO} />
      {/* Periscope tube on top */}
      <line x1={0} y1={-32} x2={0} y2={-44} stroke={YELLOW_LO} strokeWidth={3} />
      <rect x={-3} y={-48} width={10} height={4} fill={YELLOW_LO} />
      {/* Porthole — outer ring + glass */}
      <circle r={20} fill={BROWN_DARK} />
      <circle r={17} fill="#7fbfd6" />
      {/* Frog face inside the porthole — kaeru */}
      <g>
        {/* head */}
        <ellipse rx={14} ry={11} fill="#6fb04a" />
        {/* belly highlight */}
        <ellipse cy={3} rx={9} ry={4} fill="#c5e08a" opacity={0.7} />
        {/* eye bumps */}
        <circle cx={-7} cy={-7} r={4} fill="#6fb04a" />
        <circle cx={7} cy={-7} r={4} fill="#6fb04a" />
        {/* eye whites + pupils */}
        <circle cx={-7} cy={-7} r={3} fill={WHITE} />
        <circle cx={7} cy={-7} r={3} fill={WHITE} />
        <circle cx={-7} cy={-6} r={1.4} fill={INK} />
        <circle cx={7} cy={-6} r={1.4} fill={INK} />
        {/* smile */}
        <path
          d="M -5 3 Q 0 7 5 3"
          stroke={INK}
          strokeWidth={1.2}
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </g>
  );
};

// ── Yellow fish — small, eye, tail ─────────────────────────────────────────
const YFish: React.FC<{
  frame: number;
  fps: number;
  x: number;
  y: number;
  phase: number;
  flip?: 1 | -1;
}> = ({ frame, fps, x, y, phase, flip = 1 }) => {
  const drift = sway(frame, fps * 4, 18, phase);
  const dy = sway(frame, fps * 2.5, 3, phase + 1);
  return (
    <g transform={`translate(${x + drift} ${y + dy}) scale(${flip} 1)`}>
      <ellipse rx={12} ry={5.5} fill={YELLOW} />
      <ellipse cy={-1} rx={10} ry={3} fill={YELLOW_HI} opacity={0.5} />
      <polygon points="-12,0 -20,-6 -20,6" fill={YELLOW_LO} />
      <polygon points="-2,-5 2,-12 6,-5" fill={YELLOW_LO} />
      <circle cx={5} cy={-1} r={1.6} fill={WHITE} />
      <circle cx={5.3} cy={-1} r={0.8} fill={INK} />
    </g>
  );
};

// ── Chin — 4 small jellyfish-shaped beings, blinking eyes ──────────────────
const Chin: React.FC<{ frame: number; fps: number; x: number; y: number }> = ({
  frame,
  fps,
  x,
  y,
}) => {
  // Eye blink cycle — open most of the time, snap shut briefly
  const t = (frame / Math.max(1, fps * 3)) % 1;
  const open = t > 0.93 ? 0.1 : 1;
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 1, 2, 3].map((i) => {
        const cx = i * 22 - 33;
        const bob = sway(frame, fps * 3, 2, i * 0.6);
        return (
          <g key={i} transform={`translate(${cx} ${bob})`}>
            {/* arc body */}
            <path
              d="M -10 0 A 10 10 0 0 1 10 0 Z"
              fill="#9fcfd8"
              opacity={0.85}
            />
            {/* skirt */}
            <path
              d="M -10 0 Q -7 4 -4 0 Q 0 4 4 0 Q 7 4 10 0"
              fill="#9fcfd8"
              opacity={0.85}
            />
            {/* eye */}
            <ellipse cx={0} cy={-4} rx={2} ry={2 * open} fill={WHITE} />
            <ellipse cx={0} cy={-4} rx={1} ry={1 * open} fill={INK} />
          </g>
        );
      })}
    </g>
  );
};

// ── Sea turtle (Kame) ──────────────────────────────────────────────────────
const Kame: React.FC<{ frame: number; fps: number; x: number; y: number }> = ({
  frame,
  fps,
  x,
  y,
}) => {
  const crawl = sway(frame, fps * 12, 30);
  return (
    <g transform={`translate(${x + crawl} ${y})`}>
      {/* Body — oval brown */}
      <ellipse rx={32} ry={22} fill={BROWN} />
      {/* Shell — darker rounded rectangle on top */}
      <rect x={-28} y={-20} width={56} height={28} rx={14} fill={BROWN_DARK} />
      {/* Hexagonal pattern on shell */}
      <path
        d="M -16 -10 L -8 -16 L 0 -10 L 0 -2 L -8 4 L -16 -2 Z"
        fill="none"
        stroke={BROWN}
        strokeWidth={1.2}
      />
      <path
        d="M 0 -10 L 8 -16 L 16 -10 L 16 -2 L 8 4 L 0 -2 Z"
        fill="none"
        stroke={BROWN}
        strokeWidth={1.2}
      />
      {/* Head */}
      <ellipse cx={34} cy={-2} rx={10} ry={7} fill={BROWN} />
      <circle cx={37} cy={-3} r={1.2} fill={WHITE} />
      <circle cx={37} cy={-3} r={0.6} fill={INK} />
      {/* Legs */}
      <ellipse cx={-22} cy={16} rx={10} ry={4} fill={BROWN} transform="rotate(20 -22 16)" />
      <ellipse cx={22} cy={16} rx={10} ry={4} fill={BROWN} transform="rotate(-20 22 16)" />
      <ellipse cx={-26} cy={-10} rx={8} ry={3.5} fill={BROWN} transform="rotate(-20 -26 -10)" />
      <ellipse cx={26} cy={-10} rx={8} ry={3.5} fill={BROWN} transform="rotate(20 26 -10)" />
    </g>
  );
};

// ── Anchor ─────────────────────────────────────────────────────────────────
const Anc: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g transform={`translate(${x} ${y})`} stroke={ANCHOR} strokeWidth={3.5} fill="none">
    {/* Ring at top */}
    <circle r={9} />
    {/* Shaft */}
    <line x1={0} y1={9} x2={0} y2={70} strokeLinecap="round" />
    {/* Crossbar */}
    <line x1={-20} y1={22} x2={20} y2={22} strokeLinecap="round" />
    {/* Curved flukes at the bottom */}
    <path d="M 0 70 Q -28 70 -32 44" strokeLinecap="round" />
    <path d="M 0 70 Q 28 70 32 44" strokeLinecap="round" />
    {/* Fluke tips — filled triangles */}
    <polygon points="-32,44 -38,50 -26,52" fill={ANCHOR} stroke="none" />
    <polygon points="32,44 38,50 26,52" fill={ANCHOR} stroke="none" />
  </g>
);

// ── Skeleton key ───────────────────────────────────────────────────────────
const Kai: React.FC<{ x: number; y: number; rotate?: number }> = ({
  x,
  y,
  rotate = 0,
}) => (
  <g transform={`translate(${x} ${y}) rotate(${rotate})`} fill={YELLOW}>
    {/* Head ring */}
    <circle cx={-12} cy={0} r={7} fill="none" stroke={YELLOW} strokeWidth={2.4} />
    <circle cx={-12} cy={0} r={1.6} fill={DEEP} />
    {/* Shaft */}
    <rect x={-6} y={-1.5} width={20} height={3} />
    {/* Teeth */}
    <rect x={11} y={2} width={3} height={5} />
    <rect x={6} y={2} width={2.4} height={4} />
  </g>
);

// ── Starfish ───────────────────────────────────────────────────────────────
const Star: React.FC<{ frame: number; fps: number; x: number; y: number; dark?: boolean }> = ({
  frame,
  fps,
  x,
  y,
  dark = false,
}) => {
  const rot = (frame / fps) * 8 + (dark ? 30 : 0);
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <polygon
        points="0,-18 5.5,-5.5 18,-5.5 8,3.5 11,17 0,9 -11,17 -8,3.5 -18,-5.5 -5.5,-5.5"
        fill={dark ? BROWN_DARK : YELLOW}
      />
      {!dark && <circle r={3} fill={YELLOW_LO} />}
    </g>
  );
};

// ── Seaweed stalk — wavy vertical line with lobes ──────────────────────────
const Leaf: React.FC<{
  frame: number;
  fps: number;
  x: number;
  baseY: number;
  height: number;
  phase: number;
  color?: string;
}> = ({ frame, fps, x, baseY, height, phase, color = SEAWEED }) => {
  const segments = 8;
  const points: string[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const py = baseY - t * height;
    const w = sway(frame, fps * 4, 6 + t * 4, phase + t * 2);
    points.push(`${x + w},${py}`);
  }
  // Render as a polyline of small circles for the lobed look
  return (
    <g>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => {
        const [px, py] = p.split(",").map(Number);
        return <circle key={i} cx={px} cy={py} r={4.5} fill={color} />;
      })}
    </g>
  );
};

// ── Sea floor contour ──────────────────────────────────────────────────────
const SeaFloor: React.FC = () => (
  <g>
    <rect x={0} y={2300} width={SVG_W} height={SVG_H - 2300} fill={FLOOR} />
    <path
      d="M 0 2300 Q 100 2270 200 2300 Q 300 2330 400 2300 Q 500 2270 600 2300 Q 700 2330 800 2300 L 800 2330 L 0 2330 Z"
      fill={BROWN_DARK}
    />
    {/* Stones */}
    <ellipse cx={120} cy={2326} rx={32} ry={10} fill={BROWN} />
    <ellipse cx={300} cy={2330} rx={22} ry={7} fill={BROWN} />
    <ellipse cx={520} cy={2326} rx={28} ry={9} fill={BROWN} />
    <ellipse cx={690} cy={2330} rx={36} ry={11} fill={BROWN} />
  </g>
);

// ── Bubbles — rise from the bottom in 3 streams ────────────────────────────
const Bubbles: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const t = frame / fps;
  // 3 streams, ~5 bubbles each
  const streams = [
    { x: 160, hue: "#bce4ec" },
    { x: 420, hue: "#a8d4dc" },
    { x: 680, hue: "#bce4ec" },
  ];
  return (
    <g>
      {streams.map((s, si) => {
        return (
          <g key={si}>
            {Array.from({ length: 6 }).map((_, i) => {
              const speed = 3.2 + (i % 3) * 0.6; // seconds per cycle
              const cycle = ((t + si * 0.7 + i * 0.4) % speed) / speed;
              const startY = 2300;
              const endY = 380;
              const y = startY - cycle * (startY - endY);
              const x = s.x + Math.sin(cycle * TAU + i + si) * 12;
              const r = 2 + cycle * 5;
              const opacity = Math.max(0, 1 - cycle * 1.05) * 0.85;
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={r}
                  fill="none"
                  stroke={s.hue}
                  strokeWidth={1.2}
                  opacity={opacity}
                />
              );
            })}
          </g>
        );
      })}
    </g>
  );
};

// ── Rope + bait ────────────────────────────────────────────────────────────
const RopeAndEsa: React.FC<{
  progress: number;
  frame: number;
  fps: number;
}> = ({ progress, frame, fps }) => {
  const ropeTopY = 262; // just under the ship hull
  // Bait descends with the dive
  const esaY = 280 + progress * 1980;
  const esaX = 400 + sway(frame, fps * 4, 3);
  const len = Math.max(1, esaY - ropeTopY);
  const dashOffset = len * (1 - Math.min(1, progress / 0.95));
  return (
    <g>
      <line
        x1={esaX}
        y1={ropeTopY}
        x2={esaX}
        y2={esaY}
        stroke={ROPE}
        strokeWidth={1.2}
        strokeDasharray={len}
        strokeDashoffset={dashOffset}
        opacity={0.85}
      />
      <g transform={`translate(${esaX} ${esaY})`}>
        {/* Hook */}
        <path
          d="M 0 -4 Q 0 8 -5 10 Q -10 8 -9 4"
          stroke={ROPE}
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
        />
        {/* Lure */}
        <ellipse cx={2} cy={-1} rx={4} ry={5} fill={YELLOW} />
        <circle cx={3} cy={-2} r={1} fill={ORANGE_LO} />
        {/* Tail filament on lure */}
        <line x1={2} y1={4} x2={2} y2={9} stroke={YELLOW_LO} strokeWidth={1} />
      </g>
    </g>
  );
};

// ── Composition ────────────────────────────────────────────────────────────
export const UnderwaterDive: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const progress = frame / Math.max(1, durationInFrames - 1);
  const panY = -progress * (STAGE_H - VIEW_H);

  return (
    <AbsoluteFill style={{ backgroundColor: DEEP, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: STAGE_H,
          transform: `translateY(${panY}px)`,
          willChange: "transform",
        }}
      >
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMin meet"
          width="100%"
          height={STAGE_H}
          style={{ display: "block" }}
        >
          {/* ── Depth gradient ─────────────────────────────────────────── */}
          <defs>
            <linearGradient id="depth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={NIGHT} />
              <stop offset="11%" stopColor={NIGHT} />
              <stop offset="14%" stopColor={SURFACE} />
              <stop offset="32%" stopColor={SURFACE} />
              <stop offset="60%" stopColor={MID} />
              <stop offset="86%" stopColor={DEEP} />
              <stop offset="92%" stopColor={FLOOR} />
              <stop offset="100%" stopColor={FLOOR} />
            </linearGradient>
          </defs>
          <rect width={SVG_W} height={SVG_H} fill="url(#depth)" />

          {/* ── 1. Night sky ───────────────────────────────────────────── */}
          <Moon frame={frame} fps={fps} />
          {/* faint stars */}
          <circle cx={120} cy={80} r={1.6} fill={WHITE} opacity={0.7} />
          <circle cx={210} cy={140} r={1} fill={WHITE} opacity={0.6} />
          <circle cx={300} cy={60} r={1.4} fill={WHITE} opacity={0.7} />
          <circle cx={490} cy={110} r={1} fill={WHITE} opacity={0.5} />
          <circle cx={720} cy={200} r={1.2} fill={WHITE} opacity={0.6} />
          <Hill />
          <Ship frame={frame} fps={fps} />

          {/* ── 2. Water surface ───────────────────────────────────────── */}
          <WaterSurface frame={frame} fps={fps} />

          {/* ── 3. Mid-water: rocks + shoals ───────────────────────────── */}
          <Rocks />
          <FishShoal
            frame={frame}
            fps={fps}
            y={520}
            count={8}
            baseX={140}
            dir={1}
            phase={0}
            color={FISH_TEAL}
          />
          <FishShoal
            frame={frame}
            fps={fps}
            y={640}
            count={9}
            baseX={120}
            dir={-1}
            phase={0.8}
            color={FISH_DARK}
          />
          <FishShoal
            frame={frame}
            fps={fps}
            y={760}
            count={7}
            baseX={200}
            dir={1}
            phase={1.6}
            color={FISH_TEAL}
          />
          <FishShoal
            frame={frame}
            fps={fps}
            y={880}
            count={9}
            baseX={140}
            dir={-1}
            phase={2.4}
            color={FISH_DARK}
          />

          {/* ── 4. Mid-depth creatures ─────────────────────────────────── */}
          <YFish frame={frame} fps={fps} x={200} y={1050} phase={0.2} />
          <YFish frame={frame} fps={fps} x={620} y={1080} phase={1.1} flip={-1} />
          <YFish frame={frame} fps={fps} x={500} y={1180} phase={0.6} />

          {/* Tako (octopus) */}
          <Tako frame={frame} fps={fps} x={400} y={1240} />
          <TakoHi x={490} y={1200} />

          {/* Kurage (jellyfish) */}
          <Kurage frame={frame} fps={fps} x={210} y={1380} />

          {/* Fugu (pufferfish) */}
          <Fugu frame={frame} fps={fps} x={600} y={1420} />

          {/* Ika (squid) */}
          <Ika frame={frame} fps={fps} x={300} y={1560} />

          {/* Submarine + frog */}
          <Sub frame={frame} fps={fps} x={560} y={1620} />

          {/* Y-fish scattered */}
          <YFish frame={frame} fps={fps} x={140} y={1640} phase={2.2} />
          <YFish frame={frame} fps={fps} x={460} y={1740} phase={0.4} flip={-1} />
          <YFish frame={frame} fps={fps} x={680} y={1780} phase={1.8} />

          {/* Chin — 4 small jellies blinking */}
          <Chin frame={frame} fps={fps} x={420} y={1840} />

          {/* ── 5. Deeper ──────────────────────────────────────────────── */}
          <Kame frame={frame} fps={fps} x={220} y={2050} />
          <Star frame={frame} fps={fps} x={600} y={2080} />
          <Star frame={frame} fps={fps} x={680} y={2160} dark />

          {/* Seaweed stalks growing up from the sea floor */}
          <Leaf frame={frame} fps={fps} x={90} baseY={2300} height={210} phase={0} />
          <Leaf
            frame={frame}
            fps={fps}
            x={150}
            baseY={2300}
            height={160}
            phase={1.4}
            color="#2a7068"
          />
          <Leaf
            frame={frame}
            fps={fps}
            x={550}
            baseY={2300}
            height={230}
            phase={2.1}
          />
          <Leaf
            frame={frame}
            fps={fps}
            x={620}
            baseY={2300}
            height={180}
            phase={0.7}
            color="#2a7068"
          />

          {/* ── 6. Sea floor + anchor + keys ───────────────────────────── */}
          <SeaFloor />
          <Anc x={400} y={2330} />
          <Kai x={210} y={2370} rotate={-20} />
          <Kai x={520} y={2380} rotate={14} />
          <Kai x={660} y={2360} rotate={-6} />

          {/* ── 7. Bubbles + Rope (drawn on top) ───────────────────────── */}
          <Bubbles frame={frame} fps={fps} />
          <RopeAndEsa progress={progress} frame={frame} fps={fps} />
        </svg>
      </div>
    </AbsoluteFill>
  );
};
