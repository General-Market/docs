# 5 Sub-Niche Twitter Accounts — Strategy

## Competitive Research Summary

| Niche | Existing players | Their weakness |
|-------|-----------------|----------------|
| Congress trades | @PelosiTracker_ (1.2M), @unusual_whales (400K+), @CapitolTrades | Only track congress. Nobody tracks CEO/CFO insider sells or cluster detection |
| Earthquake alerts | @USGSted, @earthquakeBot, regional bots | Boring wire format. "M5.2, 35km depth, lat/long." No context, no outcome |
| Crypto movements | @whale_alert (2.5M), @WatcherGuru (385K) | Saturated. Don't compete here |
| Weather | NWS offices, storm chasers | Fragmented by region. No unified "planet is breaking" feed |
| Air quality | @smokeybot (tiny) | Almost nobody doing AQI alerts virally |
| Power outages | Nobody | **Wide open** |
| Internet outages | Nobody doing it virally | **Wide open** |
| Flight chaos | Airline-specific, no aggregator | **Wide open** |
| Transit disruptions | Official MTA/TfL/RATP accounts | They post excuses, not drama |
| Gov spending waste | @DOGE (political) | No neutral, data-driven version |
| Theme park waits | McBroken is a website | Not an active viral Twitter feed |
| Gaming records | Nobody aggregating milestones | **Wide open** |
| Solar/aurora | @NWSSWPC (clinical) | Nobody says "GO OUTSIDE NOW" |

---

## Branding

All 5 accounts are **GeneralMarket sub-brands**. Unified naming, unified visual identity, cross-linked.

| Account | Handle |
|---------|--------|
| Insider trades | `@GeneralInsiders` |
| Infrastructure | `@GeneralGridDown` |
| Planet events | `@GeneralSkyWatch` |
| Gov spending | `@GeneralTaxReceipt` |
| Weird data | `@GeneralGlitch` |
| Main account | `@GeneralMarket` |

**Visual identity:**
- Same profile pic template: GM logo with a colored accent per account (red=insiders, yellow=grid, blue=sky, green=taxes, purple=glitch)
- Same banner template: "General Market — [niche tagline]" + generalmarket.io
- Same bio structure: "[What we track]. Part of @GeneralMarket. Live data → generalmarket.io"

**Cross-linking:**
- Every account bio includes "Part of @GeneralMarket"
- @GeneralMarket main account retweets the best from all 5
- @GeneralMarket pinned tweet: "We run 5 data feeds tracking the world in real-time: @GeneralInsiders @GeneralGridDown @GeneralSkyWatch @GeneralTaxReceipt @GeneralGlitch — follow the ones you care about, or follow us for the highlights."
- When events cascade across niches (wildfire → power outage → FEMA spending), accounts quote-tweet each other

**Why this is better than standalone names:**
- Every viral tweet from any account promotes the GeneralMarket brand
- Followers of one account discover the others through the naming pattern
- The main @GeneralMarket account acts as a "best of" curator
- Unified brand = trust. Random bot names = spam vibes.

---

## The 5 Accounts

### Account 1: `@GeneralInsiders`
**Tagline**: "General Market — Insiders. We read the SEC filings so you don't have to."
**Sources**: sec (insider trading), finra (short interest), congress, cftc

#### Why this wins
PelosiTracker has 1.2M followers doing ONLY congress trades. We go wider: **every insider** — CEOs dumping stock before earnings, clusters of executives selling the same week, short interest spiking on the same stocks, suspicious timing between filings and news. The "follow the money" account that connects dots nobody else connects.

#### What PelosiTracker doesn't do (our edge)
- CEO/CFO insider sells with timing context ("sold $89M... earnings in 4 days")
- Cluster detection ("5 Nvidia execs all sold the same week")
- Short interest overlay ("GameStop short volume at 68% — same level as Jan 2021")
- Retroactive catches ("insiders sold $12M last week. Stock dropped 8% today.")
- Cross-referencing congress trades with committee votes

#### Decision tree
```
filing detected
├── CONGRESS TRADE
│   ├── suspiciously timed (before vote/announcement)
│   │   └── RAGE: "[politician] bought [sector] [N] days before voting on [bill]"
│   ├── large (> $100K)
│   │   └── MONEY: "[politician] just [bought/sold] $[X] in [company] — their [Nth] trade this [period]"
│   └── small / routine → skip
│
├── CEO/CFO/BOARD INSIDER SALE
│   ├── > $50M single trade
│   │   ├── first sale in years → MONEY: "[person] sold for the first time in [N] years — $[X]M"
│   │   ├── before earnings (< 2 weeks) → MONEY: "[person] dumped $[X]M — earnings in [N] days"
│   │   └── normal scheduled (10b5-1) → skip
│   ├── cluster: 3+ insiders same company same week
│   │   ├── all selling → MONEY: "[N] [company] insiders all sold — $[total]M in [N] days. They know something."
│   │   └── all buying → MONEY: "[N] insiders just bought [company] — rare conviction signal"
│   └── < $10M, no cluster → skip
│
├── RETROACTIVE CATCH (sell happened, bad news followed)
│   └── RAGE: "[company] insiders sold $[X]M last [period]. Today: [bad news]. Coincidence?"
│
├── SHORT INTEREST SPIKE
│   ├── known stock, > 60% short volume
│   │   ├── WSB-relevant → MONEY: "[stock] short volume at [X]% — [comparison to squeeze history]"
│   │   └── sector cluster (3+ same sector) → MONEY: "Hedge funds betting against the entire [sector] — [N] stocks above 50% short"
│   ├── before earnings → MONEY: "Someone very bearish on [company] — [X]% short volume, earnings [when]"
│   └── < 50% → skip
│
└── SHORT SELLERS LOSING
    └── WTF: "[stock] shorts lost $[X]B this [period] — the stock won't stop going up"
```

#### Mockups (10)
1. MONEY: "Nvidia CEO sold $48M in stock today. That's 5 consecutive trading days of selling. Total: $230M in 3 weeks."
2. RAGE: "Senator bought $500K in defense stocks. 72 hours later, voted yes on the $886B military budget. This is legal."
3. MONEY: "5 Tesla executives all sold shares in the same 4-day window — $89M total. Earnings report in 6 days."
4. MONEY: "GameStop short volume hit 68% today. Last time it was this high: January 2021. You remember what happened next."
5. RAGE: "Pfizer insiders sold $12M in stock two weeks ago. Today: stock dropped 8% on failed trial data. Just a coincidence."
6. MONEY: "JPMorgan's CEO just sold stock for the first time in 18 years. $150M. He has never done this before. Ever."
7. MONEY: "7 regional bank stocks are above 50% short volume simultaneously. Hedge funds are betting the banking crisis has a second act."
8. RAGE: "Members of Congress made 3,400 stock trades last year. They beat the S&P 500 by 12%. They also write the laws."
9. WTF: "Tesla short sellers have lost $4.1B this month. Stock is up 30%. They're still holding. Some people like pain."
10. MONEY: "12 biotech insiders bought the same tiny company this week. They almost never agree. When insiders cluster-buy, pay attention."

#### Posting cadence
- 5-10 tweets/day (SEC filings come in batches)
- Peak hours: market open (9:30am ET), after-hours filings (4-6pm ET)
- Weekly thread: "This week's most suspicious insider trades"

#### CTA
- Bio: "SEC insider trades. Short interest. Congressional stock moves. Part of @GeneralMarket. Live data → generalmarket.io"
- Pinned: "We track every SEC insider filing, short interest spike, and congressional trade in real-time. All tradeable at generalmarket.io"
- Self-reply on viral tweets (1h later): "Live short interest data → generalmarket.io/vision/finra"

---

### Account 2: `@GeneralGridDown`
**Tagline**: "General Market — Grid. When things stop working."
**Sources**: power_outages, ioda (internet), faa_delays, flights, mta_subway, tfl_tube, paris_metro, db_trains, ryanair

#### Why this wins
**Nobody aggregates infrastructure failures.** When Texas loses power, when Pakistan's internet goes dark, when the FAA issues a ground stop, when 8 subway lines go down at rush hour — there's no single account for "things are broken right now." People search Twitter during outages looking for confirmation. Be the first result.

#### What exists (and why it's not enough)
- Power outages: nothing viral
- Internet outages: IODA has data, no viral Twitter presence
- Flight delays: FlightRadar24 exists but is data-dense, not headline-format
- Transit: Official accounts (MTA, TfL) post excuses, not drama. "We are experiencing delays" ≠ "8 lines down at rush hour — the MTA spent $3.4B on upgrades"

#### Decision tree
```
event detected
├── POWER OUTAGE
│   ├── > 500K customers
│   │   ├── during extreme weather → FEAR: "[N] without power in [temp] — [danger context: no AC, pipes freezing]"
│   │   ├── no obvious cause → WTF: "[N] without power and nobody knows why"
│   │   └── grid emergency → FEAR: "Grid at [X]% reserves — [rolling blackouts starting/expected]"
│   ├── 50K-500K
│   │   ├── repeat event (Nth this year) → RAGE: "[state]'s [Nth] major outage this [period] — [utility] raised rates [X]%"
│   │   ├── during extreme temps → FEAR: "[N] without power in [temp] — [medical/safety risk]"
│   │   └── ironic → WTF: "[utility context + failure context]"
│   └── < 50K → skip
│
├── INTERNET OUTAGE (IODA)
│   ├── country < 10% connectivity
│   │   ├── authoritarian govt → RAGE: "[country] just went dark — [context: protests, elections, crackdown]"
│   │   ├── cable/infrastructure → FEAR: "[country] offline — [N]M people cut off. [cause]"
│   │   └── unknown → WATCH: "[country] internet collapsed — no explanation yet"
│   ├── 10-50% connectivity
│   │   ├── Nth time → RAGE: "[country] cut internet for the [Nth] time this year — [N]M people"
│   │   └── throttling specific platforms → RAGE: "[country] throttling [platform] to [X]% — [event context]"
│   └── > 50% → skip unless major country
│
├── FLIGHT CHAOS
│   ├── FAA ground stop
│   │   ├── nationwide → FEAR: "Every US flight grounded — [cause]. If you're at an airport, you're stuck."
│   │   └── major hub → WATCH: "Ground stop at [airport] — [cause]. Expect [N]h ripple delays."
│   ├── mass cancellations > 500
│   │   ├── airline failure → RAGE: "[airline] cancelled [N] flights — [IT failure/crew shortage]. [Nth time]."
│   │   └── weather → WATCH: "[N] flights cancelled as [storm] hits [region]"
│   └── normal delays → skip
│
├── TRANSIT CHAOS
│   ├── 4+ lines disrupted
│   │   └── RAGE: "[N] lines down in [city] at [rush hour?] — [Nth disruption this month]. [fare context]."
│   ├── same line failing repeatedly
│   │   └── RAGE: "[line] down for the [Nth] time this month — [operator] says '[excuse]'"
│   ├── bizarre cause
│   │   └── WTF: "[line] suspended because [absurd cause]"
│   └── 1-2 lines, routine → skip
│
└── COMBINED (multiple systems failing)
    └── FEAR/WTF: "[city/region]: power out + flights grounded + transit down. [context]."
```

#### Mockups (10)
1. FEAR: "340,000 Texans without power. It's 108°F. Hospitals on generators. Grid reserves at 2%. The infrastructure they said they fixed after 2021."
2. RAGE: "Iran just cut internet to 5% ahead of tomorrow's protests. 88 million people silenced."
3. FEAR: "FAA nationwide ground stop — every flight in America is grounded. System failure. No ETA."
4. RAGE: "8 NYC subway lines disrupted at rush hour. MTA spent $3.4B on upgrades last year. Fare: $2.90."
5. WTF: "Paris Metro Line 13 disrupted for the 12th time this month. Commuters have started a petition to rename it 'Line Sometimes.'"
6. FEAR: "Undersea cable cut in the Red Sea — 6 countries losing internet simultaneously. This affects global routing."
7. RAGE: "Ryanair averaging 54-minute delays today. The 8th day above 30 minutes this month. The €19 flights come with €19 reliability."
8. FEAR: "Puerto Rico: entire island dark. 1.4M customers without power. Again. The 3rd island-wide outage in 2 years."
9. WTF: "London Underground suspended a line because of a pigeon. The Victoria line is down. For a pigeon."
10. FEAR: "Atlanta airport lost power — the world's busiest airport is completely dark. 275,000 passengers, no information, no AC."

#### Posting cadence
- 8-15 tweets/day (infrastructure breaks constantly somewhere)
- FEAR tweets: post immediately (bypass queue)
- Peak: morning rush (transit), afternoon (flights), evening (power during heat/cold)

#### CTA
- Bio: "Power outages. Internet shutdowns. Flight chaos. Transit failures. Part of @GeneralMarket. Data → generalmarket.io"
- Weekly thread: "Everything that broke this week — by @GeneralMarket"

---

### Account 3: `@GeneralSkyWatch`
**Tagline**: "General Market — Sky. Look up."
**Sources**: spaceweather, earthquake, volcano, wildfire, airnow, weather_alerts

#### Why this wins
Earthquake bots exist but post boring wire data. NWS posts clinical forecasts. Storm chasers are regional. **Nobody combines all geophysical events into one "the planet is doing something" feed with clear outcomes** — "go outside and look north," "stay inside, the air is toxic," "this fault hasn't been this active in 6 years."

#### The secret weapon: LOOK tweets
Aurora content gets millions of impressions. When Kp hits 7+, people desperately want to know "can I see it from my city?" Our account is the one that tells them YES, GO OUTSIDE NOW. That's the viral hook that builds the audience. Then the earthquake/volcano/wildfire content retains them.

#### What exists (and why it's not enough)
- @USGSted: "M5.2, lat -3.4, lon 122.7, depth 35km" — who cares?
- @NWSSWPC: "G3 geomagnetic storm watch in effect" — what does that MEAN for me?
- @CalFireBot: Regional only, no national/global perspective
- Storm chasers: Great but individual, not aggregated

#### Decision tree
```
event detected
├── SOLAR / AURORA
│   ├── Kp ≥ 8 (G4+ storm)
│   │   ├── nighttime in populated areas
│   │   │   └── LOOK + FEAR: "GO OUTSIDE — aurora visible from [cities]. Also: GPS may be unreliable, [tech impacts]."
│   │   └── daytime
│   │       └── FEAR: "Major solar storm hitting Earth — [radio/GPS/grid impacts]. Aurora likely tonight."
│   ├── Kp 7 (G3) or X-class flare
│   │   ├── Nth event this week → WATCH: "[Nth] major solar event this week — the sun is in peak cycle and not calming down"
│   │   ├── aurora at unusual latitude → LOOK: "Aurora forecast as far south as [city] tonight — look north after [time]"
│   │   └── CME inbound → WATCH: "Solar storm heading for Earth — aurora likely in [N] hours at [latitude]"
│   ├── Kp 5-6 + significant context → WATCH
│   └── Kp < 5 → skip
│
├── EARTHQUAKE
│   ├── M ≥ 7.0
│   │   ├── coastal → FEAR: "M[X] off [location] — tsunami risk. If you're near the coast, move to high ground."
│   │   └── inland, populated → FEAR: "Major earthquake near [city] — [N]M people within [X]km. [historical context]."
│   ├── M 5.0-6.9 + populated area
│   │   ├── Nth this week → WATCH: "[Nth] M5+ near [location] this [period] — the [fault] hasn't been this active in [N] years"
│   │   ├── strongest since → RECORD: "Strongest quake near [city] since [year] — M[X]"
│   │   └── swarm → WATCH: "[N] earthquakes in [time] near [location] — [volcanic? fault stress?]"
│   ├── M 3.5-4.9 + major city (LA, NYC, London, Tokyo)
│   │   └── LOOK: "Did [city] just shake? M[X] — [context: rare for this city]"
│   └── M < 3.5 or remote → skip
│
├── VOLCANO
│   ├── eruption confirmed
│   │   ├── near population → FEAR: "[volcano] erupting [N]km from [city] — [evacuation/ashfall/lava context]"
│   │   ├── aviation impact → WATCH: "Flights rerouted — [volcano] ash cloud at [altitude]"
│   │   ├── Nth eruption → RECORD: "[location]'s [Nth] eruption in [period] — [hasn't been this active in N years]"
│   │   └── remote, visual → LOOK: "[volcano] erupting — [dramatic visual detail]"
│   ├── alert raised on historically dangerous volcano
│   │   └── WATCH: "[volcano] alert raised — [population in danger zone]. Last eruption: [year], [death toll]."
│   └── routine alert / lowered → skip
│
├── WILDFIRE
│   ├── > 2000 hotspots near city
│   │   └── FEAR: "Fire [N] miles from [city] — [N] hotspots. If you can see smoke, prepare to evacuate."
│   ├── smoke reaching distant city
│   │   └── FEAR: "Wildfire smoke from [source] hitting [city] — AQI [X]. Stay inside, close windows."
│   ├── dramatic vs-last-year / record season
│   │   └── RECORD: "[region] fires [X]% above last year — worst in [N] years"
│   ├── Nth major fire
│   │   └── WATCH: "[region]'s [Nth] major fire this season — no break since [month]"
│   └── < 500 hotspots, remote → skip
│
├── AIR QUALITY
│   ├── AQI > 300 (Hazardous)
│   │   └── FEAR: "[city] air is HAZARDOUS — AQI [X]. Stay inside. Close windows. This is not normal."
│   ├── AQI 150-300
│   │   ├── unexpected city → WTF: "[US city]'s air worse than [Delhi/Beijing] right now. AQI [X]."
│   │   ├── Nth bad day → RAGE: "[city] hasn't had breathable air in [N] days"
│   │   └── spike (doubled in <2h) → FEAR: "[city] AQI went from [X] to [Y] in 2 hours — smoke plume arriving. Get inside."
│   └── AQI < 150 → skip
│
└── SEVERE WEATHER
    ├── tornado warning in metro → FEAR: "Tornado warning [city] — take shelter NOW"
    ├── hurricane Cat 3+ landfall → FEAR: "Cat [X] hitting [location] — [N]M in the path"
    ├── record temperature → RECORD: "[city] hit [temp] — [hottest/coldest] since [year]. [danger context]."
    ├── Nth extreme event → WATCH: "[Nth] [event type] this [season] — [trend]"
    └── routine weather → skip
```

#### Mockups (10)
1. LOOK: "Go outside and look north RIGHT NOW — aurora visible from London, Chicago, and Paris tonight. Kp8 storm hitting Earth. This doesn't happen often."
2. FEAR: "3rd M5+ earthquake in Turkey this week. The Anatolian fault hasn't been this active in 6 years. 16 million people live near it."
3. WATCH: "4th X-class solar flare this week. The sun is in peak cycle and showing no signs of calming down. More aurora likely this weekend."
4. FEAR: "New York's air is the most toxic on Earth right now. AQI 342. Worse than Delhi. Stay inside and close your windows."
5. FEAR: "Fire 5 miles from downtown LA — 4,200 hotspots in 12 hours. If you can see smoke from your window, pack a bag."
6. RECORD: "Iceland's 5th eruption in 14 months. The Reykjanes peninsula hasn't been this active in 800 years. Something fundamental shifted underground."
7. FEAR: "M7.2 off the coast of Japan — tsunami warning for the entire Pacific rim. If you're on the coast, move to high ground now."
8. WATCH: "84 earthquakes under Yellowstone in 48 hours. USGS says no eruption risk 'for now.' The swarm is still growing."
9. RECORD: "Phoenix hit 121°F — hottest temperature ever recorded in a US city with 1M+ people. Your body can't cool itself at this temperature."
10. WTF: "Salt Lake City air quality is worse than Beijing right now. A US city. In 2026. AQI 218."

#### Posting cadence
- 5-8 tweets/day (geophysical events are less frequent but higher impact)
- FEAR + LOOK tweets: post immediately
- Aurora tweets: must post BEFORE peak viewing (timing is everything)

#### CTA
- Bio: "Earthquakes. Eruptions. Solar storms. Wildfires. Air quality. Part of @GeneralMarket. Live data → generalmarket.io"
- Pinned: "We track every earthquake, eruption, solar storm, and wildfire in real-time. When to look up, stay inside, or run — we tell you first. Part of @GeneralMarket."

---

### Account 4: `@GeneralTaxReceipt`
**Tagline**: "General Market — Taxes. Where your money actually goes."
**Sources**: usa_spending, congress (votes), courtlistener, zillow, fred/treasury (when wallet-relevant)

#### Why this wins
DOGE has millions of followers but is **politically aligned** — they push an agenda. There's no neutral, absurdist, data-driven account that just shows where federal money goes and lets people be outraged on their own. Plus: housing affordability data + interest rate impacts = everyone's wallet.

#### The angle
Every tweet answers: "What did your taxes pay for today?" or "How is the government affecting your wallet?"

The absurdity sells itself. You don't need political spin when the Pentagon can't pass an audit and a contractor charges $1,200 per bolt.

#### Decision tree
```
event detected
├── FEDERAL SPENDING
│   ├── single contract > $500M
│   │   ├── controversial recipient → RAGE: "$[X]B to [company] for [purpose] — [context: buried in bill, no-bid, etc.]"
│   │   ├── suspicious timing → RAGE: "$[X]M awarded [N] days before [related event]"
│   │   └── absurd purpose/price → WTF: "$[X]M for [purpose]. [relatable comparison: 'that's $X per citizen']"
│   ├── pattern/waste
│   │   ├── can't account for → RAGE: "[department] can't find $[X] — [Nth audit failure / since year]"
│   │   ├── money to defunct org → RAGE: "$[X] went to organizations that no longer exist"
│   │   └── price gouging → WTF: "[contractor] charged $[absurd price] per [item]. You can buy it for $[normal price]."
│   └── routine appropriation → skip
│
├── CONGRESS ACTION
│   ├── vote affecting daily life
│   │   ├── close margin → RAGE: "[bill in plain English] passed [margin]. Your [senator/rep] voted [yes/no]."
│   │   └── ironic contrast → RAGE: "Congress [did X for themselves] while [blocking Y for you]"
│   ├── bill killed repeatedly
│   │   └── RAGE: "[bill] killed for the [Nth] time. [year span]. Same bill, same result."
│   └── procedural / non-impactful → skip
│
├── COURT RULING
│   ├── affects millions → WATCH: "[court] just [ruled] on [topic] — what this means for [your rights/money/privacy]"
│   ├── massive settlement → MONEY: "$[X]B verdict against [company] — [what they did]"
│   └── routine filings → skip
│
├── HOUSING / WALLET
│   ├── affordability milestone → RAGE: "You need $[X]K/year to afford the median home. Median salary: $[Y]K. The gap: [widest ever]."
│   ├── rent ATH → RAGE: "Rent in [city]: $[X]/month. After-tax median salary: $[Y]/month. Do the math."
│   ├── absurd listing → WTF: "[description] for $[price] in [city]."
│   ├── rate impact → MONEY: "[rate] just hit [X]% — your [mortgage/loan] now costs $[X] more per month than [timeframe]"
│   └── normal fluctuation → skip
│
└── COMBINED IRONY (spending + housing + rates)
    └── RAGE: "[government spent $X on Y] while [housing/rates/debt context for citizens]"
```

#### Mockups (10)
1. RAGE: "$800M contract to Palantir for border surveillance AI. Buried on page 847 of a 1,200-page bill. Nobody voted on this specifically."
2. WTF: "NASA contractor charged $1,200 per bolt. You can buy the same bolt at Home Depot for $0.35. Your taxes paid the difference."
3. RAGE: "Pentagon failed its audit for the 7th consecutive year. $2.3 trillion unaccounted for. If you failed your taxes 7 years in a row, you'd be in prison."
4. RAGE: "Congress voted themselves a $12,000 raise last Tuesday. On Wednesday, they blocked a vote on the minimum wage. It's been $7.25 since 2009."
5. RAGE: "You need $115K/year to afford the median US home. Median salary: $59K. The gap has never been wider in American history."
6. WTF: "A parking spot in Boston just listed for $375,000. Three hundred and seventy-five thousand dollars. For a rectangle of concrete."
7. MONEY: "30-year mortgage hit 8.5% — that $400K house now costs $850/month MORE than it did 2 years ago. Same house. Same neighborhood."
8. RAGE: "$4.7B in PPP loans went to companies that immediately laid off every worker. The loans were forgiven. The workers were not."
9. RAGE: "Federal judge blocked the biggest climate regulation — 14 states sued. The rule would have cut emissions 40%. Now it cuts nothing."
10. WTF: "$50M federal grant to study why people are lonely. The study employed 3 researchers and took 4 years. They concluded: screens."

#### Posting cadence
- 3-6 tweets/day (spending data comes in batches, court rulings are event-driven)
- Housing/rates: post when milestones hit (ATH, records)
- Weekly thread: "What your taxes paid for this week"

#### CTA
- Bio: "Federal contracts. Congressional votes. Housing costs. Where your money goes. Part of @GeneralMarket. Data → generalmarket.io"
- Pinned: "We read every federal contract, every congressional vote, and every housing report so you don't have to. Part of @GeneralMarket."

---

### Account 5: `@GeneralGlitch`
**Tagline**: "General Market — Glitch. The world's weirdest data."
**Sources**: mcbroken, queue_times, steam, twitch, reddit, hackernews, github/npm, shelter, sports/esports, tmdb

#### Why this wins
This is the **entertainment/WTF account** — the one people follow for fun, not fear. McBroken proved that absurd data goes viral. Theme park wait times are inherently funny when framed as "$220 to stand in line." Gaming records are inherently shareable. Reddit drama crosses over to Twitter constantly.

The vibe: "the most interesting thing happening in the world right now, according to data most people don't know exists."

#### What makes this different from a news account
Every tweet has a "you can't make this up" quality. These aren't serious. They're the tweets people screenshot and send to friends.

#### Decision tree
```
event detected
├── McDONALD'S ICE CREAM (mcbroken)
│   ├── city > 30% broken → WTF: "[X]% broken in [city] — [ironic context: heat wave, new menu item]"
│   ├── 0% broken anywhere → WTF: "Every machine in [city] is working. Mark this day in history."
│   ├── national > 15% → WTF: "1 in [N] machines broken nationally — [context]"
│   └── normal 8-12% → skip
│
├── THEME PARKS (queue_times)
│   ├── any ride > 200 min → WTF: "[ride] wait: [N] minutes. The ride is [duration]. You stand in line for [X]% of the experience."
│   ├── park-wide avg > 90 min → RAGE: "Average wait at [park]: [N] min. Tickets: $[X]. You're paying to stand."
│   ├── unexpected closure → WTF: "[park] closed all rides — [reason]"
│   └── normal waits → skip
│
├── GAMING (steam + twitch)
│   ├── new concurrent record → RECORD: "[game] hit [N] players — more than the population of [city]"
│   ├── indie beats AAA → WTF: "[game] by [N] people just [beat metric] of [AAA game]. Budget: $[X] vs $[Y]."
│   ├── mass negative reviews → RAGE: "$[X] game: [X]% negative reviews. [What went wrong]."
│   ├── Twitch record → RECORD: "[N] people watching one person [do thing] — more than [TV comparison]"
│   ├── category shift → WTF: "'Just Chatting' has more viewers than all gaming combined. [platform] isn't a gaming platform anymore."
│   └── normal fluctuations → skip
│
├── REDDIT (reddit)
│   ├── sub gains > 100K/day → WTF: "r/[sub] gained [N]K subs in 24h — last time: [what happened]"
│   ├── mass protest/shutdown → RAGE: "[N] subreddits dark — [N]M subscribers. [why]"
│   ├── sub overtakes another (symbolic) → RECORD: "r/[A] bigger than r/[B] — [what this means]"
│   └── normal growth → skip
│
├── DEV ECOSYSTEM (github + npm + hackernews)
│   ├── repo 0→10K+ stars in days → WTF: "GitHub repo: 0 to [N]K stars in [N] days — [what it does]"
│   ├── HN > 1000 pts → WTF/WATCH: "Top HN: '[headline]' — [N] points. [brief context]"
│   ├── supply chain incident → FEAR: "[package] with [N]M downloads compromised — check your dependencies"
│   ├── absurd package → WTF: "'[name]' has [N]K weekly downloads. It's [N] lines. It [does trivial thing]."
│   └── normal stats → skip
│
├── ANIMAL SHELTERS (shelter)
│   ├── capacity crisis → WATCH: "[city] shelters at [X]% capacity — [N] animals need homes. [euthanasia context]."
│   ├── mass adoption event → LOOK: "[event]: [N] animals adopted in [time]. The good news you needed."
│   ├── long-term resident → WATCH: "[animal] in [city] has waited [N] days. [name]. Still there."
│   ├── national trend worsening → RAGE: "Shelter intake up [X]% nationally — people got bored of their pandemic pets"
│   └── normal daily numbers → skip
│
├── MOVIES/TV (tmdb)
│   ├── unexpected hit → WTF: "$[X]M indie beating $[X]M blockbuster at box office"
│   ├── cultural surprise → WTF: "Most popular show in [N] countries: [non-English show]"
│   └── normal rankings → skip
│
├── SPORTS (sports + esports)
│   ├── historic upset → WTF: "[underdog] beat [favorite] — [how rare]"
│   ├── bizarre score → WTF: "[sport] ended [score] — last time: [year]"
│   ├── esports vs traditional → RECORD: "[game event] got more viewers than [traditional sport event]"
│   └── normal results → skip
│
└── CROSS-SOURCE ABSURDITY (combine 2+ sources)
    └── WTF: "[weird juxtaposition from different data sources]"
```

#### Mockups (10)
1. WTF: "33% of McDonald's ice cream machines in Atlanta are broken. It's 97°F outside. McDonald's made $6.5B profit last quarter."
2. WTF: "Space Mountain wait: 4 hours. The ride is 2 minutes and 30 seconds. You stand in line for 96% of the experience. Tickets: $220."
3. RECORD: "A game made by 5 people just sold 25 million copies. Palworld. Five people. Twenty-five million copies."
4. WTF: "The npm package 'is-odd' has 500,000 downloads per week. It's one line of code: `return n % 2 === 1`. The JavaScript ecosystem, everyone."
5. WTF: "r/wallstreetbets gained 200K subscribers in 24 hours. The last time this happened, GameStop went up 1,600%. Something is stirring."
6. WATCH: "A cat in Denver has been waiting 847 days for adoption. Her name is Patches. She's still there."
7. RECORD: "Counter-Strike major final: 2.7M concurrent viewers. More people watching 5 guys play a video game than watched the World Series."
8. WTF: "Netflix's #1 movie right now is a $3M documentary about fungi. It's beating every $200M blockbuster on the platform."
9. WTF: "16-seed just beat a 1-seed in March Madness. This has happened exactly twice in 39 years. Vegas odds were 500:1."
10. RAGE: "Steam reviews for this $70 game: 91% negative. It launched broken. The studio went silent. They already have your money."

#### Posting cadence
- 5-10 tweets/day
- Best posted during evening/weekend (entertainment hours)
- No urgency — quality over speed for this account

#### CTA
- Bio: "Ice cream machines. Theme park lines. Gaming records. Reddit drama. Data nobody else tracks. Part of @GeneralMarket → generalmarket.io"
- Pinned: "We track 98 real-world data feeds. Some of them are really, really weird. All of them are tradeable at generalmarket.io. Part of @GeneralMarket."

---

## Account Summary

| # | Handle | Display Name | Niche | Competition | Sources |
|---|--------|-------------|-------|-------------|---------|
| 1 | @GeneralInsiders | General Market — Insiders | Money flows | PelosiTracker (congress only) | sec, finra, congress, cftc |
| 2 | @GeneralGridDown | General Market — Grid | Infrastructure failures | Nobody | power_outages, ioda, faa, flights, transit |
| 3 | @GeneralSkyWatch | General Market — Sky | Planet events | Boring earthquake bots | spaceweather, earthquake, volcano, wildfire, airnow, weather |
| 4 | @GeneralTaxReceipt | General Market — Taxes | Government money | DOGE (political) | usa_spending, congress, courts, zillow, fred |
| 5 | @GeneralGlitch | General Market — Glitch | Weird data | McBroken (website only) | mcbroken, queue_times, steam, twitch, reddit, github, shelter, sports |
| — | @GeneralMarket | General Market | Best-of curator | — | retweets from all 5 |

## Growth Strategy

**Phase 1 (Month 1-2)**: Launch all 5 simultaneously. Each posts 3-5/day minimum.

**Phase 2 (Month 2-4)**: Double down on whichever account gets first viral hit. The first earthquake, the first power outage, the first ice cream tweet that hits — that account gets priority.

**Phase 3 (Month 4-12)**: Cross-promote between accounts. @GeneralSkyWatch tweets about a wildfire → @GeneralGridDown tweets about the power outages it causes → @GeneralTaxReceipt tweets about the FEMA spending response.

**The flywheel**: All 5 accounts share a pinned thread linking to each other and to generalmarket.io. When one goes viral, the others benefit.

## Shared Infrastructure

All 5 accounts run from the same codebase:
- Same data-node (already running)
- Same anomaly detector (shared, per-source thresholds)
- Same Claude headline writer (different system prompts per account for tone)
- Same posting pipeline (shared queue, per-account scheduling)
- One SQLite db for all dedup + history
- 5 Twitter API free tier accounts = 7,500 tweets/month total
