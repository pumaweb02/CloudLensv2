Enhanced CloudLens System Overview
CloudLens is a geospatial, drone-powered platform that provides comprehensive property management and environmental risk assessment. The system integrates multiple technologies to deliver detailed property insights, accurate damage assessments, and interactive inspection reports. Recent enhancements include a robust photo-to-property matching process using Regrid data and an engaging, shareable inspection report experience for homeowners.

1. Authentication Flow
Key Features
Secure Login:
Users authenticate via Passport.js.
User Roles:
Two roles are supported:
Admin: Full access to manage properties, photos, and reports.
Regular Users: Limited access to view property information and inspection reports.
Session Management:
Sessions are managed using express-session with MemoryStore.
Password Security:
Passwords are securely hashed using Node's crypto module with scrypt.
Sample Authentication Code
typescript
Copy
// auth.ts – A simplified Passport.js local strategy example
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      // Retrieve user from database (pseudo-code)
      const user = await db.users.findOne({ where: { username } });
      if (!user) return done(null, false, { message: 'Incorrect username.' });
      
      const [hashedPassword, salt] = user.password.split('.');
      const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
      if (!timingSafeEqual(Buffer.from(hashedPassword, 'hex'), derivedKey)) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  })
);

// Session serialization
passport.serializeUser((user: any, done) => done(null, user.id));
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await db.users.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});
2. Property Management
Overview
Users can view properties in both list and map views. Each property profile includes:

Basic Information: Address, city, state, zip code.
Drone-Captured Photos: High-resolution images and thumbnails.
Inspection History: Past inspections with damage classifications and annotations.
Environmental Risk Assessments: Data correlated with historical weather information.
Weather Data: Historical weather events affecting the property.
Regrid Data Integration:
Detailed parcel boundaries, official addresses, and owner information (e.g., owner name, mailing address, parcel number, property values).
Example Property Profile Data (from Regrid)
json
Copy
{
  "propertyId": "00000205642000000",
  "address": "5402 MERCEDES AVE, DALLAS, TX, 75206-5820",
  "ownerName": "ROHDE RONALD",
  "ownerCareOf": "MARMILLO BETHANY",
  "parcelNumber": "00000205642000000",
  "yearBuilt": 1929,
  "propertyValue": 925000,
  "improvementValue": 567500,
  "landValue": 357500,
  "use": "SINGLE FAMILY RESIDENCES",
  "zoning": "CD-9 (Conservation District 9)",
  "geographicData": {
    "latitude": 32.827961,
    "longitude": -96.777237
  },
  "boundary": { /* GeoJSON polygon representing the parcel */ }
}
3. Photo Inspection Process
3.1. Photo Upload
Batch Upload Support:
Users (or automated systems) can upload multiple drone photos simultaneously.
Automatic EXIF Extraction:
The system extracts GPS coordinates, timestamps, and device information from EXIF data.
Thumbnail Generation:
Thumbnails are created for quick previews using libraries like Sharp.
File Compression & Duplicate Detection:
Photos are compressed (with EXIF preserved) and hashed to prevent duplicate processing.
Sample Compression & Duplicate Check Code
typescript
Copy
import sharp from 'sharp';
import crypto from 'crypto';
import fs from 'fs';

async function compressAndHashImage(inputPath: string, outputPath: string): Promise<string> {
  await sharp(inputPath)
    .jpeg({ quality: 80 })
    .withMetadata()
    .toFile(outputPath);
  const fileBuffer = fs.readFileSync(outputPath);
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  return hash;
}
3.2. Inspection Interface
Interactive Annotation Tools:
The interface (built with Konva.js) supports:
Circle Tool: For marking specific damage points.
Rectangle Tool: For highlighting larger areas.
Sketch Tool: For free-form annotations.
Text Tool: For adding notes.
Damage Classification:
Damage types include:
Wind damage
Hail damage
Other damage types
Severity is tracked as:
Low
Medium
High
3.3. Report Generation
Inspection Reports:
Comprehensive reports combine drone photos, annotations, damage assessments, and correlated weather data.
PDF Export:
Reports are exported as PDFs.
Shareable Link Feature:
Each report includes a unique shareable URL. When accessed by the homeowner:
Aerial/Satellite Experience:
The system automatically zooms into the property’s location using Google Maps, shows a default roof image, and then starts a slideshow:
High-altitude (satellite-like) view.
Mid-altitude view showing property context.
Detailed close-up images of the damage.
Call-to-Action:
At the end of the slideshow, the system encourages the homeowner to call or schedule an appointment, highlighting that the damage is covered by their insurance.
Sample Shareable Link Generation (Pseudo-code)
typescript
Copy
function generateShareableReportLink(reportId: string): string {
  // Generate a unique URL that ties to the report in the database.
  return `https://cloudlens.example.com/reports/${reportId}/share`;
}
4. Technical Architecture
4.1. Frontend Stack
Core Technologies:
React with TypeScript: Main framework.
Tailwind CSS: For styling.
shadcn/ui Components: Pre-built UI components.
Wouter: Lightweight routing.
TanStack Query: Data fetching.
Konva.js: For canvas-based image annotations.
Key Components:
PhotoEditor: A sophisticated canvas editor for image annotations.
ThumbnailStrip: Navigation component for photos.
DamageClassification: Interface for standardized damage assessment.
ShareableReportViewer: New component that displays the interactive map and slideshow experience for homeowners.
Sample React Component (PhotoEditor)
tsx
Copy
import React, { useRef } from 'react';
import { Stage, Layer, Rect, Text } from 'react-konva';

const PhotoEditor: React.FC<{ imageUrl: string }> = ({ imageUrl }) => {
  const stageRef = useRef(null);
  return (
    <Stage width={800} height={600} ref={stageRef}>
      <Layer>
        <Rect x={20} y={20} width={760} height={560} fill="lightgray" />
        <Text text="Annotation Area" x={30} y={30} fontSize={18} fill="black" />
        {/* Additional tools and annotation components go here */}
      </Layer>
    </Stage>
  );
};

export default PhotoEditor;
4.2. Backend Stack
Core Technologies:
Express.js: Server framework.
PostgreSQL: Database.
Drizzle ORM: For database operations.
Passport.js: For authentication.
API Structure:
RESTful endpoints (prefixed with /api).
WebSocket support for real-time features.
File uploads are handled using multer.
Session management via express-session.
Database Schema:
Users Table: Authentication and user management.
Properties Table: Property profiles including Regrid data.
Photos Table: Drone photo metadata and storage references.
Inspections Table: Damage assessments and annotations.
Weather Table: Historical weather data.
5. Advanced Property Matching & Regrid Integration
Overview
The system uses a combination of Google Maps (optional) and Regrid data to match photos to the correct property. The enhanced matching function:

Extracts GPS coordinates from the photo.
Checks a local cache to reduce redundant API calls.
Queries the Regrid API for parcel boundaries and property details.
Validates the match using Turf.js (point‑in‑polygon tests).
Updates and caches the property profile in the database.
Enhanced Matching Function (Code Snippet)
Refer to the complete function provided below:

typescript
Copy
import fetch from 'node-fetch';
import * as turf from '@turf/turf';

// Define interfaces
interface RegridProperty {
  propertyId: string;
  address: string;
  ownerName: string;
  ownerCareOf?: string;
  parcelNumber: string;
  yearBuilt: number;
  propertyValue: number;
  improvementValue: number;
  landValue: number;
  use: string;
  zoning: string;
  geographicData: {
    latitude: number;
    longitude: number;
  };
  boundary: GeoJSON.Feature<GeoJSON.Polygon>;
}

interface Photo {
  id: string;
  latitude: number;
  longitude: number;
  exif?: any;
}

interface MatchResult {
  propertyId: string | null;
  address: string | null;
  ownerName?: string;
  ownerCareOf?: string;
  parcelNumber?: string;
  yearBuilt?: number;
  propertyValue?: number;
  improvementValue?: number;
  landValue?: number;
  use?: string;
  zoning?: string;
  confidence: number;
  matchMethod: string;
}

// Helper functions (to be replaced with real implementations)
function getCachedProperty(lat: number, lng: number): RegridProperty | null { return null; }
function cachePropertyProfile(property: RegridProperty): void { /* Cache the profile */ }
function isHighDensityArea(lat: number, lng: number): boolean { return false; }
async function updatePropertyProfile(property: RegridProperty): Promise<void> {
  console.log(`Property profile updated for ${property.address}`);
}

// Query Regrid API
async function queryRegridProperty(
  lat: number,
  lng: number,
  regridApiKey: string,
  radius: number
): Promise<RegridProperty | null> {
  const url = `https://api.regrid.com/v1/properties/search?lat=${lat}&lng=${lng}&radius=${radius}&token=${regridApiKey}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Regrid API error: ${response.status} - ${response.statusText}`);
      return null;
    }
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      return {
        propertyId: result.propertyId,
        address: result.address,
        ownerName: result.owner?.name,
        ownerCareOf: result.owner?.careOf,
        parcelNumber: result.parcelNumber,
        yearBuilt: result.propertyDetails.yearBuilt,
        propertyValue: result.propertyDetails.propertyValue,
        improvementValue: result.propertyDetails.improvementValue,
        landValue: result.propertyDetails.landValue,
        use: result.propertyDetails.use,
        zoning: result.propertyDetails.zoning,
        geographicData: {
          latitude: result.geographicData.latitude,
          longitude: result.geographicData.longitude,
        },
        boundary: result.boundary,
      };
    }
    return null;
  } catch (error) {
    console.error(`Error querying Regrid API: ${error}`);
    return null;
  }
}

// Verify if a point lies within a parcel boundary
function isWithinParcel(lat: number, lng: number, boundary: GeoJSON.Feature<GeoJSON.Polygon>): boolean {
  const point = turf.point([lng, lat]);
  return turf.booleanPointInPolygon(point, boundary);
}

// Main function to assign a property to a photo
export async function assignPropertyToPhoto(
  photo: Photo,
  googleApiKey: string, // Optional: for preliminary Google Maps verification
  regridApiKey: string
): Promise<MatchResult> {
  const { latitude, longitude } = photo;
  if (!latitude || !longitude) {
    return {
      propertyId: null,
      address: null,
      confidence: 0,
      matchMethod: 'no_coordinates',
    };
  }

  // Optional: Preliminary Google Maps reverse geocoding can be integrated here.

  // Check local cache
  let property: RegridProperty | null = getCachedProperty(latitude, longitude);
  const radius = isHighDensityArea(latitude, longitude) ? 20 : 50;

  if (!property) {
    property = await queryRegridProperty(latitude, longitude, regridApiKey, radius);
  }

  if (!property) {
    return {
      propertyId: null,
      address: null,
      confidence: 0,
      matchMethod: 'no_regrid_data',
    };
  }

  if (!isWithinParcel(latitude, longitude, property.boundary)) {
    return {
      propertyId: null,
      address: null,
      confidence: 0,
      matchMethod: 'coordinate_outside_parcel',
    };
  }

  const propertyCenter = turf.center(property.boundary);
  const distance = turf.distance(turf.point([longitude, latitude]), propertyCenter, { units: 'meters' });
  let confidence = 1.0;
  if (distance > 20) {
    confidence -= 0.2;
  }
  if (confidence < 0.97) {
    return {
      propertyId: null,
      address: null,
      confidence,
      matchMethod: 'low_confidence',
    };
  }

  await updatePropertyProfile(property);
  cachePropertyProfile(property);

  return {
    propertyId: property.propertyId,
    address: property.address,
    ownerName: property.ownerName,
    ownerCareOf: property.ownerCareOf,
    parcelNumber: property.parcelNumber,
    yearBuilt: property.yearBuilt,
    propertyValue: property.propertyValue,
    improvementValue: property.improvementValue,
    landValue: property.landValue,
    use: property.use,
    zoning: property.zoning,
    confidence,
    matchMethod: 'regrid_parcel_match',
  };
}
6. Scalability and Efficiency
Batch Processing:
Use worker queues (e.g., Bull, RabbitMQ) to process photo uploads in batches.
Rate-limit external API calls and implement exponential backoff for errors.
Caching:
Use Redis (or a similar solution) to cache API responses and reduce redundant calls.
File Deduplication:
Compute and store file hashes to prevent duplicate processing.
Database Optimization:
Use PostgreSQL with spatial indexing (PostGIS) for fast geospatial queries.
7. Final Report Generation and Shareable Links
Report Generation:
Combine inspection data, drone photos (with annotations), and weather data into a comprehensive PDF report.
Shareable Link:
Generate a unique URL that launches an interactive, map-based report viewer:
Aerial/Satellite View: The link loads a Google Map centered on the property.
Slideshow: Automatically transitions through high-altitude, mid-altitude, and close-up damage photos.
Call-to-Action: The interface encourages homeowners to schedule an appointment, noting that the damage is covered by their insurance.
Sample Link Generation
typescript
Copy
function generateShareableReportLink(reportId: string): string {
  return `https://cloudlens.example.com/reports/${reportId}/share`;
}
