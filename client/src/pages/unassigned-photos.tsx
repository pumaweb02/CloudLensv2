import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, MapPin } from "lucide-react";
import { useLocation } from "wouter";
import { PhotoViewer } from "@/components/photo-viewer";
import { useState } from "react";

interface UnassignedPhoto {
  id: number;
  filename: string;
  originalName: string;
  uploadedAt: string;
  url?: string;
  thumbnailUrl?: string;
  metadata: {
    gps?: {
      altitude?: string | number;
      latitude?: number;
      longitude?: number;
    };
  };
}

export default function UnassignedPhotosPage() {
  const [, setLocation] = useLocation();
  const [selectedPhoto, setSelectedPhoto] = useState<UnassignedPhoto | null>(null);

  const { data: photos, isLoading, error } = useQuery<UnassignedPhoto[]>({
    queryKey: ["/api/photos/unassigned"],
    queryFn: async () => {
      const response = await fetch("/api/photos/unassigned");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch unassigned photos");
      }
      return response.json();
    },
    retry: 1
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 mb-2">{error instanceof Error ? error.message : "Error loading unassigned photos"}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setLocation("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Unassigned Photos</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {photos?.map((photo) => (
          <Card key={photo.id} className="overflow-hidden">
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-medium truncate">
                {photo.originalName}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div 
                className="relative aspect-video cursor-pointer"
                onClick={() => setSelectedPhoto(photo)}
              >
                <img
                  src={photo.thumbnailUrl || photo.url}
                  alt={photo.originalName}
                  className="w-full h-full object-cover"
                />
                {photo.metadata?.gps?.latitude && (
                  <div className="absolute bottom-2 right-2 bg-black/50 text-white px-2 py-1 rounded-full text-xs flex items-center">
                    <MapPin className="w-3 h-3 mr-1" />
                    {photo.metadata.gps.latitude.toFixed(6)}, {photo.metadata.gps.longitude?.toFixed(6)}
                  </div>
                )}
              </div>
              <div className="p-4">
                <p className="text-sm text-muted-foreground">
                  Uploaded: {new Date(photo.uploadedAt).toLocaleDateString()}
                </p>
                <Button 
                  variant="outline" 
                  className="w-full mt-2"
                  onClick={() => setLocation(`/property/${photo.id}/edit`)}
                >
                  Review & Assign
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedPhoto && (
        <PhotoViewer
          open={!!selectedPhoto}
          onOpenChange={() => setSelectedPhoto(null)}
          imageUrl={selectedPhoto.url || ""}
          annotations={[]}
          onSaveInspection={() => {}}
        />
      )}

      {photos?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No unassigned photos found</p>
        </div>
      )}
    </div>
  );
}