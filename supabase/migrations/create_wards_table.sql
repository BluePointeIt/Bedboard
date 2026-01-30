-- Migration: Add capacity column to wards table and update policies
-- Run this if you already have the wards table without the capacity column

-- Add capacity column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'wards' AND column_name = 'capacity'
    ) THEN
        ALTER TABLE wards ADD COLUMN capacity INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add insert policy if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'wards' AND policyname = 'Authenticated users can insert wards'
    ) THEN
        CREATE POLICY "Authenticated users can insert wards" ON wards
            FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
END $$;

-- Add update policy if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'wards' AND policyname = 'Authenticated users can update wards'
    ) THEN
        CREATE POLICY "Authenticated users can update wards" ON wards
            FOR UPDATE TO authenticated USING (true);
    END IF;
END $$;

-- Add delete policy if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'wards' AND policyname = 'Authenticated users can delete wards'
    ) THEN
        CREATE POLICY "Authenticated users can delete wards" ON wards
            FOR DELETE TO authenticated USING (true);
    END IF;
END $$;

-- Enable realtime for wards table
ALTER PUBLICATION supabase_realtime ADD TABLE wards;
