import { forwardRef } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wind, AlertTriangle, Cloud } from "lucide-react";

interface StormEvent {
  id: number;
  type: string;
  name: string;
  severity: string;
  windSpeed: number;
  startTime: string;
  endTime: string;
  damages?: string[];
  affectedCount: number;
}

interface StormReportProps {
  address: string;
  events: StormEvent[];
  totalDamage?: number;
  riskLevel?: string;
}

export const StormReport = forwardRef<HTMLDivElement, StormReportProps>(
  ({ address, events, totalDamage, riskLevel }, ref) => {
    return (
      <div ref={ref} className="p-8 max-w-4xl mx-auto bg-white">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Storm History Report</h1>
          <p className="text-lg text-muted-foreground">{address}</p>
          <p className="text-sm text-muted-foreground">
            Generated on {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wind className="h-4 w-4" />
                Total Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{events.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Properties Affected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {events.reduce((sum, event) => sum + event.affectedCount, 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Cloud className="h-4 w-4" />
                Risk Level
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{riskLevel || "Moderate"}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Storm Event History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Wind Speed</TableHead>
                  <TableHead>Properties Affected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      {format(new Date(event.startTime), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="capitalize">{event.type}</TableCell>
                    <TableCell className="capitalize">{event.severity}</TableCell>
                    <TableCell>{event.windSpeed} mph</TableCell>
                    <TableCell>{event.affectedCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {events.some(event => event.damages && event.damages.length > 0) && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Detailed Damage History</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {events
                  .filter(event => event.damages && event.damages.length > 0)
                  .map((event) => (
                    <li key={event.id}>
                      <h4 className="font-medium mb-1">
                        {format(new Date(event.startTime), "MMMM d, yyyy")} - {event.name}
                      </h4>
                      <ul className="list-disc pl-5 text-sm text-muted-foreground">
                        {event.damages?.map((damage, index) => (
                          <li key={index}>{damage}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 text-sm text-muted-foreground">
          <p>
            This report provides historical storm data for the specified address and surrounding area.
            Past weather events may not be indicative of future weather patterns.
          </p>
        </div>
      </div>
    );
  }
);

StormReport.displayName = "StormReport";
