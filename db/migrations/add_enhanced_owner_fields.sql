-- Add enhanced owner information fields
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS owner_type TEXT,
ADD COLUMN IF NOT EXISTS owner_care_of TEXT,
ADD COLUMN IF NOT EXISTS owner_mailing_street TEXT,
ADD COLUMN IF NOT EXISTS owner_mailing_city TEXT,
ADD COLUMN IF NOT EXISTS owner_mailing_state TEXT,
ADD COLUMN IF NOT EXISTS owner_mailing_zip TEXT,
ADD COLUMN IF NOT EXISTS owner_mailing_country TEXT,
ADD COLUMN IF NOT EXISTS last_owner_update TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add property value and improvement value fields
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS property_value NUMERIC,
ADD COLUMN IF NOT EXISTS improvement_value NUMERIC,
ADD COLUMN IF NOT EXISTS land_value NUMERIC;

-- Create indexes for owner-based queries
CREATE INDEX IF NOT EXISTS idx_properties_owner_info 
ON properties(owner1_first_name, owner1_last_name, owner_type) 
WHERE NOT is_deleted;

-- Create index for property value queries
CREATE INDEX IF NOT EXISTS idx_properties_value 
ON properties(property_value) 
WHERE NOT is_deleted;
