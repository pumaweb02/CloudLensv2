-- Add archived column to properties table if it doesn't exist
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Add archived column to photos table if it doesn't exist
ALTER TABLE photos 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Archive all existing properties
UPDATE properties 
SET archived = true,
    updated_at = NOW()
WHERE archived = false;

-- Archive all existing photos
UPDATE photos 
SET archived = true,
    processing_status = 'archived'
WHERE archived = false;

-- Create indexes for better querying
CREATE INDEX IF NOT EXISTS idx_properties_archived ON properties(archived) WHERE NOT archived;
CREATE INDEX IF NOT EXISTS idx_photos_archived ON photos(archived) WHERE NOT archived;

-- Add a confidence score column for property matching
ALTER TABLE photos
ADD COLUMN IF NOT EXISTS property_match_confidence DECIMAL DEFAULT NULL;

-- Create index on the new confidence column
CREATE INDEX IF NOT EXISTS idx_photos_match_confidence ON photos(property_match_confidence);
