import React from "react";
import { Composition, Folder, staticFile } from "remotion";
import { ChibiExplainer } from "./lib/templates/ChibiExplainer";
import type { ShortConfig } from "./lib/types";
import { short01Meta } from "./shorts/short-01/Short01Composition";
import { short02Meta } from "./shorts/short-02/StonecutterComposition";
import { short03Meta } from "./shorts/short-03/FebNewTop500Composition";
import { short04Meta } from "./shorts/short-04/Short04Composition";
import { visionVCMeta } from "./compositions/vision/vc/VisionVCComposition";
import { visionVC2Meta } from "./compositions/vision/vc2/VisionVC2Composition";
import { visionVC3Meta } from "./compositions/vision/vc3/VisionVC3Composition";
import {
  replicateMeta,
  sceneMetas,
} from "./compositions/replicates/original/ReplicateComposition";
import {
  rainbowsPublicMeta,
  rainbowsPublicSceneMetas,
} from "./compositions/replicates/rainbows-public/RainbowsPublicComposition";
import {
  rainbowsFlashblocksMeta,
  sceneMetasA as rainbowsFlashblocksScenesA,
  sceneMetasB as rainbowsFlashblocksScenesB,
  sceneMetasC as rainbowsFlashblocksScenesC,
} from "./compositions/replicates/rainbows-flashblocks/RainbowsFlashblocksComposition";
import {
  ofReplicateMeta,
  ofSceneMetas,
} from "./compositions/replicates/ordinaryfolk/OFReplicateComposition";
import {
  whopReplicateMeta,
  whopSceneMetas,
} from "./compositions/replicates/whop/WhopReplicateComposition";
import {
  gmBrandMeta,
  gmSceneMetas,
} from "./compositions/gm/brand/GMBrandComposition";
import {
  webglPicksMeta,
  webglSceneMetas,
} from "./compositions/backgrounds/webgl-picks/WebGLPicksComposition";
import { visionVsMeta } from "./compositions/vision/vs/VisionVsComposition";
import { kalshiMeta } from "./compositions/replicates/kalshi/KalshiComposition";
import { kalshiSideBySideMeta } from "./compositions/replicates/kalshi/KalshiSideBySide";
import { flashblocksMeta } from "./compositions/replicates/standrew/FlashblocksComposition";
import { rainbowsPitchMeta } from "./compositions/replicates/rainbows-pitch/RainbowsPitchComposition";
import { sceneAMetas as rainbowsPitchSceneA } from "./compositions/replicates/rainbows-pitch/ScenesA";
import { sceneBMetas as rainbowsPitchSceneB } from "./compositions/replicates/rainbows-pitch/ScenesB";
import { sceneCMetas as rainbowsPitchSceneC } from "./compositions/replicates/rainbows-pitch/ScenesC";
import { rainbowsPitchV2Meta } from "./compositions/replicates/rainbows-pitch-v2/RainbowsPitchV2Composition";
import { rainbowsPitchParallaxMeta } from "./compositions/replicates/rainbows-pitch-parallax/RainbowsPitchParallaxComposition";
import {
  rainbowsPitchPolymarketAMeta,
  rainbowsPitchPolymarketBMeta,
} from "./compositions/replicates/rainbows-pitch/RainbowsPitchPolymarket";
import { flashblocksSideBySideMeta } from "./compositions/replicates/standrew/FlashblocksSideBySide";
import { sceneAMetas as flashblocksSceneAMetas } from "./compositions/replicates/standrew/ScenesA";
import { sceneBMetas as flashblocksSceneBMetas } from "./compositions/replicates/standrew/ScenesB";
import { sceneCMetas as flashblocksSceneCMetas } from "./compositions/replicates/standrew/ScenesC";
import { virtualsReplicateV2Meta } from "./compositions/replicates/virtuals/v2/VirtualsReplicateV2";
import { sideBySideV2Meta as virtualsSideBySideV2Meta } from "./compositions/replicates/virtuals/v2/SideBySide";
import {
  councilReplicateMeta,
  councilSideBySideMeta,
  councilSceneMetas,
} from "./compositions/replicates/council/VirtualsReplicateComposition";
import { emberMeta } from "./compositions/replicates/ember/EmberComposition";
import { emberSideBySideMeta } from "./compositions/replicates/ember/EmberSideBySide";
import { worldcoinMeta } from "./compositions/replicates/worldcoin/WorldcoinComposition";
import { worldcoinSideBySideMeta } from "./compositions/replicates/worldcoin/WorldcoinSideBySide";
import { worldcoin2Meta } from "./compositions/replicates/worldcoin/Worldcoin2Composition";
import { worldcoin2OverLofiMeta } from "./compositions/replicates/worldcoin/Worldcoin2OverLofi";
import { rainbowsCompareIntroMeta } from "./compositions/replicates/worldcoin/RainbowsCompareIntro";
import {
  phoneBrollDemoMeta,
  laptopBrollDemoMeta,
} from "./compositions/replicates/worldcoin/DeviceBrollDemo";
import { riddMeta } from "./compositions/replicates/ridd/RiddComposition";
import { riddSideBySideMeta } from "./compositions/replicates/ridd/RiddSideBySide";
import { wabiMeta } from "./compositions/replicates/wabi/WabiComposition";
import { TutorialVideo } from "./compositions/tutorial/TutorialVideo";
import {
  TOTAL_FRAMES as TUTORIAL_DURATION,
  FPS as TUTORIAL_FPS,
} from "./compositions/tutorial/theme";
import { Launch30 } from "./compositions/launch/Launch30";
import { OgCardGM } from "./compositions/launch/OgCardGM";
import { OgBannerGM } from "./compositions/launch/OgBannerGM";
import { OgBannerNS } from "./compositions/launch/OgBannerNS";
import {
  TOTAL_FRAMES as LAUNCH_DURATION,
  FPS as LAUNCH_FPS,
} from "./compositions/launch/theme";
import { ParticleEmojiGravity } from "./scenes/ParticleAnimations";
import { EndCard } from "./compositions/endcard/EndCard";
import { HexPixelate } from "./compositions/effects/HexPixelate";
import { VIDEO_SRC as LOFI_BROLL_SRC } from "./compositions/endcard/LofiDots";
import { LofiDotsTitled } from "./compositions/endcard/LofiDotsTitled";
import {
  TOTAL_FRAMES as ENDCARD_DURATION,
  FPS as ENDCARD_FPS,
} from "./compositions/endcard/theme";
import { Sequence02 } from "./compositions/sequence02/Sequence02";
import {
  TOTAL_FRAMES as SEQ02_DURATION,
  FPS as SEQ02_FPS,
  W as SEQ02_W,
  H as SEQ02_H,
} from "./compositions/sequence02/theme";
import { insiderCasesMeta } from "./compositions/insider-trading/InsiderCases";
import {
  pitchMeta,
  pitchSceneMetas,
} from "./compositions/pitch/PitchComposition";
import { antiCheatHookMeta } from "./compositions/anticheat/AntiCheatHook";
import { antiCheatStatMeta } from "./compositions/anticheat/AntiCheatStat";
import { antiCheatRiggedMeta } from "./compositions/anticheat/AntiCheatRigged";
import { antiCheatSolutionMeta } from "./compositions/anticheat/AntiCheatSolution";
import { antiCheatReassureMeta } from "./compositions/anticheat/AntiCheatReassure";
import { antiCheatEndCardMeta } from "./compositions/anticheat/AntiCheatEndCard";
import { antiCheatFullMeta } from "./compositions/anticheat/AntiCheatFull";

const SHOW_SCENES = process.env.REMOTION_SHOW_SCENES === "1";

const shorts: ShortConfig[] = [];

// Standalone bench for HexPixelate — the broll, tessellated into small
// flat hexagons. The wrapper is the point; the broll is just convenient
// signal to test it on.
const LofiDotsHexBench: React.FC = () => (
  <HexPixelate src={LOFI_BROLL_SRC} width={1920} height={1080} cellSize={14} />
);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* ═══ ANTI-CHEAT — full launch video (60s) and its scenes ═══ */}
      <Folder name="AntiCheat">
        <Composition
          id={antiCheatFullMeta.id}
          component={antiCheatFullMeta.component}
          durationInFrames={antiCheatFullMeta.durationInFrames}
          fps={antiCheatFullMeta.fps}
          width={antiCheatFullMeta.width}
          height={antiCheatFullMeta.height}
        />
        {[
          antiCheatHookMeta,
          antiCheatStatMeta,
          antiCheatRiggedMeta,
          antiCheatSolutionMeta,
          antiCheatReassureMeta,
          antiCheatEndCardMeta,
        ].map((meta) => (
          <Composition
            key={meta.id}
            id={meta.id}
            component={meta.component}
            durationInFrames={meta.durationInFrames}
            fps={meta.fps}
            width={meta.width}
            height={meta.height}
          />
        ))}
      </Folder>

      {/* ═══ PITCH — VC pitch deck, 1 second per slide ═══ */}
      <Composition
        id={pitchMeta.id}
        component={pitchMeta.component}
        durationInFrames={pitchMeta.durationInFrames}
        fps={pitchMeta.fps}
        width={pitchMeta.width}
        height={pitchMeta.height}
      />
      <Folder name="Pitch-Slides">
        {pitchSceneMetas.map((meta) => (
          <Composition
            key={meta.id}
            id={meta.id}
            component={meta.component}
            durationInFrames={meta.durationInFrames}
            fps={meta.fps}
            width={meta.width}
            height={meta.height}
          />
        ))}
      </Folder>

      {/* ═══ LOFI DOTS — HexPixelate bench over the broll (5m11s) ═══ */}
      <Composition
        id="LofiDots"
        component={LofiDotsHexBench}
        durationInFrames={Math.round(311 * ENDCARD_FPS)}
        fps={ENDCARD_FPS}
        width={1920}
        height={1080}
      />

      {/* ═══ LOFI DOTS TITLED — same broll, but the titles are the broll ═══ */}
      <Composition
        id="LofiDotsTitled"
        component={LofiDotsTitled}
        durationInFrames={Math.round(311 * ENDCARD_FPS)}
        fps={ENDCARD_FPS}
        width={1920}
        height={1080}
      />

      {/* ═══ RAINBOWS PITCH — Flashblocks-Replicate clone, awaiting copy adaptation ═══ */}
      <Composition
        id={rainbowsPitchMeta.id}
        component={rainbowsPitchMeta.component}
        durationInFrames={rainbowsPitchMeta.durationInFrames}
        fps={rainbowsPitchMeta.fps}
        width={rainbowsPitchMeta.width}
        height={rainbowsPitchMeta.height}
      />
      {/* ═══ RAINBOWS PITCH V2 — every scene gets a prop ═══ */}
      <Composition
        id={rainbowsPitchV2Meta.id}
        component={rainbowsPitchV2Meta.component}
        durationInFrames={rainbowsPitchV2Meta.durationInFrames}
        fps={rainbowsPitchV2Meta.fps}
        width={rainbowsPitchV2Meta.width}
        height={rainbowsPitchV2Meta.height}
      />
      {/* ═══ RAINBOWS PITCH PARALLAX — each scene gets a different micro-element layer ═══ */}
      <Composition
        id={rainbowsPitchParallaxMeta.id}
        component={rainbowsPitchParallaxMeta.component}
        durationInFrames={rainbowsPitchParallaxMeta.durationInFrames}
        fps={rainbowsPitchParallaxMeta.fps}
        width={rainbowsPitchParallaxMeta.width}
        height={rainbowsPitchParallaxMeta.height}
      />
      {/* ═══ RAINBOWS PITCH — Polymarket-styled chart panels at 00:11 ═══ */}
      <Composition
        id={rainbowsPitchPolymarketAMeta.id}
        component={rainbowsPitchPolymarketAMeta.component}
        durationInFrames={rainbowsPitchPolymarketAMeta.durationInFrames}
        fps={rainbowsPitchPolymarketAMeta.fps}
        width={rainbowsPitchPolymarketAMeta.width}
        height={rainbowsPitchPolymarketAMeta.height}
      />
      <Composition
        id={rainbowsPitchPolymarketBMeta.id}
        component={rainbowsPitchPolymarketBMeta.component}
        durationInFrames={rainbowsPitchPolymarketBMeta.durationInFrames}
        fps={rainbowsPitchPolymarketBMeta.fps}
        width={rainbowsPitchPolymarketBMeta.width}
        height={rainbowsPitchPolymarketBMeta.height}
      />
      {SHOW_SCENES && (
        <Folder name="Rainbows-Pitch-Scenes">
          {[
            ...rainbowsPitchSceneA,
            ...rainbowsPitchSceneB,
            ...rainbowsPitchSceneC,
          ].map((meta) => (
            <Composition
              key={meta.id}
              id={meta.id}
              component={meta.component}
              durationInFrames={meta.durationInFrames}
              fps={rainbowsPitchMeta.fps}
              width={rainbowsPitchMeta.width}
              height={rainbowsPitchMeta.height}
            />
          ))}
        </Folder>
      )}

      {/* ═══ REPLICATE ═══ */}
      <Folder name="Replicate">
        {/* --- Rainbows: Public.com adaptation --- */}
        <Composition
          id={rainbowsPublicMeta.id}
          component={rainbowsPublicMeta.component}
          durationInFrames={rainbowsPublicMeta.durationInFrames}
          fps={rainbowsPublicMeta.fps}
          width={rainbowsPublicMeta.width}
          height={rainbowsPublicMeta.height}
        />
        {SHOW_SCENES && (
          <Folder name="Rainbows-Public-Scenes">
            {rainbowsPublicSceneMetas.map((meta) => (
              <Composition
                key={meta.id}
                id={meta.id}
                component={meta.component}
                durationInFrames={meta.durationInFrames}
                fps={meta.fps}
                width={meta.width}
                height={meta.height}
              />
            ))}
          </Folder>
        )}

        {/* --- Rainbows: Flashblocks adaptation --- */}
        <Composition
          id={rainbowsFlashblocksMeta.id}
          component={rainbowsFlashblocksMeta.component}
          durationInFrames={rainbowsFlashblocksMeta.durationInFrames}
          fps={rainbowsFlashblocksMeta.fps}
          width={rainbowsFlashblocksMeta.width}
          height={rainbowsFlashblocksMeta.height}
        />
        {SHOW_SCENES && (
          <Folder name="Rainbows-Flashblocks-Scenes">
            {[
              ...rainbowsFlashblocksScenesA,
              ...rainbowsFlashblocksScenesB,
              ...rainbowsFlashblocksScenesC,
            ].map((meta) => (
              <Composition
                key={meta.id}
                id={meta.id}
                component={meta.component}
                durationInFrames={meta.durationInFrames}
                fps={rainbowsFlashblocksMeta.fps}
                width={rainbowsFlashblocksMeta.width}
                height={rainbowsFlashblocksMeta.height}
              />
            ))}
          </Folder>
        )}

        {/* --- Wabi --- */}
        <Composition
          id={wabiMeta.id}
          component={wabiMeta.component}
          durationInFrames={wabiMeta.durationInFrames}
          fps={wabiMeta.fps}
          width={wabiMeta.width}
          height={wabiMeta.height}
        />

        {/* --- Ember --- */}
        <Composition
          id={emberMeta.id}
          component={emberMeta.component}
          durationInFrames={emberMeta.durationInFrames}
          fps={emberMeta.fps}
          width={emberMeta.width}
          height={emberMeta.height}
        />
        <Composition
          id={emberSideBySideMeta.id}
          component={emberSideBySideMeta.component}
          durationInFrames={emberSideBySideMeta.durationInFrames}
          fps={emberSideBySideMeta.fps}
          width={emberSideBySideMeta.width}
          height={emberSideBySideMeta.height}
        />

        {/* --- Worldcoin --- */}
        <Composition
          id={worldcoinMeta.id}
          component={worldcoinMeta.component}
          durationInFrames={worldcoinMeta.durationInFrames}
          fps={worldcoinMeta.fps}
          width={worldcoinMeta.width}
          height={worldcoinMeta.height}
        />
        <Composition
          id={worldcoinSideBySideMeta.id}
          component={worldcoinSideBySideMeta.component}
          durationInFrames={worldcoinSideBySideMeta.durationInFrames}
          fps={worldcoinSideBySideMeta.fps}
          width={worldcoinSideBySideMeta.width}
          height={worldcoinSideBySideMeta.height}
        />
        <Composition
          id={worldcoin2Meta.id}
          component={worldcoin2Meta.component}
          durationInFrames={worldcoin2Meta.durationInFrames}
          fps={worldcoin2Meta.fps}
          width={worldcoin2Meta.width}
          height={worldcoin2Meta.height}
        />
        <Composition
          id={worldcoin2OverLofiMeta.id}
          component={worldcoin2OverLofiMeta.component}
          durationInFrames={worldcoin2OverLofiMeta.durationInFrames}
          fps={worldcoin2OverLofiMeta.fps}
          width={worldcoin2OverLofiMeta.width}
          height={worldcoin2OverLofiMeta.height}
        />
        <Composition
          id={rainbowsCompareIntroMeta.id}
          component={rainbowsCompareIntroMeta.component}
          durationInFrames={rainbowsCompareIntroMeta.durationInFrames}
          fps={rainbowsCompareIntroMeta.fps}
          width={rainbowsCompareIntroMeta.width}
          height={rainbowsCompareIntroMeta.height}
        />
        <Composition
          id={phoneBrollDemoMeta.id}
          component={phoneBrollDemoMeta.component}
          durationInFrames={phoneBrollDemoMeta.durationInFrames}
          fps={phoneBrollDemoMeta.fps}
          width={phoneBrollDemoMeta.width}
          height={phoneBrollDemoMeta.height}
        />
        <Composition
          id={laptopBrollDemoMeta.id}
          component={laptopBrollDemoMeta.component}
          durationInFrames={laptopBrollDemoMeta.durationInFrames}
          fps={laptopBrollDemoMeta.fps}
          width={laptopBrollDemoMeta.width}
          height={laptopBrollDemoMeta.height}
        />

        {/* --- Ridd --- */}
        <Composition
          id={riddMeta.id}
          component={riddMeta.component}
          durationInFrames={riddMeta.durationInFrames}
          fps={riddMeta.fps}
          width={riddMeta.width}
          height={riddMeta.height}
        />
        <Composition
          id={riddSideBySideMeta.id}
          component={riddSideBySideMeta.component}
          durationInFrames={riddSideBySideMeta.durationInFrames}
          fps={riddSideBySideMeta.fps}
          width={riddSideBySideMeta.width}
          height={riddSideBySideMeta.height}
        />

        {/* --- Kalshi --- */}
        <Composition
          id={kalshiMeta.id}
          component={kalshiMeta.component}
          durationInFrames={kalshiMeta.durationInFrames}
          fps={kalshiMeta.fps}
          width={kalshiMeta.width}
          height={kalshiMeta.height}
        />
        <Composition
          id={kalshiSideBySideMeta.id}
          component={kalshiSideBySideMeta.component}
          durationInFrames={kalshiSideBySideMeta.durationInFrames}
          fps={kalshiSideBySideMeta.fps}
          width={kalshiSideBySideMeta.width}
          height={kalshiSideBySideMeta.height}
        />

        {/* --- Flashblocks --- */}
        <Composition
          id={flashblocksMeta.id}
          component={flashblocksMeta.component}
          durationInFrames={flashblocksMeta.durationInFrames}
          fps={flashblocksMeta.fps}
          width={flashblocksMeta.width}
          height={flashblocksMeta.height}
        />
        <Composition
          id={flashblocksSideBySideMeta.id}
          component={flashblocksSideBySideMeta.component}
          durationInFrames={flashblocksSideBySideMeta.durationInFrames}
          fps={flashblocksSideBySideMeta.fps}
          width={flashblocksSideBySideMeta.width}
          height={flashblocksSideBySideMeta.height}
        />
        {SHOW_SCENES && (
          <Folder name="Flashblocks-Scenes">
            {[
              ...flashblocksSceneAMetas,
              ...flashblocksSceneBMetas,
              ...flashblocksSceneCMetas,
            ].map((meta) => (
              <Composition
                key={meta.id}
                id={meta.id}
                component={meta.component}
                durationInFrames={meta.durationInFrames}
                fps={flashblocksMeta.fps}
                width={flashblocksMeta.width}
                height={flashblocksMeta.height}
              />
            ))}
          </Folder>
        )}

        {/* --- Virtuals V2 --- */}
        <Composition
          id={virtualsReplicateV2Meta.id}
          component={virtualsReplicateV2Meta.component}
          durationInFrames={virtualsReplicateV2Meta.durationInFrames}
          fps={virtualsReplicateV2Meta.fps}
          width={virtualsReplicateV2Meta.width}
          height={virtualsReplicateV2Meta.height}
        />
        <Composition
          id={virtualsSideBySideV2Meta.id}
          component={virtualsSideBySideV2Meta.component}
          durationInFrames={virtualsSideBySideV2Meta.durationInFrames}
          fps={virtualsSideBySideV2Meta.fps}
          width={virtualsSideBySideV2Meta.width}
          height={virtualsSideBySideV2Meta.height}
        />

        {/* --- Virtuals Council --- */}
        <Composition
          id={councilReplicateMeta.id}
          component={councilReplicateMeta.component}
          durationInFrames={councilReplicateMeta.durationInFrames}
          fps={councilReplicateMeta.fps}
          width={councilReplicateMeta.width}
          height={councilReplicateMeta.height}
        />
        <Composition
          id={councilSideBySideMeta.id}
          component={councilSideBySideMeta.component}
          durationInFrames={councilSideBySideMeta.durationInFrames}
          fps={councilSideBySideMeta.fps}
          width={councilSideBySideMeta.width}
          height={councilSideBySideMeta.height}
        />
        {SHOW_SCENES && (
          <Folder name="Council-Scenes">
            {councilSceneMetas.map((meta) => (
              <Composition
                key={meta.id}
                id={meta.id}
                component={meta.component}
                durationInFrames={meta.durationInFrames}
                fps={meta.fps}
                width={meta.width}
                height={meta.height}
              />
            ))}
          </Folder>
        )}

        {/* --- Original Replicate --- */}
        <Composition
          id={replicateMeta.id}
          component={replicateMeta.component}
          durationInFrames={replicateMeta.durationInFrames}
          fps={replicateMeta.fps}
          width={replicateMeta.width}
          height={replicateMeta.height}
        />
        {SHOW_SCENES && (
          <Folder name="Replicate-Scenes">
            {sceneMetas.map((meta) => (
              <Composition
                key={meta.id}
                id={meta.id}
                component={meta.component}
                durationInFrames={meta.durationInFrames}
                fps={meta.fps}
                width={meta.width}
                height={meta.height}
              />
            ))}
          </Folder>
        )}

        {/* --- Ordinary Folk --- */}
        <Composition
          id={ofReplicateMeta.id}
          component={ofReplicateMeta.component}
          durationInFrames={ofReplicateMeta.durationInFrames}
          fps={ofReplicateMeta.fps}
          width={ofReplicateMeta.width}
          height={ofReplicateMeta.height}
        />
        {SHOW_SCENES && (
          <Folder name="OF-Scenes">
            {ofSceneMetas.map((meta) => (
              <Composition
                key={meta.id}
                id={meta.id}
                component={meta.component}
                durationInFrames={meta.durationInFrames}
                fps={meta.fps}
                width={meta.width}
                height={meta.height}
              />
            ))}
          </Folder>
        )}

        {/* --- Whop --- */}
        <Composition
          id={whopReplicateMeta.id}
          component={whopReplicateMeta.component}
          durationInFrames={whopReplicateMeta.durationInFrames}
          fps={whopReplicateMeta.fps}
          width={whopReplicateMeta.width}
          height={whopReplicateMeta.height}
        />
        {SHOW_SCENES && (
          <Folder name="Whop-Scenes">
            {whopSceneMetas.map((meta) => (
              <Composition
                key={meta.id}
                id={meta.id}
                component={meta.component}
                durationInFrames={meta.durationInFrames}
                fps={meta.fps}
                width={meta.width}
                height={meta.height}
              />
            ))}
          </Folder>
        )}
      </Folder>

      {/* ═══ OTHER ═══ */}
      <Folder name="Other">
        <Composition
          id="Launch30"
          component={Launch30}
          durationInFrames={LAUNCH_DURATION}
          fps={LAUNCH_FPS}
          width={1920}
          height={1080}
        />
        <Composition
          id="OgCardGM"
          component={OgCardGM}
          durationInFrames={1}
          fps={30}
          width={1200}
          height={630}
        />
        <Composition
          id="OgBannerGM"
          component={OgBannerGM}
          durationInFrames={1}
          fps={30}
          width={1500}
          height={500}
        />
        <Composition
          id="OgBannerNS"
          component={OgBannerNS}
          durationInFrames={1}
          fps={30}
          width={1500}
          height={500}
        />
        <Composition
          id={insiderCasesMeta.id}
          component={insiderCasesMeta.component}
          durationInFrames={insiderCasesMeta.durationInFrames}
          fps={insiderCasesMeta.fps}
          width={insiderCasesMeta.width}
          height={insiderCasesMeta.height}
        />
        <Composition
          id="EndCard"
          component={EndCard}
          durationInFrames={ENDCARD_DURATION}
          fps={ENDCARD_FPS}
          width={1920}
          height={1080}
        />
        <Composition
          id="Sequence02"
          component={Sequence02}
          durationInFrames={SEQ02_DURATION}
          fps={SEQ02_FPS}
          width={SEQ02_W}
          height={SEQ02_H}
        />
        <Composition
          id="Tutorial"
          component={TutorialVideo}
          durationInFrames={TUTORIAL_DURATION}
          fps={TUTORIAL_FPS}
          width={1920}
          height={1080}
        />
        <Composition
          id={webglPicksMeta.id}
          component={webglPicksMeta.component}
          durationInFrames={webglPicksMeta.durationInFrames}
          fps={webglPicksMeta.fps}
          width={webglPicksMeta.width}
          height={webglPicksMeta.height}
        />
        {SHOW_SCENES && (
          <Folder name="WebGL-Picks">
            {webglSceneMetas.map((meta) => (
              <Composition
                key={meta.id}
                id={meta.id}
                component={meta.component}
                durationInFrames={meta.durationInFrames}
                fps={meta.fps}
                width={meta.width}
                height={meta.height}
              />
            ))}
          </Folder>
        )}
        <Composition
          id={gmBrandMeta.id}
          component={gmBrandMeta.component}
          durationInFrames={gmBrandMeta.durationInFrames}
          fps={gmBrandMeta.fps}
          width={gmBrandMeta.width}
          height={gmBrandMeta.height}
        />
        {SHOW_SCENES && (
          <Folder name="GM-Scenes">
            {gmSceneMetas.map((meta) => (
              <Composition
                key={meta.id}
                id={meta.id}
                component={meta.component}
                durationInFrames={meta.durationInFrames}
                fps={meta.fps}
                width={meta.width}
                height={meta.height}
              />
            ))}
          </Folder>
        )}
        <Composition
          id={visionVCMeta.id}
          component={visionVCMeta.component}
          durationInFrames={visionVCMeta.durationInFrames}
          fps={visionVCMeta.fps}
          width={visionVCMeta.width}
          height={visionVCMeta.height}
        />
        <Composition
          id={visionVC2Meta.id}
          component={visionVC2Meta.component}
          durationInFrames={visionVC2Meta.durationInFrames}
          fps={visionVC2Meta.fps}
          width={visionVC2Meta.width}
          height={visionVC2Meta.height}
        />
        <Composition
          id={visionVC3Meta.id}
          component={visionVC3Meta.component}
          durationInFrames={visionVC3Meta.durationInFrames}
          fps={visionVC3Meta.fps}
          width={visionVC3Meta.width}
          height={visionVC3Meta.height}
        />
        <Composition
          id={short01Meta.id}
          component={short01Meta.component}
          durationInFrames={short01Meta.durationInFrames}
          fps={short01Meta.fps}
          width={short01Meta.width}
          height={short01Meta.height}
        />
        <Composition
          id={short02Meta.id}
          component={short02Meta.component}
          durationInFrames={short02Meta.durationInFrames}
          fps={short02Meta.fps}
          width={short02Meta.width}
          height={short02Meta.height}
          defaultProps={{ quality: "draft" as const }}
        />
        <Composition
          id={short03Meta.id}
          component={short03Meta.component}
          durationInFrames={short03Meta.durationInFrames}
          fps={short03Meta.fps}
          width={short03Meta.width}
          height={short03Meta.height}
        />
        <Composition
          id={short04Meta.id}
          component={short04Meta.component}
          durationInFrames={short04Meta.durationInFrames}
          fps={short04Meta.fps}
          width={short04Meta.width}
          height={short04Meta.height}
        />
        <Composition
          id="EmojiGravity"
          component={ParticleEmojiGravity}
          durationInFrames={220}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id={visionVsMeta.id}
          component={visionVsMeta.component}
          durationInFrames={visionVsMeta.durationInFrames}
          fps={visionVsMeta.fps}
          width={visionVsMeta.width}
          height={visionVsMeta.height}
        />
      </Folder>

      {/* Per-short compositions */}
      {shorts.length > 0 && (
        <Folder name="Shorts">
          {shorts.map((config) => (
            <Composition
              key={config.id}
              id={config.id}
              component={() => <ChibiExplainer config={config} />}
              durationInFrames={1800}
              fps={config.fps}
              width={config.width}
              height={config.height}
              defaultProps={{ config }}
              calculateMetadata={async () => {
                try {
                  const resp = await fetch(staticFile(config.captionsPath));
                  if (resp.ok) {
                    const captions = await resp.json();
                    const lastCaption = captions[captions.length - 1];
                    if (lastCaption?.endMs) {
                      const durationFrames =
                        Math.ceil((lastCaption.endMs / 1000) * config.fps) + 60;
                      return { durationInFrames: durationFrames };
                    }
                  }
                } catch {
                  // fallback
                }
                return { durationInFrames: 1800 };
              }}
            />
          ))}
        </Folder>
      )}
    </>
  );
};
