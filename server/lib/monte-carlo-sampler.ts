import { Client, AddressType, LocationType } from "@googlemaps/google-maps-services-js";
import { GeocodeResult } from "./photo-matcher";

const EARTH_RADIUS_METERS = 6371000; // Earth's radius in meters
const DEFAULT_ERROR_METERS = 15;
const NUM_SAMPLES = 100;

export class MonteCarloSampler {
  private mapsClient: Client;

  constructor() {
    this.mapsClient = new Client({});
  }

  /**
   * Convert meters to degrees at a given latitude
   */
  private metersToDegreesOffset(meters: number, latitude: number): {
    latOffset: number;
    lngOffset: number;
  } {
    // Rough conversion: 1 deg latitude ~ 111,000 meters
    const latOffset = meters / 111000.0;
    // Longitude degrees vary with latitude due to earth's shape
    const lngOffset = meters / (111000.0 * Math.cos(this.toRadians(latitude)));
    return { latOffset, lngOffset };
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Generate sample coordinates using Gaussian distribution
   */
  private generateSampleCoordinates(
    lat: number,
    lng: number,
    errorMeters: number
  ): { lat: number; lng: number } {
    const { latOffset, lngOffset } = this.metersToDegreesOffset(errorMeters, lat);

    // Box-Muller transform for normally distributed random numbers
    const u1 = Math.random();
    const u2 = Math.random();
    const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const z2 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);

    return {
      lat: lat + z1 * latOffset,
      lng: lng + z2 * lngOffset
    };
  }

  /**
   * Perform Monte Carlo sampling for a given coordinate
   */
  async sampleCoordinates(
    latitude: number,
    longitude: number,
    gpsAccuracy?: number
  ): Promise<{
    consensusAddress: string | null;
    confidence: number;
    samples: Array<{
      coordinates: { lat: number; lng: number };
      result: GeocodeResult | null;
    }>;
  }> {
    const errorMeters = gpsAccuracy || DEFAULT_ERROR_METERS;
    const samples: Array<{
      coordinates: { lat: number; lng: number };
      result: GeocodeResult | null;
    }> = [];
    const addressCounts = new Map<string, number>();

    // Generate and geocode samples
    for (let i = 0; i < NUM_SAMPLES; i++) {
      const sampleCoords = this.generateSampleCoordinates(
        latitude,
        longitude,
        errorMeters
      );

      try {
        const response = await this.mapsClient.reverseGeocode({
          params: {
            latlng: sampleCoords,
            key: process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyAq_TvETnjsrA18ZfiUIgL1wfOOszSz51M',
            result_type: [AddressType.street_address, AddressType.premise],
          },
        });

        if (response.data.status === "OK" && response.data.results[0]) {
          const result = response.data.results[0];
          const address = result.formatted_address;
          addressCounts.set(address, (addressCounts.get(address) || 0) + 1);

          samples.push({
            coordinates: sampleCoords,
            result: {
              address: result.formatted_address,
              confidence: result.geometry.location_type === LocationType.ROOFTOP ? 1.0 : 0.9,
              location_type: result.geometry.location_type || LocationType.APPROXIMATE,
              place_id: result.place_id,
              components: this.extractAddressComponents(result.address_components)
            }
          });
        } else {
          samples.push({
            coordinates: sampleCoords,
            result: null
          });
        }
      } catch (error) {
        console.error("Error in reverse geocoding sample:", error);
        samples.push({
          coordinates: sampleCoords,
          result: null
        });
      }

      // Add small delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Find consensus address
    let consensusAddress: string | null = null;
    let maxCount = 0;
    for (const [address, count] of addressCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        consensusAddress = address;
      }
    }

    const confidence = consensusAddress ? maxCount / NUM_SAMPLES : 0;

    return {
      consensusAddress,
      confidence,
      samples
    };
  }

  private extractAddressComponents(components: any[]): {
    streetNumber?: string;
    route?: string;
    locality?: string;
    state?: string;
    zipCode?: string;
  } {
    const result: any = {};

    for (const component of components) {
      if (component.types.includes(AddressType.street_number)) {
        result.streetNumber = component.long_name;
      } else if (component.types.includes(AddressType.route)) {
        result.route = component.long_name;
      } else if (component.types.includes(AddressType.locality)) {
        result.locality = component.long_name;
      } else if (component.types.includes(AddressType.administrative_area_level_1)) {
        result.state = component.short_name;
      } else if (component.types.includes(AddressType.postal_code)) {
        result.zipCode = component.long_name;
      }
    }

    return result;
  }
}