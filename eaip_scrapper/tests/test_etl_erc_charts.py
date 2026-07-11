import contextlib
from unittest import mock

from eaip_scrapper.etl.etl_erc_charts import ERCChartsETL


@mock.patch("eaip_scrapper.etl.etl_erc_charts.boto3.client")
def test_process_to_pmtiles_with_polygon(mock_s3_client):
    polygon_str = "[[60.0,-6.0],[60.0,25.0],[65.74,25.0],[60.0,-6.0]]"

    with mock.patch("eaip_scrapper.etl.etl_erc_charts.ERC_MAP_POLYGON", polygon_str):
        etl = ERCChartsETL()

        with (
            mock.patch("subprocess.run") as mock_run,
            mock.patch("os.path.exists", return_value=False),
            contextlib.suppress(Exception),
        ):
            etl.process_to_pmtiles("test_input.pdf")

        assert mock_run.call_count >= 1
        warp_call = mock_run.call_args_list[0]
        args = warp_call[0][0]

        assert "-cutline" in args
        cutline_idx = args.index("-cutline")
        # The next arg should be the path to the temp GeoJSON file
        assert args[cutline_idx + 1].endswith(".geojson")
        assert "-crop_to_cutline" in args
        assert "-cutline_srs" in args
        srs_idx = args.index("-cutline_srs")
        assert args[srs_idx + 1] == "EPSG:4326"
        assert "-dstalpha" in args


@mock.patch("eaip_scrapper.etl.etl_erc_charts.boto3.client")
def test_process_to_pmtiles_without_polygon(mock_s3_client):
    with mock.patch("eaip_scrapper.etl.etl_erc_charts.ERC_MAP_POLYGON", None):
        etl = ERCChartsETL()

        with (
            mock.patch("subprocess.run") as mock_run,
            mock.patch("os.path.exists", return_value=False),
            contextlib.suppress(Exception),
        ):
            etl.process_to_pmtiles("test_input.pdf")

        assert mock_run.call_count >= 1
        warp_call = mock_run.call_args_list[0]
        args = warp_call[0][0]
        assert "-cutline" not in args
        assert "-crop_to_cutline" not in args
