-- Add processing status enum if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'photo_processing_status') THEN
        CREATE TYPE photo_processing_status AS ENUM (
            'pending', 
            'processing', 
            'processed', 
            'failed', 
            'needs_review', 
            'archived'
        );
    END IF;
END $$;

-- Update the photos table to use the enum and add constraints
ALTER TABLE photos 
DROP CONSTRAINT IF EXISTS valid_processing_status;

-- Convert processing_status to use the enum type
ALTER TABLE photos 
ALTER COLUMN processing_status TYPE photo_processing_status 
USING processing_status::photo_processing_status;

-- Increase confidence threshold for photo matching
ALTER TABLE photos
DROP CONSTRAINT IF EXISTS valid_confidence_score;

ALTER TABLE photos
ADD CONSTRAINT valid_confidence_score
CHECK (
    (property_match_confidence IS NULL) OR 
    (property_match_confidence BETWEEN 0.98 AND 1) -- Increased from 0.97
);

-- Reset photos with lower confidence scores
UPDATE photos 
SET property_id = NULL,
    property_match_confidence = NULL,
    processing_status = 'pending'::photo_processing_status
WHERE property_match_confidence < 0.98
   OR property_match_confidence IS NULL;

-- Update indexes for better query performance
DROP INDEX IF EXISTS idx_photos_needs_review;
CREATE INDEX idx_photos_needs_review ON photos(processing_status) 
WHERE processing_status = 'needs_review'::photo_processing_status;

-- Add composite index for better query performance
CREATE INDEX IF NOT EXISTS idx_photos_property_confidence 
ON photos(property_id, property_match_confidence, processing_status)
WHERE NOT archived;

-- Add spatial index for better coordinate matching
CREATE INDEX IF NOT EXISTS idx_properties_location 
ON properties(latitude, longitude)
WHERE NOT is_deleted;


-- Unarchive a small test set of properties and their photos
UPDATE properties 
SET archived = false,
    updated_at = NOW()
WHERE id IN (
    442, -- 6318 Gothards Lane
    441  -- 2120 Serenity Drive Northwest
)
AND archived = true;

-- Reset corresponding photos for testing
UPDATE photos 
SET 
    archived = false,
    processing_status = 'pending'::photo_processing_status,
    property_id = NULL,
    property_match_confidence = NULL
WHERE property_id IN (
    442,
    441
)
AND archived = true;