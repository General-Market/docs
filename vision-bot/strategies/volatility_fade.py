"""Volatility fade — spike fader.

Crypto, memecoins, 4chan activity, social metrics.
Things that spike violently and collapse just as fast.
Follow the trend when nothing is happening. Fade it when everything is.

With rich history, compare current |change| against historical avg to detect spikes.
With thin history, infer from move magnitude:
  - Large move (abs > 4%) = vol spike -> bet on mean reversion (opposite direction)
  - Small move (abs < 4%) = low vol -> weak momentum (follow direction, trends persist)

This diverges from momentum, which always follows sign.
Vol fade opposes large moves and follows small ones.
"""

import logging
import random

from framework.core import Strategy

log = logging.getLogger(__name__)

# Above this absolute change, assume a vol spike (fade it — bet opposite).
# Below it, assume calm waters (follow direction — low-vol trends persist).
SPIKE_THRESHOLD_PCT = 4.0


class VolatilityFadeStrategy(Strategy):
    """Spike fader — contrarian after big moves, momentum-like in quiet periods.

    Diverges from momentum: a large positive change triggers DOWN (fade the spike),
    a large negative change triggers UP. Only small moves align with momentum.
    """

    name = "volatility_fade"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = random.Random()
        self._spike_pct = (params or {}).get(
            "spike_threshold_pct", SPIKE_THRESHOLD_PCT,
        )

    def _fade_signal(self, change):
        """Infer vol-fade direction from a single change value.

        Returns opposite direction for large moves (spike fading),
        same direction for small moves (low-vol trend following).
        Momentum says UP for change=+6%. Vol fade says DOWN — spike will revert.
        """
        if change is None or change == 0:
            return self._rng.choice(["UP", "DOWN"])

        if abs(change) >= self._spike_pct:
            # Large move — vol spike, fade it (bet on reversion)
            return "DOWN" if change > 0 else "UP"
        else:
            # Small move — low vol, follow the trend
            return "UP" if change > 0 else "DOWN"

    def predict(self, markets):
        """Spike fade from change magnitude alone. Never momentum."""
        return [self._fade_signal(m.get("change")) for m in markets]

    def predict_with_context(self, markets, feed=None, batch_id=None):
        if not feed or not batch_id:
            return self.predict(markets)

        lookback = self.params.get("lookback_ticks", 10)
        vol_mult = self.params.get("vol_threshold_multiplier", 2.0)
        results = []

        for m in markets:
            asset_id = m.get("id", "")
            change = m.get("change")
            history = feed.history(batch_id, asset_id)

            if len(history) < 3 or change is None or change == 0:
                results.append(self._fade_signal(change))
                continue

            recent = history[-lookback:]
            abs_changes = [
                abs(h.get("change_pct") or 0) for h in recent
                if h.get("change_pct") is not None
            ]

            if not abs_changes:
                results.append(self._fade_signal(change))
                continue

            avg_abs = sum(abs_changes) / len(abs_changes)

            if avg_abs > 0 and abs(change) > vol_mult * avg_abs:
                # Spike — fade it
                results.append("DOWN" if change >= 0 else "UP")
            else:
                # Calm — momentum
                results.append("UP" if change >= 0 else "DOWN")

        return results
