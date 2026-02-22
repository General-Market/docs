import os
import pytest
from unittest.mock import MagicMock, patch

from framework.core import load_config


class TestLoadConfig:
    def test_defaults_without_file(self):
        cfg = load_config("/nonexistent/path.toml")
        assert cfg["strategy"] == "random"
        assert cfg["deposit"] == 10
        assert cfg["max_batches"] == 5
        assert cfg["rpc_url"] == "http://localhost:8546"
        assert cfg["auto_claim"] is True

    def test_env_var_overrides(self):
        with patch.dict(os.environ, {"DEPOSIT_AMOUNT": "25", "STRATEGY": "momentum"}):
            cfg = load_config("/nonexistent/path.toml")
            assert cfg["deposit"] == 25
            assert cfg["strategy"] == "momentum"

    def test_env_var_int_conversion(self):
        with patch.dict(os.environ, {"POLL_INTERVAL": "60"}):
            cfg = load_config("/nonexistent/path.toml")
            assert cfg["poll_interval"] == 60
            assert isinstance(cfg["poll_interval"], int)


class TestRunCycle:
    def test_joins_batch_and_calls_tracker(self):
        """Mock all dependencies, verify run_cycle joins a batch."""
        from bot import run_cycle

        cfg = load_config("/nonexistent")
        executor = MagicMock()
        executor.bot_addr = "0x1234"
        executor.usdc_balance.return_value = 100 * 10**6  # 100 USDC

        tracker = MagicMock()
        tracker.active_ids = set()
        tracker.active_count = 0

        strategy = MagicMock()
        strategy.predict.return_value = ["UP", "DOWN", "UP"]

        from framework.core import RiskCheck
        risk = RiskCheck(5, 100 * 10**6)

        issuer_urls_fn = lambda: ["http://localhost:10001"]

        with patch("bot.fetch_batches") as mock_fb, \
             patch("bot.fetch_markets") as mock_fm, \
             patch("bot.submit_bitmap") as mock_sb, \
             patch("bot.time"):
            mock_fb.return_value = [{"id": 1, "market_ids": ["btc", "eth", "sol"]}]
            mock_fm.return_value = [
                {"id": "btc", "price": 50000, "change": 2.0, "volume": 1e9, "market_cap": 1e12},
                {"id": "eth", "price": 3000, "change": -1.0, "volume": 5e8, "market_cap": 3e11},
                {"id": "sol", "price": 100, "change": 5.0, "volume": 2e8, "market_cap": 5e10},
            ]

            run_cycle(cfg, executor, tracker, strategy, risk, issuer_urls_fn)

            executor.approve_usdc.assert_called_once()
            executor.join_batch.assert_called_once()
            tracker.on_join.assert_called_once()
            tracker.check_all.assert_called_once()

    def test_max_batches_respected(self):
        """When tracker is at max, no new joins."""
        from bot import run_cycle

        cfg = load_config("/nonexistent")
        executor = MagicMock()
        executor.bot_addr = "0x1234"

        tracker = MagicMock()
        tracker.active_ids = {1, 2, 3, 4, 5}
        tracker.active_count = 5  # at max

        strategy = MagicMock()
        risk = MagicMock()
        issuer_urls_fn = lambda: ["http://localhost:10001"]

        with patch("bot.fetch_batches") as mock_fb, \
             patch("bot.time"):
            mock_fb.return_value = [{"id": 6, "market_ids": ["btc"]}]

            run_cycle(cfg, executor, tracker, strategy, risk, issuer_urls_fn)

            executor.join_batch.assert_not_called()
            tracker.check_all.assert_called_once()
