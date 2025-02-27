import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface HistoricalWeatherSearchProps {
  location: { lat: number; lng: number };
}

export function HistoricalWeatherSearch({ location }: HistoricalWeatherSearchProps) {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  const { data: historicalEvents, isLoading } = useQuery({
    queryKey: ['weather', 'historical-events', location, startDate, endDate],
    queryFn: async () => {
      if (!startDate || !endDate) return null;

      const response = await fetch(
        `/api/weather/historical-events?lat=${location.lat}&lng=${location.lng}&startTime=${startDate.toISOString()}&endTime=${endDate.toISOString()}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch historical events');
      }

      return response.json();
    },
    enabled: !!(location && startDate && endDate),
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Start Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">End Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {isLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-12 bg-muted rounded" />
              <div className="h-24 bg-muted rounded" />
            </div>
          ) : historicalEvents?.events?.length > 0 ? (
            <div className="space-y-4">
              {historicalEvents.events.map((event: any) => (
                <div
                  key={event.id}
                  className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{event.type}</span>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(event.date), "PPP")}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Select a date range to view historical weather events
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}