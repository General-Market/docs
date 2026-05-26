import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SANS, SANS_TEXT } from "../article-2/theme";
import {
  FIELD_BG,
  FPS,
  H,
  INK,
  LAYOUT,
  SUBTITLE,
  TIERS,
  TIMING,
  TITLE,
  TITLE_BAND,
  TRACK_BG,
  TRACK_BG_ACTIVE,
  W,
} from "./config";
import {
  SCHEDULE,
  TOTAL,
  activeChip,
  activeTierAt,
  cameraAt,
  cursorAt,
  flightState,
  rowGeometry,
  slotCenter,
  tileSizeFor,
} from "./engine";
import { Cursor, DescriptionChip, LogoTile } from "./components";
import type { Tier } from "./data";

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

const tierColor = (id: string) => TIERS.find((t) => t.id === id)!.color;

/** The static board: six colored label cells + their dark tracks. */
const Board: React.FC<{ active: Tier | null }> = ({ active }) => (
  <>
    {TIERS.map((t) => {
      const { top } = rowGeometry(t.id);
      const h = LAYOUT.board.rowH - LAYOUT.board.rowGap;
      const isActive = t.id === active;
      return (
        <div key={t.id}>
          <div
            style={{
              position: "absolute",
              left: 14,
              top,
              width: LAYOUT.board.labelW,
              height: h,
              background: t.color,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 54,
              color: t.ink,
              boxShadow: isActive ? `0 0 0 3px ${t.color}, 0 0 26px ${t.color}66` : "none",
            }}
          >
            {t.id}
          </div>
          <div
            style={{
              position: "absolute",
              left: LAYOUT.board.trackX,
              top,
              width: LAYOUT.board.trackRight - LAYOUT.board.trackX,
              height: h,
              background: isActive ? TRACK_BG_ACTIVE : TRACK_BG,
              borderRadius: 10,
            }}
          />
        </div>
      );
    })}
  </>
);

export const TierListReel: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = cameraAt(frame);
  const cursor = cursorAt(frame);
  const chip = activeChip(frame);
  const active = activeTierAt(frame);

  // cursor "press" — a quick squash whenever a logo is grabbed off the tray
  let press = 0;
  for (const p of SCHEDULE.placements) {
    press = Math.max(press, clamp(1 - Math.abs(frame - p.flightStart) / 3));
  }

  const titleOp = interpolate(frame, [4, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const brandOp = interpolate(
    frame,
    [SCHEDULE.outroStart + 18, SCHEDULE.outroStart + 40],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ background: FIELD_BG }}>
      {/* vignette */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(120% 90% at 50% 42%, rgba(255,255,255,0.05), rgba(0,0,0,0) 60%)",
        }}
      />

      {/* world — a continuous glide up the board, then a pull-back */}
      <div
        style={{
          position: "absolute",
          width: W,
          height: H,
          transformOrigin: "0 0",
          transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.scale})`,
        }}
      >
        <Board active={active} />

        {/* every logo: tray → flight → placed, all through one wrapper */}
        {SCHEDULE.placements.map((p) => {
          const fs = flightState(p, frame);
          const boardTile = tileSizeFor(p.tier);
          let size: number;
          let lift: number;
          let z: number;
          if (fs.phase === "tray") {
            size = LAYOUT.tray.tile;
            lift = 0;
            z = 0;
          } else if (fs.phase === "flight") {
            size = LAYOUT.tray.tile + (boardTile - LAYOUT.tray.tile) * fs.airborne;
            lift = 1;
            z = 5000;
          } else {
            size = boardTile;
            lift = 1 - easeOut(clamp((frame - p.dropFrame) / 7));
            z = 10;
          }
          return (
            <LogoTile key={p.src.id} src={p.src} size={size} x={fs.pos.x} y={fs.pos.y} lift={lift} z={z} />
          );
        })}

        {/* description chip beside the most-recent drop, clamped inside the frame */}
        {chip &&
          (() => {
            const c = slotCenter(chip.tier, chip.slotIndex);
            const boardTile = tileSizeFor(chip.tier);
            const since = frame - chip.dropFrame;
            const dwell = TIMING.chipDwell[chip.tier];
            const op = Math.min(clamp(since / 4), clamp((dwell - since) / 6));
            const below = rowGeometry(chip.tier).center < 260;
            const y = below ? c.y + boardTile / 2 + 14 : c.y - boardTile / 2 - 14;
            const x = clamp(c.x, 270, W - 270);
            return (
              <DescriptionChip
                src={chip.src}
                x={x}
                y={y}
                opacity={op}
                rise={below ? -10 : 10}
                tierColor={tierColor(chip.tier)}
              />
            );
          })()}

        <Cursor x={cursor.x} y={cursor.y} press={press} />
      </div>

      {/* title — fixed overlay, big, always visible, never touched by the camera */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: TITLE_BAND,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          opacity: titleOp,
          background: "linear-gradient(180deg, rgba(7,8,9,0.96) 0%, rgba(7,8,9,0.55) 70%, rgba(7,8,9,0) 100%)",
        }}
      >
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 58, color: INK, letterSpacing: "-1px", lineHeight: 1 }}>
          {TITLE}
        </div>
        <div style={{ fontFamily: SANS_TEXT, fontWeight: 500, fontSize: 24, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>
          {SUBTITLE} · {SCHEDULE.placements.length} sources
        </div>
      </div>

      {/* outro brand beat */}
      <div
        style={{
          position: "absolute",
          bottom: 38,
          width: "100%",
          textAlign: "center",
          opacity: brandOp,
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: 30,
          color: INK,
          letterSpacing: "-0.3px",
        }}
      >
        generalmarket.io
      </div>
    </AbsoluteFill>
  );
};

export const tierListReelMeta = {
  id: "TierListReel",
  component: TierListReel,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: TOTAL,
};
