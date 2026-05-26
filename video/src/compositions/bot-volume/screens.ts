// Three "data → proof" screens for the bot-volume beat. Each opens on a big
// number over a blurred source article, then the number leaves and the article
// comes into focus, scrolling to each proof phrase as it underlines itself.
//
// House pattern (from AttentionVolume): the article is a mock card styled after
// a recognizable outlet; the precise citation rides the source line. The figures
// and studies are real (web research, May 2026):
//   1A  algorithmic share of equity volume — industry estimates, 2025
//   2A  Investing.com survey of 938 U.S. investors, April 2026
//   2B  retail share of the algorithmic-trading market — industry data, 2025

export type Seg = { t: string; mark?: boolean };
export type BrandKey = "ft" | "investing" | "bloomberg";

export interface ProofScreen {
  id: string;
  /** big hero number, e.g. "60–70%" */
  hero: string;
  /** one line under the number */
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

export const SCREEN_DUR = 290;

export const SCREENS: ProofScreen[] = [
  {
    id: "BotVolume1A",
    hero: "60–70%",
    heroSub: "of all stock-market trading is run by machines",
    brand: "ft",
    title: "Algorithms now run most of the market",
    author: "Markets Team",
    date: "2025",
    paragraphs: [
      [{ t: "The machines are no longer a sideshow. They are the market." }],
      [
        { t: "Algorithmic and high-frequency strategies now account for " },
        { t: "60–70% of all equity trading volume", mark: true },
        { t: ", by most estimates." },
      ],
      [{ t: "It is a share that took two decades to build, climbing from roughly 15% in 2003." }],
      [
        { t: "Since then the figure has " },
        { t: "plateaued near the top of that range", mark: true },
        { t: ", where it remains today." },
      ],
    ],
    source: "Algorithmic share of equity trading volume — industry estimates, 2025",
  },
  {
    id: "BotVolume2A",
    hero: "62%",
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
  {
    id: "BotVolume2B",
    hero: "~43%",
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
];
