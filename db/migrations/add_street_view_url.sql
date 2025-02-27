-- Add street_view_url column to properties table
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS street_view_url TEXT;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS properties_street_view_url_idx ON properties(street_view_url);
