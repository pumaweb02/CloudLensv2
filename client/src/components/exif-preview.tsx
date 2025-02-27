import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Calendar } from "lucide-react";

interface ExifPreviewProps {
  photos: Array<{
    file: File;
    metadata: any;
  }>;
}

function formatGpsCoordinates(metadata: any) {
  if (!metadata?.originalMetadata?.gps?.latitude || !metadata?.originalMetadata?.gps?.longitude) return "—";
  return `${metadata.originalMetadata.gps.latitude.toFixed(6)},${metadata.originalMetadata.gps.longitude.toFixed(6)}`;
}

function formatAltitude(metadata: any) {
  if (!metadata?.originalMetadata?.gps?.altitude) return "—";
  return metadata.originalMetadata.gps.altitude;
}

function formatTimestamp(timestamp: string | null) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString();
}

export function ExifPreview({ photos }: ExifPreviewProps) {
  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-4 p-4">
        {photos.map((photo, index) => (
          <Card key={index} className="relative">
            <CardContent className="pt-6">
              <div className="grid gap-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Timing Information
                  </h3>
                  <div className="grid gap-2">
                    <div className="grid grid-cols-2">
                      <span className="text-muted-foreground">Taken at</span>
                      <span>{photo.metadata.DateTimeOriginal || "—"}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Location Information
                  </h3>
                  <div className="grid gap-2">
                    <div className="grid grid-cols-2">
                      <span className="text-muted-foreground">GPS Location</span>
                      <span>{formatGpsCoordinates(photo.metadata)}</span>
                    </div>
                    <div className="grid grid-cols-2">
                      <span className="text-muted-foreground">GPS Altitude</span>
                      <span>{formatAltitude(photo.metadata)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}