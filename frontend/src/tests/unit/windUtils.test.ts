import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatIST, calculateNowIndex } from '../../features/map/utils/windUtils';

describe('windUtils', () => {
  describe('formatIST', () => {
    it('should format UTC string to IST label and date', () => {
      // 2026-04-28T12:00:00Z is 5:30 PM IST
      const iso = '2026-04-28T12:00:00Z';
      const result = formatIST(iso);

      expect(result.label).toContain('5:30');
      expect(result.label).toContain('pm');
      expect(result.date).toContain('Tuesday');
      expect(result.date).toContain('28');
      expect(result.date).toContain('April');
      expect(result.date).toContain('2026');
    });
  });

  describe('calculateNowIndex', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return 0 if timestamps are empty', () => {
      expect(calculateNowIndex([])).toBe(0);
    });

    it('should return 0 if "now" is before the first timestamp', () => {
      const now = new Date('2026-04-28T10:00:00Z');
      vi.setSystemTime(now);

      const timestamps = [
        { validTime: '2026-04-28T12:00:00Z', label: '', date: '', files: {} },
        { validTime: '2026-04-28T15:00:00Z', label: '', date: '', files: {} },
      ];

      expect(calculateNowIndex(timestamps)).toBe(0);
    });

    it('should return last index if "now" is after the last timestamp', () => {
      const now = new Date('2026-04-28T20:00:00Z');
      vi.setSystemTime(now);

      const timestamps = [
        { validTime: '2026-04-28T12:00:00Z', label: '', date: '', files: {} },
        { validTime: '2026-04-28T15:00:00Z', label: '', date: '', files: {} },
      ];

      expect(calculateNowIndex(timestamps)).toBe(1);
    });

    it('should return interpolated index if "now" is between timestamps', () => {
      // Exactly in middle of 12:00 and 14:00 (which is 13:00)
      const now = new Date('2026-04-28T13:00:00Z');
      vi.setSystemTime(now);

      const timestamps = [
        { validTime: '2026-04-28T12:00:00Z', label: '', date: '', files: {} },
        { validTime: '2026-04-28T14:00:00Z', label: '', date: '', files: {} },
      ];

      expect(calculateNowIndex(timestamps)).toBe(0.5);
    });
  });
});
