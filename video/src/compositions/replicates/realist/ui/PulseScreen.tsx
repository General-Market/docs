import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import {
  PCOLORS as C,
  PNAV,
  TICKER,
  PHEADING,
  PULSE_HEADERS,
  PULSE_NEW_PAIRS,
  PULSE_FINAL_STRETCH,
  PULSE_MIGRATED,
  DOCK,
  PAID_CHIP,
  PulseCard,
} from "./copy/pulse";
import type { IconToken, Badge } from "./copy/trenches";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const FONT = `${fontFamily}, -apple-system, sans-serif`;

// ---------------------------------------------------------------------------
// glyphs (self-contained copy of the small line-icon vocabulary)
// ---------------------------------------------------------------------------

const Glyph: React.FC<{ kind: string; size?: number; color?: string }> = ({
  kind,
  size = 13,
  color = C.icon,
}) => {
  const s = size;
  const sw = 1.4;
  const common = { width: s, height: s, viewBox: "0 0 16 16", style: { display: "block" } };
  switch (kind) {
    case "search":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="4.5" fill="none" stroke={color} strokeWidth={sw} />
          <line x1="10.5" y1="10.5" x2="14" y2="14" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "link":
      return (
        <svg {...common}>
          <path d="M6.5 9.5 L9.5 6.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <path d="M7 5.5 L8.7 3.8 a2.6 2.6 0 0 1 3.7 3.7 L10.7 9.2" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <path d="M9 10.5 L7.3 12.2 a2.6 2.6 0 0 1 -3.7 -3.7 L5.3 6.8" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "globe":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.5" fill="none" stroke={color} strokeWidth={sw} />
          <ellipse cx="8" cy="8" rx="2.4" ry="5.5" fill="none" stroke={color} strokeWidth={sw * 0.8} />
          <line x1="2.5" y1="8" x2="13.5" y2="8" stroke={color} strokeWidth={sw * 0.8} />
        </svg>
      );
    case "pill":
      return (
        <svg {...common}>
          <rect x="2" y="5.5" width="12" height="5" rx="2.5" fill="none" stroke={color} strokeWidth={sw} transform="rotate(-35 8 8)" />
          <line x1="6" y1="9.5" x2="10" y2="6.5" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case "feather":
      return (
        <svg {...common}>
          <path d="M12.5 3.5 C9 3.5 5.5 6 4.5 9.5 L4 12.5 L7 12 C10.5 11 12.5 7.5 12.5 3.5 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <line x1="4.5" y1="11.5" x2="10" y2="6.5" stroke={color} strokeWidth={sw * 0.8} />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.5" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M8 5 L8 8 L10.5 9.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "person":
      return (
        <svg {...common}>
          <circle cx="8" cy="5.5" r="2.6" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M3.5 13.5 C4 10.5 6 9.5 8 9.5 C10 9.5 12 10.5 12.5 13.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "peopleGroup":
      return (
        <svg {...common}>
          <circle cx="5.5" cy="5.5" r="2.2" fill="none" stroke={color} strokeWidth={sw} />
          <circle cx="10.5" cy="5.5" r="2.2" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M2 13 C2.5 10.5 4 9.5 5.5 9.5 M8 13.5 C8.5 10.5 9.5 9.5 10.5 9.5 C12 9.5 13.5 10.5 14 13" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M8 2.5 C5.5 2.5 4.5 4.5 4.5 6.5 L4.5 9 L3.5 11.5 L12.5 11.5 L11.5 9 L11.5 6.5 C11.5 4.5 10.5 2.5 8 2.5 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M6.8 13 A1.3 1.3 0 0 0 9.2 13" fill="none" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case "bolt":
      return (
        <svg {...common}>
          <path d="M9 1.5 L4 9 L7.5 9 L7 14.5 L12 7 L8.5 7 Z" fill={color} />
        </svg>
      );
    case "mute":
      return (
        <svg {...common}>
          <path d="M3 6.5 L5.5 6.5 L8.5 4 L8.5 12 L5.5 9.5 L3 9.5 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <line x1="10.5" y1="6.5" x2="13.5" y2="9.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <line x1="13.5" y1="6.5" x2="10.5" y2="9.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "speaker":
      return (
        <svg {...common}>
          <path d="M3 6.5 L5.5 6.5 L8.5 4 L8.5 12 L5.5 9.5 L3 9.5 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M10.5 6 A3 3 0 0 1 10.5 10 M12 4.5 A5 5 0 0 1 12 11.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "filter":
      return (
        <svg {...common}>
          <path d="M3 4 L13 4 L9.5 8.5 L9.5 12.5 L6.5 11 L6.5 8.5 Z" fill={color} />
        </svg>
      );
    case "sliders":
      return (
        <svg {...common}>
          <path d="M3 5 H13 M3 8 H13 M3 11 H13" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <circle cx="6" cy="5" r="1.4" fill={color} />
          <circle cx="10.5" cy="8" r="1.4" fill={color} />
          <circle cx="7.5" cy="11" r="1.4" fill={color} />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M2.5 12.5 L6 8 L9 10 L13.5 4.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <path d="M8 2.5 L9.6 6.2 L13.5 6.5 L10.5 9 L11.5 13 L8 10.8 L4.5 13 L5.5 9 L2.5 6.5 L6.4 6.2 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "gear":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="2.2" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M8 2 L8 4 M8 12 L8 14 M2 8 L4 8 M12 8 L14 8 M3.8 3.8 L5.2 5.2 M10.8 10.8 L12.2 12.2 M12.2 3.8 L10.8 5.2 M5.2 10.8 L3.8 12.2" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "question":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.8" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M6.3 6.3 A1.8 1.8 0 1 1 8.4 8.4 L8 9.2" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <circle cx="8" cy="11.2" r="0.8" fill={color} />
        </svg>
      );
    case "chevron":
      return (
        <svg {...common}>
          <path d="M4.5 6.5 L8 10 L11.5 6.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <line x1="4" y1="4" x2="12" y2="12" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <line x1="12" y1="4" x2="4" y2="12" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...common}>
          <rect x="2.5" y="5" width="11" height="8" rx="1.5" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M6 5 L6 3.8 A1 1 0 0 1 7 2.8 L9 2.8 A1 1 0 0 1 10 3.8 L10 5" fill="none" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case "crown":
      return (
        <svg {...common}>
          <path d="M3 11.5 L2.5 5.5 L5.5 7.5 L8 4 L10.5 7.5 L13.5 5.5 L13 11.5 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "personRun":
      return (
        <svg {...common}>
          <circle cx="8" cy="4" r="1.8" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M5 13 L7 9 L8 7 M8 7 L11 8.5 M8 7 L6 7.5 M9.5 13 L8.5 9.8" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "telegram":
      return (
        <svg {...common}>
          <path d="M13.5 3 L2.5 7.5 L6 9 L7 13 L9 10.2 L12 12 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "grid":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="4" height="4" rx="1" fill="none" stroke={color} strokeWidth={sw} />
          <rect x="9" y="3" width="4" height="4" rx="1" fill="none" stroke={color} strokeWidth={sw} />
          <rect x="3" y="9" width="4" height="4" rx="1" fill="none" stroke={color} strokeWidth={sw} />
          <rect x="9" y="9" width="4" height="4" rx="1" fill="none" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case "xLogo":
      return (
        <svg {...common}>
          <text x="8" y="12" textAnchor="middle" fontSize="11" fontWeight={700} fill={color}>
            X
          </text>
        </svg>
      );
    case "copy":
      return (
        <svg {...common}>
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M3.5 10.5 L3 10.5 A1 1 0 0 1 2 9.5 L2 3.5 A1 1 0 0 1 3 2.5 L9 2.5 A1 1 0 0 1 10 3.5 L10 4" fill="none" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case "bookmark":
      return (
        <svg {...common}>
          <path d="M4.5 2.5 L11.5 2.5 L11.5 13.5 L8 10.8 L4.5 13.5 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "monitor":
      return (
        <svg {...common}>
          <rect x="2.5" y="3.5" width="11" height="8" rx="1" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M6 13.5 H10" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "target":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="4.5" fill="none" stroke={color} strokeWidth={sw} />
          <circle cx="8" cy="8" r="1.5" fill={color} />
          <path d="M8 1.5 L8 4 M8 12 L8 14.5 M1.5 8 L4 8 M12 8 L14.5 8" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M2.5 6.5 H13.5 M5.5 2 L5.5 4.5 M10.5 2 L10.5 4.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "skull":
      return (
        <svg {...common}>
          <path d="M8 2.5 C4.5 2.5 3 5 3 7.5 C3 9.5 4 10.5 5 11 L5 13 L11 13 L11 11 C12 10.5 13 9.5 13 7.5 C13 5 11.5 2.5 8 2.5 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <circle cx="6" cy="7.5" r="1.1" fill={color} />
          <circle cx="10" cy="7.5" r="1.1" fill={color} />
        </svg>
      );
    case "external":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="9" height="9" rx="1.5" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M9 3 L13 3 L13 7 M13 3 L8 8" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
};

const TOKEN_KIND: Record<IconToken, string> = {
  link: "link",
  search: "search",
  globe: "globe",
  pill: "pill",
  feather: "feather",
  featherRed: "feather",
  featherOrange: "feather",
  clock: "clock",
  person: "person",
  personYellow: "person",
  peopleGroup: "peopleGroup",
  sCircle: "person",
  atCircle: "person",
  fire: "clock",
  telegram: "telegram",
  xLogo: "xLogo",
  grid: "grid",
};

const ICON_COLOR: Partial<Record<IconToken, string>> = {
  feather: "#5FB8A8",
  featherRed: "#C25A5A",
  featherOrange: "#C98A4B",
  clock: "#5FB8A8",
  person: "#5FA8D4",
  peopleGroup: "#5FA8D4",
  grid: "#5FA8D4",
};

const BadgeDot: React.FC<{ kind: Badge }> = ({ kind }) => {
  if (kind === "warn") {
    return (
      <svg width={14} height={14} viewBox="0 0 16 16" style={{ display: "block" }}>
        <path d="M8 2 L15 13.5 L1 13.5 Z" fill="#E5A50A" />
        <rect x="7.3" y="6" width="1.4" height="4" fill="#181B23" />
      </svg>
    );
  }
  if (kind === "doc") {
    return (
      <svg width={14} height={14} viewBox="0 0 16 16" style={{ display: "block" }}>
        <rect x="2" y="2" width="12" height="12" rx="2" fill="#D9A441" />
        <path d="M4.5 5.5 H11.5 M4.5 8 H11.5 M4.5 10.5 H9" stroke="#181B23" strokeWidth={1.3} />
      </svg>
    );
  }
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" style={{ display: "block" }}>
      <circle cx="8" cy="8" r="6.5" fill="#35B36B" />
      <path d="M5 8 L7.2 10.2 L11 6.2" fill="none" stroke="#0E1116" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const SolanaBars: React.FC<{ size?: number }> = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: "block" }}>
    <path d="M3.5 3.5 H12 L10.5 5.5 H2 Z" fill="#41E8B0" />
    <path d="M2 7 H10.5 L12 9 H3.5 Z" fill="#7A78D8" />
    <path d="M3.5 10.5 H12 L10.5 12.5 H2 Z" fill="#9B5FE0" />
  </svg>
);

const T: React.FC<{
  size: number;
  color: string;
  weight?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ size, color, weight = 400, style, children }) => (
  <span style={{ fontSize: size, color, fontWeight: weight, lineHeight: 1, ...style }}>{children}</span>
);

const Row: React.FC<{ gap?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  gap = 6,
  style,
  children,
}) => (
  <div style={{ display: "flex", alignItems: "center", gap, ...style }}>{children}</div>
);

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

const CARD_H = 110;

type PGeom = {
  x: number; // avatar left, panel-local
  textX: number;
  box1X: number;
  box1W: number;
  box2X: number;
  box2W: number;
  right: number; // right text edge (panel-local)
  single?: boolean; // migrated single-box layout
};

const PulseCardRow: React.FC<{ card: PulseCard; y: number; geom: PGeom }> = ({ card, y, geom }) => {
  const iconTop = card.sub2 ? 46 : 32;
  const handleTop = card.sub2 ? 66 : 52;
  const pctTop = card.sub2 && card.handle ? 87 : card.handle ? 74 : 72;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: y,
        width: "100%",
        height: CARD_H,
        background: card.hovered ? C.hoverBg : undefined,
      }}
    >
      {/* avatar */}
      <div style={{ position: "absolute", left: geom.x, top: 11, width: 54, height: 54 }}>
        <Img
          src={staticFile(`realist-assets/ui/${card.avatar}`)}
          style={{
            width: 54,
            height: 54,
            borderRadius: 8,
            display: "block",
            border: card.ring ? `1.5px solid ${card.ring}` : undefined,
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -5,
            bottom: -5,
            width: 17,
            height: 17,
            borderRadius: 9,
            background: "#10231E",
            border: "1.5px solid #2E5A4C",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Glyph kind="pill" size={10} color="#57B58E" />
        </div>
      </div>
      {/* underline bar + address */}
      {card.bar.w > 0 ? (
        <div style={{ position: "absolute", left: geom.x - 6, top: 70, width: 66, height: 3, background: "#23262E", borderRadius: 2 }}>
          <div style={{ width: card.bar.w, height: 3, background: card.bar.color, borderRadius: 2 }} />
        </div>
      ) : null}
      {card.address ? (
        <div style={{ position: "absolute", left: geom.x - 6, top: 79 }}>
          <T size={12} color={C.addr}>
            {card.address}
          </T>
        </div>
      ) : null}
      {/* name row */}
      <Row gap={7} style={{ position: "absolute", left: geom.textX, top: 10 }}>
        <T size={15} color={card.hovered ? "#E4E2F5" : C.name} weight={600}>
          {card.name}
        </T>
        <T size={15} color={C.sub} style={{ fontFamily: `${FONT}, "Hiragino Sans"` }}>
          {card.sub}
        </T>
        {card.copyIcon ? <Glyph kind="copy" size={12} color="#565A66" /> : null}
        {card.badges?.map((b, i) => (
          <BadgeDot key={i} kind={b} />
        ))}
        {card.keyBadge ? (
          <Row gap={2}>
            <svg width={13} height={13} viewBox="0 0 16 16" style={{ display: "block" }}>
              <circle cx="5.5" cy="10.5" r="2.8" fill="none" stroke="#D9C243" strokeWidth={1.6} />
              <path d="M7.5 8.5 L13 3 M11 5 L13 7" stroke="#D9C243" strokeWidth={1.6} strokeLinecap="round" />
            </svg>
            <T size={12} color="#5FA8D4" weight={600}>
              {card.keyBadge}
            </T>
          </Row>
        ) : null}
      </Row>
      {card.sub2 ? (
        <div style={{ position: "absolute", left: geom.textX, top: 30 }}>
          <T size={11} color={card.sub2.color} weight={600}>
            {card.sub2.text}
          </T>
        </div>
      ) : null}
      {/* age + icons */}
      {card.age ? (
        <Row gap={11} style={{ position: "absolute", left: geom.textX, top: iconTop }}>
          <T size={13} color={card.ageColor ?? C.green} weight={600}>
            {card.age}
          </T>
          {card.timer ? (
            <Row gap={3} style={{ border: "1px solid #4A2E38", borderRadius: 9, padding: "2px 7px" }}>
              <Glyph kind="clock" size={10} color={card.timer.color} />
              <T size={12} color={card.timer.color} weight={600}>
                {card.timer.text}
              </T>
            </Row>
          ) : null}
          {card.icons.map((t, i) => (
            <Glyph key={i} kind={TOKEN_KIND[t]} size={14} color={ICON_COLOR[t] ?? C.icon} />
          ))}
          <Row gap={4} style={{ marginLeft: 6 }}>
            <Glyph kind="person" size={13} color={C.icon} />
            <T size={13} color={C.count} weight={600}>
              {card.people}
            </T>
          </Row>
          <Row gap={4}>
            <Glyph kind="bell" size={13} color={C.icon} />
            <T size={13} color={C.count} weight={600}>
              {card.bell}
            </T>
          </Row>
        </Row>
      ) : null}
      {/* handle */}
      {card.handle ? (
        <Row gap={6} style={{ position: "absolute", left: geom.textX, top: handleTop }}>
          <T size={12} color={card.handle.color} weight={600}>
            {card.handle.text}
          </T>
          {card.handle.num ? (
            <Row gap={3}>
              <Glyph kind="person" size={11} color={C.cyan} />
              <T size={12} color={C.cyan} weight={600}>
                {card.handle.num}
              </T>
            </Row>
          ) : null}
        </Row>
      ) : null}
      {/* percents */}
      {card.pct1.v ? (
        <Row gap={12} style={{ position: "absolute", left: geom.textX + 7, top: pctTop }}>
          <Row gap={3}>
            <Glyph kind="personRun" size={12} color={card.pct1.color} />
            <T size={12} color={card.pct1.color} weight={600}>
              {card.pct1.v}
            </T>
          </Row>
          <Row gap={3}>
            <Glyph kind={card.pct1Skull ? "skull" : "crown"} size={12} color={card.pct2.color} />
            <T size={12} color={card.pct2.color} weight={600}>
              {card.pct2.v}
            </T>
            <T size={12} color="#8A8D99" weight={500}>
              {card.pct2Suffix}
            </T>
          </Row>
          {card.paid ? (
            <Row gap={3} style={{ border: "1px solid #2E5A4C", borderRadius: 9, padding: "2px 7px" }}>
              <T size={11} color={C.paidGreen} weight={600}>
                {PAID_CHIP}
              </T>
            </Row>
          ) : null}
        </Row>
      ) : null}
      {/* V / MC line, right aligned */}
      <Row
        gap={4}
        style={{ position: "absolute", right: geom.right, top: 12, justifyContent: "flex-end" }}
      >
        <T size={11} color={C.label} weight={500}>
          V
        </T>
        <T size={14} color={card.hovered ? C.hoverText : C.textBright} weight={700}>
          {card.stats.v}
        </T>
        <T size={11} color={C.label} weight={500}>
          MC
        </T>
        <T size={14} color={card.stats.mcColor} weight={700}>
          {card.stats.mc}
        </T>
      </Row>
      {/* stat boxes */}
      {card.hovered ? (
        <Row gap={6} style={{ position: "absolute", right: geom.right, bottom: 16 }}>
          {["#2E5A4C", "#2E4A5A", "#5A4A2E"].map((b, i) => (
            <div
              key={i}
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                border: `1.5px solid ${b}`,
                background: "#14131C",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Glyph kind={i === 0 ? "pill" : i === 1 ? "clock" : "crown"} size={9} color={["#57B58E", "#5FA8D4", "#D9B845"][i]} />
            </div>
          ))}
        </Row>
      ) : geom.single ? (
        <div
          style={{
            position: "absolute",
            left: geom.box1X,
            top: 3,
            width: geom.box1W,
            height: 96,
            borderRadius: 8,
            border: `1px solid ${C.statBoxBorder}`,
            background: C.statBoxBg,
          }}
        >
          <Row gap={3} style={{ position: "absolute", left: 14, bottom: 26 }}>
            <Glyph kind="bolt" size={12} color={C.textBright} />
            <T size={13} color={C.textBright} weight={700}>
              {card.stats.single}
            </T>
          </Row>
        </div>
      ) : (
        <>
          <div
            style={{
              position: "absolute",
              left: geom.box1X,
              top: 3,
              width: geom.box1W,
              height: 96,
              borderRadius: 8,
              border: `1px solid ${C.statBoxBorder}`,
              background: C.statBoxBg,
            }}
          >
            <Row gap={3} style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 22 }}>
              <Glyph kind="bolt" size={12} color={C.textBright} />
              <T size={13} color={C.textBright} weight={700} style={{ whiteSpace: "nowrap" }}>
                {card.stats.chip1}
              </T>
            </Row>
          </div>
          <div
            style={{
              position: "absolute",
              left: geom.box2X,
              top: 3,
              width: geom.box2W,
              height: 96,
              borderRadius: 8,
              border: `1px solid ${C.statBoxBorder}`,
              background: C.statBoxBg,
            }}
          >
            <Row gap={3} style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 22 }}>
              <Glyph kind="bolt" size={12} color={C.textBright} />
              <T size={13} color={C.textBright} weight={700} style={{ whiteSpace: "nowrap" }}>
                {card.stats.chip2}
              </T>
            </Row>
          </div>
        </>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, background: "rgba(255,255,255,0.05)" }} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Column
// ---------------------------------------------------------------------------

const PulseColumn: React.FC<{
  x: number;
  w: number;
  headerIndex: number;
  cards: PulseCard[];
  geom: PGeom;
}> = ({ x, w, headerIndex, cards, geom }) => {
  const h = PULSE_HEADERS[headerIndex];
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 152,
        width: w,
        height: 1080 - 152,
        background: C.panelBg,
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* header */}
      <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: 44 }}>
        <div style={{ position: "absolute", left: 20, top: 14 }}>
          <T size={17} color="#DFE2EA" weight={600}>
            {h.title}
          </T>
        </div>
        <div
          style={{
            position: "absolute",
            left: w * 0.33,
            top: 11,
            width: w * 0.3,
            height: 24,
            borderBottom: "1px solid #23262F",
            display: "flex",
            alignItems: "center",
          }}
        >
          <T size={12} color="#565A66">
            {h.search}
          </T>
        </div>
        <Row gap={8} style={{ position: "absolute", right: 12, top: 12 }}>
          <Row gap={5}>
            <Glyph kind="bolt" size={11} color="#8A8D99" />
            <T size={13} color="#DFE2EA" weight={600}>
              {h.bolt}
            </T>
            <SolanaBars size={10} />
          </Row>
          {h.presets.map((p, i) => (
            <T key={p} size={12} color={i === h.activePreset ? C.purple : "#565A66"} weight={600}>
              {p}
            </T>
          ))}
          <Glyph kind={h.muted ? "mute" : "speaker"} size={13} color={C.icon} />
          <div style={{ position: "relative" }}>
            <Glyph kind="sliders" size={13} color={C.icon} />
            <div style={{ position: "absolute", right: -3, top: -3, width: 4, height: 4, borderRadius: 2, background: "#7C78C9" }} />
          </div>
        </Row>
      </div>
      {cards.map((card, i) => (
        <PulseCardRow key={i} card={card} y={50 + i * CARD_H} geom={geom} />
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

// panel-local geometry (panels: NewPairs x=12 w=638, FinalStretch x=651 w=615, Migrated x=1281 w=612)
const NP_GEOM: PGeom = { x: 22, textX: 90, box1X: 380, box1W: 109, box2X: 489, box2W: 123, right: 30 };
const FS_GEOM: PGeom = { x: 16, textX: 86, box1X: 384, box1W: 111, box2X: 498, box2W: 112, right: 8 };
const MIG_GEOM: PGeom = { x: 21, textX: 89, box1X: 431, box1W: 180, box2X: 0, box2W: 0, right: 8, single: true };

export const PulseScreen: React.FC<{ frame: number }> = () => {
  return (
    <AbsoluteFill style={{ background: C.pageBg, fontFamily: FONT, overflow: "hidden" }}>
      {/* ------------------------------------------------ top nav */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 55, background: C.navBg }}>
        {/* logo */}
        <Row gap={8} style={{ position: "absolute", left: 30, top: 15 }}>
          <svg width={26} height={24} viewBox="0 0 16 16" style={{ display: "block" }}>
            <path d="M8 2 L11 7 L5 7 Z" fill="#F2F4F9" />
            <path d="M3.5 13 L6 9 L10 9 L12.5 13 Z" fill="#F2F4F9" />
          </svg>
          <T size={20} color="#F2F4F9" weight={700} style={{ letterSpacing: 1 }}>
            {PNAV.logo}
          </T>
          <T size={13} color="#7C808C" weight={500}>
            {PNAV.logoSuffix}
          </T>
        </Row>
        <Row gap={30} style={{ position: "absolute", left: 180, top: 20 }}>
          {PNAV.items.map((it, i) => (
            <T key={it} size={14} color={i === PNAV.activeIndex ? C.purpleBright : "#9EA1AB"} weight={600}>
              {it}
            </T>
          ))}
        </Row>
        {/* notification chip */}
        <div
          style={{
            position: "absolute",
            left: 858,
            top: 4,
            width: 208,
            height: 47,
            borderRadius: 10,
            border: `1px solid ${C.notifBorder}`,
            background: "#14131C",
            boxShadow: "0 0 12px rgba(90,85,184,0.35)",
          }}
        >
          <Img
            src={staticFile(`realist-assets/ui/${PNAV.notif.avatar}`)}
            style={{ position: "absolute", left: 6, top: 5, width: 36, height: 36, borderRadius: 6 }}
          />
          <Row gap={5} style={{ position: "absolute", left: 50, top: 9 }}>
            <T size={12} color="#E4E6EC" weight={600}>
              {PNAV.notif.who}
            </T>
            <T size={12} color={C.greenMc} weight={600}>
              {PNAV.notif.verb}
            </T>
            <T size={12} color="#E4E6EC" weight={600}>
              {PNAV.notif.what}
            </T>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: "#E0507A" }} />
          </Row>
          <div style={{ position: "absolute", right: 8, top: 9 }}>
            <Glyph kind="close" size={11} color="#9EA1AB" />
          </div>
          <Row gap={4} style={{ position: "absolute", left: 50, top: 27 }}>
            <SolanaBars size={10} />
            <T size={12} color={C.greenMc} weight={600}>
              {PNAV.notif.line2Value}
            </T>
            <T size={12} color="#7C808C" weight={500}>
              {PNAV.notif.line2Tail}
            </T>
          </Row>
        </div>
        {/* search */}
        <Row
          gap={7}
          style={{
            position: "absolute",
            left: 1155,
            top: 13,
            width: 190,
            height: 28,
            padding: "0 10px",
            borderRadius: 14,
            background: "#1D202A",
          }}
        >
          <Glyph kind="search" size={13} color="#565A66" />
          <T size={13} color="#565A66">
            {PNAV.searchPlaceholder}
          </T>
          <T size={12} color="#565A66" style={{ marginLeft: "auto" }}>
            {PNAV.searchSlash}
          </T>
        </Row>
        {/* SOL selector */}
        <Row gap={5} style={{ position: "absolute", left: 1372, top: 19 }}>
          <SolanaBars size={12} />
          <T size={13} color="#E4E6EC" weight={600}>
            {PNAV.sol}
          </T>
          <Glyph kind="chevron" size={11} color="#7C808C" />
        </Row>
        {/* Deposit */}
        <div
          style={{
            position: "absolute",
            left: 1470,
            top: 13,
            height: 28,
            padding: "0 16px",
            borderRadius: 14,
            background: C.depositBg,
            display: "flex",
            alignItems: "center",
          }}
        >
          <T size={13} color={C.depositText} weight={600}>
            {PNAV.deposit}
          </T>
        </div>
        <div style={{ position: "absolute", left: 1563, top: 19 }}>
          <Glyph kind="star" size={15} color="#9EA1AB" />
        </div>
        <div style={{ position: "absolute", left: 1608, top: 19 }}>
          <Glyph kind="bell" size={15} color="#9EA1AB" />
        </div>
        {/* balances */}
        <Row gap={7} style={{ position: "absolute", left: 1650, top: 14, background: "#1A1D26", borderRadius: 13, padding: "5px 11px" }}>
          <Glyph kind="briefcase" size={13} color="#9EA1AB" />
          <SolanaBars size={10} />
          <T size={13} color="#E4E6EC" weight={600}>
            {PNAV.balance}
          </T>
          <div style={{ width: 12, height: 12, borderRadius: 6, background: "#2E5A8C" }} />
          <T size={13} color="#E4E6EC" weight={600}>
            {PNAV.zero}
          </T>
          <Glyph kind="chevron" size={11} color="#7C808C" />
        </Row>
        <div style={{ position: "absolute", left: 1836, top: 12, width: 30, height: 30, borderRadius: 15, background: "#EAEDF2" }}>
          <div style={{ position: "absolute", right: -1, bottom: -1, width: 11, height: 11, borderRadius: 6, background: "#2FA98C" }} />
        </div>
        <div style={{ position: "absolute", left: 1884, top: 19 }}>
          <Glyph kind="person" size={15} color="#9EA1AB" />
        </div>
      </div>

      {/* ------------------------------------------------ ticker strip */}
      <div style={{ position: "absolute", left: 0, top: 55, width: 1920, height: 34, borderBottom: "1px solid #15181F" }}>
        <Row gap={22} style={{ position: "absolute", left: 22, top: 9 }}>
          <Glyph kind="gear" size={14} color={C.icon} />
          <Glyph kind="star" size={14} color={C.icon} />
          <Glyph kind="chart" size={14} color={C.icon} />
          <div style={{ width: 1, height: 14, background: "#23262F" }} />
        </Row>
        <Row gap={26} style={{ position: "absolute", left: 140, top: 7 }}>
          {TICKER.map((e, i) => (
            <Row key={i} gap={6}>
              <div style={{ width: 14, height: 14, borderRadius: 4, background: e.icon }} />
              <T size={12} color="#9EA1AB" weight={600}>
                {e.label}
              </T>
              <T size={12} color="#9EA1AB" weight={600}>
                {e.cap}
              </T>
              <div style={{ background: "#1D1F2A", borderRadius: 5, padding: "3px 7px", display: "flex", alignItems: "center", gap: 4 }}>
                <Glyph kind="bolt" size={10} color="#63659A" />
                <T size={11} color="#63659A" weight={600}>
                  {e.sol}
                </T>
              </div>
            </Row>
          ))}
        </Row>
      </div>

      {/* ------------------------------------------------ heading row */}
      <div style={{ position: "absolute", left: 18, top: 106 }}>
        <Row gap={14}>
          <T size={25} color="#E7E9EE" weight={600}>
            {PHEADING.title}
          </T>
          <div style={{ background: "#171A22", borderRadius: 6, padding: "5px 6px" }}>
            <SolanaBars size={13} />
          </div>
          <svg width={18} height={18} viewBox="0 0 16 16">
            <path d="M8 1.5 L14 5 L14 11 L8 14.5 L2 11 L2 5 Z M2 5 L8 8.5 L14 5 M8 8.5 L8 14.5" fill="none" stroke="#B8963E" strokeWidth={1.1} strokeLinejoin="round" />
          </svg>
        </Row>
      </div>
      <Row gap={10} style={{ position: "absolute", left: 1184, top: 110 }}>
        {PHEADING.presetChips.map((p, i) => {
          const active = (PHEADING.activePresets as readonly number[]).includes(i);
          return (
            <Row
              key={p}
              gap={4}
              style={{
                borderRadius: 6,
                padding: "4px 9px",
                background: active ? "rgba(90,85,184,0.22)" : "#1A1D26",
                border: `1px solid ${active ? "#5A55B8" : "#23262F"}`,
              }}
            >
              <Glyph kind="copy" size={10} color={active ? "#A5A0E8" : "#7C808C"} />
              <T size={11} color={active ? "#A5A0E8" : "#9EA1AB"} weight={600}>
                {p}
              </T>
            </Row>
          );
        })}
        <Glyph kind="question" size={15} color={C.icon} />
        <Row gap={6} style={{ background: "#22252E", borderRadius: 15, padding: "7px 14px" }}>
          <Glyph kind="sliders" size={13} color="#DFE2EA" />
          <T size={14} color="#DFE2EA" weight={600}>
            {PHEADING.display}
          </T>
          <Glyph kind="chevron" size={11} color="#7C808C" />
        </Row>
        <div style={{ width: 8 }} />
        <Glyph kind="bookmark" size={14} color={C.icon} />
        <Glyph kind="monitor" size={14} color={C.icon} />
        <Glyph kind="speaker" size={14} color={C.icon} />
        <Glyph kind="target" size={14} color={C.icon} />
        <div style={{ width: 1, height: 14, background: "#23262F" }} />
        <Row gap={4}>
          <Glyph kind="calendar" size={13} color="#9EA1AB" />
          <T size={13} color="#C8CBD5" weight={600}>
            {PHEADING.walletChip}
          </T>
        </Row>
        <Row gap={4}>
          <SolanaBars size={11} />
          <T size={14} color="#F2F4F9" weight={700}>
            {PHEADING.balanceChip}
          </T>
          <Glyph kind="chevron" size={11} color="#7C808C" />
        </Row>
      </Row>

      {/* ------------------------------------------------ columns */}
      <PulseColumn x={12} w={638} headerIndex={0} cards={PULSE_NEW_PAIRS} geom={NP_GEOM} />
      <PulseColumn x={651} w={615} headerIndex={1} cards={PULSE_FINAL_STRETCH} geom={FS_GEOM} />
      <PulseColumn x={1281} w={612} headerIndex={2} cards={PULSE_MIGRATED} geom={MIG_GEOM} />
      {/* scrollbar */}
      <div style={{ position: "absolute", left: 1900, top: 205, width: 5, height: 260, borderRadius: 3, background: "#2E313B" }} />

      {/* ------------------------------------------------ docked trades panel */}
      <div
        style={{
          position: "absolute",
          left: 1272,
          top: 1008,
          width: 556,
          height: 72,
          background: C.dockBg,
          border: `1px solid ${C.dockBorder}`,
          borderRadius: "10px 10px 0 0",
          boxShadow: "0 -6px 20px rgba(0,0,0,0.4)",
        }}
      >
        <Row gap={14} style={{ position: "absolute", left: 12, top: 10 }}>
          <Row gap={5}>
            <SolanaBars size={11} />
            <T size={13} color={C.purpleBright} weight={600}>
              {DOCK.owner}
            </T>
          </Row>
          {DOCK.tabs.map((t, i) => (
            <div key={t} style={{ position: "relative" }}>
              <T size={13} color={i === DOCK.activeTab ? "#F2F4F9" : "#7C808C"} weight={i === DOCK.activeTab ? 700 : 500}>
                {t}
              </T>
              {i >= 1 ? (
                <div style={{ position: "absolute", right: -5, top: -2, width: 4, height: 4, borderRadius: 2, background: "#E0507A" }} />
              ) : null}
            </div>
          ))}
          <Glyph kind="gear" size={13} color={C.icon} />
          <Glyph kind="filter" size={13} color="#7C78C9" />
          <T size={12} color="#7C808C" weight={600}>
            {DOCK.preset}
          </T>
          <Row gap={3}>
            <Glyph kind="bolt" size={11} color="#57B58E" />
            <T size={13} color="#F2F4F9" weight={700}>
              {DOCK.bolt}
            </T>
            <SolanaBars size={10} />
          </Row>
        </Row>
        <Row gap={12} style={{ position: "absolute", right: 12, top: 10 }}>
          <Glyph kind="external" size={13} color={C.icon} />
          <Glyph kind="close" size={13} color={C.icon} />
        </Row>
        {/* column header row */}
        <Row style={{ position: "absolute", left: 12, top: 46, width: 532 }}>
          <Glyph kind="gear" size={11} color="#565A66" />
          <T size={12} color="#7C808C" weight={500} style={{ marginLeft: 14, width: 130 }}>
            {DOCK.columns[0]}
          </T>
          <T size={12} color="#7C808C" weight={500} style={{ width: 150 }}>
            {DOCK.columns[1]}
          </T>
          <T size={12} color="#7C808C" weight={500} style={{ width: 140 }}>
            {DOCK.columns[2]}
          </T>
          <T size={12} color="#7C808C" weight={500} style={{ marginLeft: "auto" }}>
            {DOCK.columns[3]}
          </T>
        </Row>
      </div>
    </AbsoluteFill>
  );
};
