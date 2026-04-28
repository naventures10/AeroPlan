export interface ForecastTimestamp {
  label: string;
  date: string;
  validTime: string;
  files: Record<string, string>;
}

export const formatIST = (isoString: string) => {
  const utcDate = new Date(isoString);

  const labelFormatter = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });

  const dateFormatter = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  return {
    label: labelFormatter.format(utcDate),
    date: dateFormatter.format(utcDate),
  };
};

/**
 * Calculates the fractional index of 'now' within the forecast timestamps.
 */
export const calculateNowIndex = (timestamps: ForecastTimestamp[]) => {
  if (timestamps.length === 0) return 0;
  const now = new Date().getTime();

  // Find the two timestamps between which 'now' falls
  for (let i = 0; i < timestamps.length - 1; i++) {
    const time1 = timestamps[i]?.validTime;
    const time2 = timestamps[i + 1]?.validTime;

    if (time1 && time2) {
      const t1 = new Date(time1).getTime();
      const t2 = new Date(time2).getTime();

      if (now >= t1 && now <= t2) {
        // Linear interpolation for the index
        return i + (now - t1) / (t2 - t1);
      }
    }
  }

  // If 'now' is before the first timestamp
  const firstTime = timestamps[0]?.validTime;
  if (firstTime && now < new Date(firstTime).getTime()) return 0;

  // If 'now' is after the last timestamp
  return timestamps.length - 1;
};

/** GeoTIFF data bounds matching the GDAL crop: [minLon, minLat, maxLon, maxLat] */
export const WIND_BOUNDS: [number, number, number, number] = [20, -10, 180, 80];

/** Clip slightly outside bounds so particles don't get clipped at exact edge */
export const CLIP_BOUNDS: [number, number, number, number] = [19.5, -10.5, 180.5, 80.5];

// Wind-speed palette: calm (blue) → fast (red)
// Data is in m/s, so we keep this mapped to m/s values.
export const WIND_PALETTE = `
0       #3288bd
10.29   #66c2a5
20.58   #abdda4
30.87   #e6f598
41.16   #fee08b
51.44   #fdae61
61.73   #d53e4f
`;
