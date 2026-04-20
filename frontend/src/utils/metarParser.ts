import type { ParsedMetar } from '../types';

export function parseMetar(metar: string | null): ParsedMetar {
  const result: ParsedMetar = {
    windDir: null,
    windSpeed: null,
    windUnit: null,
    visibility: null,
    clouds: [],
    temp: null,
    dew: null,
    qnh: null,
  };

  if (!metar) return result;

  const parts = metar.split(/\s+/);

  for (const part of parts) {
    // Wind: 32010KT, VRB05KT, 27015G25KT
    const windMatch = part.match(/^(\d{3}|VRB)(\d{2,3})(?:G\d{2,3})?(KT|MPS|KMH)$/i);
    if (windMatch) {
      result.windDir = windMatch[1] ?? '';
      result.windSpeed = windMatch[2] ?? '';
      result.windUnit = windMatch[3] ?? '';
      continue;
    }

    // Temp/Dew: 29/18, M05/M08
    const tempMatch = part.match(/^(M?\d{2})\/(M?\d{2})?$/);
    if (tempMatch) {
      const parseTemp = (t: string) =>
        t.startsWith('M') ? -parseInt(t.substring(1)) : parseInt(t);
      if (tempMatch[1]) result.temp = parseTemp(tempMatch[1]);
      if (tempMatch[2]) result.dew = parseTemp(tempMatch[2]);
      continue;
    }

    // QNH: Q1009, A2992
    if (part.startsWith('Q') && part.length === 5) {
      result.qnh = parseInt(part.substring(1));
      continue;
    }
    if (part.startsWith('A') && part.length === 5) {
      // Convert inHg to hPa approx (1 inHg = 33.86 hPa)
      result.qnh = Math.round((parseInt(part.substring(1)) / 100) * 33.8639);
      continue;
    }

    // Visibility: 5000, 9999, CAVOK
    if (part === 'CAVOK') {
      result.visibility = 'CAVOK (> 10 km)';
      result.clouds.push('Clear details (CAVOK)');
      continue;
    }
    if (part.match(/^\d{4}$/)) {
      if (part === '9999') result.visibility = '> 10 km';
      else result.visibility = `${parseInt(part)} m`;
      continue;
    }

    // Clouds: FEW010, SCT020, BKN030, OVC040, NSC, NCD
    const cloudMatch = part.match(/^(FEW|SCT|BKN|OVC|NSC|NCD|VV)(\d{3})?(CB|TCU)?$/);
    if (cloudMatch) {
      let desc = cloudMatch[1] ?? '';
      const map: Record<string, string> = {
        FEW: 'Few',
        SCT: 'Scattered',
        BKN: 'Broken',
        OVC: 'Overcast',
        NSC: 'No Sig Clouds',
        NCD: 'No Clouds',
        VV: 'Vertical Vis',
      };
      desc = map[desc] || desc;
      if (cloudMatch[2]) desc += ` at ${parseInt(cloudMatch[2]) * 100} ft`;
      if (cloudMatch[3]) desc += ` (${cloudMatch[3]})`;
      result.clouds.push(desc);
      continue;
    }
  }

  if (result.clouds.length === 0) result.clouds.push('No cloud detected');

  return result;
}
