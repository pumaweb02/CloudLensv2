-- Begin transaction
BEGIN;

-- Add new columns to properties table
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS owner1_address text,
ADD COLUMN IF NOT EXISTS year_built integer,
ADD COLUMN IF NOT EXISTS property_value numeric,
ADD COLUMN IF NOT EXISTS parcel_number text,
ADD COLUMN IF NOT EXISTS zoning text,
ADD COLUMN IF NOT EXISTS zoning_description text,
ADD COLUMN IF NOT EXISTS use_description text;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_properties_parcel_number 
ON properties(parcel_number) 
WHERE NOT is_deleted;

CREATE INDEX IF NOT EXISTS idx_properties_year_built 
ON properties(year_built) 
WHERE NOT is_deleted;

-- Create a GiST index for spatial queries if not exists
CREATE INDEX IF NOT EXISTS idx_properties_location_gist 
ON properties 
USING GIST (
  ST_SetSRID(
    ST_MakePoint(
      CAST(longitude AS float8), 
      CAST(latitude AS float8)
    ), 
    4326
  )
)
WHERE NOT is_deleted;

COMMIT;
