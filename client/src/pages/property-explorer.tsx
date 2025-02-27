import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation } from "wouter";
import { Sidebar } from "@/components/sidebar";
import {
  Search,
  TableIcon,
  Map,
  Upload,
  Settings as SettingsIcon,
  Loader2,
  Camera,
  CalendarIcon,
  FileText,
  ArrowUpDown,
  AlertTriangle,
  MapPin,
} from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  APIProvider,
  Map as GoogleMap,
  Marker,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { format } from "date-fns";
import { useTheme } from "next-themes";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DragDropUpload } from "@/components/drag-drop-upload";
import { useToast } from "@/hooks/use-toast";
import { ScanBatchForm } from "@/components/scan-batch-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InspectionDateFilter } from "@/components/inspection-date-filter";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Property = {
  id: number;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  status: "processing" | "pending" | "inspected";
  ownerName: string | null;
  ownerPhone: string | null;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
  inspectionCount: number;
  photoCount: number;
};

type StatusType = "all" | "processing" | "pending" | "inspected";
type ViewMode = "list" | "map";
type SortField =
  | "address"
  | "status"
  | "createdAt"
  | "inspectionCount"
  | "photoCount";
type SortOrder = "asc" | "desc";

type FailedPhoto = {
  id: number;
  filename: string;
  originalName: string;
  processingStatus: "failed";
  metadata: {
    error?: string;
  };
  createdAt: string;
};

type UnassignedPhoto = {
  id: number;
  filename: string;
  originalName: string;
  processingStatus: "pending";
  metadata: {
    unassigned_reason?: string;
    gps?: {
      latitude?: number;
      longitude?: number;
    };
  };
  createdAt: string;
};

type ActiveTab = "properties" | "failed" | "unassigned";

export default function PropertyExplorer() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusType>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const { theme } = useTheme();
  const { toast } = useToast();
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null
  );
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [currentBatchId, setCurrentBatchId] = useState<number | null>(null);
  const [selectedProperties, setSelectedProperties] = useState<number[]>([]);
  const [sortField, setSortField] = useState<SortField>("address");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ActiveTab>("properties");
  const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignAddress, setAssignAddress] = useState("");

  // Query for properties
  const { data: properties = [], isLoading } = useQuery<Property[]>({
    queryKey: ["/api/properties", statusFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (searchTerm) {
        params.append("search", searchTerm);
      }
      const response = await fetch(`/api/properties?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch properties: ${await response.text()}`);
      }
      const data = await response.json();
      return data?.properties || [];
    },
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
    staleTime: 0,
  });

  // Query for failed photos
  const { data: failedPhotos = [], isLoading: isLoadingFailed } = useQuery<
    FailedPhoto[]
  >({
    queryKey: ["/api/photos/failed"],
    queryFn: async () => {
      const response = await fetch("/api/photos/failed", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch failed photos");
      }
      return response.json();
    },
    enabled: activeTab === "failed",
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0
  });

  // Query for unassigned photos
  const { data: unassignedPhotos = [], isLoading: isLoadingUnassigned } =
    useQuery<UnassignedPhoto[]>({
      queryKey: ["/api/photos/unassigned"],
      queryFn: async () => {
        const response = await fetch("/api/photos/unassigned", {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Failed to fetch unassigned photos");
        }
        return response.json();
      },
      enabled: activeTab === "unassigned",
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      staleTime: 0
    });

  // Add an effect to refetch data when switching tabs
  useEffect(() => {
    if (activeTab === "failed") {
      queryClient.invalidateQueries({ queryKey: ["/api/photos/failed"] });
    } else if (activeTab === "unassigned") {
      queryClient.invalidateQueries({ queryKey: ["/api/photos/unassigned"] });
    }
  }, [activeTab, queryClient]);

  // Handle photo assignment
  const handleAssignPhoto = async (photoId: number, address: string) => {
    try {
      const response = await fetch(`/api/photos/${photoId}/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address }),
        credentials: "include",
      });

      if (!response.ok) {
        let errorMessage = "Failed to assign photo";
        try {
          const errorData = await response.json();
          // If both error and message fields exist, combine them
          if (errorData.error && errorData.message) {
            errorMessage = `${errorData.error}: ${errorData.message}`;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          // If JSON parsing fails, fallback to the response text
          errorMessage = (await response.text()) || errorMessage;
        }
        throw new Error(errorMessage);
      }

      toast({
        title: "Success",
        description: "Photo has been assigned successfully",
      });

      // Force an immediate refetch of both queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/photos/unassigned"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/properties"] }),
        queryClient.refetchQueries({ queryKey: ["/api/photos/unassigned"] }),
        queryClient.refetchQueries({ queryKey: ["/api/properties"] }),
      ]);

      setShowAssignDialog(false);
      setSelectedPhotoId(null);
      setAssignAddress("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to assign photo",
      });
    }
  };

  const center = useMemo(() => {
    const defaultCenter = { lat: 32.1656, lng: -82.9001 };

    if (!Array.isArray(properties) || properties.length === 0) {
      return defaultCenter;
    }

    const validProperties = properties.filter((prop) => {
      return (
        prop &&
        typeof prop.latitude === "number" &&
        typeof prop.longitude === "number" &&
        validateCoordinates(prop.latitude, prop.longitude)
      );
    });

    if (validProperties.length === 0) {
      return defaultCenter;
    }

    const bounds = new google.maps.LatLngBounds();
    validProperties.forEach((prop) => {
      bounds.extend({ lat: prop.latitude, lng: prop.longitude });
    });

    return {
      lat: bounds.getCenter().lat(),
      lng: bounds.getCenter().lng(),
    };
  }, [properties]);

  const validateCoordinates = (lat: number, lng: number) => {
    return (
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  };

  const sortedProperties = useMemo(() => {
    if (!Array.isArray(properties)) return [];

    return [...properties].sort((a, b) => {
      const modifier = sortOrder === "asc" ? 1 : -1;

      switch (sortField) {
        case "address":
          return modifier * a.address.localeCompare(b.address);
        case "status":
          return modifier * a.status.localeCompare(b.status);
        case "createdAt":
          return (
            modifier *
            (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          );
        case "inspectionCount":
          return (
            modifier * ((a.inspectionCount || 0) - (b.inspectionCount || 0))
          );
        case "photoCount":
          return modifier * ((a.photoCount || 0) - (b.photoCount || 0));
        default:
          return 0;
      }
    });
  }, [properties, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleBatchCreated = (batchId: number) => {
    if (!batchId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create batch. Please try again.",
      });
      return;
    }

    setCurrentBatchId(batchId);
    setShowBatchForm(false);
    setShowUploadDialog(true);
    setUploading(false);
    setUploadProgress(0);
  };

  const handleUpload = async (files: FileList) => {
    if (!currentBatchId) {
      setShowBatchForm(true);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("photos", file);
      });
      formData.append("batchId", currentBatchId.toString());

      const response = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Upload failed" }));
        throw new Error(errorData.message || "Failed to upload photos");
      }

      const result = await response.json();
      setUploadProgress(100);

      toast({
        title: "Upload Started",
        description: `Processing ${files.length} photos...`,
      });

      const checkStatus = async () => {
        const statusResponse = await fetch(
          `/api/photos/batch/${currentBatchId}/status`
        );
        const statusData = await statusResponse.json();

        if (statusData.status === "completed") {
          handleUploadComplete();
        } else if (statusData.status === "failed") {
          throw new Error(statusData.error || "Processing failed");
        } else {
          setTimeout(checkStatus, 2000);
        }
      };

      setTimeout(checkStatus, 2000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to upload photos",
      });
      handleCloseUpload();
    }
  };

  const handleCloseUpload = () => {
    setShowUploadDialog(false);
    setCurrentBatchId(null);
    setUploadProgress(0);
    setUploading(false);
  };

  const handleUploadComplete = () => {
    toast({
      title: "Success",
      description: "Photos have been processed successfully",
    });

    handleCloseUpload();
    // Force an immediate refetch of the properties
    queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
    queryClient.refetchQueries({ queryKey: ["/api/properties"] });
  };

  const TableView = ({ properties }: { properties: Property[] }) => {
    if (!Array.isArray(properties)) {
      return null;
    }

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]">
                <Checkbox
                  checked={
                    properties.length > 0 &&
                    properties.every((prop) =>
                      selectedProperties.includes(prop.id)
                    )
                  }
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedProperties(properties.map((p) => p.id));
                    } else {
                      setSelectedProperties([]);
                    }
                  }}
                />
              </TableHead>
              <TableHead
                onClick={() => handleSort("address")}
                className="cursor-pointer"
              >
                <div className="flex items-center">
                  Address
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              <TableHead
                onClick={() => handleSort("status")}
                className="cursor-pointer"
              >
                <div className="flex items-center">
                  Status
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              <TableHead
                onClick={() => handleSort("createdAt")}
                className="cursor-pointer"
              >
                <div className="flex items-center">
                  Created
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              <TableHead
                onClick={() => handleSort("inspectionCount")}
                className="cursor-pointer"
              >
                <div className="flex items-center">
                  Inspections
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              <TableHead
                onClick={() => handleSort("photoCount")}
                className="cursor-pointer"
              >
                <div className="flex items-center">
                  Photos
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProperties.map((property) => (
              <TableRow key={property.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedProperties.includes(property.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedProperties([
                          ...selectedProperties,
                          property.id,
                        ]);
                      } else {
                        setSelectedProperties(
                          selectedProperties.filter((id) => id !== property.id)
                        );
                      }
                    }}
                  />
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{property.address}</p>
                    <p className="text-sm text-muted-foreground">
                      {property.city}, {property.state} {property.zipCode}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      property.status === "inspected"
                        ? "default"
                        : property.status === "pending"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {property.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {format(new Date(property.createdAt), "MMM d, yyyy")}
                  </div>
                </TableCell>
                <TableCell>{property.inspectionCount || 0}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    {property.photoCount || 0}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLocation(`/property/${property.id}`)}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const MapView = ({ properties }: { properties: Property[] }) => {
    useEffect(() => {
      if (!mapRef.current || !Array.isArray(properties)) return;

      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
      }

      const markers = properties
        .filter((prop) => validateCoordinates(prop.latitude, prop.longitude))
        .map((property) => {
          const marker = new google.maps.Marker({
            position: { lat: property.latitude, lng: property.longitude },
            title: property.address,
          });

          marker.addListener("click", () => {
            setSelectedProperty(property);
          });

          return marker;
        });

      markersRef.current = markers;

      if (markers.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        markers.forEach((marker) => bounds.extend(marker.getPosition()!));
        mapRef.current.fitBounds(bounds);
      }

      clustererRef.current = new MarkerClusterer({
        map: mapRef.current,
        markers,
      });

      return () => {
        if (clustererRef.current) {
          clustererRef.current.clearMarkers();
        }
      };
    }, [properties]);

    return (
      <div className="h-[600px] w-full">
        <APIProvider apiKey="AIzaSyAq_TvETnjsrA18ZfiUIgL1wfOOszSz51M">
          <GoogleMap
            zoom={7}
            center={center}
            mapId={theme === "dark" ? "DARK_MAP_ID" : "LIGHT_MAP_ID"}
            gestureHandling={"greedy"}
            disableDefaultUI={false}
            onClick={() => setSelectedProperty(null)}
            onLoad={(map) => {
              mapRef.current = map;
            }}
          >
            {selectedProperty && (
              <InfoWindow
                position={{
                  lat: selectedProperty.latitude,
                  lng: selectedProperty.longitude,
                }}
                onCloseClick={() => setSelectedProperty(null)}
              >
                <div className="p-2">
                  <h3 className="font-medium">{selectedProperty.address}</h3>
                  <p className="text-sm">
                    {selectedProperty.city}, {selectedProperty.state}
                  </p>
                  <p className="text-sm">Status: {selectedProperty.status}</p>
                  <p className="text-sm">
                    Photos: {selectedProperty.photoCount || 0}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() =>
                      setLocation(`/property/${selectedProperty.id}`)
                    }
                  >
                    View Details
                  </Button>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </APIProvider>
      </div>
    );
  };

  const handleGenerateReport = async () => {
    if (selectedProperties.length === 0) {
      toast({
        variant: "destructive",
        title: "No Properties Selected",
        description:
          "Please select at least one property to generate a report.",
      });
      return;
    }

    try {
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ propertyIds: selectedProperties }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `property-report-${new Date().toISOString()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Report generated successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate report",
      });
    }
  };

  const FailedPhotosView = ({ photos }: { photos: FailedPhoto[] }) => {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Original Name</TableHead>
              <TableHead>Error</TableHead>
              <TableHead>Upload Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {photos.map((photo) => (
              <TableRow key={photo.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    {photo.originalName}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    {photo.metadata.error || "Unknown error"}
                  </div>
                </TableCell>
                <TableCell>
                  {format(new Date(photo?.uploadedAt), "MMM d, yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      toast({
                        title: "Coming Soon",
                        description:
                          "Photo review functionality will be available soon.",
                      });
                    }}
                  >
                    Review
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const UnassignedPhotosView = ({ photos }: { photos: UnassignedPhoto[] }) => {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Original Name</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>GPS Coordinates</TableHead>
              <TableHead>Upload Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {photos.map((photo) => (
              <TableRow key={photo.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    {photo.originalName}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    {photo.metadata.unassigned_reason ||
                      "No property match found"}
                  </div>
                </TableCell>
                <TableCell>
                  {photo.metadata.gps?.latitude &&
                  photo.metadata.gps?.longitude ? (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {`${photo.metadata.gps.latitude.toFixed(
                        6
                      )}, ${photo.metadata.gps.longitude.toFixed(6)}`}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">No GPS data</span>
                  )}
                </TableCell>
                <TableCell>
                  {format(new Date(photo.uploadedAt), "MMM d, yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedPhotoId(photo.id);
                      setShowAssignDialog(true);
                    }}
                  >
                    Assign
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto py-8 px-4">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-3xl font-bold text-foreground">
                Property Explorer
              </h1>
              <div className="flex gap-2">
                {activeTab === "properties" &&
                  selectedProperties.length > 0 && (
                    <Button variant="outline" onClick={handleGenerateReport}>
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Report ({selectedProperties.length})
                    </Button>
                  )}
                <Button onClick={() => setShowBatchForm(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Photos
                </Button>
              </div>
            </div>

            {activeTab === "properties" && (
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px] relative">
                  <Input
                    placeholder="Search address, ZIP code, or owner info..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                  <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(value: StatusType) => setStatusFilter(value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="inspected">Inspected</SelectItem>
                  </SelectContent>
                </Select>
                <InspectionDateFilter />
              </div>
            )}
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(value: string) => setActiveTab(value as ActiveTab)}
          >
            <TabsList className="mb-4">
              <TabsTrigger value="properties">Properties</TabsTrigger>
              <TabsTrigger value="failed" className="flex items-center gap-2">
                Failed Photos
                {failedPhotos.length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {failedPhotos.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="unassigned"
                className="flex items-center gap-2"
              >
                Unassigned Photos
                {unassignedPhotos.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {unassignedPhotos.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="properties">
              <Card className="flex-1">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={viewMode === "list" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("list")}
                    >
                      <TableIcon className="h-4 w-4 mr-2" />
                      List View
                    </Button>
                    <Button
                      variant={viewMode === "map" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("map")}
                    >
                      <Map className="h-4 w-4 mr-2" />
                      Map View
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : viewMode === "list" ? (
                    <TableView properties={properties} />
                  ) : (
                    <MapView properties={properties} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="failed">
              <Card className="flex-1">
                <CardContent>
                  {isLoadingFailed ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : (
                    <FailedPhotosView photos={failedPhotos} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="unassigned">
              <Card className="flex-1">
                <CardContent>
                  {isLoadingUnassigned ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : (
                    <UnassignedPhotosView photos={unassignedPhotos} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="sm:max-w-md">
          <div className="grid gap-4">
            <h2 className="text-lg font-semibold">Assign Photo to Property</h2>
            <Input
              placeholder="Enter property address..."
              value={assignAddress}
              onChange={(e) => setAssignAddress(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAssignDialog(false);
                  setSelectedPhotoId(null);
                  setAssignAddress("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedPhotoId) {
                    handleAssignPhoto(selectedPhotoId, assignAddress);
                  }
                }}
                disabled={!assignAddress.trim()}
              >
                Assign
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ScanBatchForm
        open={showBatchForm}
        onOpenChange={setShowBatchForm}
        onSuccess={handleBatchCreated}
      />

      <Dialog
        open={showUploadDialog}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseUpload();
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DragDropUpload
            onFilesSelected={handleUpload}
            uploading={uploading}
            progress={uploadProgress}
            disabled={uploading}
            batchId={currentBatchId}
            onShowBatchForm={() => setShowBatchForm(true)}
            onUploadComplete={handleUploadComplete}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
