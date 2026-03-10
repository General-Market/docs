# @GeneralMarket — Viral News From 98 Data Feeds

## The Formula

Every tweet has 3 parts:

```
[WHAT HAPPENED] — [CONTEXT that makes it significant] — [OUTCOME for the reader]
```

**WHAT**: The raw fact.
**CONTEXT**: Nth time, worst since, % above normal, trend direction.
**OUTCOME**: Should you fear, look, act, laugh, rage, or prepare?

Examples of the shift:

| Bad (wire service) | Good (viral) |
|---|---|
| "M5.2 earthquake in Turkey" | "3rd M5+ earthquake in Turkey this week — seismologists say the fault line is 'unusually active'" |
| "Power outage in Texas: 200K" | "200,000 Texans just lost power — it's 104°F outside and the grid is at 3% reserves" |
| "Kp index at 8" | "Look north tonight — aurora visible as far south as Chicago. 4th major solar storm this month, the sun is not calming down" |
| "AQI 342 in NYC" | "New York's air is more toxic than Delhi right now. Stay inside — 3rd smoke event this summer" |
| "GameStop short volume 68%" | "GameStop short volume just hit 68% — same level that preceded the 2021 squeeze" |

---

## Reader Outcome Types

Every tweet MUST map to one of these:

| Tag | Meaning | Trigger words in tweet |
|-----|---------|----------------------|
| **FEAR** | This is dangerous, protect yourself | "stay inside", "take shelter", "prepare", "evacuate" |
| **LOOK** | This is beautiful/spectacular, go see it | "look north", "go outside", "visible tonight", "once in a decade" |
| **MONEY** | This affects your wallet or portfolio | "your mortgage", "gas prices", "if you hold X", "your rent" |
| **RAGE** | This is unfair, be outraged | "while you...", "quietly", "again", "the Nth time" |
| **WTF** | This is absurd, share it | "somehow", "yes really", "not a joke", "you can't make this up" |
| **WATCH** | This is developing, follow along | "and it's accelerating", "still rising", "no signs of stopping" |
| **RECORD** | This has never happened / hasn't in X years | "first time since", "new record", "never before", "highest ever" |

Claude's system prompt MUST classify each tweet into one of these before posting. If it doesn't clearly fit any → don't post.

---

## Context Engine

Before Claude writes the headline, the system injects context. This is computed programmatically from historical data:

```
CONTEXT INJECTION (computed before LLM call):

1. FREQUENCY:    "Nth event of this type in [period]"
                 → "3rd X-class flare this week"
                 → "12th subway disruption this month"
                 → "4th insider sell at this company in 2 weeks"

2. COMPARISON:   "worst/best/highest/lowest since [date]"
                 → "worst AQI since the 2023 Canadian fires"
                 → "highest short interest since Jan 2021"
                 → "lowest mortgage rate since March"

3. TREND:        "Xth consecutive [day/week/month] of [direction]"
                 → "oil rising for 9 consecutive days"
                 → "14th straight month of price decline in Austin"
                 → "3rd consecutive week of reactor shutdowns"

4. HUMAN SCALE:  "X people affected" / "equivalent to [relatable thing]"
                 → "1.4M people without internet"
                 → "fire now larger than Rhode Island"
                 → "enough to fill Madison Square Garden 12 times"

5. DELTA:        "up/down X% from [period]"
                 → "340% above last year"
                 → "dropped 40% in 2 hours"
                 → "doubled since Monday"
```

This context is fed to Claude alongside the raw data. Claude picks the most dramatic framing.

---

## Decision Trees Per Source

### EARTHQUAKE

```
earthquake detected
├── M ≥ 7.0
│   ├── coastal → FEAR: "Tsunami risk. [location] coast — if you're near the shore, move to high ground"
│   └── inland  → FEAR: "Major earthquake — buildings may be damaged. [Nth M7+ this year]"
├── M 5.0–6.9
│   ├── populated area (>500K people within 100km)
│   │   ├── first in region this month → WATCH: "Felt that? M[X] near [city] — [depth]km deep"
│   │   ├── 2nd+ this week → WATCH: "[Nth] M5+ near [city] this [period] — the [fault name] is restless"
│   │   └── strongest in X years → RECORD: "Strongest earthquake near [city] since [year] — M[X]"
│   └── remote area
│       ├── first in region → skip (nobody cares about M5 in the Aleutians)
│       └── swarm (3+ in 24h) → WATCH: "Earthquake swarm: [N] quakes in [hours]h near [location] — volcanic?"
├── M 3.5–4.9
│   ├── major city (NYC, LA, London, Tokyo, Paris)
│   │   └── LOOK: "Did [city] just shake? M[X] felt across the metro — [rare context]"
│   └── else → skip
└── M < 3.5 → always skip
```

**Mockups:**
1. FEAR: "M7.2 off the coast of Japan — tsunami warning issued for the entire Pacific coast. Get away from the shore."
2. FEAR: "M6.8 in central Italy — same fault zone as the 2016 earthquake that killed 299 people"
3. WATCH: "3rd M5+ earthquake in Turkey this week — seismologists say the Anatolian fault is under unusual stress"
4. WATCH: "Earthquake swarm near Yellowstone: 84 quakes in 48 hours — USGS monitoring but says no eruption risk yet"
5. RECORD: "Strongest earthquake in New York in 140 years — M4.8, felt from Boston to Philadelphia"
6. LOOK: "Did LA just shake? M4.1 felt across the entire metro — 2nd one this month"
7. WATCH: "M5.9 near Istanbul — 16 million people live within 50km of this fault. The 'big one' is overdue."
8. RECORD: "Indonesia's 5th M6+ earthquake this year — the most active seismic year since records began"
9. FEAR: "M7.5 in the Himalayas — felt across northern India, Pakistan, and Nepal. Infrastructure damage expected."
10. WTF: "Oklahoma just had its 4th earthquake this week — all fracking-linked. The state has gone from 2 quakes/year to 200."

---

### POWER OUTAGES

```
outage detected
├── > 500K customers
│   ├── extreme weather happening → FEAR: "still [condition] outside — [N] without power, no AC/heat"
│   ├── no obvious cause → WTF: "[N] without power and nobody knows why — [utility] investigating"
│   └── grid emergency → FEAR: "Grid at [X]% reserves — rolling blackouts [starting/likely]"
├── 50K–500K
│   ├── repeated event → RAGE: "[Nth] major outage in [state] this [period] — the grid can't handle [weather]"
│   ├── during heatwave/cold snap → FEAR: "[N] without power in [temp] heat/cold — [danger context]"
│   └── ironic timing → WTF: "[utility] raised rates [X]% this year. [N] customers without power right now."
├── < 50K → skip (unless famous city + ironic)
└── grid held under stress → RECORD (positive): "[City] hit [extreme temp] and the grid held — 0 outages"
```

**Mockups:**
1. FEAR: "340,000 Texans without power and it's 108°F outside — hospitals switching to generators. Grid reserves at 2%."
2. FEAR: "1.4 million without power in Puerto Rico — the entire island is dark. Again."
3. RAGE: "Florida just had its 3rd major outage this summer — FPL raised rates 22% last year"
4. WTF: "47,000 New Yorkers lost power — ConEd says a raccoon got into a substation. Yes, again."
5. FEAR: "Michigan: 300,000 without power in -15°F windchill — pipes will start freezing in hours"
6. RAGE: "Texas grid failed again — same infrastructure they said they'd fix after 2021. 200K in the dark."
7. WATCH: "California rolling blackouts starting tonight — charge your devices, it's going to be a long one"
8. RECORD: "Phoenix hit 120°F and the grid held — zero outages. First time the grid survived a 120°F day."
9. FEAR: "Hurricane making landfall and 800,000 already without power — number still climbing fast"
10. WTF: "Power went out during the governor's press conference about grid reliability"

---

### SPACEWEATHER / AURORA

```
solar event detected
├── Kp ≥ 8 or G4+ storm
│   ├── nighttime in populated areas → LOOK + FEAR: "aurora + possible [disruptions]"
│   └── daytime → FEAR: "GPS/radio disruptions possible — [impact context]"
├── Kp 7 or G3 or X-class flare
│   ├── aurora visible at unusual latitudes → LOOK: "go outside tonight — [visible where]"
│   ├── Nth event this week → WATCH: "[Nth] major flare this week — the sun is [not calming down/in peak cycle]"
│   └── CME inbound → WATCH: "CME heading for Earth — aurora likely in [N] hours at [latitude]"
├── Kp 5-6 or M-class flare
│   ├── notable context → WATCH: "[context about solar cycle]"
│   └── else → skip
└── Kp < 5 → always skip
```

**Mockups:**
1. LOOK: "Go outside and look north right now — aurora visible as far south as Paris and Denver tonight. Kp8 storm hitting Earth."
2. FEAR: "Strongest solar storm in 20 years — GPS may be unreliable tonight. Airlines rerouting polar flights."
3. WATCH: "4th X-class solar flare this week. The sun is in peak cycle and it's not calming down."
4. LOOK: "Northern lights visible in Texas last night — first time since 2003. Photos flooding in from places that never see aurora."
5. RECORD: "Kp hit 9 — this only happens a few times per decade. Aurora possible at the equator tonight."
6. FEAR: "Massive CME hitting Earth in ~18 hours — power grid operators on standby. Charge your stuff."
7. WATCH: "Sun fired off 7 flares in 3 days — most active week of the entire solar cycle. More aurora likely this weekend."
8. LOOK: "Tonight might be your once-in-a-decade chance to see aurora from [latitude]. Kp7 storm arriving around midnight."
9. WTF: "Solar flare knocked out HF radio across the entire Atlantic for 2 hours — planes couldn't contact ATC"
10. WATCH: "The sun has produced more X-class flares this year than in the last 5 years combined"

---

### INTERNET OUTAGES (IODA)

```
connectivity drop detected
├── country drops to < 10%
│   ├── authoritarian regime → RAGE: "[country] just went dark — government-ordered shutdown"
│   ├── infrastructure event → FEAR: "[country] offline — [cable cut / disaster context]"
│   └── unknown cause → WATCH: "[country] internet just collapsed — no explanation yet"
├── country drops to 10-50%
│   ├── pattern (protests, elections) → RAGE: "[country] throttling internet [ahead of / during] [event]"
│   ├── Nth time this year → RAGE: "[country] cut internet for the [Nth] time this year"
│   └── technical cause → WATCH: "[N] million people offline — [cause]"
├── country 50-70%
│   ├── major country (>50M pop) → WATCH: "[country] connectivity dropping — [N] million affected"
│   └── small country → skip
├── sudden recovery → RECORD (positive): "[country] back online after [N] days dark"
└── multiple countries → FEAR: "Undersea cable cut — [N] countries losing connectivity simultaneously"
```

**Mockups:**
1. RAGE: "Iran's internet just dropped to 5% — the government cut it ahead of tomorrow's protests"
2. FEAR: "Undersea cable cut in the Red Sea — 6 East African countries losing internet right now"
3. RAGE: "Pakistan shut down internet for the 9th time this year — 220 million people affected"
4. WATCH: "Russia's internet connectivity falling — unusual internal traffic patterns. Something is happening."
5. RAGE: "Myanmar cut internet to 3% — communications blackout as military operations begin"
6. WTF: "Cuba has been completely offline for 14 hours — the entire country can't reach the outside world"
7. RECORD: "Ethiopia restored internet after the longest shutdown in African history — 47 days dark"
8. RAGE: "India cut Kashmir's internet again — the 52nd time. The most internet-restricted region on Earth."
9. FEAR: "4 countries just lost connectivity at the same time — all served by the same undersea cable"
10. WATCH: "Turkey is throttling Twitter and Instagram to 15% speed — election results coming in"

---

### WILDFIRE

```
hotspot data update
├── > 2000 new hotspots in 6h in one region
│   ├── near city (>100K pop within 50km) → FEAR: "Fire approaching [city] — [N] hotspots, [context]"
│   ├── ecological area → WATCH: "[forest/park] burning — [size comparison]"
│   └── remote → skip unless record-breaking
├── 500-2000 hotspots
│   ├── smoke reaching distant cities → FEAR: "Stay inside if you're in [city] — wildfire smoke [AQI context]"
│   ├── vs last year comparison dramatic → RECORD: "[region] fires [X]% above last year — worst season in [N] years"
│   └── Nth major fire this season → WATCH: "[Nth] major fire this season — [region] is not getting a break"
├── < 500 hotspots → skip
└── fire contained → RECORD (positive): "[fire name] finally 100% contained after [N] days — [acres] burned"
```

**Mockups:**
1. FEAR: "Fire 5 miles from downtown Los Angeles — 4,200 hotspots detected. If you can see smoke, start packing."
2. FEAR: "Stay inside if you're anywhere near New York — wildfire smoke from Canada making the air literally dangerous. AQI over 300."
3. RECORD: "Amazon fires up 340% vs last year — the worst burning season in 15 years and it's only August"
4. WATCH: "California's 6th major wildfire this summer — the state hasn't had a break since May"
5. WTF: "Siberian wildfires are now larger than Belgium — and almost nobody is covering it"
6. FEAR: "Maui fire: 3,100 hotspots in a 2-mile radius — satellite images are devastating"
7. WATCH: "Australia fire season starting 6 weeks earlier than normal — 1,200 hotspots in Queensland already"
8. FEAR: "Colorado fire forced evacuation of 35,000 people overnight — 0% contained, winds picking up"
9. RECORD: "Greece just had the deadliest wildfire day in 5 years — 12 fires burning simultaneously across Attica"
10. RAGE: "Same town, same fire risk, same infrastructure. 3rd evacuation in 4 years and nothing has changed."

---

### VOLCANO

```
alert update detected
├── eruption confirmed
│   ├── near populated area → FEAR: "Eruption [N]km from [city/town] — [ashfall/lava/evacuation context]"
│   ├── aviation impact → WATCH: "Flights rerouted — [volcano] ash cloud reaching [altitude]"
│   └── remote → LOOK: "[volcano] erupting — [dramatic visual context]"
├── alert level raised
│   ├── historically deadly volcano → FEAR: "[volcano] raised to [alert] — last eruption in [year] killed [N]"
│   ├── unusual activity type → WATCH: "[volcano]: [activity description] — scientists say [quote/interpretation]"
│   └── routine → skip
├── alert level lowered → skip (not viral)
└── swarm under known caldera → WATCH: "[N] earthquakes under [caldera] in [time] — [reassurance or concern]"
```

**Mockups:**
1. FEAR: "Iceland eruption: lava flowing directly toward Grindavik — the town they evacuated 3 months ago"
2. FEAR: "Popocatépetl erupting 43 miles from Mexico City — ash falling on 22 million people"
3. LOOK: "Mt. Etna putting on a show — lava fountains reaching 500 meters. Visible from 100km away."
4. WATCH: "84 earthquakes under Yellowstone caldera in 48 hours — USGS says no eruption risk 'for now'"
5. FEAR: "Mt. Semeru erupting in Indonesia — same volcano that killed 50 people in 2021. Evacuations underway."
6. RECORD: "Iceland's 5th eruption in 14 months — the Reykjanes peninsula hasn't been this active in 800 years"
7. WATCH: "Kilauea lava lake draining rapidly — geologists say this sometimes precedes a flank eruption"
8. FEAR: "Philippines raised Taal to Alert Level 3 — 14km danger zone, 100,000 people inside it"
9. WTF: "Mt. Fuji showed tremor activity for the first time in 3 years — Japan's busiest volcano with 300,000 people in the danger zone"
10. WATCH: "Canary Islands: 400 earthquakes under El Hierro this week — last time this happened, a new undersea volcano formed"

---

### SEC INSIDER TRADING

```
filing detected
├── single sale > $50M
│   ├── CEO/CFO/Board → MONEY: "[person] just dumped $[X]M in [company] — [context: before earnings? unusual?]"
│   ├── first sale in years → MONEY: "[person] sold stock for the first time in [N] years — $[X]M"
│   └── routine scheduled → skip (10b5-1 plans are boring)
├── cluster: 3+ insiders same company in 1 week
│   ├── all selling → MONEY: "[N] [company] insiders all sold this week — $[total]M. They know something."
│   ├── all buying → MONEY: "[N] insiders just bought [company] — unusual conviction at $[price]"
│   └── mixed → skip
├── politician filing
│   ├── timing suspicious (before vote/announcement) → RAGE: "[politician] bought [sector] stocks [N] days before [vote/event]"
│   ├── large trade → RAGE: "[politician] just made a $[X]M stock trade — their [Nth] this [period]"
│   └── small/routine → skip
├── sale before bad news (detected retroactively)
│   └── RAGE: "[company] insiders sold $[X]M last week — stock dropped [Y]% today on [news]"
└── < $10M individual trade, no cluster → skip
```

**Mockups:**
1. MONEY: "Nvidia's CEO has sold $230M in stock over the last 3 weeks. Every single trading day."
2. RAGE: "A senator bought $500K in defense stocks 72 hours before voting yes on the military budget"
3. MONEY: "5 Tesla executives all sold shares in the same 4-day window — total: $89M. Before earnings."
4. RAGE: "Members of Congress made 3,400 stock trades last year — and beat the S&P 500 by 12%"
5. MONEY: "JPMorgan's CEO just sold stock for the first time in 18 years — $150M. He's never done this before."
6. RAGE: "Pfizer insiders sold $12M in stock. One week later: stock dropped 8% on trial data. Coincidence?"
7. MONEY: "12 biotech insiders bought shares of the same tiny company this week — they almost never agree on anything"
8. MONEY: "Meta's CFO sold every share they were allowed to — $34M gone at once"
9. RAGE: "Boeing executives sold $18M before the latest safety investigation was announced"
10. MONEY: "Apple insider buying just hit a 5-year high — 8 executives bought stock this month. They're betting on themselves."

---

### CONGRESS

```
vote/action detected
├── close vote (margin < 5)
│   ├── affects daily life → RAGE/MONEY: "[bill description in plain English] — passed [margin]"
│   ├── affects tech/internet → RAGE: "[bill] — [impact on reader]"
│   └── procedural → skip
├── bill introduced
│   ├── affects millions directly → WATCH: "New bill: [plain English]. Here's what that means for you."
│   ├── ironic/hypocritical timing → RAGE: "Congress [did X] while [Y was happening]"
│   └── routine → skip
├── government spending
│   ├── contrast (raised own pay + blocked other thing) → RAGE
│   ├── large contract → MONEY: "$[X]B just went to [company] for [purpose]"
│   └── routine appropriation → skip
└── failed bill
    ├── Nth failure → RAGE: "[bill] killed for the [Nth] time — [year] tries and counting"
    └── first attempt → WATCH: "[bill] failed [margin] — sponsors say they'll try again"
```

**Mockups:**
1. RAGE: "Senate voted 51-49 to let ISPs sell your browsing history without consent. Your senator might have voted yes."
2. RAGE: "Congress just voted themselves a $12,000 raise. They blocked the minimum wage increase last week."
3. RAGE: "Bill to ban congressional stock trading killed for the 4th time — the people who trade stocks voted no"
4. WATCH: "New bill introduced: AI companies must disclose all training data. The biggest tech regulation attempt yet."
5. MONEY: "Congress quietly raised the debt ceiling at 11pm on a Friday. Your future taxes just got more interesting."
6. RAGE: "24 senators demanded DOJ investigate crypto exchanges — 18 of them received donations from traditional banks"
7. WATCH: "Immigration reform failed in committee for the 6th time in 3 years. Same bill, same result, every time."
8. RECORD: "House passed the bill 415-3 — the most bipartisan vote in 10 years. What was it? Renaming a post office."
9. RAGE: "$800M contract just awarded to Palantir for surveillance tech — quietly buried in the defense bill"
10. MONEY: "The bill that passed tonight means your student loan payment changes in January. Here's the math."

---

### FLIGHT CHAOS (FAA + flights + ryanair)

```
disruption detected
├── FAA ground stop
│   ├── nationwide → FEAR: "All US flights grounded — FAA system [failure/weather]. If you're at an airport, you're not leaving."
│   ├── major hub → WATCH: "Ground stop at [airport] — [reason]. Expect 2-4h ripple delays across [region]."
│   └── single airport → skip unless JFK/LAX/ORD
├── mass cancellations > 500 flights
│   ├── weather event → WATCH: "[N] flights cancelled — [storm/weather] grounding [region]"
│   ├── airline operational failure → RAGE: "[airline] cancelled [N] flights — IT failure / crew shortage"
│   └── holiday weekend → WTF: "[holiday] travel chaos: [N] cancelled, [N] delayed. Busiest travel day of the year."
├── unusual low flight count
│   └── WATCH: "Only [N] flights over [region] right now — [X]% below normal. [context]"
├── Ryanair avg delay > 45 min
│   ├── Nth bad day → RAGE: "Ryanair averaging [N]-minute delays — [Nth] day above 30 min this month"
│   └── single bad day → WTF: "Average Ryanair delay today: [N] minutes. You get what you pay for."
└── everything running smoothly → skip (nobody tweets about functional airports)
```

**Mockups:**
1. FEAR: "FAA nationwide ground stop — every flight in America is grounded. System failure, no ETA for fix."
2. WATCH: "Ground stop at O'Hare, Midway, and Milwaukee — thunderstorms. This will ripple across the country for the next 6 hours."
3. RAGE: "Southwest cancelled 2,400 flights — their scheduling system crashed. For the 3rd time this year."
4. WTF: "Thanksgiving travel update: 4,200 flights delayed, 800 cancelled. And it's only 2pm."
5. WATCH: "Only 7,200 flights over Europe right now — 35% below normal. ATC staff shortage across the continent."
6. RAGE: "Ryanair averaging 54-minute delays today. The 8th day above 30 minutes this month. The flights cost €19 for a reason."
7. FEAR: "Atlanta airport lost power — the world's busiest airport is completely dark. 275,000 passengers stranded."
8. WTF: "Heathrow is so fogged in that flights are landing in Paris instead. Passengers bussed back to London. 4-hour detour."
9. RECORD: "52,000 flights scheduled today — busiest day in US aviation history. Good luck."
10. RAGE: "FAA says there aren't enough air traffic controllers. 6 major airports on flow control because people are overworked."

---

### TRANSIT (mta_subway + tfl_tube + paris_metro + db_trains)

```
disruption detected
├── 4+ lines disrupted simultaneously
│   ├── rush hour → RAGE: "[N] lines down at rush hour — [city] commuters stranded. [Nth time this month]"
│   ├── off-peak → WATCH: "[city] transit: [N] lines out. [cause]"
│   └── full shutdown → FEAR: "[city] subway/metro fully suspended — [cause]. City basically shut down."
├── 2-3 lines disrupted
│   ├── same line again → RAGE: "[line] suspended for the [Nth] time this month — [operator] says '[excuse]'"
│   ├── unusual cause → WTF: "[line] suspended because [weird cause]"
│   └── routine → skip
├── record delay
│   └── RECORD: "Deutsche Bahn average delay at [station]: [N] minutes — worst day since [date]"
├── fare increase + bad service
│   └── RAGE: "[operator] raised fares to $[X] — service hasn't improved. [disruption stat]"
├── 0-1 lines disrupted → skip
└── rare smooth day → WTF: "Every single London Underground line running on time right now. Screenshot this — it won't last."
```

**Mockups:**
1. RAGE: "8 NYC subway lines disrupted at rush hour — the MTA spent $3.4B on upgrades last year"
2. RAGE: "Paris Metro Line 13 disrupted for the 12th time this month. At this point just walk."
3. WTF: "London Underground suspended because of a 'customer incident' involving a pigeon. The Victoria line is down."
4. RECORD: "Deutsche Bahn: average delay at Frankfurt Hbf hit 31 minutes today — worst day in 2 years"
5. RAGE: "MTA raised the fare to $2.90. Today: 6 lines disrupted, 3 elevators broken, 2 stations flooded."
6. RAGE: "London Underground: 4 lines down simultaneously during morning rush. TfL's response: 'use buses.' The buses are also delayed."
7. WTF: "Paris RER B delays hit 90 minutes — passengers reportedly walking along the tracks to the next station"
8. RAGE: "Berlin S-Bahn cancelled 3 entire lines due to staff shortage. They knew about it last week."
9. WTF: "Every single London Underground line running on time right now. Genuine anomaly. Enjoy it."
10. RECORD: "NYC subway hit its worst on-time performance since they started measuring — 52% of trains late today"

---

### CRYPTO (coingecko + pumpfun)

```
price/market event detected
├── BTC drop > 10% in 24h
│   └── MONEY: "Bitcoin just lost $[X]K in [time] — if you're leveraged, check your liquidation price"
├── memecoin > $100M mcap in < 24h
│   ├── absurd name → WTF: "A coin called $[name] is worth $[X]M. It launched [N] hours ago. Nobody knows who made it."
│   └── celebrity-linked → WATCH: "[celebrity] launched a token — $[X]M market cap in [time]. Remember how this ended last time."
├── market-wide crash (>90% of top 100 red)
│   └── MONEY: "[N] out of 100 top cryptos are red today — $[X]B in liquidations"
├── rug pull > $5M
│   └── WTF: "$[X]M rug pull — token went from $[X]M to $0 in [N] minutes. The [details of the scam]."
├── DeFi TVL crash > 20%
│   └── MONEY: "$[X]B just left DeFi in 24 hours — money is running"
├── normal 2-5% moves → skip (every crypto account does this)
└── altcoin pump without narrative → skip
```

**Mockups:**
1. MONEY: "Bitcoin just dropped $8,000 in 12 minutes. If you're on leverage, check your position right now."
2. WTF: "A memecoin called $FART reached $400M market cap in 6 hours. The creator's wallet is anonymous. This will end badly."
3. MONEY: "94 out of the top 100 cryptos are red right now — $2.3B liquidated in 4 hours"
4. WTF: "$12M rug pull on pump.fun — the dev bought a mass of their own token, pumped it to $50M, and dumped everything in 3 minutes"
5. WATCH: "A token that didn't exist on Monday is now the 3rd most traded asset on Binance. Nobody can explain why."
6. MONEY: "$8B just left DeFi protocols in 48 hours — fastest outflow since the FTX collapse"
7. RECORD: "Bitcoin dominance hit 62% — highest since 2019. Altcoins are dying."
8. WTF: "A celebrity launched their 4th crypto token. The first 3 lost investors $340M combined. This one is already at $80M."
9. MONEY: "Ethereum gas spiked to 800 gwei — a single NFT mint is costing the entire network $40 per transaction right now"
10. WATCH: "3 of the top 10 coins by volume today literally didn't exist a week ago. This market is unhinged."

---

### SHORT INTEREST (finra)

```
short data detected
├── short volume > 60% on known stock
│   ├── stock in WSB radar → MONEY: "[stock] short volume at [X]% — same level that preceded the [year] squeeze"
│   ├── before earnings → MONEY: "Someone is very bearish on [company] — [X]% short volume, earnings in [N] days"
│   └── sustained (3+ days) → WATCH: "[stock] short volume above 50% for [N] consecutive days — something is building"
├── short volume > 50% cluster (3+ stocks same sector)
│   └── MONEY: "[N] [sector] stocks above 50% short volume — hedge funds are betting against the entire sector"
├── short sellers losing big (stock up despite high short interest)
│   └── WTF: "[stock] short sellers have lost $[X]B this week — the stock keeps going up"
├── historical comparison
│   └── RECORD: "[stock] short interest highest since [date] — here's what happened last time: [outcome]"
└── < 50% or unknown stock → skip
```

**Mockups:**
1. MONEY: "GameStop short volume hit 68% — exact same level as January 2021. You know what happened next."
2. MONEY: "7 regional bank stocks above 50% short volume — hedge funds are betting the banking crisis isn't over"
3. WTF: "Tesla short sellers have lost $4.1B this month. The stock went up 30% and they're still holding."
4. MONEY: "Someone shorted $200M worth of Nvidia yesterday — the single largest short bet on a tech stock this year"
5. WATCH: "AMC short interest rising for 14 consecutive days — now at highest level since June 2021"
6. MONEY: "Apple short volume doubled overnight — earnings tomorrow. Someone knows something, or someone is very wrong."
7. RECORD: "The most shorted stock in America right now is a company you've probably never heard of — [X]% of all volume is short"
8. MONEY: "5 of the 10 most-shorted stocks are biotech — same pattern as right before the 2022 biotech crash"
9. WTF: "Meme stocks are back: GME, AMC, and BBBY's successor are all above 50% short volume. Reddit is waking up."
10. MONEY: "S&P 500 ETF (SPY) short volume at a 2-year high — big money is hedging. They expect something."

---

### WEATHER ALERTS

```
alert detected
├── tornado warning
│   ├── major metro → FEAR: "Tornado warning for [city] metro — take shelter NOW. [context: EF rating if available]"
│   └── rural → skip (unless EF4+)
├── hurricane
│   ├── Cat 3+ making landfall → FEAR: "Category [X] hurricane hitting [location] tonight — [N] million in the path. Prepare now."
│   ├── Cat 1-2 → WATCH: "Hurricane approaching [location] — [preparations context]"
│   └── in ocean, no landfall expected → skip
├── extreme temperature
│   ├── breaks all-time record → RECORD: "[city] just hit [temp] — [hottest/coldest ever recorded / since year]"
│   ├── dangerous threshold → FEAR: "[city] at [temp] — [danger: heatstroke in X min / frostbite in X min]"
│   └── seasonal normal → skip
├── flash flood
│   ├── urban area → FEAR: "Flash flood emergency in [city] — do NOT drive. [context]"
│   └── rural → skip
├── Nth extreme event this season
│   └── WATCH: "[Region]'s [Nth] [event type] this season — [trend context]"
└── winter storm / blizzard
    ├── > 50M affected → FEAR: "[N]M Americans under [warning type] — [snow/ice amounts], [travel warning]"
    └── routine winter → skip
```

**Mockups:**
1. FEAR: "Tornado warning for Oklahoma City metro — confirmed tornado on the ground heading northeast. Take shelter immediately."
2. FEAR: "Category 4 hurricane making landfall in Tampa tonight — 3.5 million people in the cone. If you haven't left, shelter now."
3. RECORD: "Phoenix just hit 121°F — the hottest temperature ever recorded in a US city with more than 1 million people"
4. FEAR: "Flash flood emergency in Las Vegas — the Strip is flooding. Do not drive. Casinos taking water."
5. FEAR: "Chicago windchill at -45°F — exposed skin gets frostbite in under 5 minutes. Stay inside."
6. WATCH: "95 million Americans are under a heat advisory right now — the 4th major heat dome this summer"
7. RECORD: "Death Valley just tied the hottest temperature ever reliably recorded on Earth — 130°F"
8. FEAR: "Blizzard warning across the entire Northeast — 24-36 inches expected. Flights already cancelling for tomorrow."
9. WATCH: "Florida's 3rd hurricane in 6 weeks — insurance companies have already pulled out of the state"
10. FEAR: "Derecho crossing Iowa at 100mph — this type of straight-line windstorm can level entire neighborhoods"

---

### EPIDEMIC

```
health alert detected
├── new pathogen / unknown illness
│   └── WATCH: "Mystery [illness type] in [location] — [N] cases, [WHO/CDC response]. Too early to panic, too important to ignore."
├── case count spike > 3x average
│   ├── in your region → FEAR: "[disease] cases [X]% above normal — [protection advice]"
│   ├── elsewhere but spreading → WATCH: "[disease] spreading faster than expected — [N] countries now affected"
│   └── contained → skip
├── WHO emergency / alert level change
│   └── WATCH: "WHO just [declared emergency / called meeting] for [disease] — [context about seriousness]"
├── anti-vax outcome visible in data
│   └── RAGE: "[disease we vaccinated away] is back — [N] cases in [location]. Vaccination rate dropped to [X]%."
├── historical comparison
│   └── RECORD: "[disease] cases at highest level since [year] — [what happened then]"
└── seasonal flu within normal range → skip
```

**Mockups:**
1. WATCH: "Mystery respiratory illness in 3 Chinese provinces — WHO just requested data. Too early to panic. Not too early to pay attention."
2. FEAR: "Bird flu confirmed in Texas — first suspected human-to-human transmission. If you work with poultry, get tested."
3. RECORD: "Measles cases in the US at the highest level since 2000 — every single outbreak traced to unvaccinated communities"
4. WATCH: "Mpox cases tripling every week in Central Africa — WHO emergency meeting tomorrow. They waited too long last time."
5. RECORD: "Dengue in Brazil: 4.2 million cases this year — 340% above average. The worst outbreak in the country's history."
6. FEAR: "US flu season is the worst in 15 years — 47 states reporting high activity. Get your shot if you haven't."
7. WATCH: "Japan's Strep A outbreak: 1,000 cases this month, unusually high lethality. Health ministry says 'unprecedented.'"
8. WTF: "Cholera outbreak in a country that had clean water 3 years ago — 12,000 cases since the infrastructure collapsed"
9. WATCH: "New SARS-related virus found in Chinese bat population — not in humans yet. Scientists flagging it early this time."
10. RAGE: "Malaria appearing at altitudes where it's never existed — Kenya reports first cases above 2,000m. Climate change isn't hypothetical."

---

### HOUSING (zillow)

```
housing data detected
├── metro price drops > 10% YoY
│   └── MONEY: "[city] home prices dropped [X]% — [context: Nth month of decline / fastest drop since]"
├── rent hits new ATH
│   └── RAGE: "Average rent in [city] hit $[X]/month — you need $[income]K/year just for rent"
├── affordability milestone
│   └── RAGE: "You now need $[X]K/year to afford the median home in [city/US] — [comparison to median income]"
├── absurd listing
│   └── WTF: "[description of absurd listing] — $[price] in [city]"
├── market reversal (trend change)
│   └── MONEY: "[city] housing market just flipped — [from X to Y context]"
├── insurance/costs exceeding mortgage
│   └── RAGE: "In [state], insurance now costs more than the mortgage for [X]% of homeowners"
└── normal 1-3% fluctuation → skip
```

**Mockups:**
1. RAGE: "Average rent in Manhattan: $5,200/month. The median salary in New York is $4,800/month after tax. Do the math."
2. MONEY: "Austin home prices dropped 18% in 6 months — biggest crash in any major US city right now"
3. RAGE: "You now need $115K/year to afford the median US home. The median US salary is $59K. The gap has never been wider."
4. WTF: "A 400 sq ft studio in San Francisco just listed for $850,000. It doesn't have a stove."
5. MONEY: "Home inventory in Denver tripled in 3 months — buyers have leverage for the first time in 4 years"
6. RAGE: "Florida home insurance now exceeds the mortgage payment for 1 in 4 homeowners. People are leaving."
7. WTF: "A parking spot in Boston just listed for $375,000. A parking spot. Three hundred seventy-five thousand dollars."
8. MONEY: "Zillow data: 40% of homes in Phoenix are listed below what the owner paid. The market is underwater."
9. RECORD: "14th straight month of price declines in Boise — longest losing streak of any US metro since 2008"
10. RAGE: "Rent in your city went up $400/month. Your salary went up $0. This is the 3rd year in a row."

---

### AIR QUALITY (airnow)

```
AQI update detected
├── AQI > 300 (Hazardous)
│   └── FEAR: "Air in [city] is HAZARDOUS right now — AQI [X]. Stay inside, close windows, run a filter if you have one."
├── AQI 200-300 (Very Unhealthy)
│   ├── unexpected city → WTF: "[city]'s air is worse than [notoriously polluted city] right now — AQI [X]"
│   ├── caused by distant fire → FEAR: "Wildfire smoke from [source] reaching [city] — AQI [X]. Stay inside."
│   └── Nth bad day → RAGE: "[city] hasn't had breathable air in [N] days"
├── AQI 150-200 (Unhealthy)
│   ├── Nth event this season → WATCH: "[Nth] unhealthy air day this summer — [trend context]"
│   └── first event → WATCH: "[city] AQI hit [X] — [cause]. Limit outdoor activity."
├── AQI < 150 → skip
└── dramatic spike (AQI doubled in < 2h)
    └── FEAR: "[city] AQI went from [X] to [Y] in 2 hours — smoke plume just arrived. Get inside."
```

**Mockups:**
1. FEAR: "New York's air is literally the most toxic on Earth right now — AQI 342. Stay inside. Close your windows. This is not normal."
2. WTF: "Salt Lake City's air quality is worse than Delhi today. A US city. Worse than Delhi."
3. FEAR: "Wildfire smoke from Canada just hit Chicago — AQI spiked from 42 to 178 in 2 hours. It's coming fast."
4. RAGE: "Portland hasn't had a single 'Good' air quality day in 3 weeks. People are wearing masks again — but for smoke."
5. FEAR: "87 million Americans are breathing 'Unhealthy' air right now — that's 1 in 4 people in the country"
6. RECORD: "San Francisco AQI hit 405 — worst air quality reading in the city's measurement history"
7. WTF: "The air in Los Angeles is worse than in a city with active coal power plants. AQI 186 and climbing."
8. FEAR: "If you're in [city], stay inside — AQI just crossed 300. This is the 'do not go outside' level."
9. RAGE: "3rd wildfire smoke event this summer in New York. A city 2,000 miles from the fires can't breathe."
10. WATCH: "Smoke plume visible on satellite heading toward the East Coast — AQI expected above 200 in Boston by tomorrow"

---

### GOVERNMENT SPENDING (usa_spending)

```
contract/grant detected
├── > $500M single contract
│   ├── controversial company → RAGE: "$[X]B to [company] for [purpose] — [ironic context]"
│   ├── timing suspicious → RAGE: "$[X]M awarded [N] days before [related event]"
│   └── notable purpose → WTF: "$[X]M to [purpose that sounds absurd out of context]"
├── wasteful pattern
│   ├── money to defunct org → RAGE: "$[X]B went to organizations that no longer exist"
│   ├── can't account for → RAGE: "[department] can't account for $[X] — [Nth time / since date]"
│   └── price gouging → WTF: "[contractor] charged $[absurd price] per [item]"
├── contrast (raised pay + blocked something)
│   └── RAGE: "Congress [did X for themselves] while [blocking Y for citizens]"
└── routine spending → skip
```

**Mockups:**
1. RAGE: "$800M to Palantir for AI surveillance at the border — buried in a 1,200-page bill nobody read"
2. RAGE: "Pentagon still can't pass an audit — $2.3 trillion unaccounted for. Your tax dollars, gone."
3. WTF: "$50M federal grant to study why people are lonely. The study itself took 4 years and employed 3 people."
4. RAGE: "FEMA awarded $340M in disaster contracts 3 days BEFORE the hurricane hit. Someone had a heads up."
5. WTF: "NASA contractor charged $1,200 per bolt. A bolt you can buy at Home Depot for $0.35."
6. RAGE: "$4.7B in PPP loans went to companies that immediately laid off every worker. The loans were forgiven."
7. MONEY: "Top 5 federal contract recipients this month — all defense companies. Combined: $12B of your money."
8. RAGE: "$180M in grants to states that never even filed a progress report. Zero accountability."
9. WTF: "The government paid $12M to build a gas station in Afghanistan. It's now closed. Nobody used it."
10. RAGE: "Defense spending increased $80B this year. Education got cut by $4B. Priorities."

---

### THEME PARKS (queue_times)

```
wait time data
├── any ride > 200 min
│   └── WTF: "[ride] wait time: [N] minutes — that's [hours] hours to ride for [duration]. [cost context]"
├── park-wide average > 90 min
│   └── RAGE: "Average wait at [park] right now: [N] minutes. Tickets cost $[X]. You're paying to stand in line."
├── park closed unexpectedly
│   └── WTF: "[park] just closed all rides — [reason]. [N] thousand visitors stranded."
├── price increase + still packed
│   └── RAGE: "Disney raised prices to $[X]/day. Average wait time: still [N] minutes. They know you'll pay."
├── 0-minute waits across many rides
│   └── WTF: "[park] showing 0-minute waits on [N] rides — either a glitch or nobody's there"
└── normal 20-60 min waits → skip
```

**Mockups:**
1. WTF: "Space Mountain wait: 4 hours. The ride is 2 minutes and 30 seconds. You're standing in line for 96% of the experience."
2. RAGE: "Disney raised tickets to $220/day. Average wait right now: 95 minutes. You're paying $220 to stand in the Florida sun."
3. WTF: "Universal's new Harry Potter ride: 6-hour wait on opening day. People in line since 4am. For a ride."
4. RAGE: "Every single ride at Disneyland is over 90 minutes right now. The Genie+ 'skip the line' pass costs another $30."
5. WTF: "Tokyo Disney: 300-minute wait for Fantasy Springs. That's 5 hours. People brought folding chairs."
6. WTF: "Disney shows 0-minute waits on 12 rides simultaneously — either a system crash or the apocalypse started"
7. RECORD: "Christmas week at Magic Kingdom: average wait across ALL rides is 110 minutes. The busiest day in the park's history."
8. RAGE: "Cedar Point's newest coaster broke down 4 times today. It opened last month. Tickets are $85."
9. WTF: "A theme park in Germany has longer wait times than any Disney park today. Europa-Park: 180 min for the new coaster."
10. RAGE: "You spent $1,200 on a family Disney trip and rode 4 rides. Welcome to the most expensive standing-in-line experience on Earth."

---

### McDONALD'S ICE CREAM (mcbroken)

```
mcbroken data
├── city > 30% broken
│   └── WTF: "[X]% of McDonald's ice cream machines broken in [city] right now. [ironic context]"
├── national > 15%
│   └── WTF: "1 in [N] McDonald's ice cream machines in America is broken right now — [context]"
├── 0% broken in a city
│   └── WTF: "Every McDonald's ice cream machine in [city] is working. Mark this day."
├── ironic timing (hot day, new product, FTC news)
│   └── WTF: "[ironic context] — and [X]% of the machines are down"
├── trend (improving/worsening)
│   └── WATCH: "Ice cream machine uptime [improved to / dropped to] [X]% after [FTC / repair law / news event]"
└── normal 8-12% → skip
```

**Mockups:**
1. WTF: "33% of McDonald's ice cream machines in Atlanta are broken right now. It's 97°F. You can't make this up."
2. WTF: "McDonald's launched a new McFlurry flavor today. 1 in 4 machines can't make it. Classic."
3. WTF: "Every single McDonald's ice cream machine near the Chicago Loop is broken. All of them. Right now."
4. RECORD: "Ice cream machine uptime hit 91% — best ever — right after the FTC announced an investigation. Fear works."
5. WTF: "Las Vegas Strip: 0% machines broken. The ice cream machines are scared of Las Vegas."
6. WTF: "It's the hottest day of the year in NYC and 28% of McDonald's ice cream machines are down. Of course."
7. WATCH: "National ice cream machine downtime dropping steadily since the Right to Repair bill. From 15% to 9%."
8. WTF: "McDonald's made $6.5B in profit last quarter. Their $18,000 ice cream machines are broken 12% of the time."
9. RAGE: "The ice cream machine has been 'broken' for years because McDonald's signed an exclusive repair contract with one company who charges $315/visit"
10. WTF: "Someone mapped all the broken McDonald's ice cream machines. It looks like a disease spreading across the country."

---

### NUCLEAR REACTORS (nrc_nuclear)

```
power output change
├── reactor drops to 0% (unplanned)
│   ├── during extreme weather → FEAR: "[reactor] emergency shutdown during [heat/cold] — grid losing [X] MW when it needs it most"
│   ├── multiple reactors → FEAR: "[N] reactors went offline simultaneously — [X]% of US nuclear output gone"
│   └── single, non-critical → WATCH: "[reactor] offline for unplanned maintenance — [output impact]"
├── new reactor reaches 100%
│   └── RECORD: "First new US nuclear reactor in [N] years just hit 100% power — [X] MW now on the grid"
├── fleet-wide record
│   └── RECORD: "US nuclear fleet at [X]% average output — [highest/lowest] ever recorded"
├── nuclear vs fossil milestone
│   └── RECORD: "Nuclear just [passed/fell below] [coal/gas] in US electricity — first time ever"
├── reactor restart (politically significant)
│   └── WATCH: "[reactor] restarting after [N] years — [who's paying / why: AI data centers, etc.]"
└── routine maintenance / small fluctuation → skip
```

**Mockups:**
1. FEAR: "Texas nuclear plant dropped to 0% during a heat wave — the grid just lost 1,200 MW it desperately needed"
2. FEAR: "3 US nuclear reactors went offline in the same 24 hours — grid operators scrambling to replace 3,500 MW"
3. RECORD: "First new US nuclear reactor in 30 years just reached full power. It took 14 years to build and cost $35 billion."
4. WTF: "Three Mile Island restarting to power Microsoft's AI data centers. The most infamous nuclear site in America, coming back for ChatGPT."
5. RECORD: "Nuclear generated more electricity than coal in the US for the first time. The shift took 50 years."
6. WATCH: "France has 12 reactors offline for maintenance — Europe's biggest nuclear power is importing German electricity. In winter."
7. RECORD: "Smallest US reactor just ran continuously for 726 days straight — a record. Zero issues."
8. FEAR: "California's last nuclear plant shutting down permanently — 2,200 MW gone. They're replacing it with natural gas."
9. WATCH: "US nuclear power output dropped 12% overnight — unplanned maintenance at 5 plants simultaneously. Unusual."
10. MONEY: "Every new nuclear plant proposal now lists 'AI data center power' as the primary customer. Not homes. Not cities. AI."

---

### RATES / OIL / ECONOMY (fred + treasury + eia + opec)

```
economic data
├── yield curve inversion change
│   └── MONEY: "Yield curve just [inverted/uninverted] — [what this predicted last time]"
├── rate hits decade+ extreme
│   └── MONEY: "[rate type] at [X]% — highest since [year]. Your [mortgage/car loan/savings] is affected."
├── oil spike > 8% in a day
│   └── MONEY: "Oil spiked [X]% today — gas prices will follow within [timeframe]. [cause]"
├── OPEC surprise decision
│   └── MONEY: "OPEC just [cut/increased] production — [impact on gas prices]"
├── jobs report extreme miss
│   └── MONEY: "US added [N]K jobs — [analysts expected X]. [implication for rates/recession]"
├── gas price milestone
│   └── RAGE: "Gas at $[X]/gallon in [state] — [comparison: highest since / costs $X more to fill up than last year]"
├── strategic reserve extreme
│   └── WATCH: "US Strategic Petroleum Reserve at lowest since [year] — [X]M barrels. [context]"
└── routine weekly data → skip
```

**Mockups:**
1. MONEY: "30-year mortgage rate just hit 8.5% — a $400K home now costs $850/month MORE than it did 2 years ago"
2. MONEY: "2-year Treasury yield inverted below the 10-year again — every time this has happened since 1970, a recession followed"
3. MONEY: "Oil spiked 12% in one day — expect gas prices to jump 30-40 cents by next week"
4. MONEY: "OPEC just announced a surprise production cut — oil jumping 8%. Fill up your tank today."
5. RECORD: "US added 517,000 jobs in a month everyone expected a recession. Nobody knows what this economy is doing."
6. RAGE: "Gas hit $6/gallon in California. The national average is $4.10. It costs $90 to fill a truck."
7. WATCH: "US Strategic Petroleum Reserve at its lowest level since 1983 — there's not much cushion left"
8. MONEY: "10-year yield crossed 5% — hasn't been this high since 2007. If you're buying a house, your rate just got worse."
9. MONEY: "Natural gas prices doubled in 2 weeks — your winter heating bill is going to hurt"
10. WTF: "Fed raised rates to 6.5% while saying the economy is 'strong.' Your credit card APR is now 28%."

---

### BORDER WAIT TIMES (cbp_border)

```
wait time data
├── any crossing > 3 hours
│   └── RAGE: "[crossing] border wait: [N] hours right now — [human impact context]"
├── all southern/northern crossings elevated
│   └── WATCH: "Every [southern/northern] border crossing above [N] hours right now — [cause if known]"
├── commercial wait > 4 hours
│   └── MONEY: "[crossing] commercial wait: [N] hours — [$ impact on trade / supply chain]"
├── crossing closed
│   └── WATCH: "[crossing] completely shut down — [reason]. [N] daily crossers affected."
├── dramatic improvement
│   └── RECORD: "Wait times at [crossing] dropped to [N] min — [cause: new system, policy change]"
├── Nth bad day
│   └── RAGE: "[Nth] day above 2 hours at [crossing] this month — people cross this daily for work"
└── normal 15-45 min → skip
```

**Mockups:**
1. RAGE: "San Ysidro border: 4-hour wait right now. People who cross daily for work left home at 3am."
2. WATCH: "Tijuana crossing shut down completely — all lanes closed. No ETA. 50,000 people cross here every day."
3. MONEY: "El Paso commercial crossing: 8-hour wait. This is where $240B in annual trade flows through. Every hour of delay costs millions."
4. RAGE: "Every single US-Mexico border crossing is above 2 hours simultaneously. This hasn't happened since the pandemic."
5. WATCH: "Canadian border at Peace Bridge: 3-hour wait — unusual for the northern border. What's happening?"
6. RAGE: "12th day above 2 hours at San Ysidro this month. People with legal crossings and legal jobs, punished by infrastructure."
7. RECORD: "New processing system brought border wait to 15 minutes — fastest crossing in 5 years. Technology works when deployed."
8. WTF: "Detroit-Windsor tunnel: 90-minute wait because of an NHL game. Two countries' border backed up for hockey."
9. MONEY: "Laredo is the busiest commercial crossing in the US. Today's wait: 6 hours. Your Amazon package is in that line."
10. WATCH: "Border crossings at lowest volume since lockdowns — not a holiday, not weather. Something shifted."

---

### COURT FILINGS (courtlistener)

```
filing detected
├── involves FAANG / major tech
│   └── MONEY/WATCH: "[agency] just [sued/ruled against] [company] — [plain English impact]"
├── constitutional ruling
│   └── WATCH: "Federal judge just [ruled X] — [what this means for your rights]"
├── massive settlement / award
│   └── MONEY: "$[X]B [settlement/verdict] against [company] — [what they did]"
├── politically explosive
│   └── WATCH: "[court] just [ruling] on [hot topic] — [impact]"
├── ironic / absurd
│   └── WTF: "[absurd legal situation]"
└── routine filings → skip
```

**Mockups:**
1. WATCH: "Federal judge just blocked the TikTok ban — ruled it violates the First Amendment. DOJ will appeal."
2. MONEY: "DOJ filed its 3rd antitrust suit against Google — this one targets the ad business. $200B in annual revenue at stake."
3. WATCH: "Supreme Court agreed to hear an AI copyright case — the ruling will decide if AI training on public data is legal"
4. MONEY: "Jury awarded $2.3B against pharmacy chains for the opioid crisis — largest verdict yet"
5. RAGE: "Court ruled NSA bulk data collection unconstitutional — again. 3rd time a court said this. NSA hasn't stopped."
6. WTF: "Meta lost a facial recognition lawsuit — $1.4B settlement. They scanned your face without asking. Now they owe you $400."
7. MONEY: "SEC lawsuit against Coinbase dismissed — judge called it 'regulatory overreach.' Crypto rallying on the news."
8. WATCH: "Judge blocked the EPA's biggest climate regulation — 14 states sued. The rule would have cut emissions 40%."
9. RAGE: "Apple ordered to pay $15B in EU back taxes — has spent $2B on lawyers trying to avoid it"
10. WTF: "Federal court filing surge: 847 new cases in DC Circuit this week — 3x the normal rate. Something big is being litigated."

---

### SPORTS (sports + pandascore)

```
event detected
├── historic upset
│   └── WTF: "[underdog] just beat [favorite] — [how rare: first time since / Nth time ever]"
├── record broken
│   └── RECORD: "[player/team] just [record] — [comparison to history]"
├── bizarre score/event
│   └── WTF: "[sport] game ended [score] — [how absurd / last time this happened]"
├── esports milestone
│   └── RECORD: "[game/event] hit [N] viewers — [comparison to traditional sports]"
├── prize money milestone
│   └── WTF: "A [age]-year-old just won $[X]M playing [game] — more than [comparison athlete]"
├── normal results → skip
└── regular season routine → skip
```

**Mockups:**
1. WTF: "16-seed just beat a 1-seed in March Madness — this has happened exactly twice in history. You're watching history."
2. WTF: "NFL game ended 2-0. Last time that happened was 1938. Nobody scored a touchdown. Both teams tried."
3. RECORD: "Counter-Strike major final: 2.7M concurrent viewers — more than the World Series. Esports isn't niche anymore."
4. WTF: "A team that was 0-14 just won the championship. Nobody can explain it. Vegas odds were 500:1."
5. RECORD: "League of Legends Worlds got more viewers than the NBA Finals. Gaming isn't the future — it's the present."
6. WTF: "A 19-year-old just earned $7.4M playing Dota 2 this year — more than most NFL players"
7. WTF: "Soccer match: 7 goals scored in injury time. The referee let the game run 14 extra minutes. Chaos."
8. RECORD: "NBA game went to 4 overtimes — final score 168-166. Players could barely stand."
9. WTF: "Cricket batter scored 100 runs in 35 balls — that's like hitting a home run every other at-bat"
10. RECORD: "An esports team just won $18M in one tournament — largest prize pool in competitive gaming history"

---

### GAMING (steam + twitch)

```
gaming event detected
├── concurrent player record for major game
│   └── RECORD: "[game] just hit [N] concurrent players — [comparison: more than population of / beats previous record by]"
├── surprise indie hit
│   └── WTF: "[game] made by [N] people just [beat AAA game at metric] — [context]"
├── review bombing / negative reception
│   └── RAGE: "$[X] game sits at [X]% negative reviews — [what went wrong]"
├── twitch viewership record
│   └── RECORD: "[streamer/event] hit [N] viewers — [comparison]"
├── cultural shift moment
│   └── WTF: "[surprising stat about gaming vs other entertainment]"
├── normal fluctuations → skip
└── routine esports matches → skip
```

**Mockups:**
1. RECORD: "GTA VI hit 1.2M concurrent players on Steam — more people playing right now than live in Dallas"
2. WTF: "A game made by 1 person just passed Fortnite in Twitch viewers. Budget: $0. Fortnite's budget: $hundreds of millions."
3. RAGE: "This $70 game has 91% negative reviews on Steam — it launched broken and the devs went silent"
4. RECORD: "Twitch streamer hit 400K live viewers — more people watching one person play a game than watch most TV shows"
5. WTF: "Palworld sold 25 million copies. The dev team is 5 people. Five."
6. RECORD: "Counter-Strike 2: 1.8M concurrent players — CS franchise all-time high, 25 years after the original"
7. WTF: "Minecraft is back to #1 on Twitch. The game is 15 years old. Nothing can kill it."
8. WTF: "Every game in Steam's top 10 right now is from an indie studio. Not one AAA game."
9. RECORD: "Twitch's 'Just Chatting' category now has more viewers than all gaming categories combined. It's not a gaming platform anymore."
10. WTF: "Steam refund requests for [game] hit 200K in 48 hours — the fastest mass-refund in platform history"

---

### ANIMAL SHELTERS (shelter)

```
shelter data
├── capacity > 120%
│   └── FEAR: "[city] shelters at [X]% capacity — [N] animals need homes right now. Euthanasia begins when it hits [threshold]."
├── mass intake (disaster)
│   └── WATCH: "[city] shelter took in [N] animals in [time] after [event] — fosters desperately needed"
├── record adoption day
│   └── LOOK: "[event] — [N] animals adopted in [time]. The good news you needed today."
├── long-term resident
│   └── WATCH: "A [animal] in [city] has been waiting [N] days for adoption. [brief description]."
├── national trend
│   ├── worsening → RAGE: "Post-[COVID/trend] pet returns: shelter intake up [X]% nationally. People got bored of their pandemic pets."
│   └── improving → LOOK: "[city] became a no-kill city — [adoption rate]%. It can be done."
└── normal daily numbers → skip
```

**Mockups:**
1. FEAR: "NYC shelters at 150% capacity — 4,200 animals need homes. When shelters overflow, euthanasia starts. Adopt or foster."
2. WATCH: "Houston shelter took in 800 animals in 48 hours after the hurricane — they need fosters, not donations. Fosters."
3. LOOK: "Clear the Shelters weekend: 15,000 animals adopted in one weekend across the country. It works."
4. RAGE: "Post-COVID pet returns: shelter intake up 35% nationally. Millions adopted dogs in 2020. Millions returned them."
5. FEAR: "40% of US shelters are at or above capacity right now. This is the worst shelter crisis in 20 years."
6. LOOK: "Austin became America's largest no-kill city — 97% save rate. Every city can do this."
7. WATCH: "A cat in Denver has been waiting 847 days for adoption. 847 days. Her name is Patches."
8. RAGE: "LA shelter euthanized 400 animals last month. The city spent $2M on a new dog park. Priorities."
9. LOOK: "A shelter dog went viral on TikTok and received 2,400 adoption applications. Social media saves lives sometimes."
10. WATCH: "Chicago shelters waiving all adoption fees this weekend — 600 animals waiting. If you've been thinking about it, this is the sign."

---

### HACKER NEWS (hackernews)

```
story detected
├── > 1000 points
│   ├── tech drama → WTF: "[headline] — HN going wild: [N] points in [time]"
│   ├── someone built something → LOOK: "[headline] — [N] points on HN. Worth checking out."
│   └── industry shift → WATCH: "[headline] — [N] points and [N] comments. Tech people are worried."
├── 500-1000 points
│   ├── relatable/funny → WTF: "Top HN post: '[headline]' — [N] points"
│   ├── corporate expose → RAGE: "'[headline]' — trending on HN. [brief context]"
│   └── else → skip
├── front page dominated by one topic
│   └── WATCH: "HN front page: [N] of top 10 posts are about [topic]. The tech world is fixated."
└── < 500 points → skip
```

**Mockups:**
1. WTF: "'I replaced my entire team with Claude' — 1,200 points on Hacker News. The comments are either terrified or jealous."
2. RAGE: "Google engineer's internal memo leaked on HN — 800 points in 2 hours. 'We have no moat and neither does OpenAI.'"
3. LOOK: "A kid built a better Maps than Google — Show HN post at 2,400 points. Silicon Valley doesn't know how to react."
4. WTF: "'We deleted our Kubernetes cluster and nothing happened' — 900 points. A lot of infrastructure teams are sweating."
5. WTF: "'I made $2M from a side project I built in a weekend' — top of HN. The project? A browser extension."
6. RAGE: "'Cloudflare is silently blocking entire countries from the internet' — trending on HN. No official response yet."
7. WATCH: "8 of the top 10 HN posts are about AI right now. The tech world can't talk about anything else."
8. WTF: "Top HN story: 'I reverse-engineered OpenAI's system prompt' — 1,500 points. OpenAI has not commented."
9. LOOK: "'Why I quit FAANG to farm mushrooms' — 600 points on HN. The comments are split between 'goals' and 'you'll be back.'"
10. RAGE: "'My startup was acqui-hired and everyone was fired on day one' — HN post confirming what everyone suspected"

---

### DEV ECOSYSTEM (github + npm + pypi)

```
dev data detected
├── repo: 0 to 10K+ stars in < 1 week
│   └── WTF: "A GitHub repo went from 0 to [N]K stars in [N] days — [what it is]"
├── framework milestone (100K stars, 1M downloads)
│   └── RECORD: "[framework] just hit [milestone] — [context about dominance/growth]"
├── language/framework shift
│   └── RECORD: "[A] just overtook [B] in [metric] — first time ever. The shift is real."
├── supply chain incident
│   └── FEAR: "[package] with [N]M downloads/week [was compromised / broke builds] — check your dependencies"
├── absurd package
│   └── WTF: "[package name] has [N] weekly downloads — it's [N] lines of code. [what it does]."
├── normal weekly stats → skip
└── minor version bumps → skip
```

**Mockups:**
1. WTF: "A GitHub repo went from 0 to 50K stars in 3 days. It's an AI agent that writes and deploys entire apps."
2. RECORD: "Python just overtook JavaScript on GitHub for the first time ever. AI ate the web."
3. FEAR: "Left-pad 2.0: a 12-line npm package was deleted and broke 47,000 projects. Check your builds."
4. WTF: "The npm package 'is-odd' has 500,000 downloads per week. It's literally one line: `return n % 2 === 1`"
5. RECORD: "PyPI downloads for AI libraries now exceed web frameworks for the first time — the developer world pivoted"
6. WTF: "A COBOL repository hit trending on GitHub. Banks are panicking and paying $500/hr to retirees."
7. RECORD: "Tailwind CSS v4: 30K GitHub stars in the first week — fastest adoption of any CSS framework ever"
8. WATCH: "Rust crate downloads up 200% this year — fastest growing language ecosystem by far. Something is pulling devs."
9. FEAR: "Popular npm package with 8M weekly downloads found to contain a crypto miner. Update NOW."
10. WTF: "The most starred GitHub repo this week is a collection of AI jailbreak prompts. It has 40K stars."

---

### REDDIT (reddit)

```
community data detected
├── sub gains > 100K members in 24h
│   └── WTF: "r/[sub] gained [N]K subscribers in 24 hours — [what triggered it]"
├── mass moderation event
│   └── RAGE: "[N] subreddits went [private/dark] — [N]M subscribers affected. [why]"
├── sub overtakes another (significant)
│   └── RECORD: "r/[sub] is now bigger than r/[sub] — [what this signals]"
├── community vs platform
│   └── RAGE: "Reddit [did X] — [N] communities are protesting"
├── normal sub growth → skip
└── individual posts → skip (we're not a Reddit aggregator)
```

**Mockups:**
1. WTF: "r/wallstreetbets gained 200K subscribers in 24 hours — last time this happened, GameStop went up 1,600%"
2. RECORD: "r/LocalLLaMA is now bigger than r/MachineLearning — the open-source AI crowd outnumbers academia"
3. RAGE: "3 subreddits with 20M combined subscribers just went private in protest — Reddit hasn't responded"
4. WTF: "r/antiwork hit 3 million subscribers — it's now the largest labor-focused community in history"
5. WATCH: "r/bitcoin subscriber count dropping for the first time in 2 years — sentiment shifting?"
6. RAGE: "Reddit's moderators work for free. Reddit's IPO valued them at $0. The mods noticed."
7. WTF: "A new subreddit went from 0 to 500K subscribers in one week. Nobody knows who runs it."
8. WTF: "r/wallstreetbets is buying Reddit stock on Reddit's IPO day. The irony is not lost on them."
9. RAGE: "r/technology mods removed 400 AI posts today — the community is revolting over censorship"
10. RECORD: "r/science gained 100K subscribers in one day after the UFO hearing — biggest single-day gain in the sub's history"

---

## Architecture (Updated)

```
┌─────────────────────────────────────────────────────────┐
│                     DATA NODE                            │
│            (already running, 98 sources)                 │
└───────────────────┬─────────────────────────────────────┘
                    │ feed updates
                    ▼
┌─────────────────────────────────────────────────────────┐
│               ANOMALY DETECTOR                           │
│                                                          │
│  Per source:                                             │
│  1. Apply decision tree → determine if event qualifies   │
│  2. If yes, compute CONTEXT:                             │
│     - frequency("3rd this week")                         │
│     - comparison("worst since 2019")                     │
│     - trend("rising for 9 days")                         │
│     - human_scale("bigger than Rhode Island")            │
│     - delta("up 340% from last year")                    │
│  3. Determine OUTCOME tag (FEAR/LOOK/MONEY/RAGE/WTF/    │
│     WATCH/RECORD) from decision tree                     │
│  4. Dedup: hash(source + entity + day)                   │
│                                                          │
│  Output: { raw_data, context, outcome_tag, source }      │
└───────────────────┬─────────────────────────────────────┘
                    │ qualified events + context
                    ▼
┌─────────────────────────────────────────────────────────┐
│            CLAUDE HEADLINE WRITER                        │
│                                                          │
│  System prompt:                                          │
│  "You write viral one-line news. You receive:            │
│   - raw data about an event                              │
│   - computed context (frequency, comparison, trend)      │
│   - outcome tag (FEAR/LOOK/MONEY/RAGE/WTF/WATCH/RECORD) │
│                                                          │
│   Rules:                                                 │
│   1. The reader must know WHY they should care            │
│   2. Include the most dramatic context provided           │
│   3. Match the outcome tag's emotion:                     │
│      FEAR  → tell them what to DO (shelter, stay inside)  │
│      LOOK  → tell them where to LOOK (go outside, north)  │
│      MONEY → tell them how their WALLET is affected       │
│      RAGE  → highlight the UNFAIRNESS or HYPOCRISY       │
│      WTF   → lean into the ABSURDITY                     │
│      WATCH → signal this is DEVELOPING, not over          │
│      RECORD → anchor to HISTORY (first since, never)      │
│   4. Max 260 chars                                        │
│   5. No emoji, no hashtags                                │
│   6. Rate virality 1-10. Only post if ≥ 7.               │
│   7. If the event + context isn't genuinely interesting   │
│      to a normal person, return SKIP."                    │
│                                                          │
│  Model: claude-haiku-4-5                                 │
└───────────────────┬─────────────────────────────────────┘
                    │ scored tweets
                    ▼
┌─────────────────────────────────────────────────────────┐
│              POSTING PIPELINE                            │
│                                                          │
│  - Queue sorted by virality score (highest first)        │
│  - 30-min minimum spacing between tweets                 │
│  - Max 15 tweets/day (scarcity = quality perception)     │
│  - FEAR tweets bypass queue (post immediately)           │
│  - Dedup: don't tweet same story twice                   │
│  - SQLite: full history for context engine lookups        │
│                                                          │
│  Thread strategy:                                        │
│  - If WATCH event escalates → reply to original tweet    │
│    with update ("Update: now at [new level]")            │
│  - Weekly recap thread on Sundays                        │
│                                                          │
│  CTA (never in tweets, only in):                         │
│  - Pinned tweet                                          │
│  - Bio link                                              │
│  - Self-reply 1h after viral tweets                      │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
             Twitter API v2
```

---

## Sources That DON'T Fit This Model

Skip entirely — no decision tree needed:

| Source | Why | Exception |
|--------|-----|-----------|
| crossref / openalex | Academic DOI counts | never |
| stackexchange | Question counts | never |
| crates_io | Merge into github/npm tree | — |
| bestbuy | Product prices | never |
| backpacktf | TF2 niche | never |
| fourchan | Brand risk | never |
| chaturbate | Brand risk | never |
| bgg | Board game niche | never |
| adzuna | Job vacancy counts | never |
| lastfm | Listener counts | never |
| anilist | Anime niche | never |
| noaa_tides/met/ndbc/nwps/usgs_water | Raw sensor data | only via weather_alerts tree |
| tomtom_evcharge | EV connector counts | never |
| iss | ISS position | unless deorbit announced |
| mil_aircraft | Sensitive | never |
| cftc | Too technical | merge into finra tree |
| polymarket | They have their own account | never |
| pubmed | Medical papers | only via epidemic tree |
| defillama | DeFi TVL | merge into crypto tree |
| finnhub/nasdaq | Stock prices | merge into sec/finra trees |

---

## Summary: What Makes Each Tweet Work

```
BAD:  [fact]
      "M5.2 earthquake in Turkey"
      → So what? What do I do? How rare is this?

GOOD: [fact] + [context] + [outcome]
      "3rd M5+ earthquake in Turkey this week — the fault hasn't been
       this active in 6 years. If you're in the region, stay alert."
      → I know it's unusual, I know it's escalating, I know what to do
```

The context engine and decision trees ensure every tweet passes the "so what?" test before it reaches anyone's timeline.
