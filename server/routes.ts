import type { Express, Request, Response, NextFunction } from "express";
import { generateInspectionReport } from './lib/report-generation'; // Move import to correct location
import { Client as GoogleMapsClient } from "@googlemaps/google-maps-services-js";
import type { AddressType, PlaceAutocompleteType } from "@googlemaps/google-maps-services-js";
import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { createServer } from 'http';
import multer from "multer";
import path from "path";
import { db } from "@db";
import {
  photos,
  type Photo,
  scan_batches,
  properties,
  user_preferences,
  weather_events,
  affected_properties,
  inspections,
  users,
  reports
} from "@db/schema";
import { eq, sql, desc, and, or } from "drizzle-orm";
import ExifReader from "exifreader";
import { promises as fs } from "fs";
import express from "express";
import { imageProcessor } from './image-processing';
import axios from 'axios';
import { z } from "zod";
import { Worker } from 'worker_threads';
import propertiesRouter from './routes/properties';
import { setupAuth } from './auth';
import statsRouter from './routes/stats';

// Initialize Google Maps client
const googleMapsClient = new GoogleMapsClient({});

// Add proper type for authenticated request
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: "admin" | "user";
  };
}

interface GPSData {
  latitude: number;
  longitude: number;
  altitude: number | null;
}

interface ExifMetadata {
  gps?: GPSData;
  DateTimeOriginal?: string | null;
}

interface AddressDetails {
  address: string;
  city: string;
  state: string;
  zipCode: string;
}


// Tomorrow.io API types and configuration
interface TomorrowioParams {
  location: string;
  fields: string[];
  units: string;
  apikey: string;
}

interface TomorrowioResponse {
  data: {
    timelines: Array<{
      timestep: string;
      endTime: string;
      startTime: string;
      intervals: Array<{
        startTime: string;
        values: {
          temperature: number;
          temperatureApparent: number;
          humidity: number;
          precipitationIntensity: number;
          precipitationType: number;
          pressureSurfaceLevel: number;
          visibility: number;
          weatherCode: number;
          windSpeed: number;
          windDirection: number;
          hailIntensity?: number;
          hailProbability?: number;
        };
      }>;
    }>;
  };
  location: {
    lat: number;
    lon: number;
    name: string | null;
  };
}

function calculateBoundariesFromAltitude(
  latitude: number,
  longitude: number,
  altitude: any
): { 
  northLatitude: number;
  southLatitude: number;
  eastLongitude: number;
  westLongitude: number;
  effectiveOffsetKm: number;
} {
  const earthRadiusKm: number = 6371; // Earth's radius in km
  const altitudeKm: number = altitude / 1000; // Convert altitude to km
  const R_eff: number = earthRadiusKm + altitudeKm; // Effective radius

  // Adjust offset dynamically based on altitude
  const offsetKm: number = (R_eff / earthRadiusKm) * 10; // Adjust offset (default 10 km at sea level)

  // Calculate latitude and longitude offsets
  const latitudeOffset: number = (offsetKm / 111) * (R_eff / earthRadiusKm);
  const longitudeOffset: number = (offsetKm / (111 * Math.cos(latitude * (Math.PI / 180)))) * (R_eff / earthRadiusKm);

  return {
      northLatitude: latitude + latitudeOffset,
      southLatitude: latitude - latitudeOffset,
      eastLongitude: longitude + longitudeOffset,
      westLongitude: longitude - longitudeOffset,
      effectiveOffsetKm: offsetKm // Show adjusted offset distance
  };
}

async function updateExistingProperties() {
  const existingProperties = await db
    .select()
    .from(properties)
    .where(and(eq(properties.api_check, false)));

  console.log("existingProperties: ", existingProperties);

  for (const property of existingProperties) {
    console.log(`Processing property ID: ${property.id}`);

    // Call API to get property details
    const propertyDetails = await getPropertyDetails({
      address: property.address,
      city: property.city,
      state: property.state,
      zipCode: property.zipCode,
    });

    console.log(`Updating property ID: ${property.id} with new data`);

    // Update the database with the retrieved details
    await db
      .update(properties)
      .set({
        owner1FirstName: propertyDetails.owner1FirstName,
        owner1LastName: propertyDetails.owner1LastName,
        owner1Phone: propertyDetails.owner1Phone.phone,
        owner1Email: propertyDetails.owner1Email.email,
        owner1Phone1: propertyDetails.owner1Phone1.phone,
        owner1Email1: propertyDetails.owner1Email1.email,
        owner1Phone2: propertyDetails.owner1Phone2.phone,
        owner1Email2: propertyDetails.owner1Email2.email,
        owner1Phone3: propertyDetails.owner1Phone3.phone,
        owner1Email3: propertyDetails.owner1Email3.email,
        owner1Phone4: propertyDetails.owner1Phone4.phone,
        owner1Email4: propertyDetails.owner1Email4.email,
        
        owner1Company: propertyDetails.owner1Company,
        owner1Notes: propertyDetails.owner1Notes,
        owner2FirstName: propertyDetails.owner2FirstName,
        owner2LastName: propertyDetails.owner2LastName,
        owner2Phone: propertyDetails.owner2Phone.phone,
        owner2Email: propertyDetails.owner2Email.email,
        owner2Phone1: propertyDetails.owner2Phone1.phone,
        owner2Email1: propertyDetails.owner2Email1.email,
        owner2Phone2: propertyDetails.owner2Phone2.phone,
        owner2Email2: propertyDetails.owner2Email2.email,
        owner2Phone3: propertyDetails.owner2Phone3.phone,
        owner2Email3: propertyDetails.owner2Email3.email,
        owner2Phone4: propertyDetails.owner2Phone4.phone,
        owner2Email4: propertyDetails.owner2Email4.email,

        owner2Company: propertyDetails.owner2Company,
        owner2Notes: propertyDetails.owner2Notes,
        owner3FirstName: propertyDetails.owner3FirstName,
        owner3LastName: propertyDetails.owner3LastName,
        owner3Phone: propertyDetails.owner3Phone.phone,
        owner3Email: propertyDetails.owner3Email.email,
        owner3Phone1: propertyDetails.owner3Phone1.phone,
        owner3Email1: propertyDetails.owner3Email1.email,
        owner3Phone2: propertyDetails.owner3Phone2.phone,
        owner3Email2: propertyDetails.owner3Email2.email,
        owner3Phone3: propertyDetails.owner3Phone3.phone,
        owner3Email3: propertyDetails.owner3Email3.email,
        owner3Phone4: propertyDetails.owner3Phone4.phone,
        owner3Email4: propertyDetails.owner3Email4.email,

        owner3Company: propertyDetails.owner3Company,
        owner3Notes: propertyDetails.owner3Notes,
        owner4FirstName: propertyDetails.owner4FirstName,
        owner4LastName: propertyDetails.owner4LastName,
        owner4Phone: propertyDetails.owner4Phone.phone,
        owner4Email: propertyDetails.owner4Email.email,
        owner4Phone1: propertyDetails.owner4Phone1.phone,
        owner4Email1: propertyDetails.owner4Email1.email,
        owner4Phone2: propertyDetails.owner4Phone2.phone,
        owner4Email2: propertyDetails.owner4Email2.email,
        owner4Phone3: propertyDetails.owner4Phone3.phone,
        owner4Email3: propertyDetails.owner4Email3.email,
        owner4Phone4: propertyDetails.owner4Phone4.phone,
        owner4Email4: propertyDetails.owner4Email4.email,

        owner4Company: propertyDetails.owner4Company,
        owner4Notes: propertyDetails.owner4Notes,
        owner5FirstName: propertyDetails.owner5FirstName,
        owner5LastName: propertyDetails.owner5LastName,
        owner5Phone: propertyDetails.owner5Phone.phone,
        owner5Email: propertyDetails.owner5Email.email,
        owner5Phone1: propertyDetails.owner5Phone1.phone,
        owner5Email1: propertyDetails.owner5Email1.email,
        owner5Phone2: propertyDetails.owner5Phone2.phone,
        owner5Email2: propertyDetails.owner5Email2.email,
        owner5Phone3: propertyDetails.owner5Phone3.phone,
        owner5Email3: propertyDetails.owner5Email3.email,
        owner5Phone4: propertyDetails.owner5Phone4.phone,
        owner5Email4: propertyDetails.owner5Email4.email,

        owner5Company: propertyDetails.owner5Company,
        owner5Notes: propertyDetails.owner5Notes,
        boundaryNeLat: propertyDetails?.boundaryNeLat,
        boundaryNeLng: propertyDetails.boundaryNeLng,
        boundarySeLat: propertyDetails.boundarySeLat,
        boundarySeLng: propertyDetails.boundarySeLng,
        county: propertyDetails.county,
        loanNumber: propertyDetails.loanNumber,
        loanType: propertyDetails.loanType,
        lastSoldDate: propertyDetails.lastSoldDate ? new Date(propertyDetails.lastSoldDate) : null,
        hoaName: propertyDetails.hoaName,
        parcelNumber: propertyDetails.parcelNumber,
        yearBuilt: propertyDetails.yearBuilt,
        propertyValue: propertyDetails.propertyValue,
        api_check: propertyDetails.api_check,
        ownershipType: propertyDetails.ownershipType,
        updatedAt: new Date(),
        mailingAddress: propertyDetails.mailingAddress,
        mortgageCompany: propertyDetails.mortgageCompany
      })
      .where(eq(properties.id, property.id));

    console.log(`Updated property ID: ${property.id}, fetching related photos...`);

    if(propertyDetails && propertyDetails?.boundaryNeLat) {
    // Fetch all photos for this property
    const all_photos = await db
      .select()
      .from(photos)
      .where(eq(photos.propertyId, property.id));

    for (const photo of all_photos) {
      const { latitude, longitude } = photo;

      // Check if the photo is out of the property boundaries
      const isOutOfBounds =
        latitude > propertyDetails.boundaryNeLat ||
        latitude < propertyDetails.boundarySeLat || 
        longitude > propertyDetails.boundaryNeLng || 
        longitude < propertyDetails.boundarySeLng; 

      if (isOutOfBounds) {
        console.log(`Photo ID: ${photo.id} is out of bounds. Updating status.`);

        // Update photo status and remove property association
        await db
          .update(photos)
          .set({
            processingStatus: "pending",
            propertyId: null,
          })
          .where(eq(photos.id, photo.id));
      }
    }
  }
    console.log(`Completed processing for property ID: ${property.id}, waiting 5 seconds...`);

    // Delay of 10 seconds before processing the next property
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  console.log("All properties and photos updated.");
}

async function getPropertyDetails(addressDetails: AddressDetails) {
  console.log("addressDetails: ", addressDetails)

  var property_options = {
    method: 'GET',
    headers: {
      'x-api-key': 'live_WWqgFW7Yt1K7hiwSEd670KTTmmktgV8YPIC'
    }
  };
  let property_api_url = `https://api.propertyreach.com/v1/property?streetAddress=${addressDetails.address}&city=${addressDetails.city}&state=${addressDetails.state}&zip=${addressDetails.zipCode}`;
  let property_details = await fetch(property_api_url, property_options);
  property_details = await property_details.json();

  // If first attempt fails, try with state
  if (!(property_details && property_details.meta.status === 200)) {
    console.log("First attempt failed, trying with state...");
    property_api_url = `https://api.propertyreach.com/v1/property?streetAddress=${addressDetails.address}&state=${addressDetails.state}`;
    property_details = await fetch(property_api_url, property_options);
    property_details = await property_details.json();
  }

  // If second attempt fails, try with address only
  if (!(property_details && property_details.meta.status === 200)) {
    console.log("Second attempt failed, trying with address only...");
    property_api_url = `https://api.propertyreach.com/v1/property?streetAddress=${addressDetails.address}`;
    property_details = await fetch(property_api_url, property_options);
    property_details = await property_details.json();
  }


  if (property_details && property_details.meta.status === 200) {
    console.log("property_details: ",property_details)
    const latitudes = property_details?.property?.parcelPolygons[0].map(coord => coord[1]) ?? "";
    const longitudes = property_details?.property?.parcelPolygons[0].map(coord => coord[0]) ?? "";

  console.log("latitudes:", latitudes);
  console.log("longitudes:", longitudes);
    const northLatitude = Math.max(...latitudes);
    const southLatitude = Math.min(...latitudes);
    const eastLongitude = Math.max(...longitudes);
    const westLongitude = Math.min(...longitudes);

    console.log("North Latitude:", northLatitude);
    console.log("South Latitude:", southLatitude);
    console.log("East Longitude:", eastLongitude);
    console.log("West Longitude:", westLongitude);

    let owners = [];

  if(property_details?.property?.ownershipType?.toLowerCase() == "individual") {
    let body = {
      target: {
        apn: property_details.property.apn
      }
    };

    let contacts_details_options = {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'x-api-key': 'live_WWqgFW7Yt1K7hiwSEd670KTTmmktgV8YPIC'
      }
    };

    let contacts_details_url = 'https://api.propertyreach.com/v1/skip-trace';

    let contact_details = await fetch(contacts_details_url, contacts_details_options)
    contact_details = await contact_details.json();

    console.log("contact_details: ", contact_details);

    // let contacts = property_details?.property?.contacts;
    //     contacts = contacts?.length > 5 ? contacts.slice(0,5) : contacts || [];

    // // console.log("contacts: ", contacts)

    // for (let contact of contacts) {

    //    let contactFirstName = contact.name?.split(" ")?.[0] || ""; 

    // if (!contactFirstName) {
    //     console.warn(`Skipping contact with missing name:`, contact);
    //     continue;
    // }
    
    //     let person = contact_details?.persons?.find(p => p.firstName === contactFirstName);
    
    //     if (person) {
    //         console.log(`Person found for contact:`, person);
    
    //         // let uniqueEmails = [...new Map((person.emails || [])
    //         //     .sort((a, b) => new Date(b.lastReported) - new Date(a.lastReported))
    //         //     .map(email => [email.email, email])) 
    //         //     .values()
    //         // ].slice(0, 5);
    //       let uniqueEmails = [...(person.emails || [])]
    //         .sort((a, b) => new Date(b.lastReported) - new Date(a.lastReported))
    //         .reduce((map, email) => {
    //           if (!map.has(email.email)) {
    //             map.set(email.email, email);
    //           }
    //           return map;
    //         }, new Map())
    //         .values();
    //       uniqueEmails = [...uniqueEmails].slice(0, 5);
    
    //         let uniquePhones = [...new Map((person.phones || [])
    //             .sort((a, b) => new Date(b.lastReported) - new Date(a.lastReported))
    //             .map(phone => [phone.phone, phone]))
    //             .values()
    //         ].slice(0, 5);
    
    //         console.log(`Top 5 Emails for ${contact.name}:`, uniqueEmails);
    //         console.log(`Top 5 Phones for ${contact.name}:`, uniquePhones);
    
    //         owners.push({ 
    //             firstName: person.firstName, 
    //             lastName: person.lastName, 
    //             emails: uniqueEmails, 
    //             phones: uniquePhones 
    //         });
    //     }
    // }

 for (let i = 1; i <= 5; i++) {
          let ownerKey = `owner${i}FirstName`;
          let ownerFirstName = property_details?.property?.[ownerKey];
          console.log("ownerFirstName: ",ownerFirstName);

          if (ownerFirstName) {
              let person = contact_details?.persons?.find((p) => p.firstName === ownerFirstName);
  
              if (person) {
                  console.log(`Person found for ${ownerKey}:`, person);
  
                  let uniqueEmails = [...new Map((person.emails || [])
                      .sort((a, b) => new Date(b.lastReported) - new Date(a.lastReported))
                      .map(email => [email.email, email])) // Ensures uniqueness
                      .values()
                  ].slice(0, 5);
  
                  let uniquePhones = [...new Map((person.phones || [])
                      .sort((a, b) => new Date(b.lastReported) - new Date(a.lastReported))
                      .map(phone => [phone.phone, phone])) // Ensures uniqueness
                      .values()
                  ].slice(0, 5);
  
                  console.log(`Top 5 Emails for ${ownerKey}:`, uniqueEmails);
                  console.log(`Top 5 Phones for ${ownerKey}:`, uniquePhones);
  
                  owners.push({ 
                      firstName: person.firstName, 
                      lastName: person.lastName, 
                      emails: uniqueEmails, 
                      phones: uniquePhones 
                  });
              }
          }
      }
    } 

      if(owners.length==0) {
        owners.push({ 
          firstName: property_details?.property?.owner1FirstName, 
          lastName: property_details?.property?.owner1LastName, 
      });
      }
  
    const mostRecentLoan = property_details?.property?.openLoans 
      ? property_details.property.openLoans.reduce((latest, current) => {
          if (!latest) return current;
          const latestDate = new Date(latest.recordingDate);
          const currentDate = new Date(current.recordingDate);
          return currentDate > latestDate ? current : latest;
        }, null)
      : null;

    // Create the response object with dynamic owner information
    const response = {
      owner1FirstName: owners[0]?.firstName || 'No',
      owner1LastName: owners[0]?.lastName || 'No',
      owner1Phone:  owners[0]?.phones?.[0] || 'No',
      owner1Email:  owners[0]?.emails?.[0] || 'No',
      owner1Phone1: owners[0]?.phones?.[1] || 'No',
      owner1Email1: owners[0]?.emails?.[1] || 'No',
      owner1Phone2: owners[0]?.phones?.[2] || 'No',
      owner1Email2: owners[0]?.emails?.[2] || 'No',
      owner1Phone3: owners[0]?.phones?.[3] || 'No',
      owner1Email3: owners[0]?.emails?.[3] || 'No',
      owner1Phone4: owners[0]?.phones?.[4] || 'No',
      owner1Email4: owners[0]?.emails?.[4]  || 'No',
      owner1Company: property_details?.property?.ownershipType || 'No',
      owner1Notes: 'No',
      owner2FirstName: owners[1]?.firstName || 'No',
      owner2LastName: owners[1]?.lastName || 'No',
      owner2Phone:  owners[1]?.phones?.[0] || 'No',
      owner2Email:  owners[1]?.emails?.[0]  || 'No',
      owner2Phone1: owners[1]?.phones?.[1] || 'No',
      owner2Email1: owners[1]?.emails?.[1]  || 'No',
      owner2Phone2: owners[1]?.phones?.[2] || 'No',
      owner2Email2: owners[1]?.emails?.[2]  || 'No',
      owner2Phone3: owners[1]?.phones?.[3] || 'No',
      owner2Email3: owners[1]?.emails?.[3]|| 'No',
      owner2Phone4: owners[1]?.phones?.[4] || 'No',
      owner2Email4: owners[1]?.emails?.[4]  || 'No',
      owner2Company:  'No',
      owner2Notes: 'No',
      owner3FirstName: owners[2]?.firstName || 'No',
      owner3LastName: owners[2]?.lastName || 'No',
      owner3Phone:  owners[2]?.phones?.[0]  || 'No',
      owner3Email:  owners[2]?.emails?.[0]  || 'No',
      owner3Phone1: owners[2]?.phones?.[1]  || 'No',
      owner3Email1: owners[2]?.emails?.[1]  || 'No',
      owner3Phone2: owners[2]?.phones?.[2]  || 'No',
      owner3Email2: owners[2]?.emails?.[2]  || 'No',
      owner3Phone3: owners[2]?.phones?.[3]  || 'No',
      owner3Email3: owners[2]?.emails?.[3]  || 'No',
      owner3Phone4: owners[2]?.phones?.[4]  || 'No',
      owner3Email4: owners[2]?.emails?.[4]  || 'No',
      owner3Company: 'No',
      owner3Notes:  'No',
      owner4FirstName: owners[3]?.firstName || 'No',
      owner4LastName: owners[3]?.lastName || 'No',
      owner4Phone:  owners[3]?.phones?.[0] || 'No',
      owner4Email:  owners[3]?.emails?.[0]  || 'No',
      owner4Phone1: owners[3]?.phones?.[1] || 'No',
      owner4Email1: owners[3]?.emails?.[1]  || 'No',
      owner4Phone2: owners[3]?.phones?.[2] || 'No',
      owner4Email2: owners[3]?.emails?.[2]  || 'No',
      owner4Phone3: owners[3]?.phones?.[3] || 'No',
      owner4Email3: owners[3]?.emails?.[3]  || 'No',
      owner4Phone4: owners[3]?.phones?.[4] || 'No',
      owner4Email4: owners[3]?.emails?.[4]  || 'No',
      owner4Company: 'No',
      owner4Notes:  'No',
      owner5FirstName: owners[4]?.firstName || 'No',
      owner5LastName: owners[4]?.lastName || 'No',
      owner5Phone:  owners[4]?.phones?.[0] || 'No',
      owner5Email:  owners[4]?.emails?.[0]  || 'No',
      owner5Phone1: owners[4]?.phones?.[1] || 'No',
      owner5Email1: owners[4]?.emails?.[1]  || 'No',
      owner5Phone2: owners[4]?.phones?.[2] || 'No',
      owner5Email2: owners[4]?.emails?.[2]  || 'No',
      owner5Phone3: owners[4]?.phones?.[3] || 'No',
      owner5Email3: owners[4]?.emails?.[3]  || 'No',
      owner5Phone4: owners[4]?.phones?.[4] || 'No',
      owner5Email4: owners[4]?.emails?.[4]  || 'No',
      owner5Company:  'No',
      owner5Notes:  'No',
      county: property_details?.property?.county || 'No',
      parcelNumber: property_details?.property?.apn || null,
      hoaName: property_details?.property?.subdivision || 'No',
      boundaryNeLat: northLatitude || null,
      boundaryNeLng: eastLongitude || null,
      boundarySeLat: southLatitude || null,
      boundarySeLng: westLongitude || null,
      yearBuilt: property_details?.property?.yearBuilt || null,
      loanNumber: property_details?.property?.loanCount || null,
      loanType: mostRecentLoan?.loanType || 'No',
      lastSoldDate: property_details?.property?.lastSaleDate || null,
      propertyValue: property_details?.property?.marketValue || null,
      api_check: true,
      mortgageCompany: mostRecentLoan?.lenderName || "No",
      ownershipType: property_details?.property?.occupancyType || "No",
      mailingAddress: property_details?.property?.ownershipType == "Corporate" ? property_details?.property?.mailingAddress : null
    };

    return response;
  }
  return {
    owner1FirstName: 'No',
    owner1LastName: 'No',
    owner1Phone: 'No',
    owner1Email: 'No',
    owner1Phone1: 'No',
    owner1Email1: 'No',
    owner1Phone2: 'No',
    owner1Email2: 'No',
    owner1Phone3: 'No',
    owner1Email3: 'No',
    owner1Phone4: 'No',
    owner1Email4: 'No',
    owner1Company: 'No',
    owner1Notes: '',
    owner2FirstName: 'No',
    owner2LastName: 'No',
    owner2Phone: 'No',
    owner2Email: 'No',
    owner2Phone1: 'No',
    owner2Email1: 'No',
    owner2Phone2: 'No',
    owner2Email2: 'No',
    owner2Phone3: 'No',
    owner2Email3: 'No',
    owner2Phone4: 'No',
    owner2Email4: 'No',
    owner2Company: 'No',
    owner2Notes: '',
    // Owner 3
    owner3FirstName: 'No',
    owner3LastName: 'No',
    owner3Phone: 'No',
    owner3Email: 'No',
    owner3Phone1: 'No',
    owner3Email1: 'No',
    owner3Phone2: 'No',
    owner3Email2: 'No',
    owner3Phone3: 'No',
    owner3Email3: 'No',
    owner3Phone4: 'No',
    owner3Email4: 'No',
    owner3Company: 'No',
    owner3Notes: '',
    // Owner 4
    owner4FirstName: 'No',
    owner4LastName: 'No',
    owner4Phone: 'No',
    owner4Email: 'No',
    owner4Phone1: 'No',
    owner4Email1: 'No',
    owner4Phone2: 'No',
    owner4Email2: 'No',
    owner4Phone3: 'No',
    owner4Email3: 'No',
    owner4Phone4: 'No',
    owner4Email4: 'No',
    owner4Company: 'No',
    owner4Notes: '',
    // Owner 5
    owner5FirstName: 'No',
    owner5LastName: 'No',
    owner5Phone: 'No',
    owner5Email: 'No',
    owner5Phone1: 'No',
    owner5Email1: 'No',
    owner5Phone2: 'No',
    owner5Email2: 'No',
    owner5Phone3: 'No',
    owner5Email3: 'No',
    owner5Phone4: 'No',
    owner5Email4: 'No',
    owner5Company: 'No',
    owner5Notes: '',
    // Property details
    county: 'No',
    parcelNumber: 'No',
    hoaName: 'No',
    boundaryNeLat: null,
    boundaryNeLng: null,
    boundarySeLat: null,
    boundarySeLng: null,
    yearBuilt: null,
    loanNumber: null,
    loanType: 'No',
    lastSoldDate: null,
    propertyValue: null,
    mortgageCompany: "No",
    api_check: true,
    ownershipType: "No",
    mailingAddress: null
  };
}

// Constants and Configuration 

const UPLOAD_DIR = "uploads";
const CHUNK_DIR = path.join(UPLOAD_DIR, "chunks");
const THUMBNAIL_DIR = path.join(UPLOAD_DIR, "thumbnails");
const MAX_CHUNK_SIZE = 50 * 1024 * 1024; // Increased to 50MB chunks for better performance
const BATCH_SIZE = 20; // Process 20 files at a time
const PROCESSING_QUEUE: any[] = [];
let isProcessing = false;

// Create necessary directories if they don't exist
Promise.all([
  fs.mkdir(UPLOAD_DIR, { recursive: true }),
  fs.mkdir(CHUNK_DIR, { recursive: true }),
  fs.mkdir(THUMBNAIL_DIR, { recursive: true })
]).catch(console.error);

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // Store chunks in separate directories by file
    if (req.body.isChunked === 'true') {
      const chunkDir = path.join(CHUNK_DIR, path.basename(file.originalname, path.extname(file.originalname)));
      await fs.mkdir(chunkDir, { recursive: true });
      cb(null, chunkDir);
    } else {
      cb(null, UPLOAD_DIR);
    }
  },
  filename: (req, file, cb) => {
    if (req.body.isChunked === 'true') {
      // For chunks, use chunk number as filename
      cb(null, `chunk-${req.body.chunkIndex}`);
    } else {
      const ext = path.extname(file.originalname);
      const sanitizedName = file.originalname.replace(ext, '').replace(/[^a-zA-Z0-9]/g, '-');
      const filename = `${Date.now()}-${sanitizedName}${ext}`;
      cb(null, filename);
    }
  }
});

// Separate upload middleware for images with increased limits
const imageUpload = multer({
  storage: storage,
  limits: {
    fileSize: req => req.body.isChunked === 'true' ? MAX_CHUNK_SIZE : 5 * 1024 * 1024 * 1024, // 5GB for direct uploads
    files: 5000
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/tiff",
      "image/heic",
      "image/raw"
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, TIFF, HEIC, and RAW formats are allowed.`));
    }
  }
});

// Separate upload middleware for PDFs
const pdfUpload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for PDFs
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed."));
    }
  }
});

// Helper Functions
async function geocodeCoordinates(latitude: number, longitude: number): Promise<AddressDetails | null> {
  // if (!process.env.GOOGLE_MAPS_API_KEY) {
  //   console.warn("Google Maps API key not configured. Address geocoding disabled.");
  //   return null;
  // }

  console.log("longitude--------------",longitude)
  console.log("latitude--------------",latitude)

  try {
    const response = await googleMapsClient.reverseGeocode({
      params: {
        latlng: { lat: latitude, lng: longitude },
        key: process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyAq_TvETnjsrA18ZfiUIgL1wfOOszSz51M',
        result_type: ["street_address", "premise"] as AddressType[],
      },
    });

    if (response.data.status !== "OK" || !response.data.results[0]) {
      console.warn("No geocoding results found for coordinates:", { latitude, longitude });
      return null;
    }

    const result = response.data.results[0];
    const addressComponents = result.address_components;

    let streetNumber = "", route = "", city = "", state = "", zipCode = "";

    for (const component of addressComponents) {
      const types = component.types as AddressType[];
      if (types.includes("street_number" as AddressType)) {
        streetNumber = component.long_name;
      } else if (types.includes("route" as AddressType)) {
        route = component.long_name;
      } else if (types.includes("locality" as AddressType)) {
        city = component.long_name;
      } else if (types.includes("administrative_area_level_1" as AddressType)) {
        state = component.short_name;
      } else if (types.includes("postal_code" as AddressType)) {
        zipCode = component.long_name;
      }
    }

    if (!state) state = "GA";

    return {
      address: streetNumber && route ? `${streetNumber} ${route}` : result.formatted_address,
      city: city || "Unknown",
      state,
      zipCode: zipCode || "Unknown"
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

function formatAltitude(altitude: number | null, unit: string): string | null {
  if (altitude === null) return null;
  const altitudeValue = unit === 'meters' ? Math.round(altitude / 3.28084) : altitude;
  return `${altitudeValue} ${unit} above sea level`;
}

function extractGPSData(tags: ExifReader.Tags): GPSData | null {
  try {
    if (!tags['GPSLatitude'] || !tags['GPSLongitude']) {
      console.log("Missing required GPS tags");
      return null;
    }

    let latitude: number | null = null;
    let longitude: number | null = null;
    let altitude: number | null = null;

    const dmsToDecimal = (degrees: number, minutes: number, seconds: number): number => {
      return degrees + (minutes / 60.0) + (seconds / 3600.0);
    };

    // Handle latitude with proper type checking
    if (tags['GPSLatitude']?.description) {
      latitude = parseFloat(String(tags['GPSLatitude'].description));
    } else if (Array.isArray(tags['GPSLatitude']?.value)) {
      const dmsValues = (tags['GPSLatitude'].value as any[]).map((v: any) => v.numerator / v.denominator);
      latitude = dmsToDecimal(dmsValues[0], dmsValues[1], dmsValues[2]);
    }

    if (tags['GPSLatitudeRef']?.value && String(tags['GPSLatitudeRef'].value)[0] === 'S' && latitude !== null) {
      latitude = -latitude;
    }

    // Handle longitude with proper type checking
    if (tags['GPSLongitude']?.description) {
      longitude = parseFloat(String(tags['GPSLongitude'].description));
    } else if (Array.isArray(tags['GPSLongitude']?.value)) {
      const dmsValues = (tags['GPSLongitude'].value as any[]).map((v: any) => v.numerator / v.denominator);
      longitude = dmsToDecimal(dmsValues[0], dmsValues[1], dmsValues[2]);
    }

    if (tags['GPSLongitudeRef']?.value && String(tags['GPSLongitudeRef'].value)[0] === 'W' && longitude !== null) {
      longitude = -longitude;
    }

    // Handle altitude with proper numeric conversion
    if (tags['GPSAltitude']) {
      const altValue = tags['GPSAltitude'].description;
      if (typeof altValue === 'string' && altValue.includes(' ')) {
        altitude = parseFloat(altValue.split(' ')[0]); // Extract numeric value only
      } else if (!isNaN(Number(altValue))) {
        altitude = Number(altValue);
      }
    }

    if (latitude === null || longitude === null || isNaN(latitude) || isNaN(longitude)) {
      console.log("Failed to convert GPS coordinates");
      return null;
    }

    latitude = Number(latitude.toFixed(6));
    longitude = Number(longitude.toFixed(6));

    return {
      latitude,
      longitude,
      altitude
    };
  } catch (error) {
    console.error("Error extracting GPS data:", error);
    return null;
  }
}

function parseTimestamp(tags: ExifReader.Tags): string | null {
  const dateTimeOriginal = tags['DateTimeOriginal']?.description;
  const createDate = tags['CreateDate']?.description;
  const dateStr = dateTimeOriginal || createDate;

  if (dateStr) {
    try {
      const match = dateStr.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
      if (match) {
        const [_, year, month, day, hour, minute, second] = match;
        const utcDate = new Date(Date.UTC(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          parseInt(second)
        ));
        return utcDate.toISOString();
      }
    } catch (error) {
      console.error("Error parsing timestamp:", error);
    }
  }
  return null;
}

async function savePhotoToDatabase(
  file: Express.Multer.File,
  propertyId: number | null,
  userId: number,
  metadata: any,
  batchId: number,
  thumbnailPath: string | null = null
): Promise<Photo> {
  try {
    console.log("Saving photo to database:", {
      filename: file.filename,
      propertyId,
      userId,
      batchId,
      metadata: JSON.stringify(metadata)
    });

    const [photo] = await db
      .insert(photos)
      .values({
        propertyId: null, // Start with null, will be updated during processing
        userId,
        batchId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        latitude: metadata.gps?.latitude || null,
        longitude: metadata.gps?.longitude || null,
        altitude: metadata.gps?.altitude || null,
        takenAt: metadata.DateTimeOriginal ? new Date(metadata.DateTimeOriginal) : null,
        metadata: metadata,
        storageLocation: path.join(UPLOAD_DIR, file.filename),
        thumbnailPath: thumbnailPath,
        processingStatus: "pending",
        processingNotes: null,
        matchMethod: null,
        isDeleted: false
      })
      .returning();

    if (!photo) {
      throw new Error('Failed to save photo to database');
    }

    console.log("Successfully saved photo to database:", photo.id);
    return photo;
  } catch (error) {
    console.error('Error saving photo to database:', error);
    throw error;
  }
}

// Helper function to generate Street View image URL using full address
function getStreetViewImageUrl(addressDetails: AddressDetails, apiKey: string): string {
  const fullAddress = `${addressDetails.address}, ${addressDetails.city}, ${addressDetails.state} ${addressDetails.zipCode}`;
  const encodedAddress = encodeURIComponent(fullAddress);
  return `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodedAddress}&key=${apiKey}`;
}

// Enhanced address normalization with more robust cleaning
function normalizeAddress(address: string): string {
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
    .replace(/\b(square|sq)\b/gi, 'sq')
    .replace(/\b(terrace|ter)\b/gi, 'ter')
    .replace(/\b(trail|trl)\b/gi, 'trl')
    .replace(/\b(way)\b/gi, 'way')
    // Remove unit/suite numbers
    .replace(/(?:unit|apt|apartment|suite|ste|#)\s*[\w-]+/gi, '')
    // Remove floor indicators
    .replace(/(?:\d+(?:st|nd|rd|th)\s+(?:floor|fl))/gi, '')
    // Keep the numbers but remove ordinal suffixes
    .replace(/(\d+)(?:st|nd|rd|th)/g, '$1')
    // Remove all spaces
    .replace(/\s+/g, '')
    .trim();
}

// Calculate Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
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

// Enhanced property matching and creation
async function findOrCreateProperty(
  gpsData: GPSData,
  userId: number
): Promise<number> {
  try {
    console.log("Finding or creating property with GPS coordinates:", gpsData);

    // First get address from coordinates
    const addressDetails = await geocodeCoordinates(gpsData.latitude, gpsData.longitude);
    if (!addressDetails) {
      console.warn("Could not geocode coordinates:", gpsData);
      throw new Error("Failed to geocode coordinates");
    }

    console.log("Geocoded address details:", addressDetails);

    // Normalize the new address for comparison
    const normalizedNewAddress = normalizeAddress(addressDetails.address);
    console.log("Normalized new address:", normalizedNewAddress);

    // First try exact address match with extended search
    const existingProperties = await db
      .select()
      .from(properties)
      .where(
        and(
          eq(properties.city, addressDetails.city),
          eq(properties.state, addressDetails.state),
          eq(properties.zipCode, addressDetails.zipCode),
          eq(properties.isDeleted, false)
        )
      );

    console.log(`Found ${existingProperties.length} properties in same city/state/zip`);

    // Check for exact or very close matches first
    for (const property of existingProperties) {
      const normalizedExisting = normalizeAddress(property.address);

      // Log each comparison for debugging
      console.log(`Comparing addresses:
        Original: ${property.address} vs ${addressDetails.address}
        Normalized: ${normalizedExisting} vs ${normalizedNewAddress}
      `);

      // Check for exact match after normalization
      if (normalizedExisting === normalizedNewAddress) {
        console.log("Found exact match after normalization:", property);
        return property.id;
      }

      // Calculate similarity score
      const distance = levenshteinDistance(normalizedExisting, normalizedNewAddress);
      const maxLength = Math.max(normalizedExisting.length, normalizedNewAddress.length);
      const similarity = 1 - (distance / maxLength);

      console.log(`Address similarity score: ${similarity}`);

      // If addresses are very similar (90% or more similar)
      if (similarity >=  0.99) {
        console.log("Found very similar address:", property);
        return property.id;
      }
    }

    // If no match found by address, check nearby properties
    // Reduce search radius to 25 meters for dense communities
    const nearbyProperties = await db
      .select()
      .from(properties)
      .where(
        and(
          sql`ST_DWithin(
            ST_MakePoint(${gpsData.latitude}, ${gpsData.longitude})::geography,
            ST_MakePoint(latitude, longitude)::geography,
            25
          )`,
          eq(properties.isDeleted, false)
        )
      );

    if (nearbyProperties.length > 0) {
      console.log(`Found ${nearbyProperties.length} nearby properties`);

      // For nearby properties, prioritize house number matching
      const nearbyMatch = nearbyProperties.find(prop => {
        const normalizedExisting = normalizeAddress(prop.address);
        const existingNumber = prop.address.match(/^\d+/)?.[0];
        const newNumber = addressDetails.address.match(/^\d+/)?.[0];

        // If house numbers match exactly, be more lenient with overall similarity
        if (existingNumber && newNumber && existingNumber === newNumber) {
          const distance = levenshteinDistance(normalizedExisting, normalizedNewAddress);
          const maxLength = Math.max(normalizedExisting.length, normalizedNewAddress.length);
          const similarity = 1 - (distance / maxLength);

          console.log(`Nearby property check:
            Address: ${prop.address}
            House number match: true
            Distance: ${distance}
            Similarity: ${similarity}
          `);

          return similarity >=  0.99; // More lenient threshold when house numbers match
        }

        // For properties without matching house numbers, require higher similarity
        const distance = levenshteinDistance(normalizedExisting, normalizedNewAddress);
        const maxLength = Math.max(normalizedExisting.length, normalizedNewAddress.length);
        const similarity = 1 - (distance / maxLength);

        console.log(`Nearby property check:
          Address: ${prop.address}
          House number match: false
          Distance: ${distance}
          Similarity: ${similarity}
        `);

        return similarity >=  0.99; // Stricter threshold when house numbers don't match
      });

      if (nearbyMatch) {
        console.log("Found matching nearby property:", nearbyMatch);
        return nearbyMatch.id;
      }
    }

    // No matching property found, create new one
    console.log("No matching property found. Creating new property with address:", addressDetails);

    // Get street view URL using the full address
    const streetViewUrl = getStreetViewImageUrl(addressDetails, process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyAq_TvETnjsrA18ZfiUIgL1wfOOszSz51M');

    // Final verification - one last exact match check before creation
    const [finalCheck] = await db
      .select()
      .from(properties)
      .where(
        and(
          sql`REGEXP_REPLACE(LOWER(${properties.address}), '[^a-z0-9]', '', 'g') = ${normalizedNewAddress}`,
          eq(properties.city, addressDetails.city),
          eq(properties.state, addressDetails.state),
          eq(properties.zipCode, addressDetails.zipCode)
        )
      )
      .limit(1);

    if (finalCheck) {
      console.log("Found matching property in final verification:", finalCheck);
      return finalCheck.id;
    }
    
    // const properties_details = await getPropertyDetails(addressDetails)

    // console.log("properties_details: ",properties_details)

    console.log("streetViewUrl: ",streetViewUrl)

    // Create new property
    const [newProperty] = await db
      .insert(properties)
      .values({
        address: addressDetails.address,
        city: addressDetails.city,
        state: addressDetails.state,
        zipCode: addressDetails.zipCode,
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        // boundaryNeLat: properties_details.boundary_ne_lat,
        // boundaryNeLng: properties_details.boundary_ne_lng,
        // boundarySeLat: properties_details.boundary_sw_lat,
        // boundarySeLng: properties_details.boundary_sw_lng,
        // owner1FirstName: properties_details.first_name,
        // owner1LastName: properties_details.last_name,
        // owner1Phone: properties_details.phone_no.phone,
        // owner1Email: properties_details.emails.email,
        // county: properties_details.county,
        // loanNumber: properties_details.loan_no,
        // loanType: properties_details.loan_type,
        // lastSoldDate: properties_details.last_sold_date ? new Date(properties_details.last_sold_date) : null,
        // hoaName: properties_details.hoa_name,
        // parcelNumber: properties_details.parcel_number,
        // yearBuilt: properties_details.year_built,
        // propertyValue: properties_details.property_value,
        // api_check: properties_details.api_check,
        status: "processing",
        streetViewUrl,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    if (!newProperty) {
      throw new Error('Failed to create property');
    }

    console.log("Successfully created new property:", newProperty);
    return newProperty.id;

  } catch (error) {
    console.error("Error in findOrCreateProperty:", error);
    throw error;
  }
}

const inspectionSchema = z.object({
  propertyId: z.number(),
  photoId: z.number().optional(),
  status: z.enum(["draft", "completed"]).optional(),
  damageType: z.string(),
  severity: z.string(),
  notes: z.string().optional(),
  annotations: z.array(z.object({
    type: z.enum(["circle", "text", "sketch", "rectangle", "blur"]),
    x: z.number(),
    y: z.number(),
    radius: z.number().optional(),
    text: z.string().optional(),
    color: z.string(),
    points: z.array(z.number()).optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    damageType: z.string(),
    severity: z.string()
  }))
});

interface FileChunk {
  chunkIndex: number;
  totalChunks: number;
  fileName: string;
  batchId: number;
}

// Memory-efficient chunk handling
async function handleFileChunks(chunkDir: string, fileName: string, totalChunks: number): Promise<string> {
  try {
    const chunks = await fs.readdir(chunkDir);
    const sortedChunks = chunks
      .filter(chunk => chunk.startsWith('chunk-'))
      .sort((a, b) => {
        const indexA = parseInt(a.split('-')[1]);
        const indexB = parseInt(b.split('-')[1]);
        return indexA - indexB;
      });

    if (sortedChunks.length !== totalChunks) {
      throw new Error(`Missing chunks for ${fileName}. Expected ${totalChunks}, got ${sortedChunks.length}`);
    }

    const finalPath = path.join(UPLOAD_DIR, fileName);
    const writeStream = require('fs').createWriteStream(finalPath);

    // Process chunks sequentially to manage memory
    for (const chunk of sortedChunks) {
      const chunkPath = path.join(chunkDir, chunk);
      await new Promise((resolve, reject) => {
        const readStream = require('fs').createReadStream(chunkPath);
        readStream.pipe(writeStream, { end: false });
        readStream.on('end', resolve);
        readStream.on('error', reject);
      });
      await fs.unlink(chunkPath); // Clean up chunk after use
    }

    writeStream.end();
    await new Promise((resolve) => writeStream.on('finish', resolve));
    await fs.rmdir(chunkDir).catch(console.error); // Clean up chunks directory
    return finalPath;
  } catch (error) {
    console.error('Error handling file chunks:', error);
    throw error;
  }
}


// Background processing function
async function processQueue() {
  if (isProcessing || PROCESSING_QUEUE.length === 0) return;

  isProcessing = true;
  while (PROCESSING_QUEUE.length > 0) {
    const { files, userId, batchId } = PROCESSING_QUEUE.shift()!;
    try {
      await processPhotoBatch(files, userId, batchId);
    } catch (error) {
      console.error('Error processing batch:', error);
    }
  }
  isProcessing = false;
}

// Update photo processing to be more robust
const processPhotoBatch = async (
  files: (Express.Multer.File & { id: number })[],
  userId: number,
  batchId: number
): Promise<{ success: number; errors: any[] }> => {
  const results = {
    success: 0,
    errors: [] as any[]
  };

  // Process files in smaller chunks to manage memory
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const fileBatch = files.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(files.length / BATCH_SIZE)}`);

    for (const file of fileBatch) {
      try {
        console.log(`Starting to process file: ${file.originalname}`);

        // Update status to processing
        await db
          .update(photos)
          .set({ processingStatus: 'processing' })
          .where(eq(photos.id, file.id));

        // Read the file to extract GPS data
        const buffer = await fs.readFile(file.path);
        const exifData = await ExifReader.load(buffer);
        const gpsData = extractGPSData(exifData);

        if (!gpsData || !gpsData.latitude || !gpsData.longitude) {
          throw new Error('No valid GPS data found in image');
        }

        // Find or create property based on GPS coordinates
        const propertyId = await findOrCreateProperty(gpsData, userId);
        console.log(`Property ID ${propertyId} assigned to photo ${file.id}`);

        // Update photo record with property ID and mark as processed
        await db
          .update(photos)
          .set({
            propertyId,
            processingStatus: 'processed'
          })
          .where(eq(photos.id, file.id));

        results.success++;
        console.log(`Successfully processed ${file.originalname}`);

      } catch (error) {
        console.error(`Error processing photo ${file.originalname}:`, error);
        // Update photo status to failed
        await db
          .update(photos)
          .set({ processingStatus: 'failed' })
          .where(eq(photos.id, file.id));

        results.errors.push({
          file: file.originalname,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Add a small delay between batches to prevent overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  await updateExistingProperties();

  return results;
};

interface FileUploadRequest extends Request {
  files: {
    report?: Express.Multer.File[];
    [key: string]: Express.Multer.File[] | undefined;
  };
}

interface UploadError {
  filename: string;
  error: string;
  originalName: string;
}

interface UploadResult {
  success: Photo[];
  noCoordinates: Photo[];
  errors: UploadError[];
}

export function registerRoutes(app: Express): any {
  // sets up /api/login, /api/logout, /api/user
  setupAuth(app);

  // Configure express for larger payloads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Serve static files from uploads directory
  app.use('/uploads', express.static(UPLOAD_DIR, {
    setHeaders: (res, path) => {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (path.endsWith('.png')) {
        res.setHeader('Content-Type', 'image/png');
      }
    }
  }));

  // Serve thumbnails directory
  app.use('/uploads/thumbnails', express.static(THUMBNAIL_DIR, {
    setHeaders: (res, path) => {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (path.endsWith('.png')) {
        res.setHeader('Content-Type', 'image/png');
      }
    }
  }));

  // Register route modules
  app.use(statsRouter);
  app.use(propertiesRouter);

  // Handle API and upload routes first
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    
    // For all other routes in development, let Vite handle it
    if (process.env.NODE_ENV === 'development') {
      return next();
    }
    
    // In production, serve the static client build  
    res.sendFile(path.join(process.cwd(), 'dist', 'client', 'index.html'));
  });

  // Add routes for users
  app.get("/api/users", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const usersList = await db
        .select({
          id: users.id,
          username: users.username,
          role: users.role,
        })
        .from(users);

      res.json(usersList);
    } catch (error) {
      next(error);
    }
  });

  // Scan Batches endpoints
  app.post("/api/scan-batches", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {        return res.status(401).json({
          error: "Not authenticated",
          message: "You must be loggedin to create a scan batch"
        });
      }

      const { name, description, flightDate, userId } = req.body;

      if (!name || !flightDate) {
        return res.status(400).json({
          error: "Invalid input",
          message: "Name and flight date are required"
        });
      }

      // Update the batch user ID assignment to fix syntax error
      const batchUserId = (req.user?.role === 'admin' && userId) ? parseInt(userId) : req.user?.id;
      const [batch] = await db
        .insert(scan_batches)
        .values({
          name,
          description,
          flightDate: new Date(flightDate),
          userId: batchUserId,
        })
        .returning();

      res.json(batch);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/scan-batches", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: "Not authenticated",
          message: "You must be logged in to view scan batches"
        });
      }

      const batches = await db
        .select()
        .from(scan_batches)
        .where(eq(scan_batches.isDeleted, false))
        .orderBy(desc(scan_batches.createdAt));

      res.json(batches);
    } catch (error) {
      next(error);
    }
  });

  // Register property routes
  app.use(propertiesRouter);

  // Property routes
  app.get("/api/properties/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const propertyId = parseInt(req.params.id);

      if (isNaN(propertyId)) {
        return res.status(400).json({
          error: "Invalid property ID",
          message: "Property ID must be a number"
        });
      }

      console.log("Fetching property details for ID:", propertyId);

      // Get property details with better error handling
      const [property] = await db
        .select()
        .from(properties)
        .where(
          and(
            eq(properties.id, propertyId),
            eq(properties.isDeleted, false)
          )
        )
        .limit(1);

      if (!property) {
        console.log("Property not found for ID:", propertyId);
        return res.status(404).json({
          error: "Property not found",
          message: `No property found with ID: ${propertyId}`
        });
      }

      console.log("Found property:", property);

      // Get property photos with proper joins and error handling
      const propertyPhotos = await db
        .select({
          photo: photos,
          user: {
            id: users.id,
            username: users.username,
            role: users.role
          },
          batch: {
            id: scan_batches.id,
            name: scan_batches.name,
            description: scan_batches.description,
            flightDate: scan_batches.flightDate
          }
        })
        .from(photos)
        .leftJoin(users, eq(photos.userId, users.id))
        .leftJoin(scan_batches, eq(photos.batchId, scan_batches.id))
        .where(eq(photos.propertyId, propertyId))
        .orderBy(photos.id);

      // Format the response with proper error handling for each photo
      const formattedPhotos = propertyPhotos.map(({ photo, user, batch }) => ({
        ...photo,
        url: photo.filename ? `/uploads/${photo.filename}` : null,
        thumbnailUrl: photo.thumbnailPath ? `/uploads/thumbnails/${path.basename(photo.thumbnailPath)}` : null,
        altitude: photo.altitude ? formatAltitude(Number(photo.altitude), 'feet') : null,
        user: user || null,
        batch: batch || null
      })).filter(photo => photo.url !== null);

      const response = {
        ...property,
        photos: formattedPhotos,
        _meta: {
          photoCount: formattedPhotos.length,
          lastUpdated: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching property details:", error);
      next(error);
    }
  });

  app.put("/api/properties/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const propertyId = parseInt(req.params.id);
      const {address, first_name, last_name, email, isDeleted } = req.body;
  
      if (isNaN(propertyId)) {
        return res.status(400).json({
          error: "Invalid property ID",
          message: "Property ID must be a number"
        });
      }
  
      console.log("Updating property details for ID:", propertyId);
  
      // Check if the property exists
      const [existingProperty] = await db
        .select()
        .from(properties)
        .where(
          and(
            eq(properties.id, propertyId),
            eq(properties.isDeleted, false)
          )
        )
        .limit(1);
  
      if (!existingProperty) {
        console.log("Property not found for ID:", propertyId);
        return res.status(404).json({
          error: "Property not found",
          message: `No property found with ID: ${propertyId}`
        });
      }
  
      // Perform the update
      const updatedProperty = await db
        .update(properties)
        .set({
          name: name ?? existingProperty.name,
          address: address ?? existingProperty.address,
          price: price ?? existingProperty.price,
          description: description ?? existingProperty.description,
          isDeleted: typeof isDeleted === "boolean" ? isDeleted : existingProperty.isDeleted,
          updatedAt: new Date()
        })
        .where(eq(properties.id, propertyId))
        .returning();
  
      if (!updatedProperty || updatedProperty.length === 0) {
        return res.status(500).json({
          error: "Update failed",
          message: "Failed to update property details"
        });
      }
  
      const response = {
        message: "Property updated successfully",
        property: updatedProperty[0]
      };
  
      console.log("Updated property:", updatedProperty[0]);
  
      res.json(response);
    } catch (error) {
      console.error("Error updating property details:", error);
      next(error);
    }
  });
  

  app.get("/api/properties", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { status, search } = req.query;
      let query = db
        .select({
          property: properties,
          photoCount: sql<number>`COUNT(DISTINCT ${photos.id})`,
          inspectionCount: sql<number>`COUNT(DISTINCT ${inspections.id})`
        })
        .from(properties)
        .leftJoin(photos, and(
          eq(photos.propertyId, properties.id),
          eq(photos.isDeleted, false)
        ))
        .leftJoin(inspections, and(
          eq(inspections.propertyId, properties.id)
        ))
        .where(eq(properties.isDeleted, false))
        .groupBy(properties.id);

      if (status && status !== 'all') {
        query = query.where(eq(properties.status, status as string));
      }

      if (search) {
        const searchTerm = `%${search}%`;
        query = query.where(
          or(
            sql`${properties.address} ILIKE ${searchTerm}`,
            sql`${properties.city} ILIKE ${searchTerm}`,
            sql`${properties.state} ILIKE ${searchTerm}`
          )
        );
      }

      const results = await query;

      const formattedProperties = results.map(({ property, photoCount, inspectionCount }) => ({
        ...property,
        photoCount: Number(photoCount),
        inspectionCount: Number(inspectionCount)
      }));

      res.json({ properties: formattedProperties });
    } catch (error) {
      console.error('Error fetching properties:', error);
      next(error);
    }
  });
  // Photo upload endpoints
  app.post("/api/photos/upload-chunk", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const chunkUpload = multer({
        storage: storage,
        limits: { fileSize: MAX_CHUNK_SIZE }
      }).single('chunk');
      chunkUpload(req, res, async (err) => {
        if (err) {
          return res.status(400).json({ error: err.message });
        }
        if (!req.file) {
          return res.status(400).json({ error: "No chunk uploaded" });
        }
        const { chunkIndex, totalChunks, fileName, batchId } = req.body;
        // Validate chunk information
        if (!chunkIndex || !totalChunks || !fileName || !batchId) {
          return res.status(400).json({ error: "Missing chunk information" });
        }
        const currentChunk = parseInt(chunkIndex);
        const totalChunksNum = parseInt(totalChunks);
        // If this was the last chunk, process the complete file
        if (currentChunk === totalChunksNum - 1) {
          try {
            const chunkDir = path.join(CHUNK_DIR, path.basename(fileName, path.extname(fileName)));
            const finalPath = await handleFileChunks(chunkDir, fileName, totalChunksNum);
            // Process the completed file
            const buffer = await fs.readFile(finalPath);
            const tags = await ExifReader.load(buffer);
            const gpsData = extractGPSData(tags);
            if (!gpsData || !gpsData.latitude || !gpsData.longitude) {
              await fs.unlink(finalPath);
              return res.status(400).json({
                error: "No valid GPS data",
                message: "The image does not contain valid GPS coordinates"
              });
            }
            // Find or create property based on GPS coordinates
            const propertyId = await findOrCreateProperty(gpsData, req.user.id);
            // Save to database with proper metadata
            const metadata: ExifMetadata = {
              gps: gpsData,
              DateTimeOriginal: parseTimestamp(tags)
            };
            const [photo] = await db
              .insert(photos)
              .values({
                propertyId,
                userId: req.user.id,
                batchId: parseInt(batchId),
                filename: path.basename(finalPath),
                originalName: fileName,
                mimeType: req.file.mimetype,
                size: (await fs.stat(finalPath)).size,
                latitude: gpsData.latitude,
                longitude: gpsData.longitude,
                altitude: gpsData.altitude,
                takenAt: metadata.DateTimeOriginal ? new Date(metadata.DateTimeOriginal) : null,
                metadata: metadata,
                storageLocation: finalPath,
                processingStatus: "processed"
              })
              .returning();
            res.json({
              message: "File upload complete",
              photo,
              propertyId
            });
          } catch (error) {
            console.error("Error processing completed file:", error);
            res.status(500).json({
              error: "Failed to process completed file",
              message: error instanceof Error ? error.message : String(error)
            });
          }
        } else {
          // Not the last chunk, acknowledge receipt
          res.json({
            message: "Chunk received",
            currentChunk,
            remainingChunks: totalChunksNum - currentChunk - 1
          });
        }
      });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/photos/upload", imageUpload.array("photos", 100), async (req: AuthenticatedRequest & FileUploadRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      if (!req.files?.length) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      // Create a new batch
      const [batch] = await db
        .insert(scan_batches)
        .values({
          name: `Batch ${new Date().toISOString()}`,
          userId: req.user.id,
          flightDate: new Date(),
        })
        .returning();

      if (!batch) {
        throw new Error("Failed to create batch");
      }

      const results: UploadResult = {
        success: [],
        noCoordinates: [],
        errors: []
      };

      // Process each file
      for (const file of req.files as Express.Multer.File[]) {
        try {
          console.log(`Processing uploaded file: ${file.originalname}`);

          // Read file and extract metadata
          const buffer = await fs.readFile(file.path);
          const tags = await ExifReader.load(buffer);
          const gpsData = extractGPSData(tags);
          const timestamp = parseTimestamp(tags);

          const metadata: ExifMetadata = {
            gps: gpsData,
            DateTimeOriginal: timestamp
          };

          // Generate thumbnail
          const thumbnailPath = await imageProcessor.generateThumbnail(file.path);

          console.log("thumbnailPath: ",thumbnailPath)
          // Save to database
          const photo = await savePhotoToDatabase(
            file,
            null,
            req.user.id,
            metadata,
            batch.id,
            thumbnailPath
          );

          if (gpsData) {
            results.success.push(photo);
          } else {
            results.noCoordinates.push(photo);
          }

        } catch (error) {
          console.error(`Error processing file ${file.originalname}:`, error);
          results.errors.push({
            filename: file.filename,
            error: error instanceof Error ? error.message : String(error),
            originalName: file.originalname
          });
        }
      }

      // Start processing the successful uploads in the background
      if (results.success.length > 0) {
        const photosToProcess = results.success.map(photo => ({
          ...photo,
          path: path.join(UPLOAD_DIR, photo.filename)
        }));

        PROCESSING_QUEUE.push({
          files: photosToProcess,
          userId: req.user.id,
          batchId: batch.id
        });
        processQueue(); // Start processing if not already running
      }

      // Send response
      res.status(200).json({
        message: "Upload completed",
        results: {
          total: req.files.length,
          processed: results.success.length + results.noCoordinates.length,
          withCoordinates: results.success.length,
          withoutCoordinates: results.noCoordinates.length,
          errors: results.errors.length,
        },
        batchId: batch.id
      });

    } catch (error) {
      console.error("Error in upload handler:", error);
      next(error);
    }
  });

  // Add this route after the photos upload endpoint and before registerRoutes
  app.get("/api/photos/failed", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: "Not authenticated",
          message: "You must be logged in to view failed photos"
        });
      }

      const failedPhotos = await db
        .select()
        .from(photos)
        .where(
          eq(photos.processingStatus, "failed")
        )
        .orderBy(desc(photos.uploadedAt));

      res.json(failedPhotos);
    } catch (error) {
      next(error);
    }
  });

  // Add this route to handle unassigned photos
  app.get("/api/photos/unassigned", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: "Not authenticated",
          message: "You must be logged in to view unassigned photos"
        });
      }

      const unassignedPhotos = await db
        .select()
        .from(photos)
        .where(
          eq(photos.processingStatus, "pending")
        )
        .orderBy(desc(photos.uploadedAt));

      res.json(unassignedPhotos);
    } catch (error) {
      next(error);
    }
  });

  // Add this route to handle manual photo assignment
  app.post("/api/photos/:id/assign", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: "Not authenticated",
          message: "You must be logged in to assign photos"
        });
      }

      const photoId = parseInt(req.params.id);
      const { address } = req.body;

      if (!address) {
        return res.status(400).json({
          error: "Invalid input",
          message: "Property address is required"
        });
      }

      // First, find the photo
      const photo = await db
        .select()
        .from(photos)
        .where(eq(photos.id, photoId))
        .limit(1);

      if (!photo[0]) {
        return res.status(404).json({
          error: "Not found",
          message: "Photo not found"
        });
      }

      // Get coordinates from the photo metadata for geocoding
      const photoLat = photo[0].latitude;
      const photoLon = photo[0].longitude;

      // Find or create the property
      let propertyId: number;
      if (photoLat && photoLon) {
        // If we have coordinates, use them to find or create the property
        propertyId = await findOrCreateProperty(
          { latitude: photoLat, longitude: photoLon, altitude: null },
          req.user.id
        );
      } else {
        // If no coordinates, geocode the provided address
        // if (!process.env.GOOGLE_MAPS_API_KEY) {
        //   return res.status(500).json({
        //     error: "Configuration error",
        //     message: "Google Maps API key not configured"
        //   });
        // }

        try {
          const response = await googleMapsClient.geocode({
            params: {
              address: address,
              key: process.env.GOOGLE_MAPS_API_KEY|| 'AIzaSyAq_TvETnjsrA18ZfiUIgL1wfOOszSz51M'
            }
          });

          if (response.data.results.length === 0) {
            return res.status(400).json({
              error: "Invalid address",
              message: "Could not geocode the provided address"
            });
          }

          const location = response.data.results[0].geometry.location;
          propertyId = await findOrCreateProperty(
            { latitude: location.lat, longitude: location.lng, altitude: null },
            req.user.id
          );
        } catch (error) {
          console.error("Geocoding error:", error);
          return res.status(500).json({
            error: "Geocoding failed",
            message: "Failed to geocode the provided address"
          });
        }
      }

      // Update the photo with the property ID
      await db
        .update(photos)
        .set({
          propertyId,
          processingStatus: "processed",
          matchMethod: "manual",
          metadata: {
            ...photo[0].metadata,
            manual_assignment: {
              assigned_by: req.user.id,
              assigned_at: new Date().toISOString(),
              original_address: address
            }
          }
        })
        .where(eq(photos.id, photoId));

      res.json({ success: true, propertyId });
    } catch (error) {
      next(error);
    }
  });

  // Update inspection route fix
  app.put("/api/inspections/:id/photos/:photoId/annotations", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const inspectionId = parseInt(req.params.id);
      const photoId = parseInt(req.params.photoId);
      const { annotations, notes, damageType, severity } = req.body;

      const [inspection] = await db
        .select()
        .from(inspections)
        .where(eq(inspections.id, inspectionId))
        .limit(1);

      if (!inspection) {
        return res.status(404).json({ error: "Inspection not found" });
      }

      const updatedAnnotations = [...(inspection.annotations || [])];
      const photoIndex = updatedAnnotations.findIndex(a => a.photoId === photoId);

      const photoAnnotation = {
        photoId,
        annotations: annotations || [],
        notes: notes || "",
        damageType: damageType || "none",
        severity: severity || "low"
      };

      if (photoIndex >= 0) {
        updatedAnnotations[photoIndex] = photoAnnotation;
      } else {
        updatedAnnotations.push(photoAnnotation);
      }

      await db
        .update(inspections)
        .set({ annotations: updatedAnnotations })
        .where(eq(inspections.id, inspectionId));

      res.json({ status: "success", data: updatedAnnotations });
    } catch (error) {
      console.error("Error updating annotations:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to update annotations",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/properties", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { status, search } = req.query;
      let query = db
        .select({
          property: properties,
          photoCount: sql<number>`COUNT(DISTINCT ${photos.id})`,
          inspectionCount: sql<number>`COUNT(DISTINCT ${inspections.id})`
        })
        .from(properties)
        .leftJoin(photos, and(
          eq(photos.propertyId, properties.id),
          eq(photos.isDeleted, false)
        ))
        .leftJoin(inspections, and(
          eq(inspections.propertyId, properties.id)
        ))
        .where(eq(properties.isDeleted, false))
        .groupBy(properties.id);

      if (status && status !== 'all') {
        query = query.where(eq(properties.status, status as string));
      }

      if (search) {
        const searchTerm = `%${search}%`;
        query = query.where(
          or(
            sql`${properties.address} ILIKE ${searchTerm}`,
            sql`${properties.city} ILIKE ${searchTerm}`,
            sql`${properties.state} ILIKE ${searchTerm}`
          )
        );
      }

      const results = await query;

      const formattedProperties = results.map(({ property, photoCount, inspectionCount }) => ({
        ...property,
        photoCount: Number(photoCount),
        inspectionCount: Number(inspectionCount)
      }));

      res.json({ properties: formattedProperties });
    } catch (error) {
      console.error('Error fetching properties:', error);
      next(error);
    }
  });
  // Property routes
  app.get("/api/properties/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const propertyId = parseInt(req.params.id);

      if (isNaN(propertyId)) {
        return res.status(400).json({
          error: "Invalid property ID",
          message: "Property ID must be a number"
        });
      }

      console.log("Fetching property details for ID:", propertyId);

      // Get property details with better error handling
      const [property] = await db
        .select()
        .from(properties)
        .where(
          and(
            eq(properties.id, propertyId),
            eq(properties.isDeleted, false)
          )
        )
        .limit(1);

      if (!property) {
        console.log("Property not found for ID:", propertyId);
        return res.status(404).json({
          error: "Property not found",
          message: `No property found with ID: ${propertyId}`
        });
      }

      console.log("Found property:", property);

      // Get property photos with proper joins and error handling
      const propertyPhotos = await db
        .select({
          photo: photos,
          user: {
            id: users.id,
            username: users.username,
            role: users.role
          },
          batch: {
            id: scan_batches.id,
            name: scan_batches.name,
            description: scan_batches.description,
            flightDate: scan_batches.flightDate
          }
        })
        .from(photos)
        .leftJoin(users, eq(photos.userId, users.id))
        .leftJoin(scan_batches, eq(photos.batchId, scan_batches.id))
        .where(eq(photos.propertyId, propertyId));

      // Format the response with proper error handling for each photo
      const formattedPhotos = propertyPhotos.map(({ photo, user, batch }) => ({
        ...photo,
        url: photo.filename ? `/uploads/${photo.filename}` : null,
        thumbnailUrl: photo.thumbnailPath ? `/uploads/thumbnails/${path.basename(photo.thumbnailPath)}` : null,
        altitude: photo.altitude ? formatAltitude(Number(photo.altitude), 'feet') : null,
        user: user || null,
        batch: batch || null
      })).filter(photo => photo.url !== null);

      const response = {
        ...property,
        photos: formattedPhotos,
        _meta: {
          photoCount: formattedPhotos.length,
          lastUpdated: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching property details:", error);
      next(error);
    }
  });

  app.get("/api/properties", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { status, search } = req.query;
      let query = db
        .select({
          property: properties,
          photoCount: sql<number>`COUNT(DISTINCT ${photos.id})`,
          inspectionCount: sql<number>`COUNT(DISTINCT ${inspections.id})`
        })
        .from(properties)
        .leftJoin(photos, and(
          eq(photos.propertyId, properties.id),
          eq(photos.isDeleted, false)
        ))
        .leftJoin(inspections, and(
          eq(inspections.propertyId, properties.id)
        ))
        .where(eq(properties.isDeleted, false))
        .groupBy(properties.id);

      if (status && status !== 'all') {
        query = query.where(eq(properties.status, status as string));
      }

      if (search) {
        const searchTerm = `%${search}%`;
        query = query.where(
          or(
            sql`${properties.address} ILIKE ${searchTerm}`,
            sql`${properties.city} ILIKE ${searchTerm}`,
            sql`${properties.state} ILIKE ${searchTerm}`
          )
        );
      }

      const results = await query;

      const formattedProperties = results.map(({ property, photoCount, inspectionCount }) => ({
        ...property,
        photoCount: Number(photoCount),
        inspectionCount: Number(inspectionCount)
      }));

      res.json({ properties: formattedProperties });
    } catch (error) {
      console.error('Error fetching properties:', error);
      next(error);
    }
  });
  app.post("/api/properties/:propertyId/inspections", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: "Not authenticated",
          message: "You must be logged in to create inspections"
        });
      }
      const propertyId = parseInt(req.params.propertyId);
      if (isNaN(propertyId)) {
        return res.status(400).json({
          error: "Invalid property ID",
          message: "Property ID must be a number"
        });
      }
      // Validate the request body
      const validatedData = inspectionSchema.parse(req.body);
      // Create the inspection
      const [inspection] = await db
        .insert(inspections)
        .values({
          propertyId: propertyId,
          userId: req.user.id,
          photoId: validatedData.photoId,
          status: validatedData.status || "draft",
          damageType: validatedData.damageType,
          severity: validatedData.severity,
          notes: validatedData.notes,
          annotations: validatedData.annotations,
          createdAt: new Date(),
          completedAt: validatedData.status === "completed" ? new Date() : null,
          aiAnalysisStatus: "pending"
        })
        .returning();
      if (!inspection) {
        throw new Error("Failed to create inspection");
      }
      // Update property's last inspection date
      await db
        .update(properties)
        .set({
          lastInspectionAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(properties.id, propertyId));
      // Format the response
      const response = {
        ...inspection,
        createdAt: inspection.createdAt?.toISOString(),
        completedAt: inspection.completedAt?.toISOString(),
        annotations: inspection.annotations || [],
        aiFindings: inspection.aiFindings || null,
      };
      res.status(201).json(response);
    } catch (error) {
      console.error("Error creating inspection:", error);
      next(error);
    }
  });
  // GET inspections for a property
  app.get("/api/properties/:propertyId/inspections", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: "Not authenticated",
          message: "You must be logged in to view inspections"
        });
      }
      const propertyId = parseInt(req.params.propertyId);
      if (isNaN(propertyId)) {
        return res.status(400).json({
          error: "Invalid property ID",
          message: "Property ID must be a number"
        });
      }
      // Get all inspections for the property
      const propertyInspections = await db
        .select()
        .from(inspections)
        .where(eq(inspections.propertyId, propertyId))
        .orderBy(desc(inspections.createdAt));
      // Format the response
      const formattedInspections = propertyInspections.map(inspection => ({
        id: inspection.id,
        propertyId: inspection.propertyId,
        userId: inspection.userId,
        photoId: inspection.photoId,
        status: inspection.status,
        damageType: inspection.damageType,
        severity: inspection.severity,
        notes: inspection.notes,
        annotations: inspection.annotations || [],
        createdAt: inspection.createdAt.toISOString(),
        completedAt: inspection.completedAt?.toISOString(),
        aiFindings: inspection.aiFindings
      }));
      res.json(formattedInspections);
    } catch (error) {
      next(error);
    }
  });
  // Update batch inspection endpoint to handle annotations properly
  app.post("/api/properties/:propertyId/inspection/batch", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const propertyId = parseInt(req.params.propertyId);
      const { status, notes, photos } = req.body;
      console.log('Received inspection data:', {
        propertyId,
        userId: req.user.id,
        status,
        photoCount: photos.length,
        notes,
        photos // Log the full photos data
      });
      // Format the annotations structure
      const photoAnnotations = photos.map(photo => ({
        photoId: photo.photo_id,
        annotations: photo.annotations || [],
        notes: photo.notes || "",
        damageType: photo.damage_type || "other",
        severity: photo.severity || "low"
      }));
      // Create a single inspection for all photos
      const [inspection] = await db
        .insert(inspections)
        .values({
          propertyId,
          userId: req.user.id,
          status: status || "draft",
          notes: notes || "",
          damageType: photos[0]?.damage_type || "other",
          severity: photos[0]?.severity || "low",
          createdAt: new Date(),
          completedAt: status === "completed" ? new Date() : null,
          annotations: photoAnnotations // Store annotations for all photos
        })
        .returning();
      console.log('Created inspection:', inspection);
      res.json({
        message: "Inspection saved successfully",
        propertyId,
        inspectionId: inspection.id,
        photosProcessed: photos.length
      });
    } catch (error) {
      console.error('Error creating batch inspection:', error);
      next(error);
    }
  });
  // Update GET inspection endpoint for proper photo annotations
  app.get("/api/properties/:propertyId/inspection/:inspectionId", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const propertyId = parseInt(req.params.propertyId);
      const inspectionId = parseInt(req.params.inspectionId);
      console.log('Fetching inspection:', { inspectionId, propertyId });
      // Get inspection details
      const [inspection] = await db
        .select()
        .from(inspections)
        .where(
          and(
            eq(inspections.id, inspectionId),
            eq(inspections.propertyId, propertyId)
          )
        )
        .limit(1);
      if (!inspection) {
        return res.status(404).json({ error: "Inspection not found" });
      }
      // Get photos associated with this inspection
      const inspectionPhotos = await db
        .select()
        .from(photos)
        .where(eq(photos.propertyId, propertyId));
      // Ensure annotations is an array
      const photoAnnotations = Array.isArray(inspection.annotations)
        ? inspection.annotations
        : [];
      // Format the response
      const response = {
        id: inspection.id,
        propertyId: inspection.propertyId,
        status: inspection.status,
        damageType: inspection.damageType,
        severity: inspection.severity,
        notes: inspection.notes || "",
        createdAt: inspection.createdAt?.toISOString(),
        completedAt: inspection.completedAt?.toISOString(),
        photos: inspectionPhotos.map(photo => {          // Find the annotations for this photo
          const photoAnnotation = photoAnnotations.find(a => a.photoId === photo.id);
          return {
            id: photo.id,
            filename: photo.filename,
            originalName: photo.originalName,
            url: `/uploads/${photo.filename}`,
            annotations: photoAnnotation?.annotations || [],
            notes: photoAnnotation?.notes || "",
            damageType: photoAnnotation?.damageType || inspection.damageType,
            severity: photoAnnotation?.severity || inspection.severity
          };
        })
      };
      console.log('Sending inspection response:', response);
      res.json(response);
    } catch (error) {
      console.error('Error retrieving inspection:', error);
      next(error);
    }
  });
  // Update inspection endpoint
  app.put("/api/properties/:propertyId/inspection/:inspectionId", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const inspectionId = parseInt(req.params.inspectionId);
      const propertyId = parseInt(req.params.propertyId);
      const { photoId, annotations, notes, damageType, severity, status } = req.body;
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      console.log('Updating inspection:', {
        inspectionId,
        propertyId,
        photoId,
        annotations,
        notes,
        damageType,
        severity,
        status
      });
      // Get current inspection
      const [currentInspection] = await db
        .select()
        .from(inspections)
        .where(eq(inspections.id, inspectionId))
        .limit(1);
      if (!currentInspection) {
        return res.status(404).json({ error: "Inspection not found" });
      }
      // Update annotations for the specific photo
      let updatedAnnotations = currentInspection.annotations || [];
      if (photoId) {
        const photoIndex = updatedAnnotations.findIndex(a => a.photoId === photoId);
        const photoAnnotation = {
          photoId,
          annotations: annotations || [],
          notes: notes || "",
          damageType: damageType || "none",
          severity: severity || "low"
        };
        if (photoIndex >= 0) {
          updatedAnnotations[photoIndex] = photoAnnotation;
        } else {
          updatedAnnotations.push(photoAnnotation);
        }
      }
      // Update the inspection record with all its fields
      const [updatedInspection] = await db
        .update(inspections)
        .set({
          annotations: updatedAnnotations,
          status: status || currentInspection.status,
          damageType: damageType || currentInspection.damageType,
          severity: severity || currentInspection.severity,
          notes: notes || currentInspection.notes,
          updatedAt: new Date(),
          completedAt: status === "completed" ? new Date() : currentInspection.completedAt
        })
        .where(eq(inspections.id, inspectionId))
        .returning();
      // Return full inspection details
      const photos = await db
        .select()
        .from(photos)
        .where(eq(photos.propertyId, propertyId));
      const formattedPhotos = photos.map(photo => {
        const photoAnnotation = updatedAnnotations.find(a => a.photoId === photo.id);
        return {
          id: photo.id,
          filename: photo.filename,
          originalName: photo.originalName,
          url: `/uploads/${photo.filename}`,
          annotations: photoAnnotation?.annotations || [],
          notes: photoAnnotation?.notes || "",
          damageType: photoAnnotation?.damageType || "none",
          severity: photoAnnotation?.severity || "low"
        };
      });
      res.json({
        ...updatedInspection,
        photos: formattedPhotos
      });
    } catch (error) {
      next(error);
    }
  });
  app.delete("/api/properties/:propertyId/inspection/:inspectionId", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const inspectionId = parseInt(req.params.inspectionId);
      const propertyId = parseInt(req.params.propertyId);
      console.log('Deleting inspection:', { inspectionId, propertyId });
      await db
        .delete(inspections)
        .where(
          and(
            eq(inspections.id, inspectionId),
            eq(inspections.propertyId, propertyId)
          )
        );
      res.json({ message: "Inspection deleted successfully" });
    } catch (error) {
      console.error('Error deleting inspection:', error);
      next(error);
    }
  });
  // Add inspection completion endpoint with proper error handling
  app.post("/api/inspections/:id/complete", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const inspectionId = parseInt(req.params.id);
      console.log('Completing inspection:', inspectionId);

      if (!req.user) {return res.status(401).json({ error: "Not authenticated" });
      }

      if (isNaN(inspectionId)) {
        return res.status(400).json({
          error: "Invalid inspection ID",
          message: "Inspection ID must be a number"
        });
      }

      const { photos, overallNotes } = req.body;

      if (!Array.isArray(photos)) {
        return res.status(400).json({
          error: "Invalid request",
          message: "Photos must be an array"
        });
      }

      // Update inspection status and notes
      const [inspection] = await db
        .update(inspections)
        .set({
          status: 'completed',
          completedAt: new Date(),
          notes: overallNotes
        })
        .where(eq(inspections.id, inspectionId))
        .returning();

      if (!inspection) {
        return res.status(404).json({
          error: "Not found",
          message: "Inspection not found"
        });
      }

      // Update photos with annotations and analysis
      for (const photo of photos) {
        await db
          .update(photos)
          .set({
            editedImage: photo.capturedImage,
            analysis: photo.analysis,
            isDefault: photo.isDefault || false
          })
          .where(eq(photos.id, photo.photoId));
      }

      console.log('Successfully completed inspection:', inspectionId);

      res.json({
        message: "Inspection completed successfully",
        inspection
      });

    } catch (error) {
      console.error("Error completing inspection:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to complete inspection"
      });
    }
  });

  // Update the inspection download endpoint
  app.get("/api/inspections/:id/download", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const inspectionId = parseInt(req.params.id);
      console.log('Generating PDF for inspection:', inspectionId);

      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      if (isNaN(inspectionId)) {
        return res.status(400).json({
          error: "Invalid inspection ID",
          message: "Inspection ID must be a number"
        });
      }

      // Get inspection with all related data
      const inspection = await db.query.inspections.findFirst({
        where: eq(inspections.id, inspectionId),
        with: {
          property: true,
          photos: {
            where: eq(photos.isDeleted, false)
          }
        }
      });

      if (!inspection || !inspection.property) {
        return res.status(404).json({
          error: "Not found",
          message: "Inspection or property not found"
        });
      }

      // Format data for PDF generation
      const reportData = {
        property: {
          address: inspection.property.address,
          city: inspection.property.city,
          state: inspection.property.state,
          zipCode: inspection.property.zipCode,
          parcelNumber: inspection.property.parcelNumber,
          yearBuilt: inspection.property.yearBuilt,
          propertyUse: inspection.property.propertyUse,
          propertyValue: inspection.property.propertyValue,
          landValue: inspection.property.landValue,
          improvementValue: inspection.property.improvementValue
        },
        owners: {
          primary: inspection.property.owner1FirstName || inspection.property.owner1LastName ? {
            name: `${inspection.property.owner1FirstName || ''} ${inspection.property.owner1LastName || ''}`.trim(),
            company: inspection.property.owner1Company,
            phone: inspection.property.owner1Phone,
            email: inspection.property.owner1Email
          } : undefined,
          secondary: inspection.property.owner2FirstName || inspection.property.owner2LastName ? {
            name: `${inspection.property.owner2FirstName || ''} ${inspection.property.owner2LastName || ''}`.trim(),
            company: inspection.property.owner2Company,
            phone: inspection.property.owner2Phone,
            email: inspection.property.owner2Email
          } : undefined
        },
        inspectionData: inspection.photos.map(photo => ({
          photoId: photo.id,
          editedImage: photo.editedImage || `/uploads/${photo.filename}`,
          damageType: inspection.damageType || 'unknown',
          severity: inspection.severity || 'unknown',
          notes: inspection.notes || '',
          weather: photo.metadata?.weather || null
        }))
      };

      // Generate PDF
      const pdfData = await generateInspectionReport(reportData);
      const pdfBuffer = Buffer.from(pdfData.split(',')[1], 'base64');

      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="inspection-${inspectionId}.pdf"`);

      // Send the PDF
      res.send(pdfBuffer);

    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to generate PDF report"
      });
    }
  });

  // Add report upload endpoint with PDF-specific upload middleware
  app.post(
    "/api/properties/:id/inspections/:inspectionId/report",
    pdfUpload.single('report'),
    async (req: AuthenticatedRequest & { file?: Express.Multer.File }, res: Response) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            error: "Unauthorized",
            message: "Authentication required"
          });
        }

        const propertyId = parseInt(req.params.id);
        const inspectionId = parseInt(req.params.inspectionId);

        if (isNaN(propertyId) || isNaN(inspectionId)) {
          return res.status(400).json({ error: "Invalid property or inspection ID" });
        }

        const inspection = await db.query.inspections.findFirst({
          where: and(
            eq(inspections.id, inspectionId),
            eq(inspections.propertyId, propertyId)
          )
        });

        if (!inspection) {
          return res.status(404).json({ error: "Inspection not found" });
        }

        // Handle file upload

        if (!req.file) {
          return res.status(400).json({ error: "No report file provided" });
        }

        try {
          console.log('Creating report record...');
          const [report] = await db
            .insert(reports)
            .values({
              inspectionId,
              propertyId,
              reportPath: req.file.path,
              status: 'completed',
              reportType: 'inspection',
              createdAt: new Date(),
              metadata: {
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                size: req.file.size
              }
            })
            .returning();

          console.log('Report created:', report);

          // Update inspection status
          await db
            .update(inspections)
            .set({
              status: 'completed',
              completedAt: new Date()
            })
            .where(eq(inspections.id, inspectionId));

          res.json({
            success: true,
            report: {
              id: report.id,
              path: `/uploads/reports/${path.basename(req.file.path)}`,
              createdAt: report.createdAt
            }
          });
        } catch (dbError) {
          console.error('Database error:', dbError);
          res.status(500).json({ error: "Failed to save report to database" });
        }
      } catch (error) {
        console.error('Report upload error:', error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  // Add endpoint to serve PDF reports
  app.get('/uploads/reports/:filename', (req, res, next) => {
    const filename = req.params.filename;
    const reportPath = path.join(UPLOAD_DIR, 'reports', filename);

    // Verify file exists before serving
    fs.access(reportPath)
      .then(() => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.sendFile(reportPath);
      })
      .catch(() => {
        res.status(404).json({ error: "Report not found" });
      });
  });

  // Error handling middleware
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });
  // Create server
  const httpServer = createServer(app);
  // Add endpoint to set default photo
  app.post("/api/photos/:id/set-default", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const photoId = parseInt(req.params.id);
      const propertyId = parseInt(req.query.propertyId as string);
      if (isNaN(photoId) || isNaN(propertyId)) {
        return res.status(400).json({
          error: "Invalid request",
          message: "Photo ID and property ID are required"
        });
      }
      // Reset any existing default photos for this property
      await db
        .update(photos)
        .set({ isDefault: false })
        .where(eq(photos.propertyId, propertyId));
      // Set the new default photo
      const [updatedPhoto] = await db
        .update(photos)
        .set({ isDefault: true })
        .where(eq(photos.id, photoId))
        .returning();
      if (!updatedPhoto) {
        return res.status(404).json({
          error: "Photo not found",
          message: `No photo found with ID: ${photoId}`
        });
      }
      res.json(updatedPhoto);
    } catch (error) {
      next(error);
    }
  });
  // Add proper error handling middleware and JSON response handling
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Global error handler:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message
    });
  });

  // Add these routes after the existing inspection routes

  // Save inspection photos
  app.post("/api/properties/:propertyId/inspection/photo", async (req: AuthenticatedRequest, res: Response) => {
    // Ensure JSON response type
    res.setHeader('Content-Type', 'application/json');

    try {
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          error: "Not authenticated"
        });
      }

      const propertyId = parseInt(req.params.propertyId);
      console.log("propertyId: ",propertyId)
      const { photoIds } = req.body;
      console.log("photoIds: ",propertyId)

      if (!photoIds || !Array.isArray(photoIds)) {
        return res.status(400).json({
          status: 'error',
          error: "Invalid photo IDs",
          message: "Photo IDs must be provided as an array"
        });
      }

      // Create new inspection
      const [inspection] = await db
        .insert(inspections)
        .values({
          propertyId,
          userId: req.user.id,
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      if (!inspection) {
        return res.status(500).json({
          status: 'error',
          error: "Failed to create inspection",
          message: "Database error while creating inspection"
        });
      }

      // Update photos with inspection ID
      await Promise.all(
        photoIds.map(async (photoId: number) => {
          try {
            await db
              .update(photos)
              .set({ inspectionId: inspection.id })
              .where(eq(photos.id, photoId));
          } catch (error) {
            console.error(`Error updating photo ${photoId}:`, error);
          }
        })
      );

      // Return success response
      return res.status(200).json({
        status: 'success',
        data: {
          inspectionId: inspection.id,
          propertyId: inspection.propertyId,
          photoCount: photoIds.length
        }
      });

    } catch (error) {
      console.error('Error saving inspection photos:', error);
      return res.status(500).json({
        status: 'error',
        error: 'Failed to save inspection photos',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  // Report generation endpoint
  app.post("/api/reports/generate", async (req: AuthenticatedRequest, res: Response) => {
    // Ensure JSON response
    res.setHeader('Content-Type', 'application/json');

    try {
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          error: "Not authenticated"
        });
      }

      const { propertyId, inspectionId } = req.body;

      if (!propertyId || !inspectionId) {
        return res.status(400).json({
          status: 'error',
          error: "Missing required data",
          message: "Property ID and Inspection ID are required"
        });
      }

      // Get property details
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.id, propertyId))
        .limit(1);

      if (!property) {
        return res.status(404).json({
          status: 'error',
          error: "Property not found",
          message: `No property found with ID: ${propertyId}`
        });
      }

      // Get inspection details
      const [inspection] = await db
        .select()
        .from(inspections)
        .where(eq(inspections.id, inspectionId))
        .limit(1);

      if (!inspection) {
        return res.status(404).json({
          status: 'error',
          error: "Inspection not found",
          message: `No inspection found with ID: ${inspectionId}`
        });
      }

      // Get property photos
      const propertyPhotos = await db
        .select()
        .from(photos)
        .where(
          and(
            eq(photos.propertyId, propertyId),
            eq(photos.isDeleted, false)
          )
        );

      // Generate the report
      const report = await generateInspectionReport({
        property,
        inspection,
        photos: propertyPhotos.map(photo => ({
          ...photo,
          url: `/uploads/${photo.filename}`,
          thumbnailUrl: photo.thumbnailPath
            ? `/uploads/thumbnails/${path.basename(photo.thumbnailPath)}`
            : null
        }))
      });

      if (!report.success || !report.filePath) {
        return res.status(500).json({
          status: 'error',
          error: 'Report generation failed',
          message: report.error || 'Failed to generate report file'
        });
      }

      // Save report to database
      const [savedReport] = await db
        .insert(reports)
        .values({
          propertyId,
          inspectionId,
          userId: req.user.id,
          reportType: 'inspection',
          status: 'completed',
          reportPath: report.filePath,
          createdAt: new Date(),
          updatedAt: new Date(),
          isDeleted: false
        })
        .returning();

      if (!savedReport) {
        return res.status(500).json({
          status: 'error',
          error: 'Database error',
          message: 'Failed to save report to database'
        });
      }

      // Return success response
      return res.status(200).json({
        status: 'success',
        data: {
          reportId: savedReport.id,
          downloadUrl: `/api/reports/${savedReport.id}/download`,
          reportType: savedReport.reportType,
          createdAt: savedReport.createdAt
        }
      });

    } catch (error) {
      console.error('Error in report generation endpoint:', error);
      return res.status(500).json({
        status: 'error',
        error: 'Failed to generate report',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Report download endpoint
  app.get("/api/reports/:id/download", async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const reportId = parseInt(req.params.id);
      if (isNaN(reportId)) {
        return res.status(400).json({ error: "Invalid report ID" });
      }

      // Get report details
      const [report] = await db
        .select()
        .from(reports)
        .where(eq(reports.id, reportId))
        .limit(1);

      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }

      // Verify file exists
      if (!report.reportPath || !(await fs.access(report.reportPath).then(() => true).catch(() => false))) {
        return res.status(404).json({ error: "Report file not found" });
      }

      // Send file
      res.download(report.reportPath);

    } catch (error) {
      console.error('Error downloading report:', error);
      res.status(500).json({
        error: 'Failed to download report',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return httpServer;
}

// Placeholder for PDF generation function.  Requires a library like PDFKit or jsPDF.
async function generateInspectionReport(reportData: any): Promise<{success:boolean, filePath:string, error?:string}> {
  //This is a placeholder. Replace with actual PDF generation logic using a library like PDFKit or jsPDF.
  //Simulate success and failure scenarios
  if(Math.random() < 0.8){
    return {success: true, filePath: '/path/to/report.pdf'};
  } else {
    return {success: false, filePath:'', error: 'Report generation failed'};
  }
}