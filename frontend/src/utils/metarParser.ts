import type { ParsedMetar } from '../types';

function parseWind(part: string, result: ParsedMetar): boolean {
  const windMatch = part.match(/^(\d{3}|VRB)(\d{2,3})(?:G\d{2,3})?(KT|MPS|KMH)$/i);
  if (windMatch) {
    result.windDir = windMatch[1] ?? '';
    result.windSpeed = windMatch[2] ?? '';
    result.windUnit = windMatch[3] ?? '';
    return true;
  }
  return false;
}

function parseTempDew(part: string, result: ParsedMetar): boolean {
  const tempMatch = part.match(/^(M?\d{2})\/(M?\d{2})?$/);
  if (tempMatch) {
    const parseTemp = (t: string) => (t.startsWith('M') ? -parseInt(t.substring(1)) : parseInt(t));
    if (tempMatch[1]) result.temp = parseTemp(tempMatch[1]);
    if (tempMatch[2]) result.dew = parseTemp(tempMatch[2]);
    return true;
  }
  return false;
}

function parseQnh(part: string, result: ParsedMetar): boolean {
  if (part.startsWith('Q') && part.length === 5) {
    result.qnh = parseInt(part.substring(1));
    return true;
  }
  if (part.startsWith('A') && part.length === 5) {
    // Convert inHg to hPa approx (1 inHg = 33.86 hPa)
    result.qnh = Math.round((parseInt(part.substring(1)) / 100) * 33.8639);
    return true;
  }
  return false;
}

function parseVisibility(part: string, result: ParsedMetar): boolean {
  if (part === 'CAVOK') {
    result.visibility = 'CAVOK (> 10 km)';
    result.clouds.push('Clear details (CAVOK)');
    return true;
  }
  if (part.match(/^\d{4}$/)) {
    if (part === '9999') result.visibility = '> 10 km';
    else result.visibility = `${parseInt(part)} m`;
    return true;
  }
  return false;
}

function parseClouds(part: string, result: ParsedMetar): boolean {
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
    return true;
  }
  return false;
}

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
    if (parseWind(part, result)) continue;
    if (parseTempDew(part, result)) continue;
    if (parseQnh(part, result)) continue;
    if (parseVisibility(part, result)) continue;
    if (parseClouds(part, result)) continue;
  }

  if (result.clouds.length === 0) result.clouds.push('No cloud detected');

  return result;
}
