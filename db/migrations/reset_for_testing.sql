-- Begin transaction
BEGIN;

-- Archive all existing properties
UPDATE properties 
SET archived = true,
    updated_at = NOW()
WHERE archived = false;

-- Archive all existing photos and reset their processing status
UPDATE photos 
SET archived = true,
    processing_status = 'archived',
    property_id = NULL,
    property_match_confidence = NULL
WHERE archived = false;

-- Create indexes for better query performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_properties_not_archived 
ON properties(archived) 
WHERE NOT archived;

CREATE INDEX IF NOT EXISTS idx_photos_not_archived 
ON photos(archived) 
WHERE NOT archived;

-- Update confidence threshold settings
ALTER TABLE photos
DROP CONSTRAINT IF EXISTS valid_confidence_score;

ALTER TABLE photos
ADD CONSTRAINT valid_confidence_score
CHECK (
    (property_match_confidence IS NULL) OR 
    (property_match_confidence BETWEEN 0.99 AND 1.0)
);

-- Reset any existing property matches below our new threshold
UPDATE photos 
SET property_id = NULL,
    property_match_confidence = NULL,
    processing_status = 'pending'
WHERE property_match_confidence < 0.99
   OR property_match_confidence IS NULL;

COMMIT;
