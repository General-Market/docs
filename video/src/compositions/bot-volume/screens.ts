// Two "data → proof" screens for the bot-volume beat. Each opens on a chart
// over a blurred source article, then the chart leaves and the article comes
// into focus, scrolling to each proof phrase as it underlines itself.
//
// House pattern (from AttentionVolume): the article is a mock card styled after
// a recognizable outlet; the precise citation rides the source line. The figures
// are real (web research, May 2026):
//   pie     retail share of the algorithmic-trading market — industry data, 2025
//   waffle  Investing.com survey of 938 U.S. investors, April 2026

export type Seg = { t: string; mark?: boolean };
export type BrandKey = "ft" | "investing" | "bloomberg";

export type Hero =
  | { kind: "pie"; pct: number; blueLabel: string; greyLabel: string }
  | { kind: "waffle"; filled: number; total: number };

export interface ProofScreen {
  id: string;
  hero: Hero;
  /** one line under the chart */
  heroSub: string;
  brand: BrandKey;
  title: string;
  author: string;
  date: string;
  /** article body — uniform 4 paragraphs, proofs in #2 and #4 (mark:true wipes in) */
  paragraphs: Seg[][];
  /** precise on-screen citation shown during the proof phase */
  source: string;
}

export const SCREEN_DUR = 195;

export const SCREENS: ProofScreen[] = [
  {
    id: "BotVolumePie",
    hero: { kind: "pie", pct: 43, blueLabel: "Retail", greyLabel: "Institutional" },
    heroSub: "of the algorithmic-trading market is now retail",
    brand: "bloomberg",
    title: "Retail traders are building their own bots",
    author: "Olivia Raeburn",
    date: "2025",
    paragraphs: [
      [{ t: "The barrier that kept ordinary traders out of automation has quietly fallen." }],
      [
        { t: "Retail investors now make up " },
        { t: "about 43% of the algorithmic-trading market", mark: true },
        { t: ", up sharply from a few years ago." },
      ],
      [{ t: "No-code builders and language models did the work an engineering team used to." }],
      [
        { t: "A working strategy is now " },
        { t: "within reach of anyone with a laptop", mark: true },
        { t: " and a prompt." },
      ],
    ],
    source: "Retail share of the algorithmic-trading market — industry data, 2025",
  },
  {
    id: "BotVolumeWaffle",
    hero: { kind: "waffle", filled: 62, total: 100 },
    heroSub: "of U.S. retail investors now use AI to trade",
    brand: "investing",
    title: "Most retail investors now trade with AI",
    author: "Markets Desk",
    date: "April 2026",
    paragraphs: [
      [{ t: "The tools that once belonged to hedge funds are now in everyone’s hands." }],
      [
        { t: "In a survey of 938 American investors, " },
        { t: "nearly two-thirds — 62% — now use AI tools", mark: true },
        { t: " to guide their decisions." },
      ],
      [{ t: "The shift has been quick, and the people using it are not looking back." }],
      [
        { t: "Among them, " },
        { t: "65% say it improved their performance", mark: true },
        { t: " — and most expect to use it more." },
      ],
    ],
    source: "Investing.com — survey of 938 U.S. investors, April 2026",
  },
];
