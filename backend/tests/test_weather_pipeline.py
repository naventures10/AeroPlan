import json
import os
from datetime import datetime
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
        file_path = output_dir / f"wind_surface_{i}.tif"
        file_path.touch()
        files.append(file_path)

    # Reference only file 3 and 4 in manifest
    manifest_data = {
        "forecasts": [
            {
                "files": {
                    "surface": "http://example.com/wind_surface_3.tif",
                    "level_4000": "http://example.com/wind_surface_4.tif",
                }
            }
        ]
    }

    cleanup_old_files(str(output_dir), manifest_data)

    # Verify only files 3 and 4 are left
    remaining_files = sorted(list(output_dir.glob("*.tif")))
    assert len(remaining_files) == 2
    assert remaining_files[0].name == "wind_surface_3.tif"
    assert remaining_files[1].name == "wind_surface_4.tif"


def test_cleanup_old_files_empty_manifest(tmp_path):
    """Test that cleanup_old_files deletes all files if manifest is empty."""
    output_dir = tmp_path / "weather"
    output_dir.mkdir()

    file_path = output_dir / "wind_surface_0.tif"
    file_path.touch()

    cleanup_old_files(str(output_dir), {"forecasts": []})

    remaining_files = list(output_dir.glob("*.tif"))
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


@patch("app.services.weather_pipeline.xr.concat")
@patch("app.services.weather_pipeline.xr.open_dataset")
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
    mock_xr_open,
    mock_xr_concat,
    tmp_path,
    monkeypatch,
):
    output_dir = tmp_path / "weather"
    output_dir.mkdir()
    monkeypatch.setattr(settings, "WEATHER_OUTPUT_DIR", str(output_dir))
    monkeypatch.setattr(settings, "WEATHER_BASE_URL", "http://test-weather")

    # Mock arange to return only one altitude to speed up test
    mock_arange.return_value = np.array([0])

    # Mock the Client and its retrieve method
    mock_client = MagicMock()
    mock_result = MagicMock()
    mock_result.datetime = datetime(2023, 1, 1, 12, 0, 0)
    mock_client.retrieve.return_value = mock_result
    mock_client_class.return_value = mock_client

    # Mock xarray datasets
    mock_ds = MagicMock()
    mock_ds.dims = ["step", "latitude", "longitude"]
    mock_ds.coords = {
        "step": np.array([np.timedelta64(0, "h")], dtype="timedelta64[ns]"),
        "latitude": np.array([90.0, 89.75]),
        "longitude": np.array([-180.0, -179.75]),
        "isobaricInhPa": np.array([1000, 500]),
        "valid_time": np.array([np.datetime64("2023-01-01T12:00:00")]),
    }
    mock_ds.__getitem__.side_effect = lambda key: MagicMock(values=np.zeros((1, 2, 2)))
    mock_ds.isobaricInhPa.values = np.array([1000, 500])
    mock_ds.drop_vars.return_value = mock_ds
    mock_ds.assign_coords.return_value = mock_ds
    mock_ds.swap_dims.return_value = mock_ds
    mock_ds.rename.return_value = mock_ds
    mock_ds.expand_dims.return_value = mock_ds

    mock_xr_concat.return_value = mock_ds
    mock_ds.sortby.return_value = mock_ds

    # Mock interp and sel chains
    mock_interp_ds = MagicMock()
    # Mock only 1 step
    mock_interp_ds.step.values = np.array([np.timedelta64(9, "h")], dtype="timedelta64[ns]")
    mock_ds.interp.return_value = mock_interp_ds

    mock_step_ds = MagicMock()
    mock_interp_ds.isel.return_value = mock_step_ds

    mock_alt_slice = MagicMock()
    mock_alt_slice.__getitem__.side_effect = lambda key: MagicMock(values=np.zeros((2, 2)))
    mock_step_ds.sel.return_value = mock_alt_slice

    mock_xr_open.return_value = mock_ds

    # Mock rasterio context manager
    mock_rasterio.return_value.__enter__.return_value = MagicMock()

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
