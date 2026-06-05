# Repeatable Outliers + Perps Funding Game

**Conclusion:** the repeatable outliers are not narrow platform labels. The strongest repeatable content is a set of *mechanics formats*: venue/risk metric drops, wallet/tool signal posts, liquidation trigger cards, bounded-downside mechanics, numbered trading rules, and copytrade/teacher-group posts.

## TL;DR

| Claim | Evidence | Action |
|---|---:|---|
| Six machine-mined motifs pass the 50-post bar | 132-927 posts, 103-663 accounts, 34-83 dates | Build content formats from these motifs first. |
| Independent broad validation found eight repeatable motifs | 91-1,566 posts depending on motif | Use this as the wider search layer, not as exact targeting alone. |
| Perps funding-arb is clean in English and weak in CN/JP/KR | EN has 7 strict machine clean regular accounts; CN/JP/KR have 0 | Target EN funding-arb creators; target CN/JP/KR through funding mechanics, liquidation, and margin pain. |
| DEX funding-arb has better repeatable account evidence than CEX funding-arb | EN DEX has 7 clean regular accounts; CN CEX mechanics has a repeatable USD1/fee/margin cluster | Separate DEX-arb copy from CEX-mechanics copy. |
| The paid gap pass is complete | Project spend now `$2.0696` against `$15.00` cap | Use the new gap-pass results; do not rerun these exact queries within the cache TTL. |

Source files:

| File | What it contains | Use |
|---|---|---|
| [repeatable_motifs.md](../../docs/x-targeting/repeatable_motifs.md) (~2 min) | Machine counts for six 50+ motifs | Use for conservative motif stats. |
| [funding_arb_accounts.md](../../docs/x-targeting/funding_arb_accounts.md) (~3 min) | Strict funding-arb account table | Use for creator targeting. |
| [wide_query_additions.tsv](../../docs/x-targeting/wide_query_additions.tsv) (~2 min) | Broad query additions from the query-strategy worker | Use for the next paid sweep. |
| [gap_queries](../../docs/x-targeting/gap_queries/) (~3 min) | Five focused query banks that were run in the gap pass | Use for audit, not immediate rerun. |
| [outlier-pass-2.md](outlier-pass-2.md) (~4 min) | Previous second-pass outlier synthesis | Use as context, not as the final funding-game answer. |

## Method

This pass widened the search in four ways:

- **Platform + event:** listing, delisting, graduation, launch, rewards, points, leaderboard.
- **Platform + failure:** liquidation, margin, fees, collateral, rug, insider, bundled wallets.
- **Market data + action:** OI spike, funding flip, negative funding, liquidation map, crowded long/short.
- **Group + behavior:** teacher, copytrade, smart-money wallet, trading diary, recap, loss review.

Twenty-two subagent workers were used across the broad pass and requested gap-fill continuation:

| Worker type | Cells covered | Output |
|---|---|---|
| Paid sweep workers | trenches EN/CN; perps EN/CN; perps JP/KR | Added 394 search rows, 17,202 cached tweets total, 6,422 profiles total. |
| Motif analysts | trenches EN/CN; perps EN/CN | Confirmed cell-specific motifs above 50 posts. |
| Funding-arb analysts | EN/CN/JP/KR | Classified true funding-arb accounts versus generic funding-rate mentioners. |
| Strategy/validator workers | broad query design; global motif validation | Added wider query bank and independent motif counts. |
| Paid gap-fill workers | CN funding-arb; JP funding-arb; KR funding-arb; CEX mechanics; DEX funding | Ran the five query directions requested after the first report. |
| Gap review analysts | CN/CEX; JP; KR; EN DEX | Manually separated clean repeatable accounts from noisy funding mentions. |

Therefore: the final answer uses both machine counts and stricter manual review. The machine layer finds repeatability. The manual layer removes false positives from broad funding language.

The requested gap-fill pass then ran five focused paid query banks:

| Gap area | New tweets | Best result | Read |
|---|---:|---|---|
| CN funding-arb | 111 | `基差交易 Hyperliquid`, `资金费套利 币安 合约`, `资金费率套利 合约` | Still no clean CN funding-arb regular account. |
| JP funding-arb | 197 | `現物 先物 裁定`, `資金調達率 アービトラージ`, `Funding Rate デルタニュートラル` | Best near-miss is `@happynapx`; no clean regular account. |
| KR funding-arb | 146 | `마이너스 펀딩비 차익`, `베이시스 거래 코인`, `펀딩비 아비트라지` | Found clean singletons; no clean regular account. |
| CEX mechanics | 119 | `0挂单费`, `BTCUSD1 永续`, `VIP 费率 合约`, `保证金容量 USD1` | Strong CN USD1/fee/Portfolio Margin mechanics cluster. |
| DEX funding | 168 | `perp funding basis trade`, `delta neutral perp points`, `funding spread Hyperliquid` | EN clean funding-arb accounts rose from 4 to 7. |

Therefore: the gap pass answered the open question. EN DEX funding-arb is targetable now; CN/JP/KR remain mechanics-first, not true funding-arb-account-first.

## Strong Motifs

Strong bar = at least 50 posts, 20 accounts, and 10 dates.

| Motif | Posts | Accounts | Dates | Cells | Why it is repeatable |
|---|---:|---:|---:|---|---|
| Venue/risk metric drop | 927 | 663 | 83 | all 6 | Product/venue posts tied to funding, OI, fees, margin, liquidation, TVL, revenue, or points. |
| Wallet/tool signal | 584 | 400 | 61 | all 6 | Wallet tracker, smart money, GMGN/Axiom/Photon/BullX, insiders, top holders. |
| Bounded-downside mechanic | 452 | 364 | 59 | all 6 | No liquidation, fixed risk, max loss, options/premium-only framing. |
| Liquidation trigger card | 428 | 293 | 67 | all 6 | Liquidation level, heatmap, OI cluster, long/short trigger. |
| Numbered market rule | 237 | 191 | 44 | all 6 | Numbered trading checklist or market rule with three or more steps. |
| Copytrade/teacher group | 132 | 103 | 34 | 5 cells | Teacher, group, copytrade, trading diary, recap, loss review. |

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
| EN | 264 | 179 | 19 | 7 | Real target market exists and got stronger after the DEX funding pass. |
| CN | 81 | 72 | 3 | 0 | Funding-arb is a near-miss; USD1/fee/Portfolio Margin mechanics are stronger. |
| JP | 103 | 90 | 2 | 0 | More clean singletons and near-misses; no repeat account. |
| KR | 54 | 26 | 3 | 0 | Funding mechanics and market recaps repeat; true-arb does not. |

### English Targets

| Account | Evidence | Classification | Use |
|---|---:|---|---|
| `@vooi_io` | 9 posts, 7 clean arb, 9 dates | Strong product/account target | Cross-venue DEX funding-arb language. |
| `@LorisTools` | 9 posts, 8 dates; manual review high | Product/account target | Cross-exchange funding-arb tooling, even if machine strict count is 2. |
| `@Ryuzaki_SEI` | 8 posts, 8 clean arb, 8 dates | Strong creator target | Delta-neutral points farming on perps venues. |
| `@SammyMzy` | 3 posts, 3 clean arb, 3 dates | Creator/sponsor target | DeFi vault, funding-rate, and basis-arb explanation. |
| `@reya_xyz` | 3 posts, 3 clean arb, 3 dates | Product/account target | RWA basis trade and spot-perp funding capture. |
| `@mozifinance` | 3 posts, 3 clean arb, 2 dates | Product/account target | PerpDEX funding scanner and cross-venue execution. |
| `@usenami_io` | 3 posts, 3 clean arb, 3 dates | Product/account target | CEX + DEX funding-rate arbitrage explainer. |
| `@minus1_12` | 4 manual-review posts, 31-day span | Manual near-target | Futures basis versus perp funding. |

Generic funding-rate accounts are useful for reach but not for true funding-arb positioning: `@KrownCryptoCave`, `@cryptorover`, `@CryptoTice_`, `@laevitas1`, `@Peter_thoc`, `_ctm_crypto`.

### CN / JP / KR Targets

| Language | Best accounts | Clean read |
|---|---|---|
| CN | `@lubijiaocheng`, `@webktsr`, `@fanfanboruo`; CEX mechanics: `@webktsr`, `@PWenzhen76938`, `@0xduyan`, `@Guomin184935`, `@CheesyBun0211` | No clean regular funding-arb account. `@webktsr` is now a clean repeatable CEX-mechanics account, not a clean funding-arb account. |
| JP | `@happynapx`, `@nyatoyoshikatsu`, `@shogun_sy`, `@cosmo20199`, `@Yoshihiko_ICKW`, `@eureka_cm` | No exact regular JP funding-arb account. `@happynapx` is the best clean Hyperliquid delta-neutral near-miss with 2 clean posts. |
| KR | `@WhitePeach`, `@ilpyung98`, `@t0_god`; clean singletons: `@Bugi952`, `@anthony_kim_k`, `@sdmcat00`, `@gorochi0315` | No strong true-arb regular. KR signal is funding mechanics, OI, liquidation, market recap, and a few clean singletons. |

Therefore: do not force a funding-arb campaign into CN/JP/KR yet. Use the funding-game language there as *mechanics education*, then test whether General Market’s no-liquidation / bounded-downside angle pulls better.

## CEX vs DEX

| Venue type | What repeats | Strong examples | Targeting implication |
|---|---|---|---|
| DEX perps | Funding-arb, delta-neutral points farming, venue metric drops, OI/funding/liquidation stats | Hyperliquid, Lighter, Variational, Aster, Extended, Ostium, VOOI, Loris, Altura | Best place to target true funding-arb and no-liquidation alternatives. |
| CEX perps | Margin, collateral, fee schedule, maker/taker changes, new perp pairs, portfolio-margin mechanics | Binance USD1/BTCUSD1, Bybit/Bitget/Gate/OKX-style query set, KCEX Korea posts | Best place to target cost/complexity pain, not pure funding-arb. |
| Cross-venue | Basis, funding spread, cash-and-carry, hidden execution/TWAP, perp-vs-spot spread | VOOI and Loris strongest; `@minus1_12` manual near-target | Highest-signal account cluster for funding-arb content. |

Therefore: for CEX, write around “fees, margin, collateral, maker rebates, and why the rule changed.” For DEX, write around “funding, OI, points, liquidation, and strategy mechanics.”

The gap pass found three repeatable EN DEX funding sub-motifs:

| DEX funding sub-motif | Posts | Authors | Dates | Read |
|---|---:|---:|---:|---|
| RWA / spot-perp basis trade | 136 | 108 | 55 | Strongest clean sub-motif. |
| Cross-venue funding tool/scanner | 79 | 61 | 45 | Strong product/tool motif. |
| Delta-neutral perp points farming | 61 | 49 | 36 | Strong creator/persona motif. |
| Vault market-neutral yield | 39 | 32 | 25 | Promising, below the 50-post bar. |

The CEX mechanics gap pass found five CN mechanics motifs:

| CEX mechanics motif | Posts | Accounts | Dates | Top accounts |
|---|---:|---:|---:|---|
| USD1 perp launch / settlement | 31 | 23 | 15 | `@webktsr`, `@0xduyan`, `@CheesyBun0211` |
| Depth / slippage / funding caveat | 25 | 17 | 15 | `@webktsr`, `@0xduyan`, `@PWenzhen76938` |
| Trading-infrastructure narrative | 21 | 16 | 13 | `@webktsr`, `@PWenzhen76938` |
| Portfolio Margin / collateral efficiency | 19 | 14 | 10 | `@webktsr`, `@0xduyan`, `@PWenzhen76938` |
| Zero maker / VIP fee schedule | 16 | 14 | 9 | `@webktsr` |

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

## Gap Pass

These queries were run after the initial report. Do not rerun the exact same query strings inside the 7-day cache window.

| Area | Query file | New tweets | Final read |
|---|---|---:|---|
| CN funding-arb | [cn_funding_arb.tsv](../../docs/x-targeting/gap_queries/cn_funding_arb.tsv) | 111 | Useful basis/funding hits, still 0 clean regular accounts. |
| JP funding-arb | [jp_funding_arb.tsv](../../docs/x-targeting/gap_queries/jp_funding_arb.tsv) | 197 | Best near-miss `@happynapx`; still 0 clean regular accounts. |
| KR funding-arb | [kr_funding_arb.tsv](../../docs/x-targeting/gap_queries/kr_funding_arb.tsv) | 146 | Clean singletons only; exact Korean phrases were too sparse. |
| CEX mechanics | [cex_mechanics.tsv](../../docs/x-targeting/gap_queries/cex_mechanics.tsv) | 119 | Strong CN USD1/fee/Portfolio Margin mechanics cluster. |
| DEX funding | [dex_funding.tsv](../../docs/x-targeting/gap_queries/dex_funding.tsv) | 168 | EN clean regular funding-arb accounts rose to 7. |

Therefore: the next paid pass should not be another broad rerun. It should deep-pull or graph-expand the EN DEX clean accounts and the CN CEX mechanics accounts.

## Exceptions

- Broad searches produced `408` timeouts, especially CN/JP/KR and exact funding-arb phrases. The scripts advanced after each failed Top/Latest request and did not enter a retry loop.
- Funding-arb counts are strict after manual review. CN, JP, and KR still do not prove regular true-arb account clusters after the gap pass.
- JP clean regex overcounts equity cash/futures arbitrage if used blindly. Manual review keeps JP at 0 clean regular crypto funding-arb accounts.
- KR exact query phrases are too stiff. Native expansion should include `펀비`, `괴리`, `현물/선물`, and `베이시스 트레이딩`.
- Some broad motifs include false-positive risk. The highest-risk one is “token call with metric,” because it can include spammy calls.
- The cache is valid: `searches.jsonl`, `tweets.jsonl`, `profiles.jsonl`, and `twapi-ledger.jsonl` all parse with zero bad rows.

Next step: build General Market post variants from EN DEX funding-arb, CN CEX mechanics, and the six global strong formats.
