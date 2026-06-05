# Repeatable Outliers + Perps Funding Game

**Conclusion:** the repeatable outliers are not narrow platform labels. The strongest repeatable content is a set of *mechanics formats*: venue/risk metric drops, wallet/tool signal posts, liquidation trigger cards, bounded-downside mechanics, numbered trading rules, and copytrade/teacher-group posts.

## TL;DR

| Claim | Evidence | Action |
|---|---:|---|
| Six machine-mined motifs pass the 50-post bar | 129-784 posts, 100-562 accounts, 33-66 dates | Build content formats from these motifs first. |
| Independent broad validation found eight repeatable motifs | 91-1,566 posts depending on motif | Use this as the wider search layer, not as exact targeting alone. |
| Perps funding-arb is clean in English and weak in CN/JP/KR | EN has 4 strict machine clean regular accounts; CN/JP/KR have 0 | Target EN funding-arb creators; target CN/JP/KR through funding mechanics, liquidation, and margin pain. |
| DEX funding-arb has better repeatable account evidence than CEX funding-arb | VOOI, Loris, Variational, Altura-style posts repeat; CEX content repeats around margin/fees/collateral instead | Separate DEX-arb copy from CEX-mechanics copy. |
| The paid broad pass stayed under budget | Project spend now `$1.7757` against `$15.00` cap | Remaining budget is enough for a JP/KR/CN funding-arb gap pass. |

Source files:

| File | What it contains | Use |
|---|---|---|
| [repeatable_motifs.md](../../docs/x-targeting/repeatable_motifs.md) (~2 min) | Machine counts for six 50+ motifs | Use for conservative motif stats. |
| [funding_arb_accounts.md](../../docs/x-targeting/funding_arb_accounts.md) (~3 min) | Strict funding-arb account table | Use for creator targeting. |
| [wide_query_additions.tsv](../../docs/x-targeting/wide_query_additions.tsv) (~2 min) | Broad query additions from the query-strategy worker | Use for the next paid sweep. |
| [outlier-pass-2.md](outlier-pass-2.md) (~4 min) | Previous second-pass outlier synthesis | Use as context, not as the final funding-game answer. |

## Method

This pass widened the search in four ways:

- **Platform + event:** listing, delisting, graduation, launch, rewards, points, leaderboard.
- **Platform + failure:** liquidation, margin, fees, collateral, rug, insider, bundled wallets.
- **Market data + action:** OI spike, funding flip, negative funding, liquidation map, crowded long/short.
- **Group + behavior:** teacher, copytrade, smart-money wallet, trading diary, recap, loss review.

Thirteen subagents were used in this continuation:

| Worker type | Cells covered | Output |
|---|---|---|
| Paid sweep workers | trenches EN/CN; perps EN/CN; perps JP/KR | Added 394 search rows, 17,202 cached tweets total, 6,422 profiles total. |
| Motif analysts | trenches EN/CN; perps EN/CN | Confirmed cell-specific motifs above 50 posts. |
| Funding-arb analysts | EN/CN/JP/KR | Classified true funding-arb accounts versus generic funding-rate mentioners. |
| Strategy/validator workers | broad query design; global motif validation | Added wider query bank and independent motif counts. |

Therefore: the final answer uses both machine counts and stricter manual review. The machine layer finds repeatability. The manual layer removes false positives from broad funding language.

## Strong Motifs

Strong bar = at least 50 posts, 20 accounts, and 10 dates.

| Motif | Posts | Accounts | Dates | Cells | Why it is repeatable |
|---|---:|---:|---:|---|---|
| Venue/risk metric drop | 784 | 562 | 66 | all 6 | Product/venue posts tied to funding, OI, fees, margin, liquidation, TVL, revenue, or points. |
| Wallet/tool signal | 568 | 386 | 55 | all 6 | Wallet tracker, smart money, GMGN/Axiom/Photon/BullX, insiders, top holders. |
| Bounded-downside mechanic | 415 | 335 | 53 | all 6 | No liquidation, fixed risk, max loss, options/premium-only framing. |
| Liquidation trigger card | 392 | 268 | 60 | all 6 | Liquidation level, heatmap, OI cluster, long/short trigger. |
| Numbered market rule | 214 | 171 | 36 | all 6 | Numbered trading checklist or market rule with three or more steps. |
| Copytrade/teacher group | 129 | 100 | 33 | 5 cells | Teacher, group, copytrade, trading diary, recap, loss review. |

Independent broad validation found the same shape at larger scale:

| Motif | Posts | Accounts | Dates | Read |
|---|---:|---:|---:|---|
| Venue/risk metric drop | 1,566 | 1,049 | 78 | Strongest global format. |
| Token call with metric | 939 | 592 | 64 | Powerful but higher spam risk. |
| Liquidation level alert | 503 | 355 | 59 | Strong perps-native repeatable format. |
| Daily market recap/watchlist | 467 | 350 | 44 | Good for language-local daily publishing. |
| Wallet/smart-money trace | 238 | 163 | 43 | Strongest trenches-native bridge into General Market. |
| Numbered trading rule | 197 | 164 | 32 | Easy repeatable education format. |
| Copytrade/teacher group | 145 | 120 | 32 | Useful as audience discovery, not as final product positioning. |
| Bounded downside/no liquidation | 91 | 81 | 32 | Directly relevant to General Market positioning. |

Therefore: the main outlier is not "Pump.fun" or "Hyperliquid." The main outlier is *a tradeable claim plus a metric plus a concrete user consequence*.

## Cell Findings

| Cell | Clean 50+ motifs | Best repeatable angles |
|---|---|---|
| trenches-en | GMGN/Axiom/Photon/BullX workflow: 104 posts / 56 accounts; risk-screening bundle: 71 / 43; Pump.fun listing/graduation/rewards: 50 / 48 | Tool workflow, dev sold/top holders/no insiders, launchpad event. |
| trenches-cn | 链上/CA/SOL/DEX/GMGN + wallet/copytrade: 124 / 105; 土狗/冲/埋伏/打新: 90 / 84; 钱包/跟单/聪明钱: 75 / 61; launch/opening: 68 / 64; 貔貅/老鼠仓/接盘: 58 / 55 | Wallet monitoring, smart-money copying, launch/opening risk, scam/rug avoidance. |
| perps-en | Points: 319 / 219; liquidation: 233 / 164; listing/launch: 219 / 161; funding: 188 / 137; OI: 131 / 88; RWA/pre-IPO: 113 / 79 | Funding + points, liquidation + OI, Hyperliquid listing/product mechanics. |
| perps-cn | Fee/margin/collateral: 1,522 / 890; Hyperliquid general: 1,210 / 687; 爆仓/清算: 511 / 361; 美股合约: 126 / 109; listing: 88 / 52 | CEX margin/fee mechanics, Hyperliquid, liquidation, tokenized stock perps. |
| perps-jp | Machine global motifs pass via venue/risk, liquidation, bounded downside, numbered rules | Search worked best on 上場, 清算, ランキング, 清算マップ, 清算ライン, ロスカット, 建玉急増, ロング/ショート多すぎ. |
| perps-kr | Machine global motifs pass via venue/risk, liquidation, numbered rules, wallet/tool, bounded downside | Search worked best on 펀딩비, 순위, 지갑, 무기한 선물 상장, 청산맵, 청산 라인, 롱/숏 과열, 손실 제한, 매매일지. |

Therefore: JP/KR should not be treated as empty. They are weaker for true funding-arb accounts, but strong for liquidation, ranking, OI, funding mechanics, loss-limited trading, and trading diary content.

## Funding Game

Definitions:

- **Funding-rate mentioner:** posts regularly about funding as a market signal.
- **Funding-arb account:** posts about basis, funding arbitrage, cash-and-carry, delta-neutral, market-neutral, or cross-venue funding strategies.
- **Clean regular account:** at least 3 cached clean funding-arb posts.

| Language | Matching posts | Accounts | Regular mentioners | Clean regular funding-arb accounts | Read |
|---|---:|---:|---:|---:|---|
| EN | 209 | 140 | 14 | 4 | Real target market exists. |
| CN | 36 | 33 | 1 | 0 | Funding-arb is a near-miss; margin/fee/collateral is stronger. |
| JP | 27 | 26 | 0 | 0 | No regular true-arb account found; only single/near-miss arbitrage posts. |
| KR | 41 | 21 | 3 | 0 | Funding mechanics and market recaps repeat; true-arb does not. |

### English Targets

| Account | Evidence | Classification | Use |
|---|---:|---|---|
| `@vooi_io` | 9 posts, 7 clean arb, 9 dates | Strong product/account target | Cross-venue DEX funding-arb language. |
| `@LorisTools` | 9 posts, 8 dates; manual review high | Product/account target | Cross-exchange funding-arb tooling, even if machine strict count is 2. |
| `@Ryuzaki_SEI` | 4 posts, 4 clean arb, 4 dates | Strong creator target | Delta-neutral points farming on perps venues. |
| `@SammyMzy` | 3 posts, 3 clean arb, 3 dates | Creator/sponsor target | DeFi vault, funding-rate, and basis-arb explanation. |
| `@minus1_12` | 4 manual-review posts, 31-day span | Manual near-target | Futures basis versus perp funding. |

Generic funding-rate accounts are useful for reach but not for true funding-arb positioning: `@KrownCryptoCave`, `@cryptorover`, `@CryptoTice_`, `@laevitas1`, `@Peter_thoc`, `_ctm_crypto`.

### CN / JP / KR Targets

| Language | Best accounts | Clean read |
|---|---|---|
| CN | `@lubijiaocheng`, `@webktsr`; one-hit watchlist: `@nftsiy`, `@yueya_eth`, `@huahuayjy`, `@biupa`, `@ddazmon` | No clean regular funding-arb account. `@lubijiaocheng` is a yield/market-neutral near-miss; `@webktsr` is stronger for CEX margin/fee mechanics. |
| JP | `@tommy_love123`, `@All3in4out`, `@eureka_cm`; one-hit leads: `@neko_btc_trader`, `@yousukeakaban`, `@like_lihood`, `@Yoshihiko_ICKW`, `@KINKUMACH` | No exact regular JP funding-arb account. JP signal is quant/funding-rate-as-signal and general arbitrage. |
| KR | `@WhitePeach`, `@ilpyung98`, `@t0_god`, near-miss `@magonia_B` | No strong true-arb regular. KR signal is funding mechanics, OI, liquidation, and market recap. |

Therefore: do not force a funding-arb campaign into CN/JP/KR yet. Use the funding-game language there as *mechanics education*, then test whether General Market’s no-liquidation / bounded-downside angle pulls better.

## CEX vs DEX

| Venue type | What repeats | Strong examples | Targeting implication |
|---|---|---|---|
| DEX perps | Funding-arb, delta-neutral points farming, venue metric drops, OI/funding/liquidation stats | Hyperliquid, Lighter, Variational, Aster, Extended, Ostium, VOOI, Loris, Altura | Best place to target true funding-arb and no-liquidation alternatives. |
| CEX perps | Margin, collateral, fee schedule, maker/taker changes, new perp pairs, portfolio-margin mechanics | Binance USD1/BTCUSD1, Bybit/Bitget/Gate/OKX-style query set, KCEX Korea posts | Best place to target cost/complexity pain, not pure funding-arb. |
| Cross-venue | Basis, funding spread, cash-and-carry, hidden execution/TWAP, perp-vs-spot spread | VOOI and Loris strongest; `@minus1_12` manual near-target | Highest-signal account cluster for funding-arb content. |

Therefore: for CEX, write around “fees, margin, collateral, maker rebates, and why the rule changed.” For DEX, write around “funding, OI, points, liquidation, and strategy mechanics.”

## Best Repeatable Formats

| Format | Skeleton | Where to run |
|---|---|---|
| Metric drop | `Venue X just did Y. Metric A moved from B to C. Here is who wins/loses.` | EN/CN/JP/KR perps, trenches EN/CN. |
| Liquidation trigger | `If BTC/HYPE touches X, Y side gets liquidated. OI/funding says Z.` | All perps languages. |
| Wallet/tool trace | `This wallet/KOL/dev moved before the crowd. Here is the trace.` | Trenches EN/CN first. |
| Bounded downside contrast | `Perps can liquidate you. This structure caps loss at X while keeping upside to Y.` | All perps languages. |
| Numbered rule | `3 rules before taking this trade / chasing this launch / copying this wallet.` | All languages. |
| Copytrade warning | `Everyone followed the teacher. The measurable failure was X.` | CN trenches, KR/JP trading diary. |

Therefore: the product story should use mechanics, not broad niche names. The repeatable unit is the post skeleton.

## Query Additions

Run these next if more paid depth is needed:

| Area | Query direction | Reason |
|---|---|---|
| CN funding-arb | `资金费套利`, `基差交易`, `正套`, `反套`, `市场中性`, combined with `币安`, `Hyperliquid`, `合约` | Current cache has near-misses, not regular accounts. |
| JP funding-arb | `資金調達率 裁定`, `デルタニュートラル`, `現物 先物 裁定`, `Funding Rate` + JP handles | Current JP native phrasing is sparse. |
| KR funding-arb | `펀딩비 차익거래`, `델타중립`, `현선물 차익`, `베이시스 거래` with venue names | Current KR hits are mostly recaps and mechanics. |
| CEX mechanics | `USD1 永续`, `0挂单费`, `Portfolio Margin`, `抵押比例`, `maker fee`, `保证金容量` | CN CEX mechanics are strong and repeatable. |
| DEX funding | `cross-exchange funding arb`, `delta neutral perp points`, `funding radar`, `funding spread`, venue pairs | EN has the cleanest account evidence. |

Therefore: the next paid pass should be gap-filling, not another broad sweep.

## Exceptions

- Broad searches produced `408` timeouts, especially CN/JP/KR. The scripts advanced after each failed Top/Latest request and did not enter a retry loop.
- Funding-arb counts are strict after manual review. CN, JP, and KR do not currently prove regular true-arb account clusters.
- Some broad motifs include false-positive risk. The highest-risk one is “token call with metric,” because it can include spammy calls.
- The cache is valid: `searches.jsonl`, `tweets.jsonl`, `profiles.jsonl`, and `twapi-ledger.jsonl` all parse with zero bad rows.

Next step: build General Market post variants from the six strong formats, starting with perps EN and CN CEX-mechanics/DEX-liquidation clusters.
