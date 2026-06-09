import { useEffect, useRef } from 'react';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { useControl } from 'react-map-gl/maplibre';
import type { ControlPosition } from 'react-map-gl/maplibre';

interface InterleavedDeckGLProps {
  layers: any[];
  position?: ControlPosition;
  onOverlayCreated?: (overlay: MapboxOverlay | null) => void;
}

/**
 * A custom component to inject DeckGL layers into the MapLibre engine.
 *
 * By setting interleaved: true, these layers are rendered as part of the
 * MapLibre render cycle, allowing for correct 3D occlusion with terrain
 * and extrusion layers.
 */
export function InterleavedDeckGL(props: InterleavedDeckGLProps) {
  const { onOverlayCreated, ...overlayProps } = props;
  const onOverlayCreatedRef = useRef(onOverlayCreated);
  const overlayRef = useRef<MapboxOverlay | null>(null);

  useEffect(() => {
    onOverlayCreatedRef.current = onOverlayCreated;
  }, [onOverlayCreated]);

  const overlay = useControl(
    () => {
      const instance = new MapboxOverlay({ ...overlayProps, interleaved: true });
      overlayRef.current = instance;
      return instance;
    },
    () => {
      if (overlayRef.current) {
        overlayRef.current.finalize();
        overlayRef.current = null;
      }
    },
  );
  overlay.setProps(overlayProps);

  useEffect(() => {
    if (onOverlayCreatedRef.current) {
      onOverlayCreatedRef.current(overlay);
    }

    return () => {
      onOverlayCreatedRef.current?.(null);
    };
  }, [overlay]);

  return null;
}
