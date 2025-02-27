-- Begin transaction
BEGIN;

-- Add new columns to properties table
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS county text,
ADD COLUMN IF NOT EXISTS loan_number text,
ADD COLUMN IF NOT EXISTS loan_type text,
ADD COLUMN IF NOT EXISTS last_sold_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS mortgage_company text,
ADD COLUMN IF NOT EXISTS community text,
ADD COLUMN IF NOT EXISTS hoa_name text,
ADD COLUMN IF NOT EXISTS hoa_phone text,
ADD COLUMN IF NOT EXISTS hoa_website text;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_properties_county 
ON properties(county) 
WHERE NOT is_deleted;

CREATE INDEX IF NOT EXISTS idx_properties_loan_number 
ON properties(loan_number) 
WHERE NOT is_deleted;

CREATE INDEX IF NOT EXISTS idx_properties_last_sold_date 
ON properties(last_sold_date) 
WHERE NOT is_deleted;

COMMIT;
