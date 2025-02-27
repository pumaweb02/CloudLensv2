-- Create scan_batches table
CREATE TABLE IF NOT EXISTS scan_batches (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    flight_date TIMESTAMP NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP
);

-- Add indexes for scan_batches
CREATE INDEX IF NOT EXISTS batch_name_idx ON scan_batches(name);
CREATE INDEX IF NOT EXISTS flight_date_idx ON scan_batches(flight_date);
CREATE INDEX IF NOT EXISTS batch_user_idx ON scan_batches(user_id);

-- Add batch_id to photos table
ALTER TABLE photos 
ADD COLUMN IF NOT EXISTS batch_id INTEGER REFERENCES scan_batches(id) ON DELETE SET NULL;

-- Add index for batch_id in photos
CREATE INDEX IF NOT EXISTS photo_batch_idx ON photos(batch_id);
