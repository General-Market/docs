# Transcript Analysis — 200 Dimension Extraction

You are analyzing Product Hunt launch video transcripts. For each transcript, extract ALL dimensions below. Use semantic understanding, not just keyword matching. Return structured JSON.

## OUTPUT FORMAT

For each transcript, return a JSON object with "id" (string) and all dimension keys below. Use the exact key names specified.

## V1 DIMENSIONS (80) — Originally regex-extracted, now re-extracted with semantic understanding

### Opening (6 dims)
- **hook_type** (string): One of: "founder_story", "pain_point", "greeting", "announcement", "demo_instruction", "bold_claim", "descriptive", "stat_number", "product_statement", "question"
- **first_person_opener** (0/1): Opens with I/We
- **has_negative_opener** (0/1): Opens with negative framing (broken, tired, hate, frustrated, problem)
- **first_sentence_words** (int): Word count of first sentence
- **hook_quality** (1-5): Rate the opening hook's attention-grabbing power

### Length & Readability (6 dims)
- **word_count** (int): Total words
- **sentence_count** (int): Total sentences
- **avg_sentence_length** (float): Words per sentence
- **flesch_kincaid_grade** (float): Reading grade level estimate
- **word_diversity** (float 0-1): Unique words / total words
- **syllable_density** (float): Average syllables per word

### Pronouns & Voice (5 dims)
- **pronoun_strategy** (string): "mostly_we", "mostly_you", "balanced", "neutral"
- **we_count** (int): "we/our/us" occurrences
- **you_count** (int): "you/your/you're" occurrences
- **hedge_count** (int): Hedging words (maybe, perhaps, might, kind of, sort of, arguably)
- **filler_count** (int): Filler words (um, uh, like, basically, actually, literally, so yeah)

### Narrative Arc (5 dims)
- **narrative_arc** (string): "problem_solution", "solution_first", "traction_first", "problem_heavy", "neutral_flat", "too_short"
- **topic_transitions** (int): Number of major topic shifts
- **problem_pct** (float 0-100): % of transcript devoted to problem
- **solution_pct** (float 0-100): % of transcript devoted to solution
- **declining_arc** (0/1): Starts positive, ends with urgency/darker tone

### Metrics & Traction (8 dims)
- **number_count** (int): Total numbers mentioned
- **number_density** (float): Numbers per 100 words
- **metric_placement** (string): "front", "middle", "back", "none"
- **before_after_total** (int): Count of before/after comparison claims
- **success_users** (int): User/customer count claims
- **success_revenue** (int): Revenue/ARR claims
- **success_cost_savings** (int): Cost saving claims
- **success_growth** (int): Growth metric claims

### Social Proof (10 dims)
- **brand_count** (int): Distinct brand names mentioned
- **has_investor_mention** (0/1): Mentions investors/funding
- **has_testimonial** (0/1): Includes user quote or testimonial
- **trusted_by** (0/1): Uses "trusted by" pattern
- **has_partnership** (0/1): Mentions partnerships
- **has_credential** (0/1): Founder credentials (ex-FAANG, PhD, etc.)
- **social_proof_claims** (int): Total social proof statements
- **platform_mentions** (int): Other platform/tool names mentioned
- **competitive_total** (int): Competitive comparison statements
- **replacement_total** (int): "Replace X with us" type claims

### Category & Positioning (4 dims)
- **category_creation_total** (int): "the first", "the only", "a new kind", "we invented" type claims
- **ai_count** (int): AI/ML mentions
- **ai_density** (float): AI mentions per 100 words
- **buzzword_count** (int): Generic buzzwords (revolutionary, game-changing, cutting-edge, etc.)

### CTA & Closing (8 dims)
- **primary_cta** (string): "waitlist", "join", "sign_up", "try", "get_started", "book_demo", "free", "beta", "limited", "none"
- **cta_position** (string): "start", "middle", "end", "none"
- **has_discount** (0/1): Mentions discount/deal/offer
- **has_scarcity** (0/1): Scarcity language (limited, exclusive, only X spots)
- **has_pricing** (0/1): Mentions pricing
- **has_url** (0/1): Mentions a website URL
- **closing_has_cta** (0/1): Last sentences include CTA
- **closing_has_thanks** (0/1): Ends with thanks/bye

### Content Signals (15 dims)
- **storytelling** (0/1): Contains a narrative anecdote
- **humor** (0/1): Intentional humor or levity
- **demo_instructions** (int): "click here", "let me show you" type phrases
- **screen_narration** (int): "here you can see", "on the left" type phrases
- **data_viz_cues** (int): References to charts, graphs, data
- **energy_markers** (int): Exclamation marks, enthusiasm words
- **feature_list_markers** (int): "first...", "second...", "also..." enumeration
- **production_markers** (int): [Music], [Applause] type markers
- **speaker_changes** (int): Number of speaker changes
- **action_verb_count** (int): Strong action verbs
- **feature_words** (int): Feature-describing words
- **benefit_words** (int): Benefit-describing words
- **benefit_ratio** (float 0-1): Benefits / (benefits + features)
- **question_count** (int): Total questions asked
- **passive_voice_count** (int): Passive voice constructions

### Sentiment (3 dims)
- **sentiment** (string): "positive", "neutral", "negative"
- **confidence_count** (int): Confidence words (will, definitely, guaranteed, proven)
- **product_name_repeats** (int): Times product name is repeated

---

## V2 DIMENSIONS (100) — New deep analysis with semantic understanding

### A. Story Architecture (17 dims)

- **inciting_incident** (0/1): Does the transcript describe a SPECIFIC moment that triggered the product's creation? Not "we noticed a problem" but "last Tuesday my API bill was $47,000" or "I was sitting in a meeting watching everyone struggle with spreadsheets." Requires a concrete, personal, situated moment.

- **villain_named** (0/1): Is there an explicit antagonist? Could be a tool (spreadsheets, email), a process (manual reporting, copy-paste workflows), a concept (complexity, information overload), or a competitor. Must be named or clearly pointed at, not just implied.

- **villain_count** (int): How many distinct villains/antagonists are referenced?

- **stakes_escalation** (0/1): Does the problem description grow in severity across the transcript? First mention is mild, later mentions reveal deeper consequences (costs money, loses customers, wastes hours, causes burnout).

- **transformation_promise** (0/1): Does the transcript promise identity change? "Go from X to Y", "become someone who...", "never again be the person who...", "transform how you...". Not just "save time" but actual identity/role transformation.

- **transformation_position** (float 0-1): Where in the transcript does the transformation promise appear? 0=beginning, 1=end. -1 if absent.

- **pivot_sharpness** (1-5): How abrupt is the problem→solution transition? 1=gradual/blurred, 5=razor sharp ("So we built X" / "Introducing X" / hard cut from pain to product).

- **nested_stories** (0/1): Contains a story-within-the-story? User anecdote, customer journey, founder flashback, "one of our users" narrative, case study embedded in the pitch.

- **temporal_anchors** (int): Count of specific time references: years, months, "last quarter", "in 30 seconds", "within minutes", "3 years ago".

- **imagine_device** (int): Future-pacing invitations: "imagine", "picture this", "what if you could", "think about what happens when", "envision a world where". Count all instances.

- **cliffhanger_beats** (int): Suspense/tension devices: "but here's the thing", "and then something changed", "wait until you see", "the best part is", "you won't believe what happened next". Count all.

- **why_now** (0/1): Does the transcript explain why THIS product at THIS moment? Market timing, new technology enabling it, regulatory shift, cultural moment, "now that AI exists we can finally..."

- **journey_vs_destination** (float 0-1): 0=pure destination ("the solution for X"), 1=pure journey ("the tool that takes you from A to B"). How much is the product framed as a vehicle vs an endpoint?

- **emotional_bookend_match** (0/1): Does the emotional tone at the end mirror or meaningfully contrast with the opening? Pain→relief, curiosity→satisfaction, tension→resolution.

- **unsaid_problem** (int): Implicit problem references: "you know that feeling", "we've all been there", "sound familiar?", "you know how it is when...". The audience fills in the specific frustration.

- **resolution_completeness** (float 0-1): What fraction of problems raised are explicitly resolved? 1.0 = every pain point gets a solution. 0.5 = half the problems are left hanging.

- **story_compression** (float): How much narrative time passes per sentence? High = covering years in a few words. Low = minute-by-minute walkthrough. Rate 1-5.

### B. Emotional Mechanics (17 dims)

- **emotion_specificity** (1-5): 1=only generic emotions ("frustrated", "happy"), 5=vivid and situated ("that sinking feeling when the deploy fails at 2am on a Friday", "the rush when your first user signs up"). Rate the emotional precision.

- **relief_distance** (int): How many sentences between introducing a tension/problem and offering relief/solution? 0=immediate, 5+=sustained tension.

- **pride_trigger** (int): Count of moments that make the viewer feel smart/capable: "you already know", "as a [role] you understand", "smart teams use", "you're the kind of person who...".

- **fomo_construction** (int): Fear of being left behind: "competitors are already", "the market is moving", "everyone is switching", "don't get left behind", "your competitors", "while you're still using...". Count all instances.

- **empathy_firsthand** (0/1): Does the SPEAKER demonstrate they personally lived the problem? "I spent 6 months doing this manually", "when I was a PM I had to...", "we experienced this ourselves".

- **empathy_observed** (0/1): Does the transcript describe others' suffering? "teams struggle with", "developers spend hours", "companies waste thousands on...". Third-person empathy.

- **frustration_vocabulary_breadth** (int): Count of DISTINCT frustration/pain concepts expressed. Not just word count — how many different facets of the pain are articulated?

- **joy_velocity_shift** (1-5): How quickly does the emotional register shift from negative to positive when the solution appears? 1=gradual, 5=instant transformation.

- **vulnerability_moment** (0/1): Does the speaker admit failure, uncertainty, or limitation? "Our first version was terrible", "we almost gave up", "we're not perfect at X yet", "honestly, we got this wrong at first".

- **anticipatory_emotion** (int): Dopamine priming moments: "wait until you see", "you're going to love this", "here's the exciting part", "watch this", "check this out", "let me show you something cool".

- **social_belonging** (int): Community/tribe invocations: "join 10,000 developers", "community of builders", "thousands of teams trust", "you're in good company", "fellow founders".

- **loss_aversion_framing** (float 0-1): 0=pure gain framing ("save X"), 1=pure loss framing ("you're losing X every month", "wasting X hours"). 0.5=balanced.

- **surprise_delight** (int): Unexpected capability reveals later in transcript: "oh and it also does", "bonus feature", "did I mention it can", "and the cherry on top".

- **confidence_gradient** (1-5): Does the speaker's certainty grow throughout? 1=consistently uncertain or consistently certain, 5=clear arc from tentative to bold.

- **emotional_contrast_ratio** (1-5): How far apart are the lowest and highest emotional moments? 1=flat/monotone, 5=dramatic swing from despair to euphoria.

- **finally_signal** (int): Long-awaited relief language: "finally", "at last", "no more", "never again", "say goodbye to", "the wait is over", "put an end to".

- **empathy_depth** (1-5): Overall empathy quality. 1=no empathy, pure feature dump. 5=deeply understands the audience's specific daily pain. Combines firsthand experience, observed suffering, and emotional specificity.

### C. Product Presentation (17 dims)

- **feature_intro_velocity** (1-5): 1=features crammed together rapid-fire, 5=each feature gets breathing room and context before the next.

- **orphaned_features** (float 0-1): Fraction of features mentioned without an accompanying benefit/outcome. 0=every feature has a "so that..." payoff. 1=pure feature list with no benefits.

- **demo_voice_present_tense** (0/1): Does the demo narration use present tense live feel? "I click here and it shows...", "watch as I drag this...", "see how it automatically..."

- **concrete_vs_abstract** (1-5): 1=entirely abstract ("powerful analytics"), 5=entirely concrete ("see which page loses 40% of visitors at the pricing section").

- **magic_moment_position** (float 0-1): Where is the single most impressive capability shown? 0=very start, 1=very end. The "wow" moment.

- **speed_claims** (int): Count of velocity/speed claims: "in seconds", "instantly", "10x faster", "real-time", "lightning fast".

- **effort_reduction_specific** (0/1): Does the transcript quantify effort savings with specific numbers? "What took 3 hours now takes 3 minutes", "reduces 12 steps to 1".

- **effort_reduction_vague** (0/1): Vague effort savings without numbers: "saves time", "easier", "simpler", "streamlines your workflow".

- **integration_count** (int): Distinct named integrations (Slack, Notion, Zapier, GitHub, etc.)

- **progressive_disclosure** (0/1): Does the transcript layer complexity? Simple use case first, then intermediate, then advanced/power-user features.

- **one_more_thing** (0/1): Is there a bonus feature or capability saved for the very end of the transcript? The Apple keynote reveal.

- **simplicity_signals** (int): Count of simplicity claims: "simple", "easy", "intuitive", "no learning curve", "one click", "drag and drop". Include "just [verb]" when used to minimize effort.

- **under_the_hood** (0/1): Does the transcript reveal technical architecture for credibility? "Built on GPT-4", "uses vector embeddings", "powered by..."

- **use_case_count** (int): Distinct user personas or use cases explicitly addressed.

- **liveness_score** (1-5): 1=clearly pre-recorded/narrated, 5=feels completely live and spontaneous, clicking through the real product.

- **onboarding_time_claim** (0/1): Mentions specific setup/onboarding time: "up and running in 5 minutes", "deploy in seconds".

- **comparison_moment** (0/1): Side-by-side or before/after visual comparison narrated: "here's the old way... here's ours", "on the left... on the right".

### D. Wording & Rhetoric (16 dims)

- **verb_energy** (1-5): 1=passive/corporate ("utilize", "facilitate", "leverage"), 5=active/punchy ("ship", "crush", "build", "launch").

- **sentence_rhythm_variance** (1-5): 1=all sentences same length (monotone), 5=dynamic alternation between long explanatory and short punchy sentences.

- **power_word_cluster_density** (1-5): 1=no clusters, power words scattered, 5=multiple moments where 3+ impact words hit in rapid succession.

- **jargon_distribution_shape** (string): Where does technical jargon concentrate? "front_heavy", "middle_heavy", "back_heavy", "even", "minimal".

- **anaphora_count** (int): Intentional repetition at sentence/phrase starts: "No more X. No more Y." or "You can X. You can Y. You can Z."

- **just_minimizer** (int): Count of "just" used to minimize perceived effort: "just click", "just drag", "just connect".

- **superlative_density** (float): Superlatives per 100 words: "best", "most", "fastest", "only", "first", "#1".

- **question_answer_pairs** (int): Self-dialogue: question immediately followed by its own answer. "How does it work? Simple." "What makes this different? Three things."

- **transition_sophistication** (1-5): 1=basic transitions ("and", "also", "so"), 5=crafted transitions ("here's where it gets interesting", "but the real magic is...").

- **negation_as_benefit** (int): "No X needed", "without X", "zero setup", "never worry about", "eliminates X".

- **specificity_index** (1-5): 1=all vague qualifiers ("many", "significant", "great"), 5=packed with specific numbers, names, dates, measurements.

- **you_insertion_rate** (float): "You/your" per 100 words. Direct address density.

- **cliche_count** (int): Dead metaphors/buzzwords: "game-changer", "one-stop shop", "seamless", "frictionless", "empower", "unlock", "leverage", "reimagine".

- **conditional_density** (float): Conditional hedging per 100 words: "if you need", "whether you", "in case you".

- **parallel_structure** (int): Parallel grammatical constructions: "Build faster. Ship smarter. Scale easier."

- **imperative_density** (float): Direct commands per 100 words: "Try it", "Check this out", "Stop wasting time", "Sign up now".

### E. Persuasion Psychology (17 dims)

- **word_rarity_score** (1-5): 1=basic/simple vocabulary, 5=sophisticated/unusual word choices throughout.

- **qualifying_retreat** (int): Bold claim then softening: "the best — well, one of the best", "revolutionary, or at least very different".

- **conclusive_finality** (1-5): 1=trails off ("so yeah, that's it, thanks"), 5=ends with a decisive, memorable closing line.

- **social_proof_stacking_order** (string): When multiple proof types exist, what comes first? "numbers_first", "brands_first", "quotes_first", "none".

- **authority_type** (string): "technical" (ex-Google, PhD), "market" (10,000 users), "domain" (15 years experience), "mixed", "none".

- **reciprocity_trigger** (0/1): Offers something free/valuable before asking: "free tier", "open source", "free template", "no credit card needed".

- **anchor_contrast_pricing** (0/1): Establishes high reference price then reveals lower one: "Enterprise tools cost $500/mo — we're $29".

- **contrast_pairs** (int): Explicit juxtapositions beyond before/after: "instead of X, Y", "not X but Y", "unlike X", "while others X, we Y".

- **certainty_ratio** (float 0-1): Certain language / (certain + uncertain). 1=absolute confidence, 0=all hedging.

- **in_group_language** (int): Shared identity statements: "as developers we know", "fellow founders", "if you're like us", "we've all been there".

- **objection_preempt** (int): Addressing likely doubts: "you might be wondering about security", "and yes, it works offline too", "don't worry about setup".

- **scarcity_type** (string): "time" (today only), "quantity" (limited spots), "access" (invite only), "capability" (only tool that), "none".

- **bandwagon_gradient** (0/1): Does social proof escalate through the transcript? Small numbers early, bigger numbers later.

- **choice_architecture** (int): How many tiers/options presented? 0=none, 1=single path, 2=binary, 3+=multiple tiers.

- **cognitive_ease** (int): Effortlessness language: "one click", "automatic", "zero config", "plug and play", "set it and forget it", "instant".

- **everyone_else_maneuver** (int): Subtle shaming/FOMO: "most teams already", "industry standard", "your competitors use", "leading companies".

- **future_self_projection** (int): Identity transformation language: "you'll become", "imagine yourself as", "be the one who", "your future self will thank you".

### F. Structure & Timing (16 dims)

- **info_density_shape** (string): "front_loaded" (dense start, thin end), "back_loaded" (builds to climax), "even" (uniform), "middle_peak" (slow start, dense middle, thin end).

- **breathing_room** (1-5): 1=relentless information, no pauses. 5=generous space between ideas for the listener to absorb.

- **cold_open_words** (int): Words before first product mention or feature description. 0=immediate.

- **callback_count** (int): Internal cross-references: "remember that problem I mentioned?", "going back to what I showed earlier", "this ties back to...".

- **section_length_cv** (1-5): 1=all sections roughly equal length, 5=wildly uneven (one section dominates).

- **promise_proof_push** (float 0-3): How many legs of the framework does the transcript hit? 1 point each for: promise (what it does), proof (evidence), push (CTA).

- **first_feature_position** (float 0-1): Where in the transcript does the first concrete feature appear? 0=immediate, 1=very end.

- **parenthetical_credibility** (int): Casual mentions of impressive facts without emphasis: dropping a big number offhandedly, mentioning a famous customer in passing.

- **section_boundary_markers** (int): Explicit structural signposts: "number one", "next", "finally", "let's move on to", "the second thing".

- **setup_payoff_distance** (float 1-5): 1=questions answered immediately, 5=long suspenseful gaps between setup and resolution.

- **multi_persona_address** (int): Distinct user types/roles explicitly addressed: "for developers", "for designers", "for PMs", "whether you're a founder or an engineer".

- **voice_consistency** (1-5): 1=constantly shifting between I/we and you voices, 5=rock-solid consistent voice throughout.

- **counterfactual_count** (int): "What if" scenarios: "what if you didn't have to", "without this you'd still be", "imagine not having".

- **closing_velocity** (1-5): 1=slow reflective ending, 5=rapid-fire punchy sentences that accelerate to the close.

- **open_loop_closing** (0/1): Forward-looking, unresolved close: "this is just the beginning", "much more to come", "stay tuned", "wait until you see v2".

- **definitive_closing** (0/1): Clean, decisive close: "try it today", "get started now", specific URL, strong final statement.

---

## INSTRUCTIONS

1. Read each transcript carefully. Understand its meaning, intent, and emotional arc.
2. For EVERY dimension, make a judgment based on the full semantic content — do NOT rely on keyword matching alone.
3. For scales (1-5), use the full range. A 3 should be genuinely average. Don't cluster everything at 2-3.
4. For booleans (0/1), be inclusive rather than exclusive. If a transcript arguably contains the pattern, mark it 1.
5. Return valid JSON array of objects, one per transcript.
