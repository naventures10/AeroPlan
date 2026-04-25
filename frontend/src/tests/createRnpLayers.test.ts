import { describe, it, expect, vi } from 'vitest';
import { createRnpLayers } from '../features/terminal/layers/createRnpLayers';

describe('createRnpLayers', () => {
  const mockPathData = {
    approach_paths: [
      { entry_waypoint: 'A1', path: [[0, 0, 100], [1, 1, 200]], timestamps: [0, 1], total_distance_nm: 10 },
      { entry_waypoint: 'A2', path: [[2, 2, 300], [3, 3, 400]], timestamps: [0, 2], total_distance_nm: 20 },
    ],
    missed_approach_path: {
      path: [[1, 1, 200], [2, 2, 300]], timestamps: [0, 1], total_distance_nm: 10
    },
    waypoints: [
      { name: 'W1', position: [0, 0, 100], role: 'entry' }
    ]
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
      approachDist: 0
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
      approachDist: 0
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
      approachDist: 10
    };

    const layers = createRnpLayers(ctx as any);

    // Linestrings, Trips, Missed Ghost, Missed Revealed (none because time < approachDist), Waypoints scatter, Waypoints labels
    expect(layers.length).toBe(5);

    const linestring = layers[0];
    expect(linestring.props.getColor({ entry_waypoint: 'A1' })).toEqual([255, 0, 255, 0]);
    expect(linestring.props.getColor({ entry_waypoint: 'A2' })).toEqual([255, 0, 255, 30]);

    const trips = layers[1];
    expect(trips.id).toBe('rnp-approach-trips-layer');
    expect(trips.props.currentTime).toBe(5);

    const ghost = layers[2];
    expect(ghost.id).toBe('rnp-missed-approach-ghost-layer');
  });

  it('creates missed approach revealed layer', () => {
    const ctx = {
      pathData: mockPathData,
      selectedRnpApproachId: 'A1',
      hoveredRnpApproachId: null,
      setSelectedRnpApproachId: vi.fn(),
      rnpCurrentTime: 15,
      approachDist: 10
    };

    const layers = createRnpLayers(ctx as any);
    // Linestrings, Trips, Missed Ghost, Missed Revealed, Waypoints scatter, Waypoints labels
    expect(layers.length).toBe(6);

    const trips = layers[1];
    expect(trips.props.currentTime).toBe(10); // clamped

    const revealed = layers[3];
    expect(revealed.id).toBe('rnp-missed-approach-revealed-layer');
  });

  it('handles waypoints', () => {
    const ctx = {
      pathData: mockPathData,
      selectedRnpApproachId: null,
      setSelectedRnpApproachId: vi.fn(),
      rnpCurrentTime: 0,
      approachDist: 0
    };

    const layers = createRnpLayers(ctx as any);
    const scatter = layers[1];
    const labels = layers[2];

    expect(scatter.id).toBe('rnp-waypoint-markers-layer');
    expect(labels.id).toBe('rnp-waypoint-labels-layer');

    expect(scatter.props.getFillColor({ role: 'iaf' })).toEqual([255, 100, 200, 255]); // roleColor
    expect(scatter.props.getFillColor({ role: 'something_else' })).toEqual([255, 191, 0, 220]); // COLOR_WAYPOINT
  });
});
