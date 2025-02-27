import { Card, CardContent } from "@/components/ui/card";
import { Cloud, Wind, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

interface WeatherReportProps {
  location: { lat: number; lng: number };
  timeRange: "current" | "hourly" | "daily";
  dateFilter?: {
    startDate?: Date;
    endDate?: Date;
    eventTypes?: string[];
    windSpeed?: { min: number; max: number };
    hailSize?: string;
    precipitation?: { min: number; max: number };
  };
}

export function WeatherReport({ location, timeRange, dateFilter }: WeatherReportProps) {
  const { data: weatherInfo, isLoading } = useQuery({
    queryKey: ['weather', 'history', location, timeRange, dateFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: location.lat.toString(),
        lng: location.lng.toString(),
        timeRange
      });

      // Add date filters if present
      if (dateFilter?.startDate) {
        params.append('startDate', dateFilter.startDate.toISOString());
      }
      if (dateFilter?.endDate) {
        params.append('endDate', dateFilter.endDate.toISOString());
      }

      // Add event type filters
      if (dateFilter?.eventTypes?.length) {
        dateFilter.eventTypes.forEach(type => {
          params.append('eventTypes[]', type);
        });
      }

      // Add range filters
      if (dateFilter?.windSpeed) {
        params.append('windSpeedMin', dateFilter.windSpeed.min.toString());
        params.append('windSpeedMax', dateFilter.windSpeed.max.toString());
      }

      if (dateFilter?.precipitation) {
        params.append('precipitationMin', dateFilter.precipitation.min.toString());
        params.append('precipitationMax', dateFilter.precipitation.max.toString());
      }

      if (dateFilter?.hailSize) {
        params.append('hailSize', dateFilter.hailSize);
      }

      const response = await fetch(
        `/api/weather/historical?${params.toString()}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch weather history');
      }

      return response.json();
    },
    enabled: true,
    staleTime: 300000 // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!weatherInfo?.data?.timelines?.[0]?.intervals) {
    return (
      <div className="flex items-center justify-center p-6 text-muted-foreground">
        <AlertTriangle className="w-4 h-4 mr-2" />
        No weather data available for the selected filters
      </div>
    );
  }

  const intervals = weatherInfo.data.timelines[0].intervals;

  return (
    <div className="space-y-6">
      {intervals.map((interval: any, index: number) => (
        <Card key={index} className="bg-card">
          <CardContent className="pt-6">
            <div className="grid gap-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">
                  {format(new Date(interval.startTime), 'PPp')}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Temperature</h3>
                  <p className="text-2xl font-bold">{interval.values.temperature}°F</p>
                  <p className="text-sm text-muted-foreground">
                    Feels like {interval.values.temperatureApparent}°F
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Wind</h3>
                  <p className="text-2xl font-bold">{interval.values.windSpeed} mph</p>
                  <p className="text-sm text-muted-foreground">
                    Direction: {interval.values.windDirection}°
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Precipitation</h3>
                  <p className="text-2xl font-bold">{interval.values.precipitationIntensity} in/hr</p>
                  <p className="text-sm text-muted-foreground">
                    Type: {interval.values.precipitationType}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Visibility</h3>
                  <p className="text-2xl font-bold">
                    {interval.values.visibility} mi
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Pressure: {interval.values.pressureSurfaceLevel} mb
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}