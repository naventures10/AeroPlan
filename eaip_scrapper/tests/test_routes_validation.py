"""Tests for ENR 3 ATS Routes ingest and database validation schemas."""

import pytest
from pydantic import ValidationError

from eaip_scrapper.validation.schemas.database.ats_routes import (
    ATSRouteDatabaseValidator,
    ATSRouteRecord,
    ATSRouteSegmentRecord,
    ATSRouteWaypointRecord,
)
from eaip_scrapper.validation.schemas.ingest.enr_3_routes import (
    ENR3RoutesDocumentIngest,
    RouteIngest,
    RouteSegmentEntryIngest,
    RouteWaypointEntryIngest,
)

# =====================================================================
# Ingest Schema Tests
# =====================================================================


class TestRouteWaypointEntryIngest:
    def test_valid_waypoint(self):
        entry = RouteWaypointEntryIngest(
            waypoint_name="AKTIM",
            coordinates="DVOR/DME (AAT)\n235325N   0911419E",
        )
        assert entry.waypoint_name == "AKTIM"

    def test_minimal_waypoint(self):
        entry = RouteWaypointEntryIngest(waypoint_name="FIX01")
        assert entry.coordinates == ""

    def test_waypoint_with_segment_fields(self):
        """Waypoint dicts may carry segment-adjacent keys in messy data."""
        entry = RouteWaypointEntryIngest(
            waypoint_name="AKTIM",
            coordinates="235325N   0911419E",
            limits_class="FL 460\nFL 270\nClass E",
        )
        assert entry.limits_class is not None


class TestRouteSegmentEntryIngest:
    def test_valid_segment(self):
        entry = RouteSegmentEntryIngest(
            track_distance="282/102\n47.1 NM",
            limits_class="FL 460\nFL 270\nClass E\n10100 FT",
            lateral_limits="10 NM",
            direction_odd="ODD",
            direction_even="EVEN",
        )
        assert "47.1 NM" in entry.track_distance

    def test_segment_requires_track_distance(self):
        with pytest.raises(ValidationError):
            RouteSegmentEntryIngest()  # type: ignore[call-arg]


class TestRouteIngest:
    def test_valid_route(self):
        route = RouteIngest(
            route_id="A201",
            route_designator="A201 AKTIM - TADER",
            waypoints=[
                {"waypoint_name": "AKTIM", "coordinates": "235325N 0911419E"},
                {"track_distance": "282/102\n47.1 NM"},
                {"waypoint_name": "TADER", "coordinates": "240000N 0900000E"},
            ],
        )
        assert len(route.waypoints) == 3

    def test_empty_waypoints_rejected(self):
        with pytest.raises(ValidationError, match="empty waypoints"):
            RouteIngest(route_id="A201", waypoints=[])

    def test_validated_entries_parses_correctly(self):
        route = RouteIngest(
            route_id="W15",
            waypoints=[
                {"waypoint_name": "AKTIM", "coordinates": "235325N 0911419E"},
                {"track_distance": "282/102\n47.1 NM", "limits_class": "FL 460"},
                {"waypoint_name": "TADER", "coordinates": "240000N 0900000E"},
            ],
        )
        entries = route.validated_entries()
        assert len(entries) == 3
        assert isinstance(entries[0], RouteWaypointEntryIngest)
        assert isinstance(entries[1], RouteSegmentEntryIngest)
        assert isinstance(entries[2], RouteWaypointEntryIngest)


class TestENR3RoutesDocumentIngest:
    def test_valid_document(self):
        doc = ENR3RoutesDocumentIngest(
            metadata={
                "section": "ENR 3.1",
                "title": "CONVENTIONAL NAVIGATION ROUTES",
                "extracted_at": "2026-05-27T12:00:00+05:30",
                "airac_base_url": "https://aim-india.aai.aero/eaip-2605/",
            },
            routes=[
                {
                    "route_id": "A201",
                    "waypoints": [{"waypoint_name": "AKTIM"}],
                }
            ],
            total_count=1,
        )
        assert doc.total_count == 1

    def test_count_mismatch_rejected(self):
        with pytest.raises(ValidationError, match="total_count"):
            ENR3RoutesDocumentIngest(
                metadata={
                    "section": "ENR 3.1",
                    "title": "CONVENTIONAL NAVIGATION ROUTES",
                    "extracted_at": "2026-05-27T12:00:00+05:30",
                    "airac_base_url": "https://aim-india.aai.aero/eaip-2605/",
                },
                routes=[],
                total_count=5,
            )


# =====================================================================
# Database Schema Tests
# =====================================================================


class TestATSRouteRecord:
    def test_valid_route(self):
        record = ATSRouteRecord(
            route_id="A201",
            route_designator="A201 AKTIM - TADER",
            route_type="CONVENTIONAL",
            remarks="",
        )
        assert record.route_type == "CONVENTIONAL"

    def test_rnav_route(self):
        record = ATSRouteRecord(route_id="Q1", route_type="RNAV")
        assert record.route_type == "RNAV"

    def test_invalid_route_type_rejected(self):
        with pytest.raises(ValidationError):
            ATSRouteRecord(route_id="A201", route_type="RANDOM")  # type: ignore[arg-type]

    def test_empty_route_id_rejected(self):
        with pytest.raises(ValidationError, match="cannot be empty"):
            ATSRouteRecord(route_id="  ", route_type="CONVENTIONAL")

    def test_malformed_route_id_rejected(self):
        with pytest.raises(ValidationError, match="Invalid ATS route ID"):
            ATSRouteRecord(route_id="INVALID-ID-123", route_type="CONVENTIONAL")


class TestATSRouteWaypointRecord:
    def test_valid_waypoint_with_geom(self):
        record = ATSRouteWaypointRecord(
            route_id="A201",
            sequence_number=1,
            waypoint_name="AKTIM",
            raw_coordinates="235325N 0911419E",
            geom="SRID=4326;POINT(91.238611 23.890278)",
        )
        assert record.geom is not None

    def test_valid_waypoint_without_geom(self):
        record = ATSRouteWaypointRecord(
            route_id="A201",
            sequence_number=1,
            waypoint_name="AKTIM",
        )
        assert record.geom is None

    def test_zero_sequence_rejected(self):
        with pytest.raises(ValidationError):
            ATSRouteWaypointRecord(route_id="A201", sequence_number=0, waypoint_name="AKTIM")

    def test_negative_sequence_rejected(self):
        with pytest.raises(ValidationError):
            ATSRouteWaypointRecord(route_id="A201", sequence_number=-1, waypoint_name="AKTIM")

    def test_empty_waypoint_name_rejected(self):
        with pytest.raises(ValidationError, match="cannot be empty"):
            ATSRouteWaypointRecord(route_id="A201", sequence_number=1, waypoint_name="  ")

    def test_invalid_ewkt_rejected(self):
        with pytest.raises(ValidationError, match="Invalid EWKT"):
            ATSRouteWaypointRecord(
                route_id="A201",
                sequence_number=1,
                waypoint_name="AKTIM",
                geom="POINT(91.238 23.89)",  # Missing SRID prefix
            )


class TestATSRouteSegmentRecord:
    def test_valid_segment(self):
        record = ATSRouteSegmentRecord(
            route_id="A201",
            sequence_number=1,
            track_magnetic="282/102",
            distance_nm=47.1,
            upper_limit="FL 460",
            lower_limit="FL 270",
            airspace_class="E",
            moca="10100 FT",
        )
        assert record.distance_nm == 47.1

    def test_optional_fields_default_none(self):
        record = ATSRouteSegmentRecord(route_id="A201", sequence_number=1)
        assert record.track_magnetic is None
        assert record.distance_nm is None
        assert record.airspace_class is None

    def test_zero_distance_rejected(self):
        with pytest.raises(ValidationError):
            ATSRouteSegmentRecord(route_id="A201", sequence_number=1, distance_nm=0)

    def test_negative_distance_rejected(self):
        with pytest.raises(ValidationError):
            ATSRouteSegmentRecord(route_id="A201", sequence_number=1, distance_nm=-5.0)

    def test_invalid_airspace_class_rejected(self):
        with pytest.raises(ValidationError, match="Invalid airspace class"):
            ATSRouteSegmentRecord(route_id="A201", sequence_number=1, airspace_class="Z")

    def test_valid_airspace_classes(self):
        for cls in ("A", "B", "C", "D", "E", "F", "G"):
            record = ATSRouteSegmentRecord(route_id="A201", sequence_number=1, airspace_class=cls)
            assert record.airspace_class == cls


# =====================================================================
# Database Validator Convenience Class Tests
# =====================================================================


class TestATSRouteDatabaseValidator:
    def test_validate_route_params(self):
        record = ATSRouteDatabaseValidator.validate_route_params(
            ("A201", "A201 AKTIM - TADER", "CONVENTIONAL", "")
        )
        assert record.route_id == "A201"

    def test_validate_route_params_wrong_length(self):
        with pytest.raises(ValueError, match="Expected 4"):
            ATSRouteDatabaseValidator.validate_route_params(("A201", "CONVENTIONAL"))

    def test_validate_waypoint_params(self):
        record = ATSRouteDatabaseValidator.validate_waypoint_params(
            ("A201", 1, "AKTIM", "235325N 0911419E", None, "SRID=4326;POINT(91.238611 23.890278)")
        )
        assert record.sequence_number == 1

    def test_validate_waypoint_params_wrong_length(self):
        with pytest.raises(ValueError, match="Expected 6"):
            ATSRouteDatabaseValidator.validate_waypoint_params(("A201", 1, "AKTIM"))

    def test_validate_segment_params(self):
        record = ATSRouteDatabaseValidator.validate_segment_params(
            ("A201", 1, "282/102", 47.1, "FL 460", "FL 270", "E", "10100 FT", "10 NM", None, None)
        )
        assert record.distance_nm == 47.1

    def test_validate_segment_params_wrong_length(self):
        with pytest.raises(ValueError, match="Expected 11"):
            ATSRouteDatabaseValidator.validate_segment_params(("A201", 1))

    def test_validate_all_happy_path(self):
        routes = [("A201", "A201 AKTIM - TADER", "CONVENTIONAL", "")]
        waypoints = [
            ("A201", 1, "AKTIM", "235325N 0911419E", None, "SRID=4326;POINT(91.238611 23.890278)"),
            ("A201", 2, "TADER", "240000N 0900000E", None, "SRID=4326;POINT(90.0 24.0)"),
        ]
        segments = [
            ("A201", 1, "282/102", 47.1, "FL 460", "FL 270", "E", "10100 FT", "10 NM", None, None),
        ]
        # Should not raise
        ATSRouteDatabaseValidator.validate_all(routes, waypoints, segments)

    def test_validate_all_catches_bad_route(self):
        routes = [("", "designator", "CONVENTIONAL", "")]  # Empty route_id
        with pytest.raises(ValidationError):
            ATSRouteDatabaseValidator.validate_all(routes, [], [])
