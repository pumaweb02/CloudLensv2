-- Begin transaction
BEGIN;

-- Add place_id column to properties table
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS place_id TEXT,
ADD COLUMN IF NOT EXISTS boundary_ne_lat DECIMAL(10, 6),
ADD COLUMN IF NOT EXISTS boundary_ne_lng DECIMAL(10, 6),
ADD COLUMN IF NOT EXISTS boundary_sw_lat DECIMAL(10, 6),
ADD COLUMN IF NOT EXISTS boundary_sw_lng DECIMAL(10, 6);

-- Create unique index on normalized address
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_unique_address
ON properties (
    LOWER(TRIM(address)),
    LOWER(TRIM(city)),
    LOWER(TRIM(state)),
    LOWER(TRIM(zip_code))
)
WHERE NOT is_deleted;

-- Create index on place_id
CREATE INDEX IF NOT EXISTS idx_properties_place_id
ON properties(place_id)
WHERE NOT is_deleted;

-- Create spatial index for boundary queries
CREATE INDEX IF NOT EXISTS idx_properties_boundaries
ON properties(
    boundary_ne_lat,
    boundary_ne_lng,
    boundary_sw_lat,
    boundary_sw_lng
)
WHERE NOT is_deleted;

-- Reset photos that need reprocessing
UPDATE photos
SET processing_status = 'pending',
    property_id = NULL,
    property_match_confidence = NULL
WHERE processing_status = 'processed'
   OR processing_status = 'failed';

COMMIT;

-- Verify the changes
SELECT 
    table_name,
    column_name,
    data_type
FROM 
    information_schema.columns
WHERE 
    table_name = 'properties'
    AND column_name IN (
        'place_id',
        'boundary_ne_lat',
        'boundary_ne_lng',
        'boundary_sw_lat',
        'boundary_sw_lng'
    );
