/**
 * TypingField — types a string into a screenshot's empty input field, character
 * by character, with a blinking caret.
 *
 * Frame-driven, never CSS-animated: the revealed character count and the caret's
 * blink phase are both computed from useCurrentFrame() so the same picture renders
 * in Studio and in a headless render. Before startFrame nothing shows; over
 * [startFrame, startFrame+durationFrames] characters reveal linearly (rounded
 * down); after that the whole value holds and the caret hides.
 *
 * It overlays ON TOP of the screenshot's empty field — no background fill — so it
 * is positioned precisely inside the rect (canvas coords), left-aligned with a
 * small left pad, vertically centred. Numerals use Commit Mono so the typed value
 * reads with the app's numeric feel.
 *
 * Brand: text near-black #1D1D1F by default; mono = Commit Mono.
 */

import React from "react";
import { useCurrentFrame } from "remotion";
import { monoFont } from "../../common/fonts";

const NEAR_BLACK = "#1D1D1F";

const LEFT_PAD = 10; // px the text sits in from the field's left edge
const CARET_W = 2; // px caret bar width
const BLINK_PERIOD = 30; // frames for one full blink cycle (~2/sec at 60fps)

export const TypingField: React.FC<{
  rect: { x: number; y: number; w: number; h: number };
  value: string;
  startFrame: number;
  durationFrames: number;
  fontSize?: number;
  color?: string;
  prefix?: string;
}> = ({
  rect,
  value,
  startFrame,
  durationFrames,
  fontSize,
  color = NEAR_BLACK,
  prefix = "",
}) => {
  const frame = useCurrentFrame();

  // Characters revealed so far — linear over the typing window, rounded down.
  const local = frame - startFrame;
  let revealed: number;
  if (local <= 0) {
    revealed = 0;
  } else if (local >= durationFrames) {
    revealed = value.length;
  } else {
    revealed = Math.floor((local / durationFrames) * value.length);
  }

  const typing = local > 0 && local < durationFrames;
  const shown = value.slice(0, revealed);

  // Caret blinks ~2/sec while typing, hidden once the value is complete.
  const blinkOn = frame % BLINK_PERIOD < BLINK_PERIOD / 2;
  const caretVisible = typing && blinkOn;

  // Font size defaults to a comfortable fraction of the field height.
  const fs = fontSize ?? Math.round(rect.h * 0.42);

  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        display: "flex",
        alignItems: "center",
        paddingLeft: LEFT_PAD,
        boxSizing: "border-box",
        pointerEvents: "none",
        zIndex: 8500,
        fontFamily: monoFont,
        fontSize: fs,
        fontWeight: 500,
        fontVariantNumeric: "tabular-nums",
        color,
        lineHeight: 1,
        whiteSpace: "pre",
        overflow: "hidden",
      }}
    >
      <span>
        {prefix}
        {shown}
      </span>
      <span
        style={{
          display: "inline-block",
          width: CARET_W,
          height: fs,
          marginLeft: 1,
          background: color,
          opacity: caretVisible ? 1 : 0,
        }}
      />
    </div>
  );
};
