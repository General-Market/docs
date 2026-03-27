"""Merge all 20 LLM-extracted batch outputs and generate the definitive v3 report."""
import json, math, sys, os
from collections import Counter

DATA_PATH = "launch-video-analysis/ph/data/ph_daily_top_with_transcripts.json"
LLM_PARTS = "launch-video-analysis/ph/v2-llm-parts"
OUTPUT_JSON = "launch-video-analysis/ph/analyses/ph_llm_200dim_results.json"
OUTPUT_REPORT = "launch-video-analysis/ph/findings/ph_transcript_analysis_v3_report.md"

# ── helpers ──────────────────────────────────────────────────────────────────

def median(vals):
    if not vals: return 0
    s = sorted(vals)
    return s[len(s) // 2]

def mean(vals):
    if not vals: return 0
    return sum(vals) / len(vals)

def spearman_r(x, y):
    n = len(x)
    if n < 10: return 0.0
    def rank(arr):
        idx = sorted(range(n), key=lambda i: arr[i])
        ranks = [0.0] * n
        i = 0
        while i < n:
            j = i
            while j < n - 1 and arr[idx[j]] == arr[idx[j+1]]:
                j += 1
            avg = (i + j) / 2.0 + 1
            for k in range(i, j + 1):
                ranks[idx[k]] = avg
            i = j + 1
        return ranks
    rx, ry = rank(x), rank(y)
    d2 = sum((rx[i] - ry[i]) ** 2 for i in range(n))
    return 1 - (6 * d2) / (n * (n * n - 1))

# ── load and merge ───────────────────────────────────────────────────────────

def load_transcripts():
    with open(DATA_PATH) as f:
        data = json.load(f)
    return {
        x["id"]: {
            "votes": x["votes"], "date": x["date"], "year": x["date"][:4],
            "name": x["name"], "comments": x.get("comments", 0),
        }
        for x in data
        if x.get("transcript", "").strip() and len(x.get("transcript", "").split()) >= 20
    }

def load_and_merge():
    tx_meta = load_transcripts()
    merged = {}
    batch_count = 0

    for i in range(20):
        path = f"{LLM_PARTS}/output_batch_{i:02d}.json"
        if not os.path.exists(path):
            print(f"  MISSING: batch_{i:02d}")
            continue
        try:
            data = json.load(open(path))
        except json.JSONDecodeError as e:
            print(f"  INVALID JSON: batch_{i:02d} — {e}")
            continue

        batch_count += 1
        for row in data:
            rid = str(row.get("id", ""))
            if rid and rid in tx_meta:
                merged[rid] = row
                merged[rid].update(tx_meta[rid])

    print(f"  Loaded {batch_count}/20 batches, {len(merged)} unique transcripts")
    return list(merged.values()), batch_count

# ── classify dimensions ──────────────────────────────────────────────────────

BOOLEAN_DIMS = {
    "first_person_opener", "has_negative_opener", "declining_arc",
    "has_investor_mention", "has_testimonial", "trusted_by", "has_partnership",
    "has_credential", "has_discount", "has_scarcity", "has_pricing", "has_url",
    "closing_has_cta", "closing_has_thanks", "storytelling", "humor",
    "inciting_incident", "villain_named", "stakes_escalation", "transformation_promise",
    "nested_stories", "why_now", "emotional_bookend_match",
    "empathy_firsthand", "empathy_observed", "vulnerability_moment",
    "effort_reduction_specific", "effort_reduction_vague", "demo_voice_present_tense",
    "progressive_disclosure", "one_more_thing", "under_the_hood",
    "onboarding_time_claim", "comparison_moment", "reciprocity_trigger",
    "anchor_contrast_pricing", "bandwagon_gradient", "open_loop_closing",
    "definitive_closing",
}

CATEGORICAL_DIMS = {
    "hook_type", "pronoun_strategy", "narrative_arc", "metric_placement",
    "primary_cta", "cta_position", "sentiment",
    "social_proof_stacking_order", "authority_type", "scarcity_type",
    "jargon_distribution_shape", "info_density_shape",
}

SKIP_CORR = CATEGORICAL_DIMS  # Can't Spearman on strings

SCALE_DIMS = {
    "hook_quality", "pivot_sharpness", "story_compression",
    "emotion_specificity", "joy_velocity_shift", "confidence_gradient",
    "emotional_contrast_ratio", "empathy_depth",
    "feature_intro_velocity", "concrete_vs_abstract", "liveness_score",
    "verb_energy", "sentence_rhythm_variance", "power_word_cluster_density",
    "transition_sophistication", "specificity_index", "word_rarity_score",
    "conclusive_finality", "breathing_room", "section_length_cv",
    "setup_payoff_distance", "voice_consistency", "closing_velocity",
}

# ── report generation ────────────────────────────────────────────────────────

def generate_report(results):
    lines = []
    w = lines.append

    w("# PH Transcript Analysis V3 — LLM-Extracted 200 Dimensions")
    w("")
    w(f"**Dataset:** {len(results)} Product Hunt transcripts with ≥20 words.")
    w(f"**Method:** Semantic extraction via 20 parallel LLM agents (not regex).")
    w(f"**Dimensions:** ~170 extracted per transcript (V1 re-extracted + V2 new).")
    w("")
    years = {}
    for r in results:
        y = r.get("year", "?")
        years.setdefault(y, []).append(r["votes"])
    for y in sorted(years):
        w(f"- {y}: {len(years[y])} transcripts, median {median(years[y])} votes")
    w("")
    w("---")
    w("")

    # Collect all numeric dimension keys
    sample = results[0]
    all_keys = sorted([k for k in sample.keys()
                       if k not in ("id","name","date","year","votes","comments")])

    # ── SECTION 1: Continuous + Scale dims (Spearman) ──
    w("## 1. Continuous & Scale Dimensions — Ranked by Spearman r")
    w("")
    w("| # | Dimension | r | High med | Low med | Lift | n |")
    w("|---|---|---|---|---|---|---|")

    continuous_results = []
    for dim in all_keys:
        if dim in CATEGORICAL_DIMS or dim in BOOLEAN_DIMS:
            continue
        pairs = []
        for r in results:
            v = r.get(dim)
            if v is None: continue
            if isinstance(v, str): continue
            if isinstance(v, (list, dict)): continue
            try:
                v = float(v)
                if math.isnan(v): continue
            except (ValueError, TypeError):
                continue
            pairs.append((v, r["votes"]))

        if len(pairs) < 30: continue
        # Check variance — skip if all same value
        vals = [p[0] for p in pairs]
        if len(set(vals)) < 3: continue

        vv, vvo = zip(*pairs)
        r_val = spearman_r(list(vv), list(vvo))
        med_val = median(list(vv))
        high = [vo for v, vo in pairs if v > med_val]
        low = [vo for v, vo in pairs if v <= med_val]
        if not high or not low: continue
        h_med = median(high)
        l_med = median(low)
        lift = h_med - l_med
        continuous_results.append((dim, r_val, h_med, l_med, lift, len(pairs)))

    continuous_results.sort(key=lambda x: -x[1])
    for i, (dim, r_val, h_med, l_med, lift, n) in enumerate(continuous_results, 1):
        bold = "**" if abs(r_val) >= 0.06 else ""
        w(f"| {i} | {bold}{dim}{bold} | {r_val:+.3f} | {h_med} | {l_med} | {lift:+d} | {n} |")

    w("")
    w("---")
    w("")

    # ── SECTION 2: Boolean dims (median lift) ──
    w("## 2. Boolean Dimensions — Ranked by Median Vote Lift")
    w("")
    w("| # | Dimension | Has (n) | Has (med) | No (med) | Lift | Prevalence |")
    w("|---|---|---|---|---|---|---|")

    bool_results = []
    for dim in all_keys:
        if dim not in BOOLEAN_DIMS: continue
        has = [r["votes"] for r in results if r.get(dim) in (1, True, "1")]
        no = [r["votes"] for r in results if r.get(dim) in (0, False, "0")]
        if not has or not no: continue
        h_med = median(has)
        n_med = median(no)
        lift = h_med - n_med
        prev = len(has) * 100 // (len(has) + len(no))
        bool_results.append((dim, len(has), h_med, n_med, lift, prev))

    bool_results.sort(key=lambda x: -x[4])
    for i, (dim, n_has, h_med, n_med, lift, prev) in enumerate(bool_results, 1):
        bold = "**" if abs(lift) >= 10 else ""
        flag = " ⚠" if n_has < 30 else ""
        w(f"| {i} | {bold}{dim}{bold} | {n_has}{flag} | {h_med} | {n_med} | {lift:+d} | {prev}% |")

    w("")
    w("---")
    w("")

    # ── SECTION 3: Categorical dims ──
    w("## 3. Categorical Dimensions")
    w("")

    for dim in sorted(CATEGORICAL_DIMS):
        counts = Counter()
        vote_map = {}
        for r in results:
            v = str(r.get(dim, "")).strip().lower()
            if not v or v in ("none", "null", ""): v = "none"
            counts[v] += 1
            vote_map.setdefault(v, []).append(r["votes"])

        if not counts: continue
        w(f"### {dim}")
        w("")
        w(f"| Value | n | Median Votes | Mean Votes |")
        w(f"|---|---|---|---|")
        for val, n in counts.most_common():
            vm = vote_map[val]
            w(f"| {val} | {n} | {median(vm)} | {int(mean(vm))} |")
        w("")

    w("---")
    w("")

    # ── SECTION 4: Year-over-Year Shifts (continuous) ──
    w("## 4. Temporal Shifts — Continuous Dimensions (2024 → 2025 → 2026)")
    w("")
    w("| Dimension | 2024 r | 2025 r | 2026 r | Shift (24→26) | Direction |")
    w("|---|---|---|---|---|---|")

    shifts = []
    for dim, r_val, _, _, _, _ in continuous_results:
        yr_rs = {}
        for yr in ["2024", "2025", "2026"]:
            pairs = [(float(r.get(dim, 0)), r["votes"]) for r in results
                     if r.get("year") == yr and r.get(dim) is not None
                     and isinstance(r.get(dim), (int, float))]
            if len(pairs) >= 20:
                vv, vvo = zip(*pairs)
                yr_rs[yr] = spearman_r(list(vv), list(vvo))
        if "2024" in yr_rs and "2026" in yr_rs:
            shift = yr_rs["2026"] - yr_rs["2024"]
            shifts.append((dim, yr_rs.get("2024",0), yr_rs.get("2025",0), yr_rs.get("2026",0), shift))

    shifts.sort(key=lambda x: -abs(x[4]))
    for dim, r24, r25, r26, shift in shifts[:30]:
        direction = "↑ growing" if shift > 0 else "↓ declining"
        w(f"| {dim} | {r24:+.3f} | {r25:+.3f} | {r26:+.3f} | {shift:+.3f} | {direction} |")

    w("")
    w("---")
    w("")

    # ── SECTION 5: Year-over-Year Shifts (boolean) ──
    w("## 5. Temporal Shifts — Boolean Dimensions (2024 → 2025 → 2026)")
    w("")
    w("| Dimension | 2024 (usage%, lift) | 2025 (usage%, lift) | 2026 (usage%, lift) | Trend |")
    w("|---|---|---|---|---|")

    bool_shifts = []
    for dim, _, _, _, _, _ in bool_results:
        yr_data = {}
        for yr in ["2024", "2025", "2026"]:
            has = [r["votes"] for r in results if r.get("year") == yr and r.get(dim) in (1, True, "1")]
            no = [r["votes"] for r in results if r.get("year") == yr and r.get(dim) in (0, False, "0")]
            total = len(has) + len(no)
            if total >= 20:
                yr_data[yr] = {
                    "usage": len(has) * 100 // total,
                    "lift": median(has) - median(no) if has and no else 0,
                }
        if "2024" in yr_data and "2026" in yr_data:
            shift = yr_data["2026"]["lift"] - yr_data["2024"]["lift"]
            bool_shifts.append((dim, yr_data, shift))

    bool_shifts.sort(key=lambda x: -abs(x[2]))
    for dim, yd, shift in bool_shifts[:25]:
        trend = "↑" if shift > 0 else "↓"
        cols = []
        for yr in ["2024", "2025", "2026"]:
            if yr in yd:
                cols.append(f"{yd[yr]['usage']}%, {yd[yr]['lift']:+d}")
            else:
                cols.append("—")
        w(f"| {dim} | {cols[0]} | {cols[1]} | {cols[2]} | {trend} {shift:+d} |")

    w("")
    w("---")
    w("")

    # ── SECTION 6: Scale dimension distributions ──
    w("## 6. Scale Dimensions — Distribution Check")
    w("")
    w("| Dimension | Min | Max | Mean | Median | Std | r vs votes |")
    w("|---|---|---|---|---|---|---|")

    for dim in sorted(SCALE_DIMS):
        vals = [float(r.get(dim, 0)) for r in results
                if isinstance(r.get(dim), (int, float)) and r.get(dim) is not None]
        if not vals: continue
        votes = [r["votes"] for r in results
                 if isinstance(r.get(dim), (int, float)) and r.get(dim) is not None]
        r_val = spearman_r(vals, votes) if len(vals) >= 20 else 0
        mn, mx = min(vals), max(vals)
        avg = mean(vals)
        med = median(vals)
        std = math.sqrt(sum((v - avg)**2 for v in vals) / len(vals)) if len(vals) > 1 else 0
        w(f"| {dim} | {mn:.0f} | {mx:.0f} | {avg:.1f} | {med:.0f} | {std:.1f} | {r_val:+.3f} |")

    w("")
    w("---")
    w("")

    # ── SECTION 7: Top 1% deep dive ──
    w("## 7. Top 1% Deep Dive")
    w("")
    top_n = max(1, len(results) // 100)
    top = sorted(results, key=lambda x: -x["votes"])[:top_n]
    rest = sorted(results, key=lambda x: -x["votes"])[top_n:]

    w(f"**Top {top_n} products** vs rest:")
    w("")
    w("| Dimension | Top 1% | Dataset | Gap |")
    w("|---|---|---|---|")

    for dim in sorted(BOOLEAN_DIMS):
        top_has = sum(1 for t in top if t.get(dim) in (1, True, "1"))
        rest_has = sum(1 for t in rest if t.get(dim) in (1, True, "1"))
        top_pct = top_has * 100 // max(len(top), 1)
        rest_pct = rest_has * 100 // max(len(rest), 1)
        gap = top_pct - rest_pct
        if abs(gap) >= 5:
            w(f"| {dim} | {top_pct}% | {rest_pct}% | {gap:+d}pp |")

    for dim in sorted(SCALE_DIMS):
        top_vals = [float(t.get(dim, 0)) for t in top if isinstance(t.get(dim), (int, float))]
        rest_vals = [float(t.get(dim, 0)) for t in rest if isinstance(t.get(dim), (int, float))]
        if top_vals and rest_vals:
            top_avg = mean(top_vals)
            rest_avg = mean(rest_vals)
            gap = top_avg - rest_avg
            if abs(gap) >= 0.3:
                w(f"| {dim} (avg) | {top_avg:.1f} | {rest_avg:.1f} | {gap:+.1f} |")

    w("")
    w("---")
    w("")
    w(f"*Analysis generated from {len(results)} transcripts across ~170 LLM-extracted dimensions*")

    return "\n".join(lines)


# ── main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Loading and merging LLM batches...")
    results, batch_count = load_and_merge()

    if not results:
        print("No results to process!")
        sys.exit(1)

    # Save merged JSON
    print(f"Saving merged JSON ({len(results)} records)...")
    with open(OUTPUT_JSON, "w") as f:
        json.dump(results, f, indent=1)
    print(f"  → {OUTPUT_JSON}")

    # Generate report
    print("Generating report...")
    report = generate_report(results)
    with open(OUTPUT_REPORT, "w") as f:
        f.write(report)
    print(f"  → {OUTPUT_REPORT} ({len(report)} chars, {len(report.splitlines())} lines)")
