"""Tests for ENR 4.4 Significant Points validation schemas."""

import pytest
from pydantic import ValidationError

from eaip_scrapper.validation.schemas.database.significant_points import (
    SignificantPointRecord,
    SignificantPointsDatabaseValidator,
)
from eaip_scrapper.validation.schemas.ingest.enr_4_4 import (
    ENR44SignificantPointsDocumentIngest,
    SignificantPointIngest,
)

# =====================================================================
# Ingest Schema Tests
# =====================================================================


class TestSignificantPointIngest:
    def test_valid_point(self):
        point = SignificantPointIngest(
            waypoint="AKTIM",
            coordinates="235325N 0911419E",
            routes=["A201", "W15"],
        )
        assert point.waypoint == "AKTIM"
        assert len(point.routes) == 2

    def test_minimal_point(self):
        point = SignificantPointIngest(waypoint="FIX01")
        assert point.coordinates == ""
        assert point.routes == []


class TestENR44SignificantPointsDocumentIngest:
    def test_valid_document(self):
        doc = ENR44SignificantPointsDocumentIngest(
            source_url="https://example.com/IN-ENR-4.4.html",
            significant_points=[{"waypoint": "AKTIM"}],
            total_count=1,
        )
        assert doc.total_count == 1

    def test_count_mismatch_rejected(self):
        with pytest.raises(ValidationError, match="total_count"):
            ENR44SignificantPointsDocumentIngest(
                source_url="https://example.com/IN-ENR-4.4.html",
                significant_points=[],
                total_count=5,
            )


# =====================================================================
# Database Schema Tests
# =====================================================================


class TestSignificantPointRecord:
    def test_valid_record(self):
        record = SignificantPointRecord(
            waypoint_name="AKTIM",
            routes=["A201"],
            raw_coordinates="235325N 0911419E",
            geom="SRID=4326;POINT(91.238611 23.890278)",
        )
        assert record.geom is not None

    def test_valid_record_without_geom(self):
        record = SignificantPointRecord(
            waypoint_name="AKTIM",
            raw_coordinates="235325N 0911419E",
        )
        assert record.geom is None

    def test_empty_waypoint_name_rejected(self):
        with pytest.raises(ValidationError, match="cannot be empty"):
            SignificantPointRecord(waypoint_name="   ", raw_coordinates="")

    def test_invalid_waypoint_name_format_rejected(self):
        with pytest.raises(ValidationError, match="Invalid waypoint name format"):
            SignificantPointRecord(waypoint_name="A12", raw_coordinates="")  # Has numbers

        with pytest.raises(ValidationError, match="Invalid waypoint name format"):
            SignificantPointRecord(waypoint_name="aktim", raw_coordinates="")  # Lowercase

        with pytest.raises(ValidationError, match="Invalid waypoint name format"):
            SignificantPointRecord(waypoint_name="AK", raw_coordinates="")  # Too short

        with pytest.raises(ValidationError, match="Invalid waypoint name format"):
            SignificantPointRecord(waypoint_name="AKTIMA", raw_coordinates="")  # Too long

    def test_invalid_ewkt_rejected(self):
        with pytest.raises(ValidationError, match="Invalid EWKT"):
            SignificantPointRecord(
                waypoint_name="AKTIM",
                raw_coordinates="235325N 0911419E",
                geom="POINT(91.238 23.89)",  # Missing SRID prefix
            )


# =====================================================================
# Database Validator Convenience Class Tests
# =====================================================================


class TestSignificantPointsDatabaseValidator:
    def test_validate_point_params(self):
        record = SignificantPointsDatabaseValidator.validate_point_params(
            ("AKTIM", ["A201"], "235325N 0911419E", "SRID=4326;POINT(91.238611 23.890278)")
        )
        assert record.waypoint_name == "AKTIM"
        assert len(record.routes) == 1

    def test_validate_point_params_wrong_length(self):
        with pytest.raises(ValueError, match="Expected 4"):
            SignificantPointsDatabaseValidator.validate_point_params(("AKTIM", ["A201"]))

    def test_validate_all_happy_path(self):
        points = [
            ("AKTIM", ["A201"], "235325N 0911419E", "SRID=4326;POINT(91.238611 23.890278)"),
            ("TADER", ["W15"], "240000N 0900000E", "SRID=4326;POINT(90.0 24.0)"),
        ]
        # Should not raise
        SignificantPointsDatabaseValidator.validate_all(points)

    def test_validate_all_catches_bad_record(self):
        points = [("A12", [], "", None)]  # Invalid name
        with pytest.raises(ValidationError):
            SignificantPointsDatabaseValidator.validate_all(points)
