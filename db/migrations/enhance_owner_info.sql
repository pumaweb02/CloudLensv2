-- Begin transaction
BEGIN;

-- Add new columns for enhanced owner information
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS owner_mailing_street TEXT,
ADD COLUMN IF NOT EXISTS owner_mailing_city TEXT,
ADD COLUMN IF NOT EXISTS owner_mailing_state TEXT,
ADD COLUMN IF NOT EXISTS owner_mailing_zip TEXT,
ADD COLUMN IF NOT EXISTS owner_mailing_country TEXT,
ADD COLUMN IF NOT EXISTS owner_care_of TEXT,
ADD COLUMN IF NOT EXISTS owner_type TEXT,
ADD COLUMN IF NOT EXISTS last_owner_update TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for owner-based queries
CREATE INDEX IF NOT EXISTS idx_properties_owner_info 
ON properties(owner1_first_name, owner1_last_name) 
WHERE NOT is_deleted;

-- Create index for mailing address
CREATE INDEX IF NOT EXISTS idx_properties_mailing_address
ON properties(owner_mailing_street, owner_mailing_city, owner_mailing_state, owner_mailing_zip)
WHERE NOT is_deleted;

COMMIT;
