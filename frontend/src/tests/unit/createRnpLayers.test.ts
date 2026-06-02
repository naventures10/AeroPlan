import { describe, it, expect, vi } from 'vitest';
import { createRnpLayers } from '../../features/terminal/layers/createRnpLayers';

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
});
