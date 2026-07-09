// ClsDay-Replicate — 1:1 rebuild of public/cls-day-original.mp4.
// DOM/SVG only; every value from data.ts (measured). 1920×1080 @25fps, 3750f.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, CLS_PACK, Pack } from "./data";
import {
  S1Intro,
  WipeIn,
  S2Currencies,
  S3Globe,
  S4Trade,
  S5Skyline,
  S6Schedule,
  S7Netting,
} from "./scenes1";
import {
  S8Revised,
  S9ZoomTimes,
  S10Settle,
  S11DocsRow,
  S12Checks,
  S13Pvp,
  S14Target,
  S15Brackets,
  S16Payouts,
  S17Summary,
  S18Outro,
  S19EndCard,
} from "./scenes2";

export const ClsDayScenes: React.FC<{
  pack: Pack;
  BrandLogo?: React.FC<{ markP: number; lettersP: number }>;
  PillLogo?: React.FC<{ h: number }>;
}> = ({ pack, BrandLogo, PillLogo }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.white }}>
      {/* order: later scenes paint over earlier during transitions */}
      <S1Intro frame={frame} pack={pack} BrandLogo={BrandLogo} />
      <WipeIn frame={frame} />
      <S2Currencies frame={frame} pack={pack} />
      <S3Globe frame={frame} />
      <S4Trade frame={frame} pack={pack} PillLogo={PillLogo} />
      <S5Skyline frame={frame} />
      <S6Schedule frame={frame} pack={pack} />
      <S7Netting frame={frame} pack={pack} />
      <S8Revised frame={frame} pack={pack} />
      <S9ZoomTimes frame={frame} pack={pack} />
      <S10Settle frame={frame} pack={pack} PillLogo={PillLogo} />
      <S11DocsRow frame={frame} />
      <S12Checks frame={frame} />
      <S13Pvp frame={frame} />
      <S14Target frame={frame} pack={pack} />
      <S15Brackets frame={frame} pack={pack} />
      <S16Payouts frame={frame} pack={pack} />
      <S17Summary frame={frame} pack={pack} PillLogo={PillLogo} />
      <S18Outro frame={frame} />
      <S19EndCard frame={frame} pack={pack} BrandLogo={BrandLogo} />
    </AbsoluteFill>
  );
};

export const ClsDayReplicate: React.FC = () => <ClsDayScenes pack={CLS_PACK} />;
