import { useEffect, useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Move, CircleIcon, Type, Square, PencilLine,
  ZoomIn, ZoomOut, RotateCcw, Save, ChevronLeft, ChevronRight,
  CropIcon, X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

// Import all required Fabric.js classes
import { Canvas, Circle as FabricCircle, Rect as FabricRect, Text as FabricText, Image as FabricImage, Point } from 'fabric';

interface FabricPhotoEditorProps {
  imageUrl: string;
  onSave: (editedImageDataUrl: string, annotations: any[]) => Promise<void>;
  onNext?: () => void;
  onPrev?: () => void;
  canGoNext?: boolean;
  canGoPrev?: boolean;
  currentPhotoIndex?: number;
  totalPhotos?: number;
  damageType: string;
  severity: string;
}

export function FabricPhotoEditor({
  imageUrl,
  onSave,
  onNext,
  onPrev,
  canGoNext,
  canGoPrev,
  currentPhotoIndex,
  totalPhotos,
  damageType,
  severity,
}: FabricPhotoEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const cropRectRef = useRef<FabricRect | null>(null);
  const [tool, setTool] = useState<"select" | "circle" | "text" | "rectangle" | "sketch" | "crop">("select");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [textInput, setTextInput] = useState("");
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);

  // Reset the canvas when changing photos
  useEffect(() => {
    if (fabricRef.current) {
      const canvas = fabricRef.current;
      canvas.isDrawingMode = false;
      setIsDrawingMode(false);
      setTool("select");

      const objects = canvas.getObjects();
      objects.forEach(obj => {
        if (obj.type !== 'image' && obj !== cropRectRef.current) {
          canvas.remove(obj);
        }
      });
      canvas.renderAll();
      setSelectedObject(null);
    }
  }, [currentPhotoIndex]);

  // Initialize canvas and load image
  useEffect(() => {
    let isMounted = true;

    // Cleanup function to properly dispose of the canvas
    const cleanup = () => {
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }
      cropRectRef.current = null;
    };

    const initializeEditor = async () => {
      if (!canvasRef.current) return;

      // Clean up any existing canvas
      cleanup();

      try {
        setIsLoading(true);
        setError(null);

        // Fixed dimensions for consistency
        const width = 800;
        const height = 600;

        // Initialize Fabric.js canvas with proper dimensions and settings
        const canvas = new Canvas(canvasRef.current, {
          width,
          height,
          backgroundColor: '#f5f5f5',
          preserveObjectStacking: true,
          isDrawingMode: false,
        });

        // Initialize drawing brush
        if (canvas.freeDrawingBrush) {
          canvas.freeDrawingBrush.width = 2;
          canvas.freeDrawingBrush.color = damageType === "wind" ? "#4444ff" :
                                       damageType === "hail" ? "#ff4444" : "#ffaa00";
        }

        // Setup selection events
        canvas.on('selection:created', (e: any) => {
          const selected = e.selected?.[0];
          if (selected && selected.type !== 'image' && selected !== cropRectRef.current) {
            setSelectedObject(selected);
            setTool('select');
          }
        });

        canvas.on('selection:cleared', () => {
          setSelectedObject(null);
        });

        // Mouse events for drawing mode
        canvas.on('mouse:down', () => {
          if (tool === 'sketch') {
            canvas.isDrawingMode = true;
          }
        });

        canvas.on('mouse:up', () => {
          if (tool !== 'sketch') {
            canvas.isDrawingMode = false;
          }
        });

        if (!isMounted) {
          cleanup();
          return;
        }

        fabricRef.current = canvas;

        // Create and load image
        const imgElement = new Image();
        imgElement.crossOrigin = "anonymous";

        imgElement.onload = () => {
          if (!isMounted || !canvas) {
            cleanup();
            return;
          }

          const fabricImage = new FabricImage(imgElement);

          // Scale to fit
          const scale = Math.min(
            (width - 40) / imgElement.width,
            (height - 40) / imgElement.height
          );

          fabricImage.scale(scale);

          // Center the image
          fabricImage.set({
            left: (width - imgElement.width * scale) / 2,
            top: (height - imgElement.height * scale) / 2,
            selectable: false,
            evented: false,
          });

          canvas.add(fabricImage);
          canvas.renderAll();

          // Add crop rectangle
          const imageWidth = imgElement.width * scale;
          const imageHeight = imgElement.height * scale;
          const cropRect = new FabricRect({
            left: (width - imageWidth * 0.8) / 2,
            top: (height - imageHeight * 0.8) / 2,
            width: imageWidth * 0.8,
            height: imageHeight * 0.8,
            fill: 'transparent',
            stroke: '#00ff00',
            strokeWidth: 2,
            strokeDashArray: [5, 5],
            cornerColor: '#00ff00',
            cornerStrokeColor: '#00ff00',
            cornerStyle: 'circle',
            transparentCorners: false,
            cornerSize: 10,
            hasRotatingPoint: false,
          });

          cropRectRef.current = cropRect;
          canvas.add(cropRect);
          canvas.renderAll();
          setIsLoading(false);
        };

        imgElement.onerror = () => {
          if (!isMounted) return;
          setError(`Failed to load image: ${imageUrl}`);
          setIsLoading(false);
          cleanup();
        };

        imgElement.src = imageUrl;

      } catch (error) {
        if (!isMounted) return;
        console.error('Editor initialization error:', error);
        setError(`Failed to initialize editor: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsLoading(false);
        cleanup();
      }
    };

    initializeEditor();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [imageUrl, damageType]);

  const handleZoom = (delta: number) => {
    if (!fabricRef.current) return;

    const canvas = fabricRef.current;
    let zoom = canvas.getZoom() * (1 + delta);
    zoom = Math.min(Math.max(0.1, zoom), 20);

    const center = new Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
    canvas.zoomToPoint(center, zoom);
    setZoomLevel(zoom);
    canvas.renderAll();
  };

  const handleDeleteSelected = () => {
    if (!fabricRef.current || !selectedObject) return;

    fabricRef.current.remove(selectedObject);
    setSelectedObject(null);
    fabricRef.current.renderAll();
  };

  const addShape = (e: React.MouseEvent) => {
    if (!fabricRef.current || tool === "select" || isLoading) return;
    if (tool === "sketch") return; // Don't add shapes while in sketch mode

    const canvas = fabricRef.current;
    const pointer = canvas.getPointer(e.nativeEvent);
    const color = damageType === "wind" ? "#4444ff" :
                 damageType === "hail" ? "#ff4444" : "#ffaa00";

    let obj;

    switch (tool) {
      case "circle":
        obj = new FabricCircle({
          left: pointer.x,
          top: pointer.y,
          radius: 30,
          stroke: color,
          strokeWidth: 2,
          fill: 'transparent'
        });
        break;

      case "rectangle":
        obj = new FabricRect({
          left: pointer.x,
          top: pointer.y,
          width: 100,
          height: 100,
          stroke: color,
          strokeWidth: 2,
          fill: 'transparent'
        });
        break;

      case "text":
        if (textInput.trim()) {
          obj = new FabricText(textInput, {
            left: pointer.x,
            top: pointer.y,
            fontSize: 20,
            fill: color
          });
          setTextInput("");
        }
        break;

      case "crop":
        if (cropRectRef.current) {
          canvas.setActiveObject(cropRectRef.current);
          canvas.renderAll();
        }
        return; // Exit early for crop mode
    }

    if (obj) {
      canvas.discardActiveObject();
      canvas.add(obj);
      canvas.setActiveObject(obj);
      setSelectedObject(obj);
      canvas.renderAll();
    }
  };

  const handleSave = async () => {
    if (!fabricRef.current) return;

    try {
      const canvas = fabricRef.current;

      // Get the crop rectangle dimensions
      const cropRect = cropRectRef.current;
      const dataUrl = canvas.toDataURL({
        format: 'jpeg',
        quality: 0.8,
        multiplier: 1,
        left: cropRect?.left || 0,
        top: cropRect?.top || 0,
        width: cropRect?.width || canvas.width,
        height: cropRect?.height || canvas.height
      });

      // Get all objects except image and crop rectangle
      const annotations = canvas.getObjects().filter(obj =>
        obj.type !== 'image' && obj !== cropRectRef.current
      ).map(obj => ({
        type: obj.type,
        left: obj.left,
        top: obj.top,
        width: obj.width,
        height: obj.height,
        radius: obj.type === 'circle' ? (obj as FabricCircle).radius : undefined,
        stroke: obj.stroke,
        fill: obj.fill,
        text: obj.type === 'text' ? (obj as FabricText).text : undefined,
      }));

      await onSave(dataUrl, annotations);

      toast({
        title: "Success",
        description: "Changes saved successfully",
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save changes",
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-background">
        <Tabs defaultValue="tools" className="w-full">
          <TabsList>
            <TabsTrigger value="tools">Drawing Tools</TabsTrigger>
            <TabsTrigger value="zoom">Zoom Controls</TabsTrigger>
          </TabsList>

          <TabsContent value="tools" className="mt-2">
            <div className="flex items-center gap-2">
              <Button
                variant={tool === "select" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setTool("select");
                  if (fabricRef.current) {
                    fabricRef.current.isDrawingMode = false;
                  }
                }}
              >
                <Move className="w-4 h-4 mr-2" />
                Select
              </Button>
              <Button
                variant={tool === "circle" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setTool("circle");
                  if (fabricRef.current) {
                    fabricRef.current.isDrawingMode = false;
                  }
                }}
              >
                <CircleIcon className="w-4 h-4 mr-2" />
                Circle
              </Button>
              <Button
                variant={tool === "rectangle" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setTool("rectangle");
                  if (fabricRef.current) {
                    fabricRef.current.isDrawingMode = false;
                  }
                }}
              >
                <Square className="w-4 h-4 mr-2" />
                Rectangle
              </Button>
              <Button
                variant={tool === "sketch" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setTool("sketch");
                  if (fabricRef.current) {
                    fabricRef.current.isDrawingMode = true;
                    if (fabricRef.current.freeDrawingBrush) {
                      fabricRef.current.freeDrawingBrush.width = 2;
                      fabricRef.current.freeDrawingBrush.color =
                        damageType === "wind" ? "#4444ff" :
                        damageType === "hail" ? "#ff4444" : "#ffaa00";
                    }
                  }
                }}
              >
                <PencilLine className="w-4 h-4 mr-2" />
                Sketch
              </Button>
              <Button
                variant={tool === "text" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setTool("text");
                  if (fabricRef.current) {
                    fabricRef.current.isDrawingMode = false;
                  }
                }}
              >
                <Type className="w-4 h-4 mr-2" />
                Text
              </Button>
              <Button
                variant={tool === "crop" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setTool("crop");
                  if (fabricRef.current) {
                    fabricRef.current.isDrawingMode = false;
                    if (cropRectRef.current) {
                      fabricRef.current.setActiveObject(cropRectRef.current);
                      fabricRef.current.renderAll();
                    }
                  }
                }}
              >
                <CropIcon className="w-4 h-4 mr-2" />
                Adjust Area
              </Button>
              {selectedObject && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSelected}
                >
                  <X className="w-4 h-4 mr-2" />
                  Delete Selected
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="zoom" className="mt-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleZoom(0.1)}
              >
                <ZoomIn className="w-4 h-4 mr-2" />
                Zoom In
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleZoom(-0.1)}
              >
                <ZoomOut className="w-4 h-4 mr-2" />
                Zoom Out
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (fabricRef.current) {
                    fabricRef.current.setZoom(1);
                    setZoomLevel(1);
                    fabricRef.current.renderAll();
                  }
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              <div className="ml-2 text-sm text-muted-foreground">
                Zoom: {Math.round(zoomLevel * 100)}%
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {tool === "text" && (
          <div className="mt-4">
            <input
              type="text"
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder="Enter text..."
              className="w-full max-w-sm px-3 py-2 border rounded-md"
            />
          </div>
        )}
      </div>

      <div
        className="flex-1 relative bg-muted overflow-hidden"
        onClick={tool !== "sketch" ? addShape : undefined}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <div className="text-center p-4 bg-white rounded-lg shadow-lg">
              <p className="text-red-500">{error}</p>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="mt-4"
              >
                Retry
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-4 right-4">
        <Button onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </div>

      {(onPrev || onNext) && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
          {onPrev && (
            <Button
              variant="outline"
              size="sm"
              onClick={onPrev}
              disabled={!canGoPrev}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
          )}
          {onNext && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNext}
              disabled={!canGoNext}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default FabricPhotoEditor;