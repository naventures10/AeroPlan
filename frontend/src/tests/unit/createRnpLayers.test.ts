import { describe, it, expect, vi } from 'vitest';
import { createRnpLayers } from '../../features/terminal/layers/rnp/createRnpLayers';

describe('createRnpLayers', () => {
  const mockPathData = {
    approach_paths: [
      {
        entry_waypoint: 'A1',
        path: [
          [0, 0, 100],
          [1, 1, 200],
        ],
        timestamps: [0, 1],
        total_distance_nm: 10,
      },
      {
        entry_waypoint: 'A2',
        path: [
          [2, 2, 300],
          [3, 3, 400],
        ],
        timestamps: [0, 2],
        total_distance_nm: 20,
      },
    ],
    missed_approach_path: {
      path: [
        [1, 1, 200],
        [2, 2, 300],
      ],
      timestamps: [0, 1],
      total_distance_nm: 10,
    },
    waypoints: [{ name: 'W1', position: [0, 0, 100], role: 'entry' }],
  };

  it('handles null pathData', () => {
    const layers = createRnpLayers({ pathData: null } as any);
    expect(layers).toEqual([]);
  });

  it('creates layers without selected approach', () => {
    const ctx = {
      pathData: mockPathData,
      selectedRnpApproachId: null,
      hoveredRnpApproachId: null,
      setSelectedRnpApproachId: vi.fn(),
      rnpCurrentTime: 0,
      approachDist: 0,
    };

    const layers = createRnpLayers(ctx as any);
    // Linestrings, Waypoints scatter, Waypoints labels
    expect(layers.length).toBe(3);

    const linestring = layers[0];
    expect(linestring.id).toBe('rnp-approach-linestrings-layer');
    expect(linestring.props.getColor({ entry_waypoint: 'A1' })).toEqual([255, 0, 255, 160]);

    // test click
    linestring.props.onClick({ object: { entry_waypoint: 'A1' } });
    expect(ctx.setSelectedRnpApproachId).toHaveBeenCalledWith('A1');

    linestring.props.onClick({}); // empty
    expect(ctx.setSelectedRnpApproachId).toHaveBeenCalledWith(null);
  });

  it('creates layers with hovered approach', () => {
    const ctx = {
      pathData: mockPathData,
      selectedRnpApproachId: null,
      hoveredRnpApproachId: 'A1',
      setSelectedRnpApproachId: vi.fn(),
      rnpCurrentTime: 0,
      approachDist: 0,
    };

    const layers = createRnpLayers(ctx as any);
    const linestring = layers[0];
    expect(linestring.props.getColor({ entry_waypoint: 'A1' })).toEqual([255, 255, 255, 255]);
    expect(linestring.props.getWidth({ entry_waypoint: 'A1' })).toBe(6);
  });

  it('creates layers with selected approach', () => {
    const ctx = {
      pathData: mockPathData,
      selectedRnpApproachId: 'A1',
      hoveredRnpApproachId: null,
      setSelectedRnpApproachId: vi.fn(),
      rnpCurrentTime: 5,
      approachDist: 10,
    };

    const layers = createRnpLayers(ctx as any);

    // Linestrings, Gradient, Trips, Missed Static, Transition Marker, Transition Label, Waypoints scatter, Waypoints labels
    expect(layers.length).toBe(8);

    const linestring = layers[0];
    expect(linestring.props.data.length).toBe(1); // A1 filtered out
    expect(linestring.props.getColor({ entry_waypoint: 'A1' })).toEqual([255, 0, 255, 30]);
    expect(linestring.props.getColor({ entry_waypoint: 'A2' })).toEqual([255, 0, 255, 30]);

    const gradient = layers[1];
    expect(gradient.id).toBe('rnp-selected-approach-static-gradient-layer');

    const trips = layers[2];
    expect(trips.id).toBe('rnp-approach-trips-layer');
    expect(trips.props.currentTime).toBe(5);

    const staticLayer = layers[3];
    expect(staticLayer.id).toBe('rnp-missed-approach-static-layer');

    const transitionMarker = layers[4];
    expect(transitionMarker.id).toBe('rnp-mapt-transition-marker-layer');

    const transitionLabel = layers[5];
    expect(transitionLabel.id).toBe('rnp-mapt-transition-label-layer');
    expect(transitionLabel.props.getText()).toBe('MPAt');
  });

  it('clamping behavior when time exceeds approachDist', () => {
    const ctx = {
      pathData: mockPathData,
      selectedRnpApproachId: 'A1',
      hoveredRnpApproachId: null,
      setSelectedRnpApproachId: vi.fn(),
      rnpCurrentTime: 15,
      approachDist: 10,
    };

    const layers = createRnpLayers(ctx as any);
    // Linestrings, Gradient, Trips, Missed Static, Transition Marker, Transition Label, Waypoints scatter, Waypoints labels
    expect(layers.length).toBe(8);

    const trips = layers[2];
    expect(trips.props.currentTime).toBe(10); // clamped

    const staticLayer = layers[3];
    expect(staticLayer.id).toBe('rnp-missed-approach-static-layer');

    const transitionMarker = layers[4];
    expect(transitionMarker.id).toBe('rnp-mapt-transition-marker-layer');

    const transitionLabel = layers[5];
    expect(transitionLabel.id).toBe('rnp-mapt-transition-label-layer');
  });

  it('handles waypoints', () => {
    const ctx = {
      pathData: {
        ...mockPathData,
        waypoints: [
          { name: 'W1', position: [0, 0, 100], role: 'entry' },
          { name: 'RW09', position: [0.1, 0.1, 50], role: 'MAPt' },
          { name: 'RW36', position: [0.2, 0.2, 10], role: 'RWY' },
        ],
      },
      selectedRnpApproachId: null,
      hoveredRnpApproachId: null,
      setSelectedRnpApproachId: vi.fn(),
      rnpCurrentTime: 0,
      approachDist: 0,
    };

    const layers = createRnpLayers(ctx as any);

    // Layers: linestrings, rwy-markers, flyby-markers, labels
    expect(layers.length).toBe(4);

    const rwyLayer = layers[1];
    const flybyLayer = layers[2];
    const labelsLayer = layers[3];

    expect(rwyLayer.id).toBe('rnp-rwy-markers-layer');
    expect(flybyLayer.id).toBe('rnp-flyby-markers-layer');
    expect(labelsLayer.id).toBe('rnp-waypoint-labels-layer');

    // Verify correct MAPt / runway filtering
    expect(rwyLayer.props.data.map((d: any) => d.name)).toEqual(['RW36']);
    expect(flybyLayer.props.data.map((d: any) => d.name)).toEqual(['W1', 'RW09']);
    expect(labelsLayer.props.data.map((d: any) => d.name)).toEqual(['W1', 'RW09']);

    expect(rwyLayer.props.getFillColor({ role: 'iaf' })).toEqual([255, 100, 200, 255]); // roleColor
    expect(rwyLayer.props.getFillColor({ role: 'something_else' })).toEqual([255, 191, 0, 220]); // COLOR_WAYPOINT

    expect(flybyLayer.props.getColor({ role: 'iaf' })).toEqual([255, 100, 200, 255]); // roleColor
    expect(flybyLayer.props.getColor({ role: 'something_else' })).toEqual([255, 191, 0, 220]); // COLOR_WAYPOINT
  });

  it('approach linestrings PathLayer should not have transitions (flicker fix)', () => {
    const ctx = {
      pathData: mockPathData,
      selectedRnpApproachId: null,
      hoveredRnpApproachId: null,
      setSelectedRnpApproachId: vi.fn(),
      rnpCurrentTime: 0,
      approachDist: 0,
    };

    const layers = createRnpLayers(ctx as any);
    const linestring = layers[0];
    expect(linestring.id).toBe('rnp-approach-linestrings-layer');
    // transitions cause flicker — they must not be present
    expect(linestring.props.transitions).toBeFalsy();
  });

  it('creates hold patterns layer when present', () => {
    // We need 36 points in path to trigger chevron generation
    const mockHoldPath = Array.from({ length: 36 }, () => [0, 0, 100]);
    // Outbound leg: segment from index 16 [0, 0] to index 17 [0.1, 0.1]
    mockHoldPath[16] = [0, 0, 100];
    mockHoldPath[17] = [0.1, 0.1, 100];
    // Inbound leg: segment from index 34 [1, 0] to index 35 [0.9, -0.1]
    mockHoldPath[34] = [1, 0, 100];
    mockHoldPath[35] = [0.9, -0.1, 100];

    const pathDataWithHolds = {
      ...mockPathData,
      hold_patterns: [
        {
          waypoint_ident: 'HOLD1',
          path: mockHoldPath,
          turn_direction: 'R',
          inbound_course: 90,
          leg_distance_nm: 4,
          original_distance_str: '4NM',
          altitude_ft: 2000,
          speed_limit_kt: 230,
        },
      ],
    };

    const ctx = {
      pathData: pathDataWithHolds,
      selectedRnpApproachId: null,
      hoveredRnpApproachId: null,
      setSelectedRnpApproachId: vi.fn(),
      rnpCurrentTime: 0,
      approachDist: 0,
    };

    const layers = createRnpLayers(ctx as any);
    // Linestrings, Hold patterns, Hold annotations, Hold chevrons, Hold chevron labels, Waypoints scatter, Waypoints labels
    expect(layers.length).toBe(7);

    const holdLayer = layers[1];
    expect(holdLayer.id).toBe('rnp-hold-patterns-layer');
    expect(holdLayer.props.getColor).toEqual([50, 220, 80, 220]); // Harmonies premium lime green
    expect(holdLayer.props.getWidth).toBe(3);

    const annotationLayer = layers[2];
    expect(annotationLayer.id).toBe('rnp-hold-annotations-layer');
    expect(annotationLayer.props.getColor).toEqual([50, 220, 80, 255]); // Green
    expect(annotationLayer.props.data.length).toBe(1);
    expect(annotationLayer.props.data[0].position).toEqual([0, 0, 104]);

    const chevronLayer = layers[3];
    expect(chevronLayer.id).toBe('rnp-hold-chevrons-layer');
    expect(chevronLayer.props.billboard).toBe(false); // Lay flat

    const chevronLabelsLayer = layers[4];
    expect(chevronLabelsLayer.id).toBe('rnp-hold-chevron-labels-layer');

    // Retrieve the data passed to the chevrons layer
    const chevronData = chevronLayer.props.data;
    expect(chevronData.length).toBe(2);

    // Outbound chevron (index 0)
    // visual bearing: atan2(0.1, 0.1) * 180 / PI = 45 degrees
    // angle: (90 - 45 + 360) % 360 = 45 degrees
    expect(chevronData[0].angle).toBeCloseTo(45);
    expect(chevronData[0].label).toBe('270°'); // outbound course (inbound + 180) % 360

    // Inbound chevron (index 1)
    // visual bearing: atan2(-0.1, -0.1) * 180 / PI = 225 degrees
    // angle: (90 - 225 + 360) % 360 = 225 degrees
    expect(chevronData[1].angle).toBeCloseTo(225);
    expect(chevronData[1].label).toBe('090°'); // inbound course
  });
});
