# Complete Technical Guide: From Twitch API to a Trading Bot on Vision Testnet

Every moment Twitch generates a data stream no human viewer can process manually: tens of thousands of concurrent streams, millions of chat messages per hour, hundreds of game categories, second-by-second viewer counts. The human mind perceives streams through narrative — "xQc had a big night," "the channel collapsed after that raid." A machine sees viewer retention, bits-per-viewer ratios, chat cadence, subscription velocity — and finds patterns hidden behind the noise. In this article we build a full prediction system combining three probability layers: external streaming analytics (StreamCharts / SullyGnome / TwitchTracker), Vision testnet market prices (crowd intelligence on the Index L3 blockchain), and a custom ML model with Claude API as the interpreter. The entire pipeline is in Python: twitchio, pandas, scikit-learn, XGBoost, matplotlib — plus web3.py for reading Vision testnet prices on-chain.

## System Architecture

The system consists of several layers, each serving its own role:

```
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                              │
│  twitchio │ Twitch Helix API │ StreamCharts │ SullyGnome     │
│                                                              │
│  ┌──────────────────────────────────────────────────┐        │
│  │   Vision Testnet Markets (Index L3 Orbit)        │        │
│  │  Crowd-sourced probabilities on-chain (chainId   │        │
│  │  111222333). Read via web3.py, ABI from Index.   │        │
│  └──────────────────────────────────────────────────┘        │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   PROCESSING LAYER                           │
│  pandas │ numpy │ data cleaning │ feature engineering        │
│                                                              │
│  ┌──────────────────────────────────────────────────┐        │
│  │  Claude API: feature generation,                 │        │
│  │  context analysis, stats interpretation          │        │
│  └──────────────────────────────────────────────────┘        │
│                                                              │
│  ┌──────────────────────────────────────────────────┐        │
│  │  Merging 3 probability layers:                   │        │
│  │  External analytics + Vision testnet + ML model  │        │
│  └──────────────────────────────────────────────────┘        │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     MODEL LAYER                              │
│  Logistic Regression │ Random Forest │ XGBoost               │
│  Ensemble (Voting / Stacking)                                │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 INTERPRETATION LAYER                          │
│  Claude API: natural language prediction explanation          │
│  + confidence assessment + divergence analysis                │
│    between external analytics / Vision testnet / ML           │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    OUTPUT LAYER                               │
│  matplotlib visualizations │ JSON reports │ Telegram bot      │
│  Vision testnet trade submission (via AP / order API)        │
└─────────────────────────────────────────────────────────────┘
```

## Why Twitch Is the Best Playground for Predictive ML

Twitch produces thousands of active streams each day, each with high-frequency telemetry — viewer counts polled every minute, chat messages arriving every second, subscription and bit events timestamped to the millisecond. A binary outcome (goal hit / goal missed, viewer threshold reached / not, stream uptime ≥ N hours / not) simplifies the task to pure classification. Mid-tier streamers hit publicly declared goals 58–68% of the time — patterns are stable and modelable. And the Twitch Helix API provides metadata, viewer history and stream state without spending a dollar.

| Parameter | Twitch |
|---|---|
| Events per stream | ~50,000 chat messages, 500+ subs, continuous viewer ticks |
| Typical peak viewers | 1k–50k for mid-tier channels |
| Outcomes | 2 (YES/NO) — pure binary classification |
| Predictability | ~60–68% for top streamer outcomes |
| API data | Free (Twitch Helix API, OAuth app token) |
| Tracking data | Chat events via IRC, viewer counts via Helix polling |
| Streams/week | 10–50 per channel (sufficient for rolling averages over months) |

## Required Dependencies

```python
# requirements.txt
anthropic>=0.40.0
twitchio>=2.8.0
pandas>=2.1.0
numpy>=1.24.0
scikit-learn>=1.3.0
xgboost>=2.0.0
matplotlib>=3.8.0
seaborn>=0.13.0
requests>=2.31.0
python-dotenv>=1.0.0
schedule>=1.2.0           # pipeline automation
web3>=6.15.0              # Vision testnet RPC (Index L3 Orbit)
eth-account>=0.11.0       # order signing for Vision testnet
```

Installation:

```bash
pip install anthropic twitchio pandas numpy scikit-learn xgboost matplotlib seaborn requests python-dotenv schedule web3 eth-account
```

twitchio is a free open-source client for the Twitch Helix API and IRC chat — it requires only an OAuth app token. The Vision testnet RPC is public (`http://142.132.164.24/`, chainId `111222333`). External analytics providers (StreamCharts, SullyGnome) expose free endpoints or are scrape-friendly.

## Data Collection & Preparation

The primary data source is the Twitch Helix API via `twitchio`, which exposes stream state, channel metadata, follower counts, subscription events (where authorized), and game/category data spanning the full Twitch history. A secondary historical source — SullyGnome — gives per-hour viewer counts going back years.

### Data Loading

```python
import pandas as pd
import numpy as np
import requests
import time
from datetime import datetime, timedelta
from twitchio.ext import commands as twitch_commands


class TwitchDataLoader:
    """
    Historical Twitch stream data loader.
    Source: Twitch Helix API + SullyGnome scrape.
    """

    HELIX_BASE = "https://api.twitch.tv/helix"

    # Twitch Helix allows ~800 requests/min per app token
    REQUEST_DELAY = 0.1  # seconds

    def __init__(self, client_id: str, app_token: str,
                 channels: list[str]):
        """
        Args:
            client_id: Twitch app client_id
            app_token: OAuth app access token
            channels: list of channel logins, e.g. ["xqc", "kai_cenat"]
        """
        self.client_id = client_id
        self.token = app_token
        self.channels = channels
        self.headers = {
            "Client-ID": client_id,
            "Authorization": f"Bearer {app_token}",
        }

    def load_channel_streams(self, channel: str,
                              lookback_days: int = 90) -> pd.DataFrame:
        """
        Load all stream sessions for a channel over the lookback window.

        Twitch Helix returns one row per live segment. We collapse
        consecutive segments of the same session into a single stream
        record with start/end, peak/avg viewers, and category changes.
        """
        try:
            # 1) resolve user_id
            resp = requests.get(
                f"{self.HELIX_BASE}/users",
                params={"login": channel},
                headers=self.headers,
                timeout=15,
            )
            resp.raise_for_status()
            users = resp.json().get("data", [])
            if not users:
                print(f"  ⚠ Channel not found: {channel}")
                return pd.DataFrame()
            user_id = users[0]["id"]

            time.sleep(self.REQUEST_DELAY)

            # 2) fetch video archive (past broadcasts)
            videos = []
            cursor = None
            cutoff = datetime.utcnow() - timedelta(days=lookback_days)
            while True:
                params = {
                    "user_id": user_id,
                    "type": "archive",
                    "first": 100,
                }
                if cursor:
                    params["after"] = cursor
                r = requests.get(
                    f"{self.HELIX_BASE}/videos",
                    params=params, headers=self.headers, timeout=15,
                )
                r.raise_for_status()
                payload = r.json()
                batch = payload.get("data", [])
                if not batch:
                    break
                videos.extend(batch)
                last_date = pd.to_datetime(batch[-1]["created_at"])
                if last_date.to_pydatetime() < cutoff:
                    break
                cursor = payload.get("pagination", {}).get("cursor")
                if not cursor:
                    break
                time.sleep(self.REQUEST_DELAY)

            if not videos:
                print(f"  ⚠ No videos for {channel}")
                return pd.DataFrame()

            rows = []
            for v in videos:
                dur = self._parse_duration(v["duration"])
                start = pd.to_datetime(v["created_at"])
                rows.append({
                    "CHANNEL": channel,
                    "USER_ID": user_id,
                    "VIDEO_ID": v["id"],
                    "STREAM_START": start,
                    "STREAM_END": start + pd.Timedelta(seconds=dur),
                    "DURATION_SEC": dur,
                    "TITLE": v.get("title", ""),
                    "VIEW_COUNT_ARCHIVE": int(v.get("view_count", 0)),
                    "LANGUAGE": v.get("language", "en"),
                })

            df = pd.DataFrame(rows)
            df["STREAM_DATE"] = df["STREAM_START"].dt.normalize()
            df = df[df["STREAM_START"] >= cutoff]
            return df

        except Exception as e:
            print(f"  ⚠ Load error for {channel}: {e}")
            return pd.DataFrame()

    @staticmethod
    def _parse_duration(d: str) -> int:
        """Convert '1h23m45s' to seconds."""
        total = 0
        num = ""
        for c in d:
            if c.isdigit():
                num += c
            else:
                if not num:
                    continue
                n = int(num)
                if c == "h":
                    total += n * 3600
                elif c == "m":
                    total += n * 60
                elif c == "s":
                    total += n
                num = ""
        return total

    def load_all(self, lookback_days: int = 90) -> pd.DataFrame:
        """Load all configured channels."""
        frames = []
        for ch in self.channels:
            df = self.load_channel_streams(ch, lookback_days)
            if not df.empty:
                frames.append(df)
                print(f"  ✓ {ch}: {len(df)} streams")
        result = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
        print(f"\nTotal loaded: {len(result)} streams")
        return result


# === Usage ===
loader = TwitchDataLoader(
    client_id="YOUR_CLIENT_ID",
    app_token="YOUR_APP_TOKEN",
    channels=["xqc", "kai_cenat", "caseoh_", "jynxzi", "hasanabi"],
)
raw_data = loader.load_all(lookback_days=120)
```

### Enriching With Viewer Telemetry

The Helix `videos` endpoint gives the shell of each stream. Viewer counts, category transitions, and chat volume come from a separate polling loop or a third-party scrape (SullyGnome exposes per-hour averages for any channel).

```python
class ViewerTelemetry:
    """
    Polls per-hour viewer averages from SullyGnome for each stream
    and merges them back onto the stream record.
    """

    BASE = "https://sullygnome.com/api"

    def fetch_channel_stream_history(self, channel: str) -> pd.DataFrame:
        try:
            r = requests.get(
                f"{self.BASE}/channels/{channel}/streams/365",
                timeout=15,
            )
            r.raise_for_status()
            data = r.json().get("data", [])
            if not data:
                return pd.DataFrame()
            df = pd.DataFrame(data)
            df["STREAM_START"] = pd.to_datetime(df["startdatetime"])
            df["AVG_VIEWERS"] = df["avgviewers"].astype(float)
            df["PEAK_VIEWERS"] = df["peakviewers"].astype(float)
            df["FOLLOWERS_GAINED"] = df.get("followers", 0).astype(float)
            return df[[
                "STREAM_START", "AVG_VIEWERS", "PEAK_VIEWERS",
                "FOLLOWERS_GAINED",
            ]]
        except requests.RequestException:
            return pd.DataFrame()
```

### Cleaning & Transformation

```python
class DataCleaner:
    """Twitch stream data cleaning and standardization."""

    @staticmethod
    def clean(df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()

        # Sort by start time
        df["STREAM_START"] = pd.to_datetime(
            df["STREAM_START"], errors="coerce",
        )
        df = df.dropna(subset=["STREAM_START"])
        df = df.sort_values("STREAM_START").reset_index(drop=True)

        # Numeric columns
        numeric_cols = [
            "DURATION_SEC", "AVG_VIEWERS", "PEAK_VIEWERS",
            "FOLLOWERS_GAINED", "CHAT_MSG_COUNT",
            "BITS_TOTAL", "SUBS_GAINED",
        ]
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        # Drop streams with no duration or no viewers
        df = df.dropna(subset=["DURATION_SEC"])
        df = df[df["DURATION_SEC"] > 300]  # discard < 5 min test streams

        # Basic derived metrics
        df["DURATION_HOURS"] = df["DURATION_SEC"] / 3600
        df["VIEWER_DROPOFF"] = (
            (df["PEAK_VIEWERS"] - df["AVG_VIEWERS"])
            / df["PEAK_VIEWERS"].replace(0, np.nan)
        )
        df["CHAT_PER_VIEWER"] = (
            df.get("CHAT_MSG_COUNT", 0)
            / df["AVG_VIEWERS"].replace(0, np.nan)
        )
        df["BITS_PER_VIEWER"] = (
            df.get("BITS_TOTAL", 0)
            / df["AVG_VIEWERS"].replace(0, np.nan)
        )

        return df


clean_data = DataCleaner.clean(raw_data)
print(f"After cleaning: {len(clean_data)} streams")
```

### Defining The Binary Outcome

Vision testnet markets on Twitch are phrased as YES/NO questions. The most common template: *"Will channel X reach viewer threshold V by time T?"* Every stream in our dataset is labeled with whether the target was hit.

```python
def label_outcome(df: pd.DataFrame, threshold_quantile: float = 0.5) -> pd.DataFrame:
    """
    YES (1) = stream peak viewers ≥ per-channel median peak
    NO  (0) = below median.

    Per-channel quantile prevents a big streamer's label from being
    trivially 1 and a small streamer's always 0.
    """
    df = df.copy()
    df["CHANNEL_THRESHOLD"] = df.groupby("CHANNEL")["PEAK_VIEWERS"].transform(
        lambda s: s.quantile(threshold_quantile)
    )
    df["HITS_GOAL"] = (df["PEAK_VIEWERS"] >= df["CHANNEL_THRESHOLD"]).astype(int)
    return df


clean_data = label_outcome(clean_data, threshold_quantile=0.5)
print(f"Distribution: HITS_GOAL={clean_data['HITS_GOAL'].mean():.1%}, "
      f"MISS={1 - clean_data['HITS_GOAL'].mean():.1%}")
```

## Feature Engineering with Claude

The key stage where we create features for the model. Twitch provides an extremely rich set of metrics — viewer retention, chat cadence, bits/sub velocity, category transitions, hour-of-day effects.

### Statistical Features (Rolling Averages)

```python
class TwitchFeatureEngineer:
    """
    Feature generation from historical channel statistics.
    Key idea: for each stream we use ONLY data
    available BEFORE that stream starts.
    """

    def __init__(self, window: int = 10):
        self.window = window

    def compute_channel_stats(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Compute rolling averages for each channel
        over the last N streams.

        window=10 is a reasonable baseline — roughly one month
        for an active streamer (3–4 streams/week).
        """
        df = df.sort_values("STREAM_START").copy()

        stat_cols = [
            "AVG_VIEWERS", "PEAK_VIEWERS", "DURATION_HOURS",
            "FOLLOWERS_GAINED", "CHAT_MSG_COUNT",
            "BITS_TOTAL", "SUBS_GAINED",
            "VIEWER_DROPOFF", "CHAT_PER_VIEWER", "BITS_PER_VIEWER",
        ]

        rolling_frames = []
        for channel in df["CHANNEL"].unique():
            ch_df = df[df["CHANNEL"] == channel].copy()

            for col in stat_cols:
                if col not in ch_df.columns:
                    ch_df[col] = np.nan
                # shift(1) — exclude current stream
                ch_df[f"avg_{col}"] = (
                    ch_df[col]
                    .shift(1)
                    .rolling(window=self.window, min_periods=3)
                    .mean()
                )

            # Form: hit rate over last N streams
            ch_df["Form"] = (
                ch_df["HITS_GOAL"]
                .shift(1)
                .rolling(window=self.window, min_periods=3)
                .mean()
            )

            # Streak: current hit (+) / miss (-) streak
            ch_df["Streak"] = self._compute_streak(
                ch_df["HITS_GOAL"].shift(1)
            )

            rolling_frames.append(ch_df)

        return pd.concat(rolling_frames).sort_values("STREAM_START")

    @staticmethod
    def _compute_streak(hits: pd.Series) -> pd.Series:
        """Compute current hit (+) / miss (-) streak."""
        streak = []
        current = 0
        for h in hits:
            if pd.isna(h):
                streak.append(0)
                continue
            if h == 1:
                current = max(1, current + 1)
            else:
                current = min(-1, current - 1)
            streak.append(current)
        return pd.Series(streak, index=hits.index)

    def build_stream_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        For each stream, attach:
        - the channel's own rolling stats
        - category popularity at stream start
        - time-of-day / day-of-week context
        """
        ch_stats = self.compute_channel_stats(df)

        ch_stats["start_hour"] = ch_stats["STREAM_START"].dt.hour
        ch_stats["day_of_week"] = ch_stats["STREAM_START"].dt.dayofweek
        ch_stats["is_weekend"] = (ch_stats["day_of_week"] >= 5).astype(int)

        # Primetime = 18:00–23:00 UTC for English streams
        ch_stats["is_primetime"] = (
            (ch_stats["start_hour"] >= 18)
            & (ch_stats["start_hour"] <= 23)
        ).astype(int)

        feature_cols = [c for c in ch_stats.columns if c.startswith("avg_")]
        feature_cols += [
            "Form", "Streak",
            "start_hour", "day_of_week",
            "is_weekend", "is_primetime",
        ]

        return ch_stats.dropna(subset=feature_cols).reset_index(drop=True)


# === Usage ===
engineer = TwitchFeatureEngineer(window=10)
featured_data = engineer.build_stream_features(clean_data)
print(f"Streams with features: {len(featured_data)}")
print(f"Number of features: "
      f"{len([c for c in featured_data.columns if c.startswith('avg_')])}")
```

### Claude for Contextual Feature Generation

```python
import anthropic
import json
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic()  # key from ANTHROPIC_API_KEY


def claude_analyze_stream_context(
    channel: str,
    upcoming_title: str,
    category: str,
    channel_form: dict,
) -> dict:
    """
    Claude evaluates contextual factors of an upcoming stream
    that are hard to extract from numerical data — title
    framing, category momentum, expected subculture interest.
    """
    prompt = f"""You are an expert Twitch analyst. Analyze the upcoming stream
and return ONLY JSON (no markdown, no comments) with the following scores
on a scale from 0.0 to 1.0:

Channel: {channel}
Upcoming title: "{upcoming_title}"
Category: {category}

{channel}'s rolling stats over last 10 streams:
- Avg viewers: {channel_form.get('avg_AVG_VIEWERS', 'N/A'):.0f}
- Peak viewers: {channel_form.get('avg_PEAK_VIEWERS', 'N/A'):.0f}
- Duration (h): {channel_form.get('avg_DURATION_HOURS', 'N/A'):.1f}
- Chat per viewer: {channel_form.get('avg_CHAT_PER_VIEWER', 'N/A'):.2f}
- Bits per viewer: {channel_form.get('avg_BITS_PER_VIEWER', 'N/A'):.3f}
- Form (hit rate): {channel_form.get('Form', 'N/A'):.1%}
- Streak: {channel_form.get('Streak', 'N/A')}

Return JSON strictly in this format:
{{
    "title_hook_strength": <float>,
    "category_momentum": <float>,
    "audience_overlap_with_core": <float>,
    "collab_or_event_signal": <float>,
    "drama_or_controversy_signal": <float>,
    "expected_retention": <float>,
    "upset_probability": <float>,
    "hit_confidence": <float>,
    "blowout_likelihood": <float>,
    "reasoning": "<brief explanation in 1-2 sentences>"
}}"""

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}],
    )

    response_text = message.content[0].text.strip()
    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        start = response_text.find("{")
        end = response_text.rfind("}") + 1
        if start != -1 and end > start:
            return json.loads(response_text[start:end])
        return {}


# === Example usage ===
channel_form_example = {
    "avg_AVG_VIEWERS": 18_500, "avg_PEAK_VIEWERS": 32_100,
    "avg_DURATION_HOURS": 6.2, "avg_CHAT_PER_VIEWER": 0.42,
    "avg_BITS_PER_VIEWER": 0.018, "Form": 0.7, "Streak": 3,
}

analysis = claude_analyze_stream_context(
    channel="kai_cenat",
    upcoming_title="MAFIATHON 2 — FINAL DAY",
    category="Just Chatting",
    channel_form=channel_form_example,
)
print(json.dumps(analysis, indent=2, ensure_ascii=False))
```

### Adding External Analytics Signals as Features

StreamCharts, SullyGnome, and TwitchTracker publish inferred "odds" and forecast viewer ranges for major channels. Treat them like sportsbook lines — they aggregate market expertise before you arrive.

```python
def add_external_signal_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Convert external analytics forecasts to probabilities.

    StreamCharts and TwitchTracker publish ranges of the form:
    - expected_peak_viewers_lo, expected_peak_viewers_hi
    - expected_duration_hours

    We convert the expected-peak interval into an implied
    P(hits_goal) using a normal CDF around the channel threshold.
    """
    df = df.copy()

    if "EXT_PEAK_LO" in df.columns and "EXT_PEAK_HI" in df.columns:
        from scipy.stats import norm
        mean = (df["EXT_PEAK_LO"] + df["EXT_PEAK_HI"]) / 2
        # Interval half-width → std estimate (interval ≈ ±1σ)
        std = ((df["EXT_PEAK_HI"] - df["EXT_PEAK_LO"]) / 2).replace(0, np.nan)
        df["ext_prob_yes"] = 1 - norm.cdf(
            (df["CHANNEL_THRESHOLD"] - mean) / std
        )
        df["ext_prob_no"] = 1 - df["ext_prob_yes"]

    # Alternative source: implied odds from third-party booking sites
    if "EXT_ML_YES" in df.columns and "EXT_ML_NO" in df.columns:
        def ml_to_prob(ml):
            if ml < 0:
                return abs(ml) / (abs(ml) + 100)
            return 100 / (ml + 100)

        df["ml_prob_yes"] = df["EXT_ML_YES"].apply(ml_to_prob)
        df["ml_prob_no"] = df["EXT_ML_NO"].apply(ml_to_prob)
        total = df["ml_prob_yes"] + df["ml_prob_no"]
        df["norm_prob_yes"] = df["ml_prob_yes"] / total
        df["norm_prob_no"] = df["ml_prob_no"] / total
        df["odds_spread"] = df["norm_prob_yes"] - df["norm_prob_no"]

    return df


featured_data = add_external_signal_features(featured_data)
```

## Advanced Feature Engineering: Four Factors, ELO & Fatigue

### Four Factors of Stream Performance

Basketball analytics has Dean Oliver. Twitch doesn't have a canonical equivalent, so we define one. Four metrics that explain most of the variance in whether a stream hits its goal:

```python
def compute_four_factors_stream(df: pd.DataFrame) -> pd.DataFrame:
    """
    Four Factors for Twitch — key drivers of whether a stream
    reaches its viewer goal:

    1. Retention Rate = AVG_VIEWERS / PEAK_VIEWERS
       How well the stream holds its audience after peak.

    2. Chat Density = CHAT_MSG_COUNT / (AVG_VIEWERS * DURATION_HOURS)
       Engagement intensity. High density correlates with growth.

    3. Monetization Velocity = (BITS_TOTAL + SUBS_GAINED * 5) / DURATION_HOURS
       Dollars per hour — signals audience investment.

    4. Category Lift = CHANNEL_PEAK / CATEGORY_MEDIAN_PEAK
       Is this channel overperforming its category baseline?
    """
    df = df.copy()

    df["RETENTION_RATE"] = (
        df["AVG_VIEWERS"] / df["PEAK_VIEWERS"].replace(0, np.nan)
    )

    df["CHAT_DENSITY"] = (
        df["CHAT_MSG_COUNT"]
        / (df["AVG_VIEWERS"] * df["DURATION_HOURS"]).replace(0, np.nan)
    )

    df["MONETIZATION_VELOCITY"] = (
        (df["BITS_TOTAL"].fillna(0) + df["SUBS_GAINED"].fillna(0) * 5)
        / df["DURATION_HOURS"].replace(0, np.nan)
    )

    category_median = df.groupby("CATEGORY")["PEAK_VIEWERS"].transform("median")
    df["CATEGORY_LIFT"] = (
        df["PEAK_VIEWERS"] / category_median.replace(0, np.nan)
    )

    # Composite: share of growth streams where chat outpaces viewers
    df["ENGAGEMENT_INDEX"] = (
        df["RETENTION_RATE"] * df["CHAT_DENSITY"]
    )

    return df


featured_data = compute_four_factors_stream(featured_data)
```

### ELO Ratings for Channels

```python
class TwitchELO:
    """
    ELO-style ratings for Twitch channels.

    Adapted for streaming:
    - K=24 (streams are less frequent than games — ~3/week —
      so we adapt slightly faster than NBA)
    - "Home advantage" = 80 ELO for primetime windows
    - Viewer overperformance multiplier (analogous to MOV)
    - Regression to mean between quarters (burnout / renaissance cycles)
    """

    def __init__(self, k: int = 24, primetime_bonus: int = 80):
        self.k = k
        self.primetime_bonus = primetime_bonus
        self.ratings: dict[str, float] = {}

    def get_rating(self, channel: str) -> float:
        return self.ratings.setdefault(channel, 1500.0)

    def expected_score(self, rating_a: float, rating_b: float) -> float:
        return 1.0 / (1.0 + 10 ** ((rating_b - rating_a) / 400.0))

    def margin_multiplier(self, viewer_over: float,
                           elo_diff: float) -> float:
        """
        Multiplier for how far the peak viewers overshot
        (or undershot) the channel threshold.

        Inspired by FiveThirtyEight's MOV formula.
        """
        mov = abs(viewer_over)
        return ((mov + 3) ** 0.8) / (7.5 + 0.006 * abs(elo_diff))

    def update(self, channel: str, peak_viewers: int,
               threshold: int, is_primetime: bool) -> float:
        """Update rating after a stream."""
        r = self.get_rating(channel) + (
            self.primetime_bonus if is_primetime else 0
        )
        # Opponent is the "market baseline" — fixed at 1500
        r_baseline = 1500.0

        expected = self.expected_score(r, r_baseline)
        actual = 1.0 if peak_viewers >= threshold else 0.0

        over = (peak_viewers - threshold) / max(threshold, 1)
        m = self.margin_multiplier(over * 100, r - r_baseline)

        self.ratings[channel] = (
            self.get_rating(channel) + self.k * m * (actual - expected)
        )
        return self.ratings[channel]

    def quarter_reset(self, regression_factor: float = 0.80):
        """
        Regression to mean between quarters.
        Twitch: ~20% regression per quarter (factor=0.80).
        """
        mean_elo = np.mean(list(self.ratings.values()))
        for ch in self.ratings:
            self.ratings[ch] = (
                regression_factor * self.ratings[ch]
                + (1 - regression_factor) * mean_elo
            )

    def compute_elo_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Iterate through all streams chronologically,
        updating ELO after each one.
        """
        df = df.sort_values("STREAM_START").copy()
        elo_features = []
        current_quarter = None

        for _, row in df.iterrows():
            quarter = f"{row['STREAM_START'].year}-Q{(row['STREAM_START'].month - 1) // 3 + 1}"
            if current_quarter and quarter != current_quarter:
                self.quarter_reset()
            current_quarter = quarter

            ch = row["CHANNEL"]
            pre_rating = self.get_rating(ch)

            # Pre-stream expected probability
            r_eff = pre_rating + (
                self.primetime_bonus if row.get("is_primetime") else 0
            )
            expected = self.expected_score(r_eff, 1500.0)

            elo_features.append({
                "elo_channel": pre_rating,
                "elo_expected_hit": expected,
            })

            # Update after saving pre-stream rating
            if pd.notna(row.get("PEAK_VIEWERS")) and pd.notna(row.get("CHANNEL_THRESHOLD")):
                self.update(
                    ch,
                    int(row["PEAK_VIEWERS"]),
                    int(row["CHANNEL_THRESHOLD"]),
                    bool(row.get("is_primetime", 0)),
                )

        return pd.concat(
            [df.reset_index(drop=True),
             pd.DataFrame(elo_features)],
            axis=1,
        )


# === Usage ===
elo_system = TwitchELO(k=24, primetime_bonus=80)
featured_data = elo_system.compute_elo_features(featured_data)
print("Top 5 channels by ELO:")
top_channels = sorted(elo_system.ratings.items(),
                      key=lambda x: -x[1])[:5]
for ch, rating in top_channels:
    print(f"  {ch:20s}  {rating:.0f}")
```

### Fatigue Factor & Back-to-Back Streams

Streamer fatigue is the Twitch analog of NBA back-to-back. A 12-hour stream yesterday followed by another long session today is one of the strongest negative signals available.

```python
def compute_stream_fatigue_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Fatigue features for a channel:
    - Hours streamed in the last 24h before this one
    - Hours streamed in the last 72h
    - Days rest since last stream
    - "Marathon tail" flag (≥ 8h previous session within 18h)
    """
    df = df.sort_values("STREAM_START").copy()

    rest_days = []
    hours_24h = []
    hours_72h = []
    marathon_tail = []

    by_channel: dict[str, list[tuple]] = {}

    for _, row in df.iterrows():
        ch = row["CHANNEL"]
        date = row["STREAM_START"]
        dur_h = row["DURATION_HOURS"]

        history = by_channel.setdefault(ch, [])

        if history:
            last_end = history[-1][1]
            rest_days.append(
                min((date - last_end).total_seconds() / 86400.0, 14.0)
            )
        else:
            rest_days.append(3.0)

        cutoff_24 = date - pd.Timedelta(hours=24)
        cutoff_72 = date - pd.Timedelta(hours=72)
        h24 = sum(d for s, e, d in history if e >= cutoff_24)
        h72 = sum(d for s, e, d in history if e >= cutoff_72)
        hours_24h.append(h24)
        hours_72h.append(h72)

        # Marathon tail: previous stream ≥ 8h ended within 18h
        tail = 0
        if history:
            prev_s, prev_e, prev_d = history[-1]
            if prev_d >= 8 and (date - prev_e) <= pd.Timedelta(hours=18):
                tail = 1
        marathon_tail.append(tail)

        history.append((date, date + pd.Timedelta(hours=dur_h), dur_h))

    df["rest_days"] = rest_days
    df["hours_24h"] = hours_24h
    df["hours_72h"] = hours_72h
    df["marathon_tail"] = marathon_tail
    df["is_back_to_back"] = (df["rest_days"] < 1.0).astype(int)

    return df


featured_data = compute_stream_fatigue_features(featured_data)
```

### Head-to-Head: Competing Streams In The Same Category

In the NBA, two teams meet. On Twitch, two streamers compete for the same audience by being live at the same time in the same category. A stream launched opposite xQc in Just Chatting faces real headwinds.

```python
def compute_overlap_features(df: pd.DataFrame,
                              top_n: int = 5) -> pd.DataFrame:
    """
    For each stream, count concurrent top-N channels in the same
    category during the first hour. High overlap = harder to hit goal.
    """
    df = df.sort_values("STREAM_START").copy()

    overlap_count = []
    overlap_viewer_share = []

    for idx, row in df.iterrows():
        start = row["STREAM_START"]
        end = start + pd.Timedelta(hours=1)
        cat = row.get("CATEGORY", "")

        concurrent = df[
            (df.index != idx)
            & (df["CATEGORY"] == cat)
            & (df["STREAM_START"] <= end)
            & (df["STREAM_START"] + pd.to_timedelta(df["DURATION_HOURS"], unit="h") >= start)
        ]

        overlap_count.append(len(concurrent))
        if len(concurrent):
            other_viewers = concurrent["AVG_VIEWERS"].sum()
            share = row["AVG_VIEWERS"] / (
                row["AVG_VIEWERS"] + other_viewers
            )
        else:
            share = 1.0
        overlap_viewer_share.append(share)

    df["overlap_streams"] = overlap_count
    df["overlap_viewer_share"] = overlap_viewer_share
    return df


featured_data = compute_overlap_features(featured_data)
print(f"Total features: "
      f"{len([c for c in featured_data.columns if c not in ['STREAM_START', 'CHANNEL', 'VIDEO_ID', 'TITLE', 'HITS_GOAL']])}")
```

## Vision Testnet Integration: Placing Actual Bets

Vision runs on Index L3, an Arbitrum Orbit chain (chainId `111222333`, RPC `http://142.132.164.24/`). A **batch** groups many binary questions (each a "market" of the batch) that settle together at the tick boundary. The Twitch batch is **`batchId = 19`**, tick duration **60 s**.

| Parameter | Off-chain analytics | Vision testnet |
|---|---|---|
| Pricing mechanism | Editorial forecast | Parimutuel, settled on-chain |
| Margin | Nonexistent | ~0% |
| Settlement | Editorial lag | Tick boundary (60 s for Twitch) |
| Pool totals | N/A | **Not exposed to readers** — bots trade blind |
| Pick encoding | N/A | 1024-byte bitmap, keccak256 commitment |

### Canonical reference implementation

The production Python bot that trades every batch on Vision lives at `vision-bot/`. Study it. What follows mirrors its mechanics.

### Decimals, deployments, addresses

The live testnet endpoints (verified reachable over public HTTP — no VPN, no DNS):

```python
# L3 RPC (VPS 2) and chain
VISION_RPC = "http://142.132.164.24/"
CHAIN_ID   = 111222333

# Core on-chain contract. The addresses in envs/testnet/deployment.json are
# stale — they describe the *intended* deployment, not the live one. Trust
# the chain, not the JSON: call `vision.USDC()` to discover the real USDC
# token, and cross-check `eth_getCode(vision_address)` is non-empty before
# using a hard-coded address.
VISION_ADDRESS  = "0x94d540bb45975bd5a0c7ba9a15a0d34e378f6c61"

# L3 USDC: 18 decimals. Never divide on-chain amounts by 1e6 here.
# Self-discoverable via `vision.functions.USDC().call()`.
L3_USDC_ADDRESS    = "0xADDb799BC1499b224DC4368E92b9042a54908553"
L3_USDC_DECIMALS   = 18

# Data-node (VPS 1, nginx-proxied). Serves batch configs and price snapshots.
DATA_NODE = "http://116.203.156.98/data-node"

# Three oracles, BFT quorum = ceil(2/3 * 3) = 2.
ORACLES = [
    "http://116.203.156.98/oracle1",
    "http://116.203.156.98/oracle2",
    "http://116.203.156.98/oracle3",
]

# The Twitch batch id is fixed at 19 on the current deployment. Verify by
# calling vision.getBatch(19) and confirming tick_duration == 60.
TWITCH_BATCH_ID = 19

# Protocol constants read from chain (see Vision ABI):
#   MIN_DEPOSIT         = 1e17 wei = 0.1 L3 USDC
#   MIN_TICK_DURATION   = 60
#   MAX_TICK_DURATION   = 604800
#   PROTOCOL_FEE_BPS    = 5
```

**Smoke test before writing any trading code** — confirm everything answers:

```bash
# 1. RPC alive, chainId matches
curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  http://142.132.164.24/
# → {"jsonrpc":"2.0","id":1,"result":"0x6a11e3d"}   (111222333)

# 2. Vision contract has bytecode
curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_getCode","params":["0x94d540bb45975bd5a0c7ba9a15a0d34e378f6c61","latest"],"id":1}' \
  http://142.132.164.24/ | head -c 120
# → 0x608060405260043610... (non-empty)

# 3. Data-node healthy
curl -s http://116.203.156.98/data-node/health
# → {"status":"healthy",...}

# 4. Oracle healthy
curl -s http://116.203.156.98/oracle1/
# → {"status":"healthy", "is_leader":..., "connected_peers":3, ...}
```

If any of the four fails, stop — the bot won't trade until the infra is up.

### Bitmap encoding — the one thing you must not get wrong

A batch has N markets (N ≤ 8192). Your pick for market i is a single bit. `1 = UP (YES)`, `0 = DOWN (NO)`. The bitmap is **always 1024 bytes**, big-endian, MSB-first per byte — padded with zeros beyond the live market count. The on-chain commitment is `keccak256(bitmap_bytes)`; the oracle resolver iterates `[0, market_count)` only, so trailing zeros are inert. The padding exists so that a race between bot's view of `market_count` and the oracle's does not invalidate your join.

```python
from web3 import Web3

MAX_BITMAP_BYTES = 1024
MAX_BITMAP_BITS = MAX_BITMAP_BYTES * 8


def encode_bitmap(bets: list[str], count: int) -> bytes:
    """["UP","DOWN",...] -> 1024-byte padded bitmap, MSB-first.

    Raises if len(bets) < count (uncovered markets = silent loss) or
    if count > 8192 (ceiling; raise MAX_BITMAP_BYTES and redeploy if needed).
    """
    if len(bets) < count:
        raise ValueError(f"Bitmap underflow: {len(bets)} bets for {count} markets")
    if count > MAX_BITMAP_BITS:
        raise ValueError(f"Bitmap overflow: {count} > {MAX_BITMAP_BITS}")
    bitmap = bytearray(MAX_BITMAP_BYTES)
    for i in range(count):
        if bets[i] == "UP":
            bitmap[i // 8] |= 1 << (7 - (i % 8))
    return bytes(bitmap)


def hash_bitmap(bitmap: bytes) -> bytes:
    """32-byte commitment = keccak256(padded bitmap)."""
    return Web3.keccak(bitmap)
```

### The full write path

```python
import json
import time
import requests
from web3 import Web3
from eth_account import Account


class VisionBot:
    """
    Read batch config, encode a pick per market, submit on-chain + to oracles.
    The ABI in abi/Vision.json is a Foundry compiler output — the actual ABI
    lives under the "abi" key.
    """

    def __init__(
        self,
        rpc_url: str,
        vision_address: str,
        usdc_address: str,
        private_key: str,
        data_node_url: str,
        oracles: list[str],
    ):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not self.w3.is_connected():
            raise RuntimeError(f"RPC unreachable: {rpc_url}")

        self.account = Account.from_key(private_key)
        self.bot_addr = self.account.address

        with open("abi/Vision.json") as f:
            vision_abi = json.load(f)["abi"]
        with open("abi/ERC20.json") as f:
            erc20_abi = json.load(f)["abi"]

        self.vision = self.w3.eth.contract(
            address=Web3.to_checksum_address(vision_address),
            abi=vision_abi,
        )
        self.usdc = self.w3.eth.contract(
            address=Web3.to_checksum_address(usdc_address),
            abi=erc20_abi,
        )
        self.data_node_url = data_node_url.rstrip("/")
        self.oracles = [u.rstrip("/") for u in oracles]

    # ── read: batch metadata ──
    def get_batch(self, batch_id: int) -> dict:
        """Returns (creator, sourceId, configHash, tickDuration, lockOffset,
        createdAtTick, paused, settled). Transaction-free view."""
        b = self.vision.functions.getBatch(batch_id).call()
        return {
            "creator":         b[0],
            "source_id":       b[1],
            "config_hash":     b[2],       # bytes32 — pass into joinBatchDirect as-is
            "tick_duration":   int(b[3]),
            "lock_offset":     int(b[4]),
            "created_at_tick": int(b[5]),
            "paused":          bool(b[6]),
            "settled":         bool(b[7]),
        }

    def discover_source(self, source_id: str = "twitch") -> dict:
        """Ask the data-node which config the oracle leader is currently
        proposing for this source. Returns a dict with keys:
            configHash, sourceId, displayName, markets, tickDurationSecs,
            lockOffsetSecs, createdAt.

        This is the authoritative market list — its order defines the bit
        positions in the bitmap.
        """
        r = requests.get(
            f"{self.data_node_url}/batches/recommended", timeout=20,
        )
        r.raise_for_status()
        all_batches = r.json()["batches"]
        for b in all_batches:
            if b.get("sourceId") == source_id:
                return b
        raise RuntimeError(
            f"No recommended batch for sourceId={source_id!r}. "
            f"Available: {sorted({b.get('sourceId','?') for b in all_batches})}"
        )

    def find_active_batch_id(self, config_hash: bytes) -> int:
        """Given the configHash from discover_source, find the live on-chain
        batchId by querying the oracle's /vision/batches and matching by
        config_hash. Oracle batch records include `id`, `config_hash`,
        `source_id`, `market_count`, `player_count`, `paused`, `tvl`,
        `tick_duration`.
        """
        target = "0x" + config_hash.hex()
        for url in self.oracles:
            try:
                r = requests.get(f"{url}/vision/batches", timeout=10)
                if r.status_code != 200:
                    continue
                for b in r.json().get("batches", []):
                    if b.get("config_hash", "").lower() == target.lower():
                        return int(b["id"])
            except requests.RequestException:
                continue
        raise RuntimeError(
            f"No active batch found for configHash={target}. "
            f"The oracle's /vision/batches did not return a match."
        )

    def fetch_markets(self, config_hash: bytes) -> list[dict]:
        """Deprecated in favour of `discover_source`. Kept for API parity.
        If you already have the markets from `discover_source`, use them
        directly rather than re-fetching.
        """
        source = self.discover_source()
        if bytes.fromhex(source["configHash"][2:]) != config_hash:
            raise RuntimeError(
                f"configHash drift: on-chain says 0x{config_hash.hex()}, "
                f"data-node recommends {source['configHash']}. Did the "
                f"oracle just propose a new config? Retry in a few seconds."
            )
        return source["markets"]

    # ── write: approve + join ──
    def _build_tx(self, gas: int) -> dict:
        return {
            "from": self.bot_addr,
            "nonce": self.w3.eth.get_transaction_count(self.bot_addr),
            "gas": gas,
            "gasPrice": self.w3.eth.gas_price,
            "chainId": self.w3.eth.chain_id,
        }

    def _send(self, tx: dict) -> bytes:
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt.status != 1:
            raise RuntimeError(f"Tx reverted: {tx_hash.hex()}")
        return tx_hash

    def approve_usdc(self, amount_wei: int):
        """Grant the Vision contract permission to pull `amount_wei` of USDC
        (18 dec on L3). Idempotent — set to a large number once and forget."""
        tx = self.usdc.functions.approve(
            self.vision.address, amount_wei
        ).build_transaction(self._build_tx(gas=200_000))
        self._send(tx)

    def join_batch(
        self,
        batch_id: int,
        config_hash: bytes,
        deposit_wei: int,
        bitmap_hash: bytes,
    ) -> bytes:
        """On-chain commitment. Emits `BatchJoined`. The pick itself is
        NOT revealed on-chain — only its 32-byte keccak commitment."""
        tx = self.vision.functions.joinBatchDirect(
            batch_id, config_hash, deposit_wei, bitmap_hash
        ).build_transaction(self._build_tx(gas=500_000))
        return self._send(tx)

    # ── write: reveal bitmap to oracles ──
    def submit_bitmap(
        self,
        batch_id: int,
        bitmap: bytes,
        bitmap_hash: bytes,
        timeout: float = 5.0,
    ) -> int:
        """POST the raw bitmap bytes to every oracle. Each oracle verifies
        keccak256(bitmap) == bitmap_hash (the on-chain commitment) and
        records the pick. BFT quorum: need ≥ ceil(2/3 * N) accepted."""
        payload = {
            "player": self.bot_addr,
            "batch_id": batch_id,
            "bitmap_hex": "0x" + bitmap.hex(),
            "expected_hash": "0x" + bitmap_hash.hex(),
        }
        accepted = 0
        for url in self.oracles:
            try:
                r = requests.post(
                    f"{url}/vision/bitmap", json=payload, timeout=timeout
                )
                if r.status_code == 200:
                    accepted += 1
            except requests.RequestException:
                continue
        quorum = -(-len(self.oracles) * 2 // 3)   # ceil(2N/3)
        if accepted < quorum:
            raise RuntimeError(
                f"Oracle quorum failed: {accepted}/{len(self.oracles)} "
                f"accepted, need {quorum}"
            )
        return accepted

    # ── read: settlement ──
    def get_payout(self, batch_id: int, from_block: int | None = None) -> int:
        """Query the PlayerSettled event. Zero if not yet settled. Payout is
        original deposit ± winnings/losses in 18-dec USDC."""
        if from_block is None:
            latest = self.w3.eth.block_number
            from_block = max(0, latest - 100_000)    # ~28h L3 history
        logs = self.vision.events.PlayerSettled.get_logs(
            argument_filters={"batchId": batch_id, "player": self.bot_addr},
            fromBlock=from_block,
        )
        return int(logs[-1]["args"]["payout"]) if logs else 0

    def check_balance(self, batch_id: int) -> int:
        """Oracle-reported position balance. Available before on-chain
        settlement — use it to pre-compute PnL while waiting for the event."""
        for url in self.oracles:
            try:
                r = requests.get(
                    f"{url}/vision/balance/{batch_id}/{self.bot_addr}",
                    timeout=5,
                )
                if r.status_code == 200:
                    return int(r.json().get("balance", 0))
            except requests.RequestException:
                continue
        return 0
```

### End-to-end example: one bet on the Twitch batch

```python
bot = VisionBot(
    rpc_url=VISION_RPC,
    vision_address=VISION_ADDRESS,
    private_key="0x...",          # your L3 testnet wallet, funded with L3 USDC
    data_node_url=DATA_NODE,
    oracles=ORACLES,
)

deposit = int(10 * 10**18)       # 10 L3 USDC (above MIN_DEPOSIT 0.1)

# 1. Discover the current Twitch batch from the data-node
source = bot.discover_source("twitch")
config_hash = bytes.fromhex(source["configHash"][2:])
markets = source["markets"]
n = len(markets)
print(f"Source twitch: {source['displayName']} — {n} markets, tick {source['tickDurationSecs']}s")

# 2. Find the on-chain batchId for this config
batch_id = bot.find_active_batch_id(config_hash)
print(f"Active batchId = {batch_id}")

# 3. Build picks — one per market. Your ML model lives here.
# Trivial baseline: everything UP.
picks = ["UP"] * n

# 4. Encode + hash the bitmap (1024-byte padded, MSB-first, keccak commitment)
bitmap = encode_bitmap(picks, n)
bitmap_hash = hash_bitmap(bitmap)

# 5. Approve USDC (one-time per allowance) + join on-chain
bot.approve_usdc(deposit)
tx_hash = bot.join_batch(batch_id, config_hash, deposit, bitmap_hash)
print(f"Joined batch {batch_id} in tx {tx_hash.hex()}")

# 6. Reveal the bitmap bytes to oracles
accepted = bot.submit_bitmap(batch_id, bitmap, bitmap_hash)
print(f"Oracles accepted: {accepted}/{len(ORACLES)}")

# 7. Poll for settlement
while True:
    payout = bot.get_payout(batch_id)
    if payout > 0:
        pnl_usdc = (payout - deposit) / 10**18
        print(f"Settled. PnL = {pnl_usdc:+.4f} USDC")
        break
    time.sleep(15)
```

### The invariants that catch most first-time bots

1. **Bitmap length is always 1024 bytes.** Not `ceil(N/8)`. Not `N`. If you submit a shorter buffer to the oracle, `keccak256(submitted) != commitment_onchain` and the oracle rejects you — your deposit sits in the parimutuel with no pick, which resolves as pure loss.
2. **Bit order is MSB-first per byte.** Market 0 = bit 7 of byte 0. Market 8 = bit 7 of byte 1. Reverse this and you bet the opposite of what you think.
3. **`config_hash` comes from `getBatch` and is passed verbatim to `joinBatchDirect`.** Never recompute it client-side.
4. **Bitmap must be POSTed to the oracle *after* the join tx confirms.** Submit before, and the oracle rejects with "no on-chain commitment."
5. **L3 USDC is 18 decimals.** `int(10 * 10**18)` for 10 USDC. Writing `10 * 10**6` will buy you 0.0000000001 USDC of exposure, which on a parimutuel rounds to nothing.
6. **Pool totals are not queryable.** You trade blind — your edge must come from your model, not from reading the crowd. Settlement telling you the split after the fact is all you get.
7. **Missing a tick is cheaper than burning gas on a guaranteed revert.** If `now + 10s > tick_end - lock_offset`, skip the tick.
8. **The JSON deployment files lie.** `envs/testnet/deployment.json` claims a Vision address that currently has no bytecode on the RPC. The oracle's compose override has the live address (`0x94d540bb…`). Always cross-check with `eth_getCode` before hard-coding.
9. **Self-discover the USDC address.** `vision.functions.USDC().call()` returns the token the Vision contract actually accepts. Anchor on-chain truth, not JSON.
10. **Minimum deposit is 0.1 USDC** (= `1e17` wei). Lower joins revert; `MIN_DEPOSIT` is exposed as a public constant on the Vision contract.

### ABI bundles — paste these next to your code

Save as `abi/ERC20.json`:

```json
{
  "abi": [
    {"type":"function","name":"approve","stateMutability":"nonpayable","inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],"outputs":[{"type":"bool"}]},
    {"type":"function","name":"allowance","stateMutability":"view","inputs":[{"name":"owner","type":"address"},{"name":"spender","type":"address"}],"outputs":[{"type":"uint256"}]},
    {"type":"function","name":"balanceOf","stateMutability":"view","inputs":[{"name":"account","type":"address"}],"outputs":[{"type":"uint256"}]},
    {"type":"function","name":"decimals","stateMutability":"view","inputs":[],"outputs":[{"type":"uint8"}]},
    {"type":"function","name":"symbol","stateMutability":"view","inputs":[],"outputs":[{"type":"string"}]}
  ]
}
```

Save as `abi/Vision.json` — use the **full** Foundry output (too large to paste here). Fetch it from the mono repo at `contracts/out/Vision.sol/Vision.json`, or extract the `abi` key into its own file. The critical entries your bot uses:

- **`nextBatchId() → uint256`** — sanity check the contract is alive.
- **`USDC() → address`** — self-discover the wrapped USDC token.
- **`MIN_DEPOSIT() → uint256`** — 1e17 wei on the current deployment.
- **`getBatch(uint256) → (address creator, bytes32 sourceId, bytes32 configHash, uint256 tickDuration, uint256 lockOffset, uint256 createdAtTick, bool paused, bool settled)`** — batch metadata.
- **`currentTickId(uint256) → uint256`** — current absolute tick for this batch.
- **`joinBatchDirect(uint256 batchId, bytes32 configHash, uint256 depositAmount, bytes32 bitmapHash)`** — the actual join transaction.
- **`updateBitmap(uint256 batchId, bytes32 configHash, bytes32 newHash)`** — change your pick before the tick locks.
- **`event PlayerSettled(uint256 indexed batchId, address indexed player, uint256 payout, uint256 fee)`** — read your PnL.
- **`event BatchJoined(uint256 indexed batchId, address indexed player, uint256 deposit, bytes32 bitmapHash)`** — observe other participants, if you want to.

If you do not have access to the mono repo: any Foundry-compiled Vision contract from the same git commit works. Selectors are deterministic given the source.

### Reading historical settlement prices (for backtests)

```python
class VisionHistorical:
    """Past settled batches come back from data-node."""

    def __init__(self, data_node_url: str = DATA_NODE):
        self.base = data_node_url.rstrip("/")

    def get_price_history(
        self, source: str = "twitch", lookback_hours: int = 48
    ) -> pd.DataFrame:
        try:
            r = requests.get(
                f"{self.base}/vision/batch/{source}/history",
                params={"hours": lookback_hours},
                timeout=15,
            )
            r.raise_for_status()
            data = r.json().get("history", [])
            if not data:
                return pd.DataFrame()
            df = pd.DataFrame(data)
            df["timestamp"] = pd.to_datetime(df["t"], unit="s")
            df["yes_resolved"] = df["yes"].astype(float)   # 0.0 or 1.0 post-settle
            df["no_resolved"] = df["no"].astype(float)
            return df.sort_values("timestamp")
        except requests.RequestException as e:
            print(f"  data-node unreachable: {e}")
            return pd.DataFrame()
```

The data-node does **not** return live pre-settlement pool totals. It returns per-market resolved prices (0 or 1 for each market per tick) once the oracle has settled. Backtests use these resolutions as ground truth; live trading uses your model alone.

## Combining Three Probability Layers

```python
class TripleLayerFeatures:
    """
    Combining three layers for Twitch on Vision testnet:
    1. External analytics (StreamCharts / TwitchTracker) — editorial odds
    2. Vision testnet — crowd intelligence on-chain
    3. ML model — our own score

    Twitch-specific: binary market (YES/NO — hits goal or not),
    parimutuel pricing on Vision (no bid/ask spread).
    """

    @staticmethod
    def compute_divergence_features(
        external_probs: dict,
        vision_probs: dict,
        ml_probs: dict | None = None,
    ) -> dict:
        features = {}

        for prefix, probs in [("ext", external_probs),
                               ("vision", vision_probs)]:
            features[f"{prefix}_prob_yes"] = probs.get("yes", 0)
            features[f"{prefix}_prob_no"] = probs.get("no", 0)

        # KL divergence
        epsilon = 1e-6
        kl_div = 0
        for key in ["yes", "no"]:
            p = max(external_probs.get(key, epsilon), epsilon)
            q = max(vision_probs.get(key, epsilon), epsilon)
            kl_div += p * np.log(p / q)
        features["kl_div_ext_vision"] = kl_div

        # Absolute divergences
        for key in ["yes", "no"]:
            ext = external_probs.get(key, 0)
            vis = vision_probs.get(key, 0)
            features[f"divergence_{key}"] = ext - vis
            features[f"abs_divergence_{key}"] = abs(ext - vis)

        features["max_divergence"] = max(
            features["abs_divergence_yes"],
            features["abs_divergence_no"],
        )

        # Source consensus
        ext_fav = max(external_probs, key=external_probs.get)
        vis_fav = max(vision_probs, key=vision_probs.get)
        features["sources_agree"] = int(ext_fav == vis_fav)

        # Blended probabilities
        for key in ["yes", "no"]:
            features[f"blended_prob_{key}"] = (
                0.5 * external_probs.get(key, 0)
                + 0.5 * vision_probs.get(key, 0)
            )

        # Triple layer
        if ml_probs:
            for key in ["yes", "no"]:
                ml = ml_probs.get(key, 0)
                ext = external_probs.get(key, 0)
                vis = vision_probs.get(key, 0)

                features[f"ml_prob_{key}"] = ml
                features[f"ml_vs_ext_{key}"] = ml - ext
                features[f"ml_vs_vision_{key}"] = ml - vis
                features[f"triple_blend_{key}"] = (
                    0.40 * ml + 0.35 * vis + 0.25 * ext
                )

            ml_fav = max(ml_probs, key=ml_probs.get)
            features["all_three_agree"] = int(
                ext_fav == vis_fav == ml_fav
            )

        return features


# === Example ===
external = {"yes": 0.62, "no": 0.38}
vision = {"yes": 0.58, "no": 0.42}
ml_probs = {"yes": 0.65, "no": 0.35}

triple_features = TripleLayerFeatures.compute_divergence_features(
    external_probs=external,
    vision_probs=vision,
    ml_probs=ml_probs,
)
print("=== Triple Layer Features (Twitch × Vision) ===")
for k, v in triple_features.items():
    print(f"  {k:30s} = {v:.4f}")
```

### Visualize Divergences

```python
import matplotlib.pyplot as plt


def plot_twitch_divergence(streams: list[dict], figsize=(12, 6)):
    """
    Scatter plot: external analytics vs Vision testnet.
    Binary market → one chart instead of three.
    """
    fig, ax = plt.subplots(figsize=figsize)

    ext_probs = [s["ext_yes"] for s in streams]
    vis_probs = [s["vision_yes"] for s in streams]

    ax.scatter(ext_probs, vis_probs, alpha=0.6,
               color="#9146FF", edgecolors="white", s=80)

    ax.plot([0, 1], [0, 1], "k--", alpha=0.3, linewidth=1)

    ax.fill_between([0, 1], [0.03, 1.03], [0, 1],
                    alpha=0.05, color="blue",
                    label="Vision above")
    ax.fill_between([0, 1], [0, 1], [-0.03, 0.97],
                    alpha=0.05, color="red",
                    label="External above")

    ax.set_xlabel("External P(YES hits goal)", fontsize=12)
    ax.set_ylabel("Vision testnet P(YES hits goal)", fontsize=12)
    ax.set_title(
        "Twitch streams: External analytics vs Vision testnet\n"
        "Points far from diagonal → potential value",
        fontsize=14,
    )
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_aspect("equal")
    ax.legend(fontsize=10)

    plt.tight_layout()
    plt.savefig("twitch_vision_divergence.png", bbox_inches="tight")
    plt.show()


def plot_triple_layer_bar(
    market_name: str,
    external: dict,
    vision: dict,
    ml_model: dict,
):
    """Grouped bar chart: three sources side by side."""
    fig, ax = plt.subplots(figsize=(10, 6))

    x = np.arange(2)
    width = 0.25
    labels = ["YES (hits goal)", "NO"]
    keys = ["yes", "no"]

    bars1 = ax.bar(x - width, [external[k] for k in keys],
                    width, label="External analytics", color="#3498db")
    bars2 = ax.bar(x, [vision[k] for k in keys],
                    width, label="Vision testnet", color="#9146FF")
    bars3 = ax.bar(x + width, [ml_model[k] for k in keys],
                    width, label="ML Model", color="#2ecc71")

    ax.set_ylabel("Probability")
    ax.set_title(f"Triple Layer: {market_name}", fontsize=14)
    ax.set_xticks(x)
    ax.set_xticklabels(labels)
    ax.legend()

    for bars in [bars1, bars2, bars3]:
        for bar in bars:
            height = bar.get_height()
            ax.annotate(f"{height:.0%}",
                        xy=(bar.get_x() + bar.get_width() / 2, height),
                        xytext=(0, 3), textcoords="offset points",
                        ha="center", va="bottom", fontsize=9)

    plt.tight_layout()
    plt.savefig("twitch_triple_bar.png", bbox_inches="tight")
    plt.show()
```

### Claude Analyzes Divergences

```python
def claude_analyze_twitch_divergence(
    market: str,
    external: dict,
    vision: dict,
    ml_model: dict,
    vision_pool_usdc: float,
    vision_depth_imbalance: float,
) -> str:
    """
    Claude analyzes divergences between three sources
    in the Twitch × Vision context.
    """
    prompt = f"""You are a senior Twitch analyst trading on Vision testnet.
You have three sources of probabilities for a stream goal market.
Analyze divergences.

**Market:** {market}

| Source | YES | NO |
|---|---|---|
| External analytics | {external['yes']:.1%} | {external['no']:.1%} |
| Vision testnet | {vision['yes']:.1%} | {vision['no']:.1%} |
| ML model | {ml_model['yes']:.1%} | {ml_model['no']:.1%} |

**Vision testnet metadata:**
- Pool depth: ${vision_pool_usdc:,.0f} USDC (L3, 18 dec)
- Imbalance (YES vs NO): {vision_depth_imbalance:+.2f}

**Task:**
1. Where are the main divergences and what could they mean?
   (raid incoming, drama break, sub train, category move, ban risk)
2. Which source should be trusted more and why?
3. Are there signs of informed on-chain activity?
   (Vision bots react within a single block to tweets / chat spikes)
4. Forecast with confidence level.

Be specific, 5-8 sentences."""

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text
```

## Building the ML Model

### Data Preparation

```python
from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, classification_report,
    confusion_matrix, log_loss,
)


def prepare_model_data(df: pd.DataFrame) -> tuple:
    """
    Prepare data. Twitch × Vision = binary classification (YES/NO).
    """
    feature_cols = [
        c for c in df.columns
        if c.startswith((
            "avg_", "Form", "Streak",
            "start_hour", "day_of_week",
            "is_weekend", "is_primetime",
            "RETENTION_RATE", "CHAT_DENSITY",
            "MONETIZATION_VELOCITY", "CATEGORY_LIFT",
            "ENGAGEMENT_INDEX",
            "elo_", "rest_", "hours_", "marathon_tail",
            "is_back_to_back", "overlap_",
            "ext_prob_", "norm_prob_", "odds_spread",
        ))
    ]
    # Exclude non-numeric leftovers
    feature_cols = [c for c in feature_cols if df[c].dtype != object]

    X = df[feature_cols].copy()
    y = df["HITS_GOAL"].copy()

    X = X.fillna(X.median(numeric_only=True))

    print(f"Features: {X.shape[1]}")
    print(f"Streams: {X.shape[0]}")
    print(f"Balance: YES={y.mean():.1%}, NO={1-y.mean():.1%}")

    return X, y, feature_cols


X, y, feature_names = prepare_model_data(featured_data)
```

### Model Training

```python
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import (
    RandomForestClassifier, GradientBoostingClassifier,
    VotingClassifier,
)
from xgboost import XGBClassifier


def train_and_evaluate(X, y):
    """
    Train models with TimeSeriesSplit.
    Twitch binary: accuracy target ~62–70%.
    """
    tscv = TimeSeriesSplit(n_splits=5)
    scaler = StandardScaler()

    models = {
        "Logistic Regression": LogisticRegression(
            max_iter=1000, C=0.5,
        ),
        "Random Forest": RandomForestClassifier(
            n_estimators=200, max_depth=8,
            min_samples_leaf=10, random_state=42,
        ),
        "XGBoost": XGBClassifier(
            n_estimators=300, max_depth=5,
            learning_rate=0.05, subsample=0.8,
            colsample_bytree=0.8, random_state=42,
            eval_metric="logloss",
        ),
        "Gradient Boosting": GradientBoostingClassifier(
            n_estimators=200, max_depth=4,
            learning_rate=0.08, random_state=42,
        ),
    }

    results = {}

    for name, model in models.items():
        fold_accs = []
        fold_lls = []

        for train_idx, test_idx in tscv.split(X):
            X_train = scaler.fit_transform(X.iloc[train_idx])
            X_test = scaler.transform(X.iloc[test_idx])
            y_train = y.iloc[train_idx]
            y_test = y.iloc[test_idx]

            model.fit(X_train, y_train)
            preds = model.predict(X_test)
            proba = model.predict_proba(X_test)

            fold_accs.append(accuracy_score(y_test, preds))
            fold_lls.append(log_loss(y_test, proba))

        results[name] = {
            "accuracy_mean": np.mean(fold_accs),
            "accuracy_std": np.std(fold_accs),
            "log_loss_mean": np.mean(fold_lls),
            "log_loss_std": np.std(fold_lls),
        }

        print(f"\n{'='*50}")
        print(f"  {name}")
        print(f"  Accuracy:  {results[name]['accuracy_mean']:.4f} "
              f"± {results[name]['accuracy_std']:.4f}")
        print(f"  Log Loss:  {results[name]['log_loss_mean']:.4f} "
              f"± {results[name]['log_loss_std']:.4f}")

    return results, models


results, models = train_and_evaluate(X, y)
```

### Ensemble

```python
def build_ensemble(X, y):
    """Ensemble with soft voting for Twitch stream outcomes."""
    scaler = StandardScaler()

    ensemble = VotingClassifier(
        estimators=[
            ("lr", LogisticRegression(max_iter=1000, C=0.5)),
            ("rf", RandomForestClassifier(
                n_estimators=200, max_depth=8, random_state=42)),
            ("xgb", XGBClassifier(
                n_estimators=300, max_depth=5, learning_rate=0.05,
                random_state=42, eval_metric="logloss")),
        ],
        voting="soft",
        weights=[1, 1, 2],  # XGBoost gets higher weight
    )

    split_idx = int(len(X) * 0.8)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    ensemble.fit(X_train_scaled, y_train)
    preds = ensemble.predict(X_test_scaled)
    proba = ensemble.predict_proba(X_test_scaled)

    print(f"\n{'='*60}")
    print(f"  ENSEMBLE (Soft Voting)")
    print(f"  Accuracy:  {accuracy_score(y_test, preds):.4f}")
    print(f"  Log Loss:  {log_loss(y_test, proba):.4f}")
    print(f"\n{classification_report(y_test, preds, target_names=['NO', 'YES'])}")

    return ensemble, scaler


ensemble_model, scaler = build_ensemble(X, y)
```

## Claude API Integration for Interpretation

### Generating a Detailed Prediction

```python
def generate_twitch_prediction_report(
    channel: str,
    market_question: str,
    model_proba: dict,
    stats: dict,
) -> str:
    """
    Analytical report on an upcoming Vision testnet market
    for a Twitch stream.
    """
    prompt = f"""You are a professional Twitch analyst. Based on ML model
data and rolling channel statistics, compose a brief analytical report.

## Market

Channel: **{channel}**
Question: **{market_question}**

Probabilities (ML Ensemble):
- YES (hits goal): {model_proba['yes']:.1%}
- NO (misses): {model_proba['no']:.1%}

Rolling stats for {channel} (last 10 streams):
- Avg viewers: {stats['avg_AVG_VIEWERS']:.0f}
- Peak viewers: {stats['avg_PEAK_VIEWERS']:.0f}
- Retention rate: {stats['RETENTION_RATE']:.1%}
- Chat density: {stats['CHAT_DENSITY']:.2f}
- Monetization velocity ($/h): {stats['MONETIZATION_VELOCITY']:.1f}
- Form (hit rate): {stats['Form']:.1%}
- Streak: {stats['Streak']}

## Task
1. Key prediction factors (retention, engagement, category lift,
   overlap with competing streams)
2. Outcome forecast + expected peak viewer range
3. Confidence score (high / medium / low)
4. Potential upset scenarios (raid, ban, category shift, drama)

Concise and professional."""

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text
```

### Batch Analysis of Tonight's Slate

```python
def analyze_twitch_slate(markets: list[dict]) -> str:
    """
    Analyze every active Twitch market on Vision testnet in one call.
    Typical slate = 20–60 simultaneous markets.
    """
    markets_text = ""
    for i, m in enumerate(markets, 1):
        markets_text += f"""
{i}. {m['channel']} — {m['question']}
   ML: YES={m['prob_Y']:.0%} | NO={m['prob_N']:.0%}
   ELO: {m['elo_channel']:.0f}
   Fatigue: 24h={m.get('hours_24h', 0):.1f}h | Marathon tail={'Yes' if m.get('marathon_tail') else 'No'}
"""

    prompt = f"""Analyze tonight's Vision testnet slate for Twitch. For each market:
- Forecast (YES / NO)
- Confidence (⭐ / ⭐⭐ / ⭐⭐⭐)
- Expected peak viewer range
- Brief comment (1 sentence)

Markets:
{markets_text}

At the end: top 3 best bets from the slate (highest confidence)."""

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text
```

## Results Visualization

### Model Comparison

```python
import matplotlib
import seaborn as sns

matplotlib.rcParams["figure.dpi"] = 120
matplotlib.rcParams["font.size"] = 11
sns.set_style("whitegrid")


def plot_model_comparison(results: dict):
    """Model comparison visualization for Twitch × Vision."""
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    names = list(results.keys())
    accs = [results[n]["accuracy_mean"] for n in names]
    acc_stds = [results[n]["accuracy_std"] for n in names]
    lls = [results[n]["log_loss_mean"] for n in names]
    ll_stds = [results[n]["log_loss_std"] for n in names]

    colors = ["#2ecc71", "#3498db", "#9146FF", "#f39c12"]

    bars = axes[0].barh(names, accs, xerr=acc_stds,
                         color=colors, edgecolor="white", linewidth=1.5)
    axes[0].set_xlabel("Accuracy")
    axes[0].set_title("Model Accuracy (Twitch × Vision, TimeSeriesSplit CV)")
    axes[0].set_xlim(0.5, 0.75)
    for bar, val in zip(bars, accs):
        axes[0].text(val + 0.005, bar.get_y() + bar.get_height()/2,
                     f"{val:.3f}", va="center", fontweight="bold")

    bars = axes[1].barh(names, lls, xerr=ll_stds,
                         color=colors, edgecolor="white", linewidth=1.5)
    axes[1].set_xlabel("Log Loss")
    axes[1].set_title("Log Loss (lower = better)")
    for bar, val in zip(bars, lls):
        axes[1].text(val + 0.005, bar.get_y() + bar.get_height()/2,
                     f"{val:.3f}", va="center", fontweight="bold")

    plt.tight_layout()
    plt.savefig("twitch_model_comparison.png", bbox_inches="tight")
    plt.show()
```

### Confusion Matrix

```python
def plot_twitch_confusion_matrix(y_true, y_pred):
    """Confusion matrix for binary Twitch classification."""
    cm = confusion_matrix(y_true, y_pred)
    labels = ["NO (miss)", "YES (hits goal)"]

    fig, ax = plt.subplots(figsize=(7, 5))
    sns.heatmap(
        cm, annot=True, fmt="d", cmap="Purples",
        xticklabels=labels, yticklabels=labels,
        ax=ax, linewidths=0.5, linecolor="white",
        annot_kws={"size": 16, "weight": "bold"},
    )
    ax.set_xlabel("Predicted result", fontsize=12)
    ax.set_ylabel("Actual result", fontsize=12)
    ax.set_title("Confusion Matrix — Twitch × Vision Ensemble", fontsize=14)

    cm_pct = cm / cm.sum(axis=1, keepdims=True)
    for i in range(2):
        for j in range(2):
            ax.text(j + 0.5, i + 0.75,
                    f"({cm_pct[i, j]:.0%})",
                    ha="center", va="center",
                    fontsize=10, color="gray")

    plt.tight_layout()
    plt.savefig("twitch_confusion_matrix.png", bbox_inches="tight")
    plt.show()
```

### Feature Importance

```python
def plot_feature_importance(model, feature_names, top_n=15):
    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
    else:
        return

    indices = np.argsort(importances)[-top_n:]

    fig, ax = plt.subplots(figsize=(10, 8))
    colors = plt.cm.Purples(np.linspace(0.3, 0.9, top_n))
    ax.barh(range(top_n), importances[indices],
            color=colors, edgecolor="white", linewidth=0.8)
    ax.set_yticks(range(top_n))
    ax.set_yticklabels([feature_names[i] for i in indices])
    ax.set_xlabel("Feature Importance")
    ax.set_title(f"Twitch × Vision: Top-{top_n} Important Features", fontsize=14)

    plt.tight_layout()
    plt.savefig("twitch_feature_importance.png", bbox_inches="tight")
    plt.show()
```

## Backtesting & Model Evaluation

### Walk-Forward Backtest

```python
class WalkForwardBacktest:
    """
    Walk-forward for Twitch × Vision: train on past streams,
    predict the next slate.

    step_size=25 ≈ one night of streaming
    (typical slate 20–60 active markets).
    """

    def __init__(self, model, scaler,
                 initial_train_size: int = 1000,
                 step_size: int = 25):
        self.model = model
        self.scaler = scaler
        self.initial_train_size = initial_train_size
        self.step_size = step_size

    def run(self, X: pd.DataFrame, y: pd.Series) -> dict:
        all_preds = []
        all_proba = []
        all_true = []

        for start in range(self.initial_train_size,
                           len(X) - self.step_size,
                           self.step_size):
            end = start + self.step_size

            X_train = X.iloc[:start]
            y_train = y.iloc[:start]
            X_test = X.iloc[start:end]
            y_test = y.iloc[start:end]

            X_train_s = self.scaler.fit_transform(X_train)
            X_test_s = self.scaler.transform(X_test)

            self.model.fit(X_train_s, y_train)
            preds = self.model.predict(X_test_s)
            proba = self.model.predict_proba(X_test_s)

            all_preds.extend(preds)
            all_proba.extend(proba)
            all_true.extend(y_test.values)

        all_preds = np.array(all_preds)
        all_proba = np.array(all_proba)
        all_true = np.array(all_true)

        acc = accuracy_score(all_true, all_preds)
        ll = log_loss(all_true, all_proba)

        print(f"Walk-Forward Twitch × Vision Backtest:")
        print(f"  Total predictions: {len(all_preds)}")
        print(f"  Accuracy: {acc:.4f}")
        print(f"  Log Loss: {ll:.4f}")
        print(f"\n{classification_report(all_true, all_preds, target_names=['NO', 'YES'])}")

        return {
            "predictions": all_preds,
            "probabilities": all_proba,
            "actuals": all_true,
            "accuracy": acc,
            "log_loss": ll,
        }


# backtester = WalkForwardBacktest(
#     model=XGBClassifier(n_estimators=300, max_depth=5,
#                         learning_rate=0.05, random_state=42),
#     scaler=StandardScaler(),
#     initial_train_size=1000,
#     step_size=25,
# )
# backtest_results = backtester.run(X, y)
```

### Calibration

```python
def plot_twitch_calibration(y_true, y_proba):
    """
    Calibration plot for Twitch × Vision.
    Binary task → one class (YES).
    """
    from sklearn.calibration import calibration_curve

    prob_true, prob_pred = calibration_curve(
        y_true, y_proba[:, 1],
        n_bins=10, strategy="uniform",
    )

    fig, ax = plt.subplots(figsize=(8, 8))
    ax.plot([0, 1], [0, 1], "k--", label="Perfectly calibrated")
    ax.plot(prob_pred, prob_true, "s-", color="#9146FF",
            label="Twitch × Vision Model", linewidth=2, markersize=8)

    ax.fill_between(prob_pred, prob_true, prob_pred,
                     alpha=0.1, color="#9146FF")

    ax.set_xlabel("Predicted P(YES)")
    ax.set_ylabel("Actual YES fraction")
    ax.set_title("Twitch × Vision Calibration Curve")
    ax.legend(loc="lower right")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)

    plt.tight_layout()
    plt.savefig("twitch_calibration.png", bbox_inches="tight")
    plt.show()
```

## Advanced Architecture: Hybrid System

### Hybrid ML + Claude + Vision for Twitch

```python
class TwitchHybridPredictor:
    """
    Twitch × Vision prediction hybrid system (Triple Layer):
      ML model (quantitative analysis)
    + Vision testnet (crowd intelligence, on-chain)
    + Claude (qualitative analysis + synthesis)

    Twitch-specific:
    - Binary classification (YES/NO — hits goal or not)
    - Parimutuel pricing on Vision (no spread)
    - Streamer state changes fast — model must react per-block
    """

    def __init__(self, ml_model, scaler, feature_names):
        self.ml_model = ml_model
        self.scaler = scaler
        self.feature_names = feature_names
        self.client = anthropic.Anthropic()
        self.vision_client = VisionTestnetClient()
        self.triple_layer = TripleLayerFeatures()

    def predict(self, stream_features: pd.DataFrame,
                channel: str, market_question: str,
                vision_market: dict | None = None,
                external_probs: dict | None = None) -> dict:
        """Full pipeline with three layers."""

        # Step 1: ML prediction
        X_scaled = self.scaler.transform(
            stream_features[self.feature_names]
        )
        ml_proba = self.ml_model.predict_proba(X_scaled)[0]
        ml_result = {
            "no": float(ml_proba[0]),
            "yes": float(ml_proba[1]),
        }

        # Step 2: Vision testnet
        vision_probs = None
        if vision_market:
            vision_probs = {
                "yes": vision_market["yes"],
                "no": vision_market["no"],
            }

        # Step 3: External analytics
        ext_probs = external_probs or {
            "yes": ml_result["yes"],
            "no": ml_result["no"],
        }

        # Step 4: Divergence features
        divergence = {}
        if vision_probs:
            divergence = self.triple_layer.compute_divergence_features(
                external_probs=ext_probs,
                vision_probs=vision_probs,
                ml_probs={
                    "yes": ml_result["yes"],
                    "no": ml_result["no"],
                },
            )

        # Step 5: Claude synthesis
        claude_analysis = self._get_claude_synthesis(
            channel, market_question,
            ml_result, ext_probs, vision_probs,
            divergence, vision_market,
        )

        # Step 6: Combine
        final = self._triple_combine(
            ml_result, ext_probs, vision_probs, claude_analysis,
            vision_liquidity=(
                vision_market["liquidity_usdc"] if vision_market else 0
            ),
        )

        return {
            "market": f"{channel} — {market_question}",
            "layers": {
                "ml_model": ml_result,
                "external": ext_probs,
                "vision": vision_probs,
            },
            "divergence_features": divergence,
            "claude_analysis": claude_analysis,
            "final_prediction": final,
        }

    def _get_claude_synthesis(
        self, channel, question, ml_proba, ext_probs, vision_probs,
        divergence, vision_market,
    ) -> dict:
        vision_section = ""
        if vision_probs:
            vision_section = f"""
Vision testnet (crowd intelligence, Index L3):
- YES: {vision_probs['yes']:.1%}
- NO: {vision_probs['no']:.1%}
- Pool: ${vision_market['liquidity_usdc']:,.0f} USDC (18 dec)

KL-divergence (Ext vs Vision): {divergence.get('kl_div_ext_vision', 0):.4f}
Source consensus: {'Yes' if divergence.get('all_three_agree') else 'No'}"""

        prompt = f"""You are a senior Twitch analyst. Synthesize three sources.

Channel: {channel}
Market: {question}

ML model:
- YES: {ml_proba['yes']:.1%}
- NO: {ml_proba['no']:.1%}

External analytics:
- YES: {ext_probs['yes']:.1%}
- NO: {ext_probs['no']:.1%}
{vision_section}

Return ONLY JSON:
{{
    "confidence": <"high"|"medium"|"low">,
    "adjusted_yes": <float 0-1>,
    "adjusted_no": <float 0-1>,
    "vision_trust_level": <"high"|"medium"|"low">,
    "divergence_interpretation": "<what the divergence means>",
    "key_insight": "<main takeaway>",
    "expected_peak_viewers": <int>,
    "risk_factor": "<main risk — ban, raid out, drama, category shift>"
}}"""

        message = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )

        text = message.content[0].text.strip()
        try:
            start = text.find("{")
            end = text.rfind("}") + 1
            return json.loads(text[start:end])
        except (json.JSONDecodeError, ValueError):
            return {"error": "Failed to parse"}

    def _triple_combine(self, ml_result, ext_probs, vision_probs,
                         claude_result, vision_liquidity) -> dict:
        """Adaptive merging for Twitch × Vision."""
        if "error" in claude_result:
            return {
                "predicted_result": max(ml_result, key=ml_result.get),
                "probabilities": ml_result,
                "source": "ml_only",
            }

        # Liquidity thresholds in USDC (L3, 18 dec)
        if vision_probs and vision_liquidity > 10_000:
            weights = {"ml": 0.35, "vision": 0.35,
                       "ext": 0.15, "claude": 0.15}
        elif vision_probs and vision_liquidity > 1_000:
            weights = {"ml": 0.40, "vision": 0.20,
                       "ext": 0.20, "claude": 0.20}
        else:
            weights = {"ml": 0.50, "vision": 0.0,
                       "ext": 0.25, "claude": 0.25}

        combined = {}
        for key in ["yes", "no"]:
            claude_key = f"adjusted_{key}"

            ml_val = ml_result[key]
            ext_val = ext_probs.get(key, ml_val)
            vis_val = vision_probs.get(key, ml_val) if vision_probs else ml_val
            claude_val = claude_result.get(claude_key, ml_val)

            combined[key] = (
                weights["ml"] * ml_val
                + weights["vision"] * vis_val
                + weights["ext"] * ext_val
                + weights["claude"] * claude_val
            )

        total = sum(combined.values())
        combined = {k: v / total for k, v in combined.items()}

        return {
            "predicted_result": max(combined, key=combined.get),
            "probabilities": combined,
            "weights_used": weights,
            "confidence": claude_result.get("confidence", "unknown"),
            "expected_peak_viewers": claude_result.get("expected_peak_viewers", 0),
            "insight": claude_result.get("key_insight", ""),
            "risk": claude_result.get("risk_factor", ""),
            "source": "triple_hybrid",
        }
```

### Ablation Study

```python
class AblationStudy:
    """
    Ablation Study for Twitch × Vision:
      A) ML model only
      B) ML + external analytics
      C) ML + external + Vision testnet
      D) ML + external + Vision + Claude features
    """

    def __init__(self, base_model, scaler, feature_sets: dict):
        self.base_model = base_model
        self.scaler = scaler
        self.feature_sets = feature_sets

    def run(self, df, y) -> dict:
        from copy import deepcopy
        tscv = TimeSeriesSplit(n_splits=5)
        results = {}

        for config_name, features in self.feature_sets.items():
            X = df[features].fillna(df[features].median(numeric_only=True))
            fold_acc, fold_ll = [], []

            for train_idx, test_idx in tscv.split(X):
                model = deepcopy(self.base_model)
                sc = deepcopy(self.scaler)

                X_tr = sc.fit_transform(X.iloc[train_idx])
                X_te = sc.transform(X.iloc[test_idx])

                model.fit(X_tr, y.iloc[train_idx])
                proba = model.predict_proba(X_te)
                preds = model.predict(X_te)

                fold_acc.append(accuracy_score(y.iloc[test_idx], preds))
                fold_ll.append(log_loss(y.iloc[test_idx], proba))

            results[config_name] = {
                "accuracy": np.mean(fold_acc),
                "accuracy_std": np.std(fold_acc),
                "log_loss": np.mean(fold_ll),
                "log_loss_std": np.std(fold_ll),
            }

        return results

    @staticmethod
    def print_results(results: dict):
        print(f"\n{'='*65}")
        print(f"  {'Config':<25s} {'Accuracy':>10s} {'Log Loss':>10s}")
        print(f"{'='*65}")
        baseline_acc = None
        for name, m in sorted(results.items()):
            acc, ll = m["accuracy"], m["log_loss"]
            if baseline_acc is None:
                baseline_acc = acc
                delta = ""
            else:
                diff = acc - baseline_acc
                delta = f"  ({'+' if diff > 0 else ''}{diff:.2%})"
            print(f"  {name:<25s} {acc:>8.4f}±{m['accuracy_std']:.3f}"
                  f"  {ll:>8.4f}{delta}")
        print(f"{'='*65}")
```

## Deployment & Automation

### Automated Pipeline

```python
import schedule
from datetime import datetime


class TwitchPredictionPipeline:
    """
    Automated pipeline for Twitch × Vision:
    data loading → model update → tonight's predictions →
    optional order submission on Vision testnet.

    Twitch primetime is usually 18:00–23:00 UTC, so running
    at 16:00 UTC yields fresh predictions for the slate.
    """

    def __init__(self, channels: list[str]):
        self.loader = TwitchDataLoader(
            client_id=os.getenv("TWITCH_CLIENT_ID"),
            app_token=os.getenv("TWITCH_APP_TOKEN"),
            channels=channels,
        )
        self.engineer = TwitchFeatureEngineer(window=10)
        self.model = XGBClassifier(
            n_estimators=300, max_depth=5,
            learning_rate=0.05, random_state=42,
            eval_metric="logloss",
        )
        self.scaler = StandardScaler()
        self.vision = VisionTestnetClient()

    def run_daily(self):
        print(f"\n{'='*60}")
        print(f"  Twitch × Vision Pipeline: {datetime.now()}")
        print(f"{'='*60}\n")

        # 1. Load data
        raw = self.loader.load_all(lookback_days=120)
        clean = DataCleaner.clean(raw)
        clean = label_outcome(clean, threshold_quantile=0.5)
        featured = self.engineer.build_stream_features(clean)
        featured = compute_four_factors_stream(featured)

        elo = TwitchELO(k=24, primetime_bonus=80)
        featured = elo.compute_elo_features(featured)
        featured = compute_stream_fatigue_features(featured)
        featured = compute_overlap_features(featured)

        # 2. Training
        X, y, fnames = prepare_model_data(featured)
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)

        acc = accuracy_score(y, self.model.predict(X_scaled))
        print(f"  Training accuracy: {acc:.4f}")

        # 3. Tonight's active Vision markets
        active = self.vision.list_active_markets(source_prefix="twitch")
        print(f"  Active Twitch markets on Vision: {len(active)}")

        # 4. (optional) submit bot orders via AP / order API
        print(f"  Pipeline completed.")
        return True


# pipeline = TwitchPredictionPipeline(channels=[...])
# schedule.every().day.at("16:00").do(pipeline.run_daily)
# while True:
#     schedule.run_pending()
#     time.sleep(60)
```

### Project Structure

```
twitch-vision-bot/
├── config/
│   └── settings.py               # API keys, parameters, RPC endpoints
├── data/
│   ├── loader.py                  # TwitchDataLoader
│   ├── cleaner.py                 # DataCleaner
│   ├── viewer_telemetry.py        # ViewerTelemetry (SullyGnome)
│   └── vision_client.py           # VisionTestnetClient + Historical
├── features/
│   ├── engineering.py             # TwitchFeatureEngineer
│   ├── four_factors.py            # compute_four_factors_stream
│   ├── elo.py                     # TwitchELO
│   ├── fatigue.py                 # compute_stream_fatigue_features
│   ├── overlap.py                 # compute_overlap_features
│   ├── claude_features.py         # Claude-based features
│   ├── external_signals.py        # add_external_signal_features
│   └── triple_layer.py            # TripleLayerFeatures
├── models/
│   ├── train.py                   # Model training
│   ├── ensemble.py                # Ensemble
│   └── hybrid.py                  # TwitchHybridPredictor
├── evaluation/
│   ├── backtest.py                # WalkForwardBacktest
│   ├── ablation.py                # AblationStudy
│   └── metrics.py                 # Metrics and charts
├── visualization/
│   ├── plots.py                   # Basic plots
│   └── divergence.py              # Divergence charts
├── vision_trading/
│   ├── order_submit.py            # Place orders on Vision testnet
│   └── position_manager.py        # Track open positions, P&L
├── pipeline.py                    # TwitchPredictionPipeline
├── requirements.txt
├── abi/
│   ├── Index.json
│   └── VisionReserve.json
└── README.md
```

## Key Takeaways

XGBoost + SHAP is the baseline (accuracy target ~62–70% on channel-threshold binary markets). Four engineered factors — retention, chat density, monetization velocity, category lift — explain most of the variance. The external-analytics baseline (~58–62%) is the bar to beat. Vision testnet adds crowd signal that updates within a single L3 block, so lead times on raids, bans, and category migrations shrink from editorial hours to seconds. Walk-forward validation is mandatory — k-fold will leak the future through you, and the model will flatter itself. Liquidity on Vision testnet is uneven; weight the on-chain layer by USDC pool depth, not by conviction. And when the three sources agree, the edge is usually already priced in — the money sits in the disagreement.
