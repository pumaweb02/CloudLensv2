import { Client } from "@googlemaps/google-maps-services-js";

interface SnappedPoint {
  lat: number;
  lng: number;
  confidence: number;
}

interface GPSValidationResult {
  isValid: boolean;
  confidence: number;
  errorMargin: number;
  qualityIndicators: {
    hdop?: number;
    pdop?: number;
    satelliteCount?: number;
  };
}

export class RoadsService {
  private mapsClient: Client;

  constructor() {
    this.mapsClient = new Client({});
  }

  /**
   * Snap a coordinate to the nearest road
   */
  async snapToRoad(lat: number, lng: number): Promise<SnappedPoint | null> {
    try {
      // if (!process.env.GOOGLE_MAPS_API_KEY) {
      //   console.warn("Missing Google Maps API key");
      //   return null;
      // }

      const response = await this.mapsClient.snapToRoads({
        params: {
          path: [{ latitude: lat, longitude: lng }],
          interpolate: true,
          key: process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyAq_TvETnjsrA18ZfiUIgL1wfOOszSz51M',
        },
      });

      if (response.data.snappedPoints && response.data.snappedPoints.length > 0) {
        const snapped = response.data.snappedPoints[0];
        return {
          lat: snapped.location.latitude,
          lng: snapped.location.longitude,
          confidence: snapped.placeId ? 1.0 : 0.8,
        };
      }

      return null;
    } catch (error) {
      console.error("Error snapping to road:", error);
      return null;
    }
  }

  /**
   * Validate GPS metadata and compute quality metrics
   */
  validateGPSData(metadata: any): GPSValidationResult {
    const result: GPSValidationResult = {
      isValid: false,
      confidence: 0,
      errorMargin: 15, // Default error margin in meters
      qualityIndicators: {},
    };

    // Basic validation
    if (!metadata?.gps?.latitude || !metadata?.gps?.longitude) {
      return result;
    }

    // Extract DOP values if available
    if (metadata.GPSDOP) {
      result.qualityIndicators.pdop = parseFloat(metadata.GPSDOP);
    }
    if (metadata.GPSHPositioningError) {
      result.qualityIndicators.hdop = parseFloat(metadata.GPSHPositioningError);
    }

    // Validate coordinate ranges
    const lat = parseFloat(metadata.gps.latitude);
    const lng = parseFloat(metadata.gps.longitude);
    
    if (isNaN(lat) || isNaN(lng) || 
        lat < -90 || lat > 90 || 
        lng < -180 || lng > 180) {
      return result;
    }

    // Calculate confidence based on available quality indicators
    let confidenceScore = 0.8; // Base confidence

    if (result.qualityIndicators.hdop) {
      if (result.qualityIndicators.hdop < 1) confidenceScore = 1.0;
      else if (result.qualityIndicators.hdop < 2) confidenceScore = 0.95;
      else if (result.qualityIndicators.hdop < 5) confidenceScore = 0.90;
      else if (result.qualityIndicators.hdop < 10) confidenceScore = 0.85;
      else confidenceScore = 0.80;

      // Adjust error margin based on HDOP
      result.errorMargin = Math.max(5, result.qualityIndicators.hdop * 3);
    }

    if (result.qualityIndicators.pdop) {
      // Additional confidence adjustment based on PDOP
      const pdopFactor = Math.max(0.8, 1 - (result.qualityIndicators.pdop * 0.1));
      confidenceScore *= pdopFactor;
    }

    result.isValid = true;
    result.confidence = confidenceScore;

    return result;
  }

  /**
   * Calculate distance between two points in meters
   */
  calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = this.toRadians(lat1);
    const φ2 = this.toRadians(lat2);
    const Δφ = this.toRadians(lat2 - lat1);
    const Δλ = this.toRadians(lng2 - lng1);

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
