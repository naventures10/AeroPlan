export type NetworkNode = {
  position: [number, number];
  hoverRadius: number;
  size: number;
  nodeType: number;
  frequencyNorm: number; // 0.0 to 1.0, drives the ping rate
};

export type NetworkEdge = {
  from: number;
  to: number;
  routeClass: number; // 0.0 to 1.0, drives traffic density/speed
};

export type AirspaceOutline = {
  start: [number, number];
  end: [number, number];
};

export const airwayNetworkNodes: NetworkNode[] = [
  { position: [0.12, 0.68], hoverRadius: 0.055, size: 0.016, nodeType: 0, frequencyNorm: 0.8 },
  { position: [0.23, 0.61], hoverRadius: 0.048, size: 0.012, nodeType: 3, frequencyNorm: 0.4 },
  { position: [0.36, 0.57], hoverRadius: 0.052, size: 0.015, nodeType: 1, frequencyNorm: 0.6 },
  { position: [0.48, 0.63], hoverRadius: 0.048, size: 0.012, nodeType: 3, frequencyNorm: 0.3 },
  { position: [0.63, 0.59], hoverRadius: 0.052, size: 0.015, nodeType: 2, frequencyNorm: 0.9 },
  { position: [0.79, 0.66], hoverRadius: 0.055, size: 0.016, nodeType: 0, frequencyNorm: 0.7 },
  { position: [0.21, 0.38], hoverRadius: 0.045, size: 0.011, nodeType: 3, frequencyNorm: 0.2 },
  { position: [0.35, 0.42], hoverRadius: 0.045, size: 0.011, nodeType: 3, frequencyNorm: 0.3 },
  { position: [0.53, 0.44], hoverRadius: 0.052, size: 0.015, nodeType: 1, frequencyNorm: 0.6 },
  { position: [0.67, 0.4], hoverRadius: 0.045, size: 0.011, nodeType: 3, frequencyNorm: 0.4 },
  { position: [0.82, 0.32], hoverRadius: 0.055, size: 0.015, nodeType: 2, frequencyNorm: 0.8 },
  { position: [0.43, 0.25], hoverRadius: 0.044, size: 0.011, nodeType: 3, frequencyNorm: 0.3 },
  { position: [0.61, 0.21], hoverRadius: 0.055, size: 0.016, nodeType: 0, frequencyNorm: 0.9 },
  { position: [0.77, 0.18], hoverRadius: 0.044, size: 0.011, nodeType: 3, frequencyNorm: 0.2 },
];

export const airwayNetworkEdges: NetworkEdge[] = [
  { from: 0, to: 1, routeClass: 1.0 },
  { from: 1, to: 2, routeClass: 0.86 },
  { from: 2, to: 3, routeClass: 0.92 },
  { from: 3, to: 4, routeClass: 0.92 },
  { from: 4, to: 5, routeClass: 1.0 },
  { from: 1, to: 6, routeClass: 0.76 },
  { from: 6, to: 7, routeClass: 0.74 },
  { from: 7, to: 8, routeClass: 0.82 },
  { from: 8, to: 9, routeClass: 0.84 },
  { from: 9, to: 10, routeClass: 0.98 },
  { from: 7, to: 11, routeClass: 0.68 },
  { from: 11, to: 12, routeClass: 0.88 },
  { from: 12, to: 13, routeClass: 0.72 },
  { from: 3, to: 8, routeClass: 0.78 },
  { from: 4, to: 9, routeClass: 0.78 },
  { from: 8, to: 12, routeClass: 0.82 },
  { from: 2, to: 7, routeClass: 0.74 },
  { from: 9, to: 13, routeClass: 0.72 },
];

// Downsampled geometry resembling complex TMA/FIR polygons for testing.
// Instead of 10,000 points, we use simplified representations that will prove
// the ShaderLab concept without crashing the editor.
const polygon1 = [
  [0.1, 0.8],
  [0.3, 0.85],
  [0.4, 0.75],
  [0.35, 0.6],
  [0.15, 0.65],
  [0.1, 0.8],
];
const polygon2 = [
  [0.5, 0.85],
  [0.7, 0.9],
  [0.9, 0.7],
  [0.8, 0.5],
  [0.6, 0.55],
  [0.5, 0.85],
];
const polygon3 = [
  [0.15, 0.3],
  [0.25, 0.45],
  [0.45, 0.4],
  [0.35, 0.2],
  [0.2, 0.15],
  [0.15, 0.3],
];
const polygon4 = [
  [0.65, 0.35],
  [0.85, 0.4],
  [0.95, 0.25],
  [0.8, 0.1],
  [0.6, 0.15],
  [0.65, 0.35],
];

// Helper to convert arrays of points into segments
function pointsToSegments(points: number[][]): AirspaceOutline[] {
  const segments: AirspaceOutline[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    segments.push({
      start: points[i] as [number, number],
      end: points[i + 1] as [number, number],
    });
  }
  return segments;
}

export const airspaceOutlines: AirspaceOutline[] = [
  ...pointsToSegments(polygon1),
  ...pointsToSegments(polygon2),
  ...pointsToSegments(polygon3),
  ...pointsToSegments(polygon4),
];
