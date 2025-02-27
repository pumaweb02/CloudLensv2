import fs from "fs/promises";
import path from "path";
import ExifParser from "exif-parser";
import { photos, properties, scan_batches } from "@db/schema";
import { db } from "@db";
import { eq, and } from "drizzle-orm";
import { Client } from "@googlemaps/google-maps-services-js";

// Initialize Google Maps client with proper options
const googleMapsClient = new Client({});

// Define upload directory - ensure it exists
const UPLOAD_DIR = "uploads";
const THUMBNAIL_DIR = path.join(UPLOAD_DIR, "thumbnails");

// Ensure directories exist
async function ensureUploadDirs() {
  try {
    await fs.access(UPLOAD_DIR);
    await fs.access(THUMBNAIL_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.mkdir(THUMBNAIL_DIR, { recursive: true });
  }
}


// Initialize storage
ensureUploadDirs().catch(console.error);

/**
 * Get the full path for a stored photo
 */
function getPhotoPath(filename: string): string {
  return path.join(UPLOAD_DIR, filename);
}

/**
 * Get the thumbnail path for a photo
 */
function getThumbnailPath(filename: string): string {
  return path.join(THUMBNAIL_DIR, filename);
}

/**
 * Delete a photo file from storage
 */
async function deletePhoto(filename: string): Promise<void> {
  const filepath = getPhotoPath(filename);
  try {
    await fs.unlink(filepath);
    // Also try to delete thumbnail if it exists
    const thumbnailPath = getThumbnailPath(filename);
    await fs.unlink(thumbnailPath).catch(() => {}); // Ignore if thumbnail doesn't exist
  } catch (error) {
    console.error(`Error deleting photo ${filename}:`, error);
    throw error;
  }
}

/**
 * Save photo metadata to database
 */
async function savePhotoMetadata(data: {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  userId: number;
  propertyId?: number | null;
  batchId?: number | null;
  metadata: any;
  gpsData?: {
    latitude?: number | null;
    longitude?: number | null;
    altitude?: number | null;
  };
}) {
  try {
    console.log("[PhotoUtils] Saving photo metadata:", {
      filename: data.filename,
      gpsData: data.gpsData
    });

    // Extract GPS data if available
    const { latitude, longitude, altitude } = data.gpsData || {};

    // Save to database with proper types
    const [photo] = await db
      .insert(photos)
      .values({
        filename: data.filename,
        originalName: data.originalName,
        mimeType: data.mimeType,
        size: data.size,
        userId: data.userId,
        propertyId: data.propertyId || null,
        batchId: data.batchId || null,
        metadata: data.metadata,
        latitude: latitude || null,
        longitude: longitude || null,
        altitude: altitude || null,
        processingStatus: "pending",
        storageLocation: getPhotoPath(data.filename),
        thumbnailPath: getThumbnailPath(data.filename),
        uploadedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return photo;
  } catch (error) {
    console.error('Error saving photo metadata:', error);
    throw error;
  }
}

/**
 * Extract GPS coordinates from EXIF data
 */
async function readExifData(filepath: string): Promise<ExifParser.Output | null> {
  try {
    const buffer = await fs.readFile(filepath);
    const parser = ExifParser.create(buffer);
    return parser.parse();
  } catch (error) {
    console.error(`Error reading EXIF data from ${filepath}:`, error);
    return null;
  }
}

/**
 * Get photo details from database
 */
async function getPhotoDetails(photoId: number) {
  const photo = await db.query.photos.findFirst({
    where: eq(photos.id, photoId),
    with: {
      property: true,
      batch: true
    }
  });
  return photo;
}

/**
 * Get all photos for a property
 */
async function getPropertyPhotos(propertyId: number) {
  const propertyPhotos = await db.query.photos.findMany({
    where: and(
      eq(photos.propertyId, propertyId),
      eq(photos.isDeleted, false)
    ),
    orderBy: (photos, { desc }) => [desc(photos.createdAt)]
  });
  return propertyPhotos;
}

/**
 * Get MIME type from filename
 */
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.tiff':
    case '.tif':
      return 'image/tiff';
    case '.heic':
      return 'image/heic';
    case '.raw':
      return 'image/raw';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Try to match photo to a property using GPS coordinates
 */
async function matchPhotoToProperty(photoId: number, latitude: number, longitude: number): Promise<number | null> {
  try {
    // Check for API key first
    // if (!process.env.GOOGLE_MAPS_API_KEY) {
    //   console.error("[PhotoUtils] Google Maps API key not configured");
    //   throw new Error("Google Maps API key not configured");
    // }

    console.log(`[PhotoUtils] Attempting to match photo ${photoId} to property at ${latitude}, ${longitude}`);

    // Validate coordinates
    if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
      throw new Error("Invalid coordinates provided");
    }

    // First try to find nearby properties in our database
    const nearbyProperties = await db.query.properties.findMany({
      where: and(
        eq(properties.isDeleted, false)
      ),
    });

    // Calculate distances and find the closest property
    let closestProperty = null;
    let minDistance = Infinity;

    for (const property of nearbyProperties) {
      if (property.latitude && property.longitude) {
        const distance = calculateDistance(
          latitude,
          longitude,
          Number(property.latitude),
          Number(property.longitude)
        );

        if (distance < minDistance && distance < 0.1) { // Within 100 meters
          minDistance = distance;
          closestProperty = property;
        }
      }
    }

    if (closestProperty) {
      console.log(`[PhotoUtils] Found matching property: ${closestProperty.id} at distance ${minDistance}km`);
      return closestProperty.id;
    }

    // If no existing property found, try to geocode the location
    const response = await googleMapsClient.reverseGeocode({
      params: {
        latlng: { lat: latitude, lng: longitude },
        key: 'AIzaSyAq_TvETnjsrA18ZfiUIgL1wfOOszSz51M'
      }
    });

    if (response.data.results && response.data.results.length > 0) {
      const result = response.data.results[0];
      const addressComponents = result.address_components;

      // Extract address components
      const componentMap: { [key: string]: string } = {};
      addressComponents.forEach(component => {
        component.types.forEach(type => {
          componentMap[type] = component.long_name;
        });
      });

      const streetNumber = componentMap['street_number'];
      const route = componentMap['route'];
      const city = componentMap['locality'];
      const state = componentMap['administrative_area_level_1'];
      const zipCode = componentMap['postal_code'];

      // Only create property if we have enough address information
      if (streetNumber && route) {
        console.log(`[PhotoUtils] Creating new property for address: ${streetNumber} ${route}`);

        // Create a new property with all required fields
        const [newProperty] = await db
          .insert(properties)
          .values({
            address: `${streetNumber} ${route}`.trim(),
            city: city || 'Unknown',
            state: state || 'Unknown',
            zipCode: zipCode || '00000',
            latitude: latitude.toString(),
            longitude: longitude.toString(),
            status: "active",
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();

        console.log(`[PhotoUtils] Created new property: ${newProperty.id}`);
        return newProperty.id;
      } else {
        console.log(`[PhotoUtils] Insufficient address information for property creation`);
        throw new Error("Insufficient address information from geocoding");
      }
    }

    throw new Error("No valid property match found");
  } catch (error) {
    console.error('[PhotoUtils] Error matching photo to property:', error);
    throw error; // Propagate error to be handled by caller
  }
}

async function processPhoto(photoId: number): Promise<void> {
  try {
    const photo = await getPhotoDetails(photoId);
    if (!photo) {
      throw new Error(`Photo ${photoId} not found`);
    }

    console.log(`[PhotoUtils] Processing photo ${photoId}`);

    // Read EXIF data
    const exifData = await readExifData(photo.storageLocation);
    if (!exifData || !exifData.tags) {
      console.error(`[PhotoUtils] No valid EXIF data found for photo ${photoId}`);
      await db
        .update(photos)
        .set({
          processingStatus: "failed",
          metadata: {
            error: "No valid EXIF data found",
            status: "failed"
          }
        })
        .where(eq(photos.id, photoId));
      return;
    }

    const { latitude, longitude, gpsAltitude } = exifData.tags;
    console.log(`[PhotoUtils] Extracted GPS data:`, { latitude, longitude, gpsAltitude });

    // Update photo with GPS data
    await db
      .update(photos)
      .set({
        latitude: latitude || null,
        longitude: longitude || null,
        altitude: gpsAltitude || null,
        processingStatus: "processing"
      })
      .where(eq(photos.id, photoId));

    // Try to match to a property if we have coordinates
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      try {
        const propertyId = await matchPhotoToProperty(photoId, latitude, longitude);
        console.log(`[PhotoUtils] Property match result:`, { photoId, propertyId });

        if (propertyId) {
          await db
            .update(photos)
            .set({
              propertyId: propertyId,
              processingStatus: "processed",
              metadata: {
                matchedAt: new Date().toISOString(),
                status: "processed"
              }
            })
            .where(eq(photos.id, photoId));
        } else {
          throw new Error("No property match found");
        }
      } catch (matchError) {
        console.error(`[PhotoUtils] Error matching photo to property:`, matchError);
        await db
          .update(photos)
          .set({
            processingStatus: "failed",
            metadata: {
              error: matchError instanceof Error ? matchError.message : "Unknown error during property matching",
              status: "failed"
            }
          })
          .where(eq(photos.id, photoId));
      }
    } else {
      console.log(`[PhotoUtils] No valid coordinates for photo ${photoId}`);
      await db
        .update(photos)
        .set({
          processingStatus: "failed",
          metadata: {
            error: "No valid GPS coordinates found",
            status: "failed"
          }
        })
        .where(eq(photos.id, photoId));
    }
  } catch (error) {
    console.error(`[PhotoUtils] Error processing photo ${photoId}:`, error);
    await db
      .update(photos)
      .set({
        processingStatus: "failed",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error during processing",
          status: "failed"
        }
      })
      .where(eq(photos.id, photoId));
  }
}

/**
 * Calculate distance between two points in kilometers
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Delete photo record and file
 */
async function deletePhotoRecord(photoId: number): Promise<boolean> {
  try {
    const photo = await getPhotoDetails(photoId);
    if (!photo) {
      return false;
    }

    // Delete the files first
    await deletePhoto(photo.filename);

    // Then update database record
    await db
      .update(photos)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(photos.id, photoId));

    return true;
  } catch (error) {
    console.error(`Error deleting photo ${photoId}:`, error);
    return false;
  }
}

/**
 * Validate file type
 */
function isValidFileType(mimeType: string): boolean {
  const validTypes = [
    'image/jpeg',
    'image/png',
    'image/tiff',
    'image/heic',
    'image/raw'
  ];
  return validTypes.includes(mimeType);
}

/**
 * Clean up orphaned files
 */
async function cleanupOrphanedFiles(): Promise<number> {
  try {
    const files = await fs.readdir(UPLOAD_DIR);
    let removed = 0;

    for (const file of files) {
      const photo = await db.query.photos.findFirst({
        where: eq(photos.filename, file)
      });

      if (!photo) {
        await fs.unlink(path.join(UPLOAD_DIR, file));
        removed++;
      }
    }

    return removed;
  } catch (error) {
    console.error('Error cleaning up orphaned files:', error);
    return 0;
  }
}

// Export utility functions
export const photoUtils = {
  getPhotoPath,
  getThumbnailPath,
  deletePhoto,
  savePhotoMetadata,
  readExifData,
  getPhotoDetails,
  getPropertyPhotos,
  getMimeType,
  matchPhotoToProperty,
  calculateDistance,
  processPhoto,
  deletePhotoRecord,
  isValidFileType,
  cleanupOrphanedFiles
};