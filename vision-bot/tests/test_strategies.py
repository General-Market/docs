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


class TestMomentumStrategy:
    def test_positive_change_is_up(self):
        strategy = load_strategy("momentum")
        markets = [{"id": "btc", "price": 50000, "change": 5.0, "volume": 1e9, "market_cap": 1e12}]
        assert strategy.predict(markets) == ["UP"]

    def test_negative_change_is_down(self):
        strategy = load_strategy("momentum")
        markets = [{"id": "btc", "price": 50000, "change": -3.0, "volume": 1e9, "market_cap": 1e12}]
        assert strategy.predict(markets) == ["DOWN"]

    def test_none_change_is_up(self):
        strategy = load_strategy("momentum")
        markets = [{"id": "btc", "price": 50000, "change": None, "volume": None, "market_cap": None}]
        assert strategy.predict(markets) == ["UP"]

    def test_zero_change_is_up(self):
        strategy = load_strategy("momentum")
        markets = [{"id": "btc", "price": 50000, "change": 0.0, "volume": None, "market_cap": None}]
        assert strategy.predict(markets) == ["UP"]
