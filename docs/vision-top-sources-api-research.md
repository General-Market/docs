# Vision — Top "Skin in the Experience" Sources: API Feasibility

## The Winning Formula

DB Trains works because the bettor **IS** the commuter. The best sources share:
- You physically experience the data (body, wallet, time)
- Data updates frequently enough for real markets
- Free API exists with sufficient rate limits
- Enough distinct markets (stations, lines, cities) to create variety

---

## TIER 1 — Build These (Free, Real-time, High Skin, High Market Count)

### 1. London Underground Delays
| Field | Detail |
|---|---|
| API | TfL Unified API — `api.tfl.gov.uk` |
| Auth | Free key (register at api-portal.tfl.gov.uk) |
| Rate limit | 500 req/min (free tier) |
| 10-min poll? | Yes — 1 call returns ALL lines |
| Markets | **~15** (11 Tube lines + Elizabeth + DLR + Overground) |
| Freshness | Real-time |
| Cost | Free |

### 2. NYC Subway Delays
| Field | Detail |
|---|---|
| API | MTA GTFS-RT — `api-endpoint.mta.info` |
| Auth | **None required** |
| Rate limit | No published limit |
| 10-min poll? | Yes — feeds update every 30-60s |
| Markets | **~28** service lines across 9 feed URLs |
| Freshness | 30-60 seconds |
| Cost | Free |
| Gotcha | Protobuf format, need NYCT custom .proto files |

### 3. Paris Metro Delays
| Field | Detail |
|---|---|
| API | PRIM / Île-de-France Mobilités — `prim.iledefrance-mobilites.fr` |
| Auth | Free account + bearer token |
| Rate limit | Generous (platform handles 230M+ queries/month) |
| 10-min poll? | Yes |
| Markets | **~21** (16 Metro lines + 5 RER lines) |
| Freshness | Real-time |
| Cost | Free |

### 4. Tokyo Train Delays
| Field | Detail |
|---|---|
| API | ODPT — `api.odpt.org` |
| Auth | Free consumer key (register at developer.odpt.org) |
| Rate limit | No hard cap published |
| 10-min poll? | Yes |
| Markets | **~28** (Tokyo Metro 9 + JR East ~15 + Toei 4) |
| Freshness | Real-time (15-30 min delay threshold) |
| Cost | Free |
| Gotcha | Registration in Japanese, 1-2 business day approval |

### 5. Power Outages (US)
| Field | Detail |
|---|---|
| API | ORNL ODIN — `openenergyhub.ornl.gov` (OpenDataSoft) |
| Auth | Free app token recommended |
| Rate limit | Effectively unlimited at reasonable rates |
| 10-min poll? | Yes — data refreshes every 15-30 min |
| Markets | **~50** (state-level) or ~3,000 (county-level) |
| Freshness | 15-30 min |
| Cost | Free |

### 6. Internet/Cell Outages
| Field | Detail |
|---|---|
| API | IODA — `api.ioda.inetintel.cc.gatech.edu/v2/` |
| Auth | **None required** |
| Rate limit | No published limit (academic, stay under ~60 req/min) |
| 10-min poll? | Yes |
| Markets | **200+** countries + individual ISPs (ASNs) |
| Freshness | 5-15 min |
| Cost | Free |

### 7. Diwali / India AQI
| Field | Detail |
|---|---|
| API | AQICN — `api.waqi.info` |
| Auth | Free token (instant, no approval) |
| Rate limit | **1,000 req/second** (!!) |
| 10-min poll? | Yes — data updates hourly |
| Markets | **500+** India stations, 11,000+ globally |
| Freshness | 1 hour |
| Cost | Free |
| Gotcha | TOS prohibits commercial use without agreement — check |

---

## TIER 2 — Build These (Free, but lower frequency or minor cost)

### 8. Mortgage Rates (FRED)
| Field | Detail |
|---|---|
| API | FRED — `fred.stlouisfed.org` |
| Auth | Free key (1-min registration) |
| Rate limit | 120 req/min, no daily cap |
| Markets | **3-5** (30yr, 15yr, 5/1 ARM, Optimal Blue daily) |
| Freshness | Daily (Optimal Blue) or Weekly (Freddie Mac) |
| Cost | Free |

### 9. South Africa Load-Shedding
| Field | Detail |
|---|---|
| API | EskomSePush — `developer.sepush.co.za` |
| Auth | Free token via Gumroad |
| Rate limit | 50 calls/day free (25 effective, each call = 2 API calls) |
| 10-min poll? | No — poll every 30min (48 calls/day) to stay free |
| Markets | **1-3** (national stage, Cape Town, Joburg) |
| Freshness | Real-time |
| Cost | Free at 30min intervals |

### 10. SF Auto Break-Ins
| Field | Detail |
|---|---|
| API | DataSF Socrata — `data.sfgov.org/resource/wg3w-h783.json` |
| Auth | Free Socrata app token |
| Rate limit | Unlimited with token |
| Markets | **10** SFPD districts |
| Freshness | Daily (24-48h lag) |
| Cost | Free |

### 11. Concert Ticket Resale Markup
| Field | Detail |
|---|---|
| API | SeatGeek (resale) + Ticketmaster (face value) |
| Auth | Free keys from both |
| Rate limit | SeatGeek ~1,000/day, Ticketmaster 5,000/day |
| Markets | **100+** events (pairing face value with resale) |
| Freshness | Near real-time |
| Cost | Free |
| Gotcha | TOS restrictions on commercial use for both |

### 12. Pollen Counts
| Field | Detail |
|---|---|
| API | Ambee (via RapidAPI) |
| Auth | API key |
| Rate limit | 100 req/day free |
| Markets | **50+** US cities × 3 pollen types |
| Freshness | Daily (pollen is inherently daily) |
| Cost | Free if polled once/day (which matches data freshness) |

### 13. USCIS Immigration Processing Times
| Field | Detail |
|---|---|
| API | Unofficial JSON — `egov.uscis.gov/processing-times/api/processingtime/{FORM}/{OFFICE}` |
| Auth | None |
| Rate limit | Not published |
| Markets | **~50** (top 10 forms × 5 offices) |
| Freshness | Weekly/bi-weekly |
| Cost | Free |
| Gotcha | Unofficial endpoint, could break |

### 14. Bangladesh Flood Stage
| Field | Detail |
|---|---|
| API | FFWC — `ffwc.bwdb.gov.bd` or GloFAS (Copernicus) |
| Auth | None |
| Rate limit | Not published |
| Markets | **~10** critical gauge stations |
| Freshness | 1-3 hours (seasonal) |
| Cost | Free |
| Gotcha | Unreliable uptime, HTTP only, expired TLS cert |

---

## TIER 3 — Dead Ends (No viable free API)

| Source | Why it's dead |
|---|---|
| Uber Surge Pricing | API deprecated, actively blocks scraping |
| India Power Cuts | 50+ separate state utilities, no unified API |
| Nigeria Grid | No public API, PDFs only |
| Amtrak Delays | No official API, unofficial is encrypted + TOS violation |
| DMV Wait Times | No state has a public API |
| Pharmacy Wait Times | No API exists anywhere |
| Daycare Waitlist | Data doesn't exist publicly |
| IRS Refund Speed | No aggregate API, individual SSN required |
| USPS Delivery Accuracy | No aggregate performance API |
| Rent Prices (real-time) | Free tier = 50 calls/month (testing only) |
| Kenya M-Pesa Volume | Monthly PDFs, no API |
| China Chunyun | State media press releases, no API |

---

## Market Count Summary

| Source | Markets | Frequency | Free? |
|---|---|---|---|
| London Underground | 15 | Real-time | Yes |
| NYC Subway | 28 | Real-time | Yes |
| Paris Metro | 21 | Real-time | Yes |
| Tokyo Trains | 28 | Real-time | Yes |
| US Power Outages | 50 | 15-30 min | Yes |
| Internet Outages (IODA) | 200+ | 5-15 min | Yes |
| India/Global AQI | 500+ | 1 hour | Yes* |
| Mortgage Rates | 5 | Daily | Yes |
| SA Load-Shedding | 3 | Real-time | Yes (30min) |
| SF Break-Ins | 10 | Daily | Yes |
| Ticket Markup | 100+ | Real-time | Yes* |
| Pollen | 50+ | Daily | Yes |
| Immigration Times | 50 | Weekly | Yes |
| Bangladesh Floods | 10 | 1-3 hours | Yes |
| **TOTAL** | **~1,070+** | | |

*TOS review needed for commercial use

---

## Recommended Build Order

1. **London Underground** — Exact same product as DB Trains, 15 markets, free, real-time, massive commuter base
2. **NYC Subway** — 28 lines, no API key needed, 8.3M daily riders
3. **Paris Metro** — 21 lines, free, 4.5M daily riders
4. **Tokyo Trains** — 28 lines, free, 8.6M daily riders on Tokyo Metro alone
5. **US Power Outages** — 50 state markets, everyone experiences this
6. **Internet Outages** — 200+ markets, universal experience
7. **AQI (India focus)** — 500+ stations, Diwali is a cultural event market
8. **Pollen** — seasonal but intense, 50+ cities
