#!/usr/bin/env python3
"""
Correlate all mega dimensions (audio, deep visual, metadata) with PH votes.
Quarter-by-quarter temporal analysis.
Combined with previous 100 dimensions for the full 200-dimension view.
"""

import json, glob, re
import numpy as np
from collections import defaultdict, Counter
from scipy import stats

# Load PH
ph = json.load(open('ph_daily_top.json'))
ph_vid_map = {}
for p in ph:
    if not p.get('video_urls'): continue
    urls = str(p['video_urls']).split(' | ') if ' | ' in str(p.get('video_urls','')) else [str(p['video_urls'])]
    for url in urls:
        for pat in [r'youtu\.be/([a-zA-Z0-9_-]{11})', r'youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})']:
            m = re.search(pat, url)
            if m:
                ph_vid_map[m.group(1)] = p
                break

# Load all three analysis layers
data = []
for f in glob.glob('video_mega_analyses/*.json'):
    try:
        mega = json.load(open(f))
        if mega.get('status') != 'ok': continue
        vid = mega['video_id']
        if vid not in ph_vid_map: continue
        p = ph_vid_map[vid]

        # Load extended analysis too
        ext_path = f'video_analyses_extended/{vid}.json'
        ext = {}
        try:
            ext = json.load(open(ext_path))
            if ext.get('status') != 'ok': ext = {}
        except: pass

        # Load OCR
        ocr = {}
        for adir in ['ph_video_analyses', 'yc_video_analyses']:
            try:
                ocr = json.load(open(f'{adir}/{vid}.json'))
                break
            except: pass

        d = {
            'video_id': vid,
            'votes': p['votes'],
            'date': p.get('date', p.get('created_at',''))[:10],
            'mega_audio': mega.get('audio', {}),
            'mega_visual': mega.get('deep_visual', {}),
            'mega_meta': mega.get('metadata', {}),
            'ext_visual': ext.get('visual', {}),
            'ext_marketing': ext.get('marketing', {}),
            'ocr': ocr,
            'ph': p,
        }
        month = int(d['date'][5:7])
        year = d['date'][:4]
        d['quarter'] = f"{year}Q{(month-1)//3+1}"
        data.append(d)
    except: pass

quarters = sorted(set(d['quarter'] for d in data))
quarters = [q for q in quarters if sum(1 for d in data if d['quarter']==q) >= 15]

print(f"Videos with all 3 layers + PH votes: {len(data)}")
for q in quarters:
    n = sum(1 for d in data if d['quarter']==q)
    v = [d['votes'] for d in data if d['quarter']==q]
    print(f"  {q}: n={n:4d}  median={np.median(v):.0f}")

# ============================================================
# BUILD ALL DIMENSIONS (previous 100 + new 51 mega)
# ============================================================
all_dims = {}

# --- MEGA AUDIO (16 dims) ---
audio_keys = [
    'has_speech', 'has_music', 'has_sound_effects', 'silence_pct',
    'energy_trend', 'peak_position_pct', 'dynamic_range_db',
    'onset_density', 'intro_silence_sec', 'outro_silence_sec',
    'avg_spectral_centroid', 'avg_spectral_bandwidth', 'avg_zcr',
]
for k in audio_keys:
    all_dims[f'A: {k}'] = (lambda k_: lambda d: d['mega_audio'].get(k_) if d['mega_audio'].get('has_audio') else None)(k)

# Boolean audio
all_dims['A: has_audio'] = lambda d: 1 if d['mega_audio'].get('has_audio') else 0
all_dims['A: has_speech (bool)'] = lambda d: 1 if d['mega_audio'].get('has_speech') else 0
all_dims['A: has_music (bool)'] = lambda d: 1 if d['mega_audio'].get('has_music') else 0

# --- MEGA DEEP VISUAL (24 dims) ---
dv_keys = [
    'scroll_frame_count', 'avg_scroll_speed',
    'color_palette_size', 'color_consistency',
    'gradient_frame_pct', 'high_contrast_frame_pct',
    'navbar_pct', 'sidebar_pct', 'modal_pct', 'table_pct',
    'chat_pct', 'code_pct', 'terminal_pct',
    'mobile_frame_pct', 'desktop_chrome_pct',
    'avg_symmetry', 'avg_thirds_score', 'avg_content_aspect',
    'scene_diversity', 'repetition_count', 'longest_scene_sec',
]
for k in dv_keys:
    all_dims[f'DV: {k}'] = (lambda k_: lambda d: d['mega_visual'].get(k_))(k)

all_dims['DV: has_scroll'] = lambda d: 1 if d['mega_visual'].get('has_scroll') else 0
all_dims['DV: has_bookend'] = lambda d: 1 if d['mega_visual'].get('has_bookend') else 0

# --- MEGA METADATA (5 usable dims) ---
all_dims['META: has_audio_track'] = lambda d: 1 if d['mega_meta'].get('has_audio_track') else 0
all_dims['META: bit_rate_stream'] = lambda d: d['mega_meta'].get('bit_rate_stream', 0)

# Codec as category
def codec_score(d):
    c = d['mega_meta'].get('video_codec', '')
    return {'h264': 1, 'vp9': 2, 'hevc': 3, 'av1': 4, 'h265': 3}.get(c, 0)
all_dims['META: codec_generation'] = codec_score

# Encoder
def encoder_is_google(d):
    return 1 if 'google' in str(d['mega_meta'].get('encoder', '')).lower() else 0
all_dims['META: encoder_google'] = encoder_is_google

def encoder_is_apple(d):
    enc = str(d['mega_meta'].get('encoder', '')).lower()
    return 1 if 'apple' in enc or 'isom' in enc else 0
all_dims['META: encoder_apple'] = encoder_is_apple

# --- PREVIOUS EXTENDED VISUAL (28 dims) ---
ext_v_keys = [
    'face_presence_pct', 'avg_face_count', 'avg_face_size_pct',
    'has_multiple_people', 'bitrate_kbps', 'file_size_mb',
    'avg_blur_score', 'blur_variance',
    'avg_motion', 'max_motion', 'motion_variance',
    'avg_brightness', 'brightness_trend',
    'browser_chrome_pct', 'dark_mode_pct', 'light_mode_pct',
    'annotation_frames', 'intro_duration_sec', 'end_card_duration_sec',
    'warm_frame_pct', 'cool_frame_pct', 'avg_saturation',
    'pip_frames',
]
for k in ext_v_keys:
    all_dims[f'V: {k}'] = (lambda k_: lambda d: d['ext_visual'].get(k_))(k)

# First frame
all_dims['V: first_frame_dark'] = lambda d: 1 if d.get('ext_visual',{}).get('first_frame',{}).get('is_dark') else 0
all_dims['V: first_frame_white'] = lambda d: 1 if d.get('ext_visual',{}).get('first_frame',{}).get('is_white') else 0
all_dims['V: first_frame_face'] = lambda d: 1 if d.get('ext_visual',{}).get('first_frame',{}).get('has_face') else 0
all_dims['V: first_frame_brightness'] = lambda d: d.get('ext_visual',{}).get('first_frame',{}).get('brightness')

# --- PREVIOUS MARKETING (30 dims) ---
m_keys = [
    'social_proof_count', 'metric_count', 'cta_count', 'competitor_mentions',
    'feature_count', 'features_per_min', 'jargon_count', 'jargon_density',
    'benefit_count', 'feature_word_count', 'benefit_ratio',
    'urgency_count', 'brand_mentions', 'avg_reading_comfort',
    'question_count', 'acronym_count', 'acronym_density',
    'text_length_variance', 'total_ocr_words',
    'negative_sentiment_timestamps', 'positive_sentiment_timestamps',
    'step_count', 'distinct_scenes',
]
for k in m_keys:
    all_dims[f'M: {k}'] = (lambda k_: lambda d: d['ext_marketing'].get(k_))(k)

m_bools = [
    'has_social_proof', 'has_cta', 'has_pricing', 'has_testimonial',
    'has_step_structure', 'has_urgency', 'has_questions',
    'has_url_shown', 'has_text_animation', 'has_before_after', 'has_data_viz',
    'has_problem_solution_arc',
]
for k in m_bools:
    all_dims[f'M: {k}'] = (lambda k_: lambda d: 1 if d['ext_marketing'].get(k_) else 0)(k)

# Emotional arc
def emotional_arc_score(d):
    arc = d['ext_marketing'].get('emotional_arc', 'flat')
    return {'problem_to_solution': 2, 'positive_escalation': 1, 'flat': 0, 'mixed': -1, 'declining': -2}.get(arc, 0)
all_dims['M: emotional_arc_score'] = emotional_arc_score

# --- OCR PASS 1 (14 dims) ---
all_dims['P1: Duration'] = lambda d: d['ocr'].get('duration_sec')
all_dims['P1: Transition count'] = lambda d: d['ocr'].get('transition_count')
all_dims['P1: Unique text segs'] = lambda d: d['ocr'].get('unique_text_segments')

for ft in ['simple_visual', 'dark_screen', 'white_screen', 'detailed_visual', 'text_with_visual', 'ui_or_code', 'text_heavy']:
    all_dims[f'P1: {ft} %'] = (lambda ft_: lambda d: d['ocr'].get('frame_type_distribution',{}).get(ft_, 0))(ft)

def get_transition_rate(d):
    dur = d['ocr'].get('duration_sec', 0)
    tc = d['ocr'].get('transition_count', 0)
    return (tc / dur * 60) if dur > 0 else None
all_dims['P1: Transitions/min'] = get_transition_rate

def get_visual_variety(d):
    dist = d['ocr'].get('frame_type_distribution', {})
    return len([k for k, v in dist.items() if v > 0.05])
all_dims['P1: Visual variety'] = get_visual_variety

# --- PH TEXT (14 dims) ---
all_dims['T: desc_length'] = lambda d: len(d['ph'].get('description','').split())
all_dims['T: tagline_length'] = lambda d: len(d['ph'].get('tagline',''))
all_dims['T: team_size'] = lambda d: len([m for m in str(d['ph'].get('makers','')).split(',') if m.strip()])
all_dims['T: comments'] = lambda d: d['ph'].get('comments', 0)
all_dims['T: rank'] = lambda d: d['ph'].get('rank', 0)
all_dims['T: has_ai_desc'] = lambda d: 1 if re.search(r'\bAI\b', d['ph'].get('description','')) else 0
all_dims['T: has_ai_tagline'] = lambda d: 1 if re.search(r'\bAI\b', d['ph'].get('tagline','')) else 0
all_dims['T: has_free'] = lambda d: 1 if re.search(r'\bfree\b', d['ph'].get('description',''), re.I) else 0
all_dims['T: engagement'] = lambda d: d['ph'].get('comments',0) / max(d['ph'].get('votes',1),1)

print(f"\nTotal dimensions: {len(all_dims)}")

# ============================================================
# CORRELATE
# ============================================================
results = []

for name, extractor in sorted(all_dims.items()):
    row = {'name': name}
    all_rs = []
    for q in quarters:
        subset = [d for d in data if d['quarter'] == q]
        vals, votes = [], []
        for d in subset:
            try:
                v = extractor(d)
                if v is not None and not isinstance(v, (dict, list, str)):
                    vals.append(float(v))
                    votes.append(d['votes'])
            except: pass

        if len(vals) >= 15 and len(set(vals)) > 2:
            r, p = stats.spearmanr(vals, votes)
            row[q] = (r, p)
            all_rs.append(r)
        else:
            row[q] = (None, None)

    if len(all_rs) >= 3:
        row['first'] = all_rs[0]
        row['last'] = all_rs[-1]
        row['shift'] = all_rs[-1] - all_rs[0]
        x = list(range(len(all_rs)))
        slope, _, r_trend, _, _ = stats.linregress(x, all_rs)
        row['trend_slope'] = slope
    else:
        row['shift'] = 0
        row['trend_slope'] = 0

    # Overall correlation
    vals_all, votes_all = [], []
    for d in data:
        try:
            v = extractor(d)
            if v is not None and not isinstance(v, (dict, list, str)):
                vals_all.append(float(v))
                votes_all.append(d['votes'])
        except: pass
    if len(vals_all) >= 30 and len(set(vals_all)) > 3:
        r_all, p_all = stats.spearmanr(vals_all, votes_all)
        row['overall_r'] = r_all
        row['overall_p'] = p_all
    else:
        row['overall_r'] = 0
        row['overall_p'] = 1

    results.append(row)

# ============================================================
# PRINT — sorted by shift
# ============================================================
print(f"\n{'='*120}")
print(f"ALL {len(all_dims)} DIMENSIONS — QUARTERLY CORRELATIONS WITH VOTES (sorted by shift)")
print(f"{'='*120}")

print(f"\n{'Dim':45s} {'Overall':>8s}", end='')
for q in quarters:
    print(f" {q:>7s}", end='')
print(f"  {'Shift':>7s}")
print("-" * (45 + 8 + 8*len(quarters) + 9))

results.sort(key=lambda x: -abs(x.get('shift', 0)))

for row in results:
    sig_o = "*" if row['overall_p'] < 0.05 else "'" if row['overall_p'] < 0.1 else " "
    print(f"{row['name']:45s} {row['overall_r']:+.3f}{sig_o}", end='')
    for q in quarters:
        r, p = row.get(q, (None, None))
        if r is not None:
            sig = "*" if p < 0.05 else "'" if p < 0.1 else " "
            print(f" {r:+.3f}{sig}", end='')
        else:
            print(f"    --- ", end='')
    shift = row.get('shift', 0)
    print(f"  {shift:+.3f}")

# ============================================================
# NEW MEGA DIMENSIONS ONLY — ranked by overall correlation
# ============================================================
print(f"\n{'='*80}")
print("NEW MEGA DIMENSIONS ONLY — ranked by |overall r|")
print("="*80)

mega_dims = [r for r in results if r['name'].startswith(('A:', 'DV:', 'META:'))]
mega_dims.sort(key=lambda x: -abs(x['overall_r']))

print(f"\n{'Dim':45s} {'r':>8s} {'p':>8s} {'Shift':>8s}")
print("-" * 70)
for r in mega_dims:
    sig = "***" if r['overall_p'] < 0.01 else "**" if r['overall_p'] < 0.05 else "*" if r['overall_p'] < 0.1 else ""
    print(f"{r['name']:45s} {r['overall_r']:+8.3f} {r['overall_p']:8.4f} {r.get('shift',0):+8.3f} {sig}")

# ============================================================
# TOP GROWERS / FADERS / STABLE from NEW dims
# ============================================================
print(f"\n{'='*80}")
print("NEW MEGA — TOP GROWERS")
print("="*80)
growers = sorted([r for r in mega_dims if r.get('shift',0) > 0.1], key=lambda x: -x['shift'])
for r in growers[:10]:
    print(f"  {r['name']:45s} shift={r['shift']:+.3f}  ({r.get('first',0):+.3f} → {r.get('last',0):+.3f})")

print(f"\n{'='*80}")
print("NEW MEGA — TOP FADERS")
print("="*80)
faders = sorted([r for r in mega_dims if r.get('shift',0) < -0.1], key=lambda x: x['shift'])
for r in faders[:10]:
    print(f"  {r['name']:45s} shift={r['shift']:+.3f}  ({r.get('first',0):+.3f} → {r.get('last',0):+.3f})")

print(f"\n{'='*80}")
print("NEW MEGA — STABLE (always significant, same direction)")
print("="*80)
stable = [r for r in mega_dims if abs(r.get('shift',0)) < 0.1 and abs(r['overall_r']) > 0.05]
stable.sort(key=lambda x: -abs(x['overall_r']))
for r in stable[:10]:
    print(f"  {r['name']:45s} overall_r={r['overall_r']:+.3f}  shift={r.get('shift',0):+.3f}")
