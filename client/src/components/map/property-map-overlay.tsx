import { useMemo } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useQuery } from "@tanstack/react-query";
import { Marker } from "@vis.gl/react-google-maps";
import { Card } from "@/components/ui/card";
import { Loader2, Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PropertyWithPhotos {
  id: number;
  address: string;
  latitude: number;
  longitude: number;
  photos: Array<{
    id: number;
    thumbnailUrl: string;
    latitude: number;
    longitude: number;
    takenAt: string;
  }>;
}

interface PropertyMapOverlayProps {
  propertyId?: number;
  showBoundary?: boolean;
  showPhotoMarkers?: boolean;
}

export function PropertyMapOverlay({
  propertyId,
  showBoundary = true,
  showPhotoMarkers = true
}: PropertyMapOverlayProps) {
  const { data: properties, isLoading } = useQuery<PropertyWithPhotos[]>({
    queryKey: propertyId 
      ? ["/api/properties", propertyId, "with-photos"]
      : ["/api/properties/with-photos"],
  });

  const markers = useMemo(() => {
    if (!properties) return [];
    return properties.map((property) => ({
      id: property.id,
      position: { lat: Number(property.latitude), lng: Number(property.longitude) },
      property,
    }));
  }, [properties]);

  const photoMarkers = useMemo(() => {
    if (!properties) return [];
    return properties.flatMap((property) =>
      property.photos.map((photo) => ({
        id: photo.id,
        position: { lat: Number(photo.latitude), lng: Number(photo.longitude) },
        photo,
        property,
      }))
    );
  }, [properties]);

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background/80">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {markers.map(({ id, position, property }) => (
        <HoverCard key={id} openDelay={200} closeDelay={0}>
          <HoverCardTrigger asChild>
            <div>
              <Marker 
                position={position} 
                title={property.address}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 10,
                  fillColor: "#ef4444",
                  fillOpacity: 1,
                  strokeWeight: 2,
                  strokeColor: "#ffffff",
                }}
              />
            </div>
          </HoverCardTrigger>
          <HoverCardContent className="w-80 p-0" align="start" side="right">
            <Card className="p-3">
              <h4 className="text-sm font-medium mb-2">{property.address}</h4>
              <div className="grid grid-cols-3 gap-2">
                {property.photos.slice(0, 6).map((photo) => (
                  <img
                    key={photo.id}
                    src={photo.thumbnailUrl}
                    alt={`Property at ${property.address}`}
                    className="w-full h-20 object-cover rounded-sm"
                  />
                ))}
              </div>
              {property.photos.length > 6 && (
                <p className="text-xs text-muted-foreground mt-2">
                  +{property.photos.length - 6} more photos
                </p>
              )}
            </Card>
          </HoverCardContent>
        </HoverCard>
      ))}

      {showPhotoMarkers && photoMarkers.map(({ id, position, photo, property }) => (
        <HoverCard key={id} openDelay={200} closeDelay={0}>
          <HoverCardTrigger asChild>
            <div>
              <Marker 
                position={position}
                title={`Photo at ${property.address}`}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 6,
                  fillColor: "#3b82f6",
                  fillOpacity: 0.8,
                  strokeWeight: 1,
                  strokeColor: "#ffffff",
                }}
              />
            </div>
          </HoverCardTrigger>
          <HoverCardContent className="w-80 p-0" align="start" side="right">
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Camera className="h-4 w-4" />
                <h4 className="text-sm font-medium">Photo Location</h4>
              </div>
              <img
                src={photo.thumbnailUrl}
                alt={`Photo at ${property.address}`}
                className="w-full h-40 object-cover rounded-sm mb-2"
              />
              <div className="space-y-1">
                <Badge variant="outline" className="mb-1">
                  {new Date(photo.takenAt).toLocaleString()}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  Coordinates: {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
                </p>
              </div>
            </Card>
          </HoverCardContent>
        </HoverCard>
      ))}
    </>
  );
}