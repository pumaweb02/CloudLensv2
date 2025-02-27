# CloudLens Architecture Analysis

## 1. Database Layer

### Core Database Files:
- `db/index.ts`: Database connection and configuration
  - Configures connection pooling
  - Sets up Drizzle ORM
  - Provides utility functions for pagination and filtering

- `db/schema.ts`: Data model definitions
  - Tables: users, properties, photos, inspections, reports, etc.
  - Relations defined through Drizzle ORM
  - Includes proper indexing for performance

- `drizzle.config.ts`: Database configuration
  - Manages schema location and migrations
  - Handles PostgreSQL connection details

## 2. Server Routes and API Layer

### Main Entry Points:
- `server/routes.ts`: API endpoint definitions
  - Photo upload handling (/api/photos/upload)
  - Property management (/api/properties/*)
  - Inspection creation (/api/properties/:id/inspections)
  - Report generation (/api/reports)

### Key Data Flows:

1. Photo Upload Flow:
```
Client -> routes.ts -> multer middleware -> 
  -> savePhotoToDatabase() -> processPhotoBatch() -> 
    -> findOrCreateProperty() -> updatePhotoRecord
```

2. Inspection Creation Flow:
```
Client -> routes.ts -> createInspection -> 
  -> saveInspectionToDatabase -> generateReport
```

3. Report Generation Flow:
```
Client -> routes.ts -> generateInspectionReport -> 
  -> createPDF -> storeReport -> returnShareableLink
```

## 3. File Storage and Processing

### Storage Locations:
- Uploads directory: Raw uploaded files
- Thumbnails directory: Compressed versions
- PDF storage: Generated reports

### Processing Pipeline:
1. File upload with chunking support
2. EXIF data extraction
3. GPS data processing
4. Property matching
5. Thumbnail generation

## 4. Database Schema Relationships

### Core Tables and Relations:
```
users
  └─ user_preferences (1:1)
  └─ photos (1:many)
  └─ scan_batches (1:many)

properties
  └─ photos (1:many)
  └─ inspections (1:many)
  └─ reports (1:many)
  └─ affected_properties (many:many with weather_events)

photos
  └─ property (many:1)
  └─ scan_batch (many:1)
  └─ inspections (1:many)

inspections
  └─ property (many:1)
  └─ photos (many:1)
  └─ reports (1:many)

reports
  └─ inspection (many:1)
  └─ property (many:1)
```

## 5. Security Implementation

### Authentication:
- Session-based auth using express-session
- Role-based access control (admin/user)
- Secure cookie handling

### File Security:
- MIME type validation
- Size limit enforcement
- Chunked upload support
- Secure file paths

## 6. Performance Optimizations

### Database:
- Connection pooling
- Prepared statements
- Optimized indexes
- Query timeout handling

### File Processing:
- Batch processing for photos
- Memory-efficient chunk handling
- Progressive image loading
- Caching headers for static files

## 7. Error Handling

### Implemented at Multiple Levels:
1. Database layer: Connection and query errors
2. File processing: Upload and processing errors
3. API layer: Input validation and response handling
4. Authentication: Session and permission errors

## 8. Integration Points

### External Services:
1. Google Maps API
   - Geocoding
   - Street View
   - Property boundary detection

2. OpenAI Vision API
   - Image analysis
   - Damage detection

3. WeatherStack API
   - Weather data integration
   - Risk assessment
