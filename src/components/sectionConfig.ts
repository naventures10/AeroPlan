/**
 * Section Column Configuration
 * 
 * Maps each AIP section ID to its official column headers and the
 * corresponding backend JSON keys. This allows the frontend renderers
 * to display data exactly matching the official AIP document structure.
 * 
 * For "object" sections:  columns = [{key, label}]   → Ref | Description | Data
 * For "array"  sections:  columns = [{key, header}]  → ordered table columns
 */

// ── OBJECT sections (rendered as Ref | Description | Data) ─────────────────

export interface ObjectColumnDef {
  key: string;
  label: string;
}

export interface ArrayColumnDef {
  key: string;
  header: string;
}

export interface SectionColumnConfig {
  type: 'object' | 'array';
  columns: ObjectColumnDef[] | ArrayColumnDef[];
}

export const SECTION_COLUMNS: Record<string, SectionColumnConfig> = {
  // ── AD 2.2 ──────────────────────────────────────────────────────────────
  AD_2_2: {
    type: 'object',
    columns: [
      { key: 'arp_coordinates_site',  label: 'Aerodrome reference point coordinates and its site' },
      { key: 'direction_distance',    label: 'Direction and distance from the centre of the city or town' },
      { key: 'elevation_reference_temp', label: 'Aerodrome elevation and reference temperature' },
      { key: 'magnetic_variation',    label: 'Magnetic variation, date of information and annual change' },
      { key: 'operator_details',      label: 'Name of aerodrome operator, address, telephone, telefax, e-mail address, AFS address' },
      { key: 'types_of_traffic',      label: 'Types of traffic permitted (IFR/VFR)' },
      { key: 'remarks',               label: 'Remarks' },
    ] as ObjectColumnDef[],
  },

  // ── AD 2.3 ──────────────────────────────────────────────────────────────
  AD_2_3: {
    type: 'object',
    columns: [
      { key: 'aerodrome_operator',    label: 'Aerodrome Operator' },
      { key: 'customs_and_immigration', label: 'Custom and Immigration' },
      { key: 'health_and_sanitation', label: 'Health and Sanitation' },
      { key: 'ais_briefing_office',   label: 'AIS Briefing Office' },
      { key: 'ats_reporting_office',  label: 'ATS Reporting Office (ARO)' },
      { key: 'met_briefing_office',   label: 'MET Briefing Office' },
      { key: 'air_traffic_service',   label: 'Air Traffic Service' },
      { key: 'fuelling',              label: 'Fuelling' },
      { key: 'handling',              label: 'Handling' },
      { key: 'security',              label: 'Security' },
      { key: 'de_icing',              label: 'De-icing' },
      { key: 'remarks',               label: 'Remarks' },
    ] as ObjectColumnDef[],
  },

  // ── AD 2.4 ──────────────────────────────────────────────────────────────
  AD_2_4: {
    type: 'object',
    columns: [
      { key: 'cargo_handling_facilities',   label: 'Cargo-handling Facilities' },
      { key: 'fuel_and_oil_types',          label: 'Fuel and Oil Types' },
      { key: 'fuelling_facilities_capacity', label: 'Fuelling Facilities and Capacity' },
      { key: 'de_icing_facilities',         label: 'De-icing Facilities' },
      { key: 'hangar_space',                label: 'Hangar Space for Visiting Aircraft' },
      { key: 'repair_facilities',           label: 'Repair Facilities for Visiting Aircraft' },
      { key: 'remarks',                     label: 'Remarks' },
    ] as ObjectColumnDef[],
  },

  // ── AD 2.5 ──────────────────────────────────────────────────────────────
  AD_2_5: {
    type: 'object',
    columns: [
      { key: 'hotels',              label: 'Hotel(s) at or in the Vicinity of Aerodrome' },
      { key: 'restaurants',         label: 'Restaurant(s) at or in the Vicinity of Aerodrome' },
      { key: 'transportation',      label: 'Transportation Possibilities' },
      { key: 'medical_facilities',  label: 'Medical Facilities' },
      { key: 'bank_and_post_office', label: 'Bank and Post Office at or in the Vicinity' },
      { key: 'tourist_office',      label: 'Tourist Office' },
      { key: 'remarks',             label: 'Remarks' },
    ] as ObjectColumnDef[],
  },

  // ── AD 2.6 ──────────────────────────────────────────────────────────────
  AD_2_6: {
    type: 'object',
    columns: [
      { key: 'aerodrome_category',  label: 'Aerodrome Category for Fire Fighting' },
      { key: 'rescue_equipment',    label: 'Rescue Equipment' },
      { key: 'removal_capability',  label: 'Capability for Removal of Disabled Aircraft' },
      { key: 'remarks',             label: 'Remarks' },
    ] as ObjectColumnDef[],
  },

  // ── AD 2.7 ──────────────────────────────────────────────────────────────
  AD_2_7: {
    type: 'object',
    columns: [
      { key: 'clearing_equipment',   label: 'Type(s) of Clearing Equipment' },
      { key: 'clearance_priorities',  label: 'Clearance Priorities' },
      { key: 'remarks',              label: 'Remarks' },
    ] as ObjectColumnDef[],
  },

  // ── AD 2.8 ──────────────────────────────────────────────────────────────
  AD_2_8: {
    type: 'object',
    columns: [
      { key: 'aprons_designation_surface_strength',      label: 'Designation, Surface and Strength of Aprons' },
      { key: 'taxiways_designation_width_surface_strength', label: 'Designation, Width, Surface and Strength of Taxiways' },
      { key: 'altimeter_checkpoints', label: 'Location and Elevation of Altimeter Checkpoints' },
      { key: 'vor_checkpoints',      label: 'Location of VOR Checkpoints' },
      { key: 'ins_checkpoints',      label: 'Position of INS Checkpoints' },
      { key: 'remarks',              label: 'Remarks' },
    ] as ObjectColumnDef[],
  },

  // ── AD 2.9 ──────────────────────────────────────────────────────────────
  AD_2_9: {
    type: 'object',
    columns: [
      { key: 'use_of_signs_and_guidance',                   label: 'Use of Aircraft Stand Identification Signs, Taxiing Guidance and Visual Docking/Parking Guidance System' },
      { key: 'runway_and_taxiway_markings_and_lights',      label: 'Runway and Taxiway Markings and Lights' },
      { key: 'stop_bars',                                   label: 'Stop Bars' },
      { key: 'remarks',                                     label: 'Remarks' },
    ] as ObjectColumnDef[],
  },

  // ── AD 2.10 ─────────────────────────────────────────────────────────────
  AD_2_10: {
    type: 'array',
    columns: [
      { key: 'area_affected',    header: 'RWY / Area Affected' },
      { key: 'obstacle_type',    header: 'Obstacle Type' },
      { key: 'coordinates',      header: 'Coordinates' },
      { key: 'elevation',        header: 'Elevation' },
      { key: 'marking_lgt',      header: 'Marking / LGT' },
      { key: 'remarks',          header: 'Remarks' },
    ] as ArrayColumnDef[],
  },

  // ── AD 2.11 ─────────────────────────────────────────────────────────────
  AD_2_11: {
    type: 'object',
    columns: [
      { key: 'associated_met_office',             label: 'Name of the Associated Meteorological Office' },
      { key: 'hours_of_service',                  label: 'Hours of Service and Designation of Responsible MET Office Outside These Hours' },
      { key: 'office_responsible_for_taf_preparation', label: 'Office Responsible for TAFs and Periods of Validity' },
      { key: 'trend_forecast_availability',       label: 'Availability of the Trend Forecast' },
      { key: 'briefing_and_consultation_provided', label: 'Information on How Briefing/Consultation is Provided' },
      { key: 'flight_documentation_supplied',     label: 'Types of Flight Documentation Supplied and Language' },
      { key: 'charts_and_other_info_available',   label: 'Charts and Other Info Available for Briefing' },
      { key: 'supplementary_equipment_available', label: 'Supplementary Equipment Available' },
      { key: 'ats_units_provided_with_info',      label: 'Air Traffic Services Unit Provided with Information' },
      { key: 'additional_information',            label: 'Additional Information' },
    ] as ObjectColumnDef[],
  },

  // ── AD 2.12 ─────────────────────────────────────────────────────────────
  AD_2_12: {
    type: 'array',
    columns: [
      { key: 'designation',          header: 'Designations' },
      { key: 'true_bearing',         header: 'TRUE Bearings' },
      { key: 'dimensions',           header: 'Dimensions of RWY (M)' },
      { key: 'strength_and_surface', header: 'Strength (PCN) & Surface' },
      { key: 'coordinates',          header: 'THR & RWY END Coordinates' },
      { key: 'thr_elevation',        header: 'THR Elevation / TDZ' },
      { key: 'slope',                header: 'Slope of RWY' },
      { key: 'stopway_dimensions',   header: 'Stopway (M)' },
      { key: 'clearway_dimensions',  header: 'Clearway (M)' },
      { key: 'strip_dimensions',     header: 'Strips (M)' },
      { key: 'resa_dimensions',      header: 'RESA' },
      { key: 'arresting_system',     header: 'Arresting System' },
      { key: 'obstacle_free_zone',   header: 'OFZ' },
      { key: 'remarks',              header: 'Remarks' },
    ] as ArrayColumnDef[],
  },

  // ── AD 2.13 ─────────────────────────────────────────────────────────────
  AD_2_13: {
    type: 'array',
    columns: [
      { key: 'designator', header: 'RWY Designator' },
      { key: 'tora',       header: 'TORA (M)' },
      { key: 'toda',       header: 'TODA (M)' },
      { key: 'asda',       header: 'ASDA (M)' },
      { key: 'lda',        header: 'LDA (M)' },
      { key: 'remarks',    header: 'Remarks' },
    ] as ArrayColumnDef[],
  },

  // ── AD 2.14 ─────────────────────────────────────────────────────────────
  AD_2_14: {
    type: 'array',
    columns: [
      { key: 'designator',                header: 'RWY Designator' },
      { key: 'approach_lighting_system',   header: 'Approach Lighting System' },
      { key: 'threshold_lights',           header: 'Threshold Lights' },
      { key: 'visual_slope_indicator',     header: 'Visual Slope Indicator' },
      { key: 'touchdown_zone_lights',      header: 'TDZ Lights' },
      { key: 'centre_line_lights',         header: 'Centre Line Lights' },
      { key: 'edge_lights',               header: 'Edge Lights' },
      { key: 'end_lights_and_wing_bars',   header: 'End Lights & Wing Bars' },
      { key: 'stopway_lights',             header: 'Stopway Lights' },
      { key: 'remarks',                    header: 'Remarks' },
    ] as ArrayColumnDef[],
  },

  // ── AD 2.15 ─────────────────────────────────────────────────────────────
  AD_2_15: {
    type: 'object',
    columns: [
      { key: 'aerodrome_beacon_identification_beacon', label: 'Aerodrome Beacon / Identification Beacon' },
      { key: 'anemometer_landing_direction_indicator', label: 'Anemometer / Landing Direction Indicator' },
      { key: 'taxiway_edge_centre_line_lights',        label: 'Taxiway Edge and Centre Line Lights' },
      { key: 'secondary_power_supply_switch_over_time', label: 'Secondary Power Supply Including Switch-Over Time' },
      { key: 'remarks',                                label: 'Remarks' },
    ] as ObjectColumnDef[],
  },

  // ── AD 2.16 ─────────────────────────────────────────────────────────────
  AD_2_16: {
    type: 'object',
    columns: [
      { key: 'coordinates_tlof_fato',                label: 'Geographical Coordinates of TLOF/FATO Centre' },
      { key: 'elevation_tlof_fato',                  label: 'TLOF and/or FATO Area Elevation' },
      { key: 'dimensions_surface_strength_marking',  label: 'TLOF and FATO Area Dimensions, Surface, Strength, Marking' },
      { key: 'true_bearings_fato',                   label: 'True Bearings of FATO' },
      { key: 'declared_distances',                   label: 'Declared Distances Available' },
      { key: 'approach_fato_lighting',               label: 'Approach and FATO Lighting' },
      { key: 'remarks',                              label: 'Remarks' },
    ] as ObjectColumnDef[],
  },

  // ── AD 2.17 ─────────────────────────────────────────────────────────────
  AD_2_17: {
    type: 'object',
    columns: [
      { key: 'designation_and_lateral_limits', label: 'Airspace Designation, Geographical Coordinates and Lateral Limits' },
      { key: 'vertical_limits',                label: 'Vertical Limits' },
      { key: 'airspace_classification',        label: 'Airspace Classification' },
      { key: 'call_sign_and_language',         label: 'Call Sign and Language(s)' },
      { key: 'transition_altitude',            label: 'Transition Altitude' },
      { key: 'hours_of_applicability',         label: 'Hours of Applicability' },
      { key: 'remarks',                        label: 'Remarks' },
    ] as ObjectColumnDef[],
  },

  // ── AD 2.18 ─────────────────────────────────────────────────────────────
  AD_2_18: {
    type: 'array',
    columns: [
      { key: 'service_type',        header: 'Service Designation' },
      { key: 'call_sign',           header: 'Call Sign' },
      { key: 'frequency',           header: 'Channel(s)' },
      { key: 'hours_of_operation',  header: 'Hours of Operation' },
      { key: 'Remarks',             header: 'Remarks' },
    ] as ArrayColumnDef[],
  },

  // ── AD 2.19 ─────────────────────────────────────────────────────────────
  AD_2_19: {
    type: 'array',
    columns: [
      { key: 'type_of_aid',            header: 'Type of Aid' },
      { key: 'identification',         header: 'Identification' },
      { key: 'frequency_channel',      header: 'Frequency / Channel' },
      { key: 'hours_of_operation',     header: 'Hours of Operation' },
      { key: 'coordinates',            header: 'Coordinates' },
      { key: 'elevation',              header: 'Elevation' },
      { key: 'service_volume_radius',  header: 'Service Volume Radius' },
      { key: 'remarks',                header: 'Remarks' },
    ] as ArrayColumnDef[],
  },

  // ── AD 2.24 ─────────────────────────────────────────────────────────────
  AD_2_24: {
    type: 'array',
    columns: [
      { key: 'index',       header: '#' },
      { key: 'chart_name',  header: 'Chart Name' },
    ] as ArrayColumnDef[],
  },
};

/**
 * Helper to extract a display-friendly value from potentially complex data.
 * Handles nested coordinate objects {raw_dms, decimal_lat, decimal_lng}
 * by returning the raw_dms string with pipes cleaned up.
 */
export function extractDisplayValue(value: any): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value || '—';
  if (typeof value === 'number') return String(value);

  // Coordinate objects → show raw_dms
  if (typeof value === 'object' && !Array.isArray(value)) {
    if ('raw_dms' in value) {
      return String(value.raw_dms || '—').replace(/\s*\|\s*/g, ' ');
    }
    // Generic object → join key-value pairs
    return Object.entries(value)
      .filter(([k]) => !k.startsWith('decimal_'))
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
  }

  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
  }

  return String(value);
}
