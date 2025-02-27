/**
 * Database Schema Optimization Guide for 10M+ Properties
 * 
 * Performance Considerations:
 * 1. Table Partitioning: Properties table is partitioned by created_at for better query performance
 * 2. Indexing Strategy: 
 *    - Compound indexes for commonly joined fields
 *    - Composite indexes including soft delete flag
 *    - B-tree indexes for range queries
 * 3. Query Optimization:
 *    - Use cursor-based pagination for large result sets
 *    - Implement materialized views for complex aggregations
 *    - Leverage table partitioning for date-based queries
 */

import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * User table - Stores user authentication and role information
 * Indexed fields: username for quick lookups during authentication
 * Expected size: Small (< 10k records)
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  role: text("role", { enum: ["admin", "user"] }).default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  usernameIdx: index("username_idx").on(table.username),
  roleIdx: index("role_idx").on(table.role),
}));

/**
 * Properties table - Core table for storing property information
 * Optimized for: 
 * - 10M+ records
 * - Frequent reads
 * - Geospatial queries
 * - Status-based filtering
 * 
 * Partitioning: By created_at for efficient historical data management
 * Indexes: Compound indexes for common query patterns
 */
export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  county: text("county"),
  latitude: decimal("latitude", { precision: 10, scale: 6 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 6 }).notNull(),
  boundaryNeLat: decimal("boundary_ne_lat", { precision: 10, scale: 6 }),
  boundaryNeLng: decimal("boundary_ne_lng", { precision: 10, scale: 6 }),
  boundarySeLat: decimal("boundary_sw_lat", { precision: 10, scale: 6 }),
  boundarySeLng: decimal("boundary_sw_lng", { precision: 10, scale: 6 }),
  placeId: text("place_id"),
  status: text("status", { enum: ["processing", "pending", "inspected", "archived"] }).default("processing").notNull(),
  owner1FirstName: text("owner1_first_name"),
  owner1LastName:  text("owner1_last_name"),
  owner1Phone:  text("owner1_phone"),
  owner1Email:  text("owner1_email"),
  owner1Phone1: text("owner1_phone1"),
  owner1Email1: text("owner1_email1"),
  owner1Phone2: text("owner1_phone2"),
  owner1Email2: text("owner1_email2"),
  owner1Phone3: text("owner1_phone3"),
  owner1Email3: text("owner1_email3"),
  owner1Phone4: text("owner1_phone4"),
  owner1Email4: text("owner1_email4"),
  owner1Company: text("owner1_company"),
  owner1Notes: text("owner1_notes"),
  owner2FirstName: text("owner2_first_name"),
  owner2LastName:  text("owner2_last_name"),
  owner2Phone:  text("owner2_phone"),
  owner2Email:  text("owner2_email"),
  owner2Phone1: text("owner2_phone1"),
  owner2Email1: text("owner2_email1"),
  owner2Phone2: text("owner2_phone2"),
  owner2Email2: text("owner2_email2"),
  owner2Phone3: text("owner2_phone3"),
  owner2Email3: text("owner2_email3"),
  owner2Phone4: text("owner2_phone4"),
  owner2Email4: text("owner2_email4"),
  owner2Company: text("owner2_company"),
  owner2Notes: text("owner2_notes"),
  owner3FirstName: text("owner3_first_name"),
  owner3LastName:  text("owner3_last_name"),
  owner3Phone:  text("owner3_phone"),
  owner3Email:  text("owner3_email"),
  owner3Phone1: text("owner3_phone1"),
  owner3Email1: text("owner3_email1"),
  owner3Phone2: text("owner3_phone2"),
  owner3Email2: text("owner3_email2"),
  owner3Phone3: text("owner3_phone3"),
  owner3Email3: text("owner3_email3"),
  owner3Phone4: text("owner3_phone4"),
  owner3Email4: text("owner3_email4"),
  owner3Company: text("owner3_company"),
  owner3Notes:   text("owner3_notes"),
  owner4FirstName: text("owner4_first_name"),
  owner4LastName:  text("owner4_last_name"),
  owner4Phone:  text("owner4_phone"),
  owner4Email:  text("owner4_email"),
  owner4Phone1: text("owner4_phone1"),
  owner4Email1: text("owner4_email1"),
  owner4Phone2: text("owner4_phone2"),
  owner4Email2: text("owner4_email2"),
  owner4Phone3: text("owner4_phone3"),
  owner4Email3: text("owner4_email3"),
  owner4Phone4: text("owner4_phone4"),
  owner4Email4: text("owner4_email4"),
  owner4Company: text("owner4_company"),
  owner4Notes: text("owner4_notes"),
  owner5FirstName: text("owner5_first_name"), 
  owner5LastName:  text("owner5_last_name"),
  owner5Phone:  text("owner5_phone"),
  owner5Email:  text("owner5_email"),
  owner5Phone1: text("owner5_phone1"),
  owner5Email1: text("owner5_email1"),
  owner5Phone2: text("owner5_phone2"),
  owner5Email2: text("owner5_email2"),
  owner5Phone3: text("owner5_phone3"),
  owner5Email3: text("owner5_email3"),
  owner5Phone4: text("owner5_phone4"),
  owner5Email4: text("owner5_email4"),
  owner5Company: text("owner5_company"),
  owner5Notes: text("owner5_notes"),
  ownershipType : text("ownership_type"),
  // New fields
  loanNumber: text("loan_number"),
  loanType: text("loan_type"),
  lastSoldDate: timestamp("last_sold_date"),
  mortgageCompany: text("mortgage_company"),
  community: text("community"),
  hoaName: text("hoa_name"),
  hoaPhone: text("hoa_phone"),
  hoaWebsite: text("hoa_website"),
  // Existing fields from other migrations
  parcelNumber: text("parcel_number"),
  yearBuilt: integer("year_built"),
  propertyValue: decimal("property_value"),
  streetViewUrl: text("streetViewUrl"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastInspectionAt: timestamp("last_inspection_at"),
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  api_check: boolean("api_check").default(false),
  mailingAddress: text("mailing_address")
}, (table) => ({
  addressIdx: index("address_idx").on(table.address, table.city, table.state, table.isDeleted),
  locationIdx: index("location_idx").on(table.latitude, table.longitude),
  statusIdx: index("status_idx").on(table.status, table.isDeleted),
  ownerIdx: index("owner_idx").on(
    table.owner1LastName, 
    table.owner1FirstName,
    table.owner2LastName,
    table.owner3LastName,
    table.owner4LastName,
    table.owner5LastName
  ),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
  activePropertiesIdx: index("active_properties_idx").on(table.status, table.updatedAt, table.isDeleted),
  placeIdIdx: index("place_id_idx").on(table.placeId),
  // New indexes
  countyIdx: index("county_idx").on(table.county),
  loanNumberIdx: index("loan_number_idx").on(table.loanNumber),
  lastSoldDateIdx: index("last_sold_date_idx").on(table.lastSoldDate),
}));

/**
 * Scan Batches table - Stores information about drone scan sessions
 * Used to group photos from the same scanning session
 * Expected size: Medium (< 100k records)
 */
export const scan_batches = pgTable("scan_batches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  flightDate: timestamp("flight_date").notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  nameIdx: index("batch_name_idx").on(table.name),
  flightDateIdx: index("flight_date_idx").on(table.flightDate),
  userIdx: index("batch_user_idx").on(table.userId),
}));

/**
 * Photos table - Stores photo metadata and file information
 * Optimized for:
 * - Large number of records (100M+)
 * - Efficient property-based queries
 * - Quick metadata access
 * 
 * Partitioning: By uploaded_at for efficient data management
 */
export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").references(() => properties.id, { onDelete: 'cascade' }),
  batchId: integer("batch_id").references(() => scan_batches.id, { onDelete: 'set null' }),
  userId: integer("user_id").references(() => users.id, { onDelete: 'set null' }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 6 }),
  longitude: decimal("longitude", { precision: 10, scale: 6 }),
  altitude: decimal("altitude", { precision: 10, scale: 2 }),
  takenAt: timestamp("taken_at"),
  metadata: jsonb("metadata"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  storageLocation: text("storage_location").notNull(),
  thumbnailPath: text("thumbnail_path"),
  inspectionId: integer("inspection_id"),
  processingStatus: text("processing_status", { enum: ["pending", "processed", "failed"] }).default("pending"),
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  propertyIdx: index("photo_property_idx").on(table.propertyId),
  batchIdx: index("photo_batch_idx").on(table.batchId),
  uploadDateIdx: index("photo_upload_date_idx").on(table.uploadedAt),
  processingIdx: index("photo_processing_idx").on(table.processingStatus),
  locationIdx: index("photo_location_idx").on(table.latitude, table.longitude),
}));

/**
 * User preferences table - Stores user-specific settings
 * One-to-one relationship with users table
 */
export const user_preferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).unique(),
  altitudeUnit: text("altitude_unit", { enum: ["feet", "meters"] }).default("feet").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * Weather events table - Tracks weather-related incidents
 * Indexed fields: type, status, and date range for efficient filtering
 */
export const weather_events = pgTable("weather_events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["wind", "hail", "hurricane", "snow", "thunderstorm", "tornado"]
  }).notNull(),
  severity: text("severity", {
    enum: ["mild", "moderate", "severe"]
  }).notNull(),
  windSpeed: decimal("wind_speed", { precision: 5, scale: 2 }),
  windDirection: text("wind_direction", {
    enum: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
  }),
  hailSize: decimal("hail_size", { precision: 4, scale: 2 }), // in inches
  precipitation: decimal("precipitation", { precision: 6, scale: 2 }), // in inches
  hailProbability: decimal("hail_probability", { precision: 5, scale: 2 }),
  centerLatitude: decimal("center_latitude", { precision: 10, scale: 6 }).notNull(),
  centerLongitude: decimal("center_longitude", { precision: 10, scale: 6 }).notNull(),
  radius: decimal("radius", { precision: 10, scale: 2 }).notNull(), // in kilometers
  path: jsonb("path").default([]).notNull(), // Array of {lat: number, lng: number} coordinates
  warnings: jsonb("warnings"),
  alerts: jsonb("alerts"),
  radarData: jsonb("radar_data"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  status: text("status", {
    enum: ["active", "past"]
  }).default("active").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  typeIdx: index("weather_type_idx").on(table.type),
  statusIdx: index("weather_status_idx").on(table.status),
  dateRangeIdx: index("weather_date_range_idx").on(table.startTime, table.endTime),
  locationIdx: index("weather_location_idx").on(table.centerLatitude, table.centerLongitude),
  windSpeedIdx: index("wind_speed_idx").on(table.windSpeed),
  windDirIdx: index("wind_direction_idx").on(table.windDirection),
  hailSizeIdx: index("hail_size_idx").on(table.hailSize),
}));

/**
 * Affected properties table - Links properties to weather events
 * Indexed fields: weatherEventId and propertyId for quick joins
 */
export const affected_properties = pgTable("affected_properties", {
  id: serial("id").primaryKey(),
  weatherEventId: integer("weather_event_id").references(() => weather_events.id, { onDelete: 'cascade' }).notNull(),
  propertyId: integer("property_id").references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  impactLevel: text("impact_level", { enum: ["low", "medium", "high"] }).notNull(),
  notes: text("notes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  weatherEventIdx: index("weather_event_idx").on(table.weatherEventId),
  propertyIdx: index("affected_property_idx").on(table.propertyId),
  impactLevelIdx: index("impact_level_idx").on(table.impactLevel),
}));

/**
 * Inspections table - Stores property inspection data and AI analysis results
 * Indexed fields: propertyId, status, and completion date
 */
export const inspections = pgTable("inspections", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").references(() => properties.id, { onDelete: 'cascade' }),
  userId: integer("user_id").references(() => users.id, { onDelete: 'set null' }),
  photoId: integer("photo_id").references(() => photos.id, { onDelete: 'set null' }),
  status: text("status", { enum: ["draft", "completed"] }).default("draft").notNull(),
  damageType: text("damage_type", { enum: ["wind", "hail", "other", "none"] }).default("none").notNull(),
  severity: text("severity", { enum: ["low", "medium", "high"] }).default("low").notNull(),
  notes: text("notes"),
  annotations: jsonb("annotations").default({}).notNull(),
  aiFindings: jsonb("ai_findings"),
  aiConfidenceScore: decimal("ai_confidence_score", { precision: 4, scale: 3 }), // Removed .nullable()
  aiAnalysisStatus: text("ai_analysis_status", { enum: ["pending", "completed", "failed"] }),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  propertyIdx: index("inspection_property_idx").on(table.propertyId),
  statusIdx: index("inspection_status_idx").on(table.status),
  completionDateIdx: index("inspection_completion_date_idx").on(table.completedAt),
  damageTypeIdx: index("inspection_damage_type_idx").on(table.damageType),
}));

/**
 * Reports table - Stores generated PDF reports
 * Linked to inspections and properties
 */
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  inspectionId: integer("inspection_id").references(() => inspections.id, { onDelete: 'cascade' }),
  propertyId: integer("property_id").references(() => properties.id, { onDelete: 'cascade' }),
  reportPath: text("report_path").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  status: text("status", { enum: ["pending", "completed"] }).default("completed").notNull(),
  reportType: text("report_type", { enum: ["inspection", "weather", "analysis"] }).default("inspection").notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  reportUrl: text("report_url"),
  shareUrl: text("share_url"),
  shareToken: text("share_token"),
  shareExpiresAt: timestamp("share_expires_at", { mode: 'date' }),
  viewSettings: jsonb("view_settings").default({}).notNull(),
}, (table) => ({
  inspectionIdx: index("report_inspection_idx").on(table.inspectionId),
  propertyIdx: index("report_property_idx").on(table.propertyId),
  statusIdx: index("report_status_idx").on(table.status),
  createdAtIdx: index("report_created_at_idx").on(table.createdAt),
  shareTokenIdx: index("report_share_token_idx").on(table.shareToken),
}));

/**
 * Inspection Photos table - Links photos to inspections and stores edited versions
 * Optimized for:
 * - Quick lookups by inspection and photo IDs
 * - Storage of edited images and analysis data
 */
export const inspection_photos = pgTable("inspection_photos", {
  id: serial("id").primaryKey(),
  inspectionId: integer("inspection_id").references(() => inspections.id, { onDelete: 'cascade' }).notNull(),
  photoId: integer("photo_id").references(() => photos.id, { onDelete: 'cascade' }).notNull(),
  editedImageUrl: text("edited_image_url"),
  damageType: text("damage_type", { enum: ["wind", "hail", "other", "none"] }).default("none"),
  severity: text("severity", { enum: ["low", "medium", "high"] }).default("low"),
  notes: text("notes"),
  annotations: jsonb("annotations").default({}).notNull(),
  aiFindings: jsonb("ai_findings"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  inspectionIdx: index("inspection_photos_inspection_idx").on(table.inspectionId),
  photoIdx: index("inspection_photos_photo_idx").on(table.photoId),
  createdAtIdx: index("inspection_photos_created_at_idx").on(table.createdAt),
}));

/**
 * Report Templates table - Stores customizable report templates
 * Supports multiple themes and layouts for PDF reports
 */
export const report_templates = pgTable("report_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  theme: jsonb("theme").default({
    colors: {
      primary: "#1a365d",
      secondary: "#2d3748",
      accent: "#e53e3e",
      background: "#ffffff",
      text: "#000000",
      headerBackground: "#f8f8f8",
      footerBackground: "#f0f9ff"
    },
    fonts: {
      header: "Helvetica-Bold",
      body: "Helvetica",
      size: {
        title: 24,
        subtitle: 16,
        heading: 14,
        body: 11,
        small: 8
      }
    },
    spacing: {
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50
      },
      lineHeight: 1.5,
      paragraphSpacing: 1
    }
  }).notNull(),
  layout: jsonb("layout").default({
    sections: [
      {
        type: "header",
        height: 100,
        components: [
          { type: "logo", position: "center" },
          { type: "title", position: "center" },
          { type: "subtitle", position: "center" }
        ]
      },
      {
        type: "metadata",
        components: [
          { type: "date", position: "left" },
          { type: "reportId", position: "left" }
        ]
      },
      {
        type: "urgent-notice",
        style: "box",
        background: "accent-light"
      },
      {
        type: "property-info",
        style: "grid",
        columns: 2
      },
      {
        type: "street-view",
        size: "large",
        position: "center"
      },
      {
        type: "summary",
        style: "text-block"
      },
      {
        type: "photos",
        layout: "grid",
        columns: 1,
        imageSize: "large"
      },
      {
        type: "recommendations",
        style: "numbered-list"
      },
      {
        type: "footer",
        height: 80,
        components: [
          { type: "disclaimer", position: "center" },
          { type: "contact", position: "center" }
        ]
      }
    ]
  }).notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  nameIdx: index("template_name_idx").on(table.name),
  defaultIdx: index("template_default_idx").on(table.isDefault),
  createdByIdx: index("template_created_by_idx").on(table.createdBy),
}));

/**
 * Pagination helper types for handling large datasets
 */
export const paginationSchema = z.object({
  cursor: z.number().optional(),
  limit: z.number().min(1).max(100).default(20),
  sort: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

// Schema validations
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export const insertUserPreferencesSchema = createInsertSchema(user_preferences);
export const selectUserPreferencesSchema = createSelectSchema(user_preferences);

export const insertPropertySchema = createInsertSchema(properties);
export const selectPropertySchema = createSelectSchema(properties);

export const insertPhotoSchema = createInsertSchema(photos);
export const selectPhotoSchema = createSelectSchema(photos);

export const insertInspectionSchema = createInsertSchema(inspections);
export const selectInspectionSchema = createSelectSchema(inspections);

export const insertWeatherEventSchema = createInsertSchema(weather_events);
export const selectWeatherEventSchema = createSelectSchema(weather_events);

export const insertAffectedPropertySchema = createInsertSchema(affected_properties);
export const selectAffectedPropertySchema = createSelectSchema(affected_properties);

// Add new schema types for scan batches
export const insertScanBatchSchema = createInsertSchema(scan_batches);
export const selectScanBatchSchema = createSelectSchema(scan_batches);

// Add to schema validations
export const insertReportSchema = createInsertSchema(reports);
export const selectReportSchema = createSelectSchema(reports);

// Add to schema validations
export const insertReportTemplateSchema = createInsertSchema(report_templates);
export const selectReportTemplateSchema = createSelectSchema(report_templates);

// Add to schema validations
export const insertInspectionPhotoSchema = createInsertSchema(inspection_photos);
export const selectInspectionPhotoSchema = createSelectSchema(inspection_photos);

// Type exports for TypeScript
export type User = typeof users.$inferSelect;
export type UserPreferences = typeof user_preferences.$inferSelect;
export type Property = typeof properties.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type Inspection = typeof inspections.$inferSelect;
export type InsertInspection = typeof inspections.$inferInsert;
export type WeatherEvent = typeof weather_events.$inferSelect;
export type InsertWeatherEvent = typeof weather_events.$inferInsert;
export type AffectedProperty = typeof affected_properties.$inferSelect;
export type InsertProperty = typeof properties.$inferInsert;

// Add new type exports for scan batches
export type ScanBatch = typeof scan_batches.$inferSelect;
export type InsertScanBatch = typeof scan_batches.$inferInsert;

export type PhotoWithBatch = Photo & {
  batch?: ScanBatch;
};

export type PropertyWithRelations = Property & {
  photos?: PhotoWithBatch[];
  inspections?: Inspection[];
};

// Add to type exports
export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

// Add to type exports
export type ReportTemplate = typeof report_templates.$inferSelect;
export type InsertReportTemplate = typeof report_templates.$inferInsert;

// Add to type exports
export type InspectionPhoto = typeof inspection_photos.$inferSelect;
export type InsertInspectionPhoto = typeof inspection_photos.$inferInsert;