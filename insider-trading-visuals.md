# Insider Trading Visuals — Series Brainstorm

Cinematic micro-visualizers for X. Same visual grammar as `video/src/compositions/insider-trading/InsiderCases.tsx`: document on a white card, brand logo card on the right, yellow highlighter underline with red kick, dark blurred backdrop, beat-synced cuts, camera pushes into the damning phrase.

The first chapter exists. Nine more wait.

---

## 1. SEC ENFORCEMENT FILINGS — `InsiderFilings.tsx`

```
        ┌──────────────────────────────────┐
        │  UNITED STATES OF AMERICA        │
        │  SECURITIES AND EXCHANGE COMM.   │      ┌──────────────┐
        │                                  │      │              │
        │  In the Matter of:               │      │   ⚖ SEC      │
        │  ░░░░░░░░░░ DOE                  │      │              │
        │                                  │      │              │
        │  CEASE AND DESIST ORDER          │      └──────────────┘
        │                                  │
        │  ...the Respondent traded        │
        │  on ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓     │  ← yellow underline
        │  ════════════                    │  ← red punch
        │  material non-public information │
        │                                  │
        │  Civil penalty: $4,287,000       │
        └──────────────────────────────────┘
```

Real filings from sec.gov/litigation/admin. Logo card cycles through SEC, DOJ, FBI, FINRA. Move the argument from "newspaper said it" to "the government convicted them."

---

## 2. THE COURTROOM ROLL — `InsiderConvictions.tsx`

```
┌────────────────────────────────────────┐
│  RAJAT GUPTA                           │
│  Goldman Sachs board member            │  ┌──────────────┐
│                                        │  │              │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                │  │   GOLDMAN    │
│  Convicted, insider trading            │  │     SACHS    │
│  ═══════════════════════               │  │              │
│                                        │  └──────────────┘
│  Sentenced: 2 years                    │
│  Released: 2016                        │
└────────────────────────────────────────┘
```

Seven names. Gupta. Boesky. Milken. Stewart. Rajaratnam. Drier. Martoma. Brand card on the right is the institution they betrayed: Goldman, Drexel, Galleon, SAC. After the seventh: "These are the ones who got caught."

---

## 3. THE TRANSACTION — `InsiderOnChain.tsx`

```
┌──────────────────────────────────────┐
│  Etherscan — Transaction             │
│                                      │   ┌──────────────┐
│  Hash: 0x4f7a9c8e...                 │   │              │
│  From: 0x7a2f...c891                 │   │   etherscan  │
│  To:   Polymarket: ConditionalTokens │   │              │
│  Value: ▓▓▓▓▓▓▓▓                     │   │              │
│         48,000 USDC                  │   └──────────────┘
│         ═══════════                  │
│  Time: Dec 14, 2024 14:24:07 UTC     │
│                                      │
│  News broke: 14:32:11 UTC            │
└──────────────────────────────────────┘
```

The receipt. Real on-chain proof. The underline lands on the timestamp gap. Camera pushes into "14:24" then "14:32" then the difference between them. Public ledger. No defamation risk. The blockchain is the evidence and the indictment.

---

## 4. THE PHONE RECORDS — `InsiderMessages.tsx`

```
┌─────────────────────────────────┐
│  iMessage — Mar 14, 2:47 AM     │
│                                 │   ┌──────────────┐
│  ┌─────────────────────────┐   │   │              │
│  │ heard something about   │   │   │   [ FBI      │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        │   │   │     SEAL ]   │
│  │ earnings — buy calls    │   │   │              │
│  │ ═══════════════════     │   │   └──────────────┘
│  └─────────────────────────┘   │
│                                 │
│  ┌──────────────────────┐      │
│  │ how much?            │      │
│  └──────────────────────┘      │
│                                 │
│  ┌─────────────────────────┐   │
│  │ all of it.              │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

Recovered messages from real cases. SAC, Galleon, the Mathew Martoma trial. Underline the words that became evidence. Brand card: the prosecuting office. The intimacy of an iMessage bubble next to a federal seal — that's the contrast.

---

## 5. THE FRONT PAGE THROUGH TIME — `InsiderDecades.tsx`

```
WSJ 1986        BARRON'S 1987       NYT 2001        FT 2009        BLOOMBERG 2024
┌────────┐      ┌────────┐          ┌────────┐      ┌────────┐     ┌────────┐
│ BOESKY │      │ MILKEN │          │ MARTHA │      │ GUPTA  │     │ CRYPTO │
│  ▓▓▓▓  │      │ ▓▓▓▓▓▓ │          │ ▓▓▓▓▓  │      │ ▓▓▓▓▓  │     │ ▓▓▓▓▓▓ │
│ ════   │      │ ══════ │          │ ═════  │      │ ═════  │     │ ══════ │
└────────┘      └────────┘          └────────┘      └────────┘     └────────┘
   1986            1987                2001            2012            2024

           Five decades. One headline. They just changed the surnames.
```

Front pages from different eras, each underlining "insider trading," each entering on a beat. The visual style of the newsprint changes; the indictment doesn't. Forty years of the same crime in different fonts.

---

## 6. THE WALL OF SETTLEMENTS — `InsiderSettlements.tsx`

```
SEC INSIDER TRADING SETTLEMENTS — FY 2024

  $1.8M    Smith        Goldman       ▓▓▓▓▓▓▓
  $4.2M    Patel        Citadel       ▓▓▓▓▓▓▓
  $7.1M    Wong         Two Sigma     ▓▓▓▓▓▓▓
  $12.4M   Kovac        Renaissance   ▓▓▓▓▓▓▓
  $18.7M   Chen         Point72       ▓▓▓▓▓▓▓
  $24.0M   Anonymous    Citadel       ▓▓▓▓▓▓▓
  ...
  ─────────────────────────────────────
  TOTAL                                ████████
                                       $1.4 BILLION
                                       ═══════════
```

Roll through the settlements. Each line underlines as it enters. The total at the bottom is the punchline. Brand card cycles through the firms named. The visual rhyme: same highlighter as the articles, but applied to dollar amounts that compound.

---

## 7. THE WIKIPEDIA SCROLL — `InsiderWikipedia.tsx`

```
┌─────────────────────────────────────────────┐
│  List of insider trading incidents          │  ┌──────────────┐
│                                             │  │              │
│  ▸ Boesky, Ivan       1986                  │  │  WIKIPEDIA   │
│  ▸ Levine, Dennis     1986                  │  │              │
│  ▸ Milken, Michael    1989                  │  │              │
│  ▸ Cammarata, Larry   1991                  │  └──────────────┘
│  ▸ Stewart, Martha    2003                  │
│  ▸ Mozer, Paul        1991                  │
│  ▸ Stewart, James     2009                  │
│  ▸ Rajaratnam, Raj    2011                  │
│  ▸ Gupta, Rajat       2012                  │
│  ▸ Martoma, Mathew    2014                  │
│  ▸ Lee, Sang          2015                  │
│  ▸ Newman, Todd       2014                  │
│  ▸ Cohen, Steven      2016                  │
│  ▸ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓     ▓▓▓▓                  │  ← scroll & underline
│  ▸ ...                                      │     each new name
│  ▸ ...                                      │     as it enters
│  ▸ 470 entries below                        │
└─────────────────────────────────────────────┘
```

Slow vertical scroll. Names land on the beat. Each one lights up with the highlighter as it crosses a fixed centerline. The endless quality is the point — the page never ends, the names never stop.

---

## 8. THE BEFORE / AFTER — `InsiderTimeline.tsx`

```
        BEFORE                          AFTER
┌──────────────────┐              ┌──────────────────┐
│  Quarterly       │              │  Q3 EARNINGS     │
│  earnings        │   ┌──────┐   │  CRUSHED         │
│  preview         │   │  ⏱   │   │  ▓▓▓▓▓▓▓▓▓▓     │
│  ▓▓▓▓▓▓▓▓▓▓     │   │ 14m  │   │  ════════        │
│  ═══════         │   │      │   │                  │
│                  │   └──────┘   │  Stock −18%      │
│  (LinkedIn)      │              │  (CNBC)          │
└──────────────────┘              └──────────────────┘
   Insider's post                   What the market
     14 minutes                    learned 14 minutes
       earlier                          later
```

Two cards side by side instead of one + logo. Left: the leak. Right: the news. Underline the matching phrase in both. The 14-minute gap in the center is the proof. Camera pushes into the gap.

---

## 9. THE VOLUME SPIKE — `InsiderVolume.tsx`

```
┌──────────────────────────────────────────┐
│  Reuters — Unusual Options Activity      │
│                                          │   ┌──────────────┐
│  TICKER: ░░░░                            │   │              │
│                                          │   │   REUTERS    │
│  Avg daily call volume:    1,400         │   │              │
│  Volume on Mar 13:         ▓▓▓▓▓▓        │   │              │
│                            48,000        │   └──────────────┘
│                            ═══════       │
│  Multiplier:               34×           │
│                                          │
│  Acquisition announced:    Mar 14        │
└──────────────────────────────────────────┘
```

The "unusual activity" report — the kind regulators read every Monday and ignore every Friday. Reuters, Bloomberg, MarketWatch. Underline the multiplier. The math is the accusation. Brand cards cycle through every news outlet that reported "unusual activity" on the day before someone got rich.

---

## 10. THE PARTY — `InsiderConfession.tsx`

```
┌──────────────────────────────────────┐
│  Anonymous Telegram — leaked         │
│                                      │   ┌──────────────┐
│  ┌──────────────────────────┐        │   │              │
│  │ guys                     │        │   │   "INSIDER   │
│  │ Q3 numbers are ▓▓▓▓     │        │   │    TRADERS   │
│  │ ═══════                  │        │   │     CLUB"    │
│  │ buy calls now            │        │   │              │
│  └──────────────────────────┘        │   └──────────────┘
│                                      │
│  ┌────────────────────────┐         │
│  │ how do you know        │         │
│  └────────────────────────┘         │
│                                      │
│  ┌────────────────────────┐         │
│  │ i'm in the room        │         │
│  └────────────────────────┘         │
└──────────────────────────────────────┘
```

The chatroom evidence. Bloomberg published several of these in 2018–2024. Underline "in the room." The intimacy of group-chat slang attached to a federal indictment is the cinema.

---

## Series structure

Each composition reuses the existing primitives — `LogoCard`, `BrandPlate`, `HighlightLayer`, `PrologueZoomFinale` — so the visual identity doesn't fragment.

- **Chapter I** — `InsiderCases.tsx` (exists): seven exchanges, seven articles
- **Chapters II–X** — the nine above

One chapter per day on X. Ten days. No single video proves the thesis. The pattern proves it.

## Recommended build order

1. **`InsiderOnChain.tsx`** — most novel. Ports the camera language onto block explorer screenshots. Nobody else is doing this.
2. **`InsiderDecades.tsx`** — strongest emotional payload. Forty years, same crime.
3. **`InsiderFilings.tsx`** — strongest credibility. Government letterhead silences "but is it really?"

The rest follow when the first three land.
