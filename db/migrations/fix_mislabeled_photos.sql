-- Begin transaction
BEGIN;

-- Reset property assignments for photos with low confidence matches
UPDATE photos 
SET property_id = NULL,
    property_match_confidence = NULL,
    processing_status = 'pending'::photo_processing_status
WHERE property_match_confidence < 0.97
   OR property_match_confidence IS NULL;

-- Reset specific problematic photos for 6318 Gothards Lane
UPDATE photos 
SET property_id = NULL,
    property_match_confidence = NULL,
    processing_status = 'pending'::photo_processing_status
WHERE property_id IN (
    SELECT id 
    FROM properties 
    WHERE address = '6318 Gothards Lane'
);

-- Add index to improve query performance for property matching
CREATE INDEX IF NOT EXISTS idx_photos_processing_confidence 
ON photos (processing_status, property_match_confidence)
WHERE NOT archived;

COMMIT;
