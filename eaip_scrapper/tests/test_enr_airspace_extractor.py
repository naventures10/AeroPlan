from eaip_scrapper.scrapper.extractors.enr.enr_airspace_extractor import ENRAirspaceExtractor


def test_extract_airspace_entries_merging():
    extractor = ENRAirspaceExtractor(active_eaip_url="http://dummy")
    grid = [
        [
            "Bengaluru Control Area (Sector B3)\nFL 250 / FL 115\nClass D",
            "Lower Bengaluru West",
            "Bengaluru Radar\nEnglish\nH24",
            "124.8 MHz",
            "Remarks 1",
        ],
        [
            "Area bounded by\n130000N 0770000E\n130000N 0780000E",
            "Bengaluru APP",
            "Bengaluru Approach\nEnglish\nH24",
            "127.3 MHz",
            "Remarks 2",
        ],
    ]
    entries = extractor._extract_airspace_entries(grid)
    assert len(entries) == 1
    entry = entries[0]
    assert "Bengaluru Control Area (Sector B3)" in entry["name_and_limits"]
    assert "Area bounded by" in entry["name_and_limits"]
    assert len(entry["services"]) == 2
    assert entry["services"][0]["unit_providing_service"] == "Lower Bengaluru West"
    assert entry["services"][1]["unit_providing_service"] == "Bengaluru APP"
