import { PhotoViewer } from "@/components/photo-viewer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  Wind,
  CloudRain,
  AlertTriangle,
  Save,
  MapPin,
  Trash2,
  Eye,
  Download,
  Building2,
  Users,
  Camera,
  ClipboardCheck,
  Home,
  FileText,
  Shield,
  ImageIcon,
  Sparkles,
  FileDown,
  CheckCircle2,
  XCircle,
  User,
  Copy,
  ExternalLink,
  FileEdit,
  Calendar,
  Cloud,
  File,
} from "lucide-react";
import { PhotoEditor } from "@/components/photo-editor";
import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { InlineEdit } from "@/components/inline-edit";
import { StateSelect } from "@/components/state-select";
import axios from "axios";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ImageGallery } from "@/components/image-gallery";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, Cloud as CloudIcon } from "lucide-react";
import { ReportList } from "@/components/report-list";
import { InspectionReport } from "@/components/inspection-report"; //Import the InspectionReport component
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import OwnersTabs from "@/components/OwnersTabs";
import { use } from "passport";

interface Photo {
  id: number;
  filename: string;
  originalName: string;
  uploadedAt: string;
  url: string;
  thumbnailUrl: string;
  metadata: any;
  user: any;
}

interface WeatherEvent {
  date: string;
  type: string;
  severity: string;
  description: string;
}

interface InspectionReport {
  id: number;
  createdAt: string;
  url: string;
}

interface InspectionPhoto {
  id: number;
  editedImage: string;
  notes: string;
  annotations?: Array<{
    type: string;
    position: {
      x: number;
      y: number;
    };
    metadata: Record<string, any>;
  }>;
}

interface Inspection {
  id: number;
  createdAt: string;
  notes: string;
  status: "pending" | "completed" | "archived";
  damageType: "wind" | "hail" | "other" | "none";
  severity: "low" | "medium" | "high";
  report?: InspectionReport;
  photos?: InspectionPhoto[];
}

interface PropertyData {
  id: number;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: string | null;
  longitude: string | null;
  status: string;
  owner1FirstName: string | null;
  owner1LastName: string | null;
  owner1Phone: string | null;
  owner1Email: string | null;
  owner1Company: string | null;
  parcelNumber?: string;
  yearBuilt?: number;
  propertyValue?: number;
  photos?: Photo[];
  inspections?: Inspection[];
  createdAt?: string;
  updatedAt?: string;
  county?: string; // Added county
  mailingAddress?: string; // Added loan number
  loanType?: string; // Added loan type
  mortgageCompany?: string; // Added mortgage company
  lastSoldDate?: string; // Added last sold date
  community?: string; // Added community name
}
interface Report {
  id: number;
  propertyId: number;
  status: "draft" | "completed" | "deleted";
  damageType: string;
  severity: string;
  createdAt: string;
  completedAt: string | null;
  shareableLink?: string;
}
export function PropertyView() {
  const [, params] = useRoute<{ id: string }>("/property/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedWeatherTypes, setSelectedWeatherTypes] = useState<string[]>(
    []
  );
  const [inspectionCount, setInspectionCount] = useState<number>(0);
  const [weatherEvents, setWeatherEvents] = useState<WeatherEvent[]>([]);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<WeatherEvent | null>(null);
  const [selectedInspection, setSelectedInspection] =
    useState<Inspection | null>(null);
  const [showInspectionDialog, setShowInspectionDialog] = useState(false);
  const [isLoadingRegrid, setIsLoadingRegrid] = useState(false);
  const [regridData, setRegridData] = useState<any>(null);
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<number[]>([]);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [currentInspectionId, setCurrentInspectionId] = useState<number | null>(
    null
  );

  const {
    data: property,
    isLoading,
    error: propertyError,
  } = useQuery<PropertyData>({
    queryKey: [`/api/properties/${params?.id}`],
    enabled: !!params?.id,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: 3,
  });

// At the top level in your PropertyView component
const { data: inspectionsData, isLoading: inspectionsLoading } = useQuery<Report[]>({
  queryKey: [`/api/properties/${property?.id}/inspections`],
  enabled: !!property?.id,
});

useEffect(() => {
  // Run these actions when inspectionsData updates
  setInspectionCount(inspectionsData?.length || 0);
  console.log("inspectionsData?.length--->>", inspectionsData?.length);
}, [inspectionsData]);


  const filteredEvents = useMemo(() => {
    if (!Array.isArray(weatherEvents)) return [];
    return weatherEvents.filter(
      (event) =>
        selectedWeatherTypes.length === 0 ||
        selectedWeatherTypes.includes(event.type)
    );
  }, [weatherEvents, selectedWeatherTypes]);

  const formatCurrency = (value?: number): string => {
    if (!value) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const handleFetchRegridData = async () => {
    if (!property) return;

    setIsLoadingRegrid(true);
    try {
      const response = await fetch(`/api/properties/${property.id}/regrid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to fetch Regrid data");
      }

      const data = await response.json();

      await queryClient.invalidateQueries([`/api/properties/${property.id}`]);

      toast({
        title: "Success",
        description: "Property data updated from Regrid",
      });
    } catch (error) {
      console.error("Error fetching Regrid data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to fetch Regrid data",
      });
    } finally {
      setIsLoadingRegrid(false);
    }
  };

  useEffect(() => {
    const fetchWeatherData = async () => {
      if (!property?.latitude || !property?.longitude) return;

      setIsLoadingWeather(true);
      try {
        const response = await axios.get("/api/weather", {
          params: {
            lat: property.latitude,
            lon: property.longitude,
          },
        });

        setWeatherEvents(response.data || []);
      } catch (error) {
        console.error("Error fetching weather data:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch weather data",
        });
        setWeatherEvents([]);
      } finally {
        setIsLoadingWeather(false);
      }
    };

    if (property?.latitude && property?.longitude) {
      fetchWeatherData();
    }
  }, [property?.latitude, property?.longitude, toast]);

  if (isLoading || !property) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const isPropertyComplete = Boolean(
    property.address && property.city && property.state && property.zipCode
  );
  const isOwnerComplete = Boolean(
    property.owner1FirstName && property.owner1LastName
  );

  const handleUpdateProperty = async (updates: Partial<PropertyData>) => {
    if (!property) return;

    try {
      const response = await fetch(`/api/properties/${property.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await queryClient.invalidateQueries({
        queryKey: [`/api/properties/${property.id}`],
      });

      toast({
        title: "Success",
        description: "Property updated successfully",
      });
    } catch (error) {
      console.error("Error updating property:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update property",
      });
    }
  };

  const getStreetViewUrl = (property: PropertyData): string => {
    if (!property.latitude || !property.longitude) {
      const formattedAddress = encodeURIComponent(
        `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`
      );
      return `https://maps.googleapis.com/maps/api/streetview?size=800x400&location=${formattedAddress}&key=AIzaSyAq_TvETnjsrA18ZfiUIgL1wfOOszSz51M`;
    }
    return `https://maps.googleapis.com/maps/api/streetview?size=800x400&location=${property.latitude},${property.longitude}&key=AIzaSyAq_TvETnjsrA18ZfiUIgL1wfOOszSz51M`;
  };

  const weatherTypeOptions = ["wind", "hail", "rain", "storm"];

  const handleSaveAnnotations = async (annotations: any[], lines: any[]) => {
    try {
      const response = await fetch(
        `/api/properties/${property.id}/annotations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ annotations, lines }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to save annotations");
      }

      await queryClient.invalidateQueries({
        queryKey: [`/api/properties/${property.id}`],
      });
      toast({
        title: "Success",
        description: "Annotations saved successfully",
      });
    } catch (error) {
      console.error("Error saving annotations", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save annotations",
      });
    }
  };

  const loadInspectionDetails = async (inspectionId: number) => {
    try {
      const response = await fetch(`/api/inspections/${inspectionId}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to load inspection details");
      }

      const data = await response.json();
      setSelectedInspection(data);
      setShowInspectionDialog(true);
    } catch (error) {
      console.error("Error loading inspection details:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to load inspection details",
      });
    }
  };

  const handleExportInspectionPDF = async (inspection: Inspection) => {
    if (!property || !inspection) return;

    try {
      const response = await fetch(
        `/api/properties/${property.id}/inspections/${inspection.id}/report`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            property: {
              address: property.address,
              city: property.city,
              state: property.state,
              zipCode: property.zipCode,
              parcelNumber: property.parcelNumber,
              yearBuilt: property.yearBuilt?.toString(),
              propertyValue: property.propertyValue,
            },
            owners:
              property.owner1FirstName && property.owner1LastName
                ? {
                    primary: {
                      name: `${property.owner1FirstName} ${property.owner1LastName}`,
                      company: property.owner1Company,
                      phone: property.owner1Phone,
                      email: property.owner1Email,
                    },
                  }
                : undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to generate report");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inspection-report-${inspection.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Report downloaded successfully",
      });

      await queryClient.invalidateQueries({
        queryKey: [`/api/properties/${property.id}`],
      });
    } catch (error) {
      console.error("Error exporting report:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to generate report",
      });
    }
  };

  const handleDeleteInspection = async (inspectionId: number) => {
    if (!property) return;

    try {
      const response = await fetch(
        `/api/properties/${property.id}/inspections/${inspectionId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete inspection");
      }

      await queryClient.invalidateQueries({
        queryKey: [`/api/properties/${property.id}`],
      });

      toast({
        title: "Success",
        description: "Inspection deleted successfully",
      });

      setSelectedInspection(null);
      setShowInspectionDialog(false);
    } catch (error) {
      console.error("Error deleting inspection:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to delete inspection",
      });
    }
  };

  const reports = property?.inspections;

  const handleStartInspection = () => {
    if (!property?.photos?.length) {
      toast({
        title: "No Photos Available",
        description:
          "Please upload photos before creating an inspection report.",
        variant: "destructive",
      });
      return;
    }
    // Encode the photo IDs as a JSON array
    const photoIds = JSON.stringify(property.photos.map((p) => p.id));
    setLocation(
      `/property/${property.id}/inspection/new?photos=${encodeURIComponent(
        photoIds
      )}`
    );
  };

  const handlePhotoSelection = (photoIds: number[]) => {
    setSelectedPhotoIds(photoIds);
  };

  const handleGenerateReport = () => {
    if (!property?.photos) return;

    const selectedPhotos = property.photos.filter((photo) =>
      selectedPhotoIds.includes(photo.id)
    );

    if (selectedPhotos.length === 0) {
      toast({
        title: "No Photos Selected",
        description: "Please select at least one photo for the report.",
        variant: "destructive",
      });
      return;
    }
    setShowReportDialog(true);
  };

  const No_of_Owner = (property) => {
    if (!property) return ;

    let owners = 0;
    for (let i = 1; i <= 5; i++) {
      const firstName = property[`owner${i}FirstName`];
      const lastName = property[`owner${i}LastName`];
      
      if (firstName && lastName && !(firstName.toLowerCase() === "no" && lastName.toLowerCase() === "no")) {
        owners ++;
      }
    }

    return owners
  }

  const renderPhotosTab = () => (
    <TabsContent value="photos" className="mt-6">
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Property Photos</h3>
          <div className="flex gap-2">
            {selectedPhotoIds.length > 0 && (
              <Button variant="default" onClick={handleGenerateReport}>
                <FileText className="w-4 h-4 mr-2" />
                Generate Report
              </Button>
            )}
            <Button variant="default" onClick={handleStartInspection}>
              <Camera className="w-4 h-4 mr-2" />
              Start Inspection
            </Button>
          </div>
        </div>
        <ImageGallery
          photos={property?.photos || []}
          selectedIds={selectedPhotoIds}
          onSelectionChange={handlePhotoSelection}
          propertyId={property?.id || 0}
        />
      </div>
    </TabsContent>
  );

  const handleStatusChange = async (newStatus: string) => {
    if (!property) return;

    try {
      const response = await fetch(`/api/properties/${property.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await queryClient.invalidateQueries({
        queryKey: [`/api/properties/${property.id}`],
      });

      toast({
        title: "Success",
        description: "Property status updated successfully",
      });
    } catch (error) {
      console.error("Error updating property status:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update property status",
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-6 w-6" />
            <span className="font-semibold">CloudLens</span>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <Button
              variant="ghost"
              onClick={() => setLocation("/property-explorer")}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Properties
            </Button>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{property.address}</h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(property.address);
                  toast({
                    title: "Copied",
                    description: "Address copied to clipboard",
                  });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-muted-foreground">
              {property.city}, {property.state} {property.zipCode}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Select value={property.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inspected">Inspected</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={handleFetchRegridData}
              disabled={isLoadingRegrid}
            >
              {isLoadingRegrid ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Building2 className="h-4 w-4 mr-2" />
              )}
              Fetch Data
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="w-full justify-start">
                <TabsTrigger
                  value="details"
                  className="flex items-center gap-2"
                >
                  Property Details
                  {isPropertyComplete && (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="photos" className="flex items-center gap-2">
                  Photos ({property?.photos?.length || 0})
                </TabsTrigger>
                <TabsTrigger
                  value="inspections"
                  className="flex items-center gap-2"
                >
                  Inspections (
                  {inspectionCount})
                </TabsTrigger>
                <TabsTrigger value="owners" className="flex items-center gap-2">
                  Owners ({No_of_Owner(property)})
                  {isOwnerComplete && (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Property Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-sm font-medium mb-2">
                          Basic Information
                        </h3>
                        <div className="space-y-2">
                          <div>
                            <label className="text-sm text-muted-foreground">
                              Address
                            </label>
                            <InlineEdit
                              value={property.address}
                              onSave={(value) =>
                                handleUpdateProperty({ address: value })
                              }
                            />
                          </div>
                          <div>
                            <label className="text-sm text-muted-foreground">
                              Owner
                            </label>
                            <div className="flex items-center gap-2">
                              <InlineEdit
                                value={property.owner1FirstName || ""}
                                onSave={(value) =>
                                  handleUpdateProperty({
                                    owner1FirstName: value,
                                  })
                                }
                                placeholder="First Name"
                              />
                              <InlineEdit
                                value={property.owner1LastName || ""}
                                onSave={(value) =>
                                  handleUpdateProperty({
                                    owner1LastName: value,
                                  })
                                }
                                placeholder="Last Name"
                              />
                              {property.owner1Company && (
                                <span className="text-muted-foreground">
                                  (
                                  <InlineEdit
                                    value={property.owner1Company}
                                    onSave={(value) =>
                                      handleUpdateProperty({
                                        owner1Company: value,
                                      })
                                    }
                                    placeholder="Company"
                                  />
                                  )
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm text-muted-foreground">
                                County
                              </label>
                              <InlineEdit
                                value={property.county || ""}
                                onSave={(value) =>
                                  handleUpdateProperty({ county: value })
                                }
                                placeholder="Enter county"
                              />
                            </div>
                            <div>
                              <label className="text-sm text-muted-foreground">
                                Parcel Number
                              </label>
                              <InlineEdit
                                value={property.parcelNumber || ""}
                                onSave={(value) =>
                                  handleUpdateProperty({ parcelNumber: value })
                                }
                                placeholder="Enter parcel number"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium mb-2">
                          Loan Information
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          {
                            property?.mailingAddress && <div>
                              <label className="text-sm text-muted-foreground">
                                Mailing Address
                              </label>
                              <InlineEdit
                                value={property.mailingAddress || ""}
                                onSave={(value) =>
                                  handleUpdateProperty({ mailingAddress: value })
                                }
                                placeholder="Enter mailing Address"
                              />
                            </div>
                          } 
                          <div>
                            <label className="text-sm text-muted-foreground">
                              Loan Type
                            </label>
                            <InlineEdit
                              value={property.loanType || ""}
                              onSave={(value) =>
                                handleUpdateProperty({ loanType: value })
                              }
                              placeholder="Enter loan type"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-muted-foreground">
                              Mortgage Company
                            </label>
                            <InlineEdit
                              value={property.mortgageCompany || ""}
                              onSave={(value) =>
                                handleUpdateProperty({ mortgageCompany: value })
                              }
                              placeholder="Enter mortgage company"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-muted-foreground">
                              Last Sold Date
                            </label>
                            <InlineEdit
                              value={
                                property.lastSoldDate
                                  ? new Date(
                                      property.lastSoldDate
                                    ).toLocaleDateString()
                                  : ""
                              }
                              onSave={(value) => {
                                const date = new Date(value);
                                if (!isNaN(date.getTime())) {
                                  handleUpdateProperty({
                                    lastSoldDate: date.toISOString(),
                                  });
                                }
                              }}
                              placeholder="MM/DD/YYYY"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium mb-2">
                          Property Details
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm text-muted-foreground">
                              Year Built
                            </label>
                            <InlineEdit
                              value={property.yearBuilt?.toString() || ""}
                              onSave={(value) =>
                                handleUpdateProperty({
                                  yearBuilt: parseInt(value) || null,
                                })
                              }
                              placeholder="Enter year built"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-muted-foreground">
                              Property Value
                            </label>
                            <InlineEdit
                              value={property.propertyValue?.toString() || ""}
                              onSave={(value) =>
                                handleUpdateProperty({
                                  propertyValue: parseFloat(value) || null,
                                })
                              }
                              placeholder="Enter property value"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-muted-foreground">
                              Community/HOA
                            </label>
                            <InlineEdit
                              value={property?.community || property?.hoaName}
                              onSave={(value) =>
                                handleUpdateProperty({ community: value })
                              }
                              placeholder="Enter community name"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Dialog
                  open={showDateRangePicker}
                  onOpenChange={setShowDateRangePicker}
                >
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Filter Weather Events</DialogTitle>
                      <DialogDescription>
                        Select a date range to filter weather events
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label>Start Date</Label>
                        <Input
                          type="date"
                          onChange={(e) => {
                            // TODO: Implement date filtering
                          }}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>End Date</Label>
                        <Input
                          type="date"
                          onChange={(e) => {
                            // TODO: Implement date filtering
                          }}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={() => setShowDateRangePicker(false)}>
                        Apply
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {renderPhotosTab()}

              <TabsContent value="inspections" className="mt-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">
                      Property Inspections
                    </h3>
                    <Button variant="default" onClick={handleStartInspection}>
                      <Camera className="w-4 h-4 mr-2" />
                      Start New Inspection
                    </Button>
                  </div>

                  <ReportList propertyId={property.id} inspectionCount={inspectionCount} setInspectionCount={setInspectionCount}/>
                </div>
              </TabsContent>

              <TabsContent value="owners">
                <OwnersTabs property={property} />
              </TabsContent>
              {/* <TabsContent value="owners">
                <Card>
                  <CardHeader>
                    <CardTitle>Owner Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">First Name</label>
                          <div className="font-medium">{property.owner1FirstName || 'N/A'}</div>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Last Name</label>
                          <div className="font-medium">{property.owner1LastName || 'N/A'}</div>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Company</label>
                        <div className="font-medium">{property.owner1Company || 'N/A'}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">Phone</label>
                          <div className="font-medium">{property.owner1Phone || 'No'}</div>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Email</label>
                          <div className="font-medium">{property.owner1Email || 'No'}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent> */}
              <TabsContent value="documents">
                <div className="p-4 text-center text-muted-foreground">
                  Document management coming soon
                </div>
              </TabsContent>
              <TabsContent value="actions">
                <Card>
                  <CardHeader>
                    <CardTitle>Activity Log</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[600px]">
                      <div className="space-y-4">
                        {property?.inspections?.map((inspection) => (
                          <div
                            key={inspection.id}
                            className="flex gap-4 items-start"
                          >
                            <div className="w-4 h-4 mt-1 rounded-full bg-primary" />
                            <div>
                              <p className="font-medium">
                                Inspection{" "}
                                {inspection.status === "completed"
                                  ? "Completed"
                                  : "Created"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(
                                  inspection.createdAt
                                ).toLocaleString()}
                              </p>
                              <p className="text-sm mt-1">{inspection.notes}</p>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-4 items-start">
                          <div className="w-4 h-4 mt-1 rounded-full bg-primary" />
                          <div>
                            <p className="font-medium">Property Created</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(
                                property.createdAt || ""
                              ).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Street View</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative aspect-video">
                  <img
                    src={getStreetViewUrl(property)}
                    alt="Street View"
                    className="w-full h-full object-cover rounded"
                  />
                </div>
                <div className="mt-2 text-xs space-y-1">
                  <p className="text-muted-foreground">
                    Created:{" "}
                    {new Date(property.createdAt || "").toLocaleString()}
                  </p>
                  {property.updatedAt && (
                    <p className="text-muted-foreground">
                      Last edited:{" "}
                      {new Date(property.updatedAt).toLocaleString()}
                    </p>
                  )}
                  <a
                    href={`https://www.google.com/maps?layer=c&cbll=${property.latitude},${property.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View in Street View
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Quick Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-6">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-sm font-medium">Total Value</label>
                      <div className="text-2xl font-bold">
                        {formatCurrency(property.propertyValue)}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Year Built</label>
                      <div className="text-2xl font-bold">
                        {property.yearBuilt || "N/A"}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Status</label>
                      <div>
                        <Badge
                          variant={
                            property.status === "completed"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {property.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-sm font-medium">Photos</label>
                        <div className="font-medium">
                          {property?.photos?.length || 0}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">
                          Inspections
                        </label>
                        <div className="font-medium">
                          {property?.inspections?.length || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justifybetween mb-4">
                    <CardTitle className="text-base">
                      Recent Weather Events
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDateRangePicker(true)}
                      className="h-7 px-2"
                    >
                      <CalendarIcon className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {weatherTypeOptions.map((type) => (
                      <Button
                        key={type}
                        variant={
                          selectedWeatherTypes.includes(type)
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        onClick={() => {
                          setSelectedWeatherTypes((prev) =>
                            prev.includes(type)
                              ? prev.filter((t) => t !== type)
                              : [...prev, type]
                          );
                        }}
                        className="h-7 px-2"
                      >
                        {type === "wind" && (
                          <Wind className="w-3 h3 h-3 mr-1" />
                        )}
                        {type === "rain" && (
                          <CloudRain className="w-3 h-3 mr-1" />
                        )}
                        {type === "hail" && (
                          <AlertTriangle className="w-3 h-3 mr-1" />
                        )}
                        {type === "storm" && (
                          <CloudIcon className="w-3 h-3 mr-1" />
                        )}
                        {type}
                      </Button>
                    ))}
                  </div>

                  <div className="space-y-1 max-h-[200px] overflow-y-auto border rounded-md p-2">
                    {isLoadingWeather ? (
                      <div className="flex items-center justify-center py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : filteredEvents.length > 0 ? (
                      filteredEvents.map((event, index) => (
                        <div
                          key={`${event.date}-${index}`}
                          className="flex items-center justify-between p-2 hover:bg-accent rounded-sm"
                        >
                          <Badge
                            variant={
                              event.severity === "high"
                                ? "destructive"
                                : event.severity === "medium"
                                ? "default"
                                : "default"
                            }
                          >
                            {event.type}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(event.date).toLocaleDateString()}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-2 text-sm text-muted-foreground">
                        No weather events found
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {showInspectionDialog && selectedInspection && (
          <Dialog
            open={showInspectionDialog}
            onOpenChange={setShowInspectionDialog}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Inspection Details</DialogTitle>
                <DialogDescription>
                  Created:{" "}
                  {new Date(selectedInspection.createdAt).toLocaleString()}
                  <br />
                  Status: {selectedInspection.status}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Damage Type</Label>
                  <div className="text-muted-foreground">
                    {selectedInspection.damageType}
                  </div>
                </div>
                <div>
                  <Label>Severity</Label>
                  <div className="text-muted-foreground">
                    {selectedInspection.severity}
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <div className="text-muted-foreground whitespace-pre-wrap">
                    {selectedInspection.notes}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <div className="flex justify-between w-full">
                  <Button
                    variant="outline"
                    onClick={() =>
                      handleExportInspectionPDF(selectedInspection)
                    }
                    disabled={!selectedInspection}
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    Export PDF
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (selectedInspection?.id) {
                          handleDeleteInspection(selectedInspection.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowInspectionDialog(false)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        {showReportDialog && property && (
          <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
            <DialogContent>
              <InspectionReport
                propertyId={property.id}
                inspectionId={currentInspectionId}
                selectedPhotos={
                  property.photos?.filter((p) =>
                    selectedPhotoIds.includes(p.id)
                  ) || []
                }
                onClose={() => setShowReportDialog(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

export default PropertyView;

const handleUpdateOwner2LastName = async (value: string) => {
  try {
    const response = await fetch(
      `/api/properties/${params?.id}/owner2LastName`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastName: value }),
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    await queryClient.invalidateQueries({ queryKey: ["/api/properties"] });

    toast({
      title: "Success",
      description: "Owner 2 last name updated successfully",
    });
  } catch (error) {
    toast({
      variant: "destructive",
      title: "Error",
      description:
        error instanceof Error ? error.message : "Failed to update owner",
    });
  }
};

const handleDeleteInspection = async (inspectionId: number) => {
  try {
    const response = await fetch(
      `/api/properties/${params?.id}/inspections/${inspectionId}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    await queryClient.invalidateQueries({
      queryKey: [`/api/properties/${params?.id}`],
    });
    toast({ title: "Success", description: "Inspection deleted successfully" });
  } catch (error) {
    console.error("Error deleting inspection:", error);
    toast({
      variant: "destructive",
      title: "Error",
      description:
        error instanceof Error ? error.message : "Failed to delete inspection",
    });
  }
};

const handleContinueDraft = async (inspection: any) => {
  setManualInspection({
    ...inspection,
    photos: inspection.photos.map((photo: any) => ({
      ...photo,
      annotations: photo.annotations,
    })),
  });
  setCurrentEditingPhoto(inspection.photos[0].photoId);
  setShowPhotoEditor(true);
};

const onSaveInspection = async (photoId: number, data: any) => {
  try {
    const response = await fetch(
      `/api/api/properties/${property?.id}/photos/${photoId}/annotations`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          annotations: data.annotations,
          notes: data.notes,
        }),
      }
    );
    if (!response.ok) {
      throw new Error(await response.text());
    }
    await queryClient.invalidateQueries([`/api/properties/${property?.id}`]);
    toast({ title: "Success", description: "Annotations saved successfully" });
  } catch (error) {
    console.error("Error saving annotations", error);
    toast({
      variant: "destructive",
      title: "Error",
      description:
        error instanceof Error ? error.message : "Failed tosave annotations",
    });
  }
};

interface DateRange {
  from: Date | null;
  to: Date | null;
}

const handlePropertyError = (error: any) => {
  //Implementation for handling property update errors
};

const handleReportGeneration = (inspection: any) => {
  //Implementation for generating report
};

const handleSaveReport = () => {
  //Implementation for saving report
};

const setManualInspection = (inspection: any) => {
  //Implementation for setting manual inspection
};

const setCurrentEditingPhoto = (photoId: number) => {
  //Implementation for setting current editing photo
};

const setShowPhotoEditor = (show: boolean) => {
  //Implementation for showing/hiding photo editor
};

const analyzedPhotos = [];

const showReportPreview = false;
const setShowReportPreview = () => {};

const CompletionIndicator = ({ isComplete }: { isComplete: boolean }) => (
  <span
    className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
      isComplete ? "bg-green-500 text-white" : "bg-gray-300 text-gray-600"
    }`}
  >
    {isComplete ? "Complete" : "Incomplete"}
  </span>
);

interface StreetViewLinkProps {
  address: string;
  lat: number | null;
  lng: number | null;
}

const StreetViewLink: React.FC<StreetViewLinkProps> = ({
  address,
  lat,
  lng,
}) => {
  //Implementation for StreetView Link
  return <></>;
};
