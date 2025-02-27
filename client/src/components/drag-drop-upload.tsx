import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, AlertCircle, Download, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type DragEvent, type ChangeEvent } from "react";
import { Badge } from "@/components/ui/badge";

// Constants for file handling
const DEFAULT_MAX_FILE_SIZE = 5 * 1024; // 5GB
const DEFAULT_CHUNK_SIZE = 5; // 5MB chunks
const DEFAULT_MAX_RETRIES = 3;
const MAX_CONCURRENT_UPLOADS = 3;
const ITEMS_PER_PAGE = 10;
const STATUS_POLL_INTERVAL = 5000; // 5 seconds

interface FileUploadProgress {
  name: string;
  progress: number;
  status:
    | "pending"
    | "uploading"
    | "processing"
    | "done"
    | "error"
    | "no-coordinates";
  retries: number;
  chunksUploaded: number;
  totalChunks: number;
  processingStatus?: string;
  error?: string;
}

interface FailedUpload {
  fileName: string;
  error: string;
}

interface UploadStatus {
  total: number;
  processed: number;
  failed: number;
  pending: number;
  noCoordinates: number;
  photos: Array<{
    id: number;
    filename: string;
    processingStatus: string;
    error?: string;
    url?: string;
    thumbnailUrl?: string;
  }>;
}

interface DragDropUploadProps {
  onFilesSelected: (files: FileList) => void;
  uploading: boolean;
  progress: number;
  disabled?: boolean;
  maxFileSize?: number;
  maxChunkSize?: number;
  maxRetries?: number;
  batchId?: number | null;
  onShowBatchForm?: () => void;
  onUploadComplete?: () => void;
}

export function DragDropUpload({
  onFilesSelected,
  uploading,
  progress,
  disabled = false,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  maxChunkSize = DEFAULT_CHUNK_SIZE,
  maxRetries = DEFAULT_MAX_RETRIES,
  batchId,
  onShowBatchForm = () => {},
  onUploadComplete,
}: DragDropUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileProgresses, setFileProgresses] = useState<
    Map<string, FileUploadProgress>
  >(new Map());
  const [failedUploads, setFailedUploads] = useState<FailedUpload[]>([]);
  const [noCoordinatesFiles, setNoCoordinatesFiles] = useState<string[]>([]);
  const [showFailedDialog, setShowFailedDialog] = useState(false);
  const [showNoCoordinatesDialog, setShowNoCoordinatesDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeUploads, setActiveUploads] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const uploadQueue = useRef<File[]>([]);
  const totalUploaded = useRef<number>(0);
  const [allUploadsComplete, setAllUploadsComplete] = useState(false);
  const pollInterval = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (batchId && !allUploadsComplete) {
      let isSubscribed = true; // For cleanup

      const pollStatus = async () => {
        try {
          const response = await fetch(
            `/api/photos/upload-status?batchId=${batchId}`,
            {
              credentials: "include",
            }
          );

          if (!response.ok) {
            throw new Error("Failed to fetch upload status");
          }
          const uploadedResponse = await response.json();

          const status: UploadStatus = uploadedResponse;

          if (!isSubscribed || !status || typeof status.total === "undefined") {
            return;
          }

          setUploadStatus(status);

          // Track processing status for all photos
          let allComplete = true;
          let processedCount = 0;

          if (status.photos && status.photos.length > 0) {
            status.photos.forEach((photo) => {
              if (photo.processingStatus === "processed") {
                processedCount++;
              } else {
                allComplete = false;
              }

              setFileProgresses((prev) => {
                const newMap = new Map(prev);
                const current = Array.from(newMap.values()).find((f) =>
                  f.name.includes(photo.filename)
                );

                if (current) {
                  const newStatus =
                    photo.processingStatus === "failed"
                      ? "error"
                      : !photo.error && photo.processingStatus === "processed"
                      ? "done"
                      : "processing";

                  newMap.set(current.name, {
                    ...current,
                    status: newStatus,
                    progress: newStatus === "done" ? 100 : current.progress,
                    error: photo.error,
                    processingStatus: photo.processingStatus,
                  });
                }
                return newMap;
              });
            });

            // Check if all photos are processed AND we have the correct total
            if (
              status.total > 0 &&
              processedCount === status.total &&
              allComplete
            ) {
              clearInterval(pollInterval.current);
              pollInterval.current = undefined;
              setAllUploadsComplete(true);
              onUploadComplete?.();
            }
          }
        } catch (error) {
          console.error("Error polling upload status:", error);
        }
      };

      // Start polling
      pollInterval.current = setInterval(pollStatus, STATUS_POLL_INTERVAL);
      pollStatus(); // Initial check

      return () => {
        isSubscribed = false;
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
          pollInterval.current = undefined;
        }
      };
    }
  }, [batchId, allUploadsComplete, onUploadComplete]);

  const totalPages = Math.ceil(fileProgresses.size / ITEMS_PER_PAGE);
  const paginatedFiles = Array.from(fileProgresses.values()).slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const processNextInQueue = useCallback(async () => {
    if (
      activeUploads >= MAX_CONCURRENT_UPLOADS ||
      uploadQueue.current.length === 0
    ) {
      if (
        uploadQueue.current.length === 0 &&
        activeUploads === 0 &&
        totalUploaded.current > 0
      ) {
        // Don't set complete here, let the status polling handle it
        totalUploaded.current = 0;
      }
      return;
    }

    const file = uploadQueue.current.shift();
    if (!file || !batchId) return;

    setActiveUploads((prev) => prev + 1);

    try {
      const formData = new FormData();
      formData.append("photos", file);
      formData.append("batchId", batchId.toString());

      setFileProgresses((prev) => {
        const newMap = new Map(prev);
        newMap.set(file.name, {
          name: file.name,
          progress: 0,
          status: "uploading",
          retries: 0,
          chunksUploaded: 0,
          totalChunks: Math.ceil(file.size / (maxChunkSize * 1024 * 1024)),
        });
        return newMap;
      });

      const response = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();
      totalUploaded.current++;

      // Update progress based on initial upload result
      setFileProgresses((prev) => {
        const newMap = new Map(prev);
        const current = newMap.get(file.name);
        if (current) {
          if (result.noCoordinates > 0) {
            newMap.set(file.name, {
              ...current,
              status: "no-coordinates",
              progress: 100,
              processingStatus: "No GPS coordinates found",
            });
          } else {
            newMap.set(file.name, {
              ...current,
              status: "processing",
              progress: 100,
              processingStatus: "Processing...",
            });
          }
        }
        return newMap;
      });
    } catch (error) {
      console.error("Upload error:", error);
      setFileProgresses((prev) => {
        const newMap = new Map(prev);
        const current = newMap.get(file.name);
        if (current) {
          newMap.set(file.name, {
            ...current,
            status: "error",
            progress: 0,
            error: error instanceof Error ? error.message : "Upload failed",
          });
        }
        return newMap;
      });
    } finally {
      setActiveUploads((prev) => prev - 1);
      processNextInQueue();
    }
  }, [batchId, maxChunkSize]);

  const processFiles = useCallback(
    (files: FileList) => {
      if (!batchId) {
        onShowBatchForm();
        return;
      }

      const fileList = Array.from(files);
      const validFiles = fileList.filter((file) => {
        if (!file.type.startsWith("image/")) {
          toast({
            variant: "destructive",
            title: "Invalid file type",
            description: `${file.name} is not an image file`,
          });
          return false;
        }

        if (file.size > maxFileSize * 1024 * 1024) {
          toast({
            variant: "destructive",
            title: "File too large",
            description: `${file.name} exceeds the maximum file size of ${maxFileSize}MB`,
          });
          return false;
        }

        return true;
      });

      if (validFiles.length === 0) return;

      // Reset completion state when starting new uploads
      setAllUploadsComplete(false);

      // Add valid files to the upload queue
      uploadQueue.current.push(...validFiles);

      // Initialize progress tracking
      validFiles.forEach((file) => {
        setFileProgresses((prev) => {
          const newMap = new Map(prev);
          newMap.set(file.name, {
            name: file.name,
            progress: 0,
            status: "pending",
            retries: 0,
            chunksUploaded: 0,
            totalChunks: Math.ceil(file.size / (maxChunkSize * 1024 * 1024)),
          });
          return newMap;
        });
      });

      // Start processing the queue
      for (let i = 0; i < MAX_CONCURRENT_UPLOADS; i++) {
        processNextInQueue();
      }
    },
    [
      batchId,
      maxFileSize,
      maxChunkSize,
      onShowBatchForm,
      processNextInQueue,
      toast,
    ]
  );

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    if (!batchId) {
      onShowBatchForm();
      return;
    }

    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (!batchId) {
      onShowBatchForm();
      return;
    }

    if (e.target.files?.length) {
      processFiles(e.target.files);
    }
  };

  const handleUploadClick = () => {
    if (!batchId) {
      onShowBatchForm();
      return;
    }

    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "done":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      case "no-coordinates":
        return "bg-yellow-500";
      case "uploading":
      case "processing":
        return "bg-blue-500";
      default:
        return "bg-gray-300";
    }
  };

  const getStatusText = (file: FileUploadProgress) => {
    switch (file.status) {
      case "pending":
        return "Waiting...";
      case "uploading":
        return `Uploading... ${Math.round(file.progress)}%`;
      case "processing":
        return Math.round(file.progress) === 100 ? "Uploaded" : "Processing...";
      case "done":
        return "Complete";
      case "no-coordinates":
        return "No GPS Data";
      case "error":
        return file.error || "Failed";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div
            ref={dropZoneRef}
            className={`
              relative rounded-lg border-2 border-dashed p-6 transition-colors max-h-[600px] overflow-auto
              ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25"
              }
              ${
                disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer hover:border-primary/50"
              }
            `}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleUploadClick}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              disabled={disabled || allUploadsComplete}
            />

            <div className="flex flex-col items-center justify-center space-y-2 text-center">
              <div className="rounded-full bg-background p-2.5 shadow-sm">
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-sm">
                <span className="font-semibold text-foreground">
                  Click to upload
                </span>{" "}
                <span className="text-muted-foreground">or drag and drop</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {!batchId
                  ? "Click to create a new scan batch"
                  : `Image files up to ${maxFileSize}MB`}
              </p>
            </div>

            {fileProgresses.size > 0 && (
              <div className="mt-4 space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm text-muted-foreground">
                    {uploadStatus && (
                      <div className="flex gap-2">
                        <Badge variant="outline">
                          Total: {uploadStatus.total}
                        </Badge>
                        <Badge variant="default" className="bg-green-500">
                          Processed: {uploadStatus.processed}
                        </Badge>
                        {uploadStatus.noCoordinates > 0 && (
                          <Badge variant="secondary" className="bg-yellow-500">
                            No GPS: {uploadStatus.noCoordinates}
                          </Badge>
                        )}
                        {uploadStatus.failed > 0 && (
                          <Badge variant="destructive">
                            Failed: {uploadStatus.failed}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {paginatedFiles.map((file) => (
                    <div key={file.name} className="relative">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex-1">
                          <span className="text-sm font-medium truncate max-w-[200px] block">
                            {file.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {getStatusText(file)}
                          </span>
                          {file.status === "error" && (
                            <div className="flex items-center gap-1 text-xs text-destructive">
                              <AlertCircle className="h-3 w-3" />
                              {file.error}
                            </div>
                          )}
                          {file.status === "no-coordinates" && (
                            <div className="flex items-center gap-1 text-xs text-yellow-600">
                              <MapPin className="h-3 w-3" />
                              No GPS coordinates found
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground ml-2">
                          {Math.round(file.progress)}%
                        </span>
                      </div>
                      <Progress
                        value={file.progress}
                        className={`h-1 ${getStatusColor(file.status)}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uploading && !allUploadsComplete && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
                <div className="w-full max-w-sm space-y-2 p-4">
                  <Progress value={progress} className="w-full" />
                  <p className="text-sm text-center text-muted-foreground">
                    Uploading... {Math.round(progress)}%
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Failed Uploads Dialog */}
      <Dialog open={showFailedDialog} onOpenChange={setShowFailedDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Failed Uploads</DialogTitle>
            <DialogDescription>
              The following files failed to upload:
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[300px] mt-4">
            <div className="space-y-2">
              {failedUploads.map((failure, index) => (
                <div key={index} className="text-sm space-y-1">
                  <p className="font-medium">{failure.fileName}</p>
                  <p className="text-destructive text-xs">{failure.error}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="mt-4 flex justify-between items-center">
            <Button
              variant="outline"
              onClick={() => {
                // Generate the content for the file
                const content = failedUploads
                  .map(
                    (failure) =>
                      `File: ${failure.fileName}\nError: ${failure.error}\n`
                  )
                  .join("\n");

                // Create a blob and download link
                const blob = new Blob([content], { type: "text/plain" });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "failed_uploads.txt";

                // Trigger download and cleanup
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download Failed List
            </Button>
            <Button onClick={() => setShowFailedDialog(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* No Coordinates Dialog */}
      <Dialog
        open={showNoCoordinatesDialog}
        onOpenChange={setShowNoCoordinatesDialog}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Photos Without GPS Data</DialogTitle>
            <DialogDescription>
              The following photos were uploaded but don't contain GPS
              coordinates:
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[300px] mt-4">
            <div className="space-y-2">
              {noCoordinatesFiles.map((filename, index) => (
                <div key={index} className="text-sm space-y-1">
                  <p className="font-medium">{filename}</p>
                  <p className="text-yellow-600 text-xs">
                    This photo will need to be manually assigned to a property
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setShowNoCoordinatesDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pagination */}
      {fileProgresses.size > 0 && totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentPage((p) => Math.max(1, p - 1));
            }}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground py-2">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentPage((p) => Math.min(totalPages, p + 1));
            }}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
