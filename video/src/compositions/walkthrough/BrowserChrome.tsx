/**
 * BrowserChrome — a faux browser window holding the screenshot.
 *
 * A rounded white surface dressed like a real macOS Chrome/Arc top: three
 * traffic-light dots with a faint inner ring, thin back / forward / reload
 * glyphs, a pill address bar (lock + muted scheme + dark host in Commit Mono),
 * and a kebab on the right. It does not own its own placement — Screen.tsx
 * positions it in canvas space and feeds the exact pixel geometry in.
 * Children = the screenshot, laid flush below the chrome bar.
 */

import React from "react";
import { font, monoFont } from "../../common/fonts";

export const CHROME_BAR_HEIGHT = 44;
export const WINDOW_RADIUS = 16;

const C = {
  bar: "#F0F0F2",
  surface: "#FFFFFF",
  border: "rgba(0,0,0,0.10)",
  topHairline: "rgba(255,255,255,0.65)",
  hairline: "rgba(0,0,0,0.08)",
  addressBg: "#FFFFFF",
  addressBorder: "rgba(0,0,0,0.10)",
  scheme: "#9A9BA8",
  host: "#2A2B33",
  lockTint: "#3A9B5C",
  navGlyph: "#6B6C7A",
  kebab: "#8A8B98",
  dotRed: "#FF5F57",
  dotYellow: "#FEBC2E",
  dotGreen: "#28C840",
  dotRing: "rgba(0,0,0,0.14)",
};

type Props = {
  /** Inner content width (the screenshot's rendered width), in canvas px. */
  width: number;
  /** Inner content height (the screenshot's rendered height), in canvas px. */
  height: number;
  /** Window top-left in canvas space. */
  left: number;
  top: number;
  /** Address-bar host; the orchestrator can swap it per page. */
  url?: string;
  children: React.ReactNode;
};

const TrafficLight: React.FC<{ color: string }> = ({ color }) => (
  <div
    style={{
      width: 12,
      height: 12,
      borderRadius: 6,
      background: color,
      boxShadow: `inset 0 0 0 0.5px ${C.dotRing}`,
    }}
  />
);

const NavIcon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    {children}
  </svg>
);

export const BrowserChrome: React.FC<Props> = ({
  width,
  height,
  left,
  top,
  url = "app.crxfx.com",
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
          "0 1px 1px rgba(15,23,42,0.04), 0 10px 28px rgba(15,23,42,0.12), 0 32px 80px rgba(15,23,42,0.20)",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Chrome bar */}
      <div
        style={{
          position: "relative",
          height: CHROME_BAR_HEIGHT,
          background: C.bar,
          borderBottom: `1px solid ${C.hairline}`,
          boxShadow: `inset 0 1px 0 ${C.topHairline}`,
          display: "flex",
          alignItems: "center",
          paddingLeft: 18,
          paddingRight: 16,
          boxSizing: "border-box",
          gap: 14,
        }}
      >
        {/* Traffic lights */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <TrafficLight color={C.dotRed} />
          <TrafficLight color={C.dotYellow} />
          <TrafficLight color={C.dotGreen} />
        </div>

        {/* Back / forward / reload */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexShrink: 0,
            color: C.navGlyph,
          }}
        >
          <NavIcon>
            <path
              d="M9.5 4 5.5 8l4 4"
              stroke={C.navGlyph}
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </NavIcon>
          <NavIcon>
            <path
              d="M6.5 4l4 4-4 4"
              stroke={C.navGlyph}
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={0.55}
            />
          </NavIcon>
          <NavIcon>
            <path
              d="M12.4 8a4.4 4.4 0 1 1-1.3-3.1"
              stroke={C.navGlyph}
              strokeWidth="1.4"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M12.6 3.4v2.2h-2.2"
              stroke={C.navGlyph}
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </NavIcon>
        </div>

        {/* Address bar */}
        <div
          style={{
            flex: 1,
            height: 28,
            maxWidth: 420,
            margin: "0 auto",
            background: C.addressBg,
            border: `1px solid ${C.addressBorder}`,
            borderRadius: 14,
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
              rx="1.3"
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
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: C.scheme }}>https://</span>
            <span style={{ color: C.host }}>{url}</span>
          </span>
        </div>

        {/* Kebab menu — keeps the address bar optically centered */}
        <div
          style={{
            width: 24,
            flexShrink: 0,
            display: "flex",
            justifyContent: "center",
            fontFamily: font,
          }}
        >
          <svg width="4" height="16" viewBox="0 0 4 16" fill={C.kebab}>
            <circle cx="2" cy="4" r="1.5" />
            <circle cx="2" cy="8" r="1.5" />
            <circle cx="2" cy="12" r="1.5" />
          </svg>
        </div>
      </div>

      {/* Screenshot */}
      <div style={{ width, height, position: "relative", background: "#fff" }}>
        {children}
      </div>
    </div>
  );
};
