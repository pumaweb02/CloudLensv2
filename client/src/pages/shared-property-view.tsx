import { useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Wrapper } from "@googlemaps/react-wrapper";

interface PropertyData {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: string;
  longitude: string;
  photos: Array<{
    id: number;
    filename: string;
  }>;
}

const ZOOM_DURATION = 2000; // 2 seconds for zoom animation
const INITIAL_ZOOM = 15;
const FINAL_ZOOM = 19;

export function SharedPropertyView() {
  const [, params] = useRoute<{ token: string }>("/share/:token");
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    const fetchProperty = async () => {
      if (!params?.token) return;

      try {
        const response = await fetch(`/api/share/${params.token}`);
        if (!response.ok) throw new Error('Failed to fetch property data');

        const data = await response.json();
        setProperty(data);
      } catch (error) {
        console.error('Error fetching property:', error);
        setMapError(error instanceof Error ? error.message : 'Failed to fetch property data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProperty();
  }, [params?.token]);

  useEffect(() => {
    if (!property || !mapRef.current || !import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
      return;
    }

    const initMap = async () => {
      try {
        const { Map } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;
        const { Marker } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;

        // Start from a higher altitude
        const startPosition = new google.maps.LatLng(
          parseFloat(property.latitude) - 0.05,
          parseFloat(property.longitude)
        );

        const finalPosition = new google.maps.LatLng(
          parseFloat(property.latitude),
          parseFloat(property.longitude)
        );

        const map = new Map(mapRef.current, {
          zoom: INITIAL_ZOOM,
          center: startPosition,
          mapTypeId: 'satellite',
          disableDefaultUI: true,
          gestureHandling: "greedy"
        });

        googleMapRef.current = map;

        const marker = new Marker({
          position: finalPosition,
          map,
          title: property.address,
          animation: google.maps.Animation.DROP
        });

        markerRef.current = marker;

        // Animate zoom and pan
        let start: number | null = null;
        const animate = (timestamp: number) => {
          if (!start) start = timestamp;
          const progress = (timestamp - start) / ZOOM_DURATION;

          if (progress < 1) {
            const currentZoom = INITIAL_ZOOM + (FINAL_ZOOM - INITIAL_ZOOM) * progress;
            const currentLat = startPosition.lat() + (finalPosition.lat() - startPosition.lat()) * progress;
            const currentLng = startPosition.lng() + (finalPosition.lng() - startPosition.lng()) * progress;

            map.setZoom(currentZoom);
            map.setCenter({ lat: currentLat, lng: currentLng });
            requestAnimationFrame(animate);
          }
        };

        requestAnimationFrame(animate);
      } catch (error) {
        console.error('Error initializing map:', error);
        setMapError('Failed to initialize map. Please try again later.');
      }
    };

    initMap();
  }, [property]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (mapError || !property) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-6">
          <h1 className="text-xl font-bold mb-2">Error</h1>
          <p className="text-muted-foreground">
            {mapError || 'This property link appears to be invalid or has expired.'}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div 
        ref={mapRef} 
        className="w-full h-[50vh] relative"
        style={{ minHeight: "400px" }}
      />

      <div className="container mx-auto p-6">
        <Card className="mb-6">
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-2">{property.address}</h1>
            <p className="text-muted-foreground">
              {property.city}, {property.state} {property.zipCode}
            </p>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {property.photos.map((photo) => (
            <img
              key={photo.id}
              src={`/uploads/${photo.filename}`}
              alt={`Property photo ${photo.id}`}
              className="w-full h-64 object-cover rounded-lg"
            />
          ))}
        </div>
      </div>
    </div>
  );
}