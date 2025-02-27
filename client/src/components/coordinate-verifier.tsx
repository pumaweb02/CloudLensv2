import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Icons } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, MapPin } from "lucide-react";

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface CoordinateVerifierProps {
  coordinates: Coordinates;
  propertyId?: number;
  onCoordinatesVerified?: (correctedCoordinates: Coordinates) => void;
  className?: string;
}

export function CoordinateVerifier({
  coordinates,
  propertyId,
  onCoordinatesVerified,
  className
}: CoordinateVerifierProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/verify-coordinates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          propertyId
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to verify coordinates");
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.needsCorrection && data.corrected) {
        toast({
          title: "Coordinate Correction Suggested",
          description: data.message,
          variant: "warning",
        });
      } else {
        toast({
          title: "Coordinates Verified",
          description: data.message,
          variant: "default",
        });
      }

      if (data.corrected && onCoordinatesVerified) {
        onCoordinatesVerified({
          latitude: data.corrected.lat,
          longitude: data.corrected.lng
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : "Failed to verify coordinates",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsVerifying(false);
    }
  });

  const handleVerify = () => {
    setIsVerifying(true);
    verifyMutation.mutate();
  };

  return (
    <Card className={cn("p-4", className)}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h4 className="text-sm font-medium">Coordinates</h4>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleVerify}
            disabled={isVerifying}
          >
            {isVerifying ? (
              <>
                <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                Verifying
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Verify
              </>
            )}
          </Button>
        </div>

        {verifyMutation.isSuccess && (
          <Alert variant={verifyMutation.data.needsCorrection ? "warning" : "default"}>
            <AlertTitle className="flex items-center space-x-2">
              {verifyMutation.data.needsCorrection ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span>{verifyMutation.data.needsCorrection ? "Correction Suggested" : "Verified"}</span>
            </AlertTitle>
            <AlertDescription className="mt-2">
              <div className="space-y-2">
                <p>{verifyMutation.data.message}</p>
                {verifyMutation.data.corrected && (
                  <div className="space-y-1">
                    <Badge variant="outline" className="mb-2">
                      Suggested Location
                    </Badge>
                    <p className="text-sm">
                      {verifyMutation.data.corrected.address}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {verifyMutation.data.corrected.lat.toFixed(6)}, {verifyMutation.data.corrected.lng.toFixed(6)}
                    </p>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Card>
  );
}
