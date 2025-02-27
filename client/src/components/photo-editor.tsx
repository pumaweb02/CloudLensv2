import { useState, useRef, useEffect } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Stage, Layer, Image as KonvaImage, Circle, Text, Line, Rect, Transformer } from "react-konva";
import { Button } from "@/components/ui/button";
import html2canvas from 'html2canvas';
import {
  Move,
  CircleIcon,
  Type,
  Square,
  PencilLine,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Crop,
  MousePointer2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Annotation {
  id: string;
  type: "circle" | "text" | "sketch" | "rectangle" | "crop";
  x: number;
  y: number;
  radius?: number;
  text?: string;
  color: string;
  points?: number[];
  width?: number;
  height?: number;
}

interface PhotoEditorProps {
  imageUrl: string;
  onSave: (annotations: Annotation[], capturedImage?: string, zoomLevel?: number) => void;
  initialAnnotations?: Annotation[];
  damageType: string;
  severity: string;
  onNext?: () => void;
  onPrev?: () => void;
  canGoNext?: boolean;
  canGoPrev?: boolean;
}

export function PhotoEditor({
  imageUrl,
  onSave,
  initialAnnotations = [],
  damageType,
  severity,
  onNext,
  onPrev,
  canGoNext,
  canGoPrev,
}: PhotoEditorProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [tool, setTool] = useState<"select" | "circle" | "text" | "sketch" | "rectangle" | "crop">("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentLine, setCurrentLine] = useState<number[]>([]);
  const [textInput, setTextInput] = useState("");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isCropping, setIsCropping] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Update image loading and error handling
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;

    img.onload = () => {
      console.log('Image loaded successfully:', imageUrl);
      setImage(img);
      if (containerRef.current) {
        const container = containerRef.current;
        const padding = 40;
        const maxWidth = container.clientWidth - padding * 2;
        const maxHeight = container.clientHeight - padding * 2;
        const imageRatio = img.width / img.height;
        const containerRatio = maxWidth / maxHeight;

        let width, height;
        if (imageRatio > containerRatio) {
          width = maxWidth;
          height = width / imageRatio;
        } else {
          height = maxHeight;
          width = height * imageRatio;
        }

        setStageSize({ width, height });
      }
    };

    img.onerror = (error) => {
      console.error('Error loading image:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load image. Please try again.",
      });
    };

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl, toast]);

  // Handle transformer updates
  useEffect(() => {
    if (selectedId && transformerRef.current && stageRef.current) {
      const node = stageRef.current.findOne('#' + selectedId);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    }
  }, [selectedId]);

  const captureStageContent = async () => {
    if (!stageContainerRef.current) return null;

    try {
      setIsCapturing(true);
      const canvas = await html2canvas(stageContainerRef.current, {
        useCORS: true,
        allowTaint: true,
        logging: true,
        scale: 2, // Higher quality
        width: stageSize.width,
        height: stageSize.height,
        x: 0,
        y: 0,
      });

      return canvas.toDataURL('image/jpeg', 0.95);
    } catch (error) {
      console.error('Error capturing stage content:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to capture annotations. Please try again.",
      });
      return null;
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSave = async () => {
    try {
      const capturedImage = await captureStageContent();
      onSave(annotations, capturedImage, zoomLevel);

      toast({
        title: "Success",
        description: "Changes saved successfully",
      });
    } catch (error) {
      console.error('Error saving changes:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save changes. Please try again.",
      });
    }
  };

  const handleStageClick = (e: any) => {
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      setSelectedId(null);
      return;
    }

    if (tool === "select") {
      const clickedId = e.target.id();
      setSelectedId(clickedId === selectedId ? null : clickedId);
      return;
    }

    const stage = e.target.getStage();
    const point = stage.getRelativePointerPosition();
    const id = `annotation-${Date.now()}`;

    let newAnnotation: Annotation | null = null;
    switch (tool) {
      case "circle":
        newAnnotation = {
          id,
          type: "circle",
          x: point.x,
          y: point.y,
          radius: 30,
          color: damageType === "wind" ? "#4444ff" :
            damageType === "hail" ? "#ff4444" : "#ffaa00",
        };
        break;
      case "rectangle":
        newAnnotation = {
          id,
          type: "rectangle",
          x: point.x,
          y: point.y,
          width: 100,
          height: 100,
          color: "#4444ff",
        };
        break;
      case "crop":
        if (!isCropping) {
          newAnnotation = {
            id,
            type: "crop",
            x: point.x,
            y: point.y,
            width: stageSize.width / 3,
            height: stageSize.height / 3,
            color: "#00ff00",
          };
          setIsCropping(true);
        }
        break;
      case "text":
        if (textInput.trim()) {
          newAnnotation = {
            id,
            type: "text",
            x: point.x,
            y: point.y,
            text: textInput,
            color: "#000000",
          };
          setTextInput("");
        }
        break;
    }

    if (newAnnotation) {
      setAnnotations(prev => [...prev, newAnnotation!]);
      setSelectedId(id);
    }
  };

  // Drawing handlers
  const handleMouseDown = (e: any) => {
    if (tool !== "sketch") return;

    setIsDrawing(true);
    const stage = e.target.getStage();
    const point = stage.getRelativePointerPosition();
    setCurrentLine([point.x, point.y]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing || tool !== "sketch") return;

    const stage = e.target.getStage();
    const point = stage.getRelativePointerPosition();
    setCurrentLine(prev => [...prev, point.x, point.y]);
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentLine.length >= 4) {
      const id = `annotation-${Date.now()}`;
      setAnnotations(prev => [...prev, {
        id,
        type: "sketch",
        x: 0,
        y: 0,
        points: currentLine,
        color: "#000000",
      }]);
      setSelectedId(id);
    }
    setCurrentLine([]);
  };

  const handleTransformEnd = (e: any) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    node.scaleX(1);
    node.scaleY(1);

    const id = node.id();
    setAnnotations(prev => prev.map(ann => {
      if (ann.id === id) {
        const newAnn = { ...ann };
        newAnn.x = node.x();
        newAnn.y = node.y();

        if (ann.type === "circle") {
          newAnn.radius = (ann.radius || 30) * Math.max(scaleX, scaleY);
        } else if (ann.type === "rectangle" || ann.type === "crop") {
          newAnn.width = (ann.width || 100) * scaleX;
          newAnn.height = (ann.height || 100) * scaleY;
        }
        return newAnn;
      }
      return ann;
    }));
  };

  const handleDelete = () => {
    if (selectedId) {
      const annotation = annotations.find(a => a.id === selectedId);
      if (annotation?.type === "crop") {
        setIsCropping(false);
      }
      setAnnotations(prev => prev.filter(a => a.id !== selectedId));
      setSelectedId(null);
    }
  };


  return (
    <div className="h-full flex flex-col" ref={containerRef}>
      <div className="p-4 border-b bg-background">
        <Tabs defaultValue="tools" className="w-full">
          <TabsList>
            <TabsTrigger value="tools">Drawing Tools</TabsTrigger>
            <TabsTrigger value="zoom">Zoom Controls</TabsTrigger>
          </TabsList>

          <TabsContent value="tools" className="mt-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={tool === "select" ? "default" : "outline"}
                size="sm"
                onClick={() => setTool("select")}
              >
                <MousePointer2 className="w-4 h-4 mr-2" />
                Select
              </Button>
              <Button
                variant={tool === "circle" ? "default" : "outline"}
                size="sm"
                onClick={() => setTool("circle")}
              >
                <CircleIcon className="w-4 h-4 mr-2" />
                Circle
              </Button>
              <Button
                variant={tool === "rectangle" ? "default" : "outline"}
                size="sm"
                onClick={() => setTool("rectangle")}
              >
                <Square className="w-4 h-4 mr-2" />
                Rectangle
              </Button>
              <Button
                variant={tool === "crop" ? "default" : "outline"}
                size="sm"
                onClick={() => setTool("crop")}
                disabled={isCropping}
              >
                <Crop className="w-4 h-4 mr-2" />
                Crop
              </Button>
              <Button
                variant={tool === "sketch" ? "default" : "outline"}
                size="sm"
                onClick={() => setTool("sketch")}
              >
                <PencilLine className="w-4 h-4 mr-2" />
                Sketch
              </Button>
              <Button
                variant={tool === "text" ? "default" : "outline"}
                size="sm"
                onClick={() => setTool("text")}
              >
                <Type className="w-4 h-4 mr-2" />
                Text
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="zoom" className="mt-2">
            <div className="flex items-center gap-2">
              <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={4}
                onZoom={({ state }) => setZoomLevel(state.scale)}
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => zoomIn()}
                    >
                      <ZoomIn className="w-4 h-4 mr-2" />
                      Zoom In
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => zoomOut()}
                    >
                      <ZoomOut className="w-4 h-4 mr-2" />
                      Zoom Out
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resetTransform()}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reset
                    </Button>
                    <div className="ml-2 text-sm text-muted-foreground">
                      Zoom: {Math.round(zoomLevel * 100)}%
                    </div>
                  </>
                )}
              </TransformWrapper>
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

      <div className="flex-1 relative overflow-hidden bg-muted">
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={4}
          onZoom={({ state }) => setZoomLevel(state.scale)}
        >
          <TransformComponent>
            <div ref={stageContainerRef}>
              <Stage
                ref={stageRef}
                width={stageSize.width}
                height={stageSize.height}
                onClick={handleStageClick}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <Layer>
                  {image && (
                    <KonvaImage
                      image={image}
                      width={stageSize.width}
                      height={stageSize.height}
                    />
                  )}

                  {annotations.map((ann) => {
                    const props = {
                      key: ann.id,
                      id: ann.id,
                      draggable: tool === "select",
                      onTransformEnd: handleTransformEnd,
                      stroke: ann.color,
                      strokeWidth: 2,
                    };

                    switch (ann.type) {
                      case "circle":
                        return (
                          <Circle
                            {...props}
                            x={ann.x}
                            y={ann.y}
                            radius={ann.radius || 30}
                          />
                        );
                      case "rectangle":
                      case "crop":
                        return (
                          <Rect
                            {...props}
                            x={ann.x}
                            y={ann.y}
                            width={ann.width || 100}
                            height={ann.height || 100}
                            dash={ann.type === "crop" ? [5, 5] : undefined}
                          />
                        );
                      case "text":
                        return (
                          <Text
                            {...props}
                            x={ann.x}
                            y={ann.y}
                            text={ann.text || ""}
                            fontSize={16}
                            fill={ann.color}
                          />
                        );
                      case "sketch":
                        return (
                          <Line
                            {...props}
                            points={ann.points}
                            tension={0.5}
                            lineCap="round"
                            lineJoin="round"
                          />
                        );
                      default:
                        return null;
                    }
                  })}

                  {isDrawing && (
                    <Line
                      points={currentLine}
                      stroke="#000000"
                      strokeWidth={2}
                      tension={0.5}
                      lineCap="round"
                      lineJoin="round"
                    />
                  )}

                  <Transformer
                    ref={transformerRef}
                    boundBoxFunc={(oldBox, newBox) => {
                      const minSize = 5;
                      if (newBox.width < minSize || newBox.height < minSize) {
                        return oldBox;
                      }
                      return newBox;
                    }}
                    anchorStroke="#000000"
                    anchorFill="#ffffff"
                    anchorSize={8}
                    borderStroke="#000000"
                    borderDash={[2, 2]}
                    rotateEnabled={false}
                    enabledAnchors={[
                      'top-left',
                      'top-right',
                      'bottom-left',
                      'bottom-right'
                    ]}
                    keepRatio={false}
                  />
                </Layer>
              </Stage>
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>

      <div className="absolute bottom-4 right-4 flex gap-2">
        {selectedId && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
          >
            <X className="w-4 h-4 mr-2" />
            Delete Shape
          </Button>
        )}

        <Button onClick={handleSave}>
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
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default PhotoEditor;