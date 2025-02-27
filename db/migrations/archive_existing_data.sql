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

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_properties_archived ON properties(archived);
CREATE INDEX IF NOT EXISTS idx_photos_archived ON photos(archived);
