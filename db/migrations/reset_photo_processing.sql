-- Begin transaction
BEGIN;

-- Reset all photos to pending status and clear property assignments
UPDATE photos 
SET 
    processing_status = 'pending'::photo_processing_status,
    property_id = NULL,
    property_match_confidence = NULL,
    updated_at = NOW()
WHERE NOT archived;

-- Ensure proper indexes exist for efficient processing
CREATE INDEX IF NOT EXISTS idx_photos_pending 
ON photos (processing_status, archived) 
WHERE processing_status = 'pending' AND NOT archived;

CREATE INDEX IF NOT EXISTS idx_properties_active_coords 
ON properties (latitude, longitude) 
WHERE NOT is_deleted;

-- Update property status to ensure they're ready for matching
UPDATE properties
SET 
    status = 'active',
    updated_at = NOW()
WHERE NOT is_deleted;

-- Analyze tables for query optimization
ANALYZE photos;
ANALYZE properties;

COMMIT;

-- Verify the reset
SELECT 
    processing_status,
    COUNT(*) as count
FROM photos
WHERE NOT archived
GROUP BY processing_status;
