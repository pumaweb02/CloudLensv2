import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Camera, Clock, MapPin, Image, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format, parseISO, zonedTimeToUtc } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";

interface FileCardProps {
  file: File;
  metadata: {
    gpsData?: {
      latitude: number;
      longitude: number;
      altitude?: string;
    };
    timestamp?: string;
    cameraInfo?: {
      make?: string;
      model?: string;
      iso?: number;
      exposureTime?: number;
    };
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatExposureTime(time?: number): string {
  if (!time) return "N/A";
  if (time >= 1) return `${time}s`;
  return `1/${Math.round(1 / time)}s`;
}

function formatTimestamp(isoString?: string): string {
  if (!isoString) return "N/A";
  try {
    // Convert UTC ISO string to EST
    const estTime = utcToZonedTime(parseISO(isoString), 'America/New_York');
    return format(estTime, 'PPpp zzz');
  } catch (error) {
    console.error("Error formatting timestamp:", error);
    return "Invalid date";
  }
}

export function FileCard({ file, metadata }: FileCardProps) {
  const hasGps = metadata.gpsData?.latitude != null && metadata.gpsData?.longitude != null;
  const hasCamera = metadata.cameraInfo?.make || metadata.cameraInfo?.model;

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Image className="w-4 h-4" />
              {file.name}
            </CardTitle>
            <CardDescription>{formatBytes(file.size)}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!hasGps && !hasCamera && !metadata.timestamp && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No EXIF metadata found in this image
            </AlertDescription>
          </Alert>
        )}

        {hasGps && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-1 text-muted-foreground" />
            <div>
              <p className="font-medium">Location</p>
              <p className="text-sm text-muted-foreground">
                Latitude: {metadata.gpsData!.latitude.toFixed(6)}
              </p>
              <p className="text-sm text-muted-foreground">
                Longitude: {metadata.gpsData!.longitude.toFixed(6)}
              </p>
              {metadata.gpsData?.altitude && (
                <p className="text-sm text-muted-foreground">
                  Altitude: {metadata.gpsData.altitude}
                </p>
              )}
            </div>
          </div>
        )}

        {metadata.timestamp && (
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 mt-1 text-muted-foreground" />
            <div>
              <p className="font-medium">Captured</p>
              <p className="text-sm text-muted-foreground">
                {formatTimestamp(metadata.timestamp)}
              </p>
            </div>
          </div>
        )}

        {hasCamera && (
          <div className="flex items-start gap-2">
            <Camera className="w-4 h-4 mt-1 text-muted-foreground" />
            <div>
              <p className="font-medium">Camera Details</p>
              <div className="text-sm text-muted-foreground space-y-1">
                {metadata.cameraInfo?.make && (
                  <p>Make: {metadata.cameraInfo.make}</p>
                )}
                {metadata.cameraInfo?.model && (
                  <p>Model: {metadata.cameraInfo.model}</p>
                )}
                {metadata.cameraInfo?.iso && (
                  <p>ISO: {metadata.cameraInfo.iso}</p>
                )}
                {metadata.cameraInfo?.exposureTime !== undefined && (
                  <p>Exposure: {formatExposureTime(metadata.cameraInfo.exposureTime)}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}