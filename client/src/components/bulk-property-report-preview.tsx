import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Download, Building } from "lucide-react";
import { useState } from "react";
import type { DamageAnalysis } from "@/lib/ai-analysis";
import { Badge } from "@/components/ui/badge";

interface AnalyzedProperty {
  id: number;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  photos: Array<{
    id: number;
    filename: string;
    analysis: DamageAnalysis;
  }>;
}

interface BulkPropertyReportPreviewProps {
  properties: AnalyzedProperty[];
  onSave: (status: "draft" | "completed", data: any) => void;
  onExportPDF: () => void;
  onClose: () => void;
}

export function BulkPropertyReportPreview({
  properties,
  onSave,
  onExportPDF,
  onClose,
}: BulkPropertyReportPreviewProps) {
  const [editableNotes, setEditableNotes] = useState<Record<string, string>>(
    Object.fromEntries(
      properties.flatMap(property =>
        property.photos.map(photo => [`${property.id}-${photo.id}`, photo.analysis.description])
      )
    )
  );
  const [propertyNotes, setPropertyNotes] = useState<Record<number, string>>(
    Object.fromEntries(properties.map(p => [p.id, ""]))
  );
  const [overallNotes, setOverallNotes] = useState("");
  const [status, setStatus] = useState<"draft" | "completed">("draft");

  const handleSave = () => {
    onSave(status, {
      properties: properties.map(property => ({
        propertyId: property.id,
        notes: propertyNotes[property.id],
        photos: property.photos.map(photo => ({
          photoId: photo.id,
          analysis: {
            ...photo.analysis,
            description: editableNotes[`${property.id}-${photo.id}`]
          }
        }))
      })),
      overallNotes
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh]">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Bulk Property Analysis Report</h2>
              <p className="text-muted-foreground">
                Analyzing {properties.length} properties
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={status} onValueChange={(value: "draft" | "completed") => setStatus(value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Save as Draft</SelectItem>
                  <SelectItem value="completed">Mark Complete</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                Save Report
              </Button>
              <Button variant="outline" onClick={onExportPDF}>
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-6">
              {properties.map((property) => (
                <Card key={property.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Building className="w-5 h-5" />
                        {property.address}
                      </CardTitle>
                      <Badge>
                        {property.photos.length} photo{property.photos.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {property.city}, {property.state} {property.zipCode}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {property.photos.map((photo, photoIndex) => (
                        <Card key={photo.id}>
                          <CardContent className="pt-6">
                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="relative aspect-video">
                                <img
                                  src={`/uploads/${photo.filename}`}
                                  alt={`Photo ${photoIndex + 1}`}
                                  className="absolute inset-0 w-full h-full object-cover rounded"
                                />
                              </div>
                              <div className="space-y-4">
                                <div>
                                  <label className="text-sm font-medium">Damage Type</label>
                                  <p className="text-muted-foreground capitalize">
                                    {photo.analysis.damageType}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Severity</label>
                                  <p className="text-muted-foreground capitalize">
                                    {photo.analysis.severity}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Analysis Notes</label>
                                  <Textarea
                                    value={editableNotes[`${property.id}-${photo.id}`]}
                                    onChange={(e) =>
                                      setEditableNotes(prev => ({
                                        ...prev,
                                        [`${property.id}-${photo.id}`]: e.target.value
                                      }))
                                    }
                                    rows={3}
                                  />
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      
                      <div>
                        <label className="text-sm font-medium">Property Notes</label>
                        <Textarea
                          placeholder="Enter notes for this property..."
                          value={propertyNotes[property.id]}
                          onChange={(e) =>
                            setPropertyNotes(prev => ({
                              ...prev,
                              [property.id]: e.target.value
                            }))
                          }
                          rows={3}
                        />
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
                    placeholder="Enter overall assessment notes..."
                    value={overallNotes}
                    onChange={(e) => setOverallNotes(e.target.value)}
                    rows={6}
                  />
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
