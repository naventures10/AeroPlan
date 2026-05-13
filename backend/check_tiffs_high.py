import rasterio


def check(f1, f2):
    with rasterio.open(f1) as src1:
        v1 = src1.read(1)
        v1_v = src1.read(2)
    with rasterio.open(f2) as src2:
        v2 = src2.read(1)
        v2_v = src2.read(2)

    print(f"File 1 pixel (100, 100): U={v1[100, 100]:.2f}, V={v1_v[100, 100]:.2f}")
    print(f"File 2 pixel (100, 100): U={v2[100, 100]:.2f}, V={v2_v[100, 100]:.2f}")


print("Surface vs 030 (30000 ft):")
check(
    "frontend/public/weather/weather_surface_20260503_185833_step006.tif",
    "frontend/public/weather/weather_030_20260503_185833_step006.tif",
)
