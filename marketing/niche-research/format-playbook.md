# Replicable format playbook — trenches + perps, 4 languages

## TL;DR

The strongest repeatable account is a daily risk-and-opportunity desk, not a pure call account.

| format | best cell(s) | median eng in harvest | effort/post | data source needed |
|---|---|---:|---|---|
| Numbered opportunity list | trenches-en, perps-en | 300.5 / 195 | ~20 min | DEX Screener, GMGN, Hyperliquid `/info`, exchange announcements |
| Data drop | trenches-en, perps-en, perps-cn | 290.5 / 207 / 202.5 | ~15 min | Hyperliquid `/info`, Coinglass, DeFiLlama, exchange feeds |
| Tutorial/checklist | trenches-en, perps-en, perps-cn | 272 / 249.5 / 172 | ~35 min | screenshots, fee pages, docs, venue UI |
| Daily recap | perps-en, perps-cn, perps-jp | 238 / 231 / 207.5 | ~25 min | venue announcements, liquidation maps, market calendar |
| PNL/risk story | trenches-en, perps-en, perps-cn | 211.5 / 206 / 180 | ~20 min | public wallet screenshots, trade logs, historical chart |
| Token/venue call | perps-en, trenches-en | 291.5 / 143 | ~10 min | token contract, exchange listing, chart, basic safety checks |
| Thread hook | trenches-en, perps-en | 557 / 283.5 | ~45 min | incident record, screenshots, public wallet/venue data |
| Question bait | perps-en, trenches-cn, perps-kr | 148 / 67 / 63.5 | ~5 min | none, but reply monitoring matters |
| Meme short | perps-cn, perps-kr, perps-jp | 91 / 38 / 10.5 | ~5 min | live timeline context |
| Unclassified viral bait | all cells | 70-185 | not recommended | not a repeatable research format |

Therefore: build around **data drop → numbered list → checklist → daily recap**. Use meme/question formats only as light distribution posts between utility posts.

## Formats, ranked

### Numbered Opportunity List

- **Evidence:** qualified in all six cells. Median engagement: trenches-en 300.5, perps-en 195, perps-cn 178, perps-kr 145, trenches-cn 139, perps-jp 85.
- **Exemplars:** [Monasolanatoken airdrop steps](https://x.com/Monasolanatoken/status/2061070190322839789) (~1 min), [Flowslikeosmo revenue list](https://x.com/Flowslikeosmo/status/2056524494618103846) (~1 min), [JOOWOL2 Korean market rules](https://x.com/JOOWOL2/status/2062749927265206677) (~1 min).
- **Template:**

```text
EN:
{N} things that matter before you trade {venue/token} today:
1. {liquidity/funding/volume fact}
2. {risk or villain}
3. {who benefits}
4. {what would invalidate it}
5. {actionable watch level}
Not financial advice. The edge is {one-line edge}.

中文:
今天交易 {标的/平台} 前，先看这 {N} 个点：
1. {流动性/资金费率/成交量}
2. {最大风险：爆仓/貔貅/庄家/平台}
3. {谁在赚钱}
4. {什么情况说明看错}
5. {具体观察位}
不是喊单，重点是 {一句话判断}.

日本語:
今日 {銘柄/取引所} を触る前に見る {N} 点：
1. {流動性/OI/清算ライン}
2. {一番のリスク}
3. {誰が有利か}
4. {否定条件}
5. {見るべき価格帯}
煽りではなく、論点は {一文}.

한국어:
오늘 {종목/거래소} 보기 전에 체크할 {N}가지:
1. {거래량/OI/펀딩비}
2. {제일 큰 리스크}
3. {누가 유리한가}
4. {틀렸다고 볼 조건}
5. {봐야 할 가격대}
추천이 아니라 핵심은 {한 문장}.
```

- **Data source:** GMGN or DEX Screener for memecoins (~8 min); Hyperliquid `/info`, Coinglass, and venue feeds for perps (~10 min); manual sanity check against official X posts (~5 min).
- **Cadence:** daily for market recaps; twice daily during launches or liquidation events.
- **Why it compounds:** followers return because the same slots become a scan habit.

### Data Drop

- **Evidence:** qualified in all six cells. Median engagement: trenches-en 290.5, perps-en 207, perps-cn 202.5, trenches-cn 152, perps-kr 48, perps-jp 34.
- **Exemplars:** [Saylor capital-markets stat](https://x.com/saylor/status/2062500552705986704) (~1 min), [Hyperliquid RWA OI](https://x.com/HyperliquidX/status/2061673725502861406) (~1 min), [Nishi8mAlert BTC liquidation monitor](https://x.com/Nishi8mAlert/status/2062323738759070080) (~1 min).
- **Template:**

```text
EN:
{metric} just hit {number}.
Why it matters:
- {implication for liquidity}
- {who is trapped or advantaged}
- {next level to watch}
My read: {plain conclusion}.

中文:
{指标} 到了 {数字}.
这件事重要在：
- {对流动性的影响}
- {谁会被动}
- {下一条线}
我的判断：{一句话}.

日本語:
{指標} が {数字} まで来た。
重要な点：
- {流動性への影響}
- {誰が苦しいか}
- {次に見るライン}
結論：{一文}.

한국어:
{지표}가 {숫자}까지 왔다.
중요한 이유:
- {유동성 영향}
- {누가 물렸는가}
- {다음 체크 라인}
내 해석: {한 문장}.
```

- **Data source:** Hyperliquid `/info` for open interest and funding (~8 min); Coinglass liquidation heatmaps (~5 min); DeFiLlama revenue/TVL (~5 min); exchange announcements (~3 min).
- **Cadence:** daily baseline; immediate post when OI, liquidation clusters, or revenue crosses a visible threshold.
- **Why it compounds:** the account becomes a source of numbers that traders quote.

### Tutorial / Checklist

- **Evidence:** qualified in all six cells. Median engagement: trenches-en 272, perps-en 249.5, perps-cn 172, trenches-cn 163, perps-jp 125.5, perps-kr 98.
- **Exemplars:** [Nullfee product evolution](https://x.com/Nullfee/status/2060655337489740117) (~1 min), [ScarlettWeb3 sizing lesson](https://x.com/ScarlettWeb3/status/2054075451786883533) (~1 min), [JOOWOL2 investment methods](https://x.com/JOOWOL2/status/2056587064825790579) (~1 min).
- **Template:**

```text
EN:
How to use {tool/venue} without getting farmed:
Step 1: {setup}
Step 2: {check fee/liquidity/risk}
Step 3: {small test}
Step 4: {exit or invalidation}
Do not use it if {hard exception}.

中文:
怎么用 {工具/平台} 不被收割：
第1步：{准备}
第2步：{查手续费/流动性/风险}
第3步：{小仓测试}
第4步：{退出条件}
例外：{什么情况别碰}.

日本語:
{ツール/取引所} を安全に試す手順：
1. {準備}
2. {手数料/流動性/リスク確認}
3. {小額テスト}
4. {撤退条件}
例外：{触らない条件}.

한국어:
{툴/거래소}를 안전하게 써보는 법:
1. {준비}
2. {수수료/유동성/리스크 확인}
3. {소액 테스트}
4. {손절/종료 조건}
예외: {건드리지 말 조건}.
```

- **Data source:** official docs (~10 min), product UI screenshots (~10 min), fee/liquidation page (~10 min), one tiny dry run if safe (~5 min).
- **Cadence:** 2-3 per week; update after product changes.
- **Why it compounds:** users bookmark checklists and trust the account during risky launches.

### Daily Recap

- **Evidence:** qualified in all six cells. Median engagement: perps-en 238, perps-cn 231, perps-jp 207.5, trenches-en 255.5, trenches-cn 131, perps-kr 84.
- **Exemplars:** [Aster HK equities recap](https://x.com/Aster_DEX/status/2053626189890331008) (~1 min), [waveking1314 US-stock list](https://x.com/waveking1314/status/2062148740568486239) (~1 min), [admi_alts Korean weekly thoughts](https://x.com/admi_alts/status/2062824312604881302) (~1 min).
- **Template:**

```text
EN:
Daily {cell} recap:
1. Biggest move: {event}
2. Best setup: {setup}
3. Worst risk: {villain}
4. Chart/data to watch: {metric}
5. Tomorrow: {watch item}

中文:
今日复盘：
1. 最大变化：{事件}
2. 最值得看：{机会}
3. 最大风险：{风险}
4. 盯住这个数据：{指标}
5. 明天看：{观察点}

日本語:
今日のまとめ：
1. 最大材料：{イベント}
2. 一番良い形：{セットアップ}
3. 最大リスク：{リスク}
4. 見るデータ：{指標}
5. 明日見るもの：{観察点}

한국어:
오늘 정리:
1. 가장 큰 이슈: {이벤트}
2. 제일 좋은 셋업: {셋업}
3. 최대 리스크: {리스크}
4. 봐야 할 데이터: {지표}
5. 내일 체크: {관찰점}
```

- **Data source:** venue feeds (~5 min), Coinglass/Hyperliquid data (~8 min), top harvested accounts or lists (~10 min).
- **Cadence:** once per day; publish at the same local-market time.
- **Why it compounds:** the format turns the account into a habit and reduces the user's daily scan cost.

### PNL / Risk Story

- **Evidence:** qualified in all six cells. Median engagement: trenches-en 211.5, perps-en 206, perps-cn 180, trenches-cn 128, perps-kr 65, perps-jp 55.5.
- **Exemplars:** [meilinxbt profitable Solana trader](https://x.com/meilinxbt/status/2062188508794454435) (~1 min), [Sizhe_bitcat wipeout lesson](https://x.com/Sizhe_bitcat/status/2062326944658837725) (~1 min), [leeddosok 8억 loss lesson](https://x.com/leeddosok/status/2061226971800232250) (~1 min).
- **Template:**

```text
EN:
{trader} turned {start} into {end}.
The part people miss:
- {risk taken}
- {what they stopped doing}
- {what can kill the trade}
Lesson: {one rule}.

中文:
{人/账户} 从 {起点} 做到 {结果}.
大家忽略的是：
- {承担了什么风险}
- {不再做什么}
- {什么会毁掉这笔交易}
结论：{一条规则}.

日本語:
{人/口座} は {起点} から {結果} まで行った。
見落とされがちな点：
- {取ったリスク}
- {やめた行動}
- {崩れる条件}
教訓：{一つのルール}.

한국어:
{트레이더/계좌}가 {시작}에서 {결과}까지 갔다.
사람들이 놓치는 것:
- {감수한 리스크}
- {그만둔 행동}
- {망하는 조건}
교훈: {한 가지 규칙}.
```

- **Data source:** public PNL screenshot or wallet trail (~10 min), chart history (~5 min), position-size estimate (~5 min).
- **Cadence:** 1-2 per week; avoid daily PNL bait.
- **Why it compounds:** aspiration plus risk makes the account feel useful instead of purely promotional.

### Token / Venue Call

- **Evidence:** strongest in perps-en and trenches-en. Median engagement: perps-en 291.5, trenches-en 143, perps-cn 266, trenches-cn 80, perps-jp 50.
- **Exemplars:** [Nullfee phase call](https://x.com/Nullfee/status/2056409025873387832) (~1 min), [Xeffy mini-app launch](https://x.com/Xeffy_io/status/2061007479996383477) (~1 min), [Domingo_gou TermMax update](https://x.com/Domingo_gou/status/2062700934430663046) (~1 min).
- **Template:**

```text
EN:
Watching {token/venue}.
Why now: {trigger}
What is real: {volume/users/feature}
What can rug the thesis: {risk}
My line: {level/date/condition}

中文:
我在看 {币/平台}.
为什么现在看：{触发点}
真实的东西：{成交量/用户/功能}
会毁掉逻辑的是：{风险}
我的线：{价格/日期/条件}

日本語:
{銘柄/取引所} を見ている。
今見る理由：{材料}
実体：{出来高/ユーザー/機能}
崩れる条件：{リスク}
見るライン：{価格/日付/条件}
```

- **Data source:** contract or venue page (~3 min), chart/liquidity check (~4 min), official announcement (~3 min), wallet/rug screen if memecoin (~5 min).
- **Cadence:** only when a new trigger exists; overuse becomes shill noise.
- **Why it compounds:** followers want early context, but they punish blind calls.

### Thread Hook

- **Evidence:** highest median format in trenches-en and strong in perps-en. Median engagement: trenches-en 557, perps-en 283.5.
- **Exemplars:** [daddyriskbets exploit story](https://x.com/daddyriskbets/status/2052478368046592437) (~1 min), [Grayscale HYPE thread](https://x.com/Grayscale/status/2062207173208473772) (~1 min), [Americanfort public-wallet dilemma](https://x.com/Americanfort_io/status/2050968630419235067) (~1 min).
- **Template:**

```text
EN:
{Big claim in one sentence}.

Most people think {common belief}.
The actual mechanism is {mechanism}.

Thread:
1. {proof}
2. {hidden risk}
3. {who benefits}
4. {what to do}
```

- **Data source:** incident proof or public data (~20 min), screenshots (~10 min), sequence write-up (~15 min).
- **Cadence:** weekly; save for strong evidence.
- **Why it compounds:** threads create authority when they explain a mechanism no one else has made simple.

### Question Bait

- **Evidence:** qualified in perps-en, trenches-cn, and perps-kr. Median engagement: perps-en 148, trenches-cn 67, perps-kr 63.5.
- **Exemplars:** [Americanfort principle question](https://x.com/Americanfort_io/status/2046233824162713744) (~1 min), [huahuayjy moral question](https://x.com/huahuayjy/status/2061447273633263952) (~1 min), [HANROROck Korean social question](https://x.com/HANROROck/status/2059410645800615973) (~1 min).
- **Template:**

```text
EN: What is the one {principle/tool/risk} you refuse to ignore in {market}?
中文: {场景} 里，你最不能接受的 {风险/行为} 是什么？
한국어: {상황}에서 절대 못 참는 {리스크/행동} 뭐임?
```

- **Data source:** none; use current market context (~5 min).
- **Cadence:** 2-3 per week, between utility posts.
- **Why it compounds:** replies reveal pain and vocabulary for future utility posts.

### Meme Short

- **Evidence:** qualified in all six cells, but performance is uneven. Median engagement: perps-cn 91, perps-kr 38, trenches-cn 19, perps-jp 10.5, perps-en 5, trenches-en 0.
- **Exemplars:** [nangongyuan Hyperliquid skepticism](https://x.com/nangongyuan/status/2061437654517035132) (~1 min), [Zhixiajcmj X-culture observation](https://x.com/Zhixiajcmj/status/2061879931949453681) (~1 min), [o_MingMint Korean 손절 question](https://x.com/o_MingMint/status/2056225508782944379) (~1 min).
- **Template:**

```text
EN: {market} is just {pain} with better UI.
中文: {市场/平台} 不是机会，是 {痛点} 换了个皮。
日本語: {市場/銘柄}、結局 {痛み} をUIで包んだだけ。
한국어: {시장/거래소}, 결국 {고통}에 UI만 입힌 거임.
```

- **Data source:** live timeline mood (~5 min).
- **Cadence:** opportunistic; do not make it the core account.
- **Why it compounds:** useful for reach, weak for trust unless paired with data.

### Unclassified Viral Bait (`other`)

- **Evidence:** qualified in all cells, but it is a classifier bucket, not a content strategy. Median engagement: perps-en 185, trenches-en 183.5, perps-cn 167, trenches-cn 137, perps-jp 82, perps-kr 70.
- **Exemplars:** [Xeffy user milestone](https://x.com/Xeffy_io/status/2062783946954527223) (~1 min), [Americanfort privacy/compliance post](https://x.com/Americanfort_io/status/2060028328166240512) (~1 min), [giyommigirl Korean social post](https://x.com/giyommigirl/status/2057481995937325119) (~1 min).
- **Template:** not recommended. Convert the post into one of the structured formats above before publishing.
- **Data source:** varies.
- **Cadence:** none.
- **Why it compounds:** it does not compound reliably; it mostly captures personality, shock, or off-topic virality.

## Anti-patterns observed

| anti-pattern | evidence | why it underperforms or fails to compound |
|---|---|---|
| Pure meme-short as core strategy | trenches-en meme_short median was 0 despite viral outliers like [OrevaZSN](https://x.com/OrevaZSN/status/2061060249209974804) (~1 min) | It can go viral, but it does not teach the audience why to return. |
| Generic "next Hyperliquid" label | Japanese map flags "next Hyperliquid" chasing as mocked; evidence includes [cryptobaby](https://x.com/cryptobaby/status/2060665312140550157) (~1 min) | Sophisticated audiences want venue mechanics, not lazy comparisons. |
| Giveaway as research substitute | Giveaways perform in trenches, e.g. [nancy_c813](https://x.com/nancy_c813/status/2058416531617533952) (~1 min), but the action is follow/repost/address | It buys attention without building analytical trust. |
| Celebrity shock without a local edge | `other` buckets in JP/KR include large off-topic viral posts, e.g. [investorMM](https://x.com/investorMM/status/2060362392010441029) (~1 min) | The reach is real, but the audience is not necessarily tradable or retained. |
| Blind CA posting | CA calls qualify, but trenches maps show villains around insiders, rugs, and late retail exits; see [DataC58218](https://x.com/DataC58218/status/2062251993830240370) (~1 min) | A call without risk context makes the account look like exit liquidity. |

## Glossary

| term | gloss |
|---|---|
| CA | Contract address; the address users paste to find or trade a token. |
| DEX | Decentralized exchange; an exchange that runs through on-chain rails rather than a centralized operator. |
| Perp | Perpetual futures contract; leveraged derivative with no expiry. |
| OI | Open interest; total open derivative position size. |
| Funding / 资金费率 / 펀딩비 / 資金調達率 | Periodic payment between long and short perp traders. |
| Liquidation / 爆仓 / 清算 / 청산 | Forced close when margin is insufficient. |
| 追証 | Japanese margin call; additional collateral required after losses. |
| 養分 | Japanese slang for the loser who feeds smarter traders. |
| 土狗 | Chinese low-quality or speculative memecoin. |
| 金狗 | Chinese "golden dog"; a memecoin that runs hard. |
| 打狗 / 冲狗 | Chinese idiom for trading or aping dog/memecoins. |
| 貔貅盘 | Chinese honeypot-style token; easy to buy, hard or impossible to sell. |
| 老鼠仓 | Insider or privileged-position trading. |
| 손절 | Korean stop-loss or cutting a position/relationship. |
| 물타기 | Korean averaging down. |
| 김프 | Kimchi premium; Korean-market price premium versus global markets. |
| TGE | Token generation event; token launch/distribution moment. |
| RWA | Real-world asset; stocks, bonds, commodities, or claims represented through crypto rails. |
