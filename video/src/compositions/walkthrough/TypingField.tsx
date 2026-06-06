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
 * sits precisely inside the rect (canvas coords), left-aligned at a fixed origin
 * (LEFT_PAD, vertically centred). Characters are only appended, never re-laid-out,
 * so a comma never shoves the value sideways — the reveal stays still while it
 * grows to the right.
 *
 * To read as NATIVE to the screenshot — not pasted on top — pass `style`, the
 * computed style captured from the real field: its fontFamily / fontSize /
 * fontWeight / color / letterSpacing render the typed value in the field's own
 * glyphs. `style` wins; the loose `fontSize`/`color` props are the fallback.
 *
 * Brand fallbacks: text near-black #1D1D1F; mono = Commit Mono.
 */

import React from "react";
import { useCurrentFrame } from "remotion";
import { monoFont } from "../../common/fonts";

const NEAR_BLACK = "#1D1D1F";

const LEFT_PAD = 30; // px the text sits in — clears a leading "$" glyph in the field
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
  /** Override the default left pad (px). Defaults to LEFT_PAD = 30. */
  padLeft?: number;
  /**
   * Computed style captured from the real screenshot field. When present, each
   * field overrides its loose-prop equivalent so the typed value matches the
   * field's own text exactly.
   */
  style?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number | string;
    color?: string;
    letterSpacing?: string;
  };
}> = ({
  rect,
  value,
  startFrame,
  durationFrames,
  fontSize,
  color = NEAR_BLACK,
  prefix = "",
  padLeft,
  style,
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

  // Captured style wins over the loose props; loose props are the fallback.
  const resolvedFontFamily = style?.fontFamily ?? monoFont;
  // Font size defaults to a comfortable fraction of the field height.
  const fs = style?.fontSize ?? fontSize ?? Math.round(rect.h * 0.52);
  const resolvedFontWeight = style?.fontWeight ?? 500;
  const resolvedColor = style?.color ?? color;
  const resolvedLetterSpacing = style?.letterSpacing;
  const pad = padLeft ?? LEFT_PAD;

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
        justifyContent: "flex-start",
        paddingLeft: pad,
        boxSizing: "border-box",
        pointerEvents: "none",
        zIndex: 8500,
        fontFamily: resolvedFontFamily,
        fontSize: fs,
        fontWeight: resolvedFontWeight,
        letterSpacing: resolvedLetterSpacing,
        color: resolvedColor,
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
          background: resolvedColor,
          opacity: caretVisible ? 1 : 0,
        }}
      />
    </div>
  );
};
