/**
 * GreenAsciiScreen — Full-screen green-on-black ASCII + [logo General Market].
 *
 * Logo and text on the SAME LINE, big.
 * No entrance animation — instant cut in.
 * Exit: ASCII background slides up; logo stays in place, fades + shrinks.
 *
 * Logo transform independent of the slide — no x/y translation.
 * At slideOut=0.5: logo is 40% opacity and 50% smaller.
 * At slideOut=1.0: logo fully gone (synchronous with slide end).
 */

import React, { useState, useEffect } from "react";
import {
  AbsoluteFill,
  Img,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
} from "remotion";
import { FONT } from "../tutorial/designTokens";

const W = 1920;
const H = 1080;

const FONT_SIZE = 10;
const CELL_W = 6;
const CELL_H = 10;
const COLS = Math.ceil(W / CELL_W);
const ROWS = Math.ceil(H / CELL_H);

const RAMP = " .·:;+*#%@";
const GREEN = "#9fe870";

export const GreenAsciiScreen: React.FC<{
  /** 0 = on screen, 1 = fully slid up off screen */
  slideOut?: number;
}> = ({ slideOut = 0 }) => {
  const [ascii, setAscii] = useState<string | null>(null);
  const [handle] = useState(() => delayRender("Loading green ASCII"));

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = COLS;
      canvas.height = ROWS;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, COLS, ROWS);
      const { data } = ctx.getImageData(0, 0, COLS, ROWS);

      let text = "";
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const idx = (y * COLS + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
          const ci = Math.min(
            RAMP.length - 1,
            Math.floor(brightness * RAMP.length),
          );
          text += RAMP[ci];
        }
        if (y < ROWS - 1) text += "\n";
      }

      setAscii(text);
      continueRender(handle);
    };

    img.onerror = () => continueRender(handle);
    img.src = staticFile("broll/mountains-frame.jpg");
  }, [handle]);

  if (!ascii) return null;

  // ASCII background slides up
  const translateY = interpolate(slideOut, [0, 1], [0, -100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Logo fades + shrinks — NOT tied to slide movement.
  // Tuned so 0.5 slide = 0.4 opacity + 0.5 scale, 1.0 slide = invisible.
  const logoOpacity = interpolate(slideOut, [0, 0.5, 1], [1, 0.4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoScale = interpolate(slideOut, [0, 0.5, 1], [1, 0.5, 0.2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      {/* ASCII background + black — this layer slides up */}
      <AbsoluteFill style={{ transform: `translateY(${translateY}%)` }}>
        <AbsoluteFill style={{ background: "#000000" }} />
        <pre
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: FONT_SIZE,
            lineHeight: `${CELL_H}px`,
            letterSpacing: 0,
            color: GREEN,
            whiteSpace: "pre",
            margin: 0,
            padding: 0,
            overflow: "hidden",
            width: W,
            height: H,
            opacity: 0.85,
          }}
        >
          {ascii}
        </pre>
      </AbsoluteFill>

      {/* Logo layer — stationary, fades + shrinks in place */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <Img
            src={staticFile("gm-logo.svg")}
            style={{ width: 120, height: 120 }}
          />
          <span
            style={{
              fontFamily: FONT.display,
              fontSize: 104,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            General Market
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
