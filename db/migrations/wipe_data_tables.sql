-- Begin transaction
BEGIN;

-- Truncate tables in correct order to avoid foreign key conflicts
TRUNCATE TABLE photos RESTART IDENTITY CASCADE;
TRUNCATE TABLE properties RESTART IDENTITY CASCADE;
TRUNCATE TABLE matching_settings RESTART IDENTITY CASCADE;

-- Reset any sequences
ALTER SEQUENCE photos_id_seq RESTART WITH 1;
ALTER SEQUENCE properties_id_seq RESTART WITH 1;
ALTER SEQUENCE matching_settings_id_seq RESTART WITH 1;

-- Reinsert default matching settings
INSERT INTO matching_settings 
    (min_confidence_threshold, max_distance_meters)
VALUES 
    (0.90, 50);

COMMIT;
