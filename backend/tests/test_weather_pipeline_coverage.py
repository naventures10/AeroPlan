import os
from unittest.mock import MagicMock, patch

import numpy as np

from app.core.config import settings
from app.services.weather_pipeline import run_pipeline, safe_remove_grib


def test_safe_remove_grib_none():
    """Cover line 55: return if file_path is None."""
    assert safe_remove_grib("") is None


def test_safe_remove_grib_exception(monkeypatch):
    """Cover lines 64-65: exception handling in safe_remove_grib."""
    # Create a dummy file
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


@patch("app.services.weather_pipeline.cfgrib.open_datasets")
@patch("app.services.weather_pipeline.xr.open_dataset")
@patch("app.services.weather_pipeline.Client")
@patch("app.services.weather_pipeline.os.makedirs")
def test_run_pipeline_expand_dims(
    mock_makedirs, mock_client_class, mock_xr_open, mock_cfgrib_open, tmp_path, monkeypatch
):
    """Cover lines 236-237 and 240-241: expand_dims('step') for single-step datasets."""
    output_dir = tmp_path / "weather"
    monkeypatch.setattr(settings, "WEATHER_OUTPUT_DIR", str(output_dir))

    mock_ds = MagicMock()
    # Missing 'step' in dims to trigger expand_dims
    mock_ds.dims = ["latitude", "longitude"]
    mock_ds.expand_dims.return_value = mock_ds
    mock_ds.data_vars = []
    mock_xr_open.return_value = mock_ds
    mock_cfgrib_open.return_value = [mock_ds]

    # Mock retrieve to not do anything
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client

    # Trigger an exception early in processing to avoid full run but cover the expand_dims
    mock_ds.__getitem__.side_effect = Exception("Stop here")

    run_pipeline()
    assert mock_ds.expand_dims.called


@patch("app.services.weather_pipeline.cfgrib.open_datasets")
@patch("app.services.weather_pipeline.xr.open_dataset")
@patch("app.services.weather_pipeline.Client")
def test_run_pipeline_processing_exception(
    mock_client_class, mock_xr_open, mock_cfgrib_open, tmp_path, monkeypatch
):
    """Cover exception handling in COG generation."""
    output_dir = tmp_path / "weather"
    monkeypatch.setattr(settings, "WEATHER_OUTPUT_DIR", str(output_dir))

    mock_cfgrib_open.side_effect = Exception("Processing failed")
    run_pipeline()
    # Should log error and return safely


@patch("app.services.weather_pipeline.xr.open_dataset")
@patch("app.services.weather_pipeline.Client")
@patch("app.services.weather_pipeline.xr.concat")
@patch("app.services.weather_pipeline.np.arange")
def test_run_pipeline_manifest_exception(
    mock_arange, mock_xr_concat, mock_client_class, mock_xr_open, tmp_path, monkeypatch
):
    """Cover lines 308-309: exception handling in manifest update."""
    output_dir = tmp_path / "weather"
    output_dir.mkdir()
    monkeypatch.setattr(settings, "WEATHER_OUTPUT_DIR", str(output_dir))

    # Mock enough to reach manifest update
    mock_arange.return_value = np.array([0])
    mock_ds = MagicMock()
    mock_ds.dims = ["step", "latitude", "longitude"]
    mock_ds.coords = {"step": np.array([np.timedelta64(0, "h")])}
    mock_xr_open.return_value = mock_ds
    mock_xr_concat.return_value = mock_ds

    # Mock open(temp_manifest, "w") to fail
    with patch("builtins.open", side_effect=OSError("Manifest write failed")):
        run_pipeline()
    # Should log error and continue


def test_cleanup_old_files(tmp_path):
    """Cover cleanup_old_files logic."""
    output_dir = tmp_path / "weather"
    output_dir.mkdir()

    # Create an active file and a stale file
    active_tif = output_dir / "weather_active.tif"
    stale_tif = output_dir / "weather_stale.tif"
    active_tif.write_text("active")
    stale_tif.write_text("stale")

    manifest = {"forecasts": [{"files": {"surface": "http://example.com/weather_active.tif"}}]}

    from app.services.weather_pipeline import cleanup_old_files

    cleanup_old_files(str(output_dir), manifest)

    assert active_tif.exists()
    assert not stale_tif.exists()


def test_cleanup_old_files_exception(tmp_path, monkeypatch):
    """Cover exception in cleanup_old_files."""
    output_dir = tmp_path / "weather"
    output_dir.mkdir()
    stale_tif = output_dir / "weather_stale.tif"
    stale_tif.write_text("stale")

    def mock_remove(path):
        raise OSError("Delete failed")

    monkeypatch.setattr(os, "remove", mock_remove)

    from app.services.weather_pipeline import cleanup_old_files

    cleanup_old_files(str(output_dir), {})
    # Should log error and not raise


@patch("app.services.weather_pipeline.Client")
def test_run_pipeline_download_failed(mock_client_class, tmp_path, monkeypatch):
    """Cover lines 142-145: download_failed block."""
    mock_client = MagicMock()
    mock_client.retrieve.side_effect = Exception("Download failed")
    mock_client_class.return_value = mock_client

    run_pipeline()
    # Should return early
