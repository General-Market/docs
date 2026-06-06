/**
 * Screen — one screenshot inside the browser chrome. Placement + the
 * image→canvas transform live in geometry.ts (the single source).
 */

import React from "react";
import { Img, staticFile } from "remotion";
import { BrowserChrome } from "./BrowserChrome";
import { SCREEN_W, SCREEN_H, WINDOW_LEFT, WINDOW_TOP } from "./geometry";

export const Screen: React.FC<{ image: string }> = ({ image }) => (
  <BrowserChrome width={SCREEN_W} height={SCREEN_H} left={WINDOW_LEFT} top={WINDOW_TOP}>
    <Img
      src={staticFile(image)}
      style={{ width: SCREEN_W, height: SCREEN_H, display: "block", objectFit: "cover" }}
    />
  </BrowserChrome>
);
