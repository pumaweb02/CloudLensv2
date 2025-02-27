import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "@db";
import { photos, properties } from "@db/schema";
import { PhotoMatcher } from "../lib/photo-matcher";
import type { Photo } from "@db/schema";
import { Client } from "@googlemaps/google-maps-services-js";

// Initialize Google Maps client
const googleMapsClient = new Client({});

interface PropertyBoundary {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface ValidationResult {
  isValid: boolean;
  confidence: number;
  checks: {
    spatialValidation: {
      score: number;
      details: {
        coordinateMatch: boolean;
        distanceCheck: boolean;
        bearingCheck: boolean;
        boundaryCheck: boolean;
      };
    };
    metadataValidation: {
      score: number;
      details: {
        timestampValid: boolean;
        altitudeValid: boolean;
        orientationValid: boolean;
      };
    };
  };
  details: {
    distance: number;
    bearing: number;
    altitude: number | null;
    timestamp: string | null;
  };
}

export class PhotoProcessingService {
  private photoMatcher: PhotoMatcher;

  // Updated validation thresholds for stricter matching
  private readonly MAX_DISTANCE_METERS = 15;
  private readonly MIN_TOTAL_CONFIDENCE = 0.99;
  private readonly MAX_COORDINATE_DIFF = 0.00008;
  private readonly MAX_BATCH_SIZE = 50;

  private readonly COORDINATE_WEIGHT = 0.50;
  private readonly DISTANCE_WEIGHT = 0.35;
  private readonly BEARING_WEIGHT = 0.10;
  private readonly BOUNDARY_WEIGHT = 0.05;

  private readonly TIMESTAMP_WEIGHT = 0.50;
  private readonly ALTITUDE_WEIGHT = 0.30;
  private readonly ORIENTATION_WEIGHT = 0.20;

  constructor() {
    this.photoMatcher = new PhotoMatcher();
    this.photoMatcher.configure({
      maxDistance: this.MAX_DISTANCE_METERS,
      minConfidence: this.MIN_TOTAL_CONFIDENCE,
      maxCoordinateDiff: this.MAX_COORDINATE_DIFF
    });
  }

  private calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const λ1 = (lon1 * Math.PI) / 180;
    const λ2 = (lon2 * Math.PI) / 180;

    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
    const θ = Math.atan2(y, x);

    return (θ * 180 / Math.PI + 360) % 360;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private validateTimestamp(photoTimestamp: Date | null): { isValid: boolean; score: number } {
    if (!photoTimestamp) return { isValid: false, score: 0 };

    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    // Photo should not be from the future and not older than 1 year
    const isValid = photoTimestamp <= now && photoTimestamp >= oneYearAgo;
    const score = isValid ? 1 : 0;

    return { isValid, score };
  }

  private validateAltitude(
    photoAltitude: number | null,
    propertyAltitude: number | null
  ): { isValid: boolean; score: number } {
    if (!photoAltitude || !propertyAltitude) return { isValid: true, score: 0.5 };

    const altitudeDiff = Math.abs(photoAltitude - propertyAltitude);
    const maxAltitudeDiff = 100; // meters

    const isValid = altitudeDiff <= maxAltitudeDiff;
    const score = isValid ? 1 - (altitudeDiff / maxAltitudeDiff) : 0;

    return { isValid, score };
  }

  private validatePropertyBoundary(
    photoLat: number,
    photoLon: number,
    boundary: PropertyBoundary
  ): { isValid: boolean; score: number } {
    const isWithinBoundary =
      photoLat <= boundary.north &&
      photoLat >= boundary.south &&
      photoLon <= boundary.east &&
      photoLon >= boundary.west;

    if (!isWithinBoundary) return { isValid: false, score: 0 };

    // Calculate how centered the photo is within the boundary
    const latCenter = (boundary.north + boundary.south) / 2;
    const lonCenter = (boundary.east + boundary.west) / 2;

    const distanceToCenter = this.calculateDistance(photoLat, photoLon, latCenter, lonCenter);
    const maxDistance = this.calculateDistance(boundary.north, boundary.east, boundary.south, boundary.west) / 2;

    const score = 1 - (distanceToCenter / maxDistance);

    return { isValid: true, score };
  }

  private async validatePhoto(
    photo: Photo,
    propertyLat: number,
    propertyLon: number,
    propertyAddress: string,
    boundary: PropertyBoundary
  ): Promise<ValidationResult> {
    const photoLat = typeof photo.latitude === 'string' ? parseFloat(photo.latitude) : photo.latitude;
    const photoLon = typeof photo.longitude === 'string' ? parseFloat(photo.longitude) : photo.longitude;
    const photoAltitude = typeof photo.altitude === 'string' ? parseFloat(photo.altitude) : photo.altitude;

    // 1. Spatial Validation
    const distance = this.calculateDistance(photoLat, photoLon, propertyLat, propertyLon);
    const bearing = this.calculateBearing(propertyLat, propertyLon, photoLat, photoLon);
    const coordinateDiff = Math.sqrt(
      Math.pow(Math.abs(photoLat - propertyLat), 2) +
      Math.pow(Math.abs(photoLon - propertyLon), 2)
    );

    const coordinateMatch = coordinateDiff <= this.MAX_COORDINATE_DIFF;
    const distanceCheck = distance <= this.MAX_DISTANCE_METERS;
    const bearingCheck = Math.abs(bearing) <= 45 || Math.abs(bearing - 360) <= 45;
    const boundaryValidation = this.validatePropertyBoundary(photoLat, photoLon, boundary);

    const spatialScore =
      (coordinateMatch ? this.COORDINATE_WEIGHT : 0) +
      (distanceCheck ? this.DISTANCE_WEIGHT : 0) +
      (bearingCheck ? this.BEARING_WEIGHT : 0) +
      (boundaryValidation.score * this.BOUNDARY_WEIGHT);

    // 2. Metadata Validation
    const timestampValidation = this.validateTimestamp(photo.takenAt);
    const altitudeValidation = this.validateAltitude(photoAltitude, null);
    const orientationValid = true; // TODO: Implement orientation validation

    const metadataScore =
      (timestampValidation.score * this.TIMESTAMP_WEIGHT) +
      (altitudeValidation.score * this.ALTITUDE_WEIGHT) +
      (orientationValid ? this.ORIENTATION_WEIGHT : 0);

    // 3. Calculate Total Confidence
    const totalConfidence = (spatialScore * 0.7) + (metadataScore * 0.3);

    // Log validation details
    console.log(`Validation results for photo ${photo.id} at ${propertyAddress}:`, {
      spatial: {
        distance,
        bearing,
        coordinateDiff,
        score: spatialScore
      },
      metadata: {
        timestamp: photo.takenAt,
        altitude: photoAltitude,
        score: metadataScore
      },
      totalConfidence
    });

    return {
      isValid: totalConfidence >= this.MIN_TOTAL_CONFIDENCE,
      confidence: totalConfidence,
      checks: {
        spatialValidation: {
          score: spatialScore,
          details: {
            coordinateMatch,
            distanceCheck,
            bearingCheck,
            boundaryCheck: boundaryValidation.isValid
          }
        },
        metadataValidation: {
          score: metadataScore,
          details: {
            timestampValid: timestampValidation.isValid,
            altitudeValid: altitudeValidation.isValid,
            orientationValid
          }
        }
      },
      details: {
        distance,
        bearing,
        altitude: photoAltitude,
        timestamp: photo.takenAt?.toISOString() || null
      }
    };
  }

  async processPhoto(photoId: number): Promise<void> {
    try {
      console.log(`Starting to process photo ${photoId}`);

      const photo = await db.query.photos.findFirst({
        where: eq(photos.id, photoId)
      });

      if (!photo) {
        throw new Error(`Photo ${photoId} not found`);
      }

      if (!photo.latitude || !photo.longitude) {
        await this.markPhotoAsUnassigned(photoId, "Missing GPS coordinates");
        return;
      }

      const batchPhotos = photo.batchId ?
        await db.query.photos.findMany({
          where: eq(photos.batchId, photo.batchId),
          limit: this.MAX_BATCH_SIZE
        }) : [];

      console.log(`Processing photo with coordinates: ${photo.latitude}, ${photo.longitude}`);
      console.log(`Batch context: ${batchPhotos.length} related photos`);

      const matchResult = await this.photoMatcher.findMatchingProperty(photo, batchPhotos);

      if (matchResult.propertyId && matchResult.confidence >= this.MIN_TOTAL_CONFIDENCE) {
        console.log(`Found matching property ${matchResult.propertyId} with confidence ${matchResult.confidence}`);

        const property = await db.query.properties.findFirst({
          where: (properties, { eq }) => eq(properties.id, matchResult.propertyId)
        });

        if (!property) {
          throw new Error(`Property ${matchResult.propertyId} not found`);
        }

        await db.update(photos)
          .set({
            propertyId: matchResult.propertyId,
            processingStatus: "processed" as const,
            propertyMatchConfidence: matchResult.confidence,
            metadata: JSON.stringify({
              ...JSON.parse(JSON.stringify(photo.metadata || {})),
              match_result: {
                method: matchResult.matchMethod,
                processed_at: new Date().toISOString(),
                confidence: matchResult.confidence,
                factors: matchResult.matchFactors
              }
            })
          })
          .where(eq(photos.id, photoId));

        console.log(`Successfully processed and assigned photo ${photoId}`);
      } else {
        const reason = matchResult.confidence ?
          `Confidence ${matchResult.confidence} below required threshold ${this.MIN_TOTAL_CONFIDENCE}` :
          "No matching property found";

        console.log(`Photo ${photoId} marked as unassigned: ${reason}`);
        await this.markPhotoAsUnassigned(photoId, reason);
      }

    } catch (error) {
      console.error(`Error processing photo ${photoId}:`, error);
      await this.markPhotoAsUnassigned(photoId, error instanceof Error ? error.message : String(error));
    }
  }

  private async markPhotoAsUnassigned(photoId: number, reason: string): Promise<void> {
    console.log(`Marking photo ${photoId} as unassigned. Reason: ${reason}`);

    await db.update(photos)
      .set({
        propertyId: null,
        processingStatus: "pending",
        propertyMatchConfidence: null,
        metadata: {
          unassigned_reason: reason,
          updated_at: new Date().toISOString()
        }
      })
      .where(eq(photos.id, photoId));
  }

  async revalidatePhotoAssignments(): Promise<void> {
    const assignedPhotos = await db.query.photos.findMany({
      where: sql`property_id IS NOT NULL`
    });

    console.log(`Revalidating ${assignedPhotos.length} assigned photos`);

    for (const photo of assignedPhotos) {
      await this.processPhoto(photo.id);
    }
  }

  async getUnassignedPhotos(): Promise<Photo[]> {
    return await db.query.photos.findMany({
      where: and(
        isNull(photos.propertyId),
        eq(photos.processingStatus, "pending" as const)
      )
    });
  }

  async processPendingPhotos(): Promise<void> {
    const pendingPhotos = await db.query.photos.findMany({
      where: eq(photos.processingStatus, "pending" as const)
    });

    console.log(`Processing ${pendingPhotos.length} pending photos`);

    for (const photo of pendingPhotos) {
      try {
        await this.processPhoto(photo.id);
      } catch (error) {
        console.error(`Failed to process photo ${photo.id}:`, error);
        await this.markPhotoAsUnassigned(photo.id, error instanceof Error ? error.message : String(error));
      }
    }
  }

  async manuallyAssignPhoto(photoId: number, propertyId: number): Promise<void> {
    const photo = await db.query.photos.findFirst({
      where: eq(photos.id, photoId)
    });

    const property = await db.query.properties.findFirst({
      where: eq(properties.id, propertyId)
    });

    if (!photo || !property) {
      throw new Error('Photo or property not found');
    }

    const boundary: PropertyBoundary = {
      north: Number(property.latitude) + 0.0001,
      south: Number(property.latitude) - 0.0001,
      east: Number(property.longitude) + 0.0001,
      west: Number(property.longitude) - 0.0001
    };

    const validation = await this.validatePhoto(
      photo,
      Number(property.latitude),
      Number(property.longitude),
      property.address,
      boundary
    );

    // For manual assignments, we still validate but allow assignment with warning
    await db.update(photos)
      .set({
        propertyId,
        processingStatus: "processed" as const,
        metadata: JSON.stringify({
          match_result: {
            method: "manual_assignment",
            processed_at: new Date().toISOString(),
            confidence: validation.confidence,
            manual_override: true,
            validation_details: validation
          }
        })
      })
      .where(eq(photos.id, photoId));
  }
}