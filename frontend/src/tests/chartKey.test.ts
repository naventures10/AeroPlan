import { describe, it, expect } from 'vitest';
import { normalizeChartKey } from '../utils/chartKey';

describe('normalizeChartKey', () => {
  it('normalizes PDF names and URLs like the backend', () => {
    expect(normalizeChartKey('VAAU-RNP-Y-RWY-27.pdf')).toBe('VAAU-RNP-Y-RWY-27');
    expect(normalizeChartKey('https://eaip.aai.aero/foo/VAAU-RNP-Y-RWY-27.pdf')).toBe(
      'VAAU-RNP-Y-RWY-27',
    );
    expect(normalizeChartKey('  foo__bar  baz.PDF')).toBe('FOO-BAR-BAZ');
  });
});
