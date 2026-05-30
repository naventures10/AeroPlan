import json
import os
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from eaip_scrapper.etl.etl_weather import _cleanup_stale_s3_files, _run_pipeline_impl, safe_remove_grib


@pytest.fixture
def mock_s3_client():
    client = MagicMock()
    return client


def test_safe_remove_grib_none():
    assert safe_remove_grib("") is None


def test_safe_remove_grib_exception(monkeypatch):
    dummy = "dummy.grib2"
    with open(dummy, "w") as f:
        f.write("test")

    def mock_remove(path):
        raise OSError("Mock error")

    monkeypatch.setattr(os, "remove", mock_remove)
    # Should log error but not raise
    safe_remove_grib(dummy)

    if os.path.exists(dummy):
        monkeypatch.undo()
        os.remove(dummy)


def test_cleanup_stale_s3_files(mock_s3_client):
    mock_s3_client.get_paginator.return_value.paginate.return_value = [
        {
            "Contents": [
                {"Key": "weather/weather_active.tif"},
                {"Key": "weather/weather_stale.tif"},
            ]
        }
    ]
    
    active_filenames = {"weather_active.tif"}
    _cleanup_stale_s3_files(mock_s3_client, active_filenames)
    
    # Should delete stale file, but not active file
    mock_s3_client.delete_object.assert_called_once_with(
        Bucket="ais", Key="weather/weather_stale.tif"
    )


@patch("eaip_scrapper.etl.etl_weather._get_s3_client")
@patch("eaip_scrapper.etl.etl_weather.cfgrib.open_datasets")
@patch("eaip_scrapper.etl.etl_weather.xr.open_dataset")
@patch("eaip_scrapper.etl.etl_weather.xr.concat")
@patch("eaip_scrapper.etl.etl_weather.rasterio.open")
@patch("eaip_scrapper.etl.etl_weather.Client")
@patch("eaip_scrapper.etl.etl_weather.subprocess.run")
@patch("eaip_scrapper.etl.etl_weather.np.arange")
def test_run_pipeline_success(
    mock_arange,
    mock_run,
    mock_client_class,
    mock_rasterio,
    mock_xr_concat,
    mock_xr_open,
    mock_cfgrib_open,
    mock_get_s3_client,
    tmp_path,
    monkeypatch,
):
    mock_s3 = MagicMock()
    mock_get_s3_client.return_value = mock_s3

    # Mock arange to return only 0 altitude (surface) to speed up test
    mock_arange.return_value = np.array([0])

    # Mock the Client and its retrieve method
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client

    # Mock xarray datasets for surface
    mock_ds_sfc = MagicMock()
    mock_ds_sfc.data_vars = ["u10", "v10", "t2m", "d2m", "fg10", "tp", "tcc", "msl"]
    mock_ds_sfc.dims = ["step", "latitude", "longitude"]
    mock_ds_sfc.coords = {
        "step": np.array([np.timedelta64(3, "h")], dtype="timedelta64[ns]"),
        "latitude": np.array([90.0, 89.75]),
        "longitude": np.array([-180.0, -179.75]),
        "valid_time": np.array([np.datetime64("2023-01-01T12:00:00")]),
    }

    def get_var(key):
        da = MagicMock()
        da.values = np.zeros((1, 2, 2))
        da.coords = {}
        da.drop_vars.return_value = da
        da.__sub__.return_value = da
        da.__truediv__.return_value = da
        da.__mul__.return_value = da
        da.clip.return_value = da
        da.isel.return_value = da
        return da

    mock_ds_sfc.__getitem__.side_effect = get_var
    mock_ds_sfc.drop_vars.return_value = mock_ds_sfc
    mock_ds_sfc.expand_dims.return_value = mock_ds_sfc
    mock_ds_sfc.assign_coords.return_value = mock_ds_sfc

    mock_cfgrib_open.return_value = [mock_ds_sfc]

    # Mock PL dataset
    mock_ds_pl = MagicMock()
    mock_ds_pl.data_vars = ["u", "v", "t", "r"]
    mock_ds_pl.dims = ["isobaricInhPa", "step", "latitude", "longitude"]
    mock_ds_pl.coords = {
        "isobaricInhPa": np.array([1000]),
        "step": np.array([np.timedelta64(3, "h")], dtype="timedelta64[ns]"),
    }
    mock_ds_pl.isobaricInhPa.values = np.array([1000])
    mock_ds_pl.step.values = np.array([np.timedelta64(3, "h")], dtype="timedelta64[ns]")
    mock_ds_pl.__getitem__.side_effect = get_var
    mock_ds_pl.isel.return_value = mock_ds_pl
    mock_ds_pl.assign_coords.return_value = mock_ds_pl
    mock_ds_pl.swap_dims.return_value = mock_ds_pl
    mock_ds_pl.drop_vars.return_value = mock_ds_pl
    mock_ds_pl.expand_dims.return_value = mock_ds_pl
    mock_xr_open.return_value = mock_ds_pl

    # Combined dataset after concat
    mock_ds_full = MagicMock()
    mock_ds_full.step.values = np.array([np.timedelta64(3, "h")], dtype="timedelta64[ns]")
    mock_ds_full.drop_vars.return_value = mock_ds_full
    mock_ds_full.sortby.return_value = mock_ds_full
    mock_xr_concat.return_value = mock_ds_full

    # Interpolated dataset
    mock_ds_interp = MagicMock()
    mock_ds_interp.step.values = np.array([np.timedelta64(3, "h")], dtype="timedelta64[ns]")
    mock_ds_full.interp.return_value = mock_ds_interp

    mock_step_ds = MagicMock()
    mock_ds_interp.isel.return_value = mock_step_ds

    mock_alt_slice = MagicMock()
    mock_alt_slice.__getitem__.side_effect = lambda key: MagicMock(values=np.zeros((2, 2)))
    mock_ds_interp.sel.return_value = mock_alt_slice

    # Mock rasterio context manager
    mock_rasterio.return_value.__enter__.return_value = MagicMock()

    monkeypatch.setattr("eaip_scrapper.etl.etl_weather.GDAL_CMD", "echo")
    monkeypatch.setattr("eaip_scrapper.etl.etl_weather.os.remove", lambda x: None)
    
    success = _run_pipeline_impl(str(tmp_path))
    assert success is True

    # Check S3 manifest upload
    assert mock_s3.put_object.called
    call_args = mock_s3.put_object.call_args[1]
    assert call_args["Key"] == "weather/weather_manifest.json"
    
    manifest_data = json.loads(call_args["Body"].decode("utf-8"))
    assert "generated_at" in manifest_data
    assert "forecasts" in manifest_data
    assert len(manifest_data["forecasts"]) > 0
    assert "valid_time" in manifest_data["forecasts"][0]
    assert "files" in manifest_data["forecasts"][0]
    assert manifest_data["band_mapping"]["surface"]["7"] == "total_cloud_cover_0_1"


@patch("eaip_scrapper.etl.etl_weather._get_s3_client")
@patch("eaip_scrapper.etl.etl_weather.Client")
def test_run_pipeline_download_fails(mock_client_class, mock_get_s3_client, tmp_path):
    mock_client = MagicMock()
    # Raise exception during download
    mock_client.retrieve.side_effect = Exception("Mock download error")
    mock_client_class.return_value = mock_client

    success = _run_pipeline_impl(str(tmp_path))
    assert success is False
