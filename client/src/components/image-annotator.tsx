import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Stage, Layer, Line, Image } from "react-konva";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Eraser, RotateCcw, Download } from "lucide-react";

interface ImageAnnotatorProps {
  src: string;
  onSave: (data: { canvas: string; notes: string }) => void;
  defaultAnnotation?: string;
  defaultNotes?: string;
}

export function ImageAnnotator({ src, onSave, defaultAnnotation, defaultNotes }: ImageAnnotatorProps) {
  const [notes, setNotes] = useState(defaultNotes || "");
  const [tool, setTool] = useState<"pencil" | "eraser">("pencil");
  const [lines, setLines] = useState<any[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const stageRef = useRef<any>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "Anonymous";
    img.src = src;
    img.onload = () => {
      setImageObj(img);
    };
  }, [src]);

  useEffect(() => {
    if (defaultAnnotation) {
      try {
        const data = JSON.parse(defaultAnnotation);
        if (data.lines) setLines(data.lines);
      } catch (error) {
        console.error("Failed to parse annotation data:", error);
      }
    }
  }, [defaultAnnotation]);

  const handleMouseDown = (e: any) => {
    setIsDrawing(true);
    const pos = e.target.getStage().getPointerPosition();
    if (tool === "pencil") {
      setLines([...lines, { points: [pos.x, pos.y] }]);
    } else if (tool === "eraser") {
      setLines([...lines, { points: [pos.x, pos.y], erase: true }]);
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing) return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();

    const lastLine = lines[lines.length - 1];
    if (lastLine) {
      lastLine.points = lastLine.points.concat([pos.x, pos.y]);
      setLines([...lines.slice(0, -1), lastLine]);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleSave = () => {
    if (stageRef.current) {
      const annotations = {
        lines,
      };
      onSave({
        canvas: JSON.stringify(annotations),
        notes,
      });
    }
  };

  const handleClear = () => {
    setLines([]);
  };

  if (!imageObj) {
    return <div>Loading image...</div>;
  }

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant={tool === "pencil" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("pencil")}
          >
            <Pencil className="w-4 h-4 mr-2" />
            Draw
          </Button>
          <Button
            variant={tool === "eraser" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("eraser")}
          >
            <Eraser className="w-4 h-4 mr-2" />
            Erase
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>
        <Button onClick={handleSave}>
          <Download className="w-4 h-4 mr-2" />
          Save Annotations
        </Button>
      </div>

      <div className="relative" style={{ width: "100%", height: "500px" }}>
        <Stage
          ref={stageRef}
          width={800}
          height={500}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <Layer>
            <Image
              image={imageObj}
              width={800}
              height={500}
            />
            {lines.map((line: any, i) => (
              <Line
                key={i}
                points={line.points}
                stroke={line.erase ? "#FFFFFF" : "#ff0000"}
                strokeWidth={line.erase ? 20 : 5}
                tension={0.5}
                lineCap="round"
                globalCompositeOperation={
                  line.erase ? "destination-out" : "source-over"
                }
              />
            ))}
          </Layer>
        </Stage>
      </div>

      <Card className="p-4">
        <Textarea
          placeholder="Add notes about the damages..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[100px]"
        />
      </Card>
    </div>
  );
}