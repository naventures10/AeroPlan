import { describe, it, expect } from 'vitest';
import { parseMetar } from '../../utils/metarParser';

describe('metarParser', () => {
  it('should return empty struct for null or empty', () => {
    expect(parseMetar(null)).toEqual({
      windDir: null,
      windSpeed: null,
      windUnit: null,
      visibility: null,
      clouds: [],
      temp: null,
      dew: null,
      qnh: null,
    });
    expect(parseMetar('')).toEqual({
      windDir: null,
      windSpeed: null,
      windUnit: null,
      visibility: null,
      clouds: [],
      temp: null,
      dew: null,
      qnh: null,
    });
  });

  it('should parse wind properly', () => {
    let res = parseMetar('VOBM 12010KT');
    expect(res.windDir).toBe('120');
    expect(res.windSpeed).toBe('10');
    expect(res.windUnit).toBe('KT');

    res = parseMetar('VRB05MPS');
    expect(res.windDir).toBe('VRB');
    expect(res.windSpeed).toBe('05');
    expect(res.windUnit).toBe('MPS');

    res = parseMetar('27015G25KMH');
    expect(res.windDir).toBe('270');
    expect(res.windSpeed).toBe('15');
    expect(res.windUnit).toBe('KMH');
  });

  it('should parse temp and dewpoint', () => {
    let res = parseMetar('VOBM 29/18');
    expect(res.temp).toBe(29);
    expect(res.dew).toBe(18);

    res = parseMetar('M05/M08');
    expect(res.temp).toBe(-5);
    expect(res.dew).toBe(-8);

    res = parseMetar('05/');
    expect(res.temp).toBe(5);
    expect(res.dew).toBe(null);
  });

  it('should parse QNH', () => {
    let res = parseMetar('Q1009');
    expect(res.qnh).toBe(1009);

    res = parseMetar('A2992');
    expect(res.qnh).toBe(1013); // Math.round(29.92 * 33.8639)
  });

  it('should parse visibility and CAVOK', () => {
    let res = parseMetar('CAVOK');
    expect(res.visibility).toBe('CAVOK (> 10 km)');
    expect(res.clouds).toContain('Clear details (CAVOK)');

    res = parseMetar('9999');
    expect(res.visibility).toBe('> 10 km');

    res = parseMetar('5000');
    expect(res.visibility).toBe('5000 m');
  });

  it('should parse clouds', () => {
    const res = parseMetar('FEW010 SCT020 BKN030 OVC040 VV005CB NCD');
    expect(res.clouds).toEqual([
      'Few at 1000 ft',
      'Scattered at 2000 ft',
      'Broken at 3000 ft',
      'Overcast at 4000 ft',
      'Vertical Vis at 500 ft (CB)',
      'No Clouds',
    ]);
  });
});
