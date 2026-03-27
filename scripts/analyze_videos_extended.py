#!/usr/bin/env python3
"""
Extended video analysis — 50 dimensions.
Pass 1: Visual features (face detection, blur, colors, motion, PiP, browser chrome, etc.)
Pass 2: Marketing/text features (from existing OCR data + new text analysis)

Resumable — skips already-analyzed videos.
"""

import cv2
import json
import os
import sys
import re
import glob
import time
import math
import numpy as np
from collections import Counter, defaultdict
from concurrent.futures import ProcessPoolExecutor, as_completed


class NpEncoder(json.JSONEncoder):
    """Handle numpy types in JSON serialization."""
    def default(self, obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, (np.bool_,)):
            return bool(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


VIDEO_DIRS = ["yc_videos_notranscript", "ph_videos_notranscript"]
ANALYSIS_DIRS = ["yc_video_analyses", "ph_video_analyses"]
OUTPUT_DIR = "video_analyses_extended"
FRAME_INTERVAL_SEC = 3.0

# Load Haar cascade for face detection
FACE_CASCADE_PATH = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'

# ============================================================
# JARGON / MARKETING WORD LISTS
# ============================================================
TECHNICAL_JARGON = {
    'api', 'sdk', 'saas', 'devops', 'kubernetes', 'docker', 'microservice',
    'oauth', 'webhook', 'graphql', 'grpc', 'cicd', 'terraform', 'yaml',
    'json', 'crud', 'restful', 'middleware', 'backend', 'frontend', 'fullstack',
    'serverless', 'lambda', 'endpoint', 'schema', 'postgres', 'redis',
    'mongodb', 'elasticsearch', 'vectordb', 'embeddings', 'llm', 'rag',
    'finetune', 'transformer', 'gpu', 'inference', 'latency', 'throughput',
    'orchestration', 'pipeline', 'etl', 'kafka', 'rabbitmq', 'nginx',
    'ssl', 'tls', 'dns', 'cdn', 'vpc', 'iam', 'rbac', 'sso', 'jwt',
    'oauth2', 'cors', 'websocket', 'http', 'tcp', 'udp',
}

BENEFIT_WORDS = {
    'save', 'faster', 'easier', 'simpler', 'never', 'stop', 'eliminate',
    'reduce', 'increase', 'boost', 'grow', 'unlock', 'achieve', 'gain',
    'protect', 'secure', 'automate', 'instant', 'free', 'affordable',
    'effortless', 'seamless', 'powerful', 'reliable', 'scalable',
    'revenue', 'profit', 'roi', 'conversion', 'retention', 'growth',
    'customers', 'users', 'satisfaction', 'happiness', 'peace',
    'time', 'money', 'hours', 'minutes', 'seconds',
}

FEATURE_WORDS = {
    'supports', 'integrates', 'connects', 'syncs', 'provides', 'offers',
    'includes', 'built-in', 'native', 'compatible', 'plugin', 'module',
    'dashboard', 'analytics', 'reporting', 'monitoring', 'logging',
    'notification', 'alert', 'webhook', 'import', 'export', 'filter',
    'search', 'sort', 'batch', 'bulk', 'template', 'workflow', 'automation',
    'scheduling', 'configuration', 'settings', 'admin', 'permissions',
    'roles', 'audit', 'compliance',
}

NEGATIVE_SENTIMENT = {
    'problem', 'broken', 'slow', 'expensive', 'complicated', 'frustrating',
    'painful', 'tedious', 'manual', 'error', 'fail', 'waste', 'lost',
    'miss', 'lack', 'difficult', 'confusing', 'overwhelming', 'annoying',
    'struggle', 'suffer', 'risk', 'danger', 'threat', 'vulnerable',
    'outdated', 'legacy', 'clunky', 'fragmented', 'siloed', 'disconnected',
    'tired', 'hate', 'nightmare', 'chaos', 'mess',
}

POSITIVE_SENTIMENT = {
    'easy', 'fast', 'simple', 'powerful', 'beautiful', 'elegant', 'smooth',
    'reliable', 'secure', 'accurate', 'efficient', 'productive', 'smart',
    'intelligent', 'automated', 'instant', 'seamless', 'intuitive',
    'delightful', 'amazing', 'incredible', 'revolutionary', 'innovative',
    'love', 'enjoy', 'perfect', 'excellent', 'outstanding', 'brilliant',
    'game-changing', 'breakthrough', 'magic', 'best',
}

URGENCY_WORDS = {
    'limited', 'beta', 'early', 'access', 'waitlist', 'exclusive',
    'first', 'invite', 'spots', 'hurry', 'now', 'today', 'launch',
    'new', 'just', 'announcing', 'introducing', 'finally',
}

SOCIAL_PROOF_PATTERNS = [
    r'trusted\s+by', r'used\s+by', r'loved\s+by', r'chosen\s+by',
    r'\d+[kKmM]?\+?\s*(users|customers|companies|teams|developers)',
    r'YC|Y\s*Combinator', r'SOC\s*2', r'HIPAA', r'GDPR', r'ISO',
    r'as\s+seen\s+in', r'featured\s+in', r'backed\s+by',
    r'Series\s+[A-D]', r'\$\d+[mMbB]\s*(raised|funding|valuation)',
]

CTA_PATTERNS = [
    r'try\s+(it\s+)?(for\s+)?free', r'sign\s+up', r'get\s+started',
    r'book\s+a?\s*demo', r'start\s+(your\s+)?(free\s+)?trial',
    r'join\s+(the\s+)?waitlist', r'request\s+(early\s+)?access',
    r'learn\s+more', r'visit\s+\w+\.\w+', r'download',
    r'schedule\s+a?\s*(call|demo|meeting)',
]

COMPETITOR_PATTERNS = [
    r'\bvs\.?\b', r'\bversus\b', r'compared\s+to', r'unlike\b',
    r'better\s+than', r'faster\s+than', r'cheaper\s+than',
    r'alternative\s+to', r'replacement\s+for', r'instead\s+of',
]

STEP_PATTERNS = [
    r'step\s+\d', r'^\d+[\.\)]\s', r'first[\.,]', r'second[\.,]',
    r'third[\.,]', r'then[\.,]', r'next[\.,]', r'finally[\.,]',
]


def analyze_visual_extended(video_path):
    """Extended visual analysis — faces, blur, colors, motion, structure."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    if total_frames < 2 or duration < 0.5:
        cap.release()
        return None

    frame_skip = max(1, int(fps * FRAME_INTERVAL_SEC))
    face_cascade = cv2.CascadeClassifier(FACE_CASCADE_PATH)

    # Accumulators
    face_frames = 0
    face_counts = []
    face_sizes = []  # relative to frame
    blur_values = []
    brightness_values = []
    hue_values = []
    saturation_values = []
    motion_values = []
    prev_gray = None

    has_browser_chrome = 0
    has_cursor_region = 0
    has_pip = 0
    has_annotations = 0
    has_letterbox = 0

    dark_mode_frames = 0
    light_mode_frames = 0

    first_frame_data = None
    last_frame_data = None

    frame_brightnesses_timeline = []
    color_temps = []

    total_analyzed = 0
    frame_idx = 0

    while frame_idx < total_frames:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret:
            break

        timestamp = frame_idx / fps
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        h, w = frame.shape[:2]

        # === FACE DETECTION (#4, #17) ===
        faces = face_cascade.detectMultiScale(gray, 1.3, 5, minSize=(30, 30))
        face_count = len(faces)
        face_counts.append(face_count)
        if face_count > 0:
            face_frames += 1
            for (fx, fy, fw, fh) in faces:
                face_sizes.append((fw * fh) / (w * h))

        # === BACKGROUND BLUR / DOF (#18) ===
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        blur_values.append(laplacian_var)

        # === BRIGHTNESS + COLOR TEMP (#9, #31) ===
        mean_brightness = np.mean(gray)
        brightness_values.append(mean_brightness)
        frame_brightnesses_timeline.append((timestamp, mean_brightness))

        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        mean_hue = np.mean(hsv[:, :, 0])
        mean_sat = np.mean(hsv[:, :, 1])
        hue_values.append(mean_hue)
        saturation_values.append(mean_sat)

        # Color temperature: warm (hue 0-30 or 150-180) vs cool (90-130)
        if mean_hue < 30 or mean_hue > 150:
            color_temps.append('warm')
        elif 90 <= mean_hue <= 130:
            color_temps.append('cool')
        else:
            color_temps.append('neutral')

        # === DARK MODE vs LIGHT MODE (#22) ===
        if mean_brightness < 80:
            dark_mode_frames += 1
        elif mean_brightness > 170:
            light_mode_frames += 1

        # === MOTION INTENSITY (#5) ===
        if prev_gray is not None:
            diff = cv2.absdiff(prev_gray, gray)
            motion = np.mean(diff)
            motion_values.append(motion)
        prev_gray = gray.copy()

        # === BROWSER CHROME DETECTION (#20) ===
        if h > 100:
            top_strip = gray[:60, :]
            top_mean = np.mean(top_strip)
            top_edges = cv2.Canny(top_strip, 50, 150)
            top_edge_ratio = np.count_nonzero(top_edges) / top_strip.size
            # Browser chrome: high edge density + consistent brightness in top strip
            if top_edge_ratio > 0.08 and 180 < top_mean < 250:
                has_browser_chrome += 1

        # === PIP DETECTION (#13) ===
        if h > 200 and w > 200:
            # Check corners for small bright/face-containing rectangles
            corners = [
                frame[h-h//4:, w-w//4:],  # bottom-right
                frame[h-h//4:, :w//4],     # bottom-left
                frame[:h//4, w-w//4:],     # top-right
                frame[:h//4, :w//4],       # top-left
            ]
            for corner in corners:
                corner_gray = cv2.cvtColor(corner, cv2.COLOR_BGR2GRAY)
                corner_faces = face_cascade.detectMultiScale(corner_gray, 1.3, 5, minSize=(20, 20))
                if len(corner_faces) > 0:
                    # Face in corner = likely PiP
                    has_pip += 1
                    break

        # === ANNOTATION DETECTION (#24) ===
        edges = cv2.Canny(gray, 50, 150)
        # Look for circles and lines (annotation arrows, circles)
        circles = cv2.HoughCircles(gray, cv2.HOUGH_GRADIENT, 1, 50,
                                    param1=100, param2=30, minRadius=10, maxRadius=80)
        if circles is not None and len(circles[0]) > 0:
            has_annotations += 1

        # === LETTERBOXING (#28) ===
        if h > 100:
            top_10 = gray[:int(h*0.08), :]
            bottom_10 = gray[int(h*0.92):, :]
            if np.mean(top_10) < 20 and np.mean(bottom_10) < 20:
                has_letterbox += 1

        # === FIRST / LAST FRAME DATA (#7, #29, #30) ===
        if total_analyzed == 0:
            first_frame_data = {
                'brightness': float(mean_brightness),
                'has_face': face_count > 0,
                'face_count': face_count,
                'is_dark': mean_brightness < 40,
                'is_white': mean_brightness > 230,
                'blur_score': float(laplacian_var),
            }

        last_frame_data = {
            'timestamp': round(timestamp, 1),
            'brightness': float(mean_brightness),
            'has_face': face_count > 0,
            'is_dark': mean_brightness < 40,
            'is_white': mean_brightness > 230,
        }

        total_analyzed += 1
        frame_idx += frame_skip

    cap.release()

    if total_analyzed == 0:
        return None

    # Compute file size metrics (#12)
    file_size = os.path.getsize(video_path)
    bitrate_kbps = (file_size * 8 / 1000) / duration if duration > 0 else 0

    # Brightness trajectory (#9)
    if len(frame_brightnesses_timeline) >= 4:
        quarter = len(frame_brightnesses_timeline) // 4
        first_q_brightness = np.mean([b for _, b in frame_brightnesses_timeline[:quarter]])
        last_q_brightness = np.mean([b for _, b in frame_brightnesses_timeline[-quarter:]])
        brightness_trend = last_q_brightness - first_q_brightness
    else:
        brightness_trend = 0
        first_q_brightness = np.mean(brightness_values)
        last_q_brightness = first_q_brightness

    # Color temp summary
    temp_counts = Counter(color_temps)
    dominant_temp = temp_counts.most_common(1)[0][0] if temp_counts else 'neutral'

    # Intro duration (#29): time until first non-dark frame
    intro_duration = 0
    for ts, br in frame_brightnesses_timeline:
        if br > 40:
            intro_duration = ts
            break

    # End card detection (#30)
    end_card_duration = 0
    if len(frame_brightnesses_timeline) >= 2:
        for ts, br in reversed(frame_brightnesses_timeline):
            if br > 40 and br < 230:
                end_card_duration = duration - ts
                break

    return {
        # Dim 4/17: Face detection
        'face_presence_pct': round(face_frames / total_analyzed, 3),
        'avg_face_count': round(np.mean(face_counts), 2),
        'max_face_count': int(max(face_counts)) if face_counts else 0,
        'avg_face_size_pct': round(np.mean(face_sizes) * 100, 1) if face_sizes else 0,
        'has_multiple_people': int(max(face_counts) > 1) if face_counts else 0,

        # Dim 12: Bitrate
        'file_size_mb': round(file_size / 1024 / 1024, 2),
        'bitrate_kbps': round(bitrate_kbps, 0),

        # Dim 13: PiP
        'pip_frames': has_pip,
        'has_pip': has_pip > 2,

        # Dim 18: Background blur / DOF
        'avg_blur_score': round(np.mean(blur_values), 1),
        'blur_variance': round(np.std(blur_values), 1),

        # Dim 5: Motion intensity
        'avg_motion': round(np.mean(motion_values), 2) if motion_values else 0,
        'max_motion': round(max(motion_values), 2) if motion_values else 0,
        'motion_variance': round(np.std(motion_values), 2) if motion_values else 0,

        # Dim 9: Brightness trajectory
        'avg_brightness': round(np.mean(brightness_values), 1),
        'brightness_trend': round(brightness_trend, 1),
        'first_quarter_brightness': round(first_q_brightness, 1),
        'last_quarter_brightness': round(last_q_brightness, 1),

        # Dim 20: Browser chrome
        'browser_chrome_frames': has_browser_chrome,
        'browser_chrome_pct': round(has_browser_chrome / total_analyzed, 3),

        # Dim 22: Dark/Light mode
        'dark_mode_pct': round(dark_mode_frames / total_analyzed, 3),
        'light_mode_pct': round(light_mode_frames / total_analyzed, 3),

        # Dim 24: Annotations
        'annotation_frames': has_annotations,
        'has_annotations': has_annotations > 1,

        # Dim 28: Letterboxing
        'letterbox_frames': has_letterbox,
        'has_letterbox': has_letterbox > 2,

        # Dim 29: Intro duration
        'intro_duration_sec': round(intro_duration, 1),

        # Dim 30: End card
        'end_card_duration_sec': round(end_card_duration, 1),

        # Dim 31: Color temperature
        'dominant_color_temp': dominant_temp,
        'warm_frame_pct': round(temp_counts.get('warm', 0) / total_analyzed, 3),
        'cool_frame_pct': round(temp_counts.get('cool', 0) / total_analyzed, 3),

        # Dim 7: First/last frame
        'first_frame': first_frame_data,
        'last_frame': last_frame_data,

        # Saturation
        'avg_saturation': round(np.mean(saturation_values), 1),

        'frames_analyzed': total_analyzed,
    }


def analyze_text_marketing(ocr_data, launch_data=None):
    """Marketing/text analysis from existing OCR extractions."""
    text_extractions = ocr_data.get('text_extractions', [])
    pseudo_transcript = ocr_data.get('pseudo_transcript', '')
    duration = ocr_data.get('duration_sec', 0)

    all_text_lower = pseudo_transcript.lower()
    all_words = re.findall(r'[a-zA-Z]+', all_text_lower)
    word_set = set(all_words)

    # Dim 32: Value proposition placement
    vp_timestamp = None
    if text_extractions:
        vp_timestamp = text_extractions[0].get('timestamp_sec', 0)
    vp_placement = 'early' if vp_timestamp and vp_timestamp < duration * 0.25 else \
                   'middle' if vp_timestamp and vp_timestamp < duration * 0.75 else 'late'

    # Dim 33: Problem → Solution arc
    neg_timestamps = []
    pos_timestamps = []
    for te in text_extractions:
        words = set(re.findall(r'[a-z]+', te['text'].lower()))
        ts = te['timestamp_sec']
        if words & NEGATIVE_SENTIMENT:
            neg_timestamps.append(ts)
        if words & POSITIVE_SENTIMENT:
            pos_timestamps.append(ts)

    has_problem_solution_arc = False
    if neg_timestamps and pos_timestamps:
        avg_neg = np.mean(neg_timestamps)
        avg_pos = np.mean(pos_timestamps)
        has_problem_solution_arc = avg_neg < avg_pos

    # Dim 34: Social proof on screen
    social_proof_count = 0
    social_proof_texts = []
    for pattern in SOCIAL_PROOF_PATTERNS:
        matches = re.findall(pattern, all_text_lower, re.IGNORECASE)
        if matches:
            social_proof_count += len(matches)
            social_proof_texts.extend(matches)

    # Dim 35: Metrics/numbers on screen
    metric_patterns = re.findall(r'\$[\d,.]+[kKmMbB]?|\d+[kKmMbB]\+?|\d+%|\d+x\b', pseudo_transcript)
    metric_count = len(metric_patterns)
    # When do metrics appear?
    metric_timestamps = []
    for te in text_extractions:
        if re.search(r'\$[\d,.]+[kKmMbB]?|\d+[kKmMbB]\+?|\d+%|\d+x\b', te['text']):
            metric_timestamps.append(te['timestamp_sec'])
    metric_placement = None
    if metric_timestamps and duration > 0:
        avg_metric_ts = np.mean(metric_timestamps)
        if avg_metric_ts < duration * 0.33:
            metric_placement = 'early'
        elif avg_metric_ts < duration * 0.66:
            metric_placement = 'middle'
        else:
            metric_placement = 'late'

    # Dim 36: CTA type and timing
    cta_found = []
    cta_timestamps = []
    for te in text_extractions:
        text_lower = te['text'].lower()
        for pattern in CTA_PATTERNS:
            if re.search(pattern, text_lower):
                cta_found.append(re.search(pattern, text_lower).group())
                cta_timestamps.append(te['timestamp_sec'])
                break

    cta_timing = None
    if cta_timestamps and duration > 0:
        last_cta = max(cta_timestamps)
        if last_cta > duration * 0.8:
            cta_timing = 'end'
        elif last_cta < duration * 0.3:
            cta_timing = 'beginning'
        else:
            cta_timing = 'middle'

    # Dim 37: Competitor mention
    competitor_mentions = 0
    for pattern in COMPETITOR_PATTERNS:
        competitor_mentions += len(re.findall(pattern, all_text_lower))

    # Dim 38: Feature list density
    feature_count = len(word_set & FEATURE_WORDS)
    features_per_min = feature_count / (duration / 60) if duration > 0 else 0

    # Dim 39: Pricing shown
    pricing_patterns = re.findall(r'\$\d+(?:\.\d+)?(?:/mo|/month|/yr|/year|/user)?|free\s+(?:tier|plan|trial)|starting\s+at|per\s+(?:month|user|seat)', all_text_lower)
    has_pricing = len(pricing_patterns) > 0

    # Dim 40: Headline hierarchy (estimate from text length variance)
    text_lengths = [len(te['text']) for te in text_extractions]
    text_length_variance = np.std(text_lengths) if len(text_lengths) >= 2 else 0

    # Dim 41: Testimonial/quote
    testimonial_patterns = re.findall(r'["\u201c].*?["\u201d]|—\s*\w+|CEO|CTO|founder|customer', all_text_lower)
    has_testimonial = len(testimonial_patterns) > 0

    # Dim 42: Step-by-step structure
    step_count = 0
    for pattern in STEP_PATTERNS:
        step_count += len(re.findall(pattern, all_text_lower))
    has_step_structure = step_count >= 2

    # Dim 43: Jargon density
    jargon_words = word_set & TECHNICAL_JARGON
    jargon_count = len(jargon_words)
    jargon_density = jargon_count / len(all_words) if all_words else 0

    # Dim 44: Benefit vs feature language
    benefit_count = len(word_set & BENEFIT_WORDS)
    feature_word_count = len(word_set & FEATURE_WORDS)
    benefit_ratio = benefit_count / (benefit_count + feature_word_count) if (benefit_count + feature_word_count) > 0 else 0.5

    # Dim 45: Urgency/scarcity signals
    urgency_words_found = word_set & URGENCY_WORDS
    urgency_count = len(urgency_words_found)

    # Dim 46: Brand name repetition
    brand_name = ''
    if launch_data:
        brand_name = launch_data.get('company_name', '').lower()
    brand_mentions = all_text_lower.count(brand_name) if brand_name and len(brand_name) > 2 else 0

    # Dim 47: Tagline consistency
    tagline_match = False
    if launch_data and launch_data.get('tagline'):
        tagline_words = set(re.findall(r'[a-z]+', launch_data['tagline'].lower()))
        if len(tagline_words) >= 3:
            overlap = len(tagline_words & word_set) / len(tagline_words)
            tagline_match = overlap > 0.5

    # Dim 48: Screen text reading time
    reading_speeds = []
    for i, te in enumerate(text_extractions):
        word_count = len(te['text'].split())
        reading_time_needed = word_count / 4.0  # ~4 words per second for on-screen
        if i + 1 < len(text_extractions):
            display_time = text_extractions[i+1]['timestamp_sec'] - te['timestamp_sec']
        else:
            display_time = max(3.0, duration - te['timestamp_sec']) if duration > 0 else 3.0
        if display_time > 0:
            reading_speeds.append(display_time / reading_time_needed if reading_time_needed > 0 else 999)

    avg_reading_comfort = np.mean(reading_speeds) if reading_speeds else 0
    # >1 = comfortable, <1 = text disappears too fast

    # Dim 49: Emotional arc
    timeline_sentiments = []
    for te in text_extractions:
        words = set(re.findall(r'[a-z]+', te['text'].lower()))
        neg = len(words & NEGATIVE_SENTIMENT)
        pos = len(words & POSITIVE_SENTIMENT)
        score = pos - neg
        timeline_sentiments.append((te['timestamp_sec'], score))

    emotional_arc = 'flat'
    if len(timeline_sentiments) >= 4:
        half = len(timeline_sentiments) // 2
        first_half_sentiment = np.mean([s for _, s in timeline_sentiments[:half]])
        second_half_sentiment = np.mean([s for _, s in timeline_sentiments[half:]])
        if first_half_sentiment < -0.3 and second_half_sentiment > 0:
            emotional_arc = 'problem_to_solution'
        elif first_half_sentiment > 0 and second_half_sentiment > first_half_sentiment:
            emotional_arc = 'positive_escalation'
        elif first_half_sentiment > 0 and second_half_sentiment < first_half_sentiment:
            emotional_arc = 'declining'
        elif abs(first_half_sentiment - second_half_sentiment) < 0.3:
            emotional_arc = 'flat'
        else:
            emotional_arc = 'mixed'

    # Dim 50: Question marks
    question_count = pseudo_transcript.count('?')
    has_questions = question_count > 0

    # Dim 51: Acronym density
    acronyms = re.findall(r'\b[A-Z]{2,}\b', pseudo_transcript)
    acronym_count = len(acronyms)
    acronym_density = acronym_count / len(all_words) if all_words else 0

    # Dim 15: URL shown
    urls_found = re.findall(r'[a-zA-Z0-9-]+\.(?:com|io|ai|co|dev|app|org|net)\b', pseudo_transcript)
    has_url = len(urls_found) > 0

    # Dim 16: Distinct visual environments (from existing scene data)
    scene_count = ocr_data.get('transition_count', 0) + 1

    # Dim 25: Text animation detection
    # If same words appear at different timestamps with different surrounding text = likely animated
    word_first_seen = {}
    word_appearances = defaultdict(int)
    for te in text_extractions:
        words = te['text'].split()
        for w in words:
            w_low = w.lower()
            if len(w_low) >= 4:
                word_appearances[w_low] += 1
                if w_low not in word_first_seen:
                    word_first_seen[w_low] = te['timestamp_sec']

    repeated_words = {w: c for w, c in word_appearances.items() if c >= 3}
    has_text_animation = len(repeated_words) > 3  # Many words appearing repeatedly = animated/persistent UI

    # Dim 26: Before/after structure
    # Detect if text segments have contrasting pairs
    has_before_after = bool(re.search(r'before|after|old|new|without|with\b', all_text_lower))

    # Dim 27: Data visualization
    has_data_viz = bool(re.search(r'chart|graph|analytics|dashboard|metric|report|trend|growth', all_text_lower))

    return {
        # Dim 32
        'value_prop_timestamp': vp_timestamp,
        'value_prop_placement': vp_placement,
        # Dim 33
        'has_problem_solution_arc': has_problem_solution_arc,
        'negative_sentiment_timestamps': len(neg_timestamps),
        'positive_sentiment_timestamps': len(pos_timestamps),
        # Dim 34
        'social_proof_count': social_proof_count,
        'has_social_proof': social_proof_count > 0,
        # Dim 35
        'metric_count': metric_count,
        'metrics_found': metric_patterns[:5],
        'metric_placement': metric_placement,
        # Dim 36
        'cta_count': len(cta_found),
        'cta_types': list(set(cta_found))[:3],
        'cta_timing': cta_timing,
        'has_cta': len(cta_found) > 0,
        # Dim 37
        'competitor_mentions': competitor_mentions,
        # Dim 38
        'feature_count': feature_count,
        'features_per_min': round(features_per_min, 1),
        # Dim 39
        'has_pricing': has_pricing,
        'pricing_texts': pricing_patterns[:3],
        # Dim 40
        'text_length_variance': round(text_length_variance, 1),
        # Dim 41
        'has_testimonial': has_testimonial,
        # Dim 42
        'has_step_structure': has_step_structure,
        'step_count': step_count,
        # Dim 43
        'jargon_count': jargon_count,
        'jargon_density': round(jargon_density, 3),
        'jargon_words': list(jargon_words)[:10],
        # Dim 44
        'benefit_count': benefit_count,
        'feature_word_count': feature_word_count,
        'benefit_ratio': round(benefit_ratio, 2),
        # Dim 45
        'urgency_count': urgency_count,
        'has_urgency': urgency_count > 0,
        # Dim 46
        'brand_mentions': brand_mentions,
        # Dim 47
        'tagline_match': tagline_match,
        # Dim 48
        'avg_reading_comfort': round(avg_reading_comfort, 2),
        # Dim 49
        'emotional_arc': emotional_arc,
        # Dim 50
        'question_count': question_count,
        'has_questions': has_questions,
        # Dim 51
        'acronym_count': acronym_count,
        'acronym_density': round(acronym_density, 3),
        # Dim 15
        'has_url_shown': has_url,
        'urls_found': urls_found[:5],
        # Dim 16
        'distinct_scenes': scene_count,
        # Dim 25
        'has_text_animation': has_text_animation,
        # Dim 26
        'has_before_after': has_before_after,
        # Dim 27
        'has_data_viz': has_data_viz,

        'total_ocr_words': len(all_words),
    }


def process_video(args):
    """Process one video: visual + marketing analysis."""
    video_path, ocr_json_path, launch_data = args
    video_id = os.path.splitext(os.path.basename(video_path))[0]
    out_path = os.path.join(OUTPUT_DIR, f"{video_id}.json")

    # Skip if done
    if os.path.exists(out_path):
        try:
            existing = json.load(open(out_path))
            if existing.get('status') == 'ok':
                return video_id, None
        except Exception:
            pass

    try:
        # Visual pass
        visual = analyze_visual_extended(video_path)
        if visual is None:
            result = {'video_id': video_id, 'status': 'failed', 'error': 'visual_failed'}
            json.dump(result, open(out_path, 'w'), indent=2, cls=NpEncoder)
            return video_id, 'failed'

        # Load OCR data
        ocr_data = {}
        if os.path.exists(ocr_json_path):
            ocr_data = json.load(open(ocr_json_path))

        # Marketing/text pass
        marketing = analyze_text_marketing(ocr_data, launch_data)

        result = {
            'video_id': video_id,
            'status': 'ok',
            'visual': visual,
            'marketing': marketing,
        }

        with open(out_path, 'w') as f:
            json.dump(result, f, indent=2, cls=NpEncoder)

        return video_id, 'ok'

    except Exception as e:
        result = {'video_id': video_id, 'status': 'error', 'error': str(e)[:200]}
        with open(out_path, 'w') as f:
            json.dump(result, f, indent=2, cls=NpEncoder)
        return video_id, f'error: {str(e)[:60]}'


def build_task_list():
    """Build list of (video_path, ocr_path, launch_data) tuples."""
    # Load enriched launches for metadata
    enriched = {}
    if os.path.exists('yc_launches_enriched.json'):
        launches = json.load(open('yc_launches_enriched.json'))
        for launch in launches:
            if not launch.get('video_urls'):
                continue
            urls = launch['video_urls'].split(' | ') if ' | ' in launch['video_urls'] else [launch['video_urls']]
            for url in urls:
                for pattern in [r'youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})',
                                r'youtu\.be/([a-zA-Z0-9_-]{11})']:
                    m = re.search(pattern, url)
                    if m:
                        enriched[m.group(1)] = launch
                        break

    tasks = []
    for vdir, adir in zip(VIDEO_DIRS, ANALYSIS_DIRS):
        for vpath in sorted(glob.glob(os.path.join(vdir, '*.mp4'))):
            if os.path.getsize(vpath) < 1000:
                continue
            vid = os.path.splitext(os.path.basename(vpath))[0]
            ocr_path = os.path.join(adir, f'{vid}.json')
            launch = enriched.get(vid)
            tasks.append((vpath, ocr_path, launch))

    return tasks


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    tasks = build_task_list()
    print(f"Total videos to analyze: {len(tasks)}")

    # Check already done
    remaining = []
    for t in tasks:
        vid = os.path.splitext(os.path.basename(t[0]))[0]
        out_path = os.path.join(OUTPUT_DIR, f'{vid}.json')
        if os.path.exists(out_path):
            try:
                existing = json.load(open(out_path))
                if existing.get('status') == 'ok':
                    continue
            except Exception:
                pass
        remaining.append(t)

    print(f"Already done: {len(tasks) - len(remaining)}, remaining: {len(remaining)}")

    if not remaining:
        print("All done!")
        return

    ok = fail = 0
    t0 = time.time()
    workers = min(4, os.cpu_count() or 2)
    print(f"Processing with {workers} workers...")

    with ProcessPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(process_video, t): t for t in remaining}
        for future in as_completed(futures):
            try:
                vid_id, status = future.result()
                if status == 'ok':
                    ok += 1
                elif status is not None:
                    fail += 1

                done = ok + fail
                elapsed = time.time() - t0
                rate = done / elapsed * 60 if elapsed > 0 else 0
                eta = (len(remaining) - done) / rate if rate > 0 else 0
                print(f"  [{done}/{len(remaining)}] {status}: {vid_id} — {rate:.1f}/min ETA {eta:.0f}min")
            except Exception as e:
                fail += 1
                print(f"  CRASH: {e}")

    print(f"\nDone! ok={ok} fail={fail} in {(time.time()-t0)/60:.1f}min")


if __name__ == '__main__':
    main()
