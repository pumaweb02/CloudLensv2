import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GoogleMap, MarkerF, useLoadScript } from '@react-google-maps/js-api-loader';
import { useParams, Link } from 'wouter';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Phone, Calendar, ChevronLeft, ChevronRight, Satellite } from 'lucide-react';

interface InspectionViewerProps {
  shareToken: string;
}

interface ShareData {
  property: {
    address: string;
    latitude: number;
    longitude: number;
  };
  inspection: {
    id: number;
    date: string;
    summary: string;
    overallSeverity: string;
    photos: Array<{
      id: number;
      url: string;
      metadata: {
        damageType: string;
        severity: string;
        notes: string;
      };
    }>;
  };
  shareExpires: string;
}

const InspectionViewer: React.FC<InspectionViewerProps> = ({ shareToken }) => {
  const [currentZoom, setCurrentZoom] = useState(20);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [showIntro, setShowIntro] = useState(true);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyAq_TvETnjsrA18ZfiUIgL1wfOOszSz51M' ||'',
  });

  const { data: shareData } = useQuery<ShareData>({
    queryKey: ['share', shareToken],
    queryFn: async () => {
      const response = await fetch(`/api/reports/share/${shareToken}`);
      if (!response.ok) throw new Error('Failed to load shared report');
      return response.json();
    },
  });

  useEffect(() => {
    if (shareData && showMap) {
      // Intro sequence
      setTimeout(() => setShowIntro(false), 2000);

      // Advanced zoom sequence with more steps for smoother transition
      const zoomSequence = [
        { zoom: 18, delay: 1000 },
        { zoom: 16, delay: 1000 },
        { zoom: 14, delay: 1000 },
        { zoom: 12, delay: 1000 },
        { zoom: 16, delay: 1000 },
        { zoom: 18, delay: 1000 }
      ];

      let timeoutId: NodeJS.Timeout;

      zoomSequence.forEach((step, index) => {
        timeoutId = setTimeout(() => {
          setCurrentZoom(step.zoom);
          if (index === zoomSequence.length - 1) {
            setTimeout(() => {
              setShowMap(false);
              setShowSlideshow(true);
            }, 1000);
          }
        }, step.delay * (index + 1));
      });

      return () => clearTimeout(timeoutId);
    }
  }, [shareData, showMap]);

  const handleNext = () => {
    if (shareData && currentPhotoIndex < shareData.inspection.photos.length - 1) {
      setCurrentPhotoIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentPhotoIndex > 0) {
      setCurrentPhotoIndex(prev => prev - 1);
    }
  };

  if (!shareData) return <div className="flex justify-center items-center h-screen">Loading...</div>;
  if (!isLoaded) return <div className="flex justify-center items-center h-screen">Loading maps...</div>;

  const currentPhoto = shareData.inspection.photos[currentPhotoIndex];

  return (
    <div className="w-full min-h-screen bg-background">
      {showIntro && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center text-white">
          <div className="text-center space-y-4">
            <Satellite className="w-16 h-16 mx-auto mb-4 animate-pulse" />
            <h1 className="text-3xl font-bold">CloudLens™ Satellite Analysis</h1>
            <p className="text-xl">Initializing property scan...</p>
          </div>
        </div>
      )}

      {showMap && (
        <div className="w-full h-[100vh] relative">
          <GoogleMap
            zoom={currentZoom}
            center={{
              lat: shareData.property.latitude,
              lng: shareData.property.longitude,
            }}
            mapId="cloudlens-map"
            options={{
              disableDefaultUI: true,
              scrollwheel: false,
              zoomControl: false,
              styles: [
                {
                  featureType: "all",
                  elementType: "labels",
                  stylers: [{ visibility: "off" }]
                },
                {
                  featureType: "water",
                  elementType: "geometry",
                  stylers: [{ color: "#193341" }]
                },
                {
                  featureType: "landscape",
                  elementType: "geometry",
                  stylers: [{ color: "#2c5a71" }]
                }
              ],
              mapTypeId: 'satellite'
            }}
          >
            <MarkerF
              position={{
                lat: shareData.property.latitude,
                lng: shareData.property.longitude,
              }}
            />
          </GoogleMap>
          <div className="absolute top-4 left-4 right-4 bg-background/80 backdrop-blur-sm p-4 rounded-lg">
            <div className="max-w-3xl mx-auto">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                CloudLens™ Property Analysis
              </h1>
              <p className="text-muted-foreground">{shareData.property.address}</p>
            </div>
          </div>
        </div>
      )}

      {showSlideshow && (
        <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 md:space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-2xl md:text-3xl font-bold">
              Detailed Damage Assessment
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              {shareData.property.address}
            </p>
          </div>

          <Card className="overflow-hidden shadow-lg">
            <div className="relative">
              <img
                src={currentPhoto.url}
                alt={`Property damage ${currentPhotoIndex + 1}`}
                className="w-full h-auto object-cover max-h-[600px]"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-background/90 backdrop-blur-md p-4 md:p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-lg">
                      Damage Type: {currentPhoto.metadata.damageType}
                    </p>
                    <span className={`px-3 py-1 rounded-full ${
                      currentPhoto.metadata.severity === 'high' ? 'bg-red-100 text-red-700' :
                      currentPhoto.metadata.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {currentPhoto.metadata.severity.toUpperCase()} Severity
                    </span>
                  </div>
                  <p className="text-muted-foreground">{currentPhoto.metadata.notes}</p>
                </div>
              </div>
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

          <Card className="p-6 md:p-8 bg-primary/5 border-primary/20">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-1 bg-primary rounded-full" />
                <h2 className="text-2xl md:text-3xl font-bold text-primary">
                  Professional Assessment Required
                </h2>
              </div>
              <p className="text-lg text-muted-foreground">
                Our satellite and AI-powered analysis has identified potential structural damage 
                that requires immediate professional attention. Our certified inspectors are 
                ready to provide a comprehensive on-site evaluation.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button className="flex-1 flex items-center justify-center gap-2 h-14" size="lg">
                  <Phone className="w-5 h-5" />
                  <div>
                    <div className="font-semibold">Call Now</div>
                    <div className="text-sm">(888) 555-0123</div>
                  </div>
                </Button>
                <Button variant="secondary" className="flex-1 flex items-center justify-center gap-2 h-14" size="lg">
                  <Calendar className="w-5 h-5" />
                  <div>
                    <div className="font-semibold">Schedule Inspection</div>
                    <div className="text-sm">Book Online</div>
                  </div>
                </Button>
              </div>
            </div>
          </Card>

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Report generated by CloudLens™ Advanced Satellite Analysis
            </p>
            <p className="text-xs text-muted-foreground">
              Valid until {new Date(shareData.shareExpires).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default InspectionViewer;