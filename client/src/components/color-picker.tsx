import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useEffect } from "react";

interface ColorPickerProps {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function ColorPicker({ value = "#000000", onChange, className }: ColorPickerProps) {
  const [color, setColor] = useState(value);

  useEffect(() => {
    setColor(value);
  }, [value]);

  const handleChange = (newColor: string) => {
    setColor(newColor);
    onChange?.(newColor);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "w-[100px] h-[40px] rounded-md border border-input",
            className
          )}
          style={{ backgroundColor: color }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-[280px]">
        <div className="grid gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => handleChange(e.target.value)}
                className="w-full h-[40px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={color}
                onChange={(e) => handleChange(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
