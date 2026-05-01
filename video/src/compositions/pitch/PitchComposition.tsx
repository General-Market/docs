import React from "react";
import { Series } from "remotion";
import { FPS, W, H, SLIDE_FRAMES } from "./tokens";
import { Slide01Title } from "./slides/Slide01Title";
import { Slide02Problem } from "./slides/Slide02Problem";
import { Slide03Insight } from "./slides/Slide03Insight";
import { Slide04WhyNow } from "./slides/Slide04WhyNow";
import { Slide05Market } from "./slides/Slide05Market";
import { SlideExitComps } from "./slides/SlideExitComps";
import { Slide06Distribution } from "./slides/Slide06Distribution";
import { Slide07Competition } from "./slides/Slide07Competition";
import { Slide08Product } from "./slides/Slide08Product";
import { SlideTraction } from "./slides/SlideTraction";
import { Slide09Business } from "./slides/Slide09Business";
import { SlideRoadmap } from "./slides/SlideRoadmap";
import { Slide10Team } from "./slides/Slide10Team";
import { Slide11Ask } from "./slides/Slide11Ask";

type SlideEntry = { id: string; component: React.FC; frames?: number };

const SLIDES: SlideEntry[] = [
  { id: "01-Title", component: Slide01Title },
  { id: "02-Problem", component: Slide02Problem },
  { id: "03-Insight", component: Slide03Insight },
  { id: "04-WhyNow", component: Slide04WhyNow },
  { id: "05-Market", component: Slide05Market, frames: 90 },
  { id: "06-ExitComps", component: SlideExitComps },
  { id: "07-Distribution", component: Slide06Distribution },
  { id: "08-Competition", component: Slide07Competition },
  { id: "09-Product", component: Slide08Product },
  { id: "10-Traction", component: SlideTraction },
  { id: "11-Business", component: Slide09Business },
  { id: "12-Roadmap", component: SlideRoadmap },
  { id: "13-Team", component: Slide10Team },
  { id: "14-Ask", component: Slide11Ask },
];

const slideFrames = (s: SlideEntry) => s.frames ?? SLIDE_FRAMES;

export const PitchComposition: React.FC = () => {
  return (
    <Series>
      {SLIDES.map((slide) => (
        <Series.Sequence
          key={slide.id}
          durationInFrames={slideFrames(slide)}
          name={slide.id}
        >
          <slide.component />
        </Series.Sequence>
      ))}
    </Series>
  );
};

export const pitchMeta = {
  id: "Pitch",
  component: PitchComposition,
  durationInFrames: SLIDES.reduce((sum, s) => sum + slideFrames(s), 0),
  fps: FPS,
  width: W,
  height: H,
};

export const pitchSceneMetas = SLIDES.map((slide) => ({
  id: `Pitch-${slide.id}`,
  component: slide.component,
  durationInFrames: slideFrames(slide),
  fps: FPS,
  width: W,
  height: H,
}));
