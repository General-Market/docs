"""Time-of-day bias — for data ruled by the clock.

Transport delays, streaming activity, gaming concurrency, power demand.
The hour dictates the outcome more than any chart pattern.
"""

import logging
import random
from datetime import datetime, timezone

from framework.core import Strategy

log = logging.getLogger(__name__)


class TimeOfDayStrategy(Strategy):
    """Bet based on the current hour (UTC).

    Peak hours -> bullish (traffic/transit delays rise, streaming/gaming peaks).
    Off-peak -> bearish (activity drops, metrics deflate).
    Configurable peak windows and bias strength.
    """

    name = "time_of_day"

    # Default peak hours: morning rush + evening rush + evening leisure
    DEFAULT_PEAK_HOURS = [7, 8, 9, 17, 18, 19, 20, 21, 22]

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = random.Random()
        self._peak_hours = set(
            self.params.get("peak_hours", self.DEFAULT_PEAK_HOURS)
        )
        # bias: probability of following the time signal (0.0 = random, 1.0 = pure time)
        self._bias = self.params.get("bias", 0.7)

    def predict(self, markets):
        hour = datetime.now(timezone.utc).hour
        is_peak = hour in self._peak_hours
        base_dir = "UP" if is_peak else "DOWN"

        results = []
        for _ in markets:
            if self._rng.random() < self._bias:
                results.append(base_dir)
            else:
                # Against the clock — sometimes the schedule lies
                results.append("DOWN" if base_dir == "UP" else "UP")
        return results

    def predict_with_context(self, markets, feed=None, batch_id=None):
        # Time-of-day doesn't need history — the clock is the oracle
        return self.predict(markets)
