-- Migration to merge duplicate properties and their photos

-- Begin transaction
BEGIN;

-- Move photos from property 323 to 322 (6318 Gothards Lane)
UPDATE photos 
SET property_id = 322
WHERE property_id = 323;

-- Move photos from property 329 to 328 (7268 Hampton Chase Drive)
UPDATE photos 
SET property_id = 328
WHERE property_id = 329;

-- Soft delete the duplicate properties
UPDATE properties
SET is_deleted = true,
    deleted_at = NOW()
WHERE id IN (323, 329);

-- Add a unique constraint on normalized address to prevent future duplicates
CREATE OR REPLACE FUNCTION normalize_address(address text, city text, state text, zip_code text)
RETURNS text AS $$
BEGIN
    RETURN LOWER(
        REGEXP_REPLACE(
            CONCAT(
                REGEXP_REPLACE(address, '[^a-zA-Z0-9]', '', 'g'),
                city,
                state,
                zip_code
            ),
            '[^a-zA-Z0-9]', 
            '', 
            'g'
        )
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a unique index on the normalized address
CREATE UNIQUE INDEX IF NOT EXISTS unique_normalized_address 
ON properties (
    (normalize_address(address, city, state, zip_code))
)
WHERE is_deleted = false;

-- Add a check constraint to ensure latitude and longitude are within valid ranges
ALTER TABLE properties
ADD CONSTRAINT valid_coordinates 
CHECK (
    latitude BETWEEN -90 AND 90 AND 
    longitude BETWEEN -180 AND 180
);

COMMIT;
