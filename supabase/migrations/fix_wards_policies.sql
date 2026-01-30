-- Migration: Update wards table policies to allow anonymous access
-- Run this in Supabase SQL Editor to fix edit/delete permissions

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view wards" ON wards;
DROP POLICY IF EXISTS "Authenticated users can insert wards" ON wards;
DROP POLICY IF EXISTS "Authenticated users can update wards" ON wards;
DROP POLICY IF EXISTS "Authenticated users can delete wards" ON wards;

-- Create new policies that allow anyone (including anonymous users)
CREATE POLICY "Anyone can view wards" ON wards
    FOR SELECT USING (true);

CREATE POLICY "Anyone can insert wards" ON wards
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update wards" ON wards
    FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete wards" ON wards
    FOR DELETE USING (true);
