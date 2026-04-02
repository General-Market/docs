from framework.core import Strategy


class HomeFieldStrategy(Strategy):
    """Sports-specific: bet UP on home team metrics, DOWN on away."""
    name = "home_field"

    def predict(self, markets):
        results = []
        for m in markets:
            mid = (m.get("id") or "").lower()
            if "home" in mid:
                results.append("UP")
            elif "away" in mid:
                results.append("DOWN")
            else:
                # Fallback: momentum
                results.append("UP" if (m.get("change") or 0) >= 0 else "DOWN")
        return results
