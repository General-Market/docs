"""Volatility fade — momentum in the calm, contrarian in the storm.

Crypto, memecoins, 4chan activity, social metrics.
Things that spike violently and collapse just as fast.
Follow the trend when nothing is happening. Fade it when everything is.
"""

import logging
import random

from framework.core import Strategy

log = logging.getLogger(__name__)


class VolatilityFadeStrategy(Strategy):
    """Hybrid: momentum in low-vol regimes, contrarian in high-vol spikes.

    Measures current |change| against the average |change| over a lookback.
    Spike detected (|change| > threshold * avg) -> fade it.
    Calm waters -> ride the current.
    """

    name = "volatility_fade"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = random.Random()

    def predict(self, markets):
        """Fallback: momentum (follow last tick)."""
        return [
            "UP" if (m.get("change") or 0) >= 0 else "DOWN"
            for m in markets
        ]

    def predict_with_context(self, markets, feed=None, batch_id=None):
        if not feed or not batch_id:
            return self.predict(markets)

        lookback = self.params.get("lookback_ticks", 10)
        vol_mult = self.params.get("vol_threshold_multiplier", 2.0)
        results = []

        for m in markets:
            asset_id = m.get("id", "")
            change = m.get("change") or 0
            history = feed.history(batch_id, asset_id)

            if len(history) < 3:
                # Not enough data — plain momentum
                results.append("UP" if change >= 0 else "DOWN")
                continue

            recent = history[-lookback:]
            abs_changes = [
                abs(h.get("change_pct") or 0) for h in recent
                if h.get("change_pct") is not None
            ]

            if not abs_changes:
                results.append("UP" if change >= 0 else "DOWN")
                continue

            avg_abs = sum(abs_changes) / len(abs_changes)

            if avg_abs > 0 and abs(change) > vol_mult * avg_abs:
                # Spike — fade it
                results.append("DOWN" if change >= 0 else "UP")
            else:
                # Calm — momentum
                results.append("UP" if change >= 0 else "DOWN")

        return results
