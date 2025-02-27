-- Begin transaction
BEGIN;

-- First, create archive tables if they don't exist
CREATE TABLE IF NOT EXISTS archived_photos AS SELECT * FROM photos WHERE false;
CREATE TABLE IF NOT EXISTS archived_properties AS SELECT * FROM properties WHERE false;

-- Archive existing data
INSERT INTO archived_photos SELECT * FROM photos;
INSERT INTO archived_properties SELECT * FROM properties;

-- Clear the photos table first (due to foreign key constraints)
UPDATE photos SET property_id = NULL;
TRUNCATE photos RESTART IDENTITY CASCADE;

-- Clear properties table
TRUNCATE properties RESTART IDENTITY CASCADE;

-- Reset sequences
ALTER SEQUENCE photos_id_seq RESTART WITH 1;
ALTER SEQUENCE properties_id_seq RESTART WITH 1;

-- Add a timestamp to track when this cleanup occurred
COMMENT ON TABLE archived_photos IS format('Archived on %s', now()::text);
COMMENT ON TABLE archived_properties IS format('Archived on %s', now()::text);

COMMIT;
