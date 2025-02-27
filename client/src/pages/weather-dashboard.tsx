import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";
import { format } from "date-fns";
import { Sidebar } from "@/components/sidebar";
import { CloudRain, Wind, Cloud, AlertTriangle, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddressSearch } from "@/components/address-search";
import { WeatherReport } from "@/components/weather-report";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { WeatherAlertList } from "@/components/weather-alert-list";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { WeatherMapOverlay } from "@/components/weather-map-overlay";
import { HistoricalWeatherFilter } from "@/components/historical-weather-filter";

// Default coordinates for Atlanta
const DEFAULT_COORDINATES = {
  lat: 33.7490,
  lng: -84.3880
};

// Weather layer types
type WeatherLayer = 'precipitation' | 'temperature' | 'wind' | 'pressure';

export default function WeatherDashboard() {
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(DEFAULT_COORDINATES);
  const [timeRange, setTimeRange] = useState<"current" | "hourly" | "daily">("current");
  const [activeLayers, setActiveLayers] = useState<WeatherLayer[]>([]);
  const [dateFilter, setDateFilter] = useState<{ startDate?: Date; endDate?: Date }>({});
  const { toast } = useToast();

  // Handle location changes
  const handleLocationChange = useCallback((address: string, coordinates?: { lat: number; lng: number }) => {
    if (coordinates) {
      setMapCenter(coordinates);
      toast({
        title: "Location Updated",
        description: `Weather data for ${address}`,
      });
    }
  }, [toast]);

  // Toggle weather layers
  const toggleLayer = (layer: WeatherLayer) => {
    setActiveLayers(current =>
      current.includes(layer)
        ? current.filter(l => l !== layer)
        : [...current, layer]
    );
  };

  // Current Weather Query
  const { data: currentWeather, isLoading: isCurrentLoading, error: weatherError } = useQuery({
    queryKey: ['weather', 'current', mapCenter],
    queryFn: async () => {
      const response = await fetch(
        `/api/weather/current?lat=${mapCenter.lat}&lng=${mapCenter.lng}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch weather data');
      }

      return response.json();
    },
    enabled: true,
    staleTime: 300000, // 5 minutes
    retry: (failureCount, error) => {
      if (error.message?.includes('Too Many Calls')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: 5000
  });

  useEffect(() => {
    if (weatherError) {
      toast({
        title: "Weather Data Error",
        description: weatherError instanceof Error ? weatherError.message : "Failed to load weather data",
        variant: "destructive",
      });
    }
  }, [weatherError, toast]);

  const formatWeatherData = (data: any) => {
    if (!data?.data?.timelines?.[0]?.intervals?.[0]?.values) {
      return null;
    }

    const values = data.data.timelines[0].intervals[0].values;
    return {
      temperature: values.temperature,
      description: getWeatherDescription(values.weatherCode),
      windSpeed: values.windSpeed,
      humidity: values.humidity,
      precipitation: values.precipitationIntensity,
      pressure: values.pressureSurfaceLevel,
      visibility: values.visibility
    };
  };

  const getWeatherDescription = (code: number): string => {
    const weatherCodes: Record<number, string> = {
      1000: "Clear",
      1100: "Mostly Clear",
      1101: "Partly Cloudy",
      1102: "Mostly Cloudy",
      2000: "Fog",
      4000: "Drizzle",
      4001: "Rain",
      4200: "Light Rain",
      4201: "Heavy Rain",
      5000: "Snow",
      5001: "Flurries",
      5100: "Light Snow",
      5101: "Heavy Snow",
      6000: "Freezing Drizzle",
      6001: "Freezing Rain",
      7000: "Ice Pellets",
      7101: "Heavy Ice Pellets",
      8000: "Thunderstorm"
    };
    return weatherCodes[code] || "Unknown";
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-4 space-y-6">
          {/* Header and Controls */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Weather Dashboard</h1>
                <p className="text-muted-foreground">
                  {`${mapCenter.lat.toFixed(4)}°N, ${mapCenter.lng.toFixed(4)}°W`}
                </p>
              </div>
              <div className="flex gap-2">
                <HistoricalWeatherFilter
                  location={mapCenter}
                  onFilterChange={setDateFilter}
                />
                <Select value={timeRange} onValueChange={(value: "current" | "hourly" | "daily") => setTimeRange(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select time range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <AddressSearch onSearch={handleLocationChange} />
              </div>
            </div>

            {/* Weather Layer Controls */}
            <div className="flex flex-wrap gap-4 p-4 bg-card rounded-lg shadow-sm">
              {(['precipitation', 'temperature', 'wind', 'pressure'] as const).map((layer) => (
                <div key={layer} className="flex items-center space-x-2">
                  <Checkbox
                    id={layer}
                    checked={activeLayers.includes(layer)}
                    onCheckedChange={() => toggleLayer(layer)}
                  />
                  <Label htmlFor={layer} className="capitalize">{layer}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Current Weather Card */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Current Conditions</CardTitle>
              </CardHeader>
              <CardContent>
                {isCurrentLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : currentWeather ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-bold">
                          {formatWeatherData(currentWeather)?.temperature}°F
                        </p>
                        <p className="text-muted-foreground capitalize">
                          {formatWeatherData(currentWeather)?.description}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-accent/50 rounded">
                        <p className="text-xs font-medium flex items-center gap-1">
                          <Wind className="h-3 w-3" /> Wind
                        </p>
                        <p className="text-sm">
                          {formatWeatherData(currentWeather)?.windSpeed} mph
                        </p>
                      </div>
                      <div className="p-2 bg-accent/50 rounded">
                        <p className="text-xs font-medium flex items-center gap-1">
                          <CloudRain className="h-3 w-3" /> Precipitation
                        </p>
                        <p className="text-sm">
                          {formatWeatherData(currentWeather)?.precipitation} in/hr
                        </p>
                      </div>
                      <div className="p-2 bg-accent/50 rounded">
                        <p className="text-xs font-medium flex items-center gap-1">
                          <Cloud className="h-3 w-3" /> Humidity
                        </p>
                        <p className="text-sm">
                          {formatWeatherData(currentWeather)?.humidity}%
                        </p>
                      </div>
                      <div className="p-2 bg-accent/50 rounded">
                        <p className="text-xs font-medium flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Pressure
                        </p>
                        <p className="text-sm">
                          {formatWeatherData(currentWeather)?.pressure} mb
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Map Card */}
            <Card className="col-span-2">
              <CardContent className="p-0 h-[500px]">
                {/* {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? ( */}
                  <APIProvider apiKey={'AIzaSyAq_TvETnjsrA18ZfiUIgL1wfOOszSz51M'}>
                    <Map
                      center={mapCenter}
                      zoom={10}
                      mapId={import.meta.env.VITE_GOOGLE_MAPS_ID}
                      gestureHandling="greedy"
                      disableDefaultUI={false}
                    >
                      {currentWeather && (
                        <AdvancedMarker
                          position={mapCenter}
                          title={`${formatWeatherData(currentWeather)?.temperature}°F - ${formatWeatherData(currentWeather)?.description}`}
                        >
                          <MapPin className="h-6 w-6 text-primary" />
                        </AdvancedMarker>
                      )}
                      {activeLayers.map(layer => (
                        <WeatherMapOverlay
                          key={layer}
                          layer={layer}
                          visible={true}
                        />
                      ))}
                    </Map>
                  </APIProvider>
                {/* ) : (
                  <div className="flex items-center justify-center h-full">
                    <AlertTriangle className="h-8 w-8 text-yellow-500" />
                    <p className="ml-2">Google Maps API key not configured</p>
                  </div>
                )} */}
              </CardContent>
            </Card>
          </div>

          {/* Weather History and Alerts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Weather History */}
            <Card>
              <CardHeader>
                <CardTitle>Weather History</CardTitle>
              </CardHeader>
              <CardContent>
                <WeatherReport
                  location={mapCenter}
                  timeRange={timeRange}
                  dateFilter={dateFilter}
                />
              </CardContent>
            </Card>

            {/* Weather Alerts */}
            <Card>
              <CardHeader>
                <CardTitle>Weather Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <WeatherAlertList location={mapCenter} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}