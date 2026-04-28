"""Tests for chart key normalization (chart PDF ↔ RNP procedure linking)."""

import pytest

from app.utils.chart_key import normalize_chart_key


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("VAAU-RNP-Y-RWY-27.pdf", "VAAU-RNP-Y-RWY-27"),
        ("  foo__bar  baz.PDF", "FOO-BAR-BAZ"),
        (
            "https://example.com/aip/charts/VAAU-RNP-Y-RWY-27.pdf",
            "VAAU-RNP-Y-RWY-27",
        ),
        ("local/path/to/VAAU-RNP-Y-RWY-27.pdf", "VAAU-RNP-Y-RWY-27"),
        ("VAAU-RNP-Y-RWY-27-CODING.pdf", "VAAU-RNP-Y-RWY-27"),
        ("VAAU-RNP-Y-RWY-27-TABLES.pdf", "VAAU-RNP-Y-RWY-27"),
        ("VAAU-RNP-Y-RWY-27-CAT-A-B.pdf", "VAAU-RNP-Y-RWY-27"),
        ("VAAU-RNP-Y-RWY-27-FAS-DATA-PROFILE", "VAAU-RNP-Y-RWY-27"),
    ],
)
def test_normalize_chart_key(raw: str, expected: str) -> None:
    assert normalize_chart_key(raw) == expected


def test_normalize_chart_key_empty() -> None:
    assert normalize_chart_key("") == ""
    assert normalize_chart_key(None) == ""
    assert normalize_chart_key("   ") == ""
