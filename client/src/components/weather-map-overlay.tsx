import { useMemo, useEffect } from 'react';
import { useMap } from '@vis.gl/react-google-maps';

interface WeatherMapOverlayProps {
  layer: 'precipitation' | 'temperature' | 'wind' | 'pressure';
  opacity?: number;
  visible: boolean;
}

export function WeatherMapOverlay({ layer, opacity = 0.8, visible }: WeatherMapOverlayProps) {
  const map = useMap();

  const overlay = useMemo(() => {
    if (!visible || !map) return null;

    const tileUrl = `/api/weather/map-tiles/${layer}/{z}/{x}/{y}`;

    return new google.maps.ImageMapType({
      getTileUrl: (coord, zoom) => {
        return tileUrl
          .replace('{z}', zoom.toString())
          .replace('{x}', coord.x.toString())
          .replace('{y}', coord.y.toString());
      },
      tileSize: new google.maps.Size(256, 256),
      maxZoom: 20,
      minZoom: 0,
      opacity: opacity,
      name: layer
    });
  }, [layer, visible, opacity, map]);

  useEffect(() => {
    if (!map || !overlay) return;

    if (visible) {
      map.overlayMapTypes.push(overlay);
    } else {
      // Remove the overlay if it exists
      const overlays = map.overlayMapTypes.getArray();
      const index = overlays.findIndex(o => o && o.name === layer);
      if (index !== -1) {
        map.overlayMapTypes.removeAt(index);
      }
    }

    return () => {
      if (map) {
        const overlays = map.overlayMapTypes.getArray();
        const index = overlays.findIndex(o => o && o.name === layer);
        if (index !== -1) {
          map.overlayMapTypes.removeAt(index);
        }
      }
    };
  }, [map, overlay, visible, layer]);

  return null;
}