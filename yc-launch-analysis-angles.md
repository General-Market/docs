# YC Launch Analysis — 100 Angles

**Dataset:** 2,696 YC launches, 1,004 with video transcripts, all with body text and vote counts.

**Goal:** Find what separates launches that resonate from launches that dissolve into the feed. Build a playbook for our own launch video.

---

## A. Opening Hooks (The First 5 Seconds)

1. **First sentence classification** — categorize every transcript's opening line: question, stat, pain point, founder story, product statement, bold claim
2. **First-person vs. third-person openings** — "We built..." vs. "Companies lose $X..."
3. **Question openers vs. declarative openers** — which get more votes?
4. **Shock stat openers** — launches that lead with a surprising number ("$4.2 trillion is wasted on...")
5. **Negative openers** — "X is broken" / "Nobody likes X" — do pessimistic hooks outperform?
6. **Name-drop openers** — mentioning a known company or person in the first sentence
7. **Time-to-product-mention** — how many words before the product name appears?
8. **Opening word frequency** — what are the 50 most common first words across all transcripts?

## B. Transcript Structure

9. **Total length vs. votes** — is there a sweet spot? (word count buckets)
10. **Paragraph count in body text vs. votes** — do shorter posts win?
11. **Problem-solution ratio** — what % of transcript is problem vs. solution?
12. **Traction mention timing** — when in the transcript do founders drop metrics?
13. **Ask placement** — where does the CTA appear? End only, or sprinkled throughout?
14. **Number of distinct claims** — do winners make 3 claims or 12?
15. **Narrative arc classification** — problem→solution→traction, story→product→ask, demo→context→ask
16. **Section count in body text** — how many distinct sections (headers, bullets, paragraphs)?

## C. Linguistic Patterns

17. **Reading level (Flesch-Kincaid)** — do simpler transcripts get more votes?
18. **Sentence length distribution** — short punchy vs. long explanatory
19. **Active vs. passive voice ratio** — correlation with engagement
20. **Jargon density** — count of industry-specific terms per 100 words
21. **Superlative usage** — "first", "only", "fastest", "most" — does hyperbole help or hurt?
22. **Hedge word frequency** — "might", "could", "potentially" — do uncertain founders get fewer votes?
23. **Concrete vs. abstract language ratio** — specific nouns/numbers vs. vague claims
24. **Emotional valence scoring** — positive/negative sentiment across the transcript
25. **Power words** — frequency of persuasion words (free, new, proven, guaranteed, instant)
26. **"We" vs. "You" ratio** — founder-centric vs. customer-centric language

## D. Social Proof & Credibility

27. **Revenue/ARR mentions** — presence and magnitude vs. votes
28. **Customer count mentions** — "500 companies use us" — does specificity matter?
29. **Growth rate mentions** — "10x in 3 months" — frequency and correlation
30. **Logo drops** — naming customers (especially known brands) in body text
31. **Founder credential mentions** — "ex-Google", "PhD from MIT" — does pedigree move votes?
32. **Investor mentions** — does naming investors help or look desperate?
33. **"Since joining YC" framing** — how many use YC itself as a credibility signal?
34. **Testimonial/quote inclusion** — direct customer quotes in body text
35. **Before/after metrics** — "reduced X from 3 days to 3 minutes"

## E. Traction Signals

36. **Presence of any metric vs. no metrics** — binary correlation with votes
37. **Metric specificity** — round numbers ("$1M ARR") vs. precise ("$1.2M ARR")
38. **Metric type ranking** — which metric types correlate strongest? (revenue, users, growth rate, savings)
39. **Number of distinct metrics mentioned** — 1 vs. 3 vs. 7
40. **Metric placement** — title, tagline, first paragraph, buried in body?
41. **Time-framed metrics** — "in 6 months" vs. no timeframe

## F. Body Text Formatting

42. **Emoji usage in titles** — presence and count vs. votes
43. **Bold/italic formatting density** — heavily formatted vs. plain
44. **Bullet point usage** — bulleted lists vs. prose paragraphs
45. **TL;DR presence** — do posts with a TL;DR section perform differently?
46. **Header count and hierarchy** — structural organization of body text
47. **Image/GIF references** — body texts that reference embedded media
48. **Link count** — how many outbound links in the body?
49. **Body text length distribution** — word count buckets vs. votes
50. **Code snippet inclusion** — for dev tools, does showing code help?

## G. Title & Tagline

51. **Title length (characters)** — optimal range?
52. **Title contains company name** — yes/no correlation
53. **Title punctuation** — questions, exclamations, colons, dashes
54. **Tagline length** — one-liners vs. multi-sentence
55. **Title-tagline redundancy** — do they say the same thing or different things?
56. **Emoji in title vs. no emoji** — vote differential
57. **Title formula classification** — "Company: Does X for Y" vs. "Company — The Z of W"
58. **Benefit-first vs. product-first titles** — "Save 10 hours/week" vs. "AI scheduling tool"
59. **Specificity in tagline** — vague ("revolutionize") vs. concrete ("automate invoice matching")

## H. Industry & Category

60. **Votes by industry** — which YC industries get the most upvotes?
61. **Industry saturation** — launches per industry per batch — is crowding punished?
62. **B2B vs. B2C signal** — language markers and vote differences
63. **AI mention frequency over time** — when did "AI" in titles peak? Does it hurt now?
64. **Healthcare vs. fintech vs. devtools** — structural differences in winning launches
65. **Niche vs. broad market framing** — "for dentists" vs. "for businesses"

## I. Timing & Batch Effects

66. **Vote inflation over time** — are recent batches getting more votes due to platform growth?
67. **Votes normalized by batch size** — rank within cohort, not absolute
68. **Day-of-week launch timing** — do launches on certain days get more votes?
69. **Batch prestige effect** — do W (winter) vs. S (summer) batches differ?
70. **Early vs. late launchers within a batch** — first-movers vs. last?
71. **Repeat launchers** — companies that launched multiple times (Menza appears twice in top 15)

## J. Video vs. No Video

72. **Vote distribution with video vs. without** — full histogram, not just averages
73. **Video + strong body vs. video + weak body** — does writing quality matter more than video presence?
74. **Transcript length sweet spot** — optimal video duration (estimated from transcript word count)
75. **Video presence by batch** — are newer batches more likely to have videos?
76. **Top 1% analysis** — of the top 27 launches, what % have video?

## K. Competitive Framing

77. **Competitor mentions** — do launches that name competitors perform differently?
78. **"Unlike X" framing** — explicit differentiation language
79. **Category creation language** — "the first X", "a new category of"
80. **Replacement framing** — "replace your spreadsheet" / "stop using X"
81. **Comparison tables in body text** — structured competitive positioning

## L. Call to Action

82. **CTA type** — try free, book demo, sign up, join waitlist, contact us
83. **CTA count** — one ask vs. multiple asks
84. **CTA urgency language** — "today", "now", "limited" — does it work for YC audiences?
85. **Ask specificity** — "try it" vs. "send your first invoice in 2 minutes"
86. **Founder contact info** — personal email/phone in body text

## M. Founder Signal

87. **Founder count mentioned** — solo vs. team
88. **Personal story inclusion** — "I experienced this problem when..."
89. **Domain expertise signaling** — "spent 10 years in healthcare"
90. **"Why we built this"** — explicit motivation section
91. **Technical founder signal** — language that implies builder credibility

## N. Cross-Metric Correlations

92. **Body length × transcript length interaction** — long post + short video vs. short post + long video
93. **Metric density × industry** — do some industries need more proof?
94. **Emoji × industry** — healthcare with emojis vs. devtools with emojis
95. **Title length × body length** — do short titles compensate with long bodies?
96. **Traction × batch stage** — do later batches need more traction to compete?

## O. Anomaly & Outlier Analysis

97. **Vote outliers** — launches with 10x the median: what do they share?
98. **Low-vote launches with video** — what went wrong? Common patterns in failure
99. **Zero-to-hero patterns** — companies that launched with low votes but are now well-known
100. **The anti-patterns** — most common traits of bottom-10% launches (the field guide of what to avoid)

---

## Priority for Our Launch Video

**High signal (do first):**
- #1–8 (opening hooks) — the first sentence is the whole game
- #9–10 (length sweet spots) — don't ramble, don't rush
- #36–41 (traction signals) — what metrics to show and where
- #51–59 (title/tagline) — the thumbnail of the launch
- #97–100 (outliers and anti-patterns) — learn from the extremes

**Medium signal:**
- #17–26 (linguistic patterns) — calibrate the register
- #27–35 (social proof) — what proof to include
- #82–86 (CTA) — end with a clear ask

**Interesting but secondary:**
- #60–71 (industry/timing) — context, not actionable
- #92–96 (cross-correlations) — for the obsessive only
