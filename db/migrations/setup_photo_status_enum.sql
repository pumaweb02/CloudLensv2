DO $$ 
BEGIN
    -- Create the enum type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'photo_processing_status') THEN
        CREATE TYPE photo_processing_status AS ENUM (
            'pending',
            'processing',
            'processed',
            'failed',
            'needs_review',
            'archived'
        );
    END IF;

    -- Ensure photos table has all necessary columns and constraints
    BEGIN
        ALTER TABLE photos 
        ADD COLUMN IF NOT EXISTS processing_status photo_processing_status DEFAULT 'pending';
    EXCEPTION
        WHEN duplicate_column THEN
            NULL;
    END;

    -- Add missing indexes
    CREATE INDEX IF NOT EXISTS idx_photos_processing_status 
    ON photos(processing_status) 
    WHERE processing_status != 'archived';

    CREATE INDEX IF NOT EXISTS idx_photos_property_match 
    ON photos(property_id, property_match_confidence) 
    WHERE NOT archived;
END $$;
