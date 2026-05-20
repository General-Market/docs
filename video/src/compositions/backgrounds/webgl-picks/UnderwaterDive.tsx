// A ScrollTrigger dive through a 2500px hand-drawn sea — moon up top, octopus
// at the bottom, a fishing line dropped through the middle. The CodePen lived
// or died on the user's scroll wheel. Here the wheel is gone; the frame clock
// pulls the camera under for us, whether we want it or not.

import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

// ── Geometry ───────────────────────────────────────────────────────────────
const VIEW_H = 1080;
const STAGE_W = 1920;
const STAGE_H = 4500;

// ── Palette ────────────────────────────────────────────────────────────────
const NIGHT = "#0a4e5f";
const WATER_TOP = "#226670";
const WATER_MID = "#266e7e";
const WATER_DEEP = "#0c3c48";
const FLOOR = "#277081";
const ROCK_LIGHT = "#56a8be";
const ROCK_DARK = "#3d8aa0";
const ROCK_HIGHLIGHT = "#b9d4da";
const FISH = "#1f5b6a";
const YELLOW = "#f1c46b";
const STAR_YELLOW = "#ffd479";
const WHITE = "#ffffff";
const ORANGE = "#e89446";
const ROPE = "#f4e0a8";
const ANCHOR = "#7c4a2a";

// ── Helpers ────────────────────────────────────────────────────────────────
const TAU = Math.PI * 2;

const sway = (frame: number, period: number, amp: number, phase = 0) =>
  Math.sin(((frame / period) * TAU) + phase) * amp;

// ── Composition ────────────────────────────────────────────────────────────
export const UnderwaterDive: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  // Linear scroll — the source GSAP used scrub:true, a raw remap.
  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const panY = -(STAGE_H - VIEW_H) * progress;

  const t = frame / fps; // seconds — for the idle loops

  // Bait descends with the dive.
  const esaY = interpolate(progress, [0, 1], [232, 2200]);
  const esaX = STAGE_W * 0.5 + sway(frame, fps * 4, 6);

  // Fishing rope: dasharray draw — fully drawn when the bait has fully fallen.
  const ropeLen = esaY - 232;
  const ropeDraw = interpolate(progress, [0, 0.95], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Pre-computed idle phases the renderer reuses.
  const phases = useMemo(() => {
    return {
      smokeA: 0,
      smokeB: 1,
      fishRows: Array.from({ length: 8 }, (_, i) => ({
        y: 1300 + i * 110,
        dir: i % 2 === 0 ? 1 : -1,
        phase: i * 0.6,
        count: 6 + (i % 3),
        baseX: 200 + (i * 113) % 600,
      })),
      bubbles: Array.from({ length: 14 }, (_, i) => ({
        x: 120 + (i * 137) % (STAGE_W - 200),
        startY: 2400 + (i * 31) % 200,
        speed: 90 + (i % 5) * 18,
        size: 4 + (i % 4) * 2,
        phase: (i * 0.41) % 1,
      })),
    };
  }, []);

  // Moon halos breathe slowly.
  const moonBreath = 1 + sway(frame, fps * 4, 0.04);

  // Smoke ovals — scale 0→1.5, fade out, loop every 2s with two staggered puffs.
  const smokePuff = (offsetSec: number) => {
    const cycle = ((t + offsetSec) % 2) / 2; // 0→1
    return {
      scale: 0.2 + cycle * 1.3,
      opacity: Math.max(0, 1 - cycle * 1.1),
    };
  };
  const smokeA = smokePuff(phases.smokeA);
  const smokeB = smokePuff(phases.smokeB);

  // Water bands sway laterally — yoyo sin.
  const waterTopX = sway(frame, fps * 6, 20);
  const waterMidX = sway(frame, fps * 7, 30, Math.PI / 3);
  const waterDeepX = sway(frame, fps * 8, 22, Math.PI);

  // Star rotation across the scene.
  const starRot = (frame / fps) * 12;

  // Tako (octopus) bob + leg sway.
  const takoY = 2050 + sway(frame, fps * 4, 12);
  const takoLegSwing = (i: number) =>
    sway(frame, fps * 3, 10, i * (Math.PI / 2));

  // Kurage (jellyfish) drift.
  const kurageY = 1500 + sway(frame, fps * 5, 25);

  // Fugu (puffer) gentle hover.
  const fuguY = 1820 + sway(frame, fps * 4, 10, Math.PI / 4);

  // Ika (squid) hover and tentacle sway.
  const ikaY = 2480 + sway(frame, fps * 5, 14);

  // Submarine — slow drift across.
  const subX = 1280 + sway(frame, fps * 9, 30);
  const subY = 2700 + sway(frame, fps * 6, 8);

  // Kame (turtle) crawl across the floor.
  const kameX = 350 + sway(frame, fps * 12, 40);

  return (
    <AbsoluteFill style={{ backgroundColor: WATER_DEEP, overflow: "hidden" }}>
      <svg
        viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
        width={STAGE_W}
        height={STAGE_H}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: `translateY(${panY}px)`,
          willChange: "transform",
        }}
      >
        {/* ── Depth gradient ──────────────────────────────────────────── */}
        <defs>
          <linearGradient id="depth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NIGHT} />
            <stop offset="14%" stopColor={NIGHT} />
            <stop offset="22%" stopColor={WATER_TOP} />
            <stop offset="45%" stopColor={WATER_MID} />
            <stop offset="80%" stopColor={WATER_DEEP} />
            <stop offset="100%" stopColor="#062831" />
          </linearGradient>
          <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width={STAGE_W} height={STAGE_H} fill="url(#depth)" />

        {/* ── 1. Sky + moon ───────────────────────────────────────────── */}
        <g transform={`translate(1480 280)`}>
          {/* halo rings */}
          <circle r={170 * moonBreath} fill={WHITE} opacity={0.06} />
          <circle r={130 * moonBreath} fill={WHITE} opacity={0.1} />
          <circle r={95 * moonBreath} fill={WHITE} opacity={0.18} />
          <circle r={70} fill={WHITE} />
          <circle cx={-22} cy={-14} r={10} fill="#e8eef0" opacity={0.7} />
          <circle cx={14} cy={18} r={6} fill="#dbe5e8" opacity={0.6} />
        </g>

        {/* ── 2. Stars ────────────────────────────────────────────────── */}
        <g transform={`translate(360 200) rotate(${starRot})`}>
          <polygon
            points="0,-14 4,-4 14,-4 6,3 9,13 0,7 -9,13 -6,3 -14,-4 -4,-4"
            fill={STAR_YELLOW}
          />
        </g>
        <circle cx={620} cy={120} r={3} fill={STAR_YELLOW} />
        <circle cx={920} cy={300} r={2.5} fill={STAR_YELLOW} />
        <circle cx={1180} cy={150} r={3.5} fill={STAR_YELLOW} />

        {/* ── 3. Top hill silhouette (right) ──────────────────────────── */}
        <polygon
          points="1620,560 1820,360 1900,420 1990,560"
          fill="#063945"
        />
        <polygon points="1780,400 1820,360 1860,402 1830,420" fill={WHITE} />
        {/* Smaller left hill */}
        <polygon points="40,560 160,440 250,560" fill="#063945" />

        {/* ── 4. Ship ─────────────────────────────────────────────────── */}
        <g transform="translate(720 470)">
          {/* hull */}
          <path
            d="M -60 0 Q -55 24 -40 30 L 40 30 Q 55 24 60 0 Z"
            fill={WHITE}
          />
          {/* deck strip */}
          <rect x={-46} y={-10} width={92} height={10} fill="#e7eef1" />
          {/* chimney */}
          <rect x={6} y={-34} width={14} height={24} fill={WHITE} />
          <rect x={6} y={-34} width={14} height={5} fill="#cf6a40" />
          {/* mast */}
          <line x1={-22} y1={-32} x2={-22} y2={-2} stroke={WHITE} strokeWidth={2} />
          <polygon points="-22,-32 -2,-22 -22,-12" fill={WHITE} />
          {/* smoke puffs */}
          <ellipse
            cx={14}
            cy={-50}
            rx={12}
            ry={8}
            fill={WHITE}
            opacity={smokeA.opacity}
            transform={`scale(${smokeA.scale})`}
            style={{ transformOrigin: "14px -50px" }}
          />
          <ellipse
            cx={14}
            cy={-50}
            rx={12}
            ry={8}
            fill={WHITE}
            opacity={smokeB.opacity}
            transform={`scale(${smokeB.scale})`}
            style={{ transformOrigin: "14px -50px" }}
          />
        </g>

        {/* ── 5. Fishing rope + esa ───────────────────────────────────── */}
        {(() => {
          // The rope is the dotted line from sky to bait. We draw it as one
          // long dashed line that progressively reveals.
          const len = Math.max(1, ropeLen);
          const dashOffset = len * (1 - ropeDraw);
          return (
            <g>
              <line
                x1={esaX}
                y1={232}
                x2={esaX}
                y2={esaY}
                stroke={ROPE}
                strokeWidth={1.5}
                strokeDasharray={len}
                strokeDashoffset={dashOffset}
                opacity={0.8}
              />
              {/* Bait — hook + lure */}
              <g transform={`translate(${esaX} ${esaY})`}>
                <path
                  d="M 0 -6 Q 0 14 -8 16 Q -16 14 -14 6"
                  stroke={ROPE}
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                />
                <ellipse cx={4} cy={-2} rx={6} ry={8} fill={YELLOW} />
                <circle cx={6} cy={-3} r={1.6} fill="#b54a2a" />
              </g>
            </g>
          );
        })()}

        {/* ── 6. Water surface band ───────────────────────────────────── */}
        <g transform={`translate(${waterTopX} 0)`}>
          <rect
            x={-100}
            y={560}
            width={STAGE_W + 200}
            height={80}
            fill={WATER_TOP}
          />
          {/* foam caps */}
          <ellipse cx={200} cy={570} rx={120} ry={10} fill="#3a8090" />
          <ellipse cx={620} cy={580} rx={140} ry={9} fill="#3a8090" />
          <ellipse cx={1080} cy={572} rx={100} ry={10} fill="#3a8090" />
          <ellipse cx={1480} cy={585} rx={150} ry={9} fill="#3a8090" />
        </g>
        <g transform={`translate(${waterMidX} 0)`}>
          <rect
            x={-100}
            y={640}
            width={STAGE_W + 200}
            height={200}
            fill={WATER_MID}
            opacity={0.85}
          />
        </g>

        {/* ── 7. Big rocks left/right ─────────────────────────────────── */}
        {/* Left rock */}
        <g>
          <polygon
            points="0,1100 0,2400 240,2400 280,2150 220,1900 320,1700 260,1500 180,1320 90,1180"
            fill={ROCK_DARK}
          />
          <polygon
            points="0,1100 90,1180 180,1320 260,1500 200,1480 130,1340 60,1240 0,1190"
            fill={ROCK_LIGHT}
          />
          <polygon
            points="180,1320 220,1280 260,1310 240,1360 200,1340"
            fill={ROCK_HIGHLIGHT}
            opacity={0.55}
          />
        </g>
        {/* Right rock */}
        <g>
          <polygon
            points="1920,1080 1920,2400 1700,2400 1660,2100 1740,1860 1660,1620 1740,1400 1820,1240 1900,1140"
            fill={ROCK_DARK}
          />
          <polygon
            points="1920,1080 1900,1140 1820,1240 1740,1400 1810,1380 1870,1240 1920,1180"
            fill={ROCK_LIGHT}
          />
          <polygon
            points="1740,1400 1780,1370 1820,1390 1800,1440 1760,1430"
            fill={ROCK_HIGHLIGHT}
            opacity={0.55}
          />
        </g>

        {/* ── 8. Fish shoals ──────────────────────────────────────────── */}
        {phases.fishRows.map((row, i) => {
          const drift = sway(frame, fps * 4, 50, row.phase) * row.dir;
          return (
            <g key={i} transform={`translate(${drift} 0)`}>
              {Array.from({ length: row.count }).map((_, j) => {
                const x = row.baseX + j * 90;
                const y = row.y + sway(frame, fps * 3, 4, j * 0.4 + i);
                return (
                  <g key={j} transform={`translate(${x} ${y})`}>
                    <ellipse rx={14} ry={5} fill={FISH} />
                    <polygon
                      points="-14,0 -22,-5 -22,5"
                      fill={FISH}
                    />
                    <circle cx={6} cy={-1} r={1.2} fill={WHITE} />
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* ── 9. Tako (octopus) ───────────────────────────────────────── */}
        <g transform={`translate(960 ${takoY})`}>
          {/* legs — drawn first so they sit under the body */}
          {[0, 1, 2, 3].map((i) => {
            const sw = takoLegSwing(i);
            const baseAngle = -60 + i * 40;
            const rad = (baseAngle * Math.PI) / 180;
            const x1 = Math.cos(rad) * 50;
            const y1 = 60 + Math.sin(rad) * 20;
            const x2 = Math.cos(rad) * 130 + sw;
            const y2 = 180 + Math.sin(rad) * 40;
            const cx1 = (x1 + x2) / 2 + sw * 1.2;
            const cy1 = (y1 + y2) / 2;
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} Q ${cx1} ${cy1} ${x2} ${y2}`}
                stroke={YELLOW}
                strokeWidth={20}
                fill="none"
                strokeLinecap="round"
                opacity={0.92}
              />
            );
          })}
          {/* body */}
          <ellipse rx={110} ry={95} fill={YELLOW} />
          <ellipse cy={-20} rx={90} ry={45} fill="#f4d18a" opacity={0.6} />
          {/* eyes */}
          <circle cx={-32} cy={-8} r={14} fill={WHITE} />
          <circle cx={32} cy={-8} r={14} fill={WHITE} />
          <circle cx={-30} cy={-6} r={6} fill="#1f1f1f" />
          <circle cx={34} cy={-6} r={6} fill="#1f1f1f" />
          {/* smile */}
          <path
            d="M -22 30 Q 0 50 22 30"
            stroke="#1f1f1f"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
          {/* cheek */}
          <circle cx={-55} cy={20} r={9} fill={ORANGE} opacity={0.6} />
          <circle cx={55} cy={20} r={9} fill={ORANGE} opacity={0.6} />
        </g>

        {/* ── 10. Kurage (jellyfish) ──────────────────────────────────── */}
        <g transform={`translate(420 ${kurageY})`}>
          {/* dome */}
          <path
            d="M -70 0 Q -70 -70 0 -70 Q 70 -70 70 0 Z"
            fill={ORANGE}
          />
          <path
            d="M -50 -10 Q -50 -55 0 -55 Q 50 -55 50 -10"
            fill="#f1a866"
          />
          {/* skirt */}
          <path
            d="M -70 0 Q -60 12 -50 0 Q -40 12 -30 0 Q -20 12 -10 0 Q 0 12 10 0 Q 20 12 30 0 Q 40 12 50 0 Q 60 12 70 0"
            fill={ORANGE}
          />
          {/* tentacles — wavy */}
          {[-50, -25, 0, 25, 50].map((tx, i) => {
            const offset = sway(frame, fps * 3, 8, i * 0.5);
            return (
              <path
                key={i}
                d={`M ${tx} 6 Q ${tx + offset} 40 ${tx - offset} 80 Q ${tx + offset} 120 ${tx - offset / 2} 170`}
                stroke={ORANGE}
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                opacity={0.75}
              />
            );
          })}
          {/* face */}
          <circle cx={-18} cy={-22} r={4} fill="#3b1d05" />
          <circle cx={18} cy={-22} r={4} fill="#3b1d05" />
          <path
            d="M -8 -8 Q 0 -2 8 -8"
            stroke="#3b1d05"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
          />
        </g>

        {/* ── 11. Fugu (puffer) ───────────────────────────────────────── */}
        <g transform={`translate(1500 ${fuguY})`}>
          <circle r={48} fill={YELLOW} />
          <circle r={48} fill="#e8b252" opacity={0.4} />
          {/* fin */}
          <polygon points="-50,-10 -78,-30 -78,10" fill={YELLOW} />
          {/* tail */}
          <polygon points="48,0 78,-22 78,22" fill={YELLOW} />
          {/* spikes */}
          {Array.from({ length: 10 }).map((_, i) => {
            const a = (i / 10) * TAU;
            const x1 = Math.cos(a) * 44;
            const y1 = Math.sin(a) * 44;
            const x2 = Math.cos(a) * 56;
            const y2 = Math.sin(a) * 56;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#d8a04a"
                strokeWidth={2}
                strokeLinecap="round"
              />
            );
          })}
          {/* eye */}
          <circle cx={16} cy={-10} r={8} fill={WHITE} />
          <circle cx={18} cy={-10} r={4} fill="#1f1f1f" />
          {/* mouth */}
          <path
            d="M 28 8 Q 36 12 36 18"
            stroke="#1f1f1f"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
          />
        </g>

        {/* ── 12. Ika (squid) ─────────────────────────────────────────── */}
        <g transform={`translate(540 ${ikaY})`}>
          {/* head — triangle */}
          <polygon points="0,-80 -45,30 45,30" fill={YELLOW} />
          <polygon points="0,-70 -32,18 32,18" fill="#f4d18a" opacity={0.6} />
          {/* fins */}
          <polygon points="-45,30 -65,10 -55,38" fill={YELLOW} />
          <polygon points="45,30 65,10 55,38" fill={YELLOW} />
          {/* tentacles — 6 */}
          {[-30, -18, -6, 6, 18, 30].map((tx, i) => {
            const wave = sway(frame, fps * 3, 6, i * 0.7);
            return (
              <path
                key={i}
                d={`M ${tx} 30 Q ${tx + wave} 55 ${tx - wave} 80 Q ${tx + wave} 100 ${tx} 120`}
                stroke={YELLOW}
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
              />
            );
          })}
          {/* eyes */}
          <circle cx={-14} cy={-20} r={5} fill="#1f1f1f" />
          <circle cx={14} cy={-20} r={5} fill="#1f1f1f" />
        </g>

        {/* ── 13. Submarine ───────────────────────────────────────────── */}
        <g transform={`translate(${subX} ${subY})`}>
          {/* body */}
          <ellipse rx={90} ry={42} fill={YELLOW} />
          <ellipse rx={84} ry={36} fill="#e8b252" opacity={0.3} />
          {/* propeller */}
          <line x1={-90} y1={0} x2={-110} y2={-10} stroke="#704020" strokeWidth={2} />
          <line x1={-90} y1={0} x2={-110} y2={10} stroke="#704020" strokeWidth={2} />
          <polygon points="-110,-14 -118,0 -110,14" fill="#a86840" />
          {/* tower */}
          <rect x={-12} y={-58} width={24} height={20} rx={4} fill={YELLOW} />
          {/* periscope */}
          <line x1={0} y1={-58} x2={0} y2={-78} stroke={YELLOW} strokeWidth={4} />
          <rect x={-4} y={-82} width={14} height={6} fill={YELLOW} />
          {/* porthole + frog face */}
          <circle r={28} fill="#0c3c48" />
          <circle r={25} fill="#1e6b58" />
          {/* frog eyes */}
          <circle cx={-9} cy={-7} r={8} fill={WHITE} />
          <circle cx={9} cy={-7} r={8} fill={WHITE} />
          <circle cx={-9} cy={-6} r={4} fill="#1f1f1f" />
          <circle cx={9} cy={-6} r={4} fill="#1f1f1f" />
          <path
            d="M -10 8 Q 0 14 10 8"
            stroke="#1f1f1f"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
          />
          {/* fin top */}
          <polygon points="40,-30 70,-50 70,-25" fill="#d8a04a" />
        </g>

        {/* ── 14. Sea floor ───────────────────────────────────────────── */}
        <g transform={`translate(${waterDeepX} 0)`}>
          <rect x={-100} y={3700} width={STAGE_W + 200} height={STAGE_H - 3700} fill={FLOOR} />
          {/* dunes */}
          <path
            d="M 0 3700 Q 300 3640 600 3700 Q 900 3760 1200 3700 Q 1500 3640 1920 3700 L 1920 3760 L 0 3760 Z"
            fill="#1e5e6a"
          />
        </g>

        {/* ── 15. Anchor ──────────────────────────────────────────────── */}
        <g transform="translate(280 3850)">
          {/* ring */}
          <circle r={18} fill="none" stroke={ANCHOR} strokeWidth={5} />
          {/* shaft */}
          <line x1={0} y1={18} x2={0} y2={130} stroke={ANCHOR} strokeWidth={6} />
          {/* crossbar */}
          <rect x={-38} y={36} width={76} height={8} fill={ANCHOR} />
          {/* hooks */}
          <path
            d="M 0 130 Q -50 130 -60 80"
            stroke={ANCHOR}
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 0 130 Q 50 130 60 80"
            stroke={ANCHOR}
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
          />
          {/* tips */}
          <polygon points="-60,80 -72,90 -50,95" fill={ANCHOR} />
          <polygon points="60,80 72,90 50,95" fill={ANCHOR} />
        </g>

        {/* ── 16. Sea turtle (kame) ───────────────────────────────────── */}
        <g transform={`translate(${kameX} 3940)`}>
          {/* shell */}
          <ellipse rx={56} ry={36} fill="#7d4d2c" />
          <ellipse rx={50} ry={30} fill="#a06840" opacity={0.6} />
          {/* shell pattern */}
          <path d="M -30 -10 L -10 -22 L 10 -22 L 30 -10 L 20 14 L -20 14 Z" fill="none" stroke="#5c361c" strokeWidth={2} />
          <line x1={-10} y1={-22} x2={-20} y2={14} stroke="#5c361c" strokeWidth={1.5} />
          <line x1={10} y1={-22} x2={20} y2={14} stroke="#5c361c" strokeWidth={1.5} />
          {/* head */}
          <ellipse cx={58} cy={-2} rx={16} ry={12} fill="#7d4d2c" />
          <circle cx={62} cy={-4} r={2} fill={WHITE} />
          {/* flippers */}
          <ellipse cx={-32} cy={20} rx={20} ry={8} fill="#7d4d2c" transform="rotate(20 -32 20)" />
          <ellipse cx={32} cy={20} rx={20} ry={8} fill="#7d4d2c" transform="rotate(-20 32 20)" />
          <ellipse cx={-44} cy={-14} rx={16} ry={6} fill="#7d4d2c" transform="rotate(-20 -44 -14)" />
        </g>

        {/* ── 17. Starfish ────────────────────────────────────────────── */}
        <g transform={`translate(820 4080) rotate(${starRot * 0.4})`}>
          <polygon
            points="0,-30 9,-9 30,-9 13,6 19,28 0,15 -19,28 -13,6 -30,-9 -9,-9"
            fill={STAR_YELLOW}
          />
          <circle r={6} fill="#cf9e3a" />
        </g>

        {/* ── 18. Sea leaves ──────────────────────────────────────────── */}
        {[
          { x: 1100, h: 320, hue: "#1e5e5a" },
          { x: 1200, h: 260, hue: "#2a7068" },
          { x: 1320, h: 380, hue: "#1e5e5a" },
          { x: 1620, h: 300, hue: "#2a7068" },
        ].map((leaf, i) => {
          const w = sway(frame, fps * 4, 12, i);
          return (
            <path
              key={i}
              d={`M ${leaf.x} 4400 Q ${leaf.x + w} ${4400 - leaf.h / 2} ${leaf.x - w} ${4400 - leaf.h}`}
              stroke={leaf.hue}
              strokeWidth={10}
              fill="none"
              strokeLinecap="round"
            />
          );
        })}

        {/* ── 19. Treasure key ────────────────────────────────────────── */}
        <g transform="translate(1500 4100)">
          <circle r={16} fill="none" stroke={STAR_YELLOW} strokeWidth={5} />
          <rect x={14} y={-3} width={36} height={6} fill={STAR_YELLOW} />
          <rect x={42} y={3} width={6} height={10} fill={STAR_YELLOW} />
          <rect x={32} y={3} width={6} height={8} fill={STAR_YELLOW} />
        </g>

        {/* ── 20. Bubbles ─────────────────────────────────────────────── */}
        {phases.bubbles.map((b, i) => {
          const cycle = ((t * b.speed) / 600 + b.phase) % 1;
          const by = b.startY - cycle * 1800;
          const bx = b.x + Math.sin(cycle * TAU + i) * 12;
          const opacity = 1 - cycle * 0.6;
          return (
            <circle
              key={i}
              cx={bx}
              cy={by}
              r={b.size}
              fill="none"
              stroke="#a8d4dc"
              strokeWidth={1}
              opacity={opacity * 0.7}
            />
          );
        })}

        {/* ── 21. A faint final-depth vignette ────────────────────────── */}
        <rect
          x={0}
          y={4200}
          width={STAGE_W}
          height={300}
          fill="url(#depth)"
          opacity={0.3}
        />
      </svg>
    </AbsoluteFill>
  );
};
