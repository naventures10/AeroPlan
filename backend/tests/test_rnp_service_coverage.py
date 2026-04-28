from app.services.rnp_service import build_3d_paths


class MockRow:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


def test_extract_path_vector_legs():
    """Cover lines 457-480: Vector legs (CA, CF, etc.) with different distance formats."""
    proc_row = MockRow(id=1, name="TEST", airport_id="VABB", runway="09")

    # Leg 1: Regular fix
    leg1 = MockRow(
        lon=72.8,
        lat=18.9,
        altitude_numeric=5000,
        waypoint_ident="FIX1",
        path_descriptor="IF",
        role="IAF",
        source_serial="1",
        turn_direction=None,
    )

    # Leg 2: CA leg with explicit distance string
    leg2 = MockRow(
        lon=None,
        lat=None,
        altitude_numeric=6000,
        path_descriptor="CA",
        course="(90.0)",
        distance="5.5NM",
        waypoint_ident=None,
        role=None,
        source_serial="2",
        turn_direction=None,
    )

    # Leg 3: CF leg with invalid distance (triggers fallback)
    leg3 = MockRow(
        lon=None,
        lat=None,
        altitude_numeric=7000,
        path_descriptor="CF",
        course="(180.0)",
        distance="invalid",
        waypoint_ident=None,
        role=None,
        source_serial="3",
        turn_direction=None,
    )

    # Leg 4: VI leg with no distance (triggers altitude-based fallback)
    leg4 = MockRow(
        lon=None,
        lat=None,
        altitude_numeric=8000,
        path_descriptor="VI",
        course="(270.0)",
        distance=None,
        waypoint_ident=None,
        role=None,
        source_serial="4",
        turn_direction=None,
    )

    legs = [leg1, leg2, leg3, leg4]

    response = build_3d_paths(proc_row, legs)

    # Verify path was built
    assert len(response.approach_paths) > 0
    path = response.approach_paths[0].path
    # 1 (FIX1) + 1 (CA) + 1 (CF) + 1 (VI) = 4 points minimum
    assert len(path) >= 4

    # Check that points were projected
    # FIX1 is [72.8, 18.9]
    assert path[0][0] == 72.8
    assert path[0][1] == 18.9

    # CA leg should have projected from FIX1
    assert path[1][0] != 72.8 or path[1][1] != 18.9


def test_geometric_utilities():
    from app.services.rnp_service import haversine_nm, project_point

    # haversine_nm
    dist = haversine_nm(72.0, 18.0, 73.0, 18.0)
    assert dist > 50 and dist < 70

    # project_point
    p2 = project_point(72.0, 18.0, 90.0, 60.0)
    assert p2[0] > 72.0
    assert abs(p2[1] - 18.0) < 0.5
