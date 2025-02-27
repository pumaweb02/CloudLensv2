import type { KonvaEventObject } from 'konva/types/Node';
import type Konva from 'konva';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  ArrowRight,
  X,
  Save,
  CircleIcon,
  Type,
  Move,
  Undo,
  Redo,
  Square,
  PencilLine,
  Eye,
  RotateCw,
  RotateCcw,
} from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Circle, Text, Line, Rect, Transformer } from "react-konva";

// Improve type definitions
interface Annotation {
  id: string;
  type: "circle" | "text" | "sketch" | "rectangle" | "blur";
  x: number;
  y: number;
  radius?: number;
  text?: string;
  color: string;
  points?: number[][];
  width?: number;
  height?: number;
  damageType: "wind" | "hail" | "other" | "none";
  severity: "low" | "medium" | "high";
}

interface AnnotationTransformer {
  id: string;
  type: "circle" | "text" | "sketch" | "rectangle" | "blur";
  x: number;
  y: number;
  radius?: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
}

// Configuration object remains unchanged
const damageTypeConfig = {
  wind: {
    color: "#4444ff",
    tools: ["circle", "sketch", "text", "rectangle", "blur"],
  },
  hail: {
    color: "#ff4444",
    tools: ["circle", "sketch", "text", "rectangle", "blur"],
  },
  other: {
    color: "#ffaa00",
    tools: ["circle", "sketch", "text", "rectangle", "blur"],
  },
  none: {
    color: "#666666",
    tools: ["circle", "sketch", "text", "rectangle", "blur"],
  },
} as const;

interface PhotoViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  annotations?: Annotation[];
  onSaveInspection: (annotations: Annotation[]) => Promise<void>;
  onNext?: () => void;
  onPrev?: () => void;
  canGoNext?: boolean;
  canGoPrev?: boolean;
  currentIndex?: number;
  totalPhotos?: number;
  initialDamageType?: "wind" | "hail" | "other" | "none";
  initialSeverity?: "low" | "medium" | "high";
  initialNotes?: string;
}

export function PhotoViewer({
  open,
  onOpenChange,
  imageUrl,
  annotations: initialAnnotations = [],
  onSaveInspection,
  onNext,
  onPrev,
  canGoNext,
  canGoPrev,
  currentIndex,
  totalPhotos,
  initialDamageType = "none",
  initialSeverity = "low",
  initialNotes = "",
}: PhotoViewerProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations.map((ann, i) => ({...ann, id: `annotation-${i}`})));
  const [tool, setTool] = useState<"circle" | "text" | "move" | "sketch" | "rectangle" | "blur">("move");
  const [textInput, setTextInput] = useState("");
  const [currentLine, setCurrentLine] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<Annotation[][]>([initialAnnotations]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [selectedShape, setSelectedShape] = useState<AnnotationTransformer | null>(null);
  const [currentDamageType, setCurrentDamageType] = useState<"wind" | "hail" | "other" | "none">(initialDamageType);
  const [currentSeverity, setCurrentSeverity] = useState<"low" | "medium" | "high">(initialSeverity);
  const stageRef = useRef<any>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const shapeRefs = useRef<Map<string, any>>(new Map());

  // Improved form validation schema
  const inspectionSchema = z.object({
    notes: z.string().min(1, "Notes are required"),
    damageType: z.enum(["wind", "hail", "other", "none"], {
      required_error: "Please select a damage type",
    }),
    severity: z.enum(["low", "medium", "high"], {
      required_error: "Please select damage severity",
    }),
  });

  type InspectionFormData = z.infer<typeof inspectionSchema>;

  const form = useForm<InspectionFormData>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
      notes: initialNotes,
      damageType: initialDamageType,
      severity: initialSeverity,
    },
  });

  useEffect(() => {
    if (selectedShape && transformerRef.current && stageRef.current) {
      const node = shapeRefs.current.get(selectedShape.id);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedShape]);

  useEffect(() => {
    setAnnotations(initialAnnotations.map((ann, i) => ({
      ...ann,
      color: damageTypeConfig[ann.damageType || initialDamageType].color,
      id: `annotation-${i}`,
    })));
    setHistory([initialAnnotations]);
    setHistoryIndex(0);
  }, [initialAnnotations, initialDamageType]);

  useEffect(() => {
    setCurrentDamageType(initialDamageType);
    setCurrentSeverity(initialSeverity);
  }, [initialDamageType, initialSeverity]);

  useEffect(() => {
    if (imageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;
      img.onload = () => {
        setImage(img);
        const containerWidth = 800;
        const containerHeight = 600;
        const scale = Math.min(
          containerWidth / img.width,
          containerHeight / img.height
        );
        setScale(scale);
      };
    }
  }, [imageUrl]);

  const handleRotate = (direction: 'clockwise' | 'counterclockwise') => {
    setRotation(prev => {
      const change = direction === 'clockwise' ? 90 : -90;
      return (prev + change + 360) % 360;
    });
  };

  // Improved onSubmit handler with proper error handling
  const onSubmit = async (data: InspectionFormData) => {
    try {
      const updatedAnnotations = annotations.map(ann => ({
        ...ann,
        damageType: data.damageType,
        severity: data.severity,
        color: damageTypeConfig[data.damageType].color
      }));

      setCurrentDamageType(data.damageType);
      setCurrentSeverity(data.severity);

      await onSaveInspection(updatedAnnotations);
    } catch (error) {
      console.error('Error saving inspection:', error);
      // Handle error appropriately (e.g., show toast message)
    }
  };

  const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
    if (tool === "move") {
      const clickedOnEmpty = e.target === e.target.getStage();
      if (clickedOnEmpty) {
        setSelectedShape(null);
        return;
      }

      const id = e.target.id();
      const annotation = annotations.find(a => a.id === id);
      if (annotation) {
        setSelectedShape({
          id,
          type: annotation.type,
          x: annotation.x,
          y: annotation.y,
          radius: annotation.radius,
          width: annotation.width,
          height: annotation.height,
        });
      }
      return;
    }

    const stage = e.target.getStage();
    if (!stage) return;

    const point = stage.getPointerPosition();
    if (!point) return;

    const { x, y } = point;

    let newAnnotation: Annotation | null = null;

    switch (tool) {
      case "circle":
        newAnnotation = {
          id: `annotation-${annotations.length}`,
          type: "circle",
          x: x / scale,
          y: y / scale,
          radius: 20,
          color: damageTypeConfig[currentDamageType].color,
          damageType: currentDamageType,
          severity: currentSeverity,
        };
        break;
      case "rectangle":
        newAnnotation = {
          id: `annotation-${annotations.length}`,
          type: "rectangle",
          x: x / scale,
          y: y / scale,
          width: 40,
          height: 40,
          color: damageTypeConfig[currentDamageType].color,
          damageType: currentDamageType,
          severity: currentSeverity,
        };
        break;
      case "text":
        if (textInput.trim()) {
          newAnnotation = {
            id: `annotation-${annotations.length}`,
            type: "text",
            x: x / scale,
            y: y / scale,
            text: textInput,
            color: damageTypeConfig[currentDamageType].color,
            damageType: currentDamageType,
            severity: currentSeverity,
          };
          setTextInput("");
        }
        break;
      case "sketch":
        setIsDrawing(true);
        setCurrentLine([x / scale, y / scale]);
        break;
      case "blur":
        newAnnotation = {
          id: `annotation-${annotations.length}`,
          type: "blur",
          x: x / scale,
          y: y / scale,
          width: 80,
          height: 80,
          color: "rgba(200, 200, 200, 0.9)",
          damageType: currentDamageType,
          severity: currentSeverity,
        };
        break;
    }

    if (newAnnotation) {
      const newAnnotations = [...annotations, newAnnotation];
      setAnnotations(newAnnotations);
      addToHistory(newAnnotations);
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing) return;

    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    setCurrentLine(prev => [...prev, point.x / scale, point.y / scale]);
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;

    setIsDrawing(false);
    if (currentLine.length >= 4) {
      const points: number[][] = [];
      for (let i = 0; i < currentLine.length; i += 2) {
        points.push([currentLine[i], currentLine[i + 1]]);
      }

      const newAnnotation: Annotation = {
        id: `annotation-${annotations.length}`,
        type: "sketch",
        x: 0,
        y: 0,
        points: points,
        color: damageTypeConfig[currentDamageType].color,
        damageType: currentDamageType,
        severity: currentSeverity,
      };
      const newAnnotations = [...annotations, newAnnotation];
      setAnnotations(newAnnotations);
      addToHistory(newAnnotations);
    }
    setCurrentLine([]);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setAnnotations(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setAnnotations(history[historyIndex + 1]);
    }
  };

  const addToHistory = (newAnnotations: Annotation[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...newAnnotations]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };


  const config = damageTypeConfig[currentDamageType];
  const availableTools = config.tools;

  const addShapeRef = useCallback((id: string, ref: any) => {
    shapeRefs.current.set(id, ref);
  }, []);

  // Improved shape selection handler
  const handleSelect = useCallback((shape: AnnotationTransformer | null) => {
    setSelectedShape(shape);

    if (shape && transformerRef.current) {
      const node = shapeRefs.current.get(shape.id);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, []);

  const handleDelete = useCallback((shapeId: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== shapeId));
    handleSelect(null);
  }, []);

  const handleTransform = useCallback((e: KonvaEventObject<Event>) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    node.scaleX(1);
    node.scaleY(1);

    const shape = annotations.find(a => a.id === node.id());

    if (shape && node.getType() === 'Circle') {
      shape.radius = (shape.radius || 20) * Math.max(scaleX, scaleY);
    } else if (shape && node.getType() === 'Rect') {
      shape.width = Math.abs((shape.width || 40) * scaleX);
      shape.height = Math.abs((shape.height || 40) * scaleY);
    }
    setAnnotations([...annotations]);
  }, [annotations]);


  const handleDragEnd = useCallback((e: KonvaEventObject<DragEvent>, id: string) => {
    const shape = e.target;
    const updatedAnnotations = annotations.map(ann => {
      if (ann.id === id) {
        return {
          ...ann,
          x: shape.x() / scale,
          y: shape.y() / scale,
        };
      }
      return ann;
    });
    setAnnotations(updatedAnnotations);
  }, [annotations, scale]);

  const renderAnnotations = useCallback(() => {
    return annotations.map((annotation, i) => {
      const id = annotation.id;
      const commonProps = {
        id,
        key: id,
        onClick: () => handleSelect({ id, ...annotation }),
        onTap: () => handleSelect({ id, ...annotation }),
        draggable: tool === "move",
        onDragEnd: (e: KonvaEventObject<DragEvent>) => handleDragEnd(e, id),
        onTransformEnd: handleTransform,
        ref: (node: any) => addShapeRef(id, node),
      };

      switch (annotation.type) {
        case "circle":
          return (
            <Circle
              {...commonProps}
              x={annotation.x * scale}
              y={annotation.y * scale}
              radius={(annotation.radius || 20) * scale}
              stroke={annotation.color}
              strokeWidth={2}
            />
          );
        case "rectangle":
          return (
            <Rect
              {...commonProps}
              x={annotation.x * scale}
              y={annotation.y * scale}
              width={(annotation.width || 40) * scale}
              height={(annotation.height || 40) * scale}
              stroke={annotation.color}
              strokeWidth={2}
            />
          );
        case "text":
          return (
            <Text
              {...commonProps}
              x={annotation.x * scale}
              y={annotation.y * scale}
              text={annotation.text || ""}
              fill={annotation.color}
              fontSize={16 * scale}
            />
          );
        case "sketch":
          return (
            <Line
              {...commonProps}
              points={annotation.points?.flat().map(p => p * scale)}
              stroke={annotation.color}
              strokeWidth={2}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
            />
          );
        case "blur":
          return (
            <Rect
              {...commonProps}
              x={annotation.x * scale}
              y={annotation.y * scale}
              width={(annotation.width || 80) * scale}
              height={(annotation.height || 80) * scale}
              fill={annotation.color}
              opacity={0.8}
            />
          );
        default:
          return null;
      }
    });
  }, [annotations, scale, tool, handleSelect, handleDragEnd, handleTransform, addShapeRef]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-6 overflow-y-auto">
        <DialogTitle className="sr-only">Photo Inspection</DialogTitle>
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button
                variant={tool === "move" ? "default" : "outline"}
                onClick={() => setTool("move")}
                size="sm"
              >
                <Move className="w-4 h-4 mr-2" />
                Move
              </Button>
              {availableTools.includes("circle") && (
                <Button
                  variant={tool === "circle" ? "default" : "outline"}
                  onClick={() => setTool("circle")}
                  size="sm"
                >
                  <CircleIcon className="w-4 h-4 mr-2" />
                  Circle
                </Button>
              )}
              {availableTools.includes("rectangle") && (
                <Button
                  variant={tool === "rectangle" ? "default" : "outline"}
                  onClick={() => setTool("rectangle")}
                  size="sm"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Rectangle
                </Button>
              )}
              {availableTools.includes("sketch") && (
                <Button
                  variant={tool === "sketch" ? "default" : "outline"}
                  onClick={() => setTool("sketch")}
                  size="sm"
                >
                  <PencilLine className="w-4 h-4 mr-2" />
                  Sketch
                </Button>
              )}
              {availableTools.includes("text") && (
                <Button
                  variant={tool === "text" ? "default" : "outline"}
                  onClick={() => setTool("text")}
                  size="sm"
                >
                  <Type className="w-4 h-4 mr-2" />
                  Text
                </Button>
              )}
              {availableTools.includes("blur") && (
                <Button
                  variant={tool === "blur" ? "default" : "outline"}
                  onClick={() => setTool("blur")}
                  size="sm"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Blur
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => handleRotate('counterclockwise')}
                size="sm"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => handleRotate('clockwise')}
                size="sm"
              >
                <RotateCw className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-4">
              {currentIndex !== undefined && totalPhotos !== undefined && (
                <span className="text-sm text-muted-foreground">
                  Photo {currentIndex + 1} of {totalPhotos}
                </span>
              )}
              <div className="space-x-2">
                <Button variant="outline" onClick={undo} disabled={historyIndex === 0} size="sm">
                  <Undo className="w-4 h-4" />
                </Button>
                <Button variant="outline" onClick={redo} disabled={historyIndex === history.length - 1} size="sm">
                  <Redo className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onPrev} disabled={!canGoPrev}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
                <Button variant="outline" onClick={onNext} disabled={!canGoNext}>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {tool === "text" && (
            <div className="mb-4">
              <Textarea
                placeholder="Enter text annotation..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="h-20"
              />
            </div>
          )}

          <div className="flex-1 border rounded-lg overflow-hidden bg-background">
            <div className="relative w-full h-[600px]">
              {image && (
                <Stage
                  ref={stageRef}
                  width={800}
                  height={600}
                  onClick={handleStageClick}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  draggable={tool === "move"}
                  style={{ backgroundColor: '#f5f5f5' }}
                >
                  <Layer>
                    <KonvaImage
                      image={image}
                      width={image.width * scale}
                      height={image.height * scale}
                      x={(800 - image.width * scale) / 2}
                      y={(600 - image.height * scale) / 2}
                      rotation={rotation}
                      offsetX={image.width / 2}
                      offsetY={image.height / 2}
                    />
                    {renderAnnotations()}
                    {isDrawing && currentLine.length >= 4 && (
                      <Line
                        points={currentLine.map(p => p * scale)}
                        stroke={damageTypeConfig[currentDamageType].color}
                        strokeWidth={2}
                        tension={0.5}
                        lineCap="round"
                        lineJoin="round"
                      />
                    )}
                    <Transformer
                      ref={transformerRef}
                      boundBoxFunc={(oldBox, newBox) => {
                        // Limit resize
                        if (newBox.width < 5 || newBox.height < 5) {
                          return oldBox;
                        }
                        return newBox;
                      }}
                      enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                      rotateEnabled={false}
                      borderDash={[2, 2]}
                    />
                  </Layer>
                </Stage>
              )}
            </div>
          </div>

          {selectedShape && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDelete(selectedShape.id)}
              className="absolute top-4 right-4 z-50"
            >
              <X className="w-4 h-4 mr-2" />
              Delete Shape
            </Button>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="damageType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Damage Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select damage type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wind">Wind</SelectItem>
                          <SelectItem value="hail">Hail</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="severity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Severity</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select severity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <Textarea {...field} placeholder="Enter inspection notes..." />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">
                <Save className="w-4 h-4 mr-2" />
                Save Inspection
              </Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PhotoViewer;