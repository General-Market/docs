// CaptionLayer — bold, word-synced "viral YouTube" emphasis captions.
//
// At a handful of MAIN POINTS that carry no side-panel illustration, the spoken
// clause is dropped in the lower third, word by word, each word popping in on
// the exact frame the speaker says it (karaoke). The base words are heavy white
// with a crisp dark edge so they read on any background; ONE keyword per clause
// is GM electric blue, brightened for on-video pop, with a short underline rule
// that sweeps in beneath it. A soft white/blue bloom sits behind the type.
//
// It is not a subtitle track — it fires ~12 times across the whole talk, on the
// uncovered points only, and never while a panel is up (the rig owns the frame
// there, and the head is centred under a caption). Word timings come from a
// word-level transcript of final.mp4 (see captions.ts) so the reveal tracks the
// audio to ~1 frame.
//
// Brand colours: base #FFFFFF, keyword #2E7BFF (GM #0052FF brightened for video),
// glow a low-opacity white/blue. Font SF Pro Display, weight 800/900, ~96px,
// tight tracking. Lower-third so it clears the centred head.

import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font } from "../../common/fonts";
import { CAPTIONS, captionStart, captionEnd, type Caption } from "./captions";
import { activePanel } from "./panelEvents";

// SF Pro Display first (the project's Apple display face); Inter as the loaded
// fallback at heavy weight so it renders identically in any environment.
const CAPTION_FONT = `"SF Pro Display", ${font}, "Helvetica Neue", sans-serif`;

const HIGHLIGHT = "#2E7BFF"; // GM electric blue #0052FF, brightened for video.

// Window padding around a caption's spoken span. A short lead so the first
// word's pop reads as it lands; a held tail so the finished line stays a beat
// before it leaves.
const LEAD = 0.12; // seconds before the first word
const TAIL = 1.15; // seconds the finished line holds after the last word
const FADE_IN = 5; // frames — the whole block easing up at mount
const FADE_OUT = 12; // frames — the whole block easing out at the tail

// The dark edge + soft bloom that lets heavy white type sit on any background:
// a crisp dark outline for legibility, then a wide low-opacity white/blue halo.
const BASE_GLOW = [
  "0 2px 10px rgba(0,0,0,0.62)",
  "0 1px 2px rgba(0,0,0,0.85)",
  "0 0 2px rgba(0,0,0,0.7)",
  "0 0 22px rgba(255,255,255,0.30)",
  "0 0 46px rgba(120,170,255,0.22)",
].join(", ");

// The keyword carries a touch more blue bloom so it reads as lit.
const HIGHLIGHT_GLOW = [
  "0 2px 10px rgba(0,0,0,0.55)",
  "0 1px 2px rgba(0,0,0,0.8)",
  "0 0 18px rgba(46,123,255,0.55)",
  "0 0 44px rgba(46,123,255,0.42)",
].join(", ");

// One word: pops in on its spoken frame with a small spring, then holds. The
// reveal is keyed off play-time (sec) so it matches the audio regardless of how
// the parent Sequence reframes local frames.
const Word: React.FC<{
  word: { w: string; start: number };
  isKey: boolean;
  sec: number;
}> = ({ word, isKey, sec }) => {
  const { fps } = useVideoConfig();
  const sinceFrames = (sec - word.start) * fps;

  const pop = spring({
    frame: sinceFrames,
    fps,
    config: { damping: 16, mass: 0.6, stiffness: 170 },
    durationInFrames: 14,
  });
  const appear = interpolate(sinceFrames, [-1, 0], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(pop, [0, 1], [0.7, 1]);
  const rise = interpolate(pop, [0, 1], [16, 0]);
  // Underline beneath the keyword sweeps out as the word settles, then holds.
  const ruleP = interpolate(sinceFrames, [2, 13], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        opacity: appear,
        transform: `translateY(${rise}px) scale(${scale})`,
        transformOrigin: "center bottom",
        color: isKey ? HIGHLIGHT : "#FFFFFF",
        textShadow: isKey ? HIGHLIGHT_GLOW : BASE_GLOW,
        padding: "0 0.16em",
      }}
    >
      {word.w}
      {isKey && (
        <span
          style={{
            position: "absolute",
            left: "0.16em",
            right: "0.16em",
            bottom: "-0.12em",
            height: 8,
            borderRadius: 4,
            background: HIGHLIGHT,
            transform: `scaleX(${ruleP})`,
            transformOrigin: "left center",
            boxShadow: "0 0 14px rgba(46,123,255,0.6)",
          }}
        />
      )}
    </span>
  );
};

// One caption block: the whole clause, word by word, lower-third, with a clean
// block-level fade in at mount and out at the tail.
const CaptionBlock: React.FC<{ caption: Caption; mountFrames: number; durFrames: number }> = ({
  caption,
  mountFrames,
  durFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Recover absolute play-time inside the Sequence (it reframes to local 0).
  const sec = (mountFrames + frame) / fps;

  const fadeIn = interpolate(frame, [0, FADE_IN], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [durFrames - FADE_OUT, durFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 140,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "flex-end",
        gap: "0 0.04em",
        padding: "0 150px",
        opacity,
        fontFamily: CAPTION_FONT,
        fontSize: 98,
        fontWeight: 900,
        letterSpacing: "-0.02em",
        lineHeight: 1.08,
        textAlign: "center",
      }}
    >
      {caption.words.map((word, i) => (
        <Word key={`${word.start}-${i}`} word={word} isKey={i === caption.highlight} sec={sec} />
      ))}
    </div>
  );
};

export const CaptionLayer: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;

  // Never draw a caption while a side-panel is active — the rig owns the frame
  // there, and the brief is explicit that captions must not overlap panels.
  if (activePanel(sec)) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {CAPTIONS.map((c) => {
        const from = Math.round((captionStart(c) - LEAD) * fps);
        const to = Math.round((captionEnd(c) + TAIL) * fps);
        const dur = Math.max(1, to - from);
        // Only mount the window around this caption; the Sequence reframes time
        // so the child animates from its own frame 0.
        if (frame < from || frame >= from + dur) return null;
        return (
          <Sequence
            key={`${captionStart(c)}-${c.words[0].w}`}
            from={from}
            durationInFrames={dur}
            layout="none"
          >
            <CaptionBlock caption={c} mountFrames={from} durFrames={dur} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
