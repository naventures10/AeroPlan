import { describe, it, expect } from 'vitest';
import { normalizeChartKey } from '../utils/chartKey';

describe('normalizeChartKey', () => {
  it('should return empty string for null, undefined, empty', () => {
    expect(normalizeChartKey(null)).toBe('');
    expect(normalizeChartKey(undefined)).toBe('');
    expect(normalizeChartKey('')).toBe('');
    expect(normalizeChartKey('   ')).toBe('');
  });

  it('should extract filename from url', () => {
    expect(normalizeChartKey('https://example.com/charts/VOBM_RNP_09.pdf')).toBe('VOBM-RNP-09');
    expect(normalizeChartKey('http://a.b/c/VOBM%20RNP%2009.PDF')).toBe('VOBM-RNP-09');
  });

  it('should extract filename from path', () => {
    expect(normalizeChartKey('/local/path/VOBM_RNP_09.PDF')).toBe('VOBM-RNP-09');
  });

  it('should format chart strings properly, removing extensions and normalising dashes', () => {
    expect(normalizeChartKey('VOBM_RNP_09')).toBe('VOBM-RNP-09');
    expect(normalizeChartKey('VOBM   RNP__09.pdf')).toBe('VOBM-RNP-09');
    expect(normalizeChartKey('  VOBM-RNP-09  ')).toBe('VOBM-RNP-09');
  });

  it('should remove common suffixes', () => {
    expect(normalizeChartKey('VOBM_RNP_09-CODING-TABLES')).toBe('VOBM-RNP-09');
    expect(normalizeChartKey('VOBM-RNP-09-CAT-A-B-C-D')).toBe('VOBM-RNP-09');
    expect(normalizeChartKey('VOBM-RNP-09-FAS-DATA-PROFILE')).toBe('VOBM-RNP-09');
  });
});
