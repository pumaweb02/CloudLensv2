-- Add new columns to photos table
ALTER TABLE photos
ADD COLUMN IF NOT EXISTS storage_location text,
ADD COLUMN IF NOT EXISTS thumbnail_path text,
ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processed', 'failed'));

-- Update existing rows
UPDATE photos SET storage_location = CONCAT('uploads/', filename) WHERE storage_location IS NULL;
UPDATE photos SET processing_status = 'processed' WHERE processing_status IS NULL;

-- Make storage_location NOT NULL after populating data
ALTER TABLE photos ALTER COLUMN storage_location SET NOT NULL;
