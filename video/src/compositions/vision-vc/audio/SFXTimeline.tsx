/**
 * SFXTimeline — one impact per card appearance. Nothing else.
 *
 * 8 cards, 2 sounds, alternating. Volume escalates from 0.25 to 0.45.
 * No swooshes. No glitches. No shimmer. No whoosh.
 */
import React from "react";
import { Sequence, Audio, staticFile } from "remotion";

const sfx = (name: string) => `sfx/${name}`;

const SFX_DURATION_FRAMES = 30;

interface CardImpact {
  frame: number;
  label: string;
}

// Scene → Card cuts only. Card number determines the sound.
const CARD_IMPACTS: CardImpact[] = [
  { frame: 115, label: "DB → Card 1" },
  { frame: 200, label: "McD → Card 2" },
  { frame: 280, label: "Steam → Card 3" },
  { frame: 353, label: "Twitch → Card 4" },
  { frame: 416, label: "4chan → Card 5" },
  { frame: 468, label: "PumpFun → Card 6" },
  { frame: 513, label: "Military → Card 7" },
  { frame: 553, label: "Solar → Card 8" },
];

// Odd cards: cinematic impact. Even cards: bass drop.
function getSoundFile(cardIndex: number): string {
  return cardIndex % 2 === 0
    ? sfx("impact-cinematic.mp3")
    : sfx("bass-drop-heavy.mp3");
}

// Linear escalation: card 1 = 0.25, card 8 = 0.45
function getVolume(cardIndex: number): number {
  const min = 0.25;
  const max = 0.45;
  const t = cardIndex / (CARD_IMPACTS.length - 1);
  return min + t * (max - min);
}

export const SFXTimeline: React.FC = () => {
  return (
    <>
      {CARD_IMPACTS.map((card, i) => (
        <Sequence
          key={`sfx-${card.frame}`}
          from={card.frame}
          durationInFrames={SFX_DURATION_FRAMES}
          name={`SFX: ${card.label}`}
        >
          <Audio
            src={staticFile(getSoundFile(i))}
            volume={getVolume(i)}
          />
        </Sequence>
      ))}
    </>
  );
};
