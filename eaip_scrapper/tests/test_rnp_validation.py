from eaip_scrapper.validation.core.rnp_validator import RNPValidator


def test_rnp_validator_altitude_check():
    validator = RNPValidator()

    # Case 1: No altitude constraints -> FAILED
    proc_no_alt = {
        "procedure_name": "TEST_NO_ALT",
        "tabular_description": [
            {
                "serial_number": 10,
                "path_descriptor": "IF",
                "waypoint_identifier": "WPT1",
            },
            {
                "serial_number": 20,
                "path_descriptor": "TF",
                "waypoint_identifier": "WPT2",
                "distance": "5.0",
                "course": "090° M / 090° T",
            },
        ],
        "waypoints": [
            {"waypoint_id": "WPT1", "lat_dd": 15.0, "lon_dd": 75.0},
            {"waypoint_id": "WPT2", "lat_dd": 15.0, "lon_dd": 75.1},
        ],
    }
    res = validator.validate_procedure_data(proc_no_alt)
    assert not res["success"]
    assert any("No altitude constraints defined" in issue for issue in res["issues"])

    # Case 2: Has altitude constraints -> SUCCESS
    proc_with_alt = {
        "procedure_name": "TEST_WITH_ALT",
        "tabular_description": [
            {
                "serial_number": 10,
                "path_descriptor": "IF",
                "waypoint_identifier": "WPT1",
                "altitude": "@3000",
            },
            {
                "serial_number": 20,
                "path_descriptor": "TF",
                "waypoint_identifier": "WPT2",
                "distance": "5.0",
                "course": "090° M / 090° T",
            },
        ],
        "waypoints": [
            {"waypoint_id": "WPT1", "lat_dd": 15.0, "lon_dd": 75.0},
            {"waypoint_id": "WPT2", "lat_dd": 15.0, "lon_dd": 75.1},
        ],
    }
    res = validator.validate_procedure_data(proc_with_alt)
    assert res["success"]


def test_rnp_validator_holding_check():
    validator = RNPValidator()

    # Case 1: Holding leg missing parameters -> FAILED
    proc_missing_hold = {
        "procedure_name": "TEST_HOLD_MISSING",
        "tabular_description": [
            {
                "serial_number": 10,
                "path_descriptor": "IF",
                "waypoint_identifier": "WPT1",
                "altitude": "@3000",
            },
            {
                "serial_number": 20,
                "path_descriptor": "TF",
                "waypoint_identifier": "WPT2",
                "distance": "5.0",
                "course": "090° M / 090° T",
            },
            {
                "serial_number": 30,
                "path_descriptor": "HM",
                # missing waypoint, course, turn, distance
            },
        ],
        "waypoints": [
            {"waypoint_id": "WPT1", "lat_dd": 15.0, "lon_dd": 75.0},
            {"waypoint_id": "WPT2", "lat_dd": 15.0, "lon_dd": 75.1},
        ],
    }
    res = validator.validate_procedure_data(proc_missing_hold)
    assert not res["success"]
    # Check that it identifies missing params
    issue = [iss for iss in res["issues"] if "Holding pattern (HM) is missing parameters" in iss]
    assert len(issue) > 0
    assert "waypoint_identifier" in issue[0]
    assert "course" in issue[0]
    assert "turn_direction" in issue[0]
    assert "distance/time" in issue[0]

    # Case 2: Holding leg complete -> SUCCESS
    proc_complete_hold = {
        "procedure_name": "TEST_HOLD_COMPLETE",
        "tabular_description": [
            {
                "serial_number": 10,
                "path_descriptor": "IF",
                "waypoint_identifier": "WPT1",
                "altitude": "@3000",
            },
            {
                "serial_number": 20,
                "path_descriptor": "TF",
                "waypoint_identifier": "WPT2",
                "distance": "5.0",
                "course": "090° M / 090° T",
            },
            {
                "serial_number": 30,
                "path_descriptor": "HM",
                "waypoint_identifier": "WPT2",
                "course": "090° M / 090° T",
                "turn_direction": "R",
                "distance": "1 MIN",
            },
        ],
        "waypoints": [
            {"waypoint_id": "WPT1", "lat_dd": 15.0, "lon_dd": 75.0},
            {"waypoint_id": "WPT2", "lat_dd": 15.0, "lon_dd": 75.1},
        ],
    }
    res = validator.validate_procedure_data(proc_complete_hold)
    assert res["success"], f"Expected success but got: {res['issues']}"
