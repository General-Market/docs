/**
 * BrowserChrome — a faux browser window holding the screenshot.
 *
 * A rounded white surface with the three traffic-light dots, a slim address
 * bar reading `app.crxfx.com`, and a soft drop-shadow. It does not own its
 * own placement — Screen.tsx positions it in canvas space and feeds the
 * exact pixel geometry in. Children = the screenshot, laid flush below the
 * chrome bar.
 */

import React from "react";
import { font, monoFont } from "../../common/fonts";

export const CHROME_BAR_HEIGHT = 44;
export const WINDOW_RADIUS = 16;

const C = {
  bar: "#F5F5F7",
  surface: "#FFFFFF",
  border: "rgba(0,0,0,0.08)",
  hairline: "rgba(0,0,0,0.06)",
  addressBg: "#FFFFFF",
  addressBorder: "rgba(0,0,0,0.07)",
  addressText: "#5A5B6A",
  lockTint: "#8A8B9C",
  dotRed: "#FF5F57",
  dotYellow: "#FEBC2E",
  dotGreen: "#28C840",
};

type Props = {
  /** Inner content width (the screenshot's rendered width), in canvas px. */
  width: number;
  /** Inner content height (the screenshot's rendered height), in canvas px. */
  height: number;
  /** Window top-left in canvas space. */
  left: number;
  top: number;
  children: React.ReactNode;
};

const TrafficLight: React.FC<{ color: string }> = ({ color }) => (
  <div
    style={{
      width: 12,
      height: 12,
      borderRadius: 6,
      background: color,
    }}
  />
);

export const BrowserChrome: React.FC<Props> = ({
  width,
  height,
  left,
  top,
  children,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        height: height + CHROME_BAR_HEIGHT,
        borderRadius: WINDOW_RADIUS,
        background: C.surface,
        border: `1px solid ${C.border}`,
        boxShadow:
          "0 2px 4px rgba(0,0,0,0.04), 0 24px 60px rgba(15,23,42,0.18), 0 8px 24px rgba(15,23,42,0.10)",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Chrome bar */}
      <div
        style={{
          height: CHROME_BAR_HEIGHT,
          background: C.bar,
          borderBottom: `1px solid ${C.hairline}`,
          display: "flex",
          alignItems: "center",
          paddingLeft: 18,
          paddingRight: 18,
          boxSizing: "border-box",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <TrafficLight color={C.dotRed} />
          <TrafficLight color={C.dotYellow} />
          <TrafficLight color={C.dotGreen} />
        </div>

        {/* Address bar */}
        <div
          style={{
            flex: 1,
            height: 26,
            maxWidth: 360,
            margin: "0 auto",
            background: C.addressBg,
            border: `1px solid ${C.addressBorder}`,
            borderRadius: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            paddingLeft: 12,
            paddingRight: 12,
            boxSizing: "border-box",
          }}
        >
          {/* lock glyph */}
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <rect
              x="1.6"
              y="4.6"
              width="7.8"
              height="5.4"
              rx="1.2"
              fill={C.lockTint}
            />
            <path
              d="M3.3 4.6V3.3a2.2 2.2 0 0 1 4.4 0v1.3"
              stroke={C.lockTint}
              strokeWidth="1.1"
              fill="none"
            />
          </svg>
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "0.005em",
              color: C.addressText,
            }}
          >
            app.crxfx.com
          </span>
        </div>

        {/* right-side spacer keeps the address bar optically centered */}
        <div style={{ width: 44, flexShrink: 0, fontFamily: font }} />
      </div>

      {/* Screenshot */}
      <div style={{ width, height, position: "relative", background: "#fff" }}>
        {children}
      </div>
    </div>
  );
};
