# Data Sources Ranked by Audience Attention

Goal: find niches where we have data nobody else surfaces on Twitter.

## Scoring

- **Audience**: how many people care about this topic daily
- **Competition**: how many accounts already tweet about it well
- **Our edge**: do we have unique data context (frequency, trends, cross-source)?
- **Niche score**: high audience + low competition + strong edge = gold

---

## Tier 1: Massive Audience, Low Twitter Competition (GOLD)

Verified against existing X accounts and tools (March 2026).

| Source | Assets | Status | Audience | X Competition | Verdict | Niche Score |
|--------|--------|--------|----------|---------------|---------|-------------|
| **twitch** | 48,883 | LIVE | Huge (35M daily) | TwitchTracker/StreamsCharts are websites, no major X data bot | **GO** — anomaly-style tweets (viewer crashes, category shifts) are uncovered | **9/10** |
| **anilist** | 2,001 | LIVE | Large (anime fans) | @myanilist is official, no data-anomaly account exists | **GO** — "X anime dropped 1.2 points in 48h, fastest fall this season" is uncovered | **9/10** |
| **fourchan** | 100 | LIVE | Large (culture signals) | 4stats.io exists but has zero X presence | **GO** — board activity spikes as early signal for breaking events | **8/10** |
| ~~steam~~ | 502 | LIVE | Huge (30M daily) | @steamcharts on X + SteamDB + daily bot on GitHub | **PASS** — covered | ~~9/10~~ → 4/10 |
| ~~tmdb~~ | 35,198 | LIVE | Massive (movies/TV) | @BORReport + Box Office Mojo + entertainment press | **PASS** — saturated | ~~8/10~~ → 3/10 |
| ~~polymarket~~ | 89,866 | LIVE | Growing fast | Official X partner, Grok embeds odds, 170+ bots/trackers, whale bots everywhere | **PASS** — extremely saturated | ~~7/10~~ → 1/10 |

**Survivors:** Twitch anomalies, AniList data, 4chan signals. The rest are covered.

---

## Tier 2: High Attention, Medium Competition (SILVER)

Strong audiences but some existing accounts cover these. We win with CONTEXT.

| Source | Assets | Status | Audience | Competition | Our Edge | Niche Score |
|--------|--------|--------|----------|-------------|----------|-------------|
| **earthquake** | 20 | LIVE | Massive (fear-driven) | High for events | Frequency tracking, fault activity trends | **7/10** |
| **wildfire** | 20 | LIVE | Large (fear-driven) | High for events | Hotspot counts, cross-source (AQI cascade) | **7/10** |
| **crypto** | 9,963 | LIVE | Massive | Very high | We lose here — CT is saturated | **3/10** |
| **defi** | 6,552 | LIVE | Large | High | TVL movements, protocol anomalies | **4/10** |
| **stocks** | 778 | LIVE | Massive | Very high | No edge vs Bloomberg/CNBC | **2/10** |
| **sports** | 1,440 | LIVE | Massive | Very high | Odds movements could niche | **4/10** |
| **weather_alerts** | 20 | LIVE | Huge (weather Twitter) | High | Cross-source cascades are our edge | **6/10** |
| **hackernews** | 5,376 | STALE | Medium (tech) | Medium | Score anomalies, but HN is public | **4/10** |

---

## Tier 3: Niche Audience, Zero Competition (HIDDEN GEMS)

Small but passionate audiences with ZERO data accounts serving them.

| Source | Assets | Status | Audience | Competition | Our Edge | Niche Score |
|--------|--------|--------|----------|-------------|----------|-------------|
| **mcbroken** | 30 | LIVE | Cult following | Zero | City breakdowns, national spikes | **8/10** |
| **queue_times** | 30 | LIVE | Theme park fans (devoted) | Very low | Wait time records, park anomalies | **8/10** |
| **shelter** | 9 | LIVE | Animal lovers (huge on Twitter) | Zero | Intake spikes = signal (storms, crisis) | **9/10** |
| **backpacktf** | 2,388 | LIVE | TF2 trading community | Zero | Price anomalies, unusual items | **6/10** |
| **lastfm** | 1,012 | LIVE | Music data fans | Very low | Listening spikes tied to events (deaths, releases) | **7/10** |
| **mil_aircraft** | 10,713 | LIVE | OSINT/mil community | Medium | Flight patterns, unusual activity | **7/10** |
| **crates_io** | 19,829 | LIVE | Rust devs | Very low | Download spikes = supply chain signals | **6/10** |
| **npm** | 9,174 | LIVE | JS devs | Very low | Download spikes = supply chain or viral project | **6/10** |
| **yahoo_drinks** | 12 | LIVE | Niche/fun | Zero | Beverage price anomalies | **3/10** |
| **pumpfun** | 1,748 | STALE | Degen traders | Medium | Memecoin launches, but CT covers this | **3/10** |

---

## Tier 4: Important Data, But Low Twitter Virality

These matter for @GeneralGridDown / @GeneralTaxReceipt but rarely go viral alone.

| Source | Assets | Status | Audience | Competition | Our Edge | Niche Score |
|--------|--------|--------|----------|-------------|----------|-------------|
| **faa_delays** | 30 | LIVE | High when cascading | Medium | Ground stops, ripple effects | **6/10** |
| **db_trains** | 58 | LIVE | German commuters | Very low | System-wide delay patterns | **5/10** |
| **airnow** | 331 | LIVE | High during events | Low | AQI spikes linked to wildfires | **6/10** |
| **spaceweather** | 10 | LIVE | Aurora chasers | Low | Kp storms, aurora alerts = LOOK tweets | **7/10** |
| **usgs_water** | 3,040 | LIVE | Niche (flood risk) | Very low | River gauge spikes = flood warnings | **5/10** |
| **cloudflare** | 193 | LIVE | Tech/infra community | Low | Internet traffic anomalies by country | **6/10** |
| **ndbc** | 212 | LIVE | Marine/coastal | Very low | Wave heights, buoy anomalies | **4/10** |
| **citybikes** | 30 | LIVE | Urban mobility | Very low | Bike availability = city events | **3/10** |
| **noaa_tides** | 59 | LIVE | Coastal communities | Very low | Tide anomalies, storm surge | **4/10** |
| **nyc311** | 30 | LIVE | NYC locals | Low | Complaint spikes = something happening | **5/10** |

---

## Tier 5: Broken / DEAD (Need Implementation)

| Source | Assets | Status | Would-Be Audience | Priority to Fix |
|--------|--------|--------|-------------------|-----------------|
| **power_outages** | 51 | DEAD | Massive (fear) | **P0** — core @GeneralGridDown |
| **mta_subway** | 24 | DEAD | Large (NYC commuters) | **P1** |
| **tfl_tube** | 11 | DEAD | Large (London commuters) | **P1** |
| **ioda** | 50 | DEAD | Large (internet shutdowns) | **P0** — internet shutdowns go mega-viral |
| **reddit** | 318 | DEAD | Massive | **P1** — activity spikes signal breaking events |
| **congress** | 10 | STALE | High (political Twitter) | **P1** — core @GeneralInsiders |
| **sec_insider** | 157 | STALE | High (finance Twitter) | **P1** — core @GeneralInsiders |
| **cbp_border** | 81 | DEAD | Medium (immigration Twitter) | **P2** |
| **nrc_nuclear** | 95 | DEAD | Fear-driven spikes | **P2** |
| **github** | 672 | DEAD | Dev community | **P2** |
| **finra** | 25 | DEAD | Finance | **P2** — short interest data is gold |

---

## Recommended Niche-Down Strategy

### @GeneralGlitch — **Gaming + Internet Culture** (Twitch, Steam, Anilist, 4chan, McBroken)
- **48K+ live assets** across gaming/streaming
- Zero competition for real-time gaming data tweets
- "Fortnite just lost 40% of its players in one week" — this is a tweet
- McBroken and queue_times are pure viral WTF content

### @GeneralSkyWatch — **Already strong** (Earthquake, Wildfire, Spaceweather, AirNow)
- Working sources, good thresholds
- Fix: needs deeper history for "worst since" context
- Spaceweather aurora alerts (LOOK outcome) are underused

### @GeneralGridDown — **Crippled without infra sources**
- power_outages, mta_subway, tfl_tube, ioda are all DEAD
- faa_delays and db_trains are the only working sources
- **Must fix power_outages + ioda to make this account viable**

### @GeneralInsiders — **Needs SEC/Congress data flowing**
- sec_insider is STALE (last: Mar 9), congress barely working (1 asset)
- finra (short interest) is DEAD
- Without these, this account has nothing to tweet

### @GeneralTaxReceipt — **Needs implementation work**
- usa_spending is LIVE but only 12 assets
- zillow STALE, courtlistener STALE
- Least viable account right now

---

## Top 5 Niche Opportunities (Attention/Asset Ratio)

1. **Twitch/Steam combo** — 49K assets, 65M+ daily users, zero data competition on Twitter
2. **Animal shelter intake** — 9 assets but animal Twitter is MASSIVE and emotional
3. **McBroken** — cult following, pure WTF virality, zero competition
4. **Anime rankings** — 2K assets, devoted fanbase, zero data accounts
5. **Spaceweather aurora** — small source but LOOK tweets (go outside) go extremely viral
