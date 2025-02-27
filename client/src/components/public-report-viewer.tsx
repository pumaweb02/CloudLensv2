import React, { useState, useEffect, useRef } from 'react';
import { APIProvider, Map as GoogleMap, Marker } from '@vis.gl/react-google-maps';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Map as MapIcon, Image as ImageIcon, Download, Phone } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface PublicReportProps {
  reportHash: string;
  initialLat?: number;
  initialLng?: number;
  initialZoom?: number;
  enableAnimation?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PublicReportViewer({
  reportHash,
  initialLat,
  initialLng,
  initialZoom = 19,
  enableAnimation = true,
  open,
  onOpenChange
}: PublicReportProps) {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'map' | 'photos'>('map');
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [mapZoom, setMapZoom] = useState(enableAnimation ? 0 : initialZoom);
  const [isAnimating, setIsAnimating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const animationFrameRef = useRef<number>();
  const { toast } = useToast();

  const animation = {
    startZoom: 0,
    endZoom: initialZoom,
    duration: 8000,
    stages: [
      { zoom: 3, duration: 1500, tilt: 0 },
      { zoom: 6, duration: 1500, tilt: 0 },
      { zoom: 10, duration: 1500, tilt: 30 },
      { zoom: 14, duration: 1500, tilt: 45 },
      { zoom: initialZoom, duration: 2000, tilt: 60 }
    ],
    easing: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const response = await fetch(`/api/reports/share/${reportHash}/download`, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }

      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error('Received empty PDF data');
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Property-Inspection-Report-${reportData.property.address}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      toast({
        title: "Error",
        description: "Failed to download the PDF report. Please try again.",
        variant: "destructive"
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await fetch(`/api/reports/share/${reportHash}`);
        if (!response.ok) throw new Error('Report not found');
        const data = await response.json();

        // Transform the photos data
        if (data.photos) {
          data.photos = await Promise.all(data.photos.map(async (photo: any) => {
            if (!photo.id) return photo;
            try {
              // Fetch the actual photo data
              const photoResponse = await fetch(`/api/photos/${photo.id}/view`);
              if (!photoResponse.ok) throw new Error('Photo not found');
              const photoData = await photoResponse.json();
              return {
                ...photo,
                url: photoData.url
              };
            } catch (err) {
              console.error('Error loading photo:', err);
              return photo;
            }
          }));
        }

        console.log('Loaded report data:', data);
        setReportData(data);
        if (enableAnimation) {
          setIsAnimating(true);
        }
      } catch (err: any) {
        console.error('Error loading report:', err);
        setError(err.message || 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [reportHash]);

  useEffect(() => {
    if (!isAnimating || !mapRef.current) return;

    let startTime: number | null = null;
    let currentStageIndex = 0;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;

      const stage = animation.stages[currentStageIndex];
      const stageProgress = Math.min((elapsed % stage.duration) / stage.duration, 1);
      const easedProgress = animation.easing(stageProgress);

      const prevStage = currentStageIndex > 0 ? animation.stages[currentStageIndex - 1] : { zoom: animation.startZoom, tilt: 0 };
      const zoomDelta = stage.zoom - prevStage.zoom;
      const tiltDelta = stage.tilt - (prevStage.tilt || 0);

      const currentZoom = prevStage.zoom + (zoomDelta * easedProgress);
      const currentTilt = (prevStage.tilt || 0) + (tiltDelta * easedProgress);

      setMapZoom(currentZoom);
      if (mapRef.current) {
        mapRef.current.setTilt(currentTilt);
      }

      if (stageProgress === 1) {
        currentStageIndex++;
        if (currentStageIndex < animation.stages.length) {
          startTime = currentTime;
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
          setTimeout(() => setCurrentView('photos'), 1000);
        }
      } else {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isAnimating, initialZoom]);

  useEffect(() => {
    if (currentView !== 'photos' || !reportData?.photos?.length) return;

    const interval = setInterval(() => {
      setCurrentPhotoIndex(current =>
        current === reportData.photos.length - 1 ? 0 : current + 1
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [currentView, reportData?.photos]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

  if (error || !reportData) {
    return <div className="flex items-center justify-center min-h-screen">
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive">Error loading report: {error}</p>
        </CardContent>
      </Card>
    </div>;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-6 overflow-y-auto">
        <DialogTitle className="sr-only">Property Inspection Report</DialogTitle>
        <Card>
          <CardHeader>
            <CardTitle>Property Inspection Report</CardTitle>
            <p className="text-muted-foreground">
              {reportData.property.address}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <Button
                variant={currentView === 'map' ? 'default' : 'outline'}
                onClick={() => setCurrentView('map')}
                disabled={isAnimating}
              >
                <MapIcon className="w-4 h-4 mr-2" />
                Aerial View
              </Button>
              <Button
                variant={currentView === 'photos' ? 'default' : 'outline'}
                onClick={() => setCurrentView('photos')}
                disabled={isAnimating}
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                Inspection Photos
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
              >
                <Download className="w-4 h-4 mr-2" />
                {downloadingPdf ? 'Downloading...' : 'Download Report'}
              </Button>
            </div>

            {currentView === 'map' && (
              <div className={cn(
                "h-[600px] rounded-lg overflow-hidden transition-opacity duration-500",
                isAnimating ? "opacity-90" : "opacity-100"
              )}>
                <APIProvider apiKey='AIzaSyAq_TvETnjsrA18ZfiUIgL1wfOOszSz51M'>
                  <GoogleMap
                    zoom={mapZoom}
                    center={{ lat: initialLat || 0, lng: initialLng || 0 }}
                    mapTypeId="satellite"
                    gestureHandling={isAnimating ? "none" : "greedy"}
                    disableDefaultUI={true}
                    tilt={isAnimating ? 45 : 0}
                    mapTypeControl={false}
                    streetViewControl={false}
                    fullscreenControl={false}
                    zoomControl={!isAnimating}
                    onBoundsChanged={(event) => {
                      if (event.map) {
                        mapRef.current = event.map;
                      }
                    }}
                  >
                    <Marker position={{ lat: initialLat || 0, lng: initialLng || 0 }} />
                  </GoogleMap>
                </APIProvider>
              </div>
            )}

            {currentView === 'photos' && reportData.photos?.length > 0 && (
              <div className="space-y-4">
                <div className="relative aspect-video rounded-lg overflow-hidden bg-black/5">
                  {reportData.photos[currentPhotoIndex] && (
                    <img
                      src={reportData.photos[currentPhotoIndex].url}
                      alt={`Inspection photo ${currentPhotoIndex + 1}`}
                      className="absolute inset-0 w-full h-full object-contain transition-opacity duration-500"
                    />
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPhotoIndex(i => Math.max(0, i - 1))}
                    disabled={currentPhotoIndex === 0}
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Photo {currentPhotoIndex + 1} of {reportData.photos.length}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPhotoIndex(i =>
                      Math.min(reportData.photos.length - 1, i + 1)
                    )}
                    disabled={currentPhotoIndex === reportData.photos.length - 1}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
                <ScrollArea className="h-[200px] rounded-md border p-4">
                  <div>
                    <h3 className="font-semibold mb-2">Inspection Notes</h3>
                    <p className="text-sm text-muted-foreground">
                      {reportData.photos[currentPhotoIndex]?.metadata?.notes || 'No notes available'}
                    </p>
                  </div>
                </ScrollArea>

                <div className="mt-8 p-6 bg-primary/5 rounded-lg">
                  <h3 className="text-xl font-semibold mb-2">Schedule Property Inspection</h3>
                  <p className="text-muted-foreground mb-4">
                    Our experts can help assess the damage and work with your insurance provider.
                  </p>
                  <div className="flex gap-4">
                    <Button size="lg" className="w-full sm:w-auto">
                      <Phone className="w-4 h-4 mr-2" />
                      Contact Us Now
                    </Button>
                    <Button size="lg" variant="outline" onClick={handleDownloadPdf} disabled={downloadingPdf}>
                      <Download className="w-4 h-4 mr-2" />
                      {downloadingPdf ? 'Downloading...' : 'Download Report'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}