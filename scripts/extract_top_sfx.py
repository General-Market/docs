#!/usr/bin/env python3
"""
Extract SFX transients from PH launch videos.
Score each by the votes of videos it appears in.
Cluster similar SFX by MFCC fingerprint.
Export top 100 as individual MP3 files.
"""

import json, glob, os, re, sys, time
import numpy as np
import subprocess
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor, as_completed

VIDEO_DIR = "ph_videos_notranscript"
SFX_DIR = "ph_sfx_extracted"
MEGA_DIR = "video_mega_analyses"


def extract_sfx_from_video(video_path, sfx_timestamps, video_id, votes):
    """Extract individual SFX transients as short audio clips."""
    import librosa
    import soundfile as sf

    # Convert to wav first
    tmp_wav = f"/tmp/sfx_{video_id}.wav"
    subprocess.run([
        "ffmpeg", "-y", "-i", video_path, "-ac", "1", "-ar", "22050",
        "-vn", "-f", "wav", tmp_wav
    ], capture_output=True, timeout=30)

    if not os.path.exists(tmp_wav) or os.path.getsize(tmp_wav) < 1000:
        if os.path.exists(tmp_wav): os.remove(tmp_wav)
        return []

    y, sr = librosa.load(tmp_wav, sr=22050, duration=300)
    os.remove(tmp_wav)

    extracted = []
    for i, ts in enumerate(sfx_timestamps[:30]):  # Max 30 SFX per video
        # Extract 0.5s window centered on the transient
        center = int(ts * sr)
        half_win = int(0.25 * sr)  # 250ms each side
        start = max(0, center - half_win)
        end = min(len(y), center + half_win)

        if end - start < sr // 10:  # Too short
            continue

        clip = y[start:end]

        # Compute MFCC fingerprint for this clip
        mfcc = librosa.feature.mfcc(y=clip, sr=sr, n_mfcc=13)
        mfcc_mean = np.mean(mfcc, axis=1)

        # Spectral features for classification
        centroid = float(np.mean(librosa.feature.spectral_centroid(y=clip, sr=sr)))
        bandwidth = float(np.mean(librosa.feature.spectral_bandwidth(y=clip, sr=sr)))
        zcr = float(np.mean(librosa.feature.zero_crossing_rate(clip)))
        rms = float(np.sqrt(np.mean(clip**2)))
        rms_db = 20 * np.log10(rms + 1e-10)

        # Classify SFX type
        if centroid > 5000 and zcr > 0.15:
            sfx_type = 'click'
        elif centroid > 4000 and bandwidth > 3000:
            sfx_type = 'whoosh'
        elif centroid > 3000 and rms_db > -20:
            sfx_type = 'ding'
        elif centroid < 1000 and rms_db > -15:
            sfx_type = 'bass_hit'
        elif bandwidth > 5000:
            sfx_type = 'transition'
        elif zcr < 0.05 and rms_db > -25:
            sfx_type = 'tone'
        else:
            sfx_type = 'other'

        # Save clip
        clip_id = f"{video_id}_{i:03d}"
        wav_path = os.path.join(SFX_DIR, "wav", f"{clip_id}.wav")
        sf.write(wav_path, clip, sr)

        extracted.append({
            'clip_id': clip_id,
            'video_id': video_id,
            'votes': votes,
            'timestamp': round(ts, 2),
            'sfx_type': sfx_type,
            'mfcc_mean': mfcc_mean.tolist(),
            'centroid': round(centroid, 0),
            'bandwidth': round(bandwidth, 0),
            'zcr': round(zcr, 4),
            'rms_db': round(rms_db, 1),
            'wav_path': wav_path,
        })

    return extracted


def process_video(args):
    video_id, video_path, sfx_timestamps, votes = args
    try:
        clips = extract_sfx_from_video(video_path, sfx_timestamps, video_id, votes)
        return video_id, clips
    except Exception as e:
        return video_id, []


def main():
    os.makedirs(os.path.join(SFX_DIR, "wav"), exist_ok=True)
    os.makedirs(os.path.join(SFX_DIR, "mp3"), exist_ok=True)

    # Load PH data for votes
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

    # Load mega analyses with SFX timestamps
    tasks = []
    for f in glob.glob(f'{MEGA_DIR}/*.json'):
        try:
            d = json.load(open(f))
            if d.get('status') != 'ok': continue
            ad = d.get('audio_deep', {})
            if ad.get('error') or not ad.get('strong_sfx_timestamps'): continue

            vid = d['video_id']
            if vid not in ph_vid_map: continue

            video_path = os.path.join(VIDEO_DIR, f"{vid}.mp4")
            if not os.path.exists(video_path): continue

            votes = ph_vid_map[vid].get('votes', 0)
            sfx_ts = ad['strong_sfx_timestamps']

            if len(sfx_ts) >= 3:  # Only videos with enough SFX
                tasks.append((vid, video_path, sfx_ts, votes))
        except:
            pass

    # Sort by votes descending — prioritize top videos
    tasks.sort(key=lambda x: -x[3])
    # Take top 200 videos by votes
    tasks = tasks[:200]

    print(f"Extracting SFX from {len(tasks)} top-voted PH videos")

    all_clips = []
    t0 = time.time()
    workers = min(4, os.cpu_count() or 2)

    with ProcessPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(process_video, t): t for t in tasks}
        done = 0
        for future in as_completed(futures):
            vid, clips = future.result()
            all_clips.extend(clips)
            done += 1
            if done % 20 == 0:
                elapsed = time.time() - t0
                rate = done / elapsed * 60 if elapsed > 0 else 0
                print(f"  [{done}/{len(tasks)}] clips={len(all_clips)} — {rate:.0f} vids/min")

    print(f"\nExtracted {len(all_clips)} SFX clips from {len(tasks)} videos in {(time.time()-t0)/60:.1f}min")

    # ============================================================
    # SCORE EACH CLIP: vote-weighted
    # ============================================================
    for clip in all_clips:
        clip['score'] = clip['votes']  # Base score = video votes

    # ============================================================
    # CLUSTER SIMILAR SFX BY MFCC
    # ============================================================
    from sklearn.cluster import KMeans

    if len(all_clips) < 100:
        print(f"Only {len(all_clips)} clips, need more")
        # Save what we have
        with open(os.path.join(SFX_DIR, 'all_clips.json'), 'w') as f:
            json.dump(all_clips, f, indent=2)
        return

    X = np.array([c['mfcc_mean'] for c in all_clips])
    X_norm = (X - X.mean(axis=0)) / (X.std(axis=0) + 1e-10)

    n_clusters = min(100, len(all_clips) // 3)
    print(f"Clustering {len(all_clips)} clips into {n_clusters} groups...")
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = kmeans.fit_predict(X_norm)

    for i, clip in enumerate(all_clips):
        clip['cluster'] = int(labels[i])

    # ============================================================
    # SCORE CLUSTERS: sum of votes across all clips in cluster
    # ============================================================
    cluster_scores = defaultdict(lambda: {'total_votes': 0, 'clip_count': 0, 'clips': [], 'types': []})
    for clip in all_clips:
        c = clip['cluster']
        cluster_scores[c]['total_votes'] += clip['votes']
        cluster_scores[c]['clip_count'] += 1
        cluster_scores[c]['clips'].append(clip)
        cluster_scores[c]['types'].append(clip['sfx_type'])

    # Pick representative clip from each cluster (highest-voted video)
    for c_id, info in cluster_scores.items():
        info['clips'].sort(key=lambda x: -x['votes'])
        info['representative'] = info['clips'][0]
        info['avg_votes'] = info['total_votes'] / info['clip_count']
        # Most common type
        from collections import Counter
        info['dominant_type'] = Counter(info['types']).most_common(1)[0][0]

    # Rank clusters by total_votes
    ranked = sorted(cluster_scores.items(), key=lambda x: -x[1]['total_votes'])

    # ============================================================
    # EXPORT TOP 100 AS MP3
    # ============================================================
    print(f"\nTop 100 SFX clusters:")
    top_100 = []
    for rank, (c_id, info) in enumerate(ranked[:100]):
        rep = info['representative']
        wav_path = rep['wav_path']
        mp3_name = f"sfx_{rank+1:03d}_{info['dominant_type']}_{rep['video_id']}.mp3"
        mp3_path = os.path.join(SFX_DIR, "mp3", mp3_name)

        # Convert to MP3
        subprocess.run([
            "ffmpeg", "-y", "-i", wav_path, "-codec:a", "libmp3lame",
            "-qscale:a", "2", mp3_path
        ], capture_output=True, timeout=10)

        entry = {
            'rank': rank + 1,
            'cluster_id': c_id,
            'total_votes': info['total_votes'],
            'avg_votes': round(info['avg_votes'], 0),
            'clip_count': info['clip_count'],
            'dominant_type': info['dominant_type'],
            'mp3_file': mp3_name,
            'source_video': rep['video_id'],
            'source_votes': rep['votes'],
            'timestamp': rep['timestamp'],
            'centroid': rep['centroid'],
            'bandwidth': rep['bandwidth'],
            'rms_db': rep['rms_db'],
        }
        top_100.append(entry)

        print(f"  #{rank+1:3d} | {info['dominant_type']:12s} | "
              f"total_votes={info['total_votes']:6d} | "
              f"clips={info['clip_count']:3d} | "
              f"avg_votes={info['avg_votes']:5.0f} | "
              f"from {rep['video_id']} ({rep['votes']}v)")

    # Save index
    with open(os.path.join(SFX_DIR, 'top_100_sfx.json'), 'w') as f:
        json.dump(top_100, f, indent=2)

    with open(os.path.join(SFX_DIR, 'all_clips.json'), 'w') as f:
        json.dump(all_clips, f, indent=2, default=lambda x: int(x) if isinstance(x, (np.integer,)) else float(x) if isinstance(x, (np.floating,)) else str(x))

    # ============================================================
    # SFX TYPE DISTRIBUTION
    # ============================================================
    print(f"\n--- SFX Type Distribution ---")
    type_stats = defaultdict(lambda: {'count': 0, 'total_votes': 0})
    for clip in all_clips:
        t = clip['sfx_type']
        type_stats[t]['count'] += 1
        type_stats[t]['total_votes'] += clip['votes']

    for t, stats in sorted(type_stats.items(), key=lambda x: -x[1]['total_votes']):
        avg = stats['total_votes'] / stats['count']
        print(f"  {t:15s}: n={stats['count']:5d}  total_votes={stats['total_votes']:8d}  avg={avg:.0f}")

    print(f"\nDone! Top 100 MP3s in {SFX_DIR}/mp3/")
    print(f"Full index: {SFX_DIR}/top_100_sfx.json")


if __name__ == '__main__':
    main()
