/**
 * Photo Matching Module
 * 
 * Handles the automated matching of uploaded photos to properties using:
 * - GPS coordinates validation
 * - Batch processing
 * - Monte Carlo enhanced matching algorithm
 * 
 * @module PhotoMatching
 */

import { db } from "@db";
import { photos, properties } from "@db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { validateWGS84Coordinates } from "../../client/src/lib/coordinates";
import { PhotoMatcher } from "../lib/photo-matcher";

// Type definitions
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

// Configuration constants
const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const DELAY_BETWEEN_PHOTOS = 300;

const photoMatcher = new PhotoMatcher(process.env.REGRID_API_KEY || '');

async function processUnassignedPhotos(): Promise<void> {
  try {
    // Get batch of unassigned photos
    const unassignedPhotos = await db
      .select()
      .from(photos)
      .where(
        and(
          isNull(photos.propertyId),
          eq(photos.processingStatus, 'pending')
        )
      )
      .limit(BATCH_SIZE);

    if (unassignedPhotos.length === 0) {
      console.log("No unassigned photos to process");
      return;
    }

    console.log(`Processing ${unassignedPhotos.length} unassigned photos`);

    // Process each photo in the batch
    for (const photo of unassignedPhotos) {
      try {
        console.log(`\nProcessing photo ${photo.id}:`);

        // Update status to processing
        await db
          .update(photos)
          .set({ processingStatus: 'pending' })
          .where(eq(photos.id, photo.id));

        // Check for valid coordinates
        const latitude = Number(photo.latitude);
        const longitude = Number(photo.longitude);

        if (isNaN(latitude) || isNaN(longitude) || !latitude || !longitude) {
          console.log(`- No valid coordinates for photo ${photo.id}`);
          await db
            .update(photos)
            .set({ 
              processingStatus: 'failed',
              processingNotes: 'No valid coordinates found',
              matchMethod: 'no_coordinates'
            })
            .where(eq(photos.id, photo.id));
          continue;
        }

        // Validate coordinates
        const photoCoords = validateWGS84Coordinates(latitude, longitude);
        if (!photoCoords) {
          console.log(`- Invalid GPS coordinates detected`);
          await db
            .update(photos)
            .set({ 
              processingStatus: 'failed',
              processingNotes: 'Invalid GPS coordinates',
              matchMethod: 'invalid_coordinates'
            })
            .where(eq(photos.id, photo.id));
          continue;
        }

        console.log(`- GPS Coordinates: ${photoCoords.latitude}, ${photoCoords.longitude}`);

        // Get related batch photos for context
        const batchPhotos = photo.batchId ? 
          await db.select()
            .from(photos)
            .where(eq(photos.batchId, photo.batchId)) : 
          [];

        if (batchPhotos.length > 0) {
          console.log(`- Found ${batchPhotos.length} related photos in batch ${photo.batchId}`);
        }

        // Attempt property matching
        console.log('- Running property matching...');
        const matchResult = await photoMatcher.findMatchingProperty(photo, batchPhotos);

        if (matchResult.propertyId) {
          // Update photo with successful match
          await db
            .update(photos)
            .set({
              propertyId: parseInt(matchResult.propertyId),
              propertyMatchConfidence: matchResult.confidence,
              matchMethod: matchResult.matchMethod,
              processingStatus: 'processed',
              processingNotes: null
            })
            .where(eq(photos.id, photo.id));

          console.log(`✓ Matched to property ${matchResult.propertyId} with confidence ${matchResult.confidence}`);
        } else {
          // Update photo as requiring manual review
          await db
            .update(photos)
            .set({
              processingStatus: 'failed',
              processingNotes: `No match found: ${matchResult.matchMethod}`,
              matchMethod: matchResult.matchMethod
            })
            .where(eq(photos.id, photo.id));

          console.log(`× No confident match found - marked for review (${matchResult.matchMethod})`);
        }

      } catch (error) {
        console.error(`Error processing photo ${photo.id}:`, error);

        // Update photo status to failed
        await db
          .update(photos)
          .set({
            processingStatus: 'failed',
            processingNotes: error instanceof Error ? error.message : String(error),
            matchMethod: 'error'
          })
          .where(eq(photos.id, photo.id));

        console.log(`! Processing failed`);
      }

      // Add delay between photos to prevent API rate limiting
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_PHOTOS));
    }
  } catch (error) {
    console.error("Error in processUnassignedPhotos:", error);
  }
}

export { processUnassignedPhotos };