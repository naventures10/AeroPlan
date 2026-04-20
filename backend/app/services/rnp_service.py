import math
import re
from collections.abc import Sequence
from typing import Any

from app.schemas.rnp import (
    RnpApproachPath,
    RnpMissedApproachPath,
    RnpPath3dResponse,
    RnpWaypointMarker,
)

FT_TO_M = 0.3048


def haversine_nm(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Great-circle distance in nautical miles."""
    r_nm = 3440.065
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    return r_nm * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def smooth_path_3d(
    path: list[list[float]], max_turn_dist_nm: float = 1.5, steps: int = 12
) -> list[list[float]]:
    """
    Applies a corner-cutting quadratic Bezier spline to make Fly-By
    waypoint turns look like realistic aircraft tracks (curved) rather
    than sharp instantaneous angles. Maps cut distances in Nautical Miles
    to avoid massive under-turning on long segments.
    """
    if len(path) < 3:
        return path

    smoothed = [path[0]]

    for i in range(1, len(path) - 1):
        p_a = path[i - 1]
        p_b = path[i]
        p_c = path[i + 1]

        dist_ab = haversine_nm(p_a[0], p_a[1], p_b[0], p_b[1])
        dist_bc = haversine_nm(p_b[0], p_b[1], p_c[0], p_c[1])

        cut_ab = min(max_turn_dist_nm, dist_ab * 0.3) if dist_ab > 0 else 0
        cut_bc = min(max_turn_dist_nm, dist_bc * 0.3) if dist_bc > 0 else 0

        alpha_ab = (cut_ab / dist_ab) if dist_ab > 0 else 0
        alpha_bc = (cut_bc / dist_bc) if dist_bc > 0 else 0

        q0 = [
            p_b[0] + alpha_ab * (p_a[0] - p_b[0]),
            p_b[1] + alpha_ab * (p_a[1] - p_b[1]),
            p_b[2] + alpha_ab * (p_a[2] - p_b[2]),
        ]

        q2 = [
            p_b[0] + alpha_bc * (p_c[0] - p_b[0]),
            p_b[1] + alpha_bc * (p_c[1] - p_b[1]),
            p_b[2] + alpha_bc * (p_c[2] - p_b[2]),
        ]

        smoothed.append(q0)

        for j in range(1, steps):
            t = j / steps
            inv_t = 1.0 - t

            x = (inv_t**2) * q0[0] + 2 * inv_t * t * p_b[0] + (t * t) * q2[0]
            y = (inv_t**2) * q0[1] + 2 * inv_t * t * p_b[1] + (t * t) * q2[1]
            z = (inv_t**2) * q0[2] + 2 * inv_t * t * p_b[2] + (t * t) * q2[2]

            smoothed.append([x, y, z])

        smoothed.append(q2)

    smoothed.append(path[-1])
    return smoothed


def extract_true_course(course_str: str | None) -> float | None:
    """Parses true course in degrees from strings like '228.34° (228.09°)'."""
    if not course_str:
        return None
    m = re.search(r"\(\D*([\d\.]+)\D*\)", str(course_str))
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            pass
    return None


def project_point(lon: float, lat: float, brg_true: float, dist_nm: float) -> list[float]:
    """Projects a point geodesic given a true bearing and distance in Nautical Miles."""
    earth_radius_nm = 3440.065  # Earth radius in NM
    lat_rad = math.radians(lat)
    lon_rad = math.radians(lon)
    brg_rad = math.radians(brg_true)

    lat2_rad = math.asin(
        math.sin(lat_rad) * math.cos(dist_nm / earth_radius_nm)
        + math.cos(lat_rad) * math.sin(dist_nm / earth_radius_nm) * math.cos(brg_rad)
    )
    lon2_rad = lon_rad + math.atan2(
        math.sin(brg_rad) * math.sin(dist_nm / earth_radius_nm) * math.cos(lat_rad),
        math.cos(dist_nm / earth_radius_nm) - math.sin(lat_rad) * math.sin(lat2_rad),
    )

    return [math.degrees(lon2_rad), math.degrees(lat2_rad)]


def parse_serial(s: str | None) -> int:
    """Parses source_serial string into an integer, defaulting to 999 if invalid."""
    if not s or str(s).strip() == "":
        return 999
    try:
        return int(s.strip())
    except ValueError:
        return 999


def group_legs(legs_rows: Sequence[Any]) -> list[list[Any]]:
    """
    Groups legs into sequences based on source_serial resets or 'IF' path descriptors.
    Handles missing or inconsistent serial numbers.
    """
    groups = []
    current_group = []
    last_serial = -1

    for r in legs_rows:
        s_val = parse_serial(r.source_serial)
        is_split = False
        if current_group and ((s_val != 999 and s_val <= last_serial) or r.path_descriptor == "IF"):
            is_split = True

        if is_split:
            groups.append(current_group)
            current_group = []

        current_group.append(r)
        last_serial = s_val if s_val != 999 else last_serial

    if current_group:
        groups.append(current_group)

    return groups


def build_3d_paths(proc_row: Any, legs_rows: Sequence[Any]) -> RnpPath3dResponse:
    if not legs_rows:
        return RnpPath3dResponse(
            procedure_id=proc_row.id,
            name=proc_row.name,
            airport_id=proc_row.airport_id or "",
            runway=proc_row.runway or "",
            approach_paths=[],
            missed_approach_path=None,
            max_distance_nm=0.0,
            waypoints=[],
        )

    groups = group_legs(legs_rows)

    final_group = None
    rw_index = -1
    for g in groups:
        for idx, leg in enumerate(g):
            if leg.waypoint_ident and leg.waypoint_ident.startswith("RW"):
                final_group = g
                rw_index = idx
                break
        if final_group:
            break

    if final_group:
        final_approach = final_group[: rw_index + 1]
        raw_missed_approach = final_group[rw_index:]

        final_group_idx = groups.index(final_group)
        for g in groups[final_group_idx + 1 :]:
            raw_missed_approach.extend(g)
    else:
        final_approach = groups[-1] if groups else []
        raw_missed_approach = []

    initial_groups = [
        g
        for g in groups[: groups.index(final_group) if final_group else len(groups)]
        if g != final_group and not (len(g) == 1 and g[0].path_descriptor == "HM")
    ]

    def extract_path(legs_list: list, start_alt_ft: float = 10000.0) -> list[list[float]]:
        path_3d = []
        for leg in legs_list:
            alt_m = (
                float(leg.altitude_numeric) * FT_TO_M if leg.altitude_numeric is not None else None
            )

            if leg.lon is not None and leg.lat is not None:
                if not path_3d or (path_3d[-1][0] != leg.lon or path_3d[-1][1] != leg.lat):
                    path_3d.append([leg.lon, leg.lat, alt_m])
                elif alt_m is not None and path_3d[-1][2] is None:
                    path_3d[-1][2] = alt_m
            else:
                if path_3d and leg.path_descriptor in ["CA", "VA", "VI", "CF", "DF"]:
                    course_true = extract_true_course(leg.course)
                    if course_true is not None:
                        dist_nm = None
                        if leg.distance is not None:
                            try:
                                dist_str = (
                                    str(leg.distance).replace("NM", "").replace("min", "").strip()
                                )
                                dist_nm = float(dist_str)
                            except ValueError:
                                pass

                        if dist_nm is None:
                            prev_alt_m = path_3d[-1][2]
                            if prev_alt_m is not None and alt_m is not None:
                                climb_ft = (alt_m - prev_alt_m) / FT_TO_M
                                dist_nm = max(climb_ft / 200.0, 2.5) if climb_ft > 0 else 3.0
                            else:
                                dist_nm = 3.0

                        v_lon, v_lat = project_point(
                            path_3d[-1][0], path_3d[-1][1], course_true, dist_nm
                        )
                        path_3d.append([v_lon, v_lat, alt_m])

        if not path_3d:
            return path_3d

        if path_3d[0][2] is None:
            path_3d[0][2] = start_alt_ft * FT_TO_M
        if path_3d[-1][2] is None:
            path_3d[-1][2] = path_3d[0][2]

        for i in range(1, len(path_3d) - 1):
            if path_3d[i][2] is None:
                prev_idx = i - 1
                while prev_idx >= 0 and path_3d[prev_idx][2] is None:
                    prev_idx -= 1

                next_idx = i + 1
                while next_idx < len(path_3d) and path_3d[next_idx][2] is None:
                    next_idx += 1

                alt_prev = path_3d[prev_idx][2]
                alt_next = path_3d[next_idx][2]

                dist_prev = sum(
                    haversine_nm(path_3d[j][0], path_3d[j][1], path_3d[j + 1][0], path_3d[j + 1][1])
                    for j in range(prev_idx, i)
                )
                dist_next = sum(
                    haversine_nm(path_3d[j][0], path_3d[j][1], path_3d[j + 1][0], path_3d[j + 1][1])
                    for j in range(i, next_idx)
                )

                total_dist = dist_prev + dist_next
                if total_dist > 0:
                    path_3d[i][2] = alt_prev + (alt_next - alt_prev) * (dist_prev / total_dist)
                else:
                    path_3d[i][2] = alt_prev

        return path_3d

    def process_path(raw_path):
        if len(raw_path) < 2:
            return [], [], 0.0
        path_smoothed = smooth_path_3d(raw_path, max_turn_dist_nm=1.5, steps=16)
        ts = [0.0]
        for i in range(1, len(path_smoothed)):
            seg = haversine_nm(
                path_smoothed[i - 1][0],
                path_smoothed[i - 1][1],
                path_smoothed[i][0],
                path_smoothed[i][1],
            )
            seg = max(seg, 0.01)
            ts.append(round(ts[-1] + seg, 3))
        return path_smoothed, ts, ts[-1]

    approach_paths = []

    if not initial_groups and final_approach:
        p3d = extract_path(final_approach)
        smooth_p, ts, dist = process_path(p3d)
        if smooth_p:
            ident = final_approach[0].waypoint_ident or "START"
            approach_paths.append(
                RnpApproachPath(
                    label=f"via {ident}",
                    entry_waypoint=ident,
                    path=smooth_p,
                    timestamps=ts,
                    total_distance_nm=dist,
                    segment_type="approach",
                )
            )
    else:
        for ig in initial_groups:
            full_legs = ig.copy()
            if final_approach:
                if full_legs[-1].waypoint_ident == final_approach[0].waypoint_ident:
                    full_legs.extend(final_approach[1:])
                else:
                    full_legs.extend(final_approach)
            p3d = extract_path(full_legs)
            smooth_p, ts, dist = process_path(p3d)
            if smooth_p:
                ident = ig[0].waypoint_ident or "START"
                approach_paths.append(
                    RnpApproachPath(
                        label=f"via {ident}",
                        entry_waypoint=ident,
                        path=smooth_p,
                        timestamps=ts,
                        total_distance_nm=dist,
                        segment_type="approach",
                    )
                )

    missed_approach_path = None
    if raw_missed_approach:
        start_alt_raw = raw_missed_approach[0].altitude_numeric
        start_alt_ft = float(start_alt_raw) if start_alt_raw is not None else 10000.0
        p3d = extract_path(
            raw_missed_approach,
            start_alt_ft=start_alt_ft,
        )
        smooth_p, ts, dist = process_path(p3d)
        if smooth_p:
            missed_approach_path = RnpMissedApproachPath(
                path=smooth_p, timestamps=ts, total_distance_nm=dist
            )

    max_dist = max([ap.total_distance_nm for ap in approach_paths], default=0.0)

    waypoints = []
    seen = set()
    for leg in legs_rows:
        w_id = leg.waypoint_ident
        if w_id and w_id not in seen and leg.lon is not None:
            seen.add(w_id)
            alt_m = float(leg.altitude_numeric) * FT_TO_M if leg.altitude_numeric else 0.0
            waypoints.append(
                RnpWaypointMarker(name=w_id, position=[leg.lon, leg.lat, alt_m], role=leg.role)
            )

    return RnpPath3dResponse(
        procedure_id=proc_row.id,
        name=proc_row.name,
        airport_id=proc_row.airport_id or "",
        runway=proc_row.runway or "",
        approach_paths=approach_paths,
        missed_approach_path=missed_approach_path,
        max_distance_nm=max_dist,
        waypoints=waypoints,
    )
