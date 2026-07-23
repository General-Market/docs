// SubPartTag — the sub-beat stepper at the top of frame.
//
// No words. A row of icon squares joined by lines — □—□—□ — one per sub-part,
// fixed in place. A white square slides left → right onto the live step; the
// icon inside it reads blue, the joining line fills behind it. As the beats
// pass the white square walks rightward: that is the progress. It pops in at
// each sub-beat, holds ~3s, leaves. Sits at the TOP, clear of the captions.

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  Server,
  Rewind,
  Lock,
  Dice5,
  ShoppingCart,
  Wallet,
  Eye,
  Droplet,
  ScanEye,
  KeyRound,
  BookLock,
  Building2,
  BadgePercent,
  ListOrdered,
  Layers,
  Users,
  CircleX,
  HandCoins,
  TrendingUp,
  CircleSlash2,
  Flame,
  Gift,
  type LucideIcon,
} from "lucide-react";
import { SUBPARTS, CHAPTERS, activeSubTag } from "./chapters";

const ICONS: Record<string, LucideIcon> = {
  Server, Rewind, Lock, Dice5, ShoppingCart, Wallet, Eye, Droplet, ScanEye,
  KeyRound, BookLock, Building2, BadgePercent, ListOrdered, Layers, Users,
  CircleX, HandCoins, TrendingUp, CircleSlash2, Flame, Gift,
};

const DONE = "#2D5BFF";
const SLIDE = 0.4;
const SQ = 58;
const LINK = 30;
const MARGIN = 7;
const PITCH = SQ + LINK + MARGIN * 2; // 102
const RADIUS = 15;

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const stepX = (i: number): number => i * PITCH;

export const SubPartTag: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width: W } = useVideoConfig();
  const sec = frame / fps;

  const tag = activeSubTag(sec);
  if (!tag) return null;

  const { chapterIdx, subIdx, start, end } = tag;
  const subs = SUBPARTS[CHAPTERS[chapterIdx].n] ?? [];
  if (subs.length === 0) return null;

  const appear = smoothstep(start, start + SLIDE, sec);
  const leave = smoothstep(end - SLIDE, end, sec);
  const vis = appear * (1 - leave);
  const dropY = interpolate(appear, [0, 1], [-22, 0]) + leave * 12;

  // The white square slides from the previous step to the current one. For the
  // first sub-beat it slides in from off the left.
  const slide = spring({
    frame: (sec - start) * fps,
    fps,
    config: { damping: 20, mass: 0.7, stiffness: 150 },
    durationInFrames: Math.round(0.55 * fps),
  });
  const prevX = subIdx > 0 ? stepX(subIdx - 1) : stepX(0) - PITCH;
  const hlX = prevX + (stepX(subIdx) - prevX) * slide;

  const totalW = (subs.length - 1) * PITCH + SQ;
  const containerLeft = Math.round((W - totalW) / 2);

  const renderIcon = (name: string, color: string) => {
    const Icon = ICONS[name] ?? CircleSlash2;
    return <Icon size={30} color={color} strokeWidth={2.2} absoluteStrokeWidth />;
  };

  const CurIcon = subs[subIdx]?.icon ?? "CircleSlash2";

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: 46,
          left: containerLeft,
          width: totalW,
          height: SQ,
          opacity: vis,
          transform: `translateY(${dropY.toFixed(1)}px)`,
        }}
      >
        {/* Connector lines — filled up to the current step. */}
        {subs.slice(0, -1).map((_, i) => (
          <div
            key={`l${i}`}
            style={{
              position: "absolute",
              top: SQ / 2 - 2,
              left: stepX(i) + SQ + MARGIN,
              width: LINK,
              height: 4,
              borderRadius: 4,
              background: i < subIdx ? DONE : "rgba(2,14,43,0.40)",
              boxShadow: i < subIdx ? "0 0 10px rgba(45, 91, 255,0.5)" : "none",
            }}
          />
        ))}

        {/* The fixed track of icon squares. */}
        {subs.map((s, i) => {
          const done = i < subIdx;
          const fill = done ? DONE : "rgba(2,14,43,0.55)";
          const iconColor = done ? "#FFFFFF" : "rgba(255,255,255,0.55)";
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: 0,
                left: stepX(i),
                width: SQ,
                height: SQ,
                borderRadius: RADIUS,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: fill,
                border: done ? "none" : "1.5px solid rgba(255,255,255,0.32)",
                boxShadow: done ? "0 8px 22px rgba(45, 91, 255,0.35)" : "0 6px 18px rgba(0,0,0,0.30)",
              }}
            >
              {renderIcon(s.icon, iconColor)}
            </div>
          );
        })}

        {/* The white square — slides onto the live step, the icon inside blue. */}
        <div
          style={{
            position: "absolute",
            top: -3,
            left: hlX,
            width: SQ + 6,
            height: SQ + 6,
            borderRadius: RADIUS + 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#FFFFFF",
            boxShadow: "0 0 26px rgba(45, 91, 255,0.55), 0 12px 30px rgba(0,0,0,0.35)",
          }}
        >
          {renderIcon(CurIcon, DONE)}
        </div>
      </div>
    </AbsoluteFill>
  );
};
