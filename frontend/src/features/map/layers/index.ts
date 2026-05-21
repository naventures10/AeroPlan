/**
 * Barrel export for the layers module.
 *
 * Consumers import from `./layers` and get the same public API.
 */
export { useDeckLayers } from './useDeckLayers';
export { getPolygonPaint, getPointPaint } from '../../terminal/layers/terminalMapStyles';
