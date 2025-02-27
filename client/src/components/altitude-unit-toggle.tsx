import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePreferences } from "@/hooks/use-preferences";
import { Ruler } from "lucide-react";

export function AltitudeUnitToggle() {
  const { preferences, updatePreferences } = usePreferences();

  if (!preferences) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Ruler className="h-4 w-4" />
          {preferences.altitudeUnit === "feet" ? "Feet" : "Meters"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => updatePreferences("feet")}
          className={preferences.altitudeUnit === "feet" ? "bg-accent" : ""}
        >
          Feet
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => updatePreferences("meters")}
          className={preferences.altitudeUnit === "meters" ? "bg-accent" : ""}
        >
          Meters
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
