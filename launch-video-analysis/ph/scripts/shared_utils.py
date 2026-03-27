"""Shared utilities for v2 transcript analysis."""
import json, re, math
from collections import Counter

DATA_PATH = "launch-video-analysis/ph/data/ph_daily_top_with_transcripts.json"
V2_PARTS = "launch-video-analysis/ph/v2-parts"

def load_transcripts(min_words=20):
    with open(DATA_PATH) as f:
        data = json.load(f)
    out = []
    for x in data:
        t = x.get("transcript", "").strip()
        if len(t.split()) >= min_words:
            out.append({
                "id": x["id"],
                "name": x["name"],
                "date": x["date"],
                "year": x["date"][:4],
                "votes": x["votes"],
                "comments": x.get("comments", 0),
                "transcript": t,
                "description": x.get("description", ""),
                "tagline": x.get("tagline", ""),
            })
    return out

def sentences(text):
    text = re.sub(r'\[.*?\]', '', text)
    sents = re.split(r'(?<=[.!?])\s+', text.strip())
    return [s.strip() for s in sents if len(s.strip()) > 2]

def words(text):
    text = re.sub(r'\[.*?\]', '', text)
    return re.findall(r"[a-zA-Z']+", text.lower())

def word_count(text):
    return len(words(text))

def thirds(sents):
    n = len(sents)
    if n < 3:
        return [sents, [], []]
    t = n // 3
    return [sents[:t], sents[t:2*t], sents[2*t:]]

def spearman_r(x, y):
    n = len(x)
    if n < 5:
        return 0.0
    def rank(arr):
        sorted_idx = sorted(range(n), key=lambda i: arr[i])
        ranks = [0.0] * n
        i = 0
        while i < n:
            j = i
            while j < n - 1 and arr[sorted_idx[j]] == arr[sorted_idx[j+1]]:
                j += 1
            avg_rank = (i + j) / 2.0 + 1
            for k in range(i, j + 1):
                ranks[sorted_idx[k]] = avg_rank
            i = j + 1
        return ranks
    rx, ry = rank(x), rank(y)
    d2 = sum((rx[i] - ry[i]) ** 2 for i in range(n))
    return 1 - (6 * d2) / (n * (n * n - 1))

def median(vals):
    if not vals:
        return 0
    s = sorted(vals)
    n = len(s)
    return s[n // 2]

def save_results(name, results):
    """Save partial results: list of {id, dim1, dim2, ...}"""
    with open(f"{V2_PARTS}/{name}.json", "w") as f:
        json.dump(results, f)

def count_pattern(text, patterns):
    text_lower = text.lower()
    count = 0
    for p in patterns:
        count += len(re.findall(p, text_lower))
    return count

def has_pattern(text, patterns):
    text_lower = text.lower()
    for p in patterns:
        if re.search(p, text_lower):
            return True
    return False
