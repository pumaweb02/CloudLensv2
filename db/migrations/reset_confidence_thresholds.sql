-- Migration to adjust confidence thresholds and reset processing status
BEGIN;

-- Add new confidence threshold settings
CREATE TABLE IF NOT EXISTS matching_settings (
    id SERIAL PRIMARY KEY,
    min_confidence_threshold DECIMAL NOT NULL DEFAULT 0.90,
    max_distance_meters INTEGER NOT NULL DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO matching_settings 
    (min_confidence_threshold, max_distance_meters)
VALUES 
    (0.90, 50);

-- Add indices to improve matching performance
CREATE INDEX IF NOT EXISTS idx_properties_location 
    ON properties (latitude, longitude)
    WHERE NOT is_deleted;

CREATE INDEX IF NOT EXISTS idx_photos_status 
    ON photos (processing_status)
    WHERE NOT archived;

COMMIT;
