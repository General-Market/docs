#!/usr/bin/env python3
"""
Correlate all 50 extended video analysis dimensions with votes.
Produces structured output for the findings report.
"""

import json
import glob
import re
import numpy as np
from collections import defaultdict, Counter
from scipy import stats

# Load enriched launches
launches = json.load(open('yc_launches_enriched.json'))

# Build video_id -> launch mapping
launch_by_vid = {}
for launch in launches:
    if not launch.get('video_urls'):
        continue
    urls = launch['video_urls'].split(' | ') if ' | ' in launch['video_urls'] else [launch['video_urls']]
    for url in urls:
        for pattern in [r'youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})',
                        r'youtu\.be/([a-zA-Z0-9_-]{11})']:
            m = re.search(pattern, url)
            if m:
                launch_by_vid[m.group(1)] = launch
                break

# Load extended analyses
analyses = []
for f in sorted(glob.glob('video_analyses_extended/*.json')):
    try:
        d = json.load(open(f))
        if d.get('status') != 'ok':
            continue
        vid = d['video_id']
        launch = launch_by_vid.get(vid)
        if launch and launch.get('votes') is not None:
            d['votes'] = launch['votes']
            d['company_name'] = launch.get('company_name', '')
            d['industry'] = launch.get('industry', '')
            analyses.append(d)
    except Exception:
        pass

print(f"Analyses with votes: {len(analyses)}")
print(f"Vote range: {min(a['votes'] for a in analyses)} - {max(a['votes'] for a in analyses)}")
print(f"Median: {np.median([a['votes'] for a in analyses]):.0f}, Mean: {np.mean([a['votes'] for a in analyses]):.0f}")

votes = np.array([a['votes'] for a in analyses])


def bucket_analysis(values, buckets, label=""):
    """Print bucketed analysis."""
    for lo, hi, name in buckets:
        subset_votes = [v for val, v in zip(values, votes) if lo <= val < hi]
        if len(subset_votes) >= 5:
            print(f"  {name:35s}: n={len(subset_votes):4d}  avg={np.mean(subset_votes):7.1f}  median={np.median(subset_votes):6.0f}")


def bool_split(key, path='visual'):
    """Split by boolean field."""
    true_v = [a['votes'] for a in analyses if a.get(path, {}).get(key)]
    false_v = [a['votes'] for a in analyses if not a.get(path, {}).get(key)]
    if len(true_v) >= 5 and len(false_v) >= 5:
        diff = np.median(true_v) - np.median(false_v)
        sig = ""
        if len(true_v) >= 10 and len(false_v) >= 10:
            _, p = stats.mannwhitneyu(true_v, false_v, alternative='two-sided')
            sig = f"  p={p:.3f}" + (" ***" if p < 0.01 else " **" if p < 0.05 else " *" if p < 0.1 else "")
        print(f"  Yes: n={len(true_v):4d}  median={np.median(true_v):6.0f}  |  No: n={len(false_v):4d}  median={np.median(false_v):6.0f}  |  diff={diff:+.0f}{sig}")
    else:
        print(f"  Yes: n={len(true_v):4d}  |  No: n={len(false_v):4d}  (too few for comparison)")


def continuous_corr(key, path='visual', label=""):
    """Spearman correlation for continuous variable."""
    vals = []
    v = []
    for a in analyses:
        val = a.get(path, {}).get(key)
        if val is not None and not isinstance(val, (dict, list, str, bool)):
            vals.append(float(val))
            v.append(a['votes'])
    if len(vals) >= 20:
        r, p = stats.spearmanr(vals, v)
        sig = "***" if p < 0.01 else "**" if p < 0.05 else "*" if p < 0.1 else ""
        print(f"  {label or key:40s}: r={r:+.3f}  p={p:.4f} {sig}")
    else:
        print(f"  {label or key}: insufficient data (n={len(vals)})")


# ============================================================
print("\n" + "=" * 70)
print("PART A: VISUAL DIMENSIONS")
print("=" * 70)

# --- DIM 4/17: Face Detection ---
print("\n--- DIM 4/17: FACE PRESENCE ---")
continuous_corr('face_presence_pct', label='Face presence %')

face_pcts = [a['visual']['face_presence_pct'] for a in analyses]
bucket_analysis(face_pcts, [
    (0, 0.01, "No faces detected"),
    (0.01, 0.2, "Face in <20% of frames"),
    (0.2, 0.5, "Face in 20-50% of frames"),
    (0.5, 0.8, "Face in 50-80% of frames"),
    (0.8, 1.01, "Face in >80% of frames"),
])

print("\n  Multiple people on screen:")
bool_split('has_multiple_people')

print("\n  Face size (avg % of frame):")
continuous_corr('avg_face_size_pct', label='Avg face size %')

# --- DIM 12: Bitrate ---
print("\n--- DIM 12: BITRATE / FILE SIZE ---")
continuous_corr('bitrate_kbps', label='Bitrate (kbps)')
continuous_corr('file_size_mb', label='File size (MB)')

bitrates = [a['visual']['bitrate_kbps'] for a in analyses]
bucket_analysis(bitrates, [
    (0, 200, "<200 kbps (low quality)"),
    (200, 500, "200-500 kbps"),
    (500, 1000, "500-1000 kbps"),
    (1000, 2000, "1000-2000 kbps"),
    (2000, 99999, ">2000 kbps (high quality)"),
])

# --- DIM 13: Picture-in-Picture ---
print("\n--- DIM 13: PICTURE-IN-PICTURE ---")
bool_split('has_pip')

# --- DIM 18: Background Blur / DOF ---
print("\n--- DIM 18: BACKGROUND BLUR (Laplacian variance) ---")
continuous_corr('avg_blur_score', label='Avg blur score (higher=sharper)')

blur_vals = [a['visual']['avg_blur_score'] for a in analyses]
bucket_analysis(blur_vals, [
    (0, 500, "Very blurry (<500)"),
    (500, 2000, "Moderate blur (500-2000)"),
    (2000, 5000, "Sharp (2000-5000)"),
    (5000, 10000, "Very sharp (5000-10000)"),
    (10000, 999999, "Ultra sharp (>10000)"),
])

# --- DIM 5: Motion Intensity ---
print("\n--- DIM 5: MOTION INTENSITY ---")
continuous_corr('avg_motion', label='Avg motion')
continuous_corr('motion_variance', label='Motion variance')

motion_vals = [a['visual']['avg_motion'] for a in analyses]
bucket_analysis(motion_vals, [
    (0, 3, "Very static (<3)"),
    (3, 8, "Low motion (3-8)"),
    (8, 15, "Medium motion (8-15)"),
    (15, 30, "High motion (15-30)"),
    (30, 999, "Very dynamic (>30)"),
])

# --- DIM 9: Brightness Trajectory ---
print("\n--- DIM 9: BRIGHTNESS TRAJECTORY ---")
continuous_corr('brightness_trend', label='Brightness trend (+ = gets brighter)')
continuous_corr('avg_brightness', label='Avg brightness')

trends = [a['visual']['brightness_trend'] for a in analyses]
bucket_analysis(trends, [
    (-999, -20, "Gets much darker"),
    (-20, -5, "Gets slightly darker"),
    (-5, 5, "Stays constant"),
    (5, 20, "Gets slightly brighter"),
    (20, 999, "Gets much brighter"),
])

# --- DIM 20: Browser Chrome ---
print("\n--- DIM 20: BROWSER CHROME DETECTION ---")
chrome_pcts = [a['visual']['browser_chrome_pct'] for a in analyses]
bucket_analysis(chrome_pcts, [
    (0, 0.01, "No browser chrome"),
    (0.01, 0.2, "Some browser chrome"),
    (0.2, 1.01, "Heavy browser chrome (>20%)"),
])
continuous_corr('browser_chrome_pct', label='Browser chrome %')

# --- DIM 22: Dark/Light Mode ---
print("\n--- DIM 22: DARK MODE vs LIGHT MODE ---")
continuous_corr('dark_mode_pct', label='Dark mode %')
continuous_corr('light_mode_pct', label='Light mode %')

dark_pcts = [a['visual']['dark_mode_pct'] for a in analyses]
bucket_analysis(dark_pcts, [
    (0, 0.1, "Mostly light"),
    (0.1, 0.4, "Mixed"),
    (0.4, 0.7, "Mostly dark"),
    (0.7, 1.01, "Overwhelmingly dark"),
])

# --- DIM 24: Annotations ---
print("\n--- DIM 24: ANNOTATIONS (circles, highlights) ---")
bool_split('has_annotations')
continuous_corr('annotation_frames', label='Annotation frame count')

# --- DIM 28: Letterboxing ---
print("\n--- DIM 28: LETTERBOXING ---")
bool_split('has_letterbox')

# --- DIM 29: Intro Duration ---
print("\n--- DIM 29: INTRO DURATION ---")
continuous_corr('intro_duration_sec', label='Intro duration (sec)')

intro_vals = [a['visual']['intro_duration_sec'] for a in analyses]
bucket_analysis(intro_vals, [
    (0, 0.5, "No intro (instant content)"),
    (0.5, 3.1, "Short intro (<3s)"),
    (3.1, 6.1, "Medium intro (3-6s)"),
    (6.1, 999, "Long intro (>6s)"),
])

# --- DIM 30: End Card ---
print("\n--- DIM 30: END CARD ---")
continuous_corr('end_card_duration_sec', label='End card duration (sec)')

# --- DIM 31: Color Temperature ---
print("\n--- DIM 31: COLOR TEMPERATURE ---")
temp_groups = defaultdict(list)
for a in analyses:
    temp_groups[a['visual']['dominant_color_temp']].append(a['votes'])
for label in ['warm', 'neutral', 'cool']:
    v = temp_groups.get(label, [])
    if len(v) >= 5:
        print(f"  {label:10s}: n={len(v):4d}  avg={np.mean(v):7.1f}  median={np.median(v):6.0f}")

continuous_corr('warm_frame_pct', label='Warm frame %')
continuous_corr('cool_frame_pct', label='Cool frame %')
continuous_corr('avg_saturation', label='Avg saturation')

# --- DIM 7: First/Last Frame ---
print("\n--- DIM 7: FIRST FRAME ---")
first_dark = [a['votes'] for a in analyses if a['visual'].get('first_frame', {}).get('is_dark')]
first_white = [a['votes'] for a in analyses if a['visual'].get('first_frame', {}).get('is_white')]
first_face = [a['votes'] for a in analyses if a['visual'].get('first_frame', {}).get('has_face')]
first_other = [a['votes'] for a in analyses if not a['visual'].get('first_frame', {}).get('is_dark')
               and not a['visual'].get('first_frame', {}).get('is_white')
               and not a['visual'].get('first_frame', {}).get('has_face')]
for label, v in [("Dark first frame", first_dark), ("White first frame", first_white),
                  ("Face in first frame", first_face), ("Other first frame", first_other)]:
    if len(v) >= 5:
        print(f"  {label:25s}: n={len(v):4d}  avg={np.mean(v):7.1f}  median={np.median(v):6.0f}")

# ============================================================
print("\n" + "=" * 70)
print("PART B: MARKETING / TEXT DIMENSIONS")
print("=" * 70)

# --- DIM 32: Value Prop Placement ---
print("\n--- DIM 32: VALUE PROPOSITION PLACEMENT ---")
vp_groups = defaultdict(list)
for a in analyses:
    vp_groups[a.get('marketing', {}).get('value_prop_placement', 'none')].append(a['votes'])
for label in ['early', 'middle', 'late', 'none']:
    v = vp_groups.get(label, [])
    if len(v) >= 5:
        print(f"  {label:10s}: n={len(v):4d}  avg={np.mean(v):7.1f}  median={np.median(v):6.0f}")

# --- DIM 33: Problem → Solution Arc ---
print("\n--- DIM 33: PROBLEM → SOLUTION ARC ---")
bool_split('has_problem_solution_arc', 'marketing')

# --- DIM 34: Social Proof ---
print("\n--- DIM 34: SOCIAL PROOF ON SCREEN ---")
bool_split('has_social_proof', 'marketing')
continuous_corr('social_proof_count', 'marketing', 'Social proof count')

# --- DIM 35: Metrics/Numbers ---
print("\n--- DIM 35: METRICS ON SCREEN ---")
continuous_corr('metric_count', 'marketing', 'Metric count')

metric_counts = [a.get('marketing', {}).get('metric_count', 0) for a in analyses]
bucket_analysis(metric_counts, [
    (0, 1, "No metrics shown"),
    (1, 3, "1-2 metrics"),
    (3, 6, "3-5 metrics"),
    (6, 999, "6+ metrics"),
])

print("\n  Metric placement:")
mp_groups = defaultdict(list)
for a in analyses:
    mp = a.get('marketing', {}).get('metric_placement')
    if mp:
        mp_groups[mp].append(a['votes'])
for label in ['early', 'middle', 'late']:
    v = mp_groups.get(label, [])
    if len(v) >= 5:
        print(f"  {label:10s}: n={len(v):4d}  avg={np.mean(v):7.1f}  median={np.median(v):6.0f}")

# --- DIM 36: CTA ---
print("\n--- DIM 36: CALL TO ACTION ---")
bool_split('has_cta', 'marketing')

print("\n  CTA timing:")
cta_groups = defaultdict(list)
for a in analyses:
    ct = a.get('marketing', {}).get('cta_timing')
    if ct:
        cta_groups[ct].append(a['votes'])
for label in ['beginning', 'middle', 'end']:
    v = cta_groups.get(label, [])
    if len(v) >= 5:
        print(f"  {label:10s}: n={len(v):4d}  avg={np.mean(v):7.1f}  median={np.median(v):6.0f}")

# --- DIM 37: Competitor Mentions ---
print("\n--- DIM 37: COMPETITOR MENTIONS ---")
continuous_corr('competitor_mentions', 'marketing', 'Competitor mention count')
comp = [a.get('marketing', {}).get('competitor_mentions', 0) for a in analyses]
has_comp = [a['votes'] for a in analyses if a.get('marketing', {}).get('competitor_mentions', 0) > 0]
no_comp = [a['votes'] for a in analyses if a.get('marketing', {}).get('competitor_mentions', 0) == 0]
if len(has_comp) >= 5:
    print(f"  Has competitor mention: n={len(has_comp):4d}  median={np.median(has_comp):6.0f}")
    print(f"  No competitor mention:  n={len(no_comp):4d}  median={np.median(no_comp):6.0f}")

# --- DIM 38: Feature Count ---
print("\n--- DIM 38: FEATURE DENSITY ---")
continuous_corr('feature_count', 'marketing', 'Feature word count')
continuous_corr('features_per_min', 'marketing', 'Features per minute')

# --- DIM 39: Pricing ---
print("\n--- DIM 39: PRICING SHOWN ---")
bool_split('has_pricing', 'marketing')

# --- DIM 40: Text Length Variance ---
print("\n--- DIM 40: HEADLINE HIERARCHY (text length variance) ---")
continuous_corr('text_length_variance', 'marketing', 'Text length variance')

# --- DIM 41: Testimonial ---
print("\n--- DIM 41: TESTIMONIAL/QUOTE ---")
bool_split('has_testimonial', 'marketing')

# --- DIM 42: Step-by-Step ---
print("\n--- DIM 42: STEP-BY-STEP STRUCTURE ---")
bool_split('has_step_structure', 'marketing')

# --- DIM 43: Jargon Density ---
print("\n--- DIM 43: JARGON DENSITY ---")
continuous_corr('jargon_count', 'marketing', 'Jargon word count')
continuous_corr('jargon_density', 'marketing', 'Jargon density')

jargon_vals = [a.get('marketing', {}).get('jargon_count', 0) for a in analyses]
bucket_analysis(jargon_vals, [
    (0, 1, "No jargon"),
    (1, 3, "1-2 jargon words"),
    (3, 6, "3-5 jargon words"),
    (6, 999, "6+ jargon words"),
])

# --- DIM 44: Benefit vs Feature ---
print("\n--- DIM 44: BENEFIT vs FEATURE LANGUAGE ---")
continuous_corr('benefit_ratio', 'marketing', 'Benefit ratio (1=all benefits)')

br_vals = [a.get('marketing', {}).get('benefit_ratio', 0.5) for a in analyses]
bucket_analysis(br_vals, [
    (0, 0.3, "Feature-heavy (<30% benefits)"),
    (0.3, 0.5, "Balanced"),
    (0.5, 0.7, "Benefit-leaning"),
    (0.7, 1.01, "Benefit-heavy (>70%)"),
])

# --- DIM 45: Urgency/Scarcity ---
print("\n--- DIM 45: URGENCY/SCARCITY SIGNALS ---")
bool_split('has_urgency', 'marketing')
continuous_corr('urgency_count', 'marketing', 'Urgency word count')

# --- DIM 46: Brand Repetition ---
print("\n--- DIM 46: BRAND NAME REPETITION ---")
continuous_corr('brand_mentions', 'marketing', 'Brand mentions on screen')

brand_vals = [a.get('marketing', {}).get('brand_mentions', 0) for a in analyses]
bucket_analysis(brand_vals, [
    (0, 1, "Brand not shown"),
    (1, 2, "Brand shown once"),
    (2, 4, "2-3 mentions"),
    (4, 999, "4+ mentions"),
])

# --- DIM 47: Tagline Match ---
print("\n--- DIM 47: TAGLINE CONSISTENCY ---")
bool_split('tagline_match', 'marketing')

# --- DIM 48: Reading Comfort ---
print("\n--- DIM 48: SCREEN TEXT READING COMFORT ---")
continuous_corr('avg_reading_comfort', 'marketing', 'Avg reading comfort (>1 = readable)')

rc_vals = [a.get('marketing', {}).get('avg_reading_comfort', 0) for a in analyses]
bucket_analysis(rc_vals, [
    (0, 0.5, "Text too fast (<0.5)"),
    (0.5, 1, "Slightly rushed"),
    (1, 3, "Comfortable"),
    (3, 999, "Long display time (>3x)"),
])

# --- DIM 49: Emotional Arc ---
print("\n--- DIM 49: EMOTIONAL ARC ---")
arc_groups = defaultdict(list)
for a in analyses:
    arc = a.get('marketing', {}).get('emotional_arc', 'flat')
    arc_groups[arc].append(a['votes'])
for label in ['problem_to_solution', 'positive_escalation', 'flat', 'declining', 'mixed']:
    v = arc_groups.get(label, [])
    if len(v) >= 5:
        print(f"  {label:25s}: n={len(v):4d}  avg={np.mean(v):7.1f}  median={np.median(v):6.0f}")

# --- DIM 50: Questions on Screen ---
print("\n--- DIM 50: QUESTION MARKS ON SCREEN ---")
bool_split('has_questions', 'marketing')
continuous_corr('question_count', 'marketing', 'Question count')

# --- DIM 51: Acronym Density ---
print("\n--- DIM 51: ACRONYM DENSITY ---")
continuous_corr('acronym_count', 'marketing', 'Acronym count')
continuous_corr('acronym_density', 'marketing', 'Acronym density')

# --- DIM 15: URL Shown ---
print("\n--- DIM 15: URL SHOWN ON SCREEN ---")
bool_split('has_url_shown', 'marketing')

# --- DIM 25: Text Animation ---
print("\n--- DIM 25: TEXT ANIMATION ---")
bool_split('has_text_animation', 'marketing')

# --- DIM 26: Before/After ---
print("\n--- DIM 26: BEFORE/AFTER STRUCTURE ---")
bool_split('has_before_after', 'marketing')

# --- DIM 27: Data Visualization ---
print("\n--- DIM 27: DATA VISUALIZATION ---")
bool_split('has_data_viz', 'marketing')

# ============================================================
print("\n" + "=" * 70)
print("TOP QUARTILE vs BOTTOM QUARTILE — ALL 50 DIMENSIONS")
print("=" * 70)

sorted_by_votes = sorted(analyses, key=lambda x: x['votes'])
q_size = len(sorted_by_votes) // 4
bottom = sorted_by_votes[:q_size]
top = sorted_by_votes[-q_size:]

print(f"\n  Bottom 25%: n={len(bottom)}, votes <= {bottom[-1]['votes']}")
print(f"  Top 25%:    n={len(top)}, votes >= {top[0]['votes']}")

visual_metrics = [
    ('face_presence_pct', 'Face presence %'),
    ('avg_face_count', 'Avg face count'),
    ('bitrate_kbps', 'Bitrate kbps'),
    ('avg_blur_score', 'Blur score (sharpness)'),
    ('avg_motion', 'Avg motion'),
    ('avg_brightness', 'Avg brightness'),
    ('brightness_trend', 'Brightness trend'),
    ('browser_chrome_pct', 'Browser chrome %'),
    ('dark_mode_pct', 'Dark mode %'),
    ('light_mode_pct', 'Light mode %'),
    ('annotation_frames', 'Annotation frames'),
    ('intro_duration_sec', 'Intro duration sec'),
    ('warm_frame_pct', 'Warm frame %'),
    ('avg_saturation', 'Avg saturation'),
]

marketing_metrics = [
    ('social_proof_count', 'Social proof count'),
    ('metric_count', 'Metric count'),
    ('cta_count', 'CTA count'),
    ('competitor_mentions', 'Competitor mentions'),
    ('feature_count', 'Feature count'),
    ('jargon_count', 'Jargon count'),
    ('jargon_density', 'Jargon density'),
    ('benefit_ratio', 'Benefit ratio'),
    ('urgency_count', 'Urgency count'),
    ('brand_mentions', 'Brand mentions'),
    ('avg_reading_comfort', 'Reading comfort'),
    ('question_count', 'Question count'),
    ('acronym_count', 'Acronym count'),
    ('total_ocr_words', 'Total OCR words'),
]

print(f"\n  {'Metric':35s} {'Bottom 25%':>12s} {'Top 25%':>12s} {'Diff':>8s}")
print(f"  {'-' * 67}")

for key, label in visual_metrics:
    b_vals = [a['visual'].get(key, 0) for a in bottom]
    t_vals = [a['visual'].get(key, 0) for a in top]
    b_med = np.median(b_vals)
    t_med = np.median(t_vals)
    diff = t_med - b_med
    marker = " <<<" if abs(diff) > 0.1 * max(abs(b_med), abs(t_med), 1) else ""
    print(f"  {label:35s} {b_med:12.2f} {t_med:12.2f} {diff:+8.2f}{marker}")

print()
for key, label in marketing_metrics:
    b_vals = [a.get('marketing', {}).get(key, 0) for a in bottom]
    t_vals = [a.get('marketing', {}).get(key, 0) for a in top]
    b_med = np.median(b_vals)
    t_med = np.median(t_vals)
    diff = t_med - b_med
    marker = " <<<" if abs(diff) > 0.1 * max(abs(b_med), abs(t_med), 1) else ""
    print(f"  {label:35s} {b_med:12.2f} {t_med:12.2f} {diff:+8.2f}{marker}")

# ============================================================
print("\n" + "=" * 70)
print("CORRELATION SUMMARY — ALL CONTINUOUS DIMENSIONS RANKED")
print("=" * 70)

all_correlations = []

for key in ['face_presence_pct', 'avg_face_count', 'avg_face_size_pct', 'bitrate_kbps',
            'file_size_mb', 'avg_blur_score', 'blur_variance', 'avg_motion', 'max_motion',
            'motion_variance', 'avg_brightness', 'brightness_trend',
            'browser_chrome_pct', 'dark_mode_pct', 'light_mode_pct',
            'annotation_frames', 'intro_duration_sec', 'end_card_duration_sec',
            'warm_frame_pct', 'cool_frame_pct', 'avg_saturation', 'pip_frames']:
    vals = [a['visual'].get(key, 0) for a in analyses]
    if len(set(vals)) > 5:
        r, p = stats.spearmanr(vals, votes)
        all_correlations.append((f"V:{key}", r, p))

for key in ['social_proof_count', 'metric_count', 'cta_count', 'competitor_mentions',
            'feature_count', 'features_per_min', 'jargon_count', 'jargon_density',
            'benefit_count', 'feature_word_count', 'benefit_ratio', 'urgency_count',
            'brand_mentions', 'avg_reading_comfort', 'question_count',
            'acronym_count', 'acronym_density', 'text_length_variance', 'total_ocr_words']:
    vals = [a.get('marketing', {}).get(key, 0) for a in analyses]
    if len(set(vals)) > 5:
        r, p = stats.spearmanr(vals, votes)
        all_correlations.append((f"M:{key}", r, p))

# Sort by absolute correlation
all_correlations.sort(key=lambda x: -abs(x[1]))

print(f"\n  {'Dimension':50s} {'r':>8s} {'p':>8s} {'Sig':>4s}")
print(f"  {'-' * 72}")
for name, r, p in all_correlations:
    sig = "***" if p < 0.01 else "**" if p < 0.05 else "*" if p < 0.1 else ""
    print(f"  {name:50s} {r:+8.3f} {p:8.4f} {sig:>4s}")
