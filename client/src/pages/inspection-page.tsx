import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  FileText,
  Camera,
  CloudOff,
  Star,
  StarOff
} from "lucide-react";
import { KonvaPhotoEditor } from "@/components/konva-photo-editor";
import { useState, useEffect, Suspense, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast, toast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { generateInspectionReport } from "@/lib/pdf-generation";
import { format } from 'date-fns';

type DamageType = "wind" | "hail" | "other" | "none";
type SeverityLevel = "low" | "medium" | "high";

interface PropertyPhoto {
  id: number;
  filename: string;
  originalName: string;
  uploadedAt: string;
  url?: string;
  thumbnailUrl?: string;
  isDefault?: boolean;
  metadata: {
    gps?: {
      altitude?: string | number;
      latitude?: number;
      longitude?: number;
    };
  };
}

interface PropertyData {
  id: number;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  parcelNumber?: string;
  yearBuilt?: number;
  propertyValue?: number;
  owner1FirstName?: string;
  owner1LastName?: string;
  owner1Company?: string;
  owner1Phone?: string;
  owner1Email?: string;
  photos: PropertyPhoto[];
  latitude?: string;
  longitude?: string;
}

interface Annotation {
  id: string;
  type: "circle" | "text" | "rectangle" | "sketch";
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  text?: string;
  stroke: string;
  fill: string;
  damageType?: DamageType;
  severity?: SeverityLevel;
}

interface PhotoMarkings {
  annotations: Annotation[];
  lines: any[];
}

const DAMAGE_TYPES = [
  { id: 'wind' as const, label: 'Wind Damage' },
  { id: 'hail' as const, label: 'Hail Damage' },
  { id: 'other' as const, label: 'Other Damage' },
] as const;

const SEVERITY_LEVELS = [
  { value: 'low' as const, label: 'Low', color: 'bg-yellow-500' },
  { value: 'medium' as const, label: 'Medium', color: 'bg-orange-500' },
  { value: 'high' as const, label: 'High', color: 'bg-red-500' },
] as const;

interface PropertyReport {
  property: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    parcelNumber?: string;
    yearBuilt?: string;
    propertyValue?: number;
    coordinates: {
      latitude: number;
      longitude: number;
    }
  };
  owners: {
    primary?: {
      name?: string;
      company?: string;
      phone?: string;
      email?: string;
    };
  };
  inspectionData: {
    propertyId: number;
    photos: Array<{
      photoId: number;
      editedImage: string;
      damageType: string;
      severity: string;
      notes: string;
    }>;
  };
}

export default function InspectionPage() {
  const [, params] = useRoute<{ id: string }>("/property/:id/inspection/new");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [editedImages, setEditedImages] = useState<Record<number, string>>({});
  const [photoMarkings, setPhotoMarkings] = useState<Record<number, PhotoMarkings>>({});
  const [selectedDamageTypes, setSelectedDamageTypes] = useState<Record<number, DamageType>>({});
  const [selectedSeverities, setSelectedSeverities] = useState<Record<number, SeverityLevel>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [defaultPhotoId, setDefaultPhotoId] = useState<number | null>(null);

  // Move photo IDs parsing to useMemo
  const photoIds = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const photoIdsStr = searchParams.get("photos");
    let ids: number[] = [];

    try {
      if (photoIdsStr) {
        // Handle both array format and comma-separated format
        const parsed = photoIdsStr.includes('[')
          ? JSON.parse(photoIdsStr)
          : photoIdsStr.split(',');

        ids = Array.isArray(parsed) ? parsed : [parsed];
        ids = ids.map(id => Number(id)).filter(id => !isNaN(id));
      }
    } catch (error) {
      console.error('Error parsing photo IDs:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load photo selection. Please try again.",
      });
    }
    return ids;
  }, [toast]);

  const { data: property, isLoading: propertyLoading, error: propertyError } = useQuery<PropertyData>({
    queryKey: [`/api/properties/${params?.id}`],
    enabled: !!params?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (photoId: number) => {
      setIsLoading(true);
      try {
        console.log('Starting save mutation for photo:', photoId);
        if (!params?.id) {
          throw new Error('Property ID is missing');
        }

        // Ensure we have the edited image
        const editedImage = editedImages[photoId];
        if (!editedImage) {
          console.warn('No edited image found for photo:', photoId);
        }

        const currentAnnotations = photoMarkings[photoId]?.annotations || [];
        const currentLines = photoMarkings[photoId]?.lines || [];
        const currentDamageType = selectedDamageTypes[photoId] || 'other';
        const currentSeverity = selectedSeverities[photoId] || 'low';
        const currentNotes = notes[photoId] || '';

        console.log('Preparing request data:', {
          photoId,
          hasAnnotations: currentAnnotations.length > 0,
          hasLines: currentLines.length > 0,
          damageType: currentDamageType,
          severity: currentSeverity,
          hasNotes: Boolean(currentNotes)
        });

        const requestBody = {
          propertyId: parseInt(params.id),
          photoIds: [photoId],
          inspectionData: {
            editedImage,
            annotations: currentAnnotations,
            lines: currentLines,
            damageType: currentDamageType,
            severity: currentSeverity,
            notes: currentNotes,
            metadata: {}
          }
        };

        const response = await fetch(`/api/properties/${params.id}/inspection/photo`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            'Accept': 'application/json'
          },
          body: JSON.stringify(requestBody),
          credentials: "include",
        });

        console.log('Server response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Server error response:', errorText);
          throw new Error(errorText || 'Failed to save inspection data');
        }

        const data = await response.json();
        console.log('Save mutation successful:', data);
        return data;

      } catch (error) {
        console.error('Save mutation error:', error);
        throw error instanceof Error ? error : new Error('Failed to save inspection data');
      } finally {
        setIsLoading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/properties/${params?.id}`],
      });
      toast({
        title: "Success",
        description: "Photo inspection saved successfully",
      });
    },
    onError: (error) => {
      console.error('Mutation error:', error);
      toast({
        variant: "destructive",
        title: "Error saving inspection",
        description: error instanceof Error ? error.message : "Failed to save inspection data",
        duration: 5000,
      });
    }
  });

  const setDefaultPhotoMutation = useMutation({
    mutationFn: async (photoId: number) => {
      const response = await fetch(`/api/properties/${params?.id}/default-photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/properties/${params?.id}`],
      });
      toast({
        title: "Success",
        description: "Default photo updated successfully",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error updating default photo",
        description: error instanceof Error ? error.message : "Failed to update default photo",
      });
    }
  });

  const handleSaveImage = async (imageData: string, annotations: Annotation[], lines: any[]): Promise<boolean> => {
    if (!property || !currentPhoto) return false;

    try {
      console.log('Starting save for photo:', currentPhoto.id);
      setIsLoading(true);

      // Ensure image data is in the correct format
      const formattedImageData = imageData.startsWith('data:image') ?
        imageData :
        `data:image/jpeg;base64,${imageData}`;


      setEditedImages(prev => ({
        ...prev,
        [currentPhoto.id]: formattedImageData
      }));

      // Update annotations with current damage type and severity
      const updatedAnnotations = annotations.map(a => ({
        ...a,
        damageType: selectedDamageTypes[currentPhoto.id] || 'wind',
        severity: selectedSeverities[currentPhoto.id] || 'high'
      }));

      setPhotoMarkings(prev => ({
        ...prev,
        [currentPhoto.id]: {
          annotations: updatedAnnotations,
          lines
        }
      }));

      // Save to server
      console.log('Calling save mutation');
      const saveResult = await saveMutation.mutateAsync(currentPhoto.id);

      if (!saveResult) {
        throw new Error('Failed to save image data');
      }

      console.log('Save successful, checking for next photo');

      if (currentPhotoIndex < selectedPhotos.length - 1) {
        setIsEditorReady(false);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Update photo index
        setCurrentPhotoIndex(prevIndex => {
          console.log('Moving from photo index', prevIndex, 'to', prevIndex + 1);
          return prevIndex + 1;
        });
      }

      return true;

    } catch (error) {
      console.error('Save error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save changes",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleDefault = async () => {
    if (!currentPhoto) return;

    try {
      await setDefaultPhotoMutation.mutateAsync(currentPhoto.id);
      setDefaultPhotoId(currentPhoto.id);
    } catch (error) {
      console.error('Error setting default photo:', error);
    }
  };

  const selectedPhotos = property?.photos
    ?.filter(p => photoIds.includes(p.id))
    .map(photo => ({
      ...photo,
      url: photo.filename.startsWith('http') ?
        photo.filename :
        `/uploads/${encodeURIComponent(photo.filename)}`
    })) || [];

  const currentPhoto = useMemo(() => {
    console.log('Selecting current photo:', {
      index: currentPhotoIndex,
      available: selectedPhotos.length
    });
    return selectedPhotos[currentPhotoIndex];
  }, [selectedPhotos, currentPhotoIndex]);

  useEffect(() => {
    if (!currentPhoto ||
      selectedDamageTypes[currentPhoto.id] ||
      selectedSeverities[currentPhoto.id] ||
      notes[currentPhoto.id]) {
      return;
    }

    // Initialize state only if it doesn't exist for current photo
    setSelectedDamageTypes(prev => ({
      ...prev,
      [currentPhoto.id]: 'wind'
    }));

    setSelectedSeverities(prev => ({
      ...prev,
      [currentPhoto.id]: 'high'
    }));

    setNotes(prev => ({
      ...prev,
      [currentPhoto.id]: ''
    }));
  }, [currentPhoto?.id, selectedDamageTypes, selectedSeverities, notes]);

  const validatePhotos = () => {
    const invalidPhotos = photoIds.filter(photoId => {
      const hasType = selectedDamageTypes[photoId];
      const hasSeverity = selectedSeverities[photoId];
      const hasAnnotations = photoMarkings[photoId]?.annotations?.length > 0 ||
        photoMarkings[photoId]?.lines?.length > 0;
      const hasNotes = notes[photoId]?.trim().length > 0;

      console.log('Validating photo', photoId, {
        hasType,
        hasSeverity,
        hasAnnotations,
        hasNotes,
        markings: photoMarkings[photoId]
      });

      return !hasType || !hasSeverity || !hasNotes;
    });

    if (invalidPhotos.length > 0) {
      const missingFields = invalidPhotos.map(photoId => {
        const fields = [];
        if (!selectedDamageTypes[photoId]) fields.push('damage type');
        if (!selectedSeverities[photoId]) fields.push('severity');
        if (!notes[photoId]?.trim()) fields.push('inspection notes');

        const photoNumber = selectedPhotos.findIndex(p => p.id === photoId) + 1;
        return `Photo ${photoNumber}: missing ${fields.join(', ')}`;
      });

      toast({
        variant: "destructive",
        title: "Missing Required Fields",
        description: (
          <div className="space-y-2">
            <p>Please complete all required fields for each photo:</p>
            <ul className="list-disc pl-4">
              {missingFields.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        ),
        duration: 5000,
      });
      return false;
    }

    return true;
  };

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!validatePhotos()) {
        throw new Error("Please complete all required fields for each photo");
      }

      setIsLoading(true);
      try {
        if (!property) throw new Error("Property data not available");

        const photoData = photoIds.map(photoId => ({
          photoId,
          editedImage: editedImages[photoId],
          damageType: selectedDamageTypes[photoId],
          severity: selectedSeverities[photoId],
          notes: notes[photoId] || ''
        }));

        // Create inspection first
        const response = await fetch(`/api/properties/${params?.id}/inspections/complete`, {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          credentials: "include",
          body: JSON.stringify({
            inspectionData: {
              propertyId: property.id,
              photos: photoData,
              damageType: photoData[0].damageType,
              severity: photoData[0].severity,
              notes: photoData.map(d => d.notes).filter(Boolean).join('\n\n')
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Complete inspection error:', errorText);
          throw new Error(errorText || 'Failed to complete inspection');
        }

        const responseData = await response.json();
        console.log('Inspection completion response:', responseData);

        // Return success
        return responseData;
      } catch (error) {
        console.error('Complete inspection error:', error);
        throw error instanceof Error ? error : new Error('Failed to complete inspection');
      } finally {
        setIsLoading(false);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Inspection completed successfully",
      });

      queryClient.invalidateQueries({
        queryKey: [`/api/properties/${params?.id}`],
        refetchType: 'all'
      });

      setTimeout(() => {
        setLocation(`/property/${params?.id}`);
      }, 2000);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error completing inspection",
        description: error instanceof Error ? error.message : "Failed to complete inspection",
        duration: 5000,
      });
    }
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsEditorReady(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [currentPhotoIndex]);

  // Add this useEffect to debug photo changes
  useEffect(() => {
    console.log('Current photo changed:', {
      index: currentPhotoIndex,
      photoId: currentPhoto?.id,
      totalPhotos: selectedPhotos.length
    });
  }, [currentPhotoIndex, currentPhoto?.id, selectedPhotos.length]);

  if (!params?.id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Invalid property ID</p>
          <Button onClick={() => setLocation("/")} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (propertyLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (propertyError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500">Error loading property data: {propertyError?.message}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Property not found</p>
          <Button onClick={() => setLocation("/")} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (selectedPhotos.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <CloudOff className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No photos selected for inspection</p>
          <Button onClick={() => setLocation(`/property/${params.id}`)} className="mt-4">
            <Camera className="w-4 h-4 mr-2" />
            Select Photos
          </Button>
        </div>
      </div>
    );
  }

  if (!currentPhoto?.url) {
    console.error("Invalid photo data:", { currentPhoto, photoIds, selectedPhotos });
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500">Error: Photo data is invalid or missing</p>
          <pre className="mt-2 text-xs text-left bg-gray-100 p-2 rounded overflow-auto max-w-lg">
            {JSON.stringify(
              {
                currentPhoto,
                photoIndex: currentPhotoIndex,
                selectedPhotos: selectedPhotos.length,
                photoIds
              },
              null,
              2
            )}
          </pre>
          <Button onClick={() => setLocation(`/property/${params.id}`)} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return to Property
          </Button>
        </div>
      </div>
    );
  }

  const progress = Math.round((Object.keys(editedImages).length / photoIds.length) * 100);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50 border-b">
          <div className="container mx-auto py-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setLocation(`/property/${params.id}`)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Property
              </Button>
              <div className="flex flex-col items-center">
                <h1 className="text-2xl font-bold mb-2">
                  Photo Inspection ({currentPhotoIndex + 1} of {selectedPhotos.length})
                </h1>
                <Tooltip>
                  <TooltipTrigger>
                    <Progress value={progress} className="w-[200px]" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{progress}% Complete</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleToggleDefault}
                  disabled={setDefaultPhotoMutation.isPending}
                  className="mr-2"
                >
                  {currentPhoto?.isDefault ? (
                    <>
                      <Star className="w-4 h-4 mr-2 fill-yellow-400" />
                      Default Photo
                    </>
                  ) : (
                    <>
                      <StarOff className="w-4 h-4 mr-2" />
                      Set as Default
                    </>
                  )}
                </Button>
                <Button
                  variant="default"
                  onClick={() => completeMutation.mutate()}
                  disabled={completeMutation.isPending || progress < 100}
                >
                  {completeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 mr-2" />
                  )}
                  Complete & Generate Report
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto py-6">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-3">
              <Card>
                <CardHeader>
                  <CardTitle>Damage Classification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <Label>Damage Type</Label>
                    <RadioGroup
                      value={selectedDamageTypes[currentPhoto.id]}
                      onValueChange={(value: DamageType) => {
                        setSelectedDamageTypes(prev => ({
                          ...prev,
                          [currentPhoto.id]: value
                        }));
                      }}
                      className="space-y-2"
                    >
                      {DAMAGE_TYPES.map(({ id, label }) => (
                        <div key={id} className="flex items-center space-x-2">
                          <RadioGroupItem value={id} id={id} />
                          <Label htmlFor={id}>{label}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="space-y-4">
                    <Label>Severity Level</Label>
                    <RadioGroup
                      value={selectedSeverities[currentPhoto.id]}
                      onValueChange={(value: SeverityLevel) => {
                        setSelectedSeverities(prev => ({
                          ...prev,
                          [currentPhoto.id]: value
                        }));
                      }}
                      className="space-y-2"
                    >
                      {SEVERITY_LEVELS.map(({ value, label, color }) => (
                        <div key={value} className="flex items-center space-x-2">
                          <RadioGroupItem value={value} id={value} />
                          <Label htmlFor={value} className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${color}`} />
                            {label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="space-y-4">
                    <Label>
                      Inspection Notes
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <Textarea
                      value={notes[currentPhoto.id] || ''}
                      onChange={(e) => {
                        setNotes(prev => ({
                          ...prev,
                          [currentPhoto.id]: e.target.value
                        }));
                      }}
                      placeholder="Add detailed notes about the damage (required)..."
                      className="min-h-[200px]"
                    />
                    {!notes[currentPhoto.id]?.trim() && (
                      <p className="text-sm text-muted-foreground">
                        Please provide inspection notes for this photo
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="col-span-9">
              <Card>
                <CardContent className="p-6">
                  <Suspense fallback={
                    <div className="flex items-center justify-center h-[600px]">
                      <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                  }>
                    {isEditorReady ? (
                      <KonvaPhotoEditor
                        key={`${currentPhoto.id}-${currentPhotoIndex}`}
                        imageUrl={currentPhoto.url}
                        onSave={handleSaveImage}
                        damageType={selectedDamageTypes[currentPhoto.id]}
                        severity={selectedSeverities[currentPhoto.id]}
                        initialAnnotations={photoMarkings[currentPhoto.id]?.annotations || []}
                        initialLines={photoMarkings[currentPhoto.id]?.lines || []}
                        onPrev={currentPhotoIndex > 0 ? () => {
                          setIsEditorReady(false);
                          setCurrentPhotoIndex(currentPhotoIndex - 1);
                        } : undefined}
                        canGoPrev={currentPhotoIndex > 0}
                        currentPhotoIndex={currentPhotoIndex}
                        totalPhotos={selectedPhotos.length}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-[600px]">
                        <Loader2 className="w-8 h-8 animate-spin" />
                      </div>
                    )}
                  </Suspense>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}