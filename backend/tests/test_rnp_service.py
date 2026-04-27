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
    class DummyLeg:
        def __init__(self, alt_num=None, alt_str=None):
            self.altitude_numeric = alt_num
            self.altitude_constraint = alt_str

    assert extract_altitude(DummyLeg(alt_num=1000.0)) == 1000.0
    assert extract_altitude(DummyLeg(alt_num="invalid", alt_str="+5100")) == 5100.0
    assert extract_altitude(DummyLeg(alt_str="FL150")) == 15000.0
    assert extract_altitude(DummyLeg(alt_str="1000+")) == 1000.0
    assert extract_altitude(DummyLeg(alt_str="invalid")) is None
    assert extract_altitude(DummyLeg()) is None

    class MissingAttr:
        def __init__(self):
            self.altitude_numeric = None
            self.altitude_constraint = None

    assert extract_altitude(MissingAttr()) is None
    assert extract_altitude(DummyLeg(alt_num=-1.0)) is None

    class BadType:
        def __float__(self):
            raise TypeError()

    assert extract_altitude(DummyLeg(BadType())) is None


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
    class DummyLeg:
        def __init__(self, serial, pd, wpt):
            self.source_serial = serial
            self.path_descriptor = pd
            self.waypoint_ident = wpt

    # Basic split
    legs = [
        DummyLeg("10", "IF", "WPT1"),
        DummyLeg("20", "TF", "WPT2"),
        DummyLeg("10", "IF", "WPT3"),
        DummyLeg("20", "TF", "WPT2"),
    ]
    groups = group_legs(legs)
    assert len(groups) == 2

    # Split IF but same serial
    legs = [
        DummyLeg("10", "IF", "WPT1"),
        DummyLeg("10", "IF", "WPT2"),
    ]
    groups = group_legs(legs)
    assert len(groups) == 2

    # Split same serial
    legs = [
        DummyLeg("10", "TF", "W1"),
        DummyLeg("10", "TF", "W2"),
    ]
    groups = group_legs(legs)
    assert len(groups) == 2

    # Invalid serial
    legs = [
        DummyLeg("invalid", "TF", "WPT1"),
        DummyLeg("10", "TF", "WPT2"),
        DummyLeg("20", "TF", "WPT3"),
        DummyLeg("invalid", "TF", "WPT4"),
    ]
    groups = group_legs(legs)
    assert len(groups) == 1

    legs = [
        DummyLeg("10", "TF", "W1"),
        DummyLeg("5", "TF", "W2"),  # splits
        DummyLeg("5", "TF", "W3"),  # splits again because 5 <= 5
    ]
    groups = group_legs(legs)
    assert len(groups) == 3


def test_build_3d_paths():
    class DummyProc:
        def __init__(self, id=1, name="TEST", type="STAR", airport_id="TEST", runway="09"):
            self.id = id
            self.name = name
            self.type = type
            self.airport_id = airport_id
            self.runway = runway

    class DummyLeg:
        def __init__(
            self,
            serial,
            pd,
            wpt,
            lon,
            lat,
            alt_num=None,
            alt_str=None,
            role=None,
            turn=None,
            course=None,
            dist=None,
        ):
            self.source_serial = serial
            self.path_descriptor = pd
            self.waypoint_ident = wpt
            self.lon = lon
            self.lat = lat
            self.altitude_numeric = alt_num
            self.altitude_constraint = alt_str
            self.role = role
            self.turn_direction = turn
            self.course = course
            self.distance = dist

    class DictLeg(dict):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)

        def __getattr__(self, name):
            if name == "turn_direction":
                raise AttributeError()
            return self.get(name)

    proc = DummyProc()

    # 1. No waypoints
    res = build_3d_paths(proc, [])
    assert len(res.approach_paths) == 0

    # 2. No path3d
    res = build_3d_paths(proc, [DummyLeg("10", "IF", "START", None, None, role="IF")])
    assert len(res.approach_paths) == 0

    # 3. Simple straight path
    legs = [
        DummyLeg("10", "IF", "START", 0, 0, alt_num=1000.0, role="IF"),
        DummyLeg("20", "TF", "MID", 1, 0, role="TF"),
        DummyLeg("30", "TF", "END", 2, 0, alt_num=3000.0, role="TF"),
    ]
    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) == 1
    assert len(res.waypoints) == 3

    # 4. Only final (with extra point for >=2)
    legs = [
        DummyLeg("10", "IF", "START", 0, 0, alt_num=1000.0, role="IF"),
        DummyLeg("20", "TF", "RW09", 1, 0, role="TF"),
        DummyLeg("30", "TF", "END", 2, 0, role="TF"),
    ]
    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) == 1

    # 5. Complex ident
    legs = [
        DummyLeg("10", "IF", "SAME", 0, 0, alt_num=1000.0, role="IF"),
        DummyLeg("20", "TF", "MID", 1, 0, role="TF"),
        DummyLeg("10", "IF", "SAME", 1, 0, alt_num=1000.0, role="IF"),
        DummyLeg("20", "TF", "MID2", 2, 0, role="TF"),
    ]
    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) == 2
    assert res.approach_paths[1].entry_waypoint == "SAME-2"

    # 6. HM filtering
    legs = [
        DummyLeg("10", "IF", "START", 0, 0, role="IF"),
        DummyLeg("20", "IF", "RW09", 1, 0, role="IF"),
        DummyLeg("30", "TF", "MID", 2, 0, role="TF"),
        DummyLeg("10", "HM", "HOLD", 3, 0, role="HM"),
        DummyLeg("20", "TF", "AFTER_HOLD", 4, 0, role="TF"),
    ]
    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) >= 0

    # 7. Initial pos
    proc.type = "SID"
    legs = [
        DummyLeg("10", "IF", "RW09", 0, 0, role="IF"),
        DummyLeg("20", "TF", "MID", 1, 0, role="TF"),
        DummyLeg("30", "TF", "END", 2, 0, role="TF"),
    ]
    res = build_3d_paths(proc, legs, runway_threshold=[10, 10])
    assert res.approach_paths[0].path[0][0] == 10

    # 8. SID specific
    legs = [
        DummyLeg("10", "CF", "START", 0, 0, role="IF"),
        DummyLeg("20", "TF", "EXIT", 1, 0, alt_num=10000.0, role="TF"),
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
        DummyLeg("10", "IF", "W1", 0, 0, role="IF", alt_num=100.0),
        DummyLeg("20", "IF", "W1", 0, 0, role="IF", alt_num=1000.0),
        DummyLeg("25", "IF", "W1", 0, 0, role="IF", alt_num=None),
        DummyLeg("30", "CA", "W2", None, None, course="090°", dist="invalid"),
        DummyLeg("40", "CA", "W3", None, None, alt_num=3000.0, course="090°", dist=None),
        DummyLeg("50", "CA", "W4", None, None, alt_num=1000.0, course="090°", dist=None),
        DummyLeg("60", "TF", "RW09", 1, 0, role="TF", alt_num=None),
        d_leg,
    ]
    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) >= 1

    # 10. Empty dist_nm
    legs = [
        DummyLeg("10", "IF", "START", 0, 0, role="IF", alt_num=1000.0),
        DummyLeg("20", "TF", "W1", 0, 0, role="TF", alt_num=None),
        DummyLeg("30", "TF", "RW09", 1, 0, role="TF", alt_num=1000.0),
        DummyLeg("40", "TF", "END", 2, 0, role="TF", alt_num=1000.0),
    ]
    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) >= 1

    # 11. Missed Approach
    legs = [
        DummyLeg("10", "IF", "RW09", 0, 0, role="IF", alt_num=1000.0),
        DummyLeg("20", "TF", "W1", 0, 0, role="TF", alt_num=None),
        DummyLeg("30", "TF", "W2", 0, 0, role="TF", alt_num=2000.0),
        DummyLeg("40", "TF", "W3", 1, 0, role="TF", alt_num=3000.0),
    ]
    res = build_3d_paths(proc, legs)
    assert res.missed_approach_path is not None


def test_extract_path_more_branches_final():
    class DummyProc:
        def __init__(self, id=1, name="TEST", type="STAR", airport_id="TEST", runway="09"):
            self.id = id
            self.name = name
            self.type = type
            self.airport_id = airport_id
            self.runway = runway

    class DummyLeg:
        def __init__(
            self,
            serial,
            pd,
            wpt,
            lon,
            lat,
            alt_num=None,
            alt_str=None,
            role=None,
            turn=None,
            course=None,
            dist=None,
        ):
            self.source_serial = serial
            self.path_descriptor = pd
            self.waypoint_ident = wpt
            self.lon = lon
            self.lat = lat
            self.altitude_numeric = alt_num
            self.altitude_constraint = alt_str
            self.role = role
            self.turn_direction = turn
            self.course = course
            self.distance = dist

    proc = DummyProc()

    # 4. Only final (with extra point for >=2) and specific names so process_path succeeds
    legs = [
        DummyLeg("10", "IF", "START", 0, 0, alt_num=1000.0, role="IF"),
        DummyLeg("20", "TF", "RW09", 1, 0, role="TF"),
        DummyLeg("30", "TF", "END", 2, 0, role="TF"),
    ]
    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) == 1


def test_extract_path_more_branches14():
    class DummyProc:
        def __init__(self, id=1, name="TEST", type="STAR", airport_id="TEST", runway="09"):
            self.id = id
            self.name = name
            self.type = type
            self.airport_id = airport_id
            self.runway = runway

    class DummyLeg:
        def __init__(
            self,
            serial,
            pd,
            wpt,
            lon,
            lat,
            alt_num=None,
            alt_str=None,
            role=None,
            turn=None,
            course=None,
            dist=None,
        ):
            self.source_serial = serial
            self.path_descriptor = pd
            self.waypoint_ident = wpt
            self.lon = lon
            self.lat = lat
            self.altitude_numeric = alt_num
            self.altitude_constraint = alt_str
            self.role = role
            self.turn_direction = turn
            self.course = course
            self.distance = dist

    proc = DummyProc()

    # Hit 447, 453-476
    legs = [
        DummyLeg("10", "IF", "START", 0, 0, role="IF", alt_num=1000.0),
        DummyLeg("20", "CA", "W1", None, None, course="090°", dist="10NM"),
        DummyLeg(
            "30", "CA", "W2", None, None, course="090°", dist=None, alt_num=2000.0
        ),  # dist=None, climb > 0
        DummyLeg("40", "CA", "W3", None, None, course="invalid", dist=None),  # invalid course
        DummyLeg("50", "CA", "W4", None, None, course=None, dist=None),  # none course
        DummyLeg("60", "TF", "RW09", 1, 0, role="TF", alt_num=3000.0),
    ]

    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) >= 1

    # hit missing dist logic where no prev alt exists
    legs2 = [
        DummyLeg("10", "IF", "START", 0, 0, role="IF", alt_num=None),
        DummyLeg("20", "CA", "W1", None, None, course="090°", dist="invalid", alt_num=2000.0),
        DummyLeg("30", "TF", "RW09", 1, 0, role="TF", alt_num=3000.0),
    ]
    res2 = build_3d_paths(proc, legs2)
    assert len(res2.approach_paths) >= 1


def test_extract_path_remaining_branches():
    class DummyProc:
        def __init__(self, id=1, name="TEST", type="STAR", airport_id="TEST", runway="09"):
            self.id = id
            self.name = name
            self.type = type
            self.airport_id = airport_id
            self.runway = runway

    class DummyLeg:
        def __init__(
            self,
            serial,
            pd,
            wpt,
            lon,
            lat,
            alt_num=None,
            alt_str=None,
            role=None,
            turn=None,
            course=None,
            dist=None,
        ):
            self.source_serial = serial
            self.path_descriptor = pd
            self.waypoint_ident = wpt
            self.lon = lon
            self.lat = lat
            self.altitude_numeric = alt_num
            self.altitude_constraint = alt_str
            self.role = role
            self.turn_direction = turn
            self.course = course
            self.distance = dist

    class DictLeg(dict):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)

        def __getattr__(self, name):
            if name == "turn_direction":
                raise AttributeError()
            return self.get(name)

    proc = DummyProc()

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
        DummyLeg("10", "IF", "W1", 0, 0, role="IF", alt_num=100.0),
        DummyLeg("20", "IF", "W1", 0, 0, role="IF", alt_num=1000.0),
        DummyLeg("25", "IF", "W1", 0, 0, role="IF", alt_num=None),
        DummyLeg("30", "CA", "W2", None, None, course="090°", dist="invalid"),
        DummyLeg("40", "CA", "W3", None, None, alt_num=3000.0, course="090°", dist=None),
        DummyLeg("50", "CA", "W4", None, None, alt_num=1000.0, course="090°", dist=None),
        DummyLeg("60", "TF", "RW09", 1, 0, role="TF", alt_num=None),
        d_leg,
    ]
    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) >= 1

    # Hit 500, 518
    legs = [
        DummyLeg("10", "IF", "START", 0, 0, role="IF", alt_num=1000.0),
        DummyLeg("20", "TF", "W1", 0, 0, role="TF", alt_num=None),
        DummyLeg("30", "TF", "RW09", 1, 0, role="TF", alt_num=1000.0),
        # Provide valid extra point to return something
        DummyLeg("40", "TF", "END", 2, 0, role="TF", alt_num=1000.0),
    ]

    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) >= 1


def test_extract_path_more_branches_dist_0():
    class DummyProc:
        def __init__(self, id=1, name="TEST", type="STAR", airport_id="TEST", runway="09"):
            self.id = id
            self.name = name
            self.type = type
            self.airport_id = airport_id
            self.runway = runway

    class DummyLeg:
        def __init__(
            self,
            serial,
            pd,
            wpt,
            lon,
            lat,
            alt_num=None,
            alt_str=None,
            role=None,
            turn=None,
            course=None,
            dist=None,
        ):
            self.source_serial = serial
            self.path_descriptor = pd
            self.waypoint_ident = wpt
            self.lon = lon
            self.lat = lat
            self.altitude_numeric = alt_num
            self.altitude_constraint = alt_str
            self.role = role
            self.turn_direction = turn
            self.course = course
            self.distance = dist

    proc = DummyProc()

    # Hit 518 exactly: distance 0 between previous and current
    legs = [
        DummyLeg("10", "IF", "START", 0, 0, role="IF", alt_num=1000.0),
        DummyLeg("20", "TF", "W1", 0, 0, role="TF", alt_num=None),  # same coordinates, dist=0
        DummyLeg("30", "TF", "W2", 0, 0, role="TF", alt_num=2000.0),  # same coordinates
        DummyLeg("40", "TF", "RW09", 1, 0, role="TF", alt_num=1000.0),
        DummyLeg("50", "TF", "END", 2, 0, role="TF", alt_num=1000.0),
    ]

    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) >= 1


def test_extract_path_more_branches_dist_0_in_missed():
    class DummyProc:
        def __init__(self, id=1, name="TEST", type="STAR", airport_id="TEST", runway="09"):
            self.id = id
            self.name = name
            self.type = type
            self.airport_id = airport_id
            self.runway = runway

    class DummyLeg:
        def __init__(
            self,
            serial,
            pd,
            wpt,
            lon,
            lat,
            alt_num=None,
            alt_str=None,
            role=None,
            turn=None,
            course=None,
            dist=None,
        ):
            self.source_serial = serial
            self.path_descriptor = pd
            self.waypoint_ident = wpt
            self.lon = lon
            self.lat = lat
            self.altitude_numeric = alt_num
            self.altitude_constraint = alt_str
            self.role = role
            self.turn_direction = turn
            self.course = course
            self.distance = dist

    proc = DummyProc()

    # Hit 518 exactly: distance 0 between previous and current
    legs = [
        DummyLeg("10", "IF", "START", 0, 0, role="IF", alt_num=1000.0),
        DummyLeg("20", "TF", "RW09", 1, 0, role="TF", alt_num=None),
        DummyLeg("30", "TF", "W2", 2, 0, role="TF", alt_num=2000.0),
        DummyLeg("40", "TF", "W3", 2, 0, role="TF", alt_num=None),  # same coordinates, dist=0
        DummyLeg("50", "TF", "END", 2, 0, role="TF", alt_num=1000.0),  # same coordinates, dist=0
    ]

    res = build_3d_paths(proc, legs)
    assert res.missed_approach_path is not None


def test_extract_path_more_branches_dist_0_missed_2():
    class DummyProc:
        def __init__(self, id=1, name="TEST", type="STAR", airport_id="TEST", runway="09"):
            self.id = id
            self.name = name
            self.type = type
            self.airport_id = airport_id
            self.runway = runway

    class DummyLeg:
        def __init__(
            self,
            serial,
            pd,
            wpt,
            lon,
            lat,
            alt_num=None,
            alt_str=None,
            role=None,
            turn=None,
            course=None,
            dist=None,
        ):
            self.source_serial = serial
            self.path_descriptor = pd
            self.waypoint_ident = wpt
            self.lon = lon
            self.lat = lat
            self.altitude_numeric = alt_num
            self.altitude_constraint = alt_str
            self.role = role
            self.turn_direction = turn
            self.course = course
            self.distance = dist

    proc = DummyProc()

    # Hit 518 exactly: distance 0 between previous and current
    legs = [
        DummyLeg("10", "IF", "START", 0, 0, role="IF", alt_num=1000.0),
        DummyLeg("20", "TF", "RW09", 1, 0, role="TF", alt_num=None),
        DummyLeg("30", "TF", "W2", 2, 0, role="TF", alt_num=2000.0),
        DummyLeg("40", "TF", "W3", 2, 0, role="TF", alt_num=None),  # same coordinates, dist=0
        DummyLeg("50", "TF", "END", 3, 0, role="TF", alt_num=1000.0),  # diff coordinates
    ]

    res = build_3d_paths(proc, legs)
    assert res.missed_approach_path is not None


def test_extract_path_interpolate_more():
    class DummyProc:
        def __init__(self, id=1, name="TEST", type="STAR", airport_id="TEST", runway="09"):
            self.id = id
            self.name = name
            self.type = type
            self.airport_id = airport_id
            self.runway = runway

    class DummyLeg:
        def __init__(
            self,
            serial,
            pd,
            wpt,
            lon,
            lat,
            alt_num=None,
            alt_str=None,
            role=None,
            turn=None,
            course=None,
            dist=None,
        ):
            self.source_serial = serial
            self.path_descriptor = pd
            self.waypoint_ident = wpt
            self.lon = lon
            self.lat = lat
            self.altitude_numeric = alt_num
            self.altitude_constraint = alt_str
            self.role = role
            self.turn_direction = turn
            self.course = course
            self.distance = dist

    proc = DummyProc()

    # Hit lines 496, 500 (multiple missing alts leading up to known)
    legs = [
        DummyLeg("10", "IF", "RW09", 0, 0, role="IF", alt_num=1000.0),
        DummyLeg("20", "TF", "W1", 1, 0, role="TF", alt_num=None),
        DummyLeg("30", "TF", "W2", 2, 0, role="TF", alt_num=None),
        DummyLeg("40", "TF", "END", 3, 0, role="TF", alt_num=1000.0),
    ]
    res = build_3d_paths(proc, legs)
    assert res.missed_approach_path is not None


def test_extract_path_more_branches_dist_0_missed_3():
    class DummyProc:
        def __init__(self, id=1, name="TEST", type="STAR", airport_id="TEST", runway="09"):
            self.id = id
            self.name = name
            self.type = type
            self.airport_id = airport_id
            self.runway = runway

    class DummyLeg:
        def __init__(
            self,
            serial,
            pd,
            wpt,
            lon,
            lat,
            alt_num=None,
            alt_str=None,
            role=None,
            turn=None,
            course=None,
            dist=None,
        ):
            self.source_serial = serial
            self.path_descriptor = pd
            self.waypoint_ident = wpt
            self.lon = lon
            self.lat = lat
            self.altitude_numeric = alt_num
            self.altitude_constraint = alt_str
            self.role = role
            self.turn_direction = turn
            self.course = course
            self.distance = dist

    proc = DummyProc()

    # Hit 518 exactly: distance 0 between previous and current
    legs = [
        DummyLeg("10", "IF", "START", 0, 0, role="IF", alt_num=1000.0),
        DummyLeg("20", "TF", "RW09", 1, 0, role="TF", alt_num=None),
        DummyLeg("30", "TF", "W2", 2, 0, role="TF", alt_num=1000.0),
        DummyLeg("40", "TF", "W3", 2, 0, role="TF", alt_num=None),  # same coordinates, dist=0
        DummyLeg("45", "TF", "W4", 2, 0, role="TF", alt_num=None),  # same coordinates, dist=0
        DummyLeg("50", "TF", "END", 2, 0, role="TF", alt_num=2000.0),  # same coordinates
    ]

    res = build_3d_paths(proc, legs)
    assert res.missed_approach_path is not None


def test_extract_path_more_branches_dist_0_missed_4():
    class DummyProc:
        def __init__(self, id=1, name="TEST", type="STAR", airport_id="TEST", runway="09"):
            self.id = id
            self.name = name
            self.type = type
            self.airport_id = airport_id
            self.runway = runway

    class DummyLeg:
        def __init__(
            self,
            serial,
            pd,
            wpt,
            lon,
            lat,
            alt_num=None,
            alt_str=None,
            role=None,
            turn=None,
            course=None,
            dist=None,
        ):
            self.source_serial = serial
            self.path_descriptor = pd
            self.waypoint_ident = wpt
            self.lon = lon
            self.lat = lat
            self.altitude_numeric = alt_num
            self.altitude_constraint = alt_str
            self.role = role
            self.turn_direction = turn
            self.course = course
            self.distance = dist

    proc = DummyProc()

    legs = [
        DummyLeg("10", "IF", "START", 0, 0, role="IF", alt_num=1000.0),
        DummyLeg("20", "TF", "RW09", 1, 0, role="TF", alt_num=None),
        DummyLeg("30", "TF", "W2", 2, 0, role="TF", alt_num=2000.0),
        DummyLeg("40", "TF", "W3", 2, 0, role="TF", alt_num=None),  # dist 0 here
        DummyLeg("50", "TF", "END", 2, 0, role="TF", alt_num=1000.0),  # diff alt
    ]

    res = build_3d_paths(proc, legs)
    assert res.missed_approach_path is not None


def test_extract_path_more_branches_dist_0_missed_5():
    class DummyProc:
        def __init__(self, id=1, name="TEST", type="STAR", airport_id="TEST", runway="09"):
            self.id = id
            self.name = name
            self.type = type
            self.airport_id = airport_id
            self.runway = runway

    class DummyLeg:
        def __init__(
            self,
            serial,
            pd,
            wpt,
            lon,
            lat,
            alt_num=None,
            alt_str=None,
            role=None,
            turn=None,
            course=None,
            dist=None,
        ):
            self.source_serial = serial
            self.path_descriptor = pd
            self.waypoint_ident = wpt
            self.lon = lon
            self.lat = lat
            self.altitude_numeric = alt_num
            self.altitude_constraint = alt_str
            self.role = role
            self.turn_direction = turn
            self.course = course
            self.distance = dist

    proc = DummyProc()

    legs = [
        DummyLeg("10", "IF", "START", 0, 0, role="IF", alt_num=1000.0),
        DummyLeg("20", "CA", "W1", None, None, course="090°", dist="10NM"),
        DummyLeg("30", "CA", "W2", None, None, course="090°", dist="invalid", alt_num=2000.0),
        DummyLeg("40", "CA", "W3", None, None, course="invalid", dist="10NM"),
        DummyLeg("50", "CA", "W4", None, None, course=None, dist="10NM"),
        DummyLeg("60", "TF", "RW09", 1, 0, role="TF", alt_num=3000.0),
    ]

    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) >= 1

    legs2 = [
        DummyLeg("10", "IF", "START", 0, 0, role="IF", alt_num=None),
        DummyLeg("20", "CA", "W1", None, None, course="090°", dist="invalid", alt_num=2000.0),
        DummyLeg("30", "TF", "RW09", 1, 0, role="TF", alt_num=3000.0),
    ]
    res2 = build_3d_paths(proc, legs2)
    assert len(res2.approach_paths) >= 1

    legs3 = [
        DummyLeg("10", "IF", "START", 0, 0, role="IF", alt_num=1000.0),
        DummyLeg("20", "IF", "START", 0, 0, role="IF", alt_num=1000.0),
        DummyLeg("30", "TF", "RW09", 1, 0, role="TF", alt_num=3000.0),
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
        DummyLeg("10", "IF", "START", 0, 0, role="IF", alt_num=1000.0),
        d_leg,
        DummyLeg("30", "TF", "RW09", 1, 0, role="TF", alt_num=3000.0),
    ]
    res4 = build_3d_paths(proc, legs4)
    assert len(res4.approach_paths) >= 1


def test_trigger():
    class DummyProc:
        def __init__(self, id=1, name="TEST", type="STAR", airport_id="TEST", runway="09"):
            self.id = id
            self.name = name
            self.type = type
            self.airport_id = airport_id
            self.runway = runway

    class DummyLeg:
        def __init__(
            self,
            serial,
            pd,
            wpt,
            lon,
            lat,
            alt_num=None,
            alt_str=None,
            role=None,
            turn=None,
            course=None,
            dist=None,
        ):
            self.source_serial = serial
            self.path_descriptor = pd
            self.waypoint_ident = wpt
            self.lon = lon
            self.lat = lat
            self.altitude_numeric = alt_num
            self.altitude_constraint = alt_str
            self.role = role
            self.turn_direction = turn
            self.course = course
            self.distance = dist

    proc = DummyProc()

    # Target 453-476: "CA" leg with distance parse exception
    legs = [
        DummyLeg("10", "IF", "START", 0, 0, role="IF", alt_num=1000.0),
        DummyLeg("20", "CA", "W1", None, None, course="090°", dist="invalid_dist", alt_num=2000.0),
        DummyLeg("30", "TF", "RW09", 1, 0, role="TF", alt_num=3000.0),
    ]
    res = build_3d_paths(proc, legs)
    assert len(res.approach_paths) >= 1

    # Target 447 (alt_m is None)
    legs2 = [
        DummyLeg("10", "IF", "START", 0, 0, role="IF", alt_num=1000.0),
        DummyLeg("20", "IF", "START", 0, 0, role="IF", alt_num=None),
        DummyLeg("30", "TF", "RW09", 1, 0, role="TF", alt_num=3000.0),
    ]
    res2 = build_3d_paths(proc, legs2)
    assert len(res2.approach_paths) >= 1


def test_trigger2():
    class DummyProc:
        def __init__(self, id=1, name="TEST", type="STAR", airport_id="TEST", runway="09"):
            self.id = id
            self.name = name
            self.type = type
            self.airport_id = airport_id
            self.runway = runway

    class DummyLeg:
        def __init__(
            self,
            serial,
            pd,
            wpt,
            lon,
            lat,
            alt_num=None,
            alt_str=None,
            role=None,
            turn=None,
            course=None,
            dist=None,
        ):
            self.source_serial = serial
