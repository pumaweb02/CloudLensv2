-- Begin transaction to ensure atomicity
BEGIN;

-- 1. Clean up photos with low confidence matches or incorrect assignments
UPDATE photos 
SET 
    property_id = NULL,
    property_match_confidence = NULL,
    processing_status = 'pending'
WHERE 
    property_match_confidence < 0.97 
    OR property_match_confidence IS NULL;

-- 2. Mark duplicate properties as deleted
WITH duplicate_properties AS (
    SELECT 
        MIN(id) as keep_id,
        normalize_address(address, city, state, zip_code) as norm_addr
    FROM properties
    WHERE NOT is_deleted
    GROUP BY normalize_address(address, city, state, zip_code)
    HAVING COUNT(*) > 1
)
UPDATE properties p
SET 
    is_deleted = true,
    deleted_at = NOW()
WHERE id NOT IN (
    SELECT keep_id 
    FROM duplicate_properties
)
AND EXISTS (
    SELECT 1 
    FROM duplicate_properties dp 
    WHERE normalize_address(p.address, p.city, p.state, p.zip_code) = dp.norm_addr
);

-- 3. Reassign photos from deleted properties to their active counterparts
WITH property_mappings AS (
    SELECT 
        p1.id as old_id,
        p2.id as new_id
    FROM properties p1
    JOIN properties p2 
    ON normalize_address(p1.address, p1.city, p1.state, p1.zip_code) = 
       normalize_address(p2.address, p2.city, p2.state, p2.zip_code)
    WHERE p1.is_deleted AND NOT p2.is_deleted
)
UPDATE photos
SET property_id = pm.new_id
FROM property_mappings pm
WHERE property_id = pm.old_id;

-- 4. Reset orphaned inspections
UPDATE inspections
SET status = 'draft'
WHERE property_id IN (
    SELECT id 
    FROM properties 
    WHERE is_deleted
);

-- 5. Clean up weather events without affected properties
UPDATE weather_events
SET status = 'past'
WHERE id NOT IN (
    SELECT DISTINCT weather_event_id 
    FROM affected_properties
);

-- 6. Remove property relationships from deleted properties
UPDATE affected_properties
SET notes = CONCAT(notes, ' [Property deleted: ', NOW(), ']')
WHERE property_id IN (
    SELECT id 
    FROM properties 
    WHERE is_deleted
);

-- 7. Clean up batches without photos
UPDATE scan_batches
SET 
    is_deleted = true,
    deleted_at = NOW()
WHERE id NOT IN (
    SELECT DISTINCT batch_id 
    FROM photos 
    WHERE batch_id IS NOT NULL
);

-- Create indexes to improve query performance
CREATE INDEX IF NOT EXISTS idx_active_properties 
ON properties (normalize_address(address, city, state, zip_code)) 
WHERE NOT is_deleted;

CREATE INDEX IF NOT EXISTS idx_active_photos 
ON photos (property_id, processing_status, property_match_confidence)
WHERE property_id IS NOT NULL;

-- Analyze tables to update statistics
ANALYZE properties;
ANALYZE photos;
ANALYZE inspections;
ANALYZE weather_events;
ANALYZE affected_properties;
ANALYZE scan_batches;

COMMIT;
