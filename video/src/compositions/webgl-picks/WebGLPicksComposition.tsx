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

const SCENE_DURATION = 300; // 10s at 30fps
const FPS = 30;
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
];

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

export const webglSceneMetas = ALL_SCENES.map((scene) => ({
  id: scene.id,
  component: scene.component,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: SCENE_DURATION,
}));
