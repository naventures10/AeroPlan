# RNP Chart Table Headers Analysis Report

Total Unique Raw Headers Found: 367

## ⚠️ Headers Mapping to 'unknown'
These headers do not match any rules in `sanitize_header` and might contain missing data.

| Raw Header | Count | Sample Files |
|---|---|---|
| `(ft)` | 24 | VEAY-RNP-RWY-11.md, VEAY-RNP-RWY-29.md, VEAY-RNP-RWY.md, VEIM-SID-RNP1-GNSS-RWY-04.md, VEIM-SID-RNP1-GNSS-RWY.md |
| `(Kt)` | 24 | VEAY-RNP-RWY-11.md, VEAY-RNP-RWY-29.md, VEAY-RNP-RWY.md, VEIM-SID-RNP1-GNSS-RWY-04.md, VEIM-SID-RNP1-GNSS-RWY.md |
| `°` | 10 | VEIM-SID-RNP1-GNSS-RWY-04.md, VEIM-SID-RNP1-GNSS-RWY.md, VEPT-RNP-Y-RWY-25.md, VEPT-RNP-Y-RWY.md, VEPY-SID-RWY-20-BGD1-RNP1-GNSS.md |
| `(Minimum resolution - DD:MM:SS.SS)` | 2 | VOHY-RNP-Y-RWY-27.md, VOHY-RNP-Y-RWY.md |
| `°M(°T)` | 1 | VORY-RNP-Z-RWY-23-CODING.md |

---

## 📋 All Table Headers and Mappings
Sorted by occurrence count.

| Raw Header | Count | Sanitized Key | Sample Files |
|---|---|---|---|
| `Waypoint Identifier` | 283 | `waypoint_identifier` | VAAH-RNP-RWY-05.md, VAAH-RNP-RWY-23.md, VAAH-RNP-RWY.md, VAAU-RNP-Y-RWY-09.md, VAAU-RNP-Y-RWY-27.md |
| `Navigation Specification` | 204 | `nav_spec` | VAAH-RNP-RWY-05.md, VAAH-RNP-RWY-23.md, VAAH-RNP-RWY.md, VAAU-RNP-Y-RWY-09.md, VAAU-RNP-Y-RWY-27.md |
| `Path Descriptor` | 179 | `path_descriptor` | VAAH-RNP-RWY-05.md, VAAH-RNP-RWY-23.md, VAAH-RNP-RWY.md, VAAU-RNP-Y-RWY-09.md, VAAU-RNP-Y-RWY-27.md |
| `Fly Over` | 170 | `fly_over` | VAAH-RNP-RWY-05.md, VAAH-RNP-RWY-23.md, VAAH-RNP-RWY.md, VAAU-RNP-Y-RWY-09.md, VAAU-RNP-Y-RWY-27.md |
| `Turn Direction` | 161 | `turn_direction` | VAAH-RNP-RWY-05.md, VAAH-RNP-RWY-23.md, VAAH-RNP-RWY.md, VAAU-RNP-Y-RWY-09.md, VAAU-RNP-Y-RWY-27.md |
| `Serial Number` | 160 | `serial_number` | VAAH-RNP-RWY-05.md, VAAH-RNP-RWY-23.md, VAAH-RNP-RWY.md, VAAU-RNP-Y-RWY-09.md, VAAU-RNP-Y-RWY-27.md |
| `Coordinates` | 124 | `coordinates` | VAAU-RNP-Y-RWY-09.md, VAAU-RNP-Y-RWY-27.md, VAAU-RNP-Y-RWY.md, VABB-RNP-Y-RWY-14.md, VABB-RNP-Y-RWY.md |
| `Course °M(°T)` | 119 | `course` | VAAH-RNP-RWY-05.md, VAAH-RNP-RWY-23.md, VAAH-RNP-RWY.md, VABB-RNP-Y-RWY-09.md, VABB-RNP-Y-RWY-14.md |
| `Speed Limit` | 83 | `speed_limit` | VAJL-RNP-RWY-27.md, VAJL-RNP-RWY.md, VAJL-RNP-Z-RWY-09.md, VAJL-RNP-Z-RWY.md, VASD-RNP-Y-RWY-27.md |
| `Altitude` | 78 | `altitude` | VAJL-RNP-RWY-27.md, VAJL-RNP-RWY.md, VAJL-RNP-Z-RWY-09.md, VAJL-RNP-Z-RWY.md, VEAY-RNP-RWY-11.md |
| `VPA/TCH` | 59 | `vpa_tch` | VAJL-RNP-RWY-27.md, VAJL-RNP-RWY.md, VAJL-RNP-Z-RWY-09.md, VAJL-RNP-Z-RWY.md, VASD-RNP-Y-RWY-27.md |
| `Speed Limit (Kt)` | 58 | `speed_limit` | VAAH-RNP-RWY-05.md, VAAH-RNP-RWY-23.md, VAAH-RNP-RWY.md, VABB-RNP-Y-RWY-09.md, VABB-RNP-Y-RWY.md |
| `Waypoint
Identifier` | 53 | `waypoint_identifier` | VAJL-RNP-RWY-27.md, VAJL-RNP-RWY.md, VAJL-RNP-Z-RWY-09.md, VAJL-RNP-Z-RWY.md, VASU-RNP-RWY-04.md |
| `COORDINATES` | 49 | `coordinates` | VAAH-RNP-RWY-05.md, VAAH-RNP-RWY-23.md, VAAH-RNP-RWY.md, VABB-RNP-Y-RWY-09.md, VABB-RNP-Y-RWY.md |
| `WAYPOINT IDENTIFIER` | 47 | `waypoint_identifier` | VAAH-RNP-RWY-05.md, VAAH-RNP-RWY-23.md, VAAH-RNP-RWY.md, VABO-RNP-Y-RWY-04.md, VABO-RNP-Y-RWY-22.md |
| `Distance NM` | 41 | `distance` | VAAH-RNP-RWY-05.md, VAAH-RNP-RWY-23.md, VAAH-RNP-RWY.md, VABB-RNP-Y-RWY-09.md, VABB-RNP-Y-RWY.md |
| `Altitude ft` | 41 | `altitude` | VABP-RNP-Y-RWY-12.md, VABP-RNP-Y-RWY-30.md, VABP-RNP-Y-RWY.md, VAHS-RNP-RWY-23.md, VAHS-RNP-RWY.md |
| `Speed Limit kt` | 41 | `speed_limit` | VABP-RNP-Y-RWY-12.md, VABP-RNP-Y-RWY-30.md, VABP-RNP-Y-RWY.md, VAHS-RNP-RWY-23.md, VAHS-RNP-RWY.md |
| `Course °M (°T)` | 37 | `course` | VABP-RNP-Y-RWY-12.md, VABP-RNP-Y-RWY-30.md, VABP-RNP-Y-RWY.md, VAHS-RNP-RWY-23.md, VAHS-RNP-RWY.md |
| `Fly-Over` | 36 | `fly_over` | VEBU RNP RWY- 35.md, VEDO-RNP-Y-RWY-09.md, VEDO-RNP-Y-RWY.md, VEJR-RNP-Y-RWY-24.md, VEJR-RNP-Y-RWY.md |
| `Altitude (FT)` | 35 | `altitude` | VAAH-RNP-RWY-05.md, VAAH-RNP-RWY-23.md, VAAH-RNP-RWY.md, VABB-RNP-Y-RWY-09.md, VABB-RNP-Y-RWY.md |
| `VPA/TCH °/FT` | 34 | `vpa_tch` | VAAU-RNP-Y-RWY-09.md, VAAU-RNP-Y-RWY-27.md, VAAU-RNP-Y-RWY.md, VABP-RNP-Y-RWY-12.md, VABP-RNP-Y-RWY-30.md |
| `Turn` | 32 | `turn_direction` | VABB-RNP-Y-RWY-14.md, VABB-RNP-Y-RWY.md, VASD-RNP-Y-RWY-09.md, VASD-RNP-Y-RWY-27.md, VASD-RNP-Y-RWY.md |
| `Type` | 31 | `type` | VASD-RNP-Y-RWY-09.md, VASD-RNP-Y-RWY.md, VEBN-RNP-Y-RWY-09.md, VEBN-RNP-Y-RWY-27.md, VEBN-RNP-Y-RWY.md |
| `ft` | 31 | `ft` | VASD-RNP-Y-RWY-27.md, VASD-RNP-Y-RWY.md, VECC-RNP-Y-RWY-01L.md, VECC-RNP-Y-RWY-01R.md, VECC-RNP-Y-RWY-19L.md |
| `Distance/ Time` | 29 | `distance` | VEAY-RNP-RWY-11.md, VEAY-RNP-RWY-29.md, VEAY-RNP-RWY.md, VEIM-SID-RNP1-GNSS-RWY-22-TABLE.md, VIKG-RNP-Z-RWY-05.md |
| `VPA/ TCH °/ Ft` | 28 | `vpa_tch` | VAAH-RNP-RWY-05.md, VAAH-RNP-RWY-23.md, VAAH-RNP-RWY.md, VABB-RNP-Y-RWY-09.md, VABB-RNP-Y-RWY.md |
| `Altitude (ft)` | 27 | `altitude` | VEBU RNP RWY- 35.md, VEDO-RNP-Y-RWY-09.md, VEDO-RNP-Y-RWY-27.md, VEDO-RNP-Y-RWY.md, VEDO-RNP-Z-RWY-27.md |
| `NM/Min` | 26 | `nm_min` | VEAY-RNP-RWY-11.md, VEAY-RNP-RWY-29.md, VEAY-RNP-RWY.md, VEIM-SID-RNP1-GNSS-RWY-04.md, VEIM-SID-RNP1-GNSS-RWY.md |
| `Navigation 
Specification` | 25 | `nav_spec` | VAJL-RNP-RWY-27.md, VAJL-RNP-RWY.md, VAJL-RNP-Z-RWY-09.md, VAJL-RNP-Z-RWY.md, VOBL-RNP-RWY-09L.md |
| `Serial
Number` | 24 | `serial_number` | VAJL-RNP-RWY-27.md, VAJL-RNP-RWY.md, VAJL-RNP-Z-RWY-09.md, VAJL-RNP-Z-RWY.md, VOBL-RNP-Y-RWY-27R.md |
| `Turn
Direction` | 24 | `turn_direction` | VAJL-RNP-RWY-27.md, VAJL-RNP-RWY.md, VAJL-RNP-Z-RWY-09.md, VAJL-RNP-Z-RWY.md, VOBL-RNP-RWY-09L.md |
| `(ft)` | 24 | `unknown` | VEAY-RNP-RWY-11.md, VEAY-RNP-RWY-29.md, VEAY-RNP-RWY.md, VEIM-SID-RNP1-GNSS-RWY-04.md, VEIM-SID-RNP1-GNSS-RWY.md |
| `(Kt)` | 24 | `unknown` | VEAY-RNP-RWY-11.md, VEAY-RNP-RWY-29.md, VEAY-RNP-RWY.md, VEIM-SID-RNP1-GNSS-RWY-04.md, VEIM-SID-RNP1-GNSS-RWY.md |
| `Course 
0M(0T)` | 22 | `course` | VAJL-RNP-RWY-27.md, VAJL-RNP-RWY.md, VAJL-RNP-Z-RWY-09.md, VAJL-RNP-Z-RWY.md, VOBL-RNP-Y-RWY-27R.md |
| `kt` | 22 | `kt` | VASD-RNP-Y-RWY-27.md, VASD-RNP-Y-RWY.md, VECC-RNP-Y-RWY-01L.md, VECC-RNP-Y-RWY-01R.md, VECC-RNP-Y-RWY-19L.md |
| `Path
Descriptor` | 21 | `path_descriptor` | VAJL-RNP-RWY-27.md, VAJL-RNP-RWY.md, VAJL-RNP-Z-RWY-09.md, VAJL-RNP-Z-RWY.md, VOBL-RNP-Y-RWY-27R.md |
| `°/ft` | 21 | `ft` | VEAY-RNP-RWY-11.md, VEAY-RNP-RWY-29.md, VEAY-RNP-RWY.md, VECC-RNP-Y-RWY-01L.md, VECC-RNP-Y-RWY-01R.md |
| `Fly 
Over` | 20 | `fly_over` | VAJL-RNP-RWY-27.md, VAJL-RNP-RWY.md, VAJL-RNP-Z-RWY-09.md, VAJL-RNP-Z-RWY.md, VOBL-RNP-Y-RWY-27R.md |
| `Ident` | 20 | `waypoint_identifier` | VASD-RNP-Y-RWY-09.md, VASD-RNP-Y-RWY-27.md, VASD-RNP-Y-RWY.md, VEBN-RNP-Y-RWY-09.md, VEBN-RNP-Y-RWY-27.md |
| `VA/TCH` | 20 | `vpa_tch` | VECC-RNP-Y-RWY-01L.md, VECC-RNP-Y-RWY-01R.md, VECC-RNP-Y-RWY-19L.md, VECC-RNP-Y-RWY-19R.md, VEKO-RNP-Y-RWY-01.md |
| `Distance/Time` | 19 | `distance` | VEIM-SID-RNP1-GNSS-RWY-04.md, VEIM-SID-RNP1-GNSS-RWY.md, VOBL-RNP-RWY-09L.md, VOBL-RNP-Y-RWY-27R.md, VOBZ-RNP-RWY-08.md |
| `Waypoint` | 18 | `waypoint_identifier` | VABB-RNP-Y-RWY-14.md, VABB-RNP-Y-RWY.md, VABP-RNP-Y-RWY-12.md, VABP-RNP-Y-RWY-30.md, VABP-RNP-Y-RWY.md |
| `Distance/
Time` | 18 | `distance` | VAJL-RNP-RWY-27.md, VAJL-RNP-RWY.md, VAJL-RNP-Z-RWY-09.md, VAJL-RNP-Z-RWY.md, VOBM-RNP-Y-RWY-08.md |
| `VA` | 18 | `va` | VEIM-SID-RNP1-GNSS-RWY-04.md, VEIM-SID-RNP1-GNSS-RWY-22-TABLE.md, VEIM-SID-RNP1-GNSS-RWY.md, VEPT-RNP-Y-RWY-25.md, VEPT-RNP-Y-RWY.md |
| `Turn direction` | 17 | `turn_direction` | VEKI-RNP-Y-RWY-11.md, VEKI-RNP-Y-RWY-29.md, VEKI-RNP-Y-RWY.md, VOCB-RNP-Y-RWY-23.md, VOCB-RNP-Y-RWY.md |
| `Latitude/Longitude (WGS84)(DD:MM:SS.SS)` | 16 | `latitude_longitude` | VABV-RNP-Y-RWY-25.md, VABV-RNP-Y-RWY.md, VEGY-RNP-Y-RWY-28.md, VEGY-RNP-Y-RWY.md, VEPY-RNP-Y-RWY-02.md |
| `Lower Limit Altitude` | 16 | `altitude` | VASD-RNP-Y-RWY-27.md, VASD-RNP-Y-RWY.md, VEKO-RNP-Y-RWY-01.md, VEKO-RNP-Y-RWY-19.md, VEKO-RNP-Y-RWY.md |
| `Latitude/Longitude (WGS84)(Minimum resolution - DD:MM:SS.SS)` | 16 | `latitude_longitude` | VASD-RNP-Y-RWY-27.md, VASD-RNP-Y-RWY.md, VECC-RNP-Y-RWY-01L.md, VECC-RNP-Y-RWY-01R.md, VECC-RNP-Y-RWY-19L.md |
| `Fix Ident` | 16 | `waypoint_identifier` | VEBN-RNP-Y-RWY-09.md, VEBN-RNP-Y-RWY-27.md, VEBN-RNP-Y-RWY.md, VECC-RNP-Y-RWY-01L.md, VECC-RNP-Y-RWY-01R.md |
| `Distance (NM)` | 15 | `distance` | VEDO-RNP-Z-RWY-27.md, VEDO-RNP-Z-RWY.md, VEJR-RNP-Y-RWY-24.md, VEJR-RNP-Y-RWY.md, VEKI-RNP-Y-RWY-11.md |
| `VPA/TCH °/ft` | 14 | `vpa_tch` | VAHS-RNP-RWY-23.md, VAHS-RNP-RWY.md, VAHS-RNP-Y-RWY-05.md, VAHS-RNP-Y-RWY.md, VEBS-RNP-Y-RWY-14.md |
| `Seq Num` | 14 | `serial_number` | VEBN-RNP-Y-RWY-09.md, VEBN-RNP-Y-RWY-27.md, VEBN-RNP-Y-RWY.md, VECC-RNP-Y-RWY-01L.md, VECC-RNP-Y-RWY-01R.md |
| `Course Angle` | 14 | `course` | VEBN-RNP-Y-RWY-09.md, VEBN-RNP-Y-RWY-27.md, VEBN-RNP-Y-RWY.md, VECC-RNP-Y-RWY-01L.md, VECC-RNP-Y-RWY-01R.md |
| `Distance /Time NM/Min` | 13 | `distance` | VABP-RNP-Y-RWY-12.md, VABP-RNP-Y-RWY-30.md, VABP-RNP-Y-RWY.md, VAKP-RNP-RWY-25.md, VAKP-RNP-RWY.md |
| `Path and Terminator` | 13 | `path_descriptor` | VEBN-RNP-Y-RWY-09.md, VEBN-RNP-Y-RWY.md, VECC-RNP-Y-RWY-01L.md, VECC-RNP-Y-RWY-01R.md, VECC-RNP-Y-RWY-19L.md |
| `VPA/TCH (°/ft)` | 13 | `vpa_tch` | VEBU RNP RWY- 35.md, VEDO-RNP-Y-RWY-09.md, VEDO-RNP-Y-RWY-27.md, VEDO-RNP-Y-RWY.md, VEDO-RNP-Z-RWY-27.md |
| `TM DST` | 13 | `distance` | VECC-RNP-Y-RWY-01L.md, VECC-RNP-Y-RWY-01R.md, VECC-RNP-Y-RWY-19L.md, VECC-RNP-Y-RWY-19R.md, VEPT-RNP-Y-RWY-25.md |
| `°/FT` | 13 | `ft` | VEKO-RNP-Y-RWY-01.md, VEKO-RNP-Y-RWY-19.md, VEKO-RNP-Y-RWY.md, VIKG-RNP-Z-RWY-05.md, VIKG-RNP-Z-RWY-23.md |
| `Serial No.` | 11 | `serial_number` | VABV-RNP-Y-RWY-25.md, VABV-RNP-Y-RWY.md, VEKO-RNP-Y-RWY-01.md, VEKO-RNP-Y-RWY.md, VIKG-RNP-Y-RWY-05.md |
| `Path Terminator` | 11 | `path_descriptor` | VEBN-RNP-Y-RWY-27.md, VEBN-RNP-Y-RWY.md, VECC-RNP-Y-RWY-19R.md, VIJP-RNP-Y-RWY-08.md, VIJP-RNP-Y-RWY.md |
| `NM` | 11 | `nm` | VECC-RNP-Y-RWY-01L.md, VECC-RNP-Y-RWY-01R.md, VECC-RNP-Y-RWY-19L.md, VECC-RNP-Y-RWY-19R.md, VEPT-RNP-Y-RWY-25.md |
| `Lower Limit Altitude (FT)` | 11 | `altitude` | VEPY-RNP-Y-RWY-02.md, VEPY-RNP-Y-RWY.md, VIJP-RNP-Y-RWY-08.md, VIJP-RNP-Y-RWY.md, VIKG-RNP-Y-RWY-05.md |
| `Speed Limit (KT)` | 11 | `speed_limit` | VEPY-RNP-Y-RWY-02.md, VEPY-RNP-Y-RWY.md, VIJP-RNP-Y-RWY-08.md, VIJP-RNP-Y-RWY.md, VIKG-RNP-Y-RWY-05.md |
| `Altitude (Ft)` | 10 | `altitude` | VEBN-RNP-Y-RWY-09.md, VEBN-RNP-Y-RWY-27.md, VEBN-RNP-Y-RWY.md, VILK-RNP-Y-RWY-27.md, VILK-RNP-Y-RWY.md |
| `°` | 10 | `unknown` | VEIM-SID-RNP1-GNSS-RWY-04.md, VEIM-SID-RNP1-GNSS-RWY.md, VEPT-RNP-Y-RWY-25.md, VEPT-RNP-Y-RWY.md, VEPY-SID-RWY-20-BGD1-RNP1-GNSS.md |
| `Role` | 9 | `role` | VASD-RNP-Y-RWY-09.md, VASD-RNP-Y-RWY-27.md, VASD-RNP-Y-RWY.md, VEGY-RNP-Y-RWY-28.md, VEGY-RNP-Y-RWY.md |
| `Upper Limit Altitude` | 9 | `altitude` | VEKO-RNP-Y-RWY-01.md, VEKO-RNP-Y-RWY-19.md, VEKO-RNP-Y-RWY.md, VEPY-SID-RWY-20-BGD1-RNP1-GNSS.md, VIKG-RNP-Z-RWY-05.md |
| `NM/MIN` | 9 | `nm_min` | VEKO-RNP-Y-RWY-01.md, VEKO-RNP-Y-RWY-19.md, VEKO-RNP-Y-RWY.md, VIKG-RNP-Z-RWY-05.md, VIKG-RNP-Z-RWY-23.md |
| `Airport Identifier` | 9 | `waypoint_identifier` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOCP-RNP-Z-RWY-29-CODING.md |
| `NavigationSpecification` | 8 | `nav_spec` | VANM-RNP-RWY-26.md, VANM-RNP-RWY.md, VEGY-RNP-Y-RWY-28.md, VEGY-RNP-Y-RWY.md, VIAR-RNP-Y-RWY-16.md |
| `Distance/Time NM/Min` | 8 | `distance` | VANM-RNP-Y-RWY-08.md, VANM-RNP-Y-RWY.md, VEBS-RNP-Y-RWY-14.md, VEBS-RNP-Y-RWY-32.md, VEBS-RNP-Y-RWY.md |
| `SBAS Provider` | 8 | `sbas_provider` | VEDO-RNP-Z-RWY-27.md, VEDO-RNP-Z-RWY.md, VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md |
| `FIX IDENT` | 8 | `waypoint_identifier` | VIJP-RNP-Y-RWY-08.md, VIJP-RNP-Y-RWY.md, VILK-RNP-Y-RWY-09.md, VILK-RNP-Y-RWY.md, VOML-RNP-Y-RWY-06.md |
| `Function` | 8 | `role` | VILK-RNP-Y-RWY-27.md, VILK-RNP-Y-RWY.md, VOCL-RNP-Y-RWY-10.md, VOCL-RNP-Y-RWY-28.md, VOCL-RNP-Y-RWY.md |
| `Latitude` | 8 | `latitude` | VILK-RNP-Y-RWY-27.md, VILK-RNP-Y-RWY.md, VOCL-RNP-Y-RWY-10.md, VOCL-RNP-Y-RWY-28.md, VOCL-RNP-Y-RWY.md |
| `Longitude` | 8 | `longitude` | VILK-RNP-Y-RWY-27.md, VILK-RNP-Y-RWY.md, VOCL-RNP-Y-RWY-10.md, VOCL-RNP-Y-RWY-28.md, VOCL-RNP-Y-RWY.md |
| `Speed 
Limit` | 8 | `speed_limit` | VOBL-RNP-RWY-09L.md, VOBL-RNP-Y-RWY-27R.md, VOGA-RNP-RWY-28.md, VOGA-RNP-RWY.md, VOHS-RNP-Y-RWY-09L.md |
| `Speed limit (Kts)` | 8 | `speed_limit` | VOCB-RNP-Y-RWY-23.md, VOCB-RNP-Y-RWY.md, VOCI-RNP-RWY-09.md, VOCI-RNP-RWY.md, VOGB-RNP-Y-RWY-27.md |
| `TurnDirection` | 7 | `turn_direction` | VANM-RNP-RWY-26.md, VANM-RNP-RWY.md, VEGY-RNP-Y-RWY-28.md, VEGY-RNP-Y-RWY.md, VIAR-RNP-Y-RWY-16.md |
| `VA/ TCH (°/FT)` | 7 | `vpa_tch` | VEPY-RNP-Y-RWY-02.md, VEPY-RNP-Y-RWY.md, VIKG-RNP-Y-RWY-05.md, VIKG-RNP-Y-RWY-23.md, VIKG-RNP-Y-RWY.md |
| `RNP Y RWY 09` | 6 | `rnp_y_rwy_09` | VAAU-RNP-Y-RWY-09.md, VAAU-RNP-Y-RWY.md, VOSR-RNP-Y-RWY-09.md, VOSR-RNP-Y-RWY.md |
| `RNP Y RWY 27` | 6 | `rnp_y_rwy_27` | VAAU-RNP-Y-RWY-27.md, VAAU-RNP-Y-RWY.md, VOGB-RNP-Y-RWY-27.md, VOGB-RNP-Y-RWY.md, VOSR-RNP-Y-RWY-27.md |
| `Distance/ Time NM/Min` | 6 | `distance` | VANP-RNP-Y-RWY-32.md, VANP-RNP-Y-RWY.md, VAPR-RNP-Y-RWY-09.md, VAPR-RNP-Y-RWY-27.md, VAPR-RNP-Y-RWY.md |
| `TM DST(NM)` | 6 | `distance` | VEBN-RNP-Y-RWY-09.md, VEBN-RNP-Y-RWY-27.md, VEBN-RNP-Y-RWY.md, VOML-RNP-Y-RWY-24.md, VOML-RNP-Y-RWY.md |
| `Latitude/Longitude (WGS84)` | 6 | `latitude_longitude` | VEBN-RNP-Y-RWY-09.md, VEBN-RNP-Y-RWY-27.md, VEBN-RNP-Y-RWY.md, VOHY-RNP-Y-RWY-27.md, VOHY-RNP-Y-RWY.md |
| `Role Of The Fix` | 6 | `role` | VECC-RNP-Y-RWY-01L.md, VECC-RNP-Y-RWY-01R.md, VECC-RNP-Y-RWY-19L.md, VECC-RNP-Y-RWY-19R.md, VEPT-RNP-Y-RWY-25.md |
| `Distance (NM)/Time(min)` | 6 | `distance` | VEDO-RNP-Y-RWY-09.md, VEDO-RNP-Y-RWY-27.md, VEDO-RNP-Y-RWY.md, VOPB-RNP-Y-RWY-04.md, VOPB-RNP-Y-RWY.md |
| `VPA/ TCH (°/ Ft)` | 6 | `vpa_tch` | VEGT-RNP-RWY-02.md, VEGT-RNP-RWY.md, VEHO-RNP-Y-RWY-26.md, VEHO-RNP-Y-RWY.md, VEMR-RNP-RWY-12.md |
| `Sequence Number` | 6 | `serial_number` | VEGY-RNP-Y-RWY-28.md, VEGY-RNP-Y-RWY.md, VIJP-RNP-Y-RWY-08.md, VIJP-RNP-Y-RWY.md, VILK-RNP-Y-RWY-09.md |
| `Course Angle0M(0T)` | 6 | `course` | VIJP-RNP-Y-RWY-08.md, VIJP-RNP-Y-RWY.md, VILK-RNP-Y-RWY-09.md, VILK-RNP-Y-RWY.md, VOML-RNP-Y-RWY-06.md |
| `Operation Type` | 6 | `operation_type` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `Runway` | 6 | `runway` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `Runway Letter` | 6 | `runway_letter` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `Approach Performance Designator` | 6 | `path_descriptor` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `Route Indicator` | 6 | `route_indicator` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `Reference Path Data Selector` | 6 | `path_descriptor` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `Reference Path Identifier` | 6 | `waypoint_identifier` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `LTP/FTP Latitude` | 6 | `ltp_ftp_latitude` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `LTP/FTP Longitude` | 6 | `ltp_ftp_longitude` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `LTP/FTP Ellipsoidal Height (metres)` | 6 | `ltp_ftp_ellipsoidal_height` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `FPAP Latitude` | 6 | `fpap_latitude` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `Delta FPAP Latitude (seconds)` | 6 | `delta_fpap_latitude` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `FPAP Longitude` | 6 | `fpap_longitude` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `Delta FPAP Longitude (seconds)` | 6 | `delta_fpap_longitude` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `Threshold Crossing Height` | 6 | `threshold_crossing_height` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `TCH Units Selector` | 6 | `vpa_tch` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `Glidepath Angle (degrees)` | 6 | `path_descriptor` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `Course Width (metres)` | 6 | `course` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `Length Offset (metres)` | 6 | `length_offset` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `HAL (metres)` | 6 | `hal` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `VAL (metres)` | 6 | `val` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `Data Block` | 6 | `data_block` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `Calculated CRC Value` | 6 | `calculated_crc_value` | VIPT-RNP-Z-RWY-10.md, VIPT-RNP-Z-RWY-28.md, VIPT-RNP-Z-RWY.md, VOCP-RNP-Z-RWY-11-CODING.md, VOGO-RNP-RWY-26-CODING.md |
| `Distance (Nm)` | 6 | `distance` | VOCB-RNP-Y-RWY-23.md, VOCB-RNP-Y-RWY.md, VOGB-RNP-Y-RWY-27.md, VOGB-RNP-Y-RWY.md, VOVZ-RNP-Y-RWY-28.md |
| `Role of the Fix` | 6 | `role` | VOCL-RNP-Y-RWY-10.md, VOCL-RNP-Y-RWY-28.md, VOCL-RNP-Y-RWY.md, VOML-RNP-Y-RWY-06.md, VOML-RNP-Y-RWY.md |
| `Fix` | 6 | `fix` | VOCL-RNP-Y-RWY-10.md, VOCL-RNP-Y-RWY-28.md, VOCL-RNP-Y-RWY.md |
| `SerialNumber` | 5 | `serial_number` | VANM-RNP-RWY-26.md, VANM-RNP-RWY.md, VIAR-RNP-Y-RWY-16.md, VIAR-RNP-Y-RWY.md, VOGO-RNP-RWY-26-CODING.md |
| `PathDescriptor` | 5 | `path_descriptor` | VANM-RNP-RWY-26.md, VANM-RNP-RWY.md, VIAR-RNP-Y-RWY-16.md, VIAR-RNP-Y-RWY.md, VOGO-RNP-RWY-26-CODING.md |
| `Course°M(°T)` | 5 | `course` | VEGY-RNP-Y-RWY-28.md, VEGY-RNP-Y-RWY.md, VIAR-RNP-Y-RWY-16.md, VIAR-RNP-Y-RWY.md, VOBL-RNP-Y-RWY-27L.md |
| `WPT` | 5 | `waypoint_identifier` | VIJP-RNP-Y-RWY-08.md, VIJP-RNP-Y-RWY.md, VILK-RNP-Y-RWY-09.md, VILK-RNP-Y-RWY.md, VOBL-RNP-Y-RWY-27L.md |
| `Upper Limit Altitude (FT)` | 5 | `altitude` | VIKG-RNP-Y-RWY-05.md, VIKG-RNP-Y-RWY-23.md, VIKG-RNP-Y-RWY.md, VOBL-RNP-Y-RWY-27L.md |
| `Latitude/Longitude (WGS84) (Minimum resolution - DD:MM:SS.SS)` | 5 | `latitude_longitude` | VOHB-RNP-Y-RWY26.md, VORY-RNP-RWY-05.md, VORY-RNP-RWY-23.md, VORY-RNP-RWY.md |
| `RNP RWY 23-VAAH` | 4 | `rnp_rwy_23_vaah` | VAAH-RNP-RWY-23.md, VAAH-RNP-RWY.md |
| `INSTRUMENT APPROACH CHART` | 4 | `instrument_approach_chart` | VAAU-RNP-Y-RWY-09.md, VAAU-RNP-Y-RWY.md, VEPT-RNP-Y-RWY-07.md, VEPT-RNP-Y-RWY.md |
| `Course Angle °M(°T)` | 4 | `course` | VAAU-RNP-Y-RWY-09.md, VAAU-RNP-Y-RWY-27.md, VAAU-RNP-Y-RWY.md |
| `Distance / Time NM/Min` | 4 | `distance` | VAAU-RNP-Y-RWY-09.md, VAAU-RNP-Y-RWY-27.md, VAAU-RNP-Y-RWY.md |
| `Altitude FT` | 4 | `altitude` | VAAU-RNP-Y-RWY-09.md, VAAU-RNP-Y-RWY-27.md, VAAU-RNP-Y-RWY.md |
| `Speed Limit KT` | 4 | `speed_limit` | VAAU-RNP-Y-RWY-09.md, VAAU-RNP-Y-RWY-27.md, VAAU-RNP-Y-RWY.md |
| `Distance/Time NM/MIN` | 4 | `distance` | VABB-RNP-Y-RWY-14.md, VABB-RNP-Y-RWY.md, VOBZ-RNP-RWY-26.md, VOBZ-RNP-RWY.md |
| `Distance NM/ Min` | 4 | `distance` | VABO-RNP-Y-RWY-04.md, VABO-RNP-Y-RWY-22.md, VABO-RNP-Y-RWY.md |
| `RNP RWY 23 (CAT A/B/C)` | 4 | `rnp_rwy_23` | VAHS-RNP-RWY-23.md, VAHS-RNP-RWY.md |
| `Distance NM/MIN` | 4 | `distance` | VAHS-RNP-RWY-23.md, VAHS-RNP-RWY.md, VAHS-RNP-Y-RWY-05.md, VAHS-RNP-Y-RWY.md |
| `Way Point` | 4 | `way_point` | VAHS-RNP-RWY-23.md, VAHS-RNP-RWY.md, VAHS-RNP-Y-RWY-05.md, VAHS-RNP-Y-RWY.md |
| `RNP Y RWY 05` | 4 | `rnp_y_rwy_05` | VAHS-RNP-Y-RWY-05.md, VAHS-RNP-Y-RWY.md |
| `RNP Y RWY 23-VAKE` | 4 | `rnp_y_rwy_23_vake` | VAKE-RNP-Y-RWY-23.md, VAKE-RNP-Y-RWY.md |
| `RNP Z RWY 05-VAKE` | 4 | `rnp_z_rwy_05_vake` | VAKE-RNP-Z-RWY-05.md, VAKE-RNP-Z-RWY.md |
| `RNP Z RWY 23-VAKE` | 4 | `rnp_z_rwy_23_vake` | VAKE-RNP-Z-RWY-23.md, VAKE-RNP-Z-RWY.md |
| `RNP RWY 26` | 4 | `rnp_rwy_26` | VANM-RNP-RWY-26.md, VANM-RNP-RWY.md |
| `WaypointIdentifier` | 4 | `waypoint_identifier` | VANM-RNP-RWY-26.md, VANM-RNP-RWY.md, VIAR-RNP-Y-RWY-16.md, VIAR-RNP-Y-RWY.md |
| `VPA/TCH°/FT` | 4 | `vpa_tch` | VANM-RNP-RWY-26.md, VANM-RNP-RWY.md, VIAR-RNP-Y-RWY-16.md, VIAR-RNP-Y-RWY.md |
| `RNP Y RWY 08` | 4 | `rnp_y_rwy_08` | VANM-RNP-Y-RWY-08.md, VANM-RNP-Y-RWY.md |
| `Sl.No.` | 4 | `serial_number` | VASD-RNP-Y-RWY-27.md, VASD-RNP-Y-RWY.md, VEGT-RNP-RWY-02.md, VEGT-RNP-RWY.md |
| `Speed Limit(Kt)` | 4 | `speed_limit` | VEBN-RNP-Y-RWY-09.md, VEBN-RNP-Y-RWY-27.md, VEBN-RNP-Y-RWY.md |
| `VA/TCH °/Ft` | 4 | `vpa_tch` | VEBN-RNP-Y-RWY-09.md, VEBN-RNP-Y-RWY-27.md, VEBN-RNP-Y-RWY.md |
| `Course °M (T)` | 4 | `course` | VEBS-RNP-Y-RWY-32.md, VEBS-RNP-Y-RWY.md, VOCL-RNP-Y-RWY-28.md, VOCL-RNP-Y-RWY.md |
| `VA/ TCH(°/FT)` | 4 | `vpa_tch` | VEGY-RNP-Y-RWY-28.md, VEGY-RNP-Y-RWY.md, VOML-RNP-Y-RWY-24.md, VOML-RNP-Y-RWY.md |
| `Path descriptor` | 4 | `path_descriptor` | VEKI-RNP-Y-RWY-11.md, VEKI-RNP-Y-RWY-29.md, VEKI-RNP-Y-RWY.md |
| `Fly over` | 4 | `fly_over` | VEKI-RNP-Y-RWY-11.md, VEKI-RNP-Y-RWY-29.md, VEKI-RNP-Y-RWY.md |
| `Role of The Fix` | 4 | `role` | VEKI-RNP-Y-RWY-11.md, VEKI-RNP-Y-RWY-29.md, VEKI-RNP-Y-RWY.md |
| `Coordinates (WGS84)` | 4 | `coordinates` | VEKI-RNP-Y-RWY-11.md, VEKI-RNP-Y-RWY-29.md, VEKI-RNP-Y-RWY.md |
| `TM DST/Time (NM/MIN)` | 4 | `distance` | VEPY-RNP-Y-RWY-02.md, VEPY-RNP-Y-RWY.md, VIKG-RNP-Y-RWY-23.md, VIKG-RNP-Y-RWY.md |
| `RNP Y RWY16 VIAR` | 4 | `rnp_y_rwy16_viar` | VIAR-RNP-Y-RWY-16.md, VIAR-RNP-Y-RWY.md |
| `TM DST (NM/MIN)` | 4 | `distance` | VIJP-RNP-Y-RWY-08.md, VIJP-RNP-Y-RWY.md, VILK-RNP-Y-RWY-09.md, VILK-RNP-Y-RWY.md |
| `VA/TCH (°/FT)` | 4 | `vpa_tch` | VIJP-RNP-Y-RWY-08.md, VIJP-RNP-Y-RWY.md, VILK-RNP-Y-RWY-09.md, VILK-RNP-Y-RWY.md |
| `RNP Y RWY 23` | 4 | `rnp_y_rwy_23` | VOCB-RNP-Y-RWY-23.md, VOCB-RNP-Y-RWY.md |
| `Sl. No` | 4 | `serial_number` | VOCL-RNP-Y-RWY-10.md, VOCL-RNP-Y-RWY-28.md, VOCL-RNP-Y-RWY.md |
| `Fix Identifier` | 4 | `waypoint_identifier` | VOCL-RNP-Y-RWY-10.md, VOCL-RNP-Y-RWY-28.md, VOCL-RNP-Y-RWY.md |
| `Vertical Angle(°)/TCH(Ft)` | 4 | `vpa_tch` | VOCL-RNP-Y-RWY-10.md, VOCL-RNP-Y-RWY-28.md, VOCL-RNP-Y-RWY.md |
| `0` | 4 | `0` | VOGO-RNP-RWY-26-CODING.md |
| `Seq. Nr.` | 4 | `serial_number` | VOML-RNP-Y-RWY-06.md, VOML-RNP-Y-RWY-24.md, VOML-RNP-Y-RWY.md |
| `Speed Limit(KT)` | 4 | `speed_limit` | VOML-RNP-Y-RWY-06.md, VOML-RNP-Y-RWY-24.md, VOML-RNP-Y-RWY.md |
| `IDENT` | 4 | `waypoint_identifier` | VOML-RNP-Y-RWY-06.md, VOML-RNP-Y-RWY-24.md, VOML-RNP-Y-RWY.md |
| `RNP Y RWY28` | 4 | `rnp_y_rwy28` | VOVZ-RNP-Y-RWY-28.md, VOVZ-RNP-Y-RWY.md |
| `FlyOver` | 3 | `fly_over` | VANM-RNP-RWY-26.md, VANM-RNP-RWY.md, VOGO-RNP-RWY-26-CODING.md |
| `SpeedLimitkt` | 3 | `speed_limit` | VANM-RNP-RWY-26.md, VANM-RNP-RWY.md, VOKN-RNP-Y-RWY-07-CODING.md |
| `IAP Transition Identifier` | 3 | `waypoint_identifier` | VECC-RNP-Y-RWY-01L.md, VECC-RNP-Y-RWY-19L.md, VECC-RNP-Y-RWY-19R.md |
| `NAVAID / Fix / WPT` | 3 | `nav_spec` | VECC-RNP-Y-RWY-01R.md, VEPT-RNP-Y-RWY-25.md, VEPT-RNP-Y-RWY.md |
| `Latitude/Longitude (WGS84)( DD:MM:SS.SS)` | 3 | `latitude_longitude` | VEKO-RNP-Y-RWY-19.md, VEKO-RNP-Y-RWY.md, VOHS-RNP-Y-RWY-27R.md |
| `Distance (NM)/Time` | 3 | `distance` | VEPT-RNP-Y-RWY-07.md, VEPT-RNP-Y-RWY.md, VIDN-RNP-Y-RWY-08-CODING.md |
| `Distance /Time` | 3 | `distance` | VIKG-RNP-Z-RWY-23.md, VIKG-RNP-Z-RWY.md, VOHS-RNP-Y-RWY-27L.md |
| `Lower Limit Altitude (ft)` | 3 | `altitude` | VOBZ-RNP-RWY-08.md, VOBZ-RNP-RWY.md, VOHB-RNP-Y-RWY08.md |
| `Path 
Descriptor` | 3 | `path_descriptor` | VOGA-RNP-RWY-10.md, VOGA-RNP-RWY.md, VOTP-SID-RWY-26-RNP1-GNSS-CODING.md |
| `Course` | 3 | `course` | VOHB-RNP-Y-RWY08.md, VOHB-RNP-Y-RWY26.md, VORY-RNP-Z-RWY-23-CODING.md |
| `Course °M("T)` | 3 | `course` | VOHS-RNP-Y-RWY-09R.md, VOMD-RNP-Y-RWY-27.md, VOMD-RNP-Y-RWY.md |
| `RNP RWY 05-VAAH` | 2 | `rnp_rwy_05_vaah` | VAAH-RNP-RWY-05.md, VAAH-RNP-RWY.md |
| `AERODROME ELEV 1917 ftHEIGHTS RELATED TOTHR RWY 09 - ELEV 1917 ft` | 2 | `aerodrome_elev_1917_ftheights_related_tothr_rwy_09_elev_1917_ft` | VAAU-RNP-Y-RWY-09.md, VAAU-RNP-Y-RWY.md |
| `AURANGABAD(VAAU)INDIARNP Y RWY 09` | 2 | `aurangabadindiarnp_y_rwy_09` | VAAU-RNP-Y-RWY-09.md, VAAU-RNP-Y-RWY.md |
| `RNP Y RWY 27 VAAU` | 2 | `rnp_y_rwy_27_vaau` | VAAU-RNP-Y-RWY-27.md, VAAU-RNP-Y-RWY.md |
| `RNP Y RWY 09-VABB` | 2 | `rnp_y_rwy_09_vabb` | VABB-RNP-Y-RWY-09.md, VABB-RNP-Y-RWY.md |
| `WAYPOINT` | 2 | `waypoint_identifier` | VABB-RNP-Y-RWY-09.md, VABB-RNP-Y-RWY.md |
| `RNP Y RWY14 - VABB` | 2 | `rnp_y_rwy14_vabb` | VABB-RNP-Y-RWY-14.md, VABB-RNP-Y-RWY.md |
| `Upper Limit Altitude ft` | 2 | `altitude` | VABB-RNP-Y-RWY-14.md, VABB-RNP-Y-RWY.md |
| `Lower Limit Altitude ft` | 2 | `altitude` | VABB-RNP-Y-RWY-14.md, VABB-RNP-Y-RWY.md |
| `Speed kt` | 2 | `speed_limit` | VABB-RNP-Y-RWY-14.md, VABB-RNP-Y-RWY.md |
| `VPA/TCH °ft` | 2 | `vpa_tch` | VABB-RNP-Y-RWY-14.md, VABB-RNP-Y-RWY.md |
| `RNP Y RWY 14 - VABB` | 2 | `rnp_y_rwy_14_vabb` | VABB-RNP-Y-RWY-14.md, VABB-RNP-Y-RWY.md |
| `RNP Y RWY 30-VABP` | 2 | `rnp_y_rwy_30_vabp` | VABP-RNP-Y-RWY-30.md, VABP-RNP-Y-RWY.md |
| `DST/Time (NM/MIN)` | 2 | `distance` | VABV-RNP-Y-RWY-25.md, VABV-RNP-Y-RWY.md |
| `Speed (KT)` | 2 | `speed_limit` | VABV-RNP-Y-RWY-25.md, VABV-RNP-Y-RWY.md |
| `VPA/TCH (°/FT)` | 2 | `vpa_tch` | VABV-RNP-Y-RWY-25.md, VABV-RNP-Y-RWY.md |
| `RNP Y RWY 07` | 2 | `rnp_y_rwy_07` | VAID-RNP-Y-RWY-07.md, VAID-RNP-Y-RWY.md |
| `RNP Y RWY 05-VAKE` | 2 | `rnp_y_rwy_05_vake` | VAKE-RNP-Y-RWY-05.md, VAKE-RNP-Y-RWY.md |
| `Course°M (°T)` | 2 | `course` | VANM-RNP-RWY-26.md, VANM-RNP-RWY.md |
| `DistanceNM` | 2 | `distance` | VANM-RNP-RWY-26.md, VANM-RNP-RWY.md |
| `Altitudeft` | 2 | `altitude` | VANM-RNP-RWY-26.md, VANM-RNP-RWY.md |
| `RNP Z RWY 27 (CAT A/B) (LPV Only)-VAPR` | 2 | `rnp_z_rwy_27_vapr` | VAPR-RNP-Z-RWY-27.md, VAPR-RNP-Z-RWY.md |
| `SL NO.` | 2 | `serial_number` | VASD-RNP-Y-RWY-09.md, VASD-RNP-Y-RWY.md |
| `Course ° M (T)` | 2 | `course` | VASD-RNP-Y-RWY-09.md, VASD-RNP-Y-RWY.md |
| `Lower Limit Altitude (Ft)` | 2 | `altitude` | VASD-RNP-Y-RWY-09.md, VASD-RNP-Y-RWY.md |
| `Speed Limit( kt)` | 2 | `speed_limit` | VASD-RNP-Y-RWY-09.md, VASD-RNP-Y-RWY.md |
| `VPA/TCH °/Ft` | 2 | `vpa_tch` | VASD-RNP-Y-RWY-09.md, VASD-RNP-Y-RWY.md |
| `Latitude/Longitude (WGS84)
(Minimum resolution - DD:MM:SS.SS)` | 2 | `latitude_longitude` | VASD-RNP-Y-RWY-09.md, VASD-RNP-Y-RWY.md |
| `Tabular Description- RNP Y RWY 27` | 2 | `tabular_description_rnp_y_rwy_27` | VASD-RNP-Y-RWY-27.md, VASD-RNP-Y-RWY.md |
| `Course °M(T)` | 2 | `course` | VASD-RNP-Y-RWY-27.md, VASD-RNP-Y-RWY.md |
| `°/Ft` | 2 | `ft` | VASD-RNP-Y-RWY-27.md, VASD-RNP-Y-RWY.md |
| `RNP RWY 22` | 2 | `rnp_rwy_22` | VASU-RNP-RWY-22.md, VASU-RNP-RWY.md |
| `RNP RWY 26 (CAT A/B/C)` | 2 | `rnp_rwy_26` | VAUD-RNP-RWY-26.md, VAUD-RNP-RWY.md |
| `RNP Y RWY 14-VEBS` | 2 | `rnp_y_rwy_14_vebs` | VEBS-RNP-Y-RWY-14.md, VEBS-RNP-Y-RWY.md |
| `Course M°(T)` | 2 | `course` | VEBS-RNP-Y-RWY-14.md, VEBS-RNP-Y-RWY.md |
| `RNP Y RWY 14 -VEBS` | 2 | `rnp_y_rwy_14_vebs` | VEBS-RNP-Y-RWY-14.md, VEBS-RNP-Y-RWY.md |
| `RNP Y RWY 09-VEDO` | 2 | `rnp_y_rwy_09_vedo` | VEDO-RNP-Y-RWY-09.md, VEDO-RNP-Y-RWY.md |
| `INSTRUMENT` | 2 | `instrument` | VEDO-RNP-Y-RWY-27.md, VEDO-RNP-Y-RWY.md |
| `AERODROME ELEV 802 ft` | 2 | `aerodrome_elev_802_ft` | VEDO-RNP-Y-RWY-27.md, VEDO-RNP-Y-RWY.md |
| `DEOGHAR (VEDO)` | 2 | `deoghar` | VEDO-RNP-Y-RWY-27.md, VEDO-RNP-Y-RWY.md |
| `APPROACH` | 2 | `approach` | VEDO-RNP-Y-RWY-27.md, VEDO-RNP-Y-RWY.md |
| `HEIGHTS RELATED TO` | 2 | `heights_related_to` | VEDO-RNP-Y-RWY-27.md, VEDO-RNP-Y-RWY.md |
| `INDIA` | 2 | `india` | VEDO-RNP-Y-RWY-27.md, VEDO-RNP-Y-RWY.md |
| `CHART` | 2 | `chart` | VEDO-RNP-Y-RWY-27.md, VEDO-RNP-Y-RWY.md |
| `THR RWY 27 — ELEV 802 ft` | 2 | `thr_rwy_27_elev_802_ft` | VEDO-RNP-Y-RWY-27.md, VEDO-RNP-Y-RWY.md |
| `RNP Y RWY 27(CAT A/B/C)` | 2 | `rnp_y_rwy_27` | VEDO-RNP-Y-RWY-27.md, VEDO-RNP-Y-RWY.md |
| `RNP Y RWY 27-VEDO` | 2 | `rnp_y_rwy_27_vedo` | VEDO-RNP-Y-RWY-27.md, VEDO-RNP-Y-RWY.md |
| `Course ºM(ºT)` | 2 | `course` | VEDO-RNP-Z-RWY-27.md, VEDO-RNP-Z-RWY.md |
| `RNP Z RWY 27-VEDO` | 2 | `rnp_z_rwy_27_vedo` | VEDO-RNP-Z-RWY-27.md, VEDO-RNP-Z-RWY.md |
| `3` | 2 | `3` | VEDO-RNP-Z-RWY-27.md, VEDO-RNP-Z-RWY.md |
| `Delta FPAP Latitude` | 2 | `delta_fpap_latitude` | VEDO-RNP-Z-RWY-27.md, VEDO-RNP-Z-RWY.md |
| `-0.00002639` | 2 | `0_00002639` | VEDO-RNP-Z-RWY-27.md, VEDO-RNP-Z-RWY.md |
| `Airport identifier` | 2 | `waypoint_identifier` | VEDO-RNP-Z-RWY-27.md, VEDO-RNP-Z-RWY.md |
| `VEDO` | 2 | `vedo` | VEDO-RNP-Z-RWY-27.md, VEDO-RNP-Z-RWY.md |
| `Delta FPAP Longitude` | 2 | `delta_fpap_longitude` | VEDO-RNP-Z-RWY-27.md, VEDO-RNP-Z-RWY.md |
| `-0.02465473` | 2 | `0_02465473` | VEDO-RNP-Z-RWY-27.md, VEDO-RNP-Z-RWY.md |
| `Path and Descriptor` | 2 | `path_descriptor` | VEGY-RNP-Y-RWY-28.md, VEGY-RNP-Y-RWY.md |
| `TMDST/Time(NM/MIN)` | 2 | `distance` | VEGY-RNP-Y-RWY-28.md, VEGY-RNP-Y-RWY.md |
| `Altitude(FT)` | 2 | `altitude` | VEGY-RNP-Y-RWY-28.md, VEGY-RNP-Y-RWY.md |
| `SpeedLimit(KT)` | 2 | `speed_limit` | VEGY-RNP-Y-RWY-28.md, VEGY-RNP-Y-RWY.md |
| `RNP Y RWY 24 (CAT A/B) -VEJR` | 2 | `rnp_y_rwy_24_vejr` | VEJR-RNP-Y-RWY-24.md, VEJR-RNP-Y-RWY.md |
| `TM DST /TIME` | 2 | `distance` | VEKO-RNP-Y-RWY-01.md, VEKO-RNP-Y-RWY.md |
| `Latitude/Longitude (WGS84) (DD:MM:SS.SS)` | 2 | `latitude_longitude` | VEKO-RNP-Y-RWY-01.md, VEKO-RNP-Y-RWY.md |
| `TM DST/TIME` | 2 | `distance` | VEKO-RNP-Y-RWY-19.md, VEKO-RNP-Y-RWY.md |
| `RNP RWY 12 (CAT A/B/C) -VEMR` | 2 | `rnp_rwy_12_vemr` | VEMR-RNP-RWY-12.md, VEMR-RNP-RWY.md |
| `Sl. No.` | 2 | `serial_number` | VEMR-RNP-RWY-12.md, VEMR-RNP-RWY.md |
| `AERODROME ELEV 175 ftHEIGHTS RELATED TOTHR RWY 07 — ELEV 175 ft` | 2 | `aerodrome_elev_175_ftheights_related_tothr_rwy_07_elev_175_ft` | VEPT-RNP-Y-RWY-07.md, VEPT-RNP-Y-RWY.md |
| `PATNA (VEPT)INDIARNP Y RWY 07(CAT A/B/C)` | 2 | `patna_indiarnp_y_rwy_07` | VEPT-RNP-Y-RWY-07.md, VEPT-RNP-Y-RWY.md |
| `RNP Y RWY 07-VEPT` | 2 | `rnp_y_rwy_07_vept` | VEPT-RNP-Y-RWY-07.md, VEPT-RNP-Y-RWY.md |
| `Waypoint identifier` | 2 | `waypoint_identifier` | VEPY-RNP-Y-RWY-02.md, VEPY-RNP-Y-RWY.md |
| `TM /DSTNM/MIN` | 2 | `distance` | VIAR-RNP-Y-RWY-16.md, VIAR-RNP-Y-RWY.md |
| `AltitudeFT` | 2 | `altitude` | VIAR-RNP-Y-RWY-16.md, VIAR-RNP-Y-RWY.md |
| `SpeedLimitKt` | 2 | `speed_limit` | VIAR-RNP-Y-RWY-16.md, VIAR-RNP-Y-RWY.md |
| `Course "M("T)` | 2 | `course` | VIDP-RNP-Y-RWY-10-CODING.md, VIDP-RNP-Y-RWY-27-CODING.md |
| `Role of the fix / Navigation Specification` | 2 | `role` | VIJP-RNP-Y-RWY-08.md, VIJP-RNP-Y-RWY.md |
| `WAYPOINT LIST` | 2 | `waypoint_identifier` | VIJP-RNP-Y-RWY-26.md, VIJP-RNP-Y-RWY.md |
| `TM DST/ Time (NM/ MIN)` | 2 | `distance` | VIKG-RNP-Y-RWY-05.md, VIKG-RNP-Y-RWY.md |
| `Waypoint Identified` | 2 | `waypoint_identifier` | VIKG-RNP-Y-RWY-05.md, VIKG-RNP-Y-RWY.md |
| `Role of the fix` | 2 | `role` | VILK-RNP-Y-RWY-09.md, VILK-RNP-Y-RWY.md |
| `TABULAR DESCRIPTION-RNP Y RWY 27, LUCKNOW(VILK)` | 2 | `tabular_description_rnp_y_rwy_27_lucknow` | VILK-RNP-Y-RWY-27.md, VILK-RNP-Y-RWY.md |
| `Mag Var (Deg)` | 2 | `mag_var` | VILK-RNP-Y-RWY-27.md, VILK-RNP-Y-RWY.md |
| `Vertical Angle/TCH` | 2 | `vpa_tch` | VILK-RNP-Y-RWY-27.md, VILK-RNP-Y-RWY.md |
| `HOLDING-RNP Y RWY 27, LUCKNOW(VILK)` | 2 | `holding_rnp_y_rwy_27_lucknow` | VILK-RNP-Y-RWY-27.md, VILK-RNP-Y-RWY.md |
| `Holding Fix` | 2 | `holding_fix` | VILK-RNP-Y-RWY-27.md, VILK-RNP-Y-RWY.md |
| `Inbound Track °M (°T)` | 2 | `inbound_track` | VILK-RNP-Y-RWY-27.md, VILK-RNP-Y-RWY.md |
| `Max Speed (Kt IAS)` | 2 | `speed_limit` | VILK-RNP-Y-RWY-27.md, VILK-RNP-Y-RWY.md |
| `Min/ Max Holding Altitude (Ft)` | 2 | `altitude` | VILK-RNP-Y-RWY-27.md, VILK-RNP-Y-RWY.md |
| `Time/ Dist outbound` | 2 | `distance` | VILK-RNP-Y-RWY-27.md, VILK-RNP-Y-RWY.md |
| `WAYPOINT LIST-RNP Y RWY 27, LUCKNOW(VILK)` | 2 | `waypoint_identifier` | VILK-RNP-Y-RWY-27.md, VILK-RNP-Y-RWY.md |
| `Course
0M(0T)` | 2 | `course` | VOBL-RNP-RWY-09L.md, VOTP-SID-RWY-26-RNP1-GNSS-CODING.md |
| `Lower 
Limit 
Altitude` | 2 | `altitude` | VOBL-RNP-RWY-09L.md, VOBL-RNP-Y-RWY-27R.md |
| `Speed Limit (kt)` | 2 | `speed_limit` | VOBZ-RNP-RWY-08.md, VOBZ-RNP-RWY.md |
| `VA/T°/FT CH` | 2 | `vpa_tch` | VOBZ-RNP-RWY-08.md, VOBZ-RNP-RWY.md |
| `VA/TCH °/FT` | 2 | `vpa_tch` | VOBZ-RNP-RWY-26.md, VOBZ-RNP-RWY.md |
| `Coordinates (DD:MM:SS.SS)` | 2 | `coordinates` | VOBZ-RNP-RWY-26.md, VOBZ-RNP-RWY.md |
| `Distance/Time (Nm/Min)` | 2 | `distance` | VOCI-RNP-RWY-09.md, VOCI-RNP-RWY.md |
| `Coordinates (WGS84)(Minimum resolution - DD:MM:SS.SS)` | 2 | `coordinates` | VOCI-RNP-RWY-09.md, VOCI-RNP-RWY.md |
| `Course°M (T)` | 2 | `course` | VOCL-RNP-Y-RWY-10.md, VOCL-RNP-Y-RWY.md |
| `Fly
Over` | 2 | `fly_over` | VOGA-RNP-RWY-10.md, VOGA-RNP-RWY.md |
| `Course 
0M(0(T)` | 2 | `course` | VOGA-RNP-RWY-10.md, VOGA-RNP-RWY.md |
| `Distance
Time
NM/MIN` | 2 | `distance` | VOGA-RNP-RWY-10.md, VOGA-RNP-RWY.md |
| `Upper 
Limit 
Altitude` | 2 | `altitude` | VOGA-RNP-RWY-10.md, VOGA-RNP-RWY.md |
| `Lower
Limit
Altitude` | 2 | `altitude` | VOGA-RNP-RWY-10.md, VOGA-RNP-RWY.md |
| `Speed
Limit` | 2 | `speed_limit` | VOGA-RNP-RWY-10.md, VOGA-RNP-RWY.md |
| `Distance/
-
Time` | 2 | `distance` | VOGA-RNP-RWY-28.md, VOGA-RNP-RWY.md |
| `50.0` | 2 | `50_0` | VOGO-RNP-RWY-26-CODING.md |
| `Speed Limit Kt` | 2 | `speed_limit` | VOHB-RNP-Y-RWY08.md, VOHB-RNP-Y-RWY26.md |
| `Fly
Over` | 2 | `fly_over` | VOHS-RNP-Y-RWY-09L.md, VOHS-RNP-Y-RWY-27R.md |
| `(Minimum resolution - DD:MM:SS.SS)` | 2 | `unknown` | VOHY-RNP-Y-RWY-27.md, VOHY-RNP-Y-RWY.md |
| `VA/ TCH(º/FT)` | 2 | `vpa_tch` | VOML-RNP-Y-RWY-06.md, VOML-RNP-Y-RWY.md |
| `Course Angle0°M(0°T)` | 2 | `course` | VOML-RNP-Y-RWY-24.md, VOML-RNP-Y-RWY.md |
| `Role ofthe Fix` | 2 | `role` | VOML-RNP-Y-RWY-24.md, VOML-RNP-Y-RWY.md |
| `Fly – Over` | 2 | `fly_over` | VORY-RNP-RWY-05.md, VORY-RNP-RWY.md |
| `Distance/ TIME` | 2 | `distance` | VORY-RNP-RWY-05.md, VORY-RNP-RWY.md |
| `VORY` | 2 | `vory` | VORY-RNP-Z-RWY-05-CODING.md, VORY-RNP-Z-RWY-23-CODING.md |
| `Distance NM/Min` | 2 | `distance` | VOSR-RNP-Y-RWY-27.md, VOSR-RNP-Y-RWY.md |
| `VPA/ TCH` | 2 | `vpa_tch` | VOVZ-RNP-Y-RWY-28.md, VOVZ-RNP-Y-RWY.md |
| `RNP Z RWY 06 (CAT A/B/C) (LPV Only)-VAJB` | 1 | `rnp_z_rwy_06_vajb` | VAJB RNP Z RWY 06.md |
| `Course ³M(°T)` | 1 | `course` | VEBU RNP RWY- 35.md |
| `Distance (NM)-Time(min)` | 1 | `distance` | VEBU RNP RWY- 35.md |
| `Waypoint Information` | 1 | `waypoint_identifier` | VECC-RNP-Y-RWY-19R.md |
| `Serial Num` | 1 | `serial_number` | VEPY-SID-RWY-20-BGD1-RNP1-GNSS.md |
| `WAYPOINT INFORMATION` | 1 | `waypoint_identifier` | VEPY-SID-RWY-20-BGD1-RNP1-GNSS.md |
| `VPA/TCH */ Ft` | 1 | `vpa_tch` | VIDP-RNP-Y-RWY-27-CODING.md |
| `VPA/TCH */FT` | 1 | `vpa_tch` | VIDP-RNP-Y-RWY-29R-CODING.md |
| `Rth Descriptor` | 1 | `path_descriptor` | VIND-RNP-RWY-28-CODING.md |
| `Course (MPT)` | 1 | `course` | VIND-RNP-RWY-28-CODING.md |
| `Serial
No.` | 1 | `serial_number` | VOBL-RNP-RWY-09L.md |
| `Fly -
Over` | 1 | `fly_over` | VOBL-RNP-RWY-09L.md |
| `Path 
Designator` | 1 | `path_descriptor` | VOBL-RNP-RWY-09L.md |
| `Serial-Number` | 1 | `serial_number` | VOBL-RNP-Y-RWY-09R.md |
| `Path-Descriptor` | 1 | `path_descriptor` | VOBL-RNP-Y-RWY-09R.md |
| `Rec Navaid` | 1 | `nav_spec` | VOBL-RNP-Y-RWY-09R.md |
| `Waypoint-Identifier` | 1 | `waypoint_identifier` | VOBL-RNP-Y-RWY-09R.md |
| `Course-°M(°T)` | 1 | `course` | VOBL-RNP-Y-RWY-09R.md |
| `Distance-(Nm)` | 1 | `distance` | VOBL-RNP-Y-RWY-09R.md |
| `Turn-direction` | 1 | `turn_direction` | VOBL-RNP-Y-RWY-09R.md |
| `Altitude-(ft)` | 1 | `altitude` | VOBL-RNP-Y-RWY-09R.md |
| `Speed-limit-(Kts)` | 1 | `speed_limit` | VOBL-RNP-Y-RWY-09R.md |
| `VPA/-TCH-°/ft` | 1 | `vpa_tch` | VOBL-RNP-Y-RWY-09R.md |
| `Navigation-Specification` | 1 | `nav_spec` | VOBL-RNP-Y-RWY-09R.md |
| `TM DST (NM)` | 1 | `distance` | VOBL-RNP-Y-RWY-27L.md |
| `Coordinates(Minimum resolution - DD:MM:SS.SS)` | 1 | `coordinates` | VOBL-RNP-Y-RWY-27R.md |
| `VOCP` | 1 | `vocp` | VOCP-RNP-Z-RWY-29-CODING.md |
| `3 (GAGAN)` | 1 | `3` | VOGO-RNP-RWY-26-CODING.md |
| `VOGO` | 1 | `vogo` | VOGO-RNP-RWY-26-CODING.md |
| `26` | 1 | `26` | VOGO-RNP-RWY-26-CODING.md |
| `0 (None)` | 1 | `0` | VOGO-RNP-RWY-26-CODING.md |
| `Z` | 1 | `z` | VOGO-RNP-RWY-26-CODING.md |
| `G26A` | 1 | `g26a` | VOGO-RNP-RWY-26-CODING.md |
| `152301.9565N` | 1 | `152301_9565n` | VOGO-RNP-RWY-26-CODING.md |
| `0735054.2370E` | 1 | `0735054_2370e` | VOGO-RNP-RWY-26-CODING.md |
| `-26.0` | 1 | `26_0` | VOGO-RNP-RWY-26-CODING.md |
| `152240.1290N` | 1 | `152240_1290n` | VOGO-RNP-RWY-26-CODING.md |
| `-21.8275` | 1 | `21_8275` | VOGO-RNP-RWY-26-CODING.md |
| `0734901.5680E` | 1 | `0734901_5680e` | VOGO-RNP-RWY-26-CODING.md |
| `-112.6690` | 1 | `112_6690` | VOGO-RNP-RWY-26-CODING.md |
| `0 (feet)` | 1 | `0` | VOGO-RNP-RWY-26-CODING.md |
| `3.10` | 1 | `3_10` | VOGO-RNP-RWY-26-CODING.md |
| `105.00` | 1 | `105_00` | VOGO-RNP-RWY-26-CODING.md |
| `40.0` | 1 | `40_0` | VOGO-RNP-RWY-26-CODING.md |
| `30 0F 07 0F 16 1A D0 00 01 3632 07 89 1F 9A 06 3A 3A B1 1FFC 12 79 55 FF C6 8F FC F4 0136 01 64 00 C8 FA DB 27 7A 2E` | 1 | `30_0f_07_0f_16_1a_d0_00_01_3632_07_89_1f_9a_06_3a_3a_b1_1ffc_12_79_55_ff_c6_8f_fc_f4_0136_01_64_00_c8_fa_db_27_7a_2e` | VOGO-RNP-RWY-26-CODING.md |
| `DB277A2E` | 1 | `db277a2e` | VOGO-RNP-RWY-26-CODING.md |
| `Distance
/Time` | 1 | `distance` | VOHS-RNP-Y-RWY-09L.md |
| `Serial number` | 1 | `serial_number` | VOKN-RNP-Y-RWY-07-CODING.md |
| `Path Description` | 1 | `path_descriptor` | VOKN-RNP-Y-RWY-07-CODING.md |
| `Course° M//° T` | 1 | `course` | VOKN-RNP-Y-RWY-07-CODING.md |
| `Lower LimitAltitudeft` | 1 | `altitude` | VOKN-RNP-Y-RWY-07-CODING.md |
| `TM DSTNM/MIN` | 1 | `distance` | VOKN-RNP-Y-RWY-07-CODING.md |
| `VA/TCH°/ft` | 1 | `vpa_tch` | VOKN-RNP-Y-RWY-07-CODING.md |
| `Serial` | 1 | `serial_number` | VORY-RNP-Z-RWY-23-CODING.md |
| `Path` | 1 | `path_descriptor` | VORY-RNP-Z-RWY-23-CODING.md |
| `Fly` | 1 | `fly_over` | VORY-RNP-Z-RWY-23-CODING.md |
| `Distance/` | 1 | `distance` | VORY-RNP-Z-RWY-23-CODING.md |
| `Navigation` | 1 | `nav_spec` | VORY-RNP-Z-RWY-23-CODING.md |
| `Number` | 1 | `number` | VORY-RNP-Z-RWY-23-CODING.md |
| `Descriptor` | 1 | `path_descriptor` | VORY-RNP-Z-RWY-23-CODING.md |
| `Identifier` | 1 | `waypoint_identifier` | VORY-RNP-Z-RWY-23-CODING.md |
| `Over` | 1 | `over` | VORY-RNP-Z-RWY-23-CODING.md |
| `°M(°T)` | 1 | `unknown` | VORY-RNP-Z-RWY-23-CODING.md |
| `Time` | 1 | `time` | VORY-RNP-Z-RWY-23-CODING.md |
| `Direction` | 1 | `direction` | VORY-RNP-Z-RWY-23-CODING.md |
| `Specification` | 1 | `nav_spec` | VORY-RNP-Z-RWY-23-CODING.md |
| `Waypoint 
Identifier` | 1 | `waypoint_identifier` | VOTP-SID-RWY-26-RNP1-GNSS-CODING.md |
| `Turn 
Direction` | 1 | `turn_direction` | VOTP-SID-RWY-26-RNP1-GNSS-CODING.md |
| `Distance/ 
Time` | 1 | `distance` | VOTP-SID-RWY-26-RNP1-GNSS-CODING.md |
| `ANIRO 1` | 1 | `aniro_1` | VOTP-STAR-RWY-26-RNP1-GNSS-CODING.md |
| `VEMBO 1` | 1 | `vembo_1` | VOTP-STAR-RWY-26-RNP1-GNSS-CODING.md |
| `LURGI 1` | 1 | `lurgi_1` | VOTP-STAR-RWY-26-RNP1-GNSS-CODING.md |
| `RINTO 1` | 1 | `rinto_1` | VOTP-STAR-RWY-26-RNP1-GNSS-CODING.md |
| `KARGA 1` | 1 | `karga_1` | VOTP-STAR-RWY-26-RNP1-GNSS-CODING.md |
| `HOLD` | 1 | `hold` | VOTP-STAR-RWY-26-RNP1-GNSS-CODING.md |
