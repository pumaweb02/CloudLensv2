import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, ZoomIn, Download, Edit, PenTool, X, ZoomOut, RotateCcw } from "lucide-react";
import { Stage, Layer, Image as KonvaImage, Transformer, Rect } from 'react-konva';
import { useCallback, useEffect, useRef, useState } from 'react';
import Konva from 'konva';
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ImageAnnotator } from "./image-annotator";
import { compressImage, calculateCompressionQuality } from "@/lib/image-utils";

interface ImageViewerProps {
  src: string;
  alt: string;
  propertyId: number;
  photoId: number;
  filename: string;
  onDelete?: () => void;
  onSelect?: () => void;
  onAnnotate?: (data: { photoId: number; canvas: string; notes: string }) => void;
  existingAnnotation?: { canvas: string; notes: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageViewer({
  src,
  alt,
  propertyId,
  photoId,
  filename,
  onDelete,
  onSelect,
  onAnnotate,
  existingAnnotation,
  open,
  onOpenChange
}: ImageViewerProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const imageRef = useRef<Konva.Image>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      setImage(img);
      updateDimensions(img);
    };
  }, [src]);

  const updateDimensions = useCallback((img: HTMLImageElement) => {
    if (!containerRef.current) return;

    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    const imgRatio = img.width / img.height;
    const containerRatio = containerWidth / containerHeight;

    let width, height;
    if (imgRatio > containerRatio) {
      width = containerWidth * 0.9;
      height = width / imgRatio;
    } else {
      height = containerHeight * 0.9;
      width = height * imgRatio;
    }

    setDimensions({ width, height });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (image) {
        updateDimensions(image);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [image, updateDimensions]);

  const handleZoomIn = () => {
    setScale(s => Math.min(s + 0.1, 3));
  };

  const handleZoomOut = () => {
    setScale(s => Math.max(s - 0.1, 0.5));
  };

  const handleReset = () => {
    setScale(1);
  };

  const handleSelect = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      setSelectedId(null);
      return;
    }

    const id = e.target.id();
    if (id === selectedId) {
      setSelectedId(null);
    } else {
      setSelectedId(id);
    }
  };

  useEffect(() => {
    if (selectedId && transformerRef.current && stageRef.current) {
      const node = stageRef.current.findOne('#' + selectedId);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    }
  }, [selectedId]);

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/properties/${propertyId}/photos/${photoId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      await queryClient.invalidateQueries({
        queryKey: [`/api/properties/${propertyId}`],
      });

      toast({
        title: "Success",
        description: "Photo deleted successfully",
      });

      onOpenChange(false);
      onDelete?.();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete photo",
      });
    }
  };

  const handleCompressAndDownload = async () => {
    try {
      setIsProcessing(true);

      // Fetch the image
      const response = await fetch(src);
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();

      // Calculate appropriate compression quality based on file size
      const quality = calculateCompressionQuality(blob.size);

      // Compress the image
      const compressedBlob = await compressImage(
        new File([blob], filename, { type: blob.type }),
        1920,
        1080,
        quality
      );

      // Create download link
      const url = URL.createObjectURL(compressedBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `compressed_${filename}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: `Image compressed and downloaded (Quality: ${Math.round(quality * 100)}%)`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to process image",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnnotationSave = (data: { canvas: string; notes: string }) => {
    onAnnotate?.({
      photoId,
      ...data,
    });
    setIsAnnotating(false);
    toast({
      title: "Success",
      description: "Annotations saved successfully",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{filename}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={isProcessing}
                onClick={handleCompressAndDownload}
              >
                <Download className="h-4 w-4" />
              </Button>
              {onSelect && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    onSelect();
                    onOpenChange(false);
                    toast({
                      title: "Photo Selected",
                      description: "This photo has been selected for inspection.",
                    });
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {onAnnotate && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsAnnotating(!isAnnotating)}
                >
                  <PenTool className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
              </Button>

            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden relative" ref={containerRef}>
          {image && (
            <Stage
              ref={stageRef}
              width={dimensions.width}
              height={dimensions.height}
              scaleX={scale}
              scaleY={scale}
              onClick={handleSelect}
            >
              <Layer>
                <KonvaImage
                  ref={imageRef}
                  image={image}
                  width={dimensions.width}
                  height={dimensions.height}
                  x={0}
                  y={0}
                />
                {/* Add shapes here */}
                <Transformer
                  ref={transformerRef}
                  boundBoxFunc={(oldBox, newBox) => {
                    // Limit resize
                    if (newBox.width < 5 || newBox.height < 5) {
                      return oldBox;
                    }
                    return newBox;
                  }}
                  enabledAnchors={[
                    'top-left',
                    'top-right',
                    'bottom-left',
                    'bottom-right'
                  ]}
                  rotateEnabled={false}
                  borderDash={[2, 2]}
                  padding={5}
                />
              </Layer>
            </Stage>
          )}
          {isAnnotating ? (
            <ImageAnnotator
              src={src}
              onSave={handleAnnotationSave}
              defaultAnnotation={existingAnnotation?.canvas}
              defaultNotes={existingAnnotation?.notes}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}