from typing import Any

from app.services.rnp_service import (
    build_3d_paths,
    extract_altitude,
    extract_true_course,
    group_legs,
    haversine_nm,
    parse_serial,
    project_point,
    smooth_path_3d,
)


class DummyLeg:
    """Generic leg for mocking."""

    altitude_numeric: Any = None
    altitude_constraint: Any = None
    source_serial: Any = None
    path_descriptor: Any = None
    waypoint_ident: Any = None
    lon: Any = None
    lat: Any = None
    role: Any = None
    course: Any = None
    distance: Any = None
    turn_direction: Any = None

    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

    def __getattr__(self, name):
        return None


class DummyProc:
    """Generic procedure for mocking."""

    type: str | None = None

    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

    def __getattr__(self, name):
        return None


def test_haversine_nm():
    assert haversine_nm(0, 0, 0, 0) == 0.0
    dist = haversine_nm(0, 0, 1, 0)
    assert dist > 59.0 and dist < 61.0  # ~60 NM per degree


def test_extract_true_course():
    assert extract_true_course("299.41° Mag /297.66° True") == 297.66
    assert extract_true_course("266.94°(265.44°)") == 265.44
    assert extract_true_course("180") is None
    assert extract_true_course("invalid / also invalid") is None
    assert extract_true_course(None) is None
    assert extract_true_course("123.45°(invalid)") is None
    assert extract_true_course("123.45°(123.45°)") == 123.45


def test_extract_altitude():
    assert extract_altitude(DummyLeg(altitude_numeric=1000.0)) == 1000.0
    assert (
        extract_altitude(DummyLeg(altitude_numeric="invalid", altitude_constraint="+5100"))
        == 5100.0
    )
    assert extract_altitude(DummyLeg(altitude_constraint="FL150")) == 15000.0
    assert extract_altitude(DummyLeg(altitude_constraint="1000+")) == 1000.0
    assert extract_altitude(DummyLeg(altitude_constraint="invalid")) is None
    assert extract_altitude(DummyLeg()) is None

    class MissingAttr:
        def __init__(self):
            self.altitude_numeric = None
            self.altitude_constraint = None

    assert extract_altitude(MissingAttr()) is None
    assert extract_altitude(DummyLeg(altitude_numeric=-1.0)) is None

    class BadType:
        def __float__(self):
            raise TypeError()

    assert extract_altitude(DummyLeg(altitude_numeric=BadType())) is None


def test_project_point():
    lon, lat = project_point(0, 0, 90, 60)
    assert round(lon, 2) == 1.00
    assert round(lat, 2) == 0.0


def test_smooth_path_3d():
    # Too short path
    assert len(smooth_path_3d([[0.0, 0.0, 0.0], [1.0, 1.0, 1.0]])) == 2

    # Linear path
    path = [[0.0, 0.0, 0.0], [1.0, 0.0, 1000.0], [2.0, 0.0, 2000.0]]
    smoothed = smooth_path_3d(path, max_turn_dist_nm=2.5, steps=2)
    assert len(smoothed) > len(path)

    # Small turn
    path = [[0.0, 0.0, 0.0], [1.0, 0.0, 1000.0], [1.0, 1.0, 2000.0]]
    smoothed = smooth_path_3d(path, turn_directions=[None, "R", None])
    assert len(smoothed) > len(path)

    # U-turn (D-arc logic) CCW
    path = [[0.0, 0.0, 0.0], [1.0, 0.0, 1000.0], [0.1, 0.1, 2000.0]]
    smoothed = smooth_path_3d(path, max_turn_dist_nm=10.0, turn_directions=[None, "L", None])
    assert len(smoothed) > len(path)

    # U-turn (D-arc logic) CW
    path = [[0.0, 0.0, 0.0], [1.0, 0.0, 1000.0], [0.1, -0.1, 2000.0]]
    smoothed = smooth_path_3d(path, max_turn_dist_nm=10.0, turn_directions=[None, "R", None])
    assert len(smoothed) > len(path)

    # U-turn with forced direction "longer way"
    path = [[0.0, 0.0, 0.0], [1.0, 0.0, 1000.0], [0.1, 0.1, 2000.0]]
    # It naturally wants to go left (CCW) so forcing R makes it go the long way
    smoothed = smooth_path_3d(path, max_turn_dist_nm=10.0, turn_directions=[None, "R", None])
    assert len(smoothed) > len(path)

    # U-turn without forced direction
    path = [[0.0, 0.0, 0.0], [1.0, 0.0, 1000.0], [0.1, 0.1, 2000.0]]
    smoothed = smooth_path_3d(path, max_turn_dist_nm=10.0, turn_directions=[None, None, None])
    assert len(smoothed) > len(path)

    # U-turn without alt at end
    path = [[0.0, 0.0, 0.0], [1.0, 0.0, 1000.0], [0.1, 0.1, None]]
    smoothed = smooth_path_3d(path, max_turn_dist_nm=10.0, turn_directions=[None, None, None])  # type: ignore
    assert len(smoothed) > len(path)

    # Missing altitude at start
    path = [[0.0, 0.0, None], [1.0, 0.0, None], [2.0, 0.0, None]]
    smoothed = smooth_path_3d(path, turn_directions=[None, None, None])  # type: ignore
    assert len(smoothed) > len(path)

    # 0 distance path elements
    path = [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0], [0.0, 0.0, 0.0]]
    smoothed = smooth_path_3d(path)
    assert len(smoothed) > len(path)


def test_smooth_path_3d_exceptions():
    # Force lines 500, 504, 522
    path = [[0.0, 0.0, 0.0], [1.0, 0.0, 0.0]]
    smoothed = smooth_path_3d(path)  # < 3 points
    assert len(smoothed) == 2


def test_parse_serial():
    assert parse_serial("10") == 10
    assert parse_serial(" 20 ") == 20
    assert parse_serial(None) == 999
    assert parse_serial("") == 999
    assert parse_serial("invalid") == 999


def test_group_legs():
    # Basic split
    legs = [
        DummyLeg(source_serial="10", path_descriptor="IF", waypoint_ident="WPT1"),
        DummyLeg(source_serial="20", path_descriptor="TF", waypoint_ident="WPT2"),
        DummyLeg(source_serial="10", path_descriptor="IF", waypoint_ident="WPT3"),
        DummyLeg(source_serial="20", path_descriptor="TF", waypoint_ident="WPT2"),
    ]
    groups = group_legs(legs)
    assert len(groups) == 2

    # Split IF but same serial
    legs = [
        DummyLeg(source_serial="10", path_descriptor="IF", waypoint_ident="WPT1"),
        DummyLeg(source_serial="10", path_descriptor="IF", waypoint_ident="WPT2"),
    ]
    groups = group_legs(legs)
    assert len(groups) == 2

    # Split same serial
    legs = [
        DummyLeg(source_serial="10", path_descriptor="TF", waypoint_ident="W1"),
        DummyLeg(source_serial="10", path_descriptor="TF", waypoint_ident="W2"),
    ]
    groups = group_legs(legs)
    assert len(groups) == 2

    # Invalid serial
    legs = [
        DummyLeg(source_serial="invalid", path_descriptor="TF", waypoint_ident="WPT4"),
        DummyLeg(source_serial="10", path_descriptor="TF", waypoint_ident="WPT2"),
        DummyLeg(source_serial="20", path_descriptor="TF", waypoint_ident="WPT3"),
        DummyLeg(source_serial="invalid", path_descriptor="TF", waypoint_ident="WPT4"),
    ]
    groups = group_legs(legs)
    assert len(groups) == 1

    legs = [
        DummyLeg(source_serial="10", path_descriptor="TF", waypoint_ident="W1"),
        DummyLeg(source_serial="5", path_descriptor="TF", waypoint_ident="W2"),  # splits
        DummyLeg(
            source_serial="5", path_descriptor="TF", waypoint_ident="W3"
        ),  # splits again because 5 <= 5
    ]
    groups = group_legs(legs)
    assert len(groups) == 3


def test_build_3d_paths():
    class DictLeg(dict):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)

        def __getattr__(self, name):
            if name == "turn_direction":
                raise AttributeError()
            return self.get(name)

    proc = DummyProc(id=1, name="TEST", type="STAR", airport_id="TEST", runway="09")

    # 1. No waypoints
    res = build_3d_paths(proc, [])
    assert len(res.approach_paths) == 0

    # 2. No path3d
    res = build_3d_paths(
        proc,
        [
            DummyLeg(
                source_serial="10",
                path_descriptor="IF",
                waypoint_ident="START",
                lon=None,
                lat=None,
                role="IF",
            )
        ],
    )
    assert len(res.approach_paths) == 0

    # 3. Simple straight path
    legs = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            altitude_numeric=1000.0,
            role="IF",
        ),
        DummyLeg(
            source_serial="20", path_descriptor="TF", waypoint_ident="MID", lon=1, lat=0, role="TF"
        ),
        DummyLeg(
            source_serial="30",
            path_descriptor="TF",
            waypoint_ident="END",
            lon=2,
            lat=0,
            altitude_numeric=3000.0,
            role="TF",
        ),
    ]
    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) == 1
    assert len(res.waypoints) == 3

    # 4. Only final (with extra point for >=2)
    legs = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            altitude_numeric=1000.0,
            role="IF",
        ),
        DummyLeg(
            source_serial="20", path_descriptor="TF", waypoint_ident="RW09", lon=1, lat=0, role="TF"
        ),
        DummyLeg(
            source_serial="30", path_descriptor="TF", waypoint_ident="END", lon=2, lat=0, role="TF"
        ),
    ]
    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) == 1

    # 5. Complex ident
    legs = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="SAME",
            lon=0,
            lat=0,
            altitude_numeric=1000.0,
            role="IF",
        ),
        DummyLeg(
            source_serial="20", path_descriptor="TF", waypoint_ident="MID", lon=1, lat=0, role="TF"
        ),
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="SAME",
            lon=1,
            lat=0,
            altitude_numeric=1000.0,
            role="IF",
        ),
        DummyLeg(
            source_serial="20", path_descriptor="TF", waypoint_ident="MID2", lon=2, lat=0, role="TF"
        ),
    ]
    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) == 2
    assert res.approach_paths[1].entry_waypoint == "SAME-2"

    # 6. HM filtering
    legs = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            role="IF",
        ),
        DummyLeg(
            source_serial="20", path_descriptor="IF", waypoint_ident="RW09", lon=1, lat=0, role="IF"
        ),
        DummyLeg(
            source_serial="30", path_descriptor="TF", waypoint_ident="MID", lon=2, lat=0, role="TF"
        ),
        DummyLeg(
            source_serial="10", path_descriptor="HM", waypoint_ident="HOLD", lon=3, lat=0, role="HM"
        ),
        DummyLeg(
            source_serial="20",
            path_descriptor="TF",
            waypoint_ident="AFTER_HOLD",
            lon=4,
            lat=0,
            role="TF",
        ),
    ]
    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) >= 1

    # 7. Initial pos
    proc.type = "SID"
    legs = [
        DummyLeg(
            source_serial="10", path_descriptor="IF", waypoint_ident="RW09", lon=0, lat=0, role="IF"
        ),
        DummyLeg(
            source_serial="20", path_descriptor="TF", waypoint_ident="MID", lon=1, lat=0, role="TF"
        ),
        DummyLeg(
            source_serial="30", path_descriptor="TF", waypoint_ident="END", lon=2, lat=0, role="TF"
        ),
    ]
    res = build_3d_paths(proc, legs, runway_threshold=[10, 10])
    assert res.approach_paths[0].path[0][0] == 10

    # 8. SID specific
    legs = [
        DummyLeg(
            source_serial="10",
            path_descriptor="CF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            role="IF",
        ),
        DummyLeg(
            source_serial="20",
            path_descriptor="TF",
            waypoint_ident="EXIT",
            lon=1,
            lat=0,
            altitude_numeric=10000.0,
            role="TF",
        ),
    ]
    res = build_3d_paths(proc, legs)
    assert res.approach_paths[0].entry_waypoint == "EXIT"

    # 9. Missing branches and dict test
    proc.type = "STAR"
    d_leg = DictLeg(
        {
            "source_serial": "70",
            "path_descriptor": "TF",
            "waypoint_ident": "END",
            "lon": 2,
            "lat": 0,
            "altitude_numeric": None,
            "altitude_constraint": None,
            "role": None,
            "course": None,
            "distance": None,
            "turn_direction": "L",
        }
    )
    legs = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="W1",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=100.0,
        ),
        DummyLeg(
            source_serial="20",
            path_descriptor="IF",
            waypoint_ident="W1",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=1000.0,
        ),
        DummyLeg(
            source_serial="25",
            path_descriptor="IF",
            waypoint_ident="W1",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=None,
        ),
        DummyLeg(
            source_serial="30",
            path_descriptor="CA",
            waypoint_ident="W2",
            lon=None,
            lat=None,
            course="090°",
            distance="invalid",
        ),
        DummyLeg(
            source_serial="40",
            path_descriptor="CA",
            waypoint_ident="W3",
            lon=None,
            lat=None,
            altitude_numeric=3000.0,
            course="090°",
            distance=None,
        ),
        DummyLeg(
            source_serial="50",
            path_descriptor="CA",
            waypoint_ident="W4",
            lon=None,
            lat=None,
            altitude_numeric=1000.0,
            course="090°",
            distance=None,
        ),
        DummyLeg(
            source_serial="60",
            path_descriptor="TF",
            waypoint_ident="RW09",
            lon=1,
            lat=0,
            role="TF",
            altitude_numeric=None,
        ),
        d_leg,
    ]
    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) >= 1

    # 10. Empty dist_nm
    legs = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=1000.0,
        ),
        DummyLeg(
            source_serial="20",
            path_descriptor="TF",
            waypoint_ident="W1",
            lon=0,
            lat=0,
            role="TF",
            altitude_numeric=None,
        ),
        DummyLeg(
            source_serial="30",
            path_descriptor="TF",
            waypoint_ident="RW09",
            lon=1,
            lat=0,
            role="TF",
            altitude_numeric=1000.0,
        ),
        DummyLeg(
            source_serial="40",
            path_descriptor="TF",
            waypoint_ident="END",
            lon=2,
            lat=0,
            role="TF",
            altitude_numeric=1000.0,
        ),
    ]
    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) >= 1

    # 11. Missed Approach
    legs = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="RW09",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=1000.0,
        ),
        DummyLeg(
            source_serial="20",
            path_descriptor="TF",
            waypoint_ident="W1",
            lon=0,
            lat=0,
            role="TF",
            altitude_numeric=None,
        ),
        DummyLeg(
            source_serial="30",
            path_descriptor="TF",
            waypoint_ident="W2",
            lon=0,
            lat=0,
            role="TF",
            altitude_numeric=2000.0,
        ),
        DummyLeg(
            source_serial="40",
            path_descriptor="TF",
            waypoint_ident="W3",
            lon=1,
            lat=0,
            role="TF",
            altitude_numeric=3000.0,
        ),
    ]
    res = build_3d_paths(proc, legs)
    assert res.missed_approach_path is not None


def test_extract_path_more_branches_final():
    proc = DummyProc(id=1, name="TEST", type="STAR", airport_id="TEST", runway="09")

    # 4. Only final (with extra point for >=2) and specific names so process_path succeeds
    legs = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            altitude_numeric=1000.0,
            role="IF",
        ),
        DummyLeg(
            source_serial="20", path_descriptor="TF", waypoint_ident="RW09", lon=1, lat=0, role="TF"
        ),
        DummyLeg(
            source_serial="30", path_descriptor="TF", waypoint_ident="END", lon=2, lat=0, role="TF"
        ),
    ]
    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) == 1


def test_extract_path_more_branches14():
    proc = DummyProc(id=1, name="TEST", type="STAR", airport_id="TEST", runway="09")

    # Hit 447, 453-476
    legs = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=1000.0,
        ),
        DummyLeg(
            source_serial="20",
            path_descriptor="CA",
            waypoint_ident="W1",
            lon=None,
            lat=None,
            course="090°",
            distance="10NM",
        ),
        DummyLeg(
            source_serial="30",
            path_descriptor="CA",
            waypoint_ident="W2",
            lon=None,
            lat=None,
            course="090°",
            distance=None,
            altitude_numeric=2000.0,
        ),  # dist=None, climb > 0
        DummyLeg(
            source_serial="40",
            path_descriptor="CA",
            waypoint_ident="W3",
            lon=None,
            lat=None,
            course="invalid",
            distance=None,
        ),  # invalid course
        DummyLeg(
            source_serial="50",
            path_descriptor="CA",
            waypoint_ident="W4",
            lon=None,
            lat=None,
            course=None,
            distance=None,
        ),  # none course
        DummyLeg(
            source_serial="60",
            path_descriptor="TF",
            waypoint_ident="RW09",
            lon=1,
            lat=0,
            role="TF",
            altitude_numeric=3000.0,
        ),
    ]

    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) >= 1

    # hit missing dist logic where no prev alt exists
    legs2 = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=None,
        ),
        DummyLeg(
            source_serial="20",
            path_descriptor="CA",
            waypoint_ident="W1",
            lon=None,
            lat=None,
            course="090°",
            distance="invalid",
            altitude_numeric=2000.0,
        ),
        DummyLeg(
            source_serial="30",
            path_descriptor="TF",
            waypoint_ident="RW09",
            lon=1,
            lat=0,
            role="TF",
            altitude_numeric=3000.0,
        ),
    ]
    res2 = build_3d_paths(proc, legs2)
    assert len(res2.approach_paths) >= 1


def test_extract_path_remaining_branches():
    class DictLeg(dict):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)

        def __getattr__(self, name):
            if name == "turn_direction":
                raise AttributeError()
            return self.get(name)

    proc = DummyProc(id=1, name="TEST", type="STAR", airport_id="TEST", runway="09")

    # Hit 429
    d_leg = DictLeg(
        {
            "source_serial": "70",
            "path_descriptor": "TF",
            "waypoint_ident": "END",
            "lon": 2,
            "lat": 0,
            "altitude_numeric": None,
            "altitude_constraint": None,
            "role": None,
            "course": None,
            "distance": None,
            "turn_direction": "L",
        }
    )

    legs = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="W1",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=100.0,
        ),
        DummyLeg(
            source_serial="20",
            path_descriptor="IF",
            waypoint_ident="W1",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=1000.0,
        ),
        DummyLeg(
            source_serial="25",
            path_descriptor="IF",
            waypoint_ident="W1",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=None,
        ),
        DummyLeg(
            source_serial="30",
            path_descriptor="CA",
            waypoint_ident="W2",
            lon=None,
            lat=None,
            course="090°",
            distance="invalid",
        ),
        DummyLeg(
            source_serial="40",
            path_descriptor="CA",
            waypoint_ident="W3",
            lon=None,
            lat=None,
            altitude_numeric=3000.0,
            course="090°",
            distance=None,
        ),
        DummyLeg(
            source_serial="50",
            path_descriptor="CA",
            waypoint_ident="W4",
            lon=None,
            lat=None,
            altitude_numeric=1000.0,
            course="090°",
            distance=None,
        ),
        DummyLeg(
            source_serial="60",
            path_descriptor="TF",
            waypoint_ident="RW09",
            lon=1,
            lat=0,
            role="TF",
            altitude_numeric=None,
        ),
        d_leg,
    ]
    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) >= 1

    # Hit 500, 518
    legs = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=1000.0,
        ),
        DummyLeg(
            source_serial="20",
            path_descriptor="TF",
            waypoint_ident="W1",
            lon=0,
            lat=0,
            role="TF",
            altitude_numeric=None,
        ),
        DummyLeg(
            source_serial="30",
            path_descriptor="TF",
            waypoint_ident="RW09",
            lon=1,
            lat=0,
            role="TF",
            altitude_numeric=1000.0,
        ),
        # Provide valid extra point to return something
        DummyLeg(
            source_serial="40",
            path_descriptor="TF",
            waypoint_ident="END",
            lon=2,
            lat=0,
            role="TF",
            altitude_numeric=1000.0,
        ),
    ]

    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) >= 1


def test_extract_path_more_branches_dist_0():
    proc = DummyProc(id=1, name="TEST", type="STAR", airport_id="TEST", runway="09")

    # Hit 518 exactly: distance 0 between previous and current
    legs = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=1000.0,
        ),
        DummyLeg(
            source_serial="20",
            path_descriptor="TF",
            waypoint_ident="W1",
            lon=0,
            lat=0,
            role="TF",
            altitude_numeric=None,
        ),  # same coordinates, dist=0
        DummyLeg(
            source_serial="30",
            path_descriptor="TF",
            waypoint_ident="W2",
            lon=0,
            lat=0,
            role="TF",
            altitude_numeric=2000.0,
        ),  # same coordinates
        DummyLeg(
            source_serial="40",
            path_descriptor="TF",
            waypoint_ident="RW09",
            lon=1,
            lat=0,
            role="TF",
            altitude_numeric=1000.0,
        ),
        DummyLeg(
            source_serial="50",
            path_descriptor="TF",
            waypoint_ident="END",
            lon=2,
            lat=0,
            role="TF",
            altitude_numeric=1000.0,
        ),
    ]

    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) >= 1


def test_extract_path_more_branches_dist_0_in_missed():
    proc = DummyProc(id=1, name="TEST", type="STAR", airport_id="TEST", runway="09")

    # Hit 518 exactly: distance 0 between previous and current
    legs = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=1000.0,
        ),
        DummyLeg(
            source_serial="20",
            path_descriptor="TF",
            waypoint_ident="RW09",
            lon=1,
            lat=0,
            role="TF",
            altitude_numeric=None,
        ),
        DummyLeg(
            source_serial="30",
            path_descriptor="TF",
            waypoint_ident="W2",
            lon=2,
            lat=0,
            role="TF",
            altitude_numeric=2000.0,
        ),
        DummyLeg(
            source_serial="40",
            path_descriptor="TF",
            waypoint_ident="W3",
            lon=2,
            lat=0,
            role="TF",
            altitude_numeric=None,
        ),  # same coordinates, dist=0
        DummyLeg(
            source_serial="50",
            path_descriptor="TF",
            waypoint_ident="END",
            lon=2,
            lat=0,
            role="TF",
            altitude_numeric=1000.0,
        ),  # same coordinates, dist=0
    ]

    res = build_3d_paths(proc, legs)
    assert res.missed_approach_path is not None


def test_extract_path_more_branches_dist_0_missed_2():
    proc = DummyProc(id=1, name="TEST", type="STAR", airport_id="TEST", runway="09")

    # Hit 518 exactly: distance 0 between previous and current
    legs = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=1000.0,
        ),
        DummyLeg(
            source_serial="20",
            path_descriptor="TF",
            waypoint_ident="RW09",
            lon=1,
            lat=0,
            role="TF",
            altitude_numeric=None,
        ),
        DummyLeg(
            source_serial="30",
            path_descriptor="TF",
            waypoint_ident="W2",
            lon=2,
            lat=0,
            role="TF",
            altitude_numeric=2000.0,
        ),
        DummyLeg(
            source_serial="40",
            path_descriptor="TF",
            waypoint_ident="W3",
            lon=2,
            lat=0,
            role="TF",
            altitude_numeric=None,
        ),  # same coordinates, dist=0
        DummyLeg(
            source_serial="50",
            path_descriptor="TF",
            waypoint_ident="END",
            lon=3,
            lat=0,
            role="TF",
            altitude_numeric=1000.0,
        ),  # diff coordinates
    ]

    res = build_3d_paths(proc, legs)
    assert res.missed_approach_path is not None


def test_extract_path_interpolate_more():
    proc = DummyProc(id=1, name="TEST", type="STAR", airport_id="TEST", runway="09")

    # Hit lines 496, 500 (multiple missing alts leading up to known)
    legs = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="RW09",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=1000.0,
        ),
        DummyLeg(
            source_serial="20",
            path_descriptor="TF",
            waypoint_ident="W1",
            lon=1,
            lat=0,
            role="TF",
            altitude_numeric=None,
        ),
        DummyLeg(
            source_serial="30",
            path_descriptor="TF",
            waypoint_ident="W2",
            lon=2,
            lat=0,
            role="TF",
            altitude_numeric=None,
        ),
        DummyLeg(
            source_serial="40",
            path_descriptor="TF",
            waypoint_ident="END",
            lon=3,
            lat=0,
            role="TF",
            altitude_numeric=1000.0,
        ),
    ]
    res = build_3d_paths(proc, legs)
    assert res.missed_approach_path is not None


def test_extract_path_more_branches_dist_0_missed_3():
    proc = DummyProc(id=1, name="TEST", type="STAR", airport_id="TEST", runway="09")

    # Hit 518 exactly: distance 0 between previous and current
    legs = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=1000.0,
        ),
        DummyLeg(
            source_serial="20",
            path_descriptor="TF",
            waypoint_ident="RW09",
            lon=1,
            lat=0,
            role="TF",
            altitude_numeric=None,
        ),
        DummyLeg(
            source_serial="30",
            path_descriptor="TF",
            waypoint_ident="W2",
            lon=2,
            lat=0,
            role="TF",
            altitude_numeric=1000.0,
        ),
        DummyLeg(
            source_serial="40",
            path_descriptor="TF",
            waypoint_ident="W3",
            lon=2,
            lat=0,
            role="TF",
            altitude_numeric=None,
        ),  # same coordinates, dist=0
        DummyLeg(
            source_serial="45",
            path_descriptor="TF",
            waypoint_ident="W4",
            lon=2,
            lat=0,
            role="TF",
            altitude_numeric=None,
        ),  # same coordinates, dist=0
        DummyLeg(
            source_serial="50",
            path_descriptor="TF",
            waypoint_ident="END",
            lon=2,
            lat=0,
            role="TF",
            altitude_numeric=2000.0,
        ),  # same coordinates
    ]

    res = build_3d_paths(proc, legs)
    assert res.missed_approach_path is not None


def test_extract_path_more_branches_dist_0_missed_4():
    proc = DummyProc(id=1, name="TEST", type="STAR", airport_id="TEST", runway="09")

    legs = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=1000.0,
        ),
        DummyLeg(
            source_serial="20",
            path_descriptor="TF",
            waypoint_ident="RW09",
            lon=1,
            lat=0,
            role="TF",
            altitude_numeric=None,
        ),
        DummyLeg(
            source_serial="30",
            path_descriptor="TF",
            waypoint_ident="W2",
            lon=2,
            lat=0,
            role="TF",
            altitude_numeric=2000.0,
        ),
        DummyLeg(
            source_serial="40",
            path_descriptor="TF",
            waypoint_ident="W3",
            lon=2,
            lat=0,
            role="TF",
            altitude_numeric=None,
        ),  # dist 0 here
        DummyLeg(
            source_serial="50",
            path_descriptor="TF",
            waypoint_ident="END",
            lon=2,
            lat=0,
            role="TF",
            altitude_numeric=1000.0,
        ),  # diff alt
    ]

    res = build_3d_paths(proc, legs)
    assert res.missed_approach_path is not None


def test_extract_path_more_branches_dist_0_missed_5():
    proc = DummyProc(id=1, name="TEST", type="STAR", airport_id="TEST", runway="09")

    legs = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=1000.0,
        ),
        DummyLeg(
            source_serial="20",
            path_descriptor="CA",
            waypoint_ident="W1",
            lon=None,
            lat=None,
            course="090°",
            distance="10NM",
        ),
        DummyLeg(
            source_serial="30",
            path_descriptor="CA",
            waypoint_ident="W2",
            lon=None,
            lat=None,
            course="090°",
            distance="invalid",
            altitude_numeric=2000.0,
        ),
        DummyLeg(
            source_serial="40",
            path_descriptor="CA",
            waypoint_ident="W3",
            lon=None,
            lat=None,
            course="invalid",
            distance="10NM",
        ),
        DummyLeg(
            source_serial="50",
            path_descriptor="CA",
            waypoint_ident="W4",
            lon=None,
            lat=None,
            course=None,
            distance="10NM",
        ),
        DummyLeg(
            source_serial="60",
            path_descriptor="TF",
            waypoint_ident="RW09",
            lon=1,
            lat=0,
            role="TF",
            altitude_numeric=3000.0,
        ),
    ]

    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) >= 1

    legs2 = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=None,
        ),
        DummyLeg(
            source_serial="20",
            path_descriptor="CA",
            waypoint_ident="W1",
            lon=None,
            lat=None,
            course="090°",
            distance="invalid",
            altitude_numeric=2000.0,
        ),
        DummyLeg(
            source_serial="30",
            path_descriptor="TF",
            waypoint_ident="RW09",
            lon=1,
            lat=0,
            role="TF",
            altitude_numeric=3000.0,
        ),
    ]
    res2 = build_3d_paths(proc, legs2)
    assert len(res2.approach_paths) >= 1

    legs3 = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=1000.0,
        ),
        DummyLeg(
            source_serial="20",
            path_descriptor="IF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=1000.0,
        ),
        DummyLeg(
            source_serial="30",
            path_descriptor="TF",
            waypoint_ident="RW09",
            lon=1,
            lat=0,
            role="TF",
            altitude_numeric=3000.0,
        ),
    ]
    res3 = build_3d_paths(proc, legs3)
    assert len(res3.approach_paths) >= 1

    class DictLeg(dict):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)

        def __getattr__(self, name):
            return self.get(name)

    d_leg = DictLeg(
        {
            "source_serial": "70",
            "path_descriptor": "TF",
            "waypoint_ident": "END",
            "lon": 2,
            "lat": 0,
            "altitude_numeric": None,
            "altitude_constraint": None,
            "role": None,
            "course": None,
            "distance": None,
            "turn_direction": "L",
        }
    )

    legs4 = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=1000.0,
        ),
        d_leg,
        DummyLeg(
            source_serial="30",
            path_descriptor="TF",
            waypoint_ident="RW09",
            lon=1,
            lat=0,
            role="TF",
            altitude_numeric=3000.0,
        ),
    ]
    res4 = build_3d_paths(proc, legs4)
    assert len(res4.approach_paths) >= 1


def test_trigger():
    proc = DummyProc(id=1, name="TEST", type="STAR", airport_id="TEST", runway="09")

    # Target 453-476: "CA" leg with distance parse exception
    legs = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=1000.0,
        ),
        DummyLeg(
            source_serial="20",
            path_descriptor="CA",
            waypoint_ident="W1",
            lon=None,
            lat=None,
            course="090°",
            distance="invalid_dist",
            altitude_numeric=2000.0,
        ),
        DummyLeg(
            source_serial="30",
            path_descriptor="TF",
            waypoint_ident="RW09",
            lon=1,
            lat=0,
            role="TF",
            altitude_numeric=3000.0,
        ),
    ]
    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) >= 1

    # Target 447 (alt_m is None)
    legs2 = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=1000.0,
        ),
        DummyLeg(
            source_serial="20",
            path_descriptor="IF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=None,
        ),
        DummyLeg(
            source_serial="30",
            path_descriptor="TF",
            waypoint_ident="RW09",
            lon=1,
            lat=0,
            role="TF",
            altitude_numeric=3000.0,
        ),
    ]
    res2 = build_3d_paths(proc, legs2)
    assert len(res2.approach_paths) >= 1


def test_missed_approach_start_altitude_offset():
    import math

    from app.services.rnp_service import FT_TO_M

    proc = DummyProc(id=1, name="TEST", type="STAR", airport_id="TEST", runway="09")

    # Legs structure matching approach + missed approach:
    # 1. Approach starts at START, ends at RW09 (threshold elevation 317 ft)
    # 2. Missed approach group starts at RW09, climbs to W1 (at 2300 ft)
    legs = [
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="START",
            lon=0,
            lat=0,
            role="IF",
            altitude_numeric=1000.0,
        ),
        DummyLeg(
            source_serial="20",
            path_descriptor="TF",
            waypoint_ident="RW09",
            lon=1,
            lat=0,
            role="TF",
            altitude_numeric=317.0,
        ),
        # Missed approach starts here
        DummyLeg(
            source_serial="10",
            path_descriptor="IF",
            waypoint_ident="RW09",
            lon=1,
            lat=0,
            role="IF",
            altitude_numeric=None,
        ),
        DummyLeg(
            source_serial="20",
            path_descriptor="TF",
            waypoint_ident="W1",
            lon=2,
            lat=0,
            role="TF",
            altitude_numeric=2300.0,
        ),
    ]

    res = build_3d_paths(proc, legs)
    assert res.missed_approach_path is not None

    # Path should start 1.0 NM before the threshold along the approach segment
    # START: (0, 0), RW09: (1, 0).
    dist_nm = haversine_nm(0.0, 0.0, 1.0, 0.0)
    expected_lon = 1.0 - (1.0 / dist_nm)
    first_pt = res.missed_approach_path.path[0]
    assert math.isclose(first_pt[0], expected_lon, rel_tol=1e-5)
    assert math.isclose(first_pt[1], 0.0, rel_tol=1e-5)

    # First coordinate of missed approach path should have interpolated altitude
    expected_alt_ft = 317.0 + (1.0 / dist_nm) * (1000.0 - 317.0)
    expected_alt_m = expected_alt_ft * FT_TO_M
    assert math.isclose(first_pt[2], expected_alt_m, rel_tol=1e-5)

    # Second coordinate should be close to the runway threshold (1, 0) due to Bezier smoothing
    second_pt = res.missed_approach_path.path[1]
    assert math.isclose(second_pt[0], 1.0, abs_tol=0.01)
    assert math.isclose(second_pt[1], 0.0, abs_tol=0.01)

    # The runway threshold altitude should be interpolated as climbing (higher than 617 ft)
    assert second_pt[2] > expected_alt_m
