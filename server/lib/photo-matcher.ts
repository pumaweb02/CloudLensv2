import { eq, and } from "drizzle-orm";
import { db } from "@db";
import { photos, properties } from "@db/schema";
import type { Property, Photo } from "@db/schema";
import { Client } from "@googlemaps/google-maps-services-js";
import { z } from "zod";
import * as turf from "@turf/turf";

interface MatchResult {
  propertyId: string | null;
  confidence: number;
  matchMethod: string;
  matchFactors?: {
    gpsAccuracy?: number;
    addressSimilarity?: number;
    temporalConsistency?: number;
    [key: string]: number | undefined;
  };
}

interface CachedProperty {
  timestamp: number;
  data: RegridProperty;
}

const propertyCache = new Map<string, CachedProperty>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export class PhotoMatcher {
  private readonly MAX_DISTANCE_METERS = 15;
  private readonly MIN_TOTAL_CONFIDENCE = 0.99;
  private readonly regridApiKey: string;

  constructor(apiKey: string) {
    this.regridApiKey = apiKey;
    if (!this.regridApiKey) {
      throw new Error("REGRID_API_KEY is required");
    }
  }

  async findMatchingProperty(
    photo: Photo,
    batchPhotos: Photo[] = []
  ): Promise<MatchResult> {
    try {
      // Step 1: Validate photo coordinates
      const latitude = Number(photo.latitude);
      const longitude = Number(photo.longitude);

      if (isNaN(latitude) || isNaN(longitude) || !latitude || !longitude) {
        console.log("No valid coordinates for photo:", photo.id);
        return { 
          propertyId: null, 
          confidence: 0, 
          matchMethod: 'no_coordinates' 
        };
      }

      // Step 2: Check cached property data
      const cacheKey = `${latitude},${longitude}`;
      let property = this.getCachedProperty(cacheKey);

      // Step 3: If not cached, decide search radius based on area density
      const radius = await this.isHighDensityArea(latitude, longitude) ? 20 : 50;
      if (!property) {
        property = await this.queryRegridProperty(latitude, longitude, radius);
        if (property) {
          this.cachePropertyProfile(cacheKey, property);
        }
      }

      if (!property) {
        console.log("No Regrid data found for coordinates:", latitude, longitude);
        return { 
          propertyId: null, 
          confidence: 0, 
          matchMethod: 'no_regrid_data' 
        };
      }

      // Step 4: Validate that the photo coordinate falls within the parcel boundary
      if (!this.isWithinParcel(latitude, longitude, property.boundary)) {
        console.log("Coordinates outside parcel boundary");
        return { 
          propertyId: null, 
          confidence: 0, 
          matchMethod: 'coordinate_outside_parcel' 
        };
      }

      // Step 5: Compute additional confidence metrics
      const propertyCenter = turf.center(property.boundary);
      const distance = turf.distance(
        turf.point([longitude, latitude]),
        propertyCenter,
        { units: 'meters' }
      );

      let confidence = 1.0;
      if (distance > 20) confidence -= 0.2;

      if (confidence < this.MIN_TOTAL_CONFIDENCE) {
        console.log("Low confidence match:", confidence);
        return { 
          propertyId: null, 
          confidence, 
          matchMethod: 'low_confidence' 
        };
      }

      // Step 6: Save/update the property profile
      const propertyId = await this.updatePropertyProfile(property);

      // Return successful match result
      return {
        propertyId: String(propertyId),
        confidence,
        matchMethod: 'regrid_parcel_match'
      };

    } catch (error) {
      console.error("Error in findMatchingProperty:", error);
      return {
        propertyId: null,
        confidence: 0,
        matchMethod: 'error',
      };
    }
  }

  private getCachedProperty(key: string): RegridProperty | null {
    const cached = propertyCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > CACHE_TTL) {
      propertyCache.delete(key);
      return null;
    }

    return cached.data;
  }

  private cachePropertyProfile(key: string, property: RegridProperty): void {
    propertyCache.set(key, {
      timestamp: Date.now(),
      data: property
    });
  }

  private async isHighDensityArea(lat: number, lng: number): Promise<boolean> {
    try {
      const response = await this.queryRegridProperty(lat, lng, 50, true);
      return (response?.nearbyParcelCount ?? 0) > 3;
    } catch (error) {
      console.error("Error checking area density:", error);
      return false;
    }
  }

  private isWithinParcel(lat: number, lng: number, boundary: GeoJSON.Feature<GeoJSON.Polygon, any>): boolean {
    const point = turf.point([lng, lat]);
    return turf.booleanPointInPolygon(point, boundary);
  }

  private async updatePropertyProfile(property: RegridProperty): Promise<number> {
    try {
      const propertyData = {
        address: property.address.street,
        city: property.address.city,
        state: property.address.state,
        zipCode: property.address.zipCode,
        latitude: String(property.coordinates.latitude),
        longitude: String(property.coordinates.longitude),
        parcelNumber: property.parcelNumber,
        yearBuilt: property.yearBuilt,
        propertyValue: property.propertyValue?.total,
        improvementValue: property.propertyValue?.improvements,
        landValue: property.propertyValue?.land,
        useDescription: property.useDescription,
        zoning: property.zoning?.code,
        zoningDescription: property.zoning?.description,
        ownerType: this.determineOwnerType(property.ownerInfo.name),
        ownerCareOf: property.ownerInfo.careOf,
        ownerMailingStreet: property.ownerInfo.mailingAddress.street,
        ownerMailingCity: property.ownerInfo.mailingAddress.city,
        ownerMailingState: property.ownerInfo.mailingAddress.state,
        ownerMailingZip: property.ownerInfo.mailingAddress.zipCode,
        ownerMailingCountry: property.ownerInfo.mailingAddress.country,
        lastOwnerUpdate: new Date(),
        status: 'pending' as const,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Check if property exists
      const [existingProperty] = await db
        .select()
        .from(properties)
        .where(
          and(
            eq(properties.latitude, String(property.coordinates.latitude)),
            eq(properties.longitude, String(property.coordinates.longitude))
          )
        )
        .limit(1);

      if (existingProperty) {
        console.log("Updating existing property:", existingProperty.id);
        await db
          .update(properties)
          .set({
            ...propertyData,
            status: existingProperty.status
          })
          .where(eq(properties.id, existingProperty.id));
        return existingProperty.id;
      } else {
        console.log("Creating new property with data:", propertyData);
        const [newProperty] = await db
          .insert(properties)
          .values(propertyData)
          .returning();

        if (!newProperty) {
          throw new Error("Failed to create property");
        }

        console.log("Created new property:", newProperty.id);
        return newProperty.id;
      }

    } catch (error) {
      console.error("Error in updatePropertyProfile:", error);
      throw error;
    }
  }

  private determineOwnerType(name: string): string {
    const lname = name.toLowerCase();
    if (lname.includes('llc') || lname.includes('inc') || lname.includes('corp') ||
        lname.includes('trust') || lname.includes('properties')) {
      return 'business';
    }
    if (lname.includes('city of') || lname.includes('county') ||
        lname.includes('state of') || lname.includes('department')) {
      return 'government';
    }
    return 'individual';
  }
}

interface RegridProperty {
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  coordinates: {
    latitude: number;
    longitude: number;
  };
  parcelNumber: string;
  yearBuilt: number;
  propertyValue?: {
    total: number;
    improvements: number;
    land: number;
  };
  useDescription: string;
  zoning?: {
    code: string;
    description: string;
  };
  ownerInfo: {
    name: string;
    careOf?: string;
    mailingAddress: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
  };
  boundary: GeoJSON.Feature<GeoJSON.Polygon, any>;
  nearbyParcelCount?: number;
}

// Extend GeoJSON types
declare module 'geojson' {
  export interface Feature<G extends GeoJSON.Geometry, P = GeoJSON.GeoJsonProperties> {
    type: 'Feature';
    geometry: G;
    properties: P;
  }
}