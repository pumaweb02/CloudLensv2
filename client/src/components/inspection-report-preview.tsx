import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, Download, Share2, CloudSun, Loader2 } from "lucide-react";
import type { DamageAnalysis } from "@/lib/ai-analysis";
import html2canvas from 'html2canvas';
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {format} from 'date-fns'

interface AnalyzedPhoto {
  id: number;
  filename: string;
  analysis: DamageAnalysis & {
    weather?: {
      temperature?: number;
      conditions?: string;
      windSpeed?: number;
      precipitation?: number;
    };
  };
  isDefault?: boolean;
}

interface InspectionReportPreviewProps {
  propertyAddress: string;
  city: string;
  state: string;
  zipCode: string;
  parcelNumber?: string;
  yearBuilt?: string;
  propertyUse?: string;
  propertyValue?: number;
  landValue?: number;
  improvementValue?: number;
  owner1FirstName?: string;
  owner1LastName?: string;
  owner1Company?: string;
  owner1Phone?: string;
  owner1Email?: string;
  owner2FirstName?: string;
  owner2LastName?: string;
  owner2Company?: string;
  owner2Phone?: string;
  owner2Email?: string;
  photos: AnalyzedPhoto[];
  onSave: (status: "draft" | "completed", data: {
    photos: Array<{
      photoId: number;
      capturedImage: string;
      analysis: DamageAnalysis;
      isDefault?: boolean;
    }>;
    overallNotes: string;
  }) => void;
  onClose: () => void;
  onExportPDF?: (propertyReport: {
    property: {
      address: string;
      city: string;
      state: string;
      zipCode: string;
      parcelNumber?: string;
      yearBuilt?: string;
      propertyUse?: string;
      propertyValue?: number;
      landValue?: number;
      improvementValue?: number;
    };
    owners: {
      primary?: {
        name?: string;
        company?: string;
        phone?: string;
        email?: string;
      };
      secondary?: {
        name?: string;
        company?: string;
        phone?: string;
        email?: string;
      };
    };
    inspectionData: Array<{
      photoId: number;
      editedImage: string;
      damageType: string;
      severity: string;
      notes: string;
      weather?: {
        temperature?: number;
        conditions?: string;
        windSpeed?: number;
        precipitation?: number;
      };
    }>;
  }) => void;
}

export function InspectionReportPreview({
  propertyAddress,
  city,
  state,
  zipCode,
  parcelNumber,
  yearBuilt,
  propertyUse,
  propertyValue,
  landValue,
  improvementValue,
  owner1FirstName,
  owner1LastName,
  owner1Company,
  owner1Phone,
  owner1Email,
  owner2FirstName,
  owner2LastName,
  owner2Company,
  owner2Phone,
  owner2Email,
  photos,
  onSave,
  onClose,
  onExportPDF,
}: InspectionReportPreviewProps) {
  const { toast } = useToast();
  const [editableNotes, setEditableNotes] = useState<Record<number, string>>(
    Object.fromEntries(photos.map(p => [p.id, p.analysis.description]))
  );
  const [overallNotes, setOverallNotes] = useState("");
  const [status, setStatus] = useState<"draft" | "completed">("draft");
  const [showWeather, setShowWeather] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const photoRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const sortedPhotos = [...photos].sort((a, b) => {
    if (a.isDefault) return -1;
    if (b.isDefault) return 1;
    return 0;
  });

  const defaultPhoto = sortedPhotos.find(p => p.isDefault);

  const captureAnnotatedPhotos = async () => {
    console.log('Starting photo capture process...');
    try {
      const capturedPhotos = await Promise.all(
        photos.map(async (photo) => {
          const photoElement = photoRefs.current[photo.id];
          if (!photoElement) {
            console.error(`No element found for photo ${photo.id}`);
            return null;
          }

          try {
            console.log(`Capturing photo ${photo.id}...`);

            // Wait for all images to load
            const images = photoElement.getElementsByTagName('img');
            await Promise.all(
              Array.from(images).map(
                img =>
                  new Promise((resolve) => {
                    if (img.complete) resolve(true);
                    else img.onload = () => resolve(true);
                  })
              )
            );

            // Set proper scale and size for high-quality capture
            const canvas = await html2canvas(photoElement, {
              useCORS: true,
              allowTaint: true,
              logging: false,
              imageTimeout: 30000,
              scale: 2,
              backgroundColor: null,
              windowWidth: photoElement.scrollWidth,
              windowHeight: photoElement.scrollHeight,
            });

            const capturedImage = canvas.toDataURL('image/jpeg', 0.85);
            console.log(`Successfully captured photo ${photo.id}`);

            return {
              photoId: photo.id,
              capturedImage,
              analysis: {
                ...photo.analysis,
                description: editableNotes[photo.id]
              },
              isDefault: photo.isDefault
            };
          } catch (error) {
            console.error(`Failed to capture photo ${photo.id}:`, error);
            toast({
              title: "Error",
              description: `Failed to capture photo ${photo.id}. Please try again.`,
              variant: "destructive",
            });
            return null;
          }
        })
      );

      const filteredPhotos = capturedPhotos.filter((photo): photo is NonNullable<typeof photo> => photo !== null);

      if (filteredPhotos.length === 0) {
        throw new Error('No photos were captured successfully');
      }

      return filteredPhotos;
    } catch (error) {
      console.error('Error in captureAnnotatedPhotos:', error);
      throw error;
    }
  };

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      const capturedPhotos = await captureAnnotatedPhotos();
      await onSave(status, {
        photos: capturedPhotos,
        overallNotes
      });

      toast({
        title: "Success",
        description: `Inspection ${status === 'completed' ? 'completed' : 'saved as draft'} successfully`,
      });

      onClose();
    } catch (error) {
      console.error('Error saving report:', error);
      toast({
        title: "Error",
        description: "Failed to save the report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPDF = async () => {
    if (!onExportPDF) return;

    try {
      setIsExporting(true);
      console.log('Starting photo capture process...');

      const capturedPhotos = await captureAnnotatedPhotos();
      console.log(`Successfully captured ${capturedPhotos.length} photos`);

      const propertyReport = {
        property: {
          address: propertyAddress,
          city,
          state,
          zipCode,
          parcelNumber,
          yearBuilt,
          propertyUse,
          propertyValue,
          landValue,
          improvementValue,
        },
        owners: {
          primary: owner1FirstName || owner1LastName ? {
            name: `${owner1FirstName || ''} ${owner1LastName || ''}`.trim(),
            company: owner1Company,
            phone: owner1Phone,
            email: owner1Email,
          } : undefined,
          secondary: owner2FirstName || owner2LastName ? {
            name: `${owner2FirstName || ''} ${owner2LastName || ''}`.trim(),
            company: owner2Company,
            phone: owner2Phone,
            email: owner2Email,
          } : undefined,
        },
        inspectionData: capturedPhotos.map(photo => ({
          photoId: photo.photoId,
          editedImage: photo.capturedImage,
          damageType: photo.analysis.damageType || 'unknown',
          severity: photo.analysis.severity || 'unknown',
          notes: photo.analysis.description || '',
          weather: photo.analysis.weather,
        })),
      };

      console.log('Calling API to generate PDF...');
      try {
        // Make the API call to generate PDF
        const response = await fetch(`/api/properties/${propertyReport.property.address}/inspections/report`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/pdf'
          },
          body: JSON.stringify(propertyReport),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Get the blob from the response
        const blob = await response.blob();

        // Create a URL for the blob
        const url = window.URL.createObjectURL(blob);

        // Sanitize address for filename
        const sanitizedAddress = propertyReport.property.address
          .replace(/[^a-z0-9]/gi, '-')
          .replace(/-+/g, '-')
          .toLowerCase();

        // Create a temporary link element with standardized filename
        const link = document.createElement('a');
        link.href = url;
        link.download = `CloudLens-Property-Inspection-${sanitizedAddress}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

        // Append to body, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the URL
        window.URL.revokeObjectURL(url);

        console.log('PDF export completed');
        toast({
          title: "Success",
          description: "PDF report generated successfully",
        });
      } catch (exportError) {
        console.error('Error during PDF export:', exportError);
        toast({
          title: "Error",
          description: "Failed to generate PDF report. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error during PDF generation:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="container flex h-[100vh] max-w-7xl items-center justify-center">
        <div className="relative h-[90vh] w-full rounded-lg border bg-background shadow-lg">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-2xl font-bold">Inspection Report Preview</h2>
                <p className="text-muted-foreground">{propertyAddress}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWeather(!showWeather)}
                >
                  <CloudSun className="h-4 w-4 mr-2" />
                  {showWeather ? 'Hide Weather' : 'Show Weather'}
                </Button>
                <Select value={status} onValueChange={(value: "draft" | "completed") => setStatus(value)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Save as Draft</SelectItem>
                    <SelectItem value="completed">Mark Complete</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {isSaving ? 'Saving...' : 'Save Report'}
                </Button>
                {onExportPDF && (
                  <Button
                    variant="outline"
                    onClick={handleExportPDF}
                    disabled={isExporting || isSaving}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {isExporting ? 'Generating...' : 'Export PDF'}
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={onClose}
                  disabled={isSaving}
                >
                  Close
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 p-6">
              <div className="space-y-6">
                {/* Default Photo Section */}
                {defaultPhoto && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">Summary of Findings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div
                          className="relative aspect-video"
                          ref={el => photoRefs.current[defaultPhoto.id] = el}
                        >
                          <img
                            src={`/uploads/${defaultPhoto.filename}`}
                            alt="Primary Damage View"
                            className="absolute inset-0 w-full h-full object-cover rounded"
                          />
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium">Primary Damage Assessment</label>
                            <p className="text-muted-foreground capitalize">
                              {defaultPhoto.analysis.damageType} - {defaultPhoto.analysis.severity} Severity
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Key Findings</label>
                            <Textarea
                              value={editableNotes[defaultPhoto.id]}
                              onChange={(e) => setEditableNotes(prev => ({
                                ...prev,
                                [defaultPhoto.id]: e.target.value
                              }))}
                              rows={4}
                            />
                          </div>
                          {showWeather && defaultPhoto.analysis.weather && (
                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-semibold mb-2">Weather Conditions</h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {defaultPhoto.analysis.weather.temperature && (
                                  <p>Temperature: {defaultPhoto.analysis.weather.temperature}°F</p>
                                )}
                                {defaultPhoto.analysis.weather.conditions && (
                                  <p>Conditions: {defaultPhoto.analysis.weather.conditions}</p>
                                )}
                                {defaultPhoto.analysis.weather.windSpeed && (
                                  <p>Wind Speed: {defaultPhoto.analysis.weather.windSpeed} mph</p>
                                )}
                                {defaultPhoto.analysis.weather.precipitation && (
                                  <p>Precipitation: {defaultPhoto.analysis.weather.precipitation}%</p>
                                )}
                              </div>
                            </div>
                          )}
                          <div className="bg-destructive/10 p-4 rounded-lg">
                            <h4 className="font-semibold text-destructive mb-2">Urgent Action Required</h4>
                            <p className="text-sm">
                              Based on our assessment, immediate attention is needed.
                              Contact our team for a detailed consultation and remediation plan.
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Property Details */}
                <Card>
                  <CardHeader>
                    <CardTitle>Property Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium">Property Details</label>
                        <div className="space-y-1 mt-1">
                          <p className="text-sm">Parcel Number: {parcelNumber || 'N/A'}</p>
                          <p className="text-sm">Year Built: {yearBuilt || 'N/A'}</p>
                          <p className="text-sm">Property Use: {propertyUse || 'N/A'}</p>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Property Values</label>
                        <div className="space-y-1 mt-1">
                          <p className="text-sm">Total Value: {formatCurrency(propertyValue)}</p>
                          <p className="text-sm">Land Value: {formatCurrency(landValue)}</p>
                          <p className="text-sm">Improvement Value: {formatCurrency(improvementValue)}</p>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Location</label>
                        <div className="space-y-1 mt-1">
                          <p className="text-sm">{propertyAddress}</p>
                          <p className="text-sm">{city}, {state} {zipCode}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Additional Photos */}
                {sortedPhotos.filter(photo => !photo.isDefault).map((photo, index) => (
                  <Card key={photo.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">Detailed Assessment - Photo {index + 1}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div
                          className="relative aspect-video"
                          ref={el => photoRefs.current[photo.id] = el}
                        >
                          <img
                            src={`/uploads/${photo.filename}`}
                            alt={`Photo ${index + 1}`}
                            className="absolute inset-0 w-full h-full object-cover rounded"
                          />
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium">Damage Assessment</label>
                            <div className="space-y-1 mt-1">
                              <p className="text-muted-foreground capitalize">Type: {photo.analysis.damageType}</p>
                              <p className="text-muted-foreground capitalize">Severity: {photo.analysis.severity}</p>
                            </div>
                          </div>
                          {showWeather && photo.analysis.weather && (
                            <div className="bg-muted p-4 rounded-lg">
                              <h4 className="font-semibold mb-2">Weather Conditions</h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {photo.analysis.weather.temperature && (
                                  <p>Temperature: {photo.analysis.weather.temperature}°F</p>
                                )}
                                {photo.analysis.weather.conditions && (
                                  <p>Conditions: {photo.analysis.weather.conditions}</p>
                                )}
                                {photo.analysis.weather.windSpeed && (
                                  <p>Wind Speed: {photo.analysis.weather.windSpeed} mph</p>
                                )}
                                {photo.analysis.weather.precipitation && (
                                  <p>Precipitation: {photo.analysis.weather.precipitation}%</p>
                                )}
                              </div>
                            </div>
                          )}
                          <div>
                            <label className="text-sm font-medium">Analysis Notes</label>
                            <Textarea
                              value={editableNotes[photo.id]}
                              onChange={(e) => setEditableNotes(prev => ({
                                ...prev,
                                [photo.id]: e.target.value
                              }))}
                              rows={4}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Card>
                  <CardHeader>
                    <CardTitle>Overall Assessment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Enter overall inspection notes..."
                      value={overallNotes}
                      onChange={(e) => setOverallNotes(e.target.value)}
                      rows={6}
                    />
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}