# Second-Pass Outlier Research — repeatable account-format stats

## TL;DR

The strongest repeatable route is **risk/data desks by language**, not generic “crypto alpha” posting.

| cell | repeatable outliers | strongest repeatable pattern | confidence | next action |
|---|---:|---|---|---|
| `perps-en` | 80 | Data drops that compare OI, liquidity, rewards, crowding, and failure path | High | Publish number-led perp/risk prompts daily |
| `trenches-cn` | 45 | Numbered proof and “before you ape” checklists | Medium-high | Build a Chinese signal hygiene desk |
| `trenches-en` | 38 | Daily trenches radar: movement, wallet/tool signal, trap, action | Medium | Avoid pure token shill; use risk-labeled recaps |
| `perps-kr` | 28 | Numbered trading rules with one receipt or data point | Medium-high | Use `3줄 요약` risk-rule posts |
| `perps-cn` | 26 | Mechanism → user constraint → rule data drops | Low-medium | Retest after 408-heavy queries recover |
| `perps-jp` | 10 | Liquidation/risk cards with trigger levels | Medium | Copy `@Nishi8mAlert` style risk monitors |

Therefore: the repeatable Vision content system is **data drop → numbered rule → daily recap → risk card**. Each post should turn a market stat into a prediction prompt.

## What Changed

First pass mapped niches. This pass measured repeatability inside accounts.

| pass | question | evidence | output |
|---|---|---:|---|
| First pass | Which niches exist? | niche maps across six cells | Audience maps and broad content formats |
| Second pass | Which account-format pairs repeat? | 16,430 cached tweets, 5,911 profiles, 265 search rows | `outliers.json` and `outliers.md` per cell |
| Second pass synthesis | What should Vision copy? | 227 repeatable account-format outliers | This report |

Exception: `perps-cn` is under-sampled because repeated `408` API timeouts stopped several paid searches. Use it as directional evidence, not final proof.

## Method

We searched beyond the first-pass keywords.

| route | examples | result |
|---|---|---|
| Account discovery | “who to follow”, “top accounts”, `币圈 必关注`, `코인 트레이더 팔로우`, `仮想通貨 おすすめアカウント` | Found smaller accounts with high engagement per follower |
| Tool and workflow terms | GMGN, Axiom, Photon, BullX, wallet tracker, copy trade, liquidation heatmap | Found repeatable tool/risk desk formats |
| Local pain terms | `追証 地獄`, `손절 원칙`, `爆仓`, `插针`, “got liquidated” | Found leverage psychology and false-positive keyword traps |
| Adjacent groups | prop firms, funding arbitrage, trading journals, account teachers, RWA perps | Found better content skeletons than generic perp searches |
| Product comparisons | perp DEX comparison, stablecoin margin, collateral, bounded loss | Found mechanism-led explainers for CN and EN perps |

The score rewards account-format pairs that repeat. It uses repeat count, share of that account’s harvested posts, median engagement, median views, and engagement per 1,000 followers. Single viral posts are listed separately and excluded from repeatable recommendations when they are off-topic.

## Strongest Outliers

These are the best cross-cell rows after excluding obvious off-topic or duplicate-label traps.

| cell | account | format | repeats/share | median eng/views | eng/1k followers | example | what to copy |
|---|---|---|---:|---:|---:|---|---|
| `perps-kr` | `@juhyeon6749` | `pnl_flex` | 2/2, 100% | 3,645.5 / 292,842.5 | 913.888 | [post](https://x.com/juhyeon6749/status/2054428669251395815) (~1 min) | Simple story about why a boring rule beats active trading |
| `perps-en` | `@Nullfee` | `token_call` | 2/2, 100% | 35,850 / 41,182 | 747.451 | [post](https://x.com/Nullfee/status/2056409025873387832) (~1 min) | Leaderboard/reward path with a concrete action |
| `trenches-en` | `@degenwifstache` | `token_call` | 2/2, 100% | 942 / 24,987 | 205.677 | [post](https://x.com/DegenWifStache/status/2054588888455561566) (~1 min) | A memorable thesis list, not the ticker itself |
| `trenches-en` | `@mntrenches` | `thread_hook` | 2/2, 100% | 949 / 7,585 | 151.743 | [post](https://x.com/Mntrenches/status/2062218489444847997) (~1 min) | Native action hook; do not copy giveaway mechanics |
| `perps-en` | `@capy_onchain` | `data_drop` | 7/8, 88% | 124 / 4,267 | 111.511 | [post](https://x.com/capy_onchain/status/2062263839845212399) (~1 min) | “I analyzed N venues; only X matter” data filter |
| `perps-jp` | `@Nishi8mAlert` | `data_drop` | 10/10, 100% | 20.5 / 1,422.5 | 3.564 | [post](https://x.com/Nishi8mAlert/status/2062323738759070080) (~1 min) | Current value, UP/DOWN trigger, liquidation sentence |
| `perps-kr` | `@ilpyung98` | `data_drop` | 21/47, 45% | 50 / 1,689 | 5.015 | [post](https://x.com/ilpyung98/status/2061074341664817486) (~1 min) | Hyperliquid valuation/data receipt, repeated consistently |
| `trenches-cn` | `@xingzhanAI` | `numbered_list` | 6/6, 100% | 86 / 5,643 | 4.731 | [post](https://x.com/xingzhanAI/status/2053774362130485688) (~1 min) | Chain-data numbered recap, modest reach but strong repeat |

Therefore: the accounts with the best strategic fit are not always the highest raw score. Repeatability plus copyable structure matters more than one viral post.

## Cell Findings

### Trenches EN

The useful pattern is **daily trenches radar**.

| account | format | repeat/share | median eng/views | eng/1k followers | copyable skeleton |
|---|---|---:|---:|---:|---|
| `@degenwifstache` | `token_call` | 2/2, 100% | 942 / 24,987 | 205.677 | “Here are N reasons this market moves” |
| `@stitchdegen` | `token_call` | 3/3, 100% | 348 / 14,905 | 30.715 | Daily recap of what is worth watching |
| `@exonyte_` | `data_drop` | 2/2, 100% | 115.5 / 1,667 | 60.031 | Tool/data status update with one launch clue |

Copy this for Vision:

```text
Daily Vision trenches radar:
1. Market most crowded:
2. Market with cleanest public signal:
3. Market likely to trap late entries:
4. What the crowd is missing:
5. Prediction to place:
```

Do not copy wallet-drop giveaways or empty `100x` ticker shills. They score well but do not transfer to Vision.

### Trenches CN

The useful pattern is **before-you-ape signal hygiene**.

| account | format | repeat/share | median eng/views | eng/1k followers | copyable skeleton |
|---|---|---:|---:|---:|---|
| `@aliideez` | `numbered_list` | 2/2, 100% | 291.5 / 39,982.5 | 63.000 | Chain proof before the token call |
| `@315728dzp` | `token_call` | 2/3, 67% | 373 / 14,547 | 18.711 | Late screenshot / copy-trade pain |
| `@xingzhanAI` | `numbered_list` | 6/6, 100% | 86 / 5,643 | 4.731 | Repeated numbered chain-data recap |

Copy this for Vision:

```text
今天下判断前，先看这 5 个点：
1. 信号来源：
2. 发布时间：
3. 现在还是早，还是已经晚：
4. 最大风险：
5. 可以下注的预测：
```

Therefore: position Vision as the place that turns delayed KOL screenshots into timestamped prediction discipline.

### Perps EN

The useful pattern is **repeatable data drops**.

| account | format | repeat/share | median eng/views | eng/1k followers | copyable skeleton |
|---|---|---:|---:|---:|---|
| `@capy_onchain` | `data_drop` | 7/8, 88% | 124 / 4,267 | 111.511 | Venue comparison by hard filters |
| `@0x_zax` | `tutorial` | 2/3, 67% | 255.5 / 6,246.5 | 66.885 | Daily action checklist across projects |
| `@0xTowhid` | `pnl_flex` | 3/5, 60% | 123 / 2,276 | 65.705 | Shortcut overview of active incentives |
| `@Lighter_xyz` | `token_call` | 16/30, 53% | 273 / 18,687 | 2.304 | Product update tied to trader pain |

Copy this for Vision:

```text
I checked {N} live markets.
Only {X} are worth predicting today:
1. Highest crowding:
2. Cleanest data source:
3. Worst failure path:
4. Best bounded-risk setup:
Prediction prompt:
```

Exclude `@hxxntrr` from strategic examples. It scored high, but the top example is Apple arbitrage, not perps.

### Perps CN

The useful pattern is **mechanism → user constraint → rule**.

| account | format | repeat/share | median eng/views | eng/1k followers | copyable skeleton |
|---|---|---:|---:|---:|---|
| `@dashubtc` | `data_drop` | 2/2, 100% | 535.5 / 16,123.5 | 26.197 | Bounded-risk trade mechanic |
| `@hyperevm_cn` | `data_drop` | 5/11, 46% | 230 / 2,183 | 20.848 | Ecosystem mechanism explanation |
| `@webktsr` | `data_drop` | 3/3, 100% | 451 / 11,420 | 11.245 | Margin/collateral user constraint |

Copy this for Vision:

```text
很多人看错 {市场}，因为他们只看方向，不看约束。
1. 机制：
2. 用户真正怕的是：
3. Vision 的规则：
4. 最坏情况：
5. 今天可以判断的是：
```

Exception: confidence is low-medium because the paid pass hit repeated `408`s on `资金费率`, `止盈 止损`, `仓位管理`, `插针`, `实盘`, and `合约 复盘`.

### Perps JP

The useful pattern is **liquidation/risk card**.

| account | format | repeat/share | median eng/views | eng/1k followers | copyable skeleton |
|---|---|---:|---:|---:|---|
| `@Nishi8mAlert` | `data_drop` | 10/10, 100% | 20.5 / 1,422.5 | 3.564 | BTC liquidation trigger monitor |
| `@hiropi_fx` | `data_drop` | 5/7, 71% | 41 / 6,162 | 0.823 | Liquidation map interpretation |
| `@corenona` | `daily_recap` | 2/3, 67% | 259.5 / 9,203 | 116.055 | Daily market focus, but weak sample |

Copy this for Vision:

```text
📊 Vision予測モニター
現在値：
上方向トリガー：
下方向トリガー：
注意する清算/ロスカ水準：
今日の予測：
```

Therefore: JP is not a broad perp-content opportunity yet. It is a narrow risk-monitor opportunity.

### Perps KR

The useful pattern is **numbered risk rules with receipts**.

| account | format | repeat/share | median eng/views | eng/1k followers | copyable skeleton |
|---|---|---:|---:|---:|---|
| `@mad_dogdebt` | `numbered_list` | 4/9, 44% | 1,119.5 / 68,354.5 | 77.394 | Beginner rule explained through a story |
| `@JOOWOL2` | `numbered_list` | 11/62, 18% | 769 / 63,615 | 23.388 | Market rules in list format |
| `@ilpyung98` | `data_drop` | 21/47, 45% | 50 / 1,689 | 5.015 | Repeated Hyperliquid data/valuation receipt |

Copy this for Vision:

```text
3줄 요약:
1. 지금 시장에서 착각하는 것:
2. 데이터가 말하는 것:
3. 오늘 예측할 것:

체크리스트:
- 펀딩비:
- 청산 위험:
- OI:
- 손절 기준:
```

Do not copy raw `손절` virality. The search term catches social breakup content, not only stop-loss content.

## Search Routes That Worked

| cell | best routes | what they found | repeatable use |
|---|---|---|---|
| `trenches-en` | `axiom` + `gmgn`, `photon` + `bullx`, wallet tracker, no-insiders terms | Tool comparisons, token calls, copy-trade pain | Daily radar with tool signal |
| `trenches-cn` | `币圈 必关注`, `聪明钱 钱包`, wallet/copy-trade phrases | Account discovery and smart-money narratives | Before-you-ape proof list |
| `perps-en` | liquidation heatmap, perp DEX comparison, points farming | Risk data and venue comparison | Number-led market comparison |
| `perps-cn` | Latest search for `合约 带单 老师`, `合约 复盘 日报` | Copy-trade teacher and recap language | Mechanism/rule data drop |
| `perps-jp` | `仮想通貨 おすすめアカウント`, `清算マップ`, `追証 地獄` | Account lists, liquidation maps, margin-call pain | Trigger-level risk card |
| `perps-kr` | `코인 트레이더 팔로우`, `펀딩비 차익거래`, `선물 복기 코인`, `손절 원칙`, `수익 인증 선물` | Account discovery, funding, journals, stop-loss rules, receipts | `3줄 요약` with proof |

Therefore: for a third pass, prioritize localized account discovery and risk language over generic venue names.

## False Positives

| false positive | why it looked strong | why not to copy |
|---|---|---|
| Giveaways and wallet drops | High engagement and high repeat in trenches EN | They farm replies; they do not prove Vision demand |
| Single viral memes | Huge eng/1k followers | Mostly off-topic and not repeatable by account |
| Generic `손절` search | Pulls very high Korean engagement | In Korean it also means social cut-off, not only stop-loss |
| Official exchange campaign posts | Repeat and reach | Paid/product incentives inflate demand |
| Two-post 100% rows | Clean-looking repeat/share | Two posts are leads, not proof |
| Duplicate classifier labels | One post can score as data_drop, pnl_flex, daily_recap | Copy the underlying skeleton, not the label count |

## Do These Now

| priority | action | effort | owner |
|---:|---|---|---|
| 1 | Create daily EN perp data-drop posts from OI, crowding, rewards, and failure path | ~20 min/post | Growth |
| 2 | Create CN “before you ape” signal checklists for late-copy-trade pain | ~20 min/post | Growth |
| 3 | Create KR `3줄 요약` posts with one Hyperliquid/funding/liquidation receipt | ~15 min/post | Growth |
| 4 | Create JP risk cards with trigger levels and neutral prediction language | ~15 min/post | Growth |
| 5 | Create trenches EN radar posts that name crowd, trap, and action | ~15 min/post | Growth |
| 6 | Retest `perps-cn` with narrower Latest-only risk-control searches after 408s clear | ~45 min | Research |

## Evidence Files

| file | contents | read time |
|---|---|---:|
| [trenches-en outliers](../../docs/x-targeting/niches/trenches-en/outliers.md) | 38 repeatable account-format rows | ~3 min |
| [trenches-cn outliers](../../docs/x-targeting/niches/trenches-cn/outliers.md) | 45 repeatable account-format rows | ~3 min |
| [perps-en outliers](../../docs/x-targeting/niches/perps-en/outliers.md) | 80 repeatable account-format rows | ~4 min |
| [perps-cn outliers](../../docs/x-targeting/niches/perps-cn/outliers.md) | 26 repeatable account-format rows | ~3 min |
| [perps-jp outliers](../../docs/x-targeting/niches/perps-jp/outliers.md) | 10 repeatable account-format rows | ~2 min |
| [perps-kr outliers](../../docs/x-targeting/niches/perps-kr/outliers.md) | 28 repeatable account-format rows | ~3 min |
| [format playbook](./format-playbook.md) | First-pass reusable templates | ~8 min |

## Cost And Coverage

| item | value |
|---|---:|
| Final project spend | $1.4451 / $15.00 |
| Net second-pass spend | ~$0.1546 |
| Cache rows validated | 16,430 tweets, 5,911 profiles, 265 searches, 2,590 ledger rows |
| JSONL integrity errors | 0 |
| Paid API exception | repeated `408` timeouts on broad searches |

Therefore: the research is still far below budget. The next useful spend is a narrow third pass on `perps-cn` and JP/KR account-follow graphs, not more generic keyword search.

## Glossary

- **Data drop:** a post that leads with a hard number, market stat, liquidation level, OI figure, fee, TVL, or revenue metric.
- **Engagement:** weighted score used by the tooling: favorites + 3×retweets + 2×replies + 4×quotes.
- **Eng/1k followers:** median engagement normalized per 1,000 account followers.
- **OI:** open interest, the size of outstanding perp positions.
- **Perp:** perpetual futures contract.
- **PNL:** profit and loss.
