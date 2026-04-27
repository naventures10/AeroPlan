from unittest.mock import MagicMock


def test_get_storage_client(monkeypatch) -> None:
    """Test getting the boto3 storage client."""
    import boto3

    from app.core.storage import get_storage_client

    mock_boto3_client = MagicMock()
    mock_boto3_client.return_value = "mock_s3_client"

    monkeypatch.setattr(boto3, "client", mock_boto3_client)

    client = get_storage_client()

    assert client == "mock_s3_client"
    mock_boto3_client.assert_called_once()
