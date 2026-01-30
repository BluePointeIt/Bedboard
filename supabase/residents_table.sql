-- Residents Table for Bedboard
-- Run this SQL in the Supabase SQL Editor

-- ============================================
-- RESIDENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS residents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medical_record_number TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
    payer_type TEXT DEFAULT 'private' CHECK (payer_type IN ('private', 'medicare', 'medicaid', 'managed_care')),
    diagnoses TEXT[] DEFAULT '{}',
    contact_phone TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    notes TEXT,
    admission_date TIMESTAMPTZ DEFAULT NOW(),
    discharge_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'discharged', 'deceased')),
    room_id UUID,
    bed_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster searches
CREATE INDEX IF NOT EXISTS idx_residents_status ON residents(status);
CREATE INDEX IF NOT EXISTS idx_residents_mrn ON residents(medical_record_number);
CREATE INDEX IF NOT EXISTS idx_residents_name ON residents(last_name, first_name);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_residents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS residents_updated_at ON residents;
CREATE TRIGGER residents_updated_at
    BEFORE UPDATE ON residents
    FOR EACH ROW
    EXECUTE FUNCTION update_residents_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all residents
CREATE POLICY "Authenticated users can view residents" ON residents
    FOR SELECT TO authenticated USING (true);

-- Authenticated users can insert residents
CREATE POLICY "Authenticated users can insert residents" ON residents
    FOR INSERT TO authenticated WITH CHECK (true);

-- Authenticated users can update residents
CREATE POLICY "Authenticated users can update residents" ON residents
    FOR UPDATE TO authenticated USING (true);

-- Authenticated users can delete residents (soft delete preferred)
CREATE POLICY "Authenticated users can delete residents" ON residents
    FOR DELETE TO authenticated USING (true);

-- ============================================
-- ENABLE REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE residents;
