import re

from framework.core import Strategy, make_strategy_rng


# Tokenise an asset id on common delimiters and check whole tokens, not
# substrings. "chrome" must not match "home"; "homeschool" must not match
# "home" either. The asset id is a structured identifier, not prose.
_TOKEN_SPLIT = re.compile(r"[_\-/.: ]+")


class HomeFieldStrategy(Strategy):
    """Sports-specific: bet UP on home team metrics, DOWN on away."""
    name = "home_field"

    def __init__(self, params=None):
        super().__init__(params)
        self._rng = make_strategy_rng(self.name)

    def predict(self, markets):
        results = []
        for m in markets:
            mid = (m.get("id") or "").lower()
            tokens = set(t for t in _TOKEN_SPLIT.split(mid) if t)
            if "home" in tokens:
                results.append("UP")
            elif "away" in tokens:
                results.append("DOWN")
            else:
                c = m.get("change")
                if c is None:
                    results.append(self._rng.choice(["UP", "DOWN"]))
                elif c == 0.0:
                    # Zero change: no home-field signal, no momentum signal.
                    # Default DOWN — the away team's silence wins by default.
                    results.append("DOWN")
                else:
                    results.append("UP" if c > 0 else "DOWN")
        return results
