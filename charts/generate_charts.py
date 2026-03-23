import json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from matplotlib.lines import Line2D
from scipy import stats

# ── Load data ──────────────────────────────────────────────────────────────────
with open('/Users/maxguillabert/Downloads/index/yc_launches_with_transcripts.json') as f:
    data = json.load(f)

# ── Batch ordering ──────────────────────────────────────────────────────────────
SEASON_ORDER = {'Winter': 0, 'Spring': 1, 'Summer': 2, 'Fall': 3}
SEASON_COLORS = {
    'Winter': '#4da6ff',   # blue
    'Spring': '#4dbb5f',   # green
    'Summer': '#ff9f40',   # orange
    'Fall':   '#ff5555',   # red
}

def batch_sort_key(b):
    parts = b.split()
    season = parts[0]
    year = int(parts[1])
    return (year, SEASON_ORDER.get(season, 99))

all_batches_sorted = sorted(set(d['batch'] for d in data), key=batch_sort_key)

# ── Per-batch stats ─────────────────────────────────────────────────────────────
from collections import defaultdict

batch_data = defaultdict(list)
for d in data:
    batch_data[d['batch']].append(d)

batch_stats = {}
for b in all_batches_sorted:
    launches = batch_data[b]
    votes = [d['votes'] for d in launches]
    has_video = [1 for d in launches if d.get('video_urls', '').strip()]
    batch_stats[b] = {
        'median_votes': float(np.median(votes)),
        'count': len(launches),
        'pct_video': 100.0 * len(has_video) / len(launches) if launches else 0,
        'season': b.split()[0],
    }

# ── Dark theme base ─────────────────────────────────────────────────────────────
BG      = '#1a1a2e'
PANEL   = '#16213e'
TEXT    = '#e0e0e0'
GRID    = '#2a2a4a'
ACCENT  = '#ffffff'

plt.rcParams.update({
    'figure.facecolor':  BG,
    'axes.facecolor':    PANEL,
    'axes.edgecolor':    GRID,
    'axes.labelcolor':   TEXT,
    'xtick.color':       TEXT,
    'ytick.color':       TEXT,
    'text.color':        TEXT,
    'grid.color':        GRID,
    'legend.facecolor':  PANEL,
    'legend.edgecolor':  GRID,
    'font.family':       'DejaVu Sans',
    'font.size':         10,
})

# ═══════════════════════════════════════════════════════════════════════════════
# Chart 1 — Batch median votes (vertical bars)
# ═══════════════════════════════════════════════════════════════════════════════
fig, ax = plt.subplots(figsize=(12, 8), dpi=150)
fig.patch.set_facecolor(BG)
ax.set_facecolor(PANEL)

x_pos = np.arange(len(all_batches_sorted))
medians = [batch_stats[b]['median_votes'] for b in all_batches_sorted]
colors  = [SEASON_COLORS[batch_stats[b]['season']] for b in all_batches_sorted]

bars = ax.bar(x_pos, medians, color=colors, width=0.75, zorder=3, alpha=0.88)

# Annotate top 3
top3_idx = sorted(range(len(medians)), key=lambda i: medians[i], reverse=True)[:3]
for rank, i in enumerate(top3_idx):
    ax.annotate(
        f'#{rank+1} {all_batches_sorted[i]}\n{medians[i]:.1f}',
        xy=(x_pos[i], medians[i]),
        xytext=(x_pos[i], medians[i] + max(medians) * 0.04),
        ha='center', va='bottom',
        fontsize=8.5, color=ACCENT, fontweight='bold',
        arrowprops=dict(arrowstyle='->', color=ACCENT, lw=1.2),
    )

ax.set_xticks(x_pos)
ax.set_xticklabels(all_batches_sorted, rotation=45, ha='right', fontsize=8.5)
ax.set_ylabel('Median Votes', fontsize=12, labelpad=10)
ax.set_title('YC Batch — Median Launch Votes by Batch', fontsize=14, fontweight='bold', pad=16)
ax.yaxis.grid(True, linestyle='--', alpha=0.5, zorder=0)
ax.set_axisbelow(True)

# Legend
legend_elements = [
    Line2D([0], [0], color=SEASON_COLORS['Winter'], marker='s', linestyle='', markersize=10, label='Winter'),
    Line2D([0], [0], color=SEASON_COLORS['Spring'], marker='s', linestyle='', markersize=10, label='Spring'),
    Line2D([0], [0], color=SEASON_COLORS['Summer'], marker='s', linestyle='', markersize=10, label='Summer'),
    Line2D([0], [0], color=SEASON_COLORS['Fall'],   marker='s', linestyle='', markersize=10, label='Fall'),
]
ax.legend(handles=legend_elements, loc='upper left', framealpha=0.8)

plt.tight_layout()
plt.savefig('/Users/maxguillabert/Downloads/index/charts/batch_median_votes.png',
            dpi=150, bbox_inches='tight', facecolor=BG)
plt.close()
print('Chart 1 saved.')

# ═══════════════════════════════════════════════════════════════════════════════
# Chart 2 — Batch size vs median votes (scatter + trend)
# ═══════════════════════════════════════════════════════════════════════════════
fig, ax = plt.subplots(figsize=(12, 8), dpi=150)
fig.patch.set_facecolor(BG)
ax.set_facecolor(PANEL)

sizes   = [batch_stats[b]['count']        for b in all_batches_sorted]
medians2= [batch_stats[b]['median_votes'] for b in all_batches_sorted]
colors2 = [SEASON_COLORS[batch_stats[b]['season']] for b in all_batches_sorted]

sc = ax.scatter(sizes, medians2, c=colors2, s=90, zorder=5, alpha=0.9, edgecolors='white', linewidths=0.4)

# Labels
for i, b in enumerate(all_batches_sorted):
    ax.annotate(b, (sizes[i], medians2[i]),
                textcoords='offset points', xytext=(4, 4),
                fontsize=7.5, color=TEXT, alpha=0.85)

# Trend line
slope, intercept, r, p, se = stats.linregress(sizes, medians2)
x_line = np.linspace(min(sizes), max(sizes), 200)
y_line = slope * x_line + intercept
ax.plot(x_line, y_line, color='#ff9f40', linewidth=1.8, linestyle='--', alpha=0.9,
        label=f'Trend  (r={r:.2f}, p={p:.3f})')

ax.set_xlabel('Number of Launches in Batch', fontsize=12, labelpad=10)
ax.set_ylabel('Median Votes', fontsize=12, labelpad=10)
ax.set_title('Batch Size vs. Median Votes — Do Bigger Batches Dilute Attention?', fontsize=13, fontweight='bold', pad=16)
ax.yaxis.grid(True, linestyle='--', alpha=0.5, zorder=0)
ax.xaxis.grid(True, linestyle='--', alpha=0.5, zorder=0)
ax.set_axisbelow(True)

legend_elements2 = [
    Line2D([0], [0], color=SEASON_COLORS['Winter'], marker='o', linestyle='', markersize=9, label='Winter'),
    Line2D([0], [0], color=SEASON_COLORS['Spring'], marker='o', linestyle='', markersize=9, label='Spring'),
    Line2D([0], [0], color=SEASON_COLORS['Summer'], marker='o', linestyle='', markersize=9, label='Summer'),
    Line2D([0], [0], color=SEASON_COLORS['Fall'],   marker='o', linestyle='', markersize=9, label='Fall'),
    Line2D([0], [0], color='#ff9f40', linewidth=1.8, linestyle='--', label=f'Trend  r={r:.2f}'),
]
ax.legend(handles=legend_elements2, loc='upper right', framealpha=0.8)

plt.tight_layout()
plt.savefig('/Users/maxguillabert/Downloads/index/charts/batch_size_vs_votes.png',
            dpi=150, bbox_inches='tight', facecolor=BG)
plt.close()
print(f'Chart 2 saved. Slope={slope:.4f}, r={r:.3f}, p={p:.4f}')

# ═══════════════════════════════════════════════════════════════════════════════
# Chart 3 — Video adoption over time + median votes overlay
# ═══════════════════════════════════════════════════════════════════════════════
fig, ax1 = plt.subplots(figsize=(12, 8), dpi=150)
fig.patch.set_facecolor(BG)
ax1.set_facecolor(PANEL)

pct_video = [batch_stats[b]['pct_video']     for b in all_batches_sorted]
med_v     = [batch_stats[b]['median_votes']  for b in all_batches_sorted]
x_pos3    = np.arange(len(all_batches_sorted))

# Primary: % with video
ax1.plot(x_pos3, pct_video, color='#4da6ff', linewidth=2.5, marker='o', markersize=6,
         label='% with video', zorder=5)
ax1.fill_between(x_pos3, pct_video, alpha=0.12, color='#4da6ff')
ax1.set_ylabel('% of Launches with Video', color='#4da6ff', fontsize=12, labelpad=10)
ax1.tick_params(axis='y', labelcolor='#4da6ff')
ax1.set_ylim(0, 105)

# Secondary: median votes
ax2 = ax1.twinx()
ax2.set_facecolor(PANEL)
ax2.plot(x_pos3, med_v, color='#ff9f40', linewidth=2.2, marker='s', markersize=5,
         linestyle='--', label='Median votes', zorder=4)
ax2.set_ylabel('Median Votes', color='#ff9f40', fontsize=12, labelpad=10)
ax2.tick_params(axis='y', labelcolor='#ff9f40')

ax1.set_xticks(x_pos3)
ax1.set_xticklabels(all_batches_sorted, rotation=45, ha='right', fontsize=8.5)
ax1.set_title('Video Adoption & Median Votes by Batch — The Fall 2024 Inflection', fontsize=13, fontweight='bold', pad=16)
ax1.yaxis.grid(True, linestyle='--', alpha=0.35, zorder=0)

# Mark Fall 2024 inflection
if 'Fall 2024' in all_batches_sorted:
    fi = all_batches_sorted.index('Fall 2024')
    ax1.axvline(x=fi, color='#ff5555', linewidth=1.6, linestyle=':', alpha=0.85)
    ax1.text(fi + 0.15, 97, 'Fall 2024\ninflection', color='#ff5555',
             fontsize=9, va='top', fontweight='bold')

# Combined legend
lines1, labels1 = ax1.get_legend_handles_labels()
lines2, labels2 = ax2.get_legend_handles_labels()
ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper left', framealpha=0.8)

plt.tight_layout()
plt.savefig('/Users/maxguillabert/Downloads/index/charts/batch_video_adoption.png',
            dpi=150, bbox_inches='tight', facecolor=BG)
plt.close()
print('Chart 3 saved.')

# ── Print summary stats ─────────────────────────────────────────────────────────
print('\n=== Batch summary ===')
for b in all_batches_sorted:
    s = batch_stats[b]
    print(f"{b:20s}  n={s['count']:4d}  median={s['median_votes']:5.1f}  video={s['pct_video']:5.1f}%")

top3 = sorted(all_batches_sorted, key=lambda b: batch_stats[b]['median_votes'], reverse=True)[:3]
print('\nTop 3 by median votes:', top3)
