import { useCallback, useRef, useEffect } from "react";
import { APIProvider, Map, MapCameraChangedEvent } from "@vis.gl/react-google-maps";
import { PropertyMapOverlay } from "./property-map-overlay";

interface PropertyMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  propertyId?: number;
  showPropertyBoundary?: boolean;
  showPhotoMarkers?: boolean;
}

export function PropertyMap({ 
  center = { lat: 33.7488, lng: -84.3877 }, // Default to Atlanta
  zoom = 12,
  className,
  propertyId,
  showPropertyBoundary = true,
  showPhotoMarkers = true
}: PropertyMapProps) {
  const mapRef = useRef<google.maps.Map>();

  const onCameraChanged = useCallback((ev: MapCameraChangedEvent) => {
    if (mapRef.current) {
      mapRef.current.setCenter(ev.detail.center);
      mapRef.current.setZoom(ev.detail.zoom);
    }
  }, []);

  return (
    <APIProvider apiKey='AIzaSyAq_TvETnjsrA18ZfiUIgL1wfOOszSz51M'>
      <div className={className}>
        <Map
          zoom={zoom}
          center={center}
          gestureHandling={"greedy"}
          disableDefaultUI={false}
          onCameraChanged={onCameraChanged}
          mapId={import.meta.env.VITE_GOOGLE_MAPS_ID}
        >
          <PropertyMapOverlay 
            propertyId={propertyId}
            showBoundary={showPropertyBoundary}
            showPhotoMarkers={showPhotoMarkers}
          />
        </Map>
      </div>
    </APIProvider>
  );
}