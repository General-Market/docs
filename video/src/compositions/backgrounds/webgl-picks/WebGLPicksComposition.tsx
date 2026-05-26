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
import { GsapGrid } from "./GsapGrid";
import { MediaTypeRings } from "./MediaTypeRings";
import { InitialsRotate } from "./InitialsRotate";
import { IPhoneWidgets } from "./iPhoneWidgets";
import { UnderwaterDive } from "./UnderwaterDive";
import { DudeWalk } from "./DudeWalk";
import { DashboardReveal } from "./DashboardReveal";
import { BongoCat } from "./BongoCat";
import { FluidMotion } from "./FluidMotion";
import { PsychoPixels } from "./PsychoPixels";
import { KiplingCube } from "./KiplingCube";
import { StarTreck } from "./StarTreck";
import { CloudDrag } from "./CloudDrag";
import { PsychoTitle } from "./PsychoTitle";
import { DivTv } from "./DivTv";
import { GeneralMarketGlitch } from "./GeneralMarketGlitch";
import { DiamondGrid } from "./DiamondGrid";
import { WalkRideLogo } from "./WalkRideLogo";
import { ShimmerButton } from "./ShimmerButton";
import { EmojiCarousel } from "./EmojiCarousel";
import { CityHoverCards } from "./CityHoverCards";
import { TextScramble } from "./TextScramble";
import { OrganicMotion } from "./OrganicMotion";
import { AnimationPrinciples } from "./AnimationPrinciples";
import { RgbGlitch } from "./RgbGlitch";
import { Backlights } from "./Backlights";
import { CrtScreen } from "./CrtScreen";
import { RingCarousel } from "./RingCarousel";
import { TravelDeco } from "./TravelDeco";
import { UmbralFloor } from "./UmbralFloor";
import { ConveyorBuilder } from "./ConveyorBuilder";
import { CommandPath } from "./CommandPath";
import { CommunityHeadline } from "./CommunityHeadline";
import { ImageGridScroll } from "./ImageGridScroll";
import { CheckerBlock } from "./CheckerBlock";
import { BlurLoader } from "./BlurLoader";

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
  { id: "WP-GsapGrid", component: GsapGrid },
  { id: "WP-MediaTypeRings", component: MediaTypeRings },
  { id: "WP-InitialsRotate", component: InitialsRotate },
  { id: "WP-iPhoneWidgets", component: IPhoneWidgets },
  { id: "WP-UnderwaterDive", component: UnderwaterDive },
  { id: "WP-DudeWalk", component: DudeWalk },
  { id: "WP-DashboardReveal", component: DashboardReveal },
  { id: "WP-BongoCat", component: BongoCat },
  { id: "WP-RgbGlitch", component: RgbGlitch },
  { id: "WP-Backlights", component: Backlights },
  { id: "WP-CrtScreen", component: CrtScreen },
  { id: "WP-RingCarousel", component: RingCarousel },
  { id: "WP-TravelDeco", component: TravelDeco },
  { id: "WP-UmbralFloor", component: UmbralFloor },
  { id: "WP-ConveyorBuilder", component: ConveyorBuilder },
  { id: "WP-CommandPath", component: CommandPath },
  { id: "WP-CommunityHeadline", component: CommunityHeadline },
  { id: "WP-ImageGridScroll", component: ImageGridScroll },
  { id: "WP-CheckerBlock", component: CheckerBlock },
  { id: "WP-BlurLoader", component: BlurLoader },
  // reelOnly: appears in the WebGLPicks reel but does not get its own
  // top-level composition URL.
  { id: "WP-PremierLeague", component: PremierLeague, reelOnly: true },
  { id: "WP-FluidMotion", component: FluidMotion, reelOnly: true },
  { id: "WP-PsychoPixels", component: PsychoPixels, reelOnly: true },
  { id: "WP-KiplingCube", component: KiplingCube, reelOnly: true },
  { id: "WP-StarTreck", component: StarTreck, reelOnly: true },
  { id: "WP-CloudDrag", component: CloudDrag, reelOnly: true },
  { id: "WP-PsychoTitle", component: PsychoTitle, reelOnly: true },
  { id: "WP-DivTv", component: DivTv, reelOnly: true },
  { id: "WP-GeneralMarketGlitch", component: GeneralMarketGlitch, reelOnly: true },
  { id: "WP-DiamondGrid", component: DiamondGrid, reelOnly: true },
  { id: "WP-WalkRideLogo", component: WalkRideLogo, reelOnly: true },
  { id: "WP-ShimmerButton", component: ShimmerButton, reelOnly: true },
  { id: "WP-EmojiCarousel", component: EmojiCarousel, reelOnly: true },
  { id: "WP-CityHoverCards", component: CityHoverCards, reelOnly: true },
  { id: "WP-TextScramble", component: TextScramble, reelOnly: true },
  { id: "WP-OrganicMotion", component: OrganicMotion, reelOnly: true },
  { id: "WP-AnimationPrinciples", component: AnimationPrinciples, reelOnly: true },
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
