import pytest

from src.embedding.pricing import estimate_embedding_cost_usd


def test_zero_chars_costs_nothing():
    assert estimate_embedding_cost_usd(0) == 0.0


def test_negative_chars_costs_nothing():
    assert estimate_embedding_cost_usd(-5) == 0.0


def test_known_char_count_matches_formula():
    # 4000 chars / 4 chars-per-token = 1000 tokens = 1 "unit" of 1000 tokens
    # 1 * 0.00001 = 0.00001
    assert estimate_embedding_cost_usd(4000) == pytest.approx(0.00001)


def test_cost_scales_linearly_with_char_count():
    small = estimate_embedding_cost_usd(4000)
    large = estimate_embedding_cost_usd(40000)
    assert large == pytest.approx(small * 10)
