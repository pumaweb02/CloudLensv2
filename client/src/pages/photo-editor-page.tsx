import { useLocation, useParams } from "wouter";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Stage, Layer, Image as KonvaImage, Circle, Text, Line, Rect, Transformer } from "react-konva";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ZoomIn,
  ZoomOut,
  Save,
  CircleIcon,
  Type,
  Move,
  Undo,
  Redo,
  PencilLine,
  Square,
  ChevronLeft,
  RotateCcw,
  Loader2,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

interface Annotation {
  id: string;
  type: "circle" | "text" | "sketch" | "rectangle";
  x: number;
  y: number;
  radius?: number;
  text?: string;
  color: string;
  points?: number[];
  width?: number;
  height?: number;
  selected?: boolean;
}

export function PhotoEditorPage() {
  const [, setLocation] = useLocation();
  const { photoId, id: propertyId } = useParams();
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [tool, setTool] = useState<"circle" | "text" | "move" | "sketch" | "rectangle">("move");
  const [color, setColor] = useState("#ff0000");
  const [textInput, setTextInput] = useState("");
  const [currentLine, setCurrentLine] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<Annotation[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0, scale: { x: 1, y: 1 } });
  const { toast } = useToast();
  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load image helper
  const loadImage = useCallback(async (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image"));
    });
  }, []);

  // Calculate dimensions helper
  const calculateDimensions = useCallback(() => {
    if (!image || !containerRef.current) return;

    const container = containerRef.current;
    const maxWidth = container.clientWidth * 0.95;
    const maxHeight = container.clientHeight * 0.95;

    const widthRatio = maxWidth / image.width;
    const heightRatio = maxHeight / image.height;
    const ratio = Math.min(widthRatio, heightRatio);

    setDimensions({
      width: image.width * ratio,
      height: image.height * ratio,
      scale: { x: ratio, y: ratio }
    });
  }, [image]);

  // Selection and Transform handling
  useEffect(() => {
    if (selectedId && transformerRef.current && stageRef.current) {
      const node = stageRef.current.findOne(`#${selectedId}`);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer().batchDraw();
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [selectedId]);

  // Handle stage click for shape selection and creation
  const handleStageClick = useCallback((e: any) => {
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      setSelectedId(null);
      return;
    }

    if (tool === "move") {
      const clickedId = e.target.id();
      setSelectedId(clickedId === selectedId ? null : clickedId);
      return;
    }

    const stage = e.target.getStage();
    const point = getRelativePointerPosition(stage);
    const { x, y } = point;

    const id = `annotation-${annotations.length}`;
    let newAnnotation: Annotation | null = null;

    switch (tool) {
      case "circle":
        newAnnotation = {
          id,
          type: "circle",
          x: x / dimensions.scale.x,
          y: y / dimensions.scale.y,
          radius: 50,
          color,
          selected: true
        };
        break;
      case "rectangle":
        newAnnotation = {
          id,
          type: "rectangle",
          x: x / dimensions.scale.x,
          y: y / dimensions.scale.y,
          width: 100,
          height: 100,
          color,
          selected: true
        };
        break;
      case "text":
        if (textInput) {
          newAnnotation = {
            id,
            type: "text",
            x: x / dimensions.scale.x,
            y: y / dimensions.scale.y,
            text: textInput,
            color,
            selected: true
          };
          setTextInput("");
        }
        break;
    }

    if (newAnnotation) {
      const newAnnotations = [...annotations, newAnnotation];
      setAnnotations(newAnnotations);
      setSelectedId(id);
      addToHistory(newAnnotations);
    }
  }, [tool, dimensions.scale, color, annotations, textInput, selectedId]);

  // Handle shape transform
  const handleTransform = useCallback((e: any) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale to 1 as we'll apply it to width/height/radius
    node.scaleX(1);
    node.scaleY(1);

    const id = node.id();
    const updatedAnnotations = annotations.map(ann => {
      if (ann.id === id) {
        if (ann.type === "circle") {
          return {
            ...ann,
            radius: (ann.radius || 50) * Math.max(scaleX, scaleY),
            x: node.x() / dimensions.scale.x,
            y: node.y() / dimensions.scale.y
          };
        } else if (ann.type === "rectangle") {
          return {
            ...ann,
            width: (ann.width || 100) * scaleX,
            height: (ann.height || 100) * scaleY,
            x: node.x() / dimensions.scale.x,
            y: node.y() / dimensions.scale.y
          };
        }
      }
      return ann;
    });

    setAnnotations(updatedAnnotations);
    addToHistory(updatedAnnotations);
  }, [annotations, dimensions.scale]);

  // Handle shape drag
  const handleDragEnd = useCallback((e: any) => {
    const node = e.target;
    const id = node.id();

    const updatedAnnotations = annotations.map(ann => {
      if (ann.id === id) {
        return {
          ...ann,
          x: node.x() / dimensions.scale.x,
          y: node.y() / dimensions.scale.y
        };
      }
      return ann;
    });

    setAnnotations(updatedAnnotations);
    addToHistory(updatedAnnotations);
  }, [annotations, dimensions.scale]);

  // Delete selected annotation
  const handleDelete = useCallback(() => {
    if (selectedId) {
      const updatedAnnotations = annotations.filter(ann => ann.id !== selectedId);
      setAnnotations(updatedAnnotations);
      setSelectedId(null);
      addToHistory(updatedAnnotations);
    }
  }, [selectedId, annotations]);

  const handleNavigateBack = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const hasUnsavedChanges = annotations.length > 0 && annotations !== history[0];

    if (hasUnsavedChanges) {
      const confirmed = window.confirm("You have unsaved changes. Are you sure you want to leave?");
      if (!confirmed) return;
    }

    if (propertyId) {
      setLocation(`/property/${propertyId}`);
    } else {
      setLocation("/property-explorer");
    }
  }, [annotations, history, setLocation, propertyId]);

  useEffect(() => {
    if (!photoId) return;

    const fetchPhoto = async () => {
      try {
        setIsLoading(true);
        setImageError(null);

        const authCheck = await fetch('/api/user', {
          credentials: 'include'
        });

        if (!authCheck.ok) {
          throw new Error('Not authenticated');
        }

        const response = await fetch(`/api/photos/${photoId}`, {
          credentials: "include",
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Not authenticated");
          }
          throw new Error("Failed to load photo");
        }

        const data = await response.json();

        try {
          const img = await loadImage(`/uploads/${data.filename}`);
          setImage(img);
          if (data.annotations) {
            //Adding ids to annotations if they don't exist.  This assumes the backend doesn't provide IDs.
            const annotationsWithIds = data.annotations.map((ann: any, index: number) => ({...ann, id: `annotation-${index}`}))
            setAnnotations(annotationsWithIds);
            setHistory([annotationsWithIds]);
          }
        } catch (error) {
          console.error("Image loading error:", error);
          setImageError("Failed to load image. The file might be too large or corrupted.");
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to load image. Please try again or contact support if the issue persists.",
          });
        }
      } catch (error) {
        console.error("Photo fetch error:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch photo data";
        setImageError(errorMessage);

        if (errorMessage === "Not authenticated") {
          toast({
            variant: "destructive",
            title: "Authentication Error",
            description: "Please log in to view this photo",
          });
          setLocation("/login");
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: errorMessage,
          });
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPhoto();
  }, [photoId, loadImage, toast, setLocation]);

  useEffect(() => {
    calculateDimensions();
  }, [calculateDimensions]);

  useEffect(() => {
    const handleResize = () => {
      calculateDimensions();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateDimensions]);

  const addToHistory = useCallback((newAnnotations: Annotation[]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push([...newAnnotations]);
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const getRelativePointerPosition = useCallback((stage: any) => {
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    const pos = stage.getPointerPosition();
    return transform.point(pos);
  }, []);

  const handleMouseDown = useCallback((e: any) => {
    if (tool === "move") return;

    const stage = e.target.getStage();
    const point = getRelativePointerPosition(stage);
    const { x, y } = point;

    if (tool === "sketch") {
      setIsDrawing(true);
      setCurrentLine([x / dimensions.scale.x, y / dimensions.scale.y]);
    }
  }, [tool, dimensions.scale, getRelativePointerPosition]);

  const handleMouseMove = useCallback((e: any) => {
    if (!isDrawing || tool !== "sketch") return;

    const stage = e.target.getStage();
    const point = getRelativePointerPosition(stage);
    setCurrentLine(prev => [...prev, point.x / dimensions.scale.x, point.y / dimensions.scale.y]);
  }, [isDrawing, tool, dimensions.scale, getRelativePointerPosition]);

  const handleMouseUp = useCallback(async () => {
    if (!isDrawing && tool !== "sketch") {
      try {
        const response = await fetch(`/api/photos/${photoId}/annotations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ annotations }),
          credentials: "include",
        });

        if (!response.ok) throw new Error("Failed to save annotations");
      } catch (error) {
        console.error('Error saving annotations:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to save annotations",
        });
      }
      return;
    }

    setIsDrawing(false);
    if (currentLine.length >= 4) {
      const id = `annotation-${annotations.length}`;
      const newAnnotation: Annotation = {
        id,
        type: "sketch",
        x: 0,
        y: 0,
        points: currentLine,
        color,
        selected: true
      };
      const newAnnotations = [...annotations, newAnnotation];
      setAnnotations(newAnnotations);

      try {
        const response = await fetch(`/api/photos/${photoId}/annotations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ annotations: newAnnotations }),
          credentials: "include",
        });

        if (!response.ok) throw new Error("Failed to save annotations");
      } catch (error) {
        console.error('Error saving annotations:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to save annotations",
        });
      }
    }
    setCurrentLine([]);
  }, [isDrawing, tool, currentLine, annotations, color, photoId, toast]);


  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setAnnotations(history[historyIndex - 1]);
      setSelectedId(null); //Deselect on undo
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setAnnotations(history[historyIndex + 1]);
      setSelectedId(null); //Deselect on redo
    }
  }, [historyIndex, history]);

  const handleSave = async () => {
    if (!annotations.length) {
      toast({
        title: "Info",
        description: "No annotations to save",
      });
      return;
    }

    try {
      const response = await fetch(`/api/photos/${photoId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotations }),
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to save annotations");

      toast({
        title: "Success",
        description: "Annotations saved successfully",
      });

      setLocation("/properties");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save annotations",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="h-screen flex flex-col">
        {/* Toolbar */}
        <div className="border-b p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="flex items-center justify-between max-w-[1600px] mx-auto">
            <Button variant="ghost" onClick={handleNavigateBack}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Properties
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant={tool === "move" ? "default" : "outline"}
                onClick={() => setTool("move")}
              >
                <Move className="w-4 h-4 mr-2" />
                Move
              </Button>
              <Button
                variant={tool === "circle" ? "default" : "outline"}
                onClick={() => setTool("circle")}
              >
                <CircleIcon className="w-4 h-4 mr-2" />
                Circle
              </Button>
              <Button
                variant={tool === "rectangle" ? "default" : "outline"}
                onClick={() => setTool("rectangle")}
              >
                <Square className="w-4 h-4 mr-2" />
                Rectangle
              </Button>
              <Button
                variant={tool === "sketch" ? "default" : "outline"}
                onClick={() => setTool("sketch")}
              >
                <PencilLine className="w-4 h-4 mr-2" />
                Sketch
              </Button>
              <Button
                variant={tool === "text" ? "default" : "outline"}
                onClick={() => setTool("text")}
              >
                <Type className="w-4 h-4 mr-2" />
                Text
              </Button>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger className="w-[100px]">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="#ff0000">Red</SelectItem>
                  <SelectItem value="#00ff00">Green</SelectItem>
                  <SelectItem value="#0000ff">Blue</SelectItem>
                  <SelectItem value="#ffff00">Yellow</SelectItem>
                  <SelectItem value="#ffffff">White</SelectItem>
                  <SelectItem value="#000000">Black</SelectItem>
                </SelectContent>
              </Select>
              <div className="space-x-1">
                <Button
                  variant="outline"
                  onClick={undo}
                  disabled={historyIndex === 0}
                >
                  <Undo className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={redo}
                  disabled={historyIndex === history.length - 1}
                >
                  <Redo className="w-4 h-4" />
                </Button>
              </div>
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        </div>

        {/* Text input section */}
        {tool === "text" && (
          <div className="border-b bg-background p-4">
            <div className="max-w-[1600px] mx-auto">
              <Textarea
                placeholder="Enter text annotation..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="h-20"
              />
            </div>
          </div>
        )}

        {/* Main editing area */}
        <div className="flex-1 overflow-hidden bg-background relative" ref={containerRef}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="ml-2">Loading photo...</span>
            </div>
          ) : imageError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <p className="text-destructive">{imageError}</p>
                <Button variant="outline" onClick={() => setLocation(`/property/${propertyId}`)}>
                  Return to Properties
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative h-full">
              {image && dimensions.width > 0 && dimensions.height > 0 && (
                <Stage
                  ref={stageRef}
                  width={dimensions.width}
                  height={dimensions.height}
                  onClick={handleStageClick}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <Layer>
                    <KonvaImage
                      image={image}
                      width={dimensions.width}
                      height={dimensions.height}
                    />
                    {annotations.map((annotation) => {
                      const isSelected = annotation.id === selectedId;

                      switch (annotation.type) {
                        case "circle":
                          return (
                            <Circle
                              key={annotation.id}
                              id={annotation.id}
                              x={annotation.x * dimensions.scale.x}
                              y={annotation.y * dimensions.scale.y}
                              radius={(annotation.radius || 50) * dimensions.scale.x}
                              stroke={annotation.color}
                              strokeWidth={2}
                              draggable={tool === "move"}
                              onDragEnd={handleDragEnd}
                              onTransformEnd={handleTransform}
                            />
                          );
                        case "rectangle":
                          return (
                            <Rect
                              key={annotation.id}
                              id={annotation.id}
                              x={annotation.x * dimensions.scale.x}
                              y={annotation.y * dimensions.scale.y}
                              width={(annotation.width || 100) * dimensions.scale.x}
                              height={(annotation.height || 100) * dimensions.scale.y}
                              stroke={annotation.color}
                              strokeWidth={2}
                              draggable={tool === "move"}
                              onDragEnd={handleDragEnd}
                              onTransformEnd={handleTransform}
                            />
                          );
                        case "text":
                          return (
                            <Text
                              key={annotation.id}
                              id={annotation.id}
                              x={annotation.x * dimensions.scale.x}
                              y={annotation.y * dimensions.scale.y}
                              text={annotation.text || ""}
                              fill={annotation.color}
                              fontSize={16 * dimensions.scale.x}
                              draggable={tool === "move"}
                              onDragEnd={handleDragEnd}
                            />
                          );
                        case "sketch":
                          return (
                            <Line
                              key={annotation.id}
                              id={annotation.id}
                              points={annotation.points?.map((p, idx) =>
                                p * (idx % 2 === 0 ? dimensions.scale.x : dimensions.scale.y)
                              )}
                              stroke={annotation.color}
                              strokeWidth={2}
                              tension={0.5}
                              lineCap="round"
                              lineJoin="round"
                              draggable={tool === "move"}
                              onDragEnd={handleDragEnd}
                            />
                          );
                        default:
                          return null;
                      }
                    })}
                    {isDrawing && (
                      <Line
                        points={currentLine.map((p, idx) =>
                          p * (idx % 2 === 0 ? dimensions.scale.x : dimensions.scale.y)
                        )}
                        stroke={color}
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

              {/* Delete button for selected shape */}
              {selectedId && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  className="absolute top-4 right-4 z-50"
                >
                  <X className="w-4 h-4 mr-2" />
                  Delete Shape
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}