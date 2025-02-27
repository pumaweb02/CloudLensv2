import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ImageIcon,
  ZoomIn,
  Calendar,
  User,
  Upload,
  Filter,
  SortAsc,
  FileEdit,
  Star,
  Camera,
  Link,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Photo {
  id: number;
  filename: string;
  originalName: string;
  uploadedAt: string;
  url: string;
  thumbnailUrl: string;
  isDefault?: boolean;
  metadata: {
    gps?: {
      altitude?: number;
      latitude?: number;
      longitude?: number;
    };
  };
  user: {
    id: number;
    username: string;
    role: string;
  } | null;
  batch?: {
    id: number;
    name: string;
    description?: string;
    flightDate: string;
  };
}

interface ImageGalleryProps {
  photos: Photo[];
  onPhotoSelect?: (selectedIds: number[]) => void;
  selectedIds?: number[];
  propertyId?: number;
  onSetDefaultPhoto?: (photoId: number) => void;
  onSelectionChange?: (selectedIds: number[]) => void;
  onPhotoDelete?: (photoId: number) => Promise<void>;
  onSave?: (photoId: number, data: any) => Promise<void>;
  onAnalyze?: (photoId: number) => Promise<void>;
}

export function ImageGallery({
  photos,
  selectedIds = [],
  onSelectionChange,
  onPhotoDelete,
  onSave,
  onAnalyze,
  onSetDefaultPhoto,
  propertyId
}: ImageGalleryProps) {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name" | "batch">("batch");
  const [groupByBatch, setGroupByBatch] = useState(true);
  const { toast } = useToast();

  const handlePhotoToggle = (photoId: number) => {
    if (!onSelectionChange) return;
    const newSelected = selectedIds.includes(photoId)
      ? selectedIds.filter((id) => id !== photoId)
      : [...selectedIds, photoId];
    onSelectionChange(newSelected);
  };

  const handleStartInspection = () => {
    if (!propertyId) {
      toast({
        title: "Error",
        description: "Property ID is required to start an inspection",
        variant: "destructive"
      });
      return;
    }

    if (selectedIds.length === 0) {
      toast({
        title: "No Photos Selected",
        description: "Please select at least one photo to create an inspection report",
        variant: "destructive"
      });
      return;
    }

    const photoIdsParam = selectedIds.join(',');
    setLocation(`/property/${propertyId}/inspection/new?photos=${photoIdsParam}`);
  };

  const formatAltitude = (altitude: number | undefined | null): string => {
    if (altitude == null) return "N/A";
    return `${Math.round(altitude)} meters`;
  };

  const filteredPhotos = photos.filter(
    (photo) =>
      photo.originalName.toLowerCase().includes(search.toLowerCase()) ||
      (photo.batch?.name.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const sortedPhotos = [...filteredPhotos].sort((a, b) => {
    if (a.isDefault) return -1;
    if (b.isDefault) return 1;

    switch (sortBy) {
      case "date":
        return (
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );
      case "name":
        return a.originalName.localeCompare(b.originalName);
      case "batch":
        if (!a.batch || !b.batch) return 0;
        const batchCompare = a.batch.name.localeCompare(b.batch.name);
        if (batchCompare !== 0) return batchCompare;
        return (
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );
      default:
        return 0;
    }
  });

  const groupedPhotos = groupByBatch
    ? sortedPhotos.reduce<Record<string, Photo[]>>((acc, photo) => {
        const batchKey = photo.batch?.name || "Unassigned";
        if (!acc[batchKey]) {
          acc[batchKey] = [];
        }
        acc[batchKey].push(photo);
        return acc;
      }, {})
    : { "All Photos": sortedPhotos };

  const PhotoCard = ({ photo }: { photo: Photo }) => (
    <Card
      key={photo.id}
      className={`relative group cursor-pointer transition-all duration-200 hover:shadow-lg ${
        selectedIds.includes(photo.id)
          ? "ring-2 ring-primary"
          : "hover:ring-1 hover:ring-primary/20"
      }`}
    >
      <CardContent className="p-2">
        <HoverCard>
          <HoverCardTrigger asChild>
            <div className="relative aspect-square">
              <img
                src={photo?.thumbnailPath?.includes("https") ? photo?.thumbnailPath : `/uploads/${photo?.thumbnailPath}`}
                alt={photo.originalName}
                className="absolute inset-0 w-full h-full object-cover rounded-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`/uploads/${photo.filename}`, "_blank");
                }}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSave) onSave(photo.id, {});
                  }}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                {onSetDefaultPhoto && (
                  <Button
                    variant={photo.isDefault ? "default" : "secondary"}
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetDefaultPhoto(photo.id);
                    }}
                    className={photo.isDefault ? "bg-yellow-500" : ""}
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="absolute top-2 left-2">
                <Checkbox
                  checked={selectedIds.includes(photo.id)}
                  onCheckedChange={() => handlePhotoToggle(photo.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              {photo.isDefault && (
                <div className="absolute top-2 right-2">
                  <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                    Default
                  </span>
                </div>
              )}
            </div>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">{photo.originalName}</h4>
              <div className="text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  <span>Taken: {format(new Date(photo.uploadedAt), "PPp")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Upload className="h-3 w-3" />
                  <span>
                    Uploaded: {format(new Date(photo.uploadedAt), "PPp")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3" />
                  <span>By: {photo.user?.username || "Unknown"}</span>
                </div>
                {photo.batch && (
                  <div className="pt-1">
                    <div className="font-semibold">Batch: {photo.batch.name}</div>
                    {photo.batch.description && (
                      <div className="text-muted-foreground">
                        {photo.batch.description}
                      </div>
                    )}
                    <div>
                      Flight Date:{" "}
                      {format(new Date(photo.batch.flightDate), "PP")}
                    </div>
                  </div>
                )}
                {photo.metadata?.gps && (
                  <div className="pt-1">
                    {photo.metadata.gps.altitude !== undefined && (
                      <div>
                        Altitude: {Math.round(photo.metadata.gps.altitude)}m
                      </div>
                    )}
                    {photo.metadata.gps.latitude !== undefined && photo.metadata.gps.longitude !== undefined && (
                      <div className="flex items-center gap-2">
                        <Link className="h-3 w-3" />
                        <a
                          href={`https://www.google.com/maps?q=${photo.metadata.gps.latitude},${photo.metadata.gps.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {photo.metadata.gps.latitude.toFixed(6)},{" "}
                          {photo.metadata.gps.longitude.toFixed(6)}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center sticky top-0 bg-background z-10 py-4 border-b">
        <div className="flex-1">
          <Input
            placeholder="Search photos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={sortBy}
            onValueChange={(value: "date" | "name" | "batch") => setSortBy(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SortAsc className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="batch">Batch</SelectItem>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setGroupByBatch(!groupByBatch)}
            className={groupByBatch ? "bg-secondary" : ""}
          >
            <Filter className="w-4 h-4 mr-2" />
            Group by Batch
          </Button>
          <Button
            variant="default"
            onClick={handleStartInspection}
            disabled={selectedIds.length === 0}
          >
            <Camera className="w-4 h-4 mr-2" />
            Start Inspection ({selectedIds.length})
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-12rem)] rounded-md border">
        <div className="space-y-8 p-4">
          {Object.entries(groupedPhotos).map(([batchName, batchPhotos]) => (
            <div key={batchName} className="space-y-4">
              <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-2 rounded-lg shadow-sm">
                <h3 className="font-semibold flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  {batchName}
                  <span className="text-muted-foreground text-sm font-normal">
                    ({batchPhotos.length} photos)
                  </span>
                </h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {batchPhotos.map((photo) => (
                  <PhotoCard key={photo.id} photo={photo} />
                ))}
              </div>
              <Separator className="my-8" />
            </div>
          ))}
          {Object.keys(groupedPhotos).length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mb-4" />
              <p>No photos found</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}