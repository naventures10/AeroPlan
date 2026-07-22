/**
 * Centralised feature flags.
 *
 * Each flag is read once at module-load time from a `VITE_*` env variable.
 * Set the matching variable to `"true"` in `.env` (or at build time) to lock
 * the feature; any other value (or absent) keeps the feature enabled.
 */
export const featureFlags = {
  lockAipSupplements: import.meta.env.VITE_LOCK_AIP_SUPPLEMENTS === 'true',
  lockAerodromeCharts: import.meta.env.VITE_LOCK_AERODROME_CHARTS === 'true',
} as const;

export type FeatureId = 'aip-supplements' | 'aerodrome-charts' | 'AD_2_24';

// Initialize E2E runtime overrides on window
if (typeof window !== 'undefined') {
  (window as any).__LOCKS__ = {
    lockAipSupplements: import.meta.env.VITE_LOCK_AIP_SUPPLEMENTS === 'true',
    lockAerodromeCharts: import.meta.env.VITE_LOCK_AERODROME_CHARTS === 'true',
  };
}

export function isFeatureLocked(id: FeatureId): boolean {
  if (typeof window !== 'undefined' && (window as any).__LOCKS__) {
    const overrides = (window as any).__LOCKS__;
    if (id === 'aip-supplements') {
      return overrides.lockAipSupplements;
    }
    if (id === 'aerodrome-charts' || id === 'AD_2_24') {
      return overrides.lockAerodromeCharts;
    }
    return false;
  }

  switch (id) {
    case 'aip-supplements':
      return featureFlags.lockAipSupplements;
    case 'aerodrome-charts':
    case 'AD_2_24':
      return featureFlags.lockAerodromeCharts;
    default:
      return false;
  }
}
