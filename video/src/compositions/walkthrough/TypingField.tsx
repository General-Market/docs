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
 * A real input field shows a placeholder (a faint "0", "0.00", "Amount…") while
 * empty. The screenshot baked that placeholder in — so when we type over it the
 * placeholder would peek out beside the real value. NEVER show a placeholder
 * above the real value: when the captured `style.background` is known, we paint
 * a mask of the field's own background from the text origin to the right edge,
 * covering the baked placeholder while leaving any fixed prefix glyph (a leading
 * "$" sitting left of the pad) untouched. The mask appears the instant typing
 * begins, so the field reads exactly as the user's real keystrokes would.
 *
 * Brand fallbacks: text near-black #1D1D1F; mono = Commit Mono.
 */

import React from "react";
import { useCurrentFrame } from "remotion";
import { monoFont } from "../../common/fonts";

const NEAR_BLACK = "#1D1D1F";

// Where the typed value's left edge sits inside the captured field rect. The
// manifest rect is the field's text box, and its placeholder ("0", "0.00", …)
// is left-aligned at the rect's left edge — so the real value must start there
// too, replacing the placeholder rather than indenting past it.
const LEFT_PAD = 2;
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
    /** The field's own background — painted as a mask over the baked placeholder. */
    background?: string;
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

  // The field's baked-in placeholder must never show beside the real value. Once
  // typing has begun, mask the WHOLE field rect with the field's own background,
  // then render the real value on top — the placeholder cannot peek out at any
  // edge. With no captured background we can't mask cleanly, so the fallback is
  // no mask (the field is assumed empty).
  const maskBg = style?.background;
  const showMask = maskBg != null && local > 0;

  return (
    <>
      {showMask && (
        <div
          style={{
            position: "absolute",
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h,
            background: maskBg,
            pointerEvents: "none",
            zIndex: 8499,
          }}
        />
      )}
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
    </>
  );
};
