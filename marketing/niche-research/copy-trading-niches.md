# Copy-Trading Niches — Outlier Pass for Vibe

> Research date 2026-06-08. Source: live X/Twitter via the `docs/x-targeting` harness (twitterapi.io). 41 `Top` searches across 4 languages and 6 asset classes. 644 deduped tweets cached at `docs/x-targeting/cache/copy_trading/tweets.jsonl`. Spend: **$0.11** of the $1 budget. Ledger: `docs/x-targeting/cache/twapi-ledger.jsonl` (cells `copy-en|cn|kr|jp`).

## TL;DR

The dream-user pattern Vibe should own is **"a trader turned $X into $Y — here is the exact framework, now run it yourself."** It is the single most repeatable, highest-engagement copy-trading motif in English, and the AI-agent version of it is the strongest outlier in the whole set.

| sub-niche | best language | repeatable post shape | engagement | Vibe fit | confidence |
|---|---|---|---:|---|---|
| AI-agent copy ("I gave an AI $50…") | EN, CN | result screenshot → "autonomous agent" → the loop it runs | 24,454 top fav | **Highest** — Vibe *is* the agent | High |
| Transformation framework thread | EN | famous trader + $X→$Y + "here's his strategy 🧵" | 9,173 top fav | **High** — the framework is the product | High |
| Smart-money / wallet copy | EN | "found wallets doing 6 figures/day → here's the tool" | 1,510 top fav | **High** — one-click wallet mirror | Medium-high |
| eToro / platform popular-investor | EN | structural "copy this portfolio" + reward path | 1,207 (20× repeat) | Medium — incumbent, crowded | High |
| Lead-trader 带单 / 喊单 (signal-calling) | CN | "teacher called $X, we held, +400万" | 8,141 top fav | Medium — distill the caller into a skill | Medium |
| Paid signal room 리딩방 | KR | **anti**-room confession: "I joined them all, lost money" | 2,523 top fav | Medium — sell the *escape* from rooms | High |
| Copy/mirror as scam コピトレ | JP | skeptic warning + "decide for yourself" | 670 top fav | Low — distrust is the default | High |
| Sports / politician mirror | EN | "tail my bets" / "mirror Pelosi's trades" | 4,255 top fav | Medium — same shape, new asset | Medium |

Therefore: build the framework-and-agent angle for the West, and the *escape-from-the-signal-room* angle for Korea and Japan. The same software, two opposite stories.

## The one finding that changes positioning

The copy-trading promise does not travel. It is trusted in English, tolerated in Chinese, and openly distrusted in Korean and Japanese.

| language | dominant frame | what the crowd rewards | what kills a post |
|---|---|---|---|
| **EN** | aspiration | "here is the framework that made $Y" | looking like a paid signal seller |
| **CN** | mechanism + AI | distilling a famous caller into a usable skill | bare 喊单 (calling without proof) |
| **KR** | suspicion | the creator who *refuses* the paid room | running a 리딩방 yourself |
| **JP** | warning | "mirror trading is 情弱刈り (preying on the ignorant)" | "+400pips, anyone can start" promo spam |

In Korea, the four highest copy-trading posts are all confessions against the paid signal room — *"I joined every 리딩방 and lost; there are no real masters, you have to do it yourself"* ([@admi_alts](https://x.com/admi_alts/status/2019623984078503959), ~1 min). In Japan, the top organic post calls copy-trading the textbook *joujaku-gari* — bait for the uninformed ([@romi_hoshino](https://x.com/romi_hoshino/status/2038904858070389053), ~1 min).

A tool that says "copy this trader" wins the West and loses the East. A tool that says "*understand* this trader's framework, then trade it yourself" wins both. The distrust is not an obstacle; it is the wedge.

## Method

We searched beyond a single keyword, because "copy trading" alone returns platform ads, not patterns.

| route | examples | result |
|---|---|---|
| Direct platform terms | `copy trading`, `copytrading`, `copy trade bybit/bitget`, eToro popular investor | Structural platform posts + the asymmetry meme |
| The dream phrasing | `"turned $" "into $"`, `"here is the framework"`, `"$1000 into $"` | The transformation thread, the literal dream-user shape |
| AI-agent terms | `AI bot`, `autonomous agent`, `polymarket`, `Grok3 trading bot`, `Claude Code` | The highest outliers in the set |
| Wallet / on-chain copy | `copy these wallets`, `smart money`, `GMGN copy trade`, `hyperliquid copy` | Memecoin sniper-wallet mirror posts |
| Local copy terms | 跟单 / 带单 / 喊单 (CN), 카피트레이딩 / 리딩방 / 따라매매 (KR), コピートレード / ミラートレード (JP) | The cultural-trust split above |
| Adjacent asset classes | options `follow my trades`, `tail my bets`, mirror-Pelosi, futures | Same shape, different instrument |

Per-cell sample size and engagement floor (median over the cell):

| cell | tweets | median fav | median views | median RT | top fav |
|---|---:|---:|---:|---:|---:|
| `copy-en` | 374 | 84 | 8,850 | 8 | 24,454 |
| `copy-cn` | 118 | 57 | 18,302 | 4 | 8,141 |
| `copy-kr` | 80 | 48 | 4,956 | 2 | 2,523 |
| `copy-jp` | 72 | 48 | 2,012 | 8 | 670 |

EN motif density (overlapping tags over 374 EN tweets): AI-agent copy **89**, transformation $X→$Y **86**, wallet/smart-money **81**, framework/thread **51**, sports tail **33**, options/politician **24**, signal-provider meta **22**. The dream, the agent, and the wallet are the three pillars — and they overlap, which is the opportunity.

Exception: `copy-cn` and `copy-jp` carry off-topic noise (Pokémon "mirror card" trades in JP; general personal-finance and spam in CN). The trading-relevant subset is what is cited below; raw text is in the cache for re-tagging.

## Sub-niche 1 — The AI-agent copy ("I gave an AI $50")

The strongest outlier in the entire dataset is not a human trader. It is a person handing money to a bot and narrating the loop.

| account | post | fav / views | what it does |
|---|---|---:|---|
| [@Argona0x](https://x.com/Argona0x/status/2021232172753936470) | "i gave an AI $50 and told it 'pay for yourself or you die'" | 24,454 / 4.76M | result + stakes + the 10-min loop, step by step |
| [@AshCrypto](https://x.com/AshCrypto/status/2047228760412274798) | "anthropic engineer turned $200 into $14,300 in Polymarket… Claude Code that ranks 14,000 wallets" | 3,081 / 398K | famous-source + method + "10 trades daily" |
| [@DefiWimar](https://x.com/DefiWimar/status/1892249864894812635) | "I LITERALLY CREATED A CRYPTO MONEY PRINTER… Grok3 bot turned 0.5 SOL into 465 SOL" | 1,283 / — | the printer framing + on-chain receipt |
| [@qkl2058](https://x.com/qkl2058/status/2062052934280708361) (CN) | developer accidentally leaks his AI trade log: $868k profit, 28,620 predictions | 768 / 412K | the *accidental reveal* — proof without bragging |

The shape repeats: **result first, stakes second, then the exact loop the agent runs** (scan N markets → estimate fair value → find mispricing > X% → size → execute every T minutes). The loop is the framework. The reader does not want to copy a trade; they want to *own the machine that makes the trades*.

This is Vibe's home. Vibe is the simple software that turns "I gave an AI $50" from a screenshot into a thing the dream user can actually run.

Therefore: lead every Vibe asset with the loop, not the logo. The machine sells itself when you show its rules.

## Sub-niche 2 — The transformation framework thread

The classic. Take a trader with a legendary result, reverse-engineer the method, hand over the holdings.

| account | post | fav / views | structure |
|---|---|---:|---|
| [@0xReflection](https://x.com/0xReflection/status/...) | "Andrew Kang… turned $5,000 into $208 million… here's why + his holdings 🧵" | 9,173 / 3.30M | trader → result → "here's why" → holdings list |
| [@nobrainflip](https://x.com/nobrainflip/status/1779872124955480334) | "GCR turned $1k into $1 billion… I spent hours analyzing his tweets, here's his strategy 🧵" | 7,657 / 2.66M | trader → result → *I did the work for you* → strategy |
| [@JohnLoc18](https://x.com/JohnLoc18/status/...) | "the guy who turned $300 into $200,000–$300,000 in a few months trading $SPY" | 6,677 / 1.84M | first-person dream + vulnerability |
| [@BullTheoryio](https://x.com/BullTheoryio/status/...) | "88-year-old Japanese trader… $387,000 into $14 million over 40 years" | 5,059 / 2.82M | the patient-method counter-narrative |
| [@SailorManCrypto](https://x.com/SailorManCrypto/status/2059605771709456660) | "How I Decide What to Trade. My Top-Down Logic. Cheat Sheet… here is the framework" | 123 / — | the small-account version — fully copyable |

The big numbers ride on the *framework* clause, not the result. "I spent hours analyzing his tweets, here's his strategy" is the load-bearing sentence — it converts envy into a download. The mid-tier version ([@SailorManCrypto](https://x.com/SailorManCrypto/status/2059605771709456660)) is the more honest template for Vibe: a named decision procedure the reader can run today.

Vibe angle: let a user point Vibe at a trader they admire and get back a runnable framework — the thread, made executable.

## Sub-niche 3 — Smart-money / wallet copy

On-chain, the dream is literal: the wallet's trades are public, so "copy" means "mirror these addresses."

| account | post | fav | hook |
|---|---|---:|---|
| [@rektfencer](https://x.com/rektfencer/status/1849527879660351920) | "Found wallets making 6 figures EVERY SINGLE DAY… turned $1,500 into $158K… here's the…" | 946 | discovery + result + the tool |
| [@leshka_eth](https://x.com/leshka_eth/status/1771593623811084387) | "This sniper turned $12 into $50k in 1 day… there are numerous such smart-money wallets" | 923 | the *many such wallets* framing → a system, not a fluke |
| [@unusual_whales](https://x.com/unusual_whales/status/2033621837037613147) | "added Polymarket data to all our MCP and API… connect any AI assistant to live data" | 1,510 | the infrastructure pitch — data → any agent |

Note [@unusual_whales](https://x.com/unusual_whales/status/2033621837037613147) is the bridge between sub-niches 1 and 3: it sells the *data feed an agent copies from*. That is the same value chain Vibe sits in. Wallet-copy is the most product-ready niche — the "trader" is an address, the framework is a filter (win rate, hold time, position size), and the copy is one click.

## Sub-niche 4 — eToro and the platform popular-investor

eToro posts 20× in the sample and is the structural incumbent: "copy this portfolio, here's the reward path." Median engagement is modest (1,207 total fav over 20 posts) but it proves the demand category is mainstream, not crypto-only. The asymmetry meme that beats it — [@Leveragedgiant](https://x.com/Leveragedgiant/status/...): *"your forex signal provider watching you make $5,000 with his signal that he made $35 from"* (11,976 fav) — tells you the incumbent's weakness: copiers resent paying the caller. Vibe wins by removing the caller.

## Sub-niche 5 — CN lead-trader (带单 / 喊单) and the AI-skill distillation

China splits in two. The old shape is 带单老师 / 喊单 — a "teacher" calls a trade and the room holds it ([@dongbimao](https://x.com/dongbimao/status/2061655274910355638), "感谢老黄喊单，一天400万" — thanks for the call, +4M in a day). The new, fast-rising shape distills a famous caller into an *AI skill you converse with*:

- [@eastweb3eth](https://x.com/eastweb3eth/status/2062828056725893521) (1,864 fav): packages trader "Serenity"'s entire post history into a skill — *"install it, talk to it, it analyzes stocks with Serenity's thinking framework, like a private investment assistant."*
- [@SUOHA_AI](https://x.com/SUOHA_AI/status/2061862503475237091): *"Serenity teaches real skill, not just calling tickers"* — the distinction the market itself draws.

This is the clearest external validation of the Vibe thesis in any language: **the framework, not the call.** The Chinese market has already named the product — a skill that thinks like the trader. Vibe should ship exactly that.

## Sub-niche 6 — KR signal rooms and JP mirror-scam: sell the escape

Korea and Japan do not reward the copy promise; they reward the warning.

- KR: [@admi_alts](https://x.com/admi_alts/status/2019623984078503959) — *"I joined every paid room, lost money, learned there are no great masters — you have to do it yourself."* [@chimpz77](https://x.com/chimpz77/status/2004899982831436243) (2,523 fav) — *"if you don't want to study: gold, S&P, QQQ. The problem is joining 리딩방 with no standard of your own. Let's study."* [@OnWhEe](https://x.com/OnWhEe/status/...) — *"I run no paid room; everything I teach is free."*
- JP: [@kabu_kabuki](https://x.com/kabu_kabuki/status/...) — *"always decide for yourself; I've never seen anyone succeed long-term just mirroring."* [@AYA_FX100](https://x.com/AYA_FX100/status/...) — a checklist of *warning signs you've started mirroring others* (a loss-pattern post, not a copy pitch).

The promo spam exists ([@No1club55](https://x.com/No1club55/status/1639456237116076032), "+400pips, anyone can start") but it is low-trust and low-reach. The credible creator's posture is *anti-copy*. So Vibe's Korean and Japanese story is not "copy a winner" — it is *"stop renting someone else's calls; own a framework you understand."* The tool is identical; the headline inverts.

## What Vibe should build and post

| priority | move | why | effort |
|---|---|---|---|
| 1 | "Run the agent" demo: result → the loop → a button | Sub-niche 1 is the top outlier and is literally Vibe | ~1 day asset |
| 2 | "Point Vibe at any trader, get a runnable framework" | Sub-niches 2 + 5 — the framework-not-the-call thesis, validated in EN and CN | ~2 day feature framing |
| 3 | Wallet-mirror with a visible filter (win rate, hold, size) | Sub-niche 3 is the most product-ready; copy = one click | ~3 day build |
| 4 | Region-split landing copy | EN/CN = aspiration; KR/JP = escape-the-room | ~half day copy |
| 5 | The asymmetry hook for ads | "stop paying a caller who risks $35 of his own" converts resentment | ~1 hr hook bank |

Therefore: one engine, three product surfaces (agent, framework, wallet-mirror), two cultural stories. The dream is universal; the trust is local. Build for both.

## Glossary

- **Copy-trading** — software that mirrors one trader's trades into a follower's account.
- **带单 (dàidān) / 喊单 (hǎndān)** — Chinese for lead-trading / calling out trades for a paid room.
- **리딩방 (reading-bang)** — Korean paid signal/chat room; a "leading room."
- **コピートレード / ミラートレード** — Japanese for copy- / mirror-trading.
- **情弱刈り (joujaku-gari)** — Japanese slang: "harvesting the ignorant," the standard accusation against copy schemes.
- **Smart money** — wallets with a measurable on-chain edge; "wallet copy" mirrors their trades.
- **Popular investor** — eToro's term for a trader others pay to copy.
- **`Top` queryType** — twitterapi.io search ranking by engagement, used here to surface repeatable winners.
