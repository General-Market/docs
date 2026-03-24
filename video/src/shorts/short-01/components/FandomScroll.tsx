import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

interface Props {
  scrollSpeed?: number; // pixels per frame, default 3
  /** Global frame offset for continuous scrolling across Series shots */
  globalFrameOffset?: number;
}

const FONT_FAMILY = "'Switzer', 'Inter', 'Helvetica Neue', sans-serif";

// ── Fake wiki content data ──────────────────────────────────────────

const TOC_ITEMS = [
  "1 Overview",
  "2 Top Manga 2026",
  "3 Monthly Views",
  "4 Fan Engagement Score",
  "5 Methodology",
  "6 Historical Rankings",
  "7 Community Polls",
  "8 See Also",
  "9 References",
];

const STAT_BOXES: { label: string; value: string; color: string }[] = [
  { label: "Total Rankings", value: "12,847", color: "#4a90d9" },
  { label: "Active Voters", value: "2.3M", color: "#e8a735" },
  { label: "Manga Tracked", value: "4,102", color: "#5cb85c" },
  { label: "Weekly Updates", value: "187", color: "#d9534f" },
];

const TOP_MANGA_TABLE = [
  { rank: 1, title: "One Piece", score: "9.87", views: "142.3M", trend: "+2.1%" },
  { rank: 2, title: "Jujutsu Kaisen", score: "9.72", views: "98.7M", trend: "+5.4%" },
  { rank: 3, title: "Chainsaw Man", score: "9.65", views: "87.1M", trend: "+3.8%" },
  { rank: 4, title: "My Hero Academia", score: "9.41", views: "76.4M", trend: "-1.2%" },
  { rank: 5, title: "Spy x Family", score: "9.38", views: "71.2M", trend: "+4.7%" },
  { rank: 6, title: "Demon Slayer", score: "9.35", views: "68.9M", trend: "-0.5%" },
  { rank: 7, title: "Blue Lock", score: "9.21", views: "54.3M", trend: "+8.2%" },
  { rank: 8, title: "Dandadan", score: "9.18", views: "49.7M", trend: "+12.1%" },
  { rank: 9, title: "Sakamoto Days", score: "9.05", views: "43.2M", trend: "+6.3%" },
  { rank: 10, title: "Kaiju No. 8", score: "8.97", views: "39.8M", trend: "+3.1%" },
];

// ── Sub-components ──────────────────────────────────────────────────

const FandomHeader: React.FC = () => (
  <div
    style={{
      width: "100%",
      height: 56,
      backgroundColor: "#1a1a2e",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 20px",
      boxSizing: "border-box",
      borderBottom: "3px solid #00d6d6",
      flexShrink: 0,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          backgroundColor: "#00d6d6",
          color: "#1a1a2e",
          fontFamily: FONT_FAMILY,
          fontSize: 18,
          fontWeight: 900,
          letterSpacing: 3,
          padding: "4px 14px",
          borderRadius: 3,
        }}
      >
        FANDOM
      </div>
      <span
        style={{
          color: "#888",
          fontFamily: FONT_FAMILY,
          fontSize: 13,
        }}
      >
        Manga Wiki
      </span>
    </div>
    {/* Search icon */}
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="9" cy="9" r="6.5" stroke="#888" strokeWidth="2" />
        <line x1="13.5" y1="13.5" x2="18" y2="18" stroke="#888" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          backgroundColor: "#333",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#aaa",
          fontFamily: FONT_FAMILY,
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        U
      </div>
    </div>
  </div>
);

const WikiNavBar: React.FC = () => (
  <div
    style={{
      width: "100%",
      height: 36,
      backgroundColor: "#2a2a3e",
      display: "flex",
      alignItems: "center",
      gap: 0,
      flexShrink: 0,
    }}
  >
    {["Article", "Talk", "Edit", "History"].map((tab, i) => (
      <div
        key={tab}
        style={{
          padding: "8px 18px",
          fontFamily: FONT_FAMILY,
          fontSize: 12,
          fontWeight: i === 0 ? 700 : 400,
          color: i === 0 ? "#fff" : "#999",
          backgroundColor: i === 0 ? "#3a3a5e" : "transparent",
          borderBottom: i === 0 ? "2px solid #00d6d6" : "none",
        }}
      >
        {tab}
      </div>
    ))}
  </div>
);

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: "1px solid #ddd",
      marginTop: 32,
      marginBottom: 14,
      paddingBottom: 6,
    }}
  >
    <h2
      style={{
        fontFamily: FONT_FAMILY,
        fontSize: 22,
        fontWeight: 700,
        color: "#333",
        margin: 0,
      }}
    >
      {children}
    </h2>
    <span
      style={{
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: "#4a90d9",
        cursor: "pointer",
      }}
    >
      [edit]
    </span>
  </div>
);

const Paragraph: React.FC<{ text: string }> = ({ text }) => (
  <p
    style={{
      fontFamily: FONT_FAMILY,
      fontSize: 14,
      lineHeight: 1.7,
      color: "#444",
      margin: "10px 0",
    }}
  >
    {text}
  </p>
);

// ── Main component ──────────────────────────────────────────────────

export const FandomScroll: React.FC<Props> = ({ scrollSpeed = 3, globalFrameOffset = 0 }) => {
  const frame = useCurrentFrame();

  // Use global frame for continuous scroll across Series shots
  const globalFrame = frame + globalFrameOffset;

  // Smooth scroll position
  const scrollY = interpolate(globalFrame, [0, 9999], [0, 9999 * scrollSpeed], {
    extrapolateRight: "extend",
  });

  // Vignette opacity pulsates very subtly
  const vignettePulse = 0.55 + Math.sin(frame * 0.02) * 0.05;

  return (
    <AbsoluteFill>
      {/* Screen-recording frame with rounded corners */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 8px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)",
        }}
      >
        {/* Scrollable wiki page */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${-scrollY}px)`,
            willChange: "transform",
          }}
        >
          {/* ── Fandom header (sticky look) ── */}
          <FandomHeader />
          <WikiNavBar />

          {/* ── Article content area ── */}
          <div
            style={{
              display: "flex",
              width: "100%",
              backgroundColor: "#f5f5f5",
              minHeight: 6000,
            }}
          >
            {/* ── Table of Contents sidebar ── */}
            <div
              style={{
                width: 220,
                flexShrink: 0,
                backgroundColor: "#eaeaea",
                padding: "20px 14px",
                borderRight: "1px solid #ddd",
              }}
            >
              <div
                style={{
                  fontFamily: FONT_FAMILY,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#555",
                  marginBottom: 10,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Contents
              </div>
              {TOC_ITEMS.map((item, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: FONT_FAMILY,
                    fontSize: 12,
                    color: "#4a90d9",
                    padding: "5px 0",
                    borderBottom: "1px solid #ddd",
                  }}
                >
                  {item}
                </div>
              ))}

              {/* Sidebar ad placeholder */}
              <div
                style={{
                  marginTop: 24,
                  padding: 14,
                  backgroundColor: "#ddd",
                  borderRadius: 4,
                  textAlign: "center" as const,
                }}
              >
                <div
                  style={{
                    fontFamily: FONT_FAMILY,
                    fontSize: 10,
                    color: "#999",
                    marginBottom: 6,
                  }}
                >
                  ADVERTISEMENT
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 180,
                    backgroundColor: "#ccc",
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>

            {/* ── Main content ── */}
            <div
              style={{
                flex: 1,
                padding: "24px 30px",
                backgroundColor: "#fff",
              }}
            >
              {/* Article title */}
              <h1
                style={{
                  fontFamily: FONT_FAMILY,
                  fontSize: 32,
                  fontWeight: 800,
                  color: "#222",
                  margin: 0,
                  paddingBottom: 8,
                  borderBottom: "2px solid #eee",
                }}
              >
                Manga Rankings
              </h1>

              <div
                style={{
                  fontFamily: FONT_FAMILY,
                  fontSize: 11,
                  color: "#999",
                  marginTop: 6,
                  marginBottom: 20,
                }}
              >
                From Manga Wiki, the free manga encyclopedia
              </div>

              {/* Infobox */}
              <div
                style={{
                  float: "right" as const,
                  width: 260,
                  marginLeft: 20,
                  marginBottom: 16,
                  border: "1px solid #ccc",
                  borderRadius: 4,
                  backgroundColor: "#f9f9f9",
                  padding: 14,
                }}
              >
                <div
                  style={{
                    fontFamily: FONT_FAMILY,
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#333",
                    textAlign: "center" as const,
                    marginBottom: 10,
                    backgroundColor: "#e8e8e8",
                    padding: "6px 0",
                    borderRadius: 3,
                  }}
                >
                  Manga Rankings 2026
                </div>
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                  {[
                    ["Type", "Weekly Popularity Index"],
                    ["Publisher", "Multiple"],
                    ["Frequency", "Weekly"],
                    ["First published", "2019"],
                    ["Entries", "4,102 manga"],
                    ["Active voters", "2.3M+"],
                  ].map(([label, value], i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontFamily: FONT_FAMILY,
                        fontSize: 11,
                        borderBottom: "1px solid #eee",
                        paddingBottom: 4,
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "#555" }}>{label}</span>
                      <span style={{ color: "#333" }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Paragraph text="The Manga Rankings are a comprehensive weekly index tracking the popularity and engagement metrics of manga series across global platforms. Compiled from over 40 million pages of community-contributed data, the rankings serve as the definitive barometer for manga popularity worldwide." />

              <Paragraph text="Since their inception in 2019, the rankings have grown to encompass over 4,100 tracked series with data aggregated from reading platforms, community votes, social media engagement, and merchandise sales figures. The methodology was revised in Q3 2025 to incorporate streaming viewership data." />

              {/* ── Section: Top Manga 2026 ── */}
              <SectionHeader>Top Manga 2026</SectionHeader>

              <Paragraph text="The following table represents the current standings as of February 2026, incorporating viewership data, community engagement scores, and critical reception across major platforms." />

              {/* Rankings table */}
              <div
                style={{
                  width: "100%",
                  borderCollapse: "collapse" as const,
                  border: "1px solid #ddd",
                  borderRadius: 4,
                  overflow: "hidden",
                  marginBottom: 20,
                }}
              >
                {/* Table header */}
                <div
                  style={{
                    display: "flex",
                    backgroundColor: "#4a90d9",
                    color: "#fff",
                    fontFamily: FONT_FAMILY,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  <div style={{ width: 50, padding: "8px 6px", textAlign: "center" as const }}>#</div>
                  <div style={{ flex: 1, padding: "8px 6px" }}>Title</div>
                  <div style={{ width: 60, padding: "8px 6px", textAlign: "center" as const }}>Score</div>
                  <div style={{ width: 80, padding: "8px 6px", textAlign: "right" as const }}>Views</div>
                  <div style={{ width: 60, padding: "8px 6px", textAlign: "right" as const }}>Trend</div>
                </div>
                {/* Table rows */}
                {TOP_MANGA_TABLE.map((row, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      backgroundColor: i % 2 === 0 ? "#fff" : "#f7f7f7",
                      fontFamily: FONT_FAMILY,
                      fontSize: 12,
                      color: "#333",
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    <div
                      style={{
                        width: 50,
                        padding: "7px 6px",
                        textAlign: "center" as const,
                        fontWeight: 700,
                        color: i < 3 ? "#e8a735" : "#666",
                      }}
                    >
                      {row.rank}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        padding: "7px 6px",
                        fontWeight: 600,
                        color: "#4a90d9",
                      }}
                    >
                      {row.title}
                    </div>
                    <div style={{ width: 60, padding: "7px 6px", textAlign: "center" as const }}>
                      {row.score}
                    </div>
                    <div style={{ width: 80, padding: "7px 6px", textAlign: "right" as const }}>
                      {row.views}
                    </div>
                    <div
                      style={{
                        width: 60,
                        padding: "7px 6px",
                        textAlign: "right" as const,
                        color: row.trend.startsWith("+") ? "#5cb85c" : "#d9534f",
                        fontWeight: 600,
                      }}
                    >
                      {row.trend}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Section: Monthly Views ── */}
              <SectionHeader>Monthly Views</SectionHeader>

              <Paragraph text="Monthly aggregate viewership across all tracked platforms has shown consistent growth, reaching 781 million unique visits in January 2026. This represents a 23% year-over-year increase driven primarily by the simulcast expansion into Latin American and Southeast Asian markets." />

              {/* Stat boxes */}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginTop: 16,
                  marginBottom: 24,
                  flexWrap: "wrap" as const,
                }}
              >
                {STAT_BOXES.map((stat, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      minWidth: 120,
                      backgroundColor: "#f9f9f9",
                      border: `2px solid ${stat.color}`,
                      borderRadius: 6,
                      padding: "12px 10px",
                      textAlign: "center" as const,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: FONT_FAMILY,
                        fontSize: 22,
                        fontWeight: 800,
                        color: stat.color,
                      }}
                    >
                      {stat.value}
                    </div>
                    <div
                      style={{
                        fontFamily: FONT_FAMILY,
                        fontSize: 10,
                        color: "#888",
                        marginTop: 4,
                        textTransform: "uppercase" as const,
                        letterSpacing: 0.5,
                      }}
                    >
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              <Paragraph text="The distribution of views shows a heavy concentration in the top 50 series, which account for approximately 68% of all traffic. The long tail of niche and classic manga, however, has been growing at a faster rate of 31% year-over-year." />

              {/* ── Section: Fan Engagement Score ── */}
              <SectionHeader>Fan Engagement Score</SectionHeader>

              <Paragraph text="The Fan Engagement Score (FES) is a proprietary metric combining reading frequency, discussion participation, merchandise interest, and event attendance. It is normalized on a 0-100 scale with quarterly recalibration." />

              {/* Did You Know callout */}
              <div
                style={{
                  backgroundColor: "#fff8e1",
                  border: "1px solid #e8a735",
                  borderLeft: "4px solid #e8a735",
                  borderRadius: 4,
                  padding: "14px 18px",
                  margin: "20px 0",
                }}
              >
                <div
                  style={{
                    fontFamily: FONT_FAMILY,
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#8a6d3b",
                    marginBottom: 6,
                  }}
                >
                  Did You Know?
                </div>
                <div
                  style={{
                    fontFamily: FONT_FAMILY,
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: "#666",
                  }}
                >
                  The average manga fan spends 4.7 hours per week reading manga and another 3.2 hours
                  discussing it online. Combined, this represents over 6 billion hours of free analytical
                  labor contributed to the community each year — none of which is compensated.
                </div>
              </div>

              <Paragraph text="Series with the highest FES tend to correlate strongly with merchandise sales, suggesting that deeply engaged fans are also the most commercially valuable segment. Despite this, community contributors who write wiki articles, create tier lists, and moderate discussions receive no financial compensation." />

              {/* Another section for more scroll content */}
              <SectionHeader>Methodology</SectionHeader>

              <Paragraph text="Rankings are compiled weekly using a weighted composite of the following data sources: platform readership statistics (35%), community voting aggregated across 12 major forums (25%), social media mention velocity (20%), and critical review scores (20%)." />

              <Paragraph text="Data collection occurs via API partnerships with major reading platforms and web scraping of publicly available statistics. All data is anonymized and aggregated before analysis. The methodology committee reviews and updates the weighting formula on a quarterly basis." />

              {/* Citation needed tags */}
              <div
                style={{
                  fontFamily: FONT_FAMILY,
                  fontSize: 11,
                  color: "#999",
                  fontStyle: "italic" as const,
                  margin: "16px 0",
                  padding: "10px 14px",
                  backgroundColor: "#f5f5f5",
                  borderRadius: 4,
                  border: "1px solid #eee",
                }}
              >
                This section needs additional citations for verification. Please help improve this
                article by adding citations to reliable sources.
                <span style={{ color: "#4a90d9", marginLeft: 4 }}>[citation needed]</span>
              </div>

              <SectionHeader>Historical Rankings</SectionHeader>

              <Paragraph text="The first edition of the rankings was published in March 2019 with coverage of 847 series. Growth has been exponential: by 2022 the index covered 2,100 series, and by 2025 it expanded to over 4,000. The addition of webtoon and manhwa titles in 2024 represented the largest single expansion of scope." />

              <Paragraph text="Notable shifts include the rapid rise of Dandadan and Sakamoto Days in late 2025, which displaced several long-running series from the top 10 for the first time in three years. Analysts attribute this to shifting demographics as Gen Z readers increasingly favor high-energy action series with unconventional narratives." />

              <SectionHeader>Community Polls</SectionHeader>

              <Paragraph text="Bi-weekly community polls supplement the quantitative rankings with qualitative sentiment data. Over 780,000 unique participants contributed to polls in 2025, casting a total of 14.2 million votes across various categories including 'Best Arc,' 'Most Improved,' and 'Biggest Disappointment.'" />

              <Paragraph text="Poll data is cross-referenced with reading statistics to identify discrepancies between critical sentiment and actual engagement. These discrepancies often serve as leading indicators for upcoming ranking shifts." />

              {/* References section */}
              <SectionHeader>References</SectionHeader>

              <div style={{ fontFamily: FONT_FAMILY, fontSize: 11, color: "#666", lineHeight: 1.8 }}>
                {[
                  "1. Global Manga Market Report 2026, Statista Research Department",
                  '2. "The Rise of Fan Analytics," Journal of Digital Media Studies, Vol. 14',
                  "3. Crunchyroll Annual Report FY2025, Sony Pictures Entertainment",
                  '4. "Community-Driven Content Valuation," Harvard Business Review, Dec 2025',
                  '5. "Gen Z Media Consumption Patterns," Pew Research Center, 2025',
                  "6. Fandom Platform Statistics, Q4 2025 Investor Presentation",
                  '7. "Manga Economy: The Trillion-Yen Fan Machine," Nikkei Asia, Jan 2026',
                ].map((ref, i) => (
                  <div key={i} style={{ marginBottom: 4 }}>
                    {ref}
                  </div>
                ))}
              </div>

              {/* Categories footer */}
              <div
                style={{
                  marginTop: 40,
                  paddingTop: 16,
                  borderTop: "1px solid #ddd",
                  display: "flex",
                  flexWrap: "wrap" as const,
                  gap: 6,
                }}
              >
                {[
                  "Manga",
                  "Rankings",
                  "Anime",
                  "Fan Culture",
                  "Market Analysis",
                  "Webtoons",
                  "Community",
                ].map((cat, i) => (
                  <span
                    key={i}
                    style={{
                      fontFamily: FONT_FAMILY,
                      fontSize: 10,
                      color: "#4a90d9",
                      backgroundColor: "#eef4fb",
                      padding: "3px 8px",
                      borderRadius: 3,
                      border: "1px solid #d0e0f0",
                    }}
                  >
                    {cat}
                  </span>
                ))}
              </div>

              {/* Extra padding so scroll keeps going */}
              <div style={{ height: 600 }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Warm manga tint overlay (10% opacity orange) ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(255, 140, 50, 0.10)",
          pointerEvents: "none",
          borderRadius: 12,
        }}
      />

      {/* ── Vignette effect ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          borderRadius: 12,
          pointerEvents: "none",
          background: `radial-gradient(ellipse 70% 60% at 50% 50%, transparent 0%, rgba(0,0,0,${vignettePulse}) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
