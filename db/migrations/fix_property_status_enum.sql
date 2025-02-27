DO $$ 
BEGIN
    -- Create the enum type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'property_status') THEN
        CREATE TYPE property_status AS ENUM (
            'processing',
            'pending',
            'inspected',
            'draft',
            'archived'
        );
    END IF;

    -- Drop existing constraint if it exists
    ALTER TABLE properties 
    DROP CONSTRAINT IF EXISTS property_status_check;

    -- Convert status column to use enum
    ALTER TABLE properties 
    ALTER COLUMN status TYPE property_status 
    USING status::property_status;

    -- Set default value
    ALTER TABLE properties 
    ALTER COLUMN status SET DEFAULT 'processing'::property_status;

    -- Create index for faster status queries
    CREATE INDEX IF NOT EXISTS idx_properties_status 
    ON properties(status) 
    WHERE status != 'archived'::property_status;

END $$;
