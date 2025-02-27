import { useEffect, useCallback, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';

interface LatLng {
  lat: number;
  lng: number;
}

interface PolylineOptions {
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  visible?: boolean;
  zIndex?: number;
  icons?: Array<{
    icon: {
      path: string | google.maps.SymbolPath;
      fillColor?: string;
      fillOpacity?: number;
      scale?: number;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
    };
    offset?: string;
    repeat?: string;
  }>;
}

interface PolylineProps {
  path: LatLng[];
  options?: PolylineOptions;
  radius?: number; // Added radius for impact zone
  severity?: string;
}

export function Polyline({ path, options, radius = 5000, severity = 'moderate' }: PolylineProps) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);

  const createImpactZone = useCallback(() => {
    if (!map || !path.length) return;

    // Clear previous shapes
    if (polylineRef.current) polylineRef.current.setMap(null);
    if (polygonRef.current) polygonRef.current.setMap(null);

    // Create the main storm path
    polylineRef.current = new google.maps.Polyline({
      path,
      ...options,
      map,
      zIndex: 2
    });

    // Create impact zone polygon
    const impactCoords = path.reduce((coords: LatLng[], point: LatLng) => {
      // Create points around the path to form a buffer
      const numPoints = 8;
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 360 * (Math.PI / 180);
        coords.push({
          lat: point.lat + (radius / 111111) * Math.cos(angle),
          lng: point.lng + (radius / (111111 * Math.cos(point.lat * Math.PI / 180))) * Math.sin(angle)
        });
      }
      return coords;
    }, []);

    // Add animation effect for the impact zone
    const severityColors = {
      severe: '#FF000080',
      moderate: '#FFA50080',
      mild: '#FFFF0080'
    };

    polygonRef.current = new google.maps.Polygon({
      paths: impactCoords,
      strokeColor: options?.strokeColor || '#FF0000',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: severityColors[severity as keyof typeof severityColors] || severityColors.moderate,
      fillOpacity: 0.35,
      map,
      zIndex: 1
    });

    // Add animated dash effect for the storm path
    if (polylineRef.current) {
      polylineRef.current.set('icons', [{
        icon: {
          path: 'M 0,-1 0,1',
          strokeOpacity: 1,
          scale: 4
        },
        offset: '0',
        repeat: '20px'
      }, {
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 5,
          strokeWeight: 2,
        },
        offset: '50%',
      }]);
    }

  }, [map, path, options, radius, severity]);

  useEffect(() => {
    createImpactZone();
    return () => {
      if (polylineRef.current) polylineRef.current.setMap(null);
      if (polygonRef.current) polygonRef.current.setMap(null);
    };
  }, [createImpactZone]);

  return null;
}