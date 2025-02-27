const { parentPort, workerData } = require('worker_threads');
const ExifReader = require('exifreader');
const sharp = require('sharp');
const fs = require('fs/promises');
const path = require('path');
const { db } = require('../db');
const { photos, properties } = require('../db/schema');
const { eq } = require('drizzle-orm');
const fetch = require('node-fetch');
const turf = require('@turf/turf');

const UPLOAD_DIR = "uploads";
const THUMBNAIL_DIR = path.join(UPLOAD_DIR, "thumbnails");
const CHUNK_SIZE = 10 * 1024 * 1024;
const MAX_CONCURRENT_PROCESSES = 3;
const REGRID_API_KEY = process.env.REGRID_API_KEY;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY|| 'AIzaSyAq_TvETnjsrA18ZfiUIgL1wfOOszSz51M';

// Configuration
const ADDRESS_MATCH_THRESHOLD = 0.85; // Minimum similarity score for address matching
const MAX_DISTANCE_METERS = 25; // Maximum distance in meters for point-in-polygon
const MIN_CONFIDENCE_SCORE = 0.75; // Minimum confidence score required for match

// Optimize Sharp configuration
sharp.concurrency(2);
sharp.cache(50);
sharp.simd(true);

async function ensureDirectories() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(console.error);
  await fs.mkdir(THUMBNAIL_DIR, { recursive: true }).catch(console.error);
}

// Enhanced GPS data extraction
function extractGPSData(tags) {
  try {
    const gpsLatitude = tags['GPSLatitude'];
    const gpsLongitude = tags['GPSLongitude'];
    const gpsAltitude = tags['GPSAltitude'];

    if (!gpsLatitude || !gpsLongitude) {
      console.log("No GPS data found in EXIF");
      return null;
    }

    let latitude = null;
    let longitude = null;
    let altitude = null;

    // Convert DMS to decimal degrees
    function dmsToDecimal(degrees, minutes, seconds) {
      return degrees + (minutes / 60.0) + (seconds / 3600.0);
    }

    // Handle different GPS data formats
    if (gpsLatitude.description) {
      latitude = parseFloat(gpsLatitude.description);
    } else if (Array.isArray(gpsLatitude.value)) {
      const [degrees, minutes, seconds] = gpsLatitude.value.map(v => v.numerator / v.denominator);
      latitude = dmsToDecimal(degrees, minutes, seconds);
    }

    if (gpsLongitude.description) {
      longitude = parseFloat(gpsLongitude.description);
    } else if (Array.isArray(gpsLongitude.value)) {
      const [degrees, minutes, seconds] = gpsLongitude.value.map(v => v.numerator / v.denominator);
      longitude = dmsToDecimal(degrees, minutes, seconds);
    }

    // Apply hemisphere references
    const latRef = tags['GPSLatitudeRef'];
    const longRef = tags['GPSLongitudeRef'];

    if (latRef && latRef.value[0] === 'S') {
      latitude = -latitude;
    }
    if (longRef && longRef.value[0] === 'W') {
      longitude = -longitude;
    }

    // Handle altitude
    if (gpsAltitude) {
      if (gpsAltitude.description) {
        altitude = parseFloat(gpsAltitude.description);
      } else if (gpsAltitude.value) {
        altitude = gpsAltitude.value.numerator / gpsAltitude.value.denominator;
      }
    }

    // Validate coordinates
    if (latitude === null || longitude === null || 
        isNaN(latitude) || isNaN(longitude) ||
        Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      console.log("Invalid GPS coordinates found");
      return null;
    }

    return {
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      altitude: altitude ? Number(altitude.toFixed(2)) : null
    };
  } catch (error) {
    console.error("Error extracting GPS data:", error);
    return null;
  }
}

// Improved address normalization
function normalizeAddress(address) {
  return address
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    // Remove all special characters except numbers and letters
    .replace(/[^\w\s0-9]/g, '')
    // Remove directional prefixes
    .replace(/^(north|south|east|west|n|s|e|w)\s+/i, '')
    // Standardize common abbreviations
    .replace(/\b(street|str|st)\b/gi, 'st')
    .replace(/\b(avenue|ave)\b/gi, 'ave')
    .replace(/\b(road|rd)\b/gi, 'rd')
    .replace(/\b(drive|dr)\b/gi, 'dr')
    .replace(/\b(lane|ln)\b/gi, 'ln')
    .replace(/\b(boulevard|blvd)\b/gi, 'blvd')
    .replace(/\b(court|ct)\b/gi, 'ct')
    .replace(/\b(circle|cir)\b/gi, 'cir')
    .replace(/\b(parkway|pkwy)\b/gi, 'pkwy')
    .replace(/\b(place|pl)\b/gi, 'pl')
    // Remove unit/suite numbers
    .replace(/(?:unit|apt|apartment|suite|ste|#)\s*[\w-]+/gi, '')
    // Remove floor indicators
    .replace(/(?:\d+(?:st|nd|rd|th)\s+(?:floor|fl))/gi, '')
    // Remove all spaces
    .replace(/\s+/g, '')
    .trim();
}

// Calculate Levenshtein distance for fuzzy matching
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Calculate similarity score between addresses
function calculateAddressSimilarity(addr1, addr2) {
  const normalized1 = normalizeAddress(addr1);
  const normalized2 = normalizeAddress(addr2);
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);
  return 1 - (distance / maxLength);
}

// Fetch address from Google Maps
async function fetchGoogleMapsAddress(latitude, longitude) {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('No Google Maps API key found');
    return null;
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Google Maps API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.results[0]) {
      return null;
    }

    // Extract address components
    const result = data.results[0];
    const addressComponents = {};

    for (const component of result.address_components) {
      const type = component.types[0];
      addressComponents[type] = component.long_name;
      if (component.short_name !== component.long_name) {
        addressComponents[`${type}_short`] = component.short_name;
      }
    }

    return {
      formattedAddress: result.formatted_address,
      streetNumber: addressComponents.street_number || '',
      street: addressComponents.route || '',
      city: addressComponents.locality || addressComponents.sublocality || '',
      state: addressComponents.administrative_area_level_1_short || '',
      zipCode: addressComponents.postal_code || '',
      confidence: result.geometry?.location_type === 'ROOFTOP' ? 1 : 0.8
    };
  } catch (error) {
    console.error('Error fetching Google Maps address:', error);
    return null;
  }
}

// Enhanced property data fetching from Regrid
async function fetchPropertyData(latitude, longitude) {
  if (!REGRID_API_KEY) {
    console.warn('No Regrid API key found');
    return null;
  }

  try {
    const response = await fetch(
      `https://app.regrid.com/api/v1/parcels/point/${latitude},${longitude}`,
      {
        headers: {
          'Authorization': `Bearer ${REGRID_API_KEY}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Regrid API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract and validate parcel data
    if (!data.features || !data.features[0]) {
      return null;
    }

    const parcel = data.features[0];
    return {
      address: parcel.properties.address,
      city: parcel.properties.city,
      state: parcel.properties.state,
      zipCode: parcel.properties.zip,
      parcelId: parcel.properties.parcel_id,
      boundary: parcel.geometry,
      confidence: 0.9 // Base confidence for Regrid data
    };
  } catch (error) {
    console.error('Error fetching Regrid property data:', error);
    return null;
  }
}

// Calculate overall confidence score
function calculateConfidenceScore(params) {
  const {
    googleMapsData,
    regridData,
    distanceToParcelCenter,
    addressSimilarity
  } = params;

  let score = 0;
  let factors = 0;

  // Google Maps confidence
  if (googleMapsData) {
    score += googleMapsData.confidence;
    factors++;
  }

  // Regrid confidence
  if (regridData) {
    score += regridData.confidence;
    factors++;
  }

  // Distance-based confidence (inverse relationship)
  if (distanceToParcelCenter !== undefined) {
    const distanceScore = Math.max(0, 1 - (distanceToParcelCenter / MAX_DISTANCE_METERS));
    score += distanceScore;
    factors++;
  }

  // Address similarity confidence
  if (addressSimilarity !== undefined) {
    score += addressSimilarity;
    factors++;
  }

  return factors > 0 ? score / factors : 0;
}

// Enhanced property matching
async function findOrCreateProperty(gpsData) {
  try {
    console.log('Finding property match for coordinates:', gpsData);

    // 1. Get address from Google Maps
    const googleMapsData = await fetchGoogleMapsAddress(gpsData.latitude, gpsData.longitude);
    console.log('Google Maps data:', googleMapsData);

    // 2. Get property data from Regrid
    const regridData = await fetchPropertyData(gpsData.latitude, gpsData.longitude);
    console.log('Regrid data:', regridData);

    if (!googleMapsData && !regridData) {
      throw new Error('No property data available from any source');
    }

    // 3. Look for existing properties
    const point = turf.point([gpsData.longitude, gpsData.latitude]);
    let bestMatch = null;
    let highestConfidence = 0;

    // Search for nearby properties
    const existingProperties = await db
      .select()
      .from(properties)
      .where(
        sql`ST_DWithin(
          ST_MakePoint(${gpsData.latitude}, ${gpsData.longitude})::geography,
          ST_MakePoint(latitude, longitude)::geography,
          ${MAX_DISTANCE_METERS}
        )`
      );

    for (const property of existingProperties) {
      let distanceToCenter = Infinity;
      let isWithinParcel = false;

      // Calculate distance and check if point is within parcel
      if (regridData?.boundary) {
        const parcel = turf.polygon(regridData.boundary.coordinates);
        isWithinParcel = turf.booleanPointInPolygon(point, parcel);
        const center = turf.centroid(parcel);
        distanceToCenter = turf.distance(point, center, { units: 'meters' });
      }

      // Calculate address similarity
      const addressSimilarity = calculateAddressSimilarity(
        property.address,
        googleMapsData?.formattedAddress || regridData?.address || ''
      );

      // Calculate overall confidence score
      const confidence = calculateConfidenceScore({
        googleMapsData,
        regridData,
        distanceToParcelCenter: distanceToCenter,
        addressSimilarity,
        isWithinParcel
      });

      if (confidence > highestConfidence && confidence >= MIN_CONFIDENCE_SCORE) {
        highestConfidence = confidence;
        bestMatch = property;
      }
    }

    // Return existing property if good match found
    if (bestMatch) {
      console.log('Found matching property:', bestMatch.id, 'with confidence:', highestConfidence);
      return bestMatch.id;
    }

    // 4. Create new property if no match found
    console.log('No matching property found, creating new property');

    // Prefer Google Maps data for address, fall back to Regrid
    const address = googleMapsData?.formattedAddress || 
                   `${regridData?.address || ''}, ${regridData?.city || ''}, ${regridData?.state || ''} ${regridData?.zipCode || ''}`;

    const [newProperty] = await db
      .insert(properties)
      .values({
        address: address,
        city: googleMapsData?.city || regridData?.city || 'Unknown',
        state: googleMapsData?.state || regridData?.state || 'Unknown',
        zipCode: googleMapsData?.zipCode || regridData?.zipCode || '00000',
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        parcelNumber: regridData?.parcelId || null,
        status: 'processing',
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false
      })
      .returning();

    console.log('Created new property:', newProperty.id);
    return newProperty.id;
  } catch (error) {
    console.error('Error in findOrCreateProperty:', error);
    throw error;
  }
}

// Main photo processing function
async function processPhoto(file, userId) {
  let thumbnailPath = null;
  let originalMetadata = null;
  let propertyId = null;

  try {
    await ensureDirectories();
    console.log('Processing photo:', file.originalname);

    parentPort?.postMessage({
      type: 'progress',
      status: 'reading_file',
      progress: 10
    });

    // Extract EXIF data
    const buffer = await fs.readFile(file.path);
    const tags = await ExifReader.load(buffer);
    console.log('EXIF data extracted');

    // Extract and validate GPS data
    const gpsData = extractGPSData(tags);
    if (!gpsData) {
      throw new Error('No valid GPS data found in photo');
    }
    console.log('GPS data validated:', gpsData);

    // Process image
    const processedImageBuffer = await sharp(buffer, {
      failOnError: false,
      limitInputPixels: 268402689
    })
      .rotate()
      .jpeg({
        quality: 85,
        chromaSubsampling: '4:4:4',
        progressive: true,
        force: true
      })
      .withMetadata()
      .toBuffer();

    await fs.writeFile(file.path, processedImageBuffer);
    console.log('Processed image saved');

    // Generate thumbnail
    thumbnailPath = await createThumbnail(processedImageBuffer, file.filename);
    console.log('Thumbnail generated:', thumbnailPath);

    // Find or create property
    propertyId = await findOrCreateProperty(gpsData);
    console.log('Property assigned:', propertyId);

    // Get image metadata
    originalMetadata = await sharp(processedImageBuffer).metadata();

    // Update photo record
    await db
      .update(photos)
      .set({
        processingStatus: "processed",
        thumbnailPath: path.relative(UPLOAD_DIR, thumbnailPath),
        propertyId: propertyId,
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        altitude: gpsData.altitude,
        metadata: {
          exif: tags,
          imageMetadata: originalMetadata,
          gps: gpsData,
          processing: {
            date: new Date().toISOString(),
            coordsQuality: 'high',
            compressionQuality: 85,
            originalSize: buffer.length,
            compressedSize: processedImageBuffer.length,
            compressionRatio: (buffer.length / processedImageBuffer.length).toFixed(2)
          }
        }
      })
      .where(eq(photos.id, file.id));

    console.log('Photo record updated successfully');

    // Send success message
    parentPort?.postMessage({
      type: 'complete',
      photoId: file.id,
      thumbnailPath: path.relative(UPLOAD_DIR, thumbnailPath),
      propertyId: propertyId,
      results: {
        gps: gpsData,
        metadata: originalMetadata,
        processedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error processing photo:', error);

    // Update photo with error status
    await db
      .update(photos)
      .set({
        processingStatus: 'failed',
        metadata: {
          error: error.message,
          failedAt: new Date().toISOString(),
          originalMetadata: originalMetadata || null
        }
      })
      .where(eq(photos.id, file.id));

    // Clean up thumbnail if it exists
    if (thumbnailPath) {
      await fs.unlink(thumbnailPath).catch(console.error);
    }

    // Send error message
    parentPort?.postMessage({
      type: 'error',
      error: error.message,
      photoId: file.id,
      details: {
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        metadata: originalMetadata
      }
    });
  }
}

// Compression function remains unchanged
async function compressImage(buffer, options = {}) {
  const {
    quality = 85,
    maxWidth = 2048,
    maxHeight = 2048,
    preserveMetadata = true
  } = options;

  try {
    const image = sharp(buffer, {
      failOnError: false,
      limitInputPixels: 268402689,
      sequentialRead: true
    });

    const metadata = await image.metadata();

    let resizeOptions = {};
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      resizeOptions = {
        width: maxWidth,
        height: maxHeight,
        fit: 'inside',
        withoutEnlargement: true
      };
    }

    const processedImage = image
      .rotate()
      .resize(resizeOptions)
      .jpeg({
        quality,
        chromaSubsampling: '4:4:4',
        progressive: true,
        force: true,
        mozjpeg: true,
      });

    if (preserveMetadata) {
      processedImage.withMetadata({
        orientation: metadata.orientation,
        exif: metadata.exif
      });
    }

    return await processedImage.toBuffer();
  } catch (error) {
    console.error('Error compressing image:', error);
    throw error;
  }
}

// Thumbnail creation function remains unchanged
async function createThumbnail(buffer, filename) {
  const thumbnailFilename = `thumb-${path.basename(filename)}`;
  const thumbnailPath = path.join(THUMBNAIL_DIR, thumbnailFilename);

  try {
    await sharp(buffer, {
      failOnError: false,
      limitInputPixels: 268402689
    })
      .resize(300, 300, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({
        quality: 80,
        progressive: true,
        force: true
      })
      .toFile(thumbnailPath);

    return thumbnailPath;
  } catch (error) {
    console.error('Error creating thumbnail:', error);
    throw error;
  }
}

// Start processing with timeout
const processingTimeout = setTimeout(() => {
  console.error('Processing timeout exceeded');
  process.exit(1);
}, 300000);

console.log('Starting photo processing:', workerData.file.originalname);

processPhoto(workerData.file, workerData.userId)
  .catch(error => {
    console.error('Worker critical error:', error);
    parentPort?.postMessage({
      type: 'error',
      error: error.message,
      critical: true
    });
  })
  .finally(() => {
    clearTimeout(processingTimeout);
  });