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
    path: list[list[float]],
    max_turn_dist_nm: float = 2.5,
    steps: int = 12,
    turn_directions: list[str | None] | None = None,
) -> list[list[float]]:
    """
    Angle-adaptive Bezier smoothing with Geometric D-arc for large U-turns.

    Two modes based on local turn angle:

    Small/medium turns (< ~150°):
      Quadratic fly-by. Cut distance scales linearly with turn_frac.

    Large U-turns (≥ ~150°, typical for missed approach reversals):
      4-point Cubic Geometric D-arc. Mathematically constructed to bulge outward
      perpendicularly to the turn direction by 1.25 NM, achieving the standard
      "teardrop" representation seen on IAP charts instead of a flat hairpin.

    turn_frac = (1-cos θ)/2 : 0 = straight-on, 1 = full 180° reversal.
    """
    if len(path) < 3:
        return path

    small_cut = 0.3  # Minimum cut for nearly straight transitions
    teardrop_threshold = 0.95  # turn_frac above which D-arc is used (~163°+)

    smoothed = [path[0]]

    for i in range(1, len(path) - 1):
        p_a = path[i - 1]
        p_b = path[i]
        p_c = path[i + 1]

        # Explicit turn direction from database (if any)
        forced_dir = turn_directions[i] if turn_directions and i < len(turn_directions) else None

        dist_ab = haversine_nm(p_a[0], p_a[1], p_b[0], p_b[1])
        dist_bc = haversine_nm(p_b[0], p_b[1], p_c[0], p_c[1])

        lat_rad = math.radians(p_b[1])
        cos_lat = math.cos(lat_rad)
        lon_to_nm = cos_lat * 60.04
        lat_to_nm = 60.04

        dx_in, dy_in = p_b[0] - p_a[0], p_b[1] - p_a[1]
        dx_out, dy_out = p_c[0] - p_b[0], p_c[1] - p_b[1]

        mag_in = math.sqrt(dx_in**2 + dy_in**2)
        mag_out = math.sqrt(dx_out**2 + dy_out**2)

        if mag_in > 0 and mag_out > 0:
            cos_a = (dx_in * dx_out + dy_in * dy_out) / (mag_in * mag_out)
            cos_a = max(-1.0, min(1.0, cos_a))
            turn_frac = (1.0 - cos_a) / 2.0
        else:
            turn_frac = 0.0
            cos_a = 1.0

        if turn_frac > teardrop_threshold and dist_ab > 0:
            # ── PROCEDURAL 180° SEMI-CIRCLE D-ARC ─────────────────────────
            # Replaces the twisted Bezier approach with a mathematically pure
            # 1.0 NM fly-over and 1.25 NM lateral semicircle arc.
            dx_in_nm = dx_in * lon_to_nm
            dy_in_nm = dy_in * lat_to_nm
            mag_in_nm = math.sqrt(dx_in_nm**2 + dy_in_nm**2)
            ux_in = dx_in_nm / mag_in_nm if mag_in_nm > 0 else 0
            uy_in = dy_in_nm / mag_in_nm if mag_in_nm > 0 else 0

            # Determine Turn Direction & Sweep
            dx_out_nm = dx_out * lon_to_nm
            dy_out_nm = dy_out * lat_to_nm
            mag_out_nm = math.sqrt(dx_out_nm**2 + dy_out_nm**2)
            ux_out = dx_out_nm / mag_out_nm if mag_out_nm > 0 else 0
            uy_out = dy_out_nm / mag_out_nm if mag_out_nm > 0 else 0

            # Calculate geometric cross product for default "shortest turn"
            cross = ux_in * uy_out - uy_in * ux_out

            # Respect forced direction if provided, otherwise use geometric cross product
            is_left = False
            if forced_dir == "L":
                is_left = True
            elif forced_dir == "R":
                is_left = False
            else:
                is_left = cross >= 0

            if is_left:
                # Left Turn -> Bulge Left, Sweep CCW
                nx, ny = -uy_in, ux_in
                sweep_dir = 1.0
            else:
                # Right Turn -> Bulge Right, Sweep CW
                nx, ny = uy_in, -ux_in
                sweep_dir = -1.0

            arm_nm = 1.0
            radius_nm = 1.25

            c_lon = p_b[0] + (arm_nm * ux_in + radius_nm * nx) / lon_to_nm
            c_lat = p_b[1] + (arm_nm * uy_in + radius_nm * ny) / lat_to_nm

            # Start angle points from center back to the end of the overfly arm
            start_angle = math.atan2(-ny, -nx)

            # The sweep angle should match the actual required turn angle.
            # If we are forcing a direction that is the "longer" way (e.g. 183°),
            # we must adjust the angle.
            angle_rad = math.acos(cos_a)
            if forced_dir:
                # If forced direction differs from shortest geometric direction,
                # use the complementary angle to go the "long way"
                shortest_is_left = cross >= 0
                if (forced_dir == "L" and not shortest_is_left) or (
                    forced_dir == "R" and shortest_is_left
                ):
                    angle_rad = 2 * math.pi - angle_rad

            sweep_angle = angle_rad

            smoothed.append(list(p_b))

            # Draw the 1.0 NM straight overfly to establish the turn entry
            straight_steps = 5
            for j in range(1, straight_steps + 1):
                alpha = j / straight_steps
                # Interpolate altitude if p_c exists and has altitude
                alt = p_b[2]
                if dist_bc > 0 and p_c[2] is not None and p_b[2] is not None:
                    # Rough distance-based interpolation
                    dist_from_b = alpha * arm_nm
                    alt = p_b[2] + (p_c[2] - p_b[2]) * (
                        dist_from_b / max(dist_bc, arm_nm + radius_nm * sweep_angle)
                    )

                smoothed.append(
                    [
                        p_b[0] + alpha * (arm_nm * ux_in) / lon_to_nm,
                        p_b[1] + alpha * (arm_nm * uy_in) / lat_to_nm,
                        alt,
                    ]
                )

            # Draw the clean circular arc sequence
            arc_steps = 15
            for j in range(1, arc_steps + 1):
                fraction = j / arc_steps
                theta = start_angle + sweep_dir * fraction * sweep_angle
                x = c_lon + (radius_nm * math.cos(theta)) / lon_to_nm
                y = c_lat + (radius_nm * math.sin(theta)) / lat_to_nm

                alt = p_b[2]
                if dist_bc > 0 and p_c[2] is not None and p_b[2] is not None:
                    dist_from_b = arm_nm + (fraction * radius_nm * sweep_angle)
                    alt = p_b[2] + (p_c[2] - p_b[2]) * (
                        dist_from_b / max(dist_bc, arm_nm + radius_nm * sweep_angle)
                    )

                smoothed.append([x, y, alt])

            # Post-arc naturally connects via straight line string to the next fix

        else:
            # ── QUADRATIC FLY-BY for small/medium turns ──────────────────────────
            adaptive_max = small_cut + (max_turn_dist_nm - small_cut) * turn_frac
            cut_ab = min(adaptive_max, dist_ab * 0.45) if dist_ab > 0 else 0
            cut_bc = min(adaptive_max, dist_bc * 0.45) if dist_bc > 0 else 0

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
                x = (inv_t**2) * q0[0] + 2 * inv_t * t * p_b[0] + (t**2) * q2[0]
                y = (inv_t**2) * q0[1] + 2 * inv_t * t * p_b[1] + (t**2) * q2[1]
                z = (inv_t**2) * q0[2] + 2 * inv_t * t * p_b[2] + (t**2) * q2[2]
                smoothed.append([x, y, z])

            smoothed.append(q2)

    smoothed.append(path[-1])
    return smoothed


def extract_true_course(course_str: str | None) -> float | None:
    """Parses true course in degrees from two common formats:
    - Slash-separated:   '299.41° Mag /297.66° True'  → 297.66
    - Parenthesis-style: '266.94°(265.44°)'            → 265.44
    Returns None if parsing fails.
    """
    if not course_str:
        return None
    s = str(course_str).strip()

    # Format 1: "NNN.NN° Mag / NNN.NN° True"  (slash separator)
    if "/" in s:
        after_slash = s.split("/", 1)[1]
        m = re.search(r"([\d\.]+)", after_slash)
        if m:
            try:
                return float(m.group(1))
            except ValueError:
                pass

    # Format 2: "NNN.NN°(NNN.NN°)"
    m = re.search(r"\(\D*([\d\.]+)\D*\)", s)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            pass

    return None


def extract_altitude(leg: Any) -> float | None:
    """Extracts numeric altitude in feet from altitude_numeric or altitude_constraint."""
    if leg.altitude_numeric is not None:
        try:
            val = float(leg.altitude_numeric)
            if val > 0:
                return val
        except ValueError, TypeError:
            pass

    if leg.altitude_constraint:
        s = str(leg.altitude_constraint).strip().upper()
        # Handle formats like "+5100.00", "5100", "FL150"
        m = re.search(r"(\d+)", s)
        if m:
            val = float(m.group(1))
            if "FL" in s:
                return val * 100.0
            return val
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


def build_3d_paths(
    proc_row: Any, legs_rows: Sequence[Any], runway_threshold: list[float] | None = None
) -> RnpPath3dResponse:
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

        # Truncate raw_missed_approach to only include up to and including the FIRST
        # HM (hold-in-manual) leg encountered after the runway.
        truncated_missed = []
        for leg in raw_missed_approach:
            truncated_missed.append(leg)
            if leg.path_descriptor == "HM":
                break
        raw_missed_approach = truncated_missed

        initial_groups = [
            g
            for g in groups[: groups.index(final_group)]
            if g != final_group and not (len(g) == 1 and g[0].path_descriptor == "HM")
        ]
    else:
        # For SIDs and STARs that have no "RW" waypoint, we process all groups
        # as single continuous tracks without any further "final approach" extension.
        final_approach = []
        raw_missed_approach = []
        initial_groups = [g for g in groups if not (len(g) == 1 and g[0].path_descriptor == "HM")]

    def extract_path(
        legs_list: list,
        start_alt_ft: float = 10000.0,
        initial_pos: list[float] | None = None,
        end_alt_ft: float | None = None,
    ) -> tuple[list[list[float]], list[float | None], list[str | None]]:
        path_3d = []
        leg_indices: list[int | None] = []
        turn_directions: list[str | None] = []

        if initial_pos:
            path_3d.append(list(initial_pos))
            turn_directions.append(None)

        for leg in legs_list:
            alt_ft = extract_altitude(leg)
            alt_m = alt_ft * FT_TO_M if alt_ft is not None else None

            # The turn direction in the database (L/R) describes the turn
            # required to ENTER this leg. Therefore, it applies to the turn
            # at the PREVIOUS waypoint (the one currently at the end of path_3d).
            turn_dir = None
            if hasattr(leg, "turn_direction") and leg.turn_direction:
                turn_dir = str(leg.turn_direction).strip().upper()
            elif (
                isinstance(leg, dict)
                and leg.get("turn_direction")
                and str(leg["turn_direction"]).strip()
            ):
                turn_dir = str(leg["turn_direction"]).strip().upper()

            if turn_dir in ["L", "R"] and turn_directions:
                turn_directions[-1] = turn_dir

            if leg.lon is not None and leg.lat is not None:
                if not path_3d or (path_3d[-1][0] != leg.lon or path_3d[-1][1] != leg.lat):
                    path_3d.append([leg.lon, leg.lat, alt_m])
                    leg_indices.append(len(path_3d) - 1)
                    turn_directions.append(None)
                else:
                    if alt_m is not None and path_3d[-1][2] is None:
                        path_3d[-1][2] = alt_m
                    leg_indices.append(len(path_3d) - 1)
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
                        leg_indices.append(len(path_3d) - 1)
                        turn_directions.append(None)
                    else:
                        leg_indices.append(None)
                else:
                    leg_indices.append(None)

        if not path_3d:
            return [], [], []

        if path_3d[0][2] is None:
            path_3d[0][2] = start_alt_ft * FT_TO_M
        if path_3d[-1][2] is None:
            path_3d[-1][2] = end_alt_ft * FT_TO_M if end_alt_ft is not None else path_3d[0][2]

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

        # Map interpolated altitudes back to the original legs.
        leg_alts = [path_3d[idx][2] if idx is not None else None for idx in leg_indices]

        return path_3d, leg_alts, turn_directions

    def process_path(raw_path, turn_dirs: list[str | None] | None = None):
        if len(raw_path) < 2:
            return [], [], 0.0
        path_smoothed = smooth_path_3d(
            raw_path, max_turn_dist_nm=2.5, steps=16, turn_directions=turn_dirs
        )
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

    # SID/STAR context: initial_pos is the runway threshold for SIDs
    is_sid = hasattr(proc_row, "type") and proc_row.type == "SID"
    initial_pos = runway_threshold if is_sid else None

    waypoint_altitudes = {}

    if not initial_groups and final_approach:
        p3d, leg_alts, turn_dirs = extract_path(final_approach, initial_pos=initial_pos)
        for leg, alt in zip(final_approach, leg_alts, strict=True):
            if leg.waypoint_ident and alt is not None:
                waypoint_altitudes[leg.waypoint_ident] = alt

        smooth_p, ts, dist = process_path(p3d, turn_dirs=turn_dirs)
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
        ident_counts = {}
        for ig in initial_groups:
            full_legs = ig.copy()
            if final_approach:
                if full_legs[-1].waypoint_ident == final_approach[0].waypoint_ident:
                    full_legs.extend(final_approach[1:])
                else:
                    full_legs.extend(final_approach)

            p3d, leg_alts, turn_dirs = extract_path(
                full_legs, initial_pos=initial_pos, end_alt_ft=10000.0 if is_sid else None
            )
            for leg, alt in zip(full_legs, leg_alts, strict=True):
                if leg.waypoint_ident and alt is not None:
                    waypoint_altitudes[leg.waypoint_ident] = alt

            smooth_p, ts, dist = process_path(p3d, turn_dirs=turn_dirs)
            if smooth_p:
                # Identification Logic:
                # For SIDs, use the EXIT waypoint (transition) as the identifier.
                # For STARs/Approaches, use the ENTRY waypoint (IAF).
                if is_sid:
                    ident = next(
                        (leg.waypoint_ident for leg in reversed(ig) if leg.waypoint_ident), "START"
                    )
                else:
                    ident = next((leg.waypoint_ident for leg in ig if leg.waypoint_ident), "START")

                # Ensure uniqueness
                ident_counts[ident] = ident_counts.get(ident, 0) + 1
                unique_ident = ident
                if ident_counts[ident] > 1:
                    unique_ident = f"{ident}-{ident_counts[ident]}"

                approach_paths.append(
                    RnpApproachPath(
                        label=f"via {unique_ident}",
                        entry_waypoint=unique_ident,
                        path=smooth_p,
                        timestamps=ts,
                        total_distance_nm=dist,
                        segment_type="approach",
                    )
                )

    missed_approach_path = None
    if raw_missed_approach:
        start_alt_ft = extract_altitude(raw_missed_approach[0]) or 10000.0
        p3d, leg_alts, turn_dirs = extract_path(
            raw_missed_approach, start_alt_ft=start_alt_ft, end_alt_ft=10000.0 if is_sid else 0.0
        )
        for leg, alt in zip(raw_missed_approach, leg_alts, strict=True):
            if leg.waypoint_ident and alt is not None:
                waypoint_altitudes[leg.waypoint_ident] = alt

        smooth_p, ts, dist = process_path(p3d, turn_dirs=turn_dirs)
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
            # Use interpolated altitude as fallback if explicit one is missing
            alt_m = extract_altitude(leg)
            if alt_m is not None:
                alt_m *= FT_TO_M
            else:
                alt_m = waypoint_altitudes.get(w_id, 0.0)

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
