import pytest

from framework.core import load_strategy


class TestRandomStrategy:
    def test_returns_correct_count(self):
        strategy = load_strategy("random")
        markets = [
            {"id": f"m{i}", "price": 100, "change": 1, "volume": None, "market_cap": None}
            for i in range(5)
        ]
        result = strategy.predict(markets)
        assert len(result) == 5
        assert all(b in ("UP", "DOWN") for b in result)

    def test_all_results_valid(self):
        strategy = load_strategy("random")
        markets = [{"id": "x", "price": 1, "change": None, "volume": None, "market_cap": None}] * 100
        result = strategy.predict(markets)
        assert len(result) == 100
        assert set(result).issubset({"UP", "DOWN"})

    def test_different_keys_produce_different_bitmaps(self, monkeypatch):
        """Two bots with different keys must not produce the same predictions."""
        import os
        markets = [
            {"id": f"m{i}", "price": 1, "change": None, "volume": None, "market_cap": None}
            for i in range(20)
        ]
        monkeypatch.setenv("BOT_PRIVATE_KEY", "0xAAAA")
        s1 = load_strategy("random")
        r1 = s1.predict(markets)

        monkeypatch.setenv("BOT_PRIVATE_KEY", "0xBBBB")
        s2 = load_strategy("random")
        r2 = s2.predict(markets)

        assert r1 != r2, "Different private keys must produce different bitmaps"

    def test_same_key_is_deterministic(self, monkeypatch):
        """Same key always produces the same predictions."""
        markets = [
            {"id": f"m{i}", "price": 1, "change": None, "volume": None, "market_cap": None}
            for i in range(10)
        ]
        monkeypatch.setenv("BOT_PRIVATE_KEY", "0xDEAD")
        s1 = load_strategy("random")
        s2 = load_strategy("random")
        assert s1.predict(markets) == s2.predict(markets)


class TestMomentumStrategy:
    def test_positive_change_is_up(self):
        strategy = load_strategy("momentum")
        markets = [{"id": "btc", "price": 50000, "change": 5.0, "volume": 1e9, "market_cap": 1e12}]
        assert strategy.predict(markets) == ["UP"]

    def test_negative_change_is_down(self):
        strategy = load_strategy("momentum")
        markets = [{"id": "btc", "price": 50000, "change": -3.0, "volume": 1e9, "market_cap": 1e12}]
        assert strategy.predict(markets) == ["DOWN"]

    def test_none_change_is_random(self):
        """Missing data must coin-flip — neither UP nor DOWN can be claimed
        with a straight face when the data simply isn't there."""
        strategy = load_strategy("momentum")
        markets = [{"id": "btc", "price": 50000, "change": None, "volume": None, "market_cap": None}]
        result = strategy.predict(markets)
        assert result[0] in ("UP", "DOWN")

    def test_zero_change_is_down(self):
        """Zero change is data, not absence. The momentum of stillness is DOWN."""
        strategy = load_strategy("momentum")
        markets = [{"id": "btc", "price": 50000, "change": 0.0, "volume": None, "market_cap": None}]
        assert strategy.predict(markets) == ["DOWN"]
