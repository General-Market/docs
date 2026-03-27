#!/usr/bin/env python3
"""
Full correlation: YC vs PH, all dimensions.
Compares patterns between both platforms.
"""

import json
import glob
import re
import numpy as np
from collections import defaultdict, Counter
from scipy import stats

# ============================================================
# LOAD DATA
# ============================================================

# YC launches
yc_launches = json.load(open('yc_launches_enriched.json'))
yc_vid_to_launch = {}
for l in yc_launches:
    if not l.get('video_urls') or l.get('votes') is None:
        continue
    urls = l['video_urls'].split(' | ') if ' | ' in l['video_urls'] else [l['video_urls']]
    for url in urls:
        for pat in [r'youtu\.be/([a-zA-Z0-9_-]{11})', r'youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})']:
            m = re.search(pat, url)
            if m:
                yc_vid_to_launch[m.group(1)] = l
                break

# PH launches
ph_launches = json.load(open('ph_daily_top.json'))
ph_vid_to_launch = {}
for l in ph_launches:
    if not l.get('video_urls') or l.get('votes') is None:
        continue
    urls = str(l['video_urls']).split(' | ') if ' | ' in str(l.get('video_urls', '')) else [str(l['video_urls'])]
    for url in urls:
        for pat in [r'youtu\.be/([a-zA-Z0-9_-]{11})', r'youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})']:
            m = re.search(pat, url)
            if m:
                ph_vid_to_launch[m.group(1)] = l
                break

# Load extended analyses
yc_data = []
ph_data = []
for f in sorted(glob.glob('video_analyses_extended/*.json')):
    try:
        d = json.load(open(f))
        if d.get('status') != 'ok':
            continue
        vid = d['video_id']
        if vid in yc_vid_to_launch:
            d['votes'] = yc_vid_to_launch[vid]['votes']
            d['platform'] = 'YC'
            d['company_name'] = yc_vid_to_launch[vid].get('company_name', '')
            yc_data.append(d)
        elif vid in ph_vid_to_launch:
            d['votes'] = ph_vid_to_launch[vid]['votes']
            d['platform'] = 'PH'
            d['company_name'] = ph_vid_to_launch[vid].get('name', '')
            ph_data.append(d)
    except Exception:
        pass

all_data = yc_data + ph_data

print(f"YC videos with votes + analysis: {len(yc_data)}")
print(f"PH videos with votes + analysis: {len(ph_data)}")
print(f"Total: {len(all_data)}")
print(f"\nYC votes: median={np.median([d['votes'] for d in yc_data]):.0f}, mean={np.mean([d['votes'] for d in yc_data]):.0f}, range={min(d['votes'] for d in yc_data)}-{max(d['votes'] for d in yc_data)}")
print(f"PH votes: median={np.median([d['votes'] for d in ph_data]):.0f}, mean={np.mean([d['votes'] for d in ph_data]):.0f}, range={min(d['votes'] for d in ph_data)}-{max(d['votes'] for d in ph_data)}")


def analyze_dimension(name, extractor, dataset, label=""):
    """Run bucketed + correlation analysis on a dimension."""
    vals = []
    votes = []
    for d in dataset:
        try:
            v = extractor(d)
            if v is not None and not isinstance(v, (dict, list, str, bool)):
                vals.append(float(v))
                votes.append(d['votes'])
        except Exception:
            pass

    if len(vals) < 20:
        return None

    r, p = stats.spearmanr(vals, votes)
    return {'name': name, 'r': r, 'p': p, 'n': len(vals), 'label': label}


def bool_compare(name, extractor, dataset):
    """Compare boolean dimension."""
    true_v = [d['votes'] for d in dataset if extractor(d)]
    false_v = [d['votes'] for d in dataset if not extractor(d)]
    if len(true_v) < 5 or len(false_v) < 5:
        return None
    _, p = stats.mannwhitneyu(true_v, false_v, alternative='two-sided')
    return {
        'name': name,
        'true_n': len(true_v), 'true_median': np.median(true_v),
        'false_n': len(false_v), 'false_median': np.median(false_v),
        'diff': np.median(true_v) - np.median(false_v),
        'p': p,
    }


# ============================================================
# ALL DIMENSIONS — extracted from both Pass 1 OCR + Pass 2 extended
# ============================================================

# Continuous dimensions
continuous_dims = {
    # Pass 1 (from OCR JSON)
    # Pass 2 Visual
    'V: Face presence %': lambda d: d.get('visual', {}).get('face_presence_pct'),
    'V: Avg face count': lambda d: d.get('visual', {}).get('avg_face_count'),
    'V: Face size %': lambda d: d.get('visual', {}).get('avg_face_size_pct'),
    'V: Bitrate kbps': lambda d: d.get('visual', {}).get('bitrate_kbps'),
    'V: File size MB': lambda d: d.get('visual', {}).get('file_size_mb'),
    'V: Blur score': lambda d: d.get('visual', {}).get('avg_blur_score'),
    'V: Blur variance': lambda d: d.get('visual', {}).get('blur_variance'),
    'V: Avg motion': lambda d: d.get('visual', {}).get('avg_motion'),
    'V: Max motion': lambda d: d.get('visual', {}).get('max_motion'),
    'V: Motion variance': lambda d: d.get('visual', {}).get('motion_variance'),
    'V: Avg brightness': lambda d: d.get('visual', {}).get('avg_brightness'),
    'V: Brightness trend': lambda d: d.get('visual', {}).get('brightness_trend'),
    'V: Browser chrome %': lambda d: d.get('visual', {}).get('browser_chrome_pct'),
    'V: Dark mode %': lambda d: d.get('visual', {}).get('dark_mode_pct'),
    'V: Light mode %': lambda d: d.get('visual', {}).get('light_mode_pct'),
    'V: Annotation frames': lambda d: d.get('visual', {}).get('annotation_frames'),
    'V: Intro duration': lambda d: d.get('visual', {}).get('intro_duration_sec'),
    'V: End card duration': lambda d: d.get('visual', {}).get('end_card_duration_sec'),
    'V: Warm frame %': lambda d: d.get('visual', {}).get('warm_frame_pct'),
    'V: Cool frame %': lambda d: d.get('visual', {}).get('cool_frame_pct'),
    'V: Avg saturation': lambda d: d.get('visual', {}).get('avg_saturation'),
    'V: PiP frames': lambda d: d.get('visual', {}).get('pip_frames'),
    # Pass 2 Marketing
    'M: Social proof count': lambda d: d.get('marketing', {}).get('social_proof_count'),
    'M: Metric count': lambda d: d.get('marketing', {}).get('metric_count'),
    'M: CTA count': lambda d: d.get('marketing', {}).get('cta_count'),
    'M: Competitor mentions': lambda d: d.get('marketing', {}).get('competitor_mentions'),
    'M: Feature count': lambda d: d.get('marketing', {}).get('feature_count'),
    'M: Features/min': lambda d: d.get('marketing', {}).get('features_per_min'),
    'M: Jargon count': lambda d: d.get('marketing', {}).get('jargon_count'),
    'M: Jargon density': lambda d: d.get('marketing', {}).get('jargon_density'),
    'M: Benefit count': lambda d: d.get('marketing', {}).get('benefit_count'),
    'M: Feature word count': lambda d: d.get('marketing', {}).get('feature_word_count'),
    'M: Benefit ratio': lambda d: d.get('marketing', {}).get('benefit_ratio'),
    'M: Urgency count': lambda d: d.get('marketing', {}).get('urgency_count'),
    'M: Brand mentions': lambda d: d.get('marketing', {}).get('brand_mentions'),
    'M: Reading comfort': lambda d: d.get('marketing', {}).get('avg_reading_comfort'),
    'M: Question count': lambda d: d.get('marketing', {}).get('question_count'),
    'M: Acronym count': lambda d: d.get('marketing', {}).get('acronym_count'),
    'M: Acronym density': lambda d: d.get('marketing', {}).get('acronym_density'),
    'M: Text length variance': lambda d: d.get('marketing', {}).get('text_length_variance'),
    'M: Total OCR words': lambda d: d.get('marketing', {}).get('total_ocr_words'),
}

# Boolean dimensions
bool_dims = {
    'V: Multiple people': lambda d: d.get('visual', {}).get('has_multiple_people'),
    'V: Has PiP': lambda d: d.get('visual', {}).get('has_pip'),
    'V: Has annotations': lambda d: d.get('visual', {}).get('has_annotations'),
    'V: Has letterbox': lambda d: d.get('visual', {}).get('has_letterbox'),
    'M: Has social proof': lambda d: d.get('marketing', {}).get('has_social_proof'),
    'M: Has CTA': lambda d: d.get('marketing', {}).get('has_cta'),
    'M: Has pricing': lambda d: d.get('marketing', {}).get('has_pricing'),
    'M: Has testimonial': lambda d: d.get('marketing', {}).get('has_testimonial'),
    'M: Has step structure': lambda d: d.get('marketing', {}).get('has_step_structure'),
    'M: Has urgency': lambda d: d.get('marketing', {}).get('has_urgency'),
    'M: Tagline match': lambda d: d.get('marketing', {}).get('tagline_match'),
    'M: Has questions': lambda d: d.get('marketing', {}).get('has_questions'),
    'M: Has URL shown': lambda d: d.get('marketing', {}).get('has_url_shown'),
    'M: Has text animation': lambda d: d.get('marketing', {}).get('has_text_animation'),
    'M: Has before/after': lambda d: d.get('marketing', {}).get('has_before_after'),
    'M: Has data viz': lambda d: d.get('marketing', {}).get('has_data_viz'),
    'M: Problem→Solution arc': lambda d: d.get('marketing', {}).get('has_problem_solution_arc'),
}


# ============================================================
# RUN ANALYSIS ON ALL THREE DATASETS
# ============================================================

for platform_label, dataset in [("ALL COMBINED", all_data), ("YC ONLY", yc_data), ("PH ONLY", ph_data)]:
    print(f"\n{'='*70}")
    print(f"  {platform_label} (n={len(dataset)})")
    print(f"{'='*70}")

    # Continuous correlations
    results = []
    for name, extractor in continuous_dims.items():
        r = analyze_dimension(name, extractor, dataset)
        if r:
            results.append(r)

    results.sort(key=lambda x: -abs(x['r']))
    print(f"\n  {'Dimension':45s} {'r':>8s} {'p':>8s} {'n':>5s} {'Sig':>4s}")
    print(f"  {'-'*72}")
    for r in results:
        sig = "***" if r['p'] < 0.01 else "**" if r['p'] < 0.05 else "*" if r['p'] < 0.1 else ""
        print(f"  {r['name']:45s} {r['r']:+8.3f} {r['p']:8.4f} {r['n']:5d} {sig:>4s}")

    # Boolean comparisons
    print(f"\n  Boolean dimensions:")
    print(f"  {'Dimension':35s} {'Yes n':>6s} {'Yes med':>8s} {'No n':>6s} {'No med':>8s} {'Diff':>6s} {'p':>8s}")
    print(f"  {'-'*80}")

    bool_results = []
    for name, extractor in bool_dims.items():
        r = bool_compare(name, extractor, dataset)
        if r:
            bool_results.append(r)

    bool_results.sort(key=lambda x: x['p'])
    for r in bool_results:
        sig = "***" if r['p'] < 0.01 else "**" if r['p'] < 0.05 else "*" if r['p'] < 0.1 else ""
        print(f"  {r['name']:35s} {r['true_n']:6d} {r['true_median']:8.0f} {r['false_n']:6d} {r['false_median']:8.0f} {r['diff']:+6.0f} {r['p']:8.3f} {sig}")


# ============================================================
# YC vs PH — SIDE BY SIDE COMPARISON
# ============================================================

print(f"\n{'='*70}")
print(f"  YC vs PH — SIDE-BY-SIDE DIMENSION COMPARISON")
print(f"{'='*70}")

print(f"\n  {'Dimension':40s} {'YC r':>8s} {'YC p':>8s} {'PH r':>8s} {'PH p':>8s} {'Same?':>6s}")
print(f"  {'-'*75}")

for name, extractor in continuous_dims.items():
    yc_r = analyze_dimension(name, extractor, yc_data)
    ph_r = analyze_dimension(name, extractor, ph_data)
    if yc_r and ph_r:
        same = "YES" if (yc_r['r'] > 0) == (ph_r['r'] > 0) else "NO"
        yc_sig = "*" if yc_r['p'] < 0.1 else ""
        ph_sig = "*" if ph_r['p'] < 0.1 else ""
        print(f"  {name:40s} {yc_r['r']:+7.3f}{yc_sig} {yc_r['p']:8.3f} {ph_r['r']:+7.3f}{ph_sig} {ph_r['p']:8.3f} {same:>6s}")


# ============================================================
# PLATFORM-SPECIFIC FINDINGS
# ============================================================

print(f"\n{'='*70}")
print(f"  FINDINGS UNIQUE TO EACH PLATFORM")
print(f"{'='*70}")

print(f"\n  --- YC-only significant (p<0.1) ---")
for name, extractor in continuous_dims.items():
    yc_r = analyze_dimension(name, extractor, yc_data)
    ph_r = analyze_dimension(name, extractor, ph_data)
    if yc_r and yc_r['p'] < 0.1 and (not ph_r or ph_r['p'] > 0.2):
        print(f"  {name:40s} YC: r={yc_r['r']:+.3f} p={yc_r['p']:.3f}  |  PH: {'r='+str(round(ph_r['r'],3))+' p='+str(round(ph_r['p'],3)) if ph_r else 'n/a'}")

print(f"\n  --- PH-only significant (p<0.1) ---")
for name, extractor in continuous_dims.items():
    ph_r = analyze_dimension(name, extractor, ph_data)
    yc_r = analyze_dimension(name, extractor, yc_data)
    if ph_r and ph_r['p'] < 0.1 and (not yc_r or yc_r['p'] > 0.2):
        print(f"  {name:40s} PH: r={ph_r['r']:+.3f} p={ph_r['p']:.3f}  |  YC: {'r='+str(round(yc_r['r'],3))+' p='+str(round(yc_r['p'],3)) if yc_r else 'n/a'}")

# Color temp comparison
print(f"\n  --- Color Temperature ---")
for platform, dataset in [("YC", yc_data), ("PH", ph_data)]:
    temps = defaultdict(list)
    for d in dataset:
        t = d.get('visual', {}).get('dominant_color_temp', 'unknown')
        temps[t].append(d['votes'])
    for t in ['warm', 'neutral', 'cool']:
        v = temps.get(t, [])
        if len(v) >= 5:
            print(f"  {platform} {t:8s}: n={len(v):4d}  median={np.median(v):6.0f}")

# First frame comparison
print(f"\n  --- First Frame ---")
for platform, dataset in [("YC", yc_data), ("PH", ph_data)]:
    groups = defaultdict(list)
    for d in dataset:
        ff = d.get('visual', {}).get('first_frame', {})
        if ff.get('is_dark'):
            groups['dark'].append(d['votes'])
        elif ff.get('is_white'):
            groups['white'].append(d['votes'])
        elif ff.get('has_face'):
            groups['face'].append(d['votes'])
        else:
            groups['other'].append(d['votes'])
    for g in ['dark', 'white', 'face', 'other']:
        v = groups.get(g, [])
        if len(v) >= 5:
            print(f"  {platform} {g:8s}: n={len(v):4d}  median={np.median(v):6.0f}")

# Emotional arc comparison
print(f"\n  --- Emotional Arc ---")
for platform, dataset in [("YC", yc_data), ("PH", ph_data)]:
    arcs = defaultdict(list)
    for d in dataset:
        arc = d.get('marketing', {}).get('emotional_arc', 'unknown')
        arcs[arc].append(d['votes'])
    for a in ['flat', 'mixed', 'problem_to_solution', 'positive_escalation', 'declining']:
        v = arcs.get(a, [])
        if len(v) >= 5:
            print(f"  {platform} {a:25s}: n={len(v):4d}  median={np.median(v):6.0f}")

# Value prop placement
print(f"\n  --- Value Prop Placement ---")
for platform, dataset in [("YC", yc_data), ("PH", ph_data)]:
    vps = defaultdict(list)
    for d in dataset:
        vp = d.get('marketing', {}).get('value_prop_placement', 'none')
        vps[vp].append(d['votes'])
    for v in ['early', 'middle', 'late']:
        vals = vps.get(v, [])
        if len(vals) >= 5:
            print(f"  {platform} {v:10s}: n={len(vals):4d}  median={np.median(vals):6.0f}")
