import React from 'react';
import { useParams } from 'wouter';
import { APIProvider, Map as GoogleMap } from '@vis.gl/react-google-maps';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Phone, Calendar, Satellite, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { cn } from '@/lib/utils';

interface ShareReportParams {
  shareToken?: string;
}

interface Photo {
  id: number;
  url: string;
  metadata: {
    notes?: string;
    severity?: string;
    damageType?: string;
  };
}

interface ShareData {
  property: {
    address: string;
    latitude: string;
    longitude: string;
  };
  inspection: {
    photos: Photo[];
  };
  shareExpires: string;
}

export function SharedReportPage() {
  const params = useParams<ShareReportParams>();
  const [currentView, setCurrentView] = React.useState<'map' | 'photos'>('map');
  const [currentPhotoIndex, setCurrentPhotoIndex] = React.useState(0);
  const [mapZoom, setMapZoom] = React.useState(20);
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [showIntro, setShowIntro] = React.useState(true);
  const [fadeIntro, setFadeIntro] = React.useState(false);
  const [fadeOutMap, setFadeOutMap] = React.useState(false);
  const [showPhotos, setShowPhotos] = React.useState(false);
  const mapRef = React.useRef<google.maps.Map | null>(null);
  const animationFrameRef = React.useRef<number>();
  const animationStartTimeRef = React.useRef<number | null>(null);

  const { data: shareData, isLoading, error } = useQuery<ShareData>({
    queryKey: ['sharedReport', params.shareToken],
    queryFn: async () => {
      const { data } = await axios.get(`/api/reports/share/${params.shareToken}`);
      return data;
    },
  });

  React.useEffect(() => {
    if (shareData) {
      setTimeout(() => {
        setFadeIntro(true);
        setTimeout(() => {
          setShowIntro(false);
          setIsAnimating(true);
        }, 500);
      }, 2000);
    }
  }, [shareData]);

  React.useEffect(() => {
    if (shareData && currentView === 'map' && isAnimating) {
      const animation = {
        duration: 8000,
        stages: [
          { zoom: 3, duration: 1000, tilt: 0 },
          { zoom: 8, duration: 1500, tilt: 0 },
          { zoom: 12, duration: 1500, tilt: 45 },
          { zoom: 16, duration: 1500, tilt: 45 },
          { zoom: 20, duration: 2500, tilt: 45 },
        ],
      };

      let currentStageIndex = 0;

      const animate = (timestamp: number) => {
        if (!animationStartTimeRef.current) {
          animationStartTimeRef.current = timestamp;
        }

        const elapsed = timestamp - animationStartTimeRef.current;
        let currentTime = 0;

        for (let i = 0; i < animation.stages.length; i++) {
          if (elapsed >= currentTime && elapsed < currentTime + animation.stages[i].duration) {
            currentStageIndex = i;
            break;
          }
          currentTime += animation.stages[i].duration;
        }

        const stage = animation.stages[currentStageIndex];
        const stageStartTime = animation.stages
          .slice(0, currentStageIndex)
          .reduce((sum, s) => sum + s.duration, 0);

        const stageProgress = Math.min(
          (elapsed - stageStartTime) / stage.duration,
          1
        );

        const easeProgress = stageProgress < 0.5
          ? 2 * stageProgress * stageProgress
          : -1 + (4 - 2 * stageProgress) * stageProgress;

        const prevZoom = currentStageIndex > 0
          ? animation.stages[currentStageIndex - 1].zoom
          : animation.stages[0].zoom;

        const zoomDelta = stage.zoom - prevZoom;
        const currentZoom = prevZoom + (zoomDelta * easeProgress);

        setMapZoom(currentZoom);

        if (mapRef.current) {
          mapRef.current.setTilt(stage.tilt);
        }

        if (elapsed < animation.duration) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          setFadeOutMap(true);
          setShowPhotos(true);
          setTimeout(() => {
            setCurrentView('photos');
          }, 1000);
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [shareData, currentView, isAnimating]);

  const handleNext = () => {
    if (shareData) {
      setCurrentPhotoIndex(i => Math.min(shareData.inspection.photos.length - 1, i + 1));
    }
  };

  const handlePrevious = () => {
    setCurrentPhotoIndex(i => Math.max(0, i - 1));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !shareData || !shareData.inspection.photos.length) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">Error loading report. Please check the URL and try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPhoto = shareData.inspection.photos[currentPhotoIndex];

  return (
    <div className="w-full min-h-screen bg-background">
      {showIntro && (
        <div className={cn(
          "fixed inset-0 z-50 bg-black/90 flex items-center justify-center text-white transition-opacity duration-500",
          fadeIntro && "opacity-0"
        )}>
          <div className="text-center space-y-4 px-4">
            <Satellite className="w-20 h-20 mx-auto mb-6 animate-pulse text-primary" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              CloudLens™ Advanced Analysis
            </h1>
            <p className="text-xl text-primary/80">Initializing satellite imagery analysis...</p>
          </div>
        </div>
      )}

      {currentView === 'map' && (
        <div className={cn(
          "w-full h-screen transition-opacity duration-1000",
          fadeOutMap && "opacity-0"
        )}>
          <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyAq_TvETnjsrA18ZfiUIgL1wfOOszSz51M'}>
            <GoogleMap
              zoom={mapZoom}
              center={{
                lat: parseFloat(shareData.property.latitude),
                lng: parseFloat(shareData.property.longitude)
              }}
              mapId={import.meta.env.VITE_GOOGLE_MAPS_ID}
              gestureHandling="none"
              disableDefaultUI
              mapTypeId="satellite"
              tilt={45}
              styles={[
                {
                  featureType: "all",
                  elementType: "labels",
                  stylers: [{ visibility: "off" }]
                },
                {
                  featureType: "poi",
                  stylers: [{ visibility: "off" }]
                }
              ]}
              onMount={(map) => {
                mapRef.current = map;
              }}
            />
          </APIProvider>
          <div className="absolute top-4 left-4 right-4 bg-background/80 backdrop-blur-sm p-4 rounded-lg">
            <div className="max-w-3xl mx-auto">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                CloudLens™ Advanced Analysis
              </h1>
              <p className="text-muted-foreground">{shareData.property.address}</p>
            </div>
          </div>
        </div>
      )}

      <div className={cn(
        "fixed inset-0 bg-background transition-all duration-1000 ease-in-out",
        currentView === 'photos' ? "opacity-100 z-10 translate-y-0" : "opacity-0 -z-10 translate-y-4",
        showPhotos && "pointer-events-auto"
      )}>
        <div className="min-h-screen flex flex-col">
          <header className="bg-background/95 backdrop-blur-sm border-b p-4 md:p-6 sticky top-0 z-10">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    Urgent Damage Assessment
                  </h1>
                  <p className="text-lg md:text-xl text-muted-foreground mt-2">
                    {shareData.property.address}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-destructive animate-pulse" />
                  <span className="text-destructive font-semibold">Immediate Action Required</span>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 py-8 overflow-auto px-4">
            <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
              <Card className="overflow-hidden shadow-lg">
                <div className="relative">
                  {currentPhoto && (
                    <>
                      <img
                        src={`/api/photos/${currentPhoto.id}/view`}
                        alt={`Property damage ${currentPhotoIndex + 1}`}
                        className="w-full h-auto object-cover max-h-[600px] transition-transform duration-300 ease-in-out"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-background/90 backdrop-blur-md p-4 md:p-6">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-lg">
                              Damage Type: {currentPhoto.metadata?.damageType || 'Not specified'}
                            </p>
                            <span className={cn(
                              "px-3 py-1 rounded-full font-semibold",
                              currentPhoto.metadata?.severity === 'high' ? 'bg-red-100 text-red-700 animate-pulse' :
                                currentPhoto.metadata?.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-green-100 text-green-700'
                            )}>
                              {(currentPhoto.metadata?.severity || 'Unknown').toUpperCase()} Severity
                            </span>
                          </div>
                          <p className="text-muted-foreground">{currentPhoto.metadata?.notes || 'No additional notes'}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </Card>

              <div className="flex justify-between items-center gap-4">
                <Button
                  onClick={handlePrevious}
                  disabled={currentPhotoIndex === 0}
                  variant="outline"
                  size="lg"
                  className="w-[100px]"
                >
                  <ChevronLeft className="mr-2" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Photo {currentPhotoIndex + 1} of {shareData.inspection.photos.length}
                </span>
                <Button
                  onClick={handleNext}
                  disabled={currentPhotoIndex === shareData.inspection.photos.length - 1}
                  variant="outline"
                  size="lg"
                  className="w-[100px]"
                >
                  Next
                  <ChevronRight className="ml-2" />
                </Button>
              </div>
            </div>
          </main>

          <footer className="bg-background/95 backdrop-blur-sm border-t mt-auto">
            <div className="max-w-4xl mx-auto p-4 md:p-6">
              <Card className="p-6 md:p-8 bg-destructive/5 border-destructive/20">
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-1 bg-destructive rounded-full animate-pulse" />
                    <div>
                      <h2 className="text-2xl md:text-3xl font-bold text-destructive">
                        Immediate Action Required
                      </h2>
                      <p className="text-destructive/80">Insurance-covered repairs available</p>
                    </div>
                  </div>
                  <p className="text-lg text-muted-foreground">
                    Our advanced satellite and drone analysis has identified critical damage requiring
                    immediate professional evaluation. Our certified inspectors are ready to provide
                    a detailed on-site assessment and begin the repair process.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button className="flex-1 flex items-center justify-center gap-2 h-16 bg-destructive hover:bg-destructive/90" size="lg">
                      <Phone className="w-5 h-5" />
                      <div>
                        <div className="font-semibold">24/7 Emergency Response</div>
                        <div className="text-sm">(888) 555-0123</div>
                      </div>
                    </Button>
                    <Button variant="outline" className="flex-1 flex items-center justify-center gap-2 h-16 border-destructive/20 hover:bg-destructive/5" size="lg">
                      <Calendar className="w-5 h-5 text-destructive" />
                      <div>
                        <div className="font-semibold">Priority Assessment</div>
                        <div className="text-sm">Schedule Now</div>
                      </div>
                    </Button>
                  </div>
                </div>
              </Card>

              <div className="text-center mt-6 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Analysis powered by CloudLens™ Advanced Satellite Technology
                </p>
                <p className="text-xs text-muted-foreground">
                  Report valid until {new Date(shareData.shareExpires).toLocaleDateString()}
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

export default SharedReportPage;