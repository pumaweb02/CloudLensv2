import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Circle, Rect, Text, Line } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import { Button } from "@/components/ui/button";
import {
  Move, CircleIcon, Type, Square, PencilLine,
  ZoomIn, ZoomOut, RotateCcw, Save, ChevronLeft, X, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface KonvaPhotoEditorProps {
  imageUrl: string;
  onSave: (editedImageDataUrl: string, annotations: any[], lines: any[]) => Promise<boolean>;
  onPrev?: () => void;
  canGoPrev?: boolean;
  currentPhotoIndex?: number;
  totalPhotos?: number;
  damageType?: string;
  severity?: string;
  initialAnnotations?: any[];
  initialLines?: any[];
}

export function KonvaPhotoEditor({
  imageUrl,
  onSave,
  onPrev,
  canGoPrev,
  currentPhotoIndex,
  totalPhotos,
  damageType,
  severity,
  initialAnnotations = [],
  initialLines = []
}: KonvaPhotoEditorProps) {
  const [tool, setTool] = useState<"select" | "circle" | "text" | "rectangle" | "sketch">("select");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [annotations, setAnnotations] = useState<any[]>(initialAnnotations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lines, setLines] = useState<any[]>(initialLines);
  const [isDrawing, setIsDrawing] = useState(false);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const stageRef = useRef<Konva.Stage | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const cursorMap = {
    select: 'grab',
    circle: 'crosshair',
    rectangle: 'crosshair',
    text: 'text',
    sketch: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z\'/%3E%3Cpath d=\'m15 5 4 4\'/%3E%3C/svg%3E") 0 24, crosshair',
  } as const;

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      setStageSize({
        width: clientWidth,
        height: Math.max(600, clientHeight)
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.style.cursor = cursorMap[tool];
  }, [tool]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;

    img.onload = () => {
      setImage(img);
      setImageSize({
        width: img.width,
        height: img.height
      });
      setIsLoading(false);
      setStagePosition({ x: 0, y: 0 });
      setScale(1);
    };

    img.onerror = (error) => {
      console.error('Image load error:', error);
      setError(`Failed to load image: ${imageUrl}`);
      setIsLoading(false);
    };

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl]);

  const handlePointerDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (tool !== "sketch") return;

    const stage = stageRef.current;
    if (!stage) return;

    setIsDrawing(true);
    const pos = stage.getRelativePointerPosition();
    if (!pos) return;

    const newLine = {
      points: [pos.x, pos.y],
      stroke: damageType === "wind" ? "#4444ff" :
              damageType === "hail" ? "#ff4444" : "#ffaa00",
      strokeWidth: 2,
    };

    setLines([...lines, newLine]);
  };

  const handlePointerMove = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!isDrawing || tool !== "sketch") return;

    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getRelativePointerPosition();
    if (!pos) return;

    const lastLine = lines[lines.length - 1];
    if (!lastLine) return;

    // Create a new array with the updated points
    const newPoints = [...lastLine.points, pos.x, pos.y];

    // Update the last line with new points
    const updatedLines = [...lines.slice(0, -1), { ...lastLine, points: newPoints }];
    setLines(updatedLines);
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
  };

  const handleDragStart = () => {
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grabbing';
    }
  };

  const handleDragEnd = () => {
    if (containerRef.current) {
      containerRef.current.style.cursor = tool === 'select' ? 'grab' : cursorMap[tool];
    }
  };

  const addShape = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (tool === "select" || tool === "sketch") return;

    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getRelativePointerPosition();
    if (!pos) return;

    const color = damageType === "wind" ? "#4444ff" :
                 damageType === "hail" ? "#ff4444" : "#ffaa00";

    const newAnnotation = {
      id: Date.now().toString(),
      type: tool,
      x: pos.x,
      y: pos.y,
      width: tool === "rectangle" ? 100 : undefined,
      height: tool === "rectangle" ? 100 : undefined,
      radius: tool === "circle" ? 25 : undefined,
      text: tool === "text" ? textInput || "Double click to edit" : undefined,
      stroke: color,
      fill: "transparent",
      draggable: true
    };

    setAnnotations([...annotations, newAnnotation]);
    if (tool === "text") setTextInput("");
  };

  const handleStageClick = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const clickedOnEmpty = e.target === e.target.getStage();

    if (clickedOnEmpty) {
      setSelectedId(null);

      if (tool !== "select" && tool !== "sketch") {
        addShape(e);
      }
    }
  };

  const handleSave = async () => {
    if (!stageRef.current) {
      console.error('Stage ref is null');
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save - stage not ready",
      });
      return;
    }

    setIsLoading(true);
    try {
      const stage = stageRef.current;
      const dataUrl = stage.toDataURL({ pixelRatio: 2 });
      const success = await onSave(dataUrl, annotations, lines);

      if (success) {
        toast({
          title: "Success",
          description: currentPhotoIndex === (totalPhotos || 0) - 1 
            ? "Changes saved successfully" 
            : "Changes saved, proceeding to next photo",
        });
      } else {
        // Handle false return from onSave
        toast({
          variant: "destructive",
          title: "Warning",
          description: "Save operation completed but returned false",
        });
      }
    } catch (error) {
      console.error('Save error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save changes",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSelected = () => {
    setAnnotations(annotations.filter(ann => ann.id !== selectedId));
    setSelectedId(null);
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
                onClick={() => setTool("select")}
              >
                <Move className="w-4 h-4 mr-2" />
                Pan
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
              {selectedId && (
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
                onClick={() => setScale(s => Math.min(s * 1.1, 3))}
              >
                <ZoomIn className="w-4 h-4 mr-2" />
                Zoom In
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScale(s => Math.max(s / 1.1, 0.1))}
              >
                <ZoomOut className="w-4 h-4 mr-2" />
                Zoom Out
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setScale(1);
                  setStagePosition({ x: 0, y: 0 });
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              <div className="ml-2 text-sm text-muted-foreground">
                Zoom: {Math.round(scale * 100)}%
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
        ref={containerRef}
        className="flex-1 relative bg-muted"
        style={{ minHeight: "600px" }}
      >
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center text-red-500">
            {error}
          </div>
        ) : (
          <Stage
            ref={stageRef}
            width={stageSize.width}
            height={stageSize.height}
            scale={{ x: scale, y: scale }}
            position={stagePosition}
            draggable={tool === "select"}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragMove={(e) => {
              setStagePosition(e.target.position());
            }}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            onClick={handleStageClick}
          >
            <Layer>
              {image && (
                <KonvaImage
                  image={image}
                  width={stageSize.width}
                  height={stageSize.height}
                  listening={false}
                />
              )}
              {annotations.map((ann) => {
                const shapeProps = {
                  key: ann.id,
                  onClick: () => setSelectedId(ann.id),
                  onTap: () => setSelectedId(ann.id),
                  stroke: ann.stroke,
                  fill: ann.fill,
                  draggable: tool === "select",
                  strokeWidth: 2,
                };

                switch (ann.type) {
                  case "circle":
                    return (
                      <Circle
                        {...shapeProps}
                        x={ann.x}
                        y={ann.y}
                        radius={ann.radius}
                      />
                    );
                  case "rectangle":
                    return (
                      <Rect
                        {...shapeProps}
                        x={ann.x}
                        y={ann.y}
                        width={ann.width}
                        height={ann.height}
                      />
                    );
                  case "text":
                    return (
                      <Text
                        {...shapeProps}
                        x={ann.x}
                        y={ann.y}
                        text={ann.text}
                        fontSize={20}
                        fill={ann.stroke}
                      />
                    );
                  default:
                    return null;
                }
              })}
              {lines.map((line, i) => (
                <Line
                  key={i}
                  points={line.points}
                  stroke={line.stroke}
                  strokeWidth={line.strokeWidth || 2}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation="source-over"
                />
              ))}
            </Layer>
          </Stage>
        )}
      </div>

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
        {onPrev && (
          <Button
            variant="outline"
            size="sm"
            onClick={onPrev}
            disabled={!canGoPrev || isLoading}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
        )}
        <Button
          onClick={handleSave}
          className="min-w-[120px]"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {currentPhotoIndex === (totalPhotos || 0) - 1 ? 'Save' : `Save & Next (${currentPhotoIndex + 1}/${totalPhotos})`}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default KonvaPhotoEditor;