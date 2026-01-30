-- Migration: Update bed_assignments to reference residents instead of patients
-- Run this in Supabase SQL Editor

-- Drop the existing foreign key constraint on patient_id
ALTER TABLE bed_assignments
DROP CONSTRAINT IF EXISTS bed_assignments_patient_id_fkey;

-- Add new foreign key constraint to residents table
ALTER TABLE bed_assignments
ADD CONSTRAINT bed_assignments_patient_id_fkey
FOREIGN KEY (patient_id) REFERENCES residents(id) ON DELETE CASCADE;

-- Update the assigned_by constraint to allow anonymous users (remove NOT NULL or make it nullable)
ALTER TABLE bed_assignments
ALTER COLUMN assigned_by DROP NOT NULL;

-- Drop the existing foreign key on assigned_by if it references users
ALTER TABLE bed_assignments
DROP CONSTRAINT IF EXISTS bed_assignments_assigned_by_fkey;

-- Add RLS policies for bed_assignments
DROP POLICY IF EXISTS "Anyone can view bed_assignments" ON bed_assignments;
CREATE POLICY "Anyone can view bed_assignments" ON bed_assignments
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert bed_assignments" ON bed_assignments;
CREATE POLICY "Anyone can insert bed_assignments" ON bed_assignments
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update bed_assignments" ON bed_assignments;
CREATE POLICY "Anyone can update bed_assignments" ON bed_assignments
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can delete bed_assignments" ON bed_assignments;
CREATE POLICY "Anyone can delete bed_assignments" ON bed_assignments
    FOR DELETE USING (true);

-- Add RLS policies for beds table
DROP POLICY IF EXISTS "Anyone can view beds" ON beds;
CREATE POLICY "Anyone can view beds" ON beds
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert beds" ON beds;
CREATE POLICY "Anyone can insert beds" ON beds
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update beds" ON beds;
CREATE POLICY "Anyone can update beds" ON beds
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can delete beds" ON beds;
CREATE POLICY "Anyone can delete beds" ON beds
    FOR DELETE USING (true);

-- Add RLS policies for rooms table
DROP POLICY IF EXISTS "Anyone can view rooms" ON rooms;
CREATE POLICY "Anyone can view rooms" ON rooms
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert rooms" ON rooms;
CREATE POLICY "Anyone can insert rooms" ON rooms
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update rooms" ON rooms;
CREATE POLICY "Anyone can update rooms" ON rooms
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can delete rooms" ON rooms;
CREATE POLICY "Anyone can delete rooms" ON rooms
    FOR DELETE USING (true);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
