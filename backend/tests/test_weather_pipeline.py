import json
import os
from unittest.mock import MagicMock, patch

import numpy as np

from app.core.config import settings
from app.services.weather_pipeline import cleanup_old_files, run_pipeline


def test_cleanup_old_files(tmp_path):
    """Test that cleanup_old_files only keeps files referenced in manifest."""
    output_dir = tmp_path / "weather"
    output_dir.mkdir()

    # Create 5 dummy files
    files = []
    for i in range(5):
        file_path = output_dir / f"weather_surface_{i}.tif"
        file_path.touch()
        files.append(file_path)

    # Reference only file 3 and 4 in manifest
    manifest_data = {
        "forecasts": [
            {
                "files": {
                    "surface": "http://example.com/weather_surface_3.tif",
                    "level_4000": "http://example.com/weather_surface_4.tif",
                }
            }
        ]
    }

    cleanup_old_files(str(output_dir), manifest_data)

    # Verify only files 3 and 4 are left
    remaining_files = sorted(list(output_dir.glob("weather_*.tif")))
    assert len(remaining_files) == 2
    assert remaining_files[0].name == "weather_surface_3.tif"
    assert remaining_files[1].name == "weather_surface_4.tif"


def test_cleanup_old_files_empty_manifest(tmp_path):
    """Test that cleanup_old_files deletes all files if manifest is empty."""
    output_dir = tmp_path / "weather"
    output_dir.mkdir()

    file_path = output_dir / "weather_surface_0.tif"
    file_path.touch()

    cleanup_old_files(str(output_dir), {"forecasts": []})

    remaining_files = list(output_dir.glob("weather_*.tif"))
    assert len(remaining_files) == 0


def test_cleanup_old_files_delete_error(tmp_path, monkeypatch):
    """Test that cleanup_old_files handles deletion errors."""
    output_dir = tmp_path / "weather"
    output_dir.mkdir()

    file_path = output_dir / "wind_surface_0.tif"
    file_path.touch()

    # Mock os.remove to raise an exception
    def mock_remove(path):
        raise OSError("Mock permission error")

    monkeypatch.setattr(os, "remove", mock_remove)

    # Should not raise exception
    cleanup_old_files(str(output_dir), {"forecasts": []})


@patch("app.services.weather_pipeline.cfgrib.open_datasets")
@patch("app.services.weather_pipeline.xr.open_dataset")
@patch("app.services.weather_pipeline.xr.concat")
@patch("app.services.weather_pipeline.rasterio.open")
@patch("app.services.weather_pipeline.Client")
@patch("app.services.weather_pipeline.subprocess.run")
@patch("app.services.weather_pipeline.os.remove")
@patch("app.services.weather_pipeline.np.arange")
def test_run_pipeline_success(
    mock_arange,
    mock_os_remove,
    mock_run,
    mock_client_class,
    mock_rasterio,
    mock_xr_concat,
    mock_xr_open,
    mock_cfgrib_open,
    tmp_path,
    monkeypatch,
):
    output_dir = tmp_path / "weather"
    output_dir.mkdir()
    monkeypatch.setattr(settings, "WEATHER_OUTPUT_DIR", str(output_dir))
    monkeypatch.setattr(settings, "WEATHER_BASE_URL", "http://test-weather")

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

    # Mock __getitem__ for variables
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

    # Mock time.sleep to speed up test
    with patch("time.sleep"):
        run_pipeline()

    # Verify manifest was created
    manifest_path = output_dir / "weather_manifest.json"
    assert manifest_path.exists()

    with open(manifest_path) as f:
        data = json.loads(f.read())
        assert "generated_at" in data
        assert "forecasts" in data
        assert len(data["forecasts"]) > 0
        assert "valid_time" in data["forecasts"][0]
        assert "files" in data["forecasts"][0]
        # Check cloud cover band exists in mapping
        assert data["band_mapping"]["surface"]["7"] == "total_cloud_cover_0_1"


@patch("app.services.weather_pipeline.Client")
@patch("app.services.weather_pipeline.os.remove")
def test_run_pipeline_download_fails(mock_os_remove, mock_client_class, tmp_path, monkeypatch):
    output_dir = tmp_path / "weather"
    output_dir.mkdir()
    monkeypatch.setattr(settings, "WEATHER_OUTPUT_DIR", str(output_dir))

    mock_client = MagicMock()
    # Raise exception during download
    mock_client.retrieve.side_effect = Exception("Mock download error")
    mock_client_class.return_value = mock_client

    # Should not raise exception
    run_pipeline()

    # Verify manifest not created
    manifest_path = output_dir / "weather_manifest.json"
    assert not manifest_path.exists()


@patch("app.services.weather_pipeline.cfgrib.open_datasets")
@patch("app.services.weather_pipeline.xr.open_dataset")
@patch("app.services.weather_pipeline.xr.concat")
@patch("app.services.weather_pipeline.rasterio.open")
@patch("app.services.weather_pipeline.Client")
@patch("app.services.weather_pipeline.subprocess.run")
@patch("app.services.weather_pipeline.os.remove")
@patch("app.services.weather_pipeline.np.arange")
def test_run_pipeline_fallback_success(
    mock_arange,
    mock_os_remove,
    mock_run,
    mock_client_class,
    mock_rasterio,
    mock_xr_concat,
    mock_xr_open,
    mock_cfgrib_open,
    tmp_path,
    monkeypatch,
):
    output_dir = tmp_path / "weather"
    output_dir.mkdir()
    monkeypatch.setattr(settings, "WEATHER_OUTPUT_DIR", str(output_dir))
    monkeypatch.setattr(settings, "WEATHER_BASE_URL", "http://test-weather")

    mock_arange.return_value = np.array([0])

    mock_client = MagicMock()

    # Fail on first attempt, succeed on second attempt
    call_count = 0

    def mock_retrieve(*args, **kwargs):
        nonlocal call_count
        if call_count < 2:
            call_count += 1
            raise Exception("Mock 404 error")
        call_count += 1
        return MagicMock()

    mock_client.retrieve.side_effect = mock_retrieve
    mock_client_class.return_value = mock_client

    # Mock other requirements to complete the pipeline
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

    mock_ds_full = MagicMock()
    mock_ds_full.step.values = np.array([np.timedelta64(3, "h")], dtype="timedelta64[ns]")
    mock_ds_full.drop_vars.return_value = mock_ds_full
    mock_ds_full.sortby.return_value = mock_ds_full
    mock_xr_concat.return_value = mock_ds_full

    mock_ds_interp = MagicMock()
    mock_ds_interp.step.values = np.array([np.timedelta64(3, "h")], dtype="timedelta64[ns]")
    mock_ds_full.interp.return_value = mock_ds_interp

    mock_step_ds = MagicMock()
    mock_ds_interp.isel.return_value = mock_step_ds

    mock_alt_slice = MagicMock()
    mock_alt_slice.__getitem__.side_effect = lambda key: MagicMock(values=np.zeros((2, 2)))
    mock_ds_interp.sel.return_value = mock_alt_slice

    mock_rasterio.return_value.__enter__.return_value = MagicMock()

    with patch("time.sleep"):
        success = run_pipeline()

    assert success is True
    manifest_path = output_dir / "weather_manifest.json"
    assert manifest_path.exists()
