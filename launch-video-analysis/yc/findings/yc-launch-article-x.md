# We Dissected 2,696 Product Launch Posts. The Data Is Without Pity.

*What 1,004 video transcripts, 2,696 body texts, and a vote range of 0 to 3,068 confess about the anatomy of a launch that resonates — and the far more common anatomy of one that dissolves into the feed.*

---

Every week, founders publish a launch post. They record a video. They compose a tagline. They ask the internet to care.

We scraped all 2,696 of them. Every word, every vote, every emoji. Then we ran 56 analyses across 110 dimensions — linguistic, structural, temporal, industrial — to separate the posts the crowd remembers from the posts the crowd walks past without pausing.

The findings betray every playbook.

---

## I. The video is a lie

The most persistent orthodoxy in startup launches: record a demo. Show the product in motion. Let them see it breathe.

The data is unmoved.

No-video launches outperform video launches at **every percentile** — p25, p50, p75, p90, p95. The gap is modest but relentless:

| Percentile | Video | No-Video |
|---|---|---|
| p50 (median) | 34 | **38** |
| p75 | 74 | **79** |
| p90 | 154 | **166** |
| p95 | 262 | **296** |

The 2x2 is more damning still:

| | Long body text | Short body text |
|---|---|---|
| **Video** | median 37 | median 31 |
| **No video** | **median 44** | median 33 |

The best-performing cohort wrote well and skipped the camera. The worst recorded a demo and wrote nothing.

Video adoption surged past 85% after late 2024. It is now nearly universal. And universality is the precise moment a signal stops signaling anything. Video is table stakes. The text is the product.

When the video exists, it should be **under 60 seconds** — 100 to 150 words at speaking pace. Median peaks in this bucket (37), then declines monotonically. Past 200 words, the audience has already left. Past 1,000 words: median 23. The law is clear: under a minute or over a minute — the market has already decided.

Video transcript length itself shows zero correlation with votes (r = −0.014). The content of the pitch matters; the duration of its record does not.

---

## II. The first sentence is the whole game

We classified every video opener into categories. The hierarchy is unambiguous.

| Category | n | Median |
|---|---|---|
| Demo instruction | 33 | **48** |
| Product statement | 46 | **47.5** |
| Question | 55 | 42 |
| Founder story | 10 | 63 |
| Pain point | 99 | 34 |
| Stat / number | 144 | 31.5 |
| **Greeting ("Hi, I'm X")** | **110** | **26.5** |

"Hi, I'm Sarah from Acme" — the most common opener — is the most reliable path to mediocrity. The best opening sentence in the dataset (3,068 votes): *"I never want to talk to tenants again."*

No pitch. No product name. No context. Just a human at the end of their patience. The audience performs the rest.

**First-person openers** ("I" or "We" as first word) carry median 41, versus 34 for third-person. The word "I" as the first word of a transcript carries median **101**. "Your" carries 82. "How" carries 80. "Hi" carries 34. "Today" carries 19. "So" carries 19.

Start with the person, not the product.

**Sentence length matters.** Short openers (≤10 words): average 98. Long openers (>10 words): average 70. Brevity does not guarantee performance, but it correlates with the ceiling being higher.

**Negative words** in openers are not created equal. "Broken" averages 126 votes. "Tired" averages 97. "Hate" averages 94. "Problem" — the most-used negative word — averages 57. "Problem" has been laundered into noise by overuse. The specific wound outperforms the generic diagnosis.

**Name-dropping a brand** (Google, Stripe, etc.) in the first sentence produces no lift. Median is nearly identical. The technique may anchor the listener on someone else's product rather than yours.

**Time-to-product-mention:** mentioning the product name in the **first 10 words** correlates with the highest median (40). After that, performance drops. Most transcripts (577 of 1,004) never mention the company name at all.

---

## III. Three formatting decisions that cost nothing

**1. One emoji in the title.** Median 46 with emoji, 33 without. A +36% lift for a pictograph. One emoji is optimal. Two is tolerable. Three collapses the effect. The emoji is not decoration — it is a visual anchor in a wall of text titles.

**2. Dash over colon.** "Company - Description" produces median 41. "Company: Description" produces 33. An eight-point spread for a punctuation mark. The colon has the faint odor of a press release. The dash breathes.

**3. No numbers in titles.** Numbers in titles correlate with median 28 — worse than baseline (36). The number in the title says "advertisement." The number in the body says "proof." Location determines meaning. Similarly, colons in titles correlate with ~18% lower median votes.

These three features, combined with social proof and a short title (<50 chars), produce the single best combination in the dataset: **4.1x average votes** versus baseline. Only 37 of 2,696 launches hit all three. They outperformed 96% of the corpus.

**Title word count sweet spot:** 6–9 words, 46–75 characters. Ultra-short titles (1–3 words) perform worst on every measure. Very long titles (91+ chars) similarly collapse.

**Benefit-first titles** — those starting with a verb ("Automate", "Reduce", "Build") — show median 80, more than double the company-name-first median of 37. But only 9 launches used this structure — the signal is directional, not conclusive. The direction is clear: starting with what you do for the reader, not who you are.

---

## IV. The tagline: one sentence, one wound

**Length:** 71–100 characters is the sweet spot (median 39). Shorter (≤50 chars) and longer (101+) both underperform.

**Sentiment:** the counterintuitive finding. Problem-focused taglines (median **39**) outperform positive (35) and neutral (36). Naming a pain is more compelling than promising relief. The wound sells better than the bandage.

**Sentence count:** the steepest cliff in the dataset.

| Sentences | n | Median |
|---|---|---|
| 1 | 1,207 | **38** |
| 2 | 165 | 34 |
| **3+** | **30** | **22** |

Three sentences collapses to median 22 — nearly half the baseline. The second sentence is explanation the reader didn't request. The third is where they leave.

The successful multi-sentence taglines use the second sentence as a knife — a punchline, a contrast, a number. *"AI that converts clinical documentation into payments. In seconds."* (2,459 votes). The failed ones restate the first: *"Don't know why your agent messed up? Neither do we. But Mohi will show you exactly where..."* (4 votes). The reader's attention was borrowed and nothing was deposited.

**"AI" in tagline:** median 34 vs 36 without. The word depresses performance. Saturation punishes conformity.

**"X for Y" targeting** ("Stripe for healthcare"): median 34, slightly below baseline. Targeting narrows perceived audience. What reads as precision to the founder reads as exclusion to the crowd.

**Title-tagline word overlap:** high redundancy (>50% shared words) produces the lowest median (32). Low overlap — where the tagline adds new information — performs best (36). Say it once, not twice.

---

## V. Two metrics. Front-loaded. That's it.

The relationship between metric count and votes is not linear. It is a cliff.

| Metrics mentioned | Median |
|---|---|
| 0 | 32 |
| 1 | 38 |
| **2** | **41** |
| 3 | 39 |
| 4+ | 32.5 |

Two metrics saturate the benefit. The third adds nothing. The fourth destroys value — the post becomes a pitch deck slide, and pitch deck slides do not inspire engagement.

**Placement matters more than content.** Metrics in the **first 25%** of the body average 108 votes. Metrics in the **last 25%** average 62. Burying proof at the bottom performs no better than having no proof at all.

**Phrasing matters.** "Cut X by Y%" — used by only 10 launches — averages **308 votes**. "Reduced X by Y%" averages 224. "Saves X hours" averages 133. "From X to Y" averages 104. The rarer and more surgical the claim, the heavier it lands. Everybody says "from X to Y." Nobody says "cut operating costs by 73%." The second sentence costs something. That is why it works.

**Specificity is the clearest language signal in the entire dataset.** Posts with 8+ specific numbers average 43% more votes than posts with 0–1. This is the only language variable with a consistent, monotonic, quartile-spanning relationship to engagement.

**Specific vs round numbers:** specific ($1.2M, 127 customers) slightly outperform round ($1M, 100 customers) in average, but the medians are near-identical. The act of citing any number matters more than its precision.

**Time-framed metrics** ("in 3 months", "year over year") produce the same median as plain metrics but a much higher average (119 vs 85). The effect is concentrated in the top performers — time-framing helps the best launches go viral without changing the median floor.

**Distinct factual claims:** the jump from zero to 1–2 claims adds +10 median. Each additional bucket raises the floor. But diminishing returns set in above 3.

---

## VI. The body: what to say, how to format it

### Length

| Words | Median |
|---|---|
| 0–100 | 17 |
| 300–400 | 37 |
| 400–500 | 40 |
| **500–750** | **45** |
| 750–1000 | 27 |

The curve rises to 500–750 words, then collapses. Beyond 750, the post becomes an essay, and essays are skipped. In formatted characters: 3,000–5,000 is the sweet spot (median 42–45).

### Structure

**18–20 paragraphs** is optimal (median 43). Fewer than 10 collapses to 22. The optimal paragraph is 2 sentences — one setup, one payoff. Wall-of-text paragraphs (>4 sentences each): median **20**. Ultra-fragmented posts (≤1.5 sentences per paragraph): median 33 — too choppy, no flow.

**Whitespace:** moderate airiness (Q3) peaks at median 38. Dense posts (Q1): 32. Maximum airiness (Q4): 37. The reader needs breathing room, but not a vacuum.

**List-to-prose ratio:** 1–20% bullet lines is the sweet spot (median 39). No lists: 34. Above 50% lists: 30 — the post becomes a spec sheet and loses the narrative thread.

### Formatting features that help

| Feature | Median Lift |
|---|---|
| Emojis in body | **+10** |
| Bold text | **+10** |
| Headers | **+9** |
| TL;DR section | **+7** |
| Bullets | **+5** |

### Formatting features that hurt

| Feature | Median Lift |
|---|---|
| Code snippets | −6 |
| 3+ outbound links | −10 |
| Explicit "Our Ask" section | −1 median / −25 mean |

Signals that reduce cognitive load correlate with votes. Signals that evoke technical docs or sales decks do not.

**Images:** 88.6% of launches include them. Those without are severely penalized (median 23 vs 38). 2–3 images is optimal. The gain from 1 to 2–3 is real; beyond 4, it flattens.

---

## VII. Social proof: what works, what backfires

### Brand drops

Any major brand mentioned: median 39. No brand: 32. Best brands to reference: Microsoft (median 52), Stripe (50), Airbnb (46). **OpenAI mentions underperform baseline** — the AI wave has compressed vote distribution for AI-adjacent companies.

### Credentials

| Signal | Avg Votes |
|---|---|
| ex-Microsoft | **315** |
| ex-Google | **194** |
| MIT | **138** |
| Stanford | 91 |
| PhD (alone) | 81 |
| ex-Meta | 44 |

MIT dramatically outperforms Stanford. PhD alone is below baseline — the credential without the institutional name carries nothing. The credential that works is not the degree. It is the previous employer.

### Investor language

"Raised" is the only funding word with positive lift (avg 137). "Funded" (80), "backed by" (68), "investors" (68) — all backfire. Signaling that you have investors does not help. Saying you *raised* — implying scale, momentum — does.

### Customer quotes

**No lift.** Testimonials do not move votes. The audience trusts the founder's narrative over a curated endorsement.

### Domain expertise

| | n | Median |
|---|---|---|
| Domain expertise signal | 714 | **44** |
| No signal | 1,982 | 34 |

+10 lift. Phrases like "10 years in healthcare", "built X at Google" — domain expertise is the credibility signal that actually works. Unlike credentials (PhD, Stanford), expertise speaks to the problem, not the person.

### Technical founder signal

| | n | Median |
|---|---|---|
| Technical signal present | 1,724 | **39** |
| No technical signal | 972 | 31 |

+8 lift. The audience rewards builders. "Engineer", "CTO", "built from scratch", "open source" — the absence of any technical signal is a penalty.

---

## VIII. Calls to action: scarcity wins, generosity loses

### CTA types

| CTA | Median Lift |
|---|---|
| **waitlist** | **+24** |
| join | +7 |
| sign up | +5 |
| email us | +4 |
| book a demo | 0 |
| try | **−5** |
| get started | **−6** |

Waitlist is scarcity. Scarcity works. "Try" and "get started" — the most generic CTAs — correlate with *lower* votes. Having **no detectable CTA at all** (median 37) outperforms generic CTAs (32). The audience is not a sales funnel. They came to evaluate, not to convert. Letting the product speak is the strongest move.

### Urgency words near CTAs

| Word | Lift |
|---|---|
| **beta** | **+13.5** |
| **limited** | **+13.0** |
| free | **−7.0** |

"Beta" and "limited" are the only urgency words with positive signal. "Free" near a CTA actively hurts.

### Discount language — all negative

| Pattern | Median Lift |
|---|---|
| % off | −8 |
| free trial | −10.5 |
| no credit card | −12.5 |
| lifetime deal | −13 |

The posts that perform worst are the ones that have clearly read a growth-hacking checklist and ticked every box. The crowd wants to be chosen, not given access.

### Contact info

Including founder email: median 39 vs 31 without. Email + phone together (rare): median **50.5**. Accessibility signals commitment. The founders who want to be found are the ones the crowd trusts.

### CTA specificity

Specific CTAs ("send your first invoice in 2 minutes") perform worse (34) than no CTA at all (37). Generic CTAs ("try it out", "learn more") are worst (32). The act of asking — however specifically — reads as selling. The best launch posts don't ask. They show.

---

## IX. Competitive framing: alternatives beat superiority

### Phrase hierarchy

| Phrase | Median |
|---|---|
| **"alternative to [product]"** | **52** |
| "cheaper than" | 43 |
| "replaces" | 41 |
| "unlike" | 40 |
| "faster than" | 37 |
| "better than" | 33 |
| "compared to" | 27 |

"Alternative to" is the most reliably positive phrase. "Better than" — generic superiority — underperforms baseline. The audience trusts positioning over boasting.

### Category creation

"The first" (median 40), "the only" (39, avg **139**) — category claims outperform comparison claims. "We invented" (median 10, n=2) — founders who actually invented something apparently don't announce it that way.

### Replacement framing — the anti-pattern

"No more" (32), "replace your" (24), "forget about" (22), "stop using" (21.5). **Any replacement framing: median 28.** The more aggressive the replacement language, the worse the result. Telling users what to abandon, without earning authority first, reads as presumption.

### Differentiation claims

2–3 claims is the sweet spot (median 40–43). At 5+, both median and mean collapse. A post with five differentiation claims is a post where no single claim was convincing.

### Villain specificity

Naming a specific enemy product doesn't reliably help. Vague villains ("legacy systems") slightly outperform concrete ones ("Excel") at the median. But individual villains vary: Slack and Jira as named enemies carry median 40. Google Sheets carries 25. The villain only works when the audience already resents it.

---

## X. The words that poison, the words that endure

### Buzzword penalties

| Word | Avg Votes |
|---|---|
| "disruptive" | **21** |
| "game-changing" | 31 |
| "next-gen" | 32 |
| "revolutionary" | 49 |
| **Baseline** | **84** |

"Disruptive" is worth one-quarter of an average launch. These words do not describe a product. They perform a ritual — repeating an incantation from a pitch deck template written in 2014. The crowd can tell.

### Power words

| Word | Median Lift |
|---|---|
| **exclusive** | **+19** |
| **secret** | **+10** |
| limited | +3 |
| new | 0 |
| free | −2 |
| **proven** | **−8** |
| **breakthrough** | **−8** |

The marketing playbook is inverted. Scarcity language ("exclusive", "secret") works. Credibility language ("proven", "breakthrough") doesn't. "Free" is mildly negative.

### Action verbs — all positive

"Eliminate" (avg 118), "automate" (97), "simplify" (108), "streamline" (109), "reduce" (96). Every action verb outperforms baseline. None hurt. The verb is the engine. The adjective is the exhaust.

### Superlatives

All weakly positive except "fastest" (−0.007). "Largest" is strongest (+0.070). Hyperbole density does not hurt — the penalty most founders fear does not exist. But the effect is small everywhere.

### Jargon

Zero jargon: median 30. Some jargon (Q2): **41**. Heavy jargon (Q4): 35. The audience is technical enough to reward specificity but not so technical that they want a spec sheet. Moderate jargon is the sweet spot.

### Concrete vs abstract

Most abstract quartile: median 30. Somewhat concrete: **39**. Most concrete: 37. Pure numbers without narrative feel sterile. The sweet spot is concrete language leavened with enough abstraction to tell a story.

### Emotional valence

Strongly positive: median **42**. Slightly negative: 38. Neutral: 35. The market rewards emotional intensity in both directions more than it rewards neutrality. But the best performers name something they genuinely love, not something they hate.

---

## XI. The micro-story — the hidden weapon

15% of launches contain a micro-story: a before/after narrative with a character. Not a metric. Not a feature. A transformation made human.

| | n | Median |
|---|---|---|
| **Has micro-story** | **410** | **45** |
| No micro-story | 2,286 | 34 |

**+11 median lift.** One of the strongest single-feature signals in the entire dataset.

The #1 launch opens with a skit about a tenant whose kitchen is on fire. The #9 holds up a $30,000 medication vial and drops it. The #12: *"Your greatest revenue opportunity is hiding in plain sight."*

Metrics prove. Micro-stories convert. The difference: a metric asks the reader to believe a number. A micro-story asks the reader to see themselves. Verification versus recognition. The brain processes them differently, and the vote count knows.

---

## XII. Narrative structure: the textbook is wrong

We classified 920 video transcripts by narrative arc.

| Arc | n | Median |
|---|---|---|
| neutral→solution→solution | 27 | **47** |
| solution-first | 340 | 34 |
| problem-heavy | 299 | 34 |
| traction-first | 124 | 34 |
| **problem→solution→traction (textbook)** | **5** | **33** |

The textbook arc — problem, solution, traction — appears in **0.5% of transcripts**. The gospel is almost nobody's practice, and when practiced, it underperforms.

The standout: transcripts that skip problem framing entirely and spend two-thirds on product mechanics (median 47). The audience already knows the problem. They came for the answer.

### ABT (And-But-Therefore) structure

| | n | Median |
|---|---|---|
| "But"-only (tension, no resolution) | 1,703 | **38** |
| Full ABT (but + therefore) | 409 | 33 |
| No ABT | 501 | 33 |

The Hollywood screenwriting framework backfires in full. The "but" is the engine — it creates tension. The "therefore" reads as self-congratulatory. Set up the tension. Let the reader conclude.

### Traction placement in video

Metrics in the **third quarter** of a transcript correlate with the highest median (40). Early metrics in transcripts underperform (29). This contradicts the body text finding — different medium, different rhythm. The written post should lead with proof. The spoken pitch should earn it.

### Topic transitions

3–5 transitions is optimal (mean 92). Focused (≤2): 80. Choppy (≥6): 70. Enough movement to cover ground. Not so much that nothing lands.

---

## XIII. The body's first section matters

We mapped every launch's first section header. The hierarchy inverts every assumption.

| First Section | Median |
|---|---|
| **Team** | **45** |
| **TL;DR** | **43** |
| Problem | 39 |
| Solution | 33 |
| Ask | 32 |
| Traction | 30 |

Leading with **who you are** beats leading with what you built. Leading with your ask or traction is the worst possible opener. The post that opens by begging or bragging loses to the post that opens by introducing itself.

**First 100 words — content type:**

| Opening Type | Median |
|---|---|
| **Product-first** | **42** |
| Story-first | 40 |
| Metric-first | 35 |
| Problem-first | 33 |

In body text, the reader wants to know what you do immediately. The problem is context; the product is news. Lead with the news.

---

## XIV. Founder voice beats company voice

| Voice | n | Median |
|---|---|---|
| **Personal ("I built/realized")** | **61** | **40** |
| Corporate ("Company provides") | 1,023 | 39 |
| Team/mixed ("we") | 1,612 | 34 |

Personal first-person wins, but only 61 launches use it — 2.3%. The real loser is the default team voice ("we") at median 34. "We" as a pronoun is fine. "We built X for Y" as a default mode is not — it lacks authorship.

### Pronoun balance

| | Median |
|---|---|
| Balanced (40–60% we/you) | **38** |
| Mostly-we (>60%) | 36 |
| Mostly-you (<40%) | 32 |

Balanced framing wins. Heavy "you" language underperforms — it lectures.

### Hedge words — the surprise

Posts with hedge words ("might", "could", "perhaps"): median **41**. Without: 34. Spearman r = +0.173. Almost certainly a confound — hedging co-occurs with nuance. But the correlation is real, and it inverts the confidence gospel.

**Confidence words** ("will", "guaranteed", "proven"): zero signal. r = −0.013. The bluster is inert.

---

## XV. The linguistic non-findings

Every complexity metric — reading level, syllable density, word diversity — shows near-zero correlation with votes. The market reads everything and rewards nothing linguistic in particular.

**The one exception:** founders who speak in shorter sentences in video (not text) correlate with higher votes (r = −0.10). The only reliable linguistic finding in the dataset.

**Word complexity:** r = 0.000. Write simply or write densely — the audience does not care.

---

## XVI. Timing: when you launch matters

### Day of week

| Day | Median |
|---|---|
| **Sunday** | **45.5** |
| **Friday** | **40** |
| Wednesday | 37 |
| Tuesday | 35 |
| Monday | 34 |

Sunday is the best day. Fewest launches, most attentive audience. Tuesday through Thursday is where everyone launches, and it shows.

### Early vs late in the cycle

The delta is positive in **every single cohort without exception.** Early launchers outperform late launchers by 15–48 median votes. The gap has widened over time. The audience's attention depletes. First-mover advantage is real and measurable.

### Repeat launchers

402 companies launched multiple times. The final launch in a sequence is usually the peak. Companies warm up their audience across multiple posts. One company went from 49 to 1,078 votes by changing its name and framing — same product, different story.

---

## XVII. Industry: one playbook does not fit all

| Industry | n | Median |
|---|---|---|
| Education | 24 | **53** |
| Consumer | 182 | **45** |
| Healthcare | 238 | 37.5 |
| Fintech | 204 | 37 |
| Industrials | 148 | 36 |
| B2B | 1,834 | 35 |
| Real Estate | 50 | 26.5 |

Education leads. Consumer is the only category with both volume and elevated median. B2B is the ocean — 68% of all launches, completely average.

### "AI" in title

Rose from ~25% (2021) to ~59% (2025), then pulled back. Non-AI launches now outperform AI launches in both median and average. The word is negative equity.

### B2B vs B2C

Launches addressing **both** organizations and individuals simultaneously (median **40**) beat B2B-only (33) or B2C-only (36).

### Industry-specific traction

What type of proof works varies wildly by sector. Revenue/ARR mentions *hurt* in Education (−36 lift) and Government (−10). Growth rates carry the largest lift in Consumer (+38.5). Technical proof (open source, GitHub stars) is a Consumer badge (+21) and means nothing in Healthcare. Naming user counts *hurts* in Fintech (−7.5).

The traction that works in one sector is the traction that backfires in another. Know your audience before you cite your numbers.

---

## XVIII. What's saturating, what's emerging

### Dying signals (losing power over time)

**Metrics in body:** +10 lift in 2020–2024. Collapsed to **+1 in 2025**. Adoption rose to 71%. The signal is dead.

**Waitlist CTA:** +71 in 2022. Down to **+9 in 2025**. The tactic is being learned, and the audience is growing resistant.

**"AI" in title:** 59% saturation. Non-AI launches now outperform. The herd telegraphed its presence; the crowd stopped rewarding it.

**Traction lift by era:** in early cohorts (2018–2022), traction language added +8. In recent cohorts (2023–2026): +4. As more companies show traction, the signal becomes less differentiating. The bar has risen but the reward for clearing it has fallen.

### Rising signals

**Domain expertise:** didn't register before 2023. Now +8 to +11 lift. As the market floods with generalist builders, the audience rewards founders who've spent a decade in the problem space. This is the signal that hasn't been read into the playbook yet — which is exactly why it still works.

**Long body text:** +13 lift in 2025, up from +3 in 2024. As competition increases, depth is rewarded.

**Emoji in title:** stable +16 to +19 since 2022. Adoption has *declined* from 40% to 11% — making the signal rarer and potentially more powerful.

### Eternally inert

**Social proof:** oscillates around zero in every year. Never consistently significant. The aggregate lift is a mirage caused by correlation with other signals.

**Technical founder signal:** oscillates between +2 and +13. Non-stationary. Unreliable as a consistent differentiator.

---

## XIX. The Education anomaly and the Government mirror

Every factor behaves differently across industries. Two industries invert everything.

**Education** systematically reverses the playbook:

| Factor | Lift in Education |
|---|---|
| Metrics in body | **−36** |
| Long body | **−36** |
| Domain expertise | **−51** |
| Social proof | **+54** |
| Emoji | **+60** |
| Technical signal | **+107** |

The Education audience wants conviction and novelty. Credentials hurt. Numbers hurt. The only things that help are external validation and visual warmth. Education is a different species.

**Government** is the mirror:

| Factor | Lift in Government |
|---|---|
| Emoji | **−13** |
| Dash in title | **−10** |
| Technical signal | **−19** |
| Metrics | **−10** |

Every informal signal is penalized. Seriousness is the only currency.

---

## XX. The feature combinations that multiply

### Individual feature lift

| Feature | Lift |
|---|---|
| Emoji in title | **+14 median** |
| Domain expertise | +10 |
| Social proof (aggregate) | +9 |
| Metrics in body | +8 |
| Long body (>400w) | +8 |
| Dash in title | +6 |
| Traction language | +5 |
| Title < 50 chars | 0 |
| Has video | **−3** (negative) |

### Best combinations

| Combo | Avg Votes | Lift | n |
|---|---|---|---|
| **Emoji + social proof + short title** | **270** | **4.1x** | 37 |
| Emoji + social proof + long body | 221 | 3.3x | 50 |
| Metrics + emoji + social proof | 232 | 3.6x | 38 |

### The success score

We built a composite score (0–7 features). Each feature adds ~4–5 median votes. Score 0: median 27. Score 6: **median 67**. Score 7 (n=7) drops to 51 — the fully optimized post smells like a formula, and the crowd recoils.

### Top 1% vs bottom 50%

| Feature | Top 1% | Bottom 50% | Gap |
|---|---|---|---|
| Metrics in body | 57.7% | 32.6% | +25pp |
| Emoji in title | 42.3% | 21.8% | +21pp |
| Long body | 57.7% | 37.8% | +20pp |
| **Has video** | **42.3%** | **53.8%** | **−12pp** |

The top 1% has fewer videos than the bottom 50%. The bottom 10%'s single most distinguishing feature: **posting years after their cohort.** 49% of failures posted 2+ years late. The community had dispersed. The momentum was gone.

---

## XXI. Niche targeting vs broad framing

| | n | Median |
|---|---|---|
| **Both niche + broad** | **22** | **47** |
| Broad ("for teams/companies") | 392 | 39 |
| Niche ("for dentists/trucking") | 163 | 37 |
| Neither | 2,141 | 35 |

Speaking to both a specific vertical AND a broader audience wins. The combination signals domain expertise while not limiting perceived market.

---

## XXII. Future tense outperforms present tense

| | n | Median |
|---|---|---|
| **Future-tense only** | **500** | **40** |
| Present-tense only | 593 | 37 |
| Both | 170 | 34 |

"We're building" beats "we do." The crowd rewards ambition over proof in the launch context. They are investing attention in a promise, not evaluating a finished product. Using both tenses is worst — it reads as hedging.

---

## XXIII. Team composition

| Team Size | n | Median |
|---|---|---|
| Solo | 141 | 31 |
| Duo | 76 | 34 |
| Small (3–5) | 62 | 34 |
| **Medium (6–15)** | **23** | **65** |
| Large (16+) | 34 | 34 |

Medium teams — enough to ship something credible — outperform everything by a wide margin. But 87.5% of launches never mention team size. The ones who do are self-selecting: narrative-forward founders pitching the team as a credential.

---

## XXIV. Funding stage

| | n | Median |
|---|---|---|
| **Pre-seed** | **9** | **128** |
| Series C+ | 15 | 49 |
| Series A | 32 | 37 |
| Seed | 26 | 32 |
| Bootstrapped | 28 | 30 |

Pre-seed wins by a wide margin. The crowd rewards founders who arrive with nothing but an idea. Smaller revenue numbers get more votes. User counts under 100 (median **58**) beat 10K+ (median 42). The audience wants to witness, not validate.

---

## XXV. The uncomfortable conclusion

The highest-voted launch in the dataset — 3,068 votes — opens with a man who doesn't want to talk to his tenants. The second-highest — 2,459 — has a 29-word transcript. The fifth-highest has no video at all.

The data suggests a formula. The outliers ignore it.

The formula works at the median. It will move a launch from 36 votes to 45, from invisible to noticed. The formatting, the metrics, the emoji, the dash — these are the floor tiles that get you into the room.

But the posts that reach 3,000 — a $30,000 medication vial dropped on camera, a kitchen on fire, one sentence of exhaustion — those are not formulaic. They are human. A founder who has run out of patience is more compelling than a founder who has optimized their tagline.

The playbook gets you to the 90th percentile. The last 10% requires something the data cannot teach.

Something worth saying.

---

*Analysis: 2,696 launches, 22 cohorts, 1,004 video transcripts, 56 analyses across 110 dimensions. Charts and raw data tables available.*
