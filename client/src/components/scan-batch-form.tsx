import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useUser } from "@/hooks/use-user";
import { UserSelect } from "./user-select";
import { DragDropUpload } from "@/components/drag-drop-upload";

const scanBatchSchema = z.object({
  name: z.string().min(1, "Batch name is required"),
  description: z.string(),
  flightDate: z.string().min(1, "Flight date is required"),
  userId: z.string().optional(),
});

type ScanBatchFormValues = z.infer<typeof scanBatchSchema>;

interface ScanBatchFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (batchId: number) => void;
}

export function ScanBatchForm({ open, onOpenChange, onSuccess }: ScanBatchFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useUser();

  const form = useForm<ScanBatchFormValues>({
    resolver: zodResolver(scanBatchSchema),
    defaultValues: {
      name: "",
      description: "",
      flightDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      userId: currentUser?.id.toString(),
    },
  });

  const createBatchMutation = useMutation({
    mutationFn: async (values: ScanBatchFormValues) => {
      console.log("Submitting batch creation with values:", values);
      const response = await fetch("/api/scan-batches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          ...values,
          userId: values.userId || currentUser?.id.toString(),
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create scan batch");
      }

      return await response.json();
    },
    onSuccess: (data) => {
      console.log("Batch creation successful:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/scan-batches"] });
      toast({
        title: "Success",
        description: "Scan batch created successfully",
      });
      setBatchId(data.id);
    },
    onError: (error) => {
      console.error("Batch creation error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create scan batch",
      });
    },
  });

  const onSubmit = async (values: ScanBatchFormValues) => {
    setIsSubmitting(true);
    try {
      await createBatchMutation.mutateAsync(values);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadComplete = () => {
    console.log("Upload complete, closing dialog...");
    setUploadComplete(true);
    setIsUploading(false);

    // Show success message
    toast({
      title: "Success",
      description: "All files uploaded successfully",
    });

    // Reset form and close dialog after a short delay
    setTimeout(() => {
      onOpenChange(false);
      setUploadComplete(false);
      setBatchId(null);
      setUploadProgress(0);
      form.reset();
    }, 1500);
  };

  const handleFilesSelected = async (files: FileList) => {
    console.log("Files selected:", files.length);
    setIsUploading(true);
    setUploadProgress(0);
  };

  // Reset states when dialog is closed
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setBatchId(null);
      setUploadComplete(false);
      setIsUploading(false);
      setUploadProgress(0);
      form.reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Scan Batch</DialogTitle>
          <DialogDescription>
            Create a new batch to organize your drone scan photos.
          </DialogDescription>
        </DialogHeader>

        {!batchId ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batch Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter batch name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter batch description"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="flightDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Flight Date</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {currentUser?.role === "admin" && (
                <UserSelect
                  control={form.control}
                  name="userId"
                  label="Upload on behalf of"
                />
              )}

              <div className="pt-4">
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Batch"}
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <DragDropUpload
            onFilesSelected={handleFilesSelected}
            uploading={isUploading}
            progress={uploadProgress}
            batchId={batchId}
            onUploadComplete={handleUploadComplete}
            disabled={uploadComplete}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}