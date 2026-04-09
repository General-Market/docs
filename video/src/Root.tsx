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
import { replicateMeta, sceneMetas } from "./compositions/replicates/original/ReplicateComposition";
import { ofReplicateMeta, ofSceneMetas } from "./compositions/replicates/ordinaryfolk/OFReplicateComposition";
import { whopReplicateMeta, whopSceneMetas } from "./compositions/replicates/whop/WhopReplicateComposition";
import { gmBrandMeta, gmSceneMetas } from "./compositions/gm/brand/GMBrandComposition";
import { solanaBgMeta } from "./compositions/backgrounds/solana/SolanaBgComposition";
import { webglPicksMeta, webglSceneMetas } from "./compositions/backgrounds/webgl-picks/WebGLPicksComposition";
import { gmLaunchBgMeta, gmLaunchSceneMetas } from "./compositions/gm/launch-bg/GMLaunchBgComposition";
import { gmLogo3dMeta, gmLogoSceneMetas } from "./compositions/gm/logo-3d/GMLogo3D";
import { visionVsMeta } from "./compositions/vision/vs/VisionVsComposition";
import { gmQuantsMeta } from "./compositions/vision/vs/GMQuantsComposition";
import { kalshiMeta } from "./compositions/replicates/kalshi/KalshiComposition";
import { kalshiSideBySideMeta } from "./compositions/replicates/kalshi/KalshiSideBySide";
import { flashblocksMeta } from "./compositions/replicates/standrew/FlashblocksComposition";
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
import { GeneralMarket } from "./compositions/general-market/GeneralMarket";
import { TOTAL_DURATION as GENERAL_MARKET_DURATION } from "./compositions/general-market/theme";
import { TutorialVideo } from "./compositions/tutorial/TutorialVideo";
import { TOTAL_FRAMES as TUTORIAL_DURATION, FPS as TUTORIAL_FPS } from "./compositions/tutorial/theme";

// Per-scene compositions are hidden from the studio sidebar by default.
// Set REMOTION_SHOW_SCENES=1 in the environment to register them — needed
// only when running parallel-scene autoresearch renders by composition id.
const SHOW_SCENES = process.env.REMOTION_SHOW_SCENES === "1";

// remotion-scenes showcases
import {
  BackgroundShowcase,
  BACKGROUND_SHOWCASE_DURATION,
} from "./scenes/BackgroundAnimations";
import {
  CinematicShowcase,
  CINEMATIC_SHOWCASE_DURATION,
} from "./scenes/CinematicAnimations";
import { DemoShowcase, DEMO_SHOWCASE_DURATION } from "./scenes/DemoAnimations";
import {
  EffectShowcase,
  EFFECT_SHOWCASE_DURATION,
} from "./scenes/EffectAnimations";
import {
  LayoutShowcase,
  LAYOUT_SHOWCASE_DURATION,
} from "./scenes/LayoutAnimations";
import { ListShowcase, LIST_SHOWCASE_DURATION } from "./scenes/ListAnimations";
import { LogoShowcase, LOGO_SHOWCASE_DURATION } from "./scenes/LogoAnimations";
import {
  ParticleShowcase,
  PARTICLE_SHOWCASE_DURATION,
  ParticleEmojiGravity,
} from "./scenes/ParticleAnimations";
import {
  RollerShowcase,
  ROLLER_SHOWCASE_DURATION,
} from "./scenes/RollerAnimations";
import {
  ShapeShowcase,
  SHAPE_SHOWCASE_DURATION,
} from "./scenes/ShapeAnimations";
import { TextShowcase, TEXT_SHOWCASE_DURATION } from "./scenes/TextAnimations";
import {
  ThemeShowcase,
  THEME_SHOWCASE_DURATION,
} from "./scenes/ThemeAnimations";
import {
  TransitionShowcase,
  TRANSITION_SHOWCASE_DURATION,
} from "./scenes/TransitionAnimations";
import { UIShowcase, UI_SHOWCASE_DURATION } from "./scenes/UIAnimations";

const shorts: ShortConfig[] = [];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* ═══ GENERAL MARKET — explainer video ═══ */}
      <Composition
        id="GeneralMarket"
        component={GeneralMarket}
        durationInFrames={GENERAL_MARKET_DURATION}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* ═══ TUTORIAL — overlay composition over talking-head ═══ */}
      <Composition
        id="Tutorial"
        component={TutorialVideo}
        durationInFrames={TUTORIAL_DURATION}
        fps={TUTORIAL_FPS}
        width={1920}
        height={1080}
      />

      {/* ═══ VISION VC — main composition ═══ */}
      <Composition
        id={visionVCMeta.id}
        component={visionVCMeta.component}
        durationInFrames={visionVCMeta.durationInFrames}
        fps={visionVCMeta.fps}
        width={visionVCMeta.width}
        height={visionVCMeta.height}
      />

      {/* ═══ VISION VC2 — "Unless." whiteboard ═══ */}
      <Composition
        id={visionVC2Meta.id}
        component={visionVC2Meta.component}
        durationInFrames={visionVC2Meta.durationInFrames}
        fps={visionVC2Meta.fps}
        width={visionVC2Meta.width}
        height={visionVC2Meta.height}
      />

      {/* ═══ VISION VC3 — Charts (scatter + bar) ═══ */}
      <Composition
        id={visionVC3Meta.id}
        component={visionVC3Meta.component}
        durationInFrames={visionVC3Meta.durationInFrames}
        fps={visionVC3Meta.fps}
        width={visionVC3Meta.width}
        height={visionVC3Meta.height}
      />

      {/* ═══ REPLICATE — autoresearch animation matching ═══ */}
      <Composition
        id={replicateMeta.id}
        component={replicateMeta.component}
        durationInFrames={replicateMeta.durationInFrames}
        fps={replicateMeta.fps}
        width={replicateMeta.width}
        height={replicateMeta.height}
      />
      {/* Per-scene compositions — hidden unless REMOTION_SHOW_SCENES=1 */}
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

      {/* ═══ ORDINARY FOLK — replicate ═══ */}
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

      {/* ═══ GM BRAND — rebranded OF ═══ */}
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

      {/* ═══ SOLANA BG — lenticular prismatic background ═══ */}
      <Composition
        id={solanaBgMeta.id}
        component={solanaBgMeta.component}
        durationInFrames={solanaBgMeta.durationInFrames}
        fps={solanaBgMeta.fps}
        width={solanaBgMeta.width}
        height={solanaBgMeta.height}
      />

      {/* ═══ WHOP — replicate ═══ */}
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

      {/* ═══ WEBGL PICKS — Codrops / shader references ═══ */}
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

      {/* ═══ GM LAUNCH BACKGROUNDS — 5 branded propositions ═══ */}
      <Composition
        id={gmLaunchBgMeta.id}
        component={gmLaunchBgMeta.component}
        durationInFrames={gmLaunchBgMeta.durationInFrames}
        fps={gmLaunchBgMeta.fps}
        width={gmLaunchBgMeta.width}
        height={gmLaunchBgMeta.height}
      />
      {SHOW_SCENES && (
        <Folder name="GMLaunch-Scenes">
          {gmLaunchSceneMetas.map((meta) => (
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

      {/* ═══ GM LOGO 3D — 5 FinTech scene showcase ═══ */}
      <Composition
        id={gmLogo3dMeta.id}
        component={gmLogo3dMeta.component}
        durationInFrames={gmLogo3dMeta.durationInFrames}
        fps={gmLogo3dMeta.fps}
        width={gmLogo3dMeta.width}
        height={gmLogo3dMeta.height}
      />
      {SHOW_SCENES && (
        <Folder name="GMLogo-Scenes">
          {gmLogoSceneMetas.map((meta) => (
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

      {/* ═══ VISION VS — split-screen comparison ═══ */}
      <Composition
        id={visionVsMeta.id}
        component={visionVsMeta.component}
        durationInFrames={visionVsMeta.durationInFrames}
        fps={visionVsMeta.fps}
        width={visionVsMeta.width}
        height={visionVsMeta.height}
      />
      <Composition
        id={gmQuantsMeta.id}
        component={gmQuantsMeta.component}
        durationInFrames={gmQuantsMeta.durationInFrames}
        fps={gmQuantsMeta.fps}
        width={gmQuantsMeta.width}
        height={gmQuantsMeta.height}
      />

      {/* ═══ EMBER — replicate ═══ */}
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

      {/* ═══ KALSHI — replicate ═══ */}
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

      {/* ═══ STANDREW / FLASHBLOCKS — replicate ═══ */}
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

      {/* ═══ VIRTUALS V2 — replicate ═══ */}
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

      {/* ═══ VIRTUALS COUNCIL — replicate ═══ */}
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

      {/* ═══ Other shorts ═══ */}
      <Folder name="Other">
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
      </Folder>

      {/* ═══ Scene Library ═══ */}
      <Folder name="Scenes">
        <Composition
          id="Backgrounds"
          component={BackgroundShowcase}
          durationInFrames={BACKGROUND_SHOWCASE_DURATION}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Cinematic"
          component={CinematicShowcase}
          durationInFrames={CINEMATIC_SHOWCASE_DURATION}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Demos"
          component={DemoShowcase}
          durationInFrames={DEMO_SHOWCASE_DURATION}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Effects"
          component={EffectShowcase}
          durationInFrames={EFFECT_SHOWCASE_DURATION}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Layouts"
          component={LayoutShowcase}
          durationInFrames={LAYOUT_SHOWCASE_DURATION}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Lists"
          component={ListShowcase}
          durationInFrames={LIST_SHOWCASE_DURATION}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Logos"
          component={LogoShowcase}
          durationInFrames={LOGO_SHOWCASE_DURATION}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Particles"
          component={ParticleShowcase}
          durationInFrames={PARTICLE_SHOWCASE_DURATION}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Rollers"
          component={RollerShowcase}
          durationInFrames={ROLLER_SHOWCASE_DURATION}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Shapes"
          component={ShapeShowcase}
          durationInFrames={SHAPE_SHOWCASE_DURATION}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Text"
          component={TextShowcase}
          durationInFrames={TEXT_SHOWCASE_DURATION}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Themes"
          component={ThemeShowcase}
          durationInFrames={THEME_SHOWCASE_DURATION}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Transitions"
          component={TransitionShowcase}
          durationInFrames={TRANSITION_SHOWCASE_DURATION}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="UI"
          component={UIShowcase}
          durationInFrames={UI_SHOWCASE_DURATION}
          fps={30}
          width={1920}
          height={1080}
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
