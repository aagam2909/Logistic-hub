ALTER TABLE drivers
    ADD COLUMN IF NOT EXISTS mobile_number TEXT,
    ADD COLUMN IF NOT EXISTS dl_expiry_date DATE;
