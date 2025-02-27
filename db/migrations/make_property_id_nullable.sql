-- Allow photos to exist without being associated with a property initially
ALTER TABLE photos 
ALTER COLUMN property_id DROP NOT NULL;

-- Add an index for property_id to optimize queries
CREATE INDEX IF NOT EXISTS photos_property_id_idx ON photos(property_id);
