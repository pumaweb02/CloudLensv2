/**
 * Coordinate handling utilities for WGS-84 GPS Map Datum
 * WGS-84 is the standard geodetic datum used for GPS
 */

interface WGS84Coordinates {
  latitude: number;
  longitude: number;
  altitude?: number;
}

interface PropertyBoundary {
  neLat: number | null;
  neLng: number | null;
  seLat: number | null;
  seLng: number | null;
}

const EARTH_RADIUS_METERS = 6371e3; // Earth's radius in meters
const MAX_DISTANCE_THRESHOLD = 50; // Maximum distance in meters for high confidence match
const MIN_CONFIDENCE_THRESHOLD = 0.97; // Minimum confidence score to consider a match valid

/**
 * Validates and formats GPS coordinates to ensure WGS-84 compliance
 * @param latitude Raw latitude value
 * @param longitude Raw longitude value
 * @returns Validated WGS-84 coordinates or null if invalid
 */
export function validateWGS84Coordinates(
  latitude: number | string | null, 
  longitude: number | string | null
): WGS84Coordinates | null {
  // Convert string inputs to numbers
  const lat = typeof latitude === 'string' ? parseFloat(latitude) : Number(latitude);
  const lng = typeof longitude === 'string' ? parseFloat(longitude) : Number(longitude);

  // Check for valid WGS-84 ranges
  // Latitude: -90 to +90
  // Longitude: -180 to +180
  if (
    isNaN(lat) || 
    isNaN(lng) || 
    lat < -90 || 
    lat > 90 || 
    lng < -180 || 
    lng > 180
  ) {
    return null;
  }

  return {
    latitude: lat,
    longitude: lng
  };
}

/**
 * Calculates the distance between two WGS-84 coordinates using the Haversine formula
 * @param coord1 First WGS-84 coordinate
 * @param coord2 Second WGS-84 coordinate
 * @returns Distance in meters
 */
export function calculateDistance(coord1: WGS84Coordinates, coord2: WGS84Coordinates): number {
  const φ1 = (coord1.latitude * Math.PI) / 180;
  const φ2 = (coord2.latitude * Math.PI) / 180;
  const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates a confidence score for a coordinate match based on distance and boundaries
 * @param photoCoords Photo GPS coordinates
 * @param propertyCoords Property GPS coordinates
 * @param propertyBoundary Optional property boundary coordinates
 * @returns Confidence score between 0 and 1
 */
export function calculateLocationMatchConfidence(
  photoCoords: WGS84Coordinates,
  propertyCoords: WGS84Coordinates,
  propertyBoundary?: PropertyBoundary
): number {
  // Calculate base confidence from distance
  const distance = calculateDistance(photoCoords, propertyCoords);
  let confidence = Math.max(0, 1 - (distance / MAX_DISTANCE_THRESHOLD));

  // If property boundaries are available, adjust confidence
  if (propertyBoundary && 
      propertyBoundary.neLat !== null && 
      propertyBoundary.neLng !== null && 
      propertyBoundary.seLat !== null && 
      propertyBoundary.seLng !== null) {

    const isWithinBounds = 
      photoCoords.latitude <= propertyBoundary.neLat &&
      photoCoords.latitude >= propertyBoundary.seLat &&
      photoCoords.longitude >= propertyBoundary.neLng &&
      photoCoords.longitude <= propertyBoundary.seLng;

    // Boost confidence if within property boundaries
    if (isWithinBounds) {
      confidence = Math.min(1, confidence + 0.2);
    } else {
      // Reduce confidence if outside boundaries
      confidence *= 0.5;
    }
  }

  return confidence;
}

/**
 * Determines if a photo location matches a property based on coordinates and boundaries
 * @param photoCoords Photo GPS coordinates
 * @param propertyCoords Property GPS coordinates
 * @param propertyBoundary Optional property boundary coordinates
 * @returns Object containing match status and confidence score
 */
export function checkLocationMatch(
  photoCoords: WGS84Coordinates,
  propertyCoords: WGS84Coordinates,
  propertyBoundary?: PropertyBoundary
): { isMatch: boolean; confidence: number } {
  const confidence = calculateLocationMatchConfidence(
    photoCoords,
    propertyCoords,
    propertyBoundary
  );

  return {
    isMatch: confidence >= MIN_CONFIDENCE_THRESHOLD,
    confidence
  };
}