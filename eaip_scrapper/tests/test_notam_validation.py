from datetime import datetime

import pytest
from pydantic import ValidationError

from eaip_scrapper.validation.core.central_validator import ValidationRouter
from eaip_scrapper.validation.schemas.database.notams import NotamDatabaseRecord


def test_valid_notam_record():
    valid_data = {
        "notam_id": "A1234/26",
        "source_file": "Chennai_A_2026_03.md",
        "series": "A",
        "scope": "INT_L",
        "fir": "VOMF",
        "combined_fir": None,
        "airport_icao": "VOMF",
        "valid_from": datetime(2026, 3, 1, 10, 0),
        "valid_to": datetime(2026, 3, 15, 18, 0),
        "is_permanent": False,
        "is_estimated": False,
        "duration_category": "TEMPORARY",
        "description": "AIRSPACE RESERVATION ACTIVE DUE TO DEFENCE EXERCISE.",
        "raw_json": {"source": "Chennai_A_2026_03.md"},
    }

    record = NotamDatabaseRecord(**valid_data)
    assert record.notam_id == "A1234/26"
    assert record.fir == "VOMF"
    assert record.is_permanent is False


def test_invalid_notam_id():
    invalid_data = {
        "notam_id": "A123/26",  # Only 3 digits, should fail
        "source_file": "Chennai_A_2026_03.md",
        "series": "A",
        "scope": "INT_L",
        "description": "Valid description",
        "valid_from": datetime.now(),
    }
    with pytest.raises(ValidationError) as excinfo:
        NotamDatabaseRecord(**invalid_data)
    assert "Invalid NOTAM ID format" in str(excinfo.value)


def test_empty_description():
    invalid_data = {
        "notam_id": "A1234/26",
        "source_file": "Chennai_A_2026_03.md",
        "series": "A",
        "scope": "INT_L",
        "description": "   ",  # Empty/whitespace description
        "valid_from": datetime.now(),
    }
    with pytest.raises(ValidationError) as excinfo:
        NotamDatabaseRecord(**invalid_data)
    assert "description cannot be empty" in str(excinfo.value)


def test_permanent_notam_without_valid_from():
    # Permanent NOTAM can skip valid_from (though it's better to have one, logic allows it)
    valid_data = {
        "notam_id": "A1234/26",
        "source_file": "Chennai_A_2026_03.md",
        "series": "A",
        "scope": "INT_L",
        "is_permanent": True,
        "valid_from": None,
        "valid_to": datetime(2099, 12, 31, 23, 59),
        "description": "PERMANENT OBSTACLE ERECTED.",
    }
    record = NotamDatabaseRecord(**valid_data)
    assert record.is_permanent is True


def test_non_permanent_notam_without_valid_from():
    invalid_data = {
        "notam_id": "A1234/26",
        "source_file": "Chennai_A_2026_03.md",
        "series": "A",
        "scope": "INT_L",
        "is_permanent": False,
        "valid_from": None,
        "description": "TEMPORARY OBSTACLE ERECTED.",
    }
    with pytest.raises(ValidationError) as excinfo:
        NotamDatabaseRecord(**invalid_data)
    assert "Non-permanent NOTAM must have a valid_from timestamp" in str(excinfo.value)


def test_invalid_icao():
    invalid_data = {
        "notam_id": "A1234/26",
        "source_file": "Chennai_A_2026_03.md",
        "series": "A",
        "scope": "INT_L",
        "fir": "VOX",  # Too short
        "description": "Valid description",
        "valid_from": datetime.now(),
    }
    with pytest.raises(ValidationError) as excinfo:
        NotamDatabaseRecord(**invalid_data)
    assert "Invalid 4-character ICAO code" in str(excinfo.value)


def test_raw_markdown_validator():
    router = ValidationRouter()

    # Valid markdown with some table elements and a NOTAM ID
    valid_md = """
    # Chennai NOTAMs
    Some random text

    | Column 1 | Column 2 |
    |---|---|
    | A1234/26 | Row 2 |
    """ + ("\n| Row X | Row Y |\n" * 50)

    assert router.validate_raw_markdown(valid_md, "test_file.md") is True

    # Too short
    assert router.validate_raw_markdown("Short content", "test_file.md") is False

    # No tables/lists
    long_plain_text = (
        "This is a very long plain text with absolutely no table tags, no rows, no pipes or columns, repeating words to reach one thousand characters limit. "
        * 20
    )
    assert router.validate_raw_markdown(long_plain_text, "test_file.md") is False

    # Under strict mode, even minor corruption (e.g., 1 corrupted timestamp) is rejected (0% tolerance)
    minor_corruption_md = """
    # Chennai NOTAMs
    Some random text

    | Column 1 | Column 2 |
    |---|---|
    | A1234/26 | 26033110630/2606231130 |
    """ + "".join(f"\n| A{i:04d}/26 | 2604010000/2607010000 |\n" for i in range(1235, 1260))

    assert router.validate_raw_markdown(minor_corruption_md, "test_file.md") is False

    # Systemic corruption (>5% of timestamps corrupted) should fail strict mode
    systemic_corruption_md = """
    # Chennai NOTAMs
    Some random text

    | Column 1 | Column 2 |
    |---|---|
    | A1234/26 | 26033110630/2606231130 |
    | A1235/26 | 26033110630/2606231130 |
    | A1236/26 | 2604010000/2607010000 |
    | A1237/26 | 2604020000/2607020000 |
    | A1238/26 | 2604030000/2607030000 |
    """ + ("\n| Row X | Row Y |\n" * 50)
    assert router.validate_raw_markdown(systemic_corruption_md, "test_file.md") is False

    # Lenient mode (strict=False) should accept even systemic corruption
    assert (
        router.validate_raw_markdown(systemic_corruption_md, "test_file.md", strict=False) is True
    )

    # Missing NOTAM IDs should fail even in lenient mode
    no_notam_ids_md = """
    # Chennai NOTAMs
    Some random text

    | Column 1 | Column 2 |
    |---|---|
    | Row 1 | 2604010000/2607010000 |
    """ + ("\n| Row X | Row Y |\n" * 50)
    assert router.validate_raw_markdown(no_notam_ids_md, "test_file.md", strict=False) is False
