"""Tests for framework.core — bitmap encoding, Strategy ABC, RiskCheck."""

import pytest

from framework.core import (
    encode_bitmap,
    hash_bitmap,
    RiskCheck,
    Strategy,
)


# ── encode_bitmap ────────────────────────────────────────────────


class TestEncodeBitmap:
    def test_all_up_8_markets(self):
        """8 UP bets -> 0xFF (all bits set)."""
        bets = ["UP"] * 8
        assert encode_bitmap(bets, 8) == bytes([0xFF])

    def test_all_down_8_markets(self):
        """8 DOWN bets -> 0x00 (no bits set)."""
        bets = ["DOWN"] * 8
        assert encode_bitmap(bets, 8) == bytes([0x00])

    def test_alternating_up_down(self):
        """[UP,DOWN,UP,DOWN,UP,DOWN,UP,DOWN] -> 0xAA (10101010)."""
        bets = ["UP", "DOWN", "UP", "DOWN", "UP", "DOWN", "UP", "DOWN"]
        assert encode_bitmap(bets, 8) == bytes([0xAA])

    def test_partial_byte_3_markets_all_up(self):
        """3 UP bets -> 0xE0 (11100000). Only top 3 bits set."""
        bets = ["UP", "UP", "UP"]
        assert encode_bitmap(bets, 3) == bytes([0xE0])

    def test_empty_bets_zero_count(self):
        """0 markets -> empty bytes."""
        assert encode_bitmap([], 0) == b""

    def test_bets_shorter_than_count(self):
        """Missing entries treated as DOWN."""
        bets = ["UP"]  # only 1 bet for 8 markets
        result = encode_bitmap(bets, 8)
        assert result == bytes([0x80])  # only MSB set

    def test_16_markets_two_bytes(self):
        """16 markets produce 2 bytes."""
        bets = ["UP"] * 16
        result = encode_bitmap(bets, 16)
        assert len(result) == 2
        assert result == bytes([0xFF, 0xFF])

    def test_9_markets_needs_two_bytes(self):
        """9 markets -> 2 bytes. 9th market = MSB of 2nd byte."""
        bets = ["DOWN"] * 8 + ["UP"]
        result = encode_bitmap(bets, 9)
        assert len(result) == 2
        assert result[0] == 0x00
        assert result[1] == 0x80  # bit 0 of byte 1 = MSB = 9th market


# ── hash_bitmap ──────────────────────────────────────────────────


class TestHashBitmap:
    def test_deterministic(self):
        """Same input always produces the same hash."""
        bitmap = encode_bitmap(["UP", "DOWN", "UP"], 3)
        h1 = hash_bitmap(bitmap)
        h2 = hash_bitmap(bitmap)
        assert h1 == h2

    def test_returns_32_bytes(self):
        """keccak256 output is always 32 bytes."""
        bitmap = encode_bitmap(["UP"] * 8, 8)
        h = hash_bitmap(bitmap)
        assert len(h) == 32

    def test_different_inputs_different_hashes(self):
        """Different bitmaps produce different hashes."""
        b1 = encode_bitmap(["UP"] * 8, 8)
        b2 = encode_bitmap(["DOWN"] * 8, 8)
        assert hash_bitmap(b1) != hash_bitmap(b2)


# ── Strategy ABC ─────────────────────────────────────────────────


class TestStrategy:
    def test_cannot_instantiate_abc(self):
        """Strategy is abstract — direct instantiation must fail."""
        with pytest.raises(TypeError):
            Strategy()  # type: ignore[abstract]

    def test_subclass_with_predict_works(self):
        """A concrete subclass that implements predict() can be instantiated."""

        class AllUp(Strategy):
            name = "all-up"

            def predict(self, markets: list[dict]) -> list[str]:
                return ["UP"] * len(markets)

        s = AllUp()
        assert s.name == "all-up"
        result = s.predict([{"id": "BTC", "price": 100.0, "change": None, "volume": None, "market_cap": None}])
        assert result == ["UP"]

    def test_subclass_missing_predict_fails(self):
        """A subclass that does NOT implement predict() cannot be instantiated."""

        class Broken(Strategy):
            name = "broken"

        with pytest.raises(TypeError):
            Broken()  # type: ignore[abstract]


# ── RiskCheck ────────────────────────────────────────────────────


class TestRiskCheck:
    def test_can_join_within_limits(self):
        rc = RiskCheck(max_batches=3, max_exposure=1000)
        assert rc.can_join(deposit=100) is True

    def test_can_join_over_max_batches(self):
        rc = RiskCheck(max_batches=2, max_exposure=10_000)
        rc.record_join(1, 100)
        rc.record_join(2, 100)
        assert rc.can_join(deposit=100) is False

    def test_can_join_over_max_exposure(self):
        rc = RiskCheck(max_batches=10, max_exposure=500)
        rc.record_join(1, 300)
        assert rc.can_join(deposit=300) is False  # 300 + 300 = 600 > 500

    def test_can_join_exactly_at_exposure_limit(self):
        rc = RiskCheck(max_batches=10, max_exposure=500)
        rc.record_join(1, 200)
        assert rc.can_join(deposit=300) is True  # 200 + 300 = 500 == limit

    def test_record_join_and_exit(self):
        rc = RiskCheck(max_batches=5, max_exposure=10_000)
        rc.record_join(10, 500)
        assert rc.active_count == 1
        assert 10 in rc.active_ids

        rc.record_exit(10)
        assert rc.active_count == 0
        assert 10 not in rc.active_ids

    def test_record_exit_unknown_batch_is_noop(self):
        rc = RiskCheck(max_batches=5, max_exposure=10_000)
        rc.record_exit(999)  # should not raise
        assert rc.active_count == 0

    def test_active_count_and_ids(self):
        rc = RiskCheck(max_batches=5, max_exposure=10_000)
        rc.record_join(1, 100)
        rc.record_join(2, 200)
        rc.record_join(3, 300)
        assert rc.active_count == 3
        assert rc.active_ids == {1, 2, 3}

    def test_exposure_frees_after_exit(self):
        """After exiting a batch, its deposit no longer counts toward exposure."""
        rc = RiskCheck(max_batches=10, max_exposure=500)
        rc.record_join(1, 400)
        assert rc.can_join(deposit=200) is False  # 400 + 200 = 600 > 500
        rc.record_exit(1)
        assert rc.can_join(deposit=200) is True  # 0 + 200 = 200 <= 500


# ── load_strategy (error path) ───────────────────────────────────


class TestLoadStrategy:
    def test_unknown_strategy_raises(self):
        """load_strategy raises ValueError for a name that doesn't exist."""
        from framework.core import load_strategy

        with pytest.raises(ValueError, match="Unknown strategy"):
            load_strategy("nonexistent-strategy-xyz")
