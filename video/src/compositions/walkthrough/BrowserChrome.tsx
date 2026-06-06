/**
 * BrowserChrome — a faux browser window holding the screenshot.
 *
 * A rounded white surface dressed like a real macOS Chrome top: a tab strip
 * (traffic lights + Chrome-shaped tabs + new-tab "+"), then the toolbar row —
 * thin back / forward / reload glyphs, a pill address bar (lock + muted scheme
 * + dark host in Commit Mono), and a kebab on the right. It does not own its
 * own placement — Screen.tsx positions it in canvas space and feeds the exact
 * pixel geometry in. Children = the screenshot, laid flush below the chrome.
 *
 * Tabs are data-driven via the optional `tabs` prop. When `tabs` is absent the
 * window renders one implicit tab from `url`, so existing callers keep the
 * single-window look unchanged. `tabCenter(index, count)` gives the canvas
 * coordinates of a tab's center so the orchestrator can aim the cursor at it.
 */

import React from "react";
import { font, monoFont } from "../../common/fonts";
import {
  CHROME_BAR_HEIGHT,
  CHROME_TOTAL_HEIGHT,
  TAB_STRIP_HEIGHT,
  WINDOW_RADIUS,
  WINDOW_LEFT,
  WINDOW_TOP,
  SCREEN_W,
  type Point,
} from "./geometry";

export { CHROME_BAR_HEIGHT, CHROME_TOTAL_HEIGHT, TAB_STRIP_HEIGHT, WINDOW_RADIUS };

const C = {
  strip: "#DADCE2",
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
  tabActiveBg: "#F0F0F2",
  tabActiveText: "#2A2B33",
  tabInactiveText: "#5F6368",
  tabSeparator: "rgba(0,0,0,0.16)",
  tabClose: "#7A7B88",
  faviconDefault: "#A0A1AC",
};

/* ----------------------------------------------------------------------------
 * Tab-strip layout — window-relative px. tabCenter() mirrors the exact render
 * math, so the cursor lands on the same pixel the tab is drawn at.
 * ------------------------------------------------------------------------- */

/** Where the first tab begins, after the traffic lights. */
const TAB_STRIP_LEFT_PAD = 84;
/** Room kept free at the right for the new-tab "+" and breathing space. */
const TAB_STRIP_RIGHT_PAD = 120;
const TAB_MAX_WIDTH = 236;
const TAB_GAP = 8;
/** Tabs sit on the strip's floor; this gap above them is the strip showing. */
const TAB_TOP_PAD = 6;
const TAB_HEIGHT = TAB_STRIP_HEIGHT - TAB_TOP_PAD; // 30

/** Width of one tab given how many share the strip. */
export function tabWidthFor(count: number): number {
  const avail = SCREEN_W - TAB_STRIP_LEFT_PAD - TAB_STRIP_RIGHT_PAD;
  const n = Math.max(1, count);
  return Math.min(TAB_MAX_WIDTH, Math.floor((avail - TAB_GAP * (n - 1)) / n));
}

/** Window-relative left edge of tab #index. */
function tabLeft(index: number, count: number): number {
  return TAB_STRIP_LEFT_PAD + index * (tabWidthFor(count) + TAB_GAP);
}

/** Canvas coordinates of tab #index's center — the cursor's click target. */
export function tabCenter(index: number, count: number): Point {
  return {
    x: WINDOW_LEFT + tabLeft(index, count) + tabWidthFor(count) / 2,
    y: WINDOW_TOP + TAB_TOP_PAD + TAB_HEIGHT / 2,
  };
}

/* ------------------------------------------------------------------------- */

export type ChromeTab = {
  title: string;
  active: boolean;
  /** CSS color of the favicon dot. Defaults to a generic grey. */
  favicon?: string;
  /** Address-bar host shown while this tab is active. Falls back to `url`. */
  url?: string;
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
  /** Tabs in the strip. Absent = one implicit tab built from `url`. */
  tabs?: ChromeTab[];
  /** Overrides which tab is active (else the first tab with `active: true`). */
  activeTab?: number;
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

const Tab: React.FC<{
  tab: ChromeTab;
  index: number;
  count: number;
  isActive: boolean;
  separatorBefore: boolean;
}> = ({ tab, index, count, isActive, separatorBefore }) => {
  const w = tabWidthFor(count);
  return (
    <>
      {separatorBefore && (
        <div
          style={{
            position: "absolute",
            left: tabLeft(index, count) - TAB_GAP / 2,
            top: TAB_TOP_PAD + 7,
            width: 1,
            height: TAB_HEIGHT - 14,
            background: C.tabSeparator,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          left: tabLeft(index, count),
          bottom: 0,
          width: w,
          height: TAB_HEIGHT,
          borderRadius: "10px 10px 0 0",
          background: isActive ? C.tabActiveBg : "transparent",
          boxShadow: isActive ? `inset 0 1px 0 ${C.topHairline}` : "none",
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingLeft: 12,
          paddingRight: 10,
          boxSizing: "border-box",
        }}
      >
        {/* Favicon dot */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            background: tab.favicon ?? C.faviconDefault,
            flexShrink: 0,
          }}
        />
        {/* Title */}
        <span
          style={{
            flex: 1,
            fontFamily: font,
            fontSize: 12,
            fontWeight: isActive ? 500 : 400,
            color: isActive ? C.tabActiveText : C.tabInactiveText,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            letterSpacing: "0.005em",
          }}
        >
          {tab.title}
        </span>
        {/* Close × */}
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          style={{ flexShrink: 0, opacity: isActive ? 0.75 : 0.55 }}
        >
          <path
            d="M1.2 1.2 6.8 6.8M6.8 1.2 1.2 6.8"
            stroke={C.tabClose}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </>
  );
};

export const BrowserChrome: React.FC<Props> = ({
  width,
  height,
  left,
  top,
  url = "app.crxfx.com",
  tabs,
  activeTab,
  children,
}) => {
  const resolvedTabs: ChromeTab[] = tabs ?? [{ title: url, active: true }];
  const activeIdx =
    activeTab ?? Math.max(0, resolvedTabs.findIndex((t) => t.active));
  const addressUrl = resolvedTabs[activeIdx]?.url ?? url;
  const count = resolvedTabs.length;

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        height: height + CHROME_TOTAL_HEIGHT,
        borderRadius: WINDOW_RADIUS,
        background: C.surface,
        border: `1px solid ${C.border}`,
        boxShadow:
          "0 1px 1px rgba(15,23,42,0.04), 0 10px 28px rgba(15,23,42,0.12), 0 32px 80px rgba(15,23,42,0.20)",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Tab strip */}
      <div
        style={{
          position: "relative",
          height: TAB_STRIP_HEIGHT,
          background: C.strip,
        }}
      >
        {/* Traffic lights */}
        <div
          style={{
            position: "absolute",
            left: 18,
            top: 0,
            height: TAB_STRIP_HEIGHT,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <TrafficLight color={C.dotRed} />
          <TrafficLight color={C.dotYellow} />
          <TrafficLight color={C.dotGreen} />
        </div>

        {/* Tabs */}
        {resolvedTabs.map((tab, i) => (
          <Tab
            key={i}
            tab={tab}
            index={i}
            count={count}
            isActive={i === activeIdx}
            separatorBefore={i > 0 && i !== activeIdx && i - 1 !== activeIdx}
          />
        ))}

        {/* New-tab + */}
        <div
          style={{
            position: "absolute",
            left: tabLeft(count, count) + 2,
            top: TAB_TOP_PAD,
            width: TAB_HEIGHT,
            height: TAB_HEIGHT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path
              d="M6 1.5v9M1.5 6h9"
              stroke={C.navGlyph}
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* Toolbar — nav glyphs + address bar */}
      <div
        style={{
          position: "relative",
          height: CHROME_BAR_HEIGHT,
          background: C.bar,
          borderBottom: `1px solid ${C.hairline}`,
          display: "flex",
          alignItems: "center",
          paddingLeft: 18,
          paddingRight: 16,
          boxSizing: "border-box",
          gap: 14,
        }}
      >
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
            <span style={{ color: C.host }}>{addressUrl}</span>
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
