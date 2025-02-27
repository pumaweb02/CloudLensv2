import { useState, useCallback } from "react";
import { ScanBatchForm } from "@/components/scan-batch-form";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { DragDropUpload } from "@/components/drag-drop-upload";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, ArrowRight } from "lucide-react";

const MAX_CHUNK_SIZE = 50 * 1024 * 1024; // 50MB chunks

interface ScanBatch {
  id: number;
  name: string;
  description: string;
  flightDate: string;
  createdAt: string;
}

export default function BatchManagement() {
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const { toast } = useToast();

  const { data: batches = [], refetch: refetchBatches } = useQuery<ScanBatch[]>({
    queryKey: ["/api/scan-batches"],
    queryFn: async () => {
      const response = await fetch("/api/scan-batches");
      if (!response.ok) {
        throw new Error("Failed to fetch batches");
      }
      return response.json();
    }
  });

  const handleCreateBatchClick = () => {
    setShowBatchForm(true);
  };

  const handleBatchCreated = async (batchId: number) => {
    setSelectedBatchId(batchId);
    await refetchBatches();
    setShowBatchForm(false);
    toast({
      title: "Success",
      description: "Scan batch created. You can now upload photos.",
    });
  };

  const uploadChunk = async (
    chunk: Blob,
    chunkIndex: number,
    totalChunks: number,
    fileName: string,
    batchId: number
  ): Promise<void> => {
    const formData = new FormData();
    formData.append("chunk", chunk, "chunk");
    formData.append("chunkIndex", chunkIndex.toString());
    formData.append("totalChunks", totalChunks.toString());
    formData.append("fileName", fileName);
    formData.append("batchId", batchId.toString());
    formData.append("isChunked", "true");

    const response = await fetch("/api/photos/upload-chunk", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Failed to upload chunk ${chunkIndex}`);
    }

    return response.json();
  };

  const handleFilesSelected = async (files: FileList) => {
    if (!selectedBatchId) {
      handleCreateBatchClick();
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_CHUNK_SIZE) {
          // Large file - use chunked upload
          const totalChunks = Math.ceil(file.size / MAX_CHUNK_SIZE);
          for (let i = 0; i < totalChunks; i++) {
            const start = i * MAX_CHUNK_SIZE;
            const end = Math.min(start + MAX_CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);

            await uploadChunk(chunk, i, totalChunks, file.name, selectedBatchId);

            // Update progress for upload phase (0-50%)
            const progress = ((i + 1) / totalChunks) * 100;
            setUploadProgress(Math.min(Math.floor(progress / 2), 50));
          }
        } else {
          // Small file - use regular upload
          const formData = new FormData();
          formData.append("photos", file);
          formData.append("batchId", selectedBatchId.toString());

          const response = await fetch("/api/photos/upload", {
            method: "POST",
            body: formData
          });

          if (!response.ok) {
            throw new Error(`Failed to upload ${file.name}`);
          }
        }
      }

      // Start checking processing status
      let retryCount = 0;
      const maxRetries = 30; // Maximum number of retries (1 minute with 2-second intervals)

      const checkProcessingStatus = async () => {
        try {
          const response = await fetch(`/api/photos/processing-status?batchId=${selectedBatchId}`);
          if (!response.ok) throw new Error('Failed to check processing status');
          const data = await response.json();

          console.log("Processing status:", data); // Debug log

          if (data.status === 'completed') {
            setUploadProgress(100);
            setUploading(false);
            toast({
              title: "Success",
              description: `Successfully processed ${data.details.processed} photos and created property profiles`,
            });
            setTimeout(() => setUploadProgress(0), 1000);
          } else if (data.status === 'processing') {
            // Processing progress (50% to 100%)
            // Calculate progress based on both processed files and property creation
            const processingProgress = 50 + Math.floor(data.progress * 50);
            setUploadProgress(processingProgress);

            if (retryCount < maxRetries) {
              retryCount++;
              setTimeout(checkProcessingStatus, 2000);
            } else {
              setUploading(false);
              toast({
                variant: "destructive",
                title: "Processing Timeout",
                description: "Processing is taking longer than expected. Please check the results page.",
              });
            }
          } else if (data.status === 'error') {
            toast({
              variant: "destructive",
              title: "Processing Warning",
              description: `${data.details.processed} photos processed, ${data.details.failed} failed. ${data.details.withProperty} properties created.`,
            });
            setUploading(false);
            setUploadProgress(0);
          }
        } catch (error) {
          console.error('Processing status error:', error);
          toast({
            variant: "destructive",
            title: "Processing failed",
            description: error instanceof Error ? error.message : "Failed to process photos",
          });
          setUploading(false);
          setUploadProgress(0);
        }
      };

      checkProcessingStatus();

    } catch (error) {
      console.error("Upload error:", error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle batch navigation
  const currentBatchIndex = batches.findIndex(batch => batch.id === selectedBatchId);

  const handlePreviousBatch = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event from reaching the drop zone
    if (currentBatchIndex > 0) {
      setSelectedBatchId(batches[currentBatchIndex - 1].id);
    }
  }, [batches, currentBatchIndex, setSelectedBatchId]);

  const handleNextBatch = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event from reaching the drop zone
    if (currentBatchIndex < batches.length - 1) {
      setSelectedBatchId(batches[currentBatchIndex + 1].id);
    }
  }, [batches, currentBatchIndex, setSelectedBatchId]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Photo Upload</h1>
        <Button onClick={handleCreateBatchClick} className="gap-2">
          <Plus className="h-4 w-4" />
          Create New Batch
        </Button>
      </div>

      {/* Navigation buttons moved outside of upload area */}
      {selectedBatchId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePreviousBatch}
              disabled={currentBatchIndex <= 0}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous Batch
            </Button>
            <Button
              variant="outline"
              onClick={handleNextBatch}
              disabled={currentBatchIndex >= batches.length - 1}
              className="gap-2"
            >
              Next Batch
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <DragDropUpload
            onFilesSelected={handleFilesSelected}
            uploading={uploading}
            progress={uploadProgress}
            disabled={uploading}
            batchId={selectedBatchId}
            onShowBatchForm={handleCreateBatchClick}
          />
        </div>
      )}

      {!selectedBatchId && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <h2 className="text-lg font-semibold">Create a Scan Batch</h2>
              <p className="text-sm text-muted-foreground">
                Before uploading photos, you need to create or select a scan batch to organize them.
              </p>
              <Button onClick={handleCreateBatchClick} className="gap-2">
                <Plus className="h-4 w-4" />
                Create New Batch
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Batches Section */}
      {batches.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Batches</h2>
              <Button
                variant="outline"
                onClick={() => setSelectedBatchId(null)}
                className={selectedBatchId ? "visible" : "invisible"}
              >
                Change Batch
              </Button>
            </div>
            <div className="space-y-4">
              {batches.map(batch => (
                <div
                  key={batch.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedBatchId === batch.id
                      ? "bg-primary/10 border-primary"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => setSelectedBatchId(batch.id)}
                >
                  <h3 className="font-medium">{batch.name}</h3>
                  <p className="text-sm text-muted-foreground">{batch.description}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Flight Date: {format(new Date(batch.flightDate), "PPP")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Created: {format(new Date(batch.createdAt), "PPp")}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <p>No batches created yet.</p>
              <p className="text-sm mt-1">Create your first batch to start uploading photos.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <ScanBatchForm
        open={showBatchForm}
        onOpenChange={setShowBatchForm}
        onSuccess={handleBatchCreated}
      />
    </div>
  );
}