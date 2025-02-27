import OpenAI from "openai";
import { type WGS84Coordinates, calculateDistance, validateWGS84Coordinates } from "./coordinates";

const openai = new OpenAI({
  apiKey: import.meta.env.OPENAI_API_KEY,
});

interface PhotoMetadata {
  gps?: {
    latitude: number;
    longitude: number;
    altitude?: number;
  };
  timestamp?: string;
  deviceModel?: string;
  cameraParameters?: {
    altitude?: number;
    angle?: number;
  };
}

interface MatchResult {
  isMatch: boolean;
  confidence: number;
  factors: {
    location: number;
    temporal: number;
    visual: number;
    metadata: number;
  };
}

/**
 * Calculates temporal confidence based on photo timestamps
 */
function calculateTemporalConfidence(photos: PhotoMetadata[]): number {
  if (photos.length < 2) return 1.0;

  const timestamps = photos
    .map(p => p.timestamp ? new Date(p.timestamp).getTime() : null)
    .filter(Boolean) as number[];

  if (timestamps.length < 2) return 1.0;

  const maxTimeDiff = Math.max(...timestamps) - Math.min(...timestamps);
  const hoursDiff = maxTimeDiff / (1000 * 60 * 60);

  // Higher confidence if photos were taken within a shorter timeframe
  return Math.max(0, 1 - (hoursDiff / 24));
}

/**
 * Validates device consistency across photos
 */
function calculateDeviceConsistency(photos: PhotoMetadata[]): number {
  if (photos.length < 2) return 1.0;

  const devices = new Set(photos.map(p => p.deviceModel).filter(Boolean));

  // Higher confidence if all photos were taken with the same device
  return 1 / devices.size;
}

/**
 * Analyzes visual similarity between photos using AI
 */
async function analyzeVisualSimilarity(
  photos: string[],
  propertyAddress: string
): Promise<number> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "system",
          content: "Analyze these drone photos and determine if they appear to be of the same property. Consider architectural features, surroundings, and visual consistency. Focus on permanent structures and unique property characteristics."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `These photos are supposed to be of the property at ${propertyAddress}. Analyze if they appear to be of the same property and provide a confidence score between 0 and 1.`
            },
            ...photos.map(photo => ({
              type: "image_url",
              image_url: { url: `/uploads/${photo}` }
            }))
          ]
        }
      ],
      max_tokens: 100,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result.confidence || 0;
  } catch (error) {
    console.error('Error analyzing visual similarity:', error);
    return 0;
  }
}

/**
 * Comprehensive photo matching algorithm that considers multiple factors
 */
export async function verifyPhotoPropertyMatch(
  photos: {
    filename: string;
    metadata: PhotoMetadata;
  }[],
  propertyCoords: WGS84Coordinates,
  propertyAddress: string
): Promise<MatchResult> {
  // Factor 1: Location-based confidence with enhanced validation
  const locationConfidences = photos.map(photo => {
    if (!photo.metadata.gps) return 0;

    const photoCoords = validateWGS84Coordinates(
      photo.metadata.gps.latitude,
      photo.metadata.gps.longitude
    );

    if (!photoCoords) return 0;

    const distance = calculateDistance(photoCoords, propertyCoords);
    // Stricter distance threshold - 30 meters instead of 50
    return Math.max(0, 1 - (distance / 30));
  });

  const avgLocationConfidence = locationConfidences.reduce((a, b) => a + b, 0) / locationConfidences.length;

  // Factor 2: Temporal confidence
  const temporalConfidence = calculateTemporalConfidence(photos.map(p => p.metadata));

  // Factor 3: Device consistency
  const deviceConsistency = calculateDeviceConsistency(photos.map(p => p.metadata));

  // Factor 4: Visual similarity with enhanced analysis
  const visualConfidence = await analyzeVisualSimilarity(
    photos.map(p => p.filename),
    propertyAddress
  );

  // Adjusted weights with higher emphasis on location and visual verification
  const weights = {
    location: 0.45, // Increased weight for location accuracy
    temporal: 0.15, // Reduced temporal weight
    device: 0.10,  // Maintained device consistency weight
    visual: 0.30   // High weight for visual verification
  };

  const overallConfidence = 
    avgLocationConfidence * weights.location +
    temporalConfidence * weights.temporal +
    deviceConsistency * weights.device +
    visualConfidence * weights.visual;

  // Increased confidence threshold to 0.98 for stricter matching
  return {
    isMatch: overallConfidence >= 0.98,
    confidence: overallConfidence,
    factors: {
      location: avgLocationConfidence,
      temporal: temporalConfidence,
      visual: visualConfidence,
      metadata: deviceConsistency
    }
  };
}

/**
 * Batch verification of multiple photos for a property
 */
export async function batchVerifyPhotos(
  photos: {
    id: number;
    filename: string;
    metadata: PhotoMetadata;
  }[],
  propertyCoords: WGS84Coordinates,
  propertyAddress: string
): Promise<{
  matchedPhotos: number[];
  unmatchedPhotos: number[];
  confidenceScores: Record<number, number>;
}> {
  const result = await verifyPhotoPropertyMatch(photos, propertyCoords, propertyAddress);

  const matchedPhotos: number[] = [];
  const unmatchedPhotos: number[] = [];
  const confidenceScores: Record<number, number> = {};

  photos.forEach(photo => {
    confidenceScores[photo.id] = result.confidence;

    if (result.isMatch) {
      matchedPhotos.push(photo.id);
    } else {
      unmatchedPhotos.push(photo.id);
    }
  });

  return {
    matchedPhotos,
    unmatchedPhotos,
    confidenceScores
  };
}