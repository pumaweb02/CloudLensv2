import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CloudRain, Wind, AlertTriangle, Compass, Building2, Map, FileText, Clock, Thermometer, CloudLightning } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface Storm {
  id: number;
  name: string;
  type: string;
  severity: string;
  startTime: string;
  endTime: string | null;
  windSpeed: number;
  windDirection?: string;
  hailSize?: number;
  precipitation?: number;
  center: { lat: number; lng: number };
  radius: number;
  path?: Array<{ lat: number; lng: number }>;
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
    radarImageUrl?: string;
    satelliteImageUrl?: string;
    officialWarnings?: Array<{
      type: string;
      issuedAt: string;
      expiresAt: string;
      description: string;
      source: string;
    }>;
    summary?: string;
    localNewsReports?: Array<{
      source: string;
      title: string;
      url: string;
      date: string;
    }>;
    impactAssessment?: string;
  };
}

interface StormDetailsProps {
  storm: Storm;
  onGenerateReport?: () => void;
}

export function StormDetails({ storm, onGenerateReport }: StormDetailsProps) {
  const getDuration = () => {
    if (!storm.endTime) return "Ongoing";
    const start = new Date(storm.startTime);
    const end = new Date(storm.endTime);
    const hours = Math.abs(end.getTime() - start.getTime()) / 36e5;
    return `${Math.floor(hours)} hours ${Math.round((hours % 1) * 60)} minutes`;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{storm.name}</h2>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Duration: {getDuration()}</span>
          </div>
        </div>
        {onGenerateReport && (
          <Button onClick={onGenerateReport} variant="outline">
            Generate PDF Report
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Event Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="font-medium">Start Time:</span>
              <span>{format(new Date(storm.startTime), "PPP pp")}</span>
            </div>
            {storm.endTime && (
              <div className="flex justify-between">
                <span className="font-medium">End Time:</span>
                <span>{format(new Date(storm.endTime), "PPP pp")}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wind className="h-4 w-4" />
              Wind Conditions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-2xl font-bold">{storm.windSpeed} mph</p>
              {storm.windDirection && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Compass className="h-4 w-4" />
                  Direction: {storm.windDirection}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CloudRain className="h-4 w-4" />
              Precipitation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-2xl font-bold">
                {storm.precipitation ? `${storm.precipitation} in` : 'N/A'}
              </p>
              {storm.hailSize && (
                <p className="text-sm text-muted-foreground">
                  Hail Size: {storm.hailSize}"
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Impact Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-2xl font-bold">
                {(storm.radius / 1609.34).toFixed(1)} mi
              </p>
              <p className="text-sm text-muted-foreground">
                Radius from center
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {storm.metadata?.officialWarnings && storm.metadata.officialWarnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Official Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-4">
                {storm.metadata.officialWarnings.map((warning, index) => (
                  <div key={index} className="border-l-2 border-destructive pl-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{warning.type}</h4>
                      <Badge variant="outline">
                        {format(new Date(warning.issuedAt), "PP p")}
                      </Badge>
                    </div>
                    <p className="text-sm mt-1">{warning.description}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Source: {warning.source}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Visual Evidence Section */}
      {(storm.metadata?.radarImageUrl || storm.metadata?.satelliteImageUrl) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Visual Evidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {storm.metadata.radarImageUrl && (
                <div>
                  <h4 className="font-semibold mb-2">Radar Image</h4>
                  <img
                    src={storm.metadata.radarImageUrl}
                    alt="Storm Radar"
                    className="rounded-lg w-full"
                  />
                </div>
              )}
              {storm.metadata.satelliteImageUrl && (
                <div>
                  <h4 className="font-semibold mb-2">Satellite Image</h4>
                  <img
                    src={storm.metadata.satelliteImageUrl}
                    alt="Storm Satellite"
                    className="rounded-lg w-full"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Impact Summary */}
      {storm.metadata?.impactAssessment && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Impact Assessment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line">
              {storm.metadata.impactAssessment}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Local News & Community Reports */}
      {storm.metadata?.localNewsReports && storm.metadata.localNewsReports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Local News Coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-4">
                {storm.metadata.localNewsReports.map((report, index) => (
                  <div key={index} className="border-l-2 border-primary pl-4">
                    <h4 className="font-semibold">{report.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {report.source} - {format(new Date(report.date), "PP")}
                    </p>
                    <a
                      href={report.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Read More
                    </a>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Affected Areas Section */}
      {(storm.metadata?.affectedCounties?.length || storm.metadata?.affectedCities?.length) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Affected Areas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {storm.metadata.affectedCounties && (
              <div>
                <h4 className="font-semibold mb-2">Counties:</h4>
                <div className="flex flex-wrap gap-2">
                  {storm.metadata.affectedCounties.map((county, index) => (
                    <Badge key={index} variant="secondary">{county}</Badge>
                  ))}
                </div>
              </div>
            )}
            {storm.metadata.affectedCities && (
              <div>
                <h4 className="font-semibold mb-2">Cities:</h4>
                <div className="flex flex-wrap gap-2">
                  {storm.metadata.affectedCities.map((city, index) => (
                    <Badge key={index} variant="secondary">{city}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Damage Reports Section */}
      {storm.metadata?.reportedDamage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Damage Reports
            </CardTitle>
            {storm.metadata.reportedDamage.description && (
              <CardDescription>
                {storm.metadata.reportedDamage.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-4">
                {storm.metadata.reportedDamage.locations.map((location, index) => (
                  <div key={index} className="border-l-2 border-primary pl-4">
                    <p className="font-medium">{location.address}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{location.damageType}</Badge>
                      <Badge variant="outline">{location.severity}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Storm Summary Section */}
      {storm.metadata?.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Event Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {storm.metadata.summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Storm Path Section */}
      {storm.path && storm.path.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Storm Path Coordinates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {storm.path.map((point, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span>Point {index + 1}</span>
                    <span className="text-muted-foreground font-mono">
                      {point.lat.toFixed(4)}°N, {point.lng.toFixed(4)}°W
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}