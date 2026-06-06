/**
 * WalkthroughVideo — the beat player.
 *
 * Each step is a back-to-back run of BEAT sequences. Within a beat the engine
 * plays a real micro-action and the lower-third caption names it IN SYNC:
 *   • the screenshot for that beat mounts (a click in the previous beat is what
 *     swapped the screen — that is the "it actually did something" feel);
 *   • a page-load bar sweeps when the beat enters a new page;
 *   • the Cursor glides in on a bezier and clicks;
 *   • a field is typed, a figure rolls, a popup springs;
 *   • the caption changes with the action, not on a fixed clock.
 *
 * Steps and beats hand off on HARD CUTS — never a fade (house rule). The cursor
 * resting point is carried forward (baked into the data) so the hand never
 * teleports. All coordinates are already canvas-space (geometry.ts owns the
 * image→canvas transform); the components never see the manifest.
 */

import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { font } from "../../common/fonts";
import { DotGrid, DotGridVignette } from "../anticheat/DotGrid";
import { Cursor } from "./Cursor";
import { Callout } from "./Callout";
import { TypingField } from "./TypingField";
import { NumberRoll } from "./NumberRoll";
import { NavLoadingBar } from "./NavLoadingBar";
import { Screen } from "./Screen";
import { SCREEN_TOP, SCREEN_LEFT, SCREEN_W } from "./geometry";
import { STEPS, TOTAL_FRAMES, FPS, type ResolvedBeat } from "./walkthroughData";

const GROUND = "#F0F2F4";
const INK = "#1D1D1F";
const DIM = "#5A5B6A";

// ─── Lower-third: step title (static) + the beat caption (synced) ────────────

const LowerThird: React.FC<{ index: number; total: number; title: string; caption: string }> = ({
  index,
  total,
  title,
  caption,
}) => {
  const frame = useCurrentFrame();
  // The caption belongs to THIS beat — fade it in quickly as the beat opens, so
  // the words land with the action rather than lingering from the last one.
  const capOpacity = interpolate(frame, [0, 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const capRise = interpolate(frame, [0, 7], [8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 22, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontFamily: font, fontSize: 13, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: DIM, fontVariantNumeric: "tabular-nums" }}>
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <span style={{ fontFamily: font, fontSize: 30, fontWeight: 700, letterSpacing: "-0.018em", color: INK, lineHeight: 1.05 }}>
            {title}
          </span>
        </div>
        <div style={{ transform: `translateY(${capRise}px)`, opacity: capOpacity, fontFamily: font, fontSize: 17, fontWeight: 500, color: DIM, lineHeight: 1.3 }}>
          {caption}
        </div>
      </div>
    </div>
  );
};

// ─── One beat ────────────────────────────────────────────────────────────────

const BeatScene: React.FC<{ beat: ResolvedBeat; index: number; total: number; title: string }> = ({
  beat,
  index,
  total,
  title,
}) => (
  <AbsoluteFill style={{ background: GROUND }}>
    <DotGrid intensity={0.7} speed={0.9} />
    <DotGridVignette intensity={0.24} />

    <Screen image={beat.image} />

    {beat.loadBar && (
      <NavLoadingBar top={SCREEN_TOP} left={SCREEN_LEFT} width={SCREEN_W} startFrame={0} durationFrames={beat.loadBar.dur} />
    )}

    {beat.roll && (
      <NumberRoll
        rect={beat.roll.rect}
        to={beat.roll.to}
        startFrame={beat.roll.startFrame}
        durationFrames={beat.roll.dur}
        prefix={beat.roll.prefix}
        suffix={beat.roll.suffix}
        decimals={beat.roll.decimals}
        fontSize={beat.roll.fontSize}
        align="left"
      />
    )}

    {beat.type && (
      <TypingField
        rect={beat.type.rect}
        value={beat.type.value}
        startFrame={beat.type.startFrame}
        durationFrames={beat.type.dur}
        prefix={beat.type.prefix}
      />
    )}

    {beat.callout && (
      <Callout
        target={beat.callout.rect}
        label={beat.callout.label}
        side={beat.callout.side}
        index={beat.callout.index}
        appearFrame={beat.callout.appearFrame}
      />
    )}

    <Cursor
      from={beat.cursor.from}
      to={beat.cursor.to}
      startFrame={beat.cursor.startFrame}
      moveDuration={beat.cursor.moveDuration}
      clickFrame={beat.cursor.clickFrame}
    />

    <LowerThird index={index} total={total} title={title} caption={beat.caption} />
  </AbsoluteFill>
);

// ─── Orchestrator ────────────────────────────────────────────────────────────

export const WalkthroughVideo: React.FC = () => {
  let stepOffset = 0;
  const out: React.ReactNode[] = [];

  STEPS.forEach((step, si) => {
    let beatOffset = 0;
    step.beats.forEach((beat, bi) => {
      out.push(
        <Sequence
          key={`${step.name}-${bi}`}
          from={stepOffset + beatOffset}
          durationInFrames={beat.len}
          name={`${step.title} · ${bi + 1}`}
          layout="none"
        >
          <BeatScene beat={beat} index={si} total={STEPS.length} title={step.title} />
        </Sequence>,
      );
      beatOffset += beat.len;
    });
    stepOffset += step.durationInFrames;
  });

  return <AbsoluteFill style={{ background: GROUND }}>{out}</AbsoluteFill>;
};

export const walkthroughTakerMeta = {
  id: "WalkthroughTaker",
  component: WalkthroughVideo,
  durationInFrames: TOTAL_FRAMES,
  fps: FPS,
  width: 1920,
  height: 1080,
};
