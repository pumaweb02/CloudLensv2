import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  MapPin,
  CloudRain,
  Wind,
  AlertTriangle,
} from "lucide-react";

interface EventSummaryProps {
  event: {
    id: number;
    name: string;
    type: string;
    severity: string;
    startTime: string;
    endTime: string | null;
    windSpeed: number;
    windDirection?: string;
    precipitation?: number;
    hailSize?: number;
    center: {
      lat: number;
      lng: number;
    };
    metadata?: {
      affectedCounties?: string[];
      affectedCities?: string[];
      reportedDamage?: {
        description: string;
        locations: Array<{
          address: string;
          damageType: string;
          severity: string;
        }>;
      };
      weatherAlerts?: string[];
      summary?: string;
    };
  };
}

export function EventSummary({ event }: EventSummaryProps) {
  const getDuration = () => {
    if (!event.endTime) return "Ongoing";
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    const hours = Math.abs(end.getTime() - start.getTime()) / 36e5;
    return `${Math.floor(hours)} hours ${Math.round((hours % 1) * 60)} minutes`;
  };

  const location = event.center ? `${event.center.lat.toFixed(2)}°N, ${event.center.lng.toFixed(2)}°W` : "Location unknown";

  return (
    <div className="space-y-6">
      {/* Event Header */}
      <div className="space-y-2">
        <h3 className="text-2xl font-bold">{event.name}</h3>
        <div className="flex items-center gap-2">
          <Badge variant={event.severity === "severe" ? "destructive" : "default"}>
            {event.severity}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {event.type}
          </Badge>
        </div>
      </div>

      {/* Time and Location */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Event Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{location}</span>
            </div>
            <p>
              <span className="font-medium">Start:</span>{" "}
              {format(new Date(event.startTime), "PPP 'at' p")}
            </p>
            {event.endTime && (
              <p>
                <span className="font-medium">End:</span>{" "}
                {format(new Date(event.endTime), "PPP 'at' p")}
              </p>
            )}
            <p>
              <span className="font-medium">Duration:</span> {getDuration()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Weather Measurements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wind className="h-5 w-5" />
            Weather Measurements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Wind Speed</p>
              <p className="text-lg">{event.windSpeed} mph</p>
              {event.windDirection && (
                <p className="text-sm text-muted-foreground">
                  Direction: {event.windDirection}
                </p>
              )}
            </div>
            {event.precipitation !== undefined && (
              <div>
                <p className="text-sm font-medium">Precipitation</p>
                <p className="text-lg">{event.precipitation} inches</p>
              </div>
            )}
            {event.hailSize !== undefined && (
              <div>
                <p className="text-sm font-medium">Hail Size</p>
                <p className="text-lg">{event.hailSize} inches</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Impact Summary */}
      {event.metadata?.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Impact Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line">{event.metadata.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Affected Areas */}
      {(event.metadata?.affectedCounties?.length || event.metadata?.affectedCities?.length) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Affected Areas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {event.metadata.affectedCounties && (
              <div className="mb-4">
                <h4 className="font-medium mb-2">Counties:</h4>
                <div className="flex flex-wrap gap-2">
                  {event.metadata.affectedCounties.map((county, index) => (
                    <Badge key={index} variant="outline">
                      {county}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {event.metadata.affectedCities && (
              <div>
                <h4 className="font-medium mb-2">Cities:</h4>
                <div className="flex flex-wrap gap-2">
                  {event.metadata.affectedCities.map((city, index) => (
                    <Badge key={index} variant="outline">
                      {city}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}