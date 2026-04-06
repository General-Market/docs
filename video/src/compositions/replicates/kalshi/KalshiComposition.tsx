import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import {
  Scene01_Calendar,
  Scene02_Predicting,
  Scene03_Bracket,
  Scene04_SixRounds,
  Scene05_StatDream,
  Scene06_CoinGrid,
  Scene07_Shapes,
  Scene08_Quintillion,
} from "./ScenesA";
import {
  Scene09_SandDark,
  Scene10_Crosshair,
  Scene11_ThreeIcons,
  Scene12_AccuracyDots,
  Scene13_120Billion,
  Scene14_CalendarGrid,
  Scene15_Timeline2019,
  Scene16_49Games,
} from "./ScenesB";
import {
  Scene17_Chalkboard,
  Scene18_Buffett,
  Scene19_QuestSwoosh,
  Scene20_BillionContest,
  Scene21_FreeEntry,
  Scene22_OddsNotFavor,
  Scene23_OneMillion,
  Scene24_Unpredictable,
  Scene25_KalshiLogo,
} from "./ScenesC";

/*
 * Kalshi "$1B Perfect Bracket" — full 127s recreation
 * Original: 3840x2160, 30fps, ~127s
 * Replica:  1920x1080, 30fps, 3810 frames
 *
 * Scene timeline (seconds → frames at 30fps):
 *   01  Calendar "Every Spring"           0–4s     f0–120
 *   02  Bracket bars "Predicting"         4–8s     f120–240
 *   03  Tournament bracket 63/63          8–12s    f240–360
 *   04  Six Rounds list                   12–16s   f360–480
 *   05  "A statistician's dream"          16–21s   f480–630
 *   06  Coin flip grid                    21–26s   f630–780
 *   07  Nested shapes "To put that"       26–31s   f780–930
 *   08  "about 7.5 Quintillion"           31–36s   f930–1080
 *   09  B&W sand (dark interlude)         36–42s   f1080–1260
 *   10  Crosshair on dark                 42–47s   f1260–1410
 *   11  Three icons                       47–51s   f1410–1530
 *   12  Accuracy dots "63%"               51–56s   f1530–1680
 *   13  "1 in 120 billion"                56–61s   f1680–1830
 *   14  "3,788 years" calendar grid       61–66s   f1830–1980
 *   15  "In 2019" timeline                66–71s   f1980–2130
 *   16  "49 games perfectly"              71–77s   f2130–2310
 *   17  Chalkboard                        77–87s   f2310–2610
 *   18  Buffett drawing                   87–92s   f2610–2760
 *   19  "But the quest for" swoosh        92–96s   f2760–2880
 *   20  $1B Contest card                  96–101s  f2880–3030
 *   21  "Free to enter"                   101–105s f3030–3150
 *   22  "Odds aren't in your favor"       105–109s f3150–3270
 *   23  "$1 Million"                      109–114s f3270–3420
 *   24  "Predict the unpredictable"       114–120s f3420–3600
 *   25  Kalshi logo                       120–127s f3600–3810
 */

const FPS = 30;
const s = (sec: number) => sec * FPS;

export const KalshiComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#F0F0F0" }}>
      <Sequence from={s(0)} durationInFrames={s(4)} name="01 Calendar">
        <Scene01_Calendar />
      </Sequence>
      <Sequence from={s(4)} durationInFrames={s(4)} name="02 Predicting">
        <Scene02_Predicting />
      </Sequence>
      <Sequence from={s(8)} durationInFrames={s(4)} name="03 Bracket">
        <Scene03_Bracket />
      </Sequence>
      <Sequence from={s(12)} durationInFrames={s(4)} name="04 Six Rounds">
        <Scene04_SixRounds />
      </Sequence>
      <Sequence from={s(16)} durationInFrames={s(5)} name="05 Stat Dream">
        <Scene05_StatDream />
      </Sequence>
      <Sequence from={s(21)} durationInFrames={s(5)} name="06 Coin Grid">
        <Scene06_CoinGrid />
      </Sequence>
      <Sequence from={s(26)} durationInFrames={s(5)} name="07 Shapes">
        <Scene07_Shapes />
      </Sequence>
      <Sequence from={s(31)} durationInFrames={s(5)} name="08 Quintillion">
        <Scene08_Quintillion />
      </Sequence>
      <Sequence from={s(36)} durationInFrames={s(6)} name="09 Sand Dark">
        <Scene09_SandDark />
      </Sequence>
      <Sequence from={s(42)} durationInFrames={s(5)} name="10 Crosshair">
        <Scene10_Crosshair />
      </Sequence>
      <Sequence from={s(47)} durationInFrames={s(4)} name="11 Three Icons">
        <Scene11_ThreeIcons />
      </Sequence>
      <Sequence from={s(51)} durationInFrames={s(5)} name="12 Accuracy Dots">
        <Scene12_AccuracyDots />
      </Sequence>
      <Sequence from={s(56)} durationInFrames={s(5)} name="13 120 Billion">
        <Scene13_120Billion />
      </Sequence>
      <Sequence from={s(61)} durationInFrames={s(5)} name="14 Calendar Grid">
        <Scene14_CalendarGrid />
      </Sequence>
      <Sequence from={s(66)} durationInFrames={s(5)} name="15 Timeline 2019">
        <Scene15_Timeline2019 />
      </Sequence>
      <Sequence from={s(71)} durationInFrames={s(6)} name="16 49 Games">
        <Scene16_49Games />
      </Sequence>
      <Sequence from={s(77)} durationInFrames={s(10)} name="17 Chalkboard">
        <Scene17_Chalkboard />
      </Sequence>
      <Sequence from={s(87)} durationInFrames={s(5)} name="18 Buffett">
        <Scene18_Buffett />
      </Sequence>
      <Sequence from={s(92)} durationInFrames={s(4)} name="19 Quest Swoosh">
        <Scene19_QuestSwoosh />
      </Sequence>
      <Sequence from={s(96)} durationInFrames={s(5)} name="20 Billion Contest">
        <Scene20_BillionContest />
      </Sequence>
      <Sequence from={s(101)} durationInFrames={s(4)} name="21 Free Entry">
        <Scene21_FreeEntry />
      </Sequence>
      <Sequence from={s(105)} durationInFrames={s(4)} name="22 Odds">
        <Scene22_OddsNotFavor />
      </Sequence>
      <Sequence from={s(109)} durationInFrames={s(5)} name="23 One Million">
        <Scene23_OneMillion />
      </Sequence>
      <Sequence from={s(114)} durationInFrames={s(6)} name="24 Unpredictable">
        <Scene24_Unpredictable />
      </Sequence>
      <Sequence from={s(120)} durationInFrames={s(7)} name="25 Kalshi Logo">
        <Scene25_KalshiLogo />
      </Sequence>
    </AbsoluteFill>
  );
};

export const kalshiMeta = {
  id: "Kalshi-Replicate",
  component: KalshiComposition,
  width: 1920,
  height: 1080,
  fps: FPS,
  durationInFrames: 3810,
};
