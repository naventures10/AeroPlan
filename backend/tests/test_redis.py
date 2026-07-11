import pytest

from app.core.redis import (
    close_redis,
    get_cached_json,
    get_redis,
    init_redis,
    set_cached_json,
)


@pytest.mark.asyncio
async def test_redis_init_and_close(mock_redis) -> None:
    """Test that Redis can be initialized and closed."""
    import app.core.redis

    app.core.redis.redis_client = None

    # Initialize
    client = await init_redis()
    assert client == mock_redis
    assert get_redis() == mock_redis

    # Close
    await close_redis()
    with pytest.raises(RuntimeError, match="Redis client is not initialized"):
        get_redis()


@pytest.mark.asyncio
async def test_cache_get_set_success(mock_redis) -> None:
    """Test standard JSON cache set and get operations."""
    # Setup test data
    test_key = "test_key"
    test_value = {"nested": "value", "list": [1, 2, 3]}

    # Mock get response
    mock_redis.get.return_value = '{"nested": "value", "list": [1, 2, 3]}'

    # Initialize redis client reference
    await init_redis()

    # Set cache
    set_res = await set_cached_json(test_key, test_value)
    assert set_res is True
    mock_redis.set.assert_called_once_with(
        test_key, '{"nested": "value", "list": [1, 2, 3]}', ex=3600
    )

    # Get cache
    get_res = await get_cached_json(test_key)
    assert get_res == test_value
    mock_redis.get.assert_called_once_with(test_key)

    # Clean up client reference
    await close_redis()


@pytest.mark.asyncio
async def test_cache_get_set_failures(mock_redis) -> None:
    """Test handling of cache errors gracefully instead of raising exceptions."""
    # Initialize redis client reference
    await init_redis()

    # Fail set
    mock_redis.set.side_effect = Exception("Write error")
    set_res = await set_cached_json("fail_key", {"data": 1})
    assert set_res is False

    # Fail get
    mock_redis.get.side_effect = Exception("Read error")
    get_res = await get_cached_json("fail_key")
    assert get_res is None

    # Clean up client reference
    await close_redis()
