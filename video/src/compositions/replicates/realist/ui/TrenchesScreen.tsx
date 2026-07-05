import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import {
  COLORS as C,
  NAV,
  HEADING,
  COLUMN_HEADERS,
  RIGHT_CONTROLS,
  STAT_LABELS,
  NEW_CARDS,
  SOON_CARDS,
  MIGRATED_CARDS,
  TOAST,
  ZOOM_TABLE,
  ageAt,
  IconToken,
  TrenchCard,
  Badge,
} from "./copy/trenches";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const FONT = `${fontFamily}, -apple-system, sans-serif`;

// ---------------------------------------------------------------------------
// Tiny glyph vocabulary — 12–14px line icons approximating the Axiom set.
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
    case "featherRed":
    case "featherOrange":
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
    case "personYellow":
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
    case "pause":
      return (
        <svg {...common}>
          <rect x="4.5" y="3.5" width="2.2" height="9" rx="1" fill={color} />
          <rect x="9.3" y="3.5" width="2.2" height="9" rx="1" fill={color} />
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
    case "filter":
      return (
        <svg {...common}>
          <path d="M3 4 L13 4 L9.5 8.5 L9.5 12.5 L6.5 11 L6.5 8.5 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
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
    case "history":
      return (
        <svg {...common}>
          <path d="M3 8 A5 5 0 1 1 4.5 11.5 M3 8 L3 5 M3 8 L6 8" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <path d="M8 5.5 L8 8 L10 9.5" fill="none" stroke={color} strokeWidth={sw * 0.9} strokeLinecap="round" />
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
    case "eyeSlash":
      return (
        <svg {...common}>
          <path d="M2 8 C3.5 5 5.5 3.8 8 3.8 C10.5 3.8 12.5 5 14 8 C12.5 11 10.5 12.2 8 12.2 C5.5 12.2 3.5 11 2 8 Z" fill="none" stroke={color} strokeWidth={sw} />
          <line x1="3.5" y1="13" x2="12.5" y2="3" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "bookmark":
      return (
        <svg {...common}>
          <path d="M4.5 2.5 L11.5 2.5 L11.5 13.5 L8 10.8 L4.5 13.5 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "clipboard":
      return (
        <svg {...common}>
          <rect x="3.5" y="3" width="9" height="11" rx="1.5" fill="none" stroke={color} strokeWidth={sw} />
          <rect x="5.8" y="1.8" width="4.4" height="2.4" rx="1" fill="none" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <line x1="4" y1="4" x2="12" y2="12" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <line x1="12" y1="4" x2="4" y2="12" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...common}>
          <path d="M4.5 6.5 L8 10 L11.5 6.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
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
    case "cup":
      return (
        <svg {...common}>
          <path d="M3.5 5 L12.5 5 L11.4 11.3 A2 2 0 0 1 9.4 13 L6.6 13 A2 2 0 0 1 4.6 11.3 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M2.5 6.5 L4 6.5 M12 6.5 L13.5 6.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "personRun":
      return (
        <svg {...common}>
          <circle cx="8" cy="4" r="1.8" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M5 13 L7 9 L8 7 M8 7 L11 8.5 M8 7 L6 7.5 M9.5 13 L8.5 9.8" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "fire":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.8" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M8 4.5 C9.5 6 10.5 7.5 10.5 9 A2.5 2.5 0 0 1 5.5 9 C5.5 7.8 6.5 6 8 4.5 Z" fill={color} opacity={0.8} />
        </svg>
      );
    case "telegram":
      return (
        <svg {...common}>
          <path d="M13.5 3 L2.5 7.5 L6 9 L7 13 L9 10.2 L12 12 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "sCircle":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.8" fill="none" stroke={color} strokeWidth={sw} />
          <text x="8" y="11" textAnchor="middle" fontSize="8" fontWeight={700} fill={color}>
            S
          </text>
        </svg>
      );
    case "atCircle":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.8" fill="none" stroke={color} strokeWidth={sw} />
          <text x="8" y="11" textAnchor="middle" fontSize="8.5" fontWeight={600} fill={color}>
            @
          </text>
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
    default:
      return null;
  }
};

const ICON_COLOR: Partial<Record<IconToken, string>> = {
  feather: "#5FB8A8",
  featherRed: "#C25A5A",
  featherOrange: "#C98A4B",
  clock: "#5FB8A8",
  person: "#5FA8D4",
  personYellow: "#C9B24B",
  peopleGroup: "#5FA8D4",
  sCircle: "#5FB8A8",
  atCircle: "#5FB8A8",
  fire: "#C9962E",
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
  sCircle: "sCircle",
  atCircle: "atCircle",
  fire: "fire",
  telegram: "telegram",
  xLogo: "xLogo",
  grid: "grid",
};

const BadgeDot: React.FC<{ kind: Badge }> = ({ kind }) => {
  if (kind === "warn") {
    return (
      <svg width={14} height={14} viewBox="0 0 16 16" style={{ display: "block" }}>
        <path d="M8 2 L15 13.5 L1 13.5 Z" fill={C.badgeWarn} />
        <rect x="7.3" y="6" width="1.4" height="4" fill="#1A1D24" />
        <rect x="7.3" y="11" width="1.4" height="1.4" fill="#1A1D24" />
      </svg>
    );
  }
  if (kind === "doc") {
    return (
      <svg width={14} height={14} viewBox="0 0 16 16" style={{ display: "block" }}>
        <rect x="2" y="2" width="12" height="12" rx="2" fill={C.badgeDoc} />
        <path d="M4.5 5.5 H11.5 M4.5 8 H11.5 M4.5 10.5 H9" stroke="#1A1D24" strokeWidth={1.3} />
      </svg>
    );
  }
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" style={{ display: "block" }}>
      <circle cx="8" cy="8" r="6.5" fill={C.badgeCheck} />
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

// ---------------------------------------------------------------------------
// Shared bits of text
// ---------------------------------------------------------------------------

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

type CardGeom = {
  x: number; // avatar Img position == the plate crop origin of the av-*.png assets
  avShift: number; // px the crop missed on the avatar's left (true box starts x-avShift)
  barX: number; // progress bar left, panel-local (measured f0300)
  textX: number; // name column
  box1X: number;
  box2X: number;
  boxW1: number;
  boxW2: number;
};

const CARD_H = 117;

const TrenchCardRow: React.FC<{ card: TrenchCard; y: number; geom: CardGeom; frame: number }> = ({
  card,
  y,
  geom,
  frame,
}) => {
  const age = ageAt(card.ages, frame);
  let { v: stV, mc: stMc, mcColor: stMcColor, f: stF } = card.stats;
  for (const step of card.statSteps ?? []) {
    if (frame >= step.at) {
      if (step.v !== undefined) stV = step.v;
      if (step.mc !== undefined) stMc = step.mc;
      if (step.mcColor !== undefined) stMcColor = step.mcColor;
      if (step.fee !== undefined) stF = step.fee;
    }
  }
  return (
    <div style={{ position: "absolute", left: 0, top: y, width: "100%", height: CARD_H }}>
      {/* avatar — the asset IS a plate crop taken at exactly this position, so no
          borderRadius (corners are baked) and no drawn pump badge (baked too).
          Where the crop missed the avatar's left strip (Soon/Migrated), an
          underlay copy shifted left approximates the missing columns. */}
      <div style={{ position: "absolute", left: geom.x, top: 11, width: 52, height: 52 }}>
        {geom.avShift > 0 ? (
          <Img
            src={staticFile(`realist-assets/ui/${card.avatar}`)}
            style={{ position: "absolute", left: -geom.avShift, top: 0, width: 52, height: 52, display: "block" }}
          />
        ) : null}
        <Img
          src={staticFile(`realist-assets/ui/${card.avatar}`)}
          style={{ position: "absolute", left: 0, top: 0, width: 52, height: 52, display: "block" }}
        />
      </div>
      {/* progress bar + address */}
      <div style={{ position: "absolute", left: geom.barX, top: 71, width: 62, height: 3, background: "#23262E", borderRadius: 2 }}>
        <div style={{ width: card.bar.w, height: 3, background: card.bar.color, borderRadius: 2 }} />
      </div>
      <div style={{ position: "absolute", left: geom.barX + 3, top: 79 }}>
        <T size={11} color={C.addr}>
          {card.address}
        </T>
      </div>
      {/* name row */}
      <Row gap={7} style={{ position: "absolute", left: geom.textX, top: 8 }}>
        <T size={14} color={C.name} weight={600}>
          {card.name}
        </T>
        <T size={14} color={C.sub} style={{ fontFamily: `${FONT}, "Hiragino Sans"` }}>
          {card.sub}
        </T>
        {card.badges?.map((b, i) => (
          <BadgeDot key={i} kind={b} />
        ))}
      </Row>
      {card.sub2 ? (
        <div style={{ position: "absolute", left: geom.textX, top: 26 }}>
          <T size={11} color={card.sub2.color} weight={600}>
            {card.sub2.text}
          </T>
        </div>
      ) : null}
      {/* age + icon row */}
      <Row gap={11} style={{ position: "absolute", left: geom.textX, top: card.sub2 ? 40 : 30 }}>
        <T size={12} color={card.ageColor ?? C.green} weight={600}>
          {age}
        </T>
        {card.timer ? (
          <Row
            gap={3}
            style={{
              border: `1px solid #2E5A4C`,
              borderRadius: 9,
              padding: "2px 7px",
            }}
          >
            <Glyph kind="chart" size={10} color={C.timerGreen} />
            <T size={12} color={C.timerGreen} weight={600}>
              {card.timer}
            </T>
          </Row>
        ) : null}
        {card.icons.map((t, i) => (
          <Glyph key={i} kind={TOKEN_KIND[t]} size={13} color={ICON_COLOR[t] ?? C.icon} />
        ))}
        <Row gap={4} style={{ marginLeft: 6 }}>
          <Glyph kind="person" size={12} color={C.icon} />
          <T size={12} color={C.count} weight={600}>
            {card.people}
          </T>
        </Row>
        <Row gap={4}>
          <Glyph kind="bell" size={12} color={C.icon} />
          <T size={12} color={C.count} weight={600}>
            {card.bell}
          </T>
        </Row>
      </Row>
      {/* handle row */}
      {card.handle ? (
        <Row gap={6} style={{ position: "absolute", left: geom.textX, top: card.sub2 ? 62 : 52 }}>
          <T size={12} color={card.handle.color} weight={600}>
            {card.handle.text}
          </T>
          {card.handle.num ? (
            <T size={12} color={C.yellowNum} weight={600}>
              {card.handle.num}
            </T>
          ) : null}
          {card.handle.num2 ? (
            <T size={12} color={card.handle.num2Color ?? C.red} weight={600}>
              {card.handle.num2}
            </T>
          ) : null}
        </Row>
      ) : null}
      {/* percent row */}
      <Row gap={12} style={{ position: "absolute", left: geom.textX + 7, top: 73 }}>
        <Row gap={3}>
          <Glyph kind="personRun" size={12} color={card.pct1.color} />
          <T size={12} color={card.pct1.color} weight={600}>
            {card.pct1.v}
          </T>
        </Row>
        <Row gap={3}>
          <Glyph kind="cup" size={12} color={card.pct2.color} />
          <T size={12} color={card.pct2.color} weight={600}>
            {card.pct2.v}
          </T>
          <T size={12} color="#8A8D99" weight={500}>
            {card.pct2Suffix}
          </T>
        </Row>
      </Row>
      {/* mid rows (B. Curve / ATH) */}
      {card.midRows ? (
        <div style={{ position: "absolute", left: geom.box1X - 66, top: 58 }}>
          {card.midRows.map((r, i) => (
            <Row key={i} gap={8} style={{ marginBottom: 3 }}>
              <T size={11} color={C.sub} weight={500} style={{ width: 46 }}>
                {r.label}
              </T>
              <T size={11} color={r.valueColor} weight={600}>
                {r.value}
              </T>
            </Row>
          ))}
        </div>
      ) : null}
      {/* stat box 1 (empty, bright border) — plate f0300: outer y198..305, so
          card-local top 0, outer height 107 (105 + 2px borders) */}
      <div
        style={{
          position: "absolute",
          left: geom.box1X,
          top: 0,
          width: geom.boxW1,
          height: 105,
          borderRadius: 8,
          border: `1px solid ${C.box1Border}`,
        }}
      >
        <Row gap={3} style={{ position: "absolute", right: 8, bottom: 12 }}>
          <Glyph kind="bolt" size={11} color={C.textBright} />
          <T size={12} color={C.textBright} weight={700}>
            {card.stats.chip1}
          </T>
        </Row>
      </div>
      {/* stat box 2 */}
      <div
        style={{
          position: "absolute",
          left: geom.box2X,
          top: 0,
          width: geom.boxW2,
          height: 105,
          borderRadius: 8,
          border: `1px solid ${C.box2Border}`,
          background: C.box2Bg,
        }}
      >
        <Row gap={4} style={{ position: "absolute", right: 8, top: 5 }}>
          <T size={11} color={C.label} weight={500}>
            {STAT_LABELS.v}
          </T>
          <T size={14} color={C.textBright} weight={700}>
            {stV}
          </T>
          <T size={11} color={C.label} weight={500}>
            {STAT_LABELS.mc}
          </T>
          <T size={14} color={stMcColor} weight={700}>
            {stMc}
          </T>
        </Row>
        <Row gap={3} style={{ position: "absolute", right: 8, top: 26 }}>
          <T size={11} color={C.label} weight={500}>
            {STAT_LABELS.f}
          </T>
          <SolanaBars size={9} />
          <T size={11} color={C.textBright} weight={600}>
            {stF}
          </T>
        </Row>
        <Row gap={3} style={{ position: "absolute", right: 8, bottom: 12 }}>
          <Glyph kind="bolt" size={11} color={C.textBright} />
          <T size={12} color={C.textBright} weight={700}>
            {card.stats.chip2}
          </T>
        </Row>
      </div>
      {/* divider */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, background: C.cardDivider }} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Column
// ---------------------------------------------------------------------------

const Column: React.FC<{
  x: number;
  w: number;
  headerIndex: number;
  cards: TrenchCard[];
  geom: CardGeom;
  frame: number;
}> = ({ x, w, headerIndex, cards, geom, frame }) => {
  const h = COLUMN_HEADERS[headerIndex];
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 142,
        width: w,
        height: 1080 - 142,
        background: C.panelBg,
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* header */}
      <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: 50 }}>
        <Row gap={8} style={{ position: "absolute", left: 17, top: 16 }}>
          <T size={15} color="#DFE2EA" weight={600}>
            {h.title}
          </T>
          {h.paused ? <Glyph kind="pause" size={13} color={C.purple} /> : null}
          {h.soonChip ? (
            <Row gap={0} style={{ border: "1px solid #2C2F3A", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ padding: "3px 7px", background: "#22252E" }}>
                <SolanaBars size={10} />
              </div>
              <div style={{ padding: "3px 7px", borderLeft: "1px solid #2C2F3A" }}>
                <T size={10} color={C.sub} weight={600}>
                  {STAT_LABELS.mc}
                </T>
              </div>
            </Row>
          ) : null}
        </Row>
        {/* search */}
        <div
          style={{
            position: "absolute",
            left: w * 0.42,
            top: 12,
            width: w * 0.25,
            height: 26,
            borderBottom: "1px solid #23262F",
            display: "flex",
            alignItems: "center",
          }}
        >
          <T size={13} color="#565A66">
            {h.search}
          </T>
        </div>
        {/* right cluster — left-anchored at panel-local x (measured f0300:
            bolt 428, value right-aligned to 470, sol 475, preset 505, chart 534, mute 567, filter 597) */}
        <div style={{ position: "absolute", left: 420, top: 11, height: 26, borderRadius: 6, background: "#12151B", display: "flex", alignItems: "center", padding: "0 8px", gap: 5 }}>
          <Glyph kind="bolt" size={11} color="#8A8D99" />
          <div style={{ width: 27, textAlign: "right" }}>
            <T size={12} color="#DFE2EA" weight={600}>
              {h.bolt}
            </T>
          </div>
          <SolanaBars size={10} />
        </div>
        <div style={{ position: "absolute", left: 505, top: 17 }}>
          <T size={12} color={C.sub} weight={600}>
            {h.preset}
          </T>
        </div>
        <div style={{ position: "absolute", left: 534, top: 17 }}>
          <Glyph kind="chart" size={13} color={C.icon} />
        </div>
        <div style={{ position: "absolute", left: 567, top: 17 }}>
          <Glyph kind="mute" size={13} color={C.icon} />
        </div>
        <div style={{ position: "absolute", left: 597, top: 17 }}>
          <Glyph kind="filter" size={13} color={C.icon} />
          <div style={{ position: "absolute", right: -3, top: -3, width: 4, height: 4, borderRadius: 2, background: "#7C78C9" }} />
        </div>
      </div>
      {/* cards (positions are column-local: panel top is y=142, cards start at 198-142=56) */}
      {cards.map((card, i) => (
        <TrenchCardRow key={i} card={card} y={56 + i * CARD_H} geom={geom} frame={frame} />
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

const ExecutingToast: React.FC<{ y: number; opacity: number; spinPhase: number }> = ({ y, opacity, spinPhase }) => (
  <div
    style={{
      position: "absolute",
      left: 1631,
      top: y,
      width: 285,
      height: 74,
      background: C.toastBg,
      border: `1px solid ${C.toastBorder}`,
      borderRadius: 10,
      boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
      opacity,
    }}
  >
    {/* spinner */}
    <svg
      width={14}
      height={14}
      viewBox="0 0 16 16"
      style={{ position: "absolute", left: 12, top: 11, transform: `rotate(${spinPhase}deg)` }}
    >
      <circle cx="8" cy="8" r="6" fill="none" stroke="#3A3D6E" strokeWidth={2} />
      <path d="M8 2 A6 6 0 0 1 14 8" fill="none" stroke="#7C78C9" strokeWidth={2} strokeLinecap="round" />
    </svg>
    <div style={{ position: "absolute", left: 31, top: 9 }}>
      <T size={12} color="#BFC2CC" weight={600}>
        {TOAST.title}
      </T>
    </div>
    <div style={{ position: "absolute", right: 10, top: 15 }}>
      <Glyph kind="close" size={12} color={C.icon} />
    </div>
    <Row gap={5} style={{ position: "absolute", left: 31, top: 32 }}>
      <T size={12} color="#9EA1AB" weight={500}>
        {TOAST.buyPrefix}
      </T>
      <Img
        src={staticFile("realist-assets/ui/av-pumpwheel.png")}
        style={{ width: 13, height: 13, borderRadius: 7, display: "block" }}
      />
      <T size={12} color={C.green} weight={600}>
        {TOAST.coin}
      </T>
      <T size={12} color="#9EA1AB" weight={500}>
        {TOAST.buySuffix}
      </T>
    </Row>
    <Row gap={12} style={{ position: "absolute", left: 31, top: 56 }}>
      {TOAST.counts.map((c, i) => (
        <Row key={i} gap={4}>
          <T size={11} color="#9EA1AB" weight={500}>
            {c.label}
          </T>
          <T size={11} color={C.name} weight={600}>
            {c.value}
          </T>
        </Row>
      ))}
    </Row>
  </div>
);

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const zoomAt = (frame: number) => {
  const fs = ZOOM_TABLE.map((k) => k.f);
  const s = interpolate(frame, fs, ZOOM_TABLE.map((k) => k.s), {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tx = interpolate(frame, fs, ZOOM_TABLE.map((k) => k.tx), {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ty = interpolate(frame, fs, ZOOM_TABLE.map((k) => k.ty), {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { s, tx, ty };
};

// panel-local coordinates (panel origins: New x=12, Soon x=650, Migrated x=1289)
// box edges + bars re-measured on plate f0300 (luma edge profiles)
const NEW_GEOM: CardGeom = { x: 15, avShift: 0, barX: 10, textX: 79, box1X: 328, box2X: 470, boxW1: 136, boxW2: 137 };
const SOON_GEOM: CardGeom = { x: 25, avShift: 9, barX: 12, textX: 82, box1X: 334, box2X: 479, boxW1: 139, boxW2: 140 };
const MIG_GEOM: CardGeom = { x: 24, avShift: 8, barX: 10, textX: 81, box1X: 329, box2X: 471, boxW1: 136, boxW2: 137 };

export const TrenchesScreen: React.FC<{ frame: number }> = ({ frame }) => {
  const { s, tx, ty } = zoomAt(frame);
  const toast1 = interpolate(
    frame,
    [TOAST.toast1AppearFrame, TOAST.toast1AppearFrame + TOAST.fadeFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const toast2 = interpolate(
    frame,
    [TOAST.toast2AppearFrame, TOAST.toast2AppearFrame + TOAST.fadeFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // The reference is a compressed screen recording; when the editor zoom
  // scales it up the footage softens further. Match that optical character —
  // re-tuned after the zoom refit: sigma ~1.5 at s=1.0, ~2.5 at s=1.37.
  const blurPx = 1.5 + 2.7 * (s - 1);

  return (
    <AbsoluteFill style={{ background: C.pageBg, fontFamily: FONT, overflow: "hidden" }}>
      <AbsoluteFill style={{ filter: `blur(${blurPx}px)` }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1920,
          height: 1080,
          transform: `translate(${tx}px, ${ty}px) scale(${s})`,
          transformOrigin: "0 0",
        }}
      >
        {/* ------------------------------------------------ top nav */}
        <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 56, background: C.navBg }}>
          <Row gap={31} style={{ position: "absolute", left: 117, top: 22 }}>
            {NAV.items.map((it, i) => (
              <T key={it} size={13} color={i === NAV.activeIndex ? C.purple : "#9EA1AB"} weight={500}>
                {it}
              </T>
            ))}
          </Row>
          {/* Paste CA */}
          <Row
            gap={6}
            style={{
              position: "absolute",
              left: 1355,
              top: 14,
              height: 26,
              padding: "0 12px",
              borderRadius: 14,
              background: "#171A22",
              border: "1px solid #23262F",
            }}
          >
            <Glyph kind="clipboard" size={12} color="#9EA1AB" />
            <T size={13} color="#C8CBD5" weight={500}>
              {NAV.pasteCa}
            </T>
          </Row>
          {/* search */}
          <Row
            gap={7}
            style={{
              position: "absolute",
              left: 1448,
              top: 14,
              width: 175,
              height: 26,
              padding: "0 10px",
              borderRadius: 14,
              background: "#12151B",
              border: "1px solid #23262F",
            }}
          >
            <Glyph kind="search" size={12} color="#565A66" />
            <T size={12} color="#565A66">
              {NAV.searchPlaceholder}
            </T>
            <div
              style={{
                marginLeft: "auto",
                width: 16,
                height: 16,
                borderRadius: 8,
                border: "1px solid #2C2F3A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <T size={10} color="#565A66">
                {NAV.searchSlash}
              </T>
            </div>
          </Row>
          {/* wallet chips */}
          <Row gap={10} style={{ position: "absolute", left: 1652, top: 15 }}>
            <Row gap={5} style={{ background: "#171A22", borderRadius: 12, padding: "4px 10px" }}>
              <Glyph kind="briefcase" size={12} color="#9EA1AB" />
              <T size={13} color="#C8CBD5" weight={600}>
                {NAV.chips.wallet}
              </T>
              <div style={{ width: 1, height: 12, background: "#2C2F3A" }} />
              <T size={13} color="#C8CBD5" weight={600}>
                {NAV.chips.mid}
              </T>
              <T size={13} color="#C8CBD5" weight={600}>
                {NAV.chips.right}
              </T>
              <SolanaBars size={10} />
              <Glyph kind="chevron" size={11} color="#565A66" />
            </Row>
            <Glyph kind="gear" size={14} color="#9EA1AB" />
            <Glyph kind="person" size={14} color="#9EA1AB" />
          </Row>
        </div>

        {/* ------------------------------------------------ toolbar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 56,
            width: 1920,
            height: 28,
            borderBottom: "1px solid #15181F",
          }}
        >
          <Row gap={22} style={{ position: "absolute", left: 12, top: 7 }}>
            <Glyph kind="history" size={14} color={C.icon} />
            <Glyph kind="chart" size={14} color={C.icon} />
            <Glyph kind="star" size={14} color={C.icon} />
            <Glyph kind="gear" size={14} color={C.icon} />
            <div style={{ width: 1, height: 14, background: "#23262F" }} />
          </Row>
        </div>

        {/* ------------------------------------------------ heading
            (plate f0300 ink: title rows 106-119 cols 11-126, bare sol bars
            144-152 @111-117, cube ~154-172 @104-118, tiny beta pill ~156-174
            @117-126 — no chip bg around the bars) */}
        <div style={{ position: "absolute", left: 12, top: 103 }}>
          <Row gap={13}>
            <T size={18} color="#E7E9EE" weight={600}>
              {HEADING.title}
            </T>
          </Row>
        </div>
        <div style={{ position: "absolute", left: 143, top: 107 }}>
          <SolanaBars size={11} />
        </div>
        <svg width={17} height={17} viewBox="0 0 16 16" style={{ position: "absolute", left: 154, top: 102 }}>
          <path
            d="M8 1.5 L14 5 L14 11 L8 14.5 L2 11 L2 5 Z M2 5 L8 8.5 L14 5 M8 8.5 L8 14.5"
            fill="none"
            stroke="#8A8D99"
            strokeWidth={1.1}
            strokeLinejoin="round"
          />
        </svg>
        <div
          style={{
            position: "absolute",
            left: 156,
            top: 116,
            background: "#22252E",
            border: "1px solid #2C2F3A",
            borderRadius: 5,
            padding: "1px 3px",
            fontSize: 7,
            lineHeight: 1,
            color: "#9EA1AB",
            fontWeight: 600,
          }}
        >
          {HEADING.beta}
        </div>
        {/* right controls */}
        <Row gap={12} style={{ position: "absolute", left: 1712, top: 102 }}>
          <Glyph kind="question" size={16} color={C.icon} />
          <Row gap={6} style={{ background: "#22252E", borderRadius: 14, padding: "6px 12px" }}>
            <Glyph kind="gear" size={12} color="#C8CBD5" />
            <T size={13} color="#C8CBD5" weight={600}>
              {RIGHT_CONTROLS.customize}
            </T>
          </Row>
          <div style={{ background: "#171A22", borderRadius: 8, padding: 6 }}>
            <Glyph kind="eyeSlash" size={14} color="#9EA1AB" />
          </div>
          <div style={{ background: "#171A22", borderRadius: 8, padding: 6 }}>
            <Glyph kind="bookmark" size={14} color="#9EA1AB" />
          </div>
        </Row>

        {/* ------------------------------------------------ columns */}
        <Column x={12} w={624} headerIndex={0} cards={NEW_CARDS} geom={NEW_GEOM} frame={frame} />
        <Column x={650} w={623} headerIndex={1} cards={SOON_CARDS} geom={SOON_GEOM} frame={frame} />
        <Column x={1289} w={624} headerIndex={2} cards={MIGRATED_CARDS} geom={MIG_GEOM} frame={frame} />
      </div>

      </AbsoluteFill>
      {/* toasts are screen-fixed overlays; the plate renders them crisp, so they
          sit outside the page blur with only a light softening of their own */}
      <AbsoluteFill style={{ filter: "blur(0.7px)" }}>
        {toast1 > 0 ? <ExecutingToast y={12} opacity={toast1} spinPhase={(frame * 14) % 360} /> : null}
        {toast2 > 0 ? <ExecutingToast y={95} opacity={toast2} spinPhase={(frame * 14 + 120) % 360} /> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
