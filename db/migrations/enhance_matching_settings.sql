BEGIN;

-- Drop existing matching_settings if it exists
DROP TABLE IF EXISTS matching_settings;

-- Create new matching_settings table with correct column names
CREATE TABLE matching_settings (
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

-- Add indices for efficient querying
CREATE INDEX idx_matching_settings_created_at 
    ON matching_settings (created_at DESC);

COMMIT;
