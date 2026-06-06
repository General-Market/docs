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
  Img as RemImg,
  staticFile,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { font } from "../../common/fonts";
import { DotGrid, DotGridVignette } from "../anticheat/DotGrid";
import { Cursor } from "./Cursor";
import { Callout } from "./Callout";
import { TypingField } from "./TypingField";
import { NavLoadingBar } from "./NavLoadingBar";
import { ClickPulse } from "./ClickPulse";
import { FireblocksPage, FIREBLOCKS_URL } from "./FireblocksPage";
import { BrowserChrome, type ChromeTab } from "./BrowserChrome";
import { SCREEN_TOP, SCREEN_LEFT, SCREEN_W, SCREEN_H, WINDOW_LEFT, WINDOW_TOP } from "./geometry";
import { STEPS, TOTAL_FRAMES, FPS, type ResolvedBeat } from "./walkthroughData";

// The two browser tabs, drawn on every beat; the active one swaps the page.
const TABS = (active: 0 | 1): ChromeTab[] => [
  { title: "CRX — app.crxfx.com", active: active === 0, favicon: "#2D5BFF", url: "app.crxfx.com" },
  { title: "Fireblocks Console", active: active === 1, favicon: "#F5A623", url: FIREBLOCKS_URL },
];

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

    {/* The browser, with two tabs (CRX + Fireblocks). The content is the app
        screenshot, or — once the Fireblocks tab is active — the real console. */}
    <BrowserChrome
      width={SCREEN_W}
      height={SCREEN_H}
      left={WINDOW_LEFT}
      top={WINDOW_TOP}
      tabs={TABS(beat.activeTab)}
      activeTab={beat.activeTab}
    >
      {beat.fireblocks ? (
        <FireblocksPage action={beat.fireblocks.action} rows={beat.fireblocks.rows} approveFrame={beat.fireblocks.approveFrame} confirmedFrame={beat.fireblocks.confirmedFrame} />
      ) : (
        <ScreenImg image={beat.image} />
      )}
    </BrowserChrome>

    {/* The page-load: the content flashes white and paints in, while the Chrome
        load bar sweeps — timed to start when the page actually swaps. */}
    {beat.whiteFlash && <WhiteFlash at={beat.whiteFlash.at} />}
    {beat.loadBar && (
      <NavLoadingBar top={SCREEN_TOP} left={SCREEN_LEFT} width={SCREEN_W} startFrame={beat.loadBar.at} durationFrames={beat.loadBar.dur} />
    )}

    {beat.clickPulse && <ClickPulse rect={beat.clickPulse.rect} atFrame={beat.clickPulse.atFrame} />}

    {beat.type && (
      <TypingField
        rect={beat.type.rect}
        value={beat.type.value}
        startFrame={beat.type.startFrame}
        durationFrames={beat.type.dur}
        style={beat.type.style}
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

    {/* The tab-switch leg (its own pointer), then the main cursor leg. Two legs,
        one pointer at a time, so the hand visibly clicks the tab then the
        control — the "click between each" that makes the switch feel real. */}
    {beat.tabLeg && (
      <Sequence from={0} durationInFrames={beat.cursor ? beat.cursor.startFrame : beat.len} layout="none">
        <Cursor from={beat.tabLeg.from} to={beat.tabLeg.to} startFrame={beat.tabLeg.startFrame} moveDuration={beat.tabLeg.moveDuration} clickFrame={beat.tabLeg.clickFrame} />
      </Sequence>
    )}
    {beat.cursor && (
      <Sequence from={beat.tabLeg ? beat.cursor.startFrame : 0} layout="none">
        <Cursor
          from={beat.cursor.from}
          to={beat.cursor.to}
          startFrame={beat.tabLeg ? 0 : beat.cursor.startFrame}
          moveDuration={beat.cursor.moveDuration}
          clickFrame={beat.cursor.clickFrame != null ? (beat.tabLeg ? beat.cursor.clickFrame - beat.cursor.startFrame : beat.cursor.clickFrame) : undefined}
        />
      </Sequence>
    )}

    <LowerThird index={index} total={total} title={title} caption={beat.caption} />
  </AbsoluteFill>
);

// The screenshot, sized to the browser content area.
const ScreenImg: React.FC<{ image: string }> = ({ image }) => (
  <RemImg src={staticFile(image)} style={{ width: SCREEN_W, height: SCREEN_H, display: "block", objectFit: "cover" }} />
);

// A browser page-load veil over the content area, starting at `at`.
const WhiteFlash: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [at, at + 5, at + 11], [1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (frame < at || frame > at + 11) return null;
  return (
    <div style={{ position: "absolute", left: SCREEN_LEFT, top: SCREEN_TOP, width: SCREEN_W, height: SCREEN_H, background: "#ffffff", opacity, pointerEvents: "none", zIndex: 50 }} />
  );
};

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
