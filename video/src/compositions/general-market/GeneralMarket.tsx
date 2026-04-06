import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { THEME, LAYOUT } from './theme';
import { Scene01Liquidity } from './scenes/Scene01Liquidity';
import { Scene02Coins } from './scenes/Scene02Coins';
import { Scene03GridExpands } from './scenes/Scene03GridExpands';
import { Scene04Categories } from './scenes/Scene04Categories';
import { Scene05Settlement } from './scenes/Scene05Settlement';
import { Scene06Formula } from './scenes/Scene06Formula';
import { SceneOutro } from './scenes/SceneOutro';
import { AudioTrack } from './AudioTrack';

export const GeneralMarket: React.FC = () => {
  const b1 = LAYOUT.beat1Duration;
  const b2 = LAYOUT.beat2Duration;
  const b3 = LAYOUT.beat3Duration;
  const b4 = LAYOUT.beat4Duration;
  const b5 = LAYOUT.beat5Duration;
  const b6 = LAYOUT.beat6Duration;
  const outro = LAYOUT.outroDuration;

  const start1 = 0;
  const start2 = start1 + b1;
  const start3 = start2 + b2;
  const start4 = start3 + b3;
  const start5 = start4 + b4;
  const start6 = start5 + b5;
  const startOutro = start6 + b6;

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bgDark }}>
      <Sequence from={start1} durationInFrames={b1}>
        <Scene01Liquidity />
      </Sequence>
      <Sequence from={start2} durationInFrames={b2}>
        <Scene02Coins />
      </Sequence>
      <Sequence from={start3} durationInFrames={b3}>
        <Scene03GridExpands />
      </Sequence>
      <Sequence from={start4} durationInFrames={b4}>
        <Scene04Categories />
      </Sequence>
      <Sequence from={start5} durationInFrames={b5}>
        <Scene05Settlement />
      </Sequence>
      <Sequence from={start6} durationInFrames={b6}>
        <Scene06Formula />
      </Sequence>
      <Sequence from={startOutro} durationInFrames={outro}>
        <SceneOutro />
      </Sequence>
      <AudioTrack />
    </AbsoluteFill>
  );
};
