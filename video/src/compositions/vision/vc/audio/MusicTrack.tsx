import React from "react";
import { Audio, staticFile } from "remotion";

/*
 * Audio for light mode:
 * - Music: barely audible background texture, not cinematic
 * - Drums: removed entirely
 *
 * The ambient sounds per scene carry the atmosphere.
 * Music is just a subtle thread that connects scenes.
 */

const SCENES: [number, number][] = [
  [60, 115],
  [150, 200],
  [230, 280],
  [308, 353],
  [378, 416],
  [438, 468],
  [488, 513],
  [531, 553],
];

const FADE = 10;

const sceneAmount = (f: number): number => {
  for (const [start, end] of SCENES) {
    if (f >= start && f < end) {
      const fadeIn = Math.min(1, (f - start) / FADE);
      const fadeOut = Math.min(1, (end - f) / FADE);
      return Math.min(fadeIn, fadeOut);
    }
  }
  return 0;
};

// Much quieter — background texture only
const musicLevel = (f: number): number => {
  if (f < 60) return 0;
  if (f < 553) return 0.08;
  // 400K
  if (f < 616) return 0.05;
  // Closing
  if (f < 720) return 0.08;
  if (f < 766) return Math.max(0, 0.08 - ((f - 720) / 46) * 0.08);
  return 0;
};

export const MusicTrack: React.FC = () => {
  return (
    <>
      {/* Cinematic track — very quiet, just a thread */}
      <Audio
        src={staticFile("compositions/vision-vc/music/dark-cinematic-01.mp3")}
        volume={(f: number) => {
          const scene = sceneAmount(f);
          const level = musicLevel(f);
          if (f >= 568) return level;
          return level * (0.3 + 0.7 * scene);
        }}
      />
      {/* No drums — too aggressive for light mode */}
    </>
  );
};
