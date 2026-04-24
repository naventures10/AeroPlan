import { useEffect } from 'react';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { useControl } from 'react-map-gl/maplibre';
import type { ControlPosition } from 'react-map-gl/maplibre';

interface InterleavedDeckGLProps {
  layers: any[];
  position?: ControlPosition;
  onOverlayCreated?: (overlay: MapboxOverlay) => void;
}

/**
 * A custom component to inject DeckGL layers into the MapLibre engine.
 *
 * By setting interleaved: true, these layers are rendered as part of the
 * MapLibre render cycle, allowing for correct 3D occlusion with terrain
 * and extrusion layers.
 */
export function InterleavedDeckGL(props: InterleavedDeckGLProps) {
  const overlay = useControl(() => new MapboxOverlay({ ...props, interleaved: true }));
  overlay.setProps(props);

  useEffect(() => {
    if (props.onOverlayCreated) {
      props.onOverlayCreated(overlay);
    }
  }, [overlay, props.onOverlayCreated]);

  return null;
}
