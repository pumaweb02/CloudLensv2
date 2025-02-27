import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, AlertTriangle, Wind, CloudRain } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

interface WeatherAlert {
  id: string;
  type: string;
  severity: string;
  message: string;
  startTime: string;
  endTime: string;
}

interface WeatherAlertListProps {
  location: { lat: number; lng: number };
}

export function WeatherAlertList({ location }: WeatherAlertListProps) {
  const { data: alertsData, isLoading } = useQuery({
    queryKey: ['weather', 'alerts', location],
    queryFn: async () => {
      const response = await fetch(
        `/api/weather/alerts?lat=${location.lat}&lng=${location.lng}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch weather alerts');
      }

      return response.json();
    },
    enabled: !!location,
    staleTime: 300000 // 5 minutes
  });

  const alerts = alertsData?.data?.alerts || [];

  const getSeverityColor = (severity: string): "default" | "destructive" | "secondary" => {
    switch (severity.toLowerCase()) {
      case 'severe':
        return 'destructive';
      case 'moderate':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'wind':
        return <Wind className="h-4 w-4" />;
      case 'rain':
      case 'storm':
        return <CloudRain className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-muted h-12 rounded-md" />
        <div className="animate-pulse bg-muted h-24 rounded-md" />
      </div>
    );
  }

  return (
    <Card className="flex-shrink-0">
      <CardHeader className="py-3 border-b bg-muted/50">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertCircle className="h-4 w-4 text-destructive" />
          Active Weather Alerts
          {alerts.length > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {alerts.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="p-4 space-y-3">
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                No active alerts for this area
              </div>
            ) : (
              alerts.map((alert: WeatherAlert) => (
                <div
                  key={alert.id}
                  className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getIcon(alert.type)}
                      <span className="font-medium capitalize">{alert.type}</span>
                    </div>
                    <Badge 
                      variant={getSeverityColor(alert.severity)} 
                      className="capitalize"
                    >
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{alert.message}</p>
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <time dateTime={alert.startTime}>
                      From: {format(new Date(alert.startTime), 'PPp')}
                    </time>
                    <time dateTime={alert.endTime}>
                      Until: {format(new Date(alert.endTime), 'PPp')}
                    </time>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}