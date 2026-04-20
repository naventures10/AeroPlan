import os

import pytest
from sqlalchemy import text

from app.api.v1.endpoints.rnp import get_rnp_path_3d


@pytest.mark.asyncio
@pytest.mark.data_integrity
async def test_rnp_procedures_data_integrity(db_session):
    """
    Audits all RNP procedures in the database for path generation correctness.
    Skips unless RUN_INTEGRITY=1 is set.
    """
    if os.environ.get("RUN_INTEGRITY") != "1":
        pytest.skip("Skipping data integrity audit. Set RUN_INTEGRITY=1 to run.")
    # Query all procedures from the DB session
    res = await db_session.execute(text("SELECT id, name, airport_id FROM rnp_procedures"))
    procedures = res.fetchall()

    if not procedures:
        pytest.skip("No RNP procedures found in database. Skipping integrity audit.")

    failures = []
    for p in procedures:
        try:
            path_res = await get_rnp_path_3d(p.id, db_session)

            issues = []

            # 1. Must have at least one approach path
            if len(path_res.approach_paths) == 0:
                issues.append("Zero approach paths")

            # 2. Check for empty paths
            for idx, ap in enumerate(path_res.approach_paths):
                if len(ap.path) < 2:
                    issues.append(f"Approach {idx} insufficient points")

            # 3. Check for missed approach (nearly all RNP APCH have one)
            # We skip this for SID/STAR based on naming heuristic
            p_name = p.name.upper() if p.name else ""
            is_approach = "-RNP-" in p_name and ("SID" not in p_name and "STAR" not in p_name)

            if is_approach:
                if not path_res.missed_approach_path:
                    issues.append("Missing Missed Approach")
                elif len(path_res.missed_approach_path.path) < 2:
                    issues.append("Missed Approach insufficient points")

            if issues:
                failures.append(f"{p.airport_id} {p.name}: {', '.join(issues)}")

        except Exception as e:
            failures.append(f"{p.airport_id} {p.name}: Exception: {e!s}")

    assert not failures, (
        f"RNP Integrity check failed for {len(failures)} procedures:\n" + "\n".join(failures)
    )
