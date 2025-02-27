/**
 * Image Processing Module
 * 
 * This module handles all image processing operations including:
 * - Thumbnail generation
 * - Photo processing via worker threads
 * - Queue management for parallel processing
 * 
 * @module ImageProcessing
 */

import sharp from 'sharp';
import { db } from '@db';
import { photos } from '@db/schema';
import { eq } from 'drizzle-orm';
import path from 'path';
import fs from 'fs/promises';
import { Worker } from 'worker_threads';
import AWS from 'aws-sdk';
import { PassThrough } from 'stream';

// Configuration constants
/** Base directory for all uploaded files */
const UPLOAD_DIR = "uploads";
/** Directory for storing generated thumbnails */
const THUMBNAILS_DIR = path.join(UPLOAD_DIR, "thumbnails");
/** Maximum number of concurrent worker threads */
const MAX_CONCURRENT_WORKERS = 5;
/** Maximum size of the processing queue */
const MAX_QUEUE_SIZE = 100;

// Sharp configuration for optimal performance
sharp.concurrency(2);  // Use 2 threads for better CPU utilization
sharp.cache(true);     // Enable caching for repeated operations
sharp.simd(true);      // Enable SIMD optimization where available

// Process state tracking
let activeWorkers = 0;
const processingQueue: Array<ProcessingQueueItem> = [];

// Type definitions
interface ProcessingQueueItem {
  photoId: number;
  options: ProcessingOptions;
}

interface ProcessingOptions {
  optimizationLevel?: 'low' | 'medium' | 'high';
  [key: string]: any;
}

type ProcessingStatus = 'pending' | 'processed' | 'failed';
type ProcessingMessage = {
  type: 'progress' | 'complete' | 'error';
  status?: ProcessingStatus;
  progress?: number;
  thumbnailPath?: string;
  results?: any;
  error?: string;
};

// Ensure required directories exist
try {
  fs.mkdir(THUMBNAILS_DIR, { recursive: true }).catch(console.error);
} catch (error) {
  console.error("Error creating thumbnails directory:", error);
}

export const imageProcessor = {
  /**
   * Generates a thumbnail for the given image
   * @param imagePath - Path to the source image
   * @returns Promise<string | null> - Path to the generated thumbnail or null if generation failed
   */
  async generateThumbnail(imagePath: string): Promise<string | null> {
    try {

      const SPACES_ENDPOINT = new AWS.Endpoint('nyc3.digitaloceanspaces.com');
      const S3 = new AWS.S3({
        endpoint: SPACES_ENDPOINT,
        accessKeyId: process.env.DO_SPACES_KEY || "DO801YQDHZXQMBWN3K4U",  
        secretAccessKey: process.env.DO_SPACES_SECRET || "m8XTMT7ZtACT9V2ee0Ktq98xt6UxYcDdw3Gby6uXhhM", // Your Secret Key
      });

      const BUCKET_NAME = 'cloudlens';

      const filename = path.basename(imagePath);
      const thumbnailFilename = `thumb_${filename}`;
      // const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);
      const passThroughStream = new PassThrough();

      // Generate optimized thumbnail
       sharp(imagePath, {
        failOnError: false,
        limitInputPixels: 268402689 // 16383 x 16383 max resolution
      })
        .rotate() // Auto-rotate based on EXIF
        .resize(300, 300, {
          fit: 'inside',
          withoutEnlargement: true,
          fastShrinkOnLoad: true
        })
        .jpeg({
          quality: 80,
          progressive: true,
          optimizeScans: true,
          force: true,
          mozjpeg: true
        })
        .withMetadata() 
        .pipe(passThroughStream);
      // .toFile(thumbnailPath);

      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: `thumbnails/${thumbnailFilename}`, // Path inside DigitalOcean Spaces
        Body: passThroughStream, // Streamed output from sharp()
        ACL: 'public-read',
        ContentType: 'image/jpeg'
      };

      const uploadResponse = await S3.upload(uploadParams).promise();
      console.log("File uploaded successfully:", uploadResponse.Location);

      return uploadResponse.Location;

      //   console.log("-----------------IMAGE COMPRESION COMPLETED-------------")

      // return path.join('thumbnails', thumbnailFilename);
    } catch (error) {
      console.error("Error generating thumbnail:", error);
      return null;
    }
  },

  /**
   * Process next items in the queue if workers are available
   * @private
   */
  processNextInQueue() {
    if (processingQueue.length === 0 || activeWorkers >= MAX_CONCURRENT_WORKERS) {
      return;
    }

    // Process multiple items if possible
    const itemsToProcess = Math.min(
      MAX_CONCURRENT_WORKERS - activeWorkers,
      processingQueue.length
    );

    for (let i = 0; i < itemsToProcess; i++) {
      const next = processingQueue.shift();
      if (next) {
        this.processPhotoInWorker(next.photoId, next.options);
      }
    }
  },

  /**
   * Process a photo using a worker thread
   * @param photoId - ID of the photo to process
   * @param options - Processing options
   * @returns Promise<void>
   */
  async processPhotoInWorker(photoId: number, options: ProcessingOptions): Promise<void> {
    if (activeWorkers >= MAX_CONCURRENT_WORKERS) {
      if (processingQueue.length >= MAX_QUEUE_SIZE) {
        throw new Error("Processing queue is full");
      }
      processingQueue.push({ photoId, options });
      return;
    }

    try {
      activeWorkers++;
      const [photo] = await db
        .select()
        .from(photos)
        .where(eq(photos.id, photoId));

      if (!photo) {
        throw new Error(`Photo ${photoId} not found`);
      }

      return new Promise((resolve, reject) => {
        // Configure and start worker thread
        const worker = new Worker('./server/photo-worker.js', {
          workerData: {
            file: {
              path: path.join(UPLOAD_DIR, photo.filename),
              filename: photo.filename,
              originalname: photo.originalName,
              mimetype: photo.mimeType,
              size: photo.size
            },
            userId: photo.userId,
            optimizationLevel: options.optimizationLevel || 'high'
          }
        });

        let progressTimeout: NodeJS.Timeout;

        // Handle worker messages
        worker.on('message', async (message: ProcessingMessage) => {
          try {
            if (progressTimeout) {
              clearTimeout(progressTimeout);
            }

            switch (message.type) {
              case 'progress':
                await db
                  .update(photos)
                  .set({ 
                    processingStatus: message.status as ProcessingStatus,
                    processingProgress: message.progress 
                  })
                  .where(eq(photos.id, photoId));

                // Set timeout for stuck processes
                progressTimeout = setTimeout(() => {
                  worker.terminate();
                  reject(new Error("Processing timeout"));
                }, 300000); // 5 minutes timeout
                break;

              case 'complete':
                await db
                  .update(photos)
                  .set({
                    processingStatus: 'processed',
                    thumbnailPath: message.thumbnailPath,
                    metadata: message.results
                  })
                  .where(eq(photos.id, photoId));
                resolve();
                break;

              case 'error':
                await db
                  .update(photos)
                  .set({
                    processingStatus: 'failed',
                    metadata: {
                      error: message.error,
                      failedAt: new Date().toISOString()
                    }
                  })
                  .where(eq(photos.id, photoId));
                reject(new Error(message.error));
                break;
            }
          } catch (error) {
            console.error(`Error handling worker message for photo ${photoId}:`, error);
            reject(error);
          }
        });

        // Handle worker errors
        worker.on('error', async (error) => {
          console.error(`Worker error processing photo ${photoId}:`, error);
          try {
            await db
              .update(photos)
              .set({
                processingStatus: 'failed',
                metadata: {
                  error: error.message,
                  failedAt: new Date().toISOString()
                }
              })
              .where(eq(photos.id, photoId));
          } catch (dbError) {
            console.error("Error updating photo status:", dbError);
          }
          reject(error);
        });

        // Handle worker exit
        worker.on('exit', (code) => {
          activeWorkers--;
          if (progressTimeout) {
            clearTimeout(progressTimeout);
          }
          this.processNextInQueue();
          if (code !== 0) {
            reject(new Error(`Worker stopped with exit code ${code}`));
          }
        });
      });
    } catch (error) {
      activeWorkers--;
      this.processNextInQueue();
      throw error;
    }
  },

  /**
   * Main entry point for processing a photo
   * @param photoId - ID of the photo to process
   * @param options - Processing options
   * @returns Promise<void>
   */
  async processPhoto(photoId: number, options: ProcessingOptions = {}): Promise<void> {
    if (activeWorkers >= MAX_CONCURRENT_WORKERS) {
      if (processingQueue.length >= MAX_QUEUE_SIZE) {
        throw new Error("Processing queue is full");
      }
      processingQueue.push({ photoId, options });
      return;
    }

    return this.processPhotoInWorker(photoId, options);
  }
};