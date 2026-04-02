#!/usr/bin/env python3
"""
Generate fund-branding.json and funds.toml from a hardcoded catalog.
47 sources, 3-5 funds each, all single-source.
"""

import json
import os
from datetime import datetime

# ── Color map (from sources-display.json brandBg, cleaned) ──────────
# For gradients, pick the primary hex. For #f5f5f5 (white bg), use a domain-appropriate color.
SOURCE_COLORS = {
    "adzuna":           "#2C3E50",
    "airnow":           "#3498DB",
    "anilist":          "#152232",
    "animals":          "#4A7C59",
    "backpacktf":       "#363636",
    "bchain":           "#F7931A",
    "bestbuy":          "#0046BE",
    "bls":              "#2C3E50",
    "bonds":            "#0057B7",
    "chaturbate":       "#F47321",
    "citybikes":        "#1A1A1A",
    "cloudflare":       "#F38020",
    "congress":         "#1A2744",
    "crossref":         "#2A6496",
    "defi":             "#1B1B1B",
    "earthquake":       "#C0392B",
    "ecb":              "#003399",
    "eia":              "#00526E",
    "finra_short_vol":  "#0A3055",
    "fourchan":         "#3D5C3D",
    "gtfs_transit":     "#0039A6",
    "hackernews":       "#F66A0A",
    "iss":              "#0C0A1A",
    "mil_aircraft":     "#1A2332",
    "mta_subway":       "#0039A6",
    "ndbc":             "#1ABC9C",
    "noaa_met":         "#2C3E50",
    "noaa_tides":       "#16A085",
    "nwps":             "#2980B9",
    "parking":          "#5C6BC0",
    "polymarket":       "#1B1B1B",
    "pubmed":           "#326599",
    "pumpfun":          "#00D18C",
    "queue_times":      "#1A1A2E",
    "rates":            "#003366",
    "sec_13f":          "#0A3055",
    "spaceweather":     "#8E44AD",
    "sports":           "#1B1B1B",
    "steam":            "#171A21",
    "twitch":           "#9146FF",
    "usa_spending":     "#112E51",
    "usgs_water":       "#2980B9",
    "weather":          "#2ECC71",
    "weather_alerts":   "#E65100",
    "wildfire":         "#E67E22",
    "worldbank":        "#002244",
    "zillow":           "#006AFF",
}

# Categories by source
SOURCE_CATEGORIES = {
    "adzuna":           "Economic",
    "airnow":           "Environment",
    "anilist":          "Entertainment",
    "animals":          "Nature",
    "backpacktf":       "Gaming",
    "bchain":           "Crypto",
    "bestbuy":          "Retail",
    "bls":              "Economic",
    "bonds":            "Finance",
    "chaturbate":       "Entertainment",
    "citybikes":        "Transport",
    "cloudflare":       "Technology",
    "congress":         "Government",
    "crossref":         "Academic",
    "defi":             "Crypto",
    "earthquake":       "Geophysical",
    "ecb":              "Economic",
    "eia":              "Energy",
    "finra_short_vol":  "Finance",
    "fourchan":         "Social",
    "gtfs_transit":     "Transport",
    "hackernews":       "Social",
    "iss":              "Space",
    "mil_aircraft":     "Defense",
    "mta_subway":       "Transport",
    "ndbc":             "Ocean",
    "noaa_met":         "Weather",
    "noaa_tides":       "Ocean",
    "nwps":             "Weather",
    "parking":          "Transport",
    "polymarket":       "Prediction",
    "pubmed":           "Academic",
    "pumpfun":          "Crypto",
    "queue_times":      "Leisure",
    "rates":            "Finance",
    "sec_13f":          "Finance",
    "spaceweather":     "Space",
    "sports":           "Sports",
    "steam":            "Gaming",
    "twitch":           "Entertainment",
    "usa_spending":     "Government",
    "usgs_water":       "Environment",
    "weather":          "Weather",
    "weather_alerts":   "Weather",
    "wildfire":         "Environment",
    "worldbank":        "Economic",
    "zillow":           "Real Estate",
}

# ── Catalog: (name, symbol, strategy, params, tagline, fee) ─────────
CATALOG = {
    # ── JOBS & LABOR ────────────────────────────────────────────────
    "adzuna": [
        ("Vacancy", "VCNY", "momentum", {},
         "Job postings cluster by sector. A hiring surge in one tick means more in the next. Vacancy rides the recruitment wave.",
         2000),
        ("Layoff", "LYOF", "contrarian", {},
         "Every hiring freeze ends. Layoff bets on the recovery after job postings crater, because labor markets have short memories.",
         2000),
        ("Demand", "DMND", "momentum_threshold", {"min_change_pct": 3.0},
         "Most daily posting changes are noise. Demand only acts on shifts above 3%, where real sector movement lives.",
         1500),
        ("Headcount", "HDCT", "regime", {},
         "Labor markets operate in hiring and freezing regimes. Headcount detects the shift and positions for the new normal.",
         2000),
    ],

    # ── AIR QUALITY ─────────────────────────────────────────────────
    "airnow": [
        ("Clearsky", "CLRS", "mean_reversion", {},
         "AQI spikes are temporary. Smoke clears, winds shift, rain falls. Clearsky bets on recovery after every pollution event.",
         1500),
        ("Smog", "SMOG", "momentum", {},
         "Bad air compounds. Wildfires feed themselves, inversions trap particulates. Smog bets that poor AQI persists tick-over-tick.",
         2000),
        ("Breeze", "BRZE", "contrarian", {"min_change_pct": 5.0},
         "Only the largest AQI swings matter. Breeze fades extreme moves above 5%, trusting the atmosphere to self-correct.",
         1500),
        ("Inhalant", "INHL", "regime", {},
         "Air quality operates in seasonal regimes. Inhalant detects the shift between fire season and clear season and trades accordingly.",
         2000),
    ],

    # ── ANIME ───────────────────────────────────────────────────────
    "anilist": [
        ("Season", "SZON", "momentum", {},
         "Anime popularity spikes at premiere and sustains for weeks. Season bets a trending show stays trending tick-over-tick.",
         1500),
        ("Filler", "FILR", "contrarian", {},
         "Every hype cycle collapses. Filler fades the popularity surge, because only the source material endures.",
         2000),
        ("Simulcast", "SIMU", "time_of_day", {},
         "Episode drops happen on schedule. Viewership spikes at broadcast time across every timezone. Simulcast trades the clock.",
         1500),
        ("Canon", "CANN", "adoption_curve", {},
         "Beloved series accumulate fans on S-curves. Canon rides the adoption wave of shows entering the cultural lexicon.",
         1500),
    ],

    # ── ANIMALS ─────────────────────────────────────────────────────
    "animals": [
        ("Safari", "SFRI", "momentum", {},
         "Animal sighting patterns cluster. Where one appears, more follow. Safari bets on the persistence of observation streaks.",
         2000),
        ("Hibernate", "HBRN", "mean_reversion", {},
         "Activity spikes are seasonal noise. Hibernate bets that every surge in sightings returns to the long-run baseline.",
         1500),
        ("Biome", "BIOM", "cluster", {},
         "Ecological events cascade. A predator sighting predicts prey activity. Biome bets on the interconnectedness of species data.",
         2000),
        ("Nocturne", "NTRN", "time_of_day", {},
         "Animal activity follows circadian rhythms older than civilization. Nocturne trades the daily cycle that biology hardcodes.",
         1500),
    ],

    # ── TF2 TRADING ─────────────────────────────────────────────────
    "backpacktf": [
        ("Unusual", "UNSL", "momentum", {},
         "Virtual hat prices trend for weeks. Unusual rides the price momentum of TF2's strangest economy.",
         2000),
        ("Uncrate", "UCRT", "contrarian", {},
         "Every price spike in virtual items crashes back to earth. Uncrate fades the speculation premium.",
         2000),
        ("Vintage", "VNTG", "bullish", {},
         "Scarce digital items appreciate over time. Vintage leans long on the deflationary pressure of a shrinking supply.",
         1500),
    ],

    # ── BLOCKCHAIN ──────────────────────────────────────────────────
    "bchain": [
        ("Hashrate", "HASH", "momentum", {},
         "Mining follows price follows mining. Hashrate momentum signals network conviction that most observers miss.",
         2000),
        ("Halving", "HALV", "regime", {},
         "Bitcoin halving cycles dictate everything. Halving positions for the regime shift that supply reduction creates.",
         2000),
        ("Satoshi", "SATS", "mean_reversion", {},
         "On-chain metrics oscillate around structural norms. Satoshi bets that every deviation from baseline reverts.",
         1500),
        ("Mempool", "MPLM", "cluster", {},
         "Transaction clusters signal network stress before price moves. Mempool trades the congestion pattern that precedes volatility.",
         2000),
    ],

    # ── RETAIL ELECTRONICS ──────────────────────────────────────────
    "bestbuy": [
        ("Markdown", "MKDN", "momentum", {},
         "Clearance sales deepen before they end. Markdown follows the downward price trajectory of last-gen electronics.",
         2000),
        ("Bounce", "BNCE", "contrarian", {},
         "Every deep discount ends. Bounce bets that sale prices revert to MSRP after the promotional frenzy subsides.",
         2000),
        ("Doorbuster", "DOOR", "momentum_threshold", {"min_change_pct": 5.0},
         "Small price tweaks are inventory noise. Doorbuster only trades when electronics prices shift by 5% or more.",
         1500),
        ("Clearance", "CLRN", "bearish", {},
         "Electronics depreciate. New models replace old ones. Clearance leans short on the structural decline of last-generation inventory.",
         1500),
    ],

    # ── EMPLOYMENT STATS ────────────────────────────────────────────
    "bls": [
        ("Payroll", "PYRL", "contrarian", {},
         "Jobs data overshoots every tick. Markets overreact to every release. Payroll fades the surprise.",
         2000),
        ("Nonfarm", "NFRM", "momentum", {},
         "Employment trends persist for months. Nonfarm follows the direction because the labor market turns like an aircraft carrier.",
         2000),
        ("Wage", "WAGE", "momentum_threshold", {"min_change_pct": 0.5},
         "Wage growth below half a percent is statistical noise. Wage only acts on moves that signal real purchasing power shifts.",
         1500),
        ("Underemployed", "UNEM", "contrarian", {"min_change_pct": 2.0},
         "Unemployment overshoots in both directions. Underemployed fades extreme labor market moves above 2%, trusting the reversion.",
         2000),
    ],

    # ── BONDS ───────────────────────────────────────────────────────
    "bonds": [
        ("Coupon", "CUPN", "momentum", {},
         "Yield curves trend for months. Coupon follows the direction of rates because the bond market is slow but relentless.",
         2000),
        ("Inversion", "INVR", "contrarian", {},
         "Yield spikes attract buyers. Inversion fades extreme moves, betting that bonds always find their natural level.",
         2000),
        ("Duration", "DURN", "momentum_threshold", {"min_change_pct": 0.5},
         "Most daily yield changes are noise. Duration only acts when rates shift by half a percent, following real policy moves.",
         1500),
        ("Maturity", "MTRT", "regime", {},
         "Bond markets operate in regimes. Maturity detects the shift between risk-on and risk-off and positions accordingly.",
         2000),
        ("Par", "PARR", "mean_reversion", {},
         "Bond prices oscillate around par value. Every premium compresses, every discount narrows. Par bets on the gravitational pull of face value.",
         1500),
    ],

    # ── ADULT STREAMING ─────────────────────────────────────────────
    "chaturbate": [
        ("After Dark", "DARK", "time_of_day", {},
         "Viewership follows the clock. Peak hours are predictable across timezones. After Dark trades the nightly surge.",
         2000),
        ("Intermission", "INTR", "contrarian", {},
         "Every spike in concurrent viewers crashes back to baseline. Intermission fades the peak, trusting the dip.",
         2000),
        ("Nocturnal", "NOCT", "momentum", {},
         "Trending rooms compound viewers. Nocturnal rides the momentum of discovery algorithms doing their work.",
         1500),
        ("Peakhour", "PKHR", "cluster", {},
         "Viewer clusters correlate across rooms and categories. Peakhour trades the temporal clustering of adult entertainment demand.",
         2000),
    ],

    # ── BIKE SHARING ────────────────────────────────────────────────
    "citybikes": [
        ("Spoke", "SPOK", "mean_reversion", {},
         "Empty racks refill. Full racks empty. Spoke bets on mean reversion in transit systems designed to self-balance.",
         1500),
        ("Pedal", "PEDL", "time_of_day", {},
         "Commuters bike at 8am and 6pm. Pedal trades the clockwork rhythm of urban cycling.",
         1500),
        ("Freewheel", "FRWL", "momentum", {},
         "Weekend usage builds on itself. Good weather begets more riders begets more availability pressure. Freewheel follows the surge.",
         2000),
        ("Dockless", "DKLS", "cluster", {},
         "Bike demand clusters by neighborhood. One busy station predicts nearby stations emptying. Dockless trades the spatial spillover.",
         1500),
    ],

    # ── CDN & INTERNET ──────────────────────────────────────────────
    "cloudflare": [
        ("Traffic", "TRFC", "momentum", {},
         "Internet traffic surges compound. Viral content creates more viral content. Traffic rides the bandwidth wave.",
         2000),
        ("Darknet", "DNRK", "contrarian", {},
         "Every traffic spike resolves. The internet forgets as fast as it discovers. Darknet fades the surge back to baseline.",
         2000),
        ("Crawl", "CRWL", "time_of_day", {},
         "Bot traffic peaks at predictable hours. Search engines crawl on schedule. Crawl trades the machine rhythm.",
         1500),
        ("Outage", "OUTG", "cluster", {},
         "Internet disruptions cascade through dependent services. Outage trades the domino effect that one CDN failure triggers.",
         2000),
    ],

    # ── CONGRESS ────────────────────────────────────────────────────
    "congress": [
        ("Session", "SESN", "momentum", {},
         "When Congress votes, it keeps voting. Legislative activity has momentum. A busy tick predicts another busy tick.",
         1500),
        ("Recess", "RECS", "contrarian", {},
         "Congressional activity always crashes to zero. Recess fades every legislative surge because politicians need vacations more than laws.",
         2000),
        ("Filibuster", "FLBS", "volatility_fade", {},
         "Legislative volatility resolves into gridlock. Filibuster bets that high-variance periods return to the procedural mean.",
         1500),
        ("Bipartisan", "BPRT", "regime", {},
         "Congress operates in legislative regimes. Bipartisan detects the shift between productive sessions and gridlock periods.",
         2000),
    ],

    # ── ACADEMIC CITATIONS ──────────────────────────────────────────
    "crossref": [
        ("Citation", "CITE", "adoption_curve", {},
         "Papers accumulate citations on an S-curve. Early citations predict more. Citation rides the adoption wave.",
         1500),
        ("Retraction", "RTRC", "contrarian", {},
         "Citation spikes often precede controversy. Retraction fades sudden attention, because scrutiny follows fame in academia.",
         2000),
        ("Index", "INDX", "momentum", {},
         "Publication volume trends for months. Index follows the output of a research community that cannot stop publishing.",
         1500),
        ("Impact", "IMPC", "momentum_threshold", {"min_change_pct": 5.0},
         "Most citation changes are incremental. Impact only trades when reference counts spike 5% or more, signaling a breakthrough paper.",
         1500),
    ],

    # ── DEFI ────────────────────────────────────────────────────────
    "defi": [
        ("Lockflow", "LOCK", "momentum", {},
         "DeFi TVL moves slowly and with conviction. Lockflow bets when TVL shifts, ignoring the noise between.",
         1500),
        ("Unlock", "ULCK", "contrarian", {},
         "Every TVL surge gets withdrawn. Unlock fades the deposits, because yield farmers are constitutionally incapable of patience.",
         2000),
        ("Yield", "YILD", "mean_reversion", {},
         "APYs oscillate around equilibrium. High yields attract capital that compresses them. Yield bets on the convergence.",
         1500),
        ("Exploit", "XPLT", "volatility_fade", {},
         "DeFi volatility follows exploit cycles. Every hack creates panic that subsides. Exploit bets on the normalization after protocol drama.",
         2500),
    ],

    # ── EARTHQUAKES ─────────────────────────────────────────────────
    "earthquake": [
        ("Aftershock", "AFTR", "cluster", {},
         "Earthquakes come in swarms. After a big one, the next ticks bring more. Aftershock bets on seismic persistence.",
         2000),
        ("Dormant", "DRMT", "mean_reversion", {},
         "Seismic quiet always returns. Every swarm ends. Dormant bets on the calm after the geological storm.",
         1500),
        ("Epicenter", "EPIC", "momentum", {},
         "Active fault zones stay active for days. Epicenter follows the tremor momentum until the plate edge exhausts itself.",
         2000),
        ("Richter", "RCTR", "momentum_threshold", {"min_change_pct": 4.0},
         "Microseisms are noise. Richter only trades magnitude shifts above 4%, filtering for the events that actually matter.",
         1500),
    ],

    # ── ECB / EUROPEAN RATES ────────────────────────────────────────
    "ecb": [
        ("Euro", "EURO", "momentum", {},
         "Currency trends persist for quarters. Euro follows European monetary flows with monastic patience.",
         2000),
        ("Parity", "PRTY", "contrarian", {},
         "Exchange rates oscillate around purchasing power. Parity fades extreme deviations, because currencies remember what things cost.",
         2000),
        ("Draghi", "DRGI", "momentum_threshold", {"min_change_pct": 1.0},
         "Minor FX twitches are noise. Draghi waits for moves exceeding 1%, when central bank intent becomes unmistakable.",
         1500),
        ("Austerity", "ASTR", "regime", {},
         "European monetary policy operates in regimes. Austerity detects the shift between expansion and contraction in the eurozone.",
         2000),
    ],

    # ── ENERGY ──────────────────────────────────────────────────────
    "eia": [
        ("Pipeline", "PIPE", "momentum", {},
         "Energy supply and demand shift in regimes. Pipeline follows the direction until fundamentals reverse, which takes longer than anyone expects.",
         2000),
        ("Surplus", "SRPL", "contrarian", {},
         "Every energy supply shock resolves. Surplus bets on the return to equilibrium, because markets produce what prices demand.",
         2000),
        ("Joule", "JOUL", "bullish", {},
         "Energy demand grows with civilization. Joule leans long on the world's insatiable appetite for power.",
         1000),
        ("Reserve", "RSRV", "regime", {},
         "Energy storage operates in draw and build cycles. Reserve detects the regime shift and positions for what the inventory report will confirm.",
         2000),
    ],

    # ── SHORT VOLUME ────────────────────────────────────────────────
    "finra_short_vol": [
        ("Crowd", "CRWD", "momentum", {},
         "Short volume trends signal institutional conviction. Crowd follows the direction of concentrated bets.",
         2000),
        ("Unwind", "UWND", "contrarian", {},
         "Extreme short positions create their own reversal. Unwind bets on the squeeze that inevitably follows excess.",
         2500),
        ("Spike", "VSPK", "momentum_threshold", {"min_change_pct": 5.0},
         "Minor short volume shifts are portfolio rebalancing. Spike only trades when short interest moves 5% or more.",
         1500),
        ("Pressure", "PRES", "regime", {},
         "Short selling operates in regime cycles. Pressure detects when the market shifts from complacency to conviction.",
         2000),
    ],

    # ── 4CHAN ───────────────────────────────────────────────────────
    "fourchan": [
        ("Noise", "NOIS", "volatility_fade", {},
         "4chan activity spikes are pure chaos. Every surge crashes back to baseline within a few ticks. Noise fades every spike.",
         1500),
        ("Raid", "RAID", "momentum", {},
         "When a thread catches fire, the pile-on accelerates. Raid rides the viral moment before the jannies arrive.",
         2000),
        ("Sage", "SAGE", "contrarian", {},
         "Every thread dies. The board slides, the meme expires, entropy wins. Sage bets on the inevitable decay of attention.",
         2000),
        ("Anon", "ANON", "time_of_day", {},
         "Peak posting hours follow timezone patterns even in anonymous chaos. Anon trades the daily rhythm of the terminally online.",
         1500),
    ],

    # ── TRANSIT (GTFS) ──────────────────────────────────────────────
    "gtfs_transit": [
        ("Cascade", "CSCD", "momentum", {},
         "Transit disruptions cascade. One stuck train creates thirty delayed ones. Cascade bets that disruption persists once it starts.",
         2000),
        ("Terminal", "TRMN", "mean_reversion", {},
         "Schedules recover. The system was designed to return to normal. Terminal bets on the self-healing property of timetables.",
         1500),
        ("Timetable", "TMTB", "time_of_day", {},
         "Rush hour is rush hour. Peak service runs on a clock that hasn't changed in decades. Timetable trades the certainty.",
         1500),
        ("Delay", "DLAY", "cluster", {},
         "Transit delays cluster by line and time. One failure cascades to connecting routes. Delay trades the contagion of lateness.",
         2000),
    ],

    # ── HACKER NEWS ─────────────────────────────────────────────────
    "hackernews": [
        ("Frontpage", "FRNT", "momentum", {},
         "A top HN story accumulates upvotes that compound. Frontpage rides the attention flywheel while the thread is hot.",
         2000),
        ("Decay", "DCAY", "contrarian", {},
         "Every HN story peaks and falls. A high-score story this tick will have fewer points next tick. Decay fades the hype.",
         2000),
        ("Flagged", "FLAG", "volatility_fade", {},
         "Controversial posts spike then get buried. Flagged bets on the moderation cycle that smooths every argument into silence.",
         1500),
        ("Show", "SHOW", "time_of_day", {},
         "HN submissions cluster in US morning hours. Show trades the predictable rhythm of a community that posts before standup.",
         1500),
    ],

    # ── ISS / SPACE STATION ─────────────────────────────────────────
    "iss": [
        ("Orbit", "ORBT", "momentum", {},
         "Orbital experiments run in sequences. High activity phases persist for days. Orbit rides the mission momentum.",
         2000),
        ("Reentry", "RENT", "mean_reversion", {},
         "Every active phase ends in a quiet phase. Reentry bets on the return to baseline between mission windows.",
         1500),
        ("Microgravity", "MGRV", "cluster", {},
         "ISS events cluster around crew schedules and supply missions. Microgravity bets on the clustering of orbital activity.",
         2000),
        ("Docking", "DOCK", "momentum_threshold", {"min_change_pct": 3.0},
         "Routine passes are noise. Docking only trades on significant orbital events, when activity spikes above 3%.",
         1500),
    ],

    # ── MILITARY AIRCRAFT ───────────────────────────────────────────
    "mil_aircraft": [
        ("Sortie", "SORT", "momentum", {},
         "Military flight activity comes in waves. Exercises ramp up over days. Sortie follows the operational tempo.",
         2000),
        ("Standdown", "STDN", "mean_reversion", {},
         "Every surge in military flights reverts to peacetime baseline. Standdown bets on the return to normal operations.",
         1500),
        ("Overwatch", "OVWT", "cluster", {},
         "Surveillance patterns cluster geographically. Activity in one sector predicts activity in adjacent sectors. Overwatch follows the pattern.",
         2000),
        ("Scramble", "SCRM", "momentum_threshold", {"min_change_pct": 5.0},
         "Routine patrols are noise. Scramble trades only when flight activity surges 5% or more, indicating real operational escalation.",
         1500),
    ],

    # ── NYC SUBWAY ──────────────────────────────────────────────────
    "mta_subway": [
        ("Metro", "MTRO", "time_of_day", {},
         "The subway runs on a clock older than most passengers. Metro trades the daily rhythm that eight million commuters enforce.",
         1500),
        ("Express", "XPRS", "momentum", {},
         "Service disruptions cascade through the system. Express follows the delay propagation that one broken signal creates.",
         2000),
        ("Transfer", "XFER", "mean_reversion", {},
         "Ridership always returns to baseline. Transfer bets that every surge or dip is temporary in a system this entrenched.",
         1500),
        ("Turnstile", "TRNS", "cluster", {},
         "Station activity clusters by neighborhood. A crowded platform at Union Square predicts crowding at Times Square within ticks.",
         2000),
    ],

    # ── OCEAN BUOYS ─────────────────────────────────────────────────
    "ndbc": [
        ("Swell", "SWEL", "momentum", {},
         "Ocean swells propagate across basins for days. A storm generates waves that persist tick-over-tick. Swell rides the propagation.",
         1500),
        ("Calm", "CALM", "mean_reversion", {},
         "Every storm passes. Wave heights return to seasonal norms. Calm bets on the ocean's long memory of equilibrium.",
         1500),
        ("Riptide", "RPTD", "cluster", {},
         "Buoy readings cluster by weather system. When one buoy spikes, nearby buoys follow within ticks. Riptide trades the spatial spread.",
         2000),
    ],

    # ── METEOROLOGICAL ──────────────────────────────────────────────
    "noaa_met": [
        ("Anomaly", "ANML", "momentum", {},
         "Weather anomalies persist. A warm front doesn't dissipate in one tick. Anomaly follows the meteorological deviation.",
         2000),
        ("Lull", "LULL", "mean_reversion", {},
         "Every weather extreme reverts to the seasonal mean. Lull bets on the atmosphere's relentless averaging.",
         1500),
        ("Barometer", "BARO", "momentum_threshold", {"min_change_pct": 2.0},
         "Small pressure changes are noise. Barometer acts only when readings shift by 2% or more, signaling a real system moving through.",
         1500),
    ],

    # ── TIDES ───────────────────────────────────────────────────────
    "noaa_tides": [
        ("Tideline", "TIDE", "mean_reversion", {},
         "Tides are the most predictable force on earth. Tideline bets on the reversion that gravity guarantees twice daily.",
         1000),
        ("Surge", "SRGE", "momentum", {},
         "Storm surges compound with wind and pressure. Surge rides the amplification that weather adds to the tidal cycle.",
         2000),
        ("Neap", "NEAP", "contrarian", {},
         "Spring tides always give way to neap tides. Neap fades every extreme, trusting the lunar cycle more than the weather.",
         1500),
    ],

    # ── RIVER FORECASTS ─────────────────────────────────────────────
    "nwps": [
        ("Flood", "FLOD", "momentum", {},
         "Rising rivers keep rising until the rain stops. Flood follows the hydrological momentum of water that has nowhere else to go.",
         2000),
        ("Snowbank", "SNBR", "cluster", {},
         "Meltwater events cluster in spring. One warm day triggers a cascade of gauge readings across a watershed. Snowbank trades the melt.",
         2000),
        ("Crest", "CRST", "mean_reversion", {},
         "Every flood crests and recedes. Crest bets on the return to baseflow, because gravity always wins eventually.",
         1500),
    ],

    # ── PARKING ─────────────────────────────────────────────────────
    "parking": [
        ("Valet", "VALT", "time_of_day", {},
         "Parking fills at 9am and empties at 6pm. Valet trades the most predictable urban cycle that exists.",
         1500),
        ("Garage", "GARG", "mean_reversion", {},
         "Full garages empty. Empty garages fill. Garage bets on the oscillation that every parking structure enforces by capacity alone.",
         1500),
        ("Meter", "METR", "momentum", {},
         "Event-driven parking surges compound. When a stadium fills, surrounding lots follow in sequence. Meter rides the spillover.",
         2000),
        ("Double Park", "DBLP", "cluster", {},
         "Parking scarcity cascades through blocks. One full garage sends drivers to the next. Double Park trades the spatial contagion of desperation.",
         2000),
    ],

    # ── PREDICTION MARKETS ──────────────────────────────────────────
    "polymarket": [
        ("Oracle", "ORCL", "momentum", {},
         "Prediction markets converge to truth as events approach. Oracle rides the odds direction. The crowd gets smarter near resolution.",
         2000),
        ("Longshot", "LONG", "contrarian", {},
         "Markets overprice favorites. Longshot systematically bets against extreme odds, exploiting the certainty premium.",
         2500),
        ("Consensus", "CNSN", "momentum_threshold", {"min_change_pct": 5.0},
         "Minor odds shifts are noise. Consensus only trades when probabilities move 5% or more, signaling genuine information arrival.",
         1500),
        ("Arbitrage", "ARBI", "mean_reversion", {},
         "Prediction market odds oscillate around true probability. Arbitrage bets on the convergence that new information forces.",
         2000),
    ],

    # ── MEDICAL RESEARCH ────────────────────────────────────────────
    "pubmed": [
        ("Preprint", "PRPT", "adoption_curve", {},
         "Medical papers follow citation S-curves. Early attention predicts lasting impact. Preprint rides the adoption wave of new research.",
         1500),
        ("Placebo", "PLBO", "contrarian", {},
         "Research hype always disappoints. Placebo fades the initial excitement around publications, because replication is harder than discovery.",
         2000),
        ("Peer", "PEER", "momentum", {},
         "Publication volume in a field signals growing interest. Peer follows the research momentum that funding creates.",
         1500),
        ("Trial", "TRIL", "regime", {},
         "Medical research operates in funding regimes. Trial detects the shift between discovery phases and consolidation periods.",
         2000),
    ],

    # ── MEMECOINS ───────────────────────────────────────────────────
    "pumpfun": [
        ("Degenerator", "DGEN", "momentum", {},
         "Memecoins spike then die, but the spike lasts several ticks. Degenerator rides the momentum while it persists.",
         2500),
        ("Rugpull", "RUGP", "contrarian", {},
         "Every pump.fun token crashes. Rugpull systematically fades every surge, betting on the gravitational constant of speculation.",
         2500),
        ("Diagnosis", "DGNS", "volatility_fade", {},
         "Memecoin volatility is the product, not the side effect. Diagnosis bets that extreme swings compress to something survivable.",
         2000),
        ("Bonding", "BNDG", "momentum_threshold", {"min_change_pct": 10.0},
         "Most memecoin price moves are noise. Bonding only trades when a token moves 10% or more, catching real bonding curve events.",
         2500),
    ],

    # ── THEME PARKS ─────────────────────────────────────────────────
    "queue_times": [
        ("Fastpass", "FAST", "contrarian", {},
         "Queue times peak then drop as guests redistribute. Fastpass fades the surge, trusting crowd dynamics to self-correct.",
         2000),
        ("Rush", "RUSH", "time_of_day", {},
         "Parks follow a predictable daily curve. Rush trades the midday peak and evening decline that every family enforces.",
         1500),
        ("Cluster", "CLST", "cluster", {},
         "Popular rides create spillover queues at nearby attractions. Cluster bets on the spatial correlation of impatience.",
         2000),
    ],

    # ── INTEREST RATES ──────────────────────────────────────────────
    "rates": [
        ("Hawkish", "HAWK", "momentum", {"min_change_pct": 0.5},
         "Central banks move in cycles. A rate shift this tick predicts another. Hawkish rides the policy direction until the rhetoric turns.",
         2000),
        ("Dovish", "DOVE", "contrarian", {},
         "Rate expectations overshoot after every meeting. Dovish fades the market's overreaction to every basis point.",
         2000),
        ("Tighten", "TITE", "regime", {},
         "Monetary policy operates in regimes. Tighten detects the shift between easing and tightening cycles and positions accordingly.",
         1500),
        ("Basis", "BASS", "momentum_threshold", {"min_change_pct": 0.25},
         "Quarter-point moves are the minimum signal in rates markets. Basis filters noise below 25bps, trading only deliberate policy shifts.",
         1500),
    ],

    # ── SEC 13F FILINGS ─────────────────────────────────────────────
    "sec_13f": [
        ("Deadline", "DDLN", "momentum", {},
         "SEC filings cluster around quarterly deadlines. Filing volume builds tick-over-tick during disclosure windows. Deadline rides the surge.",
         1500),
        ("Disclosure", "DSCL", "contrarian", {},
         "Markets overreact to every 13F drop. Disclosure fades the initial move, because institutional positions are already priced in.",
         2000),
        ("Insider", "INSD", "momentum_threshold", {"min_change_pct": 3.0},
         "Minor filing volume changes are administrative. Insider only trades when activity surges 3% or more, signaling real institutional movement.",
         1500),
        ("Holdings", "HLDG", "regime", {},
         "Institutional allocation operates in risk-on and risk-off regimes. Holdings detects the shift from 13F filing patterns.",
         2000),
    ],

    # ── SPACE WEATHER ───────────────────────────────────────────────
    "spaceweather": [
        ("Aurora", "AURA", "momentum", {},
         "Solar storms come in bursts. A high Kp index this tick means elevated activity next tick. Aurora bets on solar persistence.",
         1500),
        ("Solstice", "SLST", "mean_reversion", {},
         "The sun operates on an 11-year cycle. Solstice bets on reversion to the solar mean after every coronal tantrum.",
         1500),
        ("Sunspot", "SNSP", "cluster", {},
         "Solar flares cluster temporally. One CME predicts another within the same active region. Sunspot trades the storm sequence.",
         2000),
        ("Corona", "CRNA", "regime", {},
         "The sun operates in 11-year activity cycles. Corona detects the regime shift between solar minimum and maximum.",
         1500),
    ],

    # ── SPORTS ──────────────────────────────────────────────────────
    "sports": [
        ("Homecourt", "HOME", "home_field", {},
         "Home teams win 55-60% across all sports. Homecourt applies a systematic home-team bias. Simple, persistent, profitable at scale.",
         1000),
        ("Streak", "STRK", "momentum", {},
         "Winning teams keep winning within a season. Streak rides hot form because confidence compounds in sports.",
         2000),
        ("Upset", "UPST", "contrarian", {},
         "Favorites are overpriced by the public. Upset systematically backs underdogs, exploiting the certainty premium in every market.",
         2500),
        ("Overtime", "OVTM", "volatility_fade", {},
         "Close games are unpredictable, blowouts are settled. Overtime fades the volatility of tight spreads back to the expected margin.",
         2000),
    ],

    # ── GAMING ──────────────────────────────────────────────────────
    "steam": [
        ("Weekend", "WKND", "bullish", {},
         "Gamers play. Steam concurrent players trend up more often than down. Weekend applies a structural long bias to gaming activity.",
         1500),
        ("Lobby", "LOBY", "time_of_day", {},
         "Peak gaming hours are 7pm-11pm in every timezone. Lobby trades the daily rhythm of screen addiction.",
         1500),
        ("Ragequit", "RAGE", "contrarian", {},
         "Player count spikes on launch day then crater. Ragequit fades the hype, betting on the inevitable population decay.",
         2000),
        ("Patch", "PTCH", "cluster", {},
         "Game updates cluster player activity. A major patch draws lapsed players back in waves. Patch trades the update cycle.",
         1500),
    ],

    # ── LIVE STREAMING ──────────────────────────────────────────────
    "twitch": [
        ("Prime Time", "PRME", "momentum", {},
         "Viewership begets viewership. When a streamer is hot, more viewers pile in tick-over-tick. Prime Time rides the surge.",
         2000),
        ("Offline", "OFLN", "contrarian", {},
         "Every stream ends. The audience disperses. Offline fades the viewership peak, trusting the reversion that sleep enforces.",
         2000),
        ("Subscribe", "SUBR", "adoption_curve", {},
         "Channel growth follows S-curves. Subscribe rides the adoption phase where each new viewer brings two more.",
         1500),
        ("Host", "HOST", "cluster", {},
         "Twitch raids cascade viewers between channels. One ending stream floods the next. Host trades the attention spillover.",
         2000),
    ],

    # ── GOVERNMENT SPENDING ─────────────────────────────────────────
    "usa_spending": [
        ("Stimulus", "STIM", "momentum", {},
         "Federal spending comes in waves. When agencies start disbursing, the pipeline flows for many ticks. Stimulus follows the money.",
         2000),
        ("Sequester", "SQST", "contrarian", {},
         "Every spending surge triggers austerity. Sequester fades the fiscal impulse, betting on the political pendulum.",
         2000),
        ("Deficit", "DFCT", "regime", {},
         "Government spending operates in fiscal regimes. Deficit detects the shift between expansion and contraction and positions accordingly.",
         1500),
        ("Earmark", "EMRK", "cluster", {},
         "Federal disbursements cluster around fiscal year end. Earmark trades the spending rush that deadlines create.",
         2000),
    ],

    # ── RIVER GAUGES ────────────────────────────────────────────────
    "usgs_water": [
        ("Torrent", "TRNT", "momentum", {},
         "Rising rivers keep rising until the watershed drains. Torrent follows the hydrological lag that makes floods predictable.",
         2000),
        ("Drought", "DRHT", "mean_reversion", {},
         "Every dry spell ends. Rain returns. Drought bets on the reversion that the water cycle guarantees on geological timescales.",
         1500),
        ("Watershed", "WSHD", "cluster", {},
         "Gauge readings cluster by basin. Upstream rain predicts downstream flow with a delay measured in ticks. Watershed trades the propagation.",
         2000),
        ("Baseflow", "BSFL", "regime", {},
         "Rivers operate in wet and dry regimes. Baseflow detects the hydrological shift between seasons and positions for the transition.",
         1500),
    ],

    # ── WEATHER ─────────────────────────────────────────────────────
    "weather": [
        ("Weatherfront", "WFRT", "momentum", {},
         "Weather systems move slowly. Today's temperature predicts tomorrow's. Weatherfront rides the persistence of atmospheric masses.",
         1500),
        ("Revert", "RVRT", "mean_reversion", {},
         "Temperature always returns to the seasonal mean. Every heatwave ends, every cold snap breaks. Revert bets on the return.",
         1500),
        ("Seasonal", "SSNL", "regime", {},
         "Weather operates in seasonal regimes. Seasonal detects the shift between warm and cold patterns and positions for the transition.",
         1500),
        ("Heatwave", "HEAT", "momentum_threshold", {"min_change_pct": 3.0},
         "Minor temperature fluctuations are noise. Heatwave only trades when readings shift by 3% or more, catching real system changes.",
         2000),
    ],

    # ── WEATHER ALERTS ──────────────────────────────────────────────
    "weather_alerts": [
        ("Stormwatch", "STRM", "cluster", {},
         "Severe weather alerts cluster temporally. One tornado warning predicts more in the same system. Stormwatch trades the outbreak.",
         2000),
        ("All Clear", "ACLR", "contrarian", {},
         "Every storm passes. Alert counts revert to zero. All Clear fades the panic, trusting the atmosphere to exhaust itself.",
         1500),
        ("Tornado", "TNDO", "momentum", {},
         "Severe weather events escalate before they resolve. Tornado follows the alert momentum within an active weather system.",
         2000),
        ("Bunker", "BNKR", "regime", {},
         "Weather alerts operate in calm and active regimes. Bunker detects the shift between quiet periods and outbreak seasons.",
         1500),
    ],

    # ── WILDFIRE ────────────────────────────────────────────────────
    "wildfire": [
        ("Ember", "EMBR", "momentum", {},
         "Fire season is fire season. Once hotspots appear, Ember bets they grow. Fires don't extinguish themselves between ticks.",
         2000),
        ("Contained", "CNTD", "contrarian", {},
         "Every fire gets contained eventually. Contained bets on the suppression effort that follows every major ignition.",
         2000),
        ("Tinder", "TNDR", "cluster", {},
         "Wildfires cluster geographically and temporally. Dry conditions ignite multiple fires in sequence. Tinder trades the fire weather pattern.",
         2000),
        ("Firebreak", "FBRK", "mean_reversion", {},
         "Every fire season ends. Moisture returns, fuels deplete, seasons turn. Firebreak bets on the suppression that nature and humans enforce together.",
         1500),
    ],

    # ── DEVELOPMENT ─────────────────────────────────────────────────
    "worldbank": [
        ("Glacier", "GLCR", "momentum", {"min_change_pct": 1.0},
         "Development indicators move at geological speed. Glacier only bets when something actually changes, which is rare but persistent.",
         2000),
        ("Convergence", "CNVG", "contrarian", {},
         "Nations overshoot their growth rates and revert. Convergence bets on mean reversion in the long arc of development.",
         2000),
        ("Emergence", "EMRG", "adoption_curve", {},
         "Emerging markets follow adoption S-curves. Emergence rides the growth phase of economies that are just beginning to industrialize.",
         1500),
        ("Stagnation", "STGN", "regime", {},
         "Development indicators operate in growth and stagnation regimes. Stagnation detects the shift and positions for the new phase.",
         2000),
    ],

    # ── REAL ESTATE ─────────────────────────────────────────────────
    "zillow": [
        ("Foundation", "FNDM", "momentum", {},
         "Housing prices trend for months. Foundation follows the direction because real estate turns slower than any other market.",
         2000),
        ("Overshoot", "OVSH", "contrarian", {},
         "Every housing boom corrects. Overshoot fades the frenzy, because affordability is a constraint that fantasy cannot override forever.",
         2500),
        ("Shelter", "SHLT", "bullish", {},
         "Housing appreciates over time. Population grows, land doesn't. Shelter leans long on the most basic scarcity there is.",
         1000),
        ("Appraisal", "APSL", "regime", {},
         "Housing markets operate in boom and bust regimes. Appraisal detects the shift between appreciation and correction phases.",
         2000),
    ],
}


def validate_catalog():
    """Check uniqueness of names and symbols across entire catalog."""
    all_names = []
    all_symbols = []
    source_counts = {}

    for source, funds in CATALOG.items():
        source_counts[source] = len(funds)
        for name, symbol, strategy, params, tagline, fee in funds:
            all_names.append((name, source))
            all_symbols.append((symbol, source))

    # Check name uniqueness
    name_set = {}
    for name, source in all_names:
        if name in name_set:
            raise ValueError(f"Duplicate name '{name}' in {source} and {name_set[name]}")
        name_set[name] = source

    # Check symbol uniqueness
    sym_set = {}
    for sym, source in all_symbols:
        if sym in sym_set:
            raise ValueError(f"Duplicate symbol '{sym}' in {source} and {sym_set[sym]}")
        sym_set[sym] = source

    # Check source counts
    for source, count in source_counts.items():
        if count < 3 or count > 5:
            raise ValueError(f"Source '{source}' has {count} funds (need 3-5)")

    # Check symbol lengths
    for sym, source in all_symbols:
        if len(sym) < 3 or len(sym) > 5:
            raise ValueError(f"Symbol '{sym}' in {source} has length {len(sym)} (need 3-5)")

    total = sum(source_counts.values())
    print(f"Validation passed: {len(source_counts)} sources, {total} funds")
    return total


def generate_branding_json(output_path):
    """Generate fund-branding.json."""
    funds = []
    for source, fund_list in CATALOG.items():
        color = SOURCE_COLORS.get(source, "#1B1B1B")
        category = SOURCE_CATEGORIES.get(source, "Other")
        for name, symbol, strategy, params, tagline, fee in fund_list:
            fund = {
                "name": name,
                "symbol": symbol,
                "source": source,
                "strategy": strategy,
                "params": params,
                "tagline": tagline,
                "color": color,
                "fee": fee,
                "category": category,
                "vault": ""
            }
            funds.append(fund)

    data = {"funds": funds}
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"Wrote {len(funds)} funds to {output_path}")


def generate_funds_toml(output_path):
    """Generate funds.toml with [manager] header and [[funds]] entries."""
    lines = []

    # Manager header
    lines.append("[manager]")
    lines.append('private_key_env = "FUND_MANAGER_KEY"')
    lines.append('rpc_url = "http://142.132.164.24/"')
    lines.append('factory = "0xbc418956A20DB5C343b56b6AE947AF4896b23A1e"')
    lines.append('vision_address = "0x821D7c212344dd4E5EB837B01B0FFfE3BcAc1649"')
    lines.append('usdc_address = "0x2710e49EBb807A0cB9369F13Ba24Bd809809a827"')
    lines.append('oracle_registry_address = "0x2F12F19a111cc25b114C2bcc535519854fcf83c7"')
    lines.append('vision_api = "http://142.132.164.24:10001"')
    lines.append('data_node = "http://142.132.164.24:8200"')
    lines.append("poll_interval = 30")
    lines.append("deposit_per_batch = 10.0")
    lines.append("stake_per_tick = 10.0")
    lines.append('oracle_discovery = "static"')
    lines.append('oracle_urls = ["http://142.132.164.24:10001", "http://142.132.164.24:10002", "http://142.132.164.24:10003"]')
    lines.append("")

    fund_num = 0
    for source, fund_list in CATALOG.items():
        category = SOURCE_CATEGORIES.get(source, "Other")
        lines.append(f"# ── {category.upper()} / {source} ──")
        lines.append("")

        for name, symbol, strategy, params, tagline, fee in fund_list:
            fund_num += 1
            lines.append(f"# {fund_num}. {name} — {source} {strategy}")
            lines.append("[[funds]]")
            lines.append(f'name = "{name}"')
            lines.append(f'symbol = "{symbol}"')
            lines.append(f'vault = ""')
            lines.append(f'sources = ["{source}"]')
            lines.append(f'strategy = "{strategy}"')
            lines.append("[funds.params]")
            for k, v in params.items():
                if isinstance(v, float):
                    lines.append(f"{k} = {v}")
                else:
                    lines.append(f"{k} = {v}")
            lines.append("")

    with open(output_path, 'w') as f:
        f.write('\n'.join(lines))
    print(f"Wrote {fund_num} fund entries to {output_path}")


if __name__ == "__main__":
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    branding_path = os.path.join(base, "frontend", "data", "fund-branding.json")
    toml_path = os.path.join(base, "vision-bot", "funds.toml")

    total = validate_catalog()
    generate_branding_json(branding_path)
    generate_funds_toml(toml_path)
    print(f"\nDone. {total} funds across {len(CATALOG)} sources.")
