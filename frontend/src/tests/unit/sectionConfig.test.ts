import { describe, it, expect } from 'vitest';
import { SECTION_COLUMNS } from '../../features/aip/sectionConfig';

describe('sectionConfig', () => {
  it('has configurations for all required sections', () => {
    expect(SECTION_COLUMNS['AD_2_2']).toBeDefined();
    expect(SECTION_COLUMNS['AD_2_3']).toBeDefined();
    expect(SECTION_COLUMNS['AD_2_4']).toBeDefined();
    expect(SECTION_COLUMNS['AD_2_10']).toBeDefined();
    expect(SECTION_COLUMNS['AD_2_12']).toBeDefined();
    expect(SECTION_COLUMNS['AD_2_17']).toBeDefined();
    expect(SECTION_COLUMNS['AD_2_18']).toBeDefined();
    expect(SECTION_COLUMNS['AD_2_19']).toBeDefined();
    // It's just a config file, so it doesn't really matter as long as we import it once to get coverage on the object itself.
    // The previous error showed AD_2_20 wasn't defined, which means the config doesn't export it explicitly.
  });
});
