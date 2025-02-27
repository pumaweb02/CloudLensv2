import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Share2, Loader2, Download, FileEdit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

interface ReportListProps {
  propertyId: number;
}

export function ReportList({ propertyId }: ReportListProps) {
  const [selectedReports, setSelectedReports] = useState<number[]>([]);
  const queryClient = useQueryClient();

  const { data: reports, isLoading } = useQuery<Report[]>({
    queryKey: [`/api/properties/${propertyId}/inspections`],
    enabled: !!propertyId,
  });

  const deleteInspectionsMutation = useMutation({
    mutationFn: async (inspectionIds: number[]) => {
      const response = await fetch(`/api/properties/${propertyId}/inspections`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inspectionIds }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete inspections');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Selected inspections have been deleted",
      });
      setSelectedReports([]);
      queryClient.invalidateQueries({
        queryKey: [`/api/properties/${propertyId}/inspections`],
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete inspections",
      });
    },
  });

  const handleShare = async (reportId: number) => {
    try {
      // First, create the share link
      const response = await fetch(`/api/properties/${propertyId}/inspections/${reportId}/share`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"  
        },
        credentials: "include",
      });

      // Log the raw response for debugging
      const responseText = await response.text();
      console.log('Raw server response:', responseText);

      if (!response.ok) {
        console.error('Share response error:', responseText);
        throw new Error(response.status === 404 ? "Report not found" : "Failed to create share link");
      }

      let data;
      try {
        // Parse the response text as JSON
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error("Invalid response from server");
      }

      if (!data || typeof data.shareToken !== 'string') {
        console.error('Invalid response format:', data);
        throw new Error("Invalid response format from server");
      }

      const shareableUrl = `${window.location.origin}/public/report/${data.shareToken}`;
      await navigator.clipboard.writeText(shareableUrl);

      toast({
        title: "Success",
        description: "Share link copied to clipboard. Link is valid for 30 days.",
      });

      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({
        queryKey: [`/api/properties/${propertyId}/inspections`],
      });
    } catch (error) {
      console.error('Share error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create share link"
      });
    }
  };

  const handleDownload = async (reportId: number) => {
    try {
      const response = await fetch(`/api/properties/${propertyId}/inspections/${reportId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/pdf'
        },
        body: JSON.stringify({ format: 'pdf' }),
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to download report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const filename = `CloudLens-Property-Inspection-${propertyId}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;

      document.body.appendChild(a);
      a.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Report downloaded successfully"
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to download report"
      });
    }
  };

  const handleEditDraft = async (reportId: number) => {
    window.location.href = `/property/${propertyId}/inspection/${reportId}/edit`;
  };

  const handleToggleSelect = (reportId: number) => {
    setSelectedReports(prev =>
      prev.includes(reportId)
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId]
    );
  };

  const handleDeleteSelected = () => {
    if (selectedReports.length > 0) {
      deleteInspectionsMutation.mutate(selectedReports);
    }
  };

  const handleDeleteSingle = (reportId: number) => {
    deleteInspectionsMutation.mutate([reportId]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const activeReports = reports?.filter(report => report.status !== "deleted") ?? [];

  if (!activeReports.length) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No inspection reports available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const draftReports = activeReports.filter(report => report.status === 'draft');
  const hasSelectedDrafts = selectedReports.length > 0;

  return (
    <div className="space-y-4">
      {hasSelectedDrafts && (
        <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedReports.length} {selectedReports.length === 1 ? 'draft' : 'drafts'} selected
          </span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Selected Drafts</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {selectedReports.length} selected draft{selectedReports.length === 1 ? '' : 's'}?
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteSelected}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {activeReports.map((report) => (
        <Card key={report.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {report.status === "draft" && (
                  <Checkbox
                    checked={selectedReports.includes(report.id)}
                    onCheckedChange={() => handleToggleSelect(report.id)}
                  />
                )}
                <span>
                  Inspection Report #{report.id}
                  <span className={`ml-2 text-sm ${
                    report.status === "completed" ? "text-green-500" : "text-yellow-500"
                  }`}>
                    ({report.status})
                  </span>
                </span>
              </div>
              <div className="flex gap-2">
                {report.status === "draft" ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditDraft(report.id)}
                    >
                      <FileEdit className="w-4 h-4 mr-2" />
                      Edit Draft
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Draft</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this draft inspection? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteSingle(report.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(report.id)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShare(report.id)}
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                  </>
                )}
              </div>
            </CardTitle>
            <CardDescription>
              Created on {format(new Date(report.createdAt), "PPP")}
              {report.completedAt &&
                ` • Completed on ${format(new Date(report.completedAt), "PPP")}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Damage Type</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {report.damageType}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Severity</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {report.severity}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}