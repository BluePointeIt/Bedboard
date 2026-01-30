-- Bedboard Database Schema for Supabase
-- Run this SQL in the Supabase SQL Editor to set up your database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'nurse' CHECK (role IN ('admin', 'nurse', 'doctor', 'clerk')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
        'nurse'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================
-- WARDS TABLE (Facility Units)
-- ============================================
CREATE TABLE IF NOT EXISTS wards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    floor INTEGER NOT NULL,
    capacity INTEGER DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ROOMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ward_id UUID NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
    room_number TEXT NOT NULL,
    room_type TEXT NOT NULL DEFAULT 'ward' CHECK (room_type IN ('private', 'semi-private', 'ward')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(ward_id, room_number)
);

-- ============================================
-- BEDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS beds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    bed_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'cleaning', 'maintenance')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(room_id, bed_number)
);

-- ============================================
-- PATIENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medical_record_number TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
    payer_type TEXT DEFAULT 'private' CHECK (payer_type IN ('private', 'medicare', 'medicaid', 'managed_care')),
    contact_phone TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- BED ASSIGNMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS bed_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bed_id UUID NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    discharged_at TIMESTAMPTZ,
    is_isolation BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT
);

-- Index for faster lookup of current assignments
CREATE INDEX IF NOT EXISTS idx_bed_assignments_active ON bed_assignments(bed_id) WHERE discharged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bed_assignments_patient ON bed_assignments(patient_id) WHERE discharged_at IS NULL;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE bed_assignments ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Anyone can view all wards
CREATE POLICY "Anyone can view wards" ON wards
    FOR SELECT USING (true);

-- Anyone can insert wards
CREATE POLICY "Anyone can insert wards" ON wards
    FOR INSERT WITH CHECK (true);

-- Anyone can update wards
CREATE POLICY "Anyone can update wards" ON wards
    FOR UPDATE USING (true);

-- Anyone can delete wards
CREATE POLICY "Anyone can delete wards" ON wards
    FOR DELETE USING (true);

-- Authenticated users can view all rooms
CREATE POLICY "Authenticated users can view rooms" ON rooms
    FOR SELECT TO authenticated USING (true);

-- Authenticated users can view all beds
CREATE POLICY "Authenticated users can view beds" ON beds
    FOR SELECT TO authenticated USING (true);

-- Authenticated users can update beds
CREATE POLICY "Authenticated users can update beds" ON beds
    FOR UPDATE TO authenticated USING (true);

-- Authenticated users can view all patients
CREATE POLICY "Authenticated users can view patients" ON patients
    FOR SELECT TO authenticated USING (true);

-- Authenticated users can insert patients
CREATE POLICY "Authenticated users can insert patients" ON patients
    FOR INSERT TO authenticated WITH CHECK (true);

-- Authenticated users can update patients
CREATE POLICY "Authenticated users can update patients" ON patients
    FOR UPDATE TO authenticated USING (true);

-- Authenticated users can view bed assignments
CREATE POLICY "Authenticated users can view bed_assignments" ON bed_assignments
    FOR SELECT TO authenticated USING (true);

-- Authenticated users can insert bed assignments
CREATE POLICY "Authenticated users can insert bed_assignments" ON bed_assignments
    FOR INSERT TO authenticated WITH CHECK (true);

-- Authenticated users can update bed assignments
CREATE POLICY "Authenticated users can update bed_assignments" ON bed_assignments
    FOR UPDATE TO authenticated USING (true);

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Insert sample wards
INSERT INTO wards (name, floor, capacity, description) VALUES
    ('Emergency', 1, 20, 'Emergency department'),
    ('ICU', 2, 10, 'Intensive Care Unit'),
    ('Medical', 3, 30, 'General medical ward'),
    ('Surgical', 4, 25, 'Post-operative care'),
    ('Pediatrics', 5, 15, 'Children''s ward')
ON CONFLICT DO NOTHING;

-- Insert sample rooms (after wards exist)
DO $$
DECLARE
    emergency_id UUID;
    icu_id UUID;
    medical_id UUID;
    surgical_id UUID;
    pediatrics_id UUID;
BEGIN
    SELECT id INTO emergency_id FROM wards WHERE name = 'Emergency';
    SELECT id INTO icu_id FROM wards WHERE name = 'ICU';
    SELECT id INTO medical_id FROM wards WHERE name = 'Medical';
    SELECT id INTO surgical_id FROM wards WHERE name = 'Surgical';
    SELECT id INTO pediatrics_id FROM wards WHERE name = 'Pediatrics';

    -- Emergency rooms
    INSERT INTO rooms (ward_id, room_number, room_type) VALUES
        (emergency_id, 'E101', 'ward'),
        (emergency_id, 'E102', 'ward'),
        (emergency_id, 'E103', 'semi-private')
    ON CONFLICT DO NOTHING;

    -- ICU rooms
    INSERT INTO rooms (ward_id, room_number, room_type) VALUES
        (icu_id, 'ICU-1', 'private'),
        (icu_id, 'ICU-2', 'private'),
        (icu_id, 'ICU-3', 'private'),
        (icu_id, 'ICU-4', 'private')
    ON CONFLICT DO NOTHING;

    -- Medical rooms
    INSERT INTO rooms (ward_id, room_number, room_type) VALUES
        (medical_id, 'M301', 'ward'),
        (medical_id, 'M302', 'ward'),
        (medical_id, 'M303', 'semi-private'),
        (medical_id, 'M304', 'private')
    ON CONFLICT DO NOTHING;

    -- Surgical rooms
    INSERT INTO rooms (ward_id, room_number, room_type) VALUES
        (surgical_id, 'S401', 'semi-private'),
        (surgical_id, 'S402', 'semi-private'),
        (surgical_id, 'S403', 'private')
    ON CONFLICT DO NOTHING;

    -- Pediatrics rooms
    INSERT INTO rooms (ward_id, room_number, room_type) VALUES
        (pediatrics_id, 'P501', 'ward'),
        (pediatrics_id, 'P502', 'semi-private')
    ON CONFLICT DO NOTHING;
END $$;

-- Insert sample beds (after rooms exist)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, room_type FROM rooms LOOP
        IF r.room_type = 'private' THEN
            INSERT INTO beds (room_id, bed_number, status) VALUES
                (r.id, '1', 'available')
            ON CONFLICT DO NOTHING;
        ELSIF r.room_type = 'semi-private' THEN
            INSERT INTO beds (room_id, bed_number, status) VALUES
                (r.id, 'A', 'available'),
                (r.id, 'B', 'available')
            ON CONFLICT DO NOTHING;
        ELSE
            INSERT INTO beds (room_id, bed_number, status) VALUES
                (r.id, 'A', 'available'),
                (r.id, 'B', 'available'),
                (r.id, 'C', 'available'),
                (r.id, 'D', 'available')
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
END $$;

-- Insert sample patients
INSERT INTO patients (medical_record_number, first_name, last_name, date_of_birth, gender, payer_type, contact_phone) VALUES
    ('MRN001', 'John', 'Smith', '1965-03-15', 'male', 'medicare', '555-0101'),
    ('MRN002', 'Mary', 'Johnson', '1978-07-22', 'female', 'private', '555-0102'),
    ('MRN003', 'Robert', 'Williams', '1952-11-08', 'male', 'medicaid', '555-0103'),
    ('MRN004', 'Patricia', 'Brown', '1990-01-30', 'female', 'managed_care', '555-0104'),
    ('MRN005', 'Michael', 'Jones', '1985-09-12', 'male', 'medicare', '555-0105')
ON CONFLICT DO NOTHING;

-- ============================================
-- ENABLE REALTIME
-- ============================================
-- Run these in the Supabase dashboard SQL editor to enable realtime updates

ALTER PUBLICATION supabase_realtime ADD TABLE beds;
ALTER PUBLICATION supabase_realtime ADD TABLE bed_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE patients;
