import json
import re
import statistics
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm

# Load data
with open('/Users/maxguillabert/Downloads/index/yc_launches_with_transcripts.json', 'r') as f:
    launches = json.load(f)

print(f"Total launches: {len(launches)}")

def extract_team_size(body_text, transcript):
    """
    Returns an integer estimate of team size, or None if unknown.
    Multiple signals are tried, with a priority/confidence hierarchy.
    """
    text_combined = ' '.join(filter(None, [body_text or '', transcript or '']))
    text_lower = text_combined.lower()

    # ── SIGNAL 1: explicit "team of N" / "we are N" / "N-person team" ──
    patterns_explicit = [
        r'\bteam\s+of\s+(\w+)\b',
        r'\bwe\s+are\s+a\s+team\s+of\s+(\w+)\b',
        r'\b(\w+)[\s-]person\s+team\b',
        r'\bteam\s+of\s+(\d+)\b',
        r'\b(\d+)\s*-\s*person\s+team\b',
    ]

    # ── SIGNAL 2: "X of us" ──
    patterns_of_us = [
        r'\b(two|three|four|five|six|seven|eight|nine|ten|2|3|4|5|6|7|8|9|10)\s+of\s+us\b',
        r'\bthere\s+are\s+(two|three|four|five|six|seven|eight|nine|ten|2|3|4|5|6|7|8|9|10)\s+of\s+us\b',
        r'\bthe\s+(two|three|four|five|six|seven|eight|nine|ten|2|3|4|5|6|7|8|9|10)\s+of\s+us\b',
    ]

    # ── SIGNAL 3: co-founder mentions ──
    patterns_cofounders = [
        r'\b(two|three|four|five|2|3|4|5)\s+co[\s-]?founders?\b',
        r'\b(two|three|four|five|2|3|4|5)\s+founders?\b',
        r'\bco[\s-]?founded\s+by\s+(two|three|four|five|2|3|4|5)\b',
    ]

    # ── SIGNAL 4: "N engineers / N people / N members" ──
    patterns_count = [
        r'\b(\d+)\s+engineers?\b',
        r'\b(\d+)\s+people\b',
        r'\b(\d+)\s+team\s+members?\b',
        r'\b(\d+)\s+employees?\b',
        r'\b(\d+)\s+full[\s-]?time\b',
        r'\bteam\s+of\s+(\d+)\b',
    ]

    word_to_num = {
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
        'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
        'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18,
        'nineteen': 19, 'twenty': 20,
    }

    def to_int(s):
        s = s.strip()
        if s.isdigit():
            return int(s)
        return word_to_num.get(s.lower(), None)

    # Try explicit patterns first
    for pat in patterns_explicit:
        m = re.search(pat, text_lower)
        if m:
            v = to_int(m.group(1))
            if v and 1 <= v <= 200:
                return v

    # "X of us"
    for pat in patterns_of_us:
        m = re.search(pat, text_lower)
        if m:
            v = to_int(m.group(1))
            if v and 1 <= v <= 20:
                return v

    # co-founder counts
    for pat in patterns_cofounders:
        m = re.search(pat, text_lower)
        if m:
            v = to_int(m.group(1))
            if v and 1 <= v <= 10:
                return v

    # ── SIGNAL 5: solo founder indicators ──
    solo_patterns = [
        r'\bsolo\s+founder\b',
        r'\bi\'?m\s+the\s+(only|sole)\s+founder\b',
        r'\bfounding\s+alone\b',
        r'\bbuilt\s+this\s+alone\b',
        r'\bi\s+am\s+the\s+only\s+founder\b',
        r'\bjust\s+me\b',
        r'\bonly\s+founder\b',
    ]
    for pat in solo_patterns:
        if re.search(pat, text_lower):
            return 1

    # ── SIGNAL 6: "my co-founder" → duo ──
    if re.search(r'\bmy\s+co[\s-]?founder\b', text_lower):
        return 2

    # ── SIGNAL 7: "I" alone with no co-founder = likely solo; but "we" with co-founder context ──
    # Count title-bearing people: CEO, CTO, CPO, CFO, COO etc.
    title_names = re.findall(
        r'(?:^|[\s,;(])([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*[,–-]?\s*(?:CEO|CTO|CPO|CFO|COO|CXO|Founder|Co-?Founder|VP|President|Head\s+of)',
        text_combined
    )
    if title_names:
        unique_names = set(n.strip() for n in title_names)
        if 1 <= len(unique_names) <= 15:
            return len(unique_names)

    # ── SIGNAL 8: Hi we're [Name], [Name] and [Name] ──
    hi_pattern = re.search(
        r"(?:hi|hello)[,!]?\s+(?:i'?m|we'?re|i am|we are)\s+([A-Z][a-zA-Zéàüçşñ]+(?:[,\s]+(?:and\s+)?[A-Z][a-zA-Zéàüçşñ]+){0,9})",
        text_combined
    )
    if hi_pattern:
        intro = hi_pattern.group(1)
        # Count capitalized name-like tokens
        names = re.findall(r'[A-Z][a-záéíóúàèìòùüçşñ]+', intro)
        if 1 <= len(names) <= 10:
            return len(names)

    # ── SIGNAL 9: "and I" → at least 2 founders ──
    # Count "X and I" or "I and X" patterns to infer cofounder count
    and_i_count = len(re.findall(r'\band\s+i\b|\bi\s+and\b', text_lower))
    if and_i_count >= 1:
        # Estimate from "and I" + likely list patterns
        # Look for "my cofounder and I", "the two of us"
        pass  # already handled above

    # ── SIGNAL 10: headcount mentions like "10-person", "15-person" ──
    m = re.search(r'\b(\d+)[\s-]person\b', text_lower)
    if m:
        v = int(m.group(1))
        if 1 <= v <= 200:
            return v

    # ── SIGNAL 11: team size from N count patterns ──
    for pat in patterns_count:
        m = re.search(pat, text_lower)
        if m:
            v = int(m.group(1))
            if 1 <= v <= 200:
                return v

    return None


def bucket(size):
    if size is None:
        return 'unknown'
    if size == 1:
        return 'solo (1)'
    if size == 2:
        return 'duo (2)'
    if 3 <= size <= 5:
        return 'small (3–5)'
    if 6 <= size <= 15:
        return 'medium (6–15)'
    return 'large (16+)'


BUCKET_ORDER = ['solo (1)', 'duo (2)', 'small (3–5)', 'medium (6–15)', 'large (16+)', 'unknown']

results = []
for launch in launches:
    size = extract_team_size(launch.get('body_text'), launch.get('transcript'))
    b = bucket(size)
    results.append({
        'id': launch.get('id'),
        'title': launch.get('title'),
        'votes': launch.get('votes', 0),
        'team_size': size,
        'bucket': b,
        'batch': launch.get('batch'),
        'industry': launch.get('industry'),
    })

# Aggregate stats per bucket
from collections import defaultdict
bucket_data = defaultdict(list)
for r in results:
    bucket_data[r['bucket']].append(r['votes'])

print("\n=== TEAM SIZE ANALYSIS ===\n")
stats_rows = []
for b in BUCKET_ORDER:
    votes = bucket_data[b]
    if not votes:
        continue
    n = len(votes)
    avg = statistics.mean(votes)
    med = statistics.median(votes)
    p75 = np.percentile(votes, 75)
    p90 = np.percentile(votes, 90)
    stats_rows.append({
        'bucket': b,
        'count': n,
        'avg': avg,
        'median': med,
        'p75': p75,
        'p90': p90,
    })
    print(f"{b:18s}  n={n:4d}  avg={avg:6.1f}  median={med:5.0f}  p75={p75:5.0f}  p90={p90:5.0f}")

# ── CHART ──
fig, ax = plt.subplots(figsize=(10, 6), facecolor='#0d0d0d')
ax.set_facecolor('#0d0d0d')

labels = [r['bucket'] for r in stats_rows]
medians = [r['median'] for r in stats_rows]
counts  = [r['count']  for r in stats_rows]
avgs    = [r['avg']    for r in stats_rows]

x = np.arange(len(labels))
bar_width = 0.55

# Color: highlight non-unknown buckets
colors = []
for r in stats_rows:
    if r['bucket'] == 'unknown':
        colors.append('#444444')
    elif r['bucket'] == 'duo (2)':
        colors.append('#e8c84a')
    else:
        colors.append('#5b9cf6')

bars = ax.bar(x, medians, width=bar_width, color=colors, zorder=3,
              linewidth=0, edgecolor='none')

# Avg dots
ax.scatter(x, avgs, color='#ff7a7a', s=60, zorder=5, label='mean')

# Gridlines
ax.yaxis.grid(True, color='#2a2a2a', linewidth=0.8, zorder=0)
ax.set_axisbelow(True)

# Annotate bars with n and median
for i, (bar, row) in enumerate(zip(bars, stats_rows)):
    h = bar.get_height()
    ax.text(bar.get_x() + bar.get_width() / 2, h + 0.5,
            f'n={row["count"]}\nmed={int(row["median"])}',
            ha='center', va='bottom', color='#cccccc', fontsize=8.5,
            fontfamily='DejaVu Sans')

# Axes styling
ax.set_xticks(x)
ax.set_xticklabels(labels, color='#dddddd', fontsize=11, fontfamily='DejaVu Sans')
ax.set_ylabel('Median Votes', color='#aaaaaa', fontsize=12, fontfamily='DejaVu Sans')
ax.tick_params(axis='y', colors='#aaaaaa', labelsize=10)
ax.tick_params(axis='x', colors='#aaaaaa')
for spine in ax.spines.values():
    spine.set_visible(False)

ax.set_title('YC Launch Votes by Team Size', color='#ffffff',
             fontsize=15, fontweight='bold', fontfamily='DejaVu Sans', pad=16)

# Legend
legend = ax.legend(loc='upper right', frameon=False, labelcolor='#ff7a7a',
                   fontsize=10)

plt.tight_layout()
plt.savefig('/Users/maxguillabert/Downloads/index/charts/team_size_votes.png',
            dpi=150, bbox_inches='tight', facecolor='#0d0d0d')
print("\nChart saved to /Users/maxguillabert/Downloads/index/charts/team_size_votes.png")

# ── Additional debug: sample extractions ──
print("\n=== SAMPLE EXTRACTIONS (first 20 with known size) ===")
shown = 0
for r in results:
    if r['team_size'] is not None and shown < 20:
        print(f"  size={r['team_size']:2d}  bucket={r['bucket']:18s}  votes={r['votes']:4d}  {r['title'][:60]}")
        shown += 1
