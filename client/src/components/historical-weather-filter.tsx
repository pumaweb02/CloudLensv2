import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, Filter, Wind, CloudLightning, CloudRain, Thermometer, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HistoricalWeatherFilterProps {
  location: { lat: number; lng: number };
  onFilterChange?: (filters: WeatherFilters) => void;
}

interface WeatherFilters {
  startDate?: Date;
  endDate?: Date;
  eventTypes: string[];
  windSpeed?: { min: number; max: number };
  hailSize?: string;
  precipitation?: { min: number; max: number };
  temperature?: { min: number; max: number };
}

const EVENT_TYPES = [
  { value: 'tornado', label: 'Tornado' },
  { value: 'hurricane', label: 'Hurricane' },
  { value: 'severe_thunderstorm', label: 'Severe Thunderstorm' },
  { value: 'hail', label: 'Hail' },
  { value: 'heavy_rain', label: 'Heavy Rain' },
  { value: 'high_wind', label: 'High Wind' },
  { value: 'extreme_temperature', label: 'Extreme Temperature' }
];

const HAIL_SIZES = [
  { value: 'any', label: 'Any Size' },
  { value: 'small', label: 'Small (< 1")' },
  { value: 'medium', label: 'Medium (1-2")' },
  { value: 'large', label: 'Large (> 2")' }
];

export function HistoricalWeatherFilter({ location, onFilterChange }: HistoricalWeatherFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<WeatherFilters>({
    eventTypes: [],
    windSpeed: { min: 0, max: 100 },
    precipitation: { min: 0, max: 10 }
  });
  const [isSearching, setIsSearching] = useState(false);

  const activeFilterCount = [
    filters.startDate,
    filters.endDate,
    ...(filters.eventTypes || []),
    filters.windSpeed?.max !== 100 && filters.windSpeed?.min !== 0,
    filters.hailSize,
    filters.precipitation?.max !== 10 && filters.precipitation?.min !== 0,
    filters.temperature
  ].filter(Boolean).length;

  const handleFilterChange = (updates: Partial<WeatherFilters>) => {
    const newFilters = { ...filters, ...updates };
    setFilters(newFilters);
  };

  const handleApplyFilters = () => {
    setIsSearching(true);
    onFilterChange?.(filters);
    setIsOpen(false);
    setIsSearching(false);
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      eventTypes: [],
      windSpeed: { min: 0, max: 100 },
      precipitation: { min: 0, max: 10 }
    };
    setFilters(clearedFilters);
    onFilterChange?.(clearedFilters);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="relative">
          <Filter className="mr-2 h-4 w-4" />
          Filter Weather Events
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2 px-1 min-w-[1.5rem]">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="start">
        <div className="space-y-4">
          {/* Date Range */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Date Range</Label>
              {(filters.startDate || filters.endDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFilterChange({ startDate: undefined, endDate: undefined })}
                >
                  Clear dates
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !filters.startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.startDate ? format(filters.startDate, "PPP") : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.startDate}
                    onSelect={(date) => handleFilterChange({ startDate: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !filters.endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.endDate ? format(filters.endDate, "PPP") : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.endDate}
                    onSelect={(date) => handleFilterChange({ endDate: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Event Types */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Event Types</Label>
            <div className="grid grid-cols-2 gap-2">
              {EVENT_TYPES.map((eventType) => (
                <div key={eventType.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={eventType.value}
                    checked={filters.eventTypes.includes(eventType.value)}
                    onCheckedChange={(checked) => {
                      const newEventTypes = checked
                        ? [...filters.eventTypes, eventType.value]
                        : filters.eventTypes.filter(type => type !== eventType.value);
                      handleFilterChange({ eventTypes: newEventTypes });
                    }}
                  />
                  <Label htmlFor={eventType.value}>{eventType.label}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Wind Speed Range */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Wind Speed (mph)</Label>
            <div className="px-2">
              <Slider
                value={[filters.windSpeed?.min || 0, filters.windSpeed?.max || 100]}
                min={0}
                max={100}
                step={5}
                onValueChange={([min, max]) => handleFilterChange({
                  windSpeed: { min, max }
                })}
              />
              <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>{filters.windSpeed?.min || 0} mph</span>
                <span>{filters.windSpeed?.max || 100} mph</span>
              </div>
            </div>
          </div>

          {/* Hail Size */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Hail Size</Label>
            <Select
              value={filters.hailSize}
              onValueChange={(value) => handleFilterChange({ hailSize: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select hail size" />
              </SelectTrigger>
              <SelectContent>
                {HAIL_SIZES.map((size) => (
                  <SelectItem key={size.value} value={size.value}>
                    {size.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Precipitation Range */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Precipitation (inches/hour)</Label>
            <div className="px-2">
              <Slider
                value={[filters.precipitation?.min || 0, filters.precipitation?.max || 10]}
                min={0}
                max={10}
                step={0.1}
                onValueChange={([min, max]) => handleFilterChange({
                  precipitation: { min, max }
                })}
              />
              <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>{filters.precipitation?.min || 0}"</span>
                <span>{filters.precipitation?.max || 10}"</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="ghost"
              onClick={handleClearFilters}
              disabled={isSearching || activeFilterCount === 0}
            >
              Clear All
            </Button>
            <Button
              onClick={handleApplyFilters}
              disabled={isSearching}
              className="gap-2"
            >
              {isSearching ? (
                <>Searching...</>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Apply Filters
                </>
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}