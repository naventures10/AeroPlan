from collections import namedtuple

from app.services.rnp_service import group_legs, parse_serial

# Mock leg object
Leg = namedtuple("Leg", ["source_serial", "path_descriptor", "waypoint_ident"])


def test_parse_serial():
    assert parse_serial("10") == 10
    assert parse_serial(" 20 ") == 20
    assert parse_serial(None) == 999
    assert parse_serial("") == 999
    assert parse_serial("invalid") == 999


def test_group_legs_basic_split():
    legs = [
        Leg("10", "IF", "WPT1"),
        Leg("20", "TF", "WPT2"),
        Leg("10", "IF", "WPT3"),  # Split here
        Leg("20", "TF", "WPT2"),
    ]
    groups = group_legs(legs)
    assert len(groups) == 2
    assert groups[0][0].waypoint_ident == "WPT1"
    assert groups[1][0].waypoint_ident == "WPT3"


def test_group_legs_if_split():
    # Even if serial is same, IF should split
    legs = [
        Leg("10", "IF", "WPT1"),
        Leg("10", "IF", "WPT2"),
    ]
    groups = group_legs(legs)
    assert len(groups) == 2


def test_group_legs_missing_serials_va_au():
    # Simulating VAAU logic: 10->20, 10->20, 10->20->30, 10->20->30->40...
    legs = [
        Leg("10", "IF", "AU701"),
        Leg("20", "TF", "AU703"),
        Leg("10", "IF", "AU702"),
        Leg("20", "TF", "AU703"),
        Leg("10", "IF", "AU703"),
        Leg("20", "TF", "AU704"),
        Leg("30", "TF", "RW09"),
    ]
    groups = group_legs(legs)
    assert len(groups) == 3
    assert groups[0][0].waypoint_ident == "AU701"
    assert groups[1][0].waypoint_ident == "AU702"
    assert groups[2][0].waypoint_ident == "AU703"


def test_group_legs_no_serials_va_sd():
    # Simulating VASD logic: All serials are None/Empty
    legs = [
        Leg("", "IF", "SD361"),
        Leg("", "TF", "SD364"),
        Leg("", "IF", "SD362"),
        Leg("", "TF", "SD364"),
        Leg("", "IF", "SD363"),
        Leg("", "TF", "SD364"),
        Leg("", "IF", "SD364"),
        Leg("", "TF", "SD365"),
        Leg("", "TF", "RW09"),
    ]
    groups = group_legs(legs)
    assert len(groups) == 4
    assert groups[0][0].waypoint_ident == "SD361"
    assert groups[1][0].waypoint_ident == "SD362"
    assert groups[2][0].waypoint_ident == "SD363"
    assert groups[3][0].waypoint_ident == "SD364"
