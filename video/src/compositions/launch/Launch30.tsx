import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile } from "remotion";
import { SHOTS } from "./data/shotlist";
import { toFrames, FPS } from "./theme";
import { BrollGrid } from "./shots/BrollGrid";
import { BrollGridStatement } from "./shots/BrollGridStatement";
import { QuadGrid } from "./shots/QuadGrid";
import { PayoffCard } from "./shots/PayoffCard";
import { MegaGrid } from "./shots/MegaGrid";
import { LogoReveal } from "./shots/LogoReveal";
import { Sfx } from "../tutorial/components/Sfx";
import type { SfxEvent } from "../tutorial/components/Sfx";
import {
  HARD_CUT,
  GRID_WHOOSH,
  TEXT_SLAM,
  LOGO_STINGER,
  BOOM,
} from "./sfxMap";
import type { BrollCategory } from "./types";

export const Launch30: React.FC = () => {
  const sfxEvents: SfxEvent[] = [];

  return (
    <AbsoluteFill style={{ backgroundColor: "#ffffff" }}>
      {SHOTS.map((shot, i) => {
        const from = toFrames(shot.startSec);
        const dur = toFrames(shot.durationSec);

        const cutSfx: SfxEvent[] = [];
        if (i > 0) {
          cutSfx.push({ at: from, sound: HARD_CUT });
        }

        let content: React.ReactNode = null;

        switch (shot.type) {
          case "broll-grid":
            cutSfx.push({ at: from, sound: GRID_WHOOSH });
            content = (
              <BrollGrid
                category={shot.category as Exclude<BrollCategory, "all">}
                question={shot.question!}
                words={shot.words}
                expandGrid={i === 0}
              />
            );
            break;

          case "broll-grid-statement":
            cutSfx.push({ at: from, sound: GRID_WHOOSH });
            cutSfx.push({ at: from + Math.floor(dur / 2), sound: TEXT_SLAM });
            content = (
              <BrollGridStatement
                category={shot.category as Exclude<BrollCategory, "all">}
                question={shot.question!}
                statement={shot.statement!}
                words={shot.words}
              />
            );
            break;

          case "quad-grid":
            cutSfx.push({ at: from, sound: BOOM });
            content = (
              <QuadGrid
                categories={shot.categories!}
                question={shot.question!}
              />
            );
            break;

          case "payoff-card":
            cutSfx.push({ at: from + 2, sound: TEXT_SLAM });
            content = <PayoffCard statement={shot.statement!} />;
            break;

          case "mega-grid":
            cutSfx.push({ at: from, sound: BOOM });
            content = <MegaGrid question={shot.question!} />;
            break;

          case "logo-reveal":
            cutSfx.push({ at: from, sound: LOGO_STINGER });
            content = <LogoReveal />;
            break;
        }

        sfxEvents.push(...cutSfx);

        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            {content}
          </Sequence>
        );
      })}

      <Sfx sound={sfxEvents} />

      {/* ── Music bed: track from 0:15, crossfades out over 3s ── */}
      <Sequence from={0} durationInFrames={toFrames(27)} layout="none">
        <Audio
          src={staticFile("music/launch-track.mp3")}
          startFrom={Math.round(15 * FPS)}
          volume={(f) => {
            const fadeIn = interpolate(f, [0, toFrames(0.5)], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            // slow fade-out starts at 22s, gone by 26s
            const fadeOut = interpolate(
              f,
              [toFrames(22), toFrames(26)],
              [1, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            return 0.5 * fadeIn * fadeOut;
          }}
        />
      </Sequence>

      {/* ── End section: starts 1:52 (music lead-in), piano drop at ~1:55 ── */}
      <Sequence from={toFrames(22)} durationInFrames={toFrames(8)} layout="none">
        <Audio
          src={staticFile("music/launch-track.mp3")}
          startFrom={Math.round(112 * FPS)}
          volume={(f) => {
            const fadeIn = interpolate(
              f,
              [0, toFrames(3)],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            return 0.5 * fadeIn;
          }}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
