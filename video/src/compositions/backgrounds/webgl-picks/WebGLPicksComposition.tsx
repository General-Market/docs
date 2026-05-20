import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { DepthGallery } from "./DepthGallery";
import { GradientCarousel } from "./GradientCarousel";
import { TelescopeZoom } from "./TelescopeZoom";
import { OrganicGradients } from "./OrganicGradients";
import { RunicAlphabet } from "./RunicAlphabet";
import { ShoppingCart } from "./ShoppingCart";
import { GsapSmooth } from "./GsapSmooth";
import { CardCarousel } from "./CardCarousel";
import { DeviceShowcase } from "./DeviceShowcase";
import { GlowingMarquee } from "./GlowingMarquee";
import { ParticleWave } from "./ParticleWave";
import { ScrollReveal } from "./ScrollReveal";
import { GsapStagger } from "./GsapStagger";
import { ScrollSnap } from "./ScrollSnap";
import { MouseLight } from "./MouseLight";
import { MouseTrail } from "./MouseTrail";
import { IdleEffects } from "./IdleEffects";
import { LetterDecorations } from "./LetterDecorations";
import { TextSplit } from "./TextSplit";
import { TextGsap } from "./TextGsap";
import { OpeningSequence } from "./OpeningSequence";
import { TextHighlight } from "./TextHighlight";
import { TextTrail } from "./TextTrail";
import { ParticleButtons } from "./ParticleButtons";
import { Helmet3D } from "./Helmet3D";
import { LenticularBackground } from "../solana/LenticularShader";
import { FlightsTracker } from "./FlightsTracker";
import { OneElementScroll } from "./OneElementScroll";
import { ThreeChallenge } from "./ThreeChallenge";
import { NeonSwitch } from "./NeonSwitch";
import { GooeySearch } from "./GooeySearch";
import { Scene19 } from "./Scene19";
import { RingShader } from "./RingShader";
import { Carousel3D } from "./Carousel3D";
import { SvgMorph } from "./SvgMorph";
import { VortexGallery } from "./VortexGallery";
import { WaveTide } from "./WaveTide";
import { NoiseBloom } from "./NoiseBloom";
import { InkPour } from "./InkPour";
import { FoldingCircleLoop } from "./FoldingCircleLoop";
import { GridRun } from "./GridRun";
import { Invited } from "./Invited";
import { LightSwitch } from "./LightSwitch";
import { RippleLoader } from "./RippleLoader";
import { ClayFlow } from "./ClayFlow";
import { WorldCup2026 } from "./WorldCup2026";
import { LiquidMetalButton } from "./LiquidMetalButton";
import { Projection } from "./Projection";
import { PremierLeague } from "./PremierLeague";

const SCENE_DURATION = 600; // 10s at 60fps
const FPS = 60;
const W = 1920;
const H = 1080;

const ALL_SCENES = [
  { id: "WP-DepthGallery", component: DepthGallery },
  { id: "WP-GradientCarousel", component: GradientCarousel },
  { id: "WP-TelescopeZoom", component: TelescopeZoom },
  { id: "WP-OrganicGradients", component: OrganicGradients },
  { id: "WP-RunicAlphabet", component: RunicAlphabet },
  { id: "WP-CardCarousel", component: CardCarousel },
  { id: "WP-ShoppingCart", component: ShoppingCart },
  { id: "WP-DeviceShowcase", component: DeviceShowcase },
  { id: "WP-GlowingMarquee", component: GlowingMarquee },
  { id: "WP-GsapSmooth", component: GsapSmooth },
  { id: "WP-ParticleWave", component: ParticleWave },
  { id: "WP-ScrollReveal", component: ScrollReveal },
  { id: "WP-GsapStagger", component: GsapStagger },
  { id: "WP-ScrollSnap", component: ScrollSnap },
  { id: "WP-MouseLight", component: MouseLight },
  { id: "WP-MouseTrail", component: MouseTrail },
  { id: "WP-IdleEffects", component: IdleEffects },
  { id: "WP-LetterDecorations", component: LetterDecorations },
  { id: "WP-TextHighlight", component: TextHighlight },
  { id: "WP-TextGsap", component: TextGsap },
  { id: "WP-OpeningSequence", component: OpeningSequence },
  { id: "WP-TextSplit", component: TextSplit },
  { id: "WP-TextTrail", component: TextTrail },
  { id: "WP-ParticleButtons", component: ParticleButtons },
  { id: "WP-Helmet3D", component: Helmet3D },
  { id: "WP-LenticularMetal", component: LenticularBackground },
  { id: "WP-FlightsTracker", component: FlightsTracker },
  { id: "WP-OneElementScroll", component: OneElementScroll },
  { id: "WP-ThreeChallenge", component: ThreeChallenge },
  { id: "WP-NeonSwitch", component: NeonSwitch },
  { id: "WP-GooeySearch", component: GooeySearch },
  { id: "WP-Scene19", component: Scene19 },
  { id: "WP-RingShader", component: RingShader },
  { id: "WP-Carousel3D", component: Carousel3D },
  { id: "WP-SvgMorph", component: SvgMorph },
  { id: "WP-VortexGallery", component: VortexGallery },
  { id: "WP-WaveTide", component: WaveTide },
  { id: "WP-NoiseBloom", component: NoiseBloom },
  { id: "WP-InkPour", component: InkPour },
  { id: "WP-FoldingCircleLoop", component: FoldingCircleLoop },
  { id: "WP-GridRun", component: GridRun },
  { id: "WP-Invited", component: Invited },
  { id: "WP-LightSwitch", component: LightSwitch },
  { id: "WP-RippleLoader", component: RippleLoader },
  { id: "WP-ClayFlow", component: ClayFlow },
  { id: "WP-WorldCup2026", component: WorldCup2026 },
  { id: "WP-LiquidMetalButton", component: LiquidMetalButton },
  { id: "WP-Projection", component: Projection },
  // reelOnly: appears in the WebGLPicks reel but does not get its own
  // top-level composition URL.
  { id: "WP-PremierLeague", component: PremierLeague, reelOnly: true },
] as { id: string; component: React.FC; reelOnly?: boolean }[];

export const WebGLPicksComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {ALL_SCENES.map((scene, i) => (
        <Sequence
          key={scene.id}
          from={SCENE_DURATION * i}
          durationInFrames={SCENE_DURATION}
        >
          <scene.component />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const webglPicksMeta = {
  id: "WebGLPicks",
  component: WebGLPicksComposition,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: SCENE_DURATION * ALL_SCENES.length,
};

export const webglSceneMetas = ALL_SCENES
  .filter((scene) => !scene.reelOnly)
  .map((scene) => ({
    id: scene.id,
    component: scene.component,
    width: W,
    height: H,
    fps: FPS,
    durationInFrames: SCENE_DURATION,
  }));
