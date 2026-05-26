// Three "data → proof" screens for the bot-volume beat. Each opens on a big
// number over a blurred source article, then the number leaves and the article
// comes into focus with its proof phrases underlining themselves.
//
// Sources are real, pulled from web research (May 2026):
//  1A  QuantifiedStrategies — "What Percentage of Trading Is Algorithmic?" (2025)
//  2A  ADVISOR Magazine — Investing.com survey of 938 U.S. investors (Apr 2026)
//  2B  SpencerLogic — "Rise of the Retail Algo-Trader" (2025)

export type Seg = { t: string; mark?: boolean };

export interface ProofScreen {
  id: string;
  /** big hero number, e.g. "60–70%" */
  hero: string;
  /** one line under the number */
  heroSub: string;
  /** masthead brand */
  brand: string;
  title: string;
  author: string;
  date: string;
  /** article body — each paragraph is a run of segments; mark:true wipes in */
  paragraphs: Seg[][];
  /** precise on-screen citation shown during the proof phase */
  source: string;
}

export const SCREEN_DUR = 230;

export const SCREENS: ProofScreen[] = [
  {
    id: "BotVolume1A",
    hero: "60–70%",
    heroSub: "of all stock-market trading is run by machines",
    brand: "QuantifiedStrategies",
    title: "What Percentage of Trading Is Algorithmic?",
    author: "Research Desk",
    date: "2025",
    paragraphs: [
      [
        { t: "By most estimates, algorithmic and high-frequency strategies now account for " },
        { t: "60–70% of total trading volume", mark: true },
        { t: " in major equity markets." },
      ],
      [
        { t: "The share climbed from roughly 15% in 2003 and has " },
        { t: "plateaued near the top of that range", mark: true },
        { t: " ever since." },
      ],
    ],
    source: "QuantifiedStrategies — “What Percentage of Trading Is Algorithmic?”, 2025",
  },
  {
    id: "BotVolume2A",
    hero: "62%",
    heroSub: "of U.S. retail investors now use AI to trade",
    brand: "ADVISOR Magazine",
    title: "How Retail Investors Are Using AI in 2026",
    author: "Markets Desk",
    date: "April 2026",
    paragraphs: [
      [
        { t: "In a survey of 938 American investors, " },
        { t: "nearly two-thirds — 62% — have used AI tools", mark: true },
        { t: " to assist with their investment decisions." },
      ],
      [
        { t: "Among them, " },
        { t: "65% say it improved their performance", mark: true },
        { t: ", and most expect to lean on it more." },
      ],
    ],
    source: "ADVISOR Magazine — Investing.com survey of 938 investors, April 2026",
  },
  {
    id: "BotVolume2B",
    hero: "~43%",
    heroSub: "of the algorithmic-trading market is now retail",
    brand: "SpencerLogic",
    title: "Rise of the Retail Algo-Trader",
    author: "Industry Analysis",
    date: "2025",
    paragraphs: [
      [
        { t: "Retail investors now account for " },
        { t: "approximately 43% of the algorithmic-trading market", mark: true },
        { t: " — up sharply from a few years ago." },
      ],
      [
        { t: "No-code builders and LLM prompts have " },
        { t: "put automated strategies within reach of anyone", mark: true },
        { t: " with a laptop." },
      ],
    ],
    source: "SpencerLogic — “Rise of the Retail Algo-Trader”, 2025",
  },
];
