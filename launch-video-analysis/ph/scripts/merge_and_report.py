"""Merge all v2 batch results and generate the v2 report."""
import json, math, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from shared_utils import load_transcripts, spearman_r, median

V2_PARTS = "launch-video-analysis/ph/v2-parts"
BATCHES = [
    "batch_a_story", "batch_b_emotion", "batch_c_product",
    "batch_d_wording", "batch_e_persuasion", "batch_f_structure",
]

DIMENSION_LABELS = {
    # A: Story Architecture
    "inciting_incident": "Inciting Incident (specific origin story)",
    "villain_named": "Villain Named (explicit antagonist)",
    "villain_count": "Villain References (count)",
    "stakes_escalation": "Stakes Escalation (problem grows)",
    "transformation_promise": "Transformation Promise (identity shift)",
    "transformation_position": "Transformation Position (0=start, 1=end)",
    "pivot_sharpness": "Pivot Sharpness (problem→solution turn)",
    "nested_stories": "Nested Stories (story within story)",
    "temporal_anchors": "Temporal Anchors (specific time refs)",
    "imagine_device": "\"Imagine\" Device (future pacing)",
    "cliffhanger_beats": "Cliffhanger Beats (suspense devices)",
    "why_now": "\"Why Now\" Argument (timeliness)",
    "journey_vs_destination": "Journey vs Destination Framing",
    "emotional_bookend_match": "Emotional Bookend Match",
    "unsaid_problem": "Unsaid Problem (implicit pain)",
    "resolution_completeness": "Resolution Completeness (solution/problem ratio)",
    "story_compression": "Story Compression (temporal markers/100w)",
    # B: Emotional Mechanics
    "emotion_specificity": "Emotion Specificity (vivid vs generic)",
    "relief_distance": "Relief Distance (sentences tension→relief)",
    "pride_trigger": "Pride Triggers (flattery count)",
    "fomo_construction": "FOMO Construction (fear of missing out)",
    "empathy_firsthand": "Empathy First-Hand (speaker lived it)",
    "empathy_observed": "Empathy Observed (third-person suffering)",
    "frustration_vocabulary_breadth": "Frustration Vocabulary Breadth",
    "joy_velocity_shift": "Joy Velocity Shift (positivity delta)",
    "vulnerability_moment": "Vulnerability Moment (admits failure)",
    "anticipatory_emotion": "Anticipatory Emotion (dopamine priming)",
    "social_belonging": "Social Belonging Cues (tribe language)",
    "loss_aversion_framing": "Loss Aversion Framing (loss/gain ratio)",
    "surprise_delight": "Surprise/Delight Reveals (late bonuses)",
    "confidence_gradient": "Confidence Gradient (certainty growth)",
    "emotional_contrast_ratio": "Emotional Contrast Ratio (swing size)",
    "finally_signal": "\"Finally\" Signal (long-awaited relief)",
    "empathy_depth": "Empathy Depth (composite score)",
    # C: Product Presentation
    "feature_intro_velocity": "Feature Intro Velocity (words between features)",
    "orphaned_features": "Orphaned Features (no benefit ratio)",
    "demo_voice_present_tense": "Demo Voice Present Tense",
    "concrete_vs_abstract": "Concrete vs Abstract Language",
    "magic_moment_position": "Magic Moment Position (0=start, 1=end)",
    "speed_claims": "Speed Claims (velocity language)",
    "effort_reduction_specific": "Effort Reduction Specific (quantified)",
    "effort_reduction_vague": "Effort Reduction Vague",
    "integration_count": "Integration Count (named platforms)",
    "progressive_disclosure": "Progressive Disclosure (layered complexity)",
    "one_more_thing": "\"One More Thing\" Pattern",
    "simplicity_signals": "Simplicity Signals (easy/simple count)",
    "under_the_hood": "\"Under the Hood\" (technical depth)",
    "use_case_count": "Use Case Count (distinct personas)",
    "liveness_score": "Liveness Score (live demo feel)",
    "onboarding_time_claim": "Onboarding Time Claim",
    "comparison_moment": "Comparison Moment (side-by-side)",
    # D: Wording & Rhetoric
    "verb_energy": "Verb Energy (high vs low energy)",
    "sentence_rhythm_variance": "Sentence Rhythm Variance",
    "power_word_cluster_density": "Power Word Cluster Density",
    "jargon_distribution_shape": "Jargon Distribution Shape (position of peak)",
    "anaphora_count": "Anaphora (repeated sentence starts)",
    "just_minimizer": "\"Just\" Minimizer Count",
    "superlative_density": "Superlative Density (/100w)",
    "question_answer_pairs": "Question-Answer Pairs (self-dialogue)",
    "transition_sophistication": "Transition Sophistication",
    "negation_as_benefit": "Negation as Benefit (\"no X needed\")",
    "specificity_index": "Specificity Index (concrete/vague ratio)",
    "you_insertion_rate": "\"You\" Insertion Rate (/100w)",
    "cliche_count": "Cliche Count (dead metaphors)",
    "conditional_density": "Conditional Density (hedging /100w)",
    "parallel_structure": "Parallel Structure Count",
    "imperative_density": "Imperative Density (commands /100w)",
    # E: Persuasion Psychology
    "word_rarity_score": "Word Rarity Score (avg word length)",
    "qualifying_retreat": "Qualifying Retreat (claim then soften)",
    "conclusive_finality": "Conclusive Finality (ending strength)",
    "social_proof_stacking_order": "Social Proof Stacking Order",
    "authority_type": "Authority Type (tech/market/domain)",
    "reciprocity_trigger": "Reciprocity Trigger (free before ask)",
    "anchor_contrast_pricing": "Anchor-Contrast Pricing",
    "contrast_pairs": "Contrast Pairs (juxtapositions)",
    "certainty_ratio": "Certainty Ratio (certain/uncertain)",
    "in_group_language": "In-Group Language (shared identity)",
    "objection_preempt": "Objection Preempt (addressing doubts)",
    "scarcity_type": "Scarcity Type (time/qty/access/capability)",
    "bandwagon_gradient": "Bandwagon Gradient (escalating proof)",
    "choice_architecture": "Choice Architecture (decision options)",
    "cognitive_ease": "Cognitive Ease (effortlessness language)",
    "everyone_else_maneuver": "\"Everyone Else\" Maneuver (subtle shaming)",
    "future_self_projection": "Future Self Projection (identity transform)",
    # F: Structure & Timing
    "info_density_shape": "Info Density Shape (where densest)",
    "breathing_room": "Breathing Room (connective/info ratio)",
    "cold_open_words": "Cold Open Words (to first product mention)",
    "callback_count": "Callback Count (internal references)",
    "section_length_cv": "Section Length CV (evenness)",
    "promise_proof_push": "Promise-Proof-Push Score (0-3)",
    "first_feature_position": "First Feature Position (0=start)",
    "parenthetical_credibility": "Parenthetical Credibility Drops",
    "section_boundary_markers": "Section Boundary Markers",
    "setup_payoff_distance": "Setup-Payoff Distance (suspense)",
    "multi_persona_address": "Multi-Persona Address Count",
    "voice_consistency": "Voice Consistency (pronoun stability)",
    "counterfactual_count": "Counterfactual Count (\"what if\")",
    "closing_velocity": "Closing Velocity (<1 = accelerating)",
    "open_loop_closing": "Open Loop Closing (forward-looking)",
    "definitive_closing": "Definitive Closing (clean end)",
}

DIMENSION_GROUPS = {
    "A. Story Architecture": [
        "inciting_incident", "villain_named", "villain_count", "stakes_escalation",
        "transformation_promise", "transformation_position", "pivot_sharpness",
        "nested_stories", "temporal_anchors", "imagine_device", "cliffhanger_beats",
        "why_now", "journey_vs_destination", "emotional_bookend_match", "unsaid_problem",
        "resolution_completeness", "story_compression",
    ],
    "B. Emotional Mechanics": [
        "emotion_specificity", "relief_distance", "pride_trigger", "fomo_construction",
        "empathy_firsthand", "empathy_observed", "frustration_vocabulary_breadth",
        "joy_velocity_shift", "vulnerability_moment", "anticipatory_emotion",
        "social_belonging", "loss_aversion_framing", "surprise_delight",
        "confidence_gradient", "emotional_contrast_ratio", "finally_signal", "empathy_depth",
    ],
    "C. Product Presentation": [
        "feature_intro_velocity", "orphaned_features", "demo_voice_present_tense",
        "concrete_vs_abstract", "magic_moment_position", "speed_claims",
        "effort_reduction_specific", "effort_reduction_vague", "integration_count",
        "progressive_disclosure", "one_more_thing", "simplicity_signals", "under_the_hood",
        "use_case_count", "liveness_score", "onboarding_time_claim", "comparison_moment",
    ],
    "D. Wording & Rhetoric": [
        "verb_energy", "sentence_rhythm_variance", "power_word_cluster_density",
        "jargon_distribution_shape", "anaphora_count", "just_minimizer",
        "superlative_density", "question_answer_pairs", "transition_sophistication",
        "negation_as_benefit", "specificity_index", "you_insertion_rate", "cliche_count",
        "conditional_density", "parallel_structure", "imperative_density",
    ],
    "E. Persuasion Psychology": [
        "word_rarity_score", "qualifying_retreat", "conclusive_finality",
        "social_proof_stacking_order", "authority_type", "reciprocity_trigger",
        "anchor_contrast_pricing", "contrast_pairs", "certainty_ratio", "in_group_language",
        "objection_preempt", "scarcity_type", "bandwagon_gradient", "choice_architecture",
        "cognitive_ease", "everyone_else_maneuver", "future_self_projection",
    ],
    "F. Structure & Timing": [
        "info_density_shape", "breathing_room", "cold_open_words", "callback_count",
        "section_length_cv", "promise_proof_push", "first_feature_position",
        "parenthetical_credibility", "section_boundary_markers", "setup_payoff_distance",
        "multi_persona_address", "voice_consistency", "counterfactual_count",
        "closing_velocity", "open_loop_closing", "definitive_closing",
    ],
}

# Dimensions that should be excluded from standard correlation (non-ordinal or positional)
SKIP_CORR = {"transformation_position", "social_proof_stacking_order", "authority_type",
             "scarcity_type", "jargon_distribution_shape", "magic_moment_position",
             "info_density_shape", "first_feature_position"}

# Boolean dims (show as has/no split instead of median split)
BOOLEAN_DIMS = {
    "inciting_incident", "villain_named", "stakes_escalation", "transformation_promise",
    "nested_stories", "why_now", "emotional_bookend_match", "empathy_firsthand",
    "empathy_observed", "vulnerability_moment", "effort_reduction_specific",
    "effort_reduction_vague", "progressive_disclosure", "one_more_thing", "under_the_hood",
    "onboarding_time_claim", "comparison_moment", "reciprocity_trigger",
    "anchor_contrast_pricing", "open_loop_closing", "definitive_closing",
}

# Categorical dims (show distribution table)
CATEGORICAL_DIMS = {
    "social_proof_stacking_order": {0: "none", 1: "numbers first", 2: "brands first", 3: "quotes first"},
    "authority_type": {0: "none", 1: "technical", 2: "market", 3: "domain"},
    "scarcity_type": {0: "none", 1: "time", 2: "quantity", 3: "access", 4: "capability"},
}


def load_and_merge():
    transcripts = load_transcripts()
    id_to_tx = {t["id"]: t for t in transcripts}

    merged = {}
    for batch_name in BATCHES:
        path = f"{V2_PARTS}/{batch_name}.json"
        if not os.path.exists(path):
            print(f"MISSING: {path}")
            sys.exit(1)
        data = json.load(open(path))
        for row in data:
            rid = row["id"]
            if rid not in merged:
                merged[rid] = {"id": rid}
            for k, v in row.items():
                if k != "id":
                    merged[rid][k] = v

    results = []
    for rid, dims in merged.items():
        if rid in id_to_tx:
            tx = id_to_tx[rid]
            dims["votes"] = tx["votes"]
            dims["year"] = tx["year"]
            dims["name"] = tx["name"]
            dims["date"] = tx["date"]
            results.append(dims)

    return results


def generate_report(results):
    lines = []
    w = lines.append

    w("# PH Transcript Analysis V2 — Deep Storytelling & Persuasion Findings")
    w("")
    w(f"**Dataset:** {len(results)} Product Hunt transcripts with ≥20 words.")
    years = {}
    for r in results:
        y = r["year"]
        years.setdefault(y, []).append(r["votes"])
    for y in sorted(years):
        w(f"- {y}: {len(years[y])} transcripts, median {median(years[y])} votes")
    w("")
    w("**100 new dimensions** across 6 categories: Story Architecture, Emotional Mechanics,")
    w("Product Presentation, Wording & Rhetoric, Persuasion Psychology, Structure & Timing.")
    w("")
    w("---")
    w("")

    # === MASTER TABLE: CONTINUOUS DIMENSIONS (Spearman valid) ===
    w("## 1. Continuous Dimensions — Spearman r vs Votes")
    w("")
    w("These dimensions have sufficient variance (not sparse booleans). Spearman r is meaningful.")
    w("")
    w("| # | Dimension | r | High med | Low med | Lift |")
    w("|---|---|---|---|---|---|")

    all_continuous = []
    for group_name, dim_names in DIMENSION_GROUPS.items():
        for d in dim_names:
            if d in SKIP_CORR or d in BOOLEAN_DIMS or d in CATEGORICAL_DIMS:
                continue
            pairs = [(r.get(d, 0), r["votes"]) for r in results
                     if r.get(d) is not None and not (isinstance(r.get(d, 0), float) and math.isnan(r.get(d, 0)))]
            if len(pairs) < 20:
                continue
            vv, vvo = zip(*pairs)
            r_val = spearman_r(list(vv), list(vvo))
            # Check if it's actually continuous (>10% non-zero)
            nonzero = sum(1 for v in vv if v != 0)
            if nonzero < len(vv) * 0.10:
                continue  # Too sparse for Spearman, handle as boolean
            med_val = median(list(vv))
            high = [vo for v, vo in pairs if v > med_val]
            low = [vo for v, vo in pairs if v <= med_val]
            h_med = median(high) if high else 0
            l_med = median(low) if low else 0
            lift = h_med - l_med
            label = DIMENSION_LABELS.get(d, d)
            all_continuous.append((d, label, r_val, h_med, l_med, lift))

    all_continuous.sort(key=lambda x: -x[2])
    all_dims = []  # For temporal shifts later
    for i, (d, label, r_val, h_med, l_med, lift) in enumerate(all_continuous, 1):
        bold = "**" if abs(r_val) >= 0.08 else ""
        w(f"| {i} | {bold}{label}{bold} | {r_val:+.3f} | {h_med} | {l_med} | {lift:+d} |")
        all_dims.append((d, label, r_val))

    w("")
    w("---")
    w("")

    # === MASTER TABLE: BOOLEAN DIMENSIONS (median lift) ===
    w("## 2. Boolean Dimensions — Median Vote Lift")
    w("")
    w("For sparse booleans (2-30% prevalence), Spearman r is unreliable. Median lift is the honest metric.")
    w("")
    w("| # | Dimension | Has (n) | Has (med) | No (med) | Lift | Prevalence |")
    w("|---|---|---|---|---|---|---|")

    all_booleans = []
    # Include explicitly boolean dims AND sparse continuous dims
    for group_name, dim_names in DIMENSION_GROUPS.items():
        for d in dim_names:
            if d in SKIP_CORR or d in CATEGORICAL_DIMS:
                continue
            is_bool = d in BOOLEAN_DIMS
            if not is_bool:
                # Check if sparse continuous (should be boolean)
                pairs = [(r.get(d, 0), r["votes"]) for r in results
                         if r.get(d) is not None and not (isinstance(r.get(d, 0), float) and math.isnan(r.get(d, 0)))]
                if not pairs:
                    continue
                vv = [v for v, _ in pairs]
                nonzero = sum(1 for v in vv if v != 0)
                if nonzero >= len(vv) * 0.10:
                    continue  # Already handled as continuous
                is_bool = True  # Treat as boolean

            if not is_bool:
                continue

            pairs = [(r.get(d, 0), r["votes"]) for r in results
                     if r.get(d) is not None]
            has = [vo for v, vo in pairs if v > 0]
            no = [vo for v, vo in pairs if v == 0]
            if not has or not no:
                continue

            h_med = median(has)
            n_med = median(no)
            lift = h_med - n_med
            prev = len(has) * 100 // len(pairs)
            label = DIMENSION_LABELS.get(d, d)
            all_booleans.append((d, label, len(has), h_med, n_med, lift, prev))
            all_dims.append((d, label, 0))  # r=0 placeholder for temporal

    all_booleans.sort(key=lambda x: -x[5])
    for i, (d, label, n_has, h_med, n_med, lift, prev) in enumerate(all_booleans, 1):
        bold = "**" if abs(lift) >= 15 else ""
        flag = " ⚠️" if n_has < 30 else ""
        w(f"| {i} | {bold}{label}{bold} | {n_has}{flag} | {h_med} | {n_med} | {lift:+d} | {prev}% |")

    w("")
    w("*⚠️ = fewer than 30 observations, treat with caution*")
    w("")
    w("---")
    w("")

    # === PER-GROUP DETAILED SECTIONS ===
    for group_name, dim_names in DIMENSION_GROUPS.items():
        w(f"## {group_name}")
        w("")

        for d in dim_names:
            label = DIMENSION_LABELS.get(d, d)

            vals_all = [(r.get(d, 0), r["votes"], r["year"]) for r in results
                        if r.get(d) is not None and not (isinstance(r.get(d), float) and math.isnan(r.get(d)))]
            if not vals_all:
                continue

            vv = [x[0] for x in vals_all]
            vvo = [x[1] for x in vals_all]

            w(f"### {label}")
            w("")

            if d in CATEGORICAL_DIMS:
                # Show distribution table
                cat_map = CATEGORICAL_DIMS[d]
                w(f"| Category | n | Median Votes | Mean Votes |")
                w("|---|---|---|---|")
                by_cat = {}
                for v, vo, yr in vals_all:
                    cat = cat_map.get(int(v), f"unknown({v})")
                    by_cat.setdefault(cat, []).append(vo)
                for cat in cat_map.values():
                    if cat in by_cat:
                        cv = by_cat[cat]
                        w(f"| {cat} | {len(cv)} | {median(cv)} | {sum(cv)//len(cv)} |")
                w("")

                # Year breakdown
                w(f"**By Year:**")
                w("")
                w(f"| Category | 2024 | 2025 | 2026 |")
                w("|---|---|---|---|")
                for cat_val, cat_name in cat_map.items():
                    row = f"| {cat_name}"
                    for yr in ["2024", "2025", "2026"]:
                        yr_votes = [vo for v, vo, y in vals_all if int(v) == cat_val and y == yr]
                        if yr_votes:
                            row += f" | {len(yr_votes)} (med {median(yr_votes)})"
                        else:
                            row += f" | —"
                    w(row + " |")
                w("")

            elif d in BOOLEAN_DIMS:
                has = [vo for v, vo, yr in vals_all if v == 1 or v is True]
                no = [vo for v, vo, yr in vals_all if v == 0 or v is False]
                n_has = len(has)
                pct = n_has * 100 // len(vals_all) if vals_all else 0
                w(f"| | n | Median Votes |")
                w(f"|---|---|---|")
                if has:
                    w(f"| Has | {n_has} ({pct}%) | {median(has)} |")
                if no:
                    w(f"| No | {len(no)} ({100-pct}%) | {median(no)} |")
                w("")

                if d not in SKIP_CORR:
                    r_val = spearman_r(vv, vvo)
                    w(f"Spearman r = {r_val:+.3f}")
                    w("")

                # Year shift
                w(f"**By Year:**")
                w("")
                w(f"| Year | Usage % | Has (med) | No (med) | Lift |")
                w("|---|---|---|---|---|")
                for yr in ["2024", "2025", "2026"]:
                    yr_has = [vo for v, vo, y in vals_all if (v == 1 or v is True) and y == yr]
                    yr_no = [vo for v, vo, y in vals_all if (v == 0 or v is False) and y == yr]
                    yr_total = len(yr_has) + len(yr_no)
                    if yr_total > 0:
                        pct_yr = len(yr_has) * 100 // yr_total
                        med_has = median(yr_has) if yr_has else 0
                        med_no = median(yr_no) if yr_no else 0
                        lift = med_has - med_no if yr_has and yr_no else 0
                        w(f"| {yr} | {pct_yr}% | {med_has} | {med_no} | {lift:+d} |")
                w("")

            else:
                # Continuous: median split + correlation
                r_val = spearman_r(vv, vvo) if d not in SKIP_CORR else 0
                med_val = median(vv)

                high = [vo for v, vo, yr in vals_all if v > med_val]
                low = [vo for v, vo, yr in vals_all if v <= med_val]

                w(f"Spearman r = {r_val:+.3f}" if d not in SKIP_CORR else "")
                w("")
                if high and low:
                    w(f"| Split | n | Median Votes |")
                    w(f"|---|---|---|")
                    w(f"| Above median (>{med_val:.2f}) | {len(high)} | {median(high)} |")
                    w(f"| Below median | {len(low)} | {median(low)} |")
                    w("")

                # Year-over-year correlation shift
                w(f"**Year-over-Year Shift:**")
                w("")
                w(f"| Year | r | High vs Low (median) |")
                w("|---|---|---|")
                for yr in ["2024", "2025", "2026"]:
                    yr_data = [(v, vo) for v, vo, y in vals_all if y == yr]
                    if len(yr_data) >= 20 and d not in SKIP_CORR:
                        yr_v, yr_vo = zip(*yr_data)
                        yr_r = spearman_r(list(yr_v), list(yr_vo))
                        yr_high = [vo for v, vo in yr_data if v > med_val]
                        yr_low = [vo for v, vo in yr_data if v <= med_val]
                        h_med = median(yr_high) if yr_high else 0
                        l_med = median(yr_low) if yr_low else 0
                        w(f"| {yr} | {yr_r:+.3f} | {h_med} vs {l_med} |")
                    elif len(yr_data) >= 5 and d in SKIP_CORR:
                        # Just show distribution for positional/categorical
                        yr_high = [vo for v, vo in yr_data if v > med_val]
                        yr_low = [vo for v, vo in yr_data if v <= med_val]
                        h_med = median(yr_high) if yr_high else 0
                        l_med = median(yr_low) if yr_low else 0
                        w(f"| {yr} | — | {h_med} vs {l_med} |")
                w("")

        w("---")
        w("")

    # === BIGGEST TEMPORAL SHIFTS — CONTINUOUS ===
    w("## Temporal Shifts — Continuous Dimensions (2024 → 2026)")
    w("")
    w("| Dimension | 2024 r | 2025 r | 2026 r | Shift | Direction |")
    w("|---|---|---|---|---|---|")

    cont_dims_set = {d for d, _, _, _, _, _ in all_continuous}
    shifts = []
    for d, label, _ in all_dims:
        if d not in cont_dims_set:
            continue
        yr_rs = {}
        for yr in ["2024", "2025", "2026"]:
            yr_data = [(r.get(d, 0), r["votes"]) for r in results if r["year"] == yr and r.get(d) is not None]
            if len(yr_data) >= 20:
                yr_v, yr_vo = zip(*yr_data)
                yr_rs[yr] = spearman_r(list(yr_v), list(yr_vo))
        if "2024" in yr_rs and "2026" in yr_rs:
            shift = yr_rs["2026"] - yr_rs["2024"]
            shifts.append((d, label, yr_rs.get("2024", 0), yr_rs.get("2025", 0), yr_rs.get("2026", 0), shift))

    shifts.sort(key=lambda x: -abs(x[5]))
    for d, label, r24, r25, r26, shift in shifts[:25]:
        direction = "↑ growing" if shift > 0 else "↓ declining"
        w(f"| {label} | {r24:+.3f} | {r25:+.3f} | {r26:+.3f} | {shift:+.3f} | {direction} |")

    w("")
    w("---")
    w("")

    # === BIGGEST TEMPORAL SHIFTS — BOOLEAN (lift-based) ===
    w("## Temporal Shifts — Boolean Dimensions (2024 → 2026)")
    w("")
    w("| Dimension | 2024 (usage%, lift) | 2025 (usage%, lift) | 2026 (usage%, lift) | Trend |")
    w("|---|---|---|---|---|")

    bool_dims_set = {d for d, _, _, _, _, _, _ in all_booleans}
    bool_shifts = []
    for d, label, _, _, _, _, _ in all_booleans:
        yr_lifts = {}
        yr_usage = {}
        for yr in ["2024", "2025", "2026"]:
            yr_has = [r["votes"] for r in results if r["year"] == yr and r.get(d, 0) > 0]
            yr_no = [r["votes"] for r in results if r["year"] == yr and r.get(d, 0) == 0]
            yr_total = len(yr_has) + len(yr_no)
            if yr_total > 10:
                yr_lifts[yr] = median(yr_has) - median(yr_no) if yr_has and yr_no else 0
                yr_usage[yr] = len(yr_has) * 100 // yr_total
        if "2024" in yr_lifts and "2026" in yr_lifts:
            shift = yr_lifts["2026"] - yr_lifts["2024"]
            bool_shifts.append((d, label, yr_usage, yr_lifts, shift))

    bool_shifts.sort(key=lambda x: -abs(x[4]))
    for d, label, usage, lifts, shift in bool_shifts[:20]:
        trend = "↑" if shift > 0 else "↓"
        cols = []
        for yr in ["2024", "2025", "2026"]:
            if yr in lifts:
                cols.append(f"{usage.get(yr,0)}%, {lifts[yr]:+d}")
            else:
                cols.append("—")
        w(f"| {label} | {cols[0]} | {cols[1]} | {cols[2]} | {trend} {shift:+d} |")

    w("")
    w("---")
    w("")

    # === TOP 1% DEEP DIVE ===
    w("## Top 1% Deep Dive — Story & Persuasion Profile")
    w("")
    top_n = max(1, len(results) // 100)
    top = sorted(results, key=lambda x: -x["votes"])[:top_n]
    rest = sorted(results, key=lambda x: -x["votes"])[top_n:]

    w(f"**Top {top_n} products** vs rest of dataset:")
    w("")
    w("| Dimension | Top 1% | Dataset | Gap |")
    w("|---|---|---|---|")

    for d in BOOLEAN_DIMS:
        if d in DIMENSION_LABELS:
            top_pct = sum(1 for t in top if t.get(d, 0) == 1) * 100 // max(len(top), 1)
            rest_pct = sum(1 for t in rest if t.get(d, 0) == 1) * 100 // max(len(rest), 1)
            gap = top_pct - rest_pct
            if abs(gap) >= 3:
                label = DIMENSION_LABELS[d]
                w(f"| {label} | {top_pct}% | {rest_pct}% | {gap:+d}pp |")

    w("")
    w("---")
    w("")
    w(f"*Analysis generated by merge_and_report.py*")
    w(f"*{len(results)} transcripts analyzed across 100 new dimensions*")

    return "\n".join(lines)


if __name__ == "__main__":
    print("Loading and merging batches...")
    results = load_and_merge()
    print(f"Merged: {len(results)} records")

    print("Generating report...")
    report = generate_report(results)

    out_path = "launch-video-analysis/ph/findings/ph_transcript_analysis_v2_report.md"
    with open(out_path, "w") as f:
        f.write(report)
    print(f"Report written to {out_path}")
    print(f"Report length: {len(report)} chars, {len(report.splitlines())} lines")
