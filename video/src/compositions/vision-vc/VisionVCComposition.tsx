/**
 * VisionVCComposition — PH Launch Video (36.5s, 16:9)
 *
 * Structure:
 *   1. OPENING — "583,551 things... What if they did?" (2s)
 *   2. STORY CARD — "We wanted to bet on our train." (2s) [Fix 6]
 *   3. DATA MONTAGE — 5 sources, alternating overlay/card (9s)
 *   4. TRACTION CARD — "180,000 markets live." (1.5s) [Fix 2]
 *   5. BENEFIT SCENES — 3 graphical arguments (12.5s)
 *      01 BREADTH — bar chart, every broker (4.2s)
 *      02 VOLUME — double punch, calendar grid (4.3s)
 *      03 PRIVACY — alpha decay counter (4s)
 *   6. COUNT-UP — "583,551 of them" (1.3s)
 *   7. CLOSING — pricing → count → identity + urgency (6.2s) [Fix 7]
 */
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";

import { ExclusiveCard } from "./cards/ExclusiveCard";
import { FourHundredKCard } from "./cards/FourHundredKCard";
import { StoryCard } from "./cards/StoryCard";

import { BenefitDarkPool } from "./benefits/BenefitDarkPool";
import { BenefitVolume } from "./benefits/BenefitVolume";
import { BenefitPrivacy } from "./benefits/BenefitPrivacy";

import { SmashCut } from "./transitions/SmashCut";
import { Transition } from "./transitions/Transition";
import { Squeeze } from "./transitions/Squeeze";
import { SlideIn } from "./transitions/SlideIn";

import { MarketCounter } from "./overlays/MarketCounter";
import { BrollAnnotation } from "./overlays/BrollAnnotation";
import { BrollTextOverlay } from "./overlays/BrollTextOverlay";
import { TickerTape } from "./overlays/TickerTape";

import { AmbientSounds } from "./audio/AmbientSounds";
import { MusicTrack } from "./audio/MusicTrack";

import { BackgroundLayer } from "./device/BackgroundLayer";
import { AngledDevice } from "./device/AngledDevice";

import { OpeningSequence } from "./sections/OpeningSequence";
import { ClosingSection } from "./sections/ClosingSection";
import { MosaicDezoom } from "./sections/MosaicDezoom";

import { GlowingStroke } from "./cards/GlowingStroke";

import { COLOR } from "./tokens";

const FPS = 30;
const OPENING_DUR = 60;
const DURATION_FRAMES = 1095;

const O = OPENING_DUR;

const S = {
  opening:         { from: 0,         dur: O },

  // Fix 6: Story card before montage
  storyCard:       { from: O + 0,     dur: 60  },

  // DATA MONTAGE (5 sources — ALL text on b-roll, no white cards)
  dbScene:         { from: O + 60,    dur: 75  },
  mcdScene:        { from: O + 135,   dur: 70  },
  steamScene:      { from: O + 205,   dur: 65  },
  pumpScene:       { from: O + 270,   dur: 60  },
  solarScene:      { from: O + 330,   dur: 55  },

  // Fix 2: Traction card
  tractionCard:    { from: O + 385,   dur: 45  },

  // BENEFIT SCENES (slow, graphical, labeled)
  benefitBreadth:  { from: O + 430,   dur: 125 },
  benefitVolume:   { from: O + 555,   dur: 130 },
  benefitPrivacy:  { from: O + 685,   dur: 120 },

  // CLOSING
  pause:           { from: O + 805,   dur: 3   },
  fourHundredK:    { from: O + 808,   dur: 40  },
  closing:         { from: O + 848,   dur: 187 },
} as const;

const BROLL = {
  db: "compositions/vision-vc/broll/db-video.mp4",
  mcd: "compositions/vision-vc/broll/mcdonalds-video.mp4",
  steam: "compositions/vision-vc/broll/steam-video.mp4",
  pump: "compositions/vision-vc/broll/pumpfun-video.mp4",
  solar: "compositions/vision-vc/broll/solar-video.mp4",
} as const;

const COUNTER_KEYFRAMES = [
  { frame: O + 60,   value: 0 },
  { frame: O + 135,  value: 847 },
  { frame: O + 205,  value: 14291 },
  { frame: O + 270,  value: 23508 },
  { frame: O + 330,  value: 95500 },
  { frame: O + 385,  value: 180000 },
  { frame: O + 430,  value: 180000 },
  { frame: O + 805,  value: 180000 },
  { frame: O + 828,  value: 583551 },
  { frame: O + 848,  value: 583551 },
  { frame: DURATION_FRAMES - 15, value: 583551 },
  { frame: DURATION_FRAMES, value: 583553 },
];

export const VisionVCComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.page }}>
      {/* ═══ OPENING ═══ */}
      <Sequence from={S.opening.from} durationInFrames={S.opening.dur}>
        <OpeningSequence />
      </Sequence>

      {/* ═══ STORY CARD — Fix 6 ═══ */}
      <Sequence from={S.storyCard.from} durationInFrames={S.storyCard.dur}>
        <StoryCard />
      </Sequence>

      {/* ═══ DATA MONTAGE — 3D angled device presentation ═══ */}

      {/* Entire montage wrapped in AngledDevice for spatial 3D rotation */}
      <Sequence from={S.dbScene.from} durationInFrames={S.solarScene.from + S.solarScene.dur - S.dbScene.from}>
        <AngledDevice
          perspective={2000}
          cycleDuration={S.solarScene.from + S.solarScene.dur - S.dbScene.from}
          keyframes={{
            0:   { z: 40, rotateY: -2.5, rotateX: 1.5, rotate: -0.8 },
            80:  { z: 0,  rotateY: 0,    rotateX: 0,   rotate: 0 },
            160: { z: 30, rotateY: 2,    rotateX: 1,   rotate: 0.6 },
            240: { z: 0,  rotateY: 0,    rotateX: 0,   rotate: 0 },
          }}
        >
          {/* DB: text on b-roll */}
          <Sequence from={0} durationInFrames={S.dbScene.dur}>
            <BackgroundLayer src={BROLL.db} brightness={0.90} blur={0} tint="rgba(0,0,0,0.05)" zoom="in" />
            <BrollAnnotation label="DEUTSCHE BAHN" metric="847 delay markets" tag="TRANSPORT" />
            <AmbientSounds scene="db" volume={0.08} />
            <Sequence from={28} durationInFrames={47}>
              <BrollTextOverlay text="What if train delays had a price?" subtitle="847 live markets — $0.10 each" />
            </Sequence>
          </Sequence>

          {/* McD: text on b-roll */}
          <Sequence from={S.mcdScene.from - S.dbScene.from} durationInFrames={S.mcdScene.dur}>
            <BackgroundLayer src={BROLL.mcd} brightness={0.90} blur={0} tint="rgba(0,0,0,0.05)" zoom="in" />
            <BrollAnnotation label="MCDONALD'S" metric="14,291 outage markets" tag="CONSUMER" />
            <AmbientSounds scene="mcdonalds" volume={0.06} />
            <Sequence from={25} durationInFrames={45}>
              <BrollTextOverlay text="What if McFlurry outages moved a market?" subtitle="14,291 markets across 38 countries" />
            </Sequence>
          </Sequence>

          {/* Steam: text on b-roll */}
          <Sequence from={S.steamScene.from - S.dbScene.from} durationInFrames={S.steamScene.dur}>
            <BackgroundLayer src={BROLL.steam} brightness={0.90} blur={0} tint="rgba(0,0,0,0.05)" zoom="out" />
            <BrollAnnotation label="STEAM" metric="23,508 player count markets" tag="GAMING" />
            <AmbientSounds scene="steam" volume={0.06} />
            <Sequence from={22} durationInFrames={43}>
              <BrollTextOverlay text="What if player counts were tradeable?" subtitle="23,508 markets — settles every 10 min" />
            </Sequence>
          </Sequence>

          {/* PumpFun: text on b-roll */}
          <Sequence from={S.pumpScene.from - S.dbScene.from} durationInFrames={S.pumpScene.dur}>
            <BackgroundLayer src={BROLL.pump} brightness={0.90} blur={0} tint="rgba(0,0,0,0.05)" zoom="out" />
            <BrollAnnotation label="PUMP.FUN" metric="95,500 rug markets" tag="CRYPTO" />
            <AmbientSounds scene="pumpfun" volume={0.06} />
            <Sequence from={20} durationInFrames={40}>
              <BrollTextOverlay text="What if you could short a rug pull?" subtitle="95,500 markets — active liquidity" />
            </Sequence>
          </Sequence>

          {/* Solar: text on b-roll */}
          <Sequence from={S.solarScene.from - S.dbScene.from} durationInFrames={S.solarScene.dur}>
            <BackgroundLayer src={BROLL.solar} brightness={0.90} blur={0} tint="rgba(0,0,0,0.05)" zoom="out" />
            <BrollAnnotation label="SOLAR OBSERVATORY" metric="180,000 flare markets" tag="SPACE" />
            <AmbientSounds scene="solar" volume={0.06} />
            <Sequence from={18} durationInFrames={37}>
              <BrollTextOverlay text="What if solar flares paid out?" subtitle="180,000 markets — and growing" />
            </Sequence>
          </Sequence>
        </AngledDevice>
      </Sequence>

      {/* ═══ TRACTION CARD — slide-in with glowing border ═══ */}
      <Sequence from={S.tractionCard.from} durationInFrames={S.tractionCard.dur}>
        <Transition type="in">
          <ExclusiveCard
            label="180,000 markets live. 5 data sources."
            subtitle="Built in 4 months. Growing daily."
            fontWeight={800}
            montageProgress={1.0}
          />
          <GlowingStroke
            width={1920}
            height={1080}
            radius={0}
            color1="#6366f1"
            color2="#8b5cf6"
            offset={0}
          />
        </Transition>
      </Sequence>

      {/* ═══ BENEFIT SCENES — slide-in transitions ═══ */}

      {/* 01 — BREADTH: bar chart */}
      <Sequence from={S.benefitBreadth.from} durationInFrames={S.benefitBreadth.dur}>
        <SlideIn>
          <BenefitDarkPool durationInFrames={S.benefitBreadth.dur} />
        </SlideIn>
      </Sequence>

      {/* 02 — VOLUME: double punch */}
      <Sequence from={S.benefitVolume.from} durationInFrames={S.benefitVolume.dur}>
        <SlideIn>
          <BenefitVolume durationInFrames={S.benefitVolume.dur} />
        </SlideIn>
      </Sequence>

      {/* 03 — PRIVACY: alpha decay */}
      <Sequence from={S.benefitPrivacy.from} durationInFrames={S.benefitPrivacy.dur}>
        <SlideIn>
          <BenefitPrivacy durationInFrames={S.benefitPrivacy.dur} />
        </SlideIn>
      </Sequence>

      {/* ═══ COUNT-UP + CLOSING ═══ */}
      <Sequence from={S.pause.from} durationInFrames={S.pause.dur}>
        <AbsoluteFill style={{ backgroundColor: COLOR.page }} />
      </Sequence>

      <Sequence from={S.fourHundredK.from} durationInFrames={S.fourHundredK.dur + S.closing.dur}>
        <MosaicDezoom />
      </Sequence>

      <Sequence from={S.fourHundredK.from} durationInFrames={S.fourHundredK.dur}>
        <SmashCut intensity={0.08} />
        <Squeeze delay={0} direction="vertical">
          <Transition type="in">
            <FourHundredKCard />
            <GlowingStroke
              width={1920}
              height={1080}
              radius={0}
              color1="#f59e0b"
              color2="#ef4444"
              offset={5}
            />
          </Transition>
        </Squeeze>
      </Sequence>

      <Sequence from={S.closing.from} durationInFrames={S.closing.dur}>
        <Transition type="in">
          <ClosingSection />
        </Transition>
      </Sequence>

      {/* ═══ PERSISTENT OVERLAYS ═══ */}

      {/* Ticker tape — montage only */}
      <Sequence from={S.dbScene.from} durationInFrames={S.solarScene.from + S.solarScene.dur - S.dbScene.from}>
        <TickerTape position="top" speed={2} opacity={0.3} />
      </Sequence>

      {/* Market counter */}
      <MarketCounter
        keyframes={COUNTER_KEYFRAMES}
        showFrom={S.dbScene.from + 30}
        fadeOutFrom={S.benefitBreadth.from}
      />

      {/* Background music */}
      <MusicTrack />
    </AbsoluteFill>
  );
};

export const visionVCMeta = {
  id: "VisionVC",
  component: VisionVCComposition,
  durationInFrames: DURATION_FRAMES,
  fps: FPS as 30,
  width: 1920 as 1920,
  height: 1080 as 1080,
};
