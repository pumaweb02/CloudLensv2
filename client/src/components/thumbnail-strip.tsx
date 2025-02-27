import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Check, AlertCircle } from "lucide-react";

interface ThumbnailStripProps {
  photos: Array<{
    id: number;
    url?: string;
    filename: string;
    thumbnailUrl?: string;
  }>;
  currentIndex: number;
  onSelect: (index: number) => void;
  annotations: Record<number, any[]>;
}

export function ThumbnailStrip({ photos, currentIndex, onSelect, annotations }: ThumbnailStripProps) {
  return (
    <ScrollArea className="w-full">
      <div className="flex gap-2 p-2 min-w-full">
        {photos.map((photo, index) => {
          const hasAnnotations = annotations[photo.id]?.length > 0;

          return (
            <Card
              key={photo.id}
              className={cn(
                "relative cursor-pointer hover:ring-2 hover:ring-primary transition-all",
                "w-24 h-24 shrink-0",
                index === currentIndex && "ring-2 ring-primary",
                !hasAnnotations && "ring-1 ring-yellow-500"
              )}
              onClick={() => onSelect(index)}
            >
              <img
                src={photo.url || `/uploads/${photo.filename}`}
                alt={`Photo ${index + 1}`}
                className="w-full h-full object-cover rounded-sm"
              />
              <div className="absolute top-1 right-1">
                {hasAnnotations ? (
                  <Badge variant="default" className="bg-green-500">
                    <Check className="w-3 h-3 mr-1" />
                    Done
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-yellow-500">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Pending
                  </Badge>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}