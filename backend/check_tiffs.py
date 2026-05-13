import numpy as np
import rasterio


def check(f1, f2):
    with rasterio.open(f1) as src1:
        v1 = src1.read(1)
    with rasterio.open(f2) as src2:
        v2 = src2.read(1)

    print(f"Max diff: {np.max(np.abs(v1 - v2))}")
    print(f"Mean diff: {np.mean(np.abs(v1 - v2))}")


print("Surface vs 001:")
check(
    "frontend/public/weather/weather_surface_20260503_185833_step006.tif",
    "frontend/public/weather/weather_001_20260503_185833_step006.tif",
)

print("001 vs 002:")
check(
    "frontend/public/weather/weather_001_20260503_185833_step006.tif",
    "frontend/public/weather/weather_002_20260503_185833_step006.tif",
)
